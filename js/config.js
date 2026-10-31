// =============================================================
// Общие настройки игры «Неоновый Побег».
// Все числа собраны здесь, чтобы их было легко менять и балансировать.
// Координаты указаны в «игровых пикселях» поля 720×1280 (пропорция 9:16),
// Phaser сам масштабирует поле под экран телефона.
// =============================================================

const CONFIG = {
  WIDTH: 720,
  HEIGHT: 1280,
  HUD_HEIGHT: 140, // высота верхней панели (счёт, таймер, пауза)

  FONT: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',

  COLORS: {
    BACKGROUND: 0x05060f,
    ARENA: 0x0a0d1e,
    GRID: 0x3cf0ff,
    HUD: 0x080a18,
    PLAYER: 0x3cf0ff,   // неоново-голубой
    CHASER: 0xff3b5c,   // неоново-красный
    BONUS: 0xffe14d,    // жёлтый
    OBSTACLE_FILL: 0x2a2f45,
    OBSTACLE_STROKE: 0x8a93b8,
    TEXT: 0xffffff,
    TEXT_DIM: 0x8a93b8
  },

  PLAYER: {
    SIZE: 64,           // видимый диаметр
    HITBOX_RADIUS: 27,  // хитбокс меньше видимого круга (~18%) — «прощающая» коллизия
    SPEED: 330,         // максимальная скорость, пикс/сек
    ACCELERATION: 18,   // чем больше, тем меньше инерция (18 — почти мгновенно)
    START: { x: 360, y: 1180 }
  },

  CHASER: {
    SIZE: 58,
    HITBOX_RADIUS: 25,                  // видимый размер больше хитбокса ~16%
    SPEED_FACTORS: [0.8, 0.9, 0.95],    // доля от скорости игрока у каждого врага
    STARTS: [
      { x: 100, y: 230 },
      { x: 360, y: 250 },
      { x: 620, y: 230 }
    ],
    SEPARATION_RADIUS: 110, // ближе этого расстояния враги отталкиваются
    SEPARATION_FORCE: 1.5,
    SLIDE_TIME: 0.35        // сколько секунд враг скользит вдоль препятствия
  },

  BONUS: {
    SIZE: 42,
    HITBOX_RADIUS: 21,
    POINTS: 100,
    FIRST_DELAY: 1000,      // мс до первого бонуса
    RESPAWN_DELAY: 1200,    // мс до следующего бонуса
    LIFETIME_PHASE3: 5,     // сек жизни бонуса в 3-й фазе
    MIN_DISTANCE_FROM_PLAYER: 260,
    EDGE_MARGIN: 55,        // отступ от краёв арены
    OBSTACLE_MARGIN: 40,    // отступ от препятствий
    // Запасные точки, если случайная точка не нашлась
    FALLBACK_POINTS: [
      { x: 360, y: 270 },
      { x: 360, y: 950 },
      { x: 60, y: 640 },
      { x: 660, y: 640 }
    ]
  },

  SCORE: {
    POINTS_PER_SECOND: 10
  },

  DIFFICULTY: {
    PHASE2_START: 20,          // сек
    PHASE3_START: 50,          // сек
    PHASE2_END_MULTIPLIER: 1.05, // множитель скорости врагов к концу 2-й фазы
    PHASE3_MAX_MULTIPLIER: 1.1,  // максимум в 3-й фазе (самый быстрый ≈ 1.045 от игрока)
    PHASE3_RAMP_TIME: 30,        // за сколько секунд 3-й фазы достигается максимум
    TURN_RATE_BASE: 2.2,         // манёвренность врагов в начале
    TURN_RATE_MAX: 4.5           // манёвренность врагов с конца 2-й фазы
  },

  JOYSTICK: {
    RADIUS: 100,          // ФИЗИЧЕСКИЙ радиус управления: полное отклонение = максимальная скорость
    VISUAL_RADIUS: 78,    // видимый радиус базы (меньше, чтобы не закрывать игру)
    KNOB_RADIUS: 34,      // радиус «ручки»
    DEAD_ZONE: 0.12,      // мёртвая зона (доля от RADIUS)
    ACTIVE_ALPHA: 0.55,   // непрозрачность во время движения (−45%)
    FOLLOW_SPEED: 12,     // как быстро база догоняет палец, ушедший дальше RADIUS
    // Безопасная область под кнопкой паузы: касание здесь не запускает джойстик
    PAUSE_SAFE_ZONE: { left: 530, bottom: 200 }
  },

  // Ниже этой линии на арене не должно быть статичных препятствий —
  // место, где игроку удобно держать палец
  BOTTOM_SAFE_ZONE_TOP: 1160,

  CATCH_DELAY: 400, // мс между поимкой и экраном поражения

  UI: {
    BUTTON_MIN_SIZE: 110 // ≈ 56+ CSS-пикселей на телефоне шириной 360–430 px
  },

  // Препятствия: центр (x, y), ширина w и высота h.
  // Все они — отдельные «плитки» с проходами вокруг, тупиков нет.
  OBSTACLES: [
    { x: 210, y: 400, w: 190, h: 40 },  // верхнее левое
    { x: 510, y: 400, w: 190, h: 40 },  // верхнее правое
    { x: 360, y: 650, w: 80, h: 160 },  // центральный блок
    { x: 125, y: 860, w: 40, h: 200 },  // левая стенка
    { x: 595, y: 860, w: 40, h: 200 },  // правая стенка
    { x: 360, y: 1060, w: 200, h: 40 }  // нижнее
  ]
};

