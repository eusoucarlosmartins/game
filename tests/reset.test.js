import { describe, it, expect, beforeEach } from 'vitest';
import { freshStartIfNeeded, RESET_EPOCH, EPOCH_KEY } from '../src/reset.js';

describe('freshStartIfNeeded', () => {
  beforeEach(() => localStorage.clear());

  it('apaga todos os dados do jogo de quem jogou antes da época atual', () => {
    localStorage.setItem('tapuia_save_v2', '{"day":9}');
    localStorage.setItem('tapuia_slot_1', '{}');
    localStorage.setItem('tapuia_active_slot', '2');
    localStorage.setItem('outro_site', 'fica');
    expect(freshStartIfNeeded()).toBe(true);
    expect(localStorage.getItem('tapuia_save_v2')).toBeNull();
    expect(localStorage.getItem('tapuia_slot_1')).toBeNull();
    expect(localStorage.getItem('tapuia_active_slot')).toBeNull();
    expect(localStorage.getItem('outro_site')).toBe('fica');
    expect(localStorage.getItem(EPOCH_KEY)).toBe(RESET_EPOCH);
  });

  it('roda só uma vez: saves novos sobrevivem às próximas aberturas', () => {
    freshStartIfNeeded();
    localStorage.setItem('tapuia_save_v2', '{"day":1}');
    expect(freshStartIfNeeded()).toBe(false);
    expect(localStorage.getItem('tapuia_save_v2')).toBe('{"day":1}');
  });
});
