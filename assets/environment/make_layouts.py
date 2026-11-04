# Раскладки мебели для этажей «Смены» (рогалик).
# Запуск: python3 assets/environment/make_layouts.py  → пишет js/layouts.js
#
# Общее для всех раскладок (js/layouts.js → LAYOUTS.shared): старт героини, маршруты
# санитарки и бабушки, места для медкарт, лестниц и запасные точки таблетки.
# Генератор расставляет мебель случайно (с фиксированным зерном — результат всегда тот же)
# и проверяет правила: зазоры ≥ 110 между предметами, ≥ 105 до стен, свободны зона старта,
# маршруты персонажей и все «места»; недостижимых мест нет (заливка по сетке).
# Для модификатора «Ремонт» к каждой раскладке подбираются 3 ограждения по тем же правилам.
# В игре раскладка может отражаться слева направо (двери кабинетов симметричны).
import json, os, random, re, sys
from collections import deque

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
W, H = 2240, 1280
MIN_GAP, WALL_GAP, START_R, PATH_CLEAR, SPOT_R, PLAYER_R = 110, 105, 150, 45, 40, 27

SHARED = {
    "start": [1120, 1150],
    "enemyStarts": [[1120, 171], [1900, 140], [340, 140]],
    "cleanerPath": [[70, 180], [2170, 180], [2170, 775], [1200, 775], [1200, 1225], [70, 1225], [70, 775]],
    "grannyApproach": [[1770, 180], [1770, 1045]],
    "grannyPath": [[1480, 1045], [1800, 1045]],
    "cardSpots": [[1640, 1085], [160, 1045], [2080, 1000], [480, 1040], [1120, 440]],
    "stairsSpots": [[90, 1210], [2150, 1210], [90, 700], [2150, 700], [1120, 1220], [640, 180], [1600, 180]],
    "testSpots": [[300, 460], [760, 760], [1500, 760], [1950, 460], [400, 1060], [1860, 1040], [1120, 430], [700, 470]],
    "fallback": [[1120, 160], [1120, 775], [70, 775], [2170, 775], [1120, 1225]]
}

# Размеры предметов (как в make_environment.py: картинка ровно w×h)
SIZES = {
    'chairs4': (190, 40), 'bench': (190, 40), 'registratura': (200, 40), 'wardrobe': (200, 40),
    'chairs3': (120, 40), 'magtable': (120, 40), 'kartoteka': (40, 200), 'screen': (40, 200),
    'cooler': (40, 120), 'stand': (40, 120), 'couch': (80, 160), 'gurney': (80, 160),
    'ficus': (80, 80), 'bahily': (80, 80), 'scales': (80, 80), 'terminal': (80, 80),
    'xray': (160, 80), 'desk': (200, 80), 'barrier': (120, 40), 'barrier_v': (40, 120),
}

# Мебель каждого этажа: (предмет, вес)
THEMES = {
    'terapia': [('chairs4', 6), ('chairs3', 5), ('bench', 4), ('magtable', 3), ('ficus', 3), ('stand', 2),
                ('cooler', 2), ('scales', 2), ('couch', 1)],
    'procedurny': [('gurney', 5), ('couch', 4), ('screen', 6), ('cooler', 2), ('stand', 2), ('scales', 2), ('kartoteka', 2)],
    'rentgen': [('xray', 4), ('screen', 6), ('gurney', 3), ('kartoteka', 3), ('terminal', 2), ('stand', 2), ('chairs3', 2)],
    'glavvrach': [('desk', 3), ('kartoteka', 4), ('ficus', 4), ('couch', 2), ('chairs3', 3), ('magtable', 3),
                  ('stand', 2), ('cooler', 1), ('bench', 2)],
}


def rect(o):
    return (o['x'] - o['w'] / 2, o['y'] - o['h'] / 2, o['x'] + o['w'] / 2, o['y'] + o['h'] / 2)

def rect_dist(a, b):
    dx = max(0, b[0] - a[2], a[0] - b[2]); dy = max(0, b[1] - a[3], a[1] - b[3])
    return (dx * dx + dy * dy) ** 0.5

def point_rect_dist(p, r):
    dx = max(r[0] - p[0], 0, p[0] - r[2]); dy = max(r[1] - p[1], 0, p[1] - r[3])
    return (dx * dx + dy * dy) ** 0.5

def seg_rect_dist(a, b, r):
    n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1])) / 10) + 1
    return min(point_rect_dist((a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n), r) for i in range(n + 1))

def segments():
    S = SHARED
    path = S['cleanerPath']
    segs = list(zip(path, path[1:] + path[:1]))
    segs += [((S['grannyApproach'][0][0], 180), S['grannyApproach'][0])]
    segs += list(zip(S['grannyApproach'], S['grannyApproach'][1:]))
    segs += [(S['grannyApproach'][-1], S['grannyPath'][0]), tuple(S['grannyPath'])]
    return segs

SEGS = segments()
SPOTS = SHARED['cardSpots'] + SHARED['stairsSpots'] + SHARED['testSpots'] + SHARED['fallback']

def fits(r, rects, gap=MIN_GAP):
    """Можно ли поставить прямоугольник r рядом с уже поставленными rects."""
    if r[0] < WALL_GAP or r[1] < WALL_GAP or r[2] > W - WALL_GAP or r[3] > H - WALL_GAP:
        return False
    if any(rect_dist(r, q) < gap for q in rects):
        return False
    if point_rect_dist(SHARED['start'], r) < START_R:
        return False
    if any(point_rect_dist(e, r) < START_R for e in SHARED['enemyStarts']):
        return False
    if any(point_rect_dist(s, r) < SPOT_R for s in SPOTS):
        return False
    if any(seg_rect_dist(a, b, r) < PATH_CLEAR for a, b in SEGS):
        return False
    return True

