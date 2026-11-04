// =============================================================
// Общие настройки игры «СПИДозный ЦГБ».
// Все числа собраны здесь, чтобы их было легко менять и балансировать.
// Координаты указаны в «игровых пикселях». Игра горизонтальная: высота экрана
// игры всегда 720, а ширина подстраивается под пропорцию экрана телефона
// (см. computeGameWidth в main.js), поэтому чёрных полос нет.
// =============================================================

const CONFIG = {
  // Экран игры (canvas): высота постоянная, ширина — по пропорции экрана.
  // Весь canvas — окно камеры на арену; управление и счёт — прозрачные HTML-кнопки поверх.
  WIDTH: 1280,       // «расчётная» ширина: под неё свёрстаны меню, пауза и экран поражения
  HEIGHT: 720,
  MIN_WIDTH: 960,    // уже — появятся полосы сверху и снизу (почти квадратное окно)
  MAX_WIDTH: 1700,   // шире не растём (очень вытянутые экраны)

  // Игровое поле (мир) больше экрана: камера следует за игроком.
  // Было 1080×1774 (вертикальное), стало 2240×1280 — горизонтальное и в 1.5 раза больше по площади.
  ARENA: {
    WIDTH: 2240,
    HEIGHT: 1280
  },

  // Пиксельный шрифт с кириллицей Tiny5 (assets/fonts/, подключён в css/style.css)
  FONT: '"Tiny5", monospace',

  // Палитра «мрачная государственная поликлиника»: карточки — пожелтевшие казённые бланки,
  // кнопки — грязно-зелёная масляная краска, штамп — выцветший красный
  COLORS: {
    INK: 0x1c1e20,         // тёмный контур, текст на светлом
    PAPER: 0xc8c2a6,       // пожелтевший бланк: таблички, карточки
    PAPER_SHADE: 0x9e9a84, // тень бланка: нижняя грань табличек
    PAINT: 0x5f8270,       // масляная панель стены: главные кнопки
    PAINT_DARK: 0x46624f,
    PAINT_LINE: 0x34403a,  // бордюр панели, приглушённый текст
    WOOD: 0x8a7458,        // дерево (рамки)
    WOOD_DARK: 0x5c4a38,
    STAMP: 0x9c2a2e,       // красный штамп («ПОЙМАН!»)
    BACKGROUND: 0x1c1e20,
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
    START: { x: 1120, y: 1150 } // низ поля по центру, у входа
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
    DASH_VISIBLE_MARGIN: 40, // рвётся, только если виден на экране (отступ от края)
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
        start: { x: 1120, y: 171 },
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
        start: { x: 1900, y: 140 },
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
        start: { x: 340, y: 140 },
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
      { x: 1120, y: 160 },
      { x: 1120, y: 775 },
      { x: 70, y: 775 },
      { x: 2170, y: 775 },
      { x: 1120, y: 1225 }
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

  // Плавающий полупрозрачный джойстик поверх игры (HTML): появляется там,
  // где палец коснулся левой половины экрана.
  // ВНИМАНИЕ: размеры здесь в CSS-пикселях экрана, а не в игровых координатах.
  JOYSTICK: {
    ZONE_SHARE: 0.5,       // зона джойстика — левая половина экрана
    BASE_RADIUS: 60,       // радиус базы
    KNOB_RADIUS: 25,       // радиус ручки
    MAX_TO_HEIGHT: 0.17,   // на низком экране база не больше 17% его высоты
    EDGE_MARGIN: 8,        // база целиком на экране: отступ от края
    DEAD_ZONE: 0.15,       // мёртвая зона — 15% радиуса: палец у центра не даёт «ползания»
    FULL_SPEED_AT: 0.6,    // полная скорость уже при 60% отклонения
    SNAP_ANGLE: 8          // почти ровно вверх/вниз/вбок (±8°) — движение строго по прямой
  },

  CATCH_DELAY: 400, // мс между поимкой и экраном поражения

  // Комбо: таблетки подряд быстрее WINDOW секунд — множитель очков растёт до MAX
  COMBO: {
    WINDOW: 6,
    MAX: 4
  },

  // «Проскочила вплотную»: пациент был ближе DISTANCE (центр к центру), но не поймал
  NEAR_MISS: {
    DISTANCE: 80,
    RELEASE: 30,     // засчитывается, когда пациент отдалился ещё на столько
    POINTS: 25,
    COOLDOWN: 2      // сек — не чаще для одного пациента
  },

  // Уворот героини: короткий рывок, во время которого пациенты не ловят
  DODGE: {
    DURATION: 0.2,      // сек
    SPEED_FACTOR: 2.6,  // во сколько раз быстрее обычного бега
    COOLDOWN: 3.5,      // сек перезарядки
    DASH_DODGE_DISTANCE: 110, // пациент пронёсся в рывке ближе этого — «увернулась»
    DASH_DODGE_POINTS: 50
  },

  // Таблетки с эффектами: каждая SPECIAL_EVERY-я таблетка — особая (после SPECIAL_AFTER сек)
  PILLS: {
    SPECIAL_EVERY: 3,
    SPECIAL_AFTER: 8,
    TYPES: {
      validol: {
        texture: 'pill-validol', sprite: 'assets/sprites/pill_validol.png', color: 0xff5a64,
        name: 'Валидол', hint: 'быстрее!', duration: 4, speedBoost: 1.35
      },
      sleeping: {
        texture: 'pill-sleeping', sprite: 'assets/sprites/pill_sleeping.png', color: 0x6e96ff,
        name: 'Снотворное', hint: 'все спят', duration: 3
      },
      mask: {
        texture: 'pill-mask', sprite: 'assets/sprites/pill_mask.png', color: 0x82dcff,
        name: 'Маска', hint: 'защита от поимки', duration: 10, stun: 1.2, invulnerable: 1.5
      },
      laxative: {
        texture: 'pill-laxative', sprite: 'assets/sprites/pill_laxative.png', color: 0xc48446,
        name: 'Слабительное', hint: 'все в туалет!', duration: 4
      }
    }
  },

  // Двери кабинетов 101–106 на северной стене (центр двери по x; картинка — wall_north.png).
  // Из дверей выходят пациенты и другие персонажи; в кабинете можно спрятаться.
  DOORS: {
    LIST: [{ x: 160, number: 101 }, { x: 520, number: 102 }, { x: 900, number: 103 },
      { x: 1340, number: 104 }, { x: 1720, number: 105 }, { x: 2080, number: 106 }],
    TOP: 6,            // дверной проём на картинке стены: y 6…43
    BOTTOM: 43,
    FRONT_Y: 84,       // точка перед дверью, где появляются персонажи
    TELEGRAPH: 1.2     // сек: дверь мигает и скрипит перед появлением
  },

  // Кто и когда выходит из кабинетов (сек от начала партии)
  SPAWNS: [
    { role: 'hunter', at: 1 },
    { role: 'interceptor', at: 3 },
    { role: 'heavy', at: 6 },
    { npc: 'cleaner', at: 25 },
    { role: 'hunter', at: 40 },       // ещё один Охотник
    { npc: 'granny', at: 50 },
    { role: 'interceptor', at: 70 }   // ещё один Перехватчик
  ],

  // Укрытие в кабинете: забежать в дверь — 3 с невидима, очки за время не идут
  HIDE: {
    ENTER_DISTANCE: 44,  // насколько близко к двери (центр героини к точке у стены)
    DURATION: 3,
    COOLDOWN: 12,        // сек, пока кабинет «занят» после пряток
    INVULNERABLE_AFTER: 1 // сек неуязвимости после выхода
  },

  // Персонажи поликлиники (не ловят)
  NPC: {
    cleaner: {
      texture: 'npc-cleaner', sprite: 'assets/sprites/npc_cleaner_sheet.png', runFps: 8,
      speed: 80, puddleEvery: 1.0, name: 'Санитарка',
      // петля по свободным коридорам (проверена на отсутствие препятствий на пути)
      path: [[70, 180], [2170, 180], [2170, 775], [1200, 775], [1200, 1225], [70, 1225], [70, 775]],
      phrases: ['Куда по мытому?!', 'Осторожно, мокро!', 'Ходят тут…']
    },
    granny: {
      texture: 'npc-granny', sprite: 'assets/sprites/npc_granny_sheet.png', runFps: 5,
      speed: 55, name: 'Бабушка',
      // по пути к очереди в регистратуру: от двери вниз по свободному коридору x = 1770
      approach: [[1770, 180], [1770, 1045]],
      path: [[1480, 1045], [1800, 1045]],
      hitboxRadius: 24,  // твёрдая: героиня и пациенты обходят
      phrases: ['Кто последний?', 'Я только спросить!', 'Мне по записи!', 'Молодёжь пошла…']
    }
  },

  // Лужи после санитарки: скользко и героине, и пациентам
  PUDDLE: {
    LIFETIME: 9,       // сек
    MAX: 12,
    RADIUS_X: 32,      // лужа — эллипс
    RADIUS_Y: 14,
    SLIP_ACCEL: 0.25,  // на мокром разгон героини в 4 раза слабее…
    SLIP_DECEL: 0.06,  // …а торможение почти не работает: проезжает ≈ 60 px, заносит на поворотах
    CHASER_TURN: 0.25  // во сколько раз хуже поворачивают пациенты на мокром
  },

  // Задания на смену: в меню выбираются 3 случайных (по разной статистике),
  // за каждое выполненное — бонус. stat — поле статистики партии (time — секунды)
  MISSIONS: {
    PER_SHIFT: 3,
    POINTS: 300,
    LIST: [
      { id: 'pills5', text: 'Собери 5 таблеток', stat: 'pills', goal: 5 },
      { id: 'pills8', text: 'Собери 8 таблеток', stat: 'pills', goal: 8 },
      { id: 'time45', text: 'Продержись 45 секунд', stat: 'time', goal: 45 },
      { id: 'time75', text: 'Продержись 75 секунд', stat: 'time', goal: 75 },
      { id: 'near3', text: 'Проскочи вплотную 3 раза', stat: 'nearMisses', goal: 3 },
      { id: 'dashDodge2', text: 'Увернись от 2 рывков', stat: 'dashDodges', goal: 2 },
      { id: 'combo3', text: 'Сделай комбо ×3', stat: 'maxCombo', goal: 3 },
      { id: 'dodge5', text: 'Используй уворот 5 раз', stat: 'dodges', goal: 5 },
      { id: 'hide1', text: 'Спрячься в кабинете', stat: 'hides', goal: 1 },
      { id: 'special2', text: 'Возьми 2 особые таблетки', stat: 'specialPills', goal: 2 }
    ]
  },

  // «Диагноз» по итогам партии (по очкам, от меньшего к большему)
  DIAGNOSES: [
    { score: 0, text: 'Острый случай' },
    { score: 300, text: 'На больничном' },
    { score: 700, text: 'Хроник' },
    { score: 1200, text: 'Здорова как бык' },
    { score: 2000, text: 'Главврач года' }
  ],

  // Гардероб: варианты формы героини. unlock — условие открытия
  // (stat: bestScore — рекорд, bestTime — лучшее время, totalPills — таблеток за всё время,
  //  totalMissions — выполнено заданий за всё время, games — сыграно смен)
  SKINS: [
    { key: 'classic', name: 'Классика', texture: 'player', sprite: 'assets/sprites/doctor_sheet.png', unlock: null },
    { key: 'pink', name: 'Розовая смена', texture: 'player-pink', sprite: 'assets/sprites/doctor_pink_sheet.png',
      unlock: { stat: 'bestScore', value: 600, text: 'рекорд 600 очков' } },
    { key: 'night', name: 'Ночная смена', texture: 'player-night', sprite: 'assets/sprites/doctor_night_sheet.png',
      unlock: { stat: 'totalPills', value: 30, text: '30 таблеток за всё время' } },
    { key: 'surgeon', name: 'Хирург', texture: 'player-surgeon', sprite: 'assets/sprites/doctor_surgeon_sheet.png',
      unlock: { stat: 'totalMissions', value: 5, text: '5 выполненных заданий' } },
    { key: 'chief', name: 'Главврач', texture: 'player-chief', sprite: 'assets/sprites/doctor_chief_sheet.png',
      unlock: { stat: 'bestTime', value: 90, text: 'продержаться 90 секунд' } }
  ],

  // Штампы на экране поражения (случайный из открытых)
  STAMPS: [
    { text: 'ПОЙМАН!', unlock: null },
    { text: 'НА БОЛЬНИЧНЫЙ!', unlock: { stat: 'games', value: 5, text: 'сыграть 5 смен' } },
    { text: 'В ОЧЕРЕДЬ!', unlock: { stat: 'bestScore', value: 1000, text: 'рекорд 1000 очков' } },
    { text: 'ВЫПИСАНА!', unlock: { stat: 'totalMissions', value: 10, text: '10 выполненных заданий' } }
  ],

  // Отсчёт 3-2-1 после паузы
  COUNTDOWN: {
    FROM: 3,
    STEP_MS: 550
  },

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
    SEAMS_X: [318, 638, 958, 1278, 1598, 1918], // швы полотен линолеума
    WEAR: [[1072, 1080], [1072, 740], [420, 740], [1700, 740], [1150, 150], [400, 1180]], // потёртости (левый верхний угол)
    MAT: { x: 1064, y: 1210 },          // коврик у входа
    // Грязь и разруха на полу (левый верхний угол картинки): пятна, дыры в линолеуме, трещины
    STAINS: [[240, 720], [820, 200], [1460, 700], [1980, 1000], [700, 1010], [1240, 1210], [90, 400], [2120, 300]],
    TEARS: [[560, 760], [1540, 1010], [1800, 220], [260, 1020]],
    CRACKS: [[980, 1000], [1700, 640], [380, 450], [2040, 760], [1300, 160]]
  },

  // Освещение: лампы дневного света на потолке (js/utils/lighting.js).
  // Между лампами — полумрак; несколько ламп барахлят и мигают.
  LIGHTING: {
    CELL: 8,           // свет считается квадратами 8×8 (крупные «пиксели»)
    LEVELS: 6,         // ступеней яркости (с точечным дизерингом между ними)
    RADIUS: 340,       // радиус светового пятна лампы
    DARK: 0.62,        // темнота вдали от ламп (0 — светло, 1 — черно)
    LIT: 0.04,         // темнота прямо под лампой
    DEPTH: 4.5,        // слой темноты: над полом и мебелью, под персонажами и таблетками
    VIGNETTE: 0.55,    // темнота по краям экрана
    FLICKER_EVERY: [3, 9],     // сек между «приступами» мигания
    FLICKER_BURST: [0.4, 1.4], // сек длится приступ
    FLICKER_DEPTH: 0.9,        // насколько темнеет пятно, когда лампа гаснет
    // Не все лампы работают: часть коридоров в полумраке
    LAMPS: [[300, 200], [900, 200], [1500, 200], [2000, 200],
      [600, 560], [1200, 560], [1800, 560],
      [200, 800], [760, 800], [1340, 800], [2100, 800],
      [500, 1080], [1100, 1080], [1720, 1080]],
    FLICKERING: [2, 5, 7, 12] // индексы мигающих ламп в LAMPS
  },

  // Препятствия: центр (x, y), ширина w и высота h — в координатах поля (мира);
  // look — вариант картинки (assets/environment/obstacle_<look>.png, размер = w×h).
  // Горизонтальная раскладка «районная поликлиника»: 29 препятствий на 2240×1280.
  // Свободны коридоры: у дверей (y ≈ 180), посередине (y ≈ 775) и у входа (y ≈ 1225).
  // Проверено assets/environment/check_layout.py: зазоры ≥ OBSTACLE_MIN_GAP, до стен ≥ 105,
  // зоны старта (r 150) свободны, запасные точки бонуса вне препятствий, недостижимых мест нет.
  OBSTACLE_MIN_GAP: 110,
  OBSTACLES: [
    // север — у кабинетов
    { x: 300, y: 330, w: 190, h: 40, look: 'bench' }, // скамья
    { x: 560, y: 420, w: 80, h: 160, look: 'couch' }, // кушетка
    { x: 960, y: 330, w: 190, h: 40, look: 'chairs4' }, // кресла ×4
    { x: 1280, y: 330, w: 190, h: 40, look: 'chairs4' }, // кресла ×4
    { x: 1680, y: 420, w: 80, h: 160, look: 'gurney' }, // каталка
    { x: 1940, y: 330, w: 190, h: 40, look: 'bench' }, // скамья
    { x: 180, y: 580, w: 40, h: 200, look: 'screen' }, // ширма
    { x: 380, y: 620, w: 80, h: 80, look: 'scales' }, // весы и ростомер
    { x: 760, y: 580, w: 80, h: 80, look: 'ficus' }, // фикус
    { x: 930, y: 600, w: 40, h: 120, look: 'cooler' }, // кулер и урна
    { x: 1120, y: 560, w: 120, h: 40, look: 'chairs3' }, // кресла ×3
    { x: 1310, y: 600, w: 40, h: 120, look: 'stand' }, // стенд
    { x: 1480, y: 580, w: 80, h: 80, look: 'scales' }, // весы и ростомер
    { x: 1880, y: 580, w: 80, h: 80, look: 'ficus' }, // фикус
    { x: 2060, y: 600, w: 40, h: 200, look: 'screen' }, // ширма
    // середина — зал ожидания
    { x: 360, y: 880, w: 120, h: 40, look: 'magtable' }, // журнальный столик
    { x: 640, y: 900, w: 40, h: 120, look: 'stand' }, // стенд
    { x: 900, y: 880, w: 190, h: 40, look: 'chairs4' }, // кресла ×4
    { x: 1340, y: 880, w: 190, h: 40, look: 'bench' }, // скамья
    { x: 1600, y: 900, w: 40, h: 120, look: 'cooler' }, // кулер и урна
    { x: 1880, y: 880, w: 120, h: 40, look: 'chairs3' }, // кресла ×3
    { x: 160, y: 900, w: 40, h: 200, look: 'kartoteka' }, // картотека
    { x: 2080, y: 880, w: 40, h: 120, look: 'cooler' }, // кулер и урна
    // юг — вход: гардероб, бахилы, терминал, регистратура
    { x: 300, y: 1150, w: 200, h: 40, look: 'wardrobe' }, // гардероб
    { x: 620, y: 1120, w: 80, h: 80, look: 'bahily' }, // бахилы и урна
    { x: 860, y: 1150, w: 120, h: 40, look: 'chairs3' }, // кресла ×3
    { x: 1380, y: 1120, w: 80, h: 80, look: 'terminal' }, // терминал очереди
    { x: 1640, y: 1150, w: 200, h: 40, look: 'registratura' }, // регистратура
    { x: 1960, y: 1110, w: 80, h: 80, look: 'ficus' } // фикус
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

// Карточка-бланк (пауза, поражение, гардероб, памятка): табличка + тонкая двойная рамка
// внутри и строка «Форма № …» мелким шрифтом в углу — как у казённых медицинских бланков.
// Возвращает графику; подпись формы (текст) — graphics.formLabel.
function drawForm(scene, graphics, x, y, width, height, formNumber) {
  const C = CONFIG.COLORS;
  drawPlate(graphics, x, y, width, height, C.PAPER, C.PAPER_SHADE, 8);
  const left = Math.round(x - width / 2) + 16;
  const top = Math.round(y - height / 2) + 16;
  const w = Math.round(width) - 32;
  const h = Math.round(height) - 36;
  graphics.lineStyle(2, C.PAINT_LINE, 0.5);
  graphics.strokeRect(left, top, w, h);
  graphics.lineStyle(2, C.PAINT_LINE, 0.25);
  graphics.strokeRect(left + 6, top + 6, w - 12, h - 12);
  if (formNumber) {
    graphics.formLabel = createText(scene, left + w - 10, top + 16, 'Форма № ' + formNumber, 16, C.PAINT_LINE)
      .setOrigin(1, 0.5).setAlpha(0.8);
  }
  return graphics;
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
    Sound.play('click');
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
// scale — this.scale сцены; blockHeight — высота содержимого (его координаты — относительно центра).
// blockWidth — ширина содержимого (по умолчанию ширина не ограничивает).
function fitContainer(container, scale, blockHeight, blockWidth = 0) {
  const k = Math.min(1, (scale.height - 30) / blockHeight, blockWidth ? (scale.width - 30) / blockWidth : 1);
  container.setScale(k);
  container.setPosition(scale.width / 2, scale.height / 2);
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
