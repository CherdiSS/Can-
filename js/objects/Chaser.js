// =============================================================
// Преследователь. У каждого врага своя роль (см. CONFIG.CHASER.ROLES):
//   Охотник      — гонится прямо за игроком, очень поворотлив;
//   Перехватчик  — целится в точку впереди игрока;
//   Загонщик     — держится между игроком и бонусом / центром арены.
// После 50-й секунды враги делают рывки (Dash):
//   погоня → телеграф (предупреждение) → рывок → восстановление → погоня.
// Хитбокс у всех — круг одного размера, форма влияет только на картинку.
// =============================================================

class Chaser extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, role) {
    super(scene, role.start.x, role.start.y, role.texture);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.role = role;

    // Круглый хитбокс по центру картинки
    const radius = CONFIG.CHASER.HITBOX_RADIUS;
    const half = role.size / 2;
    this.body.setCircle(radius, half - radius, half - radius);

    this.setCollideWorldBounds(true);
    this.setDepth(9);

    // Текущая скорость врага (меняется плавно — отсюда инерция)
    this.moveVelocity = new Phaser.Math.Vector2(0, 0);

    // Скольжение вдоль препятствия
    this.slideDirection = new Phaser.Math.Vector2(0, 0);
    this.slideAxis = null;
    this.slideTime = 0;

    // Точка, к которой враг сейчас идёт (зависит от роли)
    this.target = new Phaser.Math.Vector2(role.start.x, role.start.y);

    // Рывок: 'chase' | 'telegraph' | 'dash'
    this.dashState = 'chase';
    this.stateTimer = 0;
    this.dashCooldown = role.dash.firstDelay; // отсчитывается только после 50-й секунды
    this.recoveryTimer = 0;                   // время «восстановления» после рывка
    this.dashDirection = new Phaser.Math.Vector2(1, 0);
    this.lastDashInterval = 0;
    this.pathLine = new Phaser.Geom.Line();

    // Светящееся ядро (отдельная картинка, смещается в сторону движения)
    this.core = scene.add.image(this.x, this.y, 'enemy-core').setTint(role.color).setDepth(10);

