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
  tool: 'miner',        // ferramenta selecionada (global) — default minerador
                        // pois é a primeira ação esperada do jogador no veio
  workersTotal: 2,      // pool global (mantido pra compat com saves antigos)
  workers: [],          // array de mineradores: { id, name, skill, fatigue, salary, tile? }
  tilesDug: 0,          // contador global

  factories: [
    { recipeId: 'iron_ingot', brewing: 0, output: 0, wagon: { pos: 0, dir: 0, product: null, load: 0, state: 'idle', timer: 0 } },
  ],

  warehouse: Object.fromEntries(Object.keys(R).filter(k => R[k].kind === 'raw').map(k => [k, 0])),
  products: Object.fromEntries(Object.keys(R).filter(k => R[k].kind === 'prod').map(k => [k, 0])),

  // Silo por recurso bruto (capacidade individual)
  silos: Object.fromEntries(
    Object.keys(R)
      .filter(k => R[k].kind === 'raw' && !R[k].free)
      .map(k => [k, { cap: SILO_DEFAULT_CAP }])
  ),

  // (state.wagon removido — agora cada factory tem seu próprio wagon)

  contract: null,            // alias pra contracts[0] (mantido pra compat com código antigo)
  contracts: [],             // múltiplos contratos simultâneos (1-3 dependendo da era)
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
  cityGrowth: 0,           // pontos de crescimento da cidade (sobe a cada contrato cumprido)
  tntUses: 0,              // contador pra conquista de TNT
  achievements: {},        // id -> timestamp quando desbloqueado
  history: [],             // [{ day, money, rp, approval, contracts }] — sample diário pra gráficos

  // Preferências
  muted: false,
  musicEnabled: true,       // música ambiente procedural ligada/desligada
  difficulty: 'normal',     // 'easy' | 'normal' | 'hard' — afeta multiplicadores
  gameMode: 'normal',       // 'normal' | 'sandbox' | 'hardcore'

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
  eventMarketMul: 0,        // bônus temporário aditivo no mercado (de eventos)
  eventWagonMul: 0,         // bônus temporário aditivo na velocidade da carruagem
  eventFactoryMul: 0,       // bônus temporário aditivo na velocidade das fábricas

  // Partículas (floating numbers, sparks, dust) — efêmeras, não persistidas
  particles: [],
  // Ambiência do overworld (nuvens drifting, pássaros voando) — não persistido
  ambience: {
    clouds: [],
    birds: [],
    nextBirdIn: 8,
    initialized: false,
  },

  // Câmera do overworld (drag-to-pan + scroll-to-zoom) — não persistido
  camera: { x: 0, y: 0, zoom: 1 },
  // Câmera da mina (scroll vertical pelas profundezas) — não persistido
  mineCamera: { y: 0 },
  isPanning: false,
  panStart: null,        // { mouseX, mouseY, cameraX, cameraY } em screen coords
  panDistance: 0,        // distância acumulada do drag (px) — pra distinguir click de drag
};

export function log(msg, kind = '') {
  state.log.unshift({ msg, kind, day: state.day });
  if (state.log.length > 80) state.log.pop();
}
