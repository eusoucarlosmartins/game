// relics.js — relíquias (estilo AoE): achados raros escondidos fundo nas minas.
// Ao cavar o bloco, a relíquia vai para a Academia e rende ouro todo dia.
import { state, log } from './state.js';
import { MINE } from './data.js';
import { fmtMoney } from './util.js';

export const RELIC_INCOME = 30; // $ por relíquia por dia
const PER_MINE = 2;
const MIN_DEPTH = 5;

export const RELIC_NAMES = [
  'Machado de pedra Xokleng', 'Cruz da missão jesuíta', 'Moeda de ouro do Império',
  'Âncora de navio açoriano', 'Sino da capela de Desterro', 'Medalha da Guerra do Paraguai',
  'Cachimbo de barro guarani', 'Lampião do primeiro poço', 'Mapa de Anita Garibaldi',
  'Estribo de prata tropeiro', 'Pedra rúnica do Vale', 'Relógio do Conde d’Eu',
];

/**
 * Esconde relíquias numa mina (uma vez por mina; minas antigas recebem ao carregar).
 * @param {any} mine @param {() => number} [rnd]
 */
export function placeRelics(mine, rnd = Math.random) {
  if (!mine || !mine.grid || mine.relicsPlaced) return;
  mine.relicsPlaced = true;
  let placed = 0;
  for (let tries = 0; tries < 200 && placed < PER_MINE; tries++) {
    const r = MIN_DEPTH + Math.floor(rnd() * (MINE.rows - MIN_DEPTH));
    const c = 2 + Math.floor(rnd() * (MINE.cols - 3));
    const t = mine.grid[r] && mine.grid[r][c];
    if (!t || t.revealed || (t.type !== 'dirt' && t.type !== 'stone') || t.relic) continue;
    t.relic = true;
    placed++;
  }
}

/** Chamado quando um bloco é cavado/explodido. @param {any} tile */
export function collectRelicFrom(tile) {
  if (!tile || !tile.relic) return false;
  const n = state.relics || 0;
  const name = RELIC_NAMES[n % RELIC_NAMES.length];
  state.relics = n + 1;
  state.relicNames = [...(state.relicNames || []), name];
  state.approval = Math.min(100, (state.approval || 0) + 3);
  log(`🏺 Relíquia encontrada: ${name}! Exposta na Academia, rende ${fmtMoney(RELIC_INCOME)}/dia.`, 'good');
  return true;
}

export const relicIncome = () => (state.relics || 0) * RELIC_INCOME;
