import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { initMines, tryDigClick, tryTNT, updateMine } from '../src/mine.js';
import { FLOOD_TIME } from '../src/hazards.js';

const air = () => ({ type: 'air', resource: null, amount: 0, revealed: true, worker: false });
const count = (m, flag) => m.grid.flat().filter((t) => t[flag]).length;

describe('perigos da mina', () => {
  let m;
  beforeEach(() => {
    initMines();
    state.activeMineIdx = 0;
    m = state.mines[0];
    state.money = 5000;
    state.workersTotal = 3;
    state.approval = 60;
    for (const k in state.warehouse) state.warehouse[k] = 0;
  });

  it('cada mina nova esconde 3 bolsões de gás e 3 de água', () => {
    expect(count(m, 'gas')).toBe(3);
    expect(count(m, 'water')).toBe(3);
    expect(m.grid.flat().filter((t) => (t.gas || t.water) && t.revealed).length).toBe(0);
  });

  it('grisu na picareta explode e fere um minerador por perto', () => {
    m.grid[6][10] = { type: 'stone', resource: null, amount: 0, revealed: true, worker: false, gas: true };
    m.grid[5][10] = air();
    m.grid[7][11] = { type: 'ore', resource: 'coal', amount: 20, revealed: true, worker: true };
    tryDigClick(6, 10);
    expect(state.workersTotal).toBe(2);
    expect(m.grid[7][11].worker).toBe(false);
    expect(m.grid[6][10].type).toBe('air');
  });

  it('grisu na dinamite queima sem ferir ninguém', () => {
    m.grid[6][10] = { type: 'stone', resource: null, amount: 0, revealed: true, worker: false, gas: true };
    m.grid[8][12] = { type: 'ore', resource: 'coal', amount: 20, revealed: true, worker: true };
    tryTNT(6, 10);
    expect(state.workersTotal).toBe(3);
    expect(m.grid[8][12].worker).toBe(true);
  });

  it('lençol de água inunda: mineradores perto param até escoar', () => {
    m.grid[6][10] = { type: 'dirt', resource: null, amount: 0, revealed: true, worker: false, water: true };
    m.grid[5][10] = air();
    m.grid[6][11] = air();
    m.grid[6][12] = { type: 'ore', resource: 'coal', amount: 30, revealed: true, worker: true };
    tryDigClick(6, 10);
    expect(m.grid[6][11].flood).toBe(FLOOD_TIME);
    updateMine(5);
    expect(state.warehouse.coal).toBe(0);
    for (let i = 0; i < FLOOD_TIME + 2; i++) updateMine(1);
    expect(m.grid[6][11].flood).toBe(0);
    updateMine(5);
    expect(state.warehouse.coal).toBeGreaterThan(0);
  });
});
