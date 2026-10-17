// staff.js — funcionários e gerentes liberados por era, com níveis e salário diário.
// Funcionários dão bônus fixos; gerentes também AGEM sozinhos usando o conselheiro
// (sem mexer na tela do jogador) e registram o que fizeram.
import { state, log } from './state.js';
import { CFG, R, RECIPE_BY_ID, WORKER_COST, SILO_DEFAULT_CAP } from './data.js';
import { currentEra } from './progression.js';
import { adviseContract } from './advisor.js';
import { setRecipe, buyFactory } from './factories.js';
import { compassAt, isResourceUnlocked } from './mine.js';
import { sellProduct, sellRaw } from './market.js';
import { fmtMoney } from './util.js';

/**
 * @typedef {{ era: number, cost: number, salary: number, desc: string,
 *   mods?: Record<string, number>, auto?: string[] }} StaffLevel
 * @typedef {{ id: string, name: string, emoji: string, role: string, levels: StaffLevel[] }} StaffDef
 */

/** @type {StaffDef[]} */
export const STAFF = [
  {
    id: 'capataz', name: 'Capataz', emoji: '🧔', role: 'Mina',
    levels: [
      { era: 1, cost: 150, salary: 6, desc: 'Mineradores extraem 15% mais rápido.', mods: { mineRate: 0.15 } },
      { era: 2, cost: 400, salary: 10, desc: 'Mineradores extraem 30% mais rápido.', mods: { mineRate: 0.3 } },
      { era: 4, cost: 1200, salary: 18, desc: 'Mineradores extraem 50% mais rápido.', mods: { mineRate: 0.5 } },
    ],
  },
  {
    id: 'carroceiro', name: 'Carroceiro', emoji: '🐴', role: 'Transporte',
    levels: [
      { era: 1, cost: 120, salary: 5, desc: 'A carroça anda 25% mais rápido.', mods: { wagonSpd: 0.25 } },
      { era: 3, cost: 600, salary: 12, desc: 'Carroça 50% mais rápida e leva +2 por viagem.', mods: { wagonSpd: 0.5, wagonCapFlat: 2 } },
    ],
  },
  {
    id: 'gerenteContrato', name: 'Gerente de Contratos', emoji: '📋', role: 'Contratos',
    levels: [
      { era: 2, cost: 450, salary: 14, desc: 'Troca sozinho a receita das fábricas a cada pedido novo.', auto: ['switch'] },
      { era: 3, cost: 1000, salary: 20, desc: 'Também negocia: recompensa dos contratos +15%.', auto: ['switch'], mods: { contractReward: 0.15 } },
      { era: 4, cost: 2000, salary: 30, desc: 'Também consegue +20s de prazo em todo pedido.', auto: ['switch'], mods: { contractReward: 0.15, deadline: 20 } },
    ],
  },
  {
    id: 'gerenteMina', name: 'Gerente de Mina', emoji: '⛑️', role: 'Mina',
    levels: [
      { era: 2, cost: 500, salary: 15, desc: 'Coloca mineradores livres (ou ociosos) nos veios que o pedido precisa.', auto: ['mine'] },
      { era: 3, cost: 1100, salary: 22, desc: 'Também chama o geólogo e usa a Bússola sozinho ($40 por uso).', auto: ['mine', 'explore'] },
      { era: 4, cost: 2200, salary: 32, desc: 'Também contrata mineradores quando todos estão ocupados (guarda $600 de reserva).', auto: ['mine', 'explore', 'hire'] },
    ],
  },
  {
    id: 'gerenteFabrica', name: 'Gerente de Fábrica', emoji: '🏭', role: 'Fábricas',
    levels: [
      { era: 3, cost: 800, salary: 18, desc: 'Fábricas 20% mais rápidas; vende produtos encalhados com o estoque cheio.', mods: { factSpd: 0.2 }, auto: ['sellProducts'] },
      { era: 4, cost: 1800, salary: 28, desc: 'Fábricas 35% mais rápidas; vende matéria-prima que nenhuma fábrica usa quando o silo enche.', mods: { factSpd: 0.35 }, auto: ['sellProducts', 'sellRaw'] },
      { era: 5, cost: 3500, salary: 40, desc: 'Fábricas 50% mais rápidas; compra a próxima fábrica quando sobra dinheiro (reserva $1.500).', mods: { factSpd: 0.5 }, auto: ['sellProducts', 'sellRaw', 'buyFactory'] },
    ],
  },
];
export const STAFF_BY_ID = Object.fromEntries(STAFF.map((s) => [s.id, s]));

