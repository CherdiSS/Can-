# Пиксель-арт окружения «российская районная поликлиника» для «Неонового Побега».
# Всё рисуется попиксельно в итоговом размере, без сглаживания.
# Объём препятствий: вид сверху 3/4 — светлая верхняя грань + тёмная фронтальная (южная) грань,
# обе целиком внутри коллизионного прямоугольника; тень рисуется отдельным слоем в игре.
from PIL import Image
import os, random

OUTDIR = os.path.dirname(os.path.abspath(__file__))
T = (0, 0, 0, 0)
def c(r, g, b): return (r, g, b, 255)

# ---------------- палитра окружения (25 цветов) ----------------
OUT = c(30, 36, 44)
P1, P2, PL, PH = c(146, 118, 90), c(137, 110, 84), c(122, 97, 75), c(160, 132, 102)   # линолеум «паркет»
WW, WW_SH = c(214, 214, 200), c(178, 180, 170)            # побелка
PANEL, PANEL_D, BORDER = c(122, 164, 140), c(92, 130, 110), c(58, 72, 68)   # масляная панель
WD_L, WD, WD_D = c(196, 170, 134), c(166, 138, 104), c(116, 92, 70)
M_L, M, M_D = c(184, 192, 200), c(138, 148, 160), c(92, 100, 112)
SEAT, SEAT_D = c(82, 112, 140), c(60, 84, 108)
GR, GR_D = c(104, 148, 92), c(66, 104, 62)
SH, SH_D = c(226, 230, 226), c(182, 190, 188)
BURG = c(118, 60, 62)
GLASS = c(150, 182, 192)
MAT = c(52, 66, 90)

# ---------------- пиксельный шрифт ----------------
FONT = {  # буквы 4×5
    'Р': ["###.", "#..#", "###.", "#...", "#..."],
    'Е': ["####", "#...", "###.", "#...", "####"],
    'Г': ["####", "#...", "#...", "#...", "#..."],
    'И': ["#..#", "#..#", "#.##", "##.#", "#..#"],
    'С': [".###", "#...", "#...", "#...", ".###"],
    'Т': ["####", ".##.", ".##.", ".##.", ".##."],
    'А': [".##.", "#..#", "####", "#..#", "#..#"],
    'У': ["#..#", "#..#", ".###", "...#", "###."],
    'Д': [".##.", ".#.#", ".#.#", "####", "#..#"],
    'О': [".##.", "#..#", "#..#", "#..#", ".##."],
    'Б': ["####", "#...", "###.", "#..#", "###."],
}
DIGITS = {  # цифры 3×5
    '0': ["###", "#.#", "#.#", "#.#", "###"], '1': [".#.", "##.", ".#.", ".#.", "###"],
    '2': ["###", "..#", "###", "#..", "###"], '3': ["###", "..#", ".##", "..#", "###"],
    '4': ["#.#", "#.#", "###", "..#", "..#"], '5': ["###", "#..", "###", "..#", "###"],
    '6': ["###", "#..", "###", "#.#", "###"], '7': ["###", "..#", ".#.", ".#.", ".#."],
    '8': ["###", "#.#", "###", "#.#", "###"], '9': ["###", "#.#", "###", "..#", "###"],
}

class Img:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.im = Image.new("RGBA", (w, h), T); self.p = self.im.load()
    def put(self, x, y, col):
        if 0 <= x < self.w and 0 <= y < self.h: self.p[x, y] = col
    def rect(self, x0, y0, x1, y1, col):
        for y in range(max(0, y0), min(self.h, y1 + 1)):
            for x in range(max(0, x0), min(self.w, x1 + 1)): self.p[x, y] = col
    def frame(self, x0, y0, x1, y1, col):
        self.rect(x0, y0, x1, y0, col); self.rect(x0, y1, x1, y1, col)
        self.rect(x0, y0, x0, y1, col); self.rect(x1, y0, x1, y1, col)
    def ellipse(self, x0, y0, x1, y1, col):
        cx, cy, rx, ry = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0 + 1) / 2, (y1 - y0 + 1) / 2
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if ((x + .5 - cx - .5) / rx) ** 2 + ((y + .5 - cy - .5) / ry) ** 2 <= 1: self.put(x, y, col)
    def text(self, x, y, s, col):
        for ch in s:
            g = FONT.get(ch) or DIGITS.get(ch)
            if g is None: x += 3; continue
            for gy, row in enumerate(g):
                for gx, v in enumerate(row):
                    if v == '#': self.put(x + gx, y + gy, col)
            x += len(g[0]) + 1
    def save(self, name): self.im.save(os.path.join(OUTDIR, name)); return name

