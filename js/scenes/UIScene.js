// =============================================================
// UIScene — интерфейс поверх GameScene:
// HUD (счёт, таймер, пауза), экран паузы и экран поражения.
// Состояния: 'playing' → 'paused' / 'caught' → 'gameover'.
// =============================================================

class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  create() {
    this.gameScene = this.scene.get('GameScene');
    this.state = 'playing';

    this.createHud();
    this.createPauseOverlay();
    this.createGameOverOverlay();

    setItemsVisible(this.pauseItems, false);
    setItemsVisible(this.gameOverItems, false);

    // Начальные значения HUD
    this.updateHud(this.gameScene.score, this.gameScene.elapsed);

    // Подписки на события игры
    this.gameScene.events.on('hud-update', this.updateHud, this);
    this.gameScene.events.on('player-caught', this.onPlayerCaught, this);
    this.gameScene.events.on('game-over', this.showGameOver, this);

    // Автопауза при сворачивании вкладки или потере фокуса окна
    this.game.events.on(Phaser.Core.Events.BLUR, this.onFocusLost, this);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onFocusLost, this);

    // На компьютере пауза — Esc или P
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-ESC', this.togglePause, this);
      this.input.keyboard.on('keydown-P', this.togglePause, this);
    }

    this.events.once('shutdown', this.onShutdown, this);
  }

  // ---------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------

  createHud() {
    const centerY = CONFIG.HUD_HEIGHT / 2;

    this.add.rectangle(CONFIG.WIDTH / 2, centerY, CONFIG.WIDTH, CONFIG.HUD_HEIGHT, CONFIG.COLORS.HUD);
    this.add.rectangle(CONFIG.WIDTH / 2, CONFIG.HUD_HEIGHT - 1.5, CONFIG.WIDTH, 3, CONFIG.COLORS.PLAYER, 0.5);

    // Счёт — слева
    this.scoreText = createText(this, 28, centerY, '', 40).setOrigin(0, 0.5);

    // Таймер — по центру
    this.timeText = createText(this, CONFIG.WIDTH / 2, centerY, '', 48, CONFIG.COLORS.PLAYER);

    this.createPauseButton(centerY);
  }

  // Кнопка паузы: квадрат с двумя вертикальными полосками
  createPauseButton(centerY) {
    const size = CONFIG.UI.BUTTON_MIN_SIZE;
    const x = CONFIG.WIDTH - 20 - size / 2;
    const color = CONFIG.COLORS.TEXT;

    this.pauseButton = this.add.rectangle(x, centerY, size, size, color, 0.08)
      .setStrokeStyle(4, color, 0.8)
      .setInteractive({ useHandCursor: true });

    this.add.rectangle(x - 13, centerY, 12, 42, color);
    this.add.rectangle(x + 13, centerY, 12, 42, color);

    this.pauseButton.on('pointerdown', () => this.pauseButton.setFillStyle(color, 0.3));
    this.pauseButton.on('pointerout', () => this.pauseButton.setFillStyle(color, 0.08));
    this.pauseButton.on('pointerup', () => {
      this.pauseButton.setFillStyle(color, 0.08);
      this.pauseGame();
    });
  }

  updateHud(score, seconds) {
    this.scoreText.setText('Счёт: ' + score);
    this.timeText.setText(formatTime(seconds));
  }

  // ---------------------------------------------------------------
  // Пауза
  // ---------------------------------------------------------------

  createPauseOverlay() {
    const centerX = CONFIG.WIDTH / 2;

    // Затемнение перехватывает нажатия, чтобы они не доходили до HUD
    const shade = this.add.rectangle(centerX, CONFIG.HEIGHT / 2, CONFIG.WIDTH, CONFIG.HEIGHT, 0x000000, 0.65)
      .setInteractive();

    const title = createText(this, centerX, 470, 'ПАУЗА', 88, CONFIG.COLORS.PLAYER);

    const resumeButton = createButton(this, centerX, 660, 'ПРОДОЛЖИТЬ', () => this.resumeGame());
    const menuButton = createButton(this, centerX, 830, 'В МЕНЮ', () => this.goToMenu(), {
      color: CONFIG.COLORS.TEXT_DIM
    });

    this.pauseItems = [shade, title, resumeButton, menuButton];
  }

  pauseGame() {
    if (this.state !== 'playing') {
      return;
    }
    this.state = 'paused';
    this.scene.pause('GameScene');
    setItemsVisible(this.pauseItems, true);
  }

  resumeGame() {
    if (this.state !== 'paused') {
      return;
    }
    this.state = 'playing';
    setItemsVisible(this.pauseItems, false);
    this.scene.resume('GameScene');
  }

  togglePause() {
    if (this.state === 'playing') {
      this.pauseGame();
    } else if (this.state === 'paused') {
      this.resumeGame();
    }
  }

  onFocusLost() {
    this.pauseGame();
  }

  // ---------------------------------------------------------------
  // Поражение
  // ---------------------------------------------------------------

  createGameOverOverlay() {
    const centerX = CONFIG.WIDTH / 2;

    const shade = this.add.rectangle(centerX, CONFIG.HEIGHT / 2, CONFIG.WIDTH, CONFIG.HEIGHT, 0x000000, 0.85)
      .setInteractive();

    const title = createText(this, centerX, 300, 'ПОЙМАН!', 92, CONFIG.COLORS.CHASER);
    const scoreLabel = createText(this, centerX, 440, 'Счёт', 36, CONFIG.COLORS.TEXT_DIM);
    this.finalScoreText = createText(this, centerX, 515, '0', 104);
    this.finalTimeText = createText(this, centerX, 620, '', 44, CONFIG.COLORS.PLAYER);
    this.newRecordText = createText(this, centerX, 700, 'Новый рекорд!', 52, CONFIG.COLORS.BONUS);
    this.bestScoreText = createText(this, centerX, 770, '', 34, CONFIG.COLORS.TEXT_DIM);

    const restartButton = createButton(this, centerX, 930, 'ИГРАТЬ СНОВА', () => this.restartGame(), {
      width: 480,
      height: 140,
      fontSize: 52
    });
    const menuButton = createButton(this, centerX, 1100, 'В МЕНЮ', () => this.goToMenu(), {
      width: 380,
      height: 120,
      fontSize: 44,
      color: CONFIG.COLORS.TEXT_DIM
    });

    this.gameOverItems = [
      shade, title, scoreLabel, this.finalScoreText, this.finalTimeText,
      this.newRecordText, this.bestScoreText, restartButton, menuButton
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

    setItemsVisible(this.gameOverItems, true);
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
