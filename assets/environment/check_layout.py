# Проверка всех раскладок из js/layouts.js теми же правилами, что у генератора make_layouts.py:
# зазоры между предметами и до стен, свободные старт, маршруты персонажей и места
# (медкарты, лестницы, пробирки, запасные точки таблетки), достижимость каждого места.
# Запуск: python3 assets/environment/check_layout.py
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_layouts as M

text = open(os.path.join(M.ROOT, 'js', 'layouts.js'), encoding='utf-8').read()
data = json.loads(text[text.index('{'):text.rindex('}') + 1])
assert data['shared'] == M.SHARED, 'shared в js/layouts.js отличается от генератора — перегенерируй'
good = True
for name, lay in data['list'].items():
    good &= M.check(name, lay['obstacles'])
    good &= M.check(name + ' + ремонт', lay['obstacles'] + lay['repair'], M.REPAIR_GAP)
print('всё в порядке' if good else 'ЕСТЬ ПРОБЛЕМЫ')
sys.exit(0 if good else 1)
