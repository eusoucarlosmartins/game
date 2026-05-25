// market.js — venda de matéria-prima e produtos por % do preço de contrato
import { state, log } from './state.js';
import { R } from './data.js';
import { fmtMoney } from './util.js';
import { play } from './audio.js';
import { OVERWORLD } from './geometry.js';
import { spawnMoneyText } from './particles.js';
import { seasonMul } from './seasons.js';

export const MARKET_RAW_MULT = 0.6;   // mat. prima vende a 60% do preço
export const MARKET_PROD_MULT = 0.7;  // produto vende a 70%
export const MARKET_BUY_MULT = 1.6;   // comprar custa 160% do preço (premium pra importar)

// Comprar matéria-prima no mercado quando esgotada na mina (premium).
// Respeita o cap do silo daquele recurso.
export function buyRaw(resource, amount) {
  if (!R[resource] || R[resource].free) return;
  if (R[resource].kind !== 'raw') return;
  if (!state.silos[resource]) state.silos[resource] = { cap: 400 };
  const cap = state.silos[resource].cap || 400;
  const space = Math.max(0, cap - (state.warehouse[resource] || 0));
  if (space <= 0) {
    log(`Silo de ${R[resource].name} cheio.`, 'bad');
    return;
  }
  const buy = Math.min(amount, space);
  const unitPrice = Math.max(1, Math.round(R[resource].price * MARKET_BUY_MULT));
  const total = unitPrice * buy;
  if (state.money < total) {
    // Compra o que dá com o dinheiro disponível
    const affordable = Math.floor(state.money / unitPrice);
    if (affordable <= 0) {
      log(`Sem dinheiro pra comprar ${R[resource].name} (${fmtMoney(unitPrice)}/un).`, 'bad');
      return;
    }
    return buyRaw(resource, affordable);
  }
  state.money -= total;
  state.warehouse[resource] = (state.warehouse[resource] || 0) + buy;
  const mn = OVERWORLD.mercadoNode;
  spawnMoneyText(mn.x + mn.w / 2, mn.y - 6, -total, 'overworld');
  log(`Mercado: comprou ${buy}× ${R[resource].name} por ${fmtMoney(total)}.`, '');
  play('coin');
}

export function sellRaw(resource, amount) {
  if (!R[resource] || R[resource].free) return;
  const have = state.warehouse[resource] || 0;
  const sell = Math.min(amount, Math.floor(have));
  if (sell <= 0) return;
  const earn = Math.max(1, Math.round(sell * R[resource].price * MARKET_RAW_MULT * (1 + (state.marketBonus || 0) + (state.eventMarketMul || 0)) * seasonMul('market')));
  state.warehouse[resource] -= sell;
  state.money += earn;
  state.totalEarnings = (state.totalEarnings || 0) + earn;
  const mn = OVERWORLD.mercadoNode;
  spawnMoneyText(mn.x + mn.w / 2, mn.y - 6, earn, 'overworld');
  log(`Mercado: ${sell}× ${R[resource].name} → +${fmtMoney(earn)}.`, 'good');
  play('coin');
}

export function sellProduct(resource, amount) {
  if (!R[resource]) return;
  const have = state.products[resource] || 0;
  const sell = Math.min(amount, Math.floor(have));
  if (sell <= 0) return;
  const earn = Math.max(1, Math.round(sell * R[resource].price * MARKET_PROD_MULT * (1 + (state.marketBonus || 0) + (state.eventMarketMul || 0)) * seasonMul('market')));
  state.products[resource] -= sell;
  state.money += earn;
  state.totalEarnings = (state.totalEarnings || 0) + earn;
  const mn = OVERWORLD.mercadoNode;
  spawnMoneyText(mn.x + mn.w / 2, mn.y - 6, earn, 'overworld');
  log(`Mercado: ${sell}× ${R[resource].name} → +${fmtMoney(earn)}.`, 'good');
  play('coin');
}

export function sellAllRaw(resource) {
  sellRaw(resource, Math.floor(state.warehouse[resource] || 0));
}
export function sellAllProduct(resource) {
  sellProduct(resource, Math.floor(state.products[resource] || 0));
}
