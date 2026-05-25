// save.js — persistência em localStorage com 3 slots independentes.
// Slot ativo é guardado em ACTIVE_KEY; cada slot tem sua própria chave
// 'tapuia_save_v2_slotN' (N = 1, 2, 3).
import { state } from './state.js';
import { R, SILO_DEFAULT_CAP } from './data.js';
import { $ } from './util.js';

export const SAVE_VERSION = 2;
export const AUTOSAVE_INTERVAL = 15;
const LEGACY_KEY = 'tapuia_save_v2'; // pre-slot
const ACTIVE_KEY = 'tapuia_active_slot';
export const SAVE_SLOTS = [1, 2, 3];

function slotKey(slot) { return `tapuia_save_v2_slot${slot}`; }

export function getActiveSlot() {
  try {
    const s = parseInt(localStorage.getItem(ACTIVE_KEY) || '1', 10);
    return SAVE_SLOTS.includes(s) ? s : 1;
  } catch { return 1; }
}

export function setActiveSlot(slot) {
  if (!SAVE_SLOTS.includes(slot)) return;
  try { localStorage.setItem(ACTIVE_KEY, String(slot)); } catch { /* ignore */ }
}

// Migra save legado pro slot 1 na primeira vez que carrega
function migrateLegacyIfNeeded() {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return;
    if (localStorage.getItem(slotKey(1))) {
      // já tem slot 1; só remove o legado pra não confundir
      localStorage.removeItem(LEGACY_KEY);
      return;
    }
    localStorage.setItem(slotKey(1), legacy);
    localStorage.removeItem(LEGACY_KEY);
  } catch { /* ignore */ }
}

const PERSIST_KEYS = [
  'money','approval','day','dayTimer','speed','over',
  'mines','activeMineIdx','tool','workersTotal','workers','tilesDug',
  'factories','warehouse','products','silos','recipeCap',
  'contract','contracts','currentCity','nextContractIn','contractsCompleted',
  'equipment','research','rp','eraReached','log',
  'projects','permContractBonus','passiveIncome','approvalFloor',
  'wagonSpeedBonus','wagonCapacityBonus','marketBonus','rpBonus','factorySpeedBonus','approvalPerContractBonus',
  'muted','musicEnabled','scene','tutorial','difficulty','dailyChallenge',
  'totalEarnings','oreMined','cityGrowth','tntUses','achievements','history','gameMode',
  'victoryShown',
];

let lastSaveTime = 0;

export function saveGame(slot) {
  const s = slot ?? getActiveSlot();
  try {
    const data = { version: SAVE_VERSION, savedAt: Date.now() };
    for (const k of PERSIST_KEYS) data[k] = state[k];
    localStorage.setItem(slotKey(s), JSON.stringify(data));
    lastSaveTime = Date.now();
    updateSaveStatus();
    return true;
  } catch (e) {
    console.error('Falha ao salvar:', e);
    return false;
  }
}

export function loadGame(slot) {
  migrateLegacyIfNeeded();
  const s = slot ?? getActiveSlot();
  try {
    const raw = localStorage.getItem(slotKey(s));
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data.version !== SAVE_VERSION) {
      console.warn('Versão de save incompatível, ignorando.');
      return false;
    }
    for (const k of PERSIST_KEYS) {
      if (data[k] !== undefined) state[k] = data[k];
    }
    // Garante chaves para recursos novos adicionados após o save
    for (const k in R) {
      if (R[k].kind === 'raw' && !R[k].free) {
        if (state.warehouse[k] === undefined) state.warehouse[k] = 0;
        if (!state.silos[k]) state.silos[k] = { cap: SILO_DEFAULT_CAP };
      }
      if (R[k].kind === 'prod' && state.products[k] === undefined) state.products[k] = 0;
    }
    // Migração antiga: state.mine (single) → state.mines[] (array)
    // @ts-ignore — campo legado
    if (state.mine && (!state.mines || state.mines.length === 0)) {
      // @ts-ignore
      const old = state.mine;
      state.mines = [{
        id: 'mina_central', name: 'Mina Central',
        grid: old.grid || null, tntFx: null, exhausted: false,
        elevator: { y: 0, dir: 1 },
      }];
      state.activeMineIdx = 0;
      state.tool = old.tool || 'pick';
      // @ts-ignore
      delete state.mine;
    }
    for (const m of (state.mines || [])) m.tntFx = null;
    for (const f of (state.factories || [])) {
      if (!f.wagon) f.wagon = { pos: 0, dir: 0, product: null, load: 0, state: 'idle', timer: 0 };
    }
    // Migração: saves antigos só tinham state.contract single. Garante contracts[] sincronizado.
    if (!Array.isArray(state.contracts)) state.contracts = [];
    if (state.contract && !state.contracts.includes(state.contract)) {
      state.contracts.unshift(state.contract);
    }
    state.contract = state.contracts[0] || null;
    // @ts-ignore — campo legado
    if (state.wagon) delete state.wagon;
    lastSaveTime = data.savedAt || Date.now();
    return true;
  } catch (e) {
    console.error('Falha ao carregar:', e);
    return false;
  }
}

export function deleteSave(slot) {
  const s = slot ?? getActiveSlot();
  try { localStorage.removeItem(slotKey(s)); } catch { /* ignore */ }
}

// Metadados de um slot pra exibir no modal (sem carregar o save todo no state)
export function getSlotInfo(slot) {
  try {
    const raw = localStorage.getItem(slotKey(slot));
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      day: data.day || 1,
      contractsCompleted: data.contractsCompleted || 0,
      eraReached: data.eraReached || 1,
      money: data.money || 0,
      difficulty: data.difficulty || 'normal',
      savedAt: data.savedAt || 0,
      currentCity: data.currentCity || '—',
    };
  } catch { return null; }
}

export function updateSaveStatus() {
  const el = $('save-status');
  if (!el) return;
  if (!lastSaveTime) { el.textContent = `slot ${getActiveSlot()} · vazio`; return; }
  const ago = Math.floor((Date.now() - lastSaveTime) / 1000);
  let when;
  if (ago < 5) when = 'agora';
  else if (ago < 60) when = `${ago}s`;
  else if (ago < 3600) when = `${Math.floor(ago/60)} min`;
  else when = `${Math.floor(ago/3600)}h`;
  el.textContent = `slot ${getActiveSlot()} · salvo ${when}`;
}
