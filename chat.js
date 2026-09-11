/* ============================================================
   CHAT logic — Notebook AI conversation
   ============================================================ */
(function() {
  'use strict';

  const API_BASE = 'https://karunya-chat.karunya-muddana.workers.dev';

  const messagesEl  = document.getElementById('messages');
  const inputEl     = document.getElementById('chat-input');
  const formEl      = document.getElementById('composer');
  const sendBtn     = document.getElementById('send-btn');
  const freshBtn    = document.getElementById('fresh-btn');

  if (!messagesEl || !inputEl || !formEl) return;

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const suggestedTpl = document.getElementById('suggested');
  const suggestedCopy = suggestedTpl ? suggestedTpl.cloneNode(true) : null;

  const history = [];
  let busy = false;
  let asked = 0;
  let wokeSaid = false;

  // Hand-writing rhythm. A real pen doesn't move at one speed: it runs on
  // through a word, hesitates at a comma, and stops properly at a full stop.
  const PACE = {
    base:       17,   // ms per character mid-word
    jitter:     7,    // random 0..n added per character
    space:      34,   // between words
    comma:      130,  // , ; :
    sentence:   290,  // . ! ?
    dash:       90,   // - and en/em dashes
  };

  // Literal characters, no escapes: em dash, en dash, hyphen.
  const SENTENCE_END = /[.!?]/;
  const CLAUSE_END   = /[,;:]/;
  const DASHES       = /[—–-]/;

  // The Render free tier sleeps; the first reply after a nap is slow.
  const COLD_START_MS = 5000;

  // ---------- Mascot hooks (no-ops if the mascot isn't on the page) ----------
  const mascot = (type, detail) => window.dispatchEvent(new CustomEvent('mascot:' + type, { detail }));

  // ---------- Wiring ----------
  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = inputEl.value.trim();
    if (!message || busy) return;
    inputEl.value = '';
    syncSendBtn();
    ask(message, true);
  });

  // Quick prompts (delegated, so they still work after the page is torn out)
  messagesEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.suggest-btn');
    if (!btn || busy) return;
    ask(btn.textContent.trim(), true);
  });

  let lastLook = 0;
  inputEl.addEventListener('input', () => {
    syncSendBtn();
    const now = performance.now();
    if (now - lastLook > 500) { lastLook = now; mascot('look', { el: inputEl, ms: 1400 }); }
  });

  if (freshBtn) freshBtn.addEventListener('click', tearOutPage);

  // Popping the keyboard on load is rude on a phone; only focus for mice.
  if (finePointer) setTimeout(() => inputEl.focus(), 400);

  function syncSendBtn() {
    if (sendBtn) sendBtn.classList.toggle('ready', !!inputEl.value.trim());
  }

  // ---------- Conversation ----------
  async function ask(message, echo) {
    if (busy) return;
    busy = true;
    inputEl.disabled = true;
    if (sendBtn) sendBtn.disabled = true;

    hideSuggestions();
    if (echo) appendUserMessage(message);
    if (freshBtn) freshBtn.hidden = false;

    asked++;
    if (echo && (asked === 1 || Math.random() < 0.3)) mascot('say', { key: 'asked', soft: true, hold: 1400 });
    else mascot('mood', { mood: 'excited' });

    const indicator = appendWritingIndicator();
    // Thinking face while it waits; if the server is napping, a chai too.
    mascot('state', { expr: 'think', mark: 'dots' });
    const slowTimer = setTimeout(() => {
      indicator.querySelector('.writing-dots').firstChild.nodeValue = 'waking the server up, the first reply can take ~30s';
      mascot('state', { expr: 'sleepy', mark: 'zz', prop: 'chai' });
      if (!wokeSaid) { wokeSaid = true; mascot('say', { key: 'waking', hold: 3200 }); }
    }, COLD_START_MS);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: history.slice(-10) }),
      });

      clearTimeout(slowTimer);
      indicator.remove();
      mascot('state');

      if (!res.ok) {
        if (res.status === 429) {
          appendError('that’s a few too many at once — give it about a minute and ask again.', message);
        } else if (res.status >= 500) {
          appendError('my end fell over answering that one. worth another go; if it keeps happening, email me instead.', message);
        } else {
          appendError('that one didn’t get through. try rephrasing it?', null);
        }
        return;
      }

      const data = await res.json();
      const reply = (data && data.response) ? data.response : "(I came back empty-handed — try rephrasing?)";
      appendAIMessage(reply);

      history.push({ role: 'user', content: message });
      history.push({ role: 'assistant', content: reply });
      // keep payload light
      while (history.length > 20) history.splice(0, 2);

    } catch (err) {
      clearTimeout(slowTimer);
      indicator.remove();
      mascot('state');
      appendError('can’t reach my end from here — either your connection dropped or the server is waking up. it sleeps when nobody’s around, so give it a moment and try again.', message);
    } finally {
      busy = false;
      inputEl.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
      if (finePointer) setTimeout(() => inputEl.focus(), 200);
    }
  }

  function hideSuggestions() {
    const s = document.getElementById('suggested');
    if (!s) return;
    s.style.transition = 'opacity 220ms ease, transform 220ms ease';
    s.style.opacity = '0';
    s.style.transform = 'translateY(-6px)';
    setTimeout(() => s.remove(), 240);
  }

  function tearOutPage() {
    if (busy) return;
    history.length = 0;
    asked = 0;
    messagesEl.classList.add('tearing');
    setTimeout(() => {
      messagesEl.innerHTML = '';
      messagesEl.classList.remove('tearing');
      if (suggestedCopy) messagesEl.appendChild(suggestedCopy.cloneNode(true));
      freshBtn.hidden = true;
      mascot('say', { text: 'fresh page! ask away.', hold: 1600 });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (window.__lenis) window.__lenis.scrollTo(0, { duration: 0.8 });
      if (finePointer) inputEl.focus();
    }, 360);
  }

  // ---------- Messages ----------
  function stamp() {
    const el = document.createElement('span');
    el.className = 'stamp';
    el.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return el;
  }

  function speakerEl(who) {
    const s = document.createElement('span');
    s.className = 'speaker';
    s.textContent = who;
    return s;
  }

  function appendUserMessage(text) {
    const block = document.createElement('div');
    block.className = 'msg msg-user';
    block.appendChild(speakerEl('you'));

    const content = document.createElement('span');
    content.className = 'content';
    content.textContent = text;
    block.appendChild(content);
    block.appendChild(stamp());

    messagesEl.appendChild(block);
    scrollToBottom(true);
  }

  function appendError(text, retryMessage) {
    const block = appendAIMessage(text, true);
    mascot('say', { key: 'oops', mood: 'sad', soft: true });
    if (!retryMessage) return;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'retry-btn';
    retry.textContent = 'try again';
    retry.addEventListener('click', () => {
      if (busy) return;
      block.remove();
      ask(retryMessage, false);
    });
    block.appendChild(retry);
  }

  function appendAIMessage(text, isError) {
    const block = document.createElement('div');
    block.className = 'msg msg-ai' + (isError ? ' msg-error' : '');
    block.appendChild(speakerEl('karunya'));

    // Screen readers get the whole reply at once, not letter by letter.
    const spoken = document.createElement('span');
    spoken.className = 'chat-sr';
    spoken.textContent = text;
    block.appendChild(spoken);

    const content = document.createElement('span');
    content.className = 'content writing';
    content.setAttribute('aria-hidden', 'true');
    block.appendChild(content);
    messagesEl.appendChild(block);

    // Diary effect — ink-on-paper, one character at a time.
    // Words are wrapped in an inline-block container so the browser never
    // breaks mid-word (e.g. "ML-OPS"). Each letter gets a tiny random
    // rotation so it looks genuinely hand-written.
    // elapsedMs accumulates a real duration instead of counting
    // characters, so punctuation can buy a pause without shifting
    // everything after it by the same fixed amount.
    let elapsedMs = 0;

    function advance(ch) {
      const before = elapsedMs;
      elapsedMs += PACE.base + Math.random() * PACE.jitter;
      if (SENTENCE_END.test(ch)) elapsedMs += PACE.sentence;
      else if (CLAUSE_END.test(ch)) elapsedMs += PACE.comma;
      else if (DASHES.test(ch)) elapsedMs += PACE.dash;
      return before;
    }

    function writeSegment(seg, lineBold) {
      let host = content;
      if (seg.href) {
        host = document.createElement('a');
        host.href = seg.href;
        if (!seg.href.startsWith('mailto:')) { host.target = '_blank'; host.rel = 'noopener'; }
        host.tabIndex = -1;   // the screen-reader copy carries the text
        content.appendChild(host);
      }
      const cls = 'ink-word' + (seg.b || lineBold ? ' ink-b' : '') + (seg.i ? ' ink-i' : '') + (seg.code ? ' ink-code' : '');

      seg.text.split(/( +)/).forEach(token => {
        if (!token) return;
        if (/^ +$/.test(token)) {
          for (let i = 0; i < token.length; i++) {
            const sp = document.createElement('span');
            sp.className = 'diary-char';
            sp.textContent = ' ';
            sp.style.animationDelay = elapsedMs.toFixed(0) + 'ms';
            elapsedMs += PACE.space;
            host.appendChild(sp);
          }
          return;
        }
        const wordEl = document.createElement('span');
        wordEl.className = cls;
        if (seg.code) wordEl.style.animationDelay = elapsedMs.toFixed(0) + 'ms';
        for (let i = 0; i < token.length; i++) {
          const ch = document.createElement('span');
          ch.className = 'diary-char word-char';
          ch.textContent = token[i];
          // subtle random per-character tilt — looks hand-written, not typed
          ch.style.setProperty('--r', (Math.random() * 4 - 2).toFixed(2) + 'deg');
          ch.style.animationDelay = advance(token[i]).toFixed(0) + 'ms';
          wordEl.appendChild(ch);
        }
        host.appendChild(wordEl);
      });
    }

    text.replace(/\r/g, '').split('\n').forEach((raw, li) => {
      if (li > 0) {
        content.appendChild(document.createElement('br'));
        elapsedMs += PACE.sentence;
      }
      let line = raw;
      let bold = false;
      const heading = line.match(/^\s{0,3}#{1,6}\s+(.*)$/);
      if (heading) { line = heading[1]; bold = true; }
      const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
      if (bullet) line = '• ' + bullet[1];
      parseInline(line).forEach(seg => writeSegment(seg, bold));
    });

    // Remove the quill cursor once the last character has finished animating
    const totalMs = elapsedMs;
    setTimeout(() => {
      content.classList.remove('writing');
      block.insertBefore(stamp(), content.nextSibling);
      if (isError) return;
      mascot('state');
      if (history.length === 2) mascot('say', { key: 'replied', mood: 'joy', soft: true, hold: 1800 });
    }, totalMs + 560);

    // Reading glasses on while the reply writes itself, eyes on the ink.
    if (!isError) {
      mascot('state', { prop: 'glasses' });
      mascot('look', { el: block, ms: totalMs + 400 });
    }

    // Follow the ink down the page, unless the reader has scrolled up.
    let elapsed = 0;
    const scrollInterval = setInterval(() => {
      scrollToBottom(false);
      elapsed += 250;
      if (elapsed >= totalMs + 400) clearInterval(scrollInterval);
    }, 250);
    scrollToBottom(true);
    return block;
  }

  // Light markdown: **bold**, *italic*, `code`, [links](url), bare URLs and
  // emails. Anything else stays as written. Only http(s) and mailto links.
  const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|https?:\/\/[^\s<>()]+|[\w.+-]+@[\w-]+\.[\w.-]*\w|\*[^*\s][^*]*\*)/g;
  function parseInline(str) {
    const out = [];
    let last = 0, m;
    INLINE.lastIndex = 0;
    while ((m = INLINE.exec(str))) {
      if (m.index > last) out.push({ text: str.slice(last, m.index) });
      const t = m[0];
      if (t.startsWith('**') || t.startsWith('__')) out.push({ text: t.slice(2, -2), b: true });
      else if (t.startsWith('`')) out.push({ text: t.slice(1, -1), code: true });
      else if (t.startsWith('[')) {
        const lm = t.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
        const href = safeHref(lm[2]);
        out.push(href ? { text: lm[1], href } : { text: lm[1] });
      } else if (t.startsWith('http')) {
        // Leave a sentence's full stop outside the link.
        const trail = (t.match(/[.,!?;:'"]+$/) || [''])[0];
        const url = trail ? t.slice(0, -trail.length) : t;
        out.push({ text: url.replace(/^https?:\/\//, '').replace(/\/$/, ''), href: url });
        if (trail) out.push({ text: trail });
      } else if (t.includes('@') && !t.startsWith('*')) out.push({ text: t, href: 'mailto:' + t });
      else out.push({ text: t.slice(1, -1), i: true });
      last = m.index + t.length;
    }
    if (last < str.length) out.push({ text: str.slice(last) });
    return out;
  }
  function safeHref(u) {
    if (/^https?:\/\//i.test(u)) return u;
    if (/^mailto:/i.test(u)) return u;
    return null;
  }

  function appendWritingIndicator() {
    const block = document.createElement('div');
    block.className = 'msg msg-ai msg-writing';
    block.appendChild(speakerEl('karunya'));

    const content = document.createElement('span');
    content.className = 'content';

    const dots = document.createElement('span');
    dots.className = 'writing-dots';
    dots.innerHTML = 'writing<span>.</span><span>.</span><span>.</span>';
    content.appendChild(dots);

    block.appendChild(content);
    messagesEl.appendChild(block);
    scrollToBottom(true);
    return block;
  }

  // `force` scrolls regardless; otherwise only if the reader is already
  // near the bottom, so scrolling up to re-read isn't yanked back down.
  function scrollToBottom(force) {
    requestAnimationFrame(() => {
      const bottom = document.documentElement.scrollHeight;
      if (!force && bottom - (window.scrollY + window.innerHeight) > 260) return;
      // When the inertial scroller is running it owns the scroll position —
      // a native smooth scroll would just be fought and snapped back.
      if (window.__lenis) {
        window.__lenis.scrollTo(bottom, { duration: 0.8 });
        return;
      }
      window.scrollTo({ top: bottom, behavior: 'smooth' });
    });
  }
})();
