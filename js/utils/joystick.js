// =============================================================
// Плавающий полупрозрачный джойстик поверх игры.
// Это обычные HTML-элементы над canvas, а не объекты Phaser.
//
// Палец коснулся левой половины экрана — там появляется база джойстика,
// и дальше направление считается от этой точки. Отпустил — база
// возвращается бледной подсказкой в левый нижний угол.
//
// Все расчёты — в CSS-пикселях, поэтому масштаб canvas на управление не влияет.
// Наружу отдаётся только вектор x, y длиной 0..1.
//
// Обработчики вешаются один раз при загрузке страницы (Joystick.init),
// поэтому после рестарта сцены дубликатов не появляется.
// =============================================================

const Joystick = {
  x: 0,              // вектор движения (длина 0..1)
  y: 0,
  pointerId: null,   // палец, который держит джойстик
  enabled: false,    // джойстик показан (идёт игровая сцена)
  active: false,     // джойстик принимает ввод (не пауза и не поражение)
  center: null,      // { cx, cy, r } базы в CSS-пикселях (координаты окна)
  radius: 60,        // текущий радиус базы
  onLayoutChange: null, // вызывается после изменения размеров окна (подгонка игры, main.js)

  zone: null,
  base: null,
  knob: null,

  init() {
    this.zone = document.getElementById('joystick-zone');
    this.base = document.getElementById('joystick-base');
    this.knob = document.getElementById('joystick-knob');

    // Касание в любом месте зоны (левая половина экрана)
    this.zone.addEventListener('pointerdown', (event) => this.onPointerDown(event));

    // Движение и отпускание слушаем на всём окне: палец может уйти за пределы зоны
    window.addEventListener('pointermove', (event) => this.onPointerMove(event));
    window.addEventListener('pointerup', (event) => this.onPointerEnd(event));
    window.addEventListener('pointercancel', (event) => this.onPointerEnd(event));
    this.zone.addEventListener('lostpointercapture', (event) => this.onPointerEnd(event));

    // Потеря фокуса / сворачивание — сразу отпускаем джойстик
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.reset();
      }
    });

    // Пересчёт размеров при изменении окна и ориентации
    window.addEventListener('resize', () => this.updateLayout());
    window.addEventListener('orientationchange', () => this.updateLayout());
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.updateLayout());
    }

    this.updateLayout();
  },

  // Размер джойстика под текущий экран (в CSS-пикселях)
  updateLayout() {
    const J = CONFIG.JOYSTICK;
    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;

    // На низком экране (телефон горизонтально) джойстик чуть меньше
    this.radius = Math.round(Math.max(40, Math.min(J.BASE_RADIUS, viewportHeight * J.MAX_TO_HEIGHT)));
    const knobRadius = Math.round(this.radius * J.KNOB_RADIUS / J.BASE_RADIUS);

    const root = document.documentElement.style;
    root.setProperty('--base-r', this.radius + 'px');
    root.setProperty('--knob-r', knobRadius + 'px');

    if (this.pointerId === null) {
      this.placeAtRest();
    }

    // Окно поменяло размер — подгоняем игру (функцию задаёт main.js)
    if (this.onLayoutChange) {
      requestAnimationFrame(this.onLayoutChange);
    }
  },

  // Положение-подсказка: левый нижний угол зоны
  placeAtRest() {
    const rect = this.zone.getBoundingClientRect();
    const r = this.radius;
    this.placeBase(rect.left + r * 2 + 24, rect.bottom - r * 2 - 10);
  },

  // Поставить центр базы в точку окна (cx, cy); база целиком остаётся на экране
  placeBase(cx, cy) {
    const zone = this.zone.getBoundingClientRect();
    const r = this.radius;
    const m = CONFIG.JOYSTICK.EDGE_MARGIN;
    const x = Phaser.Math.Clamp(cx, zone.left + r + m, Math.max(zone.left + r + m, window.innerWidth - r - m));
    const y = Phaser.Math.Clamp(cy, zone.top + r + m, Math.max(zone.top + r + m, zone.bottom - r - m));
    this.base.style.left = (x - zone.left) + 'px';
    this.base.style.top = (y - zone.top) + 'px';
    return { cx: x, cy: y, r: r };
  },

  onPointerDown(event) {
    // Второй палец не перехватывает управление
    if (!this.active || this.pointerId !== null) {
      return;
    }
    event.preventDefault();
    this.pointerId = event.pointerId;
    // База — под пальцем (у самого края экрана чуть сдвигается внутрь)
    this.center = this.placeBase(event.clientX, event.clientY);
    try {
      this.zone.setPointerCapture(event.pointerId);
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

  // Вектор и положение ручки относительно центра базы
  updateFromPointer(px, py) {
    const { cx, cy, r } = this.center;
    const dx = px - cx;
    const dy = py - cy;
    const distance = Math.hypot(dx, dy);
    const J = CONFIG.JOYSTICK;

    // Отклонение 0..1: за пределами радиуса — 1, направление продолжает считываться
    const strength = Math.min(distance, r) / r;

    if (distance < 0.001 || strength < J.DEAD_ZONE) {
      this.x = 0;
      this.y = 0;
    } else {
      // Сразу за мёртвой зоной сила начинается с нуля и достигает полной
      // уже при FULL_SPEED_AT отклонения — не нужно тянуть палец к самому краю.
      // Длина вектора не больше 1 — по диагонали не быстрее, чем по прямой.
      const power = Math.min(1, (strength - J.DEAD_ZONE) / (J.FULL_SPEED_AT - J.DEAD_ZONE));

      // Почти ровно вверх/вниз/вбок — «прилипаем» к прямой (удобно в проходах)
      let angle = Math.atan2(dy, dx);
      const axis = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
      if (Math.abs(angle - axis) <= J.SNAP_ANGLE * Math.PI / 180) {
        angle = axis;
      }
      this.x = Math.cos(angle) * power;
      this.y = Math.sin(angle) * power;
      // Убираем «почти ноль» от cos/sin прямых углов
      if (Math.abs(this.x) < 1e-9) this.x = 0;
      if (Math.abs(this.y) < 1e-9) this.y = 0;
    }

    // Ручка не выходит за радиус базы
    const offset = Math.min(distance, r);
    const knobX = distance > 0.001 ? (dx / distance) * offset : 0;
    const knobY = distance > 0.001 ? (dy / distance) * offset : 0;
    this.knob.style.transform = 'translate(' + knobX + 'px, ' + knobY + 'px)';
  },

  // Отпустить джойстик: ручка в центр, база — на место подсказки, движение прекращается
  reset() {
    if (this.pointerId !== null && this.zone.hasPointerCapture &&
        this.zone.hasPointerCapture(this.pointerId)) {
      try {
        this.zone.releasePointerCapture(this.pointerId);
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
      this.placeAtRest();
    }
  },

  // Показать/спрятать джойстик и кнопки (игровая сцена запущена или нет)
  setEnabled(enabled) {
    this.enabled = enabled;
    document.body.classList.toggle('is-game', enabled);
    this.setActive(enabled);
  },

  // Включить/выключить ввод (пауза, поражение)
  setActive(active) {
    this.active = active;
    if (!active) {
      this.reset();
    }
    document.body.classList.toggle('is-inactive', !active);
  },

  // Вектор движения или null, если джойстик никто не держит
  getVector() {
    if (this.pointerId === null) {
      return null;
    }
    return { x: this.x, y: this.y };
  }
};
