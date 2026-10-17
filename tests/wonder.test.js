import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { activateProject, updateProjects, projectProgress, updateWonder, getProjectDef, WONDER_HOLD } from '../src/projects.js';

describe('Maravilha (Ponte Hercílio Luz)', () => {
  beforeEach(() => {
    state.projects = { active: null, completed: [] };
    state.wonder = null;
    state.contractsCompleted = 80; // Era VI
    for (const k in state.products) state.products[k] = 0;
    for (const k in state.warehouse) state.warehouse[k] = 0;
  });

  it('só pode ser iniciada na Era VI', () => {
    state.contractsCompleted = 50;
    activateProject('maravilha');
    expect(state.projects.active).toBeNull();
    state.contractsCompleted = 80;
    activateProject('maravilha');
    expect(state.projects.active?.id).toBe('maravilha');
  });

  it('avança com os recursos e, concluída, conta 2 minutos até a vitória', () => {
    activateProject('maravilha');
    const req = getProjectDef('maravilha').requirements;
    for (const k in req) state.products[k] = req[k];
    for (let i = 0; i < 5; i++) updateProjects(10);
    expect(projectProgress('maravilha')).toBeGreaterThan(0);
    expect(updateWonder(1)).toBe(false); // ainda não concluída
    for (let i = 0; i < 400 && projectProgress('maravilha') < 1; i++) updateProjects(1);
    expect(projectProgress('maravilha')).toBe(1);
    expect(state.wonder?.done).toBe(true);
    expect(updateWonder(WONDER_HOLD - 1)).toBe(false);
    expect(updateWonder(2)).toBe(true);
    expect(state.wonder?.won).toBe(true);
  });
});
