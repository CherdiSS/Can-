# Пиксель-арт спрайты для больничной версии «Неонового Побега».
# Каждый рисуется попиксельно прямо на итоговом холсте (64×64, бонус 48×48), без сглаживания.
# Внешний контур в 1 px окрашен в цвет роли (как в config.js), внутри — тёмный контур.
from PIL import Image
import os

OUTDIR = os.path.dirname(os.path.abspath(__file__))
T = (0, 0, 0, 0)

def c(r, g, b):
    return (r, g, b, 255)

OUT = c(24, 18, 30)

class Spr:
    def __init__(self, size):
        self.w = self.h = size
        self.im = Image.new("RGBA", (size, size), T)
        self.p = self.im.load()
        self.ox = self.oy = 0          # смещение текущего «слоя» (для поз анимации)

    def at(self, dx=0, dy=0):
        """Всё, что рисуется дальше, сдвигается на (dx, dy) — так двигаются части тела в кадрах."""
        self.ox, self.oy = dx, dy

    def put(self, x, y, col):
        x, y = x + self.ox, y + self.oy
        if 0 <= x < self.w and 0 <= y < self.h:
            self.p[x, y] = col

    def rect(self, x0, y0, x1, y1, col):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.put(x, y, col)

    def rrect(self, x0, y0, x1, y1, r, col):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                cx = min(max(x, x0 + r), x1 - r)
                cy = min(max(y, y0 + r), y1 - r)
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.6:
                    self.put(x, y, col)

    def box(self, x0, y0, x1, y1, fill):
        self.rect(x0, y0, x1, y1, OUT)
        self.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, fill)

    def ring(self, col, only_from=None):
        """Заполняет пустые пиксели, соседние (4-связность) с непустыми."""
        src = self.im.copy().load()
        for y in range(self.h):
            for x in range(self.w):
                if src[x, y][3]:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < self.w and 0 <= ny < self.h and src[nx, ny][3]:
                        if only_from is None or src[nx, ny] != only_from:
                            self.p[x, y] = col
                            break

    def finish(self, rim, mirror=False):
        self.at(0, 0)
        if mirror:                      # вид со спины: предмет — в другой руке
            self.im = self.im.transpose(Image.FLIP_LEFT_RIGHT)
            self.p = self.im.load()
        self.ring(OUT, only_from=OUT)   # тёмный контур вокруг всего
        self.ring(rim)                  # внешний контур цветом роли

    def save(self, name):
        path = os.path.join(OUTDIR, name)
        self.im.save(path)
        return path


# ---------------------------------------------------------------- позы анимации
# bob — корпус вверх/вниз, sway — корпус влево/вправо, armL/armR — взмах рук (по y),
# legL/legR — насколько поднята нога (ботинок выше, нога короче), back — вид со спины.
# «Левая/правая» — со стороны зрителя.
def pose(bob=0, sway=0, armL=0, armR=0, legL=0, legR=0, back=False):
    return dict(bob=bob, sway=sway, armL=armL, armR=armR, legL=legL, legR=legR, back=back)

STAND = pose()


def run_cycle(lift, swing, bob=-1, sway=0, back=False):
    """4 кадра бега: шаг левой, «полёт», шаг правой, «полёт»."""
    return [
        pose(0, sway, swing, -swing, lift, 0, back),
        pose(bob, 0, 0, 0, 0, 0, back),
        pose(0, -sway, -swing, swing, 0, lift, back),
        pose(bob, 0, 0, 0, 0, 0, back),
    ]


def idle_cycle(back=False):
    """2 кадра дыхания: плечи и руки чуть опускаются."""
    return [pose(back=back), pose(0, 0, 1, 1, 0, 0, back)]


