/* ============================================================
   Portfolio JS — nav, reveals, cursor, parallax, plane
   ============================================================ */
(function() {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer  = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ---------- Inertial smooth scroll ----------
  // Native scrolling stays the fallback: touch, coarse pointers and
  // reduced-motion users never get the wheel interception.
  if (window.Lenis && finePointer && !reduceMotion) {
    const lenis = new window.Lenis({
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      wheelMultiplier: 0.9,
      touchMultiplier: 1.6,
      smoothWheel: true
    });
    document.documentElement.classList.add('lenis-on');
    (function raf(time) { lenis.raf(time); requestAnimationFrame(raf); })();

    // In-page anchors go through Lenis so they ease rather than jump.
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (!id || id === '#') return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -90, duration: 1.25 });
        document.body.classList.remove('menu-open');
      });
    });
    window.__lenis = lenis;
  }

  // ---------- Custom cursor ----------
  const dot = document.querySelector('.cursor-dot');
  const ring = document.querySelector('.cursor-ring');
  if (dot && ring && window.matchMedia('(hover: hover)').matches) {
    document.body.classList.add('cursor-ready');
    let mx = 0, my = 0, rx = 0, ry = 0;
    window.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px)`;
    });
    const lerp = () => {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      requestAnimationFrame(lerp);
    };
    lerp();
    document.querySelectorAll('a, button, .card, .post-card, .pill, .status-pill, .polaroid').forEach(el => {
      el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
      el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
    });
  }

  // ---------- Mobile menu ----------
  const hamb = document.querySelector('.hamburger');
  if (hamb) {
    hamb.addEventListener('click', () => document.body.classList.toggle('menu-open'));
    document.querySelectorAll('.mobile-overlay a').forEach(a => {
      a.addEventListener('click', () => document.body.classList.remove('menu-open'));
    });
  }

  // ---------- Reveal on scroll ----------
  // Grid children get an index so they cascade in instead of arriving
  // as one block. The index lives on the child, the trigger on the parent.
  const STAGGER_GRIDS = '.bento, .stats-grid, .stack-grid, .writing-grid, .contact-grid, .skills-grid';
  document.querySelectorAll(STAGGER_GRIDS).forEach(grid => {
    const kids = Array.from(grid.children);
    if (kids.length < 2) return;
    grid.classList.add('stagger');
    kids.forEach((kid, i) => kid.style.setProperty('--i', i));
  });

  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        revealObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.04, rootMargin: '0px 0px 12% 0px' });
  document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

  // A grid that is itself the .reveal element needs no separate trigger;
  // one that sits inside a taller section gets its own, so long sections
  // don't fire everything at once.
  document.querySelectorAll('.stagger:not(.reveal)').forEach(el => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        obs.unobserve(e.target);
      });
    }, { threshold: 0.04, rootMargin: '0px 0px 12% 0px' });
    obs.observe(el);
  });

  // ---------- Section titles: word-by-word rise ----------
  if (!reduceMotion) {
    document.querySelectorAll('.section-title').forEach(splitIntoWords);

    const titleObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('words-in');
        titleObs.unobserve(e.target);
      });
    }, { threshold: 0.25 });
    document.querySelectorAll('.section-title.split').forEach(el => titleObs.observe(el));
  }

  function splitIntoWords(title) {
    if (title.dataset.split) return;
    const out = document.createDocumentFragment();
    let n = 0;

    // Walk top-level nodes so inline markup (<em>, <br>) survives intact.
    Array.from(title.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        node.nodeValue.split(/(\s+)/).forEach(chunk => {
          if (!chunk) return;
          if (/^\s+$/.test(chunk)) { out.appendChild(document.createTextNode(chunk)); return; }
          out.appendChild(wrapWord(document.createTextNode(chunk), n++));
        });
      } else if (node.nodeName === 'BR') {
        out.appendChild(node.cloneNode(true));
      } else {
        out.appendChild(wrapWord(node.cloneNode(true), n++));
      }
    });

    if (!n) return;
    title.innerHTML = '';
    title.appendChild(out);
    title.dataset.split = 'true';
    title.classList.add('split');
  }

  function wrapWord(inner, i) {
    const mask = document.createElement('span');
    mask.className = 'w';
    const lift = document.createElement('span');
    lift.className = 'w-i';
    lift.style.setProperty('--wi', i);
    lift.appendChild(inner);
    mask.appendChild(lift);
    return mask;
  }

  // ---------- Magnetic buttons ----------
  // Small pull toward the pointer — enough to feel alive, not enough
  // to make the sketched outline look like it came unstuck.
  if (finePointer && !reduceMotion) {
    document.querySelectorAll('.btn, .nav-email, .card .links a').forEach(el => {
      let raf = null, cx = 0, cy = 0, tx = 0, ty = 0;
      const strength = el.classList.contains('btn') ? 0.28 : 0.4;

      function loop() {
        cx += (tx - cx) * 0.14;
        cy += (ty - cy) * 0.14;
        el.style.setProperty('--mx', cx.toFixed(2) + 'px');
        el.style.setProperty('--my', cy.toFixed(2) + 'px');
        if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) {
          raf = requestAnimationFrame(loop);
        } else { raf = null; }
      }
      function kick() { if (!raf) raf = requestAnimationFrame(loop); }

      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        tx = (e.clientX - (r.left + r.width / 2)) * strength;
        ty = (e.clientY - (r.top + r.height / 2)) * strength;
        kick();
      });
      el.addEventListener('mouseleave', () => { tx = 0; ty = 0; kick(); });
      el.classList.add('magnetic');
    });
  }

  // ---------- Nav: condense on scroll, retreat on the way down ----------
  const nav = document.querySelector('.nav');
  if (nav) {
    let lastY = window.scrollY;
    let ticking = false;
    function navUpdate() {
      const y = window.scrollY;
      nav.classList.toggle('nav-condensed', y > 60);
      // Only hide well past the hero, and never while the menu is open.
      if (y > 420 && y > lastY + 6 && !document.body.classList.contains('menu-open')) {
        nav.classList.add('nav-away');
      } else if (y < lastY - 6 || y < 200) {
        nav.classList.remove('nav-away');
      }
      lastY = y;
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(navUpdate); }
    }, { passive: true });
    navUpdate();
  }

  // ---------- Reading progress ----------
  const progress = document.querySelector('.scroll-progress');
  if (progress) {
    let pTicking = false;
    function progUpdate() {
      const doc = document.documentElement;
      const total = doc.scrollHeight - window.innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 0;
      progress.style.transform = `scaleX(${p.toFixed(4)})`;
      pTicking = false;
    }
    window.addEventListener('scroll', () => {
      if (!pTicking) { pTicking = true; requestAnimationFrame(progUpdate); }
    }, { passive: true });
    progUpdate();
  }

  // ---------- Pill cascade ----------
  const pillObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const pills = e.target.querySelectorAll('.pill');
        pills.forEach((p, i) => setTimeout(() => p.classList.add('in'), i * 26));
        pillObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.18 });
  document.querySelectorAll('.pills-cluster').forEach(el => pillObs.observe(el));

  // ---------- Stats count-up ----------
  const statObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        animateStat(e.target);
        statObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.55 });
  document.querySelectorAll('.stat-card .num').forEach(el => statObs.observe(el));

  function animateStat(el) {
    const textNode = el.firstChild;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;
    const original = textNode.nodeValue.trim();
    const match = original.match(/^([\d.,]+)(.*)$/);
    if (!match) return;
    const cleanNum = match[1].replace(/,/g, '');
    const target = parseFloat(cleanNum);
    if (isNaN(target)) return;
    const suffix = match[2];
    const decimals = (cleanNum.split('.')[1] || '').length;
    const duration = 1300;
    const start = performance.now();

    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const current = target * eased;
      const numText = decimals
        ? current.toFixed(decimals)
        : Math.floor(current).toString();
      textNode.nodeValue = numText + suffix;
      if (t < 1) requestAnimationFrame(tick);
      else textNode.nodeValue = original;
    }
    textNode.nodeValue = (0).toFixed(decimals) + suffix;
    requestAnimationFrame(tick);
  }

  // ---------- Nav scroll-spy ----------
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
  if (navLinks.length) {
    const sectionMap = new Map();
    navLinks.forEach(a => {
      const id = a.getAttribute('href').slice(1);
      const sec = document.getElementById(id);
      if (sec) sectionMap.set(sec, a);
    });
    const spyObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        const link = sectionMap.get(e.target);
        if (!link) return;
        if (e.isIntersecting && e.intersectionRatio > 0.3) {
          navLinks.forEach(l => l.classList.remove('active'));
          link.classList.add('active');
        }
      });
    }, { threshold: [0.3, 0.6] });
    sectionMap.forEach((_, sec) => spyObs.observe(sec));
  }

  // ---------- Mouse tilt on polaroid ----------
  const polaroid = document.querySelector('.polaroid[data-tilt]');
  if (polaroid && window.matchMedia('(hover: hover)').matches) {
    const wrap = polaroid.parentElement;
    let tx = 0, ty = 0, cx = 0, cy = 0;
    wrap.addEventListener('mousemove', (e) => {
      const r = wrap.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      tx = -ny * 9;
      ty =  nx * 11;
    });
    wrap.addEventListener('mouseleave', () => { tx = 0; ty = 0; });
    function loop() {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      polaroid.style.transform = `rotate(-2deg) rotateX(${cx}deg) rotateY(${cy}deg)`;
      requestAnimationFrame(loop);
    }
    loop();
  }

  // ---------- Parallax scroll ----------
  const heroPhoto = document.querySelector('.hero-photo-col');
  const planeFloat = document.querySelector('.hero-floating-plane');

  // Margin doodles drift at their own rates, so the page reads as a few
  // sheets of tracing paper rather than one flat surface. The doodles are
  // decorative and already rotated inline, so `translate` is used to avoid
  // clobbering that transform.
  // Base positions are measured once (with any drift cleared first), so the
  // offset we apply never feeds back into the next frame's measurement.
  const doodles = [];
  function measureDoodles() {
    doodles.length = 0;
    if (reduceMotion) return;
    document.querySelectorAll('.doodle').forEach((el, i) => {
      el.style.translate = '';
      const r = el.getBoundingClientRect();
      doodles.push({
        el,
        base: r.top + window.scrollY + r.height / 2,
        rate:  0.055 + ((i * 37) % 11) * 0.013,  // 0.055 – 0.185, deterministic
        drift: ((i % 3) - 1) * 0.035             // slight sideways lean
      });
    });
  }

  let parallaxTicking = false;
  function onScrollParallax() {
    const y = window.scrollY;
    const vh = window.innerHeight;
    if (heroPhoto && y < vh) {
      heroPhoto.style.translate = `0 ${y * 0.10}px`;
    }
    if (planeFloat && y < vh) {
      planeFloat.style.translate = `${y * 0.3}px ${-y * 0.2}px`;
    }
    const viewMid = y + vh / 2;
    for (const d of doodles) {
      const off = d.base - viewMid;
      if (off < -vh - 300 || off > vh + 300) continue;   // well offscreen: skip
      d.el.style.translate =
        `${(off * d.drift).toFixed(1)}px ${(-off * d.rate).toFixed(1)}px`;
    }
    parallaxTicking = false;
  }

  // Touch screens scroll on the compositor, so a JS-driven offset always
  // trails a frame behind and reads as judder. Keep parallax for mice.
  if (finePointer) {
    measureDoodles();
    window.addEventListener('scroll', () => {
      if (!parallaxTicking) { parallaxTicking = true; requestAnimationFrame(onScrollParallax); }
    }, { passive: true });
    window.addEventListener('resize', () => { measureDoodles(); onScrollParallax(); }, { passive: true });
    window.addEventListener('load', () => { measureDoodles(); onScrollParallax(); });
    onScrollParallax();
  }

  // ---------- Contact form ----------
  // To enable real form submission via Formspree:
  //   1. Sign up at https://formspree.io and create a new form.
  //   2. Copy your endpoint (looks like https://formspree.io/f/xxxxxxxx) into FORMSPREE_ENDPOINT below.
  // Until that's set, the form opens the visitor's mail client (mailto:) as a reliable fallback.
  const FORMSPREE_ENDPOINT = ''; // e.g. 'https://formspree.io/f/xxxxxxxx'
  const CONTACT_EMAIL = 'Karunya.muddana@outlook.com';

  const form = document.querySelector('.contact-form');
  if (form) {
    const statusEl = form.querySelector('.form-status') || (() => {
      const el = document.createElement('div');
      el.className = 'form-status';
      form.appendChild(el);
      return el;
    })();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Honeypot
      const honeypot = form.querySelector('[name="_gotcha"]');
      if (honeypot && honeypot.value) return;

      const btn = form.querySelector('button[type="submit"]');
      const original = btn.textContent;

      const data = {
        name:    (form.querySelector('[name="name"]')   || {}).value?.trim()    || '',
        email:   (form.querySelector('[name="email"]')  || {}).value?.trim()    || '',
        message: (form.querySelector('[name="message"]')|| {}).value?.trim()    || '',
      };

      if (!data.name || !data.email || !data.message) {
        showStatus('error', 'please fill in all three fields');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        showStatus('error', 'that email address looks off');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Sending…';
      showStatus('pending', '');

      const useFormspree = FORMSPREE_ENDPOINT && FORMSPREE_ENDPOINT.includes('formspree.io');

      if (useFormspree) {
        try {
          const formData = new FormData();
          formData.append('name',     data.name);
          formData.append('email',    data.email);
          formData.append('message',  data.message);
          formData.append('_subject', `Portfolio contact from ${data.name}`);
          formData.append('_replyto', data.email);

          const res = await fetch(FORMSPREE_ENDPOINT, {
            method: 'POST',
            body: formData,
            headers: { 'Accept': 'application/json' }
          });

          if (res.ok) {
            showStatus('success', `thanks ${data.name.split(' ')[0]} — I\u2019ll write back soon.`);
            form.reset();
            btn.textContent = 'Sent ✓';
            setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 3000);
            return;
          }
          throw new Error('Formspree returned non-OK');
        } catch (err) {
          // fall through to mailto
          openMailto(data);
          btn.textContent = original;
          btn.disabled = false;
        }
      } else {
        // Direct mailto fallback (always works)
        openMailto(data);
        showStatus('mailto', 'opening your mail app — hit send there to deliver.');
        setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1500);
      }
    });

    function openMailto(data) {
      const subject = `Portfolio contact from ${data.name}`;
      const body = `Name: ${data.name}\nEmail: ${data.email}\n\n${data.message}\n\n— sent from karunya.dev`;
      const url = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = url;
    }

    function showStatus(type, msg) {
      statusEl.classList.remove('success', 'error', 'mailto', 'pending');
      if (type) statusEl.classList.add(type);
      statusEl.textContent = msg;
      // The mascot reacts to how the message went
      const say = {
        success: 'sent! karunya will write back soon.',
        mailto:  'your mail app should pop up. hit send there!',
        error:   'hmm. that email looks a bit off.'
      }[type];
      if (say) window.dispatchEvent(new CustomEvent('mascot:say', { detail: { text: say, mood: type === 'error' ? 'surprised' : 'excited' } }));
    }
  }

  // ---------- ABOUT PAGE: vertical paper plane ----------
  const planeTrack = document.querySelector('.plane-track');
  if (planeTrack) initPlane();

  function initPlane() {
    const svg = planeTrack.querySelector('svg');
    const path = svg.querySelector('#plane-path');
    const plane = planeTrack.querySelector('.plane-img');
    const progressBar = document.querySelector('.about-progress');

    let pathLength = 0;
    let trackH = 0, trackW = 0;
    let lastAngle = 0;
    let wobblePhase = 0;
    const planeHalf = plane.offsetWidth / 2;

    function buildPath() {
      trackH = planeTrack.clientHeight;
      trackW = planeTrack.clientWidth;
      const cx = trackW / 2;
      const dx = Math.min(14, trackW * 0.22);
      const h = trackH;
      const d = `M ${cx} 0 ` +
                `C ${cx - dx} ${h * 0.11}, ${cx + dx} ${h * 0.20}, ${cx} ${h * 0.30} ` +
                `S ${cx - dx} ${h * 0.48}, ${cx} ${h * 0.58} ` +
                `S ${cx + dx} ${h * 0.74}, ${cx} ${h * 0.84} ` +
                `S ${cx - dx * 0.6} ${h * 0.95}, ${cx} ${h}`;
      svg.setAttribute('viewBox', `0 0 ${trackW} ${trackH}`);
      path.setAttribute('d', d);
      pathLength = path.getTotalLength();
      path.style.strokeDasharray = '4 7';
      path.style.strokeDashoffset = pathLength;
    }

    function update() {
      const doc = document.documentElement;
      const totalScroll = doc.scrollHeight - window.innerHeight;
      const p = totalScroll > 0 ? Math.max(0, Math.min(1, window.scrollY / totalScroll)) : 0;
      const t = Math.max(0, Math.min(1, (p - 0.02) / 0.96));
      const len = pathLength * t;
      const pt = path.getPointAtLength(len);
      const aheadPt = path.getPointAtLength(Math.min(pathLength, len + 2));

      const dy = aheadPt.y - pt.y;
      const dx = aheadPt.x - pt.x;
      const targetAngle = Math.atan2(dx, dy) * 180 / Math.PI;
      lastAngle += (targetAngle - lastAngle) * 0.18;

      wobblePhase += 0.05;
      const wobble = Math.sin(wobblePhase) * 0.9;

      plane.style.transform =
        `translate(${pt.x - planeHalf}px, ${pt.y - planeHalf}px) rotate(${lastAngle + wobble}deg)`;
      path.style.strokeDashoffset = String(Math.max(0, pathLength - len));
      if (progressBar) progressBar.style.setProperty('--progress', (p * 100).toFixed(2) + '%');
    }

    buildPath();
    update();
    window.addEventListener('resize', () => { buildPath(); update(); });
    window.addEventListener('scroll', update, { passive: true });
    (function loop() { update(); requestAnimationFrame(loop); })();
  }

  // ---------- Copy email ----------
  document.querySelectorAll('.copy-chip').forEach((chip) => {
    chip.addEventListener('click', async () => {
      const text = chip.dataset.copy;
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; }
      catch (_) {
        const ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { ok = document.execCommand('copy'); } catch (_) {}
        ta.remove();
      }
      chip.textContent = ok ? 'copied ✓' : 'press ctrl+c';
      chip.classList.toggle('done', ok);
      if (ok) window.dispatchEvent(new CustomEvent('mascot:say', { detail: { text: 'copied! go on, paste it somewhere nice.', mood: 'excited' } }));
      clearTimeout(chip._t);
      chip._t = setTimeout(() => { chip.textContent = 'copy'; chip.classList.remove('done'); }, 1800);
    });
  });
})();
