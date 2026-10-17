// hud.js — controles DOM sobre o canvas (dedo-friendly) + navegação compacta:
// botão voltar, troca de mina, barra de ferramentas, zoom, chip do contrato,
// barra inferior que abre a sidebar como painel deslizante.
import { state } from './state.js';
import { R, MINE } from './data.js';
import { setActiveMine, activeMine, setTool } from './mine.js';
import { setRecipe } from './factories.js';
import { adviseContract, freeWorkers, freeIdleWorker } from './advisor.js';
import { nextThreat, armyPower, army, rivalOf } from './military.js';
import { buildSite, changeSiteWorkers } from './sites.js';
import { tryHireWorker } from './mine.js';
import { openBuyMineModal } from './ui.js';
import { play } from './audio.js';
import { zoomCenter, toggleFit, view, centerOn } from './camera.js';

const COMPACT_QUERY = '(max-width: 820px), (max-height: 520px)';
export const isCompact = () => window.matchMedia(COMPACT_QUERY).matches;

/** Vibração curtinha de confirmação (só onde o aparelho suporta). */
export function haptic(ms = 10) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

/** @param {string} id */
const el = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

const sidebar = /** @type {HTMLElement} */ (document.querySelector('.sidebar'));
const backdrop = el('sidebar-backdrop');
const nav = el('bottom-nav');

/** @param {string} tab */
function selectTab(tab) {
  const btn = /** @type {HTMLElement|null} */ (document.querySelector(`.tab[data-tab="${tab}"]`));
  if (btn) btn.click();
}

/** @param {boolean} open @param {string} [navKey] */
function setSheet(open, navKey) {
  sidebar.classList.toggle('open', open);
  sidebar.style.transform = '';
  backdrop.classList.toggle('show', open);
  nav.querySelectorAll('button').forEach((b) => {
    const key = /** @type {HTMLElement} */ (b).dataset.sheet;
    b.classList.toggle('active', open && key === navKey);
  });
}

/**
 * Abre a aba pedida. Em tela compacta, sobe o painel; no desktop a sidebar já está visível.
 * @param {string} tab
 */
export function openPanel(tab) {
  selectTab(tab);
  if (isCompact()) setSheet(true, tab);
}

export function closeSheet() { setSheet(false); }

/** Garante um trabalhador livre: libera um ocioso; se não houver, contrata. @param {string} keep */
function ensureFreeWorker(keep) {
  if (freeWorkers() > 0) return true;
  if (freeIdleWorker(keep)) return true;
  const before = state.workersTotal;
  tryHireWorker();
  return state.workersTotal > before;
}

/** Põe/tira trabalhador de um posto; o + libera ou contrata alguém se preciso. @param {string} id @param {number} delta */
export function addSiteWorker(id, delta) {
  if (delta > 0) ensureFreeWorker('');
  return changeSiteWorkers(id, delta, freeWorkers);
}

function wireSheet() {
  nav.addEventListener('click', (e) => {
    const b = /** @type {HTMLElement|null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-sheet]'));
    if (!b) return;
    const key = b.dataset.sheet || 'contract';
    const isOpenOnThis = sidebar.classList.contains('open') && b.classList.contains('active');
    play('click');
    haptic(6);
    if (isOpenOnThis) { setSheet(false); return; }
    if (key === 'more') {
      sidebar.classList.add('show-tabs');
      setSheet(true, 'more');
      return;
    }
    sidebar.classList.remove('show-tabs');
    selectTab(key);
    setSheet(true, key);
  });
  backdrop.addEventListener('click', () => setSheet(false));

  // Arrastar a alça pra baixo fecha o painel (portrait)
  const handle = /** @type {HTMLElement} */ (sidebar.querySelector('.sheet-handle'));
  let y0 = -1;
  handle.addEventListener('pointerdown', (e) => {
    y0 = e.clientY;
    handle.setPointerCapture(e.pointerId);
    sidebar.style.transition = 'none';
  });
  handle.addEventListener('pointermove', (e) => {
    if (y0 < 0) return;
    const dy = Math.max(0, e.clientY - y0);
    sidebar.style.transform = `translateY(${dy}px)`;
  });
  const release = (/** @type {PointerEvent} */ e) => {
    if (y0 < 0) return;
    const dy = e.clientY - y0;
    y0 = -1;
    sidebar.style.transition = '';
    if (dy > 70) setSheet(false);
    else sidebar.style.transform = '';
  };
  handle.addEventListener('pointerup', release);
  handle.addEventListener('pointercancel', release);
  handle.addEventListener('click', () => setSheet(false));
}

function wireTopbar() {
  const menuBtn = el('menu-btn');
  const topbar = /** @type {HTMLElement} */ (document.querySelector('.topbar'));
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !topbar.classList.contains('menu-open');
    topbar.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    play('click');
  });
  document.addEventListener('click', (e) => {
    if (!topbar.classList.contains('menu-open')) return;
    const t = /** @type {HTMLElement} */ (e.target);
    if (!t.closest('.save-controls')) {
      topbar.classList.remove('menu-open');
      menuBtn.setAttribute('aria-expanded', 'false');
    }
  });
  el('speed-cycle').addEventListener('click', () => {
    const order = [1, 2, 4, 0];
    const next = order[(order.indexOf(state.speed) + 1) % order.length];
    const btn = /** @type {HTMLElement|null} */ (document.querySelector(`.speed-btn[data-speed="${next}"]`));
    if (btn) btn.click();
    else state.speed = next;
    play('click');
    haptic(6);
  });
}