def legs(s, P, left, right, top, bottom, shoe_l, shoe_r, skin, skin_sh, shoe, shade_w=1):
    """Ноги и обувь (рисуются первыми: их верх прячется под одеждой).
    left/right — (x0, x1) ног; shoe_* — (x0, x1) обуви; обувь — строки bottom+1..bottom+3."""
    for (x0, x1), (sx0, sx1), lift in ((left, shoe_l, P['legL']), (right, shoe_r, P['legR'])):
        s.at(0, 0)
        s.rect(x0, top, x1, bottom - lift, skin)
        s.rect(x0, top, x0 + shade_w - 1, bottom - lift, skin_sh)
        s.rrect(sx0, bottom + 1 - lift, sx1, bottom + 3 - lift, 1, shoe)


# ---------------------------------------------------------------- героиня-врач
def doctor(P=STAND):
    s = Spr(64)
    SKIN, SKIN_SH = c(242, 204, 178), c(208, 160, 140)
    HAIR, HAIR_L, HAIR_D = c(200, 122, 70), c(232, 166, 106), c(146, 80, 48)
    EYE = c(46, 170, 86)
    WHITE, COAT_SH = c(246, 248, 250), c(184, 198, 214)
    SCRUB, SCRUB_D = c(52, 160, 142), c(30, 108, 98)
    STETH, SILVER = c(70, 76, 92), c(178, 186, 200)
    RED = c(226, 52, 64)
    CYAN = c(60, 240, 255)       # цвет игрока (CONFIG.COLORS.PLAYER)
    back = P['back']
    bx, by = P['sway'], P['bob']

    # брюки и обувь (сначала: верх ног прячется под халатом, когда корпус подпрыгивает)
    s.at(0, 0)
    s.rect(29, 48, 30, 57 - P['legL'], SCRUB_D); s.rect(38, 48, 39, 57 - P['legR'], SCRUB_D)
    for (x0, x1, sx0, sx1, lift) in ((24, 30, 23, 30, P['legL']), (33, 39, 33, 40, P['legR'])):
        s.rect(x0, 48, x1 - 2, 57 - lift, SCRUB)
        s.rrect(sx0, 58 - lift, sx1, 60 - lift, 1, WHITE)

    s.at(bx, by)
    if not back:
        # хвост волос (справа, за головой)
        s.rrect(41, 6, 46, 21, 2, HAIR); s.rect(45, 8, 46, 20, HAIR_D)
        s.rect(41, 7, 42, 8, SCRUB)                      # резинка
        # голова
        s.rrect(22, 5, 41, 23, 6, SKIN)
        s.rect(38, 13, 41, 21, SKIN_SH)
        # волосы и чёлка
        s.rrect(21, 3, 42, 12, 5, HAIR)
        s.rect(26, 4, 31, 5, HAIR_L); s.rect(24, 6, 25, 7, HAIR_L)
        s.rect(32, 3, 32, 7, HAIR_D)                     # пробор
        s.rect(21, 10, 23, 22, HAIR); s.rect(40, 10, 42, 22, HAIR)
        s.rect(40, 12, 42, 22, HAIR_D)
        for x in range(24, 40):                          # рваная чёлка
            if x % 4 != 0:
                s.put(x, 12, HAIR)
            if x % 4 in (1, 2):
                s.put(x, 13, HAIR)
        # глаза: ресницы, зелёная радужка, блик
        for ex in (26, 35):
            s.rect(ex, 15, ex + 2, 15, OUT)
            s.rect(ex, 16, ex + 1, 17, EYE) if ex == 26 else s.rect(ex + 1, 16, ex + 2, 17, EYE)
        s.put(28, 16, WHITE); s.put(28, 17, WHITE)
        s.put(35, 16, WHITE); s.put(35, 17, WHITE)
        s.put(25, 19, RED); s.put(38, 19, RED)           # румянец
        s.rect(31, 20, 32, 20, RED)                      # губы
    else:
        # затылок: волосы целиком, хвост по центру
        s.rrect(22, 5, 41, 23, 6, SKIN)
        s.rrect(21, 3, 42, 22, 6, HAIR)
        s.rect(26, 5, 31, 6, HAIR_L); s.rect(38, 8, 42, 21, HAIR_D)
        s.rect(31, 6, 32, 14, HAIR_D)
        s.rect(29, 14, 34, 15, SCRUB)                    # резинка
        s.rrect(29, 16, 34, 30, 2, HAIR); s.rect(33, 17, 34, 29, HAIR_D)
    # шея
    s.rect(29, 23, 34, 25, SKIN_SH)
    # халат
    s.rrect(19, 25, 44, 51, 3, WHITE)
    s.rect(41, 28, 44, 50, COAT_SH)
    if not back:
        for i in range(7):                               # V-вырез, видна форма
            s.rect(27 + i, 25 + i, 36 - i, 25 + i, SCRUB)
        s.rect(31, 32, 32, 51, SCRUB)                    # распахнутый халат
    s.rect(19, 50, 44, 51, COAT_SH)
    if not back:
        # стетоскоп
        s.rect(27, 25, 27, 33, STETH); s.rect(36, 25, 36, 30, STETH)
        s.rrect(25, 33, 28, 36, 1, SILVER); s.put(26, 34, STETH)
        # нагрудный карман с красным крестом
        s.rect(36, 35, 40, 40, COAT_SH)
        s.rect(38, 36, 38, 39, RED); s.rect(37, 37, 39, 38, RED)
    else:
        s.rrect(29, 16, 34, 30, 2, HAIR); s.rect(33, 17, 34, 29, HAIR_D)   # хвост поверх воротника
        s.rect(31, 40, 32, 51, COAT_SH)                  # шлица
        s.rect(24, 38, 39, 38, COAT_SH)                  # хлястик
    # рукава и кисти
    s.at(bx, by + P['armL'])
    s.rrect(14, 27, 17, 44, 1, WHITE); s.rect(14, 29, 14, 43, COAT_SH)
    s.rrect(14, 45, 17, 48, 1, SKIN)
    s.at(bx, by + P['armR'])
    s.rrect(46, 27, 49, 44, 1, WHITE); s.rect(48, 29, 49, 43, COAT_SH)
    s.rrect(46, 45, 49, 48, 1, SKIN)
    s.finish(CYAN, mirror=back)
    return s


