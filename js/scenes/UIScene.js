// =============================================================
// UIScene — интерфейс поверх GameScene: экран паузы и экран поражения.
// Счёт, таймер и кнопка паузы — в нижней HTML-панели (js/utils/hud.js).
// Высота экрана игры меняется (под пропорцию телефона), поэтому содержимое
// оверлеев лежит в контейнерах: они центрируются и при нехватке места уменьшаются.
// Состояния: 'playing' → 'paused' → 'countdown' (3-2-1) → 'playing'; 'caught' → 'gameover'.
// =============================================================

// Высота блоков оверлеев (их координаты — относительно центра экрана)
const PAUSE_BLOCK_HEIGHT = 820;
const GAME_OVER_BLOCK_HEIGHT = 1060;

class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  create() {
    this.gameScene = this.scene.get('GameScene');
    this.state = 'playing';

    this.createPauseOverlay();
    this.createCountdown();
    this.createGameOverOverlay();
    this.layout();

    setItemsVisible(this.pauseItems, false);
    setItemsVisible(this.gameOverItems, false);

    // Кнопка паузы в нижней панели
    Hud.onPause = () => this.pauseGame();

    // Начальные значения HUD
    this.updateHud(this.gameScene.score, this.gameScene.elapsed);

    // Подписки на события игры
    this.gameScene.events.on('hud-update', this.updateHud, this);
    this.gameScene.events.on('player-caught', this.onPlayerCaught, this);
    this.gameScene.events.on('game-over', this.showGameOver, this);

