// state.js — estado mutável global + função log
import { R, CFG, SILO_DEFAULT_CAP } from './data.js';

export const state = {
  money: CFG.startMoney,
  approval: CFG.approvalStart,
  day: 1,
  dayTimer: 0,
  speed: 1,
  over: false,

  // Mina (grid criado em initMine() durante boot)
  mine: { grid: null, tool: 'pick', tntFx: null },
  workersTotal: 2,
  tilesDug: 0,

  factories: [
    { recipeId: 'iron_ingot', brewing: 0, output: 0 },
  ],

  warehouse: Object.fromEntries(Object.keys(R).filter(k => R[k].kind === 'raw').map(k => [k, 0])),
  products: Object.fromEntries(Object.keys(R).filter(k => R[k].kind === 'prod').map(k => [k, 0])),

  // Silo por recurso bruto (capacidade individual)
  silos: Object.fromEntries(
    Object.keys(R)
      .filter(k => R[k].kind === 'raw' && !R[k].free)
      .map(k => [k, { cap: SILO_DEFAULT_CAP }])
  ),

  wagon: { pos: 0, dir: 0, product: null, load: 0, state: 'idle', timer: 0 },

  contract: null,
  currentCity: 'Florianópolis',
  nextContractIn: 6,
  contractsCompleted: 0,

  equipment: {},
  research: {},
  rp: 0,
  eraReached: 1,
  log: [],

  // Projetos de obra
  projects: { active: null, completed: [] },

  // Efeitos permanentes de projetos
  permContractBonus: 0,
  passiveIncome: 0,
  approvalFloor: 0,

  // Estado transitório (não persistido)
  mouseX: -1,
  mouseY: -1,
  activeEvent: null,
  nextEventIn: 45,
  eventMineMul: 1,
  eventContractBonus: 0,
};

export function log(msg, kind = '') {
  state.log.unshift({ msg, kind, day: state.day });
  if (state.log.length > 80) state.log.pop();
}
