// ==UserScript==
// @name         Fixed Video Folding
// @namespace    https://github.com/ddyakovlev1/Fixed_Video_Folding
// @version      1.1.0
// @description  Горячие клавиши видео (свернуть в мини-плеер, полный экран и др.) работают на русской раскладке так же, как на английской
// @author       ddyakovlev1
// @match        *://*/*
// @run-at       document-start
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/ddyakovlev1/tampermonkey_skript_set/main/Fixed_Video_Folding/fixed-video-folding.user.js
// @updateURL    https://raw.githubusercontent.com/ddyakovlev1/tampermonkey_skript_set/main/Fixed_Video_Folding/fixed-video-folding.user.js
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

  // Старые коды клавиш (keyCode) для символов
  const SYMBOL_KEYCODES = {
    BracketLeft: 219, BracketRight: 221, Semicolon: 186, Quote: 222,
    Comma: 188, Period: 190, Slash: 191, Backquote: 192,
  };

  // Русская буква → физическая клавиша (раскладка ЙЦУКЕН).
  // Запасной путь: LibreWolf и Firefox с защитой от отпечатков
  // (resistFingerprinting) не сообщают физическую клавишу для русских букв.
  const RU_TO_CODE = {
    'й': 'KeyQ', 'ц': 'KeyW', 'у': 'KeyE', 'к': 'KeyR', 'е': 'KeyT', 'н': 'KeyY',
    'г': 'KeyU', 'ш': 'KeyI', 'щ': 'KeyO', 'з': 'KeyP', 'х': 'BracketLeft', 'ъ': 'BracketRight',
    'ф': 'KeyA', 'ы': 'KeyS', 'в': 'KeyD', 'а': 'KeyF', 'п': 'KeyG', 'р': 'KeyH',
    'о': 'KeyJ', 'л': 'KeyK', 'д': 'KeyL', 'ж': 'Semicolon', 'э': 'Quote',
    'я': 'KeyZ', 'ч': 'KeyX', 'с': 'KeyC', 'м': 'KeyV', 'и': 'KeyB', 'т': 'KeyN',
    'ь': 'KeyM', 'б': 'Comma', 'ю': 'Period', 'ё': 'Backquote',
  };

  // События, которые создал сам скрипт. Их пропускаем, чтобы не зациклиться.
  const own = new WeakSet();

  // Физическая клавиша: сначала из event.code, если его нет — по русской букве
  function physicalCode(e) {
    if (/^Key[A-Z]$/.test(e.code) || SYMBOLS[e.code]) return e.code;
    const ch = (e.key || '').toLowerCase();
    return RU_TO_CODE[ch] || null;
  }

  // Английский символ для физической клавиши
  function englishKey(code, shift) {
    const m = /^Key([A-Z])$/.exec(code);
    if (m) return shift ? m[1] : m[1].toLowerCase();
    const s = SYMBOLS[code];
    if (s) return shift ? s[1] : s[0];
    return null;
  }

  function keyCodeFor(code) {
    const m = /^Key([A-Z])$/.exec(code);
    if (m) return m[1].charCodeAt(0);
    return SYMBOL_KEYCODES[code] || 0;
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

    const code = physicalCode(e);
    if (!code) return; // клавиша не наша
    const key = englishKey(code, e.shiftKey);
    if (!key || key === e.key) return; // уже английская раскладка
    if (isTyping(e)) return;

    // Глушим «русское» событие и отправляем такое же, но с английской буквой
    e.stopImmediatePropagation();
    e.preventDefault();

    const copy = new KeyboardEvent(e.type, {
      key,
      code,
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
    const keyCode = keyCodeFor(code);
    Object.defineProperty(copy, 'keyCode', { get: () => keyCode });
    Object.defineProperty(copy, 'which', { get: () => keyCode });

    own.add(copy);
    (e.target || document).dispatchEvent(copy);
  }

  // Ловим раньше всех: на window, в фазе перехвата
  window.addEventListener('keydown', handler, true);
  window.addEventListener('keyup', handler, true);
})();
