/* ============================================================
   CHAT logic — Notebook AI conversation
   ============================================================ */
(function() {
  'use strict';

  const API_BASE = 'https://agent-for-website.onrender.com';

  const messagesEl  = document.getElementById('messages');
  const inputEl     = document.getElementById('chat-input');
  const formEl      = document.getElementById('composer');
  const suggestedEl = document.getElementById('suggested');
  const sendBtn     = document.getElementById('send-btn');

  if (!messagesEl || !inputEl || !formEl) return;

  const history = [];
  let busy = false;

  // Hand-writing rhythm. A real pen doesn't move at one speed: it runs on
  // through a word, hesitates at a comma, and stops properly at a full stop.
  const PACE = {
    base:       17,   // ms per character mid-word
    jitter:     7,    // random 0..n added per character
    space:      34,   // between words
    comma:      130,  // , ; :
    sentence:   290,  // . ! ?
    dash:       90,   // - and en/em dashes
  };

  // Literal characters, no escapes: em dash, en dash, hyphen.
  const SENTENCE_END = /[.!?]/;
  const CLAUSE_END   = /[,;:]/;
  const DASHES       = /[—–-]/;

  // Submit handler
  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
  });

  // Quick prompts
  document.querySelectorAll('.suggest-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (busy) return;
      inputEl.value = btn.textContent.trim();
      sendMessage();
    });
  });

  // Focus on load
  setTimeout(() => inputEl.focus(), 400);

  async function sendMessage() {
    const message = inputEl.value.trim();
    if (!message || busy) return;

    busy = true;
    inputEl.disabled = true;
    if (sendBtn) sendBtn.disabled = true;

    // Hide suggested prompts on first send
    if (suggestedEl && suggestedEl.parentNode) {
      suggestedEl.style.transition = 'opacity 220ms ease, transform 220ms ease';
      suggestedEl.style.opacity = '0';
      suggestedEl.style.transform = 'translateY(-6px)';
      setTimeout(() => suggestedEl.remove(), 240);
    }

    // Append visitor message
    appendUserMessage(message);

    inputEl.value = '';

    // Show "writing..." indicator
    const indicator = appendWritingIndicator();

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: history.slice(-10)
        }),
      });

      if (!res.ok) {
        indicator.remove();
        if (res.status === 429) {
          appendAIMessage('that’s a few too many at once — give it about a minute and ask again.', true);
        } else if (res.status >= 500) {
          appendAIMessage('my end fell over answering that one. worth another go; if it keeps happening, email me instead.', true);
        } else {
          appendAIMessage('that one didn’t get through. try rephrasing it?', true);
        }
        return;
      }

      const data = await res.json();
      indicator.remove();
      const reply = (data && data.response) ? data.response : "(I came back empty-handed — try rephrasing?)";
      appendAIMessage(reply);

      history.push({ role: 'user', content: message });
      history.push({ role: 'assistant', content: reply });
      // keep payload light
      while (history.length > 20) history.splice(0, 2);

    } catch (err) {
      indicator.remove();
      appendAIMessage('can’t reach my end from here — either your connection dropped or the server is waking up. it sleeps when nobody’s around, so give it a moment and try again.', true);
    } finally {
      busy = false;
      inputEl.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
      setTimeout(() => inputEl.focus(), 200);
    }
  }

  function stamp() {
    const el = document.createElement('span');
    el.className = 'stamp';
    el.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return el;
  }

  function appendUserMessage(text) {
    const block = document.createElement('div');
    block.className = 'msg msg-user';

    const speaker = document.createElement('span');
    speaker.className = 'speaker';
    speaker.textContent = 'you';
    block.appendChild(speaker);

    const content = document.createElement('span');
    content.className = 'content';
    content.textContent = text;
    block.appendChild(content);
    block.appendChild(stamp());

    messagesEl.appendChild(block);
    scrollToBottom();
  }

  function appendAIMessage(text, isError) {
    const block = document.createElement('div');
    block.className = 'msg msg-ai' + (isError ? ' msg-error' : '');

    const speaker = document.createElement('span');
    speaker.className = 'speaker';
    speaker.textContent = 'karunya';
    block.appendChild(speaker);

    const content = document.createElement('span');
    content.className = 'content';
    block.appendChild(content);
    messagesEl.appendChild(block);

    // Diary effect — ink-on-paper, one character at a time.
    // (charIndex replaces the old `total` variable)
    // Words are wrapped in an inline-block container so the browser never
    // breaks mid-word (e.g. "ML-OPS"). Each letter gets a tiny random
    // rotation so it looks genuinely hand-written.
    content.classList.add('writing');
    // elapsedMs accumulates a real duration instead of counting
    // characters, so punctuation can buy a pause without shifting
    // everything after it by the same fixed amount.
    let elapsedMs = 0;
    let charIndex = 0;
    const tokens = text.split(/(\n| +)/);

    function advance(ch) {
      const before = elapsedMs;
      elapsedMs += PACE.base + Math.random() * PACE.jitter;
      if (SENTENCE_END.test(ch)) elapsedMs += PACE.sentence;
      else if (CLAUSE_END.test(ch)) elapsedMs += PACE.comma;
      else if (DASHES.test(ch)) elapsedMs += PACE.dash;
      return before;
    }

    tokens.forEach(token => {
      if (!token) return;
      if (token === '\n') {
        content.appendChild(document.createElement('br'));
        elapsedMs += PACE.sentence;
        charIndex++;
      } else if (/^ +$/.test(token)) {
        for (let i = 0; i < token.length; i++) {
          const sp = document.createElement('span');
          sp.className = 'diary-char';
          sp.textContent = ' ';
          sp.style.animationDelay = elapsedMs.toFixed(0) + 'ms';
          elapsedMs += PACE.space;
          content.appendChild(sp);
          charIndex++;
        }
      } else {
        const wordEl = document.createElement('span');
        wordEl.style.cssText = 'display:inline-block;white-space:nowrap;';
        for (let i = 0; i < token.length; i++) {
          const ch = document.createElement('span');
          ch.className = 'diary-char word-char';
          ch.textContent = token[i];
          // subtle random per-character tilt — looks hand-written, not typed
          ch.style.setProperty('--r', (Math.random() * 4 - 2).toFixed(2) + 'deg');
          ch.style.animationDelay = advance(token[i]).toFixed(0) + 'ms';
          wordEl.appendChild(ch);
          charIndex++;
        }
        content.appendChild(wordEl);
      }
    });

    // Remove the quill cursor once the last character has finished animating
    const totalMs = elapsedMs;
    setTimeout(() => {
      content.classList.remove('writing');
      block.appendChild(stamp());
    }, totalMs + 560);

    // Scroll periodically as it fills
    let elapsed = 0;
    const scrollInterval = setInterval(() => {
      scrollToBottom();
      elapsed += 250;
      if (elapsed >= totalMs + 400) clearInterval(scrollInterval);
    }, 250);
    scrollToBottom();
  }

  function appendWritingIndicator() {
    const block = document.createElement('div');
    block.className = 'msg msg-ai msg-writing';

    const speaker = document.createElement('span');
    speaker.className = 'speaker';
    speaker.textContent = 'karunya';
    block.appendChild(speaker);

    const content = document.createElement('span');
    content.className = 'content';

    const dots = document.createElement('span');
    dots.className = 'writing-dots';
    dots.innerHTML = 'writing<span>.</span><span>.</span><span>.</span>';
    content.appendChild(dots);

    block.appendChild(content);
    messagesEl.appendChild(block);
    scrollToBottom();
    return block;
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      const bottom = document.documentElement.scrollHeight;
      // When the inertial scroller is running it owns the scroll position —
      // a native smooth scroll would just be fought and snapped back.
      if (window.__lenis) {
        window.__lenis.scrollTo(bottom, { duration: 0.8 });
        return;
      }
      window.scrollTo({ top: bottom, behavior: 'smooth' });
    });
  }
})();
