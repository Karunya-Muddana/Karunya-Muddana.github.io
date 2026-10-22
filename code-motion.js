/* ============================================================
   Code motion — the anime.js layer.

   Two things, on purpose:
   - Experience is a git graph drawn in pencil. The line draws
     once, when the log first comes into view. The commits are
     readable the whole time; only the pencil moves.
   - Sticky notes on the project cards can be peeled off and moved.
     That one is an interaction, so it springs a little on release.

   With reduced motion the graph is simply drawn, and nothing else
   here runs.
   ============================================================ */
import { animate, createDraggable, createDrawable, spring } from './vendor/anime.min.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();

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

// Deterministic jitter, so the sketch looks the same on every visit.
function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

fontsReady.then(whenRough).then(gitGraph);
if (!reduce && finePointer) peelableStickies();

/* ---------- Experience: a git graph in pencil ---------- */
function gitGraph(rough) {
  const log = document.querySelector('.xp-log');
  if (!log || !rough) return;
  const nodes = Array.from(log.querySelectorAll('.xp-node'));
  if (!nodes.length) return;

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'xp-branch');
  svg.setAttribute('aria-hidden', 'true');
  log.prepend(svg);

  let drawn = false;

  function draw() {
    const lr = log.getBoundingClientRect();
    const c = nodes.map((n) => {
      const r = n.getBoundingClientRect();
      return { x: r.left + r.width / 2 - lr.left, y: r.top + r.height / 2 - lr.top };
    });
    const x = c[0].x, y0 = c[0].y, y1 = c[c.length - 1].y;
    const w = Math.max(48, x * 2);
    svg.setAttribute('viewBox', `0 0 ${w} ${lr.height}`);
    svg.style.width = w + 'px';
    svg.innerHTML = '';

    // A wobbly vertical through every node, plus a side branch off the
    // open-source commit, the way `--graph` forks a line.
    const rnd = seeded(7);
    const pts = [];
    for (let y = y0; y < y1; y += 70) pts.push([x + (rnd() - 0.5) * 3.2, y]);
    pts.push([x, y1]);
    const rc = rough.svg(svg);
    svg.appendChild(rc.curve(pts, { roughness: 0.9, bowing: 0.6, strokeWidth: 1.8, stroke: '#1A1916', seed: 12 }));
    if (c[1] && c[2]) {
      const a = c[1].y + 14, b = c[2].y - 14, bx = x + 22;
      svg.appendChild(rc.curve([[x, a], [bx, a + 30], [bx, (a + b) / 2], [bx, b - 30], [x, b]],
        { roughness: 0.8, bowing: 0.4, strokeWidth: 1.2, stroke: 'rgba(26,25,22,0.55)', seed: 19 }));
    }
    return createDrawable(svg.querySelectorAll('path'));
  }

  const lines = draw();
  if (!reduce && 'IntersectionObserver' in window) {
    animate(lines, { draw: '0 0', duration: 0 });
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      drawn = true;
      animate(lines, { draw: ['0 0', '0 1'], duration: 1400, ease: 'inOutQuad' });
    }, { threshold: 0.2 });
    io.observe(log);
  } else {
    drawn = true;
  }

  // Positions depend on layout; redraw (already finished) on width changes.
  let w = innerWidth, t = 0;
  addEventListener('resize', () => {
    if (innerWidth === w) return;
    w = innerWidth;
    clearTimeout(t);
    t = setTimeout(() => { const l = draw(); if (!drawn) animate(l, { draw: '0 0', duration: 0 }); }, 160);
  });
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
      onGrab: () => {
        note.style.zIndex = '30';
        animate(note, { scale: 1.06, rotate: r * 0.3, duration: 180, ease: 'outExpo' });
        if (!told) {
          told = true;
          window.dispatchEvent(new CustomEvent('mascot:say', { detail: { text: 'hey, that was pinned there!', mood: 'surprised' } }));
        }
      },
      // A physical drop is the one place a little spring belongs.
      onRelease: () => {
        animate(note, { scale: 1, rotate: r, ease: spring({ bounce: 0.3, duration: 380 }) });
      },
    });
  });
}
