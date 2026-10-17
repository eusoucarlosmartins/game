// main.js — entry: loop, eventos, init
import { state, log } from './state.js';
import { $ } from './util.js';
import { ROMAN, CFG, MINE, ACHIEVEMENTS, CIV_BY_ID } from './data.js';
import { currentEra } from './progression.js';
import { saveGame, loadGame, deleteSave, updateSaveStatus, AUTOSAVE_INTERVAL } from './save.js';
import { initMines, connectToShaft, updateMine, tryDigClick, tryTNT, tryCompass, tryPlaceWorker, tryHireWorker, setTool, setActiveMine, buyMine, regenerateMine, activeMine as getActiveMine } from './mine.js';
import { buyFactory, setRecipe, updateFactories } from './factories.js';
import { updateWagon } from './wagon.js';
import { updateContract, updateDay } from './contracts.js';
import { updateEvents } from './events.js';
import { updateProjects, activateProject, cancelProject } from './projects.js';
import { checkAchievements, updateAchievementToast } from './achievements.js';
import { play, toggleMute, unlockOnFirstGesture } from './audio.js';
import { draw } from './draw.js';
import { syncUI, openRecipeModal, openBuyMineModal, openCivilizationModal, closeModal, openSiteModal } from './ui.js';
import { openUpgradesModal, buyUpgrade, buyEquipment, buyResearch } from './upgrades.js';
import { sellRaw, sellAllRaw, sellProduct, sellAllProduct } from './market.js';
import { chooseCivilization } from './civilizations.js';
import { loadSprites } from './sprites.js';
import { W } from './geometry.js';
import { resizeCanvas, screenToWorld, screenToHud, hudSize, centerOn } from './camera.js';
import { attachInput } from './input.js';
import { initHud, syncHud, openPanel, haptic } from './hud.js';
import { minimapLayout, minimapToWorld } from './terrain.js';
import { pickOverworld } from './overworld.js';
import { proj } from './iso.js';
import { freshStartIfNeeded } from './reset.js';
import { updateStaff, hireOrPromote } from './staff.js';
import { buildSite } from './sites.js';
import { addSiteWorker } from './hud.js';

// ---------- Game over / vitória ----------
function fmt(n) { return Math.floor(n).toLocaleString('pt-BR'); }

function populateGameOverModal(victory) {
  const card = document.querySelector('.gameover-card');
  if (card) {
    card.classList.remove('victory', 'defeat');
    card.classList.add(victory ? 'victory' : 'defeat');
  }
  const emblem = $('gameover-emblem');
  if (emblem) emblem.textContent = victory ? '🏆' : '💀';

  const civ = state.civilization ? CIV_BY_ID[state.civilization] : null;
  const completedProj = ((state.projects && state.projects.completed) || []).length;
  const achUnlocked = Object.keys(state.achievements || {}).length;

  const statsEl = $('gameover-stats');
  if (statsEl) {
    const rows = [
      ['Civilização', civ ? `${civ.emoji} ${civ.name}` : '—'],
      ['Era atual', ROMAN[(state.eraReached || 1) - 1]],
      ['Dia', state.day],
      ['Aprovação final', Math.round(state.approval) + '%'],
      ['Contratos cumpridos', state.contractsCompleted],
      ['Projetos concluídos', completedProj],
      ['Dinheiro total ganho', '$' + fmt(state.totalEarnings || 0)],
      ['Tiles cavados', fmt(state.tilesDug || 0)],
      ['Mineradores contratados', state.workersTotal],
      ['Conquistas', `${achUnlocked}/${ACHIEVEMENTS.length}`],
    ];
    statsEl.innerHTML = rows.map(([l, v]) =>
      `<div class="row"><span class="label">${l}</span><span class="value">${v}</span></div>`
    ).join('');
  }
  const achEl = $('gameover-achievements');
  if (achEl) {
    achEl.innerHTML = ACHIEVEMENTS.map((a) => {
      const owned = (state.achievements || {})[a.id];
      return `<li class="${owned ? 'unlocked' : 'locked'}" title="${a.name}: ${a.desc}">${a.emoji}</li>`;
    }).join('');
  }
}

