import { describe, it, expect } from 'vitest';
import { state } from '../src/state.js';
import { MINE, CFG } from '../src/data.js';
import { initMines, updateMine, tryPlaceWorker, tryHireWorker, tryDigClick, setActiveMine } from '../src/mine.js';
import { updateFactories, setRecipe, buyFactory } from '../src/factories.js';
import { updateWagon } from '../src/wagon.js';
import { updateContract, updateDay } from '../src/contracts.js';
import { adviseContract } from '../src/advisor.js';

/** Robô que só faz o que o conselheiro sugere (1 ação a cada 2s de jogo). */
function actOnAdvice() {
  const a = adviseContract();
  if (!a) return;
  if (a.kind === 'switch' && a.factory !== undefined && a.recipe) setRecipe(a.factory, a.recipe);
  else if (a.kind === 'buyFactory') buyFactory();
  else if (a.kind === 'mine' && a.mineIdx !== undefined) {
    setActiveMine(a.mineIdx);
    const g = state.mines[a.mineIdx].grid;
    let busy = 0;
    for (const row of g) for (const t of row) if (t.worker) busy++;
    if (busy >= state.workersTotal && state.money >= 80) tryHireWorker();
    if (busy >= state.workersTotal) {
      // retira de um veio de outro recurso
      for (const row of g) for (const t of row) if (t.worker && t.resource !== a.resource) { t.worker = false; busy = -1; break; }
    }
    for (let r = 0; r < MINE.rows; r++) for (let c = 0; c < MINE.cols; c++) {
      const t = g[r][c];
      if (t.revealed && t.type === 'ore' && t.resource === a.resource && !t.worker) { tryPlaceWorker(r, c); return; }
    }
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

describe('balanceamento do começo de jogo', () => {
  it('seguindo só o conselheiro, o jogador avança de era e não é destituído em 20 min', () => {
    initMines();
    state.money = CFG.startMoney;
    state.approval = 50;
    state.contractsCompleted = 0;
    state.factories = [{ recipeId: 'iron_ingot', brewing: 0, output: 0 }];
    state.activeMineIdx = 0;
    tryPlaceWorker(1, 2);
    tryPlaceWorker(1, 4);
    let minApproval = 100;
    let act = 0;
    for (let t = 0; t < 1200; t += 0.1) {
      updateMine(0.1); updateFactories(0.1); updateWagon(0.1); updateContract(0.1); updateDay(0.1);
      act += 0.1;
      if (act >= 2) { act = 0; actOnAdvice(); }
      minApproval = Math.min(minApproval, state.approval);
    }
    console.log(`[balance] contratos=${state.contractsCompleted} aprovação=${state.approval} (mín ${minApproval}) $${Math.round(state.money)} fábricas=${state.factories.length} mineradores=${state.workersTotal}`);
    expect(state.approval).toBeGreaterThan(0);
    expect(state.contractsCompleted).toBeGreaterThanOrEqual(6);
  });
});
