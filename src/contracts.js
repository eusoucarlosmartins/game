// contracts.js — geração e ciclo de contratos.
// Suporta múltiplos contratos simultâneos (em state.contracts), com
// state.contract sendo um alias do primário pra compat com código antigo.
import { state, log } from './state.js';
import { R, CFG } from './data.js';
import { fmtMoney, rand, irand, clamp } from './util.js';
import { currentEra, eraData, checkEraProgression } from './progression.js';
import { play } from './audio.js';
import { CITY } from './geometry.js';
import { spawnMoneyText, spawnText, spawnBurst } from './particles.js';
import { checkContractAchievements, checkEarningsAchievements } from './achievements.js';

// Quantos contratos paralelos baseado na era:
// Era 1-2 = 1, Era 3-4 = 2, Era 5-6 = 3
export function maxConcurrentContracts() {
  const era = currentEra();
  if (era >= 5) return 3;
  if (era >= 3) return 2;
  return 1;
}

function syncPrimary() {
  state.contract = state.contracts[0] || null;
  if (state.contract) state.currentCity = state.contract.city;
}

export function pickContractProduct() {
  const era = eraData(currentEra());
  const pool = era.contracts;
  return pool[irand(0, pool.length - 1)];
}

function makeContract() {
  const productId = pickContractProduct();
  const product = R[productId];
  const price = product.price;
  let need;
  if (product.tier === 2) need = irand(4, 9);
  else if (product.tier === 3) need = irand(3, 6);
  else need = irand(2, 5);
  if (currentEra() === 1) need = irand(3, 5);
  const deadline = rand(CFG.cityDeadlineMin, CFG.cityDeadlineMax) + price * 0.15;
  // Cidade diferente das que já estão ativas
  const activeCities = new Set(state.contracts.map(c => c.city));
  let city = CFG.cities[irand(0, CFG.cities.length - 1)];
  let tries = 0;
  while (activeCities.has(city) && tries < 10) {
    city = CFG.cities[(CFG.cities.indexOf(city) + 1) % CFG.cities.length];
    tries++;
  }
  return { city, product: productId, need, delivered: 0, deadline, elapsed: 0 };
}

export function generateContract() {
  if (!Array.isArray(state.contracts)) state.contracts = [];
  if (state.contracts.length >= maxConcurrentContracts()) return;
  const k = makeContract();
  state.contracts.push(k);
  syncPrimary();
  log(`${k.city} pede ${k.need} ${R[k.product].name} em ${Math.round(k.deadline)}s.`);
}

// Tenta entregar X unidades de um produto. Encontra o primeiro contrato
// que aceita esse produto (FIFO), credita ali até completar ou esgotar.
export function deliverProduct(amount, productId) {
  if (!Array.isArray(state.contracts) || state.contracts.length === 0) return 0;
  // Se productId não vier (chamada antiga), pega do contrato primário
  if (!productId && state.contracts[0]) productId = state.contracts[0].product;
  let remaining = amount;
  for (let i = 0; i < state.contracts.length && remaining > 0; i++) {
    const k = state.contracts[i];
    if (k.product !== productId) continue;
    const space = k.need - k.delivered;
    if (space <= 0) continue;
    const take = Math.min(space, remaining);
    k.delivered += take;
    remaining -= take;
    if (k.delivered >= k.need) {
      completeContract(i);
      i--; // array shrank
    }
  }
  return amount - remaining; // quanto foi efetivamente entregue
}

