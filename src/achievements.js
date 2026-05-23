// achievements.js — sistema de conquistas: dispara popup + persiste.
// Conquistas são definidas em data.ACHIEVEMENTS; o estado é guardado em
// state.achievements[id] = timestamp.
import { state, log } from './state.js';
import { ACH_BY_ID, MINE_CATALOG } from './data.js';
import { play } from './audio.js';

// Fila de popups a desenhar (UI consome no draw)
const popupQueue = [];
const POPUP_DURATION = 4.0; // segundos

/**
 * Desbloqueia uma conquista pelo id. Idempotente (se já desbloqueada, nada faz).
 * Dispara popup visual + log + som.
 * @param {string} id
 */
export function unlock(id) {
  if (!state.achievements) state.achievements = {};
  if (state.achievements[id]) return false;
  const def = ACH_BY_ID[id];
  if (!def) return false;
  state.achievements[id] = Date.now();
  popupQueue.push({
    id, def,
    life: POPUP_DURATION,
    total: POPUP_DURATION,
  });
  log(`🏆 Conquista: ${def.emoji} ${def.name} — ${def.desc}`, 'good');
  play('success');
  return true;
}

/** Chamado pelo loop pra atualizar timers dos popups */
export function updateAchievementPopups(dt) {
  for (let i = popupQueue.length - 1; i >= 0; i--) {
    popupQueue[i].life -= dt;
    if (popupQueue[i].life <= 0) popupQueue.splice(i, 1);
  }
}

/** Retorna o popup mais recente (pra renderização) */
export function topPopup() {
  return popupQueue.length > 0 ? popupQueue[popupQueue.length - 1] : null;
}

/** Lista de todas as conquistas com status (pro stats panel) */
export function listAchievements() {
  return Object.values(ACH_BY_ID).map((def) => ({
    ...def,
    unlocked: !!(state.achievements && state.achievements[def.id]),
    timestamp: state.achievements && state.achievements[def.id],
  }));
}

// Checks chamados após eventos do jogo (centralizados aqui pra facilitar).
// Cada função verifica os pré-requisitos e chama unlock() pra cada conquista
// que ainda não foi disparada.

export function checkContractAchievements() {
  const n = state.contractsCompleted || 0;
  if (n >= 1) unlock('first_contract');
  if (n >= 10) unlock('contracts_10');
  if (n >= 50) unlock('contracts_50');
}

export function checkProjectAchievements() {
  if ((state.projects.completed || []).length >= 1) unlock('first_project');
}

export function checkEraAchievements() {
  const era = state.eraReached || 1;
  if (era >= 3) unlock('era_3');
  if (era >= 6) unlock('era_6');
}

export function checkMineAchievements() {
  const t = state.tilesDug || 0;
  if (t >= 100) unlock('tiles_100');
  if (t >= 500) unlock('tiles_500');
}

export function checkEarningsAchievements() {
  const e = state.totalEarnings || 0;
  if (e >= 10000) unlock('earnings_10k');
  if (e >= 50000) unlock('earnings_50k');
}

export function checkMineCountAchievements() {
  // Conta minas pagas (cost > 0)
  const paid = (state.mines || []).filter((m) => {
    const cat = MINE_CATALOG.find((c) => c.id === m.id);
    return cat && cat.cost > 0;
  });
  if (paid.length >= 1) unlock('first_mine_bought');
  if ((state.mines || []).length >= 4) unlock('all_mines');
}

export function checkExhaustionAchievement() {
  if ((state.mines || []).some((m) => m.exhausted)) unlock('mine_exhausted');
}

export function checkRegenerationAchievement() {
  unlock('mine_regenerated');
}

export function checkTntAchievement() {
  if ((state.tntUses || 0) >= 10) unlock('tnt_10');
}
