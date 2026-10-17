// layout.js — pegadas (footprints) no chão de cada estrutura do mapa isométrico.
// Coordenadas de chão 1280x720; {x, y} = canto norte, w ao longo de gx, d ao longo de gy.
import { OVERWORLD, factoryRect } from './geometry.js';

/** @typedef {{ x: number, y: number, w: number, d: number }} Footprint */

/** @param {number} cx @param {number} cy @param {number} w @param {number} d @returns {Footprint} */
const around = (cx, cy, w, d) => ({ x: cx - w / 2, y: cy - d / 2, w, d });

/** @type {Footprint[]} */
export const MINE_FP = OVERWORLD.mineEntrances.map((e) => around(e.x + e.w / 2 + 5, e.y + e.h / 2, 110, 84));

/** @type {Footprint[]} */
export const FACTORY_FP = [0, 1, 2].map((i) => {
  const r = factoryRect(i);
  return around(r.x + r.w / 2, 395, 92, 84);
});

export const MERCADO_FP = around(345, 580, 76, 56);
export const PESQUISA_FP = around(695, 580, 80, 66);

export const CITY_CENTER = { x: 1050, y: 420 };
export const CITY_SIGN = { x: 1050, y: 615 };
export const CIV_FLAG = { x: 215, y: 34 };

/** @param {Footprint} f */
export const centerOf = (f) => ({ x: f.x + f.w / 2, y: f.y + f.d / 2 });
