// ==UserScript==
// @name         YouTube: любая скорость (видео + Shorts)
// @namespace    danil.yt.speed
// @version      3.4
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
  // Shorts: снизу справа, на уровне строки с каналом
  const SHORTS_BOTTOM = 88;
  const SHORTS_RIGHT = 12;

  // ── Скрытие: копия логики скрипта перевода VOT ──
  // VOT показывает плашку при каждом движении курсора над видео и прячет её
  // через «Delay before hiding the translate button» после ПОСЛЕДНЕГО движения —
  // и когда курсор ушёл с видео, и когда он просто замер над видео.
  // Поставь сюда то же значение, что в настройках VOT (по умолчанию 1000 мс, максимум 3000).
  const HIDE_DELAY_MS = 1000;
  // VOT проверяет таймер не непрерывно: первая проверка через 250 мс после движения,
  // дальше раз в 1000 мс. Поэтому реальное скрытие наступает чуть позже задержки.
  // Повторяем ту же сетку, чтобы плашки пропадали одновременно.
  const VOT_FIRST_TICK = 250, VOT_IDLE_TICK = 1000;
  const realDelay = d => d <= VOT_FIRST_TICK
    ? VOT_FIRST_TICK
    : VOT_FIRST_TICK + Math.ceil((d - VOT_FIRST_TICK) / VOT_IDLE_TICK) * VOT_IDLE_TICK;
  const HIDE_AFTER = realDelay(HIDE_DELAY_MS);

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

  // Положение пересчитываем при каждом показе: плеер может перейти
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

  function setVisible(s, show) {
    s.visible = show;
    s.panel.style.opacity = show ? '1' : '0';
    s.panel.style.pointerEvents = show ? 'auto' : 'none';
  }

  const inRect = (el, x, y) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  // Движение над видео: показать и перезапустить таймер скрытия
  function activity(s) {
    layout(s);
    setVisible(s, true);
    clearTimeout(s.timer);
    s.timer = setTimeout(() => {
      // Как в VOT: если курсор стоит на самой панели — не прятать
      if (inRect(s.panel, mx, my)) return;
      setVisible(s, false);
    }, HIDE_AFTER);
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

    const s = { player, panel, val, shorts: null, visible: false, timer: null };
    panels.push(s);
    player.appendChild(panel);
    layout(s);
    console.log('[TM speed] панель добавлена в плеер', player.id || player.className, s.shorts ? '(Shorts)' : '');
  }

  // Наведение определяем по координатам курсора и границам плеера:
  // слои YouTube поверх видео (описание в Shorts, оверлеи) не мешают.
  let mx = -1, my = -1;
  function onPointer(e) {
    mx = e.clientX; my = e.clientY;
    panels.forEach(s => {
      if (s.player.isConnected && inRect(s.player, mx, my)) activity(s);
    });
  }
  document.addEventListener('pointermove', onPointer, { passive: true, capture: true });
  document.addEventListener('pointerdown', onPointer, { passive: true, capture: true });

  // Как в VOT: клик мимо видео прячет панель сразу
  document.addEventListener('click', e => {
    panels.forEach(s => {
      if (s.visible && !s.player.contains(e.target)) { clearTimeout(s.timer); setVisible(s, false); }
    });
  }, true);

  // Плееры появляются динамически (переходы, Shorts) — проверяем раз в секунду
  setInterval(() => {
    document.querySelectorAll('.html5-video-player').forEach(addPanel);
    for (let i = panels.length - 1; i >= 0; i--) {
      if (!panels[i].player.isConnected) {
        clearTimeout(panels[i].timer);
        labels.delete(panels[i].val);
        panels.splice(i, 1);
      }
    }
  }, 1000);
})();
