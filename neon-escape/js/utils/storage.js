// =============================================================
// Сохранение лучшего результата в localStorage.
// Обёрнуто в try/catch: в приватном режиме Safari localStorage
// может быть недоступен — тогда игра просто не запоминает рекорд.
// =============================================================

const BEST_SCORE_KEY = 'neonEscape.bestScore';

// Возвращает сохранённый рекорд (или 0)
function getBestScore() {
  try {
    const value = parseInt(localStorage.getItem(BEST_SCORE_KEY), 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch (error) {
    return 0;
  }
}

// Сохраняет счёт, если он больше рекорда.
// Возвращает true, если установлен новый рекорд.
function saveBestScore(score) {
  const best = getBestScore();
  if (score <= best) {
    return false;
  }
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(score));
  } catch (error) {
    // Ничего страшного: рекорд просто не сохранится
  }
  return true;
}
