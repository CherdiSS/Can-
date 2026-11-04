// =============================================================
// Освещение «мрачной поликлиники»: лампы дневного света на потолке.
//
// Под лампами — светлые пятна, между ними — полумрак. Свет считается
// крупными «пикселями» (CELL × CELL) с точечным дизерингом, как в пиксель-арте.
// Несколько ламп барахлят: время от времени мигают и гаснут на долю секунды.
// По краям экрана — тёмная виньетка.
//
// Слой темноты лежит НАД полом и мебелью, но ПОД персонажами и таблетками:
// героиня, пациенты и бонусы всегда хорошо видны.
// Расположение ламп и сила темноты — CONFIG.LIGHTING.
// =============================================================

// Матрица Байера 4×4 для точечного дизеринга (переход между уровнями «ступеньками» в шахматку)
const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

class Lighting {
  // scene — сцена; width/height — размер освещаемой области в координатах мира;
  // lamps — [[x, y], ...]; options.flickering — индексы мигающих ламп;
  // options.dark — темнота вдали от ламп (по умолчанию CONFIG.LIGHTING.DARK)
  constructor(scene, width, height, lamps, options = {}) {
    const L = CONFIG.LIGHTING;
    this.scene = scene;
    this.lamps = lamps;
    this.cell = L.CELL;
    this.dark = options.dark || L.DARK;

    // 1) Темнота от всех ламп сразу — одна картинка на всё поле
    const key = 'light-' + width + 'x' + height + '-' + this.dark + '-' + lamps.map((l) => l.join(':')).join(',');
    if (!scene.textures.exists(key)) {
      this.drawDarkness(key, width, height, lamps);
    }
    this.darkness = scene.add.image(0, 0, key).setOrigin(0).setScale(this.cell).setDepth(L.DEPTH);

    // 2) Мигающие лампы: когда лампа гаснет, поверх кладётся «пятно темноты» её размера
    this.patchKey = 'light-patch-' + this.dark;
    if (!scene.textures.exists(this.patchKey)) {
      this.drawPatch(this.patchKey);
    }
    this.flickers = (options.flickering || []).map((index) => {
      const [x, y] = lamps[index];
      // левый верхний угол пятна — по сетке «пикселей» света, чтобы клетки совпадали
      const half = Math.ceil(L.RADIUS * 2 / this.cell) * this.cell / 2;
      const patch = scene.add.image(Math.round((x - half) / this.cell) * this.cell, Math.round((y - half) / this.cell) * this.cell,
        this.patchKey).setOrigin(0).setScale(this.cell).setDepth(L.DEPTH + 0.1).setVisible(false);
      return { x, y, patch, timer: Phaser.Math.FloatBetween(1, L.FLICKER_EVERY[1]), burst: 0, off: false };
    });
  }

  // Сколько света в точке (0 — темно, 1 — полностью под лампой)
  lightAt(x, y, lamps) {
    const R = CONFIG.LIGHTING.RADIUS;
    let light = 0;
    lamps.forEach(([lx, ly]) => {
      const d = Math.hypot(x - lx, y - ly) / R;
      if (d < 1) {
        const k = 1 - d * d;
        light += k * k;
      }
    });
    return Math.min(1, light);
  }

  // Уровень темноты (0..1) с дизерингом «ступеньками»
  quantize(dark, cx, cy) {
    const levels = CONFIG.LIGHTING.LEVELS;
    const threshold = BAYER_4[(cy % 4) * 4 + (cx % 4)];
    return Math.min(levels, Math.floor(dark * levels + threshold)) / levels;
  }

