// advisor.js — "conselheiro do contrato": descobre o que impede o pedido atual de
// ser cumprido e sugere UMA ação concreta (de preferência resolvida com um toque).
import { state } from './state.js';
import { R, RECIPE_BY_ID, CFG, MINE, SILO_DEFAULT_CAP } from './data.js';
import { isRecipeUnlocked, isDepositUnlocked } from './progression.js';
import { SITE_BY_RESOURCE, SITES, siteState, siteUnlocked } from './sites.js';
import { getProjectDef } from './projects.js';

/**
 * @typedef {{
 *   kind: 'switch' | 'mine' | 'explore' | 'buyMine' | 'buyFactory' | 'buildSite' | 'siteWorker' | 'army' | 'locked',
 *   text: string, factory?: number, recipe?: string, resource?: string, mineIdx?: number,
 *   r?: number, c?: number, site?: string
 * }} Advice
 */

/** @param {string} id */
const stockOf = (id) => (R[id] && R[id].free ? Infinity
  : R[id] && R[id].kind === 'raw' ? state.warehouse[id] || 0 : state.products[id] || 0);

/** @param {string} id */
const factoryMaking = (id) => state.factories.findIndex((f) => f.recipeId === id);

/** Quantas unidades do produto do pedido ainda faltam fabricar. */
function remainingUnits() {
  const k = state.contract;
  if (!k) return 0;
  return Math.max(0, k.need - k.delivered - (state.products[k.product] || 0));
}

/**
 * Produtos intermediários que precisam continuar sendo fabricados (estoque não basta).
 * @param {string} product @param {number} units @param {Set<string>} keep
 */
function collectKeep(product, units, keep) {
  keep.add(product);
  const recipe = RECIPE_BY_ID[product];
  if (!recipe) return;
  for (const [ing, n] of Object.entries(recipe.in)) {
    if (R[ing].kind !== 'prod') continue;
    const need = units * n - stockOf(ing);
    if (need > 0) collectKeep(ing, need, keep);
  }
}

/** Fábrica que pode trocar de receita sem prejudicar o pedido. @param {Set<string>} keep */
function factoryToSwitch(keep) {
  // ordem de preferência: fábrica parada > trabalhando > trabalhando para o projeto em obra
  const project = projectShortfall();
  /** @param {any} f */
  const score = (f) => (project.has(f.recipeId) ? 2 : 0) + (f.brewing > 0 ? 1 : 0);
  let best = -1;
  state.factories.forEach((f, i) => {
    if (keep.has(f.recipeId)) return;
    if (best < 0 || score(f) < score(state.factories[best])) best = i;
  });
  return best;
}

/** @param {string} res @returns {{mineIdx:number, worked:boolean} | null} */
function findVein(res) {
  /** @type {{mineIdx:number, worked:boolean} | null} */
  let found = null;
  (state.mines || []).forEach((m, mi) => {
    if (!m || !m.grid) return;
    for (let r = 0; r < MINE.rows; r++) {
      for (let c = 0; c < MINE.cols; c++) {
        const t = m.grid[r][c];
        if (!t.revealed || t.type !== 'ore' || t.resource !== res || t.amount <= 0) continue;
        if (t.worker) { found = { mineIdx: mi, worked: true }; return; }
        if (!found) found = { mineIdx: mi, worked: false };
      }
    }
  });
  return found;
}

/**
 * "Geólogo": veio ainda escondido do recurso, o mais próximo de um túnel aberto.
 * @param {string} res @returns {{mineIdx:number, r:number, c:number} | null}
 */