def reachable(rects):
    """Все свободные клетки достижимы от старта (сетка 10 px, круг героини + запас)."""
    step, R = 10, PLAYER_R + 5
    cols, rows = W // step + 1, H // step + 1
    free = [[False] * cols for _ in range(rows)]
    total = 0
    for gy in range(rows):
        for gx in range(cols):
            x, y = gx * step, gy * step
            if R <= x <= W - R and R <= y <= H - R and all(point_rect_dist((x, y), q) > R for q in rects):
                free[gy][gx] = True; total += 1
    sx, sy = SHARED['start'][0] // step, SHARED['start'][1] // step
    seen = {(sx, sy)}; q = deque([(sx, sy)])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < cols and 0 <= ny < rows and free[ny][nx] and (nx, ny) not in seen:
                seen.add((nx, ny)); q.append((nx, ny))
    return len(seen) == total

def place(rnd, looks, count, base_rects, tries=4000, gap=MIN_GAP):
    placed, rects = [], list(base_rects)
    bag = [k for k, w in looks for _ in range(w)]
    t = 0
    while len(placed) < count and t < tries:
        t += 1
        look = rnd.choice(bag)
        w, h = SIZES[look]
        x = rnd.randrange(WALL_GAP + w // 2, W - WALL_GAP - w // 2, 10)
        y = rnd.randrange(WALL_GAP + h // 2 + 120, H - WALL_GAP - h // 2, 10)
        o = dict(x=x, y=y, w=w, h=h, look=look)
        r = rect(o)
        if fits(r, rects, gap):
            placed.append(o); rects.append(r)
    return placed

REPAIR_GAP = 90  # ограждения ставим чуть теснее: проход ≥ 90 px (героиня — 54 px)

def make_repair(rnd, obstacles):
    base = [rect(o) for o in obstacles]
    for _ in range(300):
        bars = place(rnd, [('barrier', 1), ('barrier_v', 1)], 3, base, tries=3000, gap=REPAIR_GAP)
        if len(bars) >= 2 and reachable(base + [rect(o) for o in bars]):
            return bars
    raise SystemExit('не удалось расставить ограждения «Ремонта»')

def make_layout(theme, seed, count):
    for attempt in range(60):
        rnd = random.Random(seed * 1000 + attempt)
        obstacles = place(rnd, THEMES[theme], count, [])
        if len(obstacles) >= count - 2 and reachable([rect(o) for o in obstacles]):
            return obstacles, make_repair(rnd, obstacles)
    raise SystemExit('не удалось собрать раскладку ' + theme)

def registratura_from_config():
    """Первый этаж — ручная раскладка (registratura_layout.json), проверенная раньше вручную."""
    src = os.path.join(HERE, 'registratura_layout.json')
    return json.load(open(src, encoding='utf-8'))

def check(name, obstacles, gap=MIN_GAP):
    """Проверка готовой раскладки по всем правилам (с ограждениями — зазор REPAIR_GAP)."""
    rects = [rect(o) for o in obstacles]
    problems = [o['look'] + ' ' + str((o['x'], o['y'])) for o, r in zip(obstacles, rects)
                if not fits(r, [q for q in rects if q is not r], gap)]
    ok = reachable(rects)
    dens = len(rects) / (W * H) * 1e6
    print(f'[{name}] предметов {len(rects)} ({dens:.1f} на 1 000 000 px²), всё достижимо: {ok}, нарушений: {len(problems)}')
    for p in problems:
        print('   -', p)
    return ok and not problems


if __name__ == '__main__':
    layouts = {}
    reg = registratura_from_config()
    layouts['registratura'] = {'obstacles': reg, 'repair': make_repair(random.Random(7), reg)}
    for i, (theme, count) in enumerate((('terapia', 30), ('procedurny', 28), ('rentgen', 26), ('glavvrach', 28))):
        obstacles, repair = make_layout(theme, 11 + i, count)
        layouts[theme] = {'obstacles': obstacles, 'repair': repair}
    good = True
    for name, lay in layouts.items():
        good &= check(name, lay['obstacles'])
        good &= check(name + ' + ремонт', lay['obstacles'] + lay['repair'], REPAIR_GAP)
    if not good:
        raise SystemExit('раскладки не прошли проверку')
    out = os.path.join(ROOT, 'js', 'layouts.js')
    with open(out, 'w', encoding='utf-8') as f:
        f.write('// =============================================================\n')
        f.write('// Раскладки мебели этажей. СГЕНЕРИРОВАНО assets/environment/make_layouts.py —\n')
        f.write('// не редактировать вручную: поменяй генератор и запусти его снова.\n')
        f.write('// shared — общее для всех раскладок: старт, маршруты персонажей, места медкарт,\n')
        f.write('// лестниц и пробирок. list — мебель (obstacles) и ограждения «Ремонта» (repair).\n')
        f.write('// =============================================================\n')
        f.write('const LAYOUTS = ' + json.dumps({'shared': SHARED, 'list': layouts}, ensure_ascii=False) + ';\n')
    print('ok →', os.path.relpath(out, ROOT))