# ---------------------------------------------------------------- Охотник: шприц
def hunter(P=STAND):
    s = Spr(64)
    SKIN, SKIN_SH = c(226, 196, 170), c(176, 140, 128)
    HAIR, BAG = c(66, 58, 72), c(150, 108, 130)
    GOWN, GOWN_SH, GOWN_HI = c(132, 188, 214), c(80, 130, 172), c(196, 230, 242)
    WHITE, GREY, DGREY = c(242, 242, 236), c(164, 170, 182), c(98, 104, 118)
    BLOOD, BLOOD_D = c(204, 24, 36), c(122, 10, 22)
    RIM = c(255, 59, 92)          # Охотник: 0xff3b5c
    back = P['back']
    bx, by = P['sway'], P['bob']

    legs(s, P, (25, 29), (32, 36), 48, 57, (24, 30), (31, 37), SKIN, SKIN_SH, WHITE)

    # шприц (за рукой) — рука со шприцем вытянута и не качается
    s.at(bx, by + P['armR'])
    s.rect(43, 22, 43, 29, DGREY)                    # упор
    s.rect(44, 25, 48, 26, GREY)                     # шток
    s.rect(49, 21, 49, 30, GREY)                     # фланец
    s.box(50, 22, 58, 29, WHITE)                     # цилиндр
    s.rect(51, 25, 57, 28, BLOOD); s.rect(51, 28, 57, 28, BLOOD_D)
    s.put(53, 23, GREY); s.put(55, 23, GREY)         # деления
    s.rect(59, 24, 59, 27, GREY)                     # наконечник
    s.rect(60, 25, 61, 25, GREY)                     # игла
    s.put(61, 27, BLOOD)                             # капля
    # тело
    s.at(bx, by)
    s.rrect(20, 24, 41, 50, 3, GOWN)
    s.rect(20, 27, 22, 49, GOWN_SH); s.rect(38, 27, 39, 47, GOWN_HI)
    for y in range(29, 49, 5):
        for x in range(25 + (y // 5 % 2) * 2, 37, 4):
            s.put(x, y, GOWN_SH)
    s.rect(20, 49, 41, 50, GOWN_SH)
    if not back:
        for i in range(4):
            s.rect(27 + i, 24 + i, 34 - i, 24 + i, SKIN)
    else:
        s.rect(30, 25, 31, 48, SKIN); s.rect(29, 25, 29, 48, GOWN_SH)   # распахнутая сзади рубашка
        s.rect(27, 30, 34, 30, WHITE); s.rect(27, 38, 34, 38, WHITE)    # завязки
    s.rect(27, 21, 34, 24, SKIN_SH)                  # шея
    # голова
    s.rrect(21, 5, 40, 22, 5, SKIN)
    s.rect(37, 12, 40, 20, SKIN_SH)
    s.rrect(21, 4, 40, 10, 3, HAIR)
    if not back:
        s.put(24, 11, HAIR); s.put(29, 11, HAIR); s.put(35, 11, HAIR)
        s.rect(21, 11, 40, 12, WHITE)                # бинт
        s.rect(33, 11, 35, 12, BLOOD)
        for ex in (24, 32):                          # глаза навыкате
            s.rect(ex, 14, ex + 3, 16, WHITE)
            s.rect(ex + 2, 15, ex + 3, 16, OUT)
            s.rect(ex, 17, ex + 3, 17, BAG)
        s.rect(25, 19, 36, 20, OUT)                  # оскал: ряд зубов
        for x in range(26, 36, 2):
            s.put(x, 19, WHITE)
        s.put(25, 18, OUT); s.put(36, 18, OUT)       # уголки рта вверх
    else:
        s.rrect(21, 4, 40, 21, 5, HAIR)              # затылок: волосы до шеи
        s.rect(37, 12, 40, 20, c(50, 44, 56))        # тень на затылке
        s.rect(21, 11, 40, 12, WHITE)                # бинт с узлом
        s.rect(29, 10, 32, 13, WHITE); s.rect(30, 14, 30, 17, WHITE); s.rect(32, 14, 32, 16, WHITE)
    # левая рука качается
    s.at(bx, by + P['armL'])
    s.rrect(15, 25, 18, 32, 1, GOWN); s.rect(15, 27, 15, 32, GOWN_SH)
    s.rect(16, 33, 18, 43, SKIN); s.rect(16, 33, 16, 43, SKIN_SH)
    s.rect(16, 40, 18, 40, WHITE)                    # браслет
    s.rrect(15, 43, 19, 46, 1, SKIN)
    # правая рука держит шприц
    s.at(bx, by + P['armR'])
    s.rrect(43, 30, 47, 37, 1, GOWN); s.rect(43, 35, 47, 37, GOWN_SH)
    s.rect(48, 31, 51, 35, SKIN); s.rect(48, 34, 51, 35, SKIN_SH)
    s.box(51, 26, 56, 33, SKIN); s.rect(52, 31, 55, 32, SKIN_SH)
    s.finish(RIM, mirror=back)
    return s


# ---------------------------------------------------------------- Перехватчик: капельница
def interceptor(P=STAND):
    s = Spr(64)
    SKIN, SKIN_SH = c(196, 206, 172), c(146, 160, 128)      # бледно-зеленоватая кожа
    GOWN, GOWN_SH, GOWN_HI = c(150, 204, 182), c(92, 150, 132), c(204, 236, 222)
    WHITE, SILVER, DGREY = c(242, 242, 236), c(178, 186, 200), c(98, 104, 118)
    BAGC, TUBE = c(214, 228, 236), c(188, 214, 228)
    BLOOD, BLOOD_D, SCAR = c(204, 24, 36), c(122, 10, 22), c(120, 60, 80)
    RIM = c(217, 75, 255)          # Перехватчик: 0xd94bff
    back = P['back']
    bx, by = P['sway'], P['bob']

    legs(s, P, (18, 22), (27, 31), 48, 57, (17, 23), (26, 32), SKIN, SKIN_SH, WHITE)

    # стойка капельницы катится по полу — не подпрыгивает; колёсики крутятся
    s.at(0, 0)
    s.rect(42, 3, 53, 4, SILVER)                     # крюк-перекладина
    s.rect(47, 5, 48, 57, SILVER); s.rect(48, 5, 48, 57, DGREY)
    s.rect(42, 57, 53, 58, DGREY)                    # основание
    s.rect(42, 59, 43, 60, OUT); s.rect(52, 59, 53, 60, OUT)  # колёсики
    if P['legL'] or P['legR']:
        s.put(42 if P['legL'] else 43, 59, DGREY); s.put(52 if P['legL'] else 53, 59, DGREY)
    s.box(43, 5, 52, 16, BAGC)                       # пакет
    s.rect(44, 9, 51, 15, BLOOD); s.rect(44, 9, 51, 9, BLOOD_D)
    s.rect(50, 17, 50, 27, TUBE)                     # трубка
    s.rect(46, 27, 50, 27, TUBE)
    # тело
    s.at(bx, by)
    s.rrect(14, 24, 37, 50, 3, GOWN)
    s.rect(14, 27, 16, 49, GOWN_SH); s.rect(34, 27, 35, 47, GOWN_HI)
    for x in range(20, 33, 4):                       # полоски
        s.rect(x, 30, x, 48, GOWN_SH)
    s.rect(14, 49, 37, 50, GOWN_SH)
    if not back:
        for i in range(4):
            s.rect(22 + i, 24 + i, 29 - i, 24 + i, SKIN)
    else:
        s.rect(25, 25, 26, 48, SKIN); s.rect(24, 25, 24, 48, GOWN_SH)   # распахнутая сзади рубашка
        s.rect(22, 31, 29, 31, WHITE); s.rect(22, 40, 29, 40, WHITE)    # завязки
    s.rect(22, 21, 29, 24, SKIN_SH)
    # лысая голова со шрамом
    s.rrect(15, 4, 36, 22, 7, SKIN)
    s.rect(32, 10, 36, 19, SKIN_SH)
    s.rect(18, 8, 31, 8, SCAR)
    for x in range(19, 31, 3):
        s.put(x, 7, SCAR); s.put(x, 9, SCAR)
    if not back:
        for ex in (18, 27):                          # пустые глаза, смотрят вперёд-вправо
            s.rect(ex, 12, ex + 4, 15, WHITE)
            s.rect(ex + 3, 13, ex + 4, 14, OUT)
            s.rect(ex, 16, ex + 4, 16, SKIN_SH)
        s.rect(23, 18, 26, 20, OUT)                  # раскрытый рот
        s.rect(24, 20, 25, 20, BLOOD_D)
    else:
        s.rect(15, 14, 16, 16, SKIN_SH); s.rect(35, 14, 36, 16, SKIN_SH)   # уши
        s.rect(22, 18, 29, 19, SKIN_SH)              # складка на затылке
    # левая рука качается
    s.at(bx, by + P['armL'])
    s.rrect(9, 25, 12, 32, 1, GOWN); s.rect(9, 27, 9, 32, GOWN_SH)
    s.rect(10, 33, 12, 43, SKIN); s.rect(10, 33, 10, 43, SKIN_SH)
    s.rrect(9, 43, 13, 46, 1, SKIN)
    # правая рука держится за стойку
    s.at(bx, by)
    s.rrect(38, 25, 42, 31, 1, GOWN); s.rect(38, 30, 42, 31, GOWN_SH)
    s.rect(43, 28, 45, 30, SKIN)
    s.box(44, 25, 49, 32, SKIN); s.rect(45, 30, 48, 31, SKIN_SH)
    s.finish(RIM, mirror=back)
    return s


# ---------------------------------------------------------------- Тяжёлый загонщик: бинты и гипс
def heavy(P=STAND):
    s = Spr(64)
    SKIN, SKIN_SH = c(222, 176, 146), c(170, 124, 104)
    GOWN, GOWN_SH, GOWN_HI = c(132, 188, 214), c(80, 130, 172), c(196, 230, 242)
    WHITE, BAND_SH = c(240, 238, 228), c(186, 182, 170)
    EYE, BLOOD = c(255, 214, 72), c(204, 24, 36)
    RIM = c(255, 140, 26)          # Загонщик: 0xff8c1a
    back = P['back']
    bx, by = P['sway'], P['bob']

    # толстые ноги (переваливается: шаг невысокий)
    legs(s, P, (17, 26), (37, 46), 50, 58, (15, 27), (36, 48), SKIN, SKIN_SH, WHITE, shade_w=2)

    # огромное тело
    s.at(bx, by)
    s.rrect(9, 23, 54, 52, 8, GOWN)
    s.rect(9, 30, 13, 48, GOWN_SH)
    if not back:
        s.rect(44, 28, 48, 29, GOWN_HI); s.rect(47, 30, 49, 34, GOWN_HI)   # блик на животе
        s.rect(34, 47, 46, 48, GOWN_SH)                                    # складка под животом
    else:
        s.rect(31, 25, 32, 50, SKIN); s.rect(30, 25, 30, 50, GOWN_SH)     # распахнутая сзади рубашка
        s.rect(28, 32, 35, 32, WHITE); s.rect(28, 42, 35, 42, WHITE)       # завязки
        s.rect(14, 26, 15, 27, BAND_SH)
        for i in range(12):                                                # лямка перевязи через спину
            s.rect(16 + i * 2, 27 + i, 17 + i * 2, 27 + i, BAND_SH)
    s.rect(9, 50, 54, 52, GOWN_SH)
    s.rect(26, 23, 37, 25, SKIN_SH)                  # шея
    # голова в бинтах
    s.rrect(21, 3, 42, 23, 7, WHITE)
    for y, x0, x1 in ((6, 24, 39), (9, 21, 34), (17, 23, 42), (20, 25, 38)):
        s.rect(x0, y, x1, y, BAND_SH)
    s.rect(38, 8, 42, 20, BAND_SH)
    if not back:
        s.rect(22, 11, 41, 14, OUT)                  # щель для глаз
        s.rect(26, 12, 28, 13, EYE); s.rect(35, 12, 37, 13, EYE)
        s.rect(29, 4, 31, 5, BLOOD)                  # пятно на бинте
    else:
        s.rect(22, 12, 41, 12, BAND_SH)              # витки бинта на затылке
        s.rect(29, 13, 33, 16, WHITE); s.rect(29, 13, 33, 13, BAND_SH)    # узел
        s.rect(30, 17, 30, 21, WHITE); s.rect(32, 17, 32, 20, WHITE)
    # левая рука в гипсе поперёк груди (со спины видно только плечо)
    s.at(bx, by + P['armL'])
    s.rrect(4, 25, 7, 37, 1, GOWN); s.rect(4, 27, 4, 37, GOWN_SH)
    s.at(bx, by)
    if not back:
        s.box(5, 32, 31, 39, WHITE)
        s.rect(6, 37, 30, 38, BAND_SH)
        s.rect(12, 33, 12, 36, BAND_SH); s.rect(20, 33, 20, 36, BAND_SH)
        s.rect(26, 26, 27, 31, BAND_SH)              # перевязь
        s.box(29, 31, 34, 38, SKIN)                  # кисть из гипса
    else:
        s.box(3, 36, 8, 41, WHITE)                   # гипс выглядывает сбоку
    # правая рука с кулаком
    s.at(bx, by + P['armR'])
    s.rrect(56, 25, 60, 36, 1, GOWN); s.rect(59, 27, 60, 36, GOWN_SH)
    s.rect(56, 37, 59, 45, SKIN); s.rect(59, 37, 59, 45, SKIN_SH)
    s.rrect(55, 45, 60, 50, 2, SKIN); s.rect(56, 49, 59, 50, SKIN_SH)
    s.finish(RIM, mirror=back)
    return s


# ---------------------------------------------------------------- бонус: капсула
def bonus():
    s = Spr(48)
    GOLD, GOLD_D, GOLD_L = c(255, 200, 40), c(214, 146, 22), c(255, 236, 140)
    WHITE, WHITE_SH = c(246, 246, 240), c(188, 192, 204)
    RIM = c(255, 225, 77)          # бонус: 0xffe14d
    ax, ay, bx, by, r = 13.5, 34.5, 34.5, 13.5, 8.6
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    for y in range(48):
        for x in range(48):
            px, py = x + 0.5, y + 0.5
            t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2))
            qx, qy = ax + t * dx, ay + t * dy
            d = ((px - qx) ** 2 + (py - qy) ** 2) ** 0.5
            if d > r:
                continue
            # сторона от оси (нормаль): >0 — нижняя-правая, затенённая
            side = ((px - qx) * 1 + (py - qy) * 1) / 2 ** 0.5
            upper = t > 0.5
            base, dark, light = (WHITE, WHITE_SH, WHITE) if upper else (GOLD, GOLD_D, GOLD_L)
            col = base
            if side > r - 3.2:
                col = dark
            elif -r + 2.0 < side < -r + 4.2 and 0.12 < t < 0.88:
                col = light if not upper else WHITE
            s.put(x, y, col)
    # шов между половинками
    for y in range(48):
        for x in range(48):
            px, py = x + 0.5, y + 0.5
            t = ((px - ax) * dx + (py - ay) * dy) / L2
            if abs(t - 0.5) < 0.022 and s.p[x, y][3]:
                s.put(x, y, OUT)
    s.finish(RIM)
    # искорки (без контура)
    for (sx, sy) in ((40, 7), (7, 41)):
        s.put(sx, sy, WHITE)
        for d in (1, 2):
            for (ox, oy) in ((d, 0), (-d, 0), (0, d), (0, -d)):
                s.put(sx + ox, sy + oy, RIM if d == 2 else WHITE)
    return s


