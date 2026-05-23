// mine.test.js — múltiplas minas, geração de grid, workers globais
import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { initMines, tryHireWorker, workersAvailable, workersActive, activeMine, buyMine, isMineOwned, canBuyMine } from '../src/mine.js';
import { MINE } from '../src/data.js';

beforeEach(() => {
  state.money = 1000;
  state.workersTotal = 2;
  state.mines = [];
  state.activeMineIdx = 0;
  state.tool = 'pick';
});

describe('initMines', () => {
  it('cria 2 minas iniciais nomeadas', () => {
    initMines();
    expect(state.mines).toHaveLength(2);
    expect(state.mines[0].name).toBe('Mina Central');
    expect(state.mines[1].name).toBe('Mina do Vale');
  });

  it('cada mina tem grid com dimensões corretas', () => {
    initMines();
    for (const m of state.mines) {
      expect(m.grid).toHaveLength(MINE.rows);
      for (const row of m.grid) expect(row).toHaveLength(MINE.cols);
    }
  });

  it('col 0 de toda mina é poço (shaft) revelado', () => {
    initMines();
    for (const m of state.mines) {
      for (let r = 0; r < MINE.rows; r++) {
        expect(m.grid[r][0].type).toBe('shaft');
        expect(m.grid[r][0].revealed).toBe(true);
      }
    }
  });

  it('cada mina tem state de elevador inicial', () => {
    initMines();
    for (const m of state.mines) {
      expect(m.elevator).toBeDefined();
      expect(m.elevator.y).toBe(0);
      expect(m.elevator.dir).toBe(1);
      expect(m.exhausted).toBe(false);
    }
  });

  it('todo tile (exceto shaft) tem tipo válido', () => {
    initMines();
    const validTypes = new Set(['dirt', 'stone', 'ore', 'air', 'shaft']);
    for (const m of state.mines) {
      for (let r = 0; r < MINE.rows; r++) {
        for (let c = 0; c < MINE.cols; c++) {
          expect(validTypes.has(m.grid[r][c].type)).toBe(true);
        }
      }
    }
  });

  it('coloca veio de coal e iron_ore no túnel inicial adjacente ao elevador', () => {
    initMines();
    // Túnel inicial sai do elevador (col 0) pela direita. Veios iniciais
    // estão em (1, 2) e (1, 3) — logo abaixo do túnel horizontal de cima.
    for (const m of state.mines) {
      expect(m.grid[1][2].resource).toBe('coal');
      expect(m.grid[1][3].resource).toBe('iron_ore');
    }
  });

  it('cada mina distribui veios de vários recursos', () => {
    initMines();
    for (const m of state.mines) {
      const found = new Set();
      for (let r = 0; r < MINE.rows; r++) {
        for (let c = 0; c < MINE.cols; c++) {
          if (m.grid[r][c].type === 'ore') found.add(m.grid[r][c].resource);
        }
      }
      expect(found.has('coal')).toBe(true);
      expect(found.has('iron_ore')).toBe(true);
      expect(found.size).toBeGreaterThan(3);
    }
  });
});

describe('activeMine', () => {
  it('retorna mina pelo activeMineIdx', () => {
    initMines();
    state.activeMineIdx = 0;
    expect(activeMine().name).toBe('Mina Central');
    state.activeMineIdx = 1;
    expect(activeMine().name).toBe('Mina do Vale');
  });
});

describe('buyMine (catálogo de minas pagas)', () => {
  it('isMineOwned reconhece minas iniciais como possuídas', () => {
    initMines();
    expect(isMineOwned('central')).toBe(true);
    expect(isMineOwned('vale')).toBe(true);
    expect(isMineOwned('mar')).toBe(false);
    expect(isMineOwned('serra')).toBe(false);
  });

  it('canBuyMine bloqueia se era atual insuficiente', () => {
    initMines();
    state.contractsCompleted = 0; // era 1
    state.money = 10000;
    expect(canBuyMine('mar')).toBe(false); // requer era 3
    expect(canBuyMine('serra')).toBe(false); // requer era 4
  });

  it('canBuyMine bloqueia se dinheiro insuficiente', () => {
    initMines();
    state.contractsCompleted = 30; // era 5+
    state.money = 100;
    expect(canBuyMine('mar')).toBe(false);
    expect(canBuyMine('serra')).toBe(false);
  });

  it('buyMine adiciona mina ao estado, gasta dinheiro e aplica viés', () => {
    initMines();
    state.contractsCompleted = 30;
    state.money = 5000;
    expect(state.mines.length).toBe(2);
    buyMine('mar');
    expect(state.mines.length).toBe(3);
    expect(state.mines[2].id).toBe('mar');
    expect(state.mines[2].name).toBe('Mina do Mar');
    expect(state.money).toBe(5000 - 1500);
    // viés: deve ter ao menos um veio dos recursos do mar
    const found = new Set();
    for (let r = 0; r < state.mines[2].grid.length; r++) {
      for (let c = 0; c < state.mines[2].grid[r].length; c++) {
        const t = state.mines[2].grid[r][c];
        if (t.type === 'ore') found.add(t.resource);
      }
    }
    // ao menos 1 dos recursos com viés deve existir
    const biased = ['sand', 'sulfur', 'saltpeter', 'oil'];
    expect(biased.some((b) => found.has(b))).toBe(true);
  });

  it('buyMine é no-op se já possui', () => {
    initMines();
    state.money = 5000;
    state.contractsCompleted = 30;
    buyMine('central'); // já possuída
    expect(state.mines.length).toBe(2); // não mudou
    expect(state.money).toBe(5000);
  });
});

describe('workers (pool global entre todas as minas)', () => {
  it('disponíveis = total quando ninguém alocado em nenhuma mina', () => {
    initMines();
    expect(workersAvailable()).toBe(state.workersTotal);
    expect(workersActive()).toBe(0);
  });

  it('worker alocado em qualquer mina conta como ocupado', () => {
    initMines();
    // marca um tile com worker na 2ª mina
    state.mines[1].grid[1][1] = { type: 'ore', resource: 'coal', amount: 20, revealed: true, worker: true };
    expect(workersActive()).toBe(1);
    expect(workersAvailable()).toBe(state.workersTotal - 1);
  });

  it('contratar minerador aumenta total e gasta dinheiro', () => {
    initMines();
    const moneyBefore = state.money;
    const totalBefore = state.workersTotal;
    tryHireWorker();
    expect(state.workersTotal).toBe(totalBefore + 1);
    expect(state.money).toBe(moneyBefore - 80);
  });

  it('contratar sem dinheiro é no-op', () => {
    initMines();
    state.money = 10;
    const totalBefore = state.workersTotal;
    tryHireWorker();
    expect(state.workersTotal).toBe(totalBefore);
    expect(state.money).toBe(10);
  });
});
