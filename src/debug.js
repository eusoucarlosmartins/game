// debug.js — painel de diagnóstico para celulares sem console (iPhone).
// Liga com ?debug=1 na URL ou tocando 5 vezes seguidas no dinheiro (Tesouro).
import { view, camFor } from './camera.js';
import { state } from './state.js';

const counts = /** @type {Record<string, number>} */ ({});
const errors = /** @type {string[]} */ ([]);
let version = '?';
/** @type {HTMLElement | null} */
let box = null;

/** @param {string} msg */
function pushError(msg) {
  errors.unshift(msg.slice(0, 140));
  errors.length = Math.min(errors.length, 4);
}

function show() {
  if (box) return;
  box = document.createElement('pre');
  box.id = 'debug-box';
  box.style.cssText = 'position:fixed;left:4px;top:60px;z-index:99999;margin:0;padding:6px 8px;max-width:92vw;'
    + 'font:11px/1.35 ui-monospace,Menlo,monospace;color:#bfffbf;background:rgba(0,0,0,.82);'
    + 'border-radius:6px;white-space:pre-wrap;pointer-events:none';
  document.body.appendChild(box);
  if ('caches' in window) caches.keys().then((k) => { version = k.join(',') || 'sem cache'; }).catch(() => {});
  setInterval(render, 400);
}

function render() {
  if (!box) return;
  const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById('game'));
  const r = canvas ? canvas.getBoundingClientRect() : null;
  const cam = camFor(state.scene);
  box.textContent = [
    `versão ${version} · ${navigator.userAgent.match(/OS [\d_]+|Chrome\/\d+|Version\/[\d.]+/g)?.join(' ') || ''}`,
    `janela ${innerWidth}x${innerHeight} dpr ${devicePixelRatio}`,
    `canvas css ${r ? `${Math.round(r.width)}x${Math.round(r.height)}` : '-'} px ${canvas ? `${canvas.width}x${canvas.height}` : '-'} view ${view.cw}x${view.ch}`,
    `cena ${state.scene} zoom ${cam.zoom.toFixed(3)} x ${cam.x.toFixed(0)} y ${cam.y.toFixed(0)}`,
    `eventos ${Object.entries(counts).map(([k, n]) => `${k}:${n}`).join(' ') || 'nenhum'}`,
    ...errors.map((e) => `ERRO ${e}`),
  ].join('\n');
}

export function initDebug() {
  for (const t of ['pointerdown', 'pointercancel', 'touchstart', 'gesturestart', 'gesturechange', 'click']) {
    document.addEventListener(t, (e) => {
      const k = t === 'click' && /** @type {HTMLElement} */ (e.target).closest?.('[data-zoom]') ? 'zoomBtn' : t;
      counts[k] = (counts[k] || 0) + 1;
    }, { capture: true, passive: true });
  }
  window.addEventListener('error', (e) => pushError(`${e.message} @${(e.filename || '').split('/').pop()}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) => pushError(String(e.reason)));
  const origError = console.error.bind(console);
  console.error = (...a) => { pushError(a.map((x) => (x && x.stack ? x.stack.split('\n').slice(0, 2).join(' ') : String(x))).join(' ')); origError(...a); };

  let on = /[?&]debug=1/.test(location.search);
  try { on = on || localStorage.getItem('tapuia-debug') === '1'; } catch { /* sem storage */ }
  if (on) show();
  // 5 toques no dinheiro liga/desliga (app instalado não tem barra de endereço)
  const title = document.getElementById('stat-money')?.closest('.stat');
  let taps = 0, last = 0;
  title?.addEventListener('click', () => {
    const now = Date.now();
    taps = now - last < 600 ? taps + 1 : 1;
    last = now;
    if (taps < 5) return;
    taps = 0;
    if (box) { box.remove(); box = null; try { localStorage.removeItem('tapuia-debug'); } catch { /* */ } return; }
    try { localStorage.setItem('tapuia-debug', '1'); } catch { /* */ }
    show();
  });
}