# Лист кадров 64×64 в один ряд (12 кадров, 768×64):
#   0–1  дыхание лицом к зрителю   2–5  бег лицом к зрителю
#   6–7  дыхание спиной            8–11 бег спиной (бежит вверх по экрану)
# Порядок кадров дублируется в config.js (CONFIG.ANIMATION.FRAMES).
CHARACTERS = {
    # имя файла: (функция, высота шага, взмах рук, подскок корпуса, раскачка)
    "doctor_sheet.png": (doctor, 3, 2, -1, 0),
    "enemy_hunter_sheet.png": (hunter, 3, 2, -1, 0),
    "enemy_interceptor_sheet.png": (interceptor, 2, 1, -1, 0),   # шаркает
    "enemy_heavy_sheet.png": (heavy, 2, 1, -1, 1),               # переваливается
}


def frames_for(lift, swing, bob, sway):
    return (idle_cycle() + run_cycle(lift, swing, bob, sway) +
            idle_cycle(back=True) + run_cycle(lift, swing, bob, sway, back=True))


def sheet(draw, lift, swing, bob, sway):
    poses = frames_for(lift, swing, bob, sway)
    out = Image.new("RGBA", (64 * len(poses), 64), T)
    for i, P in enumerate(poses):
        out.paste(draw(P).im, (64 * i, 0))
    return out


if __name__ == "__main__":
    for name, (draw, lift, swing, bob, sway) in CHARACTERS.items():
        sheet(draw, lift, swing, bob, sway).save(os.path.join(OUTDIR, name))
    bonus().save("bonus_pill.png")
    print("ok")
