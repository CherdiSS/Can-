// =============================================================
// Прогресс игрока за всё время: сыгранные смены, таблетки, задания,
// лучшее время, выбранная форма. Хранится в localStorage (как и рекорд).
// Отсюда же — открытие формы и штампов и выбор заданий на смену.
// =============================================================

const PROGRESS_KEY = 'neonEscape.progress';

const Progress = {
  defaults() {
    return { games: 0, totalPills: 0, totalMissions: 0, bestTime: 0, skin: 'classic' };
  },

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
      return Object.assign(this.defaults(), saved);
    } catch (error) {
      return this.defaults();
    }
  },

  save(data) {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
    } catch (error) {
      // приватный режим — прогресс просто не сохранится
    }
  },

  // Значение показателя для условия открытия (рекорд берётся из storage.js)
  statValue(data, stat) {
    return stat === 'bestScore' ? getBestScore() : (data[stat] || 0);
  },

  isUnlocked(item, data = this.load()) {
    return !item.unlock || this.statValue(data, item.unlock.stat) >= item.unlock.value;
  },

  // Выбранная форма (если вдруг закрыта — классика)
  getSkin() {
    const data = this.load();
    const skin = CONFIG.SKINS.find((s) => s.key === data.skin);
    return skin && this.isUnlocked(skin, data) ? skin : CONFIG.SKINS[0];
  },

  setSkin(key) {
    const data = this.load();
    data.skin = key;
    this.save(data);
  },

  // Учесть сыгранную смену. wasOpen — что было открыто ДО смены (до сохранения рекорда).
  // Возвращает названия того, что открылось впервые
  recordGame(result, missionsDone, wasOpen) {
    const data = Object.assign({}, this.load());
    data.games += 1;
    data.totalPills += result.stats.pills;
    data.totalMissions += missionsDone;
    data.bestTime = Math.max(data.bestTime, Math.floor(result.seconds));
    this.save(data);
    return this.unlockedNames(data).filter((name) => !wasOpen.includes(name));
  },

  unlockedNames(data) {
    return CONFIG.SKINS.filter((s) => s.unlock && this.isUnlocked(s, data)).map((s) => 'форма «' + s.name + '»')
      .concat(CONFIG.STAMPS.filter((s) => s.unlock && this.isUnlocked(s, data)).map((s) => 'штамп «' + s.text + '»'));
  },

  // Случайный открытый штамп для экрана поражения
  randomStamp() {
    const data = this.load();
    const open = CONFIG.STAMPS.filter((s) => this.isUnlocked(s, data));
    return Phaser.Utils.Array.GetRandom(open).text;
  },

  // Задания на смену: PER_SHIFT случайных, по разной статистике
  rollMissions() {
    const pool = Phaser.Utils.Array.Shuffle(CONFIG.MISSIONS.LIST.slice());
    const picked = [];
    pool.forEach((mission) => {
      if (picked.length < CONFIG.MISSIONS.PER_SHIFT && !picked.some((m) => m.stat === mission.stat)) {
        picked.push(mission);
      }
    });
    return picked.map((m) => m.id);
  }
};

// Диагноз по очкам
function getDiagnosis(score) {
  let text = CONFIG.DIAGNOSES[0].text;
  CONFIG.DIAGNOSES.forEach((d) => {
    if (score >= d.score) {
      text = d.text;
    }
  });
  return text;
}
