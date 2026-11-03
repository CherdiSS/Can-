# Иконки «Неонового Побега» для экрана «Домой» (iPhone) и манифеста (Android).
# Собираются из готовых пиксельных спрайтов увеличением без сглаживания.
# Перегенерировать: python3 assets/icons/make_icons.py  (нужен Pillow)
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SPRITES = os.path.join(HERE, '..', 'sprites')
# Палитра поликлиники (как у окружения и интерфейса)
BG = (122, 164, 140, 255)      # масляная панель стены
NEON = (30, 36, 44, 255)       # тёмный контур — рамка иконки
RED = (255, 59, 92, 255)       # цвет Охотника

# Первый кадр листа анимации (64×64) — персонаж стоит лицом к зрителю
doctor = Image.open(os.path.join(SPRITES, 'doctor_sheet.png')).convert('RGBA').crop((0, 0, 64, 64))
hunter = Image.open(os.path.join(SPRITES, 'enemy_hunter_sheet.png')).convert('RGBA').crop((0, 0, 64, 64))


def make_icon(size):
    unit = size / 180                       # всё рассчитано для 180×180
    icon = Image.new('RGBA', (size, size), BG)
    draw = ImageDraw.Draw(icon)
    # Неоновая рамка
    border = max(2, round(6 * unit))
    draw.rounded_rectangle([border, border, size - 1 - border, size - 1 - border],
                           radius=round(10 * unit), outline=NEON, width=border)
    # Врач крупно по центру, охотник поменьше сзади-справа; масштаб — целое число
    big = max(1, round(2 * unit))
    small = max(1, round(1 * unit))
    h = hunter.resize((hunter.width * small, hunter.height * small), Image.NEAREST)
    d = doctor.resize((doctor.width * big, doctor.height * big), Image.NEAREST)
    icon.alpha_composite(h, (size - h.width - round(14 * unit), round(18 * unit)))
    icon.alpha_composite(d, ((size - d.width) // 2 - round(10 * unit), size - d.height - round(16 * unit)))
    # Кольцо цвета Охотника у его ног
    cx = size - h.width // 2 - round(14 * unit)
    cy = round(18 * unit) + h.height - round(6 * unit)
    rx, ry = round(20 * unit), round(6 * unit)
    draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], outline=RED, width=max(1, round(2 * unit)))
    return icon.convert('RGB')               # iOS не любит прозрачность в иконках


for size in (180, 192, 512):
    make_icon(size).save(os.path.join(HERE, 'icon-%d.png' % size))
print('ok')
