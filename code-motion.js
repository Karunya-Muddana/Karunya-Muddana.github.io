/* ============================================================
   Code motion — the anime.js layer for the code-and-pencil bits.

   - Eyebrow labels decode out of symbols as they arrive.
   - The hero prompt types what's going on right now.
   - Experience is a git graph drawn in pencil; the line follows
     the scroll and each commit lands as the pencil reaches it.
   - PR cards scribble their "diff", then get rubber-stamped.
   - engraph's terminal types its install command.
   - The house-price chart's bars grow; the tuned one gets circled.
   - Sticky notes can be peeled off and moved around.
   - Stack icons hop in a ripple from whichever one you touch.

   Everything is decoration over a page that already reads fine:
   with reduced motion, or if this module never loads, the static
   content is what people get.
   ============================================================ */
import {
  animate, createTimeline, createDraggable, onScroll,
  createDrawable, scrambleText, stagger, spring
} from './vendor/anime.min.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();

// Run `fn` once, the first time `el` is properly on screen.
function onceInView(el, fn, threshold = 0.35) {
  if (!('IntersectionObserver' in window)) return fn(el);
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      fn(el);
    });
  }, { threshold });
  io.observe(el);
}

// rough.js is a deferred classic script; modules can run before it.
function whenRough() {
  return new Promise((res) => {
    let tries = 0;
    (function check() {
      if (window.rough) return res(window.rough);
      if (++tries > 80) return res(null);
      setTimeout(check, 75);
    })();
  });
}

// Deterministic jitter, so the sketches look the same on every visit.
function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

if (!reduce) {
  decodeEyebrows();
  heroPrompt();
  typeComments();
  fontsReady.then(() => whenRough()).then((rough) => {
    gitGraph(rough);
    prCards(rough);
    houseChart(rough);
  });
  engraphTerminal();
  stackHop();
  if (finePointer) peelableStickies();
}

/* ---------- Eyebrows: decode from symbols ---------- */
function decodeEyebrows() {
  document.querySelectorAll('.eyebrow').forEach((eb) => {
    const text = Array.from(eb.childNodes).find((n) => n.nodeType === 3 && n.nodeValue.trim());
    if (!text) return;
    const span = document.createElement('span');
    span.dataset.decode = '';
    span.textContent = text.nodeValue.trim();
    eb.replaceChild(span, text);
    onceInView(eb, () => {
      animate(span, {
        textContent: scrambleText({ chars: '{}[]/\\=+*_;:01', settleDuration: 260, revealRate: 40 }),
      });
    }, 0.9);
  });
}

/* ---------- Hero: a prompt that types what's happening ---------- */
function heroPrompt() {
  const term = document.querySelector('.hero-term');
  if (!term) return;
  const out = term.querySelector('.term-out');
  const cmd = term.querySelector('.term-cmd');
  const note = term.querySelector('.term-note');

  // Screen readers get the first line once; the loop is visual only.
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = 'Now: ' + note.textContent.replace(/^#\s*/, '');
  term.appendChild(sr);
  out.setAttribute('aria-hidden', 'true');

  const LINES = [
    ['cat now.txt', '# AI engineer on a healthcare certification project, Germany'],
    ['git log --author=karunya --merged', '# fixes upstream in ipython and git-cola'],
    ['pip install engraph', '# long-term memory for AI coding assistants'],
    ['ls ~/hackathons', '# native: smart india hackathon 2026'],
  ];
  let i = 0, timer = 0, running = false, visible = true;
  const wait = (ms) => new Promise((r) => { timer = setTimeout(r, ms); });

  function typeInto(el, str, speed) {
    const o = { n: 0 };
    return animate(o, {
      n: str.length,
      duration: str.length * speed,
      ease: 'linear',
      modifier: Math.round,
      onUpdate: () => { el.textContent = str.slice(0, o.n); },
    }).then(() => {});
  }
  function erase(el, speed) {
    const str = el.textContent;
    const o = { n: str.length };
    return animate(o, {
      n: 0,
      duration: Math.max(1, str.length) * speed,
      ease: 'linear',
      modifier: Math.round,
      onUpdate: () => { el.textContent = str.slice(0, o.n); },
    }).then(() => {});
  }

  async function loop() {
    running = true;
    // The first line is already printed in the HTML; let it sit first.
    await wait(4200);
    while (visible) {
      i = (i + 1) % LINES.length;
      note.style.opacity = '0';
      await erase(cmd, 18);
      note.textContent = '';
      await wait(260);
      await typeInto(cmd, LINES[i][0], 46 + Math.random() * 20);
      await wait(180);
      note.textContent = LINES[i][1];
      animate(note, { opacity: [0, 1], duration: 420, ease: 'outQuad' });
      await wait(3600);
    }
    running = false;
  }

  // Only spend frames while the hero is on screen and the tab is open.
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting && !document.hidden;
    if (visible && !running) loop();
  });
  io.observe(term);
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden && term.getBoundingClientRect().bottom > 0;
    if (visible && !running) loop();
  });
}

