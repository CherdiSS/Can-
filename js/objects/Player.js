// =============================================================
// Игрок — героиня-врач (пиксельный лист кадров с анимацией бега и дыхания).
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

  // inputX / inputY — направление и сила (длина вектора от 0 до 1).
  // Чёткое управление: направление меняется сразу (без дуги через ноль),
  // разгон быстрый, торможение ещё быстрее — героиня почти не «доезжает».
  move(inputX, inputY, dt) {
    const P = CONFIG.PLAYER;
    const velocity = this.moveVelocity;
    const inputLength = Math.hypot(inputX, inputY);
    const targetSpeed = Math.min(1, inputLength) * P.SPEED;
    let speed = velocity.length();

    if (targetSpeed > 0) {
      const rate = targetSpeed > speed ? P.ACCELERATION : P.DECELERATION;
      speed += (targetSpeed - speed) * (1 - Math.exp(-rate * dt));
      velocity.set(inputX / inputLength * speed, inputY / inputLength * speed);
    } else {
      speed *= Math.exp(-P.DECELERATION * dt);
      if (speed < 2) {
        velocity.set(0, 0); // окончательная остановка
      } else {
        velocity.normalize().scale(speed);
      }
    }

    this.body.setVelocity(velocity.x, velocity.y);

    // Спрайт нарисован лицом к зрителю: при движении влево зеркалим, вправо — возвращаем.
    // Порог, чтобы героиня не «дёргалась» при почти вертикальном движении.
    if (velocity.x < -15) {
      this.setFlipX(true);
    } else if (velocity.x > 15) {
      this.setFlipX(false);
    }

    // Бег или дыхание; бежит вверх — вид со спины
    animateCharacter(this, velocity.x, velocity.y, P.SPEED);
  }

  // Полная остановка (при поимке)
  stop() {
    this.moveVelocity.set(0, 0);
    this.body.setVelocity(0, 0);
    this.anims.pause(); // кадр застывает в момент поимки
  }
}
