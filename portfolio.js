/* ============================================================
   Portfolio JS — nav, reveals, cursor, parallax, plane
   ============================================================ */
(function() {
  'use strict';

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
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        revealObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.16 });
  document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

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
    const isDecimal = cleanNum.includes('.');
    const duration = 1300;
    const start = performance.now();

    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const current = target * eased;
      const numText = isDecimal
        ? current.toFixed(1)
        : Math.floor(current).toString();
      textNode.nodeValue = numText + suffix;
      if (t < 1) requestAnimationFrame(tick);
      else textNode.nodeValue = original;
    }
    textNode.nodeValue = (isDecimal ? '0.0' : '0') + suffix;
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
  function onScrollParallax() {
    const y = window.scrollY;
    if (heroPhoto && y < window.innerHeight) {
      heroPhoto.style.translate = `0 ${y * 0.10}px`;
    }
    if (planeFloat && y < window.innerHeight) {
      planeFloat.style.translate = `${y * 0.3}px ${-y * 0.2}px`;
    }
  }
  window.addEventListener('scroll', onScrollParallax, { passive: true });
  onScrollParallax();

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
})();
