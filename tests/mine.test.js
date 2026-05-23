// mine.test.js — geração do grid e operações básicas
import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { initMine, tryHireWorker, workersAvailable, workersActive } from '../src/mine.js';
import { MINE } from '../src/data.js';

beforeEach(() => {
  state.money = 1000;
  state.workersTotal = 2;
  state.mine = { grid: null, tool: 'pick', tntFx: null };
});

describe('initMine', () => {
  it('cria grid com dimensões corretas', () => {
    initMine();
    expect(state.mine.grid).toHaveLength(MINE.rows);
    for (const row of state.mine.grid) {
      expect(row).toHaveLength(MINE.cols);
    }
  });

  it('todo tile tem tipo válido', () => {
    initMine();
    const validTypes = new Set(['dirt', 'stone', 'ore', 'air']);
    for (let r = 0; r < MINE.rows; r++) {
      for (let c = 0; c < MINE.cols; c++) {
        expect(validTypes.has(state.mine.grid[r][c].type)).toBe(true);
      }
    }
  });

  it('túnel inicial revelado no topo central', () => {
    initMine();
    const cc = Math.floor(MINE.cols / 2);
    expect(state.mine.grid[0][cc].revealed).toBe(true);
    expect(state.mine.grid[0][cc].type).toBe('air');
  });

  it('coloca veio de coal e iron_ore no túnel inicial', () => {
    initMine();
    const cc = Math.floor(MINE.cols / 2);
    expect(state.mine.grid[1][cc - 1].type).toBe('ore');
    expect(state.mine.grid[1][cc - 1].resource).toBe('coal');
    expect(state.mine.grid[1][cc + 1].type).toBe('ore');
    expect(state.mine.grid[1][cc + 1].resource).toBe('iron_ore');
  });

  it('distribui veios de vários recursos pelo mapa', () => {
    initMine();
    const found = new Set();
    for (let r = 0; r < MINE.rows; r++) {
      for (let c = 0; c < MINE.cols; c++) {
        const t = state.mine.grid[r][c];
        if (t.type === 'ore') found.add(t.resource);
      }
    }
    // Deve ter pelo menos coal, iron_ore + alguns outros
    expect(found.has('coal')).toBe(true);
    expect(found.has('iron_ore')).toBe(true);
    expect(found.size).toBeGreaterThan(3);
  });
});

describe('workers', () => {
  it('disponíveis = total quando ninguém alocado', () => {
    initMine();
    expect(workersAvailable()).toBe(state.workersTotal);
    expect(workersActive()).toBe(0);
  });

  it('contratar minerador aumenta total e gasta dinheiro', () => {
    initMine();
    const moneyBefore = state.money;
    const totalBefore = state.workersTotal;
    tryHireWorker();
    expect(state.workersTotal).toBe(totalBefore + 1);
    expect(state.money).toBe(moneyBefore - 80);
  });

  it('contratar sem dinheiro é no-op', () => {
    initMine();
    state.money = 10;
    const totalBefore = state.workersTotal;
    tryHireWorker();
    expect(state.workersTotal).toBe(totalBefore);
    expect(state.money).toBe(10);
  });
});
