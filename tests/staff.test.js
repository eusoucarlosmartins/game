import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { initMines } from '../src/mine.js';
import { mineRateMul, factSpdMul } from '../src/progression.js';
import { canHire, hireOrPromote, staffLevel, staffMod, payStaff, updateStaff, staffActive } from '../src/staff.js';

function reset() {
  initMines();
  state.money = 10000;
  state.contractsCompleted = 0;
  state.staff = {};
  state.staffUnpaid = {};
  state.workersTotal = 2;
  state.factories = [{ recipeId: 'iron_ingot', brewing: 0, output: 0 }];
  for (const k in state.warehouse) state.warehouse[k] = 0;
  for (const k in state.products) state.products[k] = 0;
  state.contract = null;
}

describe('equipe (funcionários e gerentes)', () => {
  beforeEach(reset);

  it('libera cargos por era', () => {
    expect(canHire('capataz')).toBe('ok');
    expect(canHire('gerenteContrato')).toBe('era');
    state.contractsCompleted = 6; // Era II
    expect(canHire('gerenteContrato')).toBe('ok');
  });

  it('contratar e promover cobram e sobem de nível; bônus entram nos multiplicadores', () => {
    const base = mineRateMul();
    expect(hireOrPromote('capataz')).toBe(true);
    expect(staffLevel('capataz')).toBe(1);
    expect(state.money).toBe(10000 - 150);
    expect(mineRateMul()).toBeCloseTo(base + 0.15);
    expect(hireOrPromote('capataz')).toBe(false); // nível 2 exige Era II
    state.contractsCompleted = 6;
    expect(hireOrPromote('capataz')).toBe(true);
    expect(staffMod('mineRate')).toBeCloseTo(0.3);
  });

  it('sem dinheiro para o salário, o funcionário para (e o bônus some) até receber', () => {
    hireOrPromote('capataz');
    state.money = 0;
    payStaff();
    expect(staffActive('capataz')).toBe(false);
    expect(staffMod('mineRate')).toBe(0);
    state.money = 100;
    payStaff();
    expect(staffActive('capataz')).toBe(true);
    expect(state.money).toBe(94);
  });

  it('gerente de contratos troca a receita sozinho', () => {
    state.contractsCompleted = 6;
    hireOrPromote('gerenteContrato');
    state.contract = { city: 'Lages', product: 'brick', need: 4, delivered: 0, deadline: 90, elapsed: 0 };
    updateStaff(3.1);
    expect(state.factories[0].recipeId).toBe('brick');
  });

  it('gerente de mina põe minerador livre no veio que falta', () => {
    state.contractsCompleted = 6;
    hireOrPromote('gerenteMina');
    state.contract = { city: 'Lages', product: 'iron_ingot', need: 4, delivered: 0, deadline: 90, elapsed: 0 };
    state.warehouse.iron_ore = 10;
    updateStaff(3.1);
    const coal = state.mines[0].grid[1][2];
    expect(coal.resource).toBe('coal');
    expect(coal.worker).toBe(true);
  });

  it('gerente de fábrica acelera a produção e vende produto encalhado', () => {
    state.contractsCompleted = 16; // Era III
    const base = factSpdMul();
    hireOrPromote('gerenteFabrica');
    expect(factSpdMul()).toBeCloseTo(base + 0.2);
    state.products.nails = 25;
    const money = state.money;
    updateStaff(3.1);
    expect(state.products.nails).toBe(2);
    expect(state.money).toBeGreaterThan(money);
  });
});
