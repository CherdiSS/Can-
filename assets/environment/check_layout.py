# Проверка раскладки: зазоры, стены, зоны старта, запасные точки бонуса, связность (flood fill).
import os, re, sys
from collections import deque
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from layout import *

# Раскладка берётся прямо из js/config.js — источник правды один, данные не расходятся
CONFIG_JS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'js', 'config.js')
def load_config_obstacles():
    text = open(CONFIG_JS, encoding='utf-8').read()
    return [dict(x=int(a), y=int(b), w=int(c), h=int(d), look=e) for a, b, c, d, e in
            re.findall(r"\{ x: (\d+), y: (\d+), w: (\d+), h: (\d+), look: '(\w+)' \}", text)]

def check(obst, label):
    rects = [rect(o) for o in obst]
    problems = []
    for i in range(len(rects)):
        for j in range(i + 1, len(rects)):
            d = rect_dist(rects[i], rects[j])
            if d < MIN_GAP: problems.append(f"зазор {i}-{j} = {d:.0f} < {MIN_GAP}")
    for i, r in enumerate(rects):
        if r[0] < WALL_GAP or r[1] < WALL_GAP or r[2] > ARENA_W - WALL_GAP or r[3] > ARENA_H - WALL_GAP:
            problems.append(f"препятствие {i} ближе {WALL_GAP} к стене: {r}")
    for name, p in [("игрок", PLAYER_START)] + [(f"враг{k}", e) for k, e in enumerate(ENEMY_STARTS)]:
        d = min(point_rect_dist(p, r) for r in rects)
        if d < START_R: problems.append(f"зона старта {name} {p}: до препятствия {d:.0f} < {START_R}")
    for p in FALLBACK:
        for i, r in enumerate(rects):
            m = BONUS_MARGIN
            if r[0] - m < p[0] < r[2] + m and r[1] - m < p[1] < r[3] + m:
                problems.append(f"запасная точка бонуса {p} внутри препятствия {i} (+{m})")
    # flood fill по сетке 5 px для круга радиусом PLAYER_R + 5 (запас)
    step, R = 5, PLAYER_R + 5
    W, H = ARENA_W // step + 1, ARENA_H // step + 1
    free = [[False] * W for _ in range(H)]
    nfree = 0
    for gy in range(H):
        for gx in range(W):
            x, y = gx * step, gy * step
            if x < R or y < R or x > ARENA_W - R or y > ARENA_H - R: continue
            if all(point_rect_dist((x, y), r) > R for r in rects):
                free[gy][gx] = True; nfree += 1
    sx, sy = PLAYER_START[0] // step, PLAYER_START[1] // step
    seen = [[False] * W for _ in range(H)]
    q = deque([(sx, sy)]); seen[sy][sx] = True; reach = 0
    while q:
        x, y = q.popleft(); reach += 1
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and free[ny][nx] and not seen[ny][nx]:
                seen[ny][nx] = True; q.append((nx, ny))
    enemies_ok = all(seen[e[1] // step][e[0] // step] for e in ENEMY_STARTS)
    unreachable = nfree - reach
    # узкие места: минимальный зазор между соседями
    gaps = sorted(rect_dist(rects[i], rects[j]) for i in range(len(rects)) for j in range(i + 1, len(rects)))
    dens = len(rects) / (ARENA_W * ARENA_H) * 1e6
    area = sum((r[2]-r[0])*(r[3]-r[1]) for r in rects) / (ARENA_W * ARENA_H) * 100
    print(f"[{label}] препятствий: {len(rects)}, плотность {dens:.2f} на 1 000 000 px², занято {area:.1f}% площади")
    print(f"  минимальный зазор {gaps[0]:.0f} px; свободных клеток {nfree}, достижимо {reach}, недостижимо {unreachable}; враги достижимы: {enemies_ok}")
    print("  проблемы:", "нет" if not problems else "\n   - " + "\n   - ".join(problems))
    return seen, free, step

if __name__ == "__main__":
    check(OLD, "старая раскладка (14)")
    cfg = load_config_obstacles()
    check(cfg, "js/config.js")
