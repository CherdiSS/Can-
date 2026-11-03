# Пиксельные элементы интерфейса «Неонового Побега» в палитре поликлиники.
# Перегенерировать: python3 assets/ui/make_ui.py  (нужен Pillow)
#  - joystick_base.png  — основание джойстика (масляная панель с контуром)
#  - joystick_knob.png  — ручка джойстика (побелка, тёмная нижняя грань)
#  - ring.png           — кольцо у ног врага (белое, в игре красится в цвет роли)
#  - arrow.png          — стрелка у края экрана (белая с тёмным контуром, красится в цвет цели)
#  - arrow_diag.png     — та же стрелка по диагонали (вправо-вниз): пиксель-арт не поворачивают на 45°
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


disc(30, base_color).save(os.path.join(HERE, 'joystick_base.png'))
disc(13, knob_color).save(os.path.join(HERE, 'joystick_knob.png'))
ellipse_ring(46, 14).save(os.path.join(HERE, 'ring.png'))
arrow().save(os.path.join(HERE, 'arrow.png'))
arrow_diag().save(os.path.join(HERE, 'arrow_diag.png'))
print('ok')
