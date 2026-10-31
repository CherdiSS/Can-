// =============================================================
// Бонус — жёлтый круг. На арене одновременно максимум один бонус.
// Когда бонус «спрятан», его физическое тело отключено.
// =============================================================

class Bonus extends Phaser.Physics.Arcade.Sprite {
  constructor(scene) {
    super(scene, 0, 0, 'bonus');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const radius = CONFIG.BONUS.HITBOX_RADIUS;
    const half = CONFIG.BONUS.SIZE / 2;
    this.body.setCircle(radius, half - radius, half - radius);
    this.body.setImmovable(true);
    this.setDepth(5);

    // Сколько секунд бонус лежит на арене в 3-й фазе
    this.age = 0;

    this.hide();
  }

  // Показать бонус в точке (x, y)
  spawn(x, y) {
    this.enableBody(true, x, y, true, true);
    this.age = 0;
    this.setAlpha(1);
  }

  // Спрятать бонус и отключить его тело
  hide() {
    this.disableBody(true, true);
  }

  // Обновляет «время жизни». Возвращает true, если бонус пора убрать.
  // limited = true только в 3-й фазе, когда бонусы исчезают через 5 секунд.
  updateLifetime(dt, limited) {
    if (!this.active || !limited) {
      return false;
    }

    this.age += dt;
    const lifetime = CONFIG.BONUS.LIFETIME_PHASE3;

    // Последние 1.5 секунды бонус мигает — предупреждение игроку
    if (lifetime - this.age < 1.5) {
      this.setAlpha(Math.floor(this.age * 8) % 2 === 0 ? 1 : 0.35);
    }

    return this.age >= lifetime;
  }
}
