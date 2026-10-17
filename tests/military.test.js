import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { army, buildBarracks, trainUnit, canTrain, armyPower, resolveAttack, sendExpedition, updateArmy, rivals, garrisonPower, tributePerDay, scaresBandits } from '../src/military.js';

describe('exército e fronteiras', () => {
  beforeEach(() => {
    state.army = null;
    state.civilization = 'catarinense';
    state.contractsCompleted = 8; // Era III
    state.money = 10000;
    state.approval = 50;
    state.day = 1;
    for (const k in state.products) state.products[k] = 0;
    for (const k in state.warehouse) state.warehouse[k] = 0;
  });

  it('rivais são as outras civilizações, cada uma numa fronteira', () => {
    const r = rivals();
    expect(r.map((x) => x.id)).not.toContain('catarinense');
    expect(new Set(r.map((x) => x.border)).size).toBe(r.length);
  });

  it('quartel exige Era III e dinheiro; unidades consomem os produtos de guerra', () => {
    state.contractsCompleted = 3;
    expect(buildBarracks()).toBe(false);
    state.contractsCompleted = 8;
    expect(canTrain('milicia')).toBe('barracks');
    expect(buildBarracks()).toBe(true);
    expect(trainUnit('milicia')).toBe(true);
    expect(armyPower()).toBe(1);
    expect(canTrain('fuzileiro')).toBe('era');
    state.contractsCompleted = 25; // Era V
    expect(canTrain('fuzileiro')).toBe('cost');
    state.products.rifle = 1; state.products.bullets = 2;
    expect(trainUnit('fuzileiro')).toBe(true);
    expect(state.products.rifle).toBe(0);
    expect(armyPower()).toBe(5);
  });

  it('ataque vencido dá saque; perdido tira dinheiro, silos e aprovação', () => {
    buildBarracks();
    for (let i = 0; i < 10; i++) trainUnit('milicia');
    const money = state.money;
    expect(resolveAttack({ rival: 'gaucho', border: 'portoalegre', power: 6, eta: 0, total: 60 })).toBe(true);
    expect(state.money).toBeGreaterThan(money);
    expect(army().wins).toBe(1);
    state.warehouse.coal = 200;
    const appr = state.approval;
    expect(resolveAttack({ rival: 'gaucho', border: 'portoalegre', power: 999, eta: 0, total: 60 })).toBe(false);
    expect(state.warehouse.coal).toBe(150);
    expect(state.approval).toBe(appr - 10);
  });

  it('ataques chegam a partir da Era III com aviso', () => {
    army().nextThreatIn = 1;
    updateArmy(2);
    expect(army().threats.length).toBe(1);
    expect(army().threats[0].eta).toBeGreaterThan(0);
  });

  it('expedição forte conquista território: tributo diário e fim dos ataques daquele rival', () => {
    buildBarracks();
    state.money = 100000;
    const target = rivals()[0].id;
    while (armyPower() * 1.0 < garrisonPower(target) + 2) trainUnit('milicia');
    expect(sendExpedition(target)).toBe(true);
    expect(armyPower()).toBe(0);
    for (let i = 0; i < 50; i++) updateArmy(1);
    expect(army().territories[target]).toBe(true);
    expect(tributePerDay()).toBe(120);
    expect(armyPower()).toBeGreaterThan(0);
  });

  it('milícia em casa espanta bandidos', () => {
    buildBarracks();
    expect(scaresBandits()).toBe(false);
    for (let i = 0; i < 3; i++) trainUnit('milicia');
    expect(scaresBandits()).toBe(true);
  });
});
