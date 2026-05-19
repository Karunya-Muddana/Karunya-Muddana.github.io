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
  const CHAR_DELAY_MS = 22;

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
          appendAIMessage('going a bit fast — try again in a moment.', true);
        } else if (res.status >= 500) {
          appendAIMessage("hmm, something's off on my end. try again?", true);
        } else {
          appendAIMessage('that request did not go through.', true);
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
      appendAIMessage("looks like I can't reach the page right now. check your connection?", true);
    } finally {
      busy = false;
      inputEl.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
      setTimeout(() => inputEl.focus(), 200);
    }
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

    // Diary effect — characters appear one-by-one with ink-bleed
    let total = text.length;
    for (let i = 0; i < total; i++) {
      const ch = document.createElement('span');
      ch.className = 'diary-char';
      // preserve whitespace correctly
      if (text[i] === ' ') ch.innerHTML = '&nbsp;';
      else if (text[i] === '\n') ch.innerHTML = '<br>';
      else ch.textContent = text[i];
      ch.style.animationDelay = (i * CHAR_DELAY_MS) + 'ms';
      content.appendChild(ch);
    }

    // Scroll periodically as it fills
    const totalMs = total * CHAR_DELAY_MS;
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
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth'
      });
    });
  }
})();
