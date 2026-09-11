/* ============================================================
   rough.js sketched borders & underlines
   Wired-elements style hand-drawn overlays
   ============================================================ */
(function() {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function readColor(el) {
    return getComputedStyle(el).color || '#1A1916';
  }

  function ensureSVG(el) {
    let svg = el.querySelector(':scope > svg.rough-overlay');
    if (svg) { while (svg.firstChild) svg.removeChild(svg.firstChild); return svg; }
    const ns = 'http://www.w3.org/2000/svg';
    svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'rough-overlay');
    svg.setAttribute('preserveAspectRatio', 'none');
    el.appendChild(svg);
    return svg;
  }

  function draw(el) {
    if (!window.rough) return;
    const type = el.dataset.rough;
    const rect = el.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w < 4 || h < 4) return;

    const svg = ensureSVG(el);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    const stroke = el.dataset.roughStroke || readColor(el);
    const seed = parseInt(el.dataset.seed || '0') || (el._roughSeed = el._roughSeed || Math.floor(Math.random() * 999));
    const roughness = parseFloat(el.dataset.roughness || '1.6');
    const bowing = parseFloat(el.dataset.bowing || '1.2');
    const strokeWidth = parseFloat(el.dataset.strokeWidth || '1.4');

    const rc = window.rough.svg(svg, {
      options: { stroke, strokeWidth, roughness, bowing, seed }
    });

    let node;
    if (type === 'box') {
      node = rc.rectangle(2, 2, Math.max(2, w - 4), Math.max(2, h - 4));
    } else if (type === 'pill') {
      // approximate pill: rounded rectangle via two arcs + lines
      const r = Math.min(h / 2, w / 2) - 1;
      node = rc.path(pillPath(w, h, r), { stroke, strokeWidth, roughness, bowing, seed, fill: 'none' });
    } else if (type === 'circle') {
      node = rc.ellipse(w / 2, h / 2, Math.max(2, w - 6), Math.max(2, h - 6));
    } else if (type === 'underline') {
      // pencil-style double underline along bottom
      const y = h - 4;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const a = rc.curve([[2, y], [w*0.3, y-2], [w*0.6, y+1], [w-2, y-1]], { stroke, strokeWidth: strokeWidth*2, roughness, seed });
      const b = rc.curve([[3, y+3], [w*0.4, y+1], [w*0.7, y+4], [w-3, y+2]], { stroke, strokeWidth: strokeWidth*1.1, roughness, seed: seed+1 });
      g.appendChild(a); g.appendChild(b);
      node = g;
    } else if (type === 'strike') {
      node = rc.line(2, h * 0.55, w - 2, h * 0.50);
    } else {
      node = rc.rectangle(2, 2, Math.max(2, w - 4), Math.max(2, h - 4));
    }
    svg.appendChild(node);

    // Hand-drawn ink: prime the strokes so they can be "drawn" on entry.
    if (!reduceMotion) primeInk(el, svg);
  }

  function pillPath(w, h, r) {
    return `M ${r} 1 L ${w - r} 1 A ${r} ${r} 0 0 1 ${w - r} ${h - 1} L ${r} ${h - 1} A ${r} ${r} 0 0 1 ${r} 1 Z`;
  }

  /* ------------------------------------------------------------
     Ink-in: each rough.js stroke is dash-offset back to nothing,
     then released when the element scrolls into view — so the
     sketched borders draw themselves the way a pen would.
     ------------------------------------------------------------ */
  function primeInk(el, svg) {
    const strokes = svg.querySelectorAll('path, line, ellipse, circle');
    if (!strokes.length) return;
    const alreadyInked = el.classList.contains('ink-in');

    strokes.forEach((s, i) => {
      let len;
      try { len = s.getTotalLength ? s.getTotalLength() : 0; } catch (_) { len = 0; }
      if (!len || !isFinite(len)) return;
      s.style.strokeDasharray = len;
      // rough.js draws each shape twice; offset the second pass so the
      // sketch fills in rather than tracing one clean outline.
      s.style.setProperty('--ink-delay', (i * 90) + 'ms');
      s.style.strokeDashoffset = alreadyInked ? '0' : String(len);
    });

    svg.classList.add('ink');
    if (alreadyInked) return;
    inkObs.observe(el);
  }

  const inkObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('ink-in');
      e.target.querySelectorAll('.rough-overlay path, .rough-overlay line, .rough-overlay ellipse, .rough-overlay circle')
        .forEach(s => { s.style.strokeDashoffset = '0'; });
      inkObs.unobserve(e.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });

  function decorateAll() {
    document.querySelectorAll('[data-rough]').forEach(draw);
  }

  const touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  let resizeTimer, lastW = window.innerWidth;
  function onResize() {
    // Phones fire resize whenever the URL bar slides in or out mid-scroll.
    // The sketches only depend on width, so skip those height-only ones.
    if (touch && window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(decorateAll, 120);
  }

  function waitForRough(cb, tries = 0) {
    if (window.rough) return cb();
    if (tries > 60) return; // ~6s fallback
    setTimeout(() => waitForRough(cb, tries + 1), 100);
  }

  window.addEventListener('resize', onResize);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForRough(decorateAll));
  } else {
    waitForRough(decorateAll);
  }

  // Expose for re-draw triggers
  window.__redrawRough = decorateAll;
})();
