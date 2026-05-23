// state.js — estado mutável global + função log
import { R, CFG, SILO_DEFAULT_CAP } from './data.js';

export const state = {
  money: CFG.startMoney,
  approval: CFG.approvalStart,
  day: 1,
  dayTimer: 0,
  speed: 1,
  over: false,

  // Minas — array de minas independentes (cada uma com grid próprio)
  mines: [],            // populado por initMines() no boot
  activeMineIdx: 0,     // qual mina o jogador está vendo no momento
  tool: 'pick',         // ferramenta selecionada (global)
  workersTotal: 2,      // pool global de mineradores
  tilesDug: 0,          // contador global

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
  wagonSpeedBonus: 0,
  wagonCapacityBonus: 0,
  marketBonus: 0,
  rpBonus: 0,
  factorySpeedBonus: 0,
  approvalPerContractBonus: 0,

  // Estatísticas globais (acumuladas pra sempre)
  totalEarnings: 0,        // soma de tudo que entrou em $ (contratos + mercado + impostos + passivo)
  oreMined: {},            // recurso -> quantidade total minerada

  // Preferências
  muted: false,

  // Cena atual do canvas: 'overworld' (mapa) ou 'mine' (interior da mina)
  scene: 'overworld',

  // Tutorial inicial (auto-avança baseado em ações)
  tutorial: { step: 0, dismissed: false, autoDismissIn: 12 },

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
