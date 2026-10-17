// paint.js — peças de desenho compartilhadas entre a mina, o mapa e o HUD
import { state } from './state.js';
import { R, CIV_BY_ID } from './data.js';

export const UI_FONT = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** @param {string} id */
export function resAbbrev(id) {
  return ({
    coal: 'CVO', iron_ore: 'FRO', copper_ore: 'CBR', zinc_ore: 'ZNC', lead: 'CHB',
    silver_ore: 'PRT', gold_ore: 'OUR', sulfur: 'ENX', saltpeter: 'SLT', oil: 'PET',
    wood: 'MAD', stone: 'PED', clay: 'ARG', sand: 'ARE', diamond: 'DIA', ruby: 'RUB',
  })[id] || id.slice(0, 3).toUpperCase();
}

export function civColor() {
  const c = state.civilization ? CIV_BY_ID[state.civilization] : null;
  return c ? c.color : '#5a3416';
}
export function civAccent() {
  const c = state.civilization ? CIV_BY_ID[state.civilization] : null;
  return c ? c.accentColor : '#c69042';
}

/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} size @param {string} resourceId */
export function drawResourceIcon(ctx, x, y, size, resourceId) {
  const res = R[resourceId];
  if (!res) return;
  ctx.fillStyle = res.color;
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = '#1a0e06';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, size, size);
  ctx.font = `bold ${Math.floor(size * 0.45)}px ${UI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(20,10,5,0.85)';
  ctx.fillRect(x, y + size - Math.floor(size * 0.55), size, Math.floor(size * 0.55));
  ctx.fillStyle = '#ffd44a';
  ctx.fillText(resAbbrev(resourceId), x + size / 2, y + size - Math.floor(size * 0.28));
}

/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} w @param {number} h */
export function drawScrollPanel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + 2, y + 3, w + 2, h + 2);
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = '#f1e3c2';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(122,75,37,0.12)';
  ctx.lineWidth = 1;
  for (let i = 10; i < h; i += 9) {
    ctx.beginPath();
    ctx.moveTo(x + 4, y + i);
    ctx.lineTo(x + w - 4, y + i);
    ctx.stroke();
  }
}

/**
 * Placa de nome em pé (texto nítido, contraste alto), centralizada em (x, y).
 * @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {string} text
 * @param {{ bg?: string, fg?: string, size?: number, border?: string }} [o]
 * @returns {{x:number,y:number,w:number,h:number}} retângulo ocupado
 */
export function plate(ctx, x, y, text, o = {}) {
  const size = o.size || 12;
  ctx.font = `bold ${size}px ${UI_FONT}`;
  const w = Math.ceil(ctx.measureText(text).width) + 14;
  const h = size + 9;
  const rx = Math.round(x - w / 2), ry = Math.round(y - h / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(rx + 1, ry + 2, w, h);
  ctx.fillStyle = o.border || '#2a1608';
  ctx.fillRect(rx - 1, ry - 1, w + 2, h + 2);
  ctx.fillStyle = o.bg || '#e2b765';
  ctx.fillRect(rx, ry, w, h);
  ctx.fillStyle = o.fg || '#1a0e06';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, rx + w / 2, ry + h / 2 + 0.5);
  return { x: rx, y: ry, w, h };
}
