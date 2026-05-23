// main.js — entry point: ciclo principal, eventos e inicialização
import { state, log } from './state.js';
import { $ } from './util.js';
import { ROMAN, CFG } from './data.js';
import { currentEra } from './progression.js';
import { saveGame, loadGame, deleteSave, updateSaveStatus, AUTOSAVE_INTERVAL } from './save.js';
import { tryHire, tryFireMiner, openDeposit, updateDeposits, updateCart } from './mine.js';
import { buyFactory, setRecipe, updateFactories } from './factories.js';
import { updateWagon } from './wagon.js';
import { updateContract, updateDay } from './contracts.js';
import { draw } from './draw.js';
import { syncUI, openDepositModal, openRecipeModal, closeModal } from './ui.js';
import { openUpgradesModal, buyUpgrade, buyEquipment, buyResearch } from './upgrades.js';

// ---------- Game over / vitória ----------
function checkEnd() {
  if (state.over) return;
  if (state.approval <= 0) {
    state.over = true;
    $('end-title').textContent = 'A população te destituiu';
    $('end-text').textContent = 'A aprovação caiu a zero. O governo central revogou seu mandato.';
    $('game-over').classList.remove('hidden');
  } else if (state.approval >= CFG.approvalMax && state.day >= 21 && state.contractsCompleted >= 10) {
    state.over = true;
    $('end-title').textContent = 'Vitória política!';
    $('end-text').textContent = `Aprovação máxima após ${state.day} dias e ${state.contractsCompleted} contratos cumpridos. Santa Catarina prospera sob a Tapuia.`;
    $('game-over').classList.remove('hidden');
  }
}

function tick(dt) {
  if (state.over) return;
  updateDeposits(dt);
  updateCart(dt);
  updateFactories(dt);
  updateWagon(dt);
  updateContract(dt);
  updateDay(dt);
  checkEnd();
}

// ---------- Loop principal ----------
let lastT = performance.now();
let autosaveTimer = 0;
let lastStatusSecond = 0;
function frame(now) {
  const dtReal = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  const dt = dtReal * state.speed;
  tick(dt);
  autosaveTimer += dtReal;
  if (autosaveTimer >= AUTOSAVE_INTERVAL) {
    autosaveTimer = 0;
    if (!state.over) saveGame();
  }
  if (Math.floor(performance.now() / 1000) !== lastStatusSecond) {
    lastStatusSecond = Math.floor(performance.now() / 1000);
    updateSaveStatus();
  }
  draw();
  syncUI();
  requestAnimationFrame(frame);
}

// ---------- Event handlers ----------
document.querySelectorAll('.speed-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.speed = parseFloat(btn.dataset.speed);
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const t = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector(`.tab-panel[data-panel="${t}"]`).classList.add('active');
  });
});

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const a = t.dataset.action;
  switch (a) {
    case 'hire':           tryHire(+t.dataset.slot); break;
    case 'fire':           tryFireMiner(+t.dataset.slot); break;
    case 'open-deposit':   openDepositModal(+t.dataset.slot); break;
    case 'confirm-open':   openDeposit(+t.dataset.slot, t.dataset.res); break;
    case 'change-recipe':  openRecipeModal(+t.dataset.fact); break;
    case 'confirm-recipe': setRecipe(+t.dataset.fact, t.dataset.recipe); break;
    case 'buy-eq':         buyEquipment(t.dataset.id); break;
    case 'buy-res':        buyResearch(t.dataset.id); break;
    case 'buy-upgrade':    buyUpgrade(t.dataset.upgId, t.dataset.upgKind); break;
  }
});

$('buy-factory-btn').addEventListener('click', buyFactory);
$('upgrades-btn').addEventListener('click', openUpgradesModal);

document.querySelectorAll('[data-close]').forEach(b => {
  b.addEventListener('click', () => closeModal(b.dataset.close));
});
document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', (e) => { if (e.target === m) m.classList.add('hidden'); });
});

$('restart-btn').addEventListener('click', () => {
  deleteSave();
  location.reload();
});
$('save-btn').addEventListener('click', () => {
  if (saveGame()) log('Partida salva.', 'good');
  else log('Falha ao salvar partida.', 'bad');
});
$('newgame-btn').addEventListener('click', () => {
  if (confirm('Apagar a partida atual e começar de novo? Não dá para desfazer.')) {
    deleteSave();
    location.reload();
  }
});
window.addEventListener('beforeunload', () => {
  if (!state.over) saveGame();
});

// ---------- INÍCIO ----------
const loaded = loadGame();
if (loaded) {
  state.eraReached = Math.max(state.eraReached || 1, currentEra());
  log(`Partida carregada (dia ${state.day}, ${state.contractsCompleted} contratos, Era ${ROMAN[state.eraReached - 1]}).`, 'good');
  updateSaveStatus();
} else {
  log('Nomeado governador de Santa Catarina. Apenas a Tapuia pode salvar o estado.');
  log(`Era I — Colônia Mineradora. Recursos limitados: comece pelo essencial.`);
  log('Extraia Carvão + Minério de Ferro → produza Lingotes de Ferro → cumpra os contratos para liberar a próxima era.');
}
requestAnimationFrame((t) => { lastT = t; frame(t); });