def text_width(s):
    return sum(len((FONT.get(ch) or DIGITS.get(ch) or ["..."])[0]) + 1 for ch in s) - 1

def block(w, h, H, top, top_hi, front, front_d):
    """Объёмный блок: верх (h-H строк) + фронт (H строк), тёмный контур."""
    s = Img(w, h)
    s.rect(0, 0, w - 1, h - H - 1, top); s.rect(1, 1, w - 2, 1, top_hi)
    s.rect(0, h - H, w - 1, h - 1, front); s.rect(0, h - 3, w - 1, h - 1, front_d)
    s.rect(0, h - H, w - 1, h - H, OUT); s.frame(0, 0, w - 1, h - 1, OUT)
    return s

def pad(s, H):
    """Резиновый коврик под предметом: вся коллизионная площадь видна, нет «воздуха»."""
    for y in range(s.h):
        for x in range(s.w):
            if s.p[x, y][3] == 0:
                s.p[x, y] = OUT if y >= s.h - 4 else BORDER
    s.frame(0, 0, s.w - 1, s.h - 1, OUT)
    return s

def finish(s, H):
    s.rect(0, s.h - H, s.w - 1, s.h - H, OUT); s.frame(0, 0, s.w - 1, s.h - 1, OUT); return s

# ================================================================ пол и стены
def floor_tile():
    """Линолеум «под паркет» квадратами: в соседних квадратах планки повёрнуты."""
    s = Img(64, 64); rnd = random.Random(11)
    for qy in range(2):
        for qx in range(2):
            x0, y0 = qx * 32, qy * 32
            horiz = (qx + qy) % 2 == 0
            for k in range(4):
                col = P1 if k % 2 == 0 else P2
                if horiz: s.rect(x0, y0 + k * 8, x0 + 31, y0 + k * 8 + 7, col); s.rect(x0, y0 + k * 8, x0 + 31, y0 + k * 8, PL)
                else:     s.rect(x0 + k * 8, y0, x0 + k * 8 + 7, y0 + 31, col); s.rect(x0 + k * 8, y0, x0 + k * 8, y0 + 31, PL)
    for _ in range(18):
        s.put(rnd.randrange(64), rnd.randrange(64), PH)
    return s

def decal_wear():
    """Потёртость линолеума в проходах — разреженные светлые пиксели."""
    s = Img(96, 48); rnd = random.Random(5)
    for y in range(48):
        for x in range(96):
            d = ((x - 48) / 48) ** 2 + ((y - 24) / 24) ** 2
            if d < 1 and rnd.random() < 0.55 * (1 - d): s.put(x, y, PH)
    return s

def decal_seam():
    """Шов между полотнами линолеума (вертикальный тайл 2×64)."""
    s = Img(2, 64); s.rect(0, 0, 0, 63, PL); s.rect(1, 0, 1, 63, PH); return s

def decal_mat():
    s = Img(112, 56)
    s.rect(0, 0, 111, 55, MAT); s.frame(0, 0, 111, 55, OUT); s.frame(4, 4, 107, 51, SEAT_D)
    for y in range(10, 48, 6): s.rect(8, y, 103, y, OUT)
    return s

