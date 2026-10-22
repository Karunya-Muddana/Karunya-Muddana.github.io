/* ============================================================
   Motion — hero write-in (GSAP SplitText), cut-paper drop,
   and the pencil construction guides around the headline.
   ============================================================ */
(function () {
  'use strict';

  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const title = document.querySelector('.hero-title');
  const hero = document.querySelector('.hero');
  const guides = document.querySelector('.hero-guides');
  if (!title || !hero) return;

  const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();

  // ---------- Write-in ----------
  function writeIn() {
    const gsap = window.gsap, SplitText = window.SplitText;
    if (!gsap || !SplitText || reduce) {
      root.classList.remove('split-pending');
      return Promise.resolve();
    }
    gsap.registerPlugin(SplitText);

    const split = SplitText.create(title.querySelectorAll('.sp'), { type: 'chars', charsClass: 'ch' });
    root.classList.add('split-on');
    root.classList.remove('split-pending');

    const cuts = title.querySelectorAll('.hero-cuts .cut');
    const tl = gsap.timeline({ delay: 0.15 });

    // Each letter lands a little crooked, then settles, left to right,
    // as if it's being written.
    tl.from(split.chars, {
      opacity: 0,
      yPercent: 36,
      rotate: () => gsap.utils.random(-14, 10),
      scale: 0.86,
      duration: 0.55,
      ease: 'expo.out',
      stagger: 0.045
    });

    // Cut paper drops on after the full stop: square, circle, rectangle, tape.
    tl.from(cuts, {
      opacity: 0,
      y: -46,
      rotate: (i) => [18, -30, -20, 30][i] || 0,
      duration: 0.5,
      ease: 'expo.out',
      stagger: 0.11,
      clearProps: 'opacity'
    }, '-=0.15');

    // Once the letters have landed they don't need their own GPU layers.
    return new Promise((res) => tl.eventCallback('onComplete', () => {
      root.classList.add('split-done');
      res();
    }));
  }

  // ---------- Pencil guides ----------
  // Two ruled lines per edge, run past the headline to the page edges,
  // with small shaded squares where the bands cross, like 1.png.
  function drawGuides() {
    if (!guides || !window.rough || getComputedStyle(guides).display === 'none') return;

    const hr = hero.getBoundingClientRect();
    let L = Infinity, R = -Infinity, T = Infinity, B = -Infinity;
    const range = document.createRange();
    title.querySelectorAll('.ln').forEach((ln) => {
      range.selectNodeContents(ln);
      const r = range.getBoundingClientRect();
      L = Math.min(L, r.left); R = Math.max(R, r.right);
      T = Math.min(T, r.top); B = Math.max(B, r.bottom);
    });
    if (!isFinite(L)) return;

    const pad = 18, band = 16;
    const fs = parseFloat(getComputedStyle(title).fontSize);
    const x1 = L - hr.left - pad, x2 = R - hr.left + pad;
    // Top band sits between the eyebrow and the headline, never on the
    // eyebrow text. Bottom band clears the underline hanging under "ship".
    const eyebrow = title.previousElementSibling;
    const eb = eyebrow ? eyebrow.getBoundingClientRect().bottom - hr.top : -Infinity;
    const y1 = Math.max(T - hr.top + fs * 0.1, eb + band + 8);
    const sub = title.nextElementSibling;
    const st = sub ? sub.getBoundingClientRect().top - hr.top : Infinity;
    const y2 = Math.min(B - hr.top + fs * 0.26 + 6, st - band - 10);
    const W = hr.width, H = hr.height;

    guides.setAttribute('viewBox', `0 0 ${W} ${H}`);
    guides.innerHTML = '';
    const rc = window.rough.svg(guides);
    const inner = { roughness: 0.45, bowing: 0.35, stroke: 'rgba(26,25,22,0.30)', strokeWidth: 1, strokeLineDash: [5, 7] };
    const outer = { roughness: 0.45, bowing: 0.35, stroke: 'rgba(26,25,22,0.14)', strokeWidth: 1 };
    const top = 86; // clear of the nav

    const add = (n) => guides.appendChild(n);
    let seed = 40;
    // Horizontal bands
    [[y1, y1 - band], [y2, y2 + band]].forEach(([a, b]) => {
      add(rc.line(0, a, W, a, { ...inner, seed: seed++ }));
      add(rc.line(0, b, W, b, { ...outer, seed: seed++ }));
    });
    // Vertical bands
    [[x1, x1 - band], [x2, x2 + band]].forEach(([a, b]) => {
      add(rc.line(a, top, a, H, { ...inner, seed: seed++ }));
      add(rc.line(b, top, b, H, { ...outer, seed: seed++ }));
    });
    // Corner squares fill the band crossings
    [[x1 - band, y1 - band], [x2, y1 - band], [x1 - band, y2], [x2, y2]].forEach(([x, y]) => {
      add(rc.rectangle(x, y, band, band, {
        roughness: 0.5, bowing: 0.3, seed: seed++,
        fill: 'rgba(188,182,166,0.55)', fillStyle: 'solid',
        stroke: 'rgba(26,25,22,0.32)', strokeWidth: 0.9
      }));
    });
    guides.classList.add('on');
  }

  // ---------- Red-pencil circle on the ExcelMCP printout ----------
  const printout = document.querySelector('.printout');
  if (printout && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { printout.classList.add('in'); io.disconnect(); }
      });
    }, { threshold: 0.6 });
    io.observe(printout);
  } else if (printout) {
    printout.classList.add('in');
  }

  let resizeT = 0;
  const redraw = () => { clearTimeout(resizeT); resizeT = setTimeout(drawGuides, 150); };

  ready.then(writeIn).then(() => {
    drawGuides();
    if ('ResizeObserver' in window) new ResizeObserver(redraw).observe(hero);
    else window.addEventListener('resize', redraw);
  });
})();
