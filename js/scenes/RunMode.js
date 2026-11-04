// =============================================================
// Режим «Смена» (рогалик) — дополнение к GameScene.
//
// Смена = забег по этажам поликлиники (CONFIG.RUN.FLOORS). На каждом этаже:
//   1) медкарта лежит у регистратуры или картотеки — подбери её;
//   2) отнеси в подсвеченный кабинет (стрелка у края экрана подскажет);
//   3) когда все карты разнесены — открывается лестница, пациенты звереют;
//   4) добежала до лестницы — этаж пройден, в ординаторской выбираешь усиление.
// У героини 3 сердечка на всю смену. Лечат аптечка (иногда лежит на этаже)
// и процедурный кабинет (дверь с красным крестом, один раз за этаж).
//
// Состояние смены между этажами хранится в registry ('run'): этаж, сердечка,
// усиления, очки и статистика. Каждый этаж — это новый запуск GameScene.
// Методы ниже добавляются в GameScene (Object.assign в конце файла).
// =============================================================

const Run = {
  // Новая смена: этаж 1, полные сердечка, без усилений
  start(registry) {
    registry.set('mode', 'run');
    registry.set('run', {
      floor: 1,
      hearts: CONFIG.RUN.HEARTS,
      maxHearts: CONFIG.RUN.HEARTS,
      perks: {},
      scoredTime: 0,
      extraPoints: 0,
      time: 0,
      stats: null,
      missionsDone: []
    });
  },

  perkCount(run, key) {
    return run.perks[key] || 0;
  },

  // Три разных усиления на выбор (уже взятые «одноразовые» не предлагаются)
  rollPerks(run) {
    const pool = CONFIG.PERKS.filter((perk) => perk.stack || !run.perks[perk.key]);
    return Phaser.Utils.Array.Shuffle(pool.slice()).slice(0, 3);
  },

  // Расписание выхода пациентов на этаже: чем выше этаж, тем раньше и больше
  spawns(floor) {
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
    this.floorInfo = CONFIG.RUN.FLOORS[Math.min(this.run.floor, CONFIG.RUN.FLOORS.length) - 1];
    this.cardsDelivered = 0;
    this.carrying = false;
    this.stairsOpen = false;
    this.floorDone = false;
    this.procedureUsed = false;
    this.medkitTime = Phaser.Math.FloatBetween(CONFIG.RUN.MEDKIT_AT[0], CONFIG.RUN.MEDKIT_AT[1]);
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
    this.spawnQueue = Run.spawns(this.run.floor).map((entry) => Object.assign({ door: null, done: false }, entry));
  },

  createRun() {
    const R = CONFIG.RUN;
    // Двери: одна — процедурная (лечит), остальные — кабинеты для медкарт
    this.procedureDoor = Phaser.Utils.Array.GetRandom(this.doors);

    // Медкарта, лестница, аптечка, карта «в руках» и стрелка к цели
    this.cardItem = this.add.image(0, 0, 'ui-medcard').setScale(2).setDepth(5).setVisible(false);
    this.tweens.add({ targets: this.cardItem, scale: 2.3, duration: 450, yoyo: true, repeat: -1 });
    this.carriedCard = this.add.image(0, 0, 'ui-medcard').setDepth(12).setVisible(false);
    this.stairs = this.add.image(0, 0, 'ui-stairs').setDepth(5).setVisible(false);
    this.goalArrow = this.add.image(0, 0, 'ui-arrow').setScrollFactor(0).setDepth(91).setVisible(false);
    this.runGraphics = this.add.graphics().setDepth(5);

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

    this.placeCard();
    this.updateRunHud();
  },

  // Сложность: каждый этаж «начинается» позже, после открытия лестницы — ещё сложнее
  runDifficultyShift() {
    const R = CONFIG.RUN;
    return (this.run.floor - 1) * R.FLOOR_TIME_SHIFT + (this.stairsOpen ? R.ENRAGE_TIME : 0);
  },

  // Время всей смены (для заданий и экрана поражения)
  runTotalTime() {
    return this.run.time + this.elapsed;
  },

  // ---------------------------------------------------------------
  // Медкарты
  // ---------------------------------------------------------------

  // Положить новую карту у регистратуры или картотеки (подальше от героини)
  placeCard() {
    const spots = CONFIG.RUN.CARD_SPOTS.slice().sort((a, b) =>
      Phaser.Math.Distance.Between(b[0], b[1], this.player.x, this.player.y) -
      Phaser.Math.Distance.Between(a[0], a[1], this.player.x, this.player.y));
    const [x, y] = spots[Phaser.Math.Between(0, 1)];
    this.cardItem.setPosition(x, y).setVisible(true);
    this.targetDoor = null;
  },

  pickUpCard() {
    this.carrying = true;
    this.cardItem.setVisible(false);
    // Нести — в любой кабинет, кроме процедурного
    const doors = this.doors.filter((door) => door !== this.procedureDoor);
    this.targetDoor = Phaser.Utils.Array.GetRandom(doors);
    this.popup(this.player.x, this.player.y - 40, 'медкарта → ' + this.targetDoor.number, CONFIG.COLORS.PAPER);
    Sound.play('pill');
    this.updateRunHud();
  },

  deliverCard() {
    const R = CONFIG.RUN;
    this.carrying = false;
    this.cardsDelivered += 1;
    this.stats.cards = (this.stats.cards || 0) + 1;
    this.addPoints(R.CARD_POINTS, this.targetDoor.x, CONFIG.DOORS.FRONT_Y + 60, 'карта сдана! +' + R.CARD_POINTS, CONFIG.COLORS.BONUS);
    Sound.play('door');
    Sound.play('powerup');
    // Кабинет пару секунд «занят» (принимают карту) — героиня не прячется в нём сразу после сдачи
    this.targetDoor.cooldown = Math.max(this.targetDoor.cooldown, 2);
    this.targetDoor = null;
    if (this.cardsDelivered >= this.floorInfo.cards) {
      this.openStairs();
    } else {
      this.placeCard();
    }
    this.updateRunHud();
  },

  // Возле двери (как для пряток): по x рядом с дверью и у самой стены
  isAtDoor(door) {
    return Math.abs(this.player.x - door.x) < CONFIG.HIDE.ENTER_DISTANCE && this.player.y < CONFIG.DOORS.BOTTOM + 30;
  },

  // ---------------------------------------------------------------
  // Лестница
  // ---------------------------------------------------------------

  openStairs() {
    // Подальше от героини — из двух самых дальних мест случайное
    const spots = CONFIG.RUN.STAIRS_SPOTS.slice().sort((a, b) =>
      Phaser.Math.Distance.Between(b[0], b[1], this.player.x, this.player.y) -
      Phaser.Math.Distance.Between(a[0], a[1], this.player.x, this.player.y));
    const [x, y] = spots[Phaser.Math.Between(0, 1)];
    this.stairs.setPosition(x, y).setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.stairs, alpha: 1, duration: 400 });
    this.stairsOpen = true;
    this.popup(this.player.x, this.player.y - 60, 'лестница открыта!', CONFIG.COLORS.BONUS);
    this.popup(this.player.x, this.player.y - 100, 'пациенты звереют!', CONFIG.COLORS.STAMP);
    Sound.play('mission');
    Sound.vibrate([30, 40, 30]);
  },

  // Этаж пройден: всё замирает, очки за этаж, дальше — ординаторская (или конец смены)
  clearFloor() {
    const R = CONFIG.RUN;
    this.floorDone = true;
    this.isGameOver = true; // останавливает обновление этажа
    this.physics.pause();
    this.player.stop();
    this.chasers.forEach((chaser) => chaser.anims.pause());
    Joystick.setActive(false);
    this.startHint.setVisible(false);
    const points = R.FLOOR_POINTS * this.run.floor;
    this.addPoints(points, this.player.x, this.player.y - 40, 'этаж пройден! +' + points, CONFIG.COLORS.BONUS);
    this.updateScore();
    Sound.play('mission');
    this.saveRunState();

    const last = this.run.floor >= R.FLOORS.length;
    if (last) {
      this.time.delayedCall(700, () => this.finishGame(true), [], this);
    } else {
      this.time.delayedCall(700, () => this.events.emit('floor-cleared', {
        floor: this.run.floor,
        perks: Run.rollPerks(this.run)
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

    // Кроссовки и курьер
    this.player.perkSpeed = Math.pow(1.08, P.sneakers || 0) * (this.carrying && P.courier ? 1.2 : 1);

    if (!this.hiding) {
      // Подобрать медкарту
      if (!this.carrying && this.cardItem.visible &&
          Phaser.Math.Distance.Between(player.x, player.y, this.cardItem.x, this.cardItem.y) < R.PICKUP_DISTANCE) {
        this.pickUpCard();
      }
      // Сдать медкарту в нужный кабинет (даже если он «занят» после пряток)
      if (this.carrying && this.targetDoor && this.isAtDoor(this.targetDoor)) {
        this.deliverCard();
      }
      // Лестница
      if (this.stairsOpen && Phaser.Math.Distance.Between(player.x, player.y, this.stairs.x, this.stairs.y) < R.STAIRS_DISTANCE) {
        this.clearFloor();
        return;
      }
      // Аптечка
      if (this.medkit && Phaser.Math.Distance.Between(player.x, player.y, this.medkit.x, this.medkit.y) < R.MEDKIT_DISTANCE) {
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

    // Карта «в руках» — над головой героини
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

  // Подсветка дверей: куда нести карту (мигающая рамка), процедурная (красный крест)
  drawRunDoors(g) {
    const D = CONFIG.DOORS;
    if (this.targetDoor && Math.floor(this.time.now / 250) % 2 === 0) {
      g.lineStyle(4, CONFIG.COLORS.BONUS, 1);
      g.strokeRect(this.targetDoor.x - 19, D.TOP - 2, 38, D.BOTTOM - D.TOP + 6);
    }
    const door = this.procedureDoor;
    if (door) {
      const used = this.procedureUsed;
      g.fillStyle(CONFIG.COLORS.PAPER, 1);
      g.fillRect(door.x + 18, 8, 16, 16);
      g.fillStyle(used ? 0x777777 : 0xc4282e, 1);
      g.fillRect(door.x + 24, 10, 4, 12);
      g.fillRect(door.x + 20, 14, 12, 4);
    }
    // Пульсирующий ободок вокруг лестницы
    if (this.stairsOpen) {
      const k = 0.5 + 0.5 * Math.sin(this.time.now / 160);
      g.lineStyle(4, CONFIG.COLORS.BONUS, 0.4 + 0.6 * k);
      g.strokeRect(this.stairs.x - 44, this.stairs.y - 44, 88, 88);
    }
  },

  // Куда сейчас идти: к карте, к кабинету или к лестнице
  currentGoal() {
    if (this.stairsOpen) {
      return { x: this.stairs.x, y: this.stairs.y };
    }
    if (this.carrying && this.targetDoor) {
      return { x: this.targetDoor.x, y: CONFIG.DOORS.FRONT_Y };
    }
    if (this.cardItem.visible) {
      return { x: this.cardItem.x, y: this.cardItem.y };
    }
    return null;
  },

  updateRunIndicators() {
    const goal = this.currentGoal();
    this.placeIndicator(this.goalArrow, goal ? goal.x : 0, goal ? goal.y : 0, 0xffffff, !!goal && !this.isGameOver);
  },

  // Сердечки и цель этажа в HTML-табличке слева вверху
  updateRunHud() {
    Hud.setHearts(this.run.hearts, this.run.maxHearts);
    let goal;
    if (this.stairsOpen) {
      goal = 'Беги к лестнице!';
    } else if (this.carrying && this.targetDoor) {
      goal = 'Неси карту в ' + this.targetDoor.number;
    } else {
      goal = 'Медкарты ' + this.cardsDelivered + '/' + this.floorInfo.cards;
    }
    Hud.setGoal('Этаж ' + this.run.floor + ' · ' + goal);
  }
};

Object.assign(GameScene.prototype, RunMode);