/* ---------- `$ git log ...` lines type themselves ---------- */
function typeComments() {
  document.querySelectorAll('.code-comment').forEach((el) => {
    const str = el.textContent;
    el.textContent = '';
    el.style.minHeight = '1.5em';
    onceInView(el, () => {
      const o = { n: 0 };
      animate(o, {
        n: str.length,
        duration: str.length * 38,
        delay: 250,
        ease: 'linear',
        modifier: Math.round,
        onUpdate: () => { el.textContent = str.slice(0, o.n); },
      });
    }, 1);
  });
}

/* ---------- Experience: a git graph in pencil ---------- */
function gitGraph(rough) {
  const log = document.querySelector('.xp-log');
  if (!log || !rough) return;
  const commits = Array.from(log.querySelectorAll('.xp-commit'));
  const nodes = commits.map((c) => c.querySelector('.xp-node'));
  if (!nodes.length) return;

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'xp-branch');
  svg.setAttribute('aria-hidden', 'true');
  log.prepend(svg);

  // Commit contents wait for the pencil.
  const parts = (c) => [
    ...Array.from(c.children).filter((k) => !k.matches('.xp-node, .xp-diff')),
    ...c.querySelectorAll('.xp-diff li'),
  ];
  commits.forEach((c) => {
    parts(c).forEach((k) => { k.style.opacity = '0'; });
    c.querySelector('.xp-node').style.transform = 'scale(0)';
  });

  let scroller = null, centres = [], landed = new Set();

  function draw() {
    const lr = log.getBoundingClientRect();
    centres = nodes.map((n) => {
      const r = n.getBoundingClientRect();
      return { x: r.left + r.width / 2 - lr.left, y: r.top + r.height / 2 - lr.top };
    });
    const x = centres[0].x;
    const y0 = centres[0].y, y1 = centres[centres.length - 1].y;
    svg.setAttribute('viewBox', `0 0 ${Math.max(48, x * 2)} ${lr.height}`);
    svg.style.width = Math.max(48, x * 2) + 'px';
    svg.innerHTML = '';

    // A wobbly vertical through every node, plus a little side branch
    // off the open-source commit, the way `--graph` forks a line.
    const rnd = seeded(7);
    const pts = [];
    for (let y = y0; y < y1; y += 70) pts.push([x + (rnd() - 0.5) * 3.2, y]);
    pts.push([x, y1]);
    const rc = rough.svg(svg);
    const main = rc.curve(pts, { roughness: 0.9, bowing: 0.6, strokeWidth: 1.8, stroke: '#1A1916', seed: 12 });
    svg.appendChild(main);
    if (centres[1] && centres[2]) {
      const a = centres[1].y + 14, b = centres[2].y - 14, bx = x + 22;
      const fork = rc.curve([[x, a], [bx, a + 30], [bx, (a + b) / 2], [bx, b - 30], [x, b]],
        { roughness: 0.8, bowing: 0.4, strokeWidth: 1.2, stroke: 'rgba(26,25,22,0.55)', seed: 19 });
      svg.appendChild(fork);
    }

    const paths = svg.querySelectorAll('path');
    const drawables = createDrawable(paths);
    if (scroller) scroller.revert();
    const anim = animate(drawables, {
      draw: ['0 0', '0 1'],
      ease: 'linear',
      autoplay: (scroller = onScroll({
        target: log,
        // Keep the pencil tip about three quarters down the screen.
        enter: 'bottom-=25% top',
        leave: 'bottom-=25% bottom',
        sync: 0.35,
        onUpdate: (self) => land(self.progress),
        // Once the pencil reaches the bottom, the graph stays drawn.
        onSyncComplete: (self) => {
          if (self.progress < 1) return;
          self.revert();
          animate(drawables, { draw: '0 1', duration: 0 });
        },
      })),
    });
    return anim;
  }

  // Each node's share of the line, from the top. A commit lands when
  // the pencil has drawn past it, and stays landed.
  function land(p) {
    const y0 = centres[0].y, span = centres[centres.length - 1].y - y0 || 1;
    centres.forEach((c, i) => {
      if (landed.has(i) || p < (c.y - y0) / span - 0.02) return;
      landed.add(i);
      animate(nodes[i], { scale: [0, 1], ease: spring({ bounce: 0.55, duration: 520 }) });
      animate(parts(commits[i]), {
        opacity: [0, 1],
        translateX: [-14, 0],
        delay: stagger(55, { start: 80 }),
        duration: 520,
        ease: 'outCubic',
      });
    });
  }

  draw();
  // Line positions depend on layout; redraw on width changes only.
  let w = innerWidth, t = 0;
  addEventListener('resize', () => {
    if (innerWidth === w) return;
    w = innerWidth;
    clearTimeout(t);
    t = setTimeout(draw, 160);
  });
}

