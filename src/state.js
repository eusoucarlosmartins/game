// state.js — estado mutável global + função log que altera state.log
import { R, CFG, NUM_DEPOSITS } from './data.js';

export const state = {
  money: CFG.startMoney,
  approval: CFG.approvalStart,
  day: 1,
  dayTimer: 0,
  speed: 1,
  over: false,

  deposits: Array.from({ length: NUM_DEPOSITS }, (_, i) => ({
    slot: i,
    resource: i === 0 ? 'coal' : (i === 1 ? 'iron_ore' : null),
    miners: (i < 2) ? 1 : 0,
    pile: 0,
  })),

  factories: [
    { recipeId: 'iron_ingot', brewing: 0, output: 0 },
  ],

  warehouse: Object.fromEntries(Object.keys(R).filter(k => R[k].kind === 'raw').map(k => [k, 0])),
  products: Object.fromEntries(Object.keys(R).filter(k => R[k].kind === 'prod').map(k => [k, 0])),

  cart: { pos: 1, dir: 0, load: {}, state: 'idle', timer: 0 },
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
};

export function log(msg, kind = '') {
  state.log.unshift({ msg, kind, day: state.day });
  if (state.log.length > 80) state.log.pop();
}