  drawDarkness(key, width, height, lamps) {
    const L = CONFIG.LIGHTING;
    const cols = Math.ceil(width / this.cell);
    const rows = Math.ceil(height / this.cell);
    const texture = this.scene.textures.createCanvas(key, cols, rows);
    const ctx = texture.getContext();
    const image = ctx.createImageData(cols, rows);
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const light = this.lightAt((cx + 0.5) * this.cell, (cy + 0.5) * this.cell, lamps);
        const dark = this.quantize(this.dark - (this.dark - L.LIT) * light, cx, cy);
        const i = (cy * cols + cx) * 4;
        image.data[i] = 8;      // темнота чуть зеленоватая, как в старом здании
        image.data[i + 1] = 14;
        image.data[i + 2] = 12;
        image.data[i + 3] = Math.round(dark * 255);
      }
    }
    ctx.putImageData(image, 0, 0);
    texture.refresh();
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // Пятно темноты одной погасшей лампы: сколько света она давала
  drawPatch(key) {
    const L = CONFIG.LIGHTING;
    const size = Math.ceil(L.RADIUS * 2 / this.cell);
    const texture = this.scene.textures.createCanvas(key, size, size);
    const ctx = texture.getContext();
    const image = ctx.createImageData(size, size);
    const c = size / 2;
    for (let cy = 0; cy < size; cy++) {
      for (let cx = 0; cx < size; cx++) {
        const d = Math.hypot(cx + 0.5 - c, cy + 0.5 - c) / c;
        const k = d < 1 ? (1 - d * d) * (1 - d * d) : 0;
        const dark = this.quantize((this.dark - L.LIT) * k * L.FLICKER_DEPTH, cx, cy);
        const i = (cy * size + cx) * 4;
        image.data[i] = 8;
        image.data[i + 1] = 14;
        image.data[i + 2] = 12;
        image.data[i + 3] = Math.round(dark * 255);
      }
    }
    ctx.putImageData(image, 0, 0);
    texture.refresh();
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // Мигание ламп: редкие «приступы», во время которых лампа несколько раз гаснет.
  // onFlicker(x, y) — лампа погасла (для звука), вызывается не чаще раза за приступ
  update(dt, onFlicker) {
    const L = CONFIG.LIGHTING;
    this.flickers.forEach((f) => {
      if (f.burst > 0) {
        f.burst -= dt;
        f.switchTimer -= dt;
        if (f.switchTimer <= 0) {
          f.off = !f.off;
          f.switchTimer = f.off ? Phaser.Math.FloatBetween(0.04, 0.16) : Phaser.Math.FloatBetween(0.03, 0.2);
        }
        if (f.burst <= 0) {
          f.off = false;
          f.timer = Phaser.Math.FloatBetween(L.FLICKER_EVERY[0], L.FLICKER_EVERY[1]);
        }
      } else {
        f.timer -= dt;
        if (f.timer <= 0) {
          f.burst = Phaser.Math.FloatBetween(L.FLICKER_BURST[0], L.FLICKER_BURST[1]);
          f.switchTimer = 0;
          if (onFlicker) {
            onFlicker(f.x, f.y);
          }
        }
      }
      f.patch.setVisible(f.off);
    });
  }
}

// «Отключили свет»: дополнительная темнота всюду, кроме круга вокруг героини.
// Картинка размером с два экрана (чтобы закрывать экран при любом положении камеры)
// ездит за героиней; клетки — те же 8×8, что у основного света.
function createFlashlight(scene, radius, darkness, depth) {
  const L = CONFIG.LIGHTING;
  const cell = L.CELL;
  const cols = Math.ceil(CONFIG.MAX_WIDTH * 2 / cell);
  const rows = Math.ceil(CONFIG.HEIGHT * 2 / cell);
  const key = 'flashlight-' + radius + '-' + darkness;
  if (!scene.textures.exists(key)) {
    const texture = scene.textures.createCanvas(key, cols, rows);
    const ctx = texture.getContext();
    const image = ctx.createImageData(cols, rows);
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const d = Math.hypot((cx + 0.5 - cols / 2) * cell, (cy + 0.5 - rows / 2) * cell) / radius;
        const k = Math.min(1, Math.max(0, (d - 0.55) / 0.45));
        const level = Math.min(L.LEVELS, Math.floor(k * darkness * L.LEVELS + BAYER_4[(cy % 4) * 4 + (cx % 4)])) / L.LEVELS;
        const i = (cy * cols + cx) * 4;
        image.data[i] = 4;
        image.data[i + 1] = 8;
        image.data[i + 2] = 8;
        image.data[i + 3] = Math.round(level * 255);
      }
    }
    ctx.putImageData(image, 0, 0);
    texture.refresh();
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  const light = scene.add.image(0, 0, key).setScale(cell).setDepth(depth);
  // Следовать за героиней по сетке клеток — пиксели света не «плывут»
  light.follow = (x, y) => light.setPosition(Math.round(x / cell) * cell, Math.round(y / cell) * cell);
  return light;
}

// Виньетка: тёмные края экрана (рисуется в координатах экрана, поверх всего поля)
function createVignette(scene, depth) {
  const key = 'vignette';
  if (!scene.textures.exists(key)) {
    const w = 64;
    const h = 36;
    const texture = scene.textures.createCanvas(key, w, h);
    const ctx = texture.getContext();
    const image = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x + 0.5 - w / 2) / (w / 2);
        const dy = (y + 0.5 - h / 2) / (h / 2);
        const d = Math.min(1, Math.hypot(dx * 0.85, dy));
        const k = Math.max(0, (d - 0.55) / 0.45);
        const i = (y * w + x) * 4;
        image.data[i] = 6;
        image.data[i + 1] = 10;
        image.data[i + 2] = 10;
        image.data[i + 3] = Math.round(k * k * CONFIG.LIGHTING.VIGNETTE * 255);
      }
    }
    ctx.putImageData(image, 0, 0);
    texture.refresh();
  }
  const vignette = scene.add.image(0, 0, key).setOrigin(0).setScrollFactor(0).setDepth(depth);
  const fit = () => vignette.setDisplaySize(scene.scale.width, scene.scale.height);
  fit();
  scene.scale.on('resize', fit);
  scene.events.once('shutdown', () => scene.scale.off('resize', fit));
  return vignette;
}
