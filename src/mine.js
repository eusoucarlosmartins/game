// mine.js — múltiplas minas com grid próprio, fog of war, ferramentas,
// poço de elevador animado e depleção de recursos.
import { state, log } from './state.js';
import { R, DEPOSIT_TYPES, MINE, TOOLS, SILO_DEFAULT_CAP, WORKER_COST, MINE_CATALOG } from './data.js';
import { irand, fmtMoney } from './util.js';
import { mineRateMul, currentEra, eraData } from './progression.js';
import { play } from './audio.js';
import { spawnBurst, spawnDust } from './particles.js';
import {
  checkMineAchievements, checkMineCountAchievements,
  checkExhaustionAchievement, checkRegenerationAchievement, checkTntAchievement,
} from './achievements.js';
import { ensureWorkers, takeIdleWorker, getWorker, makeWorker } from './workers.js';

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

// Profundidade inicial do poço de uma mina nova (rows). Player extende manual.
export const INITIAL_SHAFT_DEPTH = 6;
// Custo por linha pra estender o poço: $30 + depth atual × $5
export function shaftExtendCost(currentDepth) {
  return 30 + currentDepth * 5;
}
// Custo pra construir um poço novo numa coluna virgem (5 linhas iniciais)
export const NEW_SHAFT_COST = 1500;
// Custo pra upgrade de velocidade do elevador (multiplica extração)
export function shaftSpeedUpgradeCost(level) {
  return 400 * (level + 1);
}
export const MAX_SHAFT_SPEED_LV = 5;
// Multiplicador de extração por nível (cada level = +20%)
export function shaftSpeedMul(mine) {
  return 1 + (mine.speedLv || 0) * 0.2;
}

function createMineFromCatalog(catalog, shaftCol = 0) {
  const mine = {
    id: catalog.id,
    name: catalog.name,
    grid: [],
    tntFx: null,
    exhausted: false,
    elevator: { y: 0, dir: 1 },
    shafts: [{ col: shaftCol, depth: INITIAL_SHAFT_DEPTH }],
    speedLv: 0,
  };
  buildMineGrid(mine, catalog.oreBias);
  return mine;
}

// Migração: garante que minas antigas (saves pré-shafts) tenham a estrutura.
// Saves antigos têm coluna 0 inteira como shaft → depth = MINE.rows pra
// preservar comportamento.
export function migrateMineShafts(mine) {
  if (!mine) return;
  if (!Array.isArray(mine.shafts)) {
    mine.shafts = [{ col: 0, depth: MINE.rows }];
  }
  if (typeof mine.speedLv !== 'number') mine.speedLv = 0;
}

