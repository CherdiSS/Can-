# Пиксельные элементы интерфейса «Неонового Побега» в палитре поликлиники.
# Перегенерировать: python3 assets/ui/make_ui.py  (нужен Pillow)
#  - joystick_base.png  — основание джойстика (масляная панель с контуром)
#  - joystick_knob.png  — ручка джойстика (побелка, тёмная нижняя грань)
#  - ring.png           — кольцо у ног врага (белое, в игре красится в цвет роли)
#  - arrow.png          — стрелка у края экрана (белая с тёмным контуром, красится в цвет цели)
#  - puddle.png         — лужа после санитарки (скользко)
#  - arrow_diag.png     — та же стрелка по диагонали (вправо-вниз): пиксель-арт не поворачивают на 45°
#  - heart.png, heart_empty.png — сердечки здоровья (12×11)
#  - medcard.png        — медкарта (папка) на полу — её разносят по кабинетам
#  - medkit.png         — аптечка (+1 сердечко)
#  - stairs.png         — лестница на следующий этаж (вид сверху, 80×80)
#  - tube.png           — пробирка с анализом (задача «Анализы»)
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
T = (0, 0, 0, 0)
def c(r, g, b, a=255): return (r, g, b, a)

# Палитра — та же, что у окружения (assets/environment/make_environment.py)
OUT = c(30, 36, 44)
WW, WW_SH = c(214, 214, 200), c(178, 180, 170)
PANEL, PANEL_D, BORDER = c(122, 164, 140), c(92, 130, 110), c(58, 72, 68)
WHITE = c(255, 255, 255)


def disc(size, inside):
    """Попиксельный круг: функция inside(dx, dy, r) решает цвет пикселя."""
    im = Image.new('RGBA', (size, size), T)
    p = im.load()
    r = size / 2
    for y in range(size):
        for x in range(size):
            dx, dy = x + 0.5 - r, y + 0.5 - r
            col = inside(dx, dy, r)
            if col:
                p[x, y] = col
    return im


def base_color(dx, dy, r):
    d = (dx * dx + dy * dy) ** 0.5
    if d > r: return None
    if d > r - 1.5: return OUT                       # контур
    if d > r - 3.0: return BORDER                    # тёмный обод
    if dy > 0 and d > r - 5.0: return PANEL_D        # нижняя грань (объём 3/4)
    if abs(dx) < 0.6 or abs(dy) < 0.6: return PANEL_D  # крестик-направляющие
    return PANEL


def knob_color(dx, dy, r):
    d = (dx * dx + dy * dy) ** 0.5
    if d > r: return None
    if d > r - 1.2: return OUT
    if dy > r * 0.35: return WW_SH                   # тёмная нижняя грань
    return WW


def ellipse_ring(w, h, thickness=2):
    im = Image.new('RGBA', (w, h), T)
    p = im.load()
    cx, cy = w / 2, h / 2
    for y in range(h):
        for x in range(w):
            nx = (x + 0.5 - cx) / (w / 2)
            ny = (y + 0.5 - cy) / (h / 2)
            outer = nx * nx + ny * ny <= 1
            ix = (x + 0.5 - cx) / (w / 2 - thickness)
            iy = (y + 0.5 - cy) / (h / 2 - thickness)
            inner = ix * ix + iy * iy <= 1
            if outer and not inner:
                p[x, y] = WHITE
            elif inner:
                p[x, y] = c(255, 255, 255, 60)        # лёгкая заливка внутри
    return im


def arrow():
    # Стрелка остриём вправо, 12×12: белая заливка, тёмный контур
    rows = [
        "............",
        "..OO........",
        "..OWO.......",
        "..OWWOO.....",
        "..OWWWWOO...",
        "..OWWWWWWO..",
        "..OWWWWWWO..",
        "..OWWWWOO...",
        "..OWWOO.....",
        "..OWO.......",
        "..OO........",
        "............",
    ]
    im = Image.new('RGBA', (12, 12), T)
    p = im.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == 'O': p[x, y] = OUT
            elif ch == 'W': p[x, y] = WHITE
    return im


