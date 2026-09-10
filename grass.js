/* ============================================================
   Grass — coloured-pencil grass growing out of the contact block.
   Drawn, not an image, so it fills any width and never crops.

   Two canvases: the back one (behind the mascot) holds the ground
   line and the dense back and middle layers; the front one (in
   front of the mascot) holds a sparser row of darker blades, so
   the mascot sits *in* the grass. Blades sway, lean away from the
   cursor, and only animate while on screen.
   ============================================================ */
(function () {
  'use strict';

  const edge = document.querySelector('.grass-edge');
  if (!edge) return;
  const backCv = edge.querySelector('.grass-back');
  const frontCv = edge.querySelector('.grass-front');
  if (!backCv || !frontCv || !backCv.getContext) return;

  const back = backCv.getContext('2d');
  const front = frontCv.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const INK = '#1A1916';
  const GROUND = 30;                       // px of wavy ground at the bottom

  // Depth layers: far blades are paler and taller, near ones darker.
  const LAYERS = [
    { gap: 5,  hMin: .42, hMax: .86, wMin: 2.4, wMax: 4.2, colors: ['#BCC99A', '#B1C28B', '#C6D2A6'], alpha: .9,  canvas: 'back' },
    { gap: 5,  hMin: .34, hMax: .80, wMin: 3,   wMax: 5.4, colors: ['#95AE62', '#8AA55A', '#A2B86E', '#7F9A55'], alpha: 1, canvas: 'back' },
    { gap: 12, hMin: .22, hMax: .56, wMin: 3.6, wMax: 6.4, colors: ['#5E7A3E', '#6D8A48', '#557236'], alpha: 1, canvas: 'front', rib: true }
  ];

  const pointer = { x: -9999, y: -9999 };
  let W = 0, H = 0, blades = [], extras = [], groundPts = [];
  let running = false, raf = 0;

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  function size(cv, ctx, dpr) {
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function build() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = edge.clientWidth; H = edge.clientHeight;
    size(backCv, back, dpr);
    size(frontCv, front, dpr);

    // A gently lumpy ground line
    groundPts = [];
    const seg = 24;
    for (let x = -seg; x <= W + seg; x += seg) {
      groundPts.push({ x, y: H - GROUND + Math.sin(x * 0.011) * 4 + rand(-3, 3) });
    }

    blades = [];
    LAYERS.forEach((L, li) => {
      const n = Math.max(8, Math.round(W / L.gap));
      for (let i = 0; i < n; i++) {
        const x = (i + Math.random()) * (W / n);
        blades.push({
          layer: li, canvas: L.canvas, rib: !!L.rib,
          x,
          h: (H - GROUND) * rand(L.hMin, L.hMax) + 8,
          w: rand(L.wMin, L.wMax),
          c: pick(L.colors), a: L.alpha,
          lean: rand(-22, 22),
          ph: Math.random() * Math.PI * 2,
          sp: rand(0.6, 1.4),
          bend: 0, bv: 0
        });
      }
    });

    // A few seed heads and clover flowers in the middle layer
    extras = [];
    const nSeed = Math.round(W / 160), nClover = Math.max(2, Math.round(W / 420));
    for (let i = 0; i < nSeed; i++) {
      extras.push({ kind: 'seed', x: rand(10, W - 10), h: (H - GROUND) * rand(.6, .92), lean: rand(-14, 14), ph: Math.random() * 6.28, bend: 0, bv: 0 });
    }
    for (let i = 0; i < nClover; i++) {
      extras.push({ kind: 'clover', x: rand(40, W - 40), h: (H - GROUND) * rand(.28, .45), lean: rand(-6, 6), ph: Math.random() * 6.28, bend: 0, bv: 0 });
    }
  }

  function groundY(x) {
    const i = Math.max(0, Math.min(groundPts.length - 2, Math.floor((x + 24) / 24)));
    const a = groundPts[i], b = groundPts[i + 1];
    return a.y + (b.y - a.y) * ((x - a.x) / (b.x - a.x));
  }

  // Spring each stem toward the cursor push plus the breeze.
  function motion(b, t, px, py) {
    let push = 0;
    const dx = b.x - px;
    if (Math.abs(dx) < 90 && py > H - b.h - 50 && py < H + 30) {
      push = Math.sign(dx) * (1 - Math.abs(dx) / 90) * 30;
    }
    b.bv += (push - b.bend) * 0.09;
    b.bv *= 0.84;
    b.bend += b.bv;
    const breeze = reduce ? 0 :
      Math.sin(t * 0.0011 * (b.sp || 1) + b.ph + b.x * 0.004) * 5 +
      Math.sin(t * 0.00045 + b.x * 0.0022) * 5;
    return breeze + b.bend;
  }

  function drawBlade(ctx, b, off) {
    const base = groundY(b.x) + 6;
    const tipX = b.x + b.lean + off;
    const tipY = base - b.h + Math.abs(b.bend) * 0.3;
    const cx = b.x + b.lean * 0.35 + off * 0.45;
    const cy = base - b.h * 0.55;
    const hw = b.w / 2;
    ctx.globalAlpha = b.a;
    ctx.fillStyle = b.c;
    ctx.beginPath();
    ctx.moveTo(b.x - hw, base);
    ctx.quadraticCurveTo(cx - hw * 0.6, cy, tipX, tipY);
    ctx.quadraticCurveTo(cx + hw * 0.6, cy, b.x + hw, base);
    ctx.closePath();
    ctx.fill();
    if (b.rib) {
      // Pencil midrib on the near blades
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#2F4420';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(b.x, base);
      ctx.quadraticCurveTo(cx, cy, tipX, tipY + 4);
      ctx.stroke();
    }
  }

  function drawExtra(ctx, e, off) {
    const base = groundY(e.x) + 6;
    const tipX = e.x + e.lean + off, tipY = base - e.h;
    ctx.globalAlpha = 1;
    ctx.strokeStyle = e.kind === 'seed' ? '#8C9C5E' : '#6D8A48';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(e.x, base);
    ctx.quadraticCurveTo(e.x + e.lean * 0.3 + off * 0.4, base - e.h * 0.5, tipX, tipY);
    ctx.stroke();
    if (e.kind === 'seed') {
      // Oat-like seed head: little grains up the tip
      ctx.fillStyle = '#B9B27A';
      for (let k = 0; k < 7; k++) {
        const t = k / 7;
        const gx = tipX + Math.sin(k * 2.1) * 3.2, gy = tipY + t * 22;
        ctx.beginPath();
        ctx.ellipse(gx, gy, 1.9, 3.6, (k % 2 ? 0.5 : -0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // White clover: a puff of petals with a pencil outline
      ctx.fillStyle = '#FBF8EE';
      ctx.strokeStyle = 'rgba(60,60,40,0.45)';
      ctx.lineWidth = 0.8;
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(tipX + Math.cos(a) * 6.4, tipY + Math.sin(a) * 5.4, 4.6, 3.2, a, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = '#E9E1C4';
      ctx.beginPath(); ctx.arc(tipX, tipY, 3.8, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawGround(ctx) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(groundPts[0].x, H);
    for (let i = 0; i < groundPts.length - 1; i++) {
      const a = groundPts[i], b = groundPts[i + 1];
      ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
    }
    ctx.lineTo(W + 24, H);
    ctx.closePath();
    ctx.fill();
  }

  function draw(t) {
    const r = edge.getBoundingClientRect();
    const px = pointer.x - r.left, py = pointer.y - r.top;
    back.clearRect(0, 0, W, H);
    front.clearRect(0, 0, W, H);

    for (const b of blades) {
      if (b.layer === 0) drawBlade(back, b, motion(b, t, px, py));
    }
    for (const e of extras) drawExtra(back, e, motion(e, t, px, py));
    for (const b of blades) {
      if (b.layer === 1) drawBlade(back, b, motion(b, t, px, py));
    }
    drawGround(back);
    for (const b of blades) {
      if (b.layer === 2) drawBlade(front, b, motion(b, t, px, py));
    }
    back.globalAlpha = front.globalAlpha = 1;
  }

  function loop(t) {
    // The WebGL meadow (grass3d.js) took over: stop drawing the 2D grass.
    if (edge.classList.contains('is-3d')) { running = false; return; }
    draw(t);
    if (running) raf = requestAnimationFrame(loop);
  }
  function start() {
    if (running || reduce) return;
    running = true;
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  build();
  draw(0);

  window.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });

  let resizeT = 0, lastW = W;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if (edge.clientWidth === lastW) return;   // ignore mobile URL-bar resizes
      lastW = edge.clientWidth;
      build(); draw(performance.now());
    }, 150);
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((en) => (en.isIntersecting ? start() : stop()));
    }).observe(edge);
  } else {
    start();
  }
})();
