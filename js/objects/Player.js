// =============================================================
// Игрок — неоново-голубой круг.
// Физическое тело — круг меньше картинки, поэтому столкновения «прощающие».
// =============================================================

class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player');

    // Добавляем спрайт на сцену и в физический мир
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Круглый хитбокс по центру картинки
    const radius = CONFIG.PLAYER.HITBOX_RADIUS;
    const half = CONFIG.PLAYER.SIZE / 2;
    this.body.setCircle(radius, half - radius, half - radius);

    // Игрок не может выйти за пределы арены
    this.setCollideWorldBounds(true);
    this.setDepth(10);

    // Собственная скорость (для очень небольшой инерции)
    this.moveVelocity = new Phaser.Math.Vector2(0, 0);
  }

  // inputX / inputY — направление и сила (длина вектора от 0 до 1)
  move(inputX, inputY, dt) {
    const targetX = inputX * CONFIG.PLAYER.SPEED;
    const targetY = inputY * CONFIG.PLAYER.SPEED;

    // Плавно приближаем скорость к целевой.
    // Формула не зависит от частоты кадров.
    const k = 1 - Math.exp(-CONFIG.PLAYER.ACCELERATION * dt);
    this.moveVelocity.x += (targetX - this.moveVelocity.x) * k;
    this.moveVelocity.y += (targetY - this.moveVelocity.y) * k;

    this.body.setVelocity(this.moveVelocity.x, this.moveVelocity.y);
  }

  // Полная остановка (при поимке)
  stop() {
    this.moveVelocity.set(0, 0);
    this.body.setVelocity(0, 0);
  }
}
