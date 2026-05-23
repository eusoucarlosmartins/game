// events.js — eventos aleatórios que afetam o jogo temporariamente
import { state, log } from './state.js';
import { rand, irand, clamp } from './util.js';
import { CFG, MINE } from './data.js';
import { play } from './audio.js';

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
      // Revela 25 tiles em CADA mina ativa (ao redor de tiles já revelados)
      const mines = state.mines || [];
      for (const mine of mines) {
        if (!mine.grid) continue;
        const candidates = [];
        for (let r = 0; r < MINE.rows; r++) {
          for (let c = 0; c < MINE.cols; c++) {
            if (mine.grid[r][c].revealed) continue;
            for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
              const nr = r + dr, nc = c + dc;
              if (nr < 0 || nr >= MINE.rows || nc < 0 || nc >= MINE.cols) continue;
              if (mine.grid[nr][nc].revealed) { candidates.push([r, c]); break; }
            }
          }
        }
        candidates.sort(() => Math.random() - 0.5);
        const n = Math.min(25, candidates.length);
        for (let i = 0; i < n; i++) {
          const [r, c] = candidates[i];
          mine.grid[r][c].revealed = true;
        }
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
  // === Eventos novos ===
  {
    id: 'tourism',
    name: 'Onda de Turismo',
    desc: 'Mercado paga +40% por 50s',
    duration: 50,
    kind: 'good',
    onStart() { state.eventMarketMul = 0.4; },
    onTick() { },
    onEnd() { state.eventMarketMul = 0; },
  },
  {
    id: 'embargo',
    name: 'Embargo Comercial',
    desc: 'Mercado paga -40% por 45s',
    duration: 45,
    kind: 'bad',
    onStart() { state.eventMarketMul = -0.4; },
    onTick() { },
    onEnd() { state.eventMarketMul = 0; },
  },
  {
    id: 'storm',
    name: 'Tempestade Tropical',
    desc: 'Carruagem 50% mais lenta por 40s',
    duration: 40,
    kind: 'bad',
    onStart() { state.eventWagonMul = -0.5; },
    onTick() { },
    onEnd() { state.eventWagonMul = 0; },
  },
  {
    id: 'innovation',
    name: 'Avanço Científico',
    desc: '+30 PP imediatos e fábricas +25% por 60s',
    duration: 60,
    kind: 'good',
    onStart() {
      state.rp = (state.rp || 0) + 30;
      state.eventFactoryMul = 0.25;
    },
    onTick() { },
    onEnd() { state.eventFactoryMul = 0; },
  },
  {
    id: 'tax_break',
    name: 'Subsídio do Império',
    desc: '+$800 instantâneo',
    duration: 0,
    kind: 'good',
    onStart() {
      state.money += 800;
      state.totalEarnings = (state.totalEarnings || 0) + 800;
    },
    onTick() { },
    onEnd() { },
  },
  {
    id: 'gold_strike',
    name: 'Veio Espontâneo!',
    desc: 'Revela um veio extra de ouro num lugar aleatório',
    duration: 0,
    kind: 'good',
    onStart() {
      const mines = state.mines || [];
      const candidates = [];
      for (const mine of mines) {
        if (!mine.grid) continue;
        for (let r = 5; r < MINE.rows; r++) {
          for (let c = 1; c < MINE.cols; c++) {
            const t = mine.grid[r][c];
            if (t.type === 'dirt' || t.type === 'stone') candidates.push({ mine, r, c });
          }
        }
      }
      if (candidates.length === 0) return;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      pick.mine.grid[pick.r][pick.c] = {
        type: 'ore', resource: 'gold_ore', amount: 60, revealed: true, worker: false,
      };
    },
    onTick() { },
    onEnd() { },
  },
  {
    id: 'border_dispute',
    name: 'Disputa de Fronteira',
    desc: 'Aprovação cai 12 imediatamente',
    duration: 0,
    kind: 'bad',
    onStart() { state.approval = clamp(state.approval - 12, 0, CFG.approvalMax); },
    onTick() { },
    onEnd() { },
  },
  {
    id: 'plague',
    name: 'Surto de Febre',
    desc: 'Mineração -30% por 50s',
    duration: 50,
    kind: 'bad',
    onStart() { state.eventMineMul = 0.7; },
    onTick() { },
    onEnd() { state.eventMineMul = 1; },
  },
  {
    id: 'gift',
    name: 'Mensagem da Corte',
    desc: '+50 PP de pesquisa',
    duration: 0,
    kind: 'good',
    onStart() { state.rp = (state.rp || 0) + 50; },
    onTick() { },
    onEnd() { },
  },
  // === Eventos históricos (sabor SC/Brasil 1850-1900) ===
  {
    id: 'guerra_paraguai',
    name: 'Guerra do Paraguai',
    desc: 'O Império convoca mais armamento. Próximo contrato +80% reward.',
    duration: 0,
    kind: 'neutral',
    onStart() { state.eventContractBonus = 0.8; },
    onTick() { },
    onEnd() { },
  },
  {
    id: 'imigracao_alema',
    name: 'Imigração Alemã (Blumenau)',
    desc: 'Famílias alemãs chegam! +2 mineradores grátis e fábricas +25% por 90s.',
    duration: 90,
    kind: 'good',
    onStart() {
      state.workersTotal = (state.workersTotal || 2) + 2;
      state.eventFactoryMul = 0.25;
    },
    onTick() { },
    onEnd() { state.eventFactoryMul = 0; },
  },
  {
    id: 'imigracao_italiana',
    name: 'Imigração Italiana (Urussanga)',
    desc: 'Imigrantes italianos chegam — +1 minerador e mercado +20% por 60s.',
    duration: 60,
    kind: 'good',
    onStart() {
      state.workersTotal = (state.workersTotal || 2) + 1;
      state.eventMarketMul = 0.2;
    },
    onTick() { },
    onEnd() { state.eventMarketMul = 0; },
  },
  {
    id: 'visita_imperador',
    name: 'Visita de Pedro II',
    desc: 'O Imperador visita Desterro! +25 aprovação imediato.',
    duration: 0,
    kind: 'good',
    onStart() { state.approval = clamp((state.approval || 0) + 25, 0, CFG.approvalMax); },
    onTick() { },
    onEnd() { },
  },
  {
    id: 'colera',
    name: 'Surto de Cólera',
    desc: 'Epidemia nas vilas. Mineração -50% por 90s e -15 aprovação.',
    duration: 90,
    kind: 'bad',
    onStart() {
      state.eventMineMul = 0.5;
      state.approval = clamp((state.approval || 0) - 15, 0, CFG.approvalMax);
    },
    onTick() { },
    onEnd() { state.eventMineMul = 1; },
  },
  {
    id: 'descoberta_lages',
    name: 'Descoberta em Lages',
    desc: 'Tropeiros acham veio de prata! Veio extra revelado em mina aleatória.',
    duration: 0,
    kind: 'good',
    onStart() {
      const mines = state.mines || [];
      const candidates = [];
      for (const mine of mines) {
        if (!mine.grid) continue;
        for (let r = 8; r < MINE.rows; r++) {
          for (let c = 1; c < MINE.cols; c++) {
            const t = mine.grid[r][c];
            if (t.type === 'dirt' || t.type === 'stone') candidates.push({ mine, r, c });
          }
        }
      }
      if (candidates.length === 0) return;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      pick.mine.grid[pick.r][pick.c] = {
        type: 'ore', resource: 'silver_ore', amount: 80, revealed: true, worker: false,
      };
    },
    onTick() { },
    onEnd() { },
  },
  {
    id: 'greve_tropeiros',
    name: 'Greve dos Tropeiros',
    desc: 'Tropeiros param! Carruagens -60% velocidade por 60s.',
    duration: 60,
    kind: 'bad',
    onStart() { state.eventWagonMul = -0.6; },
    onTick() { },
    onEnd() { state.eventWagonMul = 0; },
  },
  {
    id: 'vapor_hamburgo',
    name: 'Vapor de Hamburgo Atraca',
    desc: 'Mercadorias europeias rendem +$1200 imediato.',
    duration: 0,
    kind: 'good',
    onStart() {
      state.money += 1200;
      state.totalEarnings = (state.totalEarnings || 0) + 1200;
    },
    onTick() { },
    onEnd() { },
  },
  {
    id: 'revolta_federalista',
    name: 'Revolta Federalista (1893)',
    desc: 'Conflito civil! Aprovação -20 e mercado -30% por 60s.',
    duration: 60,
    kind: 'bad',
    onStart() {
      state.approval = clamp((state.approval || 0) - 20, 0, CFG.approvalMax);
      state.eventMarketMul = -0.3;
    },
    onTick() { },
    onEnd() { state.eventMarketMul = 0; },
  },
  {
    id: 'abolicao',
    name: 'Abolição da Escravatura (1888)',
    desc: 'Lei Áurea! +40 aprovação e mineração +30% permanente por 60s.',
    duration: 60,
    kind: 'good',
    onStart() {
      state.approval = clamp((state.approval || 0) + 40, 0, CFG.approvalMax);
      state.eventMineMul = 1.3;
    },
    onTick() { },
    onEnd() { state.eventMineMul = 1; },
  },
  {
    id: 'flooding',
    name: 'Vazamento de Água',
    desc: 'Um túnel inundou! Cave a água ($20) ou contorne.',
    duration: 0,
    kind: 'bad',
    onStart() {
      const candidates = [];
      for (const mine of (state.mines || [])) {
        if (!mine.grid || mine.exhausted) continue;
        for (let r = 5; r < MINE.rows; r++) {
          for (let c = 1; c < MINE.cols; c++) {
            if (mine.grid[r][c].type === 'air') candidates.push({ mine, r, c });
          }
        }
      }
      if (candidates.length === 0) return;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      pick.mine.grid[pick.r][pick.c] = { type: 'water', resource: null, amount: 0, revealed: true, worker: false };
      pick.mine._connectivity = null;
    },
    onTick() { },
    onEnd() { },
  },
  {
    id: 'gas_pocket',
    name: 'Bolsão de Gás',
    desc: 'Gás tóxico! Cave ($40) pra dissipar — workers próximos correm risco.',
    duration: 0,
    kind: 'bad',
    onStart() {
      const candidates = [];
      for (const mine of (state.mines || [])) {
        if (!mine.grid || mine.exhausted) continue;
        for (let r = 8; r < MINE.rows; r++) {
          for (let c = 2; c < MINE.cols; c++) {
            if (mine.grid[r][c].type === 'air') candidates.push({ mine, r, c });
          }
        }
      }
      if (candidates.length === 0) return;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      pick.mine.grid[pick.r][pick.c] = { type: 'gas', resource: null, amount: 0, revealed: true, worker: false };
      pick.mine._connectivity = null;
      // Tira worker de tiles vizinhos (asfixia)
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = pick.r + dr, nc = pick.c + dc;
        if (nr < 0 || nr >= MINE.rows || nc < 0 || nc >= MINE.cols) continue;
        const t = pick.mine.grid[nr][nc];
        if (t && t.worker) t.worker = false;
      }
    },
    onTick() { },
    onEnd() { },
  },
  {
    id: 'cave_in',
    name: 'Desabamento na Mina',
    desc: 'Um túnel desmoronou! Cave novamente pra liberar.',
    duration: 0,
    kind: 'bad',
    onStart() {
      // Pega uma mina ativa com tiles de air longe do shaft (col >= 4) e
      // converte um deles de volta pra dirt. Isso quebra a conectividade
      // se for um ponto de passagem importante.
      const candidates = [];
      for (const mine of (state.mines || [])) {
        if (!mine.grid || mine.exhausted) continue;
        for (let r = 0; r < MINE.rows; r++) {
          for (let c = 4; c < MINE.cols; c++) {
            if (mine.grid[r][c].type === 'air') candidates.push({ mine, r, c });
          }
        }
      }
      if (candidates.length === 0) return;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      pick.mine.grid[pick.r][pick.c] = { type: 'stone', resource: null, amount: 0, revealed: true, worker: false };
      // Invalida conectividade — vai ser recomputado no próximo tick
      pick.mine._connectivity = null;
    },
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
      // Intervalo até próximo evento, ajustado pela dificuldade
      state.nextEventIn = rand(60, 120) * eventFreqMul();
    }
    return;
  }

  state.nextEventIn -= dt;
  if (state.nextEventIn <= 0) triggerRandomEvent();
}

