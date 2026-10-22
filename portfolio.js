/* ============================================================
   Portfolio JS — scroll, nav, contact form, the about-page plane.
   Content is simply there: no scroll reveals, no parallax, no
   custom cursor. The hero write-in (motion.js) is the one entrance.
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

  // ---------- Mobile menu ----------
  const hamb = document.querySelector('.hamburger');
  if (hamb) {
    hamb.addEventListener('click', () => document.body.classList.toggle('menu-open'));
    document.querySelectorAll('.mobile-overlay a').forEach(a => {
      a.addEventListener('click', () => document.body.classList.remove('menu-open'));
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
      lastAngle += (targetAngle - lastAngle) * 0.35;

      plane.style.transform =
        `translate(${pt.x - planeHalf}px, ${pt.y - planeHalf}px) rotate(${lastAngle}deg)`;
      path.style.strokeDashoffset = String(Math.max(0, pathLength - len));
      if (progressBar) progressBar.style.setProperty('--progress', (p * 100).toFixed(2) + '%');
    }

    // Only work when the page actually moves; nothing runs while idle.
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; update(); });
    };
    buildPath();
    update();
    window.addEventListener('resize', () => { buildPath(); update(); });
    window.addEventListener('scroll', onScroll, { passive: true });
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
