// =============================================================
// Персонажи поликлиники, которые не ловят героиню:
//   санитарка — ходит по коридорам и оставляет мокрые лужи (скользко);
//   бабушка — медленно топчется в очереди и загораживает проход (твёрдая).
// Выходят из двери кабинета, идут к своему маршруту и ходят по нему по кругу.
// Маршруты в CONFIG.NPC проверены: на отрезках нет препятствий.
// =============================================================

class Npc extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, key, x, y) {
    const cfg = CONFIG.NPC[key];
    super(scene, x, y, cfg.texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.key = key;
    this.cfg = cfg;

    const radius = cfg.hitboxRadius || 22;
    const half = CONFIG.ANIMATION.FRAME_SIZE / 2;
    this.body.setCircle(radius, half - radius, half - radius);
    if (cfg.hitboxRadius) {
      // Бабушку не сдвинуть: героиня и пациенты её обходят
      this.body.setImmovable(true);
      this.body.pushable = false;
    }
    this.setDepth(9);

    // От двери — на «улицу» коридора (y = 180), затем подход к маршруту и сам маршрут по кругу
    this.route = [[x, 180]].concat(cfg.approach || []);
    const join = this.route[this.route.length - 1];
    this.loopIndex = 0;
    let best = Infinity;
    cfg.path.forEach(([px, py], i) => {
      const d = Math.hypot(px - join[0], py - join[1]);
      if (d < best) {
        best = d;
        this.loopIndex = i;
      }
    });

    this.phraseTimer = 3 + Math.random() * 3;
  }

  // Следующая точка пути
  currentTarget() {
    return this.route.length ? this.route[0] : this.cfg.path[this.loopIndex];
  }

  updateNpc(dt) {
    const [tx, ty] = this.currentTarget();
    const dx = tx - this.x;
    const dy = ty - this.y;
    const distance = Math.hypot(dx, dy);
    const step = this.cfg.speed * dt;

    if (distance <= Math.max(4, step)) {
      // Дошёл до точки — следующая
      if (this.route.length) {
        this.route.shift();
      } else {
        this.loopIndex = (this.loopIndex + 1) % this.cfg.path.length;
      }
    }
    const vx = distance > 0.5 ? dx / distance * this.cfg.speed : 0;
    const vy = distance > 0.5 ? dy / distance * this.cfg.speed : 0;
    this.body.setVelocity(vx, vy);

    if (vx < -5) {
      this.setFlipX(true);
    } else if (vx > 5) {
      this.setFlipX(false);
    }
    animateCharacter(this, vx, vy, this.cfg.speed);

    // Иногда что-нибудь говорит (возвращает фразу — сцена покажет её над головой)
    this.phraseTimer -= dt;
    if (this.phraseTimer <= 0) {
      this.phraseTimer = 6 + Math.random() * 4;
      return Phaser.Utils.Array.GetRandom(this.cfg.phrases);
    }
    return null;
  }
}
