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

  // «Картинка» из персонажей игры: героиня-врач, три пациента и таблетка.
  // Масштаб ровно ×2 — пиксели остаются квадратными и чёткими.
  createIllustration(centerX) {
    const scale = 2;
    const ring = CONFIG.CHASER.RING;
    const graphics = this.add.graphics();
    // Загонщик, Охотник, Перехватчик — у каждого своя тень-кольцо цвета роли
    [[centerX - 165, 525, 2], [centerX, 465, 0], [centerX + 165, 525, 1]].forEach(([x, y, roleIndex]) => {
      const role = CONFIG.CHASER.ROLES[roleIndex];
      graphics.lineStyle(4, role.color, 0.9);
      graphics.strokeEllipse(x, y + ring.OFFSET_Y * scale, ring.WIDTH * scale, ring.HEIGHT * scale);
      this.add.image(x, y, role.texture).setScale(scale).setFlipX(x < centerX);
    });
    this.add.image(centerX, 600, CONFIG.PLAYER.TEXTURE).setScale(scale);
    this.add.image(centerX + 225, 650, CONFIG.BONUS.TEXTURE).setScale(scale);
  }

  createHints(centerX) {
    createText(this, centerX, 730, 'Управляй джойстиком внизу экрана', 34);
    createText(this, centerX, 790, 'Убегай от пациентов, собирай таблетки', 30, CONFIG.COLORS.TEXT_DIM);
    createText(this, centerX, 835, 'На компьютере: WASD или стрелки', 26, CONFIG.COLORS.TEXT_DIM);
  }

  createBestScore(centerX) {
    createText(this, centerX, 910, 'Рекорд: ' + getBestScore(), 44, CONFIG.COLORS.BONUS);
  }

  startGame() {
    this.scene.start('GameScene');
  }
}
