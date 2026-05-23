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
 * @property {{ type: 'contract_bonus'|'passive_income'|'approval_floor'|'wagon_speed'|'wagon_capacity'|'market_bonus'|'rp_bonus'|'factory_speed'|'approval_per_contract', value: number } | null} [effect]
 */

/** @type {ProjectDef[]} */
export const PROJECT_DEFS = [
  // ===== ERA 1 — Colônia Mineradora =====
  {
    id: 'vila_mineiros',
    name: 'Vila dos Mineiros',
    desc: 'Casario simples pra abrigar os primeiros trabalhadores.',
    eraReq: 1,
    requirements: { wood: 20, stone: 15, coal: 10 },
    reward: { money: 200, approval: 5, rp: 5 },
    effect: null,
  },
  {
    id: 'capela',
    name: 'Capela de Pau-a-Pique',
    desc: 'Pequeno santuário rústico — primeira marca da comunidade.',
    eraReq: 1,
    requirements: { wood: 30, stone: 25, iron_ore: 8 },
    reward: { money: 300, approval: 10, rp: 8 },
    effect: null,
  },

  // ===== ERA 2 — Vila Industrial =====
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
    id: 'vidracaria',
    name: 'Vidraçaria',
    desc: 'Forno comunitário — vidros para construção e laboratório.',
    eraReq: 2,
    requirements: { glass: 15, brick: 25, iron_ingot: 8 },
    reward: { money: 500, approval: 6, rp: 12 },
    effect: null,
  },
  {
    id: 'estrada_terra',
    name: 'Estrada de Terra Batida',
    desc: 'Liga as minas ao centro. +10% velocidade da carruagem permanente.',
    eraReq: 2,
    requirements: { wood: 50, stone: 60, nails: 10 },
    reward: { money: 350, approval: 5, rp: 8 },
    effect: { type: 'wagon_speed', value: 0.1 },
  },

  // ===== ERA 3 — Cidade Próspera =====
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
    id: 'mercado_coberto',
    name: 'Mercado Coberto',
    desc: 'Centro do comércio local. +15% no valor do Mercado Livre.',
    eraReq: 3,
    requirements: { brick: 60, wood_plank: 40, copper_ingot: 10 },
    reward: { money: 700, approval: 10, rp: 18 },
    effect: { type: 'market_bonus', value: 0.15 },
  },
  {
    id: 'praca_matriz',
    name: 'Praça da Matriz',
    desc: 'Coração cívico da cidade — afeta o moral da população.',
    eraReq: 3,
    requirements: { brick: 50, wood_plank: 25, brass: 8 },
    reward: { money: 600, approval: 20, rp: 15 },
    effect: null,
  },

  // ===== ERA 4 — Era Industrial =====
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
    id: 'ferrovia',
    name: 'Ferrovia Regional',
    desc: 'Liga os centros produtivos. Carruagem +80% capacidade permanente.',
    eraReq: 4,
    requirements: { rails: 25, steel_beam: 30, wood_plank: 80 },
    reward: { money: 1800, approval: 18, rp: 60 },
    effect: { type: 'wagon_capacity', value: 0.8 },
  },
  {
    id: 'posto_telegrafico',
    name: 'Posto Telegráfico',
    desc: 'Comunicação a longa distância — +25% nos PP de cada contrato.',
    eraReq: 4,
    requirements: { telegraph: 10, copper_cable: 40, brick: 30 },
    reward: { money: 1000, approval: 8, rp: 80 },
    effect: { type: 'rp_bonus', value: 0.25 },
  },

  // ===== ERA 5 — Era do Aço =====
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
    id: 'quartel',
    name: 'Quartel Militar',
    desc: 'Manutenção da ordem pública — aprovação nunca cai abaixo de 15.',
    eraReq: 5,
    requirements: { rifle: 20, bullets: 40, steel: 50, brick: 80 },
    reward: { money: 2200, approval: 25, rp: 50 },
    effect: { type: 'approval_floor', value: 15 },
  },
  {
    id: 'forja_vapor',
    name: 'Forja a Vapor',
    desc: 'Mecanização industrial — fábricas produzem 20% mais rápido.',
    eraReq: 5,
    requirements: { steam_engine: 4, steel_beam: 25, copper_cable: 20 },
    reward: { money: 2500, approval: 10, rp: 80 },
    effect: { type: 'factory_speed', value: 0.2 },
  },

  // ===== ERA 6 — Era do Luxo =====
  {
    id: 'catedral',
    name: 'Catedral de Pedra',
    desc: 'Símbolo final do progresso. Aprovação nunca cai abaixo de 30.',
    eraReq: 6,
    requirements: { jewel: 5, pocket_watch: 3, gold_ingot: 30, steel_beam: 80, brick: 200 },
    reward: { money: 5000, approval: 30, rp: 100 },
    effect: { type: 'approval_floor', value: 30 },
  },
  {
    id: 'teatro',
    name: 'Teatro Municipal',
    desc: 'Apogeu cultural — +30% aprovação por contrato cumprido.',
    eraReq: 6,
    requirements: { jewel: 3, lantern: 12, wood_plank: 100, brick: 120 },
    reward: { money: 4000, approval: 35, rp: 80 },
    effect: { type: 'approval_per_contract', value: 0.3 },
  },
  {
    id: 'universidade',
    name: 'Universidade',
    desc: 'Polo de conhecimento — dobra o ganho de PP de todas as fontes.',
    eraReq: 6,
    requirements: { pocket_watch: 5, telegraph: 15, brick: 150, glass: 40 },
    reward: { money: 3500, approval: 20, rp: 150 },
    effect: { type: 'rp_bonus', value: 1.0 },
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
  const pct = Math.round(eff.value * 100);
  if (eff.type === 'contract_bonus') {
    state.permContractBonus = (state.permContractBonus || 0) + eff.value;
    log(`Efeito permanente: +${pct}% em todos os contratos futuros.`, 'good');
  } else if (eff.type === 'passive_income') {
    state.passiveIncome = (state.passiveIncome || 0) + eff.value;
    log(`Efeito permanente: +${fmtMoney(eff.value)} de renda diária.`, 'good');
  } else if (eff.type === 'approval_floor') {
    state.approvalFloor = Math.max(state.approvalFloor || 0, eff.value);
    log(`Efeito permanente: aprovação nunca cai abaixo de ${eff.value}.`, 'good');
  } else if (eff.type === 'wagon_speed') {
    state.wagonSpeedBonus = (state.wagonSpeedBonus || 0) + eff.value;
    log(`Efeito permanente: +${pct}% velocidade da carruagem.`, 'good');
  } else if (eff.type === 'wagon_capacity') {
    state.wagonCapacityBonus = (state.wagonCapacityBonus || 0) + eff.value;
    log(`Efeito permanente: +${pct}% capacidade da carruagem.`, 'good');
  } else if (eff.type === 'market_bonus') {
    state.marketBonus = (state.marketBonus || 0) + eff.value;
    log(`Efeito permanente: +${pct}% no valor do Mercado Livre.`, 'good');
  } else if (eff.type === 'rp_bonus') {
    state.rpBonus = (state.rpBonus || 0) + eff.value;
    log(`Efeito permanente: +${pct}% no ganho de PP.`, 'good');
  } else if (eff.type === 'factory_speed') {
    state.factorySpeedBonus = (state.factorySpeedBonus || 0) + eff.value;
    log(`Efeito permanente: +${pct}% velocidade das fábricas.`, 'good');
  } else if (eff.type === 'approval_per_contract') {
    state.approvalPerContractBonus = (state.approvalPerContractBonus || 0) + eff.value;
    log(`Efeito permanente: +${pct}% aprovação por contrato.`, 'good');
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