export function findHiddenVein(res) {
  /** @type {{mineIdx:number, r:number, c:number, d:number} | null} */
  let best = null;
  (state.mines || []).forEach((m, mi) => {
    if (!m || !m.grid) return;
    /** @type {[number, number][]} */
    const open = [];
    for (let r = 0; r < MINE.rows; r++) for (let c = 0; c < MINE.cols; c++) {
      const t = m.grid[r][c];
      if (t.revealed && (t.type === 'air' || t.type === 'shaft')) open.push([r, c]);
    }
    for (let r = 0; r < MINE.rows; r++) for (let c = 1; c < MINE.cols; c++) {
      const t = m.grid[r][c];
      if (t.revealed || t.type !== 'ore' || t.resource !== res || t.amount <= 0) continue;
      let d = 99;
      for (const [or, oc] of open) d = Math.min(d, Math.abs(or - r) + Math.abs(oc - c));
      if (!best || d < best.d) best = { mineIdx: mi, r, c, d };
    }
  });
  return best ? { mineIdx: best.mineIdx, r: best.r, c: best.c } : null;
}

/** Recursos usados por alguma fábrica agora ou pelo pedido (não se mexe neles). */
export function resourcesInUse() {
  const used = new Set();
  for (const f of state.factories) {
    used.add(f.recipeId);
    const rec = RECIPE_BY_ID[f.recipeId];
    if (rec) for (const ing in rec.in) used.add(ing);
  }
  if (state.contract) used.add(state.contract.product);
  // o projeto em obra também "usa": não vender nem mandar nas caravanas
  for (const [id] of projectShortfall()) {
    used.add(id);
    const rec = RECIPE_BY_ID[id];
    if (rec) for (const ing in rec.in) used.add(ing);
  }
  return used;
}

/**
 * O que ainda falta para o projeto em obra (descontando o que já foi entregue e o
 * que está em estoque), incluindo intermediários sem estoque suficiente.
 * @returns {Map<string, number>} recurso → unidades que faltam
 */
export function projectShortfall() {
  /** @type {Map<string, number>} */
  const out = new Map();
  const a = state.projects && state.projects.active;
  const def = a && getProjectDef(a.id);
  if (!def) return out;
  /** @param {string} id @param {number} units @param {number} depth */
  const add = (id, units, depth) => {
    if (units <= 0 || depth > 4) return;
    out.set(id, (out.get(id) || 0) + units);
    const rec = RECIPE_BY_ID[id];
    if (!rec) return;
    for (const [ing, n] of Object.entries(rec.in)) {
      if (R[ing].free) continue;
      const lack = units * n - stockOf(ing);
      if (lack > 0) add(ing, lack, depth + 1);
    }
  };
  for (const [id, need] of Object.entries(def.requirements)) {
    add(id, need - (a.progress[id] || 0) - stockOf(id), 0);
  }
  return out;
}

/** Fábricas que o pedido atual precisa manter (a cadeia do produto do contrato). */
export function contractKeepSet() {
  const keep = new Set();
  const k = state.contract;
  if (k && R[k.product]) {
    const left = Math.max(0, k.need - k.delivered - (state.products[k.product] || 0));
    if (left > 0) collectKeep(k.product, left, keep);
  }
  return keep;
}

/** @param {string} res */
export const siloFull = (res) => (state.warehouse[res] || 0) >= ((state.silos[res] && state.silos[res].cap) || SILO_DEFAULT_CAP) - 1;

/**
 * Libera UM trabalhador ocioso: num posto ou veio cujo silo encheu ou cujo
 * recurso nenhuma fábrica usa. Postos primeiro (são os que mais "prendem" gente).
 * @param {string} keep recurso que não deve perder trabalhador
 */
export function freeIdleWorker(keep) {
  const used = resourcesInUse();
  /** @param {string} res */
  const idle = (res) => res !== keep && (siloFull(res) || !used.has(res));
  for (const def of SITES) {
    const st = state.sites && state.sites[def.id];
    if (st && st.workers > 0 && idle(def.resource)) { st.workers--; return true; }
  }
  for (const m of state.mines || []) {
    if (!m || !m.grid) continue;
    for (const row of m.grid) {
      const t = row.find((x) => x.worker && idle(x.resource));
      if (t) { t.worker = false; return true; }
    }
  }
  return false;
}