/* ---------- PR cards: scribbled diff, then the stamp ---------- */
function prCards(rough) {
  document.querySelectorAll('.pr-card').forEach((card, ci) => {
    const svg = card.querySelector('.pr-scribble svg');
    const stamp = card.querySelector('.stamp');
    const merged = card.classList.contains('is-merged');
    let drawables = null;

    if (svg && rough) {
      const rc = rough.svg(svg);
      const rnd = seeded(31 + ci * 11);
      // Five lines of "code": indents and lengths vary, a couple are
      // marked as added or removed in the gutter.
      const rows = 5, top = 6, gap = 13;
      for (let r = 0; r < rows; r++) {
        const y = top + r * gap;
        const indent = [0, 14, 14, 28, 0][r];
        const len = 60 + rnd() * 110;
        const mark = r === 2 ? '+' : r === 3 ? (merged ? '+' : '-') : '';
        const col = mark === '+' ? '#4E6B3A' : mark === '-' ? '#B4532A' : 'rgba(26,25,22,0.42)';
        if (mark) {
          svg.appendChild(rc.line(2, y, 8, y, { stroke: col, strokeWidth: 1.6, roughness: 0.6, seed: 90 + r }));
          if (mark === '+') svg.appendChild(rc.line(5, y - 3, 5, y + 3, { stroke: col, strokeWidth: 1.6, roughness: 0.6, seed: 95 + r }));
        }
        svg.appendChild(rc.line(18 + indent, y, 18 + indent + len, y + (rnd() - 0.5) * 2,
          { stroke: col, strokeWidth: mark ? 2.4 : 1.8, roughness: 1.1, bowing: 0.8, seed: 50 + r + ci * 7 }));
      }
      drawables = createDrawable(svg.querySelectorAll('path'));
      animate(drawables, { draw: '0 0', duration: 0 });
    }
    if (stamp) stamp.style.opacity = '0';

    onceInView(card, () => {
      const tl = createTimeline({ defaults: { ease: 'outQuad' } });
      if (drawables) tl.add(drawables, { draw: ['0 0', '0 1'], duration: 420, delay: stagger(90) });
      if (stamp) {
        tl.add(stamp, {
          opacity: [0, 0.92],
          scale: [2.6, 1],
          rotate: merged ? [-34, -11] : [24, 7],
          ease: spring({ bounce: 0.35, duration: 460 }),
        }, '-=120');
      }
    }, 0.45);
  });
}

/* ---------- engraph: type the install command ---------- */
function engraphTerminal() {
  const code = document.querySelector('.term-type');
  if (!code) return;
  const str = code.dataset.type || code.textContent;
  const dim = code.closest('.term-body').querySelector('.term-dim');
  code.textContent = '';
  if (dim) dim.style.opacity = '0';
  onceInView(code.closest('.term'), () => {
    const o = { n: 0 };
    animate(o, {
      n: str.length,
      duration: str.length * 70,
      delay: 300,
      ease: 'linear',
      modifier: Math.round,
      onUpdate: () => { code.textContent = str.slice(0, o.n); },
      onComplete: () => { if (dim) animate(dim, { opacity: [0, 1], translateY: [4, 0], duration: 500, delay: 250 }); },
    });
  }, 0.6);
}

