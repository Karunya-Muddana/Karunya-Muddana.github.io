/* ============================================================
   Page → plain text, for the chat model's context.

   Keeps what a visitor reads (headings, paragraphs, project cards,
   links) and drops what they don't: scripts, SVG, decoration, the
   duplicated marquee, nav menus, the contact form. Plain JS with
   no DOM, so it runs the same in the Worker and in Node for tests.
   ============================================================ */

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const BLOCK = new Set(['p', 'div', 'section', 'article', 'header', 'footer', 'main', 'figure', 'figcaption',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'blockquote', 'tr', 'table', 'br', 'hr']);
const SKIP_TAGS = new Set(['nav', 'form', 'button', 'select', 'textarea', 'canvas', 'iframe']);
// Decoration, duplicates and UI chrome. Matched against class names.
const SKIP_CLASSES = ['mobile-overlay', 'work-strip', 'doodle', 'printout', 'scroll-cue', 'hero-guides',
  'cursor-ring', 'cursor-dot', 'scroll-progress', 'plane-track', 'about-progress', 'links', 'read-more',
  'hero-ctas', 'ctas', 'copy-chip', 'dogear', 'grass-edge', 'diamond-break', 'form-status',
  'sticky', 'annotation'];   // sticky notes and photo scribbles are jokes, not facts

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', mdash: '—', ndash: '–',
  hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', rarr: '→', larr: '←', copy: '©',
  times: '×', bull: '•', deg: '°'
};

function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function attr(attrs, name) {
  const m = attrs.match(new RegExp('\\s' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i'));
  return m ? decode(m[2] ?? m[3] ?? m[4] ?? '') : null;
}

function skipEl(tag, attrs) {
  if (SKIP_TAGS.has(tag)) return true;
  if (attr(attrs, 'aria-hidden') === 'true') return true;
  const cls = attr(attrs, 'class');
  if (cls) {
    const list = cls.split(/\s+/);
    if (list.some(c => SKIP_CLASSES.includes(c) || c.startsWith('paper-'))) return true;
  }
  return false;
}

/**
 * @param {string} html  full page HTML
 * @param {string} base  absolute URL of the page, to resolve relative links
 * @returns {string} readable text with light markdown structure
 */
export function htmlToText(html, base) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];

  // Drop whole raw-text blocks before tokenising: they can contain '<'.
  let body = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!doctype[^>]*>/i, '')
    .replace(/<head[\s\S]*?<\/head>/i, '')
    .replace(/<(script|style|svg|noscript|template)\b[\s\S]*?<\/\1>/gi, '');

  const out = [];
  const stack = [];          // { tag, skip, href, text }
  let skipping = 0;

  const TOKEN = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|[^<]+|</g;
  let m;
  while ((m = TOKEN.exec(body))) {
    const [raw, closing, tagRaw, attrs = '', selfClose] = m;
    if (!tagRaw) {
      if (!skipping) {
        // Source newlines are just indentation; only block tags break lines.
        const text = decode(raw.replace(/\s+/g, ' '));
        const a = stack.findLast(s => s.tag === 'a');
        if (a) a.text += text;
        out.push(text);
      }
      continue;
    }
    const tag = tagRaw.toLowerCase();

    if (closing) {
      // Pop back to the matching open tag (forgiving of sloppy HTML).
      const i = stack.map(s => s.tag).lastIndexOf(tag);
      if (i === -1) continue;
      while (stack.length > i) {
        const el = stack.pop();
        if (el.skip) skipping--;
        if (!skipping && el.tag === 'a' && el.href) {
          const t = el.text.replace(/\s+/g, ' ').trim();
          const bare = el.href.replace(/^mailto:/, '').replace(/^https?:\/\//, '').replace(/\/$/, '');
          if (!t.toLowerCase().includes(bare.toLowerCase())) out.push(` (${el.href})`);
        }
        if (!skipping && BLOCK.has(el.tag)) out.push('\n');
      }
      continue;
    }

    if (VOID.has(tag) || selfClose) {
      if (!skipping && (tag === 'br' || tag === 'hr')) out.push('\n');
      continue;
    }

    const skip = skipEl(tag, attrs);
    const el = { tag, skip, href: null, text: '' };
    if (tag === 'a') {
      const href = attr(attrs, 'href');
      if (href && /^(https?:|mailto:)/i.test(href)) el.href = href;
      else if (href && base && /\.html(#|$)/.test(href)) el.href = null;  // internal page links: text is enough
    }
    stack.push(el);
    if (skip) { skipping++; continue; }
    if (skipping) continue;

    if (BLOCK.has(tag)) out.push('\n');
    if (tag === 'h1' || tag === 'h2') out.push('# ');
    else if (/^h[3-6]$/.test(tag)) out.push('## ');
    else if (tag === 'li') out.push('- ');
  }

  const lines = out.join('')
    .split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(l => l && !/^[#\-·•→↓↗\s]*$/.test(l));

  // Drop repeated sentences (cards and headers sometimes echo each other).
  // Short lines are left alone: "Python" on two cards is two facts.
  const seen = new Set();
  const kept = [];
  for (const l of lines) {
    const k = l.toLowerCase();
    if (l.length > 40 && seen.has(k)) continue;
    seen.add(k);
    kept.push(l);
  }

  return (title ? `PAGE: ${decode(title).trim()}\n` : '') + kept.join('\n');
}
