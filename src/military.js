// military.js — exército e fronteiras (estilo AoE): quartel, unidades feitas com
// os produtos de guerra da economia, ataques das civilizações rivais pelas
// fronteiras e expedições para conquistar territórios que pagam tributo.
import { state, log } from './state.js';
import { R, CIVILIZATIONS } from './data.js';
import { currentEra } from './progression.js';
import { fmtMoney } from './util.js';

/**
 * @typedef {{ id: string, name: string, emoji: string, era: number, cost: Record<string, number>, power: number, upkeep: number }} UnitDef
 * @typedef {{ rival: string, border: string, power: number, eta: number, total: number }} Threat
 * @typedef {{ rival: string, eta: number, total: number, power: number, units: Record<string, number> }} Expedition
 */

/** @type {UnitDef[]} */
export const UNITS = [
  { id: 'milicia', name: 'Milícia', emoji: '🗡️', era: 3, cost: { money: 90 }, power: 1, upkeep: 1 },
  { id: 'canhao', name: 'Canhão', emoji: '💣', era: 4, cost: { money: 250, steel_beam: 2, gunpowder: 4 }, power: 8, upkeep: 4 },
  { id: 'fuzileiro', name: 'Fuzileiro', emoji: '🔫', era: 5, cost: { money: 60, rifle: 1, bullets: 2 }, power: 4, upkeep: 2 },
];
export const UNIT_BY_ID = Object.fromEntries(UNITS.map((u) => [u.id, u]));

export const BARRACKS = { era: 3, cost: 1000, x: 470, y: 455, w: 56, d: 46 };
/** Fronteiras (as mesmas estradas das rotas comerciais). */
export const BORDERS = ['portoalegre', 'curitiba', 'rio'];
export const TRIBUTE = 120; // $/dia por território conquistado
const MARCH = 60; // segundos de aviso até o ataque chegar
const EXPEDITION_TIME = 45;

export function army() {
  if (!state.army) {
    state.army = { barracks: false, units: {}, threats: [], nextThreatIn: 180, territories: {}, wins: 0, losses: 0, expedition: null, lastBattle: null };
  }
  return state.army;
}

/** Rivais = as outras civilizações, cada uma numa fronteira. */
export function rivals() {
  const mine = state.civilization || 'catarinense';
  return CIVILIZATIONS.filter((c) => c.id !== mine).slice(0, BORDERS.length)
    .map((c, i) => ({ id: c.id, name: c.name, emoji: c.emoji, color: c.color, border: BORDERS[i] }));
}

/** @param {string} id */
export const rivalOf = (id) => rivals().find((r) => r.id === id) || null;

/** Força das unidades em casa (as que estão em expedição não defendem). */
export function armyPower() {
  const a = army();
  let p = 0;
  for (const u of UNITS) p += (a.units[u.id] || 0) * u.power;
  return p;
}

/** Moral: aprovação alta luta melhor. */
const morale = () => 0.8 + Math.min(100, state.approval || 0) / 250;

export function buildBarracks() {
  const a = army();
  if (a.barracks || currentEra() < BARRACKS.era || state.money < BARRACKS.cost) return false;
  state.money -= BARRACKS.cost;
  a.barracks = true;
  log(`⚔️ Quartel construído por ${fmtMoney(BARRACKS.cost)}. Treine unidades na aba Exército.`, 'good');
  return true;
}

/** @param {string} id @returns {'ok'|'barracks'|'era'|'cost'} */
export function canTrain(id) {
  const u = UNIT_BY_ID[id];
  if (!u) return 'era';
  if (!army().barracks) return 'barracks';
  if (currentEra() < u.era) return 'era';
  for (const k in u.cost) {
    const have = k === 'money' ? state.money : (state.products[k] || 0);
    if (have < u.cost[k]) return 'cost';
  }
  return 'ok';
}

/** @param {string} id */
export function trainUnit(id) {
  if (canTrain(id) !== 'ok') return false;
  const u = UNIT_BY_ID[id];
  for (const k in u.cost) {
    if (k === 'money') state.money -= u.cost[k];
    else state.products[k] -= u.cost[k];
  }
  const a = army();
  a.units[id] = (a.units[id] || 0) + 1;
  return true;
}

/** @param {Record<string, number>} cost */
export const costText = (cost) => Object.entries(cost)
  .map(([k, n]) => (k === 'money' ? fmtMoney(n) : `${n} ${R[k].name}`)).join(' + ');

/** Perde uma fração das unidades (as mais fracas primeiro). @param {number} frac */
function loseUnits(frac) {
  const a = army();
  let toLose = Math.round(armyPower() * frac);
  for (const u of UNITS) {
    while (toLose > 0 && (a.units[u.id] || 0) > 0) {
      a.units[u.id]--;
      toLose -= u.power;
    }
  }
}

function threatPower() {
  const era = currentEra();
  return Math.max(2, Math.round((2 + (era - 3) * 4 + (state.day || 0) * 0.12) * (0.85 + Math.random() * 0.3)));
}