function completeContract(idx) {
  const k = state.contracts[idx];
  if (!k) return;
  const p = R[k.product];
  const bonus = (state.eventContractBonus || 0) + (state.permContractBonus || 0);
  const diffMul = state.difficulty === 'easy' ? 1.3 : state.difficulty === 'hard' ? 0.8 : 1;
  const reward = Math.round((CFG.contractReward + p.price * k.need) * (1 + bonus) * diffMul);
  const rpBase = 5 + Math.floor(k.need * 0.6 + p.price * 0.02);
  const rpGain = Math.round(rpBase * (1 + (state.rpBonus || 0)));
  state.money += reward;
  state.totalEarnings = (state.totalEarnings || 0) + reward;
  state.rp += rpGain;
  const apGain = Math.round(CFG.contractApprovalGain * (1 + (state.approvalPerContractBonus || 0)));
  state.approval = clamp(state.approval + apGain, 0, CFG.approvalMax);
  state.contractsCompleted++;
  state.cityGrowth = (state.cityGrowth || 0) + 1;
  const cx = CITY.x + CITY.w / 2;
  const cy = CITY.y + 100;
  spawnMoneyText(cx, cy, reward, 'overworld');
  spawnText(cx, cy + 22, `+${rpGain} PP`, '180,140,220');
  spawnText(cx, cy + 40, `+${apGain} aprov`, '120,200,120');
  spawnBurst(cx, cy, 14, '255,212,74');
  const bonusTxt = bonus > 0 ? ` (+${Math.round(bonus*100)}% evento!)` : '';
  log(`${k.city}: ${p.name} entregue! +${fmtMoney(reward)}${bonusTxt}, +${rpGain} PP e +${apGain} aprovação.`, 'good');
  state.contracts.splice(idx, 1);
  syncPrimary();
  if (bonus > 0) state.eventContractBonus = 0;
  state.nextContractIn = rand(3, 6);
  play('success');
  checkEraProgression();
  checkContractAchievements();
  checkEarningsAchievements();
}

export function failContract(idx) {
  const k = state.contracts[idx];
  if (!k) return;
  const floor = state.approvalFloor || 0;
  const approvalLossMul = state.difficulty === 'easy' ? 0.7 : state.difficulty === 'hard' ? 1.3 : 1;
  state.approval = clamp(state.approval - CFG.contractApprovalLoss * approvalLossMul, floor, CFG.approvalMax);
  log(`${k.city}: contrato expirou. −${Math.round(CFG.contractApprovalLoss * approvalLossMul)} aprovação.`, 'bad');
  state.contracts.splice(idx, 1);
  syncPrimary();
  state.nextContractIn = rand(4, 9);
  play('fail');
}

export function updateContract(dt) {
  if (!Array.isArray(state.contracts)) state.contracts = [];
  // Tick em cada contrato; remove os expirados
  for (let i = state.contracts.length - 1; i >= 0; i--) {
    const k = state.contracts[i];
    k.elapsed += dt;
    if (k.elapsed >= k.deadline) failContract(i);
  }
  // Gera novos contratos até o máximo permitido pela era
  if (state.contracts.length < maxConcurrentContracts()) {
    state.nextContractIn -= dt;
    if (state.nextContractIn <= 0) generateContract();
  }
  syncPrimary();
}

export function updateDay(dt) {
  state.dayTimer += dt;
  if (state.dayTimer >= CFG.dayLengthSec) {
    state.dayTimer = 0;
    const prevDay = state.day;
    state.day++;
    state.rp += Math.round(2 * (1 + (state.rpBonus || 0)));
    if (!state.history) state.history = [];
    state.history.push({
      day: state.day,
      money: Math.round(state.money),
      rp: state.rp,
      approval: Math.round(state.approval),
      contracts: state.contractsCompleted,
    });
    if (state.history.length > 60) state.history.shift();
    import('./seasons.js').then(m => {
      const prevSeasonIdx = Math.floor(((prevDay - 1) % 20) / 5);
      const newSeasonIdx = Math.floor(((state.day - 1) % 20) / 5);
      if (prevSeasonIdx !== newSeasonIdx) {
        const s = m.SEASONS[newSeasonIdx];
        log(`${s.emoji} ${s.name} chegou! ${s.desc}`, 'good');
      }
    });
    if (state.passiveIncome && state.passiveIncome > 0) {
      state.money += state.passiveIncome;
      state.totalEarnings = (state.totalEarnings || 0) + state.passiveIncome;
    }
    if (state.day % 7 === 0) {
      const tax = Math.floor(state.approval * 5);
      state.money += tax;
      state.totalEarnings = (state.totalEarnings || 0) + tax;
      log(`Coleta tributária semanal: +${fmtMoney(tax)}.`);
    }
  }
}