def wall_north(width=1080):
    """Северная стена целиком: побелка сверху, масляная панель снизу, двери кабинетов, стенд, батарея."""
    h = 44; s = Img(width, h)
    s.rect(0, 0, width - 1, 3, WW_SH); s.rect(0, 3, width - 1, 3, OUT)
    s.rect(0, 4, width - 1, 21, WW)
    s.rect(0, 22, width - 1, 23, BORDER)                 # бордюр между побелкой и панелью
    s.rect(0, 24, width - 1, 39, PANEL); s.rect(0, 36, width - 1, 39, PANEL_D)
    s.rect(0, 40, width - 1, 43, BORDER); s.rect(0, 40, width - 1, 40, OUT)   # плинтус
    for i, x in enumerate((90, 410, 650, 970)):          # двери кабинетов 101–104
        s.rect(x - 2, 6, x + 31, 43, WD_D)
        s.rect(x, 8, x + 29, 43, WD); s.rect(x + 14, 8, x + 15, 43, WD_D)
        s.rect(x + 24, 26, x + 26, 27, M_L)
        s.rect(x + 6, 11, x + 23, 18, SH); s.frame(x + 6, 11, x + 23, 18, M_D)
        s.text(x + 9, 12, str(101 + i), BORDER)
    s.rect(230, 7, 300, 20, WD_D); s.rect(232, 9, 298, 19, WD_L)   # информационный стенд
    for k, x in enumerate(range(236, 296, 15)):
        s.rect(x, 10, x + 11, 18, SH); s.rect(x + 2, 12, x + 9, 12, SH_D); s.rect(x + 2, 14, x + 7, 14, SH_D)
    s.rect(281, 11, 283, 17, GR); s.rect(279, 13, 285, 15, GR)     # зелёный крест-пиктограмма
    for x in (760, 860):                                            # чугунные батареи
        s.rect(x, 26, x + 44, 38, M_D)
        for k in range(x + 1, x + 44, 4): s.rect(k, 27, k + 2, 37, M_L)
    return s

def wall_side():
    s = Img(10, 64); s.rect(0, 0, 9, 63, WW_SH); s.rect(9, 0, 9, 63, OUT); s.rect(0, 0, 2, 63, PANEL_D); return s

def wall_bottom():
    s = Img(64, 10); s.rect(0, 0, 63, 9, WW_SH); s.rect(0, 0, 63, 0, OUT); s.rect(0, 7, 63, 9, PANEL_D); return s

# ================================================================ препятствия
def chairs(w, n, h=40, H=14):
    """Секционные металлические кресла, сцепленные в ряд."""
    s = Img(w, h); s.rect(0, 0, w - 1, h - 1, M_D)
    cw = (w - 2) // n
    for i in range(n):
        x0 = 1 + i * cw + 3; x1 = 1 + (i + 1) * cw - 3
        s.rect(x0, 2, x1, 8, SEAT_D); s.rect(x0, 2, x1, 2, SEAT)          # спинка
        s.rect(x0, 9, x1, h - H - 1, SEAT); s.rect(x0 + 2, 10, x1 - 2, 10, M_L)
        s.rect(x0, h - H, x1, h - H + 3, SEAT_D)
        s.rect(x0 + 4, h - H + 4, x1 - 4, h - 4, OUT)
    for i in range(n + 1):                                                 # подлокотники
        x = 1 + i * cw; s.rect(max(1, x - 1), 4, min(w - 2, x + 1), h - H - 1, M_L)
        s.rect(max(1, x - 1), h - H + 1, min(w - 2, x + 1), h - 3, M)     # стойки
    s.rect(1, h - 6, w - 2, h - 5, M)                                      # общая балка
    return finish(s, H)

