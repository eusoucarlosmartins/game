import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { SILO_DEFAULT_CAP } from '../src/data.js';
import { tryUpgradeSilo, siloUpgradeCost, SILO_STEP } from '../src/mine.js';
import { contractRp, dailyRp } from '../src/contracts.js';

describe('silo e pontos de pesquisa', () => {
  beforeEach(() => {
    state.money = 1000;
    state.contractsCompleted = 0;
    state.eraReached = 0;
    state.silos.coal = { cap: SILO_DEFAULT_CAP };
  });

  it('ampliar o silo custa dinheiro e soma capacidade', () => {
    const cost = siloUpgradeCost(SILO_DEFAULT_CAP);
    expect(tryUpgradeSilo('coal')).toBe(true);
    expect(state.silos.coal.cap).toBe(SILO_DEFAULT_CAP + SILO_STEP);
    expect(state.money).toBe(1000 - cost);
    state.money = 0;
    expect(tryUpgradeSilo('coal')).toBe(false);
  });

  it('contratos dão mais PP nas eras avançadas', () => {
    const early = contractRp(5, 40);
    expect(early).toBeGreaterThanOrEqual(15);
    state.eraReached = 5;
    expect(contractRp(5, 40)).toBeGreaterThan(early);
    expect(dailyRp()).toBeGreaterThan(2);
  });
});
