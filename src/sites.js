// sites.js — postos de coleta na superfície (estilo AoE): madeira na floresta,
// pedra na pedreira, argila no barreiro, areia no areal, petróleo no poço.
// Usam os mesmos trabalhadores da mina.
import { state, log } from './state.js';
import { R } from './data.js';
import { currentEra, mineRateMul } from './progression.js';
import { fmtMoney } from './util.js';

/**
 * @typedef {{ id: string, resource: string, name: string, emoji: string, era: number,
 *   cost: number, rate: number, maxWorkers: number, x: number, y: number, w: number, d: number,
 *   desc: string }} SiteDef
 */

/** @type {SiteDef[]} posições em coordenadas de chão do mapa (1280x720) */
export const SITES = [
  { id: 'quarry', resource: 'stone', name: 'Pedreira', emoji: '🪨', era: 1, cost: 200, rate: 0.55, maxWorkers: 4,
    x: 404, y: 104, w: 66, d: 44, desc: 'Cortadores tiram blocos de pedra do pé do penhasco.' },
  { id: 'claypit', resource: 'clay', name: 'Barreiro', emoji: '🟫', era: 1, cost: 180, rate: 0.5, maxWorkers: 4,
    x: 738, y: 262, w: 44, d: 44, desc: 'Argila retirada da margem do rio.' },
  { id: 'lumber', resource: 'wood', name: 'Lenhadores', emoji: '🪓', era: 2, cost: 250, rate: 0.5, maxWorkers: 4,
    x: 535, y: 214, w: 50, d: 38, desc: 'Lenhadores cortam a floresta ao norte — as árvores viram tocos.' },
  { id: 'sandbank', resource: 'sand', name: 'Areal', emoji: '🏖', era: 2, cost: 220, rate: 0.55, maxWorkers: 4,
    x: 752, y: 586, w: 44, d: 40, desc: 'Areia peneirada da praia do rio.' },
  { id: 'oilwell', resource: 'oil', name: 'Poço de Petróleo', emoji: '🛢', era: 4, cost: 1500, rate: 0.3, maxWorkers: 3,
    x: 470, y: 536, w: 44, d: 44, desc: 'Cavalo-de-pau bombeando petróleo bruto.' },
];
export const SITE_BY_ID = Object.fromEntries(SITES.map((s) => [s.id, s]));
export const SITE_BY_RESOURCE = Object.fromEntries(SITES.map((s) => [s.resource, s]));
/** Recursos que vêm da superfície (não geram veios nas minas novas). */
export const SURFACE_RESOURCES = new Set(SITES.map((s) => s.resource));

/** @param {string} id @returns {{built: boolean, workers: number, harvested: number}} */
export function siteState(id) {
  if (!state.sites) state.sites = {};
  if (!state.sites[id]) state.sites[id] = { built: false, workers: 0, harvested: 0 };
  return state.sites[id];
}

export function siteWorkersTotal() {
  let n = 0;
  for (const s of SITES) n += (state.sites && state.sites[s.id] && state.sites[s.id].workers) || 0;
  return n;
}

/** @param {string} id */
export const siteUnlocked = (id) => currentEra() >= SITE_BY_ID[id].era;

/** @param {string} id */
export function buildSite(id) {
  const def = SITE_BY_ID[id];
  const st = siteState(id);
  if (!def || st.built || !siteUnlocked(id) || state.money < def.cost) return false;
  state.money -= def.cost;
  st.built = true;
  log(`${def.emoji} ${def.name} construído por ${fmtMoney(def.cost)}. Coloque trabalhadores para produzir ${R[def.resource].name}.`, 'good');
  return true;
}

/**
 * @param {string} id @param {number} delta +1 / -1
 * @param {() => number} freeWorkers trabalhadores livres (mina + postos)
 */
export function changeSiteWorkers(id, delta, freeWorkers) {
  const def = SITE_BY_ID[id];
  const st = siteState(id);
  if (!def || !st.built) return false;
  if (delta > 0) {
    if (st.workers >= def.maxWorkers || freeWorkers() <= 0) return false;
    st.workers++;
  } else {
    if (st.workers <= 0) return false;
    st.workers--;
  }
  return true;
}

/** @param {number} dt @param {(res: string, n: number) => number} addToSilo */
export function updateSites(dt, addToSilo) {
  if (!state.sites) return;
  const mul = mineRateMul();
  for (const def of SITES) {
    const st = state.sites[def.id];
    if (!st || !st.built || st.workers <= 0) continue;
    const added = addToSilo(def.resource, def.rate * st.workers * mul * dt);
    st.harvested = (st.harvested || 0) + added;
  }
}
