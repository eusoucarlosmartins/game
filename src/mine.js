// mine.js — sistema de mina em grid 2D com fog of war e ferramentas
import { state, log } from './state.js';
import { R, DEPOSIT_TYPES, MINE, TOOLS, SILO_DEFAULT_CAP, WORKER_COST } from './data.js';
import { irand } from './util.js';
import { mineRateMul, currentEra, eraData } from './progression.js';
import { play } from './audio.js';

export function isResourceUnlocked(resource) {
  return eraData(currentEra()).deposits.includes(resource);
}

// ----- Geração inicial do grid -----
export function initMine() {
  const grid = [];
  for (let r = 0; r < MINE.rows; r++) {
    const row = [];
    for (let c = 0; c < MINE.cols; c++) {
      const roll = Math.random();
      const type = roll < 0.18 ? 'stone' : 'dirt';
      row.push({ type, resource: null, amount: 0, revealed: false, worker: false });
    }
    grid.push(row);
  }
  placeOreVeins(grid);
  // Túnel inicial: 5 colunas no topo central já cavadas + 1 veio coal + 1 veio iron expostos
  const cc = Math.floor(MINE.cols / 2);
  for (let c = cc - 2; c <= cc + 2; c++) grid[0][c] = airTile(true);
  grid[1][cc] = airTile(true);
  grid[1][cc - 1] = oreTile('coal', 25, true);
  grid[1][cc + 1] = oreTile('iron_ore', 25, true);
  revealAround(grid, 0, cc, 2);
  revealAround(grid, 1, cc, 1);
  state.mine.grid = grid;
}

function airTile(revealed) {
  return { type: 'air', resource: null, amount: 0, revealed: !!revealed, worker: false };
}
function oreTile(resource, amount, revealed) {
  return { type: 'ore', resource, amount, revealed: !!revealed, worker: false };
}

function placeOreVeins(grid) {
  // Distribui veias de cada recurso. Mais raros = mais fundo + menos veias.
  for (const dep of DEPOSIT_TYPES) {
    const cost = dep.cost;
    let veinCount, minDepth, veinSize;
    if (cost === 0)            { veinCount = 6; minDepth = 1;  veinSize = 5; }
    else if (cost < 200)       { veinCount = 6; minDepth = 1;  veinSize = 5; }
    else if (cost < 500)       { veinCount = 4; minDepth = 4;  veinSize = 4; }
    else if (cost < 1000)      { veinCount = 3; minDepth = 6;  veinSize = 3; }
    else                       { veinCount = 2; minDepth = 8;  veinSize = 3; }
    for (let v = 0; v < veinCount; v++) {
      const sr = irand(minDepth, MINE.rows - 1);
      const sc = irand(1, MINE.cols - 2);
      carveVein(grid, sr, sc, dep.id, veinSize);
    }
  }
}

// Conta tiles de minério revelados (mas ainda não totalmente cavados) por recurso
export function getRevealedOreCounts() {
  const counts = {};
  if (!state.mine.grid) return counts;
  for (let r = 0; r < MINE.rows; r++) {
    for (let c = 0; c < MINE.cols; c++) {
      const t = state.mine.grid[r][c];
      if (t.revealed && t.type === 'ore') {
        counts[t.resource] = (counts[t.resource] || 0) + 1;
      }
    }
  }
  return counts;
}

function carveVein(grid, r, c, resource, size) {
  let placed = 0, cr = r, cc = c, tries = 0;
  while (placed < size && tries < 40) {
    tries++;
    if (cr >= 0 && cr < MINE.rows && cc >= 0 && cc < MINE.cols) {
      const t = grid[cr][cc];
      if (t.type === 'dirt' || t.type === 'stone') {
        grid[cr][cc] = oreTile(resource, irand(20, 45), false);
        placed++;
      }
    }
    const d = irand(0, 3);
    cr += [-1, 0, 1, 0][d];
    cc += [0, 1, 0, -1][d];
  }
}

function revealAround(grid, r, c, radius) {
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      const nr = r + dr, nc = c + dc;
      if (Math.abs(dr) + Math.abs(dc) > radius) continue;
      if (nr < 0 || nr >= MINE.rows || nc < 0 || nc >= MINE.cols) continue;
      grid[nr][nc].revealed = true;
    }
  }
}

// ----- Acesso ao grid -----
function tileAt(r, c) {
  if (!state.mine.grid) return null;
  if (r < 0 || r >= MINE.rows || c < 0 || c >= MINE.cols) return null;
  return state.mine.grid[r][c];
}

function hasAdjacentAir(r, c) {
  if (r === 0) return true; // primeira linha é adjacente à superfície
  for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    const t = tileAt(r + dr, c + dc);
    if (t && t.type === 'air') return true;
  }
  return false;
}

// ----- Ações do jogador -----
export function tryDigClick(r, c) {
  const t = tileAt(r, c);
  if (!t || !t.revealed) return;
  if (t.type === 'air') return;
  if (!hasAdjacentAir(r, c)) return;
  let cost = 0;
  if (t.type === 'dirt') cost = TOOLS.pick.costDirt;
  else if (t.type === 'stone') cost = TOOLS.pick.costStone;
  else if (t.type === 'ore') cost = TOOLS.pick.costOre;
  if (state.money < cost) { log('Dinheiro insuficiente para cavar.', 'bad'); return; }
  state.money -= cost;
  digTile(r, c);
}

