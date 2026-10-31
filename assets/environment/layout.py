# Константы проверки раскладки и исходный вариант раскладки «поликлиника».
# Игра и check_layout.py берут препятствия из js/config.js (CONFIG.OBSTACLES).
# x, y — центр; w, h — размер; look — визуальный вариант.
ARENA_W, ARENA_H = 1080, 1774
OBSTACLES = [
    # север — кабинеты
    dict(x=250, y=330, w=190, h=40, look='bench'),
    dict(x=540, y=410, w=80, h=160, look='couch'),
    dict(x=830, y=330, w=190, h=40, look='chairs4'),
    dict(x=160, y=640, w=40, h=200, look='screen'),
    dict(x=340, y=590, w=80, h=80, look='scales'),
    dict(x=740, y=590, w=80, h=80, look='ficus'),
    dict(x=920, y=640, w=40, h=200, look='screen'),
    dict(x=540, y=700, w=120, h=40, look='chairs3'),
    # середина — коридор с креслами
    dict(x=330, y=830, w=120, h=40, look='magtable'),
    dict(x=750, y=830, w=120, h=40, look='chairs3'),
    dict(x=270, y=990, w=190, h=40, look='chairs4'),
    dict(x=540, y=960, w=40, h=120, look='stand'),
    dict(x=810, y=990, w=190, h=40, look='bench'),
    # юг — вход: регистратура, гардероб, бахилы, терминал
    dict(x=140, y=1260, w=40, h=200, look='kartoteka'),
    dict(x=360, y=1220, w=80, h=80, look='ficus'),
    dict(x=540, y=1200, w=40, h=120, look='cooler'),
    dict(x=720, y=1220, w=80, h=80, look='scales'),
    dict(x=940, y=1260, w=40, h=200, look='kartoteka'),
    dict(x=330, y=1430, w=80, h=80, look='bahily'),
    dict(x=540, y=1440, w=120, h=40, look='chairs3'),
    dict(x=750, y=1430, w=80, h=80, look='terminal'),
    dict(x=260, y=1640, w=200, h=40, look='wardrobe'),
    dict(x=820, y=1640, w=200, h=40, look='registratura'),
]
OLD = [(250,340,190,40),(540,340,80,160),(830,340,190,40),(160,670,40,200),(540,670,200,40),(920,670,40,200),
       (270,1000,190,40),(540,1000,40,200),(810,1000,190,40),(140,1330,40,200),(540,1330,80,160),(940,1330,40,200),
       (250,1640,190,40),(830,1640,200,40)]
PLAYER_START = (540, 1618)
ENEMY_STARTS = [(540, 171), (930, 140), (150, 140)]
FALLBACK = [(540, 160), (540, 535), (60, 1110), (1020, 1110), (540, 1690)]
MIN_GAP, WALL_GAP, START_R, BONUS_MARGIN = 110, 105, 150, 40
PLAYER_R = 27

def rect(o):
    if isinstance(o, dict): x, y, w, h = o['x'], o['y'], o['w'], o['h']
    else: x, y, w, h = o
    return (x - w / 2, y - h / 2, x + w / 2, y + h / 2)

def rect_dist(a, b):
    dx = max(0, b[0] - a[2], a[0] - b[2]); dy = max(0, b[1] - a[3], a[1] - b[3])
    return (dx * dx + dy * dy) ** 0.5

def point_rect_dist(p, r):
    dx = max(r[0] - p[0], 0, p[0] - r[2]); dy = max(r[1] - p[1], 0, p[1] - r[3])
    return (dx * dx + dy * dy) ** 0.5
