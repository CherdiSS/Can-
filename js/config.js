// =============================================================
// Общие настройки игры «Неоновый Побег».
// Все числа собраны здесь, чтобы их было легко менять и балансировать.
// Координаты указаны в «игровых пикселях». Ширина экрана игры всегда 720,
// а высота подстраивается под пропорцию свободного места на экране телефона
// (см. computeGameHeight в main.js), поэтому боковых чёрных полос нет.
// =============================================================

const CONFIG = {
  // Экран игры (canvas): ширина постоянная, высота — по пропорции экрана.
  // Весь canvas — окно камеры на арену; счёт, таймер и пауза — в нижней HTML-панели.
  WIDTH: 720,
  HEIGHT: 1280,      // «расчётная» высота: под неё свёрстаны меню, пауза и экран поражения
  MIN_HEIGHT: 760,   // ниже — появятся полосы по бокам (широкое окно на компьютере)
  MAX_HEIGHT: 1600,  // выше не растём (очень вытянутые экраны)

  // Игровое поле (мир) больше экрана: камера следует за игроком.
  // Было 720×1140, стало в 1.5 раза шире и в ~1.56 раза выше.
  // Плотность препятствий — см. комментарий у CONFIG.OBSTACLES (≈12 на 1 000 000 px²).
  ARENA: {
    WIDTH: 1080,
    HEIGHT: 1774
  },

  // Пиксельный шрифт с кириллицей Tiny5 (assets/fonts/, подключён в css/style.css)
  FONT: '"Tiny5", monospace',

  // Единая палитра «районная поликлиника» — те же цвета, что у пиксельного окружения
  COLORS: {
    INK: 0x1e242c,         // тёмный контур, текст на светлом
    PAPER: 0xd6d6c8,       // побелка: таблички, карточки
    PAPER_SHADE: 0xb2b4aa, // тень побелки: нижняя грань табличек
    PAINT: 0x7aa48c,       // масляная панель стены: главные кнопки
    PAINT_DARK: 0x5c826e,
    PAINT_LINE: 0x3a4844,  // бордюр панели, приглушённый текст
    WOOD: 0xa68a68,        // дерево (рамки)
    WOOD_DARK: 0x745c46,
    STAMP: 0xb03034,       // красный штамп («ПОЙМАН!»)
    BACKGROUND: 0x1e242c,
    PLAYER: 0x3cf0ff,      // контур героини (вшит в спрайт)
    CHASER: 0xff3b5c,      // контур Охотника (вшит в спрайт)
    BONUS: 0xffe14d        // таблетка
  },

  PLAYER: {
    // Героиня — пиксельная девушка-врач (assets/sprites/doctor_sheet.png: 12 кадров 64×64, без масштабирования)
    TEXTURE: 'player',
    SPRITE: 'assets/sprites/doctor_sheet.png', // лист кадров 12×64×64 (см. ANIMATION)
    RUN_FPS: 12,        // частота кадров бега на полной скорости
    SIZE: 64,           // размер спрайта
    HITBOX_RADIUS: 27,  // круглый хитбокс по центру спрайта (не менялся)
    SPEED: 330,         // максимальная скорость, пикс/сек
    ACCELERATION: 30,   // разгон: до полной скорости ≈ за 0.1 с
    DECELERATION: 90,   // торможение: после отпускания героиня стоит через ≈ 0.05 с
    CAMERA_LERP: 1,     // камера жёстко за героиней (1 — без запаздывания)
    START: { x: 540, y: 1618 } // низ поля по центру (те же 91% высоты, что раньше)
  },

  CHASER: {
    HITBOX_RADIUS: 25,      // у всех ролей одинаковый круглый хитбокс (столкновения не менялись)

    // У каждой роли свой пиксельный спрайт 64×64 (assets/sprites/), контур — цвета роли.
    // Тень-кольцо цвета роли у ног: смещение от центра спрайта вниз и размеры эллипса
    RING: { OFFSET_Y: 28, WIDTH: 46, HEIGHT: 14 }, // картинка assets/ui/ring.png (46×14)
    FX_PIXEL: 4,            // размер «пикселя» шлейфа и подсказок рывка
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
        sprite: 'assets/sprites/enemy_hunter_sheet.png', // пациент со шприцем
        runFps: 12,           // широкий быстрый шаг
        color: 0xff3b5c,      // красный (контур, кольцо и шлейф)
        size: 64,             // размер спрайта
        start: { x: 540, y: 171 },
        speedFactor: 0.94,
        turnBase: 3.5,
        turnMax: 5.0,
        dash: { telegraph: 0.4, duration: 0.3, speedFactor: 1.9, recovery: 1.8, firstDelay: 0.5 }
      },
      {
        key: 'interceptor',
        name: 'Перехватчик',
        texture: 'enemy-interceptor',
        sprite: 'assets/sprites/enemy_interceptor_sheet.png', // пациент с капельницей
        runFps: 9,            // шаркает
        color: 0xd94bff,      // пурпурный
        size: 64,
        start: { x: 930, y: 140 },
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
        sprite: 'assets/sprites/enemy_heavy_sheet.png', // пациент в бинтах и гипсе
        runFps: 7,            // тяжёлая переваливающаяся походка
        color: 0xff8c1a,      // оранжевый
        size: 64,
        start: { x: 150, y: 140 },
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
    // Бонус — пиксельная таблетка-капсула (assets/sprites/bonus_pill.png, 48×48)
    TEXTURE: 'bonus',
    SPRITE: 'assets/sprites/bonus_pill.png',
    SIZE: 48,
    HITBOX_RADIUS: 21,      // не менялся
    POINTS: 100,
    FIRST_DELAY: 1000,      // мс до первого бонуса
    RESPAWN_DELAY: 1200,    // мс до следующего бонуса
    LIFETIME_PHASE3: 5,     // сек жизни бонуса в 3-й фазе
    MIN_DISTANCE_FROM_PLAYER: 260,
    EDGE_MARGIN: 55,        // отступ от краёв арены
    OBSTACLE_MARGIN: 40,    // отступ от препятствий
    // Запасные точки, если случайная точка не нашлась
    FALLBACK_POINTS: [
      { x: 540, y: 160 },
      { x: 540, y: 535 },
      { x: 60, y: 1110 },
      { x: 1020, y: 1110 },
      { x: 540, y: 1690 }
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
    DEAD_ZONE: 0.15,       // мёртвая зона — 15% радиуса: палец у центра не даёт «ползания»
    FULL_SPEED_AT: 0.6,    // полная скорость уже при 60% отклонения
    SNAP_ANGLE: 8          // почти ровно вверх/вниз/вбок (±8°) — движение строго по прямой
  },

  CATCH_DELAY: 400, // мс между поимкой и экраном поражения

  // Анимации персонажей: лист 12 кадров 64×64 в ряд (assets/sprites/make_sprites.py)
  ANIMATION: {
    FRAME_SIZE: 64,
    FRAMES: {             // [первый, последний] кадр
      IDLE: [0, 1],       // дыхание лицом к зрителю
      RUN: [2, 5],        // бег лицом к зрителю
      BACK_IDLE: [6, 7],  // дыхание спиной
      BACK_RUN: [8, 11]   // бег спиной — когда персонаж бежит вверх по экрану
    },
    IDLE_FPS: 2,
    MIN_RUN_SPEED: 25,    // медленнее — анимация дыхания
    BACK_RATIO: 0.6       // вверх быстрее, чем 0.6 × вбок, — вид со спины
  },

  // Стрелки у краёв экрана: где враги и таблетка, если их не видно
  INDICATORS: {
    MARGIN: 34,        // отступ стрелки от края экрана (игровые px)
    SCALE_NEAR: 5,     // масштаб пиксельной стрелки 12×12, когда цель близко
    SCALE_FAR: 3,      // … и когда далеко
    NEAR_DISTANCE: 400,
    FAR_DISTANCE: 1300,
    BONUS_COLOR: 0xffe14d
  },

  UI: {
    BUTTON_MIN_SIZE: 110 // ≈ 56+ CSS-пикселей на телефоне шириной 360–430 px
  },

  // Окружение «районная поликлиника» — пиксель-арт (assets/environment/, генератор make_environment.py)
  ENVIRONMENT: {
    PATH: 'assets/environment/',
    LOOKS: ['chairs4', 'bench', 'registratura', 'wardrobe', 'chairs3', 'magtable', 'kartoteka', 'screen',
      'cooler', 'stand', 'couch', 'gurney', 'ficus', 'bahily', 'scales', 'terminal'],
    WALL_NORTH_HEIGHT: 44, // фасад северной стены (побелка + масляная панель, двери кабинетов)
    WALL_SIDE_WIDTH: 10,
    WALL_BOTTOM_HEIGHT: 10,
    SHADOW: { OFFSET: 6, ALPHA: 0.28 }, // тень предметов вправо-вниз
    SEAMS_X: [318, 638, 958],           // швы полотен линолеума
    WEAR: [[492, 1500], [492, 800], [380, 1080], [640, 1080], [440, 260]], // потёртости (левый верхний угол)
    MAT: { x: 484, y: 1590 }            // коврик у входа
  },

  // Препятствия: центр (x, y), ширина w и высота h — в координатах поля (мира);
  // look — вариант картинки (assets/environment/obstacle_<look>.png, размер = w×h).
  // Раскладка «районная поликлиника»: 23 препятствия, ≈12.0 на 1 000 000 px² (было 14 и ≈7.31).
  // Проверено assets/environment/check_layout.py: зазоры ≥ OBSTACLE_MIN_GAP, до стен ≥ 105,
  // зоны старта (r 150) свободны, запасные точки бонуса вне препятствий, недостижимых мест нет.
  OBSTACLE_MIN_GAP: 110,
  OBSTACLES: [
    // север — кабинеты
    { x: 250, y: 330, w: 190, h: 40, look: 'bench' }, // скамья
    { x: 540, y: 410, w: 80, h: 160, look: 'couch' }, // кушетка
    { x: 830, y: 330, w: 190, h: 40, look: 'chairs4' }, // кресла ×4
    { x: 160, y: 640, w: 40, h: 200, look: 'screen' }, // ширма
    { x: 340, y: 590, w: 80, h: 80, look: 'scales' }, // весы и ростомер
    { x: 740, y: 590, w: 80, h: 80, look: 'ficus' }, // фикус
    { x: 920, y: 640, w: 40, h: 200, look: 'screen' }, // ширма
    { x: 540, y: 700, w: 120, h: 40, look: 'chairs3' }, // кресла ×3
    // середина — коридор с креслами
    { x: 330, y: 830, w: 120, h: 40, look: 'magtable' }, // журнальный столик
    { x: 750, y: 830, w: 120, h: 40, look: 'chairs3' }, // кресла ×3
    { x: 270, y: 990, w: 190, h: 40, look: 'chairs4' }, // кресла ×4
    { x: 540, y: 960, w: 40, h: 120, look: 'stand' }, // стенд
    { x: 810, y: 990, w: 190, h: 40, look: 'bench' }, // скамья
    // юг — вход: регистратура, гардероб, бахилы, терминал
    { x: 140, y: 1260, w: 40, h: 200, look: 'kartoteka' }, // картотека
    { x: 360, y: 1220, w: 80, h: 80, look: 'ficus' }, // фикус
    { x: 540, y: 1200, w: 40, h: 120, look: 'cooler' }, // кулер и урна
    { x: 720, y: 1220, w: 80, h: 80, look: 'scales' }, // весы и ростомер
    { x: 940, y: 1260, w: 40, h: 200, look: 'kartoteka' }, // картотека
    { x: 330, y: 1430, w: 80, h: 80, look: 'bahily' }, // бахилы и урна
    { x: 540, y: 1440, w: 120, h: 40, look: 'chairs3' }, // кресла ×3
    { x: 750, y: 1430, w: 80, h: 80, look: 'terminal' }, // терминал очереди
    { x: 260, y: 1640, w: 200, h: 40, look: 'wardrobe' }, // гардероб
    { x: 820, y: 1640, w: 200, h: 40, look: 'registratura' } // регистратура
  ]
};


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

// Создаёт текст с единым стилем (пиксельный шрифт).
// options.stroke — тёмная обводка для текста поверх пола/картинок.
function createText(scene, x, y, text, size, color = CONFIG.COLORS.INK, options = {}) {
  const label = scene.add.text(x, y, text, {
    fontFamily: CONFIG.FONT,
    fontSize: size + 'px',
    fontStyle: 'normal', // у пиксельного шрифта одно начертание — без искусственного жирного
    color: colorToCss(color),
    align: 'center',
    lineSpacing: options.lineSpacing || 0
  }).setOrigin(0.5);
  if (options.stroke) {
    label.setStroke(colorToCss(CONFIG.COLORS.INK), options.stroke);
  }
  return label;
}

// Рисует пиксельную табличку (как таблички на дверях кабинетов и мебель):
// тёмный контур с вырезанными углами, заливка, тёмная нижняя грань.
// Координаты — центр (x, y); px — размер «пикселя» рамки.
function drawPlate(graphics, x, y, width, height, fill, shade, px = 6) {
  const left = Math.round(x - width / 2);
  const top = Math.round(y - height / 2);
  const w = Math.round(width);
  const h = Math.round(height);
  // контур без углов
  graphics.fillStyle(CONFIG.COLORS.INK, 1);
  graphics.fillRect(left + px, top, w - px * 2, h);
  graphics.fillRect(left, top + px, w, h - px * 2);
  // заливка
  graphics.fillStyle(fill, 1);
  graphics.fillRect(left + px, top + px, w - px * 2, h - px * 2);
  // нижняя грань (объём 3/4, как у предметов поликлиники)
  graphics.fillStyle(shade, 1);
  graphics.fillRect(left + px, top + h - px * 2.5, w - px * 2, px * 1.5);
}

// Создаёт крупную кнопку-табличку: прямоугольник (нажатия и заливка) + рамка + надпись.
// Возвращает прямоугольник; рамка — button.decor, надпись — button.label.
// options.primary — зелёная кнопка (главное действие), иначе — побелка.
function createButton(scene, x, y, label, onClick, options = {}) {
  const C = CONFIG.COLORS;
  const width = Math.max(options.width || 440, CONFIG.UI.BUTTON_MIN_SIZE);
  const height = Math.max(options.height || 130, CONFIG.UI.BUTTON_MIN_SIZE);
  const fontSize = options.fontSize || 48;
  const fill = options.primary ? C.PAINT : C.PAPER;
  const shade = options.primary ? C.PAINT_DARK : C.PAPER_SHADE;

  const decor = scene.add.graphics({ x: x, y: y });
  const draw = (pressed) => {
    decor.clear();
    drawPlate(decor, 0, 0, width, height, pressed ? shade : fill, pressed ? fill : shade);
  };
  draw(false);

  // Невидимая зона нажатия поверх рамки
  const button = scene.add.rectangle(x, y, width, height, 0x000000, 0.001)
    .setInteractive({ useHandCursor: true });
  button.decor = decor;
  button.label = createText(scene, x, y - 4, label, fontSize, C.INK);

  // Нажатие: табличка «утапливается»
  button.on('pointerdown', () => { draw(true); button.label.setY(button.y); });
  button.on('pointerout', () => { draw(false); button.label.setY(button.y - 4); });
  // Действие срабатывает, когда палец отпущен над кнопкой
  button.on('pointerup', () => {
    draw(false);
    button.label.setY(button.y - 4);
    onClick();
  });

  return button;
}

// Все части кнопки — для добавления в контейнер
function buttonParts(button) {
  return [button.decor, button, button.label];
}

// Анимация персонажа по его скорости: стоит — дышит, бежит — бег.
// Бежит вверх по экрану — вид со спины; остановился — остаётся лицом туда же.
// normalSpeed — обычная скорость персонажа (на ней кадры идут с частотой runFps).
function animateCharacter(sprite, vx, vy, normalSpeed, speedUp = 1) {
  const A = CONFIG.ANIMATION;
  const speed = Math.hypot(vx, vy);
  const moving = speed > A.MIN_RUN_SPEED;
  if (moving) {
    sprite.facingBack = vy < 0 && -vy > Math.abs(vx) * A.BACK_RATIO;
  }
  const key = sprite.texture.key + (sprite.facingBack ? '-back' : '') + (moving ? '-run' : '-idle');
  sprite.anims.play(key, true);
  sprite.anims.timeScale = moving ? Phaser.Math.Clamp(speed / normalSpeed, 0.6, 2.5) * speedUp : 1;
}

// Ставит контейнер с вёрсткой по центру экрана и уменьшает его, если не помещается.
// blockHeight — высота содержимого контейнера (его координаты — относительно центра).
function fitContainer(container, screenHeight, blockHeight) {
  const scale = Math.min(1, (screenHeight - 40) / blockHeight);
  container.setScale(scale);
  container.setPosition(CONFIG.WIDTH / 2, screenHeight / 2);
}

// Показывает или прячет список объектов интерфейса.
// У кнопок заодно включается/выключается реакция на нажатия.
function setItemsVisible(items, visible) {
  items.forEach((item) => {
    item.setVisible(visible);
    if (item.label) {
      item.label.setVisible(visible);
    }
    if (item.decor) {
      item.decor.setVisible(visible);
    }
    if (item.input) {
      item.input.enabled = visible;
    }
  });
}
