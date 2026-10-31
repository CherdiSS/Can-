// =============================================================
// Преследователь — неоново-красный круг.
// Двигается к игроку с инерцией (плавно поворачивает),
// отталкивается от других преследователей и скользит вдоль препятствий.
// =============================================================

class Chaser extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, speedFactor) {
    super(scene, x, y, 'chaser');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const radius = CONFIG.CHASER.HITBOX_RADIUS;
    const half = CONFIG.CHASER.SIZE / 2;
    this.body.setCircle(radius, half - radius, half - radius);

    this.setCollideWorldBounds(true);
    this.setDepth(9);

    // Доля от скорости игрока (0.8, 0.9 или 0.95)
    this.speedFactor = speedFactor;

    // Текущая скорость врага (меняется плавно — отсюда инерция)
    this.moveVelocity = new Phaser.Math.Vector2(0, 0);

    // Данные для скольжения вдоль препятствия
    this.slideDirection = new Phaser.Math.Vector2(0, 0);
    this.slideAxis = null; // 'x' или 'y' — вдоль какой оси скользим
    this.slideTime = 0;
  }

  // Вызывается каждый кадр из GameScene
  chase(player, chasers, dt, speedMultiplier, turnRate) {
    const speed = CONFIG.PLAYER.SPEED * this.speedFactor * speedMultiplier;

    // 1. Направление на игрока
    let dirX = player.x - this.x;
    let dirY = player.y - this.y;
    const length = Math.hypot(dirX, dirY) || 1;
    dirX /= length;
    dirY /= length;

    // 2. Если упёрлись в препятствие — в основном едем вдоль него
    let currentTurnRate = turnRate;
    if (this.slideTime > 0) {
      this.slideTime -= dt;
      dirX = this.slideDirection.x + dirX * 0.3;
      dirY = this.slideDirection.y + dirY * 0.3;
      currentTurnRate = turnRate * 2; // вдоль стены разворачиваемся быстрее
    } else {
      this.slideAxis = null;
    }

    // 3. Отталкивание от других преследователей
    const separation = this.getSeparation(chasers);
    dirX += separation.x;
    dirY += separation.y;

    // 4. Нормализуем итоговое направление
    const dirLength = Math.hypot(dirX, dirY) || 1;
    dirX /= dirLength;
    dirY /= dirLength;

    // 5. Плавный поворот: скорость постепенно тянется к желаемой
    const k = 1 - Math.exp(-currentTurnRate * dt);
    this.moveVelocity.x += (dirX * speed - this.moveVelocity.x) * k;
    this.moveVelocity.y += (dirY * speed - this.moveVelocity.y) * k;

    this.body.setVelocity(this.moveVelocity.x, this.moveVelocity.y);
  }

  // Сумма «отталкивающих» векторов от слишком близких соседей
  getSeparation(chasers) {
    const result = { x: 0, y: 0 };
    const radius = CONFIG.CHASER.SEPARATION_RADIUS;

    chasers.forEach((other) => {
      if (other === this) {
        return;
      }
      let dx = this.x - other.x;
      let dy = this.y - other.y;
      let distance = Math.hypot(dx, dy);

      if (distance >= radius) {
        return;
      }
      // Если стоят ровно в одной точке — толкаем в случайную сторону
      if (distance < 0.001) {
        dx = Math.random() - 0.5;
        dy = Math.random() - 0.5;
        distance = Math.hypot(dx, dy) || 1;
      }
      // Чем ближе сосед, тем сильнее отталкивание
      const strength = ((radius - distance) / radius) * CONFIG.CHASER.SEPARATION_FORCE;
      result.x += (dx / distance) * strength;
      result.y += (dy / distance) * strength;
    });

    return result;
  }

  // Вызывается коллайдером при касании препятствия.
  // bounds — прямоугольник препятствия, player — игрок.
  startSliding(bounds, player) {
    const centerX = this.body.center.x;
    const centerY = this.body.center.y;

    // Ближайшая к врагу точка препятствия подсказывает, о какую грань ударились
    const closestX = Phaser.Math.Clamp(centerX, bounds.left, bounds.right);
    const closestY = Phaser.Math.Clamp(centerY, bounds.top, bounds.bottom);
    const normalX = centerX - closestX;
    const normalY = centerY - closestY;

    // Боковая (вертикальная) грань — скользим вверх/вниз, иначе — влево/вправо
    const axis = Math.abs(normalX) >= Math.abs(normalY) ? 'y' : 'x';

    // Если уже скользим вдоль этой же грани — просто продлеваем скольжение
    if (this.slideTime > 0 && this.slideAxis === axis) {
      this.slideTime = CONFIG.CHASER.SLIDE_TIME;
      return;
    }

    if (axis === 'y') {
      // Сравниваем путь «через верхний край» и «через нижний край» до игрока
      const costUp = Math.abs(centerY - bounds.top) +
        Phaser.Math.Distance.Between(centerX, bounds.top, player.x, player.y);
      const costDown = Math.abs(bounds.bottom - centerY) +
        Phaser.Math.Distance.Between(centerX, bounds.bottom, player.x, player.y);
      this.slideDirection.set(0, costUp <= costDown ? -1 : 1);
    } else {
      const costLeft = Math.abs(centerX - bounds.left) +
        Phaser.Math.Distance.Between(bounds.left, centerY, player.x, player.y);
      const costRight = Math.abs(bounds.right - centerX) +
        Phaser.Math.Distance.Between(bounds.right, centerY, player.x, player.y);
      this.slideDirection.set(costLeft <= costRight ? -1 : 1, 0);
    }

    this.slideAxis = axis;
    this.slideTime = CONFIG.CHASER.SLIDE_TIME;
  }
}