/** Decide e aplica o resultado de um ataque que chegou. @param {Threat} t */
export function resolveAttack(t) {
  const a = army();
  const rival = rivalOf(t.rival);
  const name = rival ? `${rival.emoji} ${rival.name}s` : 'Invasores';
  const mine = armyPower() * morale();
  if (mine >= t.power) {
    const loot = t.power * 40;
    state.money += loot;
    state.totalEarnings = (state.totalEarnings || 0) + loot;
    state.approval = Math.min(100, (state.approval || 0) + 6);
    loseUnits(Math.min(0.5, (t.power / Math.max(1, mine)) * 0.3));
    a.wins++;
    a.lastBattle = { border: t.border, at: Date.now(), won: true };
    log(`⚔️ Vitória na fronteira! Os ${name} recuaram. Saque de ${fmtMoney(loot)} e +6 de aprovação.`, 'good');
    return true;
  }
  const cash = Math.min(1500, Math.floor(state.money * 0.15));
  state.money -= cash;
  const full = Object.keys(state.warehouse).filter((k) => !R[k].free)
    .sort((x, y) => (state.warehouse[y] || 0) - (state.warehouse[x] || 0)).slice(0, 3);
  for (const k of full) state.warehouse[k] = Math.floor((state.warehouse[k] || 0) * 0.75);
  state.approval = Math.max(state.approvalFloor || 0, (state.approval || 0) - 10);
  loseUnits(0.5);
  a.losses++;
  a.lastBattle = { border: t.border, at: Date.now(), won: false };
  log(`⚔️ Derrota! Os ${name} saquearam ${fmtMoney(cash)} e parte dos silos. −10 de aprovação.`, 'bad');
  return false;
}

/** Força da guarnição de um território rival. @param {string} rivalId */
export function garrisonPower(rivalId) {
  const idx = Math.max(0, rivals().findIndex((r) => r.id === rivalId));
  return 12 + idx * 8 + currentEra() * 3;
}

/** @param {string} rivalId */
export function canConquer(rivalId) {
  const a = army();
  if (!a.barracks || a.expedition || a.territories[rivalId] || !rivalOf(rivalId)) return false;
  return armyPower() > 0;
}

/** Manda TODO o exército em casa para conquistar o território do rival. @param {string} rivalId */
export function sendExpedition(rivalId) {
  if (!canConquer(rivalId)) return false;
  const a = army();
  a.expedition = { rival: rivalId, eta: EXPEDITION_TIME, total: EXPEDITION_TIME, power: armyPower() * morale(), units: { ...a.units } };
  a.units = {};
  const r = /** @type {any} */ (rivalOf(rivalId));
  log(`⚔️ Expedição partiu para o território ${r.name.toLowerCase()} (chega em ${EXPEDITION_TIME}s).`, 'good');
  return true;
}

function resolveExpedition() {
  const a = army();
  const ex = /** @type {Expedition} */ (a.expedition);
  a.expedition = null;
  const r = rivalOf(ex.rival);
  const need = garrisonPower(ex.rival);
  // sobreviventes voltam para casa
  const keep = ex.power >= need ? 0.75 : 0.4;
  for (const id in ex.units) a.units[id] = (a.units[id] || 0) + Math.floor(ex.units[id] * keep);
  if (ex.power >= need) {
    a.territories[ex.rival] = true;
    a.threats = a.threats.filter((t) => t.rival !== ex.rival);
    state.approval = Math.min(100, (state.approval || 0) + 10);
    log(`🏴 Território ${r ? r.name.toLowerCase() : ''} conquistado! Paga ${fmtMoney(TRIBUTE)}/dia de tributo e não ataca mais.`, 'good');
    return true;
  }
  log(`⚔️ A expedição foi repelida pela guarnição (força ${need}). Sobreviventes voltaram.`, 'bad');
  return false;
}

export const tributePerDay = () => Object.keys(army().territories).length * TRIBUTE;
export const upkeepPerDay = () => UNITS.reduce((s, u) => s + (army().units[u.id] || 0) * u.upkeep, 0);

let lastDay = -1;
/** @param {number} dt */
export function updateArmy(dt) {
  const a = army();
  if (lastDay < 0) lastDay = state.day;
  if (state.day !== lastDay) {
    lastDay = state.day;
    const tribute = tributePerDay();
    if (tribute) { state.money += tribute; state.totalEarnings = (state.totalEarnings || 0) + tribute; }
    state.money = Math.max(0, state.money - upkeepPerDay());
  }
  if (currentEra() >= 3) {
    const open = rivals().filter((r) => !a.territories[r.id]);
    a.nextThreatIn -= dt;
    if (a.nextThreatIn <= 0 && open.length && a.threats.length === 0) {
      const r = open[Math.floor(Math.random() * open.length)];
      const t = { rival: r.id, border: r.border, power: threatPower(), eta: MARCH, total: MARCH };
      a.threats.push(t);
      a.nextThreatIn = 200 + Math.random() * 120;
      log(`⚠️ ${r.emoji} Os ${r.name.toLowerCase()}s marcham para a fronteira! Força ${t.power}. Chegam em ${MARCH}s.`, 'bad');
    }
  }
  for (const t of [...a.threats]) {
    t.eta -= dt;
    if (t.eta <= 0) {
      a.threats = a.threats.filter((x) => x !== t);
      resolveAttack(t);
    }
  }
  if (a.expedition) {
    a.expedition.eta -= dt;
    if (a.expedition.eta <= 0) resolveExpedition();
  }
}

/** Ataque mais próximo (para o HUD e o conselheiro). @returns {Threat | null} */
export function nextThreat() {
  const a = army();
  return a.threats.length ? a.threats.reduce((p, q) => (q.eta < p.eta ? q : p)) : null;
}

/** Bandidos fogem se houver um mínimo de exército em casa. */
export const scaresBandits = () => armyPower() >= 3;

