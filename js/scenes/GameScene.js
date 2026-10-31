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
    this.score = 0;
    this.bonusesCollected = 0;
    this.lastHudSecond = -1;
    this.isGameOver = false;
    this.hasMoved = false;       // двигался ли игрок (для подсказки)
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

    // Фиксированный джойстик в нижней панели (js/utils/joystick.js)
    Joystick.setEnabled(true);

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

    const difficulty = this.getDifficulty(this.elapsed);
    const input = this.getMoveInput();

    this.player.move(input.x, input.y, dt);

    // Общие данные кадра для всех врагов
    const ctx = {
      dt: dt,
      player: this.player,
      chasers: this.chasers,
      bonus: this.bonus,
      obstacleRects: this.obstacleRects,
      speedMultiplier: difficulty.speedMultiplier,
      turnProgress: difficulty.turnProgress,
      dashInterval: difficulty.dashInterval,
      // Рывок одновременно делает только один враг — так честнее и предсказуемее
      dashBusy: this.chasers.some((chaser) => chaser.isDashBusy())
    };
    this.chasers.forEach((chaser) => {
      chaser.updateChaser(ctx);
      ctx.dashBusy = ctx.dashBusy || chaser.isDashBusy();
    });

    this.updateBonusLifetime(dt, difficulty.phase);
    this.updateScore();
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

  // Камера показывает часть поля под HUD и следует за игроком, не выходя за края поля
  setupCamera() {
    const camera = this.cameras.main;
    camera.setViewport(0, CONFIG.VIEW_TOP, CONFIG.WIDTH, CONFIG.VIEW_HEIGHT);
    camera.setBounds(0, 0, CONFIG.ARENA.WIDTH, CONFIG.ARENA.HEIGHT);
    camera.startFollow(this.player, true, 0.15, 0.15);
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
  }

  createChasers() {
    // Обычный массив: Phaser-коллайдеры умеют работать с массивами
    // Три врага с разными ролями: Охотник, Перехватчик, Тяжёлый загонщик
    this.chasers = CONFIG.CHASER.ROLES.map((role) => new Chaser(this, role));
  }

  createBonus() {
    this.bonus = new Bonus(this);
  }

  setupCollisions() {
    // Игрок и враги не проходят сквозь препятствия
    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.chasers, this.obstacles, this.onChaserHitObstacle, null, this);

    // Поимка игрока
    this.physics.add.overlap(this.player, this.chasers, this.onPlayerCaught, null, this);

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
  }

  createStartHint() {
    this.startHint = createText(
      this,
      CONFIG.WIDTH / 2,
      870, // координаты окна камеры (не мира): над игроком в начале игры
      'Управляй джойстиком внизу экрана',
      32,
      CONFIG.COLORS.TEXT_DIM
    ).setAlpha(0.8).setDepth(50).setScrollFactor(0); // не уезжает вместе с камерой
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
    this.bonus.spawn(position.x, position.y);
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
    bonus.hide();
    this.bonusesCollected += 1;
    this.updateScore();
    this.scheduleBonus(CONFIG.BONUS.RESPAWN_DELAY);
  }

  // ---------------------------------------------------------------
  // Столкновения с врагами и очки
  // ---------------------------------------------------------------

  onChaserHitObstacle(chaser, obstacle) {
    chaser.startSliding(obstacle.getBounds());
  }

  onPlayerCaught(player, chaser) {
    if (this.isGameOver) {
      return;
    }
    this.isGameOver = true;

    // Замораживаем момент поимки
    this.physics.pause();
    this.player.stop();
    this.player.setTintFill(0xffffff);
    Joystick.setActive(false); // палец больше не управляет персонажем

    this.events.emit('player-caught');

    // Небольшая пауза, чтобы игрок увидел, как его поймали
    this.time.delayedCall(CONFIG.CATCH_DELAY, this.finishGame, [], this);
  }

  finishGame() {
    const isNewRecord = saveBestScore(this.score);
    this.events.emit('game-over', {
      score: this.score,
      seconds: this.elapsed,
      isNewRecord: isNewRecord,
      bestScore: getBestScore()
    });
  }

  // +10 за каждую полную секунду и +100 за каждый бонус
  updateScore() {
    const seconds = Math.floor(this.elapsed);
    const newScore = seconds * CONFIG.SCORE.POINTS_PER_SECOND +
      this.bonusesCollected * CONFIG.BONUS.POINTS;

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
    // Уходим из игры (меню или рестарт) — джойстик прячется и сбрасывается
    Joystick.setEnabled(false);
  }
}