// ----- Compra de novas minas -----
export function buyMine(catalogId, shaftCol = 0) {
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
  // Sanitiza coluna (0..cols-1)
  const safeCol = Math.max(0, Math.min(MINE.cols - 1, Number(shaftCol) || 0));
  state.money -= catalog.cost;
  state.mines.push(createMineFromCatalog(catalog, safeCol));
  log(`✨ Nova mina aberta: ${catalog.name} por ${fmtMoney(catalog.cost)}.`, 'good');
  play('success');
  checkMineCountAchievements();
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
  // Determina colunas de poço e profundidade de cada um
  const shaftMap = {}; // col → depth
  for (const s of (mine.shafts || [{ col: 0, depth: MINE.rows }])) {
    shaftMap[s.col] = Math.max(shaftMap[s.col] || 0, s.depth);
  }
  for (let r = 0; r < MINE.rows; r++) {
    const row = [];
    for (let c = 0; c < MINE.cols; c++) {
      const shaftDepth = shaftMap[c];
      if (shaftDepth !== undefined && r < shaftDepth) {
        // Tile do poço — sempre revelado, não diggable
        row.push({ type: 'shaft', resource: null, amount: 0, revealed: true, worker: false });
      } else {
        const roll = Math.random();
        const type = roll < 0.18 ? 'stone' : 'dirt';
        row.push({ type, resource: null, amount: 0, revealed: false, worker: false });
      }
    }
    mine.grid.push(row);
  }
  placeOreVeins(mine.grid, oreBias);
  // Túnel inicial: a partir do PRIMEIRO poço (geralmente col 0), abre um túnel
  // horizontal de 4 tiles e coloca 2 veios essenciais pra orientar o jogador.
  const firstShaft = mine.shafts && mine.shafts[0];
  if (firstShaft) {
    const sc = firstShaft.col;
    // Túnel horizontal saindo do shaft (pra direita se col<cols-5, senão esquerda)
    const dir = sc < MINE.cols - 5 ? 1 : -1;
    for (let i = 1; i <= 4; i++) {
      const c = sc + dir * i;
      if (c >= 0 && c < MINE.cols) mine.grid[0][c] = airTile(true);
    }
    const c2 = sc + dir * 2, c3 = sc + dir * 3;
    if (c2 >= 0 && c2 < MINE.cols) mine.grid[1][c2] = oreTile('coal', 25, true);
    if (c3 >= 0 && c3 < MINE.cols) mine.grid[1][c3] = oreTile('iron_ore', 25, true);
    revealAround(mine.grid, 0, sc + dir * 2, 3);
    revealAround(mine.grid, 1, sc + dir * 3, 2);
  }
}

function airTile(revealed) {
  return { type: 'air', resource: null, amount: 0, revealed: !!revealed, worker: false };
}
function oreTile(resource, amount, revealed) {
  return { type: 'ore', resource, amount, revealed: !!revealed, worker: false };
}

// Recursos "essenciais" usados em quase toda receita ao longo das eras —
// coal entra em todo smelt, iron_ore alimenta toda a cadeia do aço, wood
// vira tábua + componentes. Recebem boost adicional pra nunca faltarem.
const ESSENTIAL_DEPOSITS = {
  coal:     { veinCount: 20, minDepth: 1, veinSize: 6 },
  iron_ore: { veinCount: 16, minDepth: 1, veinSize: 6 },
  wood:     { veinCount: 12, minDepth: 2, veinSize: 5 },
};

function placeOreVeins(grid, oreBias) {
  for (const dep of DEPOSIT_TYPES) {
    const cost = dep.cost;
    let veinCount, minDepth, veinSize;
    // Essenciais (coal/iron/wood) têm contagem fixa generosa.
    if (ESSENTIAL_DEPOSITS[dep.id]) {
      ({ veinCount, minDepth, veinSize } = ESSENTIAL_DEPOSITS[dep.id]);
    } else if (cost < 200)     { veinCount = 7;  minDepth = 2;  veinSize = 5; }
    else if (cost < 500)       { veinCount = 6;  minDepth = 10; veinSize = 5; }
    else if (cost < 1000)      { veinCount = 5;  minDepth = 20; veinSize = 4; }
    else                       { veinCount = 4;  minDepth = 32; veinSize = 4; }
    // Aplica viés regional: minérios "biased" dobram e ficam mais rasos;
    // outros minérios pagos reduzem pela metade.
    if (oreBias && oreBias.length > 0) {
      if (oreBias.includes(dep.id)) {
        veinCount = Math.floor(veinCount * 2);
        minDepth = Math.max(1, minDepth - 2);
      } else if (cost > 0 && !ESSENTIAL_DEPOSITS[dep.id]) {
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

// BFS a partir dos tiles 'shaft' (poço do elevador), expandindo só por
// air/shaft. Retorna matriz booleana de "conectado ao elevador".
// O minério só pode ser extraído de tiles cujo VIZINHO está conectado.
export function computeConnectivity(grid) {
  const { rows, cols } = MINE;
  const reached = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const queue = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] && grid[r][c].type === 'shaft') {
        reached[r][c] = true;
        queue.push([r, c]);
      }
    }
  }
  let head = 0;
  while (head < queue.length) {
    const [r, c] = queue[head++];
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (reached[nr][nc]) continue;
      const t = grid[nr][nc];
      if (t && (t.type === 'air' || t.type === 'shaft')) {
        reached[nr][nc] = true;
        queue.push([nr, nc]);
      }
    }
  }
  return reached;
}

