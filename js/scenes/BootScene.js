// =============================================================
// BootScene — первая сцена. Загружает пиксельные спрайты:
// героиню-врача, трёх врагов-пациентов и бонус-таблетку (assets/sprites/).
// Все спрайты нарисованы в итоговом размере и выводятся без масштабирования.
// =============================================================

// Картинки окружения из assets/environment/ (ключ в игре — 'env-' + имя файла)
const ENV_IMAGES = ['floor_tile', 'wall_north', 'wall_side', 'wall_bottom', 'decal_seam', 'decal_wear', 'decal_mat',
  'decal_stain', 'decal_tear', 'decal_crack'];

class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Героиня и пациенты — листы кадров анимации (12 кадров 64×64 в ряд)
    const frame = { frameWidth: CONFIG.ANIMATION.FRAME_SIZE, frameHeight: CONFIG.ANIMATION.FRAME_SIZE };
    this.load.spritesheet(CONFIG.PLAYER.TEXTURE, CONFIG.PLAYER.SPRITE, frame);
    CONFIG.SKINS.filter((skin) => skin.texture !== CONFIG.PLAYER.TEXTURE)
      .forEach((skin) => this.load.spritesheet(skin.texture, skin.sprite, frame));
    CONFIG.CHASER.ROLES.forEach((role) => {
      this.load.spritesheet(role.texture, role.sprite, frame);
    });
    Object.values(CONFIG.NPC).forEach((npc) => this.load.spritesheet(npc.texture, npc.sprite, frame));
    this.load.image(CONFIG.BONUS.TEXTURE, CONFIG.BONUS.SPRITE);
    Object.values(CONFIG.PILLS.TYPES).forEach((pill) => this.load.image(pill.texture, pill.sprite));

    // Окружение поликлиники: пол, стены, детали пола и предметы-препятствия
    const env = CONFIG.ENVIRONMENT;
    ENV_IMAGES
      .forEach((key) => this.load.image('env-' + key, env.PATH + key + '.png'));
    env.LOOKS.forEach((look) => this.load.image('obstacle-' + look, env.PATH + 'obstacle_' + look + '.png'));

    // Пиксельные элементы интерфейса: кольцо у ног врага и стрелка у края экрана
    this.load.image('ui-ring', 'assets/ui/ring.png');
    this.load.image('ui-arrow', 'assets/ui/arrow.png');
    this.load.image('ui-arrow-diag', 'assets/ui/arrow_diag.png');
    this.load.image('ui-puddle', 'assets/ui/puddle.png');
    this.load.image('ui-medcard', 'assets/ui/medcard.png');
    this.load.image('ui-medkit', 'assets/ui/medkit.png');
    this.load.image('ui-stairs', 'assets/ui/stairs.png');
    this.load.image('ui-tube', 'assets/ui/tube.png');
  }

  create() {
    // Фильтр NEAREST: при любом масштабировании пиксели остаются чёткими, без размытия
    const keys = [CONFIG.PLAYER.TEXTURE, CONFIG.BONUS.TEXTURE]
      .concat(CONFIG.SKINS.filter((skin) => skin.texture !== CONFIG.PLAYER.TEXTURE).map((skin) => skin.texture))
      .concat(Object.values(CONFIG.PILLS.TYPES).map((pill) => pill.texture))
      .concat(CONFIG.CHASER.ROLES.map((role) => role.texture))
      .concat(ENV_IMAGES
        .map((key) => 'env-' + key))
      .concat(CONFIG.ENVIRONMENT.LOOKS.map((look) => 'obstacle-' + look))
      .concat(Object.values(CONFIG.NPC).map((npc) => npc.texture))
      .concat(['ui-ring', 'ui-arrow', 'ui-arrow-diag', 'ui-puddle', 'ui-medcard', 'ui-medkit', 'ui-stairs', 'ui-tube']);
    keys.forEach((key) => {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    });

    CONFIG.SKINS.forEach((skin) => this.createCharacterAnimations(skin.texture, CONFIG.PLAYER.RUN_FPS));
    CONFIG.CHASER.ROLES.forEach((role) => this.createCharacterAnimations(role.texture, role.runFps));
    Object.values(CONFIG.NPC).forEach((npc) => this.createCharacterAnimations(npc.texture, npc.runFps));

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