/* ---------- House price: bars grow, the tuned one gets circled ---------- */
function houseChart(rough) {
  const svg = document.querySelector('.sketch-chart svg');
  if (!svg || !rough) return;
  const rc = rough.svg(svg);
  const ns = 'http://www.w3.org/2000/svg';
  const W = 330, base = 104, n = 11, slot = (W - 20) / n, bw = slot * 0.56;
  const rnd = seeded(5);
  const best = 8;
  const groups = [];

  svg.appendChild(rc.line(4, base, W - 4, base + 1, { stroke: '#1A1916', strokeWidth: 1.3, roughness: 0.8, seed: 3 }));
  for (let i = 0; i < n; i++) {
    const h = i === best ? 86 : 26 + rnd() * 46;
    const x = 12 + i * slot;
    const g = document.createElementNS(ns, 'g');
    g.appendChild(rc.rectangle(x, base - h, bw, h, {
      stroke: '#1A1916', strokeWidth: 1.1, roughness: 1.1, seed: 20 + i,
      fill: i === best ? '#4E6B3A' : 'rgba(26,25,22,0.5)',
      fillStyle: i === best ? 'cross-hatch' : 'hachure', hachureGap: i === best ? 3.2 : 4.4, fillWeight: 0.9,
    }));
    g.style.transformBox = 'fill-box';
    g.style.transformOrigin = '50% 100%';
    svg.appendChild(g);
    groups.push(g);
  }
  const bx = 12 + best * slot + bw / 2;
  const ring = rc.ellipse(bx, base - 86 - 4, bw + 22, 26, { stroke: '#B4532A', strokeWidth: 1.6, roughness: 1.4, seed: 44 });
  svg.appendChild(ring);
  const ringDraw = createDrawable(ring.querySelectorAll('path'));

  groups.forEach((g) => { g.style.transform = 'scaleY(0)'; });
  animate(ringDraw, { draw: '0 0', duration: 0 });
  onceInView(svg, () => {
    createTimeline()
      .add(groups, { scaleY: [0, 1], duration: 560, delay: stagger(55), ease: spring({ bounce: 0.3, duration: 560 }) })
      .add(ringDraw, { draw: ['0 0', '0 1'], duration: 520, ease: 'inOutQuad' }, '-=150');
  }, 0.6);
}

/* ---------- Sticky notes peel off the cards ---------- */
function peelableStickies() {
  let told = false;
  document.querySelectorAll('#work .sticky').forEach((note) => {
    const r = parseFloat(getComputedStyle(note).getPropertyValue('--r')) || -4;
    note.classList.add('is-draggable');
    note.title = 'drag me';
    // Hand the rotation to anime so dragging composes with it.
    animate(note, { rotate: r, duration: 0 });
    createDraggable(note, {
      container: '#work',
      releaseStiffness: 120,
      releaseDamping: 14,
      onGrab: (d) => {
        note.style.zIndex = '30';
        animate(note, { scale: 1.08, rotate: r * 0.3, duration: 220, ease: 'outQuad' });
        if (!told) {
          told = true;
          window.dispatchEvent(new CustomEvent('mascot:say', { detail: { text: 'hey, that was pinned there!', mood: 'surprised' } }));
        }
      },
      onRelease: () => {
        animate(note, { scale: 1, rotate: r, duration: 420, ease: spring({ bounce: 0.5, duration: 420 }) });
      },
    });
  });
}

/* ---------- Stack: icons hop in a ripple ---------- */
function stackHop() {
  const cards = Array.from(document.querySelectorAll('.stack-card'));
  const icons = cards.map((c) => c.querySelector('img'));
  if (!icons.length) return;
  let busy = false;
  cards.forEach((card, i) => {
    card.addEventListener('pointerenter', () => {
      if (busy) return;
      busy = true;
      animate(icons, {
        translateY: [0, -12, 0],
        rotate: [0, (j) => (j % 2 ? 8 : -8), 0],
        duration: 560,
        delay: stagger(60, { from: i }),
        ease: 'outQuad',
        onComplete: () => { busy = false; },
      });
    });
  });
}