// Tile é "minerável" se tem algum vizinho conectado ao elevador.
function isOreReachable(mine, r, c) {
  const reached = mine._connectivity;
  if (!reached) return true; // fallback se ainda não computado
  const { rows, cols } = MINE;
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
    if (reached[nr][nc]) return true;
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
  // Atalho amigável: clicou num veio sem worker com a picareta? Redireciona
  // pra alocar minerador (ação esperada do jogador).
  if (t.type === 'ore' && !t.worker) {
    tryPlaceWorker(r, c);
    return;
  }
  let cost = 0;
  if (t.type === 'dirt') cost = TOOLS.pick.costDirt;
  else if (t.type === 'stone') cost = TOOLS.pick.costStone;
  else if (t.type === 'ore') cost = TOOLS.pick.costOre;
  else if (t.type === 'water') cost = 20; // bombear água
  else if (t.type === 'gas') cost = 40;   // ventilar gás
  if (state.money < cost) { log('Dinheiro insuficiente para cavar.', 'bad'); return; }
  state.money -= cost;
  digTile(mine.grid, r, c);
}

function digTile(grid, r, c) {
  const t = tileAt(grid, r, c);
  if (!t) return;
  const cx = MINE.x + (c + 0.5) * MINE.cell;
  const cy = MINE.y + (r + 0.5) * MINE.cell;
  if (t.type === 'dirt' || t.type === 'stone') {
    grid[r][c] = airTile(true);
    state.tilesDug++;
    spawnDust(cx, cy, 'mine');
  } else if (t.type === 'ore') {
    t.revealed = true;
    spawnBurst(cx, cy, 6, '255,212,74', 'mine');
  } else if (t.type === 'water') {
    // Bombear: vira air, partículas azuis
    grid[r][c] = airTile(true);
    spawnBurst(cx, cy, 10, '80,140,200', 'mine');
  } else if (t.type === 'gas') {
    // Ventilar: vira air, partículas amareladas
    grid[r][c] = airTile(true);
    spawnBurst(cx, cy, 12, '220,200,80', 'mine');
  }
  revealAround(grid, r, c, 1);
  play('pickaxe');
}

export function tryTNT(r, c) {
  const mine = activeMine();
  if (!mine || !mine.grid) return;
  // TNT só funciona se o centro estiver conectado ao elevador (ou for adjacente)
  if (!mine._connectivity) mine._connectivity = computeConnectivity(mine.grid);
  const centerConnected = mine._connectivity[r] && mine._connectivity[r][c];
  if (!centerConnected && !isOreReachable(mine, r, c)) {
    log('TNT só funciona em locais já conectados ao elevador por um túnel.', 'bad');
    return;
  }
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
  // Explosão visual: 30 sparks vermelho-laranja partindo do centro
  const px = MINE.x + (c + 0.5) * MINE.cell;
  const py = MINE.y + (r + 0.5) * MINE.cell;
  spawnBurst(px, py, 30, '255,120,40', 'mine');
  spawnBurst(px, py, 16, '255,220,80', 'mine');
  state.tntUses = (state.tntUses || 0) + 1;
  checkTntAchievement();
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
    // Retirar: encontra o worker pelo id armazenado no tile
    const w = getWorker(t.worker);
    t.worker = false;
    log(`Minerador retirado${w ? ` (${w.name})` : ''}.`);
    return;
  }
  if (!isResourceUnlocked(t.resource)) {
    log(`Era atual não permite extrair ${R[t.resource].name}. Avance de era primeiro.`, 'bad');
    return;
  }
  if (!mine._connectivity) mine._connectivity = computeConnectivity(mine.grid);
  if (!isOreReachable(mine, r, c)) {
    log('Cave um túnel a partir do elevador até este veio antes de alocar o minerador.', 'bad');
    return;
  }
  ensureWorkers();
  const free = takeIdleWorker();
  if (!free) { log('Sem mineradores disponíveis. Contrate mais.', 'bad'); return; }
  t.worker = free.id;
  log(`[${mine.name}] ${free.name} (skill ${free.skill}×) alocado em ${R[t.resource].name}.`);
  play('click');
  if (state.tutorial && !state.tutorial.dismissed && state.tutorial.step === 1) {
    state.tutorial.step = 2;
  }
}

