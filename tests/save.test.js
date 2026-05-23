// save.test.js — roundtrip de save/load preservando estado essencial.
import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { saveGame, loadGame, deleteSave } from '../src/save.js';

// happy-dom já fornece localStorage; limpamos a cada teste pra isolar.
beforeEach(() => {
  localStorage.clear();
});

describe('save/load roundtrip', () => {
  it('preserva dinheiro, dia e contratos cumpridos', () => {
    state.money = 12345;
    state.day = 42;
    state.contractsCompleted = 7;
    expect(saveGame()).toBe(true);
    // muda em memória pra simular novo jogo
    state.money = 0;
    state.day = 1;
    state.contractsCompleted = 0;
    expect(loadGame()).toBe(true);
    expect(state.money).toBe(12345);
    expect(state.day).toBe(42);
    expect(state.contractsCompleted).toBe(7);
  });

  it('preserva equipamentos e pesquisas adquiridas', () => {
    state.equipment = { pick_iron: true, cart_a: true };
    state.research = { r_drill_manual: true };
    state.rp = 99;
    saveGame();
    state.equipment = {};
    state.research = {};
    state.rp = 0;
    loadGame();
    expect(state.equipment).toEqual({ pick_iron: true, cart_a: true });
    expect(state.research).toEqual({ r_drill_manual: true });
    expect(state.rp).toBe(99);
  });

  it('preserva grids das múltiplas minas e ferramenta', () => {
    state.mines = [
      {
        id: 'm1', name: 'Mina A', exhausted: false,
        grid: [[{ type: 'dirt', revealed: true, resource: null, amount: 0, worker: false }]],
        tntFx: null,
        elevator: { y: 0.3, dir: 1 },
      },
      {
        id: 'm2', name: 'Mina B', exhausted: true,
        grid: [[{ type: 'ore', resource: 'coal', amount: 5, revealed: true, worker: false }]],
        tntFx: null,
        elevator: { y: 0, dir: 1 },
      },
    ];
    state.tool = 'tnt';
    state.activeMineIdx = 1;
    saveGame();
    // zera em memória
    state.mines = [];
    state.tool = 'pick';
    state.activeMineIdx = 0;
    loadGame();
    expect(state.mines).toHaveLength(2);
    expect(state.mines[0].name).toBe('Mina A');
    expect(state.mines[1].exhausted).toBe(true);
    expect(state.tool).toBe('tnt');
    expect(state.activeMineIdx).toBe(1);
  });

  it('deleteSave limpa o storage', () => {
    state.money = 999;
    saveGame();
    expect(localStorage.getItem('tapuia_save_v2')).not.toBeNull();
    deleteSave();
    expect(localStorage.getItem('tapuia_save_v2')).toBeNull();
  });

  it('loadGame retorna false sem save', () => {
    expect(loadGame()).toBe(false);
  });

  it('estado transitório (eventos) NÃO é persistido', () => {
    state.money = 100;
    state.activeEvent = { id: 'strike', name: 'Greve', timeLeft: 10 };
    state.eventMineMul = 0.5;
    saveGame();
    // simula novo carregamento
    state.activeEvent = null;
    state.eventMineMul = 1;
    loadGame();
    // money carregou, mas estados transitórios não foram restaurados
    expect(state.money).toBe(100);
    expect(state.activeEvent).toBeNull();
    expect(state.eventMineMul).toBe(1);
  });
});
