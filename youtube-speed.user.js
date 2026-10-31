// ==UserScript==
// @name         YouTube: любая скорость (видео + Shorts)
// @namespace    danil.yt.speed
// @version      3.3
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
  // Обычное видео: сверху, привязка к центру плеера (как плашка «Перевести видео»).
  // VIDEO_SHIFT — на сколько левый край панели правее центра плеера.
  const VIDEO_TOP = 52;
  const VIDEO_SHIFT = 165;
  // Shorts: снизу справа, на уровне строки с каналом и «Подписаться»
  const SHORTS_BOTTOM = 46;
  const SHORTS_RIGHT = 12;

  // Сколько панель остаётся видна после ухода курсора с видео (мс)
  const LINGER_MS = 2500;

  let speed = parseFloat(localStorage.getItem(KEY)) || 1;
  const labels = new Set();
  const panels = []; // состояние каждой панели

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

  // Положение считаем заново при каждом показе: плеер может перейти
  // из обычного режима в Shorts и обратно
  function layout(s) {
    const shorts = isShortsPlayer(s.player);
    if (shorts === s.shorts) return;
    s.shorts = shorts;
    const st = s.panel.style;
    if (shorts) {
      Object.assign(st, { left: '', top: '', right: SHORTS_RIGHT + 'px', bottom: SHORTS_BOTTOM + 'px' });
    } else {
      Object.assign(st, { right: '', bottom: '', left: `calc(50% + ${VIDEO_SHIFT}px)`, top: VIDEO_TOP + 'px' });
    }
  }

  function update(s) {
    layout(s);
    const idle = !s.shorts && s.player.classList.contains('ytp-autohide');
    const show = s.linger || (s.hover && !idle);
    s.panel.style.opacity = show ? '1' : '0';
    s.panel.style.pointerEvents = show ? 'auto' : 'none';
  }

  function setHover(s, inside) {
    if (inside === s.hover) return;
    s.hover = inside;
    clearTimeout(s.timer);
    if (inside) {
      s.linger = false;
    } else {
      // Курсор ушёл с видео — держим панель ещё LINGER_MS, как плашку перевода
      s.linger = true;
      s.timer = setTimeout(() => { s.linger = false; update(s); }, LINGER_MS);
    }
    update(s);
  }

  function addPanel(player) {
    if (player.querySelector('.tm-speed')) return;

    const panel = document.createElement('div');
    panel.className = 'tm-speed';
    Object.assign(panel.style, {
      position: 'absolute', zIndex: '2147483647',
      display: 'flex', gap: '6px', opacity: '0', pointerEvents: 'none',
      transition: 'opacity .2s'
    });

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

    const s = { player, panel, shorts: null, hover: false, linger: false, timer: null };
    panels.push(s);
    new MutationObserver(() => update(s)).observe(player, { attributes: true, attributeFilter: ['class'] });

    player.appendChild(panel);
    update(s);
    console.log('[TM speed] панель добавлена в плеер', player.id || player.className, s.shorts ? '(Shorts)' : '');
  }

  // Наведение определяем по координатам курсора и границам плеера.
  // Так не мешают слои YouTube поверх видео (описание в Shorts, оверлеи)
  // и уход курсора срабатывает надёжно.
  let mx = -1, my = -1, queued = false;
  function checkHover() {
    queued = false;
    panels.forEach(s => {
      if (!s.player.isConnected) return;
      const r = s.player.getBoundingClientRect();
      const inside = r.width > 0 && r.height > 0 &&
        mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom;
      setHover(s, inside);
    });
  }
  const queueCheck = () => { if (!queued) { queued = true; requestAnimationFrame(checkHover); } };

  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; queueCheck(); }, { passive: true, capture: true });
  // Курсор ушёл за пределы окна
  document.documentElement.addEventListener('mouseleave', () => { mx = my = -1; queueCheck(); });
  // Прокрутка Shorts двигает ролик под неподвижным курсором
  window.addEventListener('scroll', queueCheck, { passive: true, capture: true });
  window.addEventListener('wheel', queueCheck, { passive: true, capture: true });

  // Плееры появляются динамически (переходы, Shorts) — проверяем раз в секунду
  setInterval(() => {
    document.querySelectorAll('.html5-video-player').forEach(addPanel);
    for (let i = panels.length - 1; i >= 0; i--) {
      if (!panels[i].player.isConnected) { labels.delete(panels[i].panel.firstChild.nextSibling); panels.splice(i, 1); }
    }
    queueCheck();
  }, 1000);
})();
