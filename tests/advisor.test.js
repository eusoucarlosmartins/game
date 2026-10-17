import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { initMines } from '../src/mine.js';
import { adviseContract } from '../src/advisor.js';

/** @param {string} product @param {number} need */
const contract = (product, need = 4) => {
  state.contract = { city: 'Lages', product, need, delivered: 0, deadline: 90, elapsed: 0 };
};

describe('conselheiro do contrato', () => {
  beforeEach(() => {
    initMines();
    state.factories = [{ recipeId: 'iron_ingot', brewing: 0, output: 0 }];
    for (const k in state.warehouse) state.warehouse[k] = 0;
    for (const k in state.products) state.products[k] = 0;
    state.contractsCompleted = 0;
    state.workersTotal = 2;
  });

  it('sem pedido, sem conselho', () => {
    state.contract = null;
    expect(adviseContract()).toBeNull();
  });

  it('pede para trocar a receita quando nenhuma fábrica faz o produto', () => {
    contract('brick');
    const a = adviseContract();
    expect(a?.kind).toBe('switch');
    expect(a?.factory).toBe(0);
    expect(a?.recipe).toBe('brick');
  });

  it('aponta o minério que falta quando há veio descoberto e ninguém extraindo', () => {
    contract('iron_ingot');
    state.warehouse.iron_ore = 5;
    const a = adviseContract();
    expect(a?.kind).toBe('mine');
    expect(a?.resource).toBe('coal');
  });

  it('não reclama se o minério já está sendo extraído', () => {
    contract('iron_ingot');
    const g = state.mines[0].grid;
    g[1][2].worker = true; // carvão
    g[1][4].worker = true; // ferro
    expect(adviseContract()).toBeNull();
  });

  it('sugere explorar quando não há nenhum veio visível do minério', () => {
    contract('iron_ingot');
    state.warehouse.iron_ore = 5;
    for (const m of state.mines) for (const row of m.grid) for (const t of row) if (t.resource === 'coal') t.revealed = false;
    expect(adviseContract()?.kind).toBe('explore');
  });

  it('não troca a única fábrica de lingote quando o aço depende dela e não há estoque', () => {
    state.contractsCompleted = 8; // Era III: aço liberado
    contract('steel');
    const a = adviseContract();
    expect(a?.kind).toBe('buyFactory');
  });

  it('com lingotes em estoque, pode trocar a fábrica de lingote para aço', () => {
    state.contractsCompleted = 8;
    contract('steel', 3);
    state.products.iron_ingot = 10;
    const a = adviseContract();
    expect(a?.kind).toBe('switch');
    expect(a?.recipe).toBe('steel');
  });

  it('pedido já coberto pelo estoque não gera conselho', () => {
    contract('iron_ingot', 3);
    state.products.iron_ingot = 3;
    expect(adviseContract()).toBeNull();
  });
});
