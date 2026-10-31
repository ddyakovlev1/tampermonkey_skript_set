// ==UserScript==
// @name         Fixed Video Folding
// @namespace    https://github.com/ddyakovlev1/Fixed_Video_Folding
// @version      1.0.1
// @description  Горячие клавиши видео (свернуть в мини-плеер, полный экран и др.) работают на русской раскладке так же, как на английской
// @author       ddyakovlev1
// @match        *://*/*
// @run-at       document-start
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/ddyakovlev1/Tampermonkey_Skript_Set/main/Fixed_Video_Folding/fixed-video-folding.user.js
// @updateURL    https://raw.githubusercontent.com/ddyakovlev1/Tampermonkey_Skript_Set/main/Fixed_Video_Folding/fixed-video-folding.user.js
// ==/UserScript==

(function () {
  'use strict';

  // Символы, которые не зависят от буквы: физическая клавиша → [обычный, с Shift]
  const SYMBOLS = {
    BracketLeft: ['[', '{'],
    BracketRight: [']', '}'],
    Semicolon: [';', ':'],
    Quote: ["'", '"'],
    Comma: [',', '<'],
    Period: ['.', '>'],
    Slash: ['/', '?'],
    Backquote: ['`', '~'],
  };

  // События, которые создал сам скрипт. Их пропускаем, чтобы не зациклиться.
  const own = new WeakSet();

  // Английский символ для физической клавиши (по event.code, он не зависит от раскладки)
  function englishKey(e) {
    const m = /^Key([A-Z])$/.exec(e.code);
    if (m) return e.shiftKey ? m[1] : m[1].toLowerCase();
    const s = SYMBOLS[e.code];
    if (s) return e.shiftKey ? s[1] : s[0];
    return null;
  }

  // Пользователь печатает текст — ничего не трогаем
  function isTyping(e) {
    const path = e.composedPath ? e.composedPath() : [e.target];
    for (const el of path) {
      if (!(el instanceof Element)) continue;
      if (el.isContentEditable) return true;
      const tag = el.tagName;
      if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (tag === 'INPUT') {
        const type = (el.type || 'text').toLowerCase();
        const nonText = ['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'image', 'color', 'file'];
        if (!nonText.includes(type)) return true;
      }
    }
    return false;
  }

  function handler(e) {
    if (own.has(e)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return; // браузер и так понимает Ctrl+… на любой раскладке
    if (e.isComposing) return;

    const key = englishKey(e);
    if (!key || key === e.key) return; // уже английская раскладка или клавиша не наша
    if (isTyping(e)) return;

    // Глушим «русское» событие и отправляем такое же, но с английской буквой
    e.stopImmediatePropagation();
    e.preventDefault();

    const copy = new KeyboardEvent(e.type, {
      key,
      code: e.code,
      location: e.location,
      repeat: e.repeat,
      shiftKey: e.shiftKey,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
    });

    // Старые сайты смотрят keyCode/which — передаём их тоже
    const keyCode = e.keyCode || key.toUpperCase().charCodeAt(0);
    Object.defineProperty(copy, 'keyCode', { get: () => keyCode });
    Object.defineProperty(copy, 'which', { get: () => keyCode });

    own.add(copy);
    (e.target || document).dispatchEvent(copy);
  }

  // Ловим раньше всех: на window, в фазе перехвата
  window.addEventListener('keydown', handler, true);
  window.addEventListener('keyup', handler, true);
})();
