// mine.js — múltiplas minas com grid próprio, fog of war, ferramentas,
// poço de elevador animado e depleção de recursos.
import { state, log } from './state.js';
import { R, DEPOSIT_TYPES, MINE, TOOLS, SILO_DEFAULT_CAP, WORKER_COST, MINE_CATALOG } from './data.js';
import { irand, fmtMoney } from './util.js';
import { mineRateMul, currentEra, eraData } from './progression.js';
import { play } from './audio.js';

export function isResourceUnlocked(resource) {
  return eraData(currentEra()).deposits.includes(resource);
}

// ----- Setup das minas no boot -----
export function initMines() {
  // Cria automaticamente todas as minas com cost=0 (iniciais)
  state.mines = MINE_CATALOG
    .filter((c) => c.cost === 0)
    .map((c) => createMineFromCatalog(c));
  state.activeMineIdx = 0;
}

function createMineFromCatalog(catalog) {
  const mine = {
    id: catalog.id,
    name: catalog.name,
    grid: [],
    tntFx: null,
    exhausted: false,
    elevator: { y: 0, dir: 1 },
  };
  buildMineGrid(mine, catalog.oreBias);
  return mine;
}

// ----- Compra de novas minas -----
export function buyMine(catalogId) {
  const catalog = MINE_CATALOG.find((c) => c.id === catalogId);
  if (!catalog) return;
  if (isMineOwned(catalogId)) return;
  if (state.money < catalog.cost) {
    log(`Sem dinheiro pra abrir ${catalog.name}.`, 'bad');
    return;
  }
  if (currentEra() < catalog.eraReq) {
    log(`${catalog.name} requer era ${catalog.eraReq}.`, 'bad');
    return;
  }
  state.money -= catalog.cost;
  state.mines.push(createMineFromCatalog(catalog));
  log(`✨ Nova mina aberta: ${catalog.name} por ${fmtMoney(catalog.cost)}.`, 'good');
  play('success');
}

export function isMineOwned(catalogId) {
  return state.mines.some((m) => m.id === catalogId);
}

export function canBuyMine(catalogId) {
  const catalog = MINE_CATALOG.find((c) => c.id === catalogId);
  if (!catalog) return false;
  if (isMineOwned(catalogId)) return false;
  if (state.money < catalog.cost) return false;
  if (currentEra() < catalog.eraReq) return false;
  return true;
}

export function getMineCatalog() {
  return MINE_CATALOG;
}

function buildMineGrid(mine, oreBias) {
  mine.grid = [];
  for (let r = 0; r < MINE.rows; r++) {
    const row = [];
    // Col 0 é o POÇO DO ELEVADOR (não diggable, sempre revelado)
    row.push({ type: 'shaft', resource: null, amount: 0, revealed: true, worker: false });
    for (let c = 1; c < MINE.cols; c++) {
      const roll = Math.random();
      const type = roll < 0.18 ? 'stone' : 'dirt';
      row.push({ type, resource: null, amount: 0, revealed: false, worker: false });
    }
    mine.grid.push(row);
  }
  placeOreVeins(mine.grid, oreBias);
  // Túnel inicial: 5 colunas no topo central já cavadas + 2 veios expostos
  const cc = Math.floor(MINE.cols / 2);
  for (let c = cc - 2; c <= cc + 2; c++) mine.grid[0][c] = airTile(true);
  mine.grid[1][cc] = airTile(true);
  mine.grid[1][cc - 1] = oreTile('coal', 25, true);
  mine.grid[1][cc + 1] = oreTile('iron_ore', 25, true);
  revealAround(mine.grid, 0, cc, 2);
  revealAround(mine.grid, 1, cc, 1);
}

function airTile(revealed) {
  return { type: 'air', resource: null, amount: 0, revealed: !!revealed, worker: false };
}
function oreTile(resource, amount, revealed) {
  return { type: 'ore', resource, amount, revealed: !!revealed, worker: false };
}

function placeOreVeins(grid, oreBias) {
  for (const dep of DEPOSIT_TYPES) {
    const cost = dep.cost;
    let veinCount, minDepth, veinSize;
    if (cost === 0)            { veinCount = 6; minDepth = 1;  veinSize = 5; }
    else if (cost < 200)       { veinCount = 6; minDepth = 1;  veinSize = 5; }
    else if (cost < 500)       { veinCount = 4; minDepth = 4;  veinSize = 4; }
    else if (cost < 1000)      { veinCount = 3; minDepth = 6;  veinSize = 3; }
    else                       { veinCount = 2; minDepth = 8;  veinSize = 3; }
    // Aplica viés regional: minérios "biased" dobram e ficam mais rasos;
    // outros minérios pagos reduzem pela metade.
    if (oreBias && oreBias.length > 0) {
      if (oreBias.includes(dep.id)) {
        veinCount = Math.floor(veinCount * 2);
        minDepth = Math.max(1, minDepth - 2);
      } else if (cost > 0) {
        veinCount = Math.max(1, Math.floor(veinCount * 0.45));
      }
    }
    for (let v = 0; v < veinCount; v++) {
      const sr = irand(minDepth, MINE.rows - 1);
      const sc = irand(2, MINE.cols - 2);
      carveVein(grid, sr, sc, dep.id, veinSize);
    }
  }
}