export function freeWorkers() {
  let busy = 0;
  for (const m of state.mines || []) {
    if (!m || !m.grid) continue;
    for (const row of m.grid) for (const t of row) if (t.worker) busy++;
  }
  for (const id in state.sites || {}) busy += state.sites[id].workers || 0;
  return state.workersTotal - busy;
}

/**
 * @param {string} product @param {Set<string>} keep @param {Set<string>} seen
 * @returns {Advice | null}
 */
function adviseProduce(product, keep, seen) {
  if (seen.has(product)) return null;
  seen.add(product);
  const name = R[product].name;
  const recipe = RECIPE_BY_ID[product];
  if (!recipe) return null;
  if (!isRecipeUnlocked(product)) return { kind: 'locked', text: `${name} ainda não pode ser fabricado nesta era.` };
  if (factoryMaking(product) < 0) {
    const target = factoryToSwitch(keep);
    if (target >= 0) {
      return { kind: 'switch', factory: target, recipe: product, text: `Nenhuma fábrica faz ${name}. Toque para colocar a Fábrica ${target + 1} em ${name}.` };
    }
    if (state.factories.length < CFG.factorySlotsMax) {
      return { kind: 'buyFactory', text: `Precisa de mais uma fábrica para ${name}. Toque para ver as fábricas.` };
    }
    return null;
  }
  for (const [ing, n] of Object.entries(recipe.in)) {
    if (R[ing].free || stockOf(ing) >= n) continue;
    if (R[ing].kind === 'prod') {
      const sub = adviseProduce(ing, keep, seen);
      if (sub) return sub;
      continue;
    }
    const iname = R[ing].name;
    if (!isDepositUnlocked(ing)) return { kind: 'locked', text: `${iname} só pode ser extraído numa era mais avançada.` };
    const site = SITE_BY_RESOURCE[ing];
    if (site) {
      const st = siteState(site.id);
      if (!st.built) {
        if (!siteUnlocked(site.id)) return { kind: 'locked', text: `${iname} vem do ${site.name}, liberado numa era mais avançada.` };
        return { kind: 'buildSite', site: site.id, resource: ing, text: `Falta ${iname}: ela vem do ${site.emoji} ${site.name}. Toque para construir ($${site.cost}).` };
      }
      if (st.workers <= 0) {
        const extra = freeWorkers() > 0 ? '' : ' (vai contratar um, $80)';
        return { kind: 'siteWorker', site: site.id, resource: ing, text: `Falta ${iname}: o ${site.emoji} ${site.name} está sem gente. Toque para colocar um trabalhador${extra}.` };
      }
      continue;
    }
    const vein = findVein(ing);
    if (vein && vein.worked) continue; // já está sendo extraído: é só esperar
    if (vein) {
      const extra = freeWorkers() > 0 ? '' : ' (contrate um ou retire de outro veio)';
      return { kind: 'mine', resource: ing, mineIdx: vein.mineIdx, text: `Falta ${iname}: toque para alocar um minerador num veio de ${iname}${extra}.` };
    }
    const hidden = findHiddenVein(ing);
    if (hidden) {
      const mname = state.mines[hidden.mineIdx]?.name || 'mina';
      return { kind: 'explore', resource: ing, ...hidden, text: `Falta ${iname}: o geólogo sentiu um veio na ${mname}. Toque para ir lá e revelar com a Bússola ($40).` };
    }
    return { kind: 'buyMine', resource: ing, text: `Falta ${iname}: nenhuma das suas minas tem esse minério. Toque para comprar uma mina nova.` };
  }
  return null;
}

/** @returns {Advice | null} */
export function adviseContract() {
  const k = state.contract;
  if (!k || !R[k.product]) return null;
  const left = remainingUnits();
  if (left <= 0) return null;
  const keep = new Set();
  collectKeep(k.product, left, keep);
  return adviseProduce(k.product, keep, new Set());
}

/** Pedido de um produto que nenhuma fábrica faz ainda? (dá prazo extra para trocar) */
/** @param {string} product */
export function nobodyMakes(product) {
  return factoryMaking(product) < 0;
}
