/* ============================================================
   Mascot — a paper-sticker cloud that follows you down the page.

   It perches on [data-perch] elements (value = x position as a
   fraction of the element's width; optional data-perch-y = px
   offset) and hops to whichever perch is nearest the middle of
   the screen. With no perch on screen it waits bottom-right.

   Drag it anywhere and it hops home 5s after you let go.
   Click it and it goes red-pencil red for a moment.
   ============================================================ */
(function () {
  'use strict';
  if (window.__kmascot || document.documentElement.classList.contains('embed')) return;
  window.__kmascot = true;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = window.matchMedia('(pointer: coarse)').matches;

  // Geometry, in viewBox units. FEET is where the body touches a perch.
  const VB_W = 140, VB_H = 120, FEET = 106;
  const W = coarse ? 60 : 80;
  const H = W * VB_H / VB_W;
  const FEET_PX = W * FEET / VB_W;
  const U = W / VB_W;
  const EYE_Y = 67, EYES_X = [58.5, 83.5];

  // A round, symmetric cloud: five overlapping bubbles on a flat-
  // bottomed base. Drawn as a union: each layer strokes/fills the
  // same shapes, so only the outer silhouette shows an outline.
  const SHAPES = '<rect x="26" y="68" width="90" height="38" rx="19"/>' +
    '<circle cx="34" cy="80" r="22"/><circle cx="108" cy="80" r="22"/>' +
    '<circle cx="50" cy="56" r="24"/><circle cx="92" cy="56" r="24"/>' +
    '<circle cx="71" cy="44" r="28"/>';

  // Pencil marks above the head: a dark under-stroke with colour on top.
  const tick = (d, c) =>
    `<path d="${d}" stroke="#2B3140" stroke-width="5.4"/><path d="${d}" stroke="${c}" stroke-width="3"/>`;
  const star = (x, y, s, c) =>
    `<path d="M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z" fill="${c}" stroke="#2B3140" stroke-width="1.5" stroke-linejoin="round"/>`;
  const MARKS = {
    excite: star(110, 14, 7.5, '#F2C443') + star(122, 28, 4.5, '#F2C443') + star(26, 20, 4, '#F2C443'),
    alarm:  tick('M100 16 103 5', '#D9503F') + tick('M110 20 117 10', '#D9503F') + tick('M117 30 127 26', '#D9503F'),
    shy:    '<path d="M110 22C100 15 102 4 110 9C118 4 120 15 110 22Z" fill="#EB8A98" stroke="#2B3140" stroke-width="1.6" stroke-linejoin="round"/>',
    zz:     tick('M14 14h9l-9 10h9', '#5B8FD6') + tick('M29 4h6l-6 7h6', '#5B8FD6'),
    anger:  tick('M22 18q5 0 5-5M33 13q0 5 5 5M38 27q-5 0-5 5M27 32q0-5-5-5', '#D9503F'),
    motion: tick('M8 92 1 101', '#8A857A') + tick('M17 98 11 107', '#8A857A')
  };

  // Eye shapes per expression. rx/ry = eye white, prx/pry = pupil,
  // dy = vertical shift, look = how far the pupils may wander (0–1),
  // blush = cheek strength.
  const EXPR = {
    neutral:   { rx: 10.2, ry: 13.8, prx: 5.2, pry: 7.8, dy: 0,  look: 1,   blush: 0 },
    excited:   { rx: 11.6, ry: 15.8, prx: 5.8, pry: 8.6, dy: -1, look: 1,   blush: .75 },
    surprised: { rx: 11.2, ry: 14.6, prx: 3.1, pry: 3.6, dy: -1, look: .5,  blush: 0 },
    sleepy:    { rx: 10.6, ry: 1.4,  prx: 0,   pry: 0,   dy: 3,  look: 0,   blush: 0 },
    shy:       { rx: 9.2,  ry: 12.2, prx: 4.8, pry: 7.2, dy: 6,  look: .35, blush: 1 },
    angry:     { rx: 10.2, ry: 13.8, prx: 5.2, pry: 7.8, dy: 0,  look: 0,   blush: 0 }
  };

  // ---------- DOM ----------
  const root = document.createElement('div');
  root.className = 'kmascot';
  root.setAttribute('aria-hidden', 'true');
  root.style.width = W + 'px';
  root.style.height = H + 'px';
  root.innerHTML = `
    <div class="km-squash" style="transform-origin:50% ${FEET_PX}px">
      <svg viewBox="0 0 ${VB_W} ${VB_H}" width="${W}" height="${H}">
        <defs>
          <pattern id="km-hatch" width="3.6" height="3.6" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
            <line x1="0" y1="0" x2="0" y2="3.6" stroke="#1E2A44" stroke-opacity=".12" stroke-width="1.2"/>
          </pattern>
          <filter id="km-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4"/>
            <feColorMatrix values="0 0 0 0 1  0 0 0 0 .95  0 0 0 0 .86  0 0 0 .5 -.2"/>
            <feComposite in2="SourceGraphic" operator="in"/>
          </filter>
          <filter id="km-wobble" x="-8%" y="-8%" width="116%" height="116%">
            <feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="9" result="w"/>
            <feDisplacementMap in="SourceGraphic" in2="w" scale="2" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
          <radialGradient id="km-light" cx="38%" cy="30%" r="70%">
            <stop offset="0" stop-color="#fff" stop-opacity=".22"/>
            <stop offset=".6" stop-color="#fff" stop-opacity="0"/>
          </radialGradient>
          <clipPath id="km-clip">${SHAPES}</clipPath>
          <g id="km-shape">${SHAPES}</g>
        </defs>
        <use href="#km-shape" class="km-sticker-edge"/>
        <use href="#km-shape" class="km-sticker"/>
        <use href="#km-shape" class="km-line" filter="url(#km-wobble)"/>
        <use href="#km-shape" class="km-fill"/>
        <g clip-path="url(#km-clip)">
          <rect width="140" height="120" fill="url(#km-light)"/>
          <rect width="140" height="120" fill="url(#km-hatch)"/>
          <g filter="url(#km-grain)"><use href="#km-shape" fill="#fff"/></g>
        </g>
        <g class="km-cheeks">
          <ellipse cx="45" cy="84" rx="7" ry="4"/><ellipse cx="97" cy="84" rx="7" ry="4"/>
        </g>
        <g class="km-eyes">
          ${EYES_X.map(x => `
            <ellipse class="km-white" cx="${x}" cy="${EYE_Y}" rx="10.6" ry="14.4"/>
            <ellipse class="km-pupil" cx="${x}" cy="${EYE_Y}" rx="5.4" ry="8.2"/>
            <circle class="km-shine km-shine-a" cx="${x}" cy="${EYE_Y}" r="2.1"/>
            <circle class="km-shine km-shine-b" cx="${x}" cy="${EYE_Y}" r="1"/>`).join('')}
        </g>
        <path class="km-mouth km-smile" d="M66.5 83Q71 87.5 75.5 83"/>
        <ellipse class="km-mouth km-o" cx="71" cy="85" rx="2.5" ry="3"/>
        <g class="km-angry">
          <path d="M46 59 68 66 54 76Z"/><path d="M96 59 74 66 88 76Z"/>
        </g>
        ${Object.entries(MARKS).map(([k, d]) => `<g class="km-mark km-${k}">${d}</g>`).join('')}
      </svg>
    </div>`;

  const ghost = document.createElement('div');
  ghost.className = 'km-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.innerHTML = `<svg viewBox="0 0 ${VB_W} ${VB_H}" width="${W}" height="${H}"><g>${SHAPES}</g></svg>`;

  document.body.append(ghost, root);

  // Hello to anyone who opens the console.
  console.log('%c  ☁  hi, curious one.  ', 'font:600 16px Caveat,cursive;background:#A9C7EC;color:#1A1916;padding:4px 8px;border-radius:12px');
  console.log('%cthis site is hand-made: vanilla JS, rough.js, GSAP, and a little Three.js.\nsource: https://github.com/Karunya-Muddana', 'font:12px monospace;color:#6E6B62');

  const squashEl = root.querySelector('.km-squash');
  const svg = root.querySelector('svg');
  const whites = [...root.querySelectorAll('.km-white')];
  const pupils = [...root.querySelectorAll('.km-pupil')];
  const shinesA = [...root.querySelectorAll('.km-shine-a')];
  const shinesB = [...root.querySelectorAll('.km-shine-b')];
  const cheeks = root.querySelector('.km-cheeks');

  // ---------- Helpers ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const damp = (k, dt) => 1 - Math.exp(-k * dt);
  const smooth = (t) => t * t * (3 - 2 * t);

  // Keep clear of the iPhone home bar when docked.
  const safeBottom = (() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
    const v = probe.offsetHeight;
    probe.remove();
    return v;
  })();

  const perches = () => Array.from(document.querySelectorAll('[data-perch]'));
  const DOCK = 'dock';

  function homePoint(h) {
    if (h === DOCK) {
      return { x: innerWidth - (coarse ? 46 : 72), y: innerHeight - (coarse ? 16 : 26) - safeBottom };
    }
    if (h && h.fixed) return h;
    const r = h.getBoundingClientRect();
    const fx = parseFloat(h.dataset.perch);
    return {
      x: r.left + r.width * (isNaN(fx) ? 0.5 : fx),
      y: r.top + 3 + (parseFloat(h.dataset.perchY) || 0)
    };
  }

  const onScreen = (p) =>
    p.y > 96 && p.y < innerHeight - 24 && p.x > W / 2 && p.x < innerWidth - W / 2;

  // Nearest perch to a line a little above the middle of the screen.
  // The current perch wins unless another is clearly closer, so it
  // doesn't twitch between two perches that are both in view.
  function pickHome(current) {
    const line = innerHeight * 0.42;
    let best = null, bestD = Infinity, curD = Infinity;
    for (const el of perches()) {
      if (!el.getClientRects().length) continue;
      const p = homePoint(el);
      if (!onScreen(p)) continue;
      const d = Math.abs(p.y - line);
      if (el === current) curD = d;
      if (d < bestD) { bestD = d; best = el; }
    }
    if (curD < Infinity && curD - bestD < 170) return current;
    return best || DOCK;
  }

  // ---------- State ----------
  let mode = 'wait';               // wait | sit | hop | drag | away
  let home = DOCK;
  let pos = { x: -200, y: -200 };
  let vel = { x: 0, y: 0 };
  let hop = null;
  let drag = null;
  let awayUntil = 0;
  let lastLand = 0;

  // Squash & stretch: a jelly spring pulled toward a target shape.
  const sq = { sx: 1, sy: 1, vx: 0, vy: 0, tx: 1, ty: 1 };
  const tiltS = { a: 0, v: 0, t: 0 };

  const eye = { ...EXPR.neutral };
  const gaze = { x: 0, y: 0, tx: 0, ty: 0 };
  const pointer = { x: innerWidth / 2, y: innerHeight / 2, moved: 0 };
  let nextDrift = 0;

  let blinkStart = -1, nextBlink = performance.now() + rand(1800, 4000);

  let red = false, redTimer = 0;
  let hovering = false, hoverStart = 0;
  let flash = null;                 // { expr, mark, until }
  let lastInput = performance.now();
  let wasSleepy = false;
  let shownExpr = '', shownMark = '';
  let nextIdle = performance.now() + rand(6000, 10000);
  let idleLook = null;              // { until, x, y }


  // ---------- Speech ----------
  // Lines are keyed by the perch's data-say. Each perch speaks once per
  // visit; jokes and game hints fill the quiet, never more than one
  // bubble at a time and never within ~20s of the last unprompted one.
  const LINES = {
    hero:    ["hi! that's karunya. builds agents that actually ship.", "i live on this polaroid. rent is free.", "psst. scroll down, the good stuff is below."],
    about:   ["short version: karunya picked up python the summer school exams ended. nobody asked.", "karunya's mom kept bringing real problems. karunya kept solving them."],
    stats:   ["9.2 CGPA. i've seen the spreadsheets.", "432 commits. i counted. (i didn't.)", "one agent in production, at a real company. i'm very proud."],
    native:  ["native runs with the wifi off. i also run with the wifi off.", "every run shows its working. unlike me in maths class.", "22 tools and not one paid API. frugal."],
    excel:   ["it never answers from a stale copy. fresh numbers only.", "see that red circle? that's the whole trick."],
    side:    ["the CBSE tool helped 600 students across two schools.", "roastly makes me want coffee. i can't have coffee. i'm a cloud."],
    stack:   ["python was the first love. i'm the second. probably.", "five languages. i speak zero. i communicate in vibes."],
    writing: ["karunya writes too. mostly about things that broke, and why."],
    grass:   ["this is my grass. please don't mow it.", "psst... the footer has a loose corner. just saying."],
    contact: ["say hi! karunya replies faster than i do.", "internships, collabs, weird problems. all welcome."],
    joke: [
      "why did the agent break up with the API? too many dependencies.",
      "i tried to tell a recursion joke. i tried to tell a recursion joke.",
      "there are 10 kinds of clouds: ones that get binary and ones that don't.",
      "i'm not lazy. i'm in low-power mode.",
      "debugging: being the detective in a crime where you're also the culprit.",
      "favourite data structure? a cloud. obviously.",
      "it works on my machine. i am the machine."
    ],
    hint:      ["there's a secret at the very bottom. i'm not saying more.", "psst. bottom of the page. the footer. a loose corner.", "i know a little game. it's hiding in the footer."],
    hintFound: ["wanna play cloud stack again? footer corner.", "i'm still thinking about that stack."],
    poke:  ["hey!", "ow.", "rude.", "that tickles!", "i'm telling karunya."],
    drop:  ["wheee!", "put me back!", "i can walk, you know.", "again! again!"],
    wake:  ["i wasn't sleeping. i was buffering.", "huh? oh. hi."],
    fast:  ["whoa, slow down!", "wait for me!"]
  };
  const lineIdx = {};
  function line(key) {
    const arr = LINES[key];
    if (!arr) return '';
    const i = lineIdx[key] == null ? Math.floor(Math.random() * arr.length) : (lineIdx[key] + 1) % arr.length;
    lineIdx[key] = i;
    return arr[i];
  }
  const found = () => { try { return localStorage.getItem('cloudstack-found') === '1'; } catch (_) { return false; } };

  const bubble = document.createElement('div');
  bubble.className = 'km-bubble';
  bubble.setAttribute('aria-hidden', 'true');
  bubble.innerHTML = '<span class="km-bubble-size"></span><span class="km-bubble-typed"></span>';
  document.body.appendChild(bubble);
  const bubbleSize = bubble.firstChild, bubbleTyped = bubble.lastChild;

  let speech = null, chatterAt = performance.now() + 16000;
  const spokenPerch = new Set();

  function say(text, opts = {}) {
    if (!text) return false;
    const now = performance.now();
    if (!opts.force && speech && now < speech.until) return false;
    speech = { text, start: now, until: now + (opts.hold || 3400) + text.length * 32, shown: -1 };
    bubbleSize.textContent = text;
    bubbleTyped.textContent = '';
    bubble.classList.add('on');
    chatterAt = now + rand(22000, 34000);
    return true;
  }

  function onLand(el) {
    const key = el.dataset && el.dataset.say;
    if (!key || spokenPerch.has(el)) return;
    spokenPerch.add(el);
    say(line(key));
  }

  function chatter(now) {
    if (mode !== 'sit' || speech || now < chatterAt || hovering || red || document.hidden) return;
    if (now - lastInput > 20000) return;
    const deep = (scrollY + innerHeight) / document.documentElement.scrollHeight > 0.6;
    let key = 'joke';
    if (Math.random() < (deep ? 0.55 : 0.22)) key = found() ? 'hintFound' : 'hint';
    say(line(key), { hold: 4000 });
  }

  function paintBubble(now) {
    if (!speech) return;
    if (now > speech.until) {
      bubble.classList.remove('on');
      speech = null;
      return;
    }
    const n = reduce.matches ? speech.text.length
      : Math.min(speech.text.length, Math.floor((now - speech.start) / 26));
    if (n !== speech.shown) { bubbleTyped.textContent = speech.text.slice(0, n); speech.shown = n; }
    const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    const headY = pos.y - FEET_PX + 16 * U;
    let top = headY - bh - 14, below = false;
    if (top < 78) { top = pos.y + 16; below = true; }
    const left = clamp(pos.x - bw * 0.32, 10, innerWidth - bw - 10);
    bubble.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
    bubble.style.setProperty('--tail', clamp(pos.x - left, 20, bw - 20).toFixed(1) + 'px');
    bubble.classList.toggle('below', below);
  }

  // Other scripts can make it talk: dispatch 'mascot:say' { text, mood }.
  addEventListener('mascot:say', (e) => {
    const d = e.detail || {};
    if (!d.text) return;
    say(d.text, { force: true, hold: 2600 });
    const mood = d.mood === 'surprised' ? ['surprised', 'alarm'] : ['excited', 'excite'];
    flash = { expr: mood[0], mark: mood[1], until: performance.now() + 1600 };
    if (mode === 'sit') startHop(home, { h: 22, dur: 0.34, wait: 0.06 });
  });

  // Switch tabs and the tab title asks you to come back.
  const pageTitle = document.title;
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = performance.now();
      document.title = 'come back! ☁';
    } else {
      document.title = pageTitle;
      if (performance.now() - hiddenAt > 4000) setTimeout(() => say("oh! you're back.", { force: true, hold: 1800 }), 400);
    }
  });

  addEventListener('cloudstack:close', (e) => {
    const best = e.detail && e.detail.best;
    setTimeout(() => say(best ? `best stack: ${best}. i believe in you.` : 'that was fun. again sometime?', { force: true }), 600);
  });

  // ---------- Motion ----------
  // Knock the jelly spring: it snaps to this shape and wobbles back.
  function squash(sx, sy) {
    if (reduce.matches) return;
    sq.sx = sx; sq.sy = sy;
  }

  function puff(x, y) {
    if (reduce.matches) return;
    for (const side of [-1, 1]) {
      const p = document.createElement('span');
      p.className = 'km-puff';
      p.style.left = (x + side * W * 0.28) + 'px';
      p.style.top = (y - 4) + 'px';
      p.style.setProperty('--dx', side * 16 + 'px');
      document.body.appendChild(p);
      p.addEventListener('animationend', () => p.remove(), { once: true });
    }
  }

  function startHop(to, opts = {}) {
    const tp = homePoint(to);
    if (reduce.matches) {
      // No arcs: fade out, reappear on the perch.
      root.classList.add('km-blink-move');
      setTimeout(() => {
        if (!to.fixed) home = to;
        pos = homePoint(to);
        mode = to.fixed ? 'away' : 'sit';
        root.classList.remove('km-blink-move');
      }, 160);
      hop = null;
      return;
    }
    const dist = Math.hypot(tp.x - pos.x, tp.y - pos.y);
    hop = {
      to,
      fromHome: mode === 'sit' ? home : null,
      from: { x: pos.x, y: pos.y },
      t: 0,
      // A beat of crouch before it leaves the ground (skipped for drops)
      wait: opts.drop ? 0 : (opts.wait != null ? opts.wait : 0.12),
      launched: !!opts.drop,
      dur: opts.dur || clamp(0.42 + dist / 1500, 0.42, 1),
      h: opts.h != null ? opts.h : clamp(44 + dist * 0.24, 44, 190),
      drop: !!opts.drop,
      spin: !opts.drop && dist > 520 ? Math.sign(tp.x - pos.x || 1) * 360 : 0
    };
    mode = 'hop';
  }

  function land() {
    const to = hop.to;
    const big = hop.drop || hop.h > 30;
    pos = homePoint(to);
    if (to.fixed) { mode = 'away'; }
    else { home = to; mode = 'sit'; if (to !== DOCK) onLand(to); }
    hop = null;
    lastLand = performance.now();
    sq.tx = 1; sq.ty = 1;
    squash(big ? 1.3 : 1.16, big ? 0.7 : 0.84);
    tiltS.a = ((tiltS.a % 360) + 540) % 360 - 180;   // drop any full spins
    if (big) puff(pos.x, pos.y);
  }

  // ---------- Expressions ----------
  function poke() {
    say(line('poke'), { force: true, hold: 1600 });
    red = true;
    root.classList.add('is-red');
    clearTimeout(redTimer);
    redTimer = setTimeout(() => {
      red = false;
      root.classList.remove('is-red');
    }, 2400);
    if (mode === 'sit') startHop(home, { h: 30, dur: 0.38, wait: 0.06 });
    else if (mode === 'away') startHop({ fixed: true, x: pos.x, y: pos.y }, { h: 30, dur: 0.38, wait: 0.06 });
  }

  function currentFace(now) {
    if (red) return ['angry', 'anger'];
    if (mode === 'drag' && drag && drag.moved > 6) return ['surprised', 'alarm'];
    if (flash && now < flash.until) return [flash.expr, flash.mark];
    if (hovering) return now - hoverStart > 2400 ? ['shy', 'shy'] : ['excited', 'excite'];
    if (now - lastInput > 20000) return ['sleepy', 'zz'];
    if (mode === 'hop' && hop && hop.launched && !hop.drop && hop.h > 40) return ['excited', 'motion'];
    return ['neutral', ''];
  }

  // Little things it does on its own while sitting.
  function idleAction(now) {
    const pick = Math.random();
    if (pick < 0.4) {
      startHop(home, { h: 16, dur: 0.32, wait: 0.1 });            // tiny hop
    } else if (pick < 0.75) {
      const side = Math.random() < 0.5 ? -1 : 1;                 // look around
      idleLook = { until: now + 1500, x: side, y: -0.2, flip: now + 750 };
    } else {
      tiltS.v += (Math.random() < 0.5 ? -1 : 1) * 150;           // wiggle
      squash(1.06, 0.95);
    }
  }

  // ---------- Input ----------
  function noteInput() {
    const now = performance.now();
    if (now - lastInput > 20000) wasSleepy = true;
    lastInput = now;
    if (wasSleepy) {
      wasSleepy = false;
      flash = { expr: 'surprised', mark: 'alarm', until: now + 700 };
      squash(0.86, 1.16);
      say(line('wake'), { force: true, hold: 2200 });
    }
  }

  addEventListener('pointermove', (e) => {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.moved = performance.now();
    noteInput();
  }, { passive: true });
  ['keydown', 'wheel', 'touchstart'].forEach(t => addEventListener(t, noteInput, { passive: true }));

  let lastScrollY = scrollY, lastScrollT = performance.now();
  addEventListener('scroll', () => {
    const now = performance.now();
    const v = Math.abs(scrollY - lastScrollY) / Math.max(1, now - lastScrollT) * 1000;
    lastScrollY = scrollY; lastScrollT = now;
    noteInput();
    if (v > 2800 && !red && mode !== 'drag') {
      flash = { expr: 'surprised', mark: 'alarm', until: now + 650 };
      say(line('fast'), { hold: 1200 });
    }
  }, { passive: true });

  svg.addEventListener('pointerenter', () => {
    hovering = true; hoverStart = performance.now();
    document.body.classList.add('cursor-hover');
    if (mode === 'sit') squash(0.88, 1.14);
  });
  svg.addEventListener('pointerleave', () => {
    hovering = false;
    document.body.classList.remove('cursor-hover');
  });

  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    drag = {
      id: e.pointerId,
      sx: e.clientX, sy: e.clientY,
      ox: e.clientX - pos.x, oy: e.clientY - pos.y,
      tx: pos.x, ty: pos.y,
      lx: e.clientX, ly: e.clientY, lt: performance.now(),
      vx: 0, vy: 0, moved: 0, prevMode: mode
    };
    root.classList.add('is-held');
    squash(1.08, 0.92);
  });

  svg.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const now = performance.now();
    drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy));
    if (drag.moved > 6 && mode !== 'drag') {
      mode = 'drag'; hop = null;
      squash(0.84, 1.2);
    }
    const dt = Math.max(1, now - drag.lt) / 1000;
    drag.vx = lerp(drag.vx, (e.clientX - drag.lx) / dt, 0.35);
    drag.vy = lerp(drag.vy, (e.clientY - drag.ly) / dt, 0.35);
    drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = now;
    drag.tx = e.clientX - drag.ox;
    drag.ty = e.clientY - drag.oy;
  });

  function release(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    root.classList.remove('is-held');
    sq.tx = 1; sq.ty = 1;
    if (d.moved <= 6) {
      if (mode === 'drag') mode = d.prevMode;
      poke();
      return;
    }
    mode = 'away';
    vel.x = clamp(d.vx, -2200, 2200);
    vel.y = clamp(d.vy, -2200, 2200);
    awayUntil = performance.now() + 5000;
    squash(1.2, 0.82);
    say(line('drop'), { force: true, hold: 1800 });
  }
  svg.addEventListener('pointerup', release);
  svg.addEventListener('pointercancel', release);

  // ---------- Frame ----------
  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let spin = 0;

    // ----- Position -----
    if (mode === 'sit') {
      const next = now - lastLand > 380 ? pickHome(home) : home;
      if (next !== home) startHop(next);
      else {
        pos = homePoint(home);
        const awake = now - lastInput < 20000;
        if (awake && !hovering && !red && now > nextIdle) {
          idleAction(now);
          nextIdle = now + rand(7000, 13000);
        }
      }
    }

    if (mode === 'hop' && hop) {
      if (!hop.launched) {
        // Crouch: sink down and spread out, then spring off.
        if (hop.fromHome) pos = homePoint(hop.fromHome);
        sq.tx = 1.2; sq.ty = 0.8;
        hop.wait -= dt;
        if (hop.wait <= 0) {
          hop.launched = true;
          hop.from = { x: pos.x, y: pos.y };
          sq.tx = 1; sq.ty = 1;
          squash(0.8, 1.26);
        }
      } else {
        hop.t = Math.min(1, hop.t + dt / hop.dur);
        const e = hop.t;
        const tp = homePoint(hop.to);
        const ex = hop.drop ? e : smooth(e) * 0.6 + e * 0.4;
        const nx = lerp(hop.from.x, tp.x, ex);
        const ny = hop.drop
          ? lerp(hop.from.y, tp.y, e * e)
          : lerp(hop.from.y, tp.y, e) - 4 * hop.h * e * (1 - e);
        // Stretch with vertical speed, round out at the top of the arc.
        const vy = hop.drop ? 1 : Math.abs(1 - 2 * e);
        sq.tx = 1 - vy * 0.1; sq.ty = 1 + vy * 0.14;
        const dir = Math.sign(tp.x - hop.from.x);
        tiltS.t = dir * 10 * (1 - 2 * e);
        spin = hop.spin * smooth(e);
        pos = { x: nx, y: ny };
        if (e >= 1) land();
      }
    }

    if (mode === 'drag' && drag) {
      pos.x = lerp(pos.x, drag.tx, damp(22, dt));
      pos.y = lerp(pos.y, drag.ty, damp(22, dt));
      // Dangles like it's being held by the scruff: swings against the motion.
      tiltS.t = clamp(-drag.vx * 0.02, -28, 28);
      const sp = Math.min(1, Math.hypot(drag.vx, drag.vy) / 2400);
      sq.tx = 1 - sp * 0.1; sq.ty = 1.06 + sp * 0.12;
    }

    if (mode === 'away') {
      pos.x += vel.x * dt; pos.y += vel.y * dt;
      const f = Math.exp(-5 * dt);
      vel.x *= f; vel.y *= f;
      const minX = W / 2 + 6, maxX = innerWidth - W / 2 - 6;
      const minY = FEET_PX + 70, maxY = innerHeight - 8;
      if (pos.x < minX || pos.x > maxX) { pos.x = clamp(pos.x, minX, maxX); vel.x *= -0.45; squash(0.86, 1.12); }
      if (pos.y < minY || pos.y > maxY) { pos.y = clamp(pos.y, minY, maxY); vel.y *= -0.45; squash(1.14, 0.88); }
      tiltS.t = clamp(vel.x * 0.012, -16, 16);
      if (now > awayUntil && !drag) startHop(pickHome(null));
    }

    if (mode === 'sit' || mode === 'wait') tiltS.t = 0;

    // Ghost marks home while it's been dragged off
    const showGhost = mode === 'drag' || mode === 'away';
    ghost.classList.toggle('on', showGhost);
    if (showGhost) {
      const gp = homePoint(pickHome(home));
      ghost.style.transform = `translate3d(${gp.x - W / 2}px, ${gp.y - FEET_PX}px, 0)`;
    }

    // ----- Springs -----
    // Jelly: bouncy, lightly damped, so landings wobble a few times.
    const k = 320, c = 9.5;
    sq.vx += (-(sq.sx - sq.tx) * k - sq.vx * c) * dt;
    sq.vy += (-(sq.sy - sq.ty) * k - sq.vy * c) * dt;
    sq.sx += sq.vx * dt;
    sq.sy += sq.vy * dt;
    // Tilt: a softer spring so swings overshoot a touch.
    tiltS.v += (-(tiltS.a - tiltS.t) * 160 - tiltS.v * 11) * dt;
    tiltS.a += tiltS.v * dt;

    // Breathing, and a slow sway, while it sits.
    const sitting = mode === 'sit' && !reduce.matches;
    const asleep = now - lastInput > 20000;
    const bRate = asleep ? 1.3 : 2.4;
    const breathe = sitting ? Math.sin(now / 1000 * bRate) * (asleep ? 0.03 : 0.02) : 0;
    const sway = sitting && !asleep ? Math.sin(now / 1000 * 1.1) * 1.4 : 0;

    // ----- Face -----
    const [exprName, mark] = currentFace(now);
    if (exprName !== shownExpr) { root.dataset.expr = exprName; shownExpr = exprName; }
    if (mark !== shownMark) { root.dataset.mark = mark; shownMark = mark; }
    const tgt = EXPR[exprName];
    const ek = damp(15, dt);
    for (const key in tgt) eye[key] = lerp(eye[key], tgt[key], ek);
    cheeks.style.opacity = eye.blush.toFixed(3);

    // Gaze: travel direction, the cursor, an idle look-around, or a drift.
    const eyeCx = pos.x, eyeCy = pos.y - FEET_PX + EYE_Y * U;
    if (mode === 'hop' && hop && hop.launched) {
      const tp = homePoint(hop.to);
      const d = Math.hypot(tp.x - pos.x, tp.y - pos.y) || 1;
      gaze.tx = (tp.x - pos.x) / d; gaze.ty = (tp.y - pos.y) / d;
    } else if (idleLook && now < idleLook.until) {
      if (now > idleLook.flip) { idleLook.x *= -1; idleLook.flip = Infinity; }
      gaze.tx = idleLook.x; gaze.ty = idleLook.y;
    } else if (now - pointer.moved < 2600 || mode === 'drag') {
      const dx = pointer.x - eyeCx, dy = pointer.y - eyeCy;
      const d = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, d / 150);
      gaze.tx = dx / d * reach; gaze.ty = dy / d * reach;
    } else if (now > nextDrift) {
      gaze.tx = rand(-0.9, 0.9); gaze.ty = rand(-0.5, 0.6);
      nextDrift = now + rand(1200, 3200);
    }
    if (exprName === 'shy') { gaze.tx *= 0.4; gaze.ty = 0.85; }
    const gk = damp(mode === 'drag' ? 18 : 8, dt);
    gaze.x = lerp(gaze.x, gaze.tx, gk);
    gaze.y = lerp(gaze.y, gaze.ty, gk);

    // Blink (sometimes twice), eased so the lids feel soft.
    let lid = 1;
    if (blinkStart < 0 && now > nextBlink && exprName !== 'sleepy') blinkStart = now;
    if (blinkStart >= 0) {
      const t = (now - blinkStart) / 170;
      if (t >= 1) {
        blinkStart = -1;
        nextBlink = now + (Math.random() < 0.22 ? 160 : rand(2400, 6000));
      } else {
        lid = 1 - Math.pow(Math.sin(Math.PI * t), 0.7) * 0.92;
      }
    }

    for (let i = 0; i < 2; i++) {
      const cx = EYES_X[i], cy = EYE_Y + eye.dy;
      const ry = Math.max(0.8, eye.ry * lid);
      whites[i].setAttribute('rx', eye.rx.toFixed(2));
      whites[i].setAttribute('ry', ry.toFixed(2));
      whites[i].setAttribute('cy', cy.toFixed(2));
      const limX = Math.max(0, eye.rx - eye.prx - 1.2) * eye.look;
      const limY = Math.max(0, eye.ry - eye.pry - 1.2) * eye.look * lid;
      const px = cx + gaze.x * limX, py = cy + gaze.y * limY;
      const pry = Math.max(0, eye.pry * lid);
      pupils[i].setAttribute('cx', px.toFixed(2));
      pupils[i].setAttribute('cy', py.toFixed(2));
      pupils[i].setAttribute('rx', eye.prx.toFixed(2));
      pupils[i].setAttribute('ry', pry.toFixed(2));
      // Sparkles ride on the pupil and vanish when it's small or shut.
      const shine = eye.prx > 3 && lid > 0.5 ? 1 : 0;
      shinesA[i].setAttribute('cx', (px - eye.prx * 0.32).toFixed(2));
      shinesA[i].setAttribute('cy', (py - pry * 0.38).toFixed(2));
      shinesB[i].setAttribute('cx', (px + eye.prx * 0.36).toFixed(2));
      shinesB[i].setAttribute('cy', (py + pry * 0.3).toFixed(2));
      shinesA[i].style.opacity = shinesB[i].style.opacity = shine;
    }

    chatter(now);
    paintBubble(now);

    // ----- Paint -----
    root.style.transform = `translate3d(${(pos.x - W / 2).toFixed(1)}px, ${(pos.y - FEET_PX).toFixed(1)}px, 0)`;
    squashEl.style.transform =
      `rotate(${(tiltS.a + sway + spin).toFixed(2)}deg) scale(${(sq.sx - breathe).toFixed(3)}, ${(sq.sy + breathe).toFixed(3)})`;

    requestAnimationFrame(frame);
  }

  // ---------- Entrance ----------
  // Drops in from above onto the first perch once the hero has settled.
  function enter() {
    const first = pickHome(null);
    const tp = homePoint(first);
    pos = { x: tp.x, y: -H };
    root.classList.add('is-in');
    startHop(first, { drop: true, h: 0, dur: 0.6 });
  }

  requestAnimationFrame(frame);
  const go = () => setTimeout(enter, reduce.matches ? 0 : 1700);
  if (document.readyState === 'complete') go();
  else addEventListener('load', go, { once: true });
})();