/** Nível atual (0 = não contratado). @param {string} id */
export const staffLevel = (id) => (state.staff && state.staff[id]) || 0;
/** Ativo = contratado e com salário em dia. @param {string} id */
export const staffActive = (id) => staffLevel(id) > 0 && !(state.staffUnpaid && state.staffUnpaid[id]);

/** @param {string} id @returns {StaffLevel | null} */
function currentLevelDef(id) {
  const lv = staffLevel(id);
  return lv > 0 ? STAFF_BY_ID[id].levels[lv - 1] : null;
}

/** Próximo nível disponível para contratar/promover (ou null). @param {string} id */
export function nextLevel(id) {
  const def = STAFF_BY_ID[id];
  const lv = staffLevel(id);
  return lv < def.levels.length ? def.levels[lv] : null;
}

/** Soma dos bônus de todos os funcionários ativos para um efeito. @param {string} effect */
export function staffMod(effect) {
  let total = 0;
  for (const s of STAFF) {
    if (!staffActive(s.id)) continue;
    const d = currentLevelDef(s.id);
    if (d && d.mods && d.mods[effect]) total += d.mods[effect];
  }
  return total;
}

/** @param {string} id @param {string} ability */
const can = (id, ability) => staffActive(id) && !!currentLevelDef(id)?.auto?.includes(ability);

/** @param {string} id @returns {'ok'|'era'|'money'|'max'} */
export function canHire(id) {
  const nl = nextLevel(id);
  if (!nl) return 'max';
  if (currentEra() < nl.era) return 'era';
  if (state.money < nl.cost) return 'money';
  return 'ok';
}

/** Contrata (nível 1) ou promove. @param {string} id */
export function hireOrPromote(id) {
  if (canHire(id) !== 'ok') return false;
  const nl = /** @type {StaffLevel} */ (nextLevel(id));
  state.money -= nl.cost;
  if (!state.staff) state.staff = {};
  state.staff[id] = staffLevel(id) + 1;
  if (state.staffUnpaid) delete state.staffUnpaid[id];
  const def = STAFF_BY_ID[id];
  log(state.staff[id] === 1
    ? `${def.emoji} ${def.name} contratado por ${fmtMoney(nl.cost)}. ${nl.desc}`
    : `${def.emoji} ${def.name} promovido ao nível ${state.staff[id]}. ${nl.desc}`, 'good');
  return true;
}

export function totalSalary() {
  let sum = 0;
  for (const s of STAFF) {
    const d = currentLevelDef(s.id);
    if (d) sum += d.salary;
  }
  return sum;
}

/** Folha de pagamento: chamada quando o dia vira. Quem não recebe, para até receber. */
export function payStaff() {
  if (!state.staffUnpaid) state.staffUnpaid = {};
  for (const s of STAFF) {
    const d = currentLevelDef(s.id);
    if (!d) continue;
    if (state.money >= d.salary) {
      state.money -= d.salary;
      if (state.staffUnpaid[s.id]) log(`${s.emoji} ${s.name} recebeu e voltou ao trabalho.`, 'good');
      delete state.staffUnpaid[s.id];
    } else if (!state.staffUnpaid[s.id]) {
      state.staffUnpaid[s.id] = true;
      log(`${s.emoji} ${s.name} parou: sem dinheiro para o salário (${fmtMoney(d.salary)}/dia).`, 'bad');
    }
  }
}

// ---------- Ações automáticas dos gerentes ----------
/** @param {any} mine */
const busyIn = (mine) => mine.grid.reduce((n, row) => n + row.filter((t) => t.worker).length, 0);
function totalBusy() {
  return (state.mines || []).reduce((n, m) => n + (m && m.grid ? busyIn(m) : 0), 0);
}

/** Recursos usados por alguma fábrica agora (não devem ser vendidos). */
function resourcesInUse() {
  const used = new Set();
  for (const f of state.factories) {
    used.add(f.recipeId);
    const rec = RECIPE_BY_ID[f.recipeId];
    if (rec) for (const ing in rec.in) used.add(ing);
  }
  if (state.contract) used.add(state.contract.product);
  return used;
}

