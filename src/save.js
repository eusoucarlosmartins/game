// save.js — persistência em localStorage. Versão 2 = mina em grid (incompatível com v1).
import { state } from './state.js';
import { R, SILO_DEFAULT_CAP } from './data.js';
import { $ } from './util.js';

export const SAVE_KEY = 'tapuia_save_v2';
export const SAVE_VERSION = 2;
export const AUTOSAVE_INTERVAL = 15; // segundos de tempo real

const PERSIST_KEYS = [
  'money','approval','day','dayTimer','speed','over',
  'mine','workersTotal','tilesDug','factories','warehouse','products','silos',
  'contract','currentCity','nextContractIn','contractsCompleted',
  'equipment','research','rp','eraReached','log',
  'projects','permContractBonus','passiveIncome','approvalFloor',
  'muted','scene',
];

let lastSaveTime = 0;

export function saveGame() {
  try {
    const data = { version: SAVE_VERSION, savedAt: Date.now() };
    for (const k of PERSIST_KEYS) data[k] = state[k];
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    lastSaveTime = Date.now();
    updateSaveStatus();
    return true;
  } catch (e) {
    console.error('Falha ao salvar:', e);
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
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
    // Reseta efeitos transitórios da mina
    if (state.mine) state.mine.tntFx = null;
    // Wagon volta ao idle pra evitar travas
    state.wagon = { pos: 0, dir: 0, product: null, load: 0, state: 'idle', timer: 0 };
    lastSaveTime = data.savedAt || Date.now();
    return true;
  } catch (e) {
    console.error('Falha ao carregar:', e);
    return false;
  }
}

export function deleteSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export function updateSaveStatus() {
  const el = $('save-status');
  if (!el) return;
  if (!lastSaveTime) { el.textContent = 'sem gravação'; return; }
  const ago = Math.floor((Date.now() - lastSaveTime) / 1000);
  if (ago < 5) el.textContent = 'salvo agora';
  else if (ago < 60) el.textContent = `salvo há ${ago}s`;
  else if (ago < 3600) el.textContent = `salvo há ${Math.floor(ago/60)} min`;
  else el.textContent = `salvo há ${Math.floor(ago/3600)}h`;
}
