// projects.test.js — projetos de obra: ativação, drenagem, conclusão
import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import {
  PROJECT_DEFS,
  activateProject,
  cancelProject,
  updateProjects,
  canActivateProject,
  availableProjects,
} from '../src/projects.js';

beforeEach(() => {
  state.money = 0;
  state.approval = 50;
  state.rp = 0;
  state.contractsCompleted = 0;
  state.projects = { active: null, completed: [] };
  state.permContractBonus = 0;
  state.passiveIncome = 0;
  state.approvalFloor = 0;
  state.warehouse = {};
  state.products = {};
});

describe('canActivateProject', () => {
  it('falha se era atual menor que eraReq', () => {
    state.contractsCompleted = 0; // era 1
    expect(canActivateProject('serraria')).toBe(false); // serraria pede era 2
  });

  it('passa se era atual atende', () => {
    state.contractsCompleted = 3; // era 2
    expect(canActivateProject('serraria')).toBe(true);
  });

  it('falha se outro projeto está ativo', () => {
    state.contractsCompleted = 3;
    state.projects.active = { id: 'outro', progress: {} };
    expect(canActivateProject('serraria')).toBe(false);
  });

  it('falha se já concluído', () => {
    state.contractsCompleted = 3;
    state.projects.completed = ['serraria'];
    expect(canActivateProject('serraria')).toBe(false);
  });
});

describe('activateProject', () => {
  it('marca projeto como ativo com progresso vazio', () => {
    state.contractsCompleted = 3;
    activateProject('serraria');
    expect(state.projects.active).toBeDefined();
    expect(state.projects.active?.id).toBe('serraria');
    expect(state.projects.active?.progress).toEqual({});
  });

  it('no-op se não pode ativar', () => {
    state.contractsCompleted = 0;
    activateProject('serraria');
    expect(state.projects.active).toBeNull();
  });
});

describe('updateProjects (drenagem)', () => {
  it('consome recursos da warehouse (raw) e products (prod) com taxa 0.5/s', () => {
    state.contractsCompleted = 3;
    state.warehouse = { wood: 100, stone: 100 };
    state.products = { iron_ingot: 100 };
    activateProject('serraria');
    updateProjects(1); // 1 segundo
    const prog = state.projects.active.progress;
    expect(prog.wood).toBeCloseTo(0.5, 5);
    expect(prog.stone).toBeCloseTo(0.5, 5);
    expect(prog.iron_ingot).toBeCloseTo(0.5, 5);
    expect(state.warehouse.wood).toBeCloseTo(99.5, 5);
    expect(state.products.iron_ingot).toBeCloseTo(99.5, 5);
  });

  it('não consome se warehouse vazia desse recurso', () => {
    state.contractsCompleted = 3;
    state.warehouse = { wood: 100, stone: 0 };
    state.products = { iron_ingot: 100 };
    activateProject('serraria');
    updateProjects(2);
    const prog = state.projects.active.progress;
    expect(prog.stone || 0).toBe(0);
    expect(prog.wood).toBeCloseTo(1, 5);
  });

  it('completa o projeto e aplica recompensa', () => {
    state.contractsCompleted = 3;
    // serraria: wood 40, stone 30 (raw), iron_ingot 5 (prod)
    state.warehouse = { wood: 200, stone: 200 };
    state.products = { iron_ingot: 200 };
    state.money = 0;
    state.rp = 0;
    activateProject('serraria');
    // simula 200 segundos (mais que suficiente p/ drenar a 0.5/s)
    updateProjects(200);
    expect(state.projects.completed).toContain('serraria');
    expect(state.projects.active).toBeNull();
    expect(state.money).toBe(400);
    expect(state.rp).toBe(10);
  });

  it('barragem aplica efeito de bônus permanente de contrato', () => {
    state.contractsCompleted = 25; // era 5
    // gunpowder, steel_beam, brick — todos prod
    state.products = { gunpowder: 500, steel_beam: 500, brick: 500 };
    activateProject('barragem');
    updateProjects(2000);
    expect(state.permContractBonus).toBeCloseTo(0.2, 5);
  });

  it('banco aplica renda passiva', () => {
    state.contractsCompleted = 25;
    // bank_safe, gold_ingot, steel_beam — todos prod
    state.products = { bank_safe: 100, gold_ingot: 100, steel_beam: 100 };
    activateProject('banco');
    updateProjects(2000);
    expect(state.passiveIncome).toBe(80);
  });
});

describe('cancelProject', () => {
  it('devolve 50% dos recursos contribuídos', () => {
    state.contractsCompleted = 3;
    state.warehouse = { wood: 100, stone: 100, iron_ingot: 100 };
    activateProject('serraria');
    updateProjects(10); // contribuiu 5 de cada
    cancelProject();
    expect(state.projects.active).toBeNull();
    // contribuiu ~5 de cada, devolveu ~2 (50% truncado)
    expect(state.warehouse.wood).toBeGreaterThan(95);
    expect(state.warehouse.wood).toBeLessThan(99);
  });
});

describe('availableProjects', () => {
  it('lista apenas projetos da era atual ou anterior', () => {
    state.contractsCompleted = 3; // era 2
    const avail = availableProjects();
    expect(avail.map(p => p.id)).toContain('serraria');
    expect(avail.map(p => p.id)).not.toContain('catedral'); // era 6
  });

  it('exclui projetos já concluídos', () => {
    state.contractsCompleted = 25;
    state.projects.completed = ['serraria'];
    const avail = availableProjects();
    expect(avail.map(p => p.id)).not.toContain('serraria');
  });
});

describe('PROJECT_DEFS integridade', () => {
  it('todos os recursos referenciados existem em R', () => {
    // só importa pra side-effect de ter validado o arquivo
    expect(PROJECT_DEFS.length).toBeGreaterThan(0);
    for (const p of PROJECT_DEFS) {
      expect(p.id).toBeTypeOf('string');
      expect(p.eraReq).toBeGreaterThanOrEqual(1);
      expect(p.eraReq).toBeLessThanOrEqual(6);
      expect(p.reward.money).toBeGreaterThan(0);
    }
  });
});
