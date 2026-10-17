import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { initMines } from '../src/mine.js';
import { updateFactories } from '../src/factories.js';
import { hireOrPromote, updateStaff } from '../src/staff.js';
import { pickCargo } from '../src/trade.js';
import { buildBarracks, reserveOf, setReserveUnits } from '../src/military.js';

function reset() {
  initMines();
  state.army = null;
  state.eraReached = 1;
  state.contractsCompleted = 30; // Era IV: canhão (vigas de aço + pólvora)
  state.money = 50000;
  state.staff = {}; state.staffUnpaid = {};
  state.contract = null;
  state.projects = { active: null, completed: [] };
  state.trade = { carts: [], earned: 0 };
  state.factories = [{ recipeId: 'iron_ingot', brewing: 0, output: 0 }, { recipeId: 'nails', brewing: 0, output: 0 }];
  for (const k in state.products) state.products[k] = 0;
  for (const k in state.warehouse) state.warehouse[k] = 0;
  updateStaff(25);
  buildBarracks();
}

describe('reserva militar', () => {
  beforeEach(reset);

  it('com Quartel, guarda material para 5 unidades por padrão (canhão: 4 pólvora e 2 vigas cada)', () => {
    expect(reserveOf('gunpowder')).toBe(20);
    expect(reserveOf('steel_beam')).toBe(10);
  });

  it('Gerente de Fábrica só vende o que passa da reserva', () => {
    hireOrPromote('gerenteFabrica');
    state.products.gunpowder = 30;
    updateStaff(3.1);
    expect(state.products.gunpowder).toBe(20);
  });

  it('caravanas não levam a reserva', () => {
    state.products.gunpowder = 21;
    expect(pickCargo()).toBeNull();
    state.products.gunpowder = 30;
    expect(pickCargo()?.id).toBe('gunpowder');
  });

  it('fábrica produz até completar a reserva, mesmo acima do estoque normal', () => {
    setReserveUnits(20); // 80 de pólvora
    state.factories = [{ recipeId: 'gunpowder', brewing: 0, output: 0 }];
    state.products.gunpowder = 30;
    state.warehouse.saltpeter = 10; state.warehouse.sulfur = 10; state.warehouse.coal = 10;
    updateFactories(0.1);
    expect(state.factories[0].brewing).toBeGreaterThan(0);
  });

  it('Gerente de Fábrica põe uma fábrica livre para completar a reserva', () => {
    hireOrPromote('gerenteFabrica');
    updateStaff(3.1);
    expect(state.factories.some((f) => f.recipeId === 'gunpowder' || f.recipeId === 'steel_beam')).toBe(true);
  });

  it('reserva 0 libera tudo para venda', () => {
    setReserveUnits(0);
    expect(reserveOf('gunpowder')).toBe(0);
    state.products.gunpowder = 5;
    expect(pickCargo()?.id).toBe('gunpowder');
  });
});
