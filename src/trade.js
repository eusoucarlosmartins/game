// trade.js — rotas comerciais (estilo AoE): carroças levam o excedente até as
// fronteiras e vendem melhor que o mercado local. Quanto mais longe, melhor paga.
import { state, log } from './state.js';
import { R, SILO_DEFAULT_CAP } from './data.js';
import { currentEra } from './progression.js';
import { resourcesInUse } from './advisor.js';
import { fmtMoney } from './util.js';

/** @typedef {[number, number]} Pt */
/**
 * @typedef {{ id: string, name: string, era: number, mult: number, path: Pt[] }} Route
 * @typedef {{ route: string, u: number, dir: number, cargo: string | null, n: number, wait: number }} Cart
 */

/** Caminhos em coordenadas de chão: do Mercado até a borda do mapa. @type {Route[]} */
export const ROUTES = [
  { id: 'curitiba', name: 'Curitiba (PR)', era: 3, mult: 0.85, path: [[330, 548], [290, 500], [205, 455], [-10, 455]] },
  { id: 'portoalegre', name: 'Porto Alegre (RS)', era: 3, mult: 0.95, path: [[350, 612], [338, 670], [330, 735]] },
  { id: 'rio', name: 'Rio de Janeiro (mar)', era: 4, mult: 1.1, path: [[995, 600], [1110, 640], [1180, 690], [1210, 735]] },
];
export const ROUTE_BY_ID = Object.fromEntries(ROUTES.map((r) => [r.id, r]));
export const CART_COST = 400;
export const CART_LOAD = 6;
const CART_SPEED = 32; // unidades de chão por segundo
const MAX_CARTS = 4;

/** @param {Pt[]} pts */
export function pathLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return len;
}

/** Ponto do caminho em u (0..1). @param {Pt[]} pts @param {number} u */
export function pointOn(pts, u) {
  const total = pathLength(pts);
  let d = Math.max(0, Math.min(1, u)) * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d <= seg || i === pts.length - 1) {
      const k = seg ? Math.min(1, d / seg) : 0;
      return { x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, y: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k, dx: pts[i][0] - pts[i - 1][0], dy: pts[i][1] - pts[i - 1][1] };
    }
    d -= seg;
  }
  const last = pts[pts.length - 1];
  return { x: last[0], y: last[1], dx: 0, dy: 0 };
}

/** @returns {Cart[]} */
export function carts() {
  if (!state.trade) state.trade = { carts: [], earned: 0 };
  return state.trade.carts;
}

/** @param {string} routeId */
export const routeUnlocked = (routeId) => currentEra() >= ROUTE_BY_ID[routeId].era;

/** @param {string} routeId */
export function buyCart(routeId) {
  if (!ROUTE_BY_ID[routeId] || !routeUnlocked(routeId)) return false;
  if (carts().length >= MAX_CARTS || state.money < CART_COST) return false;
  state.money -= CART_COST;
  carts().push({ route: routeId, u: 0, dir: 0, cargo: null, n: 0, wait: 0 });
  log(`🐎 Carroça de comércio comprada para a rota de ${ROUTE_BY_ID[routeId].name}.`, 'good');
  return true;
}

export const canBuyCart = () => carts().length < MAX_CARTS;

/** Escolhe o excedente mais valioso que ninguém está usando. @returns {{id: string, kind: 'prod'|'raw'} | null} */
export function pickCargo() {
  const used = resourcesInUse();
  let best = null;
  let bestValue = 0;
  for (const id in state.products) {
    const n = Math.floor(state.products[id] || 0);
    if (n < 2 || used.has(id)) continue;
    const v = Math.min(n, CART_LOAD) * R[id].price;
    if (v > bestValue) { bestValue = v; best = { id, kind: /** @type {'prod'} */ ('prod') }; }
  }
  if (best) return best;
  for (const id in state.warehouse) {
    if (!R[id] || R[id].free || used.has(id)) continue;
    const cap = (state.silos[id] && state.silos[id].cap) || SILO_DEFAULT_CAP;
    const n = Math.floor(state.warehouse[id] || 0);
    if (n < cap * 0.5) continue;
    const v = Math.min(n, CART_LOAD * 4) * R[id].price;
    if (v > bestValue) { bestValue = v; best = { id, kind: /** @type {'raw'} */ ('raw') }; }
  }
  return best;
}

/** @param {number} dt */
export function updateTrade(dt) {
  for (const c of carts()) {
    const route = ROUTE_BY_ID[c.route];
    if (!route) continue;
    const step = (CART_SPEED * dt) / pathLength(route.path);
    if (c.dir === 0) {
      // no Mercado: carrega
      c.wait -= dt;
      if (c.wait > 0) continue;
      const pick = pickCargo();
      if (!pick) { c.wait = 4; continue; }
      const store = pick.kind === 'prod' ? state.products : state.warehouse;
      const take = Math.min(Math.floor(store[pick.id] || 0), pick.kind === 'prod' ? CART_LOAD : CART_LOAD * 4);
      store[pick.id] -= take;
      c.cargo = pick.id;
      c.n = take;
      c.dir = 1;
    } else if (c.dir > 0) {
      c.u += step;
      if (c.u >= 1) {
        c.u = 1;
        if (c.cargo && c.n > 0) {
          const earn = Math.round(c.n * R[c.cargo].price * route.mult);
          state.money += earn;
          state.totalEarnings = (state.totalEarnings || 0) + earn;
          if (state.trade) state.trade.earned = (state.trade.earned || 0) + earn;
          log(`🐎 Caravana vendeu ${c.n}× ${R[c.cargo].name} em ${route.name}: +${fmtMoney(earn)}.`, 'good');
        }
        c.cargo = null;
        c.n = 0;
        c.dir = -1;
      }
    } else {
      c.u -= step;
      if (c.u <= 0) { c.u = 0; c.dir = 0; c.wait = 1; }
    }
  }
}
