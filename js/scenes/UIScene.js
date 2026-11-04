// =============================================================
// UIScene — интерфейс поверх GameScene: экран паузы и экран поражения.
// Счёт, время и кнопка паузы — HTML поверх игры (js/utils/hud.js).
// Ширина экрана игры меняется (под пропорцию телефона), поэтому содержимое
// оверлеев лежит в контейнерах: они центрируются и при нехватке места уменьшаются.
// Карточки горизонтальные — под лежащий боком телефон.
// Состояния: 'playing' → 'paused' → 'countdown' (3-2-1) → 'playing'; 'caught' → 'gameover'.
// =============================================================

// Размеры блоков оверлеев (их координаты — относительно центра экрана)
const PAUSE_BLOCK_WIDTH = 920;
const PAUSE_BLOCK_HEIGHT = 580;
const GAME_OVER_BLOCK_WIDTH = 1120;
const GAME_OVER_BLOCK_HEIGHT = 640;

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
    const { width, height } = this.scale;
    this.cameras.main.setSize(width, height);
    this.pauseShade.setPosition(width / 2, height / 2);
    this.gameOverShade.setPosition(width / 2, height / 2);
    fitContainer(this.pauseContent, this.scale, PAUSE_BLOCK_HEIGHT, PAUSE_BLOCK_WIDTH);
    this.countdownContent.setPosition(width / 2, height / 2);
    fitContainer(this.gameOverContent, this.scale, GAME_OVER_BLOCK_HEIGHT, GAME_OVER_BLOCK_WIDTH);
  }

  updateHud(score, seconds) {
    Hud.update(score, seconds);
  }

  // Затемнение с запасом — закрывает экран при любой его ширине
  // и перехватывает нажатия, чтобы они не доходили до игры (ставится в центр в layout)
  createShade(alpha) {
    return this.add.rectangle(0, 0, CONFIG.MAX_WIDTH * 2, CONFIG.HEIGHT * 2, CONFIG.COLORS.INK, alpha)
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
    this.pauseShade = shade;

    // Координаты — относительно центра экрана (контейнер ставится в центр)
    const card = this.createCard(900, 560);
    const title = createText(this, 0, -205, 'ПАУЗА', 72);
    // Задания на смену с прогрессом (обновляются при каждой паузе)
    this.pauseMissionTexts = [0, 1, 2].map((i) => createText(this, 0, -132 + i * 36, '', 26, CONFIG.COLORS.PAINT_LINE));
    const resumeButton = createButton(this, 0, 45, 'ПРОДОЛЖИТЬ', () => this.resumeGame(), { primary: true, height: 120 });
    const menuButton = createButton(this, -170, 190, 'В МЕНЮ', () => this.goToMenu(), { width: 300, height: 96, fontSize: 40 });
    this.soundButton = createButton(this, 170, 190, '', () => this.toggleSound(), { width: 300, height: 96, fontSize: 34 });
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
    this.gameOverShade = shade;
    const card = this.createCard(1100, 620);
    const lx = -270; // левая колонка: штамп и итог
    const rx = 270;  // правая: рекорд, задания, открытия и кнопки

    // Штамп — красная надпись в рамке (текст — случайный из открытых, см. гардероб)
    const stamp = this.add.graphics({ x: lx, y: -195 });
    stamp.fillStyle(C.STAMP, 1);
    stamp.fillRect(-250, -62, 500, 8);
    stamp.fillRect(-250, 54, 500, 8);
    stamp.fillRect(-250, -62, 8, 124);
    stamp.fillRect(242, -62, 8, 124);
    this.stampText = createText(this, lx, -199, 'ПОЙМАН!', 88, C.STAMP);

    const scoreLabel = createText(this, lx, -90, 'Счёт', 32, C.PAINT_LINE);
    this.finalScoreText = createText(this, lx, -35, '0', 90);
    this.finalTimeText = createText(this, lx, 35, '', 36, C.PAINT_LINE);
    this.diagnosisText = createText(this, lx, 88, '', 32, C.INK);
    this.newRecordText = createText(this, lx, 155, 'Новый рекорд!', 44, C.STAMP);
    this.bestScoreText = createText(this, rx, -235, '', 30, C.PAINT_LINE);
    this.missionsText = createText(this, rx, -190, '', 30, C.PAINT_DARK);
    this.unlockText = createText(this, rx, -105, '', 26, C.STAMP, { lineSpacing: 2 });

    const restartButton = createButton(this, rx, 90, 'ИГРАТЬ СНОВА', () => this.restartGame(), {
      width: 460,
      height: 120,
      fontSize: 50,
      primary: true
    });
    const menuButton = createButton(this, rx, 220, 'В МЕНЮ', () => this.goToMenu(), {
      width: 340,
      height: 96,
      fontSize: 42
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
