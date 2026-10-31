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

    // Состояние джойстика:
    // baseX/baseY — центр базы, fingerX/fingerY — где сейчас палец,
    // x, y — итоговый вектор направления длиной 0..1
    this.joystick = { pointerId: null, baseX: 0, baseY: 0, fingerX: 0, fingerY: 0, x: 0, y: 0 };
  }

  create() {
    this.physics.resume();
    this.physics.world.setBounds(0, CONFIG.ARENA_TOP, CONFIG.WIDTH, CONFIG.ARENA_HEIGHT);

    this.createArena();
    this.createObstacles();
    this.createPlayer();
    this.createChasers();
    this.createBonus();
    this.setupCollisions();
    this.setupKeyboard();
    this.setupJoystick();
    this.createStartHint();

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
    this.updateJoystick(dt); // база плавно следует за пальцем каждый кадр
    const input = this.getMoveInput();

    this.player.move(input.x, input.y, dt);

    this.chasers.forEach((chaser) => {
      chaser.chase(this.player, this.chasers, dt, difficulty.speedMultiplier, difficulty.turnRate);
    });

    this.updateBonusLifetime(dt, difficulty.phase);
    this.updateScore();
  }

  // ---------------------------------------------------------------
  // Создание мира
  // ---------------------------------------------------------------

  createArena() {
    const graphics = this.add.graphics();
    const top = CONFIG.ARENA_TOP;

    graphics.fillStyle(CONFIG.COLORS.ARENA, 1);
    graphics.fillRect(0, top, CONFIG.WIDTH, CONFIG.ARENA_HEIGHT);

    // Слабая сетка — чтобы было видно движение
    graphics.lineStyle(1, CONFIG.COLORS.GRID, 0.06);
    for (let x = 0; x <= CONFIG.WIDTH; x += 80) {
      graphics.lineBetween(x, top, x, CONFIG.HEIGHT);
    }
    for (let y = top; y <= CONFIG.HEIGHT; y += 80) {
      graphics.lineBetween(0, y, CONFIG.WIDTH, y);
    }

    // Рамка арены
    graphics.lineStyle(3, CONFIG.COLORS.GRID, 0.4);
    graphics.strokeRect(1.5, top + 1.5, CONFIG.WIDTH - 3, CONFIG.ARENA_HEIGHT - 3);
  }

  createObstacles() {
    // Статичная группа: тела не двигаются и непроходимы
    this.obstacles = this.physics.add.staticGroup();

    CONFIG.OBSTACLES.forEach((item) => {
      // Нижняя безопасная зона должна оставаться свободной для пальца
      if (item.y + item.h / 2 > CONFIG.BOTTOM_SAFE_ZONE_TOP) {
        console.warn('Препятствие заходит в нижнюю безопасную зону и пропущено:', item);
        return;
      }
      const rect = this.add.rectangle(item.x, item.y, item.w, item.h, CONFIG.COLORS.OBSTACLE_FILL);
      rect.setStrokeStyle(3, CONFIG.COLORS.OBSTACLE_STROKE);
      this.obstacles.add(rect);
    });
  }

  createPlayer() {
    this.player = new Player(this, CONFIG.PLAYER.START.x, CONFIG.PLAYER.START.y);
  }

  createChasers() {
    // Обычный массив: Phaser-коллайдеры умеют работать с массивами
    this.chasers = CONFIG.CHASER.STARTS.map((start, index) => {
      return new Chaser(this, start.x, start.y, CONFIG.CHASER.SPEED_FACTORS[index]);
    });
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

  setupJoystick() {
    // Джойстик запускается по всей арене ниже HUD
    this.joystickZoneTop = CONFIG.ARENA_TOP;
    this.joystickGraphics = this.add.graphics().setDepth(100);

    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);
  }

  createStartHint() {
    this.startHint = createText(
      this,
      CONFIG.WIDTH / 2,
      CONFIG.BOTTOM_SAFE_ZONE_TOP - 140,
      'Коснись арены в любом месте\nи тяни пальцем',
      36,
      CONFIG.COLORS.TEXT_DIM
    ).setAlpha(0.8).setDepth(50);
  }

  // Касание рядом с кнопкой паузы не должно двигать персонажа
  isInPauseSafeZone(x, y) {
    const zone = CONFIG.JOYSTICK.PAUSE_SAFE_ZONE;
    return x >= zone.left && y <= zone.bottom;
  }

  onPointerDown(pointer) {
    // Второй палец игнорируем, пока первый держит джойстик
    if (this.isGameOver || this.joystick.pointerId !== null) {
      return;
    }
    // HUD и область у паузы не запускают джойстик.
    // Нажатия на кнопки UIScene сюда вообще не доходят: сцена интерфейса выше,
    // и Phaser (input.topOnly) останавливает событие на нажатой кнопке.
    if (pointer.y <= this.joystickZoneTop || this.isInPauseSafeZone(pointer.x, pointer.y)) {
      return;
    }

    // База появляется точно под пальцем — касание само по себе не даёт движения
    this.joystick.pointerId = pointer.id;
    this.joystick.baseX = pointer.x;
    this.joystick.baseY = pointer.y;
    this.joystick.fingerX = pointer.x;
    this.joystick.fingerY = pointer.y;
    this.updateJoystick(0);
  }

  onPointerMove(pointer) {
    if (pointer.id !== this.joystick.pointerId) {
      return;
    }
    // Только запоминаем палец; расчёт идёт в updateJoystick каждый кадр,
    // поэтому база продолжает догонять палец, даже если он замер
    this.joystick.fingerX = pointer.x;
    this.joystick.fingerY = pointer.y;
  }

  onPointerUp(pointer) {
    if (pointer.id !== this.joystick.pointerId) {
      return;
    }
    this.resetJoystick();
  }

  // Плавающий джойстик: считает вектор движения и двигает базу за пальцем
  updateJoystick(dt) {
    const js = this.joystick;
    if (js.pointerId === null) {
      return;
    }

    const radius = CONFIG.JOYSTICK.RADIUS;
    const deadZone = CONFIG.JOYSTICK.DEAD_ZONE;
    let dx = js.fingerX - js.baseX;
    let dy = js.fingerY - js.baseY;
    let distance = Math.hypot(dx, dy);

    // 1. Палец ушёл дальше радиуса — база плавно подтягивается к нему,
    //    стремясь остаться ровно на расстоянии RADIUS (без телепорта)
    if (distance > radius) {
      const targetX = js.fingerX - (dx / distance) * radius;
      const targetY = js.fingerY - (dy / distance) * radius;
      const k = 1 - Math.exp(-CONFIG.JOYSTICK.FOLLOW_SPEED * dt);
      js.baseX += (targetX - js.baseX) * k;
      js.baseY += (targetY - js.baseY) * k;

      // Направление считаем уже от нового центра базы
      dx = js.fingerX - js.baseX;
      dy = js.fingerY - js.baseY;
      distance = Math.hypot(dx, dy);
    }

    // 2. Сила отклонения 0..1 (физический радиус — 100 px)
    const clamped = Math.min(distance, radius);
    const strength = clamped / radius;

    if (distance < 0.001 || strength < deadZone) {
      js.x = 0;
      js.y = 0;
    } else {
      // Сразу за мёртвой зоной сила начинается с нуля
      const power = (strength - deadZone) / (1 - deadZone);
      js.x = (dx / distance) * power;
      js.y = (dy / distance) * power;
    }

    // 3. Рисуем: ручка смещается в пределах ВИЗУАЛЬНОГО радиуса базы
    const visualOffset = strength * CONFIG.JOYSTICK.VISUAL_RADIUS;
    const knobX = distance > 0.001 ? js.baseX + (dx / distance) * visualOffset : js.baseX;
    const knobY = distance > 0.001 ? js.baseY + (dy / distance) * visualOffset : js.baseY;
    const isMoving = js.x !== 0 || js.y !== 0;
    this.drawJoystick(knobX, knobY, isMoving);
  }

  drawJoystick(knobX, knobY, isMoving) {
    const graphics = this.joystickGraphics;
    const visualRadius = CONFIG.JOYSTICK.VISUAL_RADIUS;
    graphics.clear();

    // Во время движения джойстик полупрозрачнее, чтобы не закрывать игру
    graphics.setAlpha(isMoving ? CONFIG.JOYSTICK.ACTIVE_ALPHA : 1);

    graphics.fillStyle(0xffffff, 0.06);
    graphics.fillCircle(this.joystick.baseX, this.joystick.baseY, visualRadius);
    graphics.lineStyle(4, 0xffffff, 0.35);
    graphics.strokeCircle(this.joystick.baseX, this.joystick.baseY, visualRadius);

    graphics.fillStyle(CONFIG.COLORS.PLAYER, 0.55);
    graphics.fillCircle(knobX, knobY, CONFIG.JOYSTICK.KNOB_RADIUS);
  }

  resetJoystick() {
    this.joystick.pointerId = null;
    this.joystick.x = 0;
    this.joystick.y = 0;
    if (this.joystickGraphics) {
      this.joystickGraphics.clear();
    }
  }

  // Итоговое направление движения: джойстик важнее клавиатуры
  getMoveInput() {
    let x = 0;
    let y = 0;

    if (this.joystick.pointerId !== null) {
      x = this.joystick.x;
      y = this.joystick.y;
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

  // Возвращает фазу, множитель скорости врагов и их манёвренность
  getDifficulty(t) {
    const D = CONFIG.DIFFICULTY;

    // Фаза 1: базовая скорость
    if (t < D.PHASE2_START) {
      return { phase: 1, speedMultiplier: 1, turnRate: D.TURN_RATE_BASE };
    }

    // Фаза 2: скорость и манёвренность плавно растут
    if (t < D.PHASE3_START) {
      const progress = (t - D.PHASE2_START) / (D.PHASE3_START - D.PHASE2_START);
      return {
        phase: 2,
        speedMultiplier: Phaser.Math.Linear(1, D.PHASE2_END_MULTIPLIER, progress),
        turnRate: Phaser.Math.Linear(D.TURN_RATE_BASE, D.TURN_RATE_MAX, progress)
      };
    }

    // Фаза 3: самый быстрый враг догоняет скорость игрока и чуть превышает её
    const progress = Math.min(1, (t - D.PHASE3_START) / D.PHASE3_RAMP_TIME);
    return {
      phase: 3,
      speedMultiplier: Phaser.Math.Linear(D.PHASE2_END_MULTIPLIER, D.PHASE3_MAX_MULTIPLIER, progress),
      turnRate: D.TURN_RATE_MAX
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
    const maxX = CONFIG.WIDTH - B.EDGE_MARGIN;
    const minY = CONFIG.ARENA_TOP + B.EDGE_MARGIN;
    const maxY = CONFIG.HEIGHT - B.EDGE_MARGIN;

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
    chaser.startSliding(obstacle.getBounds(), this.player);
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
    this.resetJoystick();

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
    // Палец могут отпустить, пока игра на паузе, — сбрасываем джойстик заранее
    this.resetJoystick();
  }

  onSceneResume() {
    this.resetJoystick();
    if (this.input.keyboard) {
      this.input.keyboard.resetKeys(); // чтобы клавиши не «залипли»
    }
  }

  onShutdown() {
    // События сцены живут между перезапусками — снимаем свои подписки
    this.events.off('pause', this.onScenePause, this);
    this.events.off('resume', this.onSceneResume, this);
    this.input.off('pointerdown', this.onPointerDown, this);
    this.input.off('pointermove', this.onPointerMove, this);
    this.input.off('pointerup', this.onPointerUp, this);
    this.input.off('pointerupoutside', this.onPointerUp, this);
  }
}