function carveVein(grid, r, c, resource, size) {
  let placed = 0, cr = r, cc = c, tries = 0;
  while (placed < size && tries < 40) {
    tries++;
    // Nunca escreve sobre o poço (col 0)
    if (cr >= 0 && cr < MINE.rows && cc >= 1 && cc < MINE.cols) {
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
export function activeMine() {
  return state.mines[state.activeMineIdx] || null;
}

export function setActiveMine(idx) {
  if (idx < 0 || idx >= state.mines.length) return;
  state.activeMineIdx = idx;
}

function tileAt(grid, r, c) {
  if (!grid) return null;
  if (r < 0 || r >= MINE.rows || c < 0 || c >= MINE.cols) return null;
  return grid[r][c];
}

function hasAdjacentAir(grid, r, c) {
  if (r === 0) return true; // borda superior conta como adjacente
  for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    const t = tileAt(grid, r + dr, c + dc);
    if (t && (t.type === 'air' || t.type === 'shaft')) return true;
  }
  return false;
}

// ----- Ações do jogador -----
export function tryDigClick(r, c) {
  const mine = activeMine();
  if (!mine || !mine.grid) return;
  const t = tileAt(mine.grid, r, c);
  if (!t || !t.revealed) return;
  if (t.type === 'air' || t.type === 'shaft') return;
  if (!hasAdjacentAir(mine.grid, r, c)) return;
  let cost = 0;
  if (t.type === 'dirt') cost = TOOLS.pick.costDirt;
  else if (t.type === 'stone') cost = TOOLS.pick.costStone;
  else if (t.type === 'ore') cost = TOOLS.pick.costOre;
  if (state.money < cost) { log('Dinheiro insuficiente para cavar.', 'bad'); return; }
  state.money -= cost;
  digTile(mine.grid, r, c);
}

function digTile(grid, r, c) {
  const t = tileAt(grid, r, c);
  if (!t) return;
  if (t.type === 'dirt' || t.type === 'stone') {
    grid[r][c] = airTile(true);
    state.tilesDug++;
  } else if (t.type === 'ore') {
    t.revealed = true;
  }
  revealAround(grid, r, c, 1);
  play('pickaxe');
}

export function tryTNT(r, c) {
  const mine = activeMine();
  if (!mine || !mine.grid) return;
  if (state.money < TOOLS.tnt.costPerUse) { log('Sem dinheiro para a Dinamite.', 'bad'); return; }
  state.money -= TOOLS.tnt.costPerUse;
  const radius = TOOLS.tnt.radius;
  let dug = 0, oreCollected = 0;
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      const nr = r + dr, nc = c + dc;
      const t = tileAt(mine.grid, nr, nc);
      if (!t || t.type === 'shaft') continue;
      if (t.type === 'dirt' || t.type === 'stone') {
        mine.grid[nr][nc] = airTile(true);
        dug++;
      } else if (t.type === 'ore') {
        const grab = Math.floor(t.amount * 0.7);
        if (grab > 0) oreCollected += tryAddToSilo(t.resource, grab);
        mine.grid[nr][nc] = airTile(true);
        dug++;
      }
    }
  }
  revealAround(mine.grid, r, c, radius + 1);
  state.tilesDug += dug;
  log(`Dinamite: ${dug} tiles. ${oreCollected > 0 ? '+' + oreCollected + ' de minério.' : ''}`, 'good');
  mine.tntFx = { r, c, t: 0.8 };
  play('boom');
}

export function tryCompass(r, c) {
  const mine = activeMine();
  if (!mine || !mine.grid) return;
  if (state.money < TOOLS.compass.costPerUse) { log('Sem dinheiro para a Bússola.', 'bad'); return; }
  state.money -= TOOLS.compass.costPerUse;
  revealAround(mine.grid, r, c, TOOLS.compass.radius);
  log(`Bússola: área revelada (raio ${TOOLS.compass.radius}).`, 'good');
  play('whoosh');
}

export function tryPlaceWorker(r, c) {
  const mine = activeMine();
  if (!mine || !mine.grid) return;
  const t = tileAt(mine.grid, r, c);
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
  log(`[${mine.name}] Minerador alocado em ${R[t.resource].name}.`);
  play('click');
  if (state.tutorial && !state.tutorial.dismissed && state.tutorial.step === 1) {
    state.tutorial.step = 2;
  }
}

