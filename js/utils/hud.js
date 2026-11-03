// =============================================================
// HUD в нижней панели управления (HTML): счёт и таймер слева от джойстика,
// кнопка паузы справа. Так верх экрана целиком отдан арене.
//
// Обработчик кнопки вешается один раз (Hud.init); UIScene при каждом запуске
// лишь подставляет свою функцию в Hud.onPause, поэтому дубликатов нет.
// Видимость HUD и приглушение кнопки на паузе/поражении управляются
// классами панели, которые ставит Joystick (is-game, is-inactive).
// =============================================================

const Hud = {
  scoreElement: null,
  timeElement: null,
  pauseButton: null,
  onPause: null, // функция паузы текущей UIScene (или null)

  init() {
    this.scoreElement = document.getElementById('hud-score');
    this.timeElement = document.getElementById('hud-time');
    this.pauseButton = document.getElementById('pause-button');

    // Пауза — когда палец, нажавший кнопку, отпущен над ней.
    // Pointer-события, а не click: браузеры не присылают click, если на экране
    // уже лежит другой палец (тот, что держит джойстик).
    // Палец, начавший движение на джойстике, закреплён за джойстиком и паузу не нажмёт.
    this.pressedPointerId = null;
    this.pauseButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.pressedPointerId = event.pointerId;
    });
    this.pauseButton.addEventListener('pointerup', (event) => {
      if (event.pointerId !== this.pressedPointerId) {
        return;
      }
      this.pressedPointerId = null;
      // Палец увели с кнопки и отпустили — это отмена нажатия
      const rect = this.pauseButton.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (inside) {
        this.pause();
      }
    });
    this.pauseButton.addEventListener('pointercancel', () => {
      this.pressedPointerId = null;
    });
    // Клавиатура (Enter/Пробел на кнопке в фокусе): click без координат указателя
    this.pauseButton.addEventListener('click', (event) => {
      if (event.detail === 0) {
        this.pause();
      }
    });
  },

  pause() {
    if (this.onPause) {
      this.onPause();
    }
  },

  update(score, seconds) {
    this.scoreElement.textContent = String(score);
    this.timeElement.textContent = formatTime(seconds);
  },

  // Комбо: множитель и доля оставшегося окна (1 → 0). multiplier < 2 — скрыть
  setCombo(multiplier, fraction) {
    const box = document.getElementById('hud-combo');
    if (multiplier < 2) {
      box.classList.remove('is-active');
      return;
    }
    box.classList.add('is-active');
    document.getElementById('hud-combo-text').textContent = '×' + multiplier;
    // Полоска убывает ступеньками по 10% — по-пиксельному
    const steps = Math.ceil(Math.max(0, Math.min(1, fraction)) * 10) * 10;
    document.getElementById('hud-combo-bar').style.width = steps + '%';
  }
};
