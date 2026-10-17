import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { initMines } from '../src/mine.js';
import { hireOrPromote, updateStaff, neededRaw } from '../src/staff.js';
import { resourcesInUse, projectShortfall } from '../src/advisor.js';
import { pickCargo } from '../src/trade.js';

function reset() {
  initMines();
  state.money = 20000;
  state.eraReached = 1;
  state.contractsCompleted = 16; // Era III
  state.staff = {}; state.staffUnpaid = {};
  state.contract = null;
  state.projects = { active: { id: 'igreja', progress: {} }, completed: [] }; // tijolo 80, tábua 30, vidro 10
  state.factories = [
    { recipeId: 'iron_ingot', brewing: 0, output: 0 },
    { recipeId: 'nails', brewing: 0, output: 0 },
  ];
  for (const k in state.products) state.products[k] = 0;
  for (const k in state.warehouse) state.warehouse[k] = 0;
  updateStaff(25); // ninguém contratado: só avança o relógio além da espera entre trocas do teste anterior
}

describe('projetos contam como "em uso"', () => {
  beforeEach(reset);

  it('o que o projeto precisa não é vendido nem mandado nas caravanas', () => {
    state.products.brick = 40;
    expect(resourcesInUse().has('brick')).toBe(true);
    expect(pickCargo()?.id).not.toBe('brick');
  });

  it('o Gerente de Mina também extrai para o projeto (argila do tijolo)', () => {
    expect(neededRaw()).toContain('clay');
  });

  it('falta do projeto desconta o que já foi entregue e o estoque', () => {
    state.projects.active.progress = { brick: 70 };
    state.products.brick = 5;
    expect(projectShortfall().get('brick')).toBe(5);
  });
});

describe('Gerente de Fábrica pensa nos projetos', () => {
  beforeEach(reset);

  it('põe uma fábrica livre no que o projeto precisa', () => {
    hireOrPromote('gerenteFabrica');
    updateStaff(3.1);
    expect(state.factories.some((f) => ['brick', 'wood_plank', 'glass'].includes(f.recipeId))).toBe(true);
  });

  it('não tira a fábrica que o pedido está usando', () => {
    hireOrPromote('gerenteFabrica');
    state.factories = [{ recipeId: 'iron_ingot', brewing: 0, output: 0 }];
    state.contract = { city: 'Lages', product: 'iron_ingot', need: 5, delivered: 0, deadline: 90, elapsed: 0 };
    updateStaff(3.1);
    expect(state.factories[0].recipeId).toBe('iron_ingot');
  });

  it('não troca de novo a mesma fábrica antes de 20s (sem troca-troca)', () => {
    hireOrPromote('gerenteFabrica');
    updateStaff(3.1);
    const idx = state.factories.findIndex((f) => f.recipeId === 'brick');
    expect(idx).toBeGreaterThanOrEqual(0);
    state.products.brick = 999; // tijolo resolvido: o projeto agora quer tábua e vidro
    updateStaff(3.1);
    expect(state.factories[idx].recipeId).toBe('brick');
    // a outra fábrica pode ir para o próximo item do projeto
    expect(state.factories.some((f, i) => i !== idx && ['wood_plank', 'glass'].includes(f.recipeId))).toBe(true);
    for (let i = 0; i < 8; i++) updateStaff(3.1);
    expect(state.factories.every((f) => ['wood_plank', 'glass', 'brick'].includes(f.recipeId))).toBe(true);
  });
});
