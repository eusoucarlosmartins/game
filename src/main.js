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
import { W, H, WORLD_W, WORLD_H, TOOLBAR, MINE_BACK_BTN, MINIMAP, OVERWORLD, factoryRect } from './geometry.js';
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
// Câmera + drag-to-pan no overworld E na mina.
// state.mouseX/Y guarda WORLD coords (overworld) ou mine-world coords (mine area)
// pra hover detection nas funções de draw funcionarem direto.
const MINE_AREA_TOP = MINE.y; // y screen acima do qual click NÃO ativa pan da mina
function inMinimap(sx, sy) {
  return sx >= MINIMAP.x && sx < MINIMAP.x + MINIMAP.w &&
         sy >= MINIMAP.y && sy < MINIMAP.y + MINIMAP.h;
}
canvas.addEventListener('mousedown', (e) => {
  const p = canvasCoords(e);
  // No overworld, mousedown no minimap NÃO inicia pan (vira click pra teleportar)
  if (state.scene === 'overworld' && inMinimap(p.x, p.y)) return;
  if (state.scene === 'overworld') {
    state.isPanning = true;
    state.panStart = { mouseX: p.x, mouseY: p.y, cameraX: state.camera.x, cameraY: state.camera.y };
    state.panDistance = 0;
    canvas.style.cursor = 'grabbing';
  } else if (state.scene === 'mine' && p.y >= MINE_AREA_TOP) {
    // Pan da mina só quando o mousedown for dentro da área do grid (não no céu/HUD)
    state.isPanning = true;
    state.panStart = { mouseX: p.x, mouseY: p.y, cameraX: 0, cameraY: state.mineCamera.y };
    state.panDistance = 0;
    canvas.style.cursor = 'grabbing';
  }
});
canvas.addEventListener('mousemove', (e) => {
  const p = canvasCoords(e);
  if (state.isPanning && state.panStart) {
    const dx = p.x - state.panStart.mouseX;
    const dy = p.y - state.panStart.mouseY;
    if (state.scene === 'overworld') {
      const z = state.camera.zoom;
      state.camera.x = clamp(state.panStart.cameraX - dx / z, 0, Math.max(0, WORLD_W - W / z));
      state.camera.y = clamp(state.panStart.cameraY - dy / z, 0, Math.max(0, WORLD_H - H / z));
    } else if (state.scene === 'mine') {
      // Mina só permite scroll vertical (grid mais alto que viewport)
      const mineMaxY = Math.max(0, MINE.rows * MINE.cell - (H - MINE.y));
      state.mineCamera.y = clamp(state.panStart.cameraY - dy, 0, mineMaxY);
    }
    state.panDistance = Math.max(state.panDistance, Math.hypot(dx, dy));
  }
  if (state.scene === 'overworld') {
    state.mouseX = p.x / state.camera.zoom + state.camera.x;
    state.mouseY = p.y / state.camera.zoom + state.camera.y;
  } else if (state.scene === 'mine') {
    // mouseX = screen x; mouseY = world y na mina (incluindo área panned)
    state.mouseX = p.x;
    state.mouseY = p.y >= MINE_AREA_TOP ? p.y + state.mineCamera.y : p.y;
  } else {
    state.mouseX = p.x;
    state.mouseY = p.y;
  }
});
canvas.addEventListener('mouseup', () => {
  state.isPanning = false;
  state.panStart = null;
  canvas.style.cursor = state.scene === 'overworld' ? 'grab' : (state.scene === 'mine' ? 'grab' : 'default');
});
canvas.addEventListener('mouseleave', () => {
  state.mouseX = -1;
  state.mouseY = -1;
  state.isPanning = false;
  state.panStart = null;
  canvas.style.cursor = 'default';
});
canvas.addEventListener('mouseenter', () => {
  canvas.style.cursor = (state.scene === 'overworld' || state.scene === 'mine') ? 'grab' : 'default';
});
// ===== Touch (mobile): 1 dedo = pan + click; 2 dedos = pinch zoom =====
function touchCoords(t) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (t.clientX - rect.left) * (canvas.width / rect.width),
    y: (t.clientY - rect.top) * (canvas.height / rect.height),
  };
}
let pinchStart = null; // { dist, zoom, cx, cy, worldX, worldY } pra zoom
canvas.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) {
    e.preventDefault();
    const p = touchCoords(e.touches[0]);
    if (state.scene === 'overworld' && inMinimap(p.x, p.y)) return;
    if (state.scene === 'overworld') {
      state.isPanning = true;
      state.panStart = { mouseX: p.x, mouseY: p.y, cameraX: state.camera.x, cameraY: state.camera.y };
      state.panDistance = 0;
    } else if (state.scene === 'mine' && p.y >= MINE_AREA_TOP) {
      state.isPanning = true;
      state.panStart = { mouseX: p.x, mouseY: p.y, cameraX: 0, cameraY: state.mineCamera.y };
      state.panDistance = 0;
    }
  } else if (e.touches.length === 2 && state.scene === 'overworld') {
    e.preventDefault();
    state.isPanning = false;
    const p1 = touchCoords(e.touches[0]);
    const p2 = touchCoords(e.touches[1]);
    const cx = (p1.x + p2.x) / 2;
    const cy = (p1.y + p2.y) / 2;
    pinchStart = {
      dist: Math.hypot(p1.x - p2.x, p1.y - p2.y),
      zoom: state.camera.zoom,
      cx, cy,
      worldX: state.camera.x + cx / state.camera.zoom,
      worldY: state.camera.y + cy / state.camera.zoom,
    };
  }
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
  if (e.touches.length === 1 && state.isPanning && state.panStart) {
    e.preventDefault();
    const p = touchCoords(e.touches[0]);
    const dx = p.x - state.panStart.mouseX;
    const dy = p.y - state.panStart.mouseY;
    if (state.scene === 'overworld') {
      const z = state.camera.zoom;
      state.camera.x = clamp(state.panStart.cameraX - dx / z, 0, Math.max(0, WORLD_W - W / z));
      state.camera.y = clamp(state.panStart.cameraY - dy / z, 0, Math.max(0, WORLD_H - H / z));
    } else if (state.scene === 'mine') {
      const mineMaxY = Math.max(0, MINE.rows * MINE.cell - (H - MINE.y));
      state.mineCamera.y = clamp(state.panStart.cameraY - dy, 0, mineMaxY);
    }
    state.panDistance = Math.max(state.panDistance, Math.hypot(dx, dy));
  } else if (e.touches.length === 2 && pinchStart && state.scene === 'overworld') {
    e.preventDefault();
    const p1 = touchCoords(e.touches[0]);
    const p2 = touchCoords(e.touches[1]);
    const newDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    const newZoom = clamp(pinchStart.zoom * (newDist / pinchStart.dist), 0.5, 2.2);
    // Mantém o centro do pinch fixo durante o zoom
    state.camera.zoom = newZoom;
    state.camera.x = clamp(pinchStart.worldX - pinchStart.cx / newZoom, 0, Math.max(0, WORLD_W - W / newZoom));
    state.camera.y = clamp(pinchStart.worldY - pinchStart.cy / newZoom, 0, Math.max(0, WORLD_H - H / newZoom));
  }
}, { passive: false });
canvas.addEventListener('touchend', (e) => {
  // Se ainda tem 1 dedo após soltar um, sai do pinch
  if (e.touches.length < 2) pinchStart = null;
  if (e.touches.length === 0) {
    state.isPanning = false;
    // Pequenos movimentos = tap → reusa a lógica do click
    if (state.panDistance <= 8 && e.changedTouches.length === 1) {
      const p = touchCoords(e.changedTouches[0]);
      handleCanvasClick(p);
    }
    state.panStart = null;
  }
}, { passive: false });

