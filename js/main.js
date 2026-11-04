// =============================================================
// Точка входа: настройки Phaser и запуск игры.
// =============================================================

const gameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: CONFIG.WIDTH,
  height: CONFIG.HEIGHT,
  backgroundColor: colorToCss(CONFIG.COLORS.BACKGROUND),

  // FIT вписывает canvas в контейнер без искажений. Ширину игры мы сами подбираем
  // под пропорцию контейнера (computeGameWidth), так что canvas заполняет его целиком
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

// Ширина игры по пропорции места под canvas: высота всегда CONFIG.HEIGHT,
// поэтому canvas занимает весь экран, без чёрных полос
function computeGameWidth() {
  const container = document.getElementById('game-container');
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (!width || !height) {
    return CONFIG.WIDTH;
  }
  const gameWidth = CONFIG.HEIGHT * width / height;
  return Math.round(Math.min(CONFIG.MAX_WIDTH, Math.max(CONFIG.MIN_WIDTH, gameWidth)));
}

// Поворот экрана, изменение окна, появление/скрытие панелей браузера —
// подгоняем ширину игры; сцены получают событие 'resize' и перестраиваются
function fitGameToScreen() {
  const width = computeGameWidth();
  if (width !== game.scale.width) {
    game.scale.setGameSize(width, CONFIG.HEIGHT);
  } else {
    game.scale.refresh();
  }
  // Телефон повернули вертикально — игру на паузу (поверх — «Поверните телефон»)
  const notice = document.getElementById('rotate-notice');
  if (getComputedStyle(notice).display !== 'none') {
    Hud.pause();
  }
}

// Сначала — управление поверх игры, затем размер игры под экран
Joystick.init();
Hud.init();
Sound.init();
gameConfig.width = computeGameWidth();

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

// Работа без интернета: регистрируем service worker (sw.js в корне сайта).
// При открытии через file:// или в старом браузере просто пропускаем
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // не получилось — игра всё равно работает, просто только с интернетом
    });
  });
}