function wireStage() {
  el('mine-back').addEventListener('click', () => {
    state.scene = 'overworld';
    play('whoosh');
    haptic();
  });
  el('mine-switcher').addEventListener('click', (e) => {
    const b = /** @type {HTMLElement|null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-mine]'));
    if (!b) return;
    // No compacto só o botão da mina ativa aparece: tocar nele passa para a próxima
    const i = +(b.dataset.mine || 0);
    const target = isCompact() && i === state.activeMineIdx ? (i + 1) % state.mines.length : i;
    setActiveMine(target);
    play('click');
    haptic(6);
  });
  el('zoom-ctl').addEventListener('click', (e) => {
    const b = /** @type {HTMLElement|null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-zoom]'));
    if (!b) return;
    const z = b.dataset.zoom;
    if (z === 'in') zoomCenter(state.scene, 1.35);
    else if (z === 'out') zoomCenter(state.scene, 1 / 1.35);
    else toggleFit(state.scene);
    haptic(4);
  });
  el('contract-chip').addEventListener('click', () => {
    openPanel('contract');
    play('click');
  });
  el('advisor').addEventListener('click', () => {
    const a = currentAdvice;
    if (!a) return;
    haptic();
    if (a.kind === 'switch' && a.factory !== undefined && a.recipe) {
      setRecipe(a.factory, a.recipe);
      play('success');
    } else if ((a.kind === 'mine' || a.kind === 'explore') && a.mineIdx !== undefined) {
      if (a.kind === 'mine' && freeWorkers() <= 0) ensureFreeWorker(a.resource || '');
      setActiveMine(a.mineIdx);
      state.scene = 'mine';
      setTool(a.kind === 'mine' ? 'miner' : a.r !== undefined ? 'compass' : 'pick');
      if (a.kind === 'explore' && a.r !== undefined && a.c !== undefined) {
        state.hintTile = { mineIdx: a.mineIdx, r: a.r, c: a.c };
        lastFocusKey = `mine:${a.mineIdx}`;
        centerOn('mine', MINE.x + (a.c + 0.5) * MINE.cell, MINE.y + (a.r + 0.5) * MINE.cell);
      }
      play('whoosh');
    } else if (a.kind === 'buildSite' && a.site) {
      if (buildSite(a.site)) { addSiteWorker(a.site, 1); play('success'); }
    } else if (a.kind === 'siteWorker' && a.site) {
      if (addSiteWorker(a.site, 1)) play('success');
    } else if (a.kind === 'army') {
      openPanel('army');
      play('click');
    } else if (a.kind === 'buyMine') {
      openBuyMineModal();
      play('click');
    } else if (a.kind === 'buyFactory') {
      openPanel('factory');
      play('click');
    }
    lastAdviceAt = 0;
  });
  // ferramenta escolhida no dock também vibra (o setTool vem do handler global data-action)
  el('tool-dock').addEventListener('click', () => haptic(6));
}

// Ao entrar numa mina, a câmera vai até os túneis já abertos (não até o canto do poço)
function focusActiveMine() {
  const m = activeMine();
  if (!m || !m.grid) return;
  let sx = 0, sy = 0, n = 0;
  for (let r = 0; r < MINE.rows; r++) {
    for (let c = 1; c < MINE.cols; c++) {
      if (m.grid[r][c].revealed) { sx += c; sy += r; n++; }
    }
  }
  if (!n) return;
  centerOn('mine', MINE.x + (sx / n + 0.5) * MINE.cell, MINE.y + (sy / n + 0.5) * MINE.cell);
}

/** Ataque chegando e exército fraco: tem prioridade sobre o pedido. @returns {import('./advisor.js').Advice | null} */
function adviseArmy() {
  const th = nextThreat();
  if (!th || armyPower() >= th.power) return null;
  const r = rivalOf(th.rival);
  const who = r ? `${r.emoji} ${r.name}s` : 'Invasores';
  const eta = Math.ceil(th.eta);
  return army().barracks
    ? { kind: 'army', text: `${who} atacam em ${eta}s: força ${th.power} contra a sua ${armyPower()}. Toque para treinar unidades.` }
    : { kind: 'army', text: `${who} atacam em ${eta}s (força ${th.power}) e você não tem exército. Toque para construir o Quartel.` };
}

let lastFocusKey = '';
/** @type {import('./advisor.js').Advice | null} */
let currentAdvice = null;
let lastAdviceAt = 0;
let lastAdviceText = '';
let lastSwitcherSig = '';
let lastChip = '';
let lastSpeed = -1;

/** Atualiza visibilidade/estado dos controles. Chamado todo frame; só toca no DOM quando muda. */
export function syncHud() {
  const inMine = state.scene === 'mine';
  const focusKey = inMine ? `mine:${state.activeMineIdx}` : '';
  if (focusKey !== lastFocusKey) {
    lastFocusKey = focusKey;
    if (inMine) focusActiveMine();
  }
  const back = el('mine-back');
  if (back.hidden === inMine) back.hidden = !inMine;
  const dock = el('tool-dock');
  if (dock.hidden === inMine) dock.hidden = !inMine;
  if (inMine) {
    dock.querySelectorAll('.dock-btn').forEach((b) => {
      const on = /** @type {HTMLElement} */ (b).dataset.tool === state.tool;
      if (b.classList.contains('active') !== on) b.classList.toggle('active', on);
    });
  }

  const sw = el('mine-switcher');
  const showSw = inMine && state.mines.length >= 2;
  const sig = showSw ? state.mines.map((m, i) => `${i}:${m.name}:${m.exhausted}:${i === state.activeMineIdx}`).join('|') : '';
  if (sig !== lastSwitcherSig) {
    lastSwitcherSig = sig;
    sw.hidden = !showSw;
    sw.innerHTML = showSw ? state.mines.map((m, i) =>
      `<button type="button" data-mine="${i}" class="${i === state.activeMineIdx ? 'active' : ''}${m.exhausted ? ' exhausted' : ''}"><span class="sw-cycle">⇄ </span>${m.exhausted ? '🚫 ' : ''}${m.name}</button>`,
    ).join('') : '';
  }

  const chip = el('contract-chip');
  let chipTxt = '';
  if (state.contract) {
    const k = state.contract;
    const left = Math.max(0, Math.ceil(k.deadline - k.elapsed));
    chipTxt = `📜 ${R[k.product].name} ${k.delivered}/${k.need} · ⏱${left}s`;
  }
  if (chipTxt !== lastChip) {
    lastChip = chipTxt;
    chip.hidden = !chipTxt;
    chip.textContent = chipTxt;
    chip.classList.toggle('urgent', !!state.contract && state.contract.deadline - state.contract.elapsed < 20);
  }

  // conselheiro: recalcula 4x/s; some durante o tutorial inicial
  const now = performance.now();
  if (now - lastAdviceAt > 250) {
    lastAdviceAt = now;
    const tutorialOn = state.tutorial && !state.tutorial.dismissed;
    currentAdvice = tutorialOn ? null : (adviseArmy() || adviseContract());
    const txt = currentAdvice ? currentAdvice.text : '';
    if (txt !== lastAdviceText) {
      lastAdviceText = txt;
      const adv = el('advisor');
      adv.hidden = !txt;
      el('advisor-text').textContent = txt;
      adv.classList.toggle('info-only', !!currentAdvice && currentAdvice.kind === 'locked');
    }
  }

  const stage = /** @type {HTMLElement} */ (document.querySelector('.stage'));
  if (stage.classList.contains('scene-mine') !== inMine) stage.classList.toggle('scene-mine', inMine);
  const top = el('hud-top');
  const anyTop = [...top.children].some((c) => !(/** @type {HTMLElement} */ (c).hidden) && /** @type {HTMLElement} */ (c).offsetParent !== null);
  view.hudTopInset = anyTop ? (top.offsetTop + top.offsetHeight + 6) / view.hudScale : 0;
  view.hudBottomInset = inMine && isCompact() && dock.offsetParent !== null
    ? (stage.clientHeight - dock.offsetTop + 8) / view.hudScale : 0;

  if (state.speed !== lastSpeed) {
    lastSpeed = state.speed;
    el('speed-cycle').textContent = state.speed === 0 ? '⏸' : `${state.speed}x`;
    document.querySelectorAll('.speed-btn').forEach((b) => {
      b.classList.toggle('active', parseFloat(/** @type {HTMLElement} */ (b).dataset.speed || '1') === state.speed);
    });
  }
}

export function initHud() {
  wireSheet();
  wireTopbar();
  wireStage();
  // sair do modo compacto com o painel aberto deixaria o backdrop preso
  window.matchMedia(COMPACT_QUERY).addEventListener('change', () => setSheet(false));
}
