// camera.js — viewport responsivo: canvas na resolução do dispositivo, zoom/pan
// por cena e conversão tela↔mundo. Cada cena tem seu próprio tamanho de mundo:
// a mina é 1280x720; o mapa é o espaço isométrico (ISO_W x ISO_H).
import { W, H } from './geometry.js';
import { ISO_W, ISO_H, proj } from './iso.js';

/** @typedef {{ x: number, y: number, zoom: number, touched: boolean, bw: number, bh: number, focus?: {x:number,y:number}, zoomBoost?: number }} Cam */

export const view = {
  cw: W,   // largura CSS do canvas
  ch: H,
  dpr: 1,
  hudScale: 1,
  hudTopInset: 0, // espaço (unidades do HUD) ocupado pelos controles DOM do topo
  hudBottomInset: 0, // idem, embaixo (barra de ferramentas da mina no modo compacto)
};

/** @type {Record<'overworld' | 'mine', Cam>} */
const cams = {
  // o losango ocupa só metade do retângulo: abre mais perto, entre as minas e as fábricas
  overworld: { x: ISO_W / 2, y: ISO_H / 2, zoom: 1, touched: false, bw: ISO_W, bh: ISO_H, focus: proj(420, 400), zoomBoost: 1.55 },
  mine: { x: W / 2, y: H / 2, zoom: 1, touched: false, bw: W, bh: H },
};

/** @param {string} scene */
export function camFor(scene) {
  return scene === 'mine' ? cams.mine : cams.overworld;
}

/** @param {Cam} cam */
const containZoom = (cam) => Math.min(view.cw / cam.bw, view.ch / cam.bh);
/** @param {Cam} cam */
const coverZoom = (cam) => Math.max(view.cw / cam.bw, view.ch / cam.bh);
/** @param {Cam} cam */
const maxZoom = (cam) => Math.max(coverZoom(cam), containZoom(cam)) * 2.5;

// Telas grandes veem o mundo inteiro; celulares começam preenchendo a altura e arrastam.
/** @param {Cam} cam */
function defaultZoom(cam) {
  const c = containZoom(cam);
  const base = c >= 0.6 ? c : coverZoom(cam);
  return Math.max(base, c * (cam.zoomBoost || 1));
}

/** @param {Cam} cam */
function clampCam(cam) {
  cam.zoom = Math.min(maxZoom(cam), Math.max(containZoom(cam), cam.zoom));
  const vw = view.cw / cam.zoom;
  const vh = view.ch / cam.zoom;
  cam.x = vw >= cam.bw ? cam.bw / 2 : Math.min(cam.bw - vw / 2, Math.max(vw / 2, cam.x));
  cam.y = vh >= cam.bh ? cam.bh / 2 : Math.min(cam.bh - vh / 2, Math.max(vh / 2, cam.y));
}

/** @param {Cam} cam */
function resetCam(cam) {
  cam.zoom = defaultZoom(cam);
  // Sem foco definido (mina): começa encostado à esquerda.
  cam.x = cam.focus ? cam.focus.x : view.cw / cam.zoom / 2;
  cam.y = cam.focus ? cam.focus.y : cam.bh / 2;
  clampCam(cam);
}

/** @param {HTMLCanvasElement} canvas */
export function resizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const cw = Math.max(1, Math.round(rect.width));
  const ch = Math.max(1, Math.round(rect.height));
  const dpr = Math.min(3, window.devicePixelRatio || 1); // até 3x: texto nítido em celulares top
  if (cw === view.cw && ch === view.ch && dpr === view.dpr && canvas.width === Math.round(cw * dpr)) return;
  view.cw = cw;
  view.ch = ch;
  view.dpr = dpr;
  view.hudScale = Math.min(1, Math.max(0.75, cw / 900));
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  for (const cam of [cams.overworld, cams.mine]) {
    if (cam.touched) clampCam(cam);
    else resetCam(cam);
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {string} scene */
export function applyWorldTransform(ctx, scene) {
  const cam = camFor(scene);
  const s = view.dpr * cam.zoom;
  ctx.setTransform(s, 0, 0, s, view.dpr * (view.cw / 2 - cam.x * cam.zoom), view.dpr * (view.ch / 2 - cam.y * cam.zoom));
}

/** @param {CanvasRenderingContext2D} ctx */
export function applyHudTransform(ctx) {
  const s = view.dpr * view.hudScale;
  ctx.setTransform(s, 0, 0, s, 0, 0);
}

/** Dimensões do espaço do HUD (pixels CSS divididos pela escala da interface). */
export function hudSize() {
  return { w: view.cw / view.hudScale, h: view.ch / view.hudScale };
}

/** @param {string} scene @param {number} sx @param {number} sy pixels CSS relativos ao canvas */
export function screenToWorld(scene, sx, sy) {
  const cam = camFor(scene);
  return {
    x: cam.x + (sx - view.cw / 2) / cam.zoom,
    y: cam.y + (sy - view.ch / 2) / cam.zoom,
  };
}

/** @param {number} sx @param {number} sy */
export function screenToHud(sx, sy) {
  return { x: sx / view.hudScale, y: sy / view.hudScale };
}

/** Retângulo do mundo visível na tela. @param {string} scene */
export function visibleWorldRect(scene) {
  const cam = camFor(scene);
  const vw = view.cw / cam.zoom, vh = view.ch / cam.zoom;
  return { x: cam.x - vw / 2, y: cam.y - vh / 2, w: vw, h: vh };
}

/** @param {string} scene @param {number} dx @param {number} dy deslocamento em pixels CSS */
export function panBy(scene, dx, dy) {
  const cam = camFor(scene);
  cam.x -= dx / cam.zoom;
  cam.y -= dy / cam.zoom;
  cam.touched = true;
  clampCam(cam);
}

/** Zoom mantendo fixo o ponto do mundo sob (sx, sy). @param {string} scene @param {number} sx @param {number} sy @param {number} factor */
export function zoomAt(scene, sx, sy, factor) {
  const cam = camFor(scene);
  const before = screenToWorld(scene, sx, sy);
  cam.zoom *= factor;
  clampCam(cam);
  cam.x = before.x - (sx - view.cw / 2) / cam.zoom;
  cam.y = before.y - (sy - view.ch / 2) / cam.zoom;
  cam.touched = true;
  clampCam(cam);
}

/** @param {string} scene @param {number} factor */
export function zoomCenter(scene, factor) {
  zoomAt(scene, view.cw / 2, view.ch / 2, factor);
}

/** @param {string} scene @param {number} x @param {number} y */
export function centerOn(scene, x, y) {
  const cam = camFor(scene);
  cam.x = x;
  cam.y = y;
  cam.touched = true;
  clampCam(cam);
}

/** Alterna entre ver o mapa inteiro e o zoom padrão do aparelho. @param {string} scene */
export function toggleFit(scene) {
  const cam = camFor(scene);
  const fit = containZoom(cam);
  if (Math.abs(cam.zoom - fit) < 0.01) {
    resetCam(cam);
    if (Math.abs(cam.zoom - fit) < 0.01) cam.zoom = fit * 1.6;
  } else {
    cam.zoom = fit;
  }
  cam.touched = true;
  clampCam(cam);
}
