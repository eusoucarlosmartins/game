// events.js — eventos aleatórios que afetam o jogo temporariamente
import { state, log } from './state.js';
import { rand, irand, clamp } from './util.js';
import { CFG, MINE } from './data.js';

// Cada evento tem: id, name, desc, duration (segundos), kind (good/bad/neutral),
// onStart(state) — efeito imediato; onTick(state, dt) — durante o evento;
// onEnd(state) — limpa side effects.
export const EVENT_TYPES = [
  {
    id: 'festival',
    name: 'Festival de Música',
    desc: '+20% de aprovação enquanto durar',
    duration: 30,
    kind: 'good',
    onStart() { /* aplicado por bônus contínuo via approval bump */ },
    onTick(dt) { state.approval = clamp(state.approval + 0.5 * dt, 0, CFG.approvalMax); },
    onEnd() { },
  },
  {
    id: 'strike',
    name: 'Greve dos Mineradores',
    desc: 'Produção da mina reduzida 50%',
    duration: 45,
    kind: 'bad',
    onStart() { state.eventMineMul = 0.5; },
    onTick() { },
    onEnd() { state.eventMineMul = 1; },
  },
  {
    id: 'discovery',
    name: 'Descoberta Espontânea',
    desc: 'Mapa revela 25 tiles próximos',
    duration: 0, // efeito instantâneo
    kind: 'good',
    onStart() {
      if (!state.mine.grid) return;
      // Revela 25 tiles ao redor de tiles já revelados
      const candidates = [];
      for (let r = 0; r < MINE.rows; r++) {
        for (let c = 0; c < MINE.cols; c++) {
          if (state.mine.grid[r][c].revealed) continue;
          for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= MINE.rows || nc < 0 || nc >= MINE.cols) continue;
            if (state.mine.grid[nr][nc].revealed) { candidates.push([r, c]); break; }
          }
        }
      }
      // embaralha e revela primeiros 25
      candidates.sort(() => Math.random() - 0.5);
      const n = Math.min(25, candidates.length);
      for (let i = 0; i < n; i++) {
        const [r, c] = candidates[i];
        state.mine.grid[r][c].revealed = true;
      }
    },
    onTick() { },
    onEnd() { },
  },
  {
    id: 'rush',
    name: 'Corrida do Ouro',
    desc: 'Próximo contrato vale +50% de recompensa',
    duration: 60,
    kind: 'good',
    onStart() { state.eventContractBonus = 0.5; },
    onTick() { },
    onEnd() { state.eventContractBonus = 0; },
  },
  {
    id: 'inspection',
    name: 'Inspeção Governamental',
    desc: 'Aprovação cai 8 imediatamente',
    duration: 0,
    kind: 'bad',
    onStart() { state.approval = clamp(state.approval - 8, 0, CFG.approvalMax); },
    onTick() { },
    onEnd() { },
  },
];

const EVT_BY_ID = Object.fromEntries(EVENT_TYPES.map(e => [e.id, e]));

export function updateEvents(dt) {
  // Inicializa timer e estado se preciso
  if (state.nextEventIn === undefined) state.nextEventIn = rand(45, 90);
  if (state.activeEvent === undefined) state.activeEvent = null;

  if (state.activeEvent) {
    const def = EVT_BY_ID[state.activeEvent.id];
    if (def && def.onTick) def.onTick(dt);
    state.activeEvent.timeLeft -= dt;
    if (state.activeEvent.timeLeft <= 0) {
      if (def && def.onEnd) def.onEnd();
      log(`Evento "${state.activeEvent.name}" terminou.`);
      state.activeEvent = null;
      state.nextEventIn = rand(60, 120);
    }
    return;
  }

  state.nextEventIn -= dt;
  if (state.nextEventIn <= 0) triggerRandomEvent();
}

function triggerRandomEvent() {
  const evt = EVENT_TYPES[irand(0, EVENT_TYPES.length - 1)];
  if (evt.duration > 0) {
    state.activeEvent = {
      id: evt.id,
      name: evt.name,
      desc: evt.desc,
      kind: evt.kind,
      timeLeft: evt.duration,
      total: evt.duration,
    };
  } else {
    state.activeEvent = null; // evento instantâneo, sem banner
    state.nextEventIn = rand(60, 120);
  }
  if (evt.onStart) evt.onStart();
  const icon = evt.kind === 'good' ? '✨' : evt.kind === 'bad' ? '⚠' : '📰';
  log(`${icon} EVENTO: ${evt.name}. ${evt.desc}.`, evt.kind === 'bad' ? 'bad' : 'good');
}
