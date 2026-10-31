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
    CHASER: 0xff3b5c,   // неоново-красный (заголовок «ПОЙМАН!»)
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
    HITBOX_RADIUS: 25,      // у всех ролей одинаковый круглый хитбокс (столкновения не менялись)
    SEPARATION_RADIUS: 110, // ближе этого расстояния враги отталкиваются
    SEPARATION_FORCE: 1.5,
    SLIDE_TIME: 0.35,       // сколько секунд враг скользит вдоль препятствия

    // Рывок (Dash) — общие ограничения
    DASH_MIN_RANGE: 110,    // ближе — не рвётся (и так рядом)
    DASH_MAX_RANGE: 420,    // дальше — не рвётся (рывок бы не долетел)
    DASH_ACCELERATION: 30,  // разгон до скорости рывка (не мгновенно)

    // Шлейф
    TRAIL_POINTS: 6,
    TRAIL_INTERVAL: 0.035,  // сек между точками шлейфа

    // Три роли врагов. speedFactor — доля от скорости игрока.
    // turnBase/turnMax — поворотливость в начале и с конца 2-й фазы.
    // dash: telegraph — предупреждение, duration — рывок,
    //       speedFactor — скорость рывка (доля от скорости игрока),
    //       recovery — пауза, когда новый рывок невозможен,
    //       firstDelay — сдвиг первого рывка после 50 с (чтобы враги не рвались одновременно)
    ROLES: [
      {
        key: 'hunter',
        name: 'Охотник',
        texture: 'enemy-hunter',
        color: 0xff3b5c,      // красный
        size: 60,
        rotates: true,        // стрела поворачивается по направлению движения
        start: { x: 360, y: 250 },
        speedFactor: 0.94,
        turnBase: 3.5,
        turnMax: 5.0,
        dash: { telegraph: 0.4, duration: 0.3, speedFactor: 1.9, recovery: 1.8, firstDelay: 0.5 }
      },
      {
        key: 'interceptor',
        name: 'Перехватчик',
        texture: 'enemy-interceptor',
        color: 0xd94bff,      // пурпурный
        size: 58,
        rotates: false,
        start: { x: 620, y: 230 },
        speedFactor: 0.90,
        turnBase: 2.6,
        turnMax: 3.8,
        leadDistance: 140,    // целится на 140 px впереди игрока
        leadMinPlayerSpeed: 0.25, // если игрок медленнее 25% скорости — гонится напрямую
        leadMinDistance: 130, // вплотную к игроку — тоже напрямую
        dash: { telegraph: 0.4, duration: 0.3, speedFactor: 1.8, recovery: 2.0, firstDelay: 1.8 }
      },
      {
        key: 'heavy',
        name: 'Тяжёлый загонщик',
        texture: 'enemy-heavy',
        color: 0xff8c1a,      // оранжевый
        size: 66,
        rotates: false,
        start: { x: 100, y: 230 },
        speedFactor: 0.82,
        turnBase: 1.3,
        turnMax: 1.9,
        closeDistance: 220,   // игрок ближе — атакует напрямую
        farDistance: 480,     // игрок дальше — медленно приближается к нему
        cutFraction: 0.5,     // встаёт на середину пути «игрок → бонус»
        arriveRadius: 90,     // плавно тормозит у точки-цели
        dash: { telegraph: 0.5, duration: 0.4, speedFactor: 1.6, recovery: 2.4, firstDelay: 3.1 }
      }
    ]
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
    PHASE2_START: 20,             // сек
    PHASE3_START: 50,             // сек: с этого момента враги начинают рывки
    PHASE2_END_MULTIPLIER: 1.03,  // множитель скорости врагов к концу 2-й фазы (дальше не растёт)
    MAX_ENEMY_SPEED_FACTOR: 0.97, // потолок ПОСТОЯННОЙ скорости любого врага (доля от игрока)
    // Пауза между рывками сверх восстановления: сокращается с 4 с (50-я секунда) до 1 с (90-я)
    DASH_INTERVAL_START: 4.0,
    DASH_INTERVAL_END: 1.0,
    DASH_INTERVAL_RAMP_TIME: 40
  },

  // Фиксированный джойстик в отдельной нижней панели (HTML под canvas).
  // ВНИМАНИЕ: размеры здесь в CSS-пикселях экрана, а не в игровых координатах.
  JOYSTICK: {
    PANEL_HEIGHT: 160,     // высота панели без нижнего safe-area отступа
    PANEL_MAX_SHARE: 0.25, // на низких экранах панель не выше 25% высоты окна
    BASE_RADIUS: 60,       // радиус базы
    KNOB_RADIUS: 25,       // радиус ручки
    BASE_TO_PANEL: 0.38,   // база не больше 38% высоты панели — всегда влезает с отступами
    DEAD_ZONE: 0.1         // мёртвая зона — 10% радиуса
  },

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
