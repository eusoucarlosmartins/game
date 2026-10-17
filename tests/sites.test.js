import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { initMines, updateMine, workersActive } from '../src/mine.js';
import { buildSite, changeSiteWorkers, siteState, SURFACE_RESOURCES } from '../src/sites.js';
import { freeWorkers, freeIdleWorker } from '../src/advisor.js';

describe('postos de coleta (superfície)', () => {
  beforeEach(() => {
    initMines();
    state.money = 5000;
    state.contractsCompleted = 0;
    state.workersTotal = 4;
    state.sites = {};
    state.contract = null;
    state.factories = [{ recipeId: 'brick', brewing: 0, output: 0 }];
    for (const k in state.warehouse) state.warehouse[k] = 0;
  });

  it('minas novas não geram madeira, pedra, argila, areia nem petróleo', () => {
    for (const m of state.mines) for (const row of m.grid) for (const t of row) {
      if (t.type === 'ore') expect(SURFACE_RESOURCES.has(t.resource)).toBe(false);
    }
  });

  it('construir respeita era e dinheiro', () => {
    expect(buildSite('lumber')).toBe(false); // Era II
    expect(buildSite('quarry')).toBe(true);
    expect(state.money).toBe(4800);
    expect(buildSite('quarry')).toBe(false); // já construído
  });

  it('trabalhadores do posto contam no total e produzem para o silo', () => {
    buildSite('claypit');
    expect(changeSiteWorkers('claypit', +1, freeWorkers)).toBe(true);
    expect(changeSiteWorkers('claypit', +1, freeWorkers)).toBe(true);
    expect(workersActive()).toBe(2);
    for (let i = 0; i < 100; i++) updateMine(0.1);
    expect(state.warehouse.clay).toBeGreaterThan(5);
    expect(siteState('claypit').harvested).toBeGreaterThan(5);
  });

  it('não passa do limite de trabalhadores nem de gente livre', () => {
    buildSite('quarry');
    state.workersTotal = 2;
    expect(changeSiteWorkers('quarry', +1, freeWorkers)).toBe(true);
    expect(changeSiteWorkers('quarry', +1, freeWorkers)).toBe(true);
    expect(changeSiteWorkers('quarry', +1, freeWorkers)).toBe(false);
  });

  it('libera quem está num posto com silo cheio', () => {
    buildSite('quarry');
    state.workersTotal = 1;
    changeSiteWorkers('quarry', +1, freeWorkers);
    expect(freeWorkers()).toBe(0);
    state.warehouse.stone = 400;
    expect(freeIdleWorker('coal')).toBe(true);
    expect(siteState('quarry').workers).toBe(0);
    expect(freeWorkers()).toBe(1);
  });
});
