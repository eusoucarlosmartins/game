// @ts-nocheck
// main.js — entry: loop, eventos, init
import { state, log } from './state.js';
import { $ } from './util.js';
import { ROMAN, CFG, MINE } from './data.js';
import { currentEra } from './progression.js';
import { saveGame, loadGame, deleteSave, updateSaveStatus, AUTOSAVE_INTERVAL } from './save.js';
import { initMine, updateMine, tryDigClick, tryTNT, tryCompass, tryPlaceWorker, tryHireWorker, setTool } from './mine.js';
import { buyFactory, setRecipe, updateFactories } from './factories.js';
import { updateWagon } from './wagon.js';
import { updateContract, updateDay } from './contracts.js';
import { updateEvents } from './events.js';
import { updateProjects, activateProject, cancelProject } from './projects.js';
import { play, toggleMute, unlockOnFirstGesture } from './audio.js';
import { draw } from './draw.js';
import { syncUI, openRecipeModal, closeModal } from './ui.js';
import { openUpgradesModal, buyUpgrade, buyEquipment, buyResearch } from './upgrades.js';
import { sellRaw, sellAllRaw, sellProduct, sellAllProduct } from './market.js';
import { TOOLBAR, MINE_BACK_BTN, OVERWORLD } from './geometry.js';

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
  updateMine(dt);
  updateFactories(dt);
  updateWagon(dt);
  updateContract(dt);
  updateEvents(dt);
  updateProjects(dt);
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

// ---------- Canvas: mouse + click handler (tools + grid) ----------
const canvas = document.getElementById('game');
function canvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}
canvas.addEventListener('mousemove', (e) => {
  const p = canvasCoords(e);
  state.mouseX = p.x;
  state.mouseY = p.y;
});
canvas.addEventListener('mouseleave', () => {
  state.mouseX = -1;
  state.mouseY = -1;
});
function hitTest(x, y, r) {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

canvas.addEventListener('click', (e) => {
  const { x, y } = canvasCoords(e);

  if (state.scene === 'overworld') {
    // Click na entrada da mina → entra na cena mina
    if (hitTest(x, y, OVERWORLD.mineEntrance)) {
      state.scene = 'mine';
      play('whoosh');
      log('Entrou na mina. Use a picareta para cavar, e o minerador pra alocar trabalhadores em veios.');
    }
    return;
  }

  // ----- Cena MINA -----
  // Botão "← Voltar ao Mapa"
  if (hitTest(x, y, MINE_BACK_BTN)) {
    state.scene = 'overworld';
    play('whoosh');
    return;
  }

  // Toolbar lateral
  if (x >= TOOLBAR.x && x < TOOLBAR.x + TOOLBAR.w && y >= TOOLBAR.y) {
    const idx = Math.floor((y - TOOLBAR.y) / TOOLBAR.slotH);
    const order = ['pick', 'tnt', 'compass', 'miner'];
    if (idx >= 0 && idx < order.length) {
      const slotY = TOOLBAR.y + idx * TOOLBAR.slotH;
      if (y < slotY + TOOLBAR.w) setTool(order[idx]);
    }
    return;
  }

  // Grid da mina
  if (x >= MINE.x && x < MINE.x + MINE.cols * MINE.cell &&
      y >= MINE.y && y < MINE.y + MINE.rows * MINE.cell) {
    const c = Math.floor((x - MINE.x) / MINE.cell);
    const r = Math.floor((y - MINE.y) / MINE.cell);
    const tool = state.mine.tool || 'pick';
    if (tool === 'pick') tryDigClick(r, c);
    else if (tool === 'tnt') tryTNT(r, c);
    else if (tool === 'compass') tryCompass(r, c);
    else if (tool === 'miner') tryPlaceWorker(r, c);
  }
});

// ---------- Atalhos de teclado ----------
document.addEventListener('keydown', (e) => {
  // Ignora se estiver digitando em input/textarea ou se modal aberto
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (document.querySelector('.modal:not(.hidden)')) return;
  switch (e.key) {
    case '1': setTool('pick'); break;
    case '2': setTool('tnt'); break;
    case '3': setTool('compass'); break;
    case '4': setTool('miner'); break;
    case ' ': e.preventDefault(); state.speed = state.speed > 0 ? 0 : 1; break;
    case 'u': case 'U': openUpgradesModal(); break;
    case 'm': case 'M': { toggleMute(); updateMuteBtn(); play('click'); break; }
  }
});

function updateMuteBtn() {
  const btn = $('mute-btn');
  if (btn) {
    btn.textContent = state.muted ? '🔇' : '🔊';
    btn.title = state.muted ? 'Som desligado (M)' : 'Som ligado (M)';
  }
}

// ---------- Event handlers (DOM) ----------
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
    case 'change-recipe':  openRecipeModal(+t.dataset.fact); break;
    case 'confirm-recipe': setRecipe(+t.dataset.fact, t.dataset.recipe); break;
    case 'buy-eq':         buyEquipment(t.dataset.id); break;
    case 'buy-res':        buyResearch(t.dataset.id); break;
    case 'buy-upgrade':    buyUpgrade(t.dataset.upgId, t.dataset.upgKind); break;
    case 'sell-raw': {
      if (t.dataset.amt === 'all') sellAllRaw(t.dataset.id);
      else sellRaw(t.dataset.id, parseInt(t.dataset.amt, 10) || 1);
      break;
    }
    case 'sell-prod': {
      if (t.dataset.amt === 'all') sellAllProduct(t.dataset.id);
      else sellProduct(t.dataset.id, parseInt(t.dataset.amt, 10) || 1);
      break;
    }
    case 'project-start':  activateProject(t.dataset.id); break;
    case 'project-cancel': cancelProject(); break;
    case 'tool-select':    setTool(t.dataset.tool); play('click'); break;
  }
});

// ---------- Sidebar drawer (mobile) ----------
const sidebar = document.querySelector('.sidebar');
const sidebarToggle = $('sidebar-toggle');
const sidebarBackdrop = $('sidebar-backdrop');
function setSidebarOpen(open) {
  if (!sidebar) return;
  sidebar.classList.toggle('open', open);
  if (sidebarBackdrop) sidebarBackdrop.classList.toggle('show', open);
}
if (sidebarToggle && sidebar) {
  sidebarToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    setSidebarOpen(!sidebar.classList.contains('open'));
    play('click');
  });
  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', () => setSidebarOpen(false));
  }
}

$('buy-factory-btn').addEventListener('click', buyFactory);
$('upgrades-btn').addEventListener('click', openUpgradesModal);
$('hire-worker-btn').addEventListener('click', tryHireWorker);
$('mute-btn').addEventListener('click', () => { toggleMute(); updateMuteBtn(); play('click'); });

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
  if (!state.mine || !state.mine.grid) initMine();
  log(`Partida carregada (dia ${state.day}, ${state.contractsCompleted} contratos, Era ${ROMAN[state.eraReached - 1]}).`, 'good');
  updateSaveStatus();
} else {
  initMine();
  log('Bem-vindo, governador. Esta é a vista do mapa de Santa Catarina.');
  log('Clique na ENTRADA DA MINA (à esquerda) para descer e cavar minérios.');
  log('No mapa você vê fábricas e a cidade do contrato atual. Contratos pagam $$$ e PP.');
}
unlockOnFirstGesture();
updateMuteBtn();
requestAnimationFrame((t) => { lastT = t; frame(t); });
