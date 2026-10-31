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
  }

  create() {
    // Фильтр NEAREST: при любом масштабировании пиксели остаются чёткими, без размытия
    const keys = [CONFIG.PLAYER.TEXTURE, CONFIG.BONUS.TEXTURE]
      .concat(CONFIG.CHASER.ROLES.map((role) => role.texture));
    keys.forEach((key) => {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    });

    this.scene.start('MenuScene');
  }
}