    // Шлейф и подсказки рывка рисуем в своей графике под врагом
    this.fx = scene.add.graphics().setDepth(8);
    this.trail = [];
    this.trailTimer = 0;
  }

  // ---------------------------------------------------------------
  // Главный метод: вызывается каждый кадр из GameScene.
  // ctx — общие данные кадра (игрок, враги, бонус, сложность и т.д.)
  // ---------------------------------------------------------------
  updateChaser(ctx) {
    const role = this.role;
    const dt = ctx.dt;

    // Постоянная скорость с потолком 0.97 от скорости игрока
    const speedCap = CONFIG.PLAYER.SPEED * CONFIG.DIFFICULTY.MAX_ENEMY_SPEED_FACTOR;
    const speed = Math.min(CONFIG.PLAYER.SPEED * role.speedFactor * ctx.speedMultiplier, speedCap);
    const turnRate = Phaser.Math.Linear(role.turnBase, role.turnMax, ctx.turnProgress);

    this.updateTarget(ctx);

    if (this.dashState === 'telegraph') {
      this.updateTelegraph(dt, speed);
    } else if (this.dashState === 'dash') {
      this.updateDash(dt, speed);
    } else {
      this.steer(ctx, speed, turnRate);
      this.updateDashTimers(ctx);
      this.tryStartDash(ctx);
    }

    this.updateVisuals(dt);
  }

  isDashBusy() {
    return this.dashState !== 'chase';
  }

  // ---------------------------------------------------------------
  // Выбор цели по роли
  // ---------------------------------------------------------------
  updateTarget(ctx) {
    const player = ctx.player;
    const role = this.role;
    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    if (role.key === 'interceptor') {
      // Точка впереди игрока по направлению его движения
      const pv = player.moveVelocity;
      const playerSpeed = pv.length();
      const isMoving = playerSpeed > CONFIG.PLAYER.SPEED * role.leadMinPlayerSpeed;
      if (isMoving && distance > role.leadMinDistance) {
        const x = player.x + (pv.x / playerSpeed) * role.leadDistance;
        const y = player.y + (pv.y / playerSpeed) * role.leadDistance;
        this.target.set(
          Phaser.Math.Clamp(x, 0, CONFIG.ARENA.WIDTH),
          Phaser.Math.Clamp(y, 0, CONFIG.ARENA.HEIGHT)
        );
        return;
      }
    }

    if (role.key === 'heavy' && distance >= role.closeDistance && distance <= role.farDistance) {
      if (ctx.bonus.active) {
        // Встаёт на пути игрока к бонусу
        this.target.set(
          Phaser.Math.Linear(player.x, ctx.bonus.x, role.cutFraction),
          Phaser.Math.Linear(player.y, ctx.bonus.y, role.cutFraction)
        );
      } else {
        // Бонуса нет — медленно занимает центр арены
        this.target.set(CONFIG.ARENA.WIDTH / 2, CONFIG.ARENA.HEIGHT / 2);
      }
      return;
    }

    // Охотник всегда, а остальные в особых случаях — прямо на игрока
    this.target.set(player.x, player.y);
  }

  // ---------------------------------------------------------------
  // Обычное движение: инерция, отталкивание, скольжение
  // ---------------------------------------------------------------
  steer(ctx, speed, turnRate) {
    let dirX = this.target.x - this.x;
    let dirY = this.target.y - this.y;
    const targetDistance = Math.hypot(dirX, dirY);
    const length = targetDistance || 1;
    dirX /= length;
    dirY /= length;

    // Загонщик плавно тормозит у своей точки, а не дрожит на ней
    let moveSpeed = speed;
    if (this.role.arriveRadius) {
      moveSpeed *= Math.min(1, targetDistance / this.role.arriveRadius);
    }

    // Упёрлись в препятствие — в основном едем вдоль него
    let currentTurnRate = turnRate;
    if (this.slideTime > 0) {
      this.slideTime -= ctx.dt;
      dirX = this.slideDirection.x + dirX * 0.3;
      dirY = this.slideDirection.y + dirY * 0.3;
      currentTurnRate = turnRate * 2;
      moveSpeed = speed;
    } else {
      this.slideAxis = null;
    }

    // Отталкивание от других врагов
    const separation = this.getSeparation(ctx.chasers);
    dirX += separation.x;
    dirY += separation.y;

    const dirLength = Math.hypot(dirX, dirY) || 1;
    dirX /= dirLength;
    dirY /= dirLength;

    // Плавный поворот: скорость постепенно тянется к желаемой
    const k = 1 - Math.exp(-currentTurnRate * ctx.dt);
    this.moveVelocity.x += (dirX * moveSpeed - this.moveVelocity.x) * k;
    this.moveVelocity.y += (dirY * moveSpeed - this.moveVelocity.y) * k;

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
      if (distance < 0.001) {
        dx = Math.random() - 0.5;
        dy = Math.random() - 0.5;
        distance = Math.hypot(dx, dy) || 1;
      }
      const strength = ((radius - distance) / radius) * CONFIG.CHASER.SEPARATION_FORCE;
      result.x += (dx / distance) * strength;
      result.y += (dy / distance) * strength;
    });

    return result;
  }

  // Вызывается коллайдером при касании препятствия
  startSliding(bounds) {
    // Во время рывка удар о стену сразу заканчивает рывок
    if (this.dashState === 'dash') {
      this.endDash();
      return;
    }

    const centerX = this.body.center.x;
    const centerY = this.body.center.y;
    const target = this.target;

    // Ближайшая к врагу точка препятствия подсказывает, о какую грань ударились
    const closestX = Phaser.Math.Clamp(centerX, bounds.left, bounds.right);
    const closestY = Phaser.Math.Clamp(centerY, bounds.top, bounds.bottom);
    const axis = Math.abs(centerX - closestX) >= Math.abs(centerY - closestY) ? 'y' : 'x';

    if (this.slideTime > 0 && this.slideAxis === axis) {
      this.slideTime = CONFIG.CHASER.SLIDE_TIME;
      return;
    }

    if (axis === 'y') {
      const costUp = Math.abs(centerY - bounds.top) +
        Phaser.Math.Distance.Between(centerX, bounds.top, target.x, target.y);
      const costDown = Math.abs(bounds.bottom - centerY) +
        Phaser.Math.Distance.Between(centerX, bounds.bottom, target.x, target.y);
      this.slideDirection.set(0, costUp <= costDown ? -1 : 1);
    } else {
      const costLeft = Math.abs(centerX - bounds.left) +
        Phaser.Math.Distance.Between(bounds.left, centerY, target.x, target.y);
      const costRight = Math.abs(bounds.right - centerX) +
        Phaser.Math.Distance.Between(bounds.right, centerY, target.x, target.y);
      this.slideDirection.set(costLeft <= costRight ? -1 : 1, 0);
    }

    this.slideAxis = axis;
    this.slideTime = CONFIG.CHASER.SLIDE_TIME;
  }

  // ---------------------------------------------------------------
  // Рывок (Dash)
  // ---------------------------------------------------------------

  // Таймеры тикают только после 50-й секунды (ctx.dashInterval !== null)
  updateDashTimers(ctx) {
    if (this.recoveryTimer > 0) {
      this.recoveryTimer -= ctx.dt;
    }
    if (ctx.dashInterval !== null && this.dashCooldown > 0) {
      this.dashCooldown -= ctx.dt;
    }
  }

  tryStartDash(ctx) {
    // Рывки только в 3-й фазе, по одному врагу за раз и после паузы
    if (ctx.dashInterval === null || ctx.dashBusy || this.dashCooldown > 0) {
      return;
    }

    const player = ctx.player;
    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    if (distance < CONFIG.CHASER.DASH_MIN_RANGE || distance > CONFIG.CHASER.DASH_MAX_RANGE) {
      return;
    }

    // Направление фиксируется в начале телеграфа — игрок видит, куда будет рывок
    let dirX = this.target.x - this.x;
    let dirY = this.target.y - this.y;
    let length = Math.hypot(dirX, dirY);
    if (length < 1) {
      dirX = player.x - this.x;
      dirY = player.y - this.y;
      length = Math.hypot(dirX, dirY) || 1;
    }
    dirX /= length;
    dirY /= length;

    // Рвётся только если на пути нет препятствий
    if (!this.isPathClear(dirX, dirY, this.getDashLength(), ctx.obstacleRects)) {
      return;
    }

    this.dashDirection.set(dirX, dirY);
    this.dashState = 'telegraph';
    this.stateTimer = this.role.dash.telegraph;
    this.lastDashInterval = ctx.dashInterval;
    this.slideTime = 0;
  }

  getDashLength() {
    const dash = this.role.dash;
    return CONFIG.PLAYER.SPEED * dash.speedFactor * dash.duration;
  }

  // Пересекает ли отрезок рывка какое-нибудь препятствие (с учётом размера врага)
  isPathClear(dirX, dirY, length, obstacleRects) {
    const r = CONFIG.CHASER.HITBOX_RADIUS;
    const endX = this.x + dirX * length;
    const endY = this.y + dirY * length;
    this.pathLine.setTo(this.x, this.y, endX, endY);

    // Конец рывка должен быть внутри арены, иначе враг сразу упрётся в край
    if (endX < r || endX > CONFIG.ARENA.WIDTH - r || endY < r || endY > CONFIG.ARENA.HEIGHT - r) {
      return false;
    }

    return !obstacleRects.some((rect) => {
      const inflated = new Phaser.Geom.Rectangle(rect.x - r, rect.y - r, rect.width + r * 2, rect.height + r * 2);
      return Phaser.Geom.Intersects.LineToRectangle(this.pathLine, inflated) ||
        inflated.contains(this.pathLine.x2, this.pathLine.y2);
    });
  }

  // Телеграф: враг почти замирает, мигает и показывает линию рывка
  updateTelegraph(dt, speed) {
    this.stateTimer -= dt;

    const k = 1 - Math.exp(-8 * dt);
    this.moveVelocity.x += (this.dashDirection.x * speed * 0.2 - this.moveVelocity.x) * k;
    this.moveVelocity.y += (this.dashDirection.y * speed * 0.2 - this.moveVelocity.y) * k;
    this.body.setVelocity(this.moveVelocity.x, this.moveVelocity.y);

    if (this.stateTimer <= 0) {
      this.dashState = 'dash';
      this.stateTimer = this.role.dash.duration;
    }
  }

  // Рывок: быстрый (но не мгновенный) разгон по зафиксированному направлению
  updateDash(dt, speed) {
    this.stateTimer -= dt;

    const dashSpeed = CONFIG.PLAYER.SPEED * this.role.dash.speedFactor;
    const k = 1 - Math.exp(-CONFIG.CHASER.DASH_ACCELERATION * dt);
    this.moveVelocity.x += (this.dashDirection.x * dashSpeed - this.moveVelocity.x) * k;
    this.moveVelocity.y += (this.dashDirection.y * dashSpeed - this.moveVelocity.y) * k;
    this.body.setVelocity(this.moveVelocity.x, this.moveVelocity.y);

    // Время вышло или упёрлись в край арены — рывок закончен
    if (this.stateTimer <= 0 || !this.body.blocked.none) {
      this.endDash(speed);
    }
  }

  endDash(speed) {
    const normalSpeed = speed || CONFIG.PLAYER.SPEED * this.role.speedFactor;
    this.dashState = 'chase';
    // Возвращаемся к обычной скорости сразу, без «хвоста» от рывка
    this.moveVelocity.set(this.dashDirection.x * normalSpeed, this.dashDirection.y * normalSpeed);
    this.body.setVelocity(this.moveVelocity.x, this.moveVelocity.y);
    this.recoveryTimer = this.role.dash.recovery;
    this.dashCooldown = this.role.dash.recovery + this.lastDashInterval;
  }

  // ---------------------------------------------------------------
  // Визуальная часть: поворот, ядро, шлейф, подсказки рывка
  // ---------------------------------------------------------------
  updateVisuals(dt) {
    const cx = this.body.center.x;
    const cy = this.body.center.y;

    // Направление «взгляда»: при телеграфе — направление рывка, иначе — движение
    let lookX = this.moveVelocity.x;
    let lookY = this.moveVelocity.y;
    if (this.dashState === 'telegraph') {
      lookX = this.dashDirection.x;
      lookY = this.dashDirection.y;
    }
    const lookLength = Math.hypot(lookX, lookY);
    const hasDirection = lookLength > 0.001;

    if (this.role.rotates && hasDirection && (this.dashState === 'telegraph' || lookLength > 10)) {
      this.setRotation(Math.atan2(lookY, lookX));
    }

    // Ядро смещено в сторону движения
    const offset = this.role.size * 0.16;
    const ox = hasDirection ? (lookX / lookLength) * offset : 0;
    const oy = hasDirection ? (lookY / lookLength) * offset : 0;
    this.core.setPosition(cx + ox, cy + oy);

    // Мигание при телеграфе, затемнение при восстановлении
    if (this.dashState === 'telegraph') {
      const flash = Math.floor(this.stateTimer * 12) % 2 === 0;
      if (flash) {
        this.setTintFill(0xffffff);
      } else {
        this.clearTint();
      }
      this.core.clearTint().setScale(1.4);
    } else {
      this.clearTint();
      this.core.setTint(this.dashState === 'dash' ? 0xffffff : this.role.color).setScale(1);
    }
    const isRecovering = this.dashState === 'chase' && this.recoveryTimer > 0;
    this.setAlpha(isRecovering ? 0.6 : 1);

    this.updateTrail(dt, cx, cy);
    this.drawFx(cx, cy);
  }

  updateTrail(dt, cx, cy) {
    this.trailTimer -= dt;
    if (this.trailTimer > 0) {
      return;
    }
    this.trailTimer = CONFIG.CHASER.TRAIL_INTERVAL;
    this.trail.unshift({ x: cx, y: cy });
    if (this.trail.length > CONFIG.CHASER.TRAIL_POINTS) {
      this.trail.pop();
    }
  }

  drawFx(cx, cy) {
    const g = this.fx;
    const color = this.role.color;
    const count = this.trail.length;
    g.clear();

    // Сужающийся шлейф: точки всё меньше и прозрачнее
    for (let i = 0; i < count; i++) {
      const fade = 1 - (i + 1) / (count + 1);
      g.fillStyle(color, 0.35 * fade);
      g.fillCircle(this.trail[i].x, this.trail[i].y, CONFIG.CHASER.HITBOX_RADIUS * 0.75 * fade);
    }

    if (this.dashState === 'telegraph') {
      const progress = 1 - this.stateTimer / this.role.dash.telegraph; // 0 → 1
      const length = this.getDashLength();

      // Линия будущего рывка
      g.lineStyle(4, color, 0.25 + 0.45 * progress);
      g.lineBetween(cx, cy, cx + this.dashDirection.x * length, cy + this.dashDirection.y * length);

      // Расширяющееся кольцо-предупреждение
      g.lineStyle(4, 0xffffff, 0.8 - 0.4 * progress);
      g.strokeCircle(cx, cy, this.role.size / 2 + 6 + 18 * progress);
    }
  }
}
