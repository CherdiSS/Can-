// =============================================================
// MenuScene — главное меню: название, задания на смену, рекорд,
// кнопка «ИГРАТЬ», звук и гардероб (форма героини и штампы).
// Фон — стена и пол поликлиники (во весь экран, пиксели ×2).
// Экран горизонтальный: слева — название и персонажи, справа — памятка и кнопки.
// Содержимое свёрстано в координатах 1280×720 и лежит в контейнере, который
// центрируется и уменьшается, если экран игры меньше расчётного.
// =============================================================

// Вертикальный центр и высота содержимого меню (в координатах вёрстки)
const MENU_CENTER_Y = 360;
const MENU_BLOCK_WIDTH = 1250;
const MENU_BLOCK_HEIGHT = 720;
const MENU_LEFT_X = 330;   // центр левой колонки
const MENU_RIGHT_X = 930;  // центр правой колонки
const MENU_PIXEL_SCALE = 2; // пиксель-арт в меню — ровно ×2
const WARDROBE_BLOCK_WIDTH = 1220;
const WARDROBE_BLOCK_HEIGHT = 700;

class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const centerX = CONFIG.WIDTH / 2; // центр вёрстки (контейнер потом ставится в центр экрана)
    this.cameras.main.setBackgroundColor(CONFIG.COLORS.BACKGROUND);
    this.wardrobe = null;

    // Задания на эту смену (GameScene возьмёт их из registry)
    this.registry.set('missions', Progress.rollMissions());

    this.createBackground();
    this.vignette = createVignette(this, 0); // тёмные края — над полом, под содержимым меню (добавлена раньше него)

    // Всё, что создано дальше, попадёт в контейнер с вёрсткой
    const firstContentIndex = this.children.list.length;
    this.createTitle(MENU_LEFT_X);
    this.createIllustration(MENU_LEFT_X);
    this.createMemo(MENU_RIGHT_X);

    // Главная кнопка — «Смена» (рогалик по этажам), зелёная, как масляная панель стены
    createButton(this, MENU_RIGHT_X, 412, 'СМЕНА', () => this.startGame('run'), {
      width: 490,
      height: 116,
      fontSize: 58,
      primary: true
    });
    // «Дежурство» — прежний режим на выживание
    createButton(this, MENU_RIGHT_X, 536, 'ДЕЖУРСТВО', () => this.startGame('duty'), { width: 490, height: 84, fontSize: 36 });

    // Гардероб и звук (настройка звука запоминается)
    createButton(this, MENU_RIGHT_X - 125, 658, 'ГАРДЕРОБ', () => this.openWardrobe(), { width: 240, height: 84, fontSize: 30 });
    this.soundButton = createButton(this, MENU_RIGHT_X + 125, 658, '', () => {
      Sound.setMuted(!Sound.muted);
      this.updateSoundLabel();
    }, { width: 240, height: 84, fontSize: 28 });
    this.updateSoundLabel();

    this.createHomeScreenHint(MENU_LEFT_X);

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
      const startRun = () => this.startGame('run'); // клавиша передала бы событие вместо режима
      this.input.keyboard.on('keydown-ENTER', startRun);
      this.input.keyboard.on('keydown-SPACE', startRun);
      this.events.once('shutdown', () => {
        this.input.keyboard.off('keydown-ENTER', startRun);
        this.input.keyboard.off('keydown-SPACE', startRun);
      });
    }
  }

  // Пол поликлиники на весь экран и стена с дверями кабинетов сверху
  createBackground() {
    this.floor = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'env-floor_tile')
      .setOrigin(0).setTileScale(MENU_PIXEL_SCALE);
    this.wall = this.add.image(this.scale.width / 2, 0, 'env-wall_north').setOrigin(0.5, 0).setScale(MENU_PIXEL_SCALE);
  }

  // Название — на табличке, как на дверях кабинетов
  createTitle(centerX) {
    const plate = this.add.graphics();
    drawPlate(plate, centerX, 150, 560, 210, CONFIG.COLORS.PAPER, CONFIG.COLORS.PAPER_SHADE, 8);
    createText(this, centerX, 143, 'СПИДозный\nЦГБ', 84, CONFIG.COLORS.INK, { lineSpacing: -8 });
  }

  // «Картинка» из персонажей игры: героиня-врач, три пациента и таблетка (с анимацией)
  createIllustration(centerX) {
    const scale = MENU_PIXEL_SCALE;
    const ring = CONFIG.CHASER.RING;
    // Загонщик, Охотник, Перехватчик — у каждого пиксельное кольцо цвета роли
    [[centerX - 160, 405, 2], [centerX, 360, 0], [centerX + 160, 405, 1]].forEach(([x, y, roleIndex]) => {
      const role = CONFIG.CHASER.ROLES[roleIndex];
      this.add.image(x, y + ring.OFFSET_Y * scale, 'ui-ring').setScale(scale).setTint(role.color);
      // пациенты бегут на месте, у каждого — своя походка
      this.add.sprite(x, y, role.texture).setScale(scale).setFlipX(x < centerX).play(role.texture + '-run');
    });
    // героиня в выбранной форме дышит
    const skin = Progress.getSkin().texture;
    this.heroine = this.add.sprite(centerX, 490, skin).setScale(scale).play(skin + '-idle');
    this.add.image(centerX + 215, 535, CONFIG.BONUS.TEXTURE).setScale(scale);
  }

  // «Памятка»: подсказка, задания на смену и рекорд на карточке-побелке
  createMemo(centerX) {
    const C = CONFIG.COLORS;
    const card = this.add.graphics();
    drawForm(this, card, centerX, 190, 620, 300);
    createText(this, centerX, 68, 'Смена: 5 этажей, разнеси медкарты', 24);
    createText(this, centerX, 96, 'Дежурство: продержись подольше', 24);
    createText(this, centerX, 122, 'Слева — бег, справа внизу — уворот', 20, C.PAINT_LINE);
    createText(this, centerX, 154, 'Задания:', 24, C.PAINT_LINE);
    this.registry.get('missions').forEach((id, i) => {
      const mission = CONFIG.MISSIONS.LIST.find((m) => m.id === id);
      createText(this, centerX, 184 + i * 28, '- ' + mission.text + ' (+' + CONFIG.MISSIONS.POINTS + ')', 24, C.INK);
    });
    const bestFloor = Progress.load().bestFloor;
    createText(this, centerX, 292, 'Рекорд: ' + getBestScore() + (bestFloor ? '  ·  этаж ' + bestFloor : ''), 32, C.STAMP);
  }

  updateSoundLabel() {
    this.soundButton.label.setText(Sound.muted ? 'ЗВУК: ВЫКЛ' : 'ЗВУК: ВКЛ');
  }

  layout() {
    const { width, height } = this.scale;
    this.cameras.main.setSize(width, height);
    this.floor.setSize(width, height);
    this.wall.setX(width / 2);
    fitContainer(this.content, this.scale, MENU_BLOCK_HEIGHT, MENU_BLOCK_WIDTH);
    if (this.wardrobe) {
      this.wardrobe.shade.setPosition(width / 2, height / 2);
      fitContainer(this.wardrobe.content, this.scale, WARDROBE_BLOCK_HEIGHT, WARDROBE_BLOCK_WIDTH);
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
    const shade = this.add.rectangle(0, 0, CONFIG.MAX_WIDTH * 2, CONFIG.HEIGHT * 2, C.INK, 0.8).setInteractive();
    const card = drawForm(this, this.add.graphics(), 0, 0, 1200, 680, '025/у');
    items.push(card, card.formLabel, createText(this, 0, -290, 'ГАРДЕРОБ', 56));

    // Слева — форма: строка = фигурка, название и состояние; нажатие — надеть
    const lx = -280;
    CONFIG.SKINS.forEach((skin, i) => {
      const y = -195 + i * 96;
      const open = Progress.isUnlocked(skin, data);
      const worn = skin.key === current;
      const row = this.add.rectangle(lx, y, 580, 88, worn ? C.PAINT : C.PAPER_SHADE, worn ? 1 : 0.35);
      const figure = this.add.sprite(lx - 230, y, skin.texture).play(skin.texture + '-idle');
      if (!open) {
        figure.setTintFill(C.PAINT_LINE); // закрыто — тёмный силуэт
      }
      const name = createText(this, lx - 170, y - 16, skin.name, 30).setOrigin(0, 0.5);
      const status = createText(this, lx - 170, y + 18, worn ? 'надета' : (open ? 'нажми, чтобы надеть' : 'закрыто: ' + skin.unlock.text),
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

    // Справа — штампы для экрана поражения и статистика
    const rx = 300;
    items.push(createText(this, rx, -195, 'Штампы на экране поражения', 28, C.PAINT_LINE));
    CONFIG.STAMPS.forEach((stamp, i) => {
      const open = Progress.isUnlocked(stamp, data);
      items.push(createText(this, rx, -145 + i * 42, open ? stamp.text : 'закрыто: ' + stamp.unlock.text, 26, open ? C.STAMP : C.PAINT_LINE));
    });
    items.push(createText(this, rx, 60, 'Смен: ' + data.games + '   таблеток: ' + data.totalPills + '   заданий: ' + data.totalMissions, 22, C.PAINT_LINE));

    const close = createButton(this, rx, 210, 'ГОТОВО', () => this.closeWardrobe(), { width: 320, height: 100, fontSize: 40, primary: true });
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
      createText(this, centerX, 650, 'На весь экран:\n«Поделиться» → «На экран „Домой“»', 22, CONFIG.COLORS.PAPER)
        .setBackgroundColor(colorToCss(CONFIG.COLORS.INK)).setPadding(14, 6, 14, 8);
    }
  }

  // mode: 'run' — «Смена» (по умолчанию, и для Enter/Пробела), 'duty' — «Дежурство»
  startGame(mode = 'run') {
    if (this.wardrobe) {
      return; // в гардеробе Enter/Пробел не запускают игру
    }
    if (mode === 'run') {
      Run.start(this.registry);
    } else {
      this.registry.set('mode', 'duty');
    }
    this.scene.start('GameScene');
  }
}