// Верх арены и высота арены (удобные сокращения)
CONFIG.ARENA_TOP = CONFIG.HUD_HEIGHT;
CONFIG.ARENA_HEIGHT = CONFIG.HEIGHT - CONFIG.HUD_HEIGHT;

// ---------- Небольшие вспомогательные функции интерфейса ----------

// Перевод цвета из числа 0xRRGGBB в строку '#rrggbb' для текста
function colorToCss(color) {
  return '#' + color.toString(16).padStart(6, '0');
}

// Время в формате «м:сс»
function formatTime(seconds) {
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return minutes + ':' + String(secs).padStart(2, '0');
}

// Создаёт текст с единым стилем
function createText(scene, x, y, text, size, color = CONFIG.COLORS.TEXT) {
  return scene.add.text(x, y, text, {
    fontFamily: CONFIG.FONT,
    fontSize: size + 'px',
    fontStyle: 'bold',
    color: colorToCss(color),
    align: 'center'
  }).setOrigin(0.5);
}

// Создаёт крупную неоновую кнопку: прямоугольник + надпись.
// Возвращает прямоугольник; надпись лежит в свойстве button.label.
function createButton(scene, x, y, label, onClick, options = {}) {
  const color = options.color !== undefined ? options.color : CONFIG.COLORS.PLAYER;
  const width = Math.max(options.width || 440, CONFIG.UI.BUTTON_MIN_SIZE);
  const height = Math.max(options.height || 130, CONFIG.UI.BUTTON_MIN_SIZE);
  const fontSize = options.fontSize || 48;

  const button = scene.add.rectangle(x, y, width, height, color, 0.15)
    .setStrokeStyle(5, color)
    .setInteractive({ useHandCursor: true });

  button.label = createText(scene, x, y, label, fontSize, color);

  // Подсветка при нажатии
  button.on('pointerdown', () => button.setFillStyle(color, 0.4));
  button.on('pointerout', () => button.setFillStyle(color, 0.15));
  // Действие срабатывает, когда палец отпущен над кнопкой
  button.on('pointerup', () => {
    button.setFillStyle(color, 0.15);
    onClick();
  });

  return button;
}

// Показывает или прячет список объектов интерфейса.
// У кнопок заодно включается/выключается реакция на нажатия.
function setItemsVisible(items, visible) {
  items.forEach((item) => {
    item.setVisible(visible);
    if (item.label) {
      item.label.setVisible(visible);
    }
    if (item.input) {
      item.input.enabled = visible;
    }
  });
}