// Multiplicador de frequência: easy = eventos mais espaçados, hard = mais
function eventFreqMul() {
  return state.difficulty === 'easy' ? 1.6 : state.difficulty === 'hard' ? 0.6 : 1;
}

// Pesos por kind ajustados por dificuldade.
// Easy: enxuga muito eventos ruins, mantém bons.
// Hard: aumenta peso de eventos ruins, reduz bons (gestão difícil).
function kindWeight(kind) {
  const d = state.difficulty;
  if (kind === 'bad')  return d === 'easy' ? 0.35 : d === 'hard' ? 1.7 : 1;
  if (kind === 'good') return d === 'easy' ? 1.4  : d === 'hard' ? 0.6 : 1;
  return 1; // 'neutral'
}

function triggerRandomEvent() {
  // Roleta ponderada por dificuldade
  const weighted = EVENT_TYPES.map(e => ({ e, w: kindWeight(e.kind) }));
  const total = weighted.reduce((s, x) => s + x.w, 0);
  let roll = Math.random() * total;
  let evt = weighted[weighted.length - 1].e;
  for (const x of weighted) {
    roll -= x.w;
    if (roll <= 0) { evt = x.e; break; }
  }
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
    state.nextEventIn = rand(60, 120) * eventFreqMul();
  }
  if (evt.onStart) evt.onStart();
  const icon = evt.kind === 'good' ? '✨' : evt.kind === 'bad' ? '⚠' : '📰';
  log(`${icon} EVENTO: ${evt.name}. ${evt.desc}.`, evt.kind === 'bad' ? 'bad' : 'good');
  play(evt.kind === 'bad' ? 'fail' : 'chime');
}
