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
    this.createEnemyTextures();
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

  // Формы врагов: Охотник — стрела, Перехватчик — ромб, Загонщик — шестиугольник.
  // Ядро рисуется отдельной картинкой (Chaser смещает его в сторону движения).
  createEnemyTextures() {
    CONFIG.CHASER.ROLES.forEach((role) => {
      const points = this.getEnemyShape(role.key, role.size);
      this.createPolygonTexture(role.texture, role.size, role.color, points);
    });

    // Белое ядро — Chaser окрашивает его в цвет роли через setTint
    const coreSize = 20;
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(coreSize / 2, coreSize / 2, coreSize / 2);
    graphics.generateTexture('enemy-core', coreSize, coreSize);
    graphics.destroy();
  }

  // Вершины фигуры внутри квадрата size×size (отступ под толщину контура)
  getEnemyShape(key, size) {
    const pad = 4;
    const c = size / 2;
    const r = c - pad;

    if (key === 'hunter') {
      // Стрела, остриём вправо (угол 0 — направление движения)
      return [
        { x: size - pad, y: c },
        { x: pad, y: pad + 2 },
        { x: size * 0.3, y: c },
        { x: pad, y: size - pad - 2 }
      ];
    }

    if (key === 'interceptor') {
      // Ромб
      return [
        { x: c, y: pad },
        { x: size - pad, y: c },
        { x: c, y: size - pad },
        { x: pad, y: c }
      ];
    }

    // Шестиугольник
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 3 * i;
      points.push({ x: c + Math.cos(angle) * r, y: c + Math.sin(angle) * r });
    }
    return points;
  }

  // Неоновый многоугольник: полупрозрачная заливка и яркий контур
  createPolygonTexture(key, size, color, points) {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(color, 0.25);
    graphics.fillPoints(points, true);
    graphics.lineStyle(5, color, 1);
    graphics.strokePoints(points, true);
    graphics.generateTexture(key, size, size);
    graphics.destroy();
  }
}
