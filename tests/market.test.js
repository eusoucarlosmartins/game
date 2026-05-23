// market.test.js — venda de matéria-prima e produto
import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { sellRaw, sellProduct, sellAllRaw, MARKET_RAW_MULT } from '../src/market.js';
import { R } from '../src/data.js';

beforeEach(() => {
  state.money = 0;
  state.warehouse = { iron_ore: 10, coal: 5, water: 0 };
  state.products = { iron_ingot: 3 };
});

describe('sellRaw', () => {
  it('vende quantidade e credita dinheiro', () => {
    sellRaw('iron_ore', 5);
    expect(state.warehouse.iron_ore).toBe(5);
    expect(state.money).toBe(Math.round(5 * R.iron_ore.price * MARKET_RAW_MULT));
  });

  it('não vende mais do que tem', () => {
    sellRaw('iron_ore', 999);
    expect(state.warehouse.iron_ore).toBe(0);
    expect(state.money).toBeGreaterThan(0);
  });

  it('não vende água (recurso free)', () => {
    state.warehouse.water = 100;
    sellRaw('water', 10);
    expect(state.warehouse.water).toBe(100);
    expect(state.money).toBe(0);
  });

  it('sellAllRaw zera o estoque', () => {
    sellAllRaw('coal');
    expect(state.warehouse.coal).toBe(0);
  });
});

describe('sellProduct', () => {
  it('vende produto e credita dinheiro', () => {
    sellProduct('iron_ingot', 2);
    expect(state.products.iron_ingot).toBe(1);
    expect(state.money).toBeGreaterThan(0);
  });
  it('não vende sem estoque', () => {
    sellProduct('iron_ingot', 99);
    expect(state.products.iron_ingot).toBe(0);
  });
});
