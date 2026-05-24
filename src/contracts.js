// contracts.js — geração e ciclo de contratos
import { state, log } from './state.js';
import { R, CFG } from './data.js';
import { fmtMoney, rand, irand, clamp } from './util.js';
import { currentEra, eraData, checkEraProgression } from './progression.js';
import { play } from './audio.js';
import { CITY } from './geometry.js';
import { spawnMoneyText, spawnText, spawnBurst } from './particles.js';
import { checkContractAchievements, checkEarningsAchievements } from './achievements.js';

export function pickContractProduct() {
  const era = eraData(currentEra());
  const pool = era.contracts;
  return pool[irand(0, pool.length - 1)];
}

export function generateContract() {
  const productId = pickContractProduct();
  const product = R[productId];
  const price = product.price;
  let need;
  if (product.tier === 2) need = irand(4, 9);
  else if (product.tier === 3) need = irand(3, 6);
  else need = irand(2, 5);
  if (currentEra() === 1) need = irand(3, 5);
  const deadline = rand(CFG.cityDeadlineMin, CFG.cityDeadlineMax) + price * 0.15;
  let city = CFG.cities[irand(0, CFG.cities.length - 1)];
  if (state.contract && city === state.contract.city) {
    city = CFG.cities[(CFG.cities.indexOf(city) + 1) % CFG.cities.length];
  }
  state.contract = { city, product: productId, need, delivered: 0, deadline, elapsed: 0 };
  state.currentCity = city;
  log(`${city} pede ${need} ${R[productId].name} em ${Math.round(deadline)}s.`);
}

export function deliverProduct(amount) {
  if (!state.contract) return;
  state.contract.delivered += amount;
  if (state.contract.delivered >= state.contract.need) {
    const p = R[state.contract.product];
    const bonus = (state.eventContractBonus || 0) + (state.permContractBonus || 0);
    const diffMul = state.difficulty === 'easy' ? 1.3 : state.difficulty === 'hard' ? 0.8 : 1;
    const reward = Math.round((CFG.contractReward + p.price * state.contract.need) * (1 + bonus) * diffMul);
    const rpBase = 5 + Math.floor(state.contract.need * 0.6 + p.price * 0.02);
    const rpGain = Math.round(rpBase * (1 + (state.rpBonus || 0)));
    state.money += reward;
    state.totalEarnings = (state.totalEarnings || 0) + reward;
    state.rp += rpGain;
    const apGain = Math.round(CFG.contractApprovalGain * (1 + (state.approvalPerContractBonus || 0)));
    state.approval = clamp(state.approval + apGain, 0, CFG.approvalMax);
    state.contractsCompleted++;
    state.cityGrowth = (state.cityGrowth || 0) + 1;
    // Floating numbers no centro da cidade
    const cx = CITY.x + CITY.w / 2;
    const cy = CITY.y + 100;
    spawnMoneyText(cx, cy, reward, 'overworld');
    spawnText(cx, cy + 22, `+${rpGain} PP`, '180,140,220');
    spawnText(cx, cy + 40, `+${apGain} aprov`, '120,200,120');
    spawnBurst(cx, cy, 14, '255,212,74');
    const bonusTxt = bonus > 0 ? ` (+${Math.round(bonus*100)}% evento!)` : '';
    log(`${state.contract.city}: ${p.name} entregue! +${fmtMoney(reward)}${bonusTxt}, +${rpGain} PP e +${CFG.contractApprovalGain} aprovação.`, 'good');
    state.contract = null;
    state.nextContractIn = rand(5, 9);
    if (bonus > 0) state.eventContractBonus = 0; // consome o bônus
    play('success');
    checkEraProgression();
    checkContractAchievements();
    checkEarningsAchievements();
  }
}

export function failContract() {
  const cityName = state.contract ? state.contract.city : 'Cidade';
  const floor = state.approvalFloor || 0;
  const approvalLossMul = state.difficulty === 'easy' ? 0.7 : state.difficulty === 'hard' ? 1.3 : 1;
  state.approval = clamp(state.approval - CFG.contractApprovalLoss * approvalLossMul, floor, CFG.approvalMax);
  log(`${cityName}: contrato expirou. −${CFG.contractApprovalLoss} aprovação.`, 'bad');
  state.contract = null;
  state.nextContractIn = rand(6, 12);
  play('fail');
}

export function updateContract(dt) {
  if (state.contract) {
    state.contract.elapsed += dt;
    if (state.contract.elapsed >= state.contract.deadline) failContract();
  } else {
    state.nextContractIn -= dt;
    if (state.nextContractIn <= 0) generateContract();
  }
}

export function updateDay(dt) {
  state.dayTimer += dt;
  if (state.dayTimer >= CFG.dayLengthSec) {
    state.dayTimer = 0;
    const prevDay = state.day;
    state.day++;
    state.rp += Math.round(2 * (1 + (state.rpBonus || 0)));
    // Sample do histórico pra gráficos (cap em 60 entradas)
    if (!state.history) state.history = [];
    state.history.push({
      day: state.day,
      money: Math.round(state.money),
      rp: state.rp,
      approval: Math.round(state.approval),
      contracts: state.contractsCompleted,
    });
    if (state.history.length > 60) state.history.shift();
    // Detecta transição de estação pra notificar
    import('./seasons.js').then(m => {
      const prevSeasonIdx = Math.floor(((prevDay - 1) % 20) / 5);
      const newSeasonIdx = Math.floor(((state.day - 1) % 20) / 5);
      if (prevSeasonIdx !== newSeasonIdx) {
        const s = m.SEASONS[newSeasonIdx];
        log(`${s.emoji} ${s.name} chegou! ${s.desc}`, 'good');
      }
    });
    // renda passiva diária (de projetos como Banco do Estado)
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
