/* ============================================================
   Resume sheet — any link to resume.html opens the resume as a
   sheet of paper slid over the page instead of navigating away.
   The sheet loads resume.html?embed=1 in a frame, so the resume
   itself only lives in one file. Cmd/Ctrl-click still opens the
   real page, and /#resume opens the sheet on load.
   ============================================================ */
(function () {
  'use strict';

  const links = document.querySelectorAll('a[href="resume.html"]');
  if (!links.length) return;

  let sheet, frame, closeBtn, lastFocus = null, closeTimer = 0;

  function build() {
    sheet = document.createElement('div');
    sheet.className = 'rsheet';
    sheet.hidden = true;
    sheet.setAttribute('data-lenis-prevent', '');
    sheet.innerHTML = `
      <div class="rsheet-backdrop" data-close></div>
      <div class="rsheet-paper" role="dialog" aria-modal="true" aria-label="Resume">
        <img class="rsheet-tape rsheet-tape-l" src="assets/paper/tape-short-1.webp" alt="" />
        <img class="rsheet-tape rsheet-tape-r" src="assets/paper/tape-short-4.webp" alt="" />
        <div class="rsheet-actions">
          <a class="rsheet-btn" href="resume.html" target="_blank" rel="noopener" aria-label="Open the resume in a new tab">&#8599;</a>
          <button class="rsheet-btn" type="button" data-print aria-label="Print or save the resume as PDF">&#8595;</button>
          <button class="rsheet-btn" type="button" data-close aria-label="Close the resume">&#10005;</button>
        </div>
        <iframe class="rsheet-frame" title="Resume, Karunya Muddana"></iframe>
      </div>`;
    document.body.appendChild(sheet);
    frame = sheet.querySelector('iframe');
    closeBtn = sheet.querySelector('button[data-close]');

    sheet.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) close();
      else if (e.target.closest('[data-print]')) {
        try { frame.contentWindow.focus(); frame.contentWindow.print(); }
        catch (_) { window.open('resume.html', '_blank', 'noopener'); }
      }
    });
    sheet.addEventListener('keydown', trapFocus);
  }

  function open() {
    if (!sheet) build();
    clearTimeout(closeTimer);
    if (!frame.getAttribute('src')) frame.src = 'resume.html?embed=1';
    lastFocus = document.activeElement;
    sheet.hidden = false;
    document.documentElement.classList.add('rsheet-lock');
    if (window.__lenis) window.__lenis.stop();
    document.body.classList.remove('menu-open');
    requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add('open')));
    closeBtn.focus({ preventScroll: true });
    document.addEventListener('keydown', onKey);
  }

  function close() {
    if (!sheet || sheet.hidden) return;
    sheet.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    closeTimer = setTimeout(() => {
      sheet.hidden = true;
      document.documentElement.classList.remove('rsheet-lock');
      if (window.__lenis) window.__lenis.start();
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }, 360);
    if (location.hash === '#resume') history.replaceState(null, '', location.pathname + location.search);
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  }

  // Keep Tab inside the sheet while it's open.
  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    const items = Array.from(sheet.querySelectorAll('.rsheet-actions a, .rsheet-actions button, iframe'));
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  links.forEach((a) => {
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      open();
    });
  });

  if (location.hash === '#resume') open();
})();