// Scroll wheel = zoom (só no overworld). Zoom em volta do cursor (estilo Google Maps).
canvas.addEventListener('wheel', (e) => {
  if (state.scene !== 'overworld') return;
  e.preventDefault();
  const p = canvasCoords(e);
  const oldZoom = state.camera.zoom;
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  const newZoom = clamp(oldZoom * factor, 0.5, 2.2);
  // Mantém o ponto sob o cursor fixo durante o zoom
  const worldX = state.camera.x + p.x / oldZoom;
  const worldY = state.camera.y + p.y / oldZoom;
  state.camera.zoom = newZoom;
  state.camera.x = clamp(worldX - p.x / newZoom, 0, Math.max(0, WORLD_W - W / newZoom));
  state.camera.y = clamp(worldY - p.y / newZoom, 0, Math.max(0, WORLD_H - H / newZoom));
}, { passive: false });
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

function handleCanvasClick(sc) {
  // Se o usuário arrastou (>5px) durante o click, é pan — não dispara hit-tests
  if (state.panDistance > 5) {
    state.panDistance = 0;
    return;
  }
  state.panDistance = 0;
  // Hit tests de HUD usam SCREEN coords (sc.x/sc.y).
  // Hit tests do MUNDO (overworld bg/buildings, grid da mina) precisam de offset
  // pela câmera adequada — feito caso a caso abaixo.
  const x = state.scene === 'overworld' ? sc.x / state.camera.zoom + state.camera.x : sc.x;
  const y = state.scene === 'overworld' ? sc.y / state.camera.zoom + state.camera.y : sc.y;

  if (state.scene === 'overworld') {
    // Click no minimap: teleporta a câmera pra área clicada
    if (inMinimap(sc.x, sc.y)) {
      const scaleX = WORLD_W / MINIMAP.w;
      const scaleY = WORLD_H / MINIMAP.h;
      const worldX = (sc.x - MINIMAP.x) * scaleX;
      const worldY = (sc.y - MINIMAP.y) * scaleY;
      state.camera.x = clamp(worldX - W / 2, 0, WORLD_W - W);
      state.camera.y = clamp(worldY - H / 2, 0, WORLD_H - H);
      play('click');
      return;
    }
    // Click em entrada de mina (ocupada → entra; vazia → abre catálogo)
    for (let i = 0; i < OVERWORLD.mineEntrances.length; i++) {
      if (hitTest(x, y, OVERWORLD.mineEntrances[i])) {
        const m = state.mines[i];
        if (m) {
          setActiveMine(i);
          state.mineCamera.y = 0;
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
        state.mineCamera.y = 0;
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

  // Grid da mina: y screen + mineCamera.y = y world dentro do grid
  const gridY = y + state.mineCamera.y;
  if (x >= MINE.x && x < MINE.x + MINE.cols * MINE.cell &&
      gridY >= MINE.y && gridY < MINE.y + MINE.rows * MINE.cell &&
      y >= MINE.y) {
    const c = Math.floor((x - MINE.x) / MINE.cell);
    const r = Math.floor((gridY - MINE.y) / MINE.cell);
    const tool = state.tool || 'pick';
    if (tool === 'pick') tryDigClick(r, c);
    else if (tool === 'tnt') tryTNT(r, c);
    else if (tool === 'compass') tryCompass(r, c);
    else if (tool === 'miner') tryPlaceWorker(r, c);
  }
}
canvas.addEventListener('click', (e) => handleCanvasClick(canvasCoords(e)));

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