// Itera TODAS as minas (workers de minas inativas também produzem)
export function workersAvailable() {
  return state.workersTotal - workersActive();
}
export function workersActive() {
  let n = 0;
  for (const mine of (state.mines || [])) {
    if (!mine.grid) continue;
    for (let r = 0; r < MINE.rows; r++) {
      for (let c = 0; c < MINE.cols; c++) {
        if (mine.grid[r][c].worker) n++;
      }
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
  state.tool = toolId;
}

// ----- Silos -----
export function tryAddToSilo(resource, amount) {
  if (!R[resource] || R[resource].free) return 0;
  const cap = (state.silos[resource] && state.silos[resource].cap) || SILO_DEFAULT_CAP;
  const space = Math.max(0, cap - (state.warehouse[resource] || 0));
  const add = Math.min(amount, space);
  if (add > 0) {
    state.warehouse[resource] = (state.warehouse[resource] || 0) + add;
    // estatística global
    if (!state.oreMined) state.oreMined = {};
    state.oreMined[resource] = (state.oreMined[resource] || 0) + add;
  }
  return add;
}

// ----- Regenerar mina esgotada -----
export function regenCost(mineId) {
  const cat = MINE_CATALOG.find((c) => c.id === mineId);
  if (!cat) return 800;
  return Math.max(500, Math.floor((cat.cost || 0) * 0.5) || 500);
}

export function regenerateMine(idx) {
  const mine = state.mines[idx];
  if (!mine || !mine.exhausted) return;
  const cost = regenCost(mine.id);
  if (state.money < cost) { log(`Sem dinheiro para regenerar ${mine.name}.`, 'bad'); return; }
  const catalog = MINE_CATALOG.find((c) => c.id === mine.id);
  if (!catalog) return;
  state.money -= cost;
  buildMineGrid(mine, catalog.oreBias);
  mine.exhausted = false;
  mine.tntFx = null;
  log(`✨ ${mine.name} regenerada por ${fmtMoney(cost)}.`, 'good');
  play('success');
}

// ----- Simulação por tick -----
export function updateMine(dt) {
  const rate = 0.6 * mineRateMul();
  for (const mine of (state.mines || [])) {
    if (!mine.grid) continue;
    updateSingleMine(mine, dt, rate);
  }
}

function updateSingleMine(mine, dt, rate) {
  // Produção dos workers
  for (let r = 0; r < MINE.rows; r++) {
    for (let c = 0; c < MINE.cols; c++) {
      const t = mine.grid[r][c];
      if (!t.worker) continue;
      if (t.type !== 'ore') { t.worker = false; continue; }
      if (t.amount <= 0) continue;
      const take = Math.min(rate * dt, t.amount);
      const added = tryAddToSilo(t.resource, take);
      t.amount -= added;
      if (t.amount <= 0.05) {
        mine.grid[r][c] = airTile(true);
        state.tilesDug++;
      }
    }
  }
  // FX da dinamite
  if (mine.tntFx) {
    mine.tntFx.t -= dt;
    if (mine.tntFx.t <= 0) mine.tntFx = null;
  }
  // Animação do elevador (vai-e-vem na vertical)
  if (mine.elevator) {
    mine.elevator.y += mine.elevator.dir * 0.18 * dt;
    if (mine.elevator.y >= 1) { mine.elevator.y = 1; mine.elevator.dir = -1; }
    if (mine.elevator.y <= 0) { mine.elevator.y = 0; mine.elevator.dir = 1; }
  }
  // Checa esgotamento (transição: avisa quando esgota)
  const wasExhausted = mine.exhausted;
  mine.exhausted = isMineExhausted(mine);
  if (!wasExhausted && mine.exhausted) {
    log(`⚠ ${mine.name} esgotada! Veja outras minas no mapa.`, 'bad');
    play('fail');
  }
}

function isMineExhausted(mine) {
  for (let r = 0; r < MINE.rows; r++) {
    for (let c = 0; c < MINE.cols; c++) {
      if (mine.grid[r][c].type === 'ore') return false;
    }
  }
  return true;
}

// ----- Helpers para UI -----
export function getRevealedOreCounts() {
  const mine = activeMine();
  const counts = {};
  if (!mine || !mine.grid) return counts;
  for (let r = 0; r < MINE.rows; r++) {
    for (let c = 0; c < MINE.cols; c++) {
      const t = mine.grid[r][c];
      if (t.revealed && t.type === 'ore') {
        counts[t.resource] = (counts[t.resource] || 0) + 1;
      }
    }
  }
  return counts;
}
