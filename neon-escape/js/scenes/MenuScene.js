// =============================================================
// MenuScene — главное меню: название, подсказка, рекорд, кнопка «ИГРАТЬ».
// =============================================================

class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const centerX = CONFIG.WIDTH / 2;
    this.cameras.main.setBackgroundColor(CONFIG.COLORS.BACKGROUND);

    this.createTitle(centerX);
    this.createIllustration(centerX);
    this.createHints(centerX);
    this.createBestScore(centerX);

    // Кнопка в нижней трети экрана
    createButton(this, centerX, 1040, 'ИГРАТЬ', () => this.startGame(), {
      width: 480,
      height: 150,
      fontSize: 60
    });

    // На компьютере можно начать игру клавишами Enter или Пробел
    if (this.input.keyboard) {
      this.input.keyboard.once('keydown-ENTER', () => this.startGame());
      this.input.keyboard.once('keydown-SPACE', () => this.startGame());
    }
  }

  createTitle(centerX) {
    const title = createText(this, centerX, 270, 'НЕОНОВЫЙ\nПОБЕГ', 96, CONFIG.COLORS.PLAYER);
    title.setLineSpacing(10);
    title.setStroke(colorToCss(0x0b3a52), 8);
  }

  // Маленькая «картинка» из игровых фигур: игрок и три преследователя
  createIllustration(centerX) {
    this.add.image(centerX, 590, 'player');
    this.add.image(centerX - 150, 500, 'chaser');
    this.add.image(centerX + 150, 500, 'chaser');
    this.add.image(centerX, 450, 'chaser');
    this.add.image(centerX + 210, 620, 'bonus');
  }

  createHints(centerX) {
    createText(this, centerX, 730, 'Тяни пальцем для движения', 42);
    createText(this, centerX, 790, 'Убегай от красных, собирай жёлтые', 30, CONFIG.COLORS.TEXT_DIM);
    createText(this, centerX, 835, 'На компьютере: WASD или стрелки', 26, CONFIG.COLORS.TEXT_DIM);
  }

  createBestScore(centerX) {
    createText(this, centerX, 910, 'Рекорд: ' + getBestScore(), 44, CONFIG.COLORS.BONUS);
  }

  startGame() {
    this.scene.start('GameScene');
  }
}
