// hazards.js — perigos escondidos na rocha: ☁️ grisu (gás) e 💧 lençol d'água.
// A Bússola revela antes de cavar; a decisão é do jogador:
// - grisu na picareta explode e fere um minerador por perto; na dinamite queima com segurança
// - lençol d'água inunda os túneis próximos por um tempo (mineradores ali param)
import { state, log } from './state.js';
import { MINE } from './data.js';

export const FLOOD_TIME = 40;
const GAS_PER_MINE = 3;
const WATER_PER_MINE = 3;

/** @param {any} mine @param {() => number} [rnd] */
export function placeHazards(mine, rnd = Math.random) {
  if (!mine || !mine.grid || mine.hazardsPlaced) return;
  mine.hazardsPlaced = true;
  /** @param {'gas'|'water'} flag @param {number} n @param {number} minDepth */
  const put = (flag, n, minDepth) => {
    let placed = 0;
    for (let tries = 0; tries < 300 && placed < n; tries++) {
      const r = minDepth + Math.floor(rnd() * (MINE.rows - minDepth));
      const c = 2 + Math.floor(rnd() * (MINE.cols - 3));
      const t = mine.grid[r] && mine.grid[r][c];
      if (!t || t.revealed || (t.type !== 'dirt' && t.type !== 'stone') || t.relic || t.gas || t.water) continue;
      t[flag] = true;
      placed++;
    }
  };
  put('gas', GAS_PER_MINE, 4);
  put('water', WATER_PER_MINE, 3);
}

/** @param {any} mine @param {number} r @param {number} c @param {number} rad */
function around(mine, r, c, rad) {
  /** @type {{t:any, r:number, c:number}[]} */
  const out = [];
  for (let dr = -rad; dr <= rad; dr++) {
    for (let dc = -rad; dc <= rad; dc++) {
      const t = mine.grid[r + dr] && mine.grid[r + dr][c + dc];
      if (t) out.push({ t, r: r + dr, c: c + dc });
    }
  }
  return out;
}

/**
 * Grisu cavado na picareta: explode (abre os blocos ao redor) e fere um minerador
 * se houver algum trabalhando perto.
 * @param {any} mine @param {number} r @param {number} c
 * @returns {{ injured: boolean }}
 */
export function explodeGas(mine, r, c) {
  let nearby = false;
  for (const { t } of around(mine, r, c, 2)) {
    if (t.worker) { t.worker = false; nearby = true; }
  }
  for (const { t, r: rr, c: cc } of around(mine, r, c, 1)) {
    if (t.type === 'dirt' || t.type === 'stone') {
      mine.grid[rr][cc] = { type: 'air', resource: null, amount: 0, revealed: true, worker: false };
    }
    t.gas = false;
  }
  for (const { t } of around(mine, r, c, 2)) t.revealed = true;
  if (nearby && state.workersTotal > 1) {
    state.workersTotal--;
    state.approval = Math.max(state.approvalFloor || 0, (state.approval || 0) - 3);
    log('💥 Explosão de grisu! Um mineiro ferido voltou para casa (−1 trabalhador, −3 aprovação). Dinamite queima o gás com segurança.', 'bad');
    return { injured: true };
  }
  log('💥 Explosão de grisu! Ninguém por perto, por sorte.', 'bad');
  return { injured: false };
}

/** Lençol d'água: inunda os túneis num raio 2. @param {any} mine @param {number} r @param {number} c */
export function floodAround(mine, r, c) {
  for (const { t } of around(mine, r, c, 2)) {
    if (t.type === 'air') t.flood = FLOOD_TIME;
    t.water = false;
  }
  log(`💧 Lençol d'água! Os túneis próximos ficaram inundados por ${FLOOD_TIME}s.`, 'bad');
}

/** Minerador está com água em volta (não produz)? @param {any} mine @param {number} r @param {number} c */
export function isFlooded(mine, r, c) {
  for (const [dr, dc] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const t = mine.grid[r + dr] && mine.grid[r + dr][c + dc];
    if (t && t.flood > 0) return true;
  }
  return false;
}
