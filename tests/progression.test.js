// progression.test.js — eras, modificadores, transportTier
import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import {
  currentEra,
  isDepositUnlocked,
  isRecipeUnlocked,
  transportTier,
  eqMod,
} from '../src/progression.js';

beforeEach(() => {
  state.contractsCompleted = 0;
  state.equipment = {};
  state.research = {};
});

describe('currentEra', () => {
  it('era 1 com 0 contratos', () => {
    state.contractsCompleted = 0;
    expect(currentEra()).toBe(1);
  });
  it('era 2 ao bater 3 contratos', () => {
    state.contractsCompleted = 3;
    expect(currentEra()).toBe(2);
  });
  it('era 3 ao bater 8 contratos', () => {
    state.contractsCompleted = 8;
    expect(currentEra()).toBe(3);
  });
  it('era 6 (final) ao bater 40 contratos', () => {
    state.contractsCompleted = 40;
    expect(currentEra()).toBe(6);
  });
});

describe('isDepositUnlocked / isRecipeUnlocked', () => {
  it('coal sempre desbloqueado (era 1)', () => {
    state.contractsCompleted = 0;
    expect(isDepositUnlocked('coal')).toBe(true);
  });
  it('wood só desbloqueia na era 2', () => {
    state.contractsCompleted = 0;
    expect(isDepositUnlocked('wood')).toBe(false);
    state.contractsCompleted = 3;
    expect(isDepositUnlocked('wood')).toBe(true);
  });
  it('iron_ingot desbloqueado já na era 1', () => {
    state.contractsCompleted = 0;
    expect(isRecipeUnlocked('iron_ingot')).toBe(true);
  });
  it('steam_engine só na era 5', () => {
    state.contractsCompleted = 24; // ainda era 4
    expect(isRecipeUnlocked('steam_engine')).toBe(false);
    state.contractsCompleted = 25; // sobe pra era 5
    expect(isRecipeUnlocked('steam_engine')).toBe(true);
  });
});

describe('transportTier', () => {
  it('tier mínimo igual à era atual (sem pesquisa)', () => {
    // Sem contratos completos → era 1 → tier 1 (estradas evoluem com era)
    expect(transportTier()).toBe(1);
  });
  it('pesquisa sobrescreve se for maior que era', () => {
    state.research = { r_wagon_big: true };
    expect(transportTier()).toBe(1); // tier da pesquisa = era atual
  });
  it('toma o maior tier entre pesquisas adquiridas', () => {
    state.research = { r_wagon_big: true, r_truck: true };
    expect(transportTier()).toBe(3);
  });
});

describe('eqMod (soma de modificadores)', () => {
  it('zero sem nada adquirido', () => {
    expect(eqMod('mineRate')).toBe(0);
    expect(eqMod('wagonCap')).toBe(0);
  });
  it('soma equipamentos', () => {
    state.equipment = { pick_iron: true };
    expect(eqMod('mineRate')).toBeCloseTo(0.15);
  });
  it('soma pesquisas com efeito secundário (e2)', () => {
    state.research = { r_car: true }; // wagonCap +0.5 + wagonSpd +0.3 (via e2)
    expect(eqMod('wagonCap')).toBeCloseTo(0.5);
    expect(eqMod('wagonSpd')).toBeCloseTo(0.3);
  });
  it('combina equipamentos e pesquisas no mesmo efeito', () => {
    state.equipment = { pick_iron: true };
    state.research = { r_drill_manual: true };
    expect(eqMod('mineRate')).toBeCloseTo(0.35);
  });
});
