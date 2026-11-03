// =============================================================
// Звук и вибрация. Звуки синтезируются в браузере (WebAudio), без файлов:
// короткие пиксельные «бипы», шорохи и удары в духе ретро-игр.
//
// На iPhone звук можно включить только после касания экрана, поэтому
// AudioContext создаётся при первом нажатии (Sound.init вешает обработчики).
// Вибрация (navigator.vibrate) работает на Android; Safari на iPhone её не поддерживает.
// Настройка «звук вкл/выкл» хранится в localStorage.
// =============================================================

const SOUND_MUTED_KEY = 'neonEscape.muted';

const Sound = {
  ctx: null,
  master: null,
  muted: false,
  noiseBuffer: null,

  init() {
    try {
      this.muted = localStorage.getItem(SOUND_MUTED_KEY) === '1';
    } catch (error) {
      this.muted = false;
    }
    const unlock = () => this.ensureContext();
    ['pointerdown', 'touchend', 'keydown'].forEach((type) => {
      window.addEventListener(type, unlock, { passive: true });
    });
  },

  // Создаёт/возобновляет AudioContext (только из обработчика касания — требование iOS)
  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        return;
      }
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);

      // Буфер белого шума для шорохов и ударов
      const length = this.ctx.sampleRate * 0.5;
      this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  setMuted(muted) {
    this.muted = muted;
    try {
      localStorage.setItem(SOUND_MUTED_KEY, muted ? '1' : '0');
    } catch (error) {
      // настройка просто не сохранится
    }
  },

  canPlay() {
    return !this.muted && this.ctx && this.ctx.state === 'running';
  },

  // Тон: частота (с плавным переходом к to), длительность, форма волны, громкость, задержка
  tone(freq, duration, { to = null, type = 'square', volume = 0.2, delay = 0 } = {}) {
    // Слишком тихо — не играем: плавное затухание в WebAudio не может идти к нулю
    if (!(volume > 0.002)) {
      return;
    }
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) {
      osc.frequency.exponentialRampToValueAtTime(to, t + duration);
    }
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  },

  // Шум через фильтр: шорох, свист, удар
  noise(duration, { from = 800, to = null, volume = 0.2, filter = 'bandpass', q = 1, delay = 0 } = {}) {
    if (!(volume > 0.002)) {
      return;
    }
    const t = this.ctx.currentTime + delay;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const biquad = this.ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.Q.value = q;
    biquad.frequency.setValueAtTime(from, t);
    if (to) {
      biquad.frequency.exponentialRampToValueAtTime(to, t + duration);
    }
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(biquad).connect(gain).connect(this.master);
    source.start(t);
    source.stop(t + duration + 0.02);
  },

  // Все звуки игры по названию. volume — множитель громкости (для звуков на расстоянии)
  play(name, { level = 1, volume = 1 } = {}) {
    if (!this.canPlay() || !(volume > 0.02)) {
      return;
    }
    // Ошибка звука никогда не должна ломать игровой кадр
    try {
      this.playUnsafe(name, level, volume);
    } catch (error) {
      console.warn('Звук «' + name + '» не проигран:', error.message);
    }
  },

  playUnsafe(name, level, volume) {
    const v = volume;
    switch (name) {
      case 'step':      // шаг героини по линолеуму
        this.noise(0.05, { from: 1800, volume: 0.06 * v, q: 0.8 });
        break;
      case 'thud':      // тяжёлый шаг Загонщика
        this.tone(70, 0.12, { to: 45, type: 'sine', volume: 0.35 * v });
        break;
      case 'pill':      // таблетка
        this.tone(660, 0.07, { volume: 0.14 });
        this.tone(990, 0.1, { volume: 0.14, delay: 0.06 });
        break;
      case 'combo':     // комбо: чем выше множитель, тем выше нота
        [0, 1, 2].forEach((i) => this.tone(520 * Math.pow(1.26, level + i), 0.07, { volume: 0.12, delay: i * 0.05 }));
        break;
      case 'nearMiss':  // проскочила вплотную
        this.noise(0.22, { from: 400, to: 3000, volume: 0.18, q: 2 });
        break;
      case 'telegraph': // пациент готовит рывок
        this.tone(440, 0.32, { to: 880, type: 'sawtooth', volume: 0.07 * v });
        break;
      case 'dash':      // рывок
        this.noise(0.25, { from: 3000, to: 300, volume: 0.2 * v, q: 1.5 });
        break;
      case 'caught':    // штамп «ПОЙМАН!»
        this.noise(0.25, { from: 300, filter: 'lowpass', volume: 0.5 });
        this.tone(160, 0.35, { to: 60, volume: 0.25 });
        break;
      case 'beep':      // отсчёт 3-2-1
        this.tone(520, 0.12, { volume: 0.16 });
        break;
      case 'go':        // поехали
        this.tone(880, 0.2, { volume: 0.18 });
        break;
      case 'click':     // кнопка
        this.tone(1200, 0.03, { volume: 0.08 });
        break;
      case 'dodge':     // уворот героини
        this.noise(0.16, { from: 600, to: 4000, volume: 0.2, q: 3 });
        break;
      case 'powerup':   // особая таблетка
        [0, 4, 7, 12].forEach((n, i) => this.tone(523 * Math.pow(2, n / 12), 0.08, { volume: 0.12, delay: i * 0.06 }));
        break;
      case 'shield':    // маска спасла
        this.tone(300, 0.25, { to: 900, type: 'triangle', volume: 0.25 });
        this.noise(0.2, { from: 2000, volume: 0.15 });
        break;
      case 'sleep':     // снотворное
        this.tone(600, 0.5, { to: 200, type: 'sine', volume: 0.18 });
        break;
      case 'door':      // скрип двери кабинета
        this.tone(220, 0.45, { to: 330, type: 'sawtooth', volume: 0.05 * v });
        this.noise(0.4, { from: 900, to: 1400, volume: 0.06 * v, q: 8 });
        break;
      case 'hide':      // спряталась в кабинете
        this.noise(0.12, { from: 250, filter: 'lowpass', volume: 0.35 });
        break;
      case 'mission':   // задание выполнено
        [0, 4, 7, 12, 16].forEach((n, i) => this.tone(659 * Math.pow(2, n / 12), 0.09, { volume: 0.12, delay: i * 0.07 }));
        break;
      default:
        break;
    }
  },

  vibrate(pattern) {
    if (!this.muted && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (error) {
        // вибрация не поддерживается — ничего страшного
      }
    }
  }
};