function checkEnd() {
  if (state.over) return;
  if (state.approval <= 0) {
    state.over = true;
    $('end-title').textContent = 'A população te destituiu';
    $('end-text').textContent = 'Sua aprovação caiu a zero. O governo central revogou seu mandato.';
    populateGameOverModal(false);
    $('game-over').classList.remove('hidden');
    play('fail');
  } else if (state.approval >= CFG.approvalMax && state.day >= 21 && state.contractsCompleted >= 10) {
    state.over = true;
    $('end-title').textContent = 'Vitória política!';
    $('end-text').textContent = `Aprovação máxima após ${state.day} dias e ${state.contractsCompleted} contratos cumpridos. Santa Catarina prospera sob a Tapuia.`;
    populateGameOverModal(true);
    $('game-over').classList.remove('hidden');
    play('chime');
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
  updateStaff(dt);
  checkAchievements();
  updateAchievementToast(dt);
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
    syncHud();
  } catch (err) {
    console.error('[syncUI]', err);
  }
  requestAnimationFrame(frame);
}

// ---------- Canvas: gestos (toque/mouse) → câmera ou ação no mundo ----------
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
resizeCanvas(canvas);
new ResizeObserver(() => resizeCanvas(canvas)).observe(canvas);
window.addEventListener('orientationchange', () => setTimeout(() => resizeCanvas(canvas), 250));

/** @param {number} x @param {number} y @param {{x:number,y:number,w:number,h:number}} r */
function hitTest(x, y, r) {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

attachInput(canvas, {
  onTap(sx, sy, pointerType) {
    // Minimapa (HUD): toque centraliza a câmera naquele ponto
    if (state.scene !== 'mine') {
      const hs = hudSize();
      const h = screenToHud(sx, sy);
      const target = minimapToWorld(minimapLayout(hs.w, hs.h), h.x, h.y);
      if (target) {
        const p = proj(target.x, target.y);
        centerOn('overworld', p.x, p.y);
        if (pointerType !== 'mouse') haptic(6);
        return;
      }
    }
    const { x, y } = screenToWorld(state.scene, sx, sy);
    const acted = handleWorldTap(x, y);
    if (acted && pointerType !== 'mouse') haptic();
  },
});

/**
 * Ação de um toque/clique em coordenadas do mundo. Retorna true se algo aconteceu.
 * @param {number} x @param {number} y
 */
function handleWorldTap(x, y) {
  if (state.scene === 'overworld') {
    const hit = pickOverworld(x, y);
    if (!hit) return false;
    if (hit.kind === 'mine') {
      const m = state.mines[hit.idx];
      setActiveMine(hit.idx);
      state.scene = 'mine';
      if (state.tutorial && !state.tutorial.dismissed && state.tutorial.step === 0) {
        state.tutorial.step = 1;
      }
      play('whoosh');
      log(`Entrou em ${m.name}. Aloque mineradores em veios descobertos.`);
    } else if (hit.kind === 'mineSlot') {
      openBuyMineModal();
      play('click');
    } else if (hit.kind === 'factory') {
      openRecipeModal(hit.idx);
      play('click');
    } else if (hit.kind === 'factorySlot') {
      openPanel('factory');
      play('click');
    } else if (hit.kind === 'site') {
      openSiteModal(hit.site || '');
      play('click');
    } else if (hit.kind === 'mercado') {
      openPanel('market');
      play('click');
    } else {
      openUpgradesModal();
      play('click');
    }
    return true;
  }

  // ----- Cena MINA -----
  // Botão "Regenerar" no banner de mina esgotada
  {
    const m = getActiveMine();
    if (m && m.exhausted) {
      const bw = 240, bh = 38;
      const bx = (W - bw) / 2;
      const by = MINE.y + (MINE.rows * MINE.cell) / 2 - 50 + 60 + 12;
      if (hitTest(x, y, { x: bx, y: by, w: bw, h: bh })) {
        regenerateMine(state.activeMineIdx);
        return true;
      }
    }
  }
  // Toque em qualquer lugar fecha o último passo do tutorial
  if (state.tutorial && !state.tutorial.dismissed && state.tutorial.step === 2) {
    state.tutorial.dismissed = true;
  }
  if (x >= MINE.x && x < MINE.x + MINE.cols * MINE.cell &&
      y >= MINE.y && y < MINE.y + MINE.rows * MINE.cell) {
    const c = Math.floor((x - MINE.x) / MINE.cell);
    const r = Math.floor((y - MINE.y) / MINE.cell);
    const tool = state.tool || 'pick';
    if (tool === 'pick') tryDigClick(r, c);
    else if (tool === 'tnt') tryTNT(r, c);
    else if (tool === 'compass') tryCompass(r, c);
    else if (tool === 'miner') tryPlaceWorker(r, c);
    return true;
  }
  return false;
}

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
    case 'hire-staff':     if (hireOrPromote(t.dataset.id || '')) play('success'); break;
    case 'site-build':     if (buildSite(t.dataset.id || '')) play('success'); break;
    case 'site-worker':    if (addSiteWorker(t.dataset.id || '', +(t.dataset.delta || 1))) play('click'); break;
    case 'tool-select':    setTool(t.dataset.tool); play('click'); break;
    case 'confirm-buy-mine': {
      buyMine(t.dataset.id);
      closeModal('modal-buy-mine');
      break;
    }
    case 'confirm-civ': {
      chooseCivilization(t.dataset.id || '');
      closeModal('modal-civilization');
      break;
    }
  }
});