// Itera TODAS as minas (workers de minas inativas também produzem)
export function workersAvailable() {
  ensureWorkers();
  return state.workers.length - workersActive();
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

// ----- Operações do elevador -----
// Estende o poço (shaftIdx) em 1 row, pagando o custo escalonado
export function tryExtendShaft(shaftIdx) {
  const mine = activeMine();
  if (!mine || !mine.shafts) return false;
  const s = mine.shafts[shaftIdx];
  if (!s) return false;
  if (s.depth >= MINE.rows) {
    log('Poço já atingiu o fundo da mina.', 'bad');
    return false;
  }
  const cost = shaftExtendCost(s.depth);
  if (state.money < cost) {
    log(`Sem dinheiro pra estender o poço ($${cost}).`, 'bad');
    return false;
  }
  state.money -= cost;
  // Converte o tile no topo do "fundo" pra shaft tile
  const r = s.depth, c = s.col;
  if (mine.grid[r] && mine.grid[r][c]) {
    mine.grid[r][c] = { type: 'shaft', resource: null, amount: 0, revealed: true, worker: false };
  }
  s.depth += 1;
  // Revela ao redor pra mostrar a área nova
  revealAround(mine.grid, r, c, 1);
  log(`Poço estendido para ${s.depth}m (-$${cost}).`, 'good');
  play('pickaxe');
  return true;
}

// Constrói um poço novo numa coluna específica (depth = INITIAL_SHAFT_DEPTH)
export function tryAddShaft(col) {
  const mine = activeMine();
  if (!mine) return false;
  if (!Array.isArray(mine.shafts)) mine.shafts = [];
  col = Math.max(0, Math.min(MINE.cols - 1, Number(col) || 0));
  // Não permite shaft já existente na mesma coluna
  if (mine.shafts.some(s => s.col === col)) {
    log('Já existe um poço nessa coluna.', 'bad');
    return false;
  }
  if (state.money < NEW_SHAFT_COST) {
    log(`Sem dinheiro pra construir novo poço ($${NEW_SHAFT_COST}).`, 'bad');
    return false;
  }
  state.money -= NEW_SHAFT_COST;
  mine.shafts.push({ col, depth: INITIAL_SHAFT_DEPTH });
  // Converte tiles da coluna em shaft até a profundidade inicial
  for (let r = 0; r < INITIAL_SHAFT_DEPTH; r++) {
    if (mine.grid[r] && mine.grid[r][col]) {
      mine.grid[r][col] = { type: 'shaft', resource: null, amount: 0, revealed: true, worker: false };
    }
  }
  // Túnel horizontal curto pra mostrar acesso
  const dir = col < MINE.cols - 3 ? 1 : -1;
  for (let i = 1; i <= 2; i++) {
    const nc = col + dir * i;
    if (mine.grid[0] && mine.grid[0][nc] && mine.grid[0][nc].type !== 'shaft') {
      mine.grid[0][nc] = airTile(true);
    }
  }
  revealAround(mine.grid, 0, col, 2);
  log(`✨ Novo poço aberto na coluna ${col + 1} (-$${NEW_SHAFT_COST}).`, 'good');
  play('success');
  return true;
}

// Upgrade de velocidade do elevador (afeta extração de TODOS workers da mina)
export function tryUpgradeShaftSpeed() {
  const mine = activeMine();
  if (!mine) return false;
  const lv = mine.speedLv || 0;
  if (lv >= MAX_SHAFT_SPEED_LV) {
    log('Velocidade do elevador já no máximo.', 'bad');
    return false;
  }
  const cost = shaftSpeedUpgradeCost(lv);
  if (state.money < cost) {
    log(`Sem dinheiro pra upgrade de velocidade ($${cost}).`, 'bad');
    return false;
  }
  state.money -= cost;
  mine.speedLv = lv + 1;
  log(`⚡ Velocidade do elevador: nível ${lv + 1}/${MAX_SHAFT_SPEED_LV} (+${mine.speedLv * 20}% extração).`, 'good');
  play('coin');
  return true;
}

// Contratação rápida: gera worker aleatório com custo fixo (vs. seleção)
export function tryHireWorker() {
  if (state.money < WORKER_COST) return;
  state.money -= WORKER_COST;
  ensureWorkers();
  // Worker contratado random tem skill mediana (0.7-1.1)
  const w = makeWorker(0.7, 1.1);
  state.workers.push(w);
  state.workersTotal = state.workers.length;
  log(`Contratado: ${w.name} (skill ${w.skill}×) por ${fmtMoney(WORKER_COST)}.`, 'good');
  play('coin');
}

export function setTool(toolId) {
  if (!TOOLS[toolId]) return;
  state.tool = toolId;
}

// ----- Silos -----
// Expande a capacidade do silo de um recurso (+200, custo escala com cap)
export function tryUpgradeSilo(resource) {
  if (!R[resource] || R[resource].free) return false;
  if (!state.silos[resource]) state.silos[resource] = { cap: SILO_DEFAULT_CAP };
  const cur = state.silos[resource].cap || SILO_DEFAULT_CAP;
  const cost = Math.max(200, Math.round(cur * 0.5));
  if (state.money < cost) {
    log(`Sem dinheiro pra expandir silo de ${R[resource].name} ($${cost}).`, 'bad');
    return false;
  }
  state.money -= cost;
  state.silos[resource].cap = cur + 200;
  log(`Silo de ${R[resource].name} expandido: ${cur} → ${cur + 200} (-$${cost}).`, 'good');
  play('coin');
  return true;
}

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
  checkRegenerationAchievement();
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
  // Recomputa conectividade a cada tick (BFS rápido, 30×50 = 1500 cells)
  mine._connectivity = computeConnectivity(mine.grid);
  // Aplica multiplicador de velocidade do elevador (upgrade da mina)
  rate *= shaftSpeedMul(mine);
  // Produção dos workers (modulada por skill e fatigue individuais)
  for (let r = 0; r < MINE.rows; r++) {
    for (let c = 0; c < MINE.cols; c++) {
      const t = mine.grid[r][c];
      if (!t.worker) continue;
      if (t.type !== 'ore') { t.worker = false; continue; }
      if (t.amount <= 0) continue;
      if (!isOreReachable(mine, r, c)) continue;
      const w = typeof t.worker === 'number' ? getWorker(t.worker) : null;
      const skill = w ? w.skill : 1;
      const fatigue = w ? (w.fatigue || 0) : 0;
      // Fatigue reduz produção até 50%. Skill multiplica diretamente.
      const effRate = rate * skill * (1 - fatigue * 0.5);
      const take = Math.min(effRate * dt, t.amount);
      const added = tryAddToSilo(t.resource, take);
      t.amount -= added;
      // Fatigue acumula proporcional ao trabalho (chega em 1 após ~3 min cavando)
      if (w) w.fatigue = Math.min(1, (w.fatigue || 0) + dt * 0.006);
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
    checkExhaustionAchievement();
  }
  // Conquistas de tilesDug (cheap: checa só se houve update de tilesDug recente)
  checkMineAchievements();
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
