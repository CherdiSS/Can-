// =============================================================
// MenuScene — главное меню: название, подсказка, рекорд, кнопка «ИГРАТЬ».
// Фон — стена и пол поликлиники (во весь экран, пиксели ×2).
// Содержимое свёрстано в координатах 720×1280 и лежит в контейнере, который
// центрируется и уменьшается, если экран игры ниже расчётного.
// =============================================================

// Вертикальный центр и высота содержимого меню (в координатах вёрстки)
const MENU_CENTER_Y = 668;
const MENU_BLOCK_HEIGHT = 1100;
const MENU_PIXEL_SCALE = 2; // пиксель-арт в меню — ровно ×2

class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const centerX = CONFIG.WIDTH / 2;
    this.cameras.main.setBackgroundColor(CONFIG.COLORS.BACKGROUND);

    this.createBackground();

    // Всё, что создано дальше, попадёт в контейнер с вёрсткой
    const firstContentIndex = this.children.list.length;
    this.createTitle(centerX);
    this.createIllustration(centerX);
    this.createMemo(centerX);

    // Главная кнопка — зелёная, как масляная панель стены
    createButton(this, centerX, 1060, 'ИГРАТЬ', () => this.startGame(), {
      width: 480,
      height: 150,
      fontSize: 64,
      primary: true
    });

    this.createHomeScreenHint(centerX);

    // Собираем содержимое в контейнер: координаты — относительно центра содержимого
    const items = this.children.list.slice(firstContentIndex);
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

  // Пол поликлиники на весь экран и стена с дверями кабинетов сверху
  createBackground() {
    this.floor = this.add.tileSprite(0, 0, CONFIG.WIDTH, this.scale.height, 'env-floor_tile')
      .setOrigin(0).setTileScale(MENU_PIXEL_SCALE);
    this.add.image(CONFIG.WIDTH / 2, 0, 'env-wall_north').setOrigin(0.5, 0).setScale(MENU_PIXEL_SCALE);
  }

  // Название — на табличке, как на дверях кабинетов
  createTitle(centerX) {
    const plate = this.add.graphics();
    drawPlate(plate, centerX, 245, 600, 230, CONFIG.COLORS.PAPER, CONFIG.COLORS.PAPER_SHADE, 8);
    createText(this, centerX, 238, 'НЕОНОВЫЙ\nПОБЕГ', 92, CONFIG.COLORS.INK, { lineSpacing: -8 });
  }

  // «Картинка» из персонажей игры: героиня-врач, три пациента и таблетка (с анимацией)
  createIllustration(centerX) {
    const scale = MENU_PIXEL_SCALE;
    const ring = CONFIG.CHASER.RING;
    // Загонщик, Охотник, Перехватчик — у каждого пиксельное кольцо цвета роли
    [[centerX - 165, 525, 2], [centerX, 465, 0], [centerX + 165, 525, 1]].forEach(([x, y, roleIndex]) => {
      const role = CONFIG.CHASER.ROLES[roleIndex];
      this.add.image(x, y + ring.OFFSET_Y * scale, 'ui-ring').setScale(scale).setTint(role.color);
      // пациенты бегут на месте, у каждого — своя походка
      this.add.sprite(x, y, role.texture).setScale(scale).setFlipX(x < centerX).play(role.texture + '-run');
    });
    // героиня дышит
    this.add.sprite(centerX, 600, CONFIG.PLAYER.TEXTURE).setScale(scale).play(CONFIG.PLAYER.TEXTURE + '-idle');
    this.add.image(centerX + 225, 650, CONFIG.BONUS.TEXTURE).setScale(scale);
  }

  // «Памятка»: подсказки и рекорд на карточке-побелке
  createMemo(centerX) {
    const C = CONFIG.COLORS;
    const card = this.add.graphics();
    drawPlate(card, centerX, 830, 640, 250, C.PAPER, C.PAPER_SHADE);
    createText(this, centerX, 752, 'Управляй джойстиком внизу экрана', 32);
    createText(this, centerX, 797, 'Убегай от пациентов, собирай таблетки', 26, C.PAINT_LINE);
    createText(this, centerX, 834, 'На компьютере: WASD или стрелки', 24, C.PAINT_LINE);
    createText(this, centerX, 893, 'Рекорд: ' + getBestScore(), 42, C.STAMP);
  }

  layout() {
    const height = this.scale.height;
    this.cameras.main.setSize(CONFIG.WIDTH, height);
    this.floor.setSize(CONFIG.WIDTH, height);
    fitContainer(this.content, height, MENU_BLOCK_HEIGHT);
  }

  // На iPhone в Safari подсказываем, как запустить игру на весь экран
  createHomeScreenHint(centerX) {
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone = window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    if (isIos && !isStandalone) {
      createText(this, centerX, 1188, 'На весь экран: «Поделиться» → «На экран „Домой“»', 24, CONFIG.COLORS.PAPER)
        .setBackgroundColor(colorToCss(CONFIG.COLORS.INK)).setPadding(14, 6, 14, 8);
    }
  }

  startGame() {
    this.scene.start('GameScene');
  }
}