initHud();

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
freshStartIfNeeded();
const loaded = loadGame();
if (loaded) {
  state.eraReached = Math.max(state.eraReached || 1, currentEra());
  // Garante array de minas válido após carregar (migração já feita em save.js)
  if (!state.mines || state.mines.length === 0) initMines();
  for (const m of state.mines) connectToShaft(m);
  // Saves antigos sem campo tutorial: marca como dismissed (não atrapalha)
  if (!state.tutorial) state.tutorial = { step: 0, dismissed: true, autoDismissIn: 0 };
  log(`Partida carregada (dia ${state.day}, ${state.contractsCompleted} contratos, Era ${ROMAN[state.eraReached - 1]}).`, 'good');
  updateSaveStatus();
} else {
  initMines();
  log('Bem-vindo, governador. Esta é a vista do mapa de Santa Catarina.');
  log('Clique em uma das MINAS à esquerda para descer e cavar. Você tem 2 minas iniciais.');
  log('Recursos esgotam com o tempo — pode explorar várias minas em paralelo.');
  // Novo jogo: pede escolha de civilização (Age of Tapuia)
  openCivilizationModal();
}
unlockOnFirstGesture();
updateMuteBtn();
// Carrega sprites em background e esconde o loading splash quando pronto
loadSprites().then(() => {
  const splash = $('loading-splash');
  if (splash) {
    splash.classList.add('hide');
    setTimeout(() => { splash.style.display = 'none'; }, 500);
  }
});

// ---------- PWA: service worker + install prompt ----------
// Registra o SW em qualquer ambiente que não seja localhost — permite
// que o site funcione tanto bundlado (Vite) quanto servindo o source
// direto (GitHub Pages sem build). Protege acesso ao import.meta.env.
const _env = /** @type {any} */ (import.meta).env || {};
const _isLocalhost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(location.hostname);
if ('serviceWorker' in navigator && !_isLocalhost && !_env.DEV) {
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

// ---------- PHASER RENDERER (opt-in via ?phaser=1) ----------
const _usePhaser = new URLSearchParams(window.location.search).has('phaser');
if (_usePhaser) {
  // Esconde canvas, mostra container Phaser, inicia engine
  const canvas = document.getElementById('game');
  if (canvas) canvas.style.display = 'none';
  const container = document.getElementById('phaser-container');
  if (container) container.style.display = 'block';
  // Boot do Phaser em background (dynamic import pra não penalizar o canvas)
  import('./phaser/game.js').then((m) => {
    m.startPhaserGame();
    log('🎮 Modo Phaser.js ativado — renderer experimental.', 'good');
  }).catch((err) => {
    console.error('[phaser] Falha ao carregar:', err);
    // Fallback: mostra canvas de novo
    if (canvas) canvas.style.display = '';
    if (container) container.style.display = 'none';
  });
}

requestAnimationFrame((t) => { lastT = t; frame(t); });
