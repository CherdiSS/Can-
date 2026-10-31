# Источник текстуры врагов «Неонового Побега» (из присланного PDF).
# Перегенерировать PNG: python3 assets/enemies/patient_syringe.py  (нужен Pillow)
# Pixel art 128x128: пациент со шприцем с кровью. Рисуем попиксельно, без сглаживания.
from PIL import Image


W = H = 128
T = (0, 0, 0, 0)
OUT        = (28, 22, 34, 255)
SKIN       = (226, 196, 170, 255)
SKIN_SH = (178, 140, 128, 255)
BAG        = (150, 110, 130, 255)
HAIR       = (66, 58, 72, 255)
GOWN       = (132, 188, 214, 255)
GOWN_SH = (82, 132, 172, 255)
GOWN_HI = (196, 230, 242, 255)
WHITE      = (242, 242, 236, 255)
GREY       = (164, 170, 182, 255)
DGREY      = (98, 104, 118, 255)
BLOOD      = (204, 24, 36, 255)
BLOOD_D = (122, 10, 22, 255)
BLOOD_H = (255, 96, 96, 255)


img = Image.new("RGBA", (W, H), T)
px = img.load()


def put(x, y, c):
       if 0 <= x < W and 0 <= y < H:
           px[x, y] = c


def rect(x0, y0, x1, y1, c):               # включительно
       for y in range(y0, y1 + 1):
           for x in range(x0, x1 + 1):
               put(x, y, c)


def rrect(x0, y0, x1, y1, r, c):            # скруглённый прямоугольник, попиксельно
       for y in range(y0, y1 + 1):
           for x in range(x0, x1 + 1):
               cx = min(max(x, x0 + r), x1 - r)
               cy = min(max(y, y0 + r), y1 - r)
               if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                   put(x, y, c)


def box(x0, y0, x1, y1, fill):              # прямоугольник с тёмным контуром
       rect(x0, y0, x1, y1, OUT)
       rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, fill)

# ---------- ноги и тапочки ----------
rect(46, 99, 54, 113, SKIN); rect(46, 99, 47, 113, SKIN_SH)
rect(61, 99, 69, 113, SKIN); rect(61, 99, 62, 113, SKIN_SH)
rrect(43, 114, 56, 120, 2, WHITE); rect(43, 119, 56, 120, GREY)
rrect(59, 114, 72, 120, 2, WHITE); rect(59, 119, 72, 120, GREY)


# ---------- больничная рубашка ----------
rrect(36, 47, 79, 99, 6, GOWN)
rect(36, 53, 40, 97, GOWN_SH)                        # тень слева
rect(74, 53, 77, 94, GOWN_HI)                        # блик справа
for y in range(56, 97, 7):                            # узор в горошек
    for x in range(43 + (y // 7 % 2) * 3, 72, 7):
        put(x, y, GOWN_SH); put(x + 1, y, GOWN_SH)
rect(36, 98, 79, 99, GOWN_SH)                        # подол
for i in range(6):                                    # V-вырез
    rect(53 + i, 47 + i, 62 - i, 47 + i, SKIN)


# шея
rect(53, 43, 62, 47, SKIN_SH)


# ---------- левая рука (опущена) ----------
rrect(27, 50, 34, 64, 2, GOWN); rect(27, 52, 28, 64, GOWN_SH)         # рукав
rect(28, 65, 33, 86, SKIN); rect(28, 65, 29, 86, SKIN_SH)
rect(28, 79, 33, 80, WHITE)                                            # браслет пациента
rrect(26, 86, 35, 93, 2, SKIN); rect(26, 89, 35, 89, SKIN_SH)          # кисть


# ---------- голова ----------
rrect(40, 10, 75, 43, 7, SKIN)
rect(71, 18, 75, 38, SKIN_SH)                         # тень на щеке
rrect(40, 9, 75, 18, 4, HAIR)                         # волосы
for x in (44, 49, 55, 66, 71):                        # растрёпанная чёлка
    rect(x, 19, x + 1, 20, HAIR)
rect(40, 21, 75, 24, WHITE)                           # бинт на лбу
rect(40, 24, 75, 24, GREY)
rect(62, 21, 66, 23, BLOOD); put(64, 22, BLOOD_D)     # пятно на бинте
# глаза с кругами под ними
for ex in (47, 62):
    rect(ex, 27, ex + 5, 31, WHITE)
    rect(ex + 2, 28, ex + 4, 31, OUT)
    put(ex + 2, 28, WHITE)
    rect(ex, 32, ex + 5, 32, BAG)
rect(45, 26, 49, 26, HAIR); rect(64, 26, 68, 26, HAIR)     # брови
# рот — кривая ухмылка
rect(50, 37, 64, 38, OUT)
rect(64, 35, 65, 36, OUT)

for x in (52, 56, 60):
    put(x, 37, WHITE); put(x + 1, 37, WHITE)


# ---------- правая рука и шприц ----------
rrect(80, 62, 88, 76, 2, GOWN); rect(80, 72, 88, 76, GOWN_SH)        # рукав
rect(89, 66, 99, 73, SKIN); rect(89, 71, 99, 73, SKIN_SH)             # предплечье


# шприц (горизонтально, игла вправо)
box(82, 48, 85, 63, DGREY)              # упор для большого пальца
rect(86, 54, 95, 57, GREY); rect(86, 57, 95, 57, DGREY)                # шток
box(96, 47, 98, 64, GREY)               # фланец цилиндра
box(99, 50, 116, 61, WHITE)             # цилиндр
rect(100, 51, 101, 60, DGREY)           # поршень внутри
rect(102, 54, 115, 60, BLOOD)           # кровь
rect(102, 54, 115, 54, BLOOD_H)
rect(102, 60, 115, 60, BLOOD_D)
for x in range(104, 116, 3):            # шкала делений
    rect(x, 51, x, 52, DGREY)
box(117, 53, 120, 58, GREY)             # наконечник
rect(121, 55, 125, 56, GREY); rect(121, 56, 125, 56, DGREY)           # игла
rect(124, 58, 125, 60, BLOOD); put(124, 58, BLOOD_H)                  # капля


# кисть, сжимающая цилиндр снизу
box(99, 58, 109, 70, SKIN)
rect(100, 66, 108, 69, SKIN_SH)
for x in (102, 105):
    rect(x, 59, x, 63, SKIN_SH)


# ---------- автоматический контур: пустые соседи заполненных пикселей ----------
src = img.copy().load()
for y in range(H):
    for x in range(W):
        if src[x, y][3] == 0:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and src[nx, ny][3] == 255 and src[nx, ny] != OUT:
                    px[x, y] = OUT
                    break


import os
here = os.path.dirname(os.path.abspath(__file__))
img.save(os.path.join(here, "patient_syringe.png"))

