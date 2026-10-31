// =============================================================
// BootScene — первая сцена. Загружает пиксель-арт врагов,
// а остальные простые фигуры рисует и превращает в текстуры.
// =============================================================

class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    this.load.image('enemy-patient-source', CONFIG.CHASER.SPRITE_SOURCE);
  }

  create() {
    this.createCircleTexture('player', CONFIG.PLAYER.SIZE, CONFIG.COLORS.PLAYER);
    this.createEnemyTexture();
    this.createCircleTexture('bonus', CONFIG.BONUS.SIZE, CONFIG.COLORS.BONUS);

    this.scene.start('MenuScene');
  }

  // Неоновый круг: полупрозрачная заливка, яркий контур и светлое ядро
  createCircleTexture(key, size, color) {
    const radius = size / 2;
    const lineWidth = 5;
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);

    graphics.fillStyle(color, 0.25);
    graphics.fillCircle(radius, radius, radius - lineWidth / 2);

    graphics.lineStyle(lineWidth, color, 1);
    graphics.strokeCircle(radius, radius, radius - lineWidth / 2);

    graphics.fillStyle(color, 1);
    graphics.fillCircle(radius, radius, radius * 0.38);

    graphics.generateTexture(key, size, size);
    graphics.destroy();
  }

  // Текстура врагов: PNG 128×128 уменьшаем до SPRITE_SIZE один раз, без сглаживания,
  // и ставим фильтр NEAREST, чтобы пиксель-арт не размывался
  createEnemyTexture() {
    const size = CONFIG.CHASER.SPRITE_SIZE;
    const source = this.textures.get('enemy-patient-source').getSourceImage();

    const texture = this.textures.createCanvas('enemy-patient', size, size);
    const context = texture.getContext();
    context.imageSmoothingEnabled = false;
    context.drawImage(source, 0, 0, size, size);
    texture.refresh();
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

    this.textures.remove('enemy-patient-source'); // исходник больше не нужен
  }
}
