// =============================================================
// Режим «Смена» (рогалик) — дополнение к GameScene.
//
// Смена = забег по этажам поликлиники (CONFIG.RUN.FLOORS). У каждого этажа своя
// раскладка мебели (js/layouts.js, иногда отражённая) и задача:
//   «Медкарты» — подбери карту и отнеси в подсвеченный кабинет (несколько раз);
//   «Анализы»  — собери пробирки по этажу и сдай в лабораторию;
//   «Обход»    — продержись, пока идёт обход (в кабинете таймер не идёт).
// Задача выполнена — открываются ДВЕ лестницы: обычная и рискованная (с особенностью
// следующего этажа: «Отключили свет», «Комиссия», «Ремонт»…). Рискованный этаж
// даёт больше очков и 4 усиления на выбор вместо 3. Добежала до лестницы — этаж
// пройден, в ординаторской выбираешь усиление.
// У героини 3 сердечка на всю смену. Лечат аптечка (иногда лежит на этаже)
// и процедурный кабинет (дверь с красным крестом, один раз за этаж).
//
// Состояние смены между этажами хранится в registry ('run'): этаж, задача,
// раскладка, особенность, сердечка, усиления, очки и статистика.
// Каждый этаж — это новый запуск GameScene.
// Методы ниже добавляются в GameScene (Object.assign в конце файла).
// =============================================================

const Run = {
  // Новая смена: этаж 1, полные сердечка, без усилений
  start(registry) {
    registry.set('mode', 'run');
    const run = {
      floor: 1,
      hearts: CONFIG.RUN.HEARTS,
      maxHearts: CONFIG.RUN.HEARTS,
      perks: {},
      scoredTime: 0,
      extraPoints: 0,
      time: 0,
      stats: null,
      missionsDone: [],
      task: null,
      nextModifier: null
    };
    Run.prepareFloor(run);
    registry.set('run', run);
  },

  // Задача, раскладка и особенность для текущего этажа run.floor
  prepareFloor(run) {
    const floor = CONFIG.RUN.FLOORS[run.floor - 1];
    run.layout = floor.layout;
    run.mirror = Math.random() < 0.5;
    const tasks = Object.keys(CONFIG.RUN.TASKS).filter((key) => key !== run.task);
    run.task = run.floor === 1 ? 'cards' : Phaser.Utils.Array.GetRandom(tasks);
    run.modifier = run.nextModifier || null;
    run.nextModifier = null;
  },

  perkCount(run, key) {
    return run.perks[key] || 0;
  },

  // Разные усиления на выбор (уже взятые «одноразовые» не предлагаются)
  rollPerks(run, count = 3) {
    const pool = CONFIG.PERKS.filter((perk) => perk.stack || !run.perks[perk.key]);
    return Phaser.Utils.Array.Shuffle(pool.slice()).slice(0, count);
  },

  // Расписание выхода пациентов на этаже: чем выше этаж, тем раньше и больше.
  // Особенности этажа добавляют своё (эпидемия, уборка, час пик)
  spawns(floor, modifier, level) {
    const list = [
      { role: 'hunter', at: 2 },
      { role: 'interceptor', at: Math.max(3, 7 - floor) },
      { role: 'heavy', at: Math.max(5, 13 - floor * 1.5) },
      { npc: 'cleaner', at: 20 }
    ];
    if (floor >= 2) list.push({ role: 'hunter', at: Math.max(12, 36 - floor * 4) });
    if (floor >= 3) list.push({ npc: 'granny', at: 15 }, { role: 'interceptor', at: Math.max(20, 48 - floor * 4) });
    if (floor >= 4) list.push({ role: 'heavy', at: 30 });
    if (floor >= 5) list.push({ role: 'hunter', at: 22 });
    if (modifier === 'epidemic') {
      list.push({ role: 'hunter', at: 5 }, { role: 'interceptor', at: 9 }, { role: 'heavy', at: 14 }, { role: 'hunter', at: 26 });
    }
    if (modifier === 'cleaning') {
      // Две санитарки сразу, и мокро вдвое чаще
      list[3].at = 3;
      list.push({ npc: 'cleaner', at: 10 });
    }
    if (modifier === 'rush') {
      // Бабушки не стоят в очереди, а бродят по кругу коридоров — их приходится обходить
      [4, 10, 17].forEach((at) => list.push({ npc: 'granny', at: at, wander: true }));
    }
    return list;
  }
};

