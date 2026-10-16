// civilizations.test.js — escolha de civ, bônus iniciais, mods de progression
import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { chooseCivilization, applyCivStartBonuses } from '../src/civilizations.js';
import { civMod, mineRateMul, factSpdMul, wagonSpeed } from '../src/progression.js';
import { CFG, SILO_DEFAULT_CAP } from '../src/data.js';

beforeEach(() => {
  state.civilization = null;
  state.money = CFG.startMoney;
  state.approval = CFG.approvalStart;
  state.silos = { coal: { cap: SILO_DEFAULT_CAP }, iron_ore: { cap: SILO_DEFAULT_CAP } };
  state.equipment = {};
  state.research = {};
  state.eventMineMul = 1;
});

describe('chooseCivilization', () => {
  it('registra civilização em state', () => {
    chooseCivilization('gaucho');
    expect(state.civilization).toBe('gaucho');
  });
  it('é no-op se já escolhida (permanente)', () => {
    chooseCivilization('gaucho');
    chooseCivilization('paulista');
    expect(state.civilization).toBe('gaucho');
  });
  it('ignora id inválido', () => {
    chooseCivilization('xyz');
    expect(state.civilization).toBeNull();
  });
});

describe('Bônus iniciais (one-shot)', () => {
  it('Catarinense: +10 aprovação inicial', () => {
    const base = state.approval;
    chooseCivilization('catarinense');
    expect(state.approval).toBe(base + 10);
  });
  it('Paulista: −$200 de caixa', () => {
    const base = state.money;
    chooseCivilization('paulista');
    expect(state.money).toBe(base - 200);
  });
  it('Mineiro: +200 cap em cada silo', () => {
    chooseCivilization('mineiro');
    for (const k in state.silos) {
      expect(state.silos[k].cap).toBe(SILO_DEFAULT_CAP + 200);
    }
  });
  it('Gaúcho: não altera caixa nem aprovação (bônus são contínuos)', () => {
    const m = state.money, a = state.approval;
    chooseCivilization('gaucho');
    expect(state.money).toBe(m);
    expect(state.approval).toBe(a);
  });
});

describe('civMod + modificadores derivados', () => {
  it('Catarinense: mineRate +10%', () => {
    chooseCivilization('catarinense');
    expect(civMod('mineRate')).toBeCloseTo(0.10);
    expect(mineRateMul()).toBeCloseTo(1.10);
  });
  it('Paulista: factSpd +30%', () => {
    chooseCivilization('paulista');
    expect(factSpdMul()).toBeCloseTo(1.30);
  });
  it('Gaúcho: wagonSpeed = base × 1.25', () => {
    chooseCivilization('gaucho');
    expect(wagonSpeed()).toBeCloseTo(CFG.wagonSpeedBase * 1.25);
  });
  it('Mineiro: mineRate −10%', () => {
    chooseCivilization('mineiro');
    expect(mineRateMul()).toBeCloseTo(0.90);
  });
  it('sem civ: civMod retorna 0', () => {
    expect(civMod('mineRate')).toBe(0);
    expect(mineRateMul()).toBe(1);
  });
});

describe('applyCivStartBonuses isolado (não via chooseCivilization)', () => {
  it('aplicar duas vezes NÃO duplica — mas o módulo não impede', () => {
    // (Documentação: cuidado em chamar manualmente — chooseCivilization é a API)
    state.civilization = 'catarinense';
    const base = state.approval;
    applyCivStartBonuses();
    expect(state.approval).toBe(base + 10);
    applyCivStartBonuses();
    expect(state.approval).toBe(base + 20); // dobra se chamado duas vezes
  });
});
