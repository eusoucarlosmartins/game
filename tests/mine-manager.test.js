import { describe, it, expect, afterEach } from 'vitest';
import { state } from '../src/state.js';
import { initMines, updateMine } from '../src/mine.js';
import { updateFactories } from '../src/factories.js';
import { updateWagon } from '../src/wagon.js';
import { updateContract, updateDay } from '../src/contracts.js';
import { updateStaff, hireOrPromote } from '../src/staff.js';
import { freeWorkers } from '../src/advisor.js';

const realRandom = Math.random;
afterEach(() => { Math.random = realRandom; });

/** @param {() => void} setup */
function run(setup) {
  let seed = 7;
  Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  initMines();
  state.eraReached = 1;
  state.money = 3000; state.approval = 60; state.contractsCompleted = 6; state.contract = null; state.nextContractIn = 2;
  state.workersTotal = 4; state.sites = {}; state.staff = {}; state.staffUnpaid = {}; state.army = null;
  state.factories = [{ recipeId: 'iron_ingot', brewing: 0, output: 0 }];
  for (const k in state.warehouse) state.warehouse[k] = 0;
  for (const k in state.products) state.products[k] = 0;
  state.log = [];
  setup();
  let idle = 0, samples = 0;
  for (let t = 0; t < 600; t += 0.1) {
    updateMine(0.1); updateFactories(0.1); updateWagon(0.1); updateContract(0.1); updateDay(0.1); updateStaff(0.1);
    if (Math.round(t * 10) % 50 === 0) { samples++; idle += Math.max(0, freeWorkers()) / state.workersTotal; }
  }
  const acts = state.log.filter((l) => /Gerente de Mina (pôs|mandou|construiu|usou|contratou)/.test(l.msg)).length;
  return { contracts: state.contractsCompleted - 6, idle: idle / samples, acts, built: Object.keys(state.sites).filter((k) => state.sites[k].built) };
}

describe('gerente de mina (simulação de 10 min sem o jogador)', () => {
  it('nível 1 mantém a equipe trabalhando nos veios e postos existentes', () => {
    const r = run(() => {
      state.sites = { claypit: { built: true, workers: 0, harvested: 0 }, quarry: { built: true, workers: 0, harvested: 0 } };
      hireOrPromote('gerenteMina'); hireOrPromote('gerenteContrato');
    });
    // o Nv1 não explora: quando os veios visíveis acabam, sobra gente parada (isso é do Nv2)
    expect(r.idle).toBeLessThan(0.6);
    expect(r.acts).toBeGreaterThan(5);
    expect(r.contracts).toBeGreaterThan(3);
  });

  it('nível 2 constrói os postos que faltam e quase ninguém fica parado', () => {
    const r = run(() => {
      state.contractsCompleted = 16;
      hireOrPromote('gerenteMina'); hireOrPromote('gerenteMina'); hireOrPromote('gerenteContrato');
    });
    expect(r.built.length).toBeGreaterThan(0);
    expect(r.idle).toBeLessThan(0.2);
    expect(r.contracts).toBeGreaterThan(10);
  });

  it('sem gerente, ninguém é alocado sozinho', () => {
    const r = run(() => {});
    expect(r.acts).toBe(0);
  });
});
