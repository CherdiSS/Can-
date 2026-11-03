// =============================================================
// MenuScene — главное меню: название, задания на смену, рекорд,
// кнопка «ИГРАТЬ», звук и гардероб (форма героини и штампы).
// Фон — стена и пол поликлиники (во весь экран, пиксели ×2).
// Содержимое свёрстано в координатах 720×1280 и лежит в контейнере, который
// центрируется и уменьшается, если экран игры ниже расчётного.
// =============================================================

// Вертикальный центр и высота содержимого меню (в координатах вёрстки)
const MENU_CENTER_Y = 712;
const MENU_BLOCK_HEIGHT = 1180;
const MENU_PIXEL_SCALE = 2; // пиксель-арт в меню — ровно ×2
const WARDROBE_BLOCK_HEIGHT = 1120;

class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const centerX = CONFIG.WIDTH / 2;
    this.cameras.main.setBackgroundColor(CONFIG.COLORS.BACKGROUND);
    this.wardrobe = null;

    // Задания на эту смену (GameScene возьмёт их из registry)
    this.registry.set('missions', Progress.rollMissions());

    this.createBackground();

    // Всё, что создано дальше, попадёт в контейнер с вёрсткой
    const firstContentIndex = this.children.list.length;
    this.createTitle(centerX);
    this.createIllustration(centerX);
    this.createMemo(centerX);

    // Главная кнопка — зелёная, как масляная панель стены
    createButton(this, centerX, 1045, 'ИГРАТЬ', () => this.startGame(), {
      width: 480,
      height: 150,
      fontSize: 64,
      primary: true
    });

    // Гардероб и звук (настройка звука запоминается)
    createButton(this, centerX - 150, 1180, 'ГАРДЕРОБ', () => this.openWardrobe(), { width: 280, height: 96, fontSize: 34 });
    this.soundButton = createButton(this, centerX + 150, 1180, '', () => {
      Sound.setMuted(!Sound.muted);
      this.updateSoundLabel();
    }, { width: 280, height: 96, fontSize: 34 });
    this.updateSoundLabel();

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
      this.input.keyboard.on('keydown-ENTER', this.startGame, this);
      this.input.keyboard.on('keydown-SPACE', this.startGame, this);
      this.events.once('shutdown', () => {
        this.input.keyboard.off('keydown-ENTER', this.startGame, this);
        this.input.keyboard.off('keydown-SPACE', this.startGame, this);
      });
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
    createText(this, centerX, 238, 'СПИДозный\nЦГБ', 92, CONFIG.COLORS.INK, { lineSpacing: -8 });
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
    // героиня в выбранной форме дышит
    const skin = Progress.getSkin().texture;
    this.heroine = this.add.sprite(centerX, 600, skin).setScale(scale).play(skin + '-idle');
    this.add.image(centerX + 225, 650, CONFIG.BONUS.TEXTURE).setScale(scale);
  }

  // «Памятка»: подсказка, задания на смену и рекорд на карточке-побелке
  createMemo(centerX) {
    const C = CONFIG.COLORS;
    const card = this.add.graphics();
    drawPlate(card, centerX, 820, 640, 280, C.PAPER, C.PAPER_SHADE);
    createText(this, centerX, 712, 'Управляй джойстиком внизу экрана', 30);
    createText(this, centerX, 756, 'Задания на смену:', 26, C.PAINT_LINE);
    this.registry.get('missions').forEach((id, i) => {
      const mission = CONFIG.MISSIONS.LIST.find((m) => m.id === id);
      createText(this, centerX, 792 + i * 32, '- ' + mission.text + ' (+' + CONFIG.MISSIONS.POINTS + ')', 24, C.INK);
    });
    createText(this, centerX, 912, 'Рекорд: ' + getBestScore(), 38, C.STAMP);
  }

  updateSoundLabel() {
    this.soundButton.label.setText(Sound.muted ? 'ЗВУК: ВЫКЛ' : 'ЗВУК: ВКЛ');
  }

  layout() {
    const height = this.scale.height;
    this.cameras.main.setSize(CONFIG.WIDTH, height);
    this.floor.setSize(CONFIG.WIDTH, height);
    fitContainer(this.content, height, MENU_BLOCK_HEIGHT);
    if (this.wardrobe) {
      fitContainer(this.wardrobe.content, height, WARDROBE_BLOCK_HEIGHT);
    }
  }

  // ---------------------------------------------------------------
  // Гардероб: форма героини и штампы. Закрытое — с условием открытия
  // ---------------------------------------------------------------

  openWardrobe() {
    if (this.wardrobe) {
      return;
    }
    const C = CONFIG.COLORS;
    const data = Progress.load();
    const current = Progress.getSkin().key;
    const items = [];

    // Затемнение перехватывает нажатия по меню
    const shade = this.add.rectangle(CONFIG.WIDTH / 2, 0, CONFIG.WIDTH, CONFIG.MAX_HEIGHT * 2, C.INK, 0.8).setInteractive();
    const card = this.add.graphics();
    drawPlate(card, 0, 0, 640, 1100, C.PAPER, C.PAPER_SHADE, 8);
    items.push(card, createText(this, 0, -490, 'ГАРДЕРОБ', 60));

    // Форма: строка = фигурка, название и состояние; нажатие — надеть
    CONFIG.SKINS.forEach((skin, i) => {
      const y = -390 + i * 104;
      const open = Progress.isUnlocked(skin, data);
      const worn = skin.key === current;
      const row = this.add.rectangle(0, y, 580, 96, worn ? C.PAINT : C.PAPER_SHADE, worn ? 1 : 0.35);
      const figure = this.add.sprite(-230, y, skin.texture).play(skin.texture + '-idle');
      if (!open) {
        figure.setTintFill(C.PAINT_LINE); // закрыто — тёмный силуэт
      }
      const name = createText(this, -170, y - 16, skin.name, 32).setOrigin(0, 0.5);
      const status = createText(this, -170, y + 20, worn ? 'надета' : (open ? 'нажми, чтобы надеть' : 'закрыто: ' + skin.unlock.text),
        22, open ? C.PAINT_LINE : C.STAMP).setOrigin(0, 0.5);
      if (open && !worn) {
        row.setInteractive({ useHandCursor: true }).on('pointerup', () => {
          Sound.play('click');
          Progress.setSkin(skin.key);
          this.closeWardrobe();
          this.scene.restart(); // меню заново — героиня уже в новой форме
        });
      }
      items.push(row, figure, name, status);
    });

    // Штампы для экрана поражения
    items.push(createText(this, 0, 145, 'Штампы на экране поражения', 28, C.PAINT_LINE));
    CONFIG.STAMPS.forEach((stamp, i) => {
      const open = Progress.isUnlocked(stamp, data);
      items.push(createText(this, 0, 190 + i * 36, open ? stamp.text : 'закрыто: ' + stamp.unlock.text, 26, open ? C.STAMP : C.PAINT_LINE));
    });
    items.push(createText(this, 0, 355, 'Смен: ' + data.games + '   таблеток: ' + data.totalPills + '   заданий: ' + data.totalMissions, 22, C.PAINT_LINE));

    const close = createButton(this, 0, 460, 'ГОТОВО', () => this.closeWardrobe(), { width: 320, height: 100, fontSize: 40, primary: true });
    const content = this.add.container(0, 0, items.concat(buttonParts(close)));
    this.wardrobe = { shade, content };
    this.layout();
  }

  closeWardrobe() {
    if (!this.wardrobe) {
      return;
    }
    this.wardrobe.shade.destroy();
    this.wardrobe.content.destroy();
    this.wardrobe = null;
  }

  // На iPhone в Safari подсказываем, как запустить игру на весь экран
  createHomeScreenHint(centerX) {
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone = window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    if (isIos && !isStandalone) {
      createText(this, centerX, 1275, 'На весь экран: «Поделиться» → «На экран „Домой“»', 24, CONFIG.COLORS.PAPER)
        .setBackgroundColor(colorToCss(CONFIG.COLORS.INK)).setPadding(14, 6, 14, 8);
    }
  }

  startGame() {
    if (this.wardrobe) {
      return; // в гардеробе Enter/Пробел не запускают игру
    }
    this.scene.start('GameScene');
  }
}
