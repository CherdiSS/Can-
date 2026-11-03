// =============================================================
// BootScene — первая сцена. Загружает пиксельные спрайты:
// героиню-врача, трёх врагов-пациентов и бонус-таблетку (assets/sprites/).
// Все спрайты нарисованы в итоговом размере и выводятся без масштабирования.
// =============================================================

class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Героиня и пациенты — листы кадров анимации (12 кадров 64×64 в ряд)
    const frame = { frameWidth: CONFIG.ANIMATION.FRAME_SIZE, frameHeight: CONFIG.ANIMATION.FRAME_SIZE };
    this.load.spritesheet(CONFIG.PLAYER.TEXTURE, CONFIG.PLAYER.SPRITE, frame);
    CONFIG.CHASER.ROLES.forEach((role) => {
      this.load.spritesheet(role.texture, role.sprite, frame);
    });
    this.load.image(CONFIG.BONUS.TEXTURE, CONFIG.BONUS.SPRITE);

    // Окружение поликлиники: пол, стены, детали пола и предметы-препятствия
    const env = CONFIG.ENVIRONMENT;
    ['floor_tile', 'wall_north', 'wall_side', 'wall_bottom', 'decal_seam', 'decal_wear', 'decal_mat']
      .forEach((key) => this.load.image('env-' + key, env.PATH + key + '.png'));
    env.LOOKS.forEach((look) => this.load.image('obstacle-' + look, env.PATH + 'obstacle_' + look + '.png'));

    // Пиксельные элементы интерфейса: кольцо у ног врага и стрелка у края экрана
    this.load.image('ui-ring', 'assets/ui/ring.png');
    this.load.image('ui-arrow', 'assets/ui/arrow.png');
    this.load.image('ui-arrow-diag', 'assets/ui/arrow_diag.png');
  }

  create() {
    // Фильтр NEAREST: при любом масштабировании пиксели остаются чёткими, без размытия
    const keys = [CONFIG.PLAYER.TEXTURE, CONFIG.BONUS.TEXTURE]
      .concat(CONFIG.CHASER.ROLES.map((role) => role.texture))
      .concat(['floor_tile', 'wall_north', 'wall_side', 'wall_bottom', 'decal_seam', 'decal_wear', 'decal_mat']
        .map((key) => 'env-' + key))
      .concat(CONFIG.ENVIRONMENT.LOOKS.map((look) => 'obstacle-' + look))
      .concat(['ui-ring', 'ui-arrow', 'ui-arrow-diag']);
    keys.forEach((key) => {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    });

    this.createCharacterAnimations(CONFIG.PLAYER.TEXTURE, CONFIG.PLAYER.RUN_FPS);
    CONFIG.CHASER.ROLES.forEach((role) => this.createCharacterAnimations(role.texture, role.runFps));

    // Ждём пиксельный шрифт: иначе первые надписи нарисуются запасным шрифтом
    this.waitForFont().then(() => this.scene.start('MenuScene'));
  }

  // Анимации одного персонажа: <ключ>-idle, -run, -back-idle, -back-run
  createCharacterAnimations(key, runFps) {
    const A = CONFIG.ANIMATION;
    const make = (suffix, [start, end], frameRate) => {
      this.anims.create({
        key: key + suffix,
        frames: this.anims.generateFrameNumbers(key, { start: start, end: end }),
        frameRate: frameRate,
        repeat: -1
      });
    };
    make('-idle', A.FRAMES.IDLE, A.IDLE_FPS);
    make('-run', A.FRAMES.RUN, runFps);
    make('-back-idle', A.FRAMES.BACK_IDLE, A.IDLE_FPS);
    make('-back-run', A.FRAMES.BACK_RUN, runFps);
  }

  waitForFont() {
    if (!document.fonts || !document.fonts.load) {
      return Promise.resolve();
    }
    const sample = 'Счёт Score 0123';
    const loading = document.fonts.load('32px "Tiny5"', sample).catch(() => {});
    // Если шрифт не загрузился за 3 секунды — играем с запасным
    const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
    return Promise.race([loading, timeout]);
  }
}