def arrow_diag():
    # Треугольник остриём вправо-вниз, контур — пустые соседи закрашенных пикселей
    size = 12
    tip, b1, b2 = (10.2, 10.2), (1.0, 8.0), (8.0, 1.0)
    def inside(px, py):
        def side(a, b, p):
            return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
        s1, s2, s3 = side(tip, b1, (px, py)), side(b1, b2, (px, py)), side(b2, tip, (px, py))
        return (s1 >= 0 and s2 >= 0 and s3 >= 0) or (s1 <= 0 and s2 <= 0 and s3 <= 0)
    im = Image.new('RGBA', (size, size), T)
    p = im.load()
    fill = {(x, y) for y in range(size) for x in range(size) if inside(x + 0.5, y + 0.5)}
    for (x, y) in fill:
        p[x, y] = WHITE
    for y in range(size):
        for x in range(size):
            if (x, y) not in fill and any((x + dx, y + dy) in fill for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                p[x, y] = OUT
    return im


def puddle():
    # Лужа 64×24: полупрозрачная голубая, с бликами
    im = Image.new('RGBA', (64, 24), T)
    p = im.load()
    for y in range(24):
        for x in range(64):
            nx, ny = (x + 0.5 - 32) / 31, (y + 0.5 - 12) / 11
            wobble = 0.08 * ((x // 6) % 2)
            d = nx * nx + ny * ny
            if d <= 1 - wobble:
                p[x, y] = c(150, 200, 230, 150) if d > 0.7 - wobble else c(170, 214, 238, 120)
    for (x0, y0, x1) in ((18, 7, 26), (36, 13, 41), (44, 8, 47)):
        for x in range(x0, x1 + 1):
            p[x, y0] = c(240, 250, 255, 210)
    return im


class Px:
    """Холст для простых предметов: put / rect / frame."""
    def __init__(self, w, h):
        self.im = Image.new('RGBA', (w, h), T); self.p = self.im.load(); self.w, self.h = w, h
    def rect(self, x0, y0, x1, y1, col):
        for y in range(max(0, y0), min(self.h, y1 + 1)):
            for x in range(max(0, x0), min(self.w, x1 + 1)): self.p[x, y] = col
    def frame(self, x0, y0, x1, y1, col):
        self.rect(x0, y0, x1, y0, col); self.rect(x0, y1, x1, y1, col)
        self.rect(x0, y0, x0, y1, col); self.rect(x1, y0, x1, y1, col)

HEART = ["..##...##..", ".####.####.", "###########", "###########", "###########",
         ".#########.", "..#######..", "...#####...", "....###....", ".....#....."]

def heart(fill, shine):
    s = Px(13, 12)
    for y, row in enumerate(HEART):
        for x, v in enumerate(row):
            if v == '#':
                s.p[x + 1, y + 1] = fill
    src = s.im.copy().load()
    for y in range(12):                                  # тёмный контур вокруг
        for x in range(13):
            if src[x, y][3]: continue
            if any(0 <= x + dx < 13 and 0 <= y + dy < 12 and src[x + dx, y + dy][3]
                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                s.p[x, y] = OUT
    if shine:
        s.rect(3, 2, 4, 3, shine)
    return s.im

def medcard():
    """Медкарта: толстая картонная папка с полосой и крестом, 32×24."""
    CARD, CARD_D, PAPERS = c(196, 168, 112), c(150, 124, 80), c(226, 222, 206)
    s = Px(32, 24)
    s.rect(2, 3, 29, 21, PAPERS); s.rect(1, 5, 30, 22, CARD); s.rect(1, 19, 30, 22, CARD_D)
    s.frame(1, 5, 30, 22, OUT); s.rect(3, 2, 28, 4, OUT); s.rect(4, 3, 27, 4, PAPERS)
    s.rect(5, 8, 18, 10, c(240, 236, 220)); s.frame(5, 8, 18, 10, OUT)        # наклейка с фамилией
    s.rect(23, 9, 24, 15, c(176, 48, 52)); s.rect(21, 11, 26, 13, c(176, 48, 52))   # крест
    s.rect(5, 13, 17, 13, CARD_D); s.rect(5, 15, 14, 15, CARD_D)
    return s.im

def medkit():
    """Аптечка: белый чемоданчик с красным крестом, 36×30."""
    BOX, BOX_D, RED = c(228, 226, 216), c(170, 168, 158), c(196, 40, 46)
    s = Px(36, 30)
    s.rect(12, 1, 23, 6, OUT); s.rect(14, 3, 21, 6, T)                           # ручка
    s.rect(1, 6, 34, 28, OUT); s.rect(2, 7, 33, 27, BOX); s.rect(2, 23, 33, 27, BOX_D)
    s.rect(16, 10, 19, 22, RED); s.rect(11, 14, 24, 18, RED)
    s.rect(3, 8, 32, 8, c(250, 250, 244))
    return s.im

def stairs():
    """Лестница вниз на следующий этаж (вид сверху): ступени темнеют вглубь, перила, стрелка."""
    s = Px(80, 80)
    s.rect(0, 0, 79, 79, OUT)
    for k in range(7):                                    # ступени: чем ниже, тем темнее
        v = 150 - k * 16
        y0 = 4 + k * 10
        s.rect(6, y0, 73, y0 + 8, c(v, v - 4, v - 14)); s.rect(6, y0 + 8, 73, y0 + 9, c(v - 40, v - 44, v - 50))
        s.rect(6, y0, 73, y0, c(min(255, v + 30), min(255, v + 26), min(255, v + 16)))
    s.rect(1, 1, 5, 78, c(110, 86, 60)); s.rect(74, 1, 78, 78, c(110, 86, 60))   # перила
    s.rect(2, 1, 2, 78, c(150, 122, 88)); s.rect(75, 1, 75, 78, c(150, 122, 88))
    ARROW = [".......##.......", ".......##.......", ".......##.......", ".......##.......",
             ".......##.......", "....########....", ".....######.....", "......####......", ".......##......."]
    for y, row in enumerate(ARROW):                       # светлая стрелка «вниз»
        for x, v in enumerate(row):
            if v == '#':
                s.rect(24 + x * 2, 24 + y * 3, 25 + x * 2, 26 + y * 3, c(214, 220, 190))
    return s.im


def tube():
    """Пробирка с кровью в штативе-подставке, 20×36."""
    GLASS_L, BLOOD = c(214, 226, 226), c(176, 36, 44)
    s = Px(20, 36)
    s.rect(5, 1, 14, 3, OUT); s.rect(6, 2, 13, 2, c(90, 120, 200))         # пробка
    s.rect(5, 4, 14, 30, OUT); s.rect(6, 4, 13, 29, GLASS_L)
    s.rect(6, 14, 13, 29, BLOOD); s.rect(6, 14, 13, 14, c(220, 80, 86)); s.rect(7, 5, 7, 27, c(250, 252, 252))
    s.rect(2, 31, 17, 35, OUT); s.rect(3, 32, 16, 34, c(150, 154, 152))     # подставка
    return s.im


tube().save(os.path.join(HERE, 'tube.png'))
heart(c(200, 40, 48), c(250, 160, 160)).save(os.path.join(HERE, 'heart.png'))
heart(c(70, 70, 74), None).save(os.path.join(HERE, 'heart_empty.png'))
medcard().save(os.path.join(HERE, 'medcard.png'))
medkit().save(os.path.join(HERE, 'medkit.png'))
stairs().save(os.path.join(HERE, 'stairs.png'))
disc(30, base_color).save(os.path.join(HERE, 'joystick_base.png'))
disc(13, knob_color).save(os.path.join(HERE, 'joystick_knob.png'))
ellipse_ring(46, 14).save(os.path.join(HERE, 'ring.png'))
arrow().save(os.path.join(HERE, 'arrow.png'))
arrow_diag().save(os.path.join(HERE, 'arrow_diag.png'))
puddle().save(os.path.join(HERE, 'puddle.png'))
print('ok')