def bench(w, h=40, H=14):
    """Деревянная скамья из реек."""
    s = block(w, h, H, WD, WD_L, WD, WD_D)
    for k, y in enumerate(range(3, h - H - 2, 5)):
        s.rect(2, y, w - 3, y + 3, WD_L if k % 2 == 0 else WD); s.rect(2, y + 4, w - 3, y + 4, WD_D)
    for x in (10, w // 2 - 3, w - 17):
        s.rect(x, 2, x + 6, h - H - 1, WD_D)                               # поперечины
        s.rect(x + 1, h - H + 2, x + 5, h - 2, M_D)                         # ножки
    s.rect(2, h - H + 1, w - 3, h - H + 4, WD)
    return finish(s, H)

def registratura(w=200, h=40, H=14):
    """Окно регистратуры со стойкой и табличкой «РЕГИСТРАТУРА» на фронте."""
    s = block(w, h, H, WD_L, SH, WD, WD_D)
    s.rect(1, 1, w - 2, 12, M); s.rect(3, 3, w - 4, 11, GLASS)             # остеклённая перегородка
    for x in range(40, w - 10, 40): s.rect(x - 1, 2, x, 12, M)
    s.rect(w // 2 - 14, 7, w // 2 + 13, 12, OUT)                           # окошко
    s.rect(w // 2 - 12, 8, w // 2 + 11, 12, M_D)
    s.rect(1, 13, w - 2, 13, WD_D)
    s.rect(30, 16, 46, 23, SH); s.rect(32, 18, 44, 18, SH_D); s.rect(32, 20, 41, 20, SH_D)  # бланки
    s.rect(140, 15, 168, 24, SEAT_D); s.rect(141, 16, 167, 17, SEAT)       # журнал записи
    s.rect(110, 17, 122, 18, OUT)                                          # ручка на верёвочке
    tw = text_width("РЕГИСТРАТУРА"); px0 = (w - tw) // 2 - 3
    s.rect(px0, h - H + 3, px0 + tw + 5, h - 4, SH); s.frame(px0, h - H + 3, px0 + tw + 5, h - 4, M_D)
    s.text(px0 + 3, h - H + 5, "РЕГИСТРАТУРА", BORDER)
    return finish(s, H)

def wardrobe(w=200, h=40, H=14):
    """Гардероб: вешалка с пальто за барьером и табличка «ГАРДЕРОБ»."""
    s = Img(w, h); s.rect(0, 0, w - 1, h - H - 1, WD_D)
    s.rect(2, 4, w - 3, 5, M_L)                                            # штанга
    coats = [SEAT_D, WD_D, BURG, M_D, GR_D, PANEL_D, OUT, SEAT, WD]
    rnd = random.Random(2)
    x = 4
    while x < w - 16:
        cw = rnd.choice((11, 13, 15)); col = rnd.choice(coats)
        s.ellipse(x, 3, x + cw, 19, col); s.rect(x + cw // 2, 3, x + cw // 2, 6, M_L)
        x += cw - 2
    s.rect(1, 20, w - 2, h - H - 1, WD_L); s.rect(1, 20, w - 2, 20, SH)    # барьер-стойка
    for x in range(24, w - 10, 30): s.rect(x, 22, x + 4, 24, M_L)           # номерки
    s.rect(0, h - H, w - 1, h - 1, WD); s.rect(0, h - 3, w - 1, h - 1, WD_D)
    tw = text_width("ГАРДЕРОБ"); px0 = (w - tw) // 2 - 3
    s.rect(px0, h - H + 3, px0 + tw + 5, h - 4, SH); s.frame(px0, h - H + 3, px0 + tw + 5, h - 4, M_D)
    s.text(px0 + 3, h - H + 5, "ГАРДЕРОБ", BORDER)
    return finish(s, H)

def magtable(w=120, h=40, H=14):
    """Журнальный столик с журналами и газетой."""
    s = block(w, h, H, WD, WD_L, WD_D, OUT)
    s.rect(8, 5, 30, 20, SEAT); s.rect(10, 7, 28, 9, SH)                   # журнал
    s.rect(26, 8, 46, 22, BURG); s.rect(28, 10, 44, 11, SH_D)
    s.rect(56, 4, 86, 21, SH)                                              # газета
    for y in range(7, 20, 3): s.rect(59, y, 83, y, SH_D)
    s.rect(59, 7, 68, 12, M_D)
    s.ellipse(96, 6, 110, 20, M_L); s.ellipse(99, 9, 107, 17, GLASS)       # стакан с водой
    for x in (5, w - 9): s.rect(x, h - H + 2, x + 3, h - 2, WD_D)
    return finish(s, H)

def kartoteka(w=40, h=200, H=16):
    """Картотека: деревянный шкаф с медкартами (сверху видны корешки)."""
    s = block(w, h, H, WD, WD_L, WD_D, OUT)
    cols = [SH, SH_D, SEAT, WD_L, GR, BURG, GLASS]
    rnd = random.Random(9); y = 4
    while y < h - H - 8:
        s.rect(3, y, w - 4, y, WD_D); x = 4
        while x < w - 5:
            fw = rnd.choice((2, 3, 4))
            s.rect(x, y + 1, min(x + fw - 1, w - 5), y + 13, rnd.choice(cols)); x += fw + 1
        s.rect(w // 2 - 3, y + 6, w // 2 + 2, y + 7, M_L)                   # бирка ящика
        y += 16
    for k in range(3):
        s.rect(4 + k * 11, h - H + 3, 4 + k * 11 + 9, h - 4, WD); s.rect(7 + k * 11, h - H + 7, 10 + k * 11, h - H + 8, M_L)
    return finish(s, H)

def screen(w=40, h=200, H=16):
    """Медицинская ширма из трёх створок: металлическая рама и белая ткань."""
    s = Img(w, h); s.rect(0, 0, w - 1, h - 1, M_D)
    n = 3; ph = (h - H - 2) // n
    for i in range(n):
        y0, y1 = 1 + i * ph + 2, 1 + (i + 1) * ph - 2
        s.rect(4, y0, w - 5, y1, M_L); s.rect(7, y0 + 3, w - 8, y1 - 3, SH)
        for x in range(11, w - 8, 6): s.rect(x, y0 + 3, x, y1 - 3, SH_D)     # складки ткани
        s.rect(w // 2 - 2, y1 + 1, w // 2 + 1, y1 + 3, M)                   # шарнир
    s.rect(0, h - H, w - 1, h - 1, M_D); s.rect(4, h - H + 1, w - 5, h - 6, SH_D)
    for x in (4, w - 9): s.ellipse(x, h - 6, x + 4, h - 2, OUT)             # колёсики
    return finish(s, H)

def cooler(w=40, h=120, H=16):
    """Кулер с водой и урна рядом."""
    s = block(w, h, H, PANEL_D, PANEL, PANEL_D, BORDER)
    s.ellipse(6, 6, 33, 33, M); s.ellipse(9, 9, 30, 30, OUT); s.ellipse(12, 12, 20, 18, M_D)   # урна
    s.rect(5, 44, 34, h - H - 2, SH); s.frame(5, 44, 34, h - H - 2, SH_D)   # корпус кулера
    s.ellipse(9, 48, 30, 69, GLASS); s.ellipse(12, 51, 27, 66, SEAT)       # бутыль сверху
    s.rect(14, 54, 16, 57, SH)
    s.rect(11, h - H - 14, 15, h - H - 9, BURG); s.rect(24, h - H - 14, 28, h - H - 9, SEAT_D)  # краны
    s.rect(5, h - H + 1, 34, h - 4, SH_D); s.rect(10, h - H + 4, 29, h - H + 6, M_D)
    return finish(s, H)

def stand(w=40, h=120, H=16):
    """Информационный стенд «санбюллетень» с листовками."""
    s = block(w, h, H, WD_D, WD, WD_D, OUT)
    s.rect(3, 3, w - 4, h - H - 3, WD_L)
    for y in range(6, h - H - 14, 22):
        s.rect(6, y, w - 7, y + 17, SH)
        for k in range(y + 9, y + 16, 3): s.rect(8, k, w - 9, k, SH_D)
        s.rect(w // 2 - 1, y + 2, w // 2, y + 7, GR); s.rect(w // 2 - 3, y + 4, w // 2 + 2, y + 5, GR)
        s.put(8, y + 1, BURG); s.put(w - 9, y + 1, BURG)                    # кнопки
    for x in (6, w - 10): s.rect(x, h - H + 2, x + 3, h - 2, M_D)            # ножки
    return finish(s, H)

def couch(w=80, h=160, H=16):
    """Кушетка из коричневого дерматина с простынёй."""
    s = block(w, h, H, BURG, WD_D, BURG, OUT)
    s.rect(4, 4, w - 5, h - H - 4, SH); s.rect(w - 9, 4, w - 5, h - H - 4, SH_D)
    for y in range(44, h - H - 8, 24): s.rect(10, y, w - 16, y, SH_D)
    s.rect(10, 8, w - 11, 28, SH); s.frame(10, 8, w - 11, 28, SH_D); s.rect(12, 26, w - 13, 27, SH_D)
    s.rect(4, h - H - 4, w - 5, h - H - 1, BURG)
    for x in (5, w - 8): s.rect(x, h - H + 3, x + 2, h - 2, M)
    s.rect(9, h - H + 4, w - 10, h - 4, OUT)
    return finish(s, H)

def gurney(w=80, h=160, H=16):
    """Каталка: металлическая рама, матрас, ручка."""
    s = Img(w, h); s.rect(0, 0, w - 1, h - H - 1, M)
    s.rect(3, 3, w - 4, 8, M_L); s.rect(6, 5, w - 7, 6, M_D)                # ручка
    s.rect(6, 12, w - 7, h - H - 6, SH_D); s.rect(8, 14, w - 9, h - H - 8, SH)
    s.rect(12, 18, w - 13, 34, SH); s.frame(12, 18, w - 13, 34, SH_D)      # подушка
    s.rect(8, 70, w - 9, 96, GLASS); s.rect(8, 70, w - 9, 71, SEAT)        # сложенное одеяло
    s.rect(0, h - H, w - 1, h - 1, M_D); s.rect(3, h - H + 1, w - 4, h - H + 4, M)
    for x in (5, w - 13): s.ellipse(x, h - 9, x + 7, h - 2, OUT); s.ellipse(x + 2, h - 7, x + 5, h - 4, M)
    return finish(s, H)

def ficus(w=80, h=80, H=16):
    """Фикус в деревянной кадке."""
    s = Img(w, h)
    s.rect(14, 26, w - 15, h - H - 1, WD); s.frame(14, 26, w - 15, h - H - 1, WD_D)
    s.rect(18, 30, w - 19, h - H - 5, WD_D)                                 # земля
    s.rect(14, h - H, w - 15, h - 1, WD); s.rect(14, h - H + 3, w - 15, h - H + 4, M_D); s.rect(14, h - 5, w - 15, h - 4, M_D)
    s.frame(14, h - H, w - 15, h - 1, OUT)
    leaves = [(10, 6, 30, 20), (34, 2, 52, 16), (50, 10, 72, 24), (4, 22, 24, 36), (56, 28, 76, 42),
              (22, 18, 42, 32), (40, 20, 58, 34), (26, 36, 44, 48), (44, 38, 60, 50)]
    for (x0, y0, x1, y1) in leaves:
        s.ellipse(x0, y0, x1, y1, OUT); s.ellipse(x0 + 1, y0 + 1, x1 - 1, y1 - 1, GR)
        s.rect(x0 + 3, (y0 + y1) // 2, x1 - 3, (y0 + y1) // 2, GR_D)
    s.rect(39, 34, 40, 46, WD_D)                                            # ствол
    return pad(s, H)

def bahily(w=80, h=80, H=16):
    """Автомат для бахил и урна."""
    s = Img(w, h)
    s.rect(2, 8, 44, h - H - 1, M_L); s.frame(2, 8, 44, h - H - 1, OUT)     # корпус автомата
    s.ellipse(8, 12, 38, 42, OUT); s.ellipse(10, 14, 36, 40, GLASS)        # купол
    for (bx, by) in ((14, 24), (22, 20), (28, 28), (16, 32), (24, 34)):   # шарики-бахилы
        s.ellipse(bx, by, bx + 6, by + 5, SEAT); s.put(bx + 1, by + 1, SH)
    s.rect(14, 50, 32, 54, OUT); s.rect(16, 51, 30, 53, M_D)                # лоток выдачи
    s.rect(2, h - H, 44, h - 1, M); s.frame(2, h - H, 44, h - 1, OUT); s.rect(18, h - H + 5, 28, h - H + 6, OUT)
    s.ellipse(52, 26, 76, h - H + 4, OUT); s.ellipse(54, 28, 74, h - H + 2, M_D)   # урна
    s.ellipse(57, 31, 71, 44, OUT)
    s.rect(53, h - H + 2, 75, h - 2, M_D); s.frame(53, h - H + 2, 75, h - 2, OUT)
    return pad(s, H)

def scales(w=80, h=80, H=16):
    """Медицинские весы с ростомером."""
    s = Img(w, h)
    s.rect(4, 28, 50, h - H - 1, M_L); s.frame(4, 28, 50, h - H - 1, OUT)    # платформа
    s.rect(9, 33, 45, h - H - 6, M_D); s.rect(11, 35, 43, h - H - 8, OUT)    # резиновый коврик
    s.rect(4, h - H, 50, h - 1, M); s.frame(4, h - H, 50, h - 1, OUT)
    s.rect(54, 4, 64, h - 1, WD_L); s.frame(54, 4, 64, h - 1, OUT)          # стойка ростомера
    for y in range(8, h - 6, 4): s.rect(55, y, 58 if y % 8 else 60, y, BORDER)
    s.rect(36, 8, 76, 12, M); s.frame(36, 8, 76, 12, OUT)                   # планка-«голова»
    s.rect(16, 20, 54, 23, M_D); s.frame(16, 20, 54, 23, OUT)               # коромысло весов
    s.rect(28, 18, 32, 25, M_L); s.frame(28, 18, 32, 25, OUT)               # гиря
    return pad(s, H)

def terminal(w=80, h=80, H=16):
    """Терминал электронной очереди."""
    s = Img(w, h)
    s.rect(14, 4, w - 15, h - H - 1, M); s.frame(14, 4, w - 15, h - H - 1, OUT)
    s.rect(18, 8, w - 19, 40, SEAT_D); s.rect(20, 10, w - 21, 38, SEAT)     # экран
    for k, y in enumerate((14, 22, 30)):                                    # кнопки услуг на экране
        s.rect(24, y, w - 25, y + 5, SH if k != 1 else GLASS)
    s.rect(28, 46, w - 29, 49, OUT); s.rect(32, 50, w - 33, 58, SH)         # щель и талончик
    s.rect(34, 52, w - 35, 52, SH_D); s.rect(34, 55, w - 37, 55, SH_D)
    s.rect(14, h - H, w - 15, h - 1, M_D); s.frame(14, h - H, w - 15, h - 1, OUT)
    s.rect(30, h - H + 5, w - 31, h - H + 7, M_L)
    return pad(s, H)

LOOKS = {
    'chairs4':      (lambda: chairs(190, 4),  (190, 40)),
    'bench':        (lambda: bench(190),      (190, 40)),
    'registratura': (registratura,            (200, 40)),
    'wardrobe':     (wardrobe,                (200, 40)),
    'chairs3':      (lambda: chairs(120, 3),  (120, 40)),
    'magtable':     (magtable,                (120, 40)),
    'kartoteka':    (kartoteka,               (40, 200)),
    'screen':       (screen,                  (40, 200)),
    'cooler':       (cooler,                  (40, 120)),
    'stand':        (stand,                   (40, 120)),
    'couch':        (couch,                   (80, 160)),
    'gurney':       (gurney,                  (80, 160)),
    'ficus':        (ficus,                   (80, 80)),
    'bahily':       (bahily,                  (80, 80)),
    'scales':       (scales,                  (80, 80)),
    'terminal':     (terminal,                (80, 80)),
}

if __name__ == "__main__":
    floor_tile().save("floor_tile.png"); decal_wear().save("decal_wear.png")
    decal_seam().save("decal_seam.png"); decal_mat().save("decal_mat.png")
    wall_north().save("wall_north.png"); wall_side().save("wall_side.png"); wall_bottom().save("wall_bottom.png")
    for key, (fn, (w, h)) in LOOKS.items():
        img = fn(); assert (img.w, img.h) == (w, h), key
        img.save(f"obstacle_{key}.png")
