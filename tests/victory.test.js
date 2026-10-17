import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { checkVictory } from '../src/victory.js';
import { army, rivals } from '../src/military.js';

describe('caminhos para a vitória', () => {
  beforeEach(() => {
    state.victory = null;
    state.wonder = null;
    state.army = null;
    state.civilization = 'catarinense';
    state.approval = 100;
    state.day = 21;
    state.contractsCompleted = 13;
  });

  it('o cenário do print (dia 21, 13 contratos, 100%, Era III) não é mais vitória', () => {
    expect(checkVictory()).toBeNull();
  });

  it('política exige Era VI, 60 contratos, 100% de aprovação e dia 60', () => {
    state.contractsCompleted = 60;
    state.day = 59;
    expect(checkVictory()).toBeNull();
    state.day = 60;
    expect(checkVictory()?.kind).toBe('political');
    state.approval = 99;
    expect(checkVictory()).toBeNull();
  });

  it('conquista: todos os territórios rivais', () => {
    const t = army().territories;
    const r = rivals();
    r.slice(0, -1).forEach((x) => { t[x.id] = true; });
    expect(checkVictory()).toBeNull();
    t[r[r.length - 1].id] = true;
    expect(checkVictory()?.kind).toBe('conquest');
  });

  it('maravilha de pé dá vitória; depois de vencer, não dispara de novo (continuar jogando)', () => {
    state.wonder = { done: true, countdown: 0, won: true };
    expect(checkVictory()?.kind).toBe('wonder');
    state.victory = 'wonder';
    expect(checkVictory()).toBeNull();
  });
});