    // Автопауза при сворачивании вкладки или потере фокуса окна
    this.game.events.on(Phaser.Core.Events.BLUR, this.onFocusLost, this);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onFocusLost, this);

    // Изменился размер экрана — перестраиваем оверлеи
    this.scale.on('resize', this.layout, this);

    // На компьютере пауза — Esc или P
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-ESC', this.togglePause, this);
      this.input.keyboard.on('keydown-P', this.togglePause, this);
    }

    this.events.once('shutdown', this.onShutdown, this);
  }

  // Подгонка под текущую высоту экрана игры
  layout() {
    const height = this.scale.height;
    this.cameras.main.setSize(CONFIG.WIDTH, height);
    fitContainer(this.pauseContent, height, PAUSE_BLOCK_HEIGHT);
    this.countdownContent.setPosition(CONFIG.WIDTH / 2, height / 2);
    fitContainer(this.gameOverContent, height, GAME_OVER_BLOCK_HEIGHT);
  }

  updateHud(score, seconds) {
    Hud.update(score, seconds);
  }

  // Затемнение с запасом по высоте — закрывает экран при любой его высоте
  // и перехватывает нажатия, чтобы они не доходили до игры
  createShade(alpha) {
    return this.add.rectangle(CONFIG.WIDTH / 2, 0, CONFIG.WIDTH, CONFIG.MAX_HEIGHT * 2, CONFIG.COLORS.INK, alpha)
      .setInteractive();
  }

  // Карточка-побелка (как справка или памятка в поликлинике), координаты — от центра
  createCard(width, height) {
    const card = this.add.graphics();
    drawPlate(card, 0, 0, width, height, CONFIG.COLORS.PAPER, CONFIG.COLORS.PAPER_SHADE, 8);
    return card;
  }

  // ---------------------------------------------------------------
  // Пауза
  // ---------------------------------------------------------------

  createPauseOverlay() {
    const shade = this.createShade(0.7);

    // Координаты — относительно центра экрана (контейнер ставится в центр)
    const card = this.createCard(600, 800);
    const title = createText(this, 0, -320, 'ПАУЗА', 84);
    // Задания на смену с прогрессом (обновляются при каждой паузе)
    this.pauseMissionTexts = [0, 1, 2].map((i) => createText(this, 0, -225 + i * 40, '', 26, CONFIG.COLORS.PAINT_LINE));
    const resumeButton = createButton(this, 0, -35, 'ПРОДОЛЖИТЬ', () => this.resumeGame(), { primary: true });
    const menuButton = createButton(this, 0, 110, 'В МЕНЮ', () => this.goToMenu(), { height: 112, fontSize: 44 });
    this.soundButton = createButton(this, 0, 240, '', () => this.toggleSound(), { height: 100, fontSize: 38 });
    this.updateSoundLabel();

    this.pauseContent = this.add.container(0, 0, [card, title].concat(this.pauseMissionTexts,
      buttonParts(resumeButton), buttonParts(menuButton), buttonParts(this.soundButton)));
    this.pauseItems = [shade, card, title].concat(this.pauseMissionTexts, [resumeButton, menuButton, this.soundButton]);
  }

  // Строка задания: «✓ Собери 5 таблеток» или «Собери 5 таблеток (2/5)»
  missionLine(mission, value) {
    return mission.done ? '+ ' + mission.text : mission.text + ' (' + Math.min(value, mission.goal) + '/' + mission.goal + ')';
  }

  updatePauseMissions() {
    const game = this.gameScene;
    game.missions.forEach((mission, i) => {
      const text = this.pauseMissionTexts[i];
      if (text) {
        text.setText(this.missionLine(mission, game.missionValue(mission)));
        text.setColor(colorToCss(mission.done ? CONFIG.COLORS.PAINT_DARK : CONFIG.COLORS.PAINT_LINE));
      }
    });
  }

  toggleSound() {
    Sound.setMuted(!Sound.muted);
    this.updateSoundLabel();
  }

  updateSoundLabel() {
    this.soundButton.label.setText(Sound.muted ? 'ЗВУК: ВЫКЛ' : 'ЗВУК: ВКЛ');
  }

  pauseGame() {
    if (this.state === 'countdown') {
      // Свернули игру или нажали паузу во время отсчёта — снова на паузу
      this.stopCountdown();
      this.state = 'paused';
      setItemsVisible(this.pauseItems, true);
      return;
    }
    if (this.state !== 'playing') {
      return;
    }
    this.state = 'paused';
    this.scene.pause('GameScene');
    this.updatePauseMissions();
    setItemsVisible(this.pauseItems, true);
  }

  resumeGame() {
    if (this.state !== 'paused') {
      return;
    }
    setItemsVisible(this.pauseItems, false);
    this.startCountdown(); // игра продолжится после 3-2-1
  }

  togglePause() {
    if (this.state === 'playing' || this.state === 'countdown') {
      this.pauseGame();
    } else if (this.state === 'paused') {
      this.resumeGame();
    }
  }

  // ---------------------------------------------------------------
  // Отсчёт 3-2-1 после паузы: успеть понять, где героиня и пациенты
  // ---------------------------------------------------------------

  createCountdown() {
    const plate = this.add.graphics();
    drawPlate(plate, 0, 0, 200, 200, CONFIG.COLORS.PAPER, CONFIG.COLORS.PAPER_SHADE, 8);
    this.countdownText = createText(this, 0, -8, '3', 140);
    this.countdownContent = this.add.container(0, 0, [plate, this.countdownText]).setVisible(false);
  }

  startCountdown() {
    const C = CONFIG.COUNTDOWN;
    this.state = 'countdown';
    this.countdownValue = C.FROM;
    this.countdownText.setText(String(this.countdownValue));
    this.countdownContent.setVisible(true);
    Sound.play('beep');
    this.countdownEvent = this.time.addEvent({
      delay: C.STEP_MS,
      repeat: C.FROM - 1,
      callback: () => {
        this.countdownValue -= 1;
        if (this.countdownValue > 0) {
          this.countdownText.setText(String(this.countdownValue));
          Sound.play('beep');
        } else {
          this.finishCountdown();
        }
      }
    });
  }

  stopCountdown() {
    if (this.countdownEvent) {
      this.countdownEvent.remove(false);
      this.countdownEvent = null;
    }
    this.countdownContent.setVisible(false);
  }

  finishCountdown() {
    this.stopCountdown();
    this.state = 'playing';
    Sound.play('go');
    this.scene.resume('GameScene');
  }

  onFocusLost() {
    this.pauseGame();
  }

  // ---------------------------------------------------------------
  // Поражение
  // ---------------------------------------------------------------

  createGameOverOverlay() {
    const C = CONFIG.COLORS;
    const shade = this.createShade(0.8);
    const card = this.createCard(640, 1040);

    // Штамп — красная надпись в рамке (текст — случайный из открытых, см. гардероб)
    const stamp = this.add.graphics({ x: 0, y: -405 });
    stamp.fillStyle(C.STAMP, 1);
    stamp.fillRect(-250, -62, 500, 8);
    stamp.fillRect(-250, 54, 500, 8);
    stamp.fillRect(-250, -62, 8, 124);
    stamp.fillRect(242, -62, 8, 124);
    this.stampText = createText(this, 0, -409, 'ПОЙМАН!', 88, C.STAMP);

    const scoreLabel = createText(this, 0, -300, 'Счёт', 32, C.PAINT_LINE);
    this.finalScoreText = createText(this, 0, -245, '0', 90);
    this.finalTimeText = createText(this, 0, -175, '', 36, C.PAINT_LINE);
    this.diagnosisText = createText(this, 0, -127, '', 32, C.INK);
    this.newRecordText = createText(this, 0, -76, 'Новый рекорд!', 44, C.STAMP);
    this.bestScoreText = createText(this, 0, -32, '', 28, C.PAINT_LINE);
    this.missionsText = createText(this, 0, 12, '', 28, C.PAINT_DARK);
    this.unlockText = createText(this, 0, 62, '', 26, C.STAMP, { lineSpacing: 2 });

    const restartButton = createButton(this, 0, 222, 'ИГРАТЬ СНОВА', () => this.restartGame(), {
      width: 500,
      height: 130,
      fontSize: 52,
      primary: true
    });
    const menuButton = createButton(this, 0, 360, 'В МЕНЮ', () => this.goToMenu(), {
      width: 380,
      height: 104,
      fontSize: 44
    });

    this.gameOverContent = this.add.container(0, 0, [
      card, stamp, this.stampText, scoreLabel, this.finalScoreText, this.finalTimeText, this.diagnosisText,
      this.newRecordText, this.bestScoreText, this.missionsText, this.unlockText
    ].concat(buttonParts(restartButton), buttonParts(menuButton)));
    this.gameOverItems = [
      shade, card, stamp, this.stampText, scoreLabel, this.finalScoreText, this.finalTimeText, this.diagnosisText,
      this.newRecordText, this.bestScoreText, this.missionsText, this.unlockText, restartButton, menuButton
    ];
  }

  // Игрока поймали — паузу больше нажимать нельзя
  onPlayerCaught() {
    this.state = 'caught';
  }

  showGameOver(result) {
    this.state = 'gameover';
    this.updateHud(result.score, result.seconds);

    this.finalScoreText.setText(String(result.score));
    this.finalTimeText.setText('Время: ' + formatTime(result.seconds));
    this.bestScoreText.setText('Рекорд: ' + result.bestScore);
    this.diagnosisText.setText('Диагноз: ' + result.diagnosis);
    const done = result.missions.filter((m) => m.done).length;
    this.missionsText.setText('Задания: ' + done + ' из ' + result.missions.length);
    this.unlockText.setText(result.unlocked.length ? 'Открыто: ' + result.unlocked.join(',\n') : '');

    // Штамп: длинная надпись уменьшается, чтобы влезть в рамку
    this.stampText.setText(result.stamp).setFontSize(88);
    if (this.stampText.width > 450) {
      this.stampText.setFontSize(Math.floor(88 * 450 / this.stampText.width));
    }

    setItemsVisible(this.gameOverItems, true);
    if (result.unlocked.length) {
      Sound.play('mission');
    }
    // «Новый рекорд!» показываем только при побитом рекорде
    this.newRecordText.setVisible(result.isNewRecord);
  }

  // ---------------------------------------------------------------
  // Переходы между сценами
  // ---------------------------------------------------------------

  restartGame() {
    // start() перезапускает GameScene и останавливает эту сцену;
    // GameScene сама снова запустит UIScene
    this.scene.start('GameScene');
  }

  goToMenu() {
    this.scene.stop('GameScene');
    this.scene.start('MenuScene');
  }

  onShutdown() {
    Hud.onPause = null;
    this.scale.off('resize', this.layout, this);
    this.gameScene.events.off('hud-update', this.updateHud, this);
    this.gameScene.events.off('player-caught', this.onPlayerCaught, this);
    this.gameScene.events.off('game-over', this.showGameOver, this);
    this.game.events.off(Phaser.Core.Events.BLUR, this.onFocusLost, this);
    this.game.events.off(Phaser.Core.Events.HIDDEN, this.onFocusLost, this);
    if (this.input.keyboard) {
      this.input.keyboard.off('keydown-ESC', this.togglePause, this);
      this.input.keyboard.off('keydown-P', this.togglePause, this);
    }
  }
}
