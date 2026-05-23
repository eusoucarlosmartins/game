// main.js — entry: loop, eventos, init
import { state, log } from './state.js';
import { $ } from './util.js';
import { ROMAN, CFG, MINE } from './data.js';
import { currentEra } from './progression.js';
import { saveGame, loadGame, deleteSave, updateSaveStatus, AUTOSAVE_INTERVAL } from './save.js';
import { initMines, updateMine, tryDigClick, tryTNT, tryCompass, tryPlaceWorker, tryHireWorker, setTool, setActiveMine, buyMine, regenerateMine, activeMine as getActiveMine } from './mine.js';
import { buyFactory, setRecipe, updateFactories } from './factories.js';
import { updateWagon } from './wagon.js';
import { updateContract, updateDay } from './contracts.js';
import { updateEvents } from './events.js';
import { updateProjects, activateProject, cancelProject } from './projects.js';
import { play, toggleMute, unlockOnFirstGesture } from './audio.js';
import { draw } from './draw.js';
import { syncUI, openRecipeModal, openBuyMineModal, closeModal } from './ui.js';
import { openUpgradesModal, buyUpgrade, buyEquipment, buyResearch } from './upgrades.js';
import { sellRaw, sellAllRaw, sellProduct, sellAllProduct } from './market.js';
import { W, H, WORLD_W, WORLD_H, TOOLBAR, MINE_BACK_BTN, OVERWORLD, factoryRect } from './geometry.js';
import { clamp } from './util.js';

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
  // Auto-dismiss do último passo do tutorial
  if (state.tutorial && !state.tutorial.dismissed && state.tutorial.step === 2) {
    state.tutorial.autoDismissIn = (state.tutorial.autoDismissIn ?? 12) - dt;
    if (state.tutorial.autoDismissIn <= 0) state.tutorial.dismissed = true;
  }
  checkEnd();
}

// ---------- Loop principal ----------
let lastT = performance.now();
let autosaveTimer = 0;
let lastStatusSecond = 0;
function frame(now) {
  try {
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
  } catch (err) {
    console.error('[tick]', err);
  }
  try {
    draw();
  } catch (err) {
    console.error('[draw]', err);
  }
  try {
    syncUI();
  } catch (err) {
    console.error('[syncUI]', err);
  }
  requestAnimationFrame(frame);
}

// ---------- Canvas: mouse + click handler (tools + grid) ----------
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
/**
 * Converte coords da página → coords do canvas (1280x720 logical).
 * @param {MouseEvent} e
 * @returns {{x: number, y: number}}
 */
function canvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}
// Câmera + drag-to-pan no overworld.
// state.mouseX/Y guarda WORLD coords no overworld (pra hover detection nas funções
// de draw funcionarem direto), e SCREEN coords no mine scene.
canvas.addEventListener('mousedown', (e) => {
  if (state.scene !== 'overworld') return;
  const p = canvasCoords(e);
  state.isPanning = true;
  state.panStart = { mouseX: p.x, mouseY: p.y, cameraX: state.camera.x, cameraY: state.camera.y };
  state.panDistance = 0;
  canvas.style.cursor = 'grabbing';
});
canvas.addEventListener('mousemove', (e) => {
  const p = canvasCoords(e);
  if (state.isPanning && state.panStart) {
    const dx = p.x - state.panStart.mouseX;
    const dy = p.y - state.panStart.mouseY;
    state.camera.x = clamp(state.panStart.cameraX - dx, 0, WORLD_W - W);
    state.camera.y = clamp(state.panStart.cameraY - dy, 0, WORLD_H - H);
    state.panDistance = Math.max(state.panDistance, Math.hypot(dx, dy));
  }
  if (state.scene === 'overworld') {
    state.mouseX = p.x + state.camera.x;
    state.mouseY = p.y + state.camera.y;
  } else {
    state.mouseX = p.x;
    state.mouseY = p.y;
  }
});
canvas.addEventListener('mouseup', () => {
  state.isPanning = false;
  state.panStart = null;
  canvas.style.cursor = state.scene === 'overworld' ? 'grab' : 'default';
});
canvas.addEventListener('mouseleave', () => {
  state.mouseX = -1;
  state.mouseY = -1;
  state.isPanning = false;
  state.panStart = null;
  canvas.style.cursor = 'default';
});
canvas.addEventListener('mouseenter', () => {
  canvas.style.cursor = state.scene === 'overworld' ? 'grab' : 'default';
});
function hitTest(x, y, r) {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/** @param {string} name */
function switchTab(name) {
  const btn = /** @type {HTMLElement|null} */ (document.querySelector(`.tab[data-tab="${name}"]`));
  if (btn) btn.click();
  // Em mobile, abre o drawer pra ver a aba imediatamente
  const sb = document.querySelector('.sidebar');
  const bd = document.getElementById('sidebar-backdrop');
  if (sb && window.matchMedia('(max-width: 900px)').matches) {
    sb.classList.add('open');
    if (bd) bd.classList.add('show');
  }
}

canvas.addEventListener('click', (e) => {
  // Se o usuário arrastou (>5px) durante o click, é pan — não dispara hit-tests
  if (state.panDistance > 5) {
    state.panDistance = 0;
    return;
  }
  state.panDistance = 0;
  const sc = canvasCoords(e);
  // No overworld, hit-tests usam WORLD coords (offset pela câmera)
  const x = state.scene === 'overworld' ? sc.x + state.camera.x : sc.x;
  const y = state.scene === 'overworld' ? sc.y + state.camera.y : sc.y;

  if (state.scene === 'overworld') {
    // Click em entrada de mina (ocupada → entra; vazia → abre catálogo)
    for (let i = 0; i < OVERWORLD.mineEntrances.length; i++) {
      if (hitTest(x, y, OVERWORLD.mineEntrances[i])) {
        const m = state.mines[i];
        if (m) {
          setActiveMine(i);
          state.scene = 'mine';
          if (state.tutorial && !state.tutorial.dismissed && state.tutorial.step === 0) {
            state.tutorial.step = 1;
          }
          play('whoosh');
          log(`Entrou em ${m.name}. Aloque mineradores em veios descobertos.`);
        } else {
          openBuyMineModal();
          play('click');
        }
        return;
      }
    }
    // Mercado node → abre aba Mercado
    if (hitTest(x, y, OVERWORLD.mercadoNode)) {
      switchTab('market');
      play('click');
      return;
    }
    // Pesquisa node → abre modal de Upgrades
    if (hitTest(x, y, OVERWORLD.pesquisaNode)) {
      openUpgradesModal();
      play('click');
      return;
    }
    // Click numa fábrica (prédio ou painel acima) → abre modal de receita
    for (let i = 0; i < state.factories.length; i++) {
      const r = factoryRect(i);
      // painel mini de receita acima (44px + 8px gap)
      const panelArea = { x: r.x, y: r.y - 52, w: r.w, h: 52 };
      if (hitTest(x, y, r) || hitTest(x, y, panelArea)) {
        openRecipeModal(i);
        play('click');
        return;
      }
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
  // Botão "Regenerar" no banner de mina esgotada
  {
    const m = getActiveMine();
    if (m && m.exhausted) {
      const bw = 240, bh = 38;
      const bx = (W - bw) / 2;
      const by = MINE.y + (MINE.rows * MINE.cell) / 2 - 50 + 60 + 12;
      if (hitTest(x, y, { x: bx, y: by, w: bw, h: bh })) {
        regenerateMine(state.activeMineIdx);
        return;
      }
    }
  }
  // Botões de troca de mina (canto superior direito)
  if (state.mines && state.mines.length >= 2) {
    const btnW = 110, btnH = 28, startY = 56;
    for (let i = 0; i < state.mines.length; i++) {
      const r = { x: W - btnW - 14, y: startY + i * (btnH + 6), w: btnW, h: btnH };
      if (hitTest(x, y, r)) {
        setActiveMine(i);
        play('click');
        return;
      }
    }
  }
  // Click em qualquer lugar fecha o último passo do tutorial
  if (state.tutorial && !state.tutorial.dismissed && state.tutorial.step === 2) {
    state.tutorial.dismissed = true;
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
    const tool = state.tool || 'pick';
    if (tool === 'pick') tryDigClick(r, c);
    else if (tool === 'tnt') tryTNT(r, c);
    else if (tool === 'compass') tryCompass(r, c);
    else if (tool === 'miner') tryPlaceWorker(r, c);
  }
});

// ---------- Atalhos de teclado ----------
document.addEventListener('keydown', (e) => {
  // Ignora se estiver digitando em input/textarea ou se modal aberto
  const tag = /** @type {HTMLElement|null} */ (e.target)?.tagName;
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
document.querySelectorAll('.speed-btn').forEach((btn) => {
  const el = /** @type {HTMLElement} */ (btn);
  el.addEventListener('click', () => {
    state.speed = parseFloat(el.dataset.speed || '1');
    document.querySelectorAll('.speed-btn').forEach((b) => b.classList.remove('active'));
    el.classList.add('active');
  });
});

document.querySelectorAll('.tab').forEach((btn) => {
  const el = /** @type {HTMLElement} */ (btn);
  el.addEventListener('click', () => {
    const t = el.dataset.tab;
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    const panel = document.querySelector(`.tab-panel[data-panel="${t}"]`);
    if (panel) panel.classList.add('active');
  });
});

document.addEventListener('click', (e) => {
  const target = /** @type {HTMLElement|null} */ (e.target);
  if (!target) return;
  const t = /** @type {HTMLElement|null} */ (target.closest('[data-action]'));
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
    case 'confirm-buy-mine': {
      buyMine(t.dataset.id);
      closeModal('modal-buy-mine');
      break;
    }
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

document.querySelectorAll('[data-close]').forEach((b) => {
  const el = /** @type {HTMLElement} */ (b);
  el.addEventListener('click', () => closeModal(el.dataset.close || ''));
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
  // Garante array de minas válido após carregar (migração já feita em save.js)
  if (!state.mines || state.mines.length === 0) initMines();
  // Saves antigos sem campo tutorial: marca como dismissed (não atrapalha)
  if (!state.tutorial) state.tutorial = { step: 0, dismissed: true, autoDismissIn: 0 };
  log(`Partida carregada (dia ${state.day}, ${state.contractsCompleted} contratos, Era ${ROMAN[state.eraReached - 1]}).`, 'good');
  updateSaveStatus();
} else {
  initMines();
  log('Bem-vindo, governador. Esta é a vista do mapa de Santa Catarina.');
  log('Clique em uma das MINAS à esquerda para descer e cavar. Você tem 2 minas iniciais.');
  log('Recursos esgotam com o tempo — pode explorar várias minas em paralelo.');
}
unlockOnFirstGesture();
updateMuteBtn();

// ---------- PWA: service worker + install prompt ----------
if ('serviceWorker' in navigator && import.meta.env?.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('[PWA] SW falhou:', err);
    });
  });
}

let deferredInstall = null;
const installBtn = $('install-btn');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  if (installBtn) installBtn.style.display = 'inline-flex';
});
if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    const choice = await deferredInstall.userChoice;
    if (choice.outcome === 'accepted') {
      log('App instalado. Veja o ícone na sua tela inicial.', 'good');
      play('success');
    }
    deferredInstall = null;
    installBtn.style.display = 'none';
  });
}
window.addEventListener('appinstalled', () => {
  if (installBtn) installBtn.style.display = 'none';
  log('Tapuia instalado como app. Pode abrir do ícone na home.', 'good');
});

requestAnimationFrame((t) => { lastT = t; frame(t); });
