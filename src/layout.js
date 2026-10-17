// layout.js — pegadas (footprints) no chão de cada estrutura do mapa isométrico.
// Coordenadas de chão 1280x720; {x, y} = canto norte, w ao longo de gx, d ao longo de gy.
import { OVERWORLD } from './geometry.js';

/** @typedef {{ x: number, y: number, w: number, d: number }} Footprint */

/** @param {number} cx @param {number} cy @param {number} w @param {number} d @returns {Footprint} */
const around = (cx, cy, w, d) => ({ x: cx - w / 2, y: cy - d / 2, w, d });

/** @type {Footprint[]} */
export const MINE_FP = OVERWORLD.mineEntrances.map((e) => around(e.x + e.w / 2 + 5, e.y + e.h / 2, 110, 84));

/** Fábricas espaçadas, cada uma com sua estrada vinda do Depósito. @type {Footprint[]} */
export const FACTORY_FP = [
  around(430, 380, 92, 84),
  around(600, 320, 92, 84),
  around(720, 410, 92, 84),
];

/** 📦 Depósito Central: as minas entregam aqui; daqui saem os insumos das fábricas. */
export const DEPOT_FP = around(290, 380, 64, 54);

/** @typedef {[number, number]} Pt */
/** Estradas Depósito → cada fábrica (chão). @type {Pt[][]} */
export const DEPOT_PATHS = [
  [[322, 386], [352, 384], [384, 382]],
  [[322, 366], [420, 318], [500, 296], [554, 304]],
  [[322, 398], [420, 444], [560, 452], [640, 440], [674, 420]],
];

export const MERCADO_FP = around(345, 580, 76, 56);
export const PESQUISA_FP = around(695, 580, 80, 66);

export const CITY_CENTER = { x: 1050, y: 420 };
export const CITY_SIGN = { x: 1050, y: 615 };
export const CIV_FLAG = { x: 215, y: 34 };

/** @param {Footprint} f */
export const centerOf = (f) => ({ x: f.x + f.w / 2, y: f.y + f.d / 2 });
