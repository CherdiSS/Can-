// =============================================================
// Точка входа: настройки Phaser и запуск игры.
// =============================================================

const gameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: CONFIG.WIDTH,
  height: CONFIG.HEIGHT,
  backgroundColor: colorToCss(CONFIG.COLORS.BACKGROUND),

  // FIT — вписываем поле 9:16 в контейнер (экран минус safe-area и панель управления) без искажений
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },

  // Arcade Physics без гравитации (вид сверху)
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },

  // Несколько касаний: палец на джойстике + нажатие кнопки паузы
  input: {
    activePointers: 3
  },

  // Порядок сцен важен: UIScene рисуется поверх GameScene
  scene: [BootScene, MenuScene, GameScene, UIScene]
};

// Сначала размечаем нижнюю панель — чтобы Phaser сразу получил правильный размер контейнера
Joystick.init();

const game = new Phaser.Game(gameConfig);
Joystick.game = game; // для пересчёта масштаба при изменении размера окна

// Запрещаем браузерные жесты: прокрутку, pinch-to-zoom (iOS), двойной тап и меню
function blockBrowserGestures() {
  document.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (event) => event.preventDefault());
  document.addEventListener('gesturechange', (event) => event.preventDefault());
  document.addEventListener('dblclick', (event) => event.preventDefault());
  document.addEventListener('contextmenu', (event) => event.preventDefault());
}

blockBrowserGestures();
