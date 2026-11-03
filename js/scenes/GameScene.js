// =============================================================
// GameScene — сама игра: арена, препятствия, игрок, преследователи,
// бонусы, управление, сложность и подсчёт очков.
// Интерфейс (HUD, пауза, поражение) рисует UIScene поверх этой сцены.
// =============================================================

class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  // init вызывается при каждом (пере)запуске сцены — сбрасываем состояние
  init() {
    this.elapsed = 0;            // время выживания в секундах
    this.scoredTime = 0;         // время, за которое начисляются очки (без пряток в кабинете)
    this.extraPoints = 0;        // очки за таблетки, комбо, «вплотную», задания
    this.score = 0;
    this.lastHudSecond = -1;
    this.isGameOver = false;
    this.hasMoved = false;       // двигался ли игрок (для подсказки)

    // Комбо: таблетки подряд быстрее CONFIG.COMBO.WINDOW
    this.combo = 0;
    this.lastPillTime = -999;

    // Статистика партии (для заданий и «диагноза»)
    this.stats = { pills: 0, specialPills: 0, nearMisses: 0, maxCombo: 0, dodges: 0, dashDodges: 0, hides: 0 };

    // Эффекты таблеток: сколько секунд ещё действуют
    this.effects = { validol: 0, sleeping: 0, mask: 0, laxative: 0 };
    this.pillsSpawned = 0;
    this.lastSpecial = null;
    this.zzzTimer = 0;

    // Кабинеты: кто и когда выходит, укрытие героини, персонажи поликлиники, лужи
    this.spawnQueue = CONFIG.SPAWNS.map((entry) => Object.assign({ door: null, done: false }, entry));
    this.doors = CONFIG.DOORS.LIST.map((door) => Object.assign({ cooldown: 0, blink: 0 }, door));
    this.hiding = null;
    this.npcs = [];
    this.puddles = [];
    this.slipNoticeTimer = 0;

    // Задания на смену: выбраны в меню (при «Играть снова» — те же)
    const ids = this.registry.get('missions') || Progress.rollMissions();
    this.registry.set('missions', ids);
    this.missions = ids.map((id) => Object.assign({ done: false }, CONFIG.MISSIONS.LIST.find((m) => m.id === id)));
  }

  create() {
    this.physics.resume();
    // Поле (мир) больше экрана: координаты мира от (0, 0) до (ARENA.WIDTH, ARENA.HEIGHT)
    this.physics.world.setBounds(0, 0, CONFIG.ARENA.WIDTH, CONFIG.ARENA.HEIGHT);

    this.createArena();
    this.createObstacles();
    this.createPlayer();
    this.createChasers();
    this.createBonus();
    this.setupCamera();
    this.setupCollisions();
    this.setupKeyboard();
    this.createStartHint();
    this.createIndicators();
    this.createEffectsHud();
    this.doorGraphics = this.add.graphics().setDepth(3); // мигание дверей и лампочки «занято»

    // Уворот: кнопка в панели, на компьютере — пробел или Shift
    Hud.onDodge = () => this.tryDodge();

    // Высота экрана игры меняется (поворот, панели браузера) — подгоняем камеру
    this.scale.on('resize', this.onResize, this);

    // Фиксированный джойстик в нижней панели (js/utils/joystick.js)
    Joystick.setEnabled(true);

    // Звуки рывков пациентов (громче, если рядом)
    this.events.on('chaser-telegraph', this.onChaserTelegraph, this);
    this.events.on('chaser-dash', this.onChaserDash, this);
    this.events.on('chaser-dash-end', this.onChaserDashEnd, this);

    // Пауза/продолжение (их вызывает UIScene)
    this.events.on('pause', this.onScenePause, this);
    this.events.on('resume', this.onSceneResume, this);
    this.events.once('shutdown', this.onShutdown, this);

    // Интерфейс запускаем поверх игры
    this.scene.launch('UIScene');

    this.scheduleBonus(CONFIG.BONUS.FIRST_DELAY);
  }

  update(time, delta) {
    if (this.isGameOver) {
      return;
    }

    // Ограничиваем шаг, чтобы после подвисания враги не «прыгали»
    const dt = Math.min(delta, 100) / 1000;
    this.elapsed += dt;
    // В кабинете очки за время не идут
    if (!this.hiding) {
      this.scoredTime += dt;
    }

    this.updateSpawns();
    this.updateDoors(dt);
    this.updateNpcs(dt);
    this.updatePuddles(dt);

    const difficulty = this.getDifficulty(this.elapsed);
    const input = this.getMoveInput();

    this.updateEffects(dt);
    this.updateHiding(dt);
    if (!this.hiding) {
      // Мокрый пол: разгон и торможение героини намного медленнее — скользит
      const wet = this.isWet(this.player.x, this.player.y);
      this.player.wet = wet;
      this.slipNoticeTimer -= dt;
      if (wet && this.slipNoticeTimer <= 0 && this.player.moveVelocity.length() > 100) {
        this.slipNoticeTimer = 3;
        this.popup(this.player.x, this.player.y - 20, 'скользко!', CONFIG.COLORS.PAPER);
      }
      this.player.move(input.x, input.y, dt);
    }
    Hud.setDodge(this.player.dodgeCooldown / CONFIG.DODGE.COOLDOWN);

    // Пока героиня в кабинете, пациенты топчутся у двери
    const target = this.hiding ? this.hiding.proxy : this.player;

    // Общие данные кадра для всех врагов
    const ctx = {
      dt: dt,
      player: target,
      chasers: this.chasers,
      bonus: this.bonus,
      obstacleRects: this.obstacleRects,
      speedMultiplier: difficulty.speedMultiplier,
      turnProgress: difficulty.turnProgress,
      dashInterval: this.hiding ? null : difficulty.dashInterval,
      // Мокрый пол — пациенты хуже поворачивают
      isWet: (x, y) => this.isWet(x, y),
      // Рывок — только если пациента видно на экране (без прыжков из-за края)
      view: this.cameras.main.worldView,
      // Таблетки: снотворное — все спят, слабительное — все убегают
      sleeping: this.effects.sleeping > 0,
      fleeing: this.effects.laxative > 0,
      // Рывок одновременно делает только один враг — так честнее и предсказуемее
      dashBusy: this.chasers.some((chaser) => chaser.isDashBusy())
    };
    this.chasers.forEach((chaser) => {
      chaser.updateChaser(ctx);
      ctx.dashBusy = ctx.dashBusy || chaser.isDashBusy();
    });

    this.updateBonusLifetime(dt, difficulty.phase);
    this.updateNearMisses(dt);
    this.updateMissions();
    this.updateComboHud();
    this.updateScore();
    this.updateIndicators();
    this.updateEffectsHud();
  }

  // ---------------------------------------------------------------
  // Создание мира
  // ---------------------------------------------------------------

  // Пол и стены поликлиники — готовые пиксельные текстуры, рисуются один раз
  createArena() {
    const width = CONFIG.ARENA.WIDTH;
    const height = CONFIG.ARENA.HEIGHT;
    const env = CONFIG.ENVIRONMENT;

    // Линолеум «под паркет»: один TileSprite на всё поле
    this.add.tileSprite(0, 0, width, height, 'env-floor_tile').setOrigin(0).setDepth(0);
    // Швы полотен, потёртости и коврик у входа
    env.SEAMS_X.forEach((x) => {
      this.add.tileSprite(x, 0, 2, height, 'env-decal_seam').setOrigin(0).setDepth(0);
    });
    env.WEAR.forEach(([x, y]) => this.add.image(x, y, 'env-decal_wear').setOrigin(0).setDepth(0));
    this.add.image(env.MAT.x, env.MAT.y, 'env-decal_mat').setOrigin(0).setDepth(0);

    // Стены: фасад северной (двери кабинетов), тонкая кромка боковых и южной.
    // Это только картинка: граница мира не менялась.
    this.add.image(0, 0, 'env-wall_north').setOrigin(0).setDepth(2);
    this.add.tileSprite(0, env.WALL_NORTH_HEIGHT, env.WALL_SIDE_WIDTH, height - env.WALL_NORTH_HEIGHT, 'env-wall_side')
      .setOrigin(0).setDepth(2);
    this.add.tileSprite(width, env.WALL_NORTH_HEIGHT, env.WALL_SIDE_WIDTH, height - env.WALL_NORTH_HEIGHT, 'env-wall_side')
      .setOrigin(0).setFlipX(true).setDepth(2).setOrigin(1, 0);
    this.add.tileSprite(0, height - env.WALL_BOTTOM_HEIGHT, width, env.WALL_BOTTOM_HEIGHT, 'env-wall_bottom')
      .setOrigin(0).setDepth(2);
  }

  // Камера занимает весь экран игры и следует за игроком, не выходя за края поля
  setupCamera() {
    const camera = this.cameras.main;
    camera.setViewport(0, 0, CONFIG.WIDTH, this.scale.height);
    camera.setBounds(0, 0, CONFIG.ARENA.WIDTH, CONFIG.ARENA.HEIGHT);
    // Без запаздывания: остановилась героиня — сразу стоит и экран
    camera.startFollow(this.player, true, CONFIG.PLAYER.CAMERA_LERP, CONFIG.PLAYER.CAMERA_LERP);
  }

  onResize() {
    this.cameras.main.setSize(CONFIG.WIDTH, this.scale.height);
    this.startHint.setY(this.getStartHintY());
  }

  createObstacles() {
    // Статичная группа: тела не двигаются и непроходимы
    this.obstacles = this.physics.add.staticGroup();

    // Тени всех предметов — одна статичная графика под ними
    const shadow = CONFIG.ENVIRONMENT.SHADOW;
    const shadows = this.add.graphics().setDepth(1);
    shadows.fillStyle(0x000000, shadow.ALPHA);

    CONFIG.OBSTACLES.forEach((item) => {
      // Коллизия — прежний невидимый прямоугольник того же размера
      const rect = this.add.rectangle(item.x, item.y, item.w, item.h).setVisible(false);
      this.obstacles.add(rect);

      // Картинка предмета ровно поверх прямоугольника (верх + фронтальная грань внутри него)
      const left = item.x - item.w / 2;
      const top = item.y - item.h / 2;
      shadows.fillRect(left + shadow.OFFSET, top + shadow.OFFSET, item.w, item.h);
      this.add.image(left, top, 'obstacle-' + item.look).setOrigin(0).setDepth(3);
    });

    // Прямоугольники препятствий — для проверки, свободен ли путь рывка врага
    this.obstacleRects = this.obstacles.getChildren().map((obstacle) => obstacle.getBounds());

    this.validateObstacleLayout();
  }

  // Подсказка для тех, кто будет менять раскладку: зазор между препятствиями
  // не должен быть меньше OBSTACLE_MIN_GAP, иначе появятся узкие места и тупики
  validateObstacleLayout() {
    const rects = this.obstacleRects;
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const dx = Math.max(0, b.left - a.right, a.left - b.right);
        const dy = Math.max(0, b.top - a.bottom, a.top - b.bottom);
        if (Math.hypot(dx, dy) < CONFIG.OBSTACLE_MIN_GAP) {
          console.warn('Препятствия ' + i + ' и ' + j + ' ближе OBSTACLE_MIN_GAP');
        }
      }
    }
  }

  createPlayer() {
    this.player = new Player(this, CONFIG.PLAYER.START.x, CONFIG.PLAYER.START.y);
    // Шаги героини: звук, когда нога касается пола (кадры «полёта» 3 и 5 листа)
    this.player.on('animationupdate', (anim, frame) => {
      if (anim.key.endsWith('run') && (frame.index === 2 || frame.index === 4)) {
        Sound.play('step');
      }
    });
  }

  createChasers() {
    // Обычный массив: Phaser-коллайдеры умеют работать с массивами
    // Три врага с разными ролями: Охотник, Перехватчик, Тяжёлый загонщик
    // Пациенты выходят из кабинетов по расписанию (CONFIG.SPAWNS)
    this.chasers = [];
  }

  // Новый пациент: звуки его рывков и тяжёлых шагов
  addChaser(role, x, y) {
    const chaser = new Chaser(this, role, x, y);
    this.chasers.push(chaser);
    // Стрелка у края экрана для этого пациента
    chaser.arrow = this.add.image(0, 0, 'ui-arrow').setScrollFactor(0).setDepth(90).setVisible(false);
    if (role.key === 'heavy') {
      chaser.on('animationupdate', (anim, frame) => {
        if (anim.key.endsWith('run') && (frame.index === 2 || frame.index === 4)) {
          Sound.play('thud', { volume: this.soundVolumeAt(chaser.x, chaser.y) });
        }
      });
    }
    return chaser;
  }

  // Громкость звука в точке мира: рядом — 1, дальше 700 px — тишина
  soundVolumeAt(x, y) {
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
    return Phaser.Math.Clamp(1 - distance / 700, 0, 1);
  }

  createBonus() {
    this.bonus = new Bonus(this);
  }

  setupCollisions() {
    // Игрок и враги не проходят сквозь препятствия
    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.chasers, this.obstacles, this.onChaserHitObstacle, null, this);

    // Поимка игрока: не во время уворота и не спящим/убегающим пациентом
    this.physics.add.overlap(this.player, this.chasers, this.onPlayerCaught,
      (player, chaser) => !player.isInvulnerable() && !chaser.isHarmless(), this);

    // Подбор бонуса
    this.physics.add.overlap(this.player, this.bonus, this.onBonusCollected, null, this);
  }

  // ---------------------------------------------------------------
  // Управление
  // ---------------------------------------------------------------

  setupKeyboard() {
    if (!this.input.keyboard) {
      this.keys = null;
      return;
    }
    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D
    });
    this.input.keyboard.on('keydown-SPACE', this.tryDodge, this);
    this.input.keyboard.on('keydown-SHIFT', this.tryDodge, this);
  }

  // Уворот героини: короткий рывок, пациенты не ловят; за героиней — «призраки»
  tryDodge() {
    if (this.isGameOver || !this.sys.isActive()) {
      return;
    }
    const input = this.getMoveInput();
    if (!this.player.tryDodge(input.x, input.y)) {
      return;
    }
    this.stats.dodges += 1;
    Sound.play('dodge');
    Sound.vibrate(15);
    this.time.addEvent({
      delay: 45,
      repeat: 3,
      callback: () => {
        const ghost = this.add.image(this.player.x, this.player.y, this.player.texture.key, this.player.frame.name)
          .setFlipX(this.player.flipX).setTintFill(CONFIG.COLORS.PLAYER).setAlpha(0.5).setDepth(9);
        this.tweens.add({ targets: ghost, alpha: 0, duration: 260, onComplete: () => ghost.destroy() });
      }
    });
  }

  // Над игроком в начале игры (координаты экрана, не мира)
  getStartHintY() {
    return this.scale.height - 300;
  }

  createStartHint() {
    this.startHint = createText(
      this,
      CONFIG.WIDTH / 2,
      this.getStartHintY(),
      'Управляй джойстиком внизу экрана',
      32,
      CONFIG.COLORS.PAPER
    ).setBackgroundColor(colorToCss(CONFIG.COLORS.INK)).setPadding(18, 8, 18, 10) // тёмная плашка — читается на любом полу
      .setDepth(50).setScrollFactor(0); // не уезжает вместе с камерой
  }

  // ---------------------------------------------------------------
  // Стрелки у краёв экрана: где враги и таблетка, если их не видно
  // ---------------------------------------------------------------

  createIndicators() {
    // Пиксельные стрелки (assets/ui/arrow.png): по одной на каждого врага и на таблетку.
    // Рисуются в координатах экрана (не уезжают с камерой), поверх арены
    // Стрелки пациентов создаются вместе с ними (addChaser), здесь — стрелка таблетки
    this.bonusArrow = this.add.image(0, 0, 'ui-arrow').setScrollFactor(0).setDepth(90).setVisible(false);
  }

  updateIndicators() {
    this.chasers.forEach((chaser) => {
      // Враг готовит рывок — стрелка белая, как и он сам
      const color = chaser.dashState === 'telegraph' ? 0xffffff : chaser.role.color;
      this.placeIndicator(chaser.arrow, chaser.x, chaser.y, color, true);
    });
    this.placeIndicator(this.bonusArrow, this.bonus.x, this.bonus.y, this.bonus.getColor(), this.bonus.active);
  }

  // Стрелка на краю экрана в направлении цели (только если цели не видно)
  placeIndicator(arrow, targetX, targetY, color, enabled) {
    const I = CONFIG.INDICATORS;
    const camera = this.cameras.main;
    const view = camera.worldView;
    if (!enabled || view.contains(targetX, targetY)) {
      arrow.setVisible(false);
      return;
    }

    // Направление из центра экрана на цель
    const halfW = camera.width / 2;
    const halfH = camera.height / 2;
    const dx = targetX - view.centerX;
    const dy = targetY - view.centerY;
    // Точка, где этот луч пересекает рамку с отступом MARGIN от краёв экрана
    const k = Math.min(
      dx !== 0 ? (halfW - I.MARGIN) / Math.abs(dx) : Infinity,
      dy !== 0 ? (halfH - I.MARGIN) / Math.abs(dy) : Infinity
    );

    // Чем ближе цель к игроку, тем крупнее стрелка; масштаб — целый (пиксели ровные)
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, targetX, targetY);
    const t = Phaser.Math.Clamp((distance - I.NEAR_DISTANCE) / (I.FAR_DISTANCE - I.NEAR_DISTANCE), 0, 1);
    const scale = t < 0.5 ? I.SCALE_NEAR : I.SCALE_FAR;

    // Направление — одно из 8. Пиксель-арт поворачиваем только на 90°:
    // для диагоналей есть отдельная картинка (стрелка вправо-вниз)
    const step = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
    const diagonal = step % 2 === 1;
    arrow.setTexture(diagonal ? 'ui-arrow-diag' : 'ui-arrow')
      .setRotation((diagonal ? step - 1 : step) * Math.PI / 4);

    arrow.setPosition(Math.round(halfW + dx * k), Math.round(halfH + dy * k))
      .setScale(scale).setTint(color).setVisible(true);
  }

  // Итоговое направление движения: джойстик важнее клавиатуры
  getMoveInput() {
    let x = 0;
    let y = 0;

    const stick = Joystick.getVector();
    if (stick) {
      // Длина вектора джойстика уже не больше 1 — диагональ не быстрее прямой
      x = stick.x;
      y = stick.y;
    } else if (this.keys) {
      const k = this.keys;
      x = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
      y = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
      // По диагонали не быстрее, чем по прямой
      const length = Math.hypot(x, y);
      if (length > 1) {
        x /= length;
        y /= length;
      }
    }

    // Как только игрок начал двигаться — убираем подсказку
    if (!this.hasMoved && (x !== 0 || y !== 0)) {
      this.hasMoved = true;
      this.startHint.setVisible(false);
    }

    return { x, y };
  }

  // ---------------------------------------------------------------
  // Сложность
  // ---------------------------------------------------------------

  // Возвращает фазу, множитель скорости врагов, прогресс их манёвренности (0..1)
  // и паузу между рывками (null — рывков ещё нет)
  getDifficulty(t) {
    const D = CONFIG.DIFFICULTY;

    // Фаза 1: базовая скорость, рывков нет
    if (t < D.PHASE2_START) {
      return { phase: 1, speedMultiplier: 1, turnProgress: 0, dashInterval: null };
    }

    // Фаза 2: скорость (до потолка 0.97 от игрока) и манёвренность плавно растут
    if (t < D.PHASE3_START) {
      const progress = (t - D.PHASE2_START) / (D.PHASE3_START - D.PHASE2_START);
      return {
        phase: 2,
        speedMultiplier: Phaser.Math.Linear(1, D.PHASE2_END_MULTIPLIER, progress),
        turnProgress: progress,
        dashInterval: null
      };
    }

    // Фаза 3: скорость больше не растёт, вместо этого — рывки, всё чаще
    const progress = Math.min(1, (t - D.PHASE3_START) / D.DASH_INTERVAL_RAMP_TIME);
    return {
      phase: 3,
      speedMultiplier: D.PHASE2_END_MULTIPLIER,
      turnProgress: 1,
      dashInterval: Phaser.Math.Linear(D.DASH_INTERVAL_START, D.DASH_INTERVAL_END, progress)
    };
  }

  // ---------------------------------------------------------------
  // Бонусы
  // ---------------------------------------------------------------

  scheduleBonus(delay) {
    this.time.delayedCall(delay, this.spawnBonus, [], this);
  }

  spawnBonus() {
    if (this.isGameOver) {
      return;
    }
    const position = this.findBonusPosition();

    // Каждая SPECIAL_EVERY-я таблетка — особая (не та же, что в прошлый раз)
    const P = CONFIG.PILLS;
    this.pillsSpawned += 1;
    let type = 'points';
    if (this.elapsed >= P.SPECIAL_AFTER && this.pillsSpawned % P.SPECIAL_EVERY === 0) {
      type = Phaser.Utils.Array.GetRandom(Object.keys(P.TYPES).filter((key) => key !== this.lastSpecial));
      this.lastSpecial = type;
    }
    this.bonus.spawn(position.x, position.y, type);
  }

  // Ищет случайную свободную точку: не у края, не в препятствии, не рядом с игроком
  findBonusPosition() {
    const B = CONFIG.BONUS;
    const minX = B.EDGE_MARGIN;
    const maxX = CONFIG.ARENA.WIDTH - B.EDGE_MARGIN;
    const minY = B.EDGE_MARGIN;
    const maxY = CONFIG.ARENA.HEIGHT - B.EDGE_MARGIN;

    for (let attempt = 0; attempt < 80; attempt++) {
      const x = Phaser.Math.Between(minX, maxX);
      const y = Phaser.Math.Between(minY, maxY);
      // Если долго не находится — немного ослабляем требование к расстоянию
      const minDistance = attempt < 60 ? B.MIN_DISTANCE_FROM_PLAYER : B.MIN_DISTANCE_FROM_PLAYER / 2;

      if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < minDistance) {
        continue;
      }
      if (this.isInsideObstacle(x, y, B.OBSTACLE_MARGIN)) {
        continue;
      }
      return { x, y };
    }

    // Запасной вариант: самая дальняя от игрока заранее проверенная точка
    let best = B.FALLBACK_POINTS[0];
    let bestDistance = -1;
    B.FALLBACK_POINTS.forEach((point) => {
      const distance = Phaser.Math.Distance.Between(point.x, point.y, this.player.x, this.player.y);
      if (distance > bestDistance) {
        bestDistance = distance;
        best = point;
      }
    });
    return { x: best.x, y: best.y };
  }

  isInsideObstacle(x, y, margin) {
    return this.obstacles.getChildren().some((obstacle) => {
      const b = obstacle.getBounds();
      return x > b.left - margin && x < b.right + margin &&
             y > b.top - margin && y < b.bottom + margin;
    });
  }

  // В 3-й фазе несобранный бонус исчезает через 5 секунд
  updateBonusLifetime(dt, phase) {
    if (this.bonus.updateLifetime(dt, phase === 3)) {
      this.bonus.hide();
      this.scheduleBonus(CONFIG.BONUS.RESPAWN_DELAY);
    }
  }

  onBonusCollected(player, bonus) {
    if (!bonus.active || this.isGameOver) {
      return;
    }
    const x = bonus.x;
    const y = bonus.y;
    const type = bonus.type;
    bonus.hide();
    if (type !== 'points') {
      this.applyPill(type, x, y);
    }

    // Комбо: успела за окно — множитель растёт, иначе начинается заново
    const C = CONFIG.COMBO;
    this.combo = this.elapsed - this.lastPillTime <= C.WINDOW ? Math.min(this.combo + 1, C.MAX) : 1;
    this.lastPillTime = this.elapsed;
    this.stats.pills += 1;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);

    const points = CONFIG.BONUS.POINTS * this.combo;
    this.addPoints(points, x, y, '+' + points + (this.combo > 1 ? '  ×' + this.combo : ''), CONFIG.COLORS.BONUS);
    Sound.play(this.combo > 1 ? 'combo' : 'pill', { level: this.combo });

    this.updateScore();
    this.scheduleBonus(CONFIG.BONUS.RESPAWN_DELAY);
  }

  // ---------------------------------------------------------------
  // Таблетки с эффектами
  // ---------------------------------------------------------------

  applyPill(type, x, y) {
    const T = CONFIG.PILLS.TYPES[type];
    this.effects[type] = T.duration;
    this.stats.specialPills += 1;
    this.popup(x, y - 45, T.name + ': ' + T.hint, T.color);
    Sound.play(type === 'sleeping' ? 'sleep' : 'powerup');
    if (type === 'laxative') {
      this.chasers.forEach((chaser) => this.popup(chaser.x, chaser.y - 30, 'в туалет!', T.color));
    }
  }

  updateEffects(dt) {
    Object.keys(this.effects).forEach((key) => {
      this.effects[key] = Math.max(0, this.effects[key] - dt);
    });
    this.player.speedBoost = this.effects.validol > 0 ? CONFIG.PILLS.TYPES.validol.speedBoost : 1;

    // Спящие пациенты похрапывают
    if (this.effects.sleeping > 0) {
      this.zzzTimer -= dt;
      if (this.zzzTimer <= 0) {
        this.zzzTimer = 0.7;
        this.chasers.forEach((chaser) => this.popup(chaser.x + 20, chaser.y - 10, 'z z', CONFIG.PILLS.TYPES.sleeping.color));
      }
    }
  }

  // Плашки активных эффектов в левом верхнем углу экрана: значок и полоска времени
  createEffectsHud() {
    this.effectsGraphics = this.add.graphics().setScrollFactor(0).setDepth(95);
    this.effectIcons = {};
    Object.entries(CONFIG.PILLS.TYPES).forEach(([key, pill]) => {
      this.effectIcons[key] = this.add.image(0, 0, pill.texture).setScrollFactor(0).setDepth(96).setVisible(false);
    });
    // Маска — защитный «ореол» из пиксельных квадратиков вокруг героини
    this.auraGraphics = this.add.graphics().setDepth(11);
  }

  updateEffectsHud() {
    const g = this.effectsGraphics;
    g.clear();
    let row = 0;
    Object.entries(CONFIG.PILLS.TYPES).forEach(([key, pill]) => {
      const left = this.effects[key];
      const icon = this.effectIcons[key];
      if (left <= 0) {
        icon.setVisible(false);
        return;
      }
      const y = 44 + row * 64;
      row += 1;
      drawPlate(g, 112, y, 200, 56, CONFIG.COLORS.PAPER, CONFIG.COLORS.PAPER_SHADE, 4);
      icon.setPosition(44, y - 2).setVisible(true);
      // полоска времени — ступеньками по 10%
      const fraction = Math.ceil(left / pill.duration * 10) / 10;
      g.fillStyle(CONFIG.COLORS.INK, 1);
      g.fillRect(76, y - 10, 116, 16);
      g.fillStyle(pill.color, 1);
      g.fillRect(80, y - 6, Math.round(108 * fraction), 8);
    });

    // Ореол маски
    const aura = this.auraGraphics;
    aura.clear();
    if (this.effects.mask > 0 && !this.isGameOver) {
      aura.fillStyle(CONFIG.PILLS.TYPES.mask.color, 0.9);
      const t = this.time.now / 400;
      for (let i = 0; i < 8; i++) {
        const a = t + i * Math.PI / 4;
        aura.fillRect(Math.round((this.player.x + Math.cos(a) * 40 - 4) / 4) * 4,
          Math.round((this.player.y + Math.sin(a) * 40 - 4) / 4) * 4, 8, 8);
      }
    }
  }

  // ---------------------------------------------------------------
  // Кабинеты: появление персонажей из дверей и укрытие героини
  // ---------------------------------------------------------------

  // Кто должен выйти: за TELEGRAPH секунд дверь мигает и скрипит, потом — выход
  updateSpawns() {
    const T = CONFIG.DOORS.TELEGRAPH;
    this.spawnQueue.forEach((entry) => {
      if (entry.done) {
        return;
      }
      if (!entry.door && this.elapsed >= entry.at - T) {
        entry.door = this.pickSpawnDoor();
        entry.door.blink = T;
        Sound.play('door', { volume: Math.max(0.35, this.soundVolumeAt(entry.door.x, CONFIG.DOORS.FRONT_Y)) });
      }
      if (this.elapsed >= entry.at) {
        entry.door = entry.door || this.pickSpawnDoor();
        entry.done = true;
        this.spawnFromDoor(entry);
      }
    });
  }

  // Дверь подальше от героини (и не та, где она прячется, и не та, что уже мигает)
  pickSpawnDoor() {
    const candidates = this.doors.filter((door) => door.blink <= 0 && !(this.hiding && this.hiding.door === door));
    const list = candidates.length ? candidates : this.doors;
    return list.reduce((best, door) => {
      const d = Phaser.Math.Distance.Between(door.x, CONFIG.DOORS.FRONT_Y, this.player.x, this.player.y);
      return d > best.d ? { door, d } : best;
    }, { door: list[0], d: -1 }).door;
  }

  spawnFromDoor(entry) {
    const x = entry.door.x;
    const y = CONFIG.DOORS.FRONT_Y;
    if (entry.role) {
      const role = CONFIG.CHASER.ROLES.find((r) => r.key === entry.role);
      this.addChaser(role, x, y);
    } else {
      this.addNpc(entry.npc, x, y);
    }
  }

  addNpc(key, x, y) {
    const npc = new Npc(this, key, x, y);
    this.npcs.push(npc);
    npc.puddleTimer = 0;
    if (npc.cfg.hitboxRadius) {
      // Бабушку приходится обходить и героине, и пациентам
      this.physics.add.collider(this.player, npc);
      this.physics.add.collider(this.chasers, npc);
    }
    this.popup(x, y - 30, npc.cfg.name, CONFIG.COLORS.PAPER);
    return npc;
  }

  updateNpcs(dt) {
    this.npcs.forEach((npc) => {
      const phrase = npc.updateNpc(dt);
      if (phrase && this.cameras.main.worldView.contains(npc.x, npc.y)) {
        this.popup(npc.x, npc.y - 30, phrase, CONFIG.COLORS.PAPER);
      }
      // Санитарка оставляет лужи
      if (npc.key === 'cleaner') {
        npc.puddleTimer -= dt;
        if (npc.puddleTimer <= 0) {
          npc.puddleTimer = npc.cfg.puddleEvery;
          this.addPuddle(npc.x, npc.y + 24);
        }
      }
    });
  }

  addPuddle(x, y) {
    const P = CONFIG.PUDDLE;
    const image = this.add.image(Math.round(x), Math.round(y), 'ui-puddle').setDepth(1);
    this.puddles.push({ x, y, ttl: P.LIFETIME, image });
    if (this.puddles.length > P.MAX) {
      this.puddles.shift().image.destroy();
    }
  }

  updatePuddles(dt) {
    this.puddles = this.puddles.filter((puddle) => {
      puddle.ttl -= dt;
      if (puddle.ttl <= 0) {
        puddle.image.destroy();
        return false;
      }
      puddle.image.setAlpha(Math.min(1, puddle.ttl / 2)); // последние 2 с — подсыхает
      return true;
    });
  }

  // Стоит ли персонаж (точка — центр спрайта, ноги на 24 px ниже) в луже
  isWet(x, y) {
    const P = CONFIG.PUDDLE;
    const feetY = y + 24;
    return this.puddles.some((puddle) => {
      const nx = (x - puddle.x) / P.RADIUS_X;
      const ny = (feetY - puddle.y) / P.RADIUS_Y;
      return nx * nx + ny * ny <= 1;
    });
  }

  // Мигание дверей перед выходом и лампочки над дверями: зелёная — можно спрятаться, красная — занято
  updateDoors(dt) {
    const D = CONFIG.DOORS;
    const g = this.doorGraphics;
    g.clear();
    this.doors.forEach((door) => {
      door.blink = Math.max(0, door.blink - dt);
      door.cooldown = Math.max(0, door.cooldown - dt);
      if (door.blink > 0 && Math.floor(door.blink * 8) % 2 === 0) {
        g.fillStyle(CONFIG.COLORS.PAPER, 0.7);
        g.fillRect(door.x - 15, D.TOP + 2, 30, D.BOTTOM - D.TOP - 2);
      }
      const busy = door.cooldown > 0 || (this.hiding && this.hiding.door === door);
      g.fillStyle(CONFIG.COLORS.INK, 1);
      g.fillRect(door.x - 7, 0, 14, 6);
      g.fillStyle(busy ? CONFIG.COLORS.STAMP : 0x6fd36f, 1);
      g.fillRect(door.x - 5, 1, 10, 4);
    });
  }

  // Укрытие: забежала в свободную дверь — 3 с в кабинете, пациенты ждут у двери
  updateHiding(dt) {
    const H = CONFIG.HIDE;
    if (this.hiding) {
      this.hiding.timer -= dt;
      this.hideText.setText(String(Math.max(1, Math.ceil(this.hiding.timer))));
      if (this.hiding.timer <= 0) {
        this.leaveCabinet();
      }
      return;
    }
    if (this.player.isDodging()) {
      return;
    }
    const door = this.doors.find((d) => d.cooldown <= 0 &&
      Math.abs(this.player.x - d.x) < H.ENTER_DISTANCE && this.player.y < CONFIG.DOORS.BOTTOM + 30);
    if (door) {
      this.enterCabinet(door);
    }
  }

  enterCabinet(door) {
    this.hiding = {
      door: door,
      timer: CONFIG.HIDE.DURATION,
      // куда идут пациенты, пока героини не видно: к двери
      proxy: { x: door.x, y: CONFIG.DOORS.FRONT_Y + 40, moveVelocity: new Phaser.Math.Vector2(0, 0) }
    };
    this.stats.hides += 1;
    this.player.moveVelocity.set(0, 0);
    this.player.body.stop();
    this.player.body.enable = false;
    this.player.setVisible(false);
    this.hideText = createText(this, door.x, CONFIG.DOORS.FRONT_Y + 10, '3', 40, CONFIG.COLORS.PAPER, { stroke: 6 }).setDepth(80);
    this.popup(door.x, CONFIG.DOORS.FRONT_Y + 40, 'кабинет ' + door.number, CONFIG.COLORS.PAPER);
    Sound.play('hide');
  }

  leaveCabinet() {
    const door = this.hiding.door;
    this.hiding = null;
    this.hideText.destroy();
    door.cooldown = CONFIG.HIDE.COOLDOWN;
    this.player.body.enable = true;
    this.player.body.reset(door.x, CONFIG.DOORS.FRONT_Y + 12);
    this.player.setVisible(true);
    this.player.invulnerableTimer = CONFIG.HIDE.INVULNERABLE_AFTER;
    Sound.play('door');
  }

  // ---------------------------------------------------------------
  // Задания на смену
  // ---------------------------------------------------------------

  missionValue(mission) {
    return mission.stat === 'time' ? Math.floor(this.elapsed) : this.stats[mission.stat];
  }

  updateMissions() {
    this.missions.forEach((mission) => {
      if (mission.done || this.missionValue(mission) < mission.goal) {
        return;
      }
      mission.done = true;
      const M = CONFIG.MISSIONS;
      this.addPoints(M.POINTS, this.player.x, this.player.y - 70, 'задание! +' + M.POINTS, CONFIG.COLORS.BONUS);
      this.popup(this.player.x, this.player.y - 110, mission.text, CONFIG.COLORS.PAPER);
      Sound.play('mission');
      Sound.vibrate([20, 30, 20]);
    });
  }

  // Комбо в панели: множитель и сколько осталось времени окна
  updateComboHud() {
    const left = CONFIG.COMBO.WINDOW - (this.elapsed - this.lastPillTime);
    if (left <= 0 && this.combo > 0) {
      this.combo = 0;
    }
    Hud.setCombo(left > 0 ? this.combo : 0, left / CONFIG.COMBO.WINDOW);
  }

  // ---------------------------------------------------------------
  // Очки: добавить и показать всплывающую надпись
  // ---------------------------------------------------------------

  addPoints(points, x, y, label, color) {
    this.extraPoints += points;
    this.popup(x, y, label, color);
  }

  // Всплывающая надпись в точке мира: поднимается и тает
  popup(x, y, text, color = CONFIG.COLORS.PAPER) {
    const label = createText(this, Math.round(x), Math.round(y - 40), text, 30, color, { stroke: 6 }).setDepth(80);
    this.tweens.add({
      targets: label,
      y: label.y - 50,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy()
    });
  }

  // «Проскочила вплотную»: пациент был совсем рядом, но не поймал
  updateNearMisses(dt) {
    const N = CONFIG.NEAR_MISS;
    if (this.hiding) {
      // В кабинете «вплотную» не считается: пациенты просто ждут у двери
      this.chasers.forEach((chaser) => { chaser.nearMissArmed = false; });
      return;
    }
    this.chasers.forEach((chaser) => {
      if (!chaser.active) {
        return;
      }
      chaser.nearMissCooldown = Math.max(0, (chaser.nearMissCooldown || 0) - dt);
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, chaser.x, chaser.y);
      if (distance < N.DISTANCE) {
        chaser.nearMissArmed = true;
      } else if (chaser.nearMissArmed && distance > N.DISTANCE + N.RELEASE) {
        chaser.nearMissArmed = false;
        if (chaser.nearMissCooldown <= 0) {
          chaser.nearMissCooldown = N.COOLDOWN;
          this.stats.nearMisses += 1;
          this.addPoints(N.POINTS, this.player.x, this.player.y, 'вплотную! +' + N.POINTS, CONFIG.COLORS.PAPER);
          Sound.play('nearMiss');
          Sound.vibrate(15);
        }
      }
    });
  }

  // ---------------------------------------------------------------
  // Столкновения с врагами и очки
  // ---------------------------------------------------------------

  onChaserTelegraph(chaser) {
    Sound.play('telegraph', { volume: Math.max(0.4, this.soundVolumeAt(chaser.x, chaser.y)) });
  }

  onChaserDash(chaser) {
    Sound.play('dash', { volume: Math.max(0.4, this.soundVolumeAt(chaser.x, chaser.y)) });
  }

  // Пациент закончил рывок рядом с героиней, но не поймал — «увернулась!»
  onChaserDashEnd(chaser, minDistance) {
    const D = CONFIG.DODGE;
    if (this.isGameOver || !(minDistance < D.DASH_DODGE_DISTANCE)) {
      return;
    }
    this.stats.dashDodges += 1;
    this.addPoints(D.DASH_DODGE_POINTS, this.player.x, this.player.y - 30, 'увернулась! +' + D.DASH_DODGE_POINTS, CONFIG.COLORS.PLAYER);
    Sound.play('nearMiss');
  }

  onChaserHitObstacle(chaser, obstacle) {
    chaser.startSliding(obstacle.getBounds());
  }

  onPlayerCaught(player, chaser) {
    if (this.isGameOver) {
      return;
    }
    // Маска спасает от одной поимки: пациент отлетает и оглушён, героиня ненадолго неуязвима
    if (this.effects.mask > 0) {
      const mask = CONFIG.PILLS.TYPES.mask;
      this.effects.mask = 0;
      player.invulnerableTimer = mask.invulnerable;
      chaser.stun(mask.stun, player.x, player.y);
      this.popup(player.x, player.y - 40, 'маска спасла!', mask.color);
      Sound.play('shield');
      Sound.vibrate(40);
      return;
    }
    this.isGameOver = true;
    this.startHint.setVisible(false); // не просвечивает сквозь экран поражения

    // Замораживаем момент поимки
    this.physics.pause();
    this.player.stop();
    this.player.setTintFill(0xffffff);
    this.chasers.forEach((chaser) => chaser.anims.pause()); // все замирают в момент поимки
    Sound.play('caught');
    Sound.vibrate([60, 40, 120]);
    Joystick.setActive(false); // палец больше не управляет персонажем

    this.events.emit('player-caught');

    // Небольшая пауза, чтобы игрок увидел, как его поймали
    this.time.delayedCall(CONFIG.CATCH_DELAY, this.finishGame, [], this);
  }

  finishGame() {
    // Что было открыто до этой смены — чтобы показать новое (форма, штамп)
    const wasOpen = Progress.unlockedNames(Progress.load());
    const isNewRecord = saveBestScore(this.score);
    const missionsDone = this.missions.filter((m) => m.done).length;
    const result = {
      score: this.score,
      seconds: this.elapsed,
      isNewRecord: isNewRecord,
      bestScore: getBestScore(),
      stats: this.stats,
      missions: this.missions,
      diagnosis: getDiagnosis(this.score),
      stamp: Progress.randomStamp()
    };
    result.unlocked = Progress.recordGame(result, missionsDone, wasOpen);
    this.events.emit('game-over', result);
  }

  // +10 за каждую полную секунду (кроме пряток) и накопленные очки за таблетки, комбо и т.д.
  updateScore() {
    const seconds = Math.floor(this.elapsed);
    const newScore = Math.floor(this.scoredTime) * CONFIG.SCORE.POINTS_PER_SECOND + this.extraPoints;

    // Сообщаем интерфейсу, только если что-то изменилось
    if (newScore !== this.score || seconds !== this.lastHudSecond) {
      this.score = newScore;
      this.lastHudSecond = seconds;
      this.events.emit('hud-update', this.score, this.elapsed);
    }
  }

  // ---------------------------------------------------------------
  // Пауза и завершение сцены
  // ---------------------------------------------------------------

  onScenePause() {
    // На паузе джойстик сброшен и не принимает ввод
    Joystick.setActive(false);
  }

  onSceneResume() {
    Joystick.setActive(true);
    if (this.input.keyboard) {
      this.input.keyboard.resetKeys(); // чтобы клавиши не «залипли»
    }
  }

  onShutdown() {
    // События сцены живут между перезапусками — снимаем свои подписки
    this.events.off('pause', this.onScenePause, this);
    this.events.off('resume', this.onSceneResume, this);
    this.events.off('chaser-telegraph', this.onChaserTelegraph, this);
    this.events.off('chaser-dash', this.onChaserDash, this);
    this.events.off('chaser-dash-end', this.onChaserDashEnd, this);
    if (this.input.keyboard) {
      this.input.keyboard.off('keydown-SPACE', this.tryDodge, this);
      this.input.keyboard.off('keydown-SHIFT', this.tryDodge, this);
    }
    Hud.onDodge = null;
    Hud.setDodge(0);
    this.scale.off('resize', this.onResize, this);
    Hud.setCombo(0, 0);
    // Уходим из игры (меню или рестарт) — джойстик прячется и сбрасывается
    Joystick.setEnabled(false);
  }
}