const RunMode = {
  // ---------------------------------------------------------------
  // Подготовка этажа (вызывается из init и create сцены)
  // ---------------------------------------------------------------

  initRun() {
    if (!this.registry.get('run')) {
      Run.start(this.registry);
    }
    this.run = this.registry.get('run');
    const R = CONFIG.RUN;
    this.floorInfo = R.FLOORS[Math.min(this.run.floor, R.FLOORS.length) - 1];
    this.task = this.run.task;
    this.modifier = this.run.modifier;
    this.pointsMul = this.modifier === 'commission' ? R.MODIFIERS.commission.points : 1;

    this.carrying = false;      // медкарта или пробирки «в руках»
    this.targetDoor = null;     // куда нести
    this.delivered = 0;         // сколько медкарт сдано
    this.tubes = [];            // пробирки на этаже («Анализы»)
    this.collected = 0;
    this.roundLeft = this.task === 'round' ? R.TASKS.round.time + R.TASKS.round.timePerFloor * (this.run.floor - 1) : 0;
    this.stairs = [];           // открытые лестницы
    this.stairsOpen = false;
    this.floorDone = false;
    this.procedureUsed = false;
    this.medkitTime = Phaser.Math.FloatBetween(R.MEDKIT_AT[0], R.MEDKIT_AT[1]);
    this.medkit = null;

    // Очки, статистика и задания продолжаются с прошлого этажа
    this.scoredTime = this.run.scoredTime;
    this.extraPoints = this.run.extraPoints;
    if (this.run.stats) {
      this.stats = Object.assign({}, this.run.stats);
    }
    this.missions.forEach((mission) => {
      mission.done = this.run.missionsDone.includes(mission.id);
    });
    this.spawnQueue = Run.spawns(this.run.floor, this.modifier).map((entry) => Object.assign({ door: null, done: false }, entry));
  },

  createRun() {
    // Двери: одна — процедурная (лечит), остальные — кабинеты для медкарт и лаборатория
    this.procedureDoor = Phaser.Utils.Array.GetRandom(this.doors);

    // Медкарта, карта/пробирки «в руках», стрелка к цели, подсветка
    this.cardItem = this.add.image(0, 0, 'ui-medcard').setScale(2).setDepth(5).setVisible(false);
    this.tweens.add({ targets: this.cardItem, scale: 2.3, duration: 450, yoyo: true, repeat: -1 });
    this.carriedCard = this.add.image(0, 0, this.task === 'tests' ? 'ui-tube' : 'ui-medcard').setDepth(12).setVisible(false);
    this.goalArrow = this.add.image(0, 0, 'ui-arrow').setScrollFactor(0).setDepth(91).setVisible(false);

    // Особенности этажа: санитарки моют чаще, бабушки бродят по кругу
    if (this.modifier === 'cleaning') {
      this.level.npc.cleaner = Object.assign({}, this.level.npc.cleaner, { puddleEvery: 0.5 });
    }
    if (this.modifier === 'rush') {
      const wander = { approach: [], path: this.level.npc.cleaner.path };
      this.spawnQueue.forEach((entry) => {
        if (entry.wander) {
          entry.route = wander;
        }
      });
    }

    // Усиления
    const P = this.run.perks;
    this.player.dodgeCooldownMax = CONFIG.DODGE.COOLDOWN * Math.pow(0.7, P.quickDodge || 0);
    this.player.dodgeDuration = CONFIG.DODGE.DURATION * (P.longDodge ? 1.5 : 1);
    if (P.secondWind) {
      this.effects.mask = 30; // маска на первые 30 секунд этажа
    }
    // Шприц: уворот сквозь пациента оглушает его
    this.physics.add.overlap(this.player, this.chasers, (player, chaser) => this.onSyringeHit(chaser),
      (player, chaser) => P.syringe && player.isDodging() && !(chaser.stunTimer > 0), this);

    if (this.task === 'cards') {
      this.placeCard();
    } else if (this.task === 'tests') {
      this.placeTubes();
    }
    this.updateRunHud();
  },

  // Сложность: каждый этаж «начинается» позже, «Комиссия» и открытая лестница — ещё сложнее
  runDifficultyShift() {
    const R = CONFIG.RUN;
    return (this.run.floor - 1) * R.FLOOR_TIME_SHIFT +
      (this.modifier === 'commission' ? R.MODIFIERS.commission.timeShift : 0) +
      (this.stairsOpen ? R.ENRAGE_TIME : 0);
  },

  // Время всей смены (для заданий и экрана поражения)
  runTotalTime() {
    return this.run.time + this.elapsed;
  },

  // Кабинет, куда нести (любой, кроме процедурного)
  pickTargetDoor() {
    const doors = this.doors.filter((door) => door !== this.procedureDoor);
    return Phaser.Utils.Array.GetRandom(doors);
  },

  // Из мест spots — случайное среди двух самых дальних от героини
  farSpot(spots) {
    const sorted = spots.slice().sort((a, b) =>
      Phaser.Math.Distance.Between(b[0], b[1], this.player.x, this.player.y) -
      Phaser.Math.Distance.Between(a[0], a[1], this.player.x, this.player.y));
    return sorted[Phaser.Math.Between(0, 1)];
  },

  // ---------------------------------------------------------------
  // «Медкарты»
  // ---------------------------------------------------------------

  placeCard() {
    const [x, y] = this.farSpot(this.level.cardSpots);
    this.cardItem.setPosition(x, y).setVisible(true);
    this.targetDoor = null;
  },

  pickUpCard() {
    this.carrying = true;
    this.cardItem.setVisible(false);
    this.targetDoor = this.pickTargetDoor();
    this.popup(this.player.x, this.player.y - 40, 'медкарта → ' + this.targetDoor.number, CONFIG.COLORS.PAPER);
    Sound.play('pill');
    this.updateRunHud();
  },

  // ---------------------------------------------------------------
  // «Анализы»
  // ---------------------------------------------------------------

  placeTubes() {
    const spots = Phaser.Utils.Array.Shuffle(this.level.testSpots.slice()).slice(0, this.floorInfo.count);
    this.tubes = spots.map(([x, y]) => {
      const tube = this.add.image(x, y, 'ui-tube').setScale(1.5).setDepth(5);
      this.tweens.add({ targets: tube, y: y - 6, duration: 500, yoyo: true, repeat: -1 });
      return tube;
    });
  },

  pickUpTube(tube) {
    this.tubes = this.tubes.filter((t) => t !== tube);
    tube.destroy();
    this.collected += 1;
    Sound.play('pill');
    if (!this.tubes.length) {
      // Все пробирки — неси в лабораторию
      this.carrying = true;
      this.targetDoor = this.pickTargetDoor();
      this.popup(this.player.x, this.player.y - 40, 'анализы → лаборатория ' + this.targetDoor.number, CONFIG.COLORS.PAPER);
    } else {
      this.popup(this.player.x, this.player.y - 40, 'пробирка ' + this.collected + '/' + this.floorInfo.count, CONFIG.COLORS.PAPER);
    }
    this.updateRunHud();
  },

  // Медкарта или анализы сданы в кабинет
  deliver() {
    const R = CONFIG.RUN;
    const door = this.targetDoor;
    this.carrying = false;
    this.targetDoor = null;
    // Кабинет пару секунд «занят» (принимают) — героиня не прячется в нём сразу после сдачи
    door.cooldown = Math.max(door.cooldown, 2);
    Sound.play('door');
    Sound.play('powerup');
    if (this.task === 'tests') {
      this.addPoints(R.CARD_POINTS * 2, door.x, CONFIG.DOORS.FRONT_Y + 60, 'анализы сданы! +' + R.CARD_POINTS * 2, CONFIG.COLORS.BONUS);
      this.openStairs();
    } else {
      this.delivered += 1;
      this.stats.cards = (this.stats.cards || 0) + 1;
      this.addPoints(R.CARD_POINTS, door.x, CONFIG.DOORS.FRONT_Y + 60, 'карта сдана! +' + R.CARD_POINTS, CONFIG.COLORS.BONUS);
      if (this.delivered >= this.floorInfo.count) {
        this.openStairs();
      } else {
        this.placeCard();
      }
    }
    this.updateRunHud();
  },

  // Возле двери (как для пряток): по x рядом с дверью и у самой стены
  isAtDoor(door) {
    return Math.abs(this.player.x - door.x) < CONFIG.HIDE.ENTER_DISTANCE && this.player.y < CONFIG.DOORS.BOTTOM + 30;
  },

  // ---------------------------------------------------------------
  // Лестницы: обычная и рискованная (особенность следующего этажа)
  // ---------------------------------------------------------------

  openStairs() {
    const R = CONFIG.RUN;
    const last = this.run.floor >= R.FLOORS.length;
    // Два самых дальних места (на последнем этаже — одна лестница к выходу)
    const spots = this.level.stairsSpots.slice().sort((a, b) =>
      Phaser.Math.Distance.Between(b[0], b[1], this.player.x, this.player.y) -
      Phaser.Math.Distance.Between(a[0], a[1], this.player.x, this.player.y)).slice(0, last ? 1 : 2);
    const risky = Phaser.Utils.Array.GetRandom(Object.keys(R.MODIFIERS).filter((key) => key !== this.modifier));
    const variants = last ? [null] : Phaser.Utils.Array.Shuffle([null, risky]);
    this.stairs = spots.map(([x, y], i) => {
      const modifier = variants[i];
      const image = this.add.image(x, y, 'ui-stairs').setDepth(5).setAlpha(0);
      this.tweens.add({ targets: image, alpha: 1, duration: 400 });
      const text = last ? 'ВЫХОД' : (modifier ? R.MODIFIERS[modifier].name.toUpperCase() + ' ★' : 'ОБЫЧНЫЙ ЭТАЖ');
      const label = createText(this, x, y - 70, text, 22, modifier ? CONFIG.COLORS.BONUS : CONFIG.COLORS.PAPER, { stroke: 6 })
        .setDepth(60);
      if (x - label.width / 2 < 10) label.setX(10 + label.width / 2);
      if (x + label.width / 2 > CONFIG.ARENA.WIDTH - 10) label.setX(CONFIG.ARENA.WIDTH - 10 - label.width / 2);
      return { x, y, image, label, modifier };
    });
    this.stairsOpen = true;
    this.popup(this.player.x, this.player.y - 60, last ? 'выход открыт!' : 'лестницы открыты!', CONFIG.COLORS.BONUS);
    this.popup(this.player.x, this.player.y - 100, 'пациенты звереют!', CONFIG.COLORS.STAMP);
    Sound.play('mission');
    Sound.vibrate([30, 40, 30]);
  },

  // Этаж пройден: всё замирает, очки за этаж, дальше — ординаторская (или конец смены)
  clearFloor(stairs) {
    const R = CONFIG.RUN;
    this.floorDone = true;
    this.isGameOver = true; // останавливает обновление этажа
    this.physics.pause();
    this.player.stop();
    this.chasers.forEach((chaser) => chaser.anims.pause());
    Joystick.setActive(false);
    this.startHint.setVisible(false);
    this.goalArrow.setVisible(false);
    // Рискованный этаж (с особенностью) — в 1.5 раза больше очков
    const points = Math.round(R.FLOOR_POINTS * this.run.floor * (this.modifier ? R.RISK_FLOOR_BONUS : 1));
    this.addPoints(points, this.player.x, this.player.y - 40, 'этаж пройден! +' + points, CONFIG.COLORS.BONUS);
    this.updateScore();
    Sound.play('mission');
    this.run.nextModifier = stairs.modifier;
    this.saveRunState();

    const last = this.run.floor >= R.FLOORS.length;
    if (last) {
      this.time.delayedCall(700, () => this.finishGame(true), [], this);
    } else {
      this.time.delayedCall(700, () => this.events.emit('floor-cleared', {
        floor: this.run.floor,
        risky: !!this.modifier,
        nextModifier: stairs.modifier,
        perks: Run.rollPerks(this.run, this.modifier ? R.RISK_PERKS : 3)
      }), [], this);
    }
  },

  // Перед переходом на следующий этаж или в конце смены
  saveRunState() {
    this.run.scoredTime = this.scoredTime;
    this.run.extraPoints = this.extraPoints;
    this.run.time += this.elapsed;
    this.elapsed = 0;
    this.run.stats = Object.assign({}, this.stats);
    this.run.missionsDone = this.missions.filter((m) => m.done).map((m) => m.id);
    this.run.score = this.score;
  },

  // Выбрано усиление в ординаторской — следующий этаж (вызывает UIScene)
  applyPerkAndNextFloor(key) {
    const run = this.run;
    const R = CONFIG.RUN;
    run.perks[key] = (run.perks[key] || 0) + 1;
    if (key === 'strongHealth') {
      run.maxHearts = Math.min(R.MAX_HEARTS, run.maxHearts + 1);
      run.hearts = Math.min(run.maxHearts, run.hearts + 1);
    }
    if (run.perks.vitamins) {
      run.hearts = Math.min(run.maxHearts, run.hearts + 1);
    }
    run.floor += 1;
    Run.prepareFloor(run);
    this.registry.set('run', run);
  },

  // ---------------------------------------------------------------
  // Здоровье
  // ---------------------------------------------------------------

  // Пациент коснулся: минус сердечко, пациента отбрасывает, героиня ненадолго неуязвима
  loseHeart(chaser) {
    const R = CONFIG.RUN;
    this.run.hearts -= 1;
    this.player.invulnerableTimer = R.HIT_INVULNERABLE;
    chaser.stun(R.HIT_STUN, this.player.x, this.player.y);
    this.cameras.main.shake(180, 0.008);
    this.cameras.main.flash(120, 120, 20, 24);
    this.popup(this.player.x, this.player.y - 40, 'ой! -1 сердечко', CONFIG.COLORS.STAMP);
    Sound.play('hit');
    Sound.vibrate([40, 30, 40]);
    this.updateRunHud();
  },

  heal(text) {
    this.run.hearts = Math.min(this.run.maxHearts, this.run.hearts + 1);
    this.popup(this.player.x, this.player.y - 50, text + ' +1 сердечко', 0xff8a8a);
    Sound.play('heal');
    this.updateRunHud();
  },

  // Шприц: уворот сквозь пациента — пациент оглушён
  onSyringeHit(chaser) {
    chaser.stun(1.5, this.player.x, this.player.y);
    this.addPoints(50, chaser.x, chaser.y - 30, 'укол! +50', CONFIG.COLORS.PLAYER);
    Sound.play('shield');
  },

  // ---------------------------------------------------------------
  // Каждый кадр
  // ---------------------------------------------------------------

  updateRun(dt) {
    const R = CONFIG.RUN;
    const P = this.run.perks;
    const player = this.player;
    const near = (x, y, d) => Phaser.Math.Distance.Between(player.x, player.y, x, y) < d;

    // Кроссовки и курьер
    this.player.perkSpeed = Math.pow(1.08, P.sneakers || 0) * (this.carrying && P.courier ? 1.2 : 1);

    if (!this.hiding) {
      // Медкарта / пробирки
      if (this.task === 'cards' && !this.carrying && this.cardItem.visible && near(this.cardItem.x, this.cardItem.y, R.PICKUP_DISTANCE)) {
        this.pickUpCard();
      }
      if (this.task === 'tests') {
        const tube = this.tubes.find((t) => near(t.x, t.y, R.PICKUP_DISTANCE));
        if (tube) {
          this.pickUpTube(tube);
        }
      }
      // Сдать в нужный кабинет (даже если он «занят» после пряток)
      if (this.carrying && this.targetDoor && this.isAtDoor(this.targetDoor)) {
        this.deliver();
      }
      // «Обход»: время идёт, только пока героиня на виду
      if (this.task === 'round' && !this.stairsOpen) {
        this.roundLeft -= dt;
        if (this.roundLeft <= 0) {
          this.popup(player.x, player.y - 140, 'обход закончен!', CONFIG.COLORS.BONUS);
          this.openStairs();
        }
        this.updateRunHud();
      }
      // Лестница
      const stairs = this.stairs.find((s) => near(s.x, s.y, R.STAIRS_DISTANCE));
      if (stairs) {
        this.clearFloor(stairs);
        return;
      }
      // Аптечка
      if (this.medkit && near(this.medkit.x, this.medkit.y, R.MEDKIT_DISTANCE)) {
        this.medkit.destroy();
        this.medkit = null;
        this.heal('аптечка!');
      }
    }

    // Аптечка появляется один раз за этаж, если сердечек не хватает
    if (this.medkitTime !== null && this.elapsed >= this.medkitTime) {
      this.medkitTime = null;
      if (this.run.hearts < this.run.maxHearts) {
        const pos = this.findBonusPosition();
        this.medkit = this.add.image(pos.x, pos.y, 'ui-medkit').setDepth(5);
        this.tweens.add({ targets: this.medkit, y: pos.y - 6, duration: 500, yoyo: true, repeat: -1 });
        this.popup(pos.x, pos.y - 30, 'аптечка', 0xff8a8a);
      }
    }

    // Магнит: таблетка сама летит к героине
    if (P.magnet && this.bonus.active) {
      const d = Phaser.Math.Distance.Between(player.x, player.y, this.bonus.x, this.bonus.y);
      if (d < 260 && d > 1) {
        const step = Math.min(d, 320 * dt);
        this.bonus.body.reset(this.bonus.x + (player.x - this.bonus.x) / d * step, this.bonus.y + (player.y - this.bonus.y) / d * step);
      }
    }

    // Карта или пробирки «в руках» — над головой героини
    this.carriedCard.setVisible(this.carrying && !this.hiding).setPosition(player.x, player.y - 46);
  },

  // Процедурный кабинет: вместо пряток — «укол» и +1 сердечко (раз за этаж)
  tryProcedure(door) {
    if (door !== this.procedureDoor || this.procedureUsed || this.run.hearts >= this.run.maxHearts) {
      return false;
    }
    this.procedureUsed = true;
    this.enterCabinet(door);
    this.hiding.heal = true;
    this.hiding.timer = CONFIG.RUN.PROCEDURE_TIME;
    this.popup(door.x, CONFIG.DOORS.FRONT_Y + 80, 'процедурная: укол', 0xff8a8a);
    return true;
  },

  // Подсветка: куда нести (мигающая рамка), процедурная (красный крест), лестницы
  drawRunDoors(g) {
    const D = CONFIG.DOORS;
    if (this.targetDoor && Math.floor(this.time.now / 250) % 2 === 0) {
      g.lineStyle(4, CONFIG.COLORS.BONUS, 1);
      g.strokeRect(this.targetDoor.x - 19, D.TOP - 2, 38, D.BOTTOM - D.TOP + 6);
    }
    const door = this.procedureDoor;
    if (door) {
      g.fillStyle(CONFIG.COLORS.PAPER, 1);
      g.fillRect(door.x + 18, 8, 16, 16);
      g.fillStyle(this.procedureUsed ? 0x777777 : 0xc4282e, 1);
      g.fillRect(door.x + 24, 10, 4, 12);
      g.fillRect(door.x + 20, 14, 12, 4);
    }
    // Пульсирующий ободок вокруг лестниц (рискованная — жёлтым)
    const k = 0.5 + 0.5 * Math.sin(this.time.now / 160);
    this.stairs.forEach((s) => {
      g.lineStyle(4, s.modifier ? CONFIG.COLORS.BONUS : CONFIG.COLORS.PAPER, 0.4 + 0.6 * k);
      g.strokeRect(s.x - 44, s.y - 44, 88, 88);
    });
  },

  // Куда сейчас идти: к ближайшей лестнице, к кабинету, к карте или пробирке
  currentGoal() {
    const nearest = (items) => items.reduce((best, item) => {
      const d = Phaser.Math.Distance.Between(item.x, item.y, this.player.x, this.player.y);
      return !best || d < best.d ? { x: item.x, y: item.y, d } : best;
    }, null);
    if (this.stairsOpen) {
      return nearest(this.stairs);
    }
    if (this.carrying && this.targetDoor) {
      return { x: this.targetDoor.x, y: CONFIG.DOORS.FRONT_Y };
    }
    if (this.task === 'cards' && this.cardItem.visible) {
      return { x: this.cardItem.x, y: this.cardItem.y };
    }
    if (this.task === 'tests' && this.tubes.length) {
      return nearest(this.tubes);
    }
    return null;
  },

  updateRunIndicators() {
    const goal = this.currentGoal();
    this.placeIndicator(this.goalArrow, goal ? goal.x : 0, goal ? goal.y : 0, 0xffffff, !!goal && !this.isGameOver);
  },

  // Сердечка и цель этажа в HTML-табличке слева вверху
  updateRunHud() {
    Hud.setHearts(this.run.hearts, this.run.maxHearts);
    let goal;
    if (this.stairsOpen) {
      goal = this.stairs.length > 1 ? 'Выбери лестницу!' : 'Беги к выходу!';
    } else if (this.carrying && this.targetDoor) {
      goal = (this.task === 'tests' ? 'Анализы в ' : 'Неси карту в ') + this.targetDoor.number;
    } else if (this.task === 'tests') {
      goal = 'Пробирки ' + this.collected + '/' + this.floorInfo.count;
    } else if (this.task === 'round') {
      goal = 'Обход: ' + formatTime(Math.max(0, Math.ceil(this.roundLeft)));
    } else {
      goal = 'Медкарты ' + this.delivered + '/' + this.floorInfo.count;
    }
    Hud.setGoal('Этаж ' + this.run.floor + ' · ' + goal);
  }
};

Object.assign(GameScene.prototype, RunMode);
