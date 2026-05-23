// market.js — venda de matéria-prima e produtos por % do preço de contrato
import { state, log } from './state.js';
import { R } from './data.js';
import { fmtMoney } from './util.js';
import { play } from './audio.js';

export const MARKET_RAW_MULT = 0.6;   // mat. prima vende a 60% do preço
export const MARKET_PROD_MULT = 0.7;  // produto vende a 70%

export function sellRaw(resource, amount) {
  if (!R[resource] || R[resource].free) return;
  const have = state.warehouse[resource] || 0;
  const sell = Math.min(amount, Math.floor(have));
  if (sell <= 0) return;
  const earn = Math.max(1, Math.round(sell * R[resource].price * MARKET_RAW_MULT));
  state.warehouse[resource] -= sell;
  state.money += earn;
  log(`Mercado: ${sell}× ${R[resource].name} → +${fmtMoney(earn)}.`, 'good');
  play('coin');
}

export function sellProduct(resource, amount) {
  if (!R[resource]) return;
  const have = state.products[resource] || 0;
  const sell = Math.min(amount, Math.floor(have));
  if (sell <= 0) return;
  const earn = Math.max(1, Math.round(sell * R[resource].price * MARKET_PROD_MULT));
  state.products[resource] -= sell;
  state.money += earn;
  log(`Mercado: ${sell}× ${R[resource].name} → +${fmtMoney(earn)}.`, 'good');
  play('coin');
}

export function sellAllRaw(resource) {
  sellRaw(resource, Math.floor(state.warehouse[resource] || 0));
}
export function sellAllProduct(resource) {
  sellProduct(resource, Math.floor(state.products[resource] || 0));
}
