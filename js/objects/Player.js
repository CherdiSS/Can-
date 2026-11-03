// =============================================================
// Игрок — героиня-врач (пиксельный лист кадров с анимацией бега и дыхания).
// Физическое тело — круг меньше картинки, поэтому столкновения «прощающие».
// =============================================================

class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    // Форма из гардероба (CONFIG.SKINS): у каждой свой лист кадров и анимации
    super(scene, x, y, Progress.getSkin().texture);

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

    // Уворот: короткий рывок с перезарядкой, пока он идёт — пациенты не ловят
    this.dodgeTimer = 0;
    this.dodgeCooldown = 0;
    this.dodgeDirection = new Phaser.Math.Vector2(0, 1);
    this.invulnerableTimer = 0; // неуязвимость после того, как маска спасла
    this.speedBoost = 1;        // валидол ускоряет
    this.wet = false;           // мокрый пол после санитарки: скользит и заносит
  }

  isDodging() {
    return this.dodgeTimer > 0;
  }

  isInvulnerable() {
    return this.dodgeTimer > 0 || this.invulnerableTimer > 0;
  }

  // Уворот в сторону ввода (или туда, куда бежит / смотрит). false — ещё перезаряжается
  tryDodge(inputX, inputY) {
    const D = CONFIG.DODGE;
    if (this.dodgeCooldown > 0 || this.dodgeTimer > 0) {
      return false;
    }
    let dx = inputX;
    let dy = inputY;
    if (Math.hypot(dx, dy) < 0.1) {
      dx = this.moveVelocity.x;
      dy = this.moveVelocity.y;
    }
    if (Math.hypot(dx, dy) < 0.1) {
      dx = this.flipX ? -1 : 1;
      dy = 0;
    }
    const length = Math.hypot(dx, dy);
    this.dodgeDirection.set(dx / length, dy / length);
    this.dodgeTimer = D.DURATION;
    this.dodgeCooldown = D.COOLDOWN;
    return true;
  }

  // inputX / inputY — направление и сила (длина вектора от 0 до 1).
  // Чёткое управление: направление меняется сразу (без дуги через ноль),
  // разгон быстрый, торможение ещё быстрее — героиня почти не «доезжает».
  move(inputX, inputY, dt) {
    const P = CONFIG.PLAYER;
    const velocity = this.moveVelocity;
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    // Мигание, пока неуязвима после маски
    this.setAlpha(this.invulnerableTimer > 0 && Math.floor(this.invulnerableTimer * 10) % 2 === 0 ? 0.35 : 1);

    // Во время уворота — быстрый рывок по направлению, ввод не учитывается
    if (this.dodgeTimer > 0) {
      this.dodgeTimer -= dt;
      const dodgeSpeed = P.SPEED * CONFIG.DODGE.SPEED_FACTOR;
      velocity.set(this.dodgeDirection.x * dodgeSpeed, this.dodgeDirection.y * dodgeSpeed);
      if (this.dodgeTimer <= 0) {
        // после рывка — обычная скорость в ту же сторону, без «доезда»
        velocity.set(this.dodgeDirection.x * P.SPEED, this.dodgeDirection.y * P.SPEED);
      }
      this.body.setVelocity(velocity.x, velocity.y);
      animateCharacter(this, velocity.x, velocity.y, P.SPEED);
      return;
    }

    const inputLength = Math.hypot(inputX, inputY);
    const targetSpeed = Math.min(1, inputLength) * P.SPEED * this.speedBoost;
    let speed = velocity.length();

    if (this.wet) {
      // Мокрый пол: вектор скорости меняется плавно — занос на поворотах и долгий «доезд»
      const W = CONFIG.PUDDLE;
      const tx = inputLength > 0 ? inputX / inputLength * targetSpeed : 0;
      const ty = inputLength > 0 ? inputY / inputLength * targetSpeed : 0;
      const rate = targetSpeed > 0 ? P.ACCELERATION * W.SLIP_ACCEL : P.DECELERATION * W.SLIP_DECEL;
      const k = 1 - Math.exp(-rate * dt);
      velocity.x += (tx - velocity.x) * k;
      velocity.y += (ty - velocity.y) * k;
    } else if (targetSpeed > 0) {
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
