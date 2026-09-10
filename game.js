/* ============================================================
   Cloud Stack — the hidden footer game.

   A loose paper corner in the footer opens it. Paper slides back
   and forth under the cloud; one tap / click / Space drops it.
   Line it up with the stack below: a perfect drop keeps its width
   and builds a combo, anything off gets trimmed, a miss sends the
   cloud tumbling. Faster as it grows; new paper every 6 levels.
   ============================================================ */
(function () {
  'use strict';

  const dog = document.querySelector('.dogear');
  if (!dog) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  };

  const INK = '#1A1916';
  const PH = 20;                                   // paper thickness
  const PAPERS = [
    { fill: '#F6F2E7', ruled: true },              // notebook
    { fill: '#F3DC8E', band: true },               // sticky note
    { fill: '#DDB8DA' },                           // lilac cut paper
    { fill: '#BCCBE3' },                           // sky
    { fill: '#E8C1A0' },                           // peach
    { fill: '#B9CFA0' },                           // sage
    { fill: '#FBFAF6', dots: true }                // receipt
  ];
  // Same bubbles as the page mascot, in its 140×120 space.
  const CLOUD = [[34, 80, 22], [108, 80, 22], [50, 56, 24], [92, 56, 24], [71, 44, 28]];

  let modal, cv, ctx, hudNow, hudBest, W = 360, H = 520, raf = 0, last = 0, isOpen = false, lastFocus = null;
  let G = null;

  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------- Modal ----------
  function build() {
    modal = document.createElement('div');
    modal.className = 'cs';
    modal.hidden = true;
    modal.setAttribute('data-lenis-prevent', '');
    modal.innerHTML = `
      <div class="cs-backdrop" data-close></div>
      <div class="cs-card" role="dialog" aria-modal="true" aria-labelledby="cs-title">
        <img class="cs-tape" src="assets/paper/tape-short-3.webp" alt="" />
        <div class="cs-head">
          <h2 id="cs-title">cloud stack</h2>
          <div class="cs-score" aria-live="polite"><b class="cs-now">0</b><span class="cs-best">best 0</span></div>
          <button class="cs-close" type="button" data-close aria-label="Close the game">&#10005;</button>
        </div>
        <canvas class="cs-canvas" tabindex="0" aria-label="Cloud Stack. Press Space, or tap, to drop the paper."></canvas>
        <p class="cs-hint">tap, click or press space to drop</p>
      </div>`;
    document.body.appendChild(modal);
    cv = modal.querySelector('canvas');
    ctx = cv.getContext('2d');
    hudNow = modal.querySelector('.cs-now');
    hudBest = modal.querySelector('.cs-best');

    modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); act(); });
    window.addEventListener('resize', () => { if (isOpen) { sizeCanvas(); } });
  }

  function sizeCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const card = modal.querySelector('.cs-card');
    W = Math.round(Math.min(400, card.clientWidth - 32));
    H = Math.round(Math.min(560, window.innerHeight - 200));
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function open() {
    if (!modal) build();
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.documentElement.classList.add('game-open', 'rsheet-lock');
    if (window.__lenis) window.__lenis.stop();
    store.set('cloudstack-found', '1');
    requestAnimationFrame(() => {
      modal.classList.add('open');
      sizeCanvas();
      reset();
      cv.focus({ preventScroll: true });
      isOpen = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    });
    document.addEventListener('keydown', onKey);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    cancelAnimationFrame(raf);
    modal.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => {
      modal.hidden = true;
      document.documentElement.classList.remove('game-open', 'rsheet-lock');
      if (window.__lenis) window.__lenis.start();
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }, 300);
    window.dispatchEvent(new CustomEvent('cloudstack:close', { detail: { best: G ? G.best : 0 } }));
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if ((e.key === ' ' || e.key === 'Enter') && document.activeElement !== modal.querySelector('.cs-close')) {
      e.preventDefault();
      act();
    }
  }

  dog.addEventListener('click', open);

  // ---------- Game state ----------
  const baseY = () => H - 64;
  const topY = () => baseY() - (G.stack.length - 1) * PH;
  const holdY = () => topY() - PH - 84;

  function reset() {
    const bw = Math.round(Math.min(190, W * 0.5));
    G = {
      state: 'ready',
      stack: [{ x: (W - bw) / 2, w: bw, paper: 0, seed: 1 }],
      falling: [], pops: [],
      score: 0, combo: 0,
      best: +store.get('cloudstack-best') || 0,
      cam: 0, camT: 0, shake: 0, overAt: 0,
      mover: null,
      cloud: { x: W / 2, y: 0, vy: 0, rot: 0, face: 'normal', faceUntil: 0, dead: false, squash: 1 }
    };
    spawn();
    G.cloud.y = G.mover.y - 34;
    hud();
  }

  function spawn() {
    const top = G.stack[G.stack.length - 1];
    const lvl = G.stack.length;
    const fromLeft = lvl % 2 === 1;
    G.mover = {
      x: fromLeft ? -top.w * 0.3 : W - top.w * 0.7,
      w: top.w,
      dir: fromLeft ? 1 : -1,
      speed: Math.min(440, 150 + lvl * 11),
      paper: Math.floor((lvl - 1) / 6) % PAPERS.length,
      seed: lvl * 7 + 3,
      y: holdY(),
      dropping: false, vy: 0
    };
  }

  function hud() {
    hudNow.textContent = G.score;
    hudBest.textContent = 'best ' + G.best;
  }

  function face(f, ms) {
    G.cloud.face = f;
    G.cloud.faceUntil = performance.now() + (ms || 900);
  }

  function pop(text) {
    G.pops.push({ text, x: W / 2, y: topY() - 34, t: 0 });
  }

  function act() {
    if (!G) return;
    if (G.state === 'over') {
      if (performance.now() - G.overAt > 650) { reset(); G.state = 'play'; }
      return;
    }
    G.state = 'play';
    const m = G.mover;
    if (m && !m.dropping) {
      m.dropping = true;
      m.vy = 0;
      G.cloud.squash = 0.8;
    }
  }

  function land() {
    const m = G.mover;
    const top = G.stack[G.stack.length - 1];
    const L = Math.max(m.x, top.x), R = Math.min(m.x + m.w, top.x + top.w);
    const ov = R - L;

    if (ov <= 2) {                                 // clean miss
      G.falling.push({ x: m.x, y: m.y, w: m.w, paper: m.paper, seed: m.seed, vx: m.dir * 70, vy: 80, rot: 0, vr: m.dir * 2.4 });
      G.mover = null;
      return over();
    }

    const diff = Math.abs(m.x - top.x);
    let x = L, w = ov, f = 'normal';
    if (diff <= 5) {                               // perfect
      x = top.x; w = top.w;
      G.combo++;
      const baseW = G.stack[0].w;
      if (G.combo >= 3 && w < baseW) {             // combos win back a little width
        const grow = Math.min(10, baseW - w);
        x -= grow / 2; w += grow;
      }
      f = G.combo >= 3 ? 'combo' : 'perfect';
      pop(G.combo >= 2 ? `perfect ×${G.combo}` : 'perfect!');
    } else {
      G.combo = 0;
      const left = m.x < top.x;
      const cutW = m.w - ov;
      G.falling.push({ x: left ? m.x : R, y: m.y, w: cutW, paper: m.paper, seed: m.seed, vx: (left ? -1 : 1) * 80, vy: 40, rot: 0, vr: (left ? -1 : 1) * 3 });
      if (cutW / m.w > 0.35) { f = 'bad'; G.shake = 7; }
    }

    G.stack.push({ x, w, paper: m.paper, seed: m.seed });
    G.score = G.stack.length - 1;
    if (G.score >= 15 && f !== 'bad' && G.score % 5 === 0) { f = 'wow'; pop(G.score + '!'); }
    face(f, f === 'bad' ? 800 : 1000);
    G.camT = Math.max(0, H * 0.6 - topY());
    spawn();
    hud();
  }

  function over() {
    G.state = 'over';
    G.overAt = performance.now();
    G.shake = 9;
    const c = G.cloud;
    c.dead = true; c.vy = -280; c.face = 'dead'; c.faceUntil = Infinity;
    if (G.score > G.best) { G.best = G.score; store.set('cloudstack-best', String(G.best)); }
    hud();
  }

  // ---------- Update ----------
  function update(dt, now) {
    const m = G.mover;
    if (m) {
      if (!m.dropping) {
        m.x += m.dir * m.speed * dt;
        if (m.x < -m.w * 0.35) { m.x = -m.w * 0.35; m.dir = 1; }
        if (m.x > W - m.w * 0.65) { m.x = W - m.w * 0.65; m.dir = -1; }
        m.y = lerp(m.y, holdY(), 1 - Math.exp(-10 * dt));
      } else {
        m.vy += 2600 * dt;
        m.y += m.vy * dt;
        if (m.y >= topY() - PH) { m.y = topY() - PH; land(); }
      }
    }

    // The cloud carries the paper, then floats up to wait for the next one.
    const c = G.cloud;
    if (c.dead) {
      c.vy += 1700 * dt; c.y += c.vy * dt; c.rot += 5 * dt;
    } else {
      const tx = G.mover ? G.mover.x + G.mover.w / 2 : c.x;
      const ty = (G.mover ? holdY() : c.y + 34) - 34;
      c.x = lerp(c.x, tx, 1 - Math.exp(-14 * dt));
      c.y = lerp(c.y, ty, 1 - Math.exp(-8 * dt));
      c.rot = lerp(c.rot, G.mover && !G.mover.dropping ? G.mover.dir * -0.08 : 0, 1 - Math.exp(-6 * dt));
    }
    c.squash = lerp(c.squash, 1, 1 - Math.exp(-9 * dt));
    if (!c.dead && now > c.faceUntil) c.face = G.stack.length > 16 ? 'focus' : 'normal';

    for (const p of G.falling) {
      p.vy += 1500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    G.falling = G.falling.filter((p) => p.y + G.cam < H + 200);
    for (const p of G.pops) { p.t += dt; p.y -= 30 * dt; }
    G.pops = G.pops.filter((p) => p.t < 1.1);

    G.cam = lerp(G.cam, G.camT, 1 - Math.exp(-5 * dt));
    G.shake = Math.max(0, G.shake - 30 * dt);
  }

  // ---------- Draw ----------
  function wob(seed, i) { return Math.sin(seed * 12.9898 + i * 78.233) * 0.9; }

  function drawPiece(p, y) {
    const P = PAPERS[p.paper];
    ctx.save();
    ctx.fillStyle = 'rgba(40,28,14,0.10)';
    ctx.fillRect(p.x + 2, y + 3, p.w, PH);
    ctx.fillStyle = P.fill;
    ctx.fillRect(p.x, y, p.w, PH);
    if (P.ruled) {
      ctx.strokeStyle = 'rgba(80,110,170,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x, y + PH * 0.62); ctx.lineTo(p.x + p.w, y + PH * 0.62); ctx.stroke();
      ctx.strokeStyle = 'rgba(200,70,60,0.35)';
      ctx.beginPath(); ctx.moveTo(p.x + 12, y); ctx.lineTo(p.x + 12, y + PH); ctx.stroke();
    }
    if (P.band) { ctx.fillStyle = 'rgba(120,90,20,0.10)'; ctx.fillRect(p.x, y, p.w, 5); }
    if (P.dots) {
      ctx.fillStyle = 'rgba(26,25,22,0.18)';
      for (let dx = 8; dx < p.w; dx += 9) ctx.fillRect(p.x + dx, y + PH / 2, 3, 1);
    }
    // Pencil outline, a little wobbly
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x + wob(p.seed, 1), y + wob(p.seed, 2));
    ctx.lineTo(p.x + p.w + wob(p.seed, 3), y + wob(p.seed, 4));
    ctx.lineTo(p.x + p.w + wob(p.seed, 5), y + PH + wob(p.seed, 6));
    ctx.lineTo(p.x + wob(p.seed, 7), y + PH + wob(p.seed, 8));
    ctx.closePath();
    ctx.stroke();
    // Every fourth sheet has a scrap of tape
    if (p.seed % 4 === 0 && p.w > 50) {
      ctx.translate(p.x + p.w - 14, y + 2);
      ctx.rotate(0.5);
      ctx.fillStyle = 'rgba(232,210,140,0.75)';
      ctx.fillRect(-12, -5, 24, 9);
    }
    ctx.restore();
  }

  function drawCloud(c) {
    const s = 0.44;
    const redTint = c.face === 'bad';
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.scale(s * (2 - c.squash), s * c.squash);
    ctx.translate(-71, -106);
    // Outline pass, then fill: only the silhouette keeps a line.
    ctx.fillStyle = '#F7F0E1';
    for (const [x, y, r] of CLOUD) { ctx.beginPath(); ctx.arc(x, y, r + 7, 0, Math.PI * 2); ctx.fill(); }
    roundRect(19, 61, 104, 52, 26, '#F7F0E1');
    ctx.fillStyle = INK;
    for (const [x, y, r] of CLOUD) { ctx.beginPath(); ctx.arc(x, y, r + 2.8, 0, Math.PI * 2); ctx.fill(); }
    roundRect(23.2, 65.2, 95.6, 43.6, 21.8, INK);
    const body = redTint ? '#E0594D' : '#A9C7EC';
    ctx.fillStyle = body;
    for (const [x, y, r] of CLOUD) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    roundRect(26, 68, 90, 38, 19, body);
    drawFace(c.face);
    ctx.restore();
  }

  function roundRect(x, y, w, h, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.fill();
  }

  function eye(x, y, rx, ry, px, py, prx, pry) {
    ctx.fillStyle = '#FFFDF8'; ctx.strokeStyle = INK; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1F2430';
    ctx.beginPath(); ctx.ellipse(x + px, y + py, prx, pry, 0, 0, Math.PI * 2); ctx.fill();
    if (prx > 3) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x + px - prx * 0.3, y + py - pry * 0.4, 2.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawFace(f) {
    const L = 58.5, R = 83.5, Y = 67;
    const cheeks = () => {
      ctx.fillStyle = 'rgba(240,140,132,0.8)';
      ctx.beginPath(); ctx.ellipse(45, 84, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(97, 84, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
    };
    const star = (x, y, r) => {
      ctx.fillStyle = '#F2C443'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r);
      ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r);
      ctx.fill(); ctx.stroke();
    };
    if (f === 'dead') {
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (const x of [L, R]) {
        ctx.beginPath(); ctx.moveTo(x - 7, Y - 7); ctx.lineTo(x + 7, Y + 7); ctx.moveTo(x + 7, Y - 7); ctx.lineTo(x - 7, Y + 7); ctx.stroke();
      }
      return;
    }
    if (f === 'bad') {
      ctx.fillStyle = '#FFFDF8'; ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(46, 59); ctx.lineTo(68, 66); ctx.lineTo(54, 76); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(96, 59); ctx.lineTo(74, 66); ctx.lineTo(88, 76); ctx.closePath(); ctx.fill(); ctx.stroke();
      return;
    }
    if (f === 'wow') {                              // mind blown
      eye(L, Y, 12.5, 16, 0, 0, 2.6, 3); eye(R, Y, 12.5, 16, 0, 0, 2.6, 3);
      star(112, 16, 8); star(26, 22, 5); star(124, 34, 4.5);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(71, 88, 3.4, 4.2, 0, 0, Math.PI * 2); ctx.fill();
      return;
    }
    if (f === 'combo') {                            // flustered
      eye(L, Y, 12, 16, 0, 1, 6, 8.6); eye(R, Y, 12, 16, 0, 1, 6, 8.6);
      cheeks();
      return;
    }
    if (f === 'perfect') {
      eye(L, Y, 11.4, 15.2, 0, 3, 5.8, 8.4); eye(R, Y, 11.4, 15.2, 0, 3, 5.8, 8.4);
      star(112, 18, 6.5);
      ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(66.5, 83); ctx.quadraticCurveTo(71, 88, 75.5, 83); ctx.stroke();
      return;
    }
    // normal / focus: watching the paper below
    const narrow = f === 'focus' ? 0.75 : 1;
    eye(L, Y, 10.2, 13.8 * narrow, 0, 4, 5.2, 7.4 * narrow);
    eye(R, Y, 10.2, 13.8 * narrow, 0, 4, 5.2, 7.4 * narrow);
  }

  function draw(now) {
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#EEE9DD';
    ctx.fillRect(0, 0, W, H);

    const sx = G.shake ? rand(-G.shake, G.shake) : 0;
    const sy = G.shake ? rand(-G.shake, G.shake) * 0.6 : 0;
    ctx.translate(sx, sy);

    // Dot grid drifts slower than the stack, for a bit of depth
    ctx.fillStyle = 'rgba(26,25,22,0.13)';
    const off = (G.cam * 0.5) % 22;
    for (let y = -22 + off; y < H; y += 22) for (let x = 11; x < W; x += 22) ctx.fillRect(x, y, 1.6, 1.6);

    ctx.translate(0, G.cam);

    // Height marks every 10 levels
    ctx.font = '600 18px Caveat, cursive';
    ctx.fillStyle = 'rgba(26,25,22,0.45)';
    ctx.strokeStyle = 'rgba(26,25,22,0.25)';
    ctx.setLineDash([4, 6]); ctx.lineWidth = 1;
    for (let k = 10; k <= G.stack.length + 12; k += 10) {
      const y = baseY() - k * PH;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.fillText(String(k), 8, y - 5);
    }
    ctx.setLineDash([]);

    // Desk under the base sheet
    ctx.fillStyle = INK;
    ctx.fillRect(-20, baseY() + PH, W + 40, 400);

    G.stack.forEach((p, i) => drawPiece(p, baseY() - i * PH));
    for (const p of G.falling) {
      ctx.save();
      ctx.translate(p.x + p.w / 2, p.y + PH / 2);
      ctx.rotate(p.rot);
      drawPiece({ ...p, x: -p.w / 2 }, -PH / 2);
      ctx.restore();
    }
    if (G.mover) drawPiece(G.mover, G.mover.y);
    drawCloud(G.cloud);

    ctx.textAlign = 'center';
    for (const p of G.pops) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / 1.1);
      ctx.font = '700 24px Caveat, cursive';
      ctx.fillStyle = INK;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Screen-space overlays
    ctx.textAlign = 'center';
    if (G.state === 'ready') {
      ctx.font = '600 22px Caveat, cursive';
      ctx.fillStyle = 'rgba(26,25,22,0.7)';
      ctx.fillText('tap to drop ↓', W / 2, 40);
    }
    if (G.state === 'over' && now - G.overAt > 500) {
      ctx.fillStyle = 'rgba(246,242,231,0.9)';
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      const bw = Math.min(260, W - 40), bh = 132, bx = (W - bw) / 2, by = H * 0.3;
      ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK;
      ctx.font = '800 34px Fraunces, Georgia, serif';
      ctx.fillText(`stack: ${G.score}`, W / 2, by + 50);
      ctx.font = '600 22px Caveat, cursive';
      ctx.fillText(G.score && G.score >= G.best ? 'new best!' : `best: ${G.best}`, W / 2, by + 82);
      ctx.fillStyle = 'rgba(26,25,22,0.6)';
      ctx.fillText('tap to try again', W / 2, by + 112);
    }
    ctx.textAlign = 'left';
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(reduce ? dt * 0.8 : dt, now);
    draw(now);
    if (isOpen) raf = requestAnimationFrame(loop);
  }
})();