function digTile(r, c) {
  const t = tileAt(r, c);
  if (!t) return;
  if (t.type === 'dirt' || t.type === 'stone') {
    state.mine.grid[r][c] = airTile(true);
    state.tilesDug++;
  } else if (t.type === 'ore') {
    // Ore fica acessível para mineração — não vira ar
    t.revealed = true;
  }
  revealAround(state.mine.grid, r, c, 1);
  play('pickaxe');
}

export function tryTNT(r, c) {
  if (state.money < TOOLS.tnt.costPerUse) { log('Sem dinheiro para a Dinamite.', 'bad'); return; }
  state.money -= TOOLS.tnt.costPerUse;
  const radius = TOOLS.tnt.radius;
  let dug = 0, oreCollected = 0;
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      const nr = r + dr, nc = c + dc;
      const t = tileAt(nr, nc);
      if (!t) continue;
      if (t.type === 'dirt' || t.type === 'stone') {
        state.mine.grid[nr][nc] = airTile(true);
        dug++;
      } else if (t.type === 'ore') {
        const grab = Math.floor(t.amount * 0.7);
        if (grab > 0) oreCollected += tryAddToSilo(t.resource, grab);
        state.mine.grid[nr][nc] = airTile(true);
        dug++;
      }
    }
  }
  revealAround(state.mine.grid, r, c, radius + 1);
  state.tilesDug += dug;
  log(`Dinamite: ${dug} tiles. ${oreCollected > 0 ? '+' + oreCollected + ' de minério.' : ''}`, 'good');
  state.mine.tntFx = { r, c, t: 0.8 };
  play('boom');
}

export function tryCompass(r, c) {
  if (state.money < TOOLS.compass.costPerUse) { log('Sem dinheiro para a Bússola.', 'bad'); return; }
  state.money -= TOOLS.compass.costPerUse;
  revealAround(state.mine.grid, r, c, TOOLS.compass.radius);
  log(`Bússola: área revelada (raio ${TOOLS.compass.radius}).`, 'good');
  play('whoosh');
}

export function tryPlaceWorker(r, c) {
  const t = tileAt(r, c);
  if (!t || !t.revealed) return;
  if (t.type !== 'ore') { log('Só pode alocar minerador em veio descoberto.', 'bad'); return; }
  if (t.worker) {
    t.worker = false;
    log('Minerador retirado.');
    return;
  }
  if (!isResourceUnlocked(t.resource)) {
    log(`Era atual não permite extrair ${R[t.resource].name}. Avance de era primeiro.`, 'bad');
    return;
  }
  if (workersAvailable() <= 0) { log('Sem mineradores disponíveis. Contrate mais.', 'bad'); return; }
  t.worker = true;
  log(`Minerador alocado em ${R[t.resource].name}.`);
  play('click');
}

export function workersAvailable() {
  return state.workersTotal - workersActive();
}
export function workersActive() {
  if (!state.mine.grid) return 0;
  let n = 0;
  for (let r = 0; r < MINE.rows; r++) {
    for (let c = 0; c < MINE.cols; c++) {
      if (state.mine.grid[r][c].worker) n++;
    }
  }
  return n;
}

export function tryHireWorker() {
  if (state.money < WORKER_COST) return;
  state.money -= WORKER_COST;
  state.workersTotal++;
  log(`Minerador contratado. Total: ${state.workersTotal}.`);
  play('coin');
}

export function setTool(toolId) {
  if (!TOOLS[toolId]) return;
  state.mine.tool = toolId;
}

// ----- Silos -----
export function tryAddToSilo(resource, amount) {
  if (!R[resource] || R[resource].free) return 0;
  const cap = (state.silos[resource] && state.silos[resource].cap) || SILO_DEFAULT_CAP;
  const space = Math.max(0, cap - (state.warehouse[resource] || 0));
  const add = Math.min(amount, space);
  state.warehouse[resource] = (state.warehouse[resource] || 0) + add;
  return add;
}

// ----- Simulação por tick -----
export function updateMine(dt) {
  if (!state.mine.grid) return;
  const rate = 0.6 * mineRateMul();
  for (let r = 0; r < MINE.rows; r++) {
    for (let c = 0; c < MINE.cols; c++) {
      const t = state.mine.grid[r][c];
      if (!t.worker) continue;
      if (t.type !== 'ore') { t.worker = false; continue; }
      if (t.amount <= 0) continue;
      const take = Math.min(rate * dt, t.amount);
      const added = tryAddToSilo(t.resource, take);
      t.amount -= added;
      if (t.amount <= 0.05) {
        state.mine.grid[r][c] = airTile(true);
        state.tilesDug++;
      }
    }
  }
  if (state.mine.tntFx) {
    state.mine.tntFx.t -= dt;
    if (state.mine.tntFx.t <= 0) state.mine.tntFx = null;
  }
}
