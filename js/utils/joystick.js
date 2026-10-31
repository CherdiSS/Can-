// =============================================================
// Фиксированный джойстик в нижней панели управления.
// Это обычные HTML-элементы под canvas, а не объекты Phaser:
// панель занимает собственное место на экране и не перекрывает арену.
//
// Все расчёты — в CSS-пикселях: центр и радиус берутся из реального
// размера базы на экране (getBoundingClientRect), поэтому масштаб canvas
// на управление не влияет. Наружу отдаётся только вектор x, y длиной 0..1.
//
// Обработчики вешаются один раз при загрузке страницы (Joystick.init),
// поэтому после рестарта сцены дубликатов не появляется.
// =============================================================

const Joystick = {
  x: 0,              // вектор движения (длина 0..1)
  y: 0,
  pointerId: null,   // палец, который начал касание на базе и держит джойстик
  enabled: false,    // джойстик показан (идёт игровая сцена)
  active: false,     // джойстик принимает ввод (не пауза и не поражение)
  center: null,      // { cx, cy, r } базы в CSS-пикселях
  game: null,        // ссылка на Phaser.Game — чтобы пересчитать масштаб после смены размеров

  panel: null,
  base: null,
  knob: null,

  init() {
    this.panel = document.getElementById('control-panel');
    this.base = document.getElementById('joystick-base');
    this.knob = document.getElementById('joystick-knob');

    // Касание начинается только на базе джойстика
    this.base.addEventListener('pointerdown', (event) => this.onPointerDown(event));

    // Движение и отпускание слушаем на всём окне: палец может уйти за пределы базы
    window.addEventListener('pointermove', (event) => this.onPointerMove(event));
    window.addEventListener('pointerup', (event) => this.onPointerEnd(event));
    window.addEventListener('pointercancel', (event) => this.onPointerEnd(event));
    this.base.addEventListener('lostpointercapture', (event) => this.onPointerEnd(event));

    // Потеря фокуса / сворачивание — сразу отпускаем джойстик
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.reset();
      }
    });

    // Пересчёт компоновки при изменении размера окна и ориентации
    window.addEventListener('resize', () => this.updateLayout());
    window.addEventListener('orientationchange', () => this.updateLayout());
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.updateLayout());
    }

    this.updateLayout();
  },

  // Высота панели и размеры джойстика под текущий экран (в CSS-пикселях)
  updateLayout() {
    const J = CONFIG.JOYSTICK;
    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;

    // На маленьких экранах панель уменьшается, чтобы арена оставалась удобной
    const panelHeight = Math.round(Math.min(J.PANEL_HEIGHT, viewportHeight * J.PANEL_MAX_SHARE));
    const baseRadius = Math.round(Math.min(J.BASE_RADIUS, panelHeight * J.BASE_TO_PANEL));
    const knobRadius = Math.round(baseRadius * J.KNOB_RADIUS / J.BASE_RADIUS);

    const root = document.documentElement.style;
    root.setProperty('--panel-h', panelHeight + 'px');
    root.setProperty('--base-r', baseRadius + 'px');
    root.setProperty('--knob-r', knobRadius + 'px');

    // Если палец держит джойстик — обновляем центр базы
    if (this.pointerId !== null) {
      this.center = this.measureBase();
    }

    // Контейнер игры поменял размер — сразу пересчитываем масштаб canvas
    if (this.game) {
      requestAnimationFrame(() => this.game.scale.refresh());
    }
  },

  measureBase() {
    const rect = this.base.getBoundingClientRect();
    return {
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
      r: rect.width / 2
    };
  },

  onPointerDown(event) {
    // Второй палец не перехватывает управление
    if (!this.active || this.pointerId !== null) {
      return;
    }

    // Захватываем управление только касанием внутри круга базы
    const center = this.measureBase();
    if (Math.hypot(event.clientX - center.cx, event.clientY - center.cy) > center.r) {
      return;
    }

    event.preventDefault();
    this.pointerId = event.pointerId;
    this.center = center;
    try {
      this.base.setPointerCapture(event.pointerId);
    } catch (error) {
      // Без захвата тоже работает: move/up слушаются на window
    }
    this.base.classList.add('is-held');
    this.updateFromPointer(event.clientX, event.clientY);
  },

  onPointerMove(event) {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    this.updateFromPointer(event.clientX, event.clientY);
  },

  onPointerEnd(event) {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    this.reset();
  },

  // Вектор и положение ручки относительно НЕПОДВИЖНОГО центра базы
  updateFromPointer(px, py) {
    const { cx, cy, r } = this.center;
    const dx = px - cx;
    const dy = py - cy;
    const distance = Math.hypot(dx, dy);
    const deadZone = CONFIG.JOYSTICK.DEAD_ZONE;

    // Сила 0..1: за пределами радиуса — 1, направление продолжает считываться
    const strength = Math.min(distance, r) / r;

    if (distance < 0.001 || strength < deadZone) {
      this.x = 0;
      this.y = 0;
    } else {
      // Сразу за мёртвой зоной сила начинается с нуля.
      // Длина вектора не больше 1 — по диагонали игрок не быстрее, чем по прямой.
      const power = (strength - deadZone) / (1 - deadZone);
      this.x = (dx / distance) * power;
      this.y = (dy / distance) * power;
    }

    // Ручка не выходит за радиус базы
    const offset = Math.min(distance, r);
    const knobX = distance > 0.001 ? (dx / distance) * offset : 0;
    const knobY = distance > 0.001 ? (dy / distance) * offset : 0;
    this.knob.style.transform = 'translate(' + knobX + 'px, ' + knobY + 'px)';
  },

  // Отпустить джойстик: ручка в центр, движение прекращается
  reset() {
    if (this.pointerId !== null && this.base.hasPointerCapture &&
        this.base.hasPointerCapture(this.pointerId)) {
      try {
        this.base.releasePointerCapture(this.pointerId);
      } catch (error) {
        // ничего страшного
      }
    }
    this.pointerId = null;
    this.center = null;
    this.x = 0;
    this.y = 0;
    if (this.knob) {
      this.knob.style.transform = 'translate(0px, 0px)';
    }
    if (this.base) {
      this.base.classList.remove('is-held');
    }
  },

  // Показать/спрятать джойстик (игровая сцена запущена или нет)
  setEnabled(enabled) {
    this.enabled = enabled;
    this.panel.classList.toggle('is-game', enabled);
    this.setActive(enabled);
  },

  // Включить/выключить ввод (пауза, поражение)
  setActive(active) {
    this.active = active;
    if (!active) {
      this.reset();
    }
    this.panel.classList.toggle('is-inactive', !active);
  },

  // Вектор движения или null, если джойстик никто не держит
  getVector() {
    if (this.pointerId === null) {
      return null;
    }
    return { x: this.x, y: this.y };
  }
};
