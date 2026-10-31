// ==UserScript==
// @name         YouTube: любая скорость (видео + Shorts)
// @namespace    danil.yt.speed
// @version      3.2
// @description  Кнопки скорости поверх плеера: − / сброс / +. Видео и Shorts, скорость запоминается.
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @grant        none
// @sandbox      DOM
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';
  console.log('[TM speed] скрипт запущен');

  const KEY = 'tm-yt-speed';
  const STEP = 0.25, MIN = 0.1, MAX = 16;

  // ── Положение панели (px). Подстрой под себя, если нужно ──
  // Обычное видео: сверху справа, на уровне плашки «Перевести видео»
  const VIDEO_TOP = 52;
  const VIDEO_RIGHT = 124;
  // Shorts: снизу справа, на уровне строки с каналом и «Подписаться»
  const SHORTS_BOTTOM = 46;
  const SHORTS_RIGHT = 12;

  // Сколько панель остаётся видна после ухода курсора с видео (мс)
  const LINGER_MS = 2500;

  let speed = parseFloat(localStorage.getItem(KEY)) || 1;
  const labels = new Set();

  const clamp = v => Math.min(MAX, Math.max(MIN, Math.round(v * 100) / 100));

  function apply(video) {
    if (video && Math.abs(video.playbackRate - speed) > 0.001) video.playbackRate = speed;
  }

  function setSpeed(v) {
    speed = clamp(v);
    localStorage.setItem(KEY, speed);
    document.querySelectorAll('video').forEach(apply);
    labels.forEach(el => (el.textContent = speed + 'x'));
  }

  // YouTube сбрасывает скорость при смене ролика — возвращаем свою
  ['play', 'playing', 'loadedmetadata', 'ratechange'].forEach(ev =>
    document.addEventListener(ev, e => {
      if (e.target && e.target.tagName === 'VIDEO') apply(e.target);
    }, true));

  function makeBtn(text, onClick, wide) {
    const b = document.createElement('button');
    b.textContent = text;
    Object.assign(b.style, {
      background: 'rgba(0,0,0,.65)', color: '#fff', border: 'none',
      borderRadius: '8px', font: 'bold 15px sans-serif', height: '34px',
      minWidth: wide ? '60px' : '40px', padding: '0 10px', cursor: 'pointer'
    });
    b.addEventListener('mouseenter', () => (b.style.background = 'rgba(0,0,0,.9)'));
    b.addEventListener('mouseleave', () => (b.style.background = 'rgba(0,0,0,.65)'));
    b.addEventListener('click', onClick);
    return b;
  }

  function isShortsPlayer(player) {
    return player.id === 'shorts-player' ||
      !!player.closest('ytd-shorts, ytd-reel-video-renderer');
  }

  function addPanel(player) {
    if (player.querySelector('.tm-speed')) return;
    const shorts = isShortsPlayer(player);

    const panel = document.createElement('div');
    panel.className = 'tm-speed';
    Object.assign(panel.style, {
      position: 'absolute', zIndex: '2147483647',
      display: 'flex', gap: '6px', opacity: '0', pointerEvents: 'none',
      transition: 'opacity .2s'
    });
    if (shorts) Object.assign(panel.style, { right: SHORTS_RIGHT + 'px', bottom: SHORTS_BOTTOM + 'px' });
    else Object.assign(panel.style, { right: VIDEO_RIGHT + 'px', top: VIDEO_TOP + 'px' });

    const val = makeBtn(speed + 'x', () => setSpeed(1), true);
    labels.add(val);
    panel.append(
      makeBtn('−', () => setSpeed(speed - STEP)),
      val,
      makeBtn('+', () => setSpeed(speed + STEP))
    );

    // Клики по кнопкам не ставят видео на паузу и не включают полный экран
    ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick'].forEach(ev =>
      panel.addEventListener(ev, e => e.stopPropagation()));

    // В Shorts описание лежит поверх плеера, поэтому следим за наведением
    // на весь блок ролика, а не только на плеер
    const hoverZone = shorts
      ? (player.closest('ytd-reel-video-renderer, ytd-shorts') || player)
      : player;

    // hover — курсор над видео; linger — курсор ушёл, но панель ещё ждёт LINGER_MS
    let hover = false, linger = false, lingerTimer = null;
    const update = () => {
      const show = linger || (hover && (shorts || !player.classList.contains('ytp-autohide')));
      panel.style.opacity = show ? '1' : '0';
      panel.style.pointerEvents = show ? 'auto' : 'none';
    };
    const enter = () => {
      clearTimeout(lingerTimer);
      linger = false;
      hover = true;
      update();
    };
    const leave = () => {
      clearTimeout(lingerTimer);
      // Если панель сейчас видна — держим её ещё LINGER_MS, как плашку перевода
      linger = panel.style.opacity === '1';
      hover = false;
      update();
      lingerTimer = setTimeout(() => { linger = false; update(); }, LINGER_MS);
    };
    hoverZone.addEventListener('mouseenter', enter);
    hoverZone.addEventListener('mouseleave', leave);
    // Панель лежит внутри hoverZone, поэтому наведение на неё = наведение на видео.
    // Отдельные обработчики на панели не нужны: при переходе с панели на видео
    // они ошибочно запускали таймер скрытия.
    new MutationObserver(update).observe(player, { attributes: true, attributeFilter: ['class'] });

    player.appendChild(panel);
    console.log('[TM speed] панель добавлена в плеер', player.id || player.className, shorts ? '(Shorts)' : '');
  }

  // Плееры появляются динамически (переходы, Shorts) — проверяем раз в секунду
  setInterval(() => {
    document.querySelectorAll('.html5-video-player').forEach(addPanel);
  }, 1000);
})();
