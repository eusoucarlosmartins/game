// civilizations.js — mecânicas AoE-like: escolha + bônus iniciais + raids
import { state, log } from './state.js';
import { CIV_BY_ID, SILO_DEFAULT_CAP, R, CFG } from './data.js';
import { clamp, fmtMoney } from './util.js';
import { play } from './audio.js';
import { scaresBandits } from './military.js';

/**
 * Aplica bônus "um-tiro" da civ no início do jogo (dinheiro, aprovação, silos).
 * Deve ser chamado APÓS initMines() mas antes do primeiro tick.
 */
export function applyCivStartBonuses() {
  const civ = state.civilization ? CIV_BY_ID[state.civilization] : null;
  if (!civ) return;
  for (const b of civ.bonuses) {
    if (b.effect === 'start_money_delta') {
      state.money = Math.max(0, state.money + b.mod);
    } else if (b.effect === 'approval_start_bonus') {
      state.approval = clamp((state.approval || 50) + b.mod, 0, CFG.approvalMax);
    } else if (b.effect === 'silo_cap_bonus') {
      for (const k in state.silos) {
        state.silos[k].cap = (state.silos[k].cap || SILO_DEFAULT_CAP) + b.mod;
      }
    }
  }
  log(`${civ.emoji} ${civ.name} — ${civ.desc}`, 'good');
}

/**
 * Escolhe a civilização e aplica bônus iniciais.
 * @param {string} civId
 */
export function chooseCivilization(civId) {
  if (!CIV_BY_ID[civId]) return;
  if (state.civilization) return; // já escolhida — permanente
  state.civilization = civId;
  applyCivStartBonuses();
  play('chime');
}

// ---------- RAIDS DE BANDIDOS (AoE flavor) ----------
// Raid dispara via events.js como evento 'raid'. Resolução automática:
// perde 20% de um recurso aleatório do silo mais cheio, ou falha contrato.
export function triggerRaid() {
  if (scaresBandits()) {
    log('🗡️ Bandidos rondaram a vila, mas fugiram ao ver a milícia.', 'good');
    return;
  }
  // Escolhe silo mais cheio
  let targetRes = null, maxStock = 0;
  for (const k in state.warehouse) {
    if (R[k] && R[k].free) continue;
    const n = state.warehouse[k] || 0;
    if (n > maxStock) { maxStock = n; targetRes = k; }
  }
  if (targetRes && maxStock >= 10) {
    const loss = Math.floor(maxStock * 0.2);
    state.warehouse[targetRes] -= loss;
    log(`⚔ RAID! Bandidos levaram ${loss} de ${R[targetRes].name}.`, 'bad');
    play('fail');
    return;
  }
  // Sem silo substancial — tira $$ do caixa
  const cashLoss = Math.min(300, Math.max(50, Math.floor(state.money * 0.08)));
  state.money = Math.max(0, state.money - cashLoss);
  log(`⚔ RAID! Bandidos saquearam ${fmtMoney(cashLoss)} do tesouro.`, 'bad');
  play('fail');
}
