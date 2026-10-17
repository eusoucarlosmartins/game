import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { MINE, CFG } from '../src/data.js';
import { initMines, tryDigClick } from '../src/mine.js';
import { placeRelics, RELIC_INCOME } from '../src/relics.js';
import { updateDay } from '../src/contracts.js';

const relicTiles = (m) => m.grid.flatMap((row, r) => row.map((t, c) => ({ t, r, c }))).filter((x) => x.t.relic);

describe('relíquias', () => {
  beforeEach(() => {
    initMines();
    state.relics = 0;
    state.relicNames = [];
    state.money = 1000;
    state.activeMineIdx = 0;
  });

  it('cada mina nova esconde 2 relíquias fundas e invisíveis', () => {
    for (const m of state.mines) {
      const rel = relicTiles(m);
      expect(rel.length).toBe(2);
      for (const { t, r } of rel) {
        expect(r).toBeGreaterThanOrEqual(5);
        expect(t.revealed).toBe(false);
      }
    }
  });

  it('cavar o bloco coleta a relíquia e ela rende ouro por dia', () => {
    const { t, r, c } = relicTiles(state.mines[0])[0];
    t.revealed = true;
    state.mines[0].grid[r - 1][c] = { type: 'air', resource: null, amount: 0, revealed: true, worker: false };
    tryDigClick(r, c);
    expect(state.relics).toBe(1);
    expect(state.relicNames.length).toBe(1);
    const before = state.money;
    state.dayTimer = CFG.dayLengthSec;
    updateDay(0.01);
    expect(state.money).toBeGreaterThanOrEqual(before + RELIC_INCOME);
  });

  it('minas antigas recebem relíquias só uma vez', () => {
    const m = state.mines[0];
    for (const row of m.grid) for (const t of row) delete t.relic;
    m.relicsPlaced = false;
    placeRelics(m);
    placeRelics(m);
    expect(relicTiles(m).length).toBe(2);
    expect(MINE.rows).toBeGreaterThan(5);
  });
});
