// progression.js — eras, modificadores de equipamento/pesquisa, e cálculos derivados
import { state, log } from './state.js';
import { ERAS, ROMAN, EQ_BY_ID, RES_BY_ID, CFG, R, CIV_BY_ID, CONQUEST_BONUS } from './data.js';
import { staffMod } from './staff.js';

/**
 * Soma modificadores da civilização escolhida (Age of Tapuia).
 * @param {string} effect
 * @returns {number}
 */
export function civMod(effect) {
  const civ = state.civilization ? CIV_BY_ID[state.civilization] : null;
  if (!civ) return conquestMod(effect);
  let total = 0;
  for (const b of civ.bonuses) if (b.effect === effect) total += b.mod;
  return total + conquestMod(effect);
}

/** Bônus dos territórios conquistados. @param {string} effect */
export function conquestMod(effect) {
  const terr = (state.army && state.army.territories) || {};
  let total = 0;
  for (const id in terr) {
    const b = /** @type {Record<string, {effect:string, mod:number}>} */ (CONQUEST_BONUS)[id];
    if (terr[id] && b && b.effect === effect) total += b.mod;
  }
  return total;
}

// Soma modificadores de equipamentos + pesquisas que afetam um effect específico
export function eqMod(effect) {
  let total = 0;
  for (const id in state.equipment) {
    if (state.equipment[id]) {
      const e = EQ_BY_ID[id];
      if (e && e.effect === effect) total += e.mod;
    }
  }
  for (const id in state.research) {
    if (state.research[id]) {
      const r = RES_BY_ID[id];
      if (!r) continue;
      if (r.effect === effect) total += r.mod;
      if (r.e2 === effect) total += r.mod2 || 0;
    }
  }
  return total;
}

// Era atual com base em contratos cumpridos
// Era atual: pelos contratos cumpridos, mas nunca abaixo da maior era já
// alcançada (mudanças de balanceamento não podem rebaixar uma partida salva).
export function currentEra() {
  let era = 1;
  for (let i = 0; i < ERAS.length - 1; i++) {
    if (state.contractsCompleted >= ERAS[i].nextAt) era = ERAS[i + 1].id;
  }
  return Math.max(era, state.eraReached || 1);
}
export function eraData(id) { return ERAS[id - 1]; }
export function isDepositUnlocked(depId) { return eraData(currentEra()).deposits.includes(depId); }
export function isRecipeUnlocked(recId)  { return eraData(currentEra()).recipes.includes(recId); }

export function checkEraProgression() {
  const era = currentEra();
  if (era > state.eraReached) {
    state.eraReached = era;
    const e = eraData(era);
    log(`⚜ ERA ${ROMAN[era - 1]}: ${e.name}!`, 'good');
    log(`   ${e.desc}`, 'good');
    const prev = eraData(era - 1);
    const newDeps = e.deposits.filter(x => !prev.deposits.includes(x));
    const newRecs = e.recipes.filter(x => !prev.recipes.includes(x));
    if (newDeps.length) log(`   Depósitos liberados: ${newDeps.map(d => R[d].name).join(', ')}.`, 'good');
    if (newRecs.length) log(`   Receitas liberadas: ${newRecs.map(d => R[d].name).join(', ')}.`, 'good');
  }
}

// Tier de transporte: maior tier das pesquisas adquiridas
export function transportTier() {
  let t = 0;
  for (const id in state.research) {
    if (state.research[id]) {
      const r = RES_BY_ID[id];
      if (r && r.tier && r.tier > t) t = r.tier;
    }
  }
  return t;
}

// Modificadores derivados
export const cartCapacity   = () => Math.floor(CFG.cartCapacityBase * (1 + eqMod('cartCap') + civMod('cartCap')));
export const cartSpeed      = () => CFG.cartSpeedBase * (1 + eqMod('cartSpd') + civMod('cartSpd'));
export const wagonCapacity  = () => Math.floor(CFG.wagonCapacityBase * (1 + eqMod('wagonCap') + civMod('wagonCap'))) + staffMod('wagonCapFlat');
export const wagonSpeed     = () => CFG.wagonSpeedBase * (1 + eqMod('wagonSpd') + civMod('wagonSpd') + staffMod('wagonSpd'));
export const mineRateMul    = () => (1 + eqMod('mineRate') + civMod('mineRate') + staffMod('mineRate')) * (state.eventMineMul !== undefined ? state.eventMineMul : 1);
export const factSpdMul     = () => 1 + eqMod('factSpd') + civMod('factSpd') + staffMod('factSpd');
export const pileMaxMul     = () => 1 + eqMod('pileMax') + civMod('pileMax');
export const pileMax        = () => Math.floor(CFG.minePileMaxBase * pileMaxMul());
