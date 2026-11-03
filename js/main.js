// =============================================================
// Точка входа: настройки Phaser и запуск игры.
// =============================================================

const gameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: CONFIG.WIDTH,
  height: CONFIG.HEIGHT,
  backgroundColor: colorToCss(CONFIG.COLORS.BACKGROUND),

  // FIT вписывает canvas в контейнер без искажений. Высоту игры мы сами подбираем
  // под пропорцию контейнера (computeGameHeight), так что canvas заполняет его целиком
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

// Высота игры по пропорции места под canvas: ширина всегда CONFIG.WIDTH,
// поэтому canvas занимает всю ширину экрана, без чёрных полос по бокам
function computeGameHeight() {
  const container = document.getElementById('game-container');
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (!width || !height) {
    return CONFIG.HEIGHT;
  }
  const gameHeight = CONFIG.WIDTH * height / width;
  return Math.round(Math.min(CONFIG.MAX_HEIGHT, Math.max(CONFIG.MIN_HEIGHT, gameHeight)));
}

// Поворот экрана, изменение окна, появление/скрытие панелей браузера —
// подгоняем высоту игры; сцены получают событие 'resize' и перестраиваются
function fitGameToScreen() {
  const height = computeGameHeight();
  if (height !== game.scale.height) {
    game.scale.setGameSize(CONFIG.WIDTH, height);
  } else {
    game.scale.refresh();
  }
}

// Сначала размечаем нижнюю панель — чтобы контейнер игры уже имел итоговый размер
Joystick.init();
Hud.init();
Sound.init();
gameConfig.height = computeGameHeight();

const game = new Phaser.Game(gameConfig);
Joystick.onLayoutChange = fitGameToScreen;

// Запрещаем браузерные жесты: прокрутку, pinch-to-zoom (iOS), двойной тап и меню
function blockBrowserGestures() {
  document.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (event) => event.preventDefault());
  document.addEventListener('gesturechange', (event) => event.preventDefault());
  document.addEventListener('dblclick', (event) => event.preventDefault());
  document.addEventListener('contextmenu', (event) => event.preventDefault());
}

blockBrowserGestures();
