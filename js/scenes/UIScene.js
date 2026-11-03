// =============================================================
// UIScene — интерфейс поверх GameScene: экран паузы и экран поражения.
// Счёт, таймер и кнопка паузы — в нижней HTML-панели (js/utils/hud.js).
// Высота экрана игры меняется (под пропорцию телефона), поэтому содержимое
// оверлеев лежит в контейнерах: они центрируются и при нехватке места уменьшаются.
// Состояния: 'playing' → 'paused' / 'caught' → 'gameover'.
// =============================================================

// Высота блоков оверлеев (их координаты — относительно центра экрана)
const PAUSE_BLOCK_HEIGHT = 480;
const GAME_OVER_BLOCK_HEIGHT = 800;

class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  create() {
    this.gameScene = this.scene.get('GameScene');
    this.state = 'playing';

    this.createPauseOverlay();
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
    fitContainer(this.gameOverContent, height, GAME_OVER_BLOCK_HEIGHT);
  }

  updateHud(score, seconds) {
    Hud.update(score, seconds);
  }

  // Затемнение с запасом по высоте — закрывает экран при любой его высоте
  // и перехватывает нажатия, чтобы они не доходили до игры
  createShade(alpha) {
    return this.add.rectangle(CONFIG.WIDTH / 2, 0, CONFIG.WIDTH, CONFIG.MAX_HEIGHT * 2, 0x000000, alpha)
      .setInteractive();
  }

  // ---------------------------------------------------------------
  // Пауза
  // ---------------------------------------------------------------

  createPauseOverlay() {
    const shade = this.createShade(0.65);

    // Координаты — относительно центра экрана (контейнер ставится в центр)
    const title = createText(this, 0, -190, 'ПАУЗА', 88, CONFIG.COLORS.PLAYER);
    const resumeButton = createButton(this, 0, 0, 'ПРОДОЛЖИТЬ', () => this.resumeGame());
    const menuButton = createButton(this, 0, 170, 'В МЕНЮ', () => this.goToMenu(), {
      color: CONFIG.COLORS.TEXT_DIM
    });

    this.pauseContent = this.add.container(0, 0, [title, resumeButton, resumeButton.label, menuButton, menuButton.label]);
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
    const shade = this.createShade(0.85);

    const title = createText(this, 0, -350, 'ПОЙМАН!', 92, CONFIG.COLORS.CHASER);
    const scoreLabel = createText(this, 0, -230, 'Счёт', 36, CONFIG.COLORS.TEXT_DIM);
    this.finalScoreText = createText(this, 0, -160, '0', 104);
    this.finalTimeText = createText(this, 0, -60, '', 44, CONFIG.COLORS.PLAYER);
    this.newRecordText = createText(this, 0, 15, 'Новый рекорд!', 52, CONFIG.COLORS.BONUS);
    this.bestScoreText = createText(this, 0, 80, '', 34, CONFIG.COLORS.TEXT_DIM);

    const restartButton = createButton(this, 0, 210, 'ИГРАТЬ СНОВА', () => this.restartGame(), {
      width: 480,
      height: 140,
      fontSize: 52
    });
    const menuButton = createButton(this, 0, 345, 'В МЕНЮ', () => this.goToMenu(), {
      width: 380,
      height: 110,
      fontSize: 44,
      color: CONFIG.COLORS.TEXT_DIM
    });

    this.gameOverContent = this.add.container(0, 0, [
      title, scoreLabel, this.finalScoreText, this.finalTimeText, this.newRecordText, this.bestScoreText,
      restartButton, restartButton.label, menuButton, menuButton.label
    ]);
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
