// achievements.test.js — desbloqueio automático + direto por evento
import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import {
  unlockAchievement,
  checkAchievements,
  updateAchievementToast,
  getAchievementProgress,
} from '../src/achievements.js';
import { ACHIEVEMENTS } from '../src/data.js';

beforeEach(() => {
  state.achievements = {};
  state.activeAchievement = null;
  state.contractsCompleted = 0;
  state.tilesDug = 0;
  state.totalEarnings = 0;
  state.tntUseCount = 0;
  state.mines = [];
  state.projects = { active: null, completed: [] };
});

describe('unlockAchievement', () => {
  it('registra timestamp e cria toast ativo', () => {
    unlockAchievement('first_contract');
    expect(state.achievements.first_contract).toBeGreaterThan(0);
    expect(state.activeAchievement).toBeDefined();
    expect(state.activeAchievement?.id).toBe('first_contract');
    expect(state.activeAchievement?.timeLeft).toBe(5);
  });

  it('é idempotente — segunda chamada não re-dispara', () => {
    unlockAchievement('first_contract');
    const t1 = state.achievements.first_contract;
    state.activeAchievement = null;
    unlockAchievement('first_contract');
    expect(state.achievements.first_contract).toBe(t1);
    expect(state.activeAchievement).toBeNull();
  });

  it('ignora id desconhecido', () => {
    unlockAchievement('wat');
    expect(state.achievements.wat).toBeUndefined();
    expect(state.activeAchievement).toBeNull();
  });
});

describe('checkAchievements', () => {
  it('desbloqueia first_contract quando contractsCompleted >= 1', () => {
    state.contractsCompleted = 1;
    checkAchievements();
    expect(state.achievements.first_contract).toBeTruthy();
  });

  it('desbloqueia contracts_10 e contracts_50 em cascata', () => {
    state.contractsCompleted = 60;
    checkAchievements();
    expect(state.achievements.contracts_10).toBeTruthy();
    expect(state.achievements.contracts_50).toBeTruthy();
  });

  it('desbloqueia tiles_100 ao bater 100 tiles', () => {
    state.tilesDug = 100;
    checkAchievements();
    expect(state.achievements.tiles_100).toBeTruthy();
    expect(state.achievements.tiles_500).toBeUndefined();
  });

  it('desbloqueia earnings_10k em $10.000', () => {
    state.totalEarnings = 10000;
    checkAchievements();
    expect(state.achievements.earnings_10k).toBeTruthy();
    expect(state.achievements.earnings_50k).toBeUndefined();
  });

  it('desbloqueia first_mine_bought quando possui mina paga', () => {
    state.mines = [{ id: 'central' }, { id: 'vale' }, { id: 'mar' }];
    checkAchievements();
    expect(state.achievements.first_mine_bought).toBeTruthy();
  });

  it('não desbloqueia first_mine_bought só com minas iniciais', () => {
    state.mines = [{ id: 'central' }, { id: 'vale' }];
    checkAchievements();
    expect(state.achievements.first_mine_bought).toBeUndefined();
  });

  it('desbloqueia all_mines com 4 minas', () => {
    state.mines = [{ id: 'central' }, { id: 'vale' }, { id: 'mar' }, { id: 'serra' }];
    checkAchievements();
    expect(state.achievements.all_mines).toBeTruthy();
  });

  it('desbloqueia mine_exhausted se qualquer mina está esgotada', () => {
    state.mines = [{ id: 'central', exhausted: true }];
    checkAchievements();
    expect(state.achievements.mine_exhausted).toBeTruthy();
  });

  it('desbloqueia tnt_10 após 10 usos', () => {
    state.tntUseCount = 10;
    checkAchievements();
    expect(state.achievements.tnt_10).toBeTruthy();
  });

  it('desbloqueia first_project com projeto concluído', () => {
    state.projects.completed = ['serraria'];
    checkAchievements();
    expect(state.achievements.first_project).toBeTruthy();
  });
});

describe('updateAchievementToast', () => {
  it('decrementa timeLeft e limpa quando chega a 0', () => {
    state.activeAchievement = { id: 'first_contract', timeLeft: 2 };
    updateAchievementToast(1);
    expect(state.activeAchievement?.timeLeft).toBe(1);
    updateAchievementToast(2);
    expect(state.activeAchievement).toBeNull();
  });

  it('é no-op quando não há toast ativo', () => {
    state.activeAchievement = null;
    expect(() => updateAchievementToast(1)).not.toThrow();
  });
});

describe('getAchievementProgress', () => {
  it('conta corretamente desbloqueadas vs total', () => {
    expect(getAchievementProgress()).toEqual({ unlocked: 0, total: ACHIEVEMENTS.length });
    state.achievements = { first_contract: 1, tiles_100: 2 };
    expect(getAchievementProgress()).toEqual({ unlocked: 2, total: ACHIEVEMENTS.length });
  });
});
