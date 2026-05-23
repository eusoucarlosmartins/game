// projects.js — Projetos de obra (construções) que consomem recursos
// automaticamente quando ativos e concedem recompensa grande ao concluir.
import { state, log } from './state.js';
import { R, CFG } from './data.js';
import { fmtMoney, clamp } from './util.js';
import { currentEra } from './progression.js';
import { play } from './audio.js';

/**
 * @typedef {object} ProjectDef
 * @property {string} id
 * @property {string} name
 * @property {string} desc
 * @property {number} eraReq
 * @property {Record<string, number>} requirements
 * @property {{ money: number, approval: number, rp: number }} reward
 * @property {{ type: 'contract_bonus'|'passive_income'|'approval_floor', value: number } | null} [effect]
 */

/** @type {ProjectDef[]} */
export const PROJECT_DEFS = [
  {
    id: 'serraria',
    name: 'Serraria Municipal',
    desc: 'Centro de processamento da madeira local.',
    eraReq: 2,
    requirements: { wood: 40, stone: 30, iron_ingot: 5 },
    reward: { money: 400, approval: 8, rp: 10 },
    effect: null,
  },
  {
    id: 'igreja',
    name: 'Igreja Matriz',
    desc: 'Marco religioso e ponto de encontro da vila.',
    eraReq: 3,
    requirements: { brick: 80, wood_plank: 30, glass: 10 },
    reward: { money: 800, approval: 15, rp: 20 },
    effect: null,
  },
  {
    id: 'barragem',
    name: 'Barragem do Rio',
    desc: 'Controle de cheias e fonte de energia. +20% permanente em todos os contratos futuros.',
    eraReq: 4,
    requirements: { gunpowder: 150, steel_beam: 40, brick: 60 },
    reward: { money: 1500, approval: 20, rp: 40 },
    effect: { type: 'contract_bonus', value: 0.2 },
  },
  {
    id: 'estacao_meteo',
    name: 'Estação Meteorológica',
    desc: 'Centro de previsão e telégrafo regional.',
    eraReq: 4,
    requirements: { copper_cable: 30, telegraph: 5, glass: 20 },
    reward: { money: 1200, approval: 10, rp: 50 },
    effect: null,
  },
  {
    id: 'banco',
    name: 'Banco do Estado',
    desc: 'Renda passiva +$80 por dia em impostos extras.',
    eraReq: 5,
    requirements: { bank_safe: 3, gold_ingot: 10, steel_beam: 30 },
    reward: { money: 2000, approval: 15, rp: 60 },
    effect: { type: 'passive_income', value: 80 },
  },
  {
    id: 'catedral',
    name: 'Catedral de Pedra',
    desc: 'Símbolo final do progresso. Aprovação nunca cai abaixo de 30.',
    eraReq: 6,
    requirements: { jewel: 5, pocket_watch: 3, gold_ingot: 30, steel_beam: 80, brick: 200 },
    reward: { money: 5000, approval: 30, rp: 100 },
    effect: { type: 'approval_floor', value: 30 },
  },
];

const PROJECT_BY_ID = Object.fromEntries(PROJECT_DEFS.map((p) => [p.id, p]));

// Taxa de drenagem: 0.5 unidade/s por recurso, paralela em todos.
const DRAIN_RATE = 0.5;

export function getProjectDef(id) {
  return PROJECT_BY_ID[id];
}

export function canActivateProject(id) {
  const def = PROJECT_BY_ID[id];
  if (!def) return false;
  if (state.projects.active) return false;
  if (state.projects.completed.includes(id)) return false;
  if (currentEra() < def.eraReq) return false;
  return true;
}

export function activateProject(id) {
  const def = PROJECT_BY_ID[id];
  if (!def) return;
  if (!canActivateProject(id)) {
    log(`Não pode iniciar ${def.name} agora.`, 'bad');
    return;
  }
  state.projects.active = { id, progress: {} };
  log(`Projeto iniciado: ${def.name}.`, 'good');
}

export function cancelProject() {
  if (!state.projects.active) return;
  const def = PROJECT_BY_ID[state.projects.active.id];
  // devolve 50% dos recursos já consumidos
  for (const res in state.projects.active.progress) {
    const contributed = state.projects.active.progress[res];
    const refund = Math.floor(contributed * 0.5);
    if (refund <= 0) continue;
    const target = R[res] && R[res].kind === 'raw' ? state.warehouse : state.products;
    target[res] = (target[res] || 0) + refund;
  }
  if (def) log(`Projeto cancelado: ${def.name}. 50% dos recursos devolvidos.`, 'bad');
  state.projects.active = null;
}

export function updateProjects(dt) {
  if (!state.projects.active) return;
  const def = PROJECT_BY_ID[state.projects.active.id];
  if (!def) { state.projects.active = null; return; }
  const prog = state.projects.active.progress;
  let allDone = true;
  for (const res in def.requirements) {
    const need = def.requirements[res];
    let have = prog[res] || 0;
    if (have < need) {
      const source = R[res] && R[res].kind === 'raw' ? state.warehouse : state.products;
      const avail = source[res] || 0;
      const want = Math.min(DRAIN_RATE * dt, need - have, avail);
      if (want > 0) {
        source[res] -= want;
        have += want;
        prog[res] = have;
      }
    }
    // re-checa APÓS o consumo (pode ter completado neste mesmo frame)
    if (have < need) allDone = false;
  }
  if (allDone) completeProject(def);
}

function completeProject(def) {
  state.projects.completed.push(def.id);
  state.money += def.reward.money;
  state.approval = clamp(state.approval + def.reward.approval, 0, CFG.approvalMax);
  state.rp += def.reward.rp;
  log(
    `✨ Concluído: ${def.name}! +${fmtMoney(def.reward.money)}, +${def.reward.approval} aprov, +${def.reward.rp} PP.`,
    'good',
  );
  if (def.effect) applyEffect(def.effect);
  state.projects.active = null;
  play('chime');
}

function applyEffect(eff) {
  if (eff.type === 'contract_bonus') {
    state.permContractBonus = (state.permContractBonus || 0) + eff.value;
    log(`Efeito permanente: +${Math.round(eff.value * 100)}% em todos os contratos futuros.`, 'good');
  } else if (eff.type === 'passive_income') {
    state.passiveIncome = (state.passiveIncome || 0) + eff.value;
    log(`Efeito permanente: +${fmtMoney(eff.value)} de renda diária.`, 'good');
  } else if (eff.type === 'approval_floor') {
    state.approvalFloor = Math.max(state.approvalFloor || 0, eff.value);
    log(`Efeito permanente: aprovação nunca cai abaixo de ${eff.value}.`, 'good');
  }
}

// Helper consultado pela UI para listar projetos disponíveis (não-completos,
// não-ativos, da era atual ou anterior)
export function availableProjects() {
  const era = currentEra();
  return PROJECT_DEFS.filter(
    (p) => p.eraReq <= era && !state.projects.completed.includes(p.id),
  );
}
