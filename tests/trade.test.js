import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { buyCart, updateTrade, carts, pickCargo, CART_COST, ROUTE_BY_ID } from '../src/trade.js';
import { R } from '../src/data.js';

describe('rotas comerciais', () => {
  beforeEach(() => {
    state.trade = { carts: [], earned: 0 };
    state.money = 5000;
    state.contractsCompleted = 8; // Era III
    state.contract = null;
    state.factories = [{ recipeId: 'iron_ingot', brewing: 0, output: 0 }];
    for (const k in state.products) state.products[k] = 0;
    for (const k in state.warehouse) state.warehouse[k] = 0;
  });

  it('carroça exige a era da rota e dinheiro', () => {
    expect(buyCart('rio')).toBe(false); // Era IV
    expect(buyCart('curitiba')).toBe(true);
    expect(state.money).toBe(5000 - CART_COST);
  });

  it('não leva o que a fábrica ou o pedido estão usando', () => {
    state.products.iron_ingot = 20;
    state.contract = { city: 'Lages', product: 'nails', need: 3, delivered: 0, deadline: 90, elapsed: 0 };
    state.products.nails = 10;
    expect(pickCargo()).toBeNull();
    state.products.brass = 8;
    expect(pickCargo()?.id).toBe('brass');
  });

  it('leva o excedente, vende na fronteira com o bônus da rota e volta', () => {
    buyCart('portoalegre');
    state.products.brass = 10;
    const before = state.money;
    for (let i = 0; i < 600; i++) updateTrade(0.1);
    const route = ROUTE_BY_ID.portoalegre;
    const expected = Math.round(6 * R.brass.price * route.mult) + Math.round(4 * R.brass.price * route.mult);
    expect(state.products.brass).toBe(0);
    expect(state.trade.earned).toBe(expected);
    expect(state.money).toBe(before + expected);
    expect(carts()[0].cargo).toBeNull();
  });
});
