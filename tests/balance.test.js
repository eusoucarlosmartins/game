import { describe, it, expect, afterEach } from 'vitest';
import { state } from '../src/state.js';
import { MINE, CFG, MINE_CATALOG } from '../src/data.js';
import { initMines, updateMine, tryPlaceWorker, tryHireWorker, tryDigClick, tryCompass, setActiveMine, buyMine, isMineOwned } from '../src/mine.js';
import { updateFactories, setRecipe, buyFactory } from '../src/factories.js';
import { updateWagon } from '../src/wagon.js';
import { updateContract, updateDay } from '../src/contracts.js';
import { adviseContract, freeWorkers, freeIdleWorker } from '../src/advisor.js';
import { buildSite, changeSiteWorkers } from '../src/sites.js';
import { updateArmy, nextThreat, armyPower, army, buildBarracks, trainUnit } from '../src/military.js';

/** Robô que só faz o que o conselheiro sugere (1 ação a cada 2s de jogo). */
function defend() {
  const th = nextThreat();
  if (!th || armyPower() >= th.power + 1) return false;
  if (!army().barracks) return buildBarracks();
  return trainUnit('milicia');
}

function actOnAdvice() {
  if (defend()) return;
  const a = adviseContract();
  if (!a) return;
  if (a.kind === 'switch' && a.factory !== undefined && a.recipe) setRecipe(a.factory, a.recipe);
  else if (a.kind === 'buyFactory') buyFactory();
  else if (a.kind === 'buildSite' && a.site) buildSite(a.site);
  else if (a.kind === 'siteWorker' && a.site) {
    if (freeWorkers() <= 0 && !freeIdleWorker(a.resource || '') && state.money >= 80) tryHireWorker();
    changeSiteWorkers(a.site, +1, freeWorkers);
  }
  else if (a.kind === 'mine' && a.mineIdx !== undefined) {
    setActiveMine(a.mineIdx);
    const g = state.mines[a.mineIdx].grid;
    if (freeWorkers() <= 0 && !freeIdleWorker(a.resource || '') && state.money >= 80) tryHireWorker();
    for (let r = 0; r < MINE.rows; r++) for (let c = 0; c < MINE.cols; c++) {
      const t = g[r][c];
      if (t.revealed && t.type === 'ore' && t.resource === a.resource && !t.worker) { tryPlaceWorker(r, c); return; }
    }
  } else if (a.kind === 'buyMine') {
    const opt = MINE_CATALOG.filter((m) => !isMineOwned(m.id) && m.cost <= state.money).sort((x, y) => x.cost - y.cost)[0];
    if (opt) buyMine(opt.id);
  } else if (a.kind === 'explore' && a.mineIdx !== undefined && a.r !== undefined && a.c !== undefined && state.money >= 40) {
    setActiveMine(a.mineIdx);
    tryCompass(a.r, a.c);
  } else if (a.kind === 'explore' && a.mineIdx !== undefined) {
    setActiveMine(a.mineIdx);
    const g = state.mines[a.mineIdx].grid;
    // cava o bloco revelado mais barato que encosta num túnel, preferindo descer
    for (let r = MINE.rows - 1; r >= 0; r--) for (let c = 1; c < MINE.cols; c++) {
      const t = g[r][c];
      if (!t.revealed || (t.type !== 'dirt' && t.type !== 'stone')) continue;
      const open = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dr, dc]) => {
        const n = g[r + dr] && g[r + dr][c + dc];
        return n && (n.type === 'air' || n.type === 'shaft');
      });
      if (open) { tryDigClick(r, c); return; }
    }
  }
}

const realRandom = Math.random;
afterEach(() => { Math.random = realRandom; });

/** @param {number} seed */
function seedRandom(seed) {
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {number} seed */
function playSeed(seed) {
  seedRandom(seed);
  initMines();
  state.mines.length = Math.min(state.mines.length, 2);
  state.money = CFG.startMoney;
  state.approval = 50;
  state.eraReached = 1;
  state.contractsCompleted = 0;
  state.contract = null;
  state.nextContractIn = 3;
  state.workersTotal = 2;
  state.sites = {};
  state.army = null;
  state.approvalFloor = 0;
  state.wagon = { pos: 0, dir: 0, state: 'idle', load: 0, product: null, timer: 0 };
  for (const k in state.warehouse) state.warehouse[k] = 0;
  for (const k in state.products) state.products[k] = 0;
  state.factories = [{ recipeId: 'iron_ingot', brewing: 0, output: 0 }];
  state.activeMineIdx = 0;
  tryPlaceWorker(1, 2);
  tryPlaceWorker(1, 4);
  let minApproval = 100;
  let act = 0;
  for (let t = 0; t < 1200; t += 0.1) {
    updateMine(0.1); updateFactories(0.1); updateWagon(0.1); updateContract(0.1); updateDay(0.1); updateArmy(0.1);
    act += 0.1;
    if (act >= 2) { act = 0; actOnAdvice(); }
    minApproval = Math.min(minApproval, state.approval);
  }
  if (seed === 11) console.log(`[army] ${army().wins}V/${army().losses}D força ${armyPower()}`);
  return { contracts: state.contractsCompleted, approval: state.approval, minApproval, money: Math.round(state.money) };
}

describe('balanceamento do começo de jogo', () => {
  it('seguindo só o conselheiro, o jogador cumpre 12+ contratos e não é destituído em 20 min (6 sementes)', () => {
    const runs = [11, 22, 33, 44, 55, 66].map(playSeed);
    console.log('[balance]', runs.map((r) => `${r.contracts}c/${r.approval}a(min${r.minApproval})`).join(' '));
    for (const r of runs) {
      expect(r.approval).toBeGreaterThan(0);
      expect(r.contracts).toBeGreaterThanOrEqual(12);
    }
  });
});
