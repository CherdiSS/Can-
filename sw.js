// =============================================================
// Service worker: игра работает без интернета.
//
// При первом открытии все файлы игры сохраняются в кэш телефона.
// Дальше каждый файл сначала запрашивается из сети (чтобы сразу получать
// обновления), а если сети нет или она отвечает дольше NETWORK_TIMEOUT —
// берётся из кэша.
//
// Добавил новый файл (спрайт, скрипт)? Допиши его в FILES и увеличь VERSION.
// =============================================================

const VERSION = 'v4';
const CACHE_NAME = 'cgb-' + VERSION;
const NETWORK_TIMEOUT = 3000; // мс

const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/lib/phaser.min.js',
  'js/config.js',
  'js/utils/storage.js',
  'js/utils/progress.js',
  'js/utils/sound.js',
  'js/utils/joystick.js',
  'js/utils/hud.js',
  'js/utils/lighting.js',
  'js/objects/Player.js',
  'js/objects/Chaser.js',
  'js/objects/Bonus.js',
  'js/objects/Npc.js',
  'js/scenes/BootScene.js',
  'js/scenes/MenuScene.js',
  'js/scenes/GameScene.js',
  'js/scenes/RunMode.js',
  'js/scenes/UIScene.js',
  'js/main.js',
  'assets/fonts/tiny5-cyrillic-400-normal.woff2',
  'assets/fonts/tiny5-latin-400-normal.woff2',
  'assets/icons/icon-180.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/ui/arrow.png',
  'assets/ui/arrow_diag.png',
  'assets/ui/joystick_base.png',
  'assets/ui/joystick_knob.png',
  'assets/ui/puddle.png',
  'assets/ui/heart.png',
  'assets/ui/heart_empty.png',
  'assets/ui/medcard.png',
  'assets/ui/medkit.png',
  'assets/ui/stairs.png',
  'assets/ui/ring.png',
  'assets/sprites/bonus_pill.png',
  'assets/sprites/doctor_sheet.png',
  'assets/sprites/doctor_pink_sheet.png',
  'assets/sprites/doctor_night_sheet.png',
  'assets/sprites/doctor_surgeon_sheet.png',
  'assets/sprites/doctor_chief_sheet.png',
  'assets/sprites/enemy_heavy_sheet.png',
  'assets/sprites/enemy_hunter_sheet.png',
  'assets/sprites/enemy_interceptor_sheet.png',
  'assets/sprites/npc_cleaner_sheet.png',
  'assets/sprites/npc_granny_sheet.png',
  'assets/sprites/pill_laxative.png',
  'assets/sprites/pill_mask.png',
  'assets/sprites/pill_sleeping.png',
  'assets/sprites/pill_validol.png',
  'assets/environment/decal_mat.png',
  'assets/environment/decal_seam.png',
  'assets/environment/decal_stain.png',
  'assets/environment/decal_tear.png',
  'assets/environment/decal_crack.png',
  'assets/environment/decal_wear.png',
  'assets/environment/floor_tile.png',
  'assets/environment/obstacle_bahily.png',
  'assets/environment/obstacle_bench.png',
  'assets/environment/obstacle_chairs3.png',
  'assets/environment/obstacle_chairs4.png',
  'assets/environment/obstacle_cooler.png',
  'assets/environment/obstacle_couch.png',
  'assets/environment/obstacle_ficus.png',
  'assets/environment/obstacle_gurney.png',
  'assets/environment/obstacle_kartoteka.png',
  'assets/environment/obstacle_magtable.png',
  'assets/environment/obstacle_registratura.png',
  'assets/environment/obstacle_scales.png',
  'assets/environment/obstacle_screen.png',
  'assets/environment/obstacle_stand.png',
  'assets/environment/obstacle_terminal.png',
  'assets/environment/obstacle_wardrobe.png',
  'assets/environment/wall_bottom.png',
  'assets/environment/wall_north.png',
  'assets/environment/wall_side.png'
];

// Установка: скачиваем все файлы игры в кэш (cache: 'reload' — мимо HTTP-кэша браузера)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(FILES.map((file) => new Request(file, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

// Активация: удаляем кэши старых версий и сразу берём страницу под контроль
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('cgb-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Запросы: сначала сеть (с таймаутом), иначе — кэш
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return; // чужие сайты и не-GET запросы не трогаем
  }
  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  // Проверяем свежесть у сервера (no-cache), чтобы обновления приходили сразу
  const network = fetch(request, { cache: 'no-cache' }).then((response) => {
    if (response.ok && response.type === 'basic') {
      cache.put(request, response.clone()); // обновляем копию в кэше
    }
    return response;
  });

  try {
    return await withTimeout(network, NETWORK_TIMEOUT);
  } catch (error) {
    // Сети нет или она слишком медленная — отдаём сохранённую копию
    const cached = await cache.match(request, { ignoreSearch: true }) ||
      (request.mode === 'navigate' ? await cache.match('index.html') : undefined);
    if (cached) {
      return cached;
    }
    return network; // в кэше нет — ждём сеть до конца
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }, (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}
