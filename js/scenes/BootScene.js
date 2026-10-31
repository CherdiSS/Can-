// =============================================================
// BootScene — первая сцена. Внешних картинок нет, поэтому здесь
// мы рисуем простые фигуры и превращаем их в текстуры.
// =============================================================

class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    this.createCircleTexture('player', CONFIG.PLAYER.SIZE, CONFIG.COLORS.PLAYER);
    this.createCircleTexture('chaser', CONFIG.CHASER.SIZE, CONFIG.COLORS.CHASER);
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
}
