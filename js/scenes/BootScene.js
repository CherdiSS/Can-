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
    this.load.image(CONFIG.PLAYER.TEXTURE, CONFIG.PLAYER.SPRITE);
    this.load.image(CONFIG.BONUS.TEXTURE, CONFIG.BONUS.SPRITE);
    CONFIG.CHASER.ROLES.forEach((role) => {
      this.load.image(role.texture, role.sprite);
    });

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

    // Ждём пиксельный шрифт: иначе первые надписи нарисуются запасным шрифтом
    this.waitForFont().then(() => this.scene.start('MenuScene'));
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