/** @param {string} resource */
function assignWorkerTo(resource) {
  // prefere minerador livre; senão tira de um veio cujo minério ninguém usa
  if (state.workersTotal - totalBusy() <= 0) {
    const used = resourcesInUse();
    let freed = false;
    for (const m of state.mines || []) {
      if (!m || !m.grid || freed) continue;
      for (const row of m.grid) {
        const t = row.find((x) => x.worker && x.resource !== resource && !used.has(x.resource));
        if (t) { t.worker = false; freed = true; break; }
      }
    }
    if (!freed) return false;
  }
  for (const m of state.mines || []) {
    if (!m || !m.grid) continue;
    for (const row of m.grid) {
      const t = row.find((x) => x.revealed && x.type === 'ore' && x.resource === resource && !x.worker && x.amount > 0);
      if (t && isResourceUnlocked(resource)) {
        t.worker = true;
        return true;
      }
    }
  }
  return false;
}

let actTimer = 0;
let lastPaidDay = -1;
let lastEraSeen = -1;

/** @param {number} dt */
export function updateStaff(dt) {
  if (lastPaidDay < 0) lastPaidDay = state.day;
  if (state.day !== lastPaidDay) {
    lastPaidDay = state.day;
    payStaff();
  }
  const era = currentEra();
  if (lastEraSeen < 0) lastEraSeen = era;
  if (era > lastEraSeen) {
    lastEraSeen = era;
    for (const s of STAFF) {
      const lv = s.levels.findIndex((l) => l.era === era);
      if (lv >= 0) log(`👔 Equipe: ${s.emoji} ${s.name} nível ${lv + 1} disponível na aba Equipe.`, 'good');
    }
  }
  actTimer += dt;
  if (actTimer < 3) return;
  actTimer = 0;

  const a = adviseContract();
  if (a) {
    if (a.kind === 'switch' && can('gerenteContrato', 'switch') && a.factory !== undefined && a.recipe) {
      setRecipe(a.factory, a.recipe);
      log(`📋 Gerente de Contratos colocou a Fábrica ${a.factory + 1} em ${R[a.recipe].name}.`);
    } else if (a.kind === 'mine' && a.resource && can('gerenteMina', 'mine')) {
      if (state.workersTotal - totalBusy() <= 0 && can('gerenteMina', 'hire') && state.money >= WORKER_COST + 600) {
        state.money -= WORKER_COST;
        state.workersTotal++;
        log(`⛑️ Gerente de Mina contratou um minerador (${fmtMoney(WORKER_COST)}).`);
      }
      if (assignWorkerTo(a.resource)) log(`⛑️ Gerente de Mina pôs um minerador em ${R[a.resource].name}.`);
    } else if (a.kind === 'explore' && can('gerenteMina', 'explore') && a.mineIdx !== undefined && a.r !== undefined && a.c !== undefined && state.money >= 140) {
      if (compassAt(state.mines[a.mineIdx], a.r, a.c)) log(`⛑️ Gerente de Mina usou a Bússola e achou ${R[a.resource || 'coal'].name}.`);
    }
  }

  if (can('gerenteFabrica', 'sellProducts')) {
    const used = resourcesInUse();
    for (const id in state.products) {
      const n = Math.floor(state.products[id] || 0);
      if (n >= CFG.factoryStockMax && !used.has(id)) sellProduct(id, n - 2);
    }
  }
  if (can('gerenteFabrica', 'sellRaw')) {
    const used = resourcesInUse();
    for (const id in state.warehouse) {
      if (!R[id] || R[id].free || used.has(id)) continue;
      const cap = (state.silos[id] && state.silos[id].cap) || SILO_DEFAULT_CAP;
      const n = Math.floor(state.warehouse[id] || 0);
      if (n >= cap * 0.9) sellRaw(id, Math.floor(n / 2));
    }
  }
  if (can('gerenteFabrica', 'buyFactory') && state.factories.length < CFG.factorySlotsMax) {
    const cost = CFG.factoryCosts[state.factories.length];
    if (state.money >= cost + 1500) {
      buyFactory();
      log('🏭 Gerente de Fábrica construiu uma nova fábrica.');
    }
  }
}

/** Há algo novo para contratar/promover que o jogador pode pagar? (selo na aba Equipe) */
export function staffAttention() {
  return STAFF.some((s) => canHire(s.id) === 'ok');
}

