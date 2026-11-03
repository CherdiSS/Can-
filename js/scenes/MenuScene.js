// =============================================================
// MenuScene — главное меню: название, подсказка, рекорд, кнопка «ИГРАТЬ».
// Свёрстано в координатах 720×1280; всё лежит в контейнере, который
// центрируется и уменьшается, если экран игры ниже расчётного.
// =============================================================

// Вертикальный центр и высота содержимого меню (в координатах вёрстки)
const MENU_CENTER_Y = 680;
const MENU_BLOCK_HEIGHT = 1080;

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

    this.createHomeScreenHint(centerX);

    // Собираем всё в контейнер: координаты — относительно центра содержимого
    const items = this.children.list.slice();
    items.forEach((item) => {
      item.x -= centerX;
      item.y -= MENU_CENTER_Y;
    });
    this.content = this.add.container(0, 0, items);
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));

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

  layout() {
    this.cameras.main.setSize(CONFIG.WIDTH, this.scale.height);
    fitContainer(this.content, this.scale.height, MENU_BLOCK_HEIGHT);
  }

  // На iPhone в Safari подсказываем, как запустить игру на весь экран
  createHomeScreenHint(centerX) {
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone = window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    if (isIos && !isStandalone) {
      createText(this, centerX, 1180, 'На весь экран: «Поделиться» → «На экран „Домой“»', 26, CONFIG.COLORS.TEXT_DIM);
    }
  }

  startGame() {
    this.scene.start('GameScene');
  }
}
