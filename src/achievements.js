// achievements.js — sistema de conquistas (meta-progressão).
// Define checagem automática + unlock direto por evento, com toast
// no canvas e persistência em state.achievements.
import { state, log } from './state.js';
import { ACHIEVEMENTS, ACH_BY_ID } from './data.js';
import { currentEra } from './progression.js';
import { play } from './audio.js';

const TOAST_DURATION = 5; // segundos

/**
 * Desbloqueia uma conquista pelo id (idempotente).
 * @param {string} id
 */
export function unlockAchievement(id) {
  if (!state.achievements) state.achievements = {};
  if (state.achievements[id]) return; // já desbloqueada
  const a = ACH_BY_ID[id];
  if (!a) return;
  state.achievements[id] = Date.now();
  log(`🏆 CONQUISTA: ${a.emoji} ${a.name} — ${a.desc}`, 'good');
  state.activeAchievement = { id, timeLeft: TOAST_DURATION };
  play('chime');
}

/**
 * Checa todas as condições de desbloqueio contra o state atual.
 * Chamado a cada tick (barato — só 15 checks de valor).
 */
export function checkAchievements() {
  if (!state.achievements) state.achievements = {};
  // Condições booleanas por conquista
  const paidMinesOwned = (state.mines || []).some(
    (m) => m.id !== 'central' && m.id !== 'vale',
  );
  /** @type {Array<[string, boolean]>} */
  const checks = [
    ['first_contract',    (state.contractsCompleted || 0) >= 1],
    ['contracts_10',      (state.contractsCompleted || 0) >= 10],
    ['contracts_50',      (state.contractsCompleted || 0) >= 50],
    ['first_project',     ((state.projects && state.projects.completed) || []).length >= 1],
    ['era_3',             currentEra() >= 3],
    ['era_6',             currentEra() >= 6],
    ['tiles_100',         (state.tilesDug || 0) >= 100],
    ['tiles_500',         (state.tilesDug || 0) >= 500],
    ['earnings_10k',      (state.totalEarnings || 0) >= 10000],
    ['earnings_50k',      (state.totalEarnings || 0) >= 50000],
    ['first_mine_bought', paidMinesOwned],
    ['all_mines',         (state.mines || []).length >= 4],
    ['mine_exhausted',    (state.mines || []).some((m) => m.exhausted)],
    ['tnt_10',            (state.tntUseCount || 0) >= 10],
    // 'mine_regenerated' é desbloqueada diretamente em mine.regenerateMine
  ];
  for (const [id, cond] of checks) {
    if (cond) unlockAchievement(id);
  }
}

/**
 * Atualiza o timer do toast ativo.
 * @param {number} dt
 */
export function updateAchievementToast(dt) {
  if (!state.activeAchievement) return;
  state.activeAchievement.timeLeft -= dt;
  if (state.activeAchievement.timeLeft <= 0) state.activeAchievement = null;
}

/**
 * Retorna contagem (desbloqueadas, total) pra sidebar.
 * @returns {{ unlocked: number, total: number }}
 */
export function getAchievementProgress() {
  const unlocked = state.achievements ? Object.keys(state.achievements).length : 0;
  return { unlocked, total: ACHIEVEMENTS.length };
}
