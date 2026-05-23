// draw.js — renderização do canvas
import { state } from './state.js';
import { R, RECIPE_BY_ID, CFG, NUM_DEPOSITS } from './data.js';
import { fmtMoney, clamp } from './util.js';
import { pileMax, transportTier, wagonCapacity } from './progression.js';
import {
  W, H, GROUND_Y, WAREHOUSE, FACTORY_AREA, CITY,
  MINE_SHAFT, TUNNEL, DEPOSIT_W, ROAD, factoryRect,
} from './geometry.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function drawSky() {
  const grd = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  grd.addColorStop(0, '#e8c98a');
  grd.addColorStop(1, '#d2a76a');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, GROUND_Y);
  ctx.fillStyle = 'rgba(255, 220, 150, 0.6)';
  ctx.beginPath();
  ctx.arc(W - 180, 80, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  for (const c of [[200, 60, 40], [500, 90, 60], [800, 50, 35]]) {
    ctx.beginPath();
    ctx.ellipse(c[0], c[1], c[2], c[2] * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGround() {
  ctx.fillStyle = '#8a5a30';
  ctx.fillRect(0, GROUND_Y, W, 20);
  ctx.fillStyle = '#6b3f1a';
  ctx.fillRect(0, GROUND_Y + 20, W, H - GROUND_Y - 20);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 100; i++) {
    const x = (i * 71) % W;
    const y = GROUND_Y + 40 + ((i * 47) % (H - GROUND_Y - 60));
    ctx.fillRect(x, y, 3, 2);
  }
}

function drawMineShaft() {
  ctx.fillStyle = '#2a1810';
  ctx.fillRect(MINE_SHAFT.x, MINE_SHAFT.top, MINE_SHAFT.w, MINE_SHAFT.bottom - MINE_SHAFT.top);
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MINE_SHAFT.x + MINE_SHAFT.w / 2 - 6, MINE_SHAFT.top);
  ctx.lineTo(MINE_SHAFT.x + MINE_SHAFT.w / 2 - 6, MINE_SHAFT.bottom);
  ctx.moveTo(MINE_SHAFT.x + MINE_SHAFT.w / 2 + 6, MINE_SHAFT.top);
  ctx.lineTo(MINE_SHAFT.x + MINE_SHAFT.w / 2 + 6, MINE_SHAFT.bottom);
  ctx.stroke();
  ctx.strokeStyle = '#5a3416';
  for (let y = MINE_SHAFT.top + 20; y < MINE_SHAFT.bottom; y += 30) {
    ctx.beginPath();
    ctx.moveTo(MINE_SHAFT.x + 4, y);
    ctx.lineTo(MINE_SHAFT.x + MINE_SHAFT.w - 4, y);
    ctx.stroke();
  }
  ctx.fillStyle = '#5a3416';
  ctx.fillRect(MINE_SHAFT.x - 10, GROUND_Y - 90, 12, 90);
  ctx.fillRect(MINE_SHAFT.x + MINE_SHAFT.w - 2, GROUND_Y - 90, 12, 90);
  ctx.fillRect(MINE_SHAFT.x - 10, GROUND_Y - 90, MINE_SHAFT.w + 20, 10);
  ctx.fillStyle = '#444';
  ctx.beginPath();
  ctx.arc(MINE_SHAFT.x + MINE_SHAFT.w / 2, GROUND_Y - 85, 8, 0, Math.PI * 2);
  ctx.fill();
}

function drawDeposits() {
  ctx.fillStyle = '#1a0e06';
  ctx.fillRect(TUNNEL.x, TUNNEL.y, TUNNEL.w, TUNNEL.h);
  ctx.fillStyle = '#3a1f0a';
  for (let i = 1; i < NUM_DEPOSITS; i++) {
    ctx.fillRect(TUNNEL.x + i * DEPOSIT_W - 2, TUNNEL.y, 4, TUNNEL.h);
  }
  for (let i = 0; i < state.deposits.length; i++) {
    const d = state.deposits[i];
    const dx = TUNNEL.x + i * DEPOSIT_W;
    if (d.resource) {
      const c = R[d.resource].color;
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.18;
      ctx.fillRect(dx + 4, TUNNEL.y + 4, DEPOSIT_W - 8, TUNNEL.h - 8);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = d.resource ? '#f1e3c2' : '#a07a4a';
    ctx.font = 'bold 9px Georgia';
    ctx.textAlign = 'center';
    const label = d.resource ? R[d.resource].name.toUpperCase() : 'SLOT VAZIO';
    if (label.length > 14) {
      const words = label.split(' ');
      const half = Math.ceil(words.length / 2);
      ctx.fillText(words.slice(0, half).join(' '), dx + DEPOSIT_W / 2, TUNNEL.y + 12);
      ctx.fillText(words.slice(half).join(' '), dx + DEPOSIT_W / 2, TUNNEL.y + 22);
    } else {
      ctx.fillText(label, dx + DEPOSIT_W / 2, TUNNEL.y + 14);
    }
    if (d.resource) {
      drawPile(dx + 10, TUNNEL.y + TUNNEL.h - 6, d.pile, R[d.resource].color);
      drawMiners(d.miners, dx + DEPOSIT_W / 2 + 4, TUNNEL.y + TUNNEL.h - 8, R[d.resource].color);
      ctx.fillStyle = '#f1e3c2';
      ctx.font = '9px Georgia';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.floor(d.pile)}/${pileMax()}`, dx + DEPOSIT_W - 6, TUNNEL.y + 34);
      ctx.textAlign = 'left';
      ctx.fillText(`⛏ ${d.miners}`, dx + 6, TUNNEL.y + 34);
    }
  }
}

function drawPile(x, baseY, amount, color) {
  if (amount <= 0) return;
  const n = Math.min(24, Math.ceil(amount));
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const px = x + (i % 5) * 5;
    const py = baseY - Math.floor(i / 5) * 4;
    ctx.fillRect(px, py - 4, 5, 4);
  }
}

function drawMiners(count, x, baseY, accent) {
  const t = performance.now() / 200;
  for (let i = 0; i < Math.min(count, 4); i++) {
    const mx = x + i * 11;
    const swing = Math.sin(t + i) * 3;
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(mx, baseY - 14, 5, 10);
    ctx.fillStyle = accent;
    ctx.fillRect(mx, baseY - 20, 5, 5);
    ctx.fillStyle = '#c69042';
    ctx.fillRect(mx - 1, baseY - 21, 7, 2);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(mx + 5, baseY - 10);
    ctx.lineTo(mx + 10 + swing, baseY - 16 - Math.abs(swing));
    ctx.stroke();
  }
}

function drawCart() {
  const c = state.cart;
  const shaftLen = MINE_SHAFT.bottom - MINE_SHAFT.top;
  const cy = MINE_SHAFT.top + shaftLen * c.pos;
  const cx = MINE_SHAFT.x + MINE_SHAFT.w / 2;
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, GROUND_Y - 85);
  ctx.lineTo(cx, cy - 6);
  ctx.stroke();
  ctx.fillStyle = '#5a3416';
  ctx.fillRect(cx - 16, cy - 14, 32, 18);
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(cx - 16, cy + 2, 32, 4);
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(cx - 10, cy + 6, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 10, cy + 6, 4, 0, Math.PI * 2); ctx.fill();
  const total = Object.values(c.load).reduce((a, b) => a + b, 0);
  if (total > 0) {
    let xOff = 0;
    for (const res in c.load) {
      const w = (c.load[res] / total) * 28;
      ctx.fillStyle = R[res].color;
      ctx.fillRect(cx - 14 + xOff, cy - 12, w, 10);
      xOff += w;
    }
  }
}

function drawWarehouse() {
  const w = WAREHOUSE;
  ctx.fillStyle = '#6b4a28';
  ctx.fillRect(w.x, w.y, w.w, w.h);
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(w.x, w.y, w.w, 12);
  ctx.beginPath();
  ctx.moveTo(w.x - 8, w.y);
  ctx.lineTo(w.x + w.w / 2, w.y - 26);
  ctx.lineTo(w.x + w.w + 8, w.y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2a1810';
  ctx.fillRect(w.x + w.w / 2 - 18, w.y + w.h - 50, 36, 50);
  ctx.strokeStyle = '#c69042';
  ctx.lineWidth = 2;
  ctx.strokeRect(w.x + w.w / 2 - 18, w.y + w.h - 50, 36, 50);
  ctx.fillStyle = '#c69042';
  ctx.fillRect(w.x + 8, w.y + 18, w.w - 16, 16);
  ctx.fillStyle = '#1a0e06';
  ctx.font = 'bold 10px Georgia';
  ctx.textAlign = 'center';
  ctx.fillText('ARMAZÉM CENTRAL', w.x + w.w / 2, w.y + 30);
  drawWarehouseBars(w);
}

function drawWarehouseBars(w) {
  const items = [];
  for (const k in state.warehouse) {
    if (R[k] && R[k].free) continue;
    if (state.warehouse[k] > 0) items.push({ k, n: state.warehouse[k] });
  }
  items.sort((a, b) => b.n - a.n);
  const top = items.slice(0, 8);
  const startX = w.x + 8;
  const barW = (w.w - 16) / Math.max(1, top.length);
  const baseY = w.y + w.h - 8;
  const maxH = w.h - 60;
  let maxN = 1;
  for (const it of top) if (it.n > maxN) maxN = it.n;
  for (let i = 0; i < top.length; i++) {
    const it = top[i];
    const h = (it.n / Math.max(maxN, 10)) * maxH;
    ctx.fillStyle = R[it.k].color;
    ctx.fillRect(startX + i * barW + 2, baseY - h, barW - 4, h);
  }
}

function drawFactories() {
  for (let i = 0; i < state.factories.length; i++) {
    const f = state.factories[i];
    const rect = factoryRect(i);
    ctx.fillStyle = '#7a4b25';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = '#5a3416';
    ctx.fillRect(rect.x, rect.y, rect.w, 10);
    ctx.fillStyle = '#f1e3c2';
    for (let j = 0; j < 3; j++) {
      ctx.fillRect(rect.x + 16 + j * 40, rect.y + 30, 20, 18);
    }
    ctx.fillStyle = '#3a1f0a';
    ctx.fillRect(rect.x + rect.w - 38, rect.y - 56, 16, 56);
    const intensity = f.brewing > 0 ? 1 : 0.4;
    const t = performance.now() / 600;
    ctx.fillStyle = `rgba(60,40,20,${0.4 * intensity})`;
    for (let k = 0; k < 4; k++) {
      const yOff = (t * 30 + k * 25) % 100;
      const r = 7 + k * 2;
      ctx.beginPath();
      ctx.arc(rect.x + rect.w - 30, rect.y - 60 - yOff, r, 0, Math.PI * 2);
      ctx.fill();
    }
    drawGear(rect.x + 22, rect.y + 70, 14, performance.now() / 400 * (f.brewing > 0 ? 1 : 0.2));
    const recipeName = R[f.recipeId]?.name || '—';
    ctx.fillStyle = '#c69042';
    ctx.fillRect(rect.x + 6, rect.y + rect.h - 28, rect.w - 12, 18);
    ctx.fillStyle = '#1a0e06';
    ctx.font = 'bold 9px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText(recipeName.toUpperCase(), rect.x + rect.w / 2, rect.y + rect.h - 15);
    const recipe = RECIPE_BY_ID[f.recipeId];
    if (recipe && f.brewing > 0) {
      const pct = 1 - f.brewing / recipe.time;
      ctx.fillStyle = '#1a0e06';
      ctx.fillRect(rect.x + 8, rect.y - 10, rect.w - 16, 5);
      ctx.fillStyle = '#c69042';
      ctx.fillRect(rect.x + 8, rect.y - 10, (rect.w - 16) * pct, 5);
    }
    ctx.fillStyle = R[f.recipeId]?.color || '#888';
    const stkW = clamp(state.products[f.recipeId] || 0, 0, 25) * 2;
    ctx.fillRect(rect.x + 8, rect.y + rect.h + 4, stkW, 6);
    ctx.fillStyle = '#1a0e06';
    ctx.font = '9px Georgia';
    ctx.textAlign = 'left';
    ctx.fillText(`N${R[f.recipeId]?.tier || '?'}`, rect.x + 4, rect.y + 22);
  }
  for (let i = state.factories.length; i < CFG.factorySlotsMax; i++) {
    const rect = factoryRect(i);
    ctx.strokeStyle = '#7a4b25';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(122, 75, 37, 0.4)';
    ctx.font = 'bold 14px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText('SLOT DISPONÍVEL', rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.font = '11px Georgia';
    ctx.fillText(fmtMoney(CFG.factoryCosts[i]), rect.x + rect.w / 2, rect.y + rect.h / 2 + 18);
  }
}

function drawGear(x, y, r, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#888';
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate((Math.PI * 2 * i) / 8);
    ctx.fillRect(-3, -r - 3, 6, 7);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a3416';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRoad() {
  const tier = transportTier();
  if (tier >= 6) {
    ctx.fillStyle = '#6b3f1a';
    ctx.fillRect(ROAD.x1, ROAD.y - 8, ROAD.x2 - ROAD.x1, 18);
    ctx.fillStyle = '#3a1f0a';
    for (let x = ROAD.x1; x < ROAD.x2; x += 14) {
      ctx.fillRect(x, ROAD.y - 6, 8, 14);
    }
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ROAD.x1, ROAD.y - 4); ctx.lineTo(ROAD.x2, ROAD.y - 4);
    ctx.moveTo(ROAD.x1, ROAD.y + 6); ctx.lineTo(ROAD.x2, ROAD.y + 6);
    ctx.stroke();
  } else if (tier >= 2) {
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(ROAD.x1, ROAD.y - 8, ROAD.x2 - ROAD.x1, 18);
    ctx.strokeStyle = '#e8d4a4';
    ctx.setLineDash([12, 10]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ROAD.x1, ROAD.y + 1);
    ctx.lineTo(ROAD.x2, ROAD.y + 1);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.fillStyle = '#a07a4a';
    ctx.fillRect(ROAD.x1, ROAD.y - 6, ROAD.x2 - ROAD.x1, 14);
    ctx.strokeStyle = '#5a3416';
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(ROAD.x1, ROAD.y + 1);
    ctx.lineTo(ROAD.x2, ROAD.y + 1);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawWagon() {
  const w = state.wagon;
  const wx = ROAD.x1 + (ROAD.x2 - ROAD.x1) * w.pos;
  const wy = ROAD.y - 16;
  const tier = transportTier();
  if (tier <= 1) drawCarriage(wx, wy, w, tier);
  else if (tier === 2) drawCar(wx, wy, w);
  else if (tier === 3) drawTruck(wx, wy, w, 1.0);
  else if (tier === 4) drawTruck(wx, wy, w, 1.3);
  else if (tier === 5) drawCarreta(wx, wy, w);
  else if (tier === 6) drawTrain(wx, wy, w, 'steam');
  else drawTrain(wx, wy, w, 'diesel');
}

function drawCarriage(wx, wy, w, tier) {
  const scale = tier === 1 ? 1.15 : 1.0;
  const half = 20 * scale;
  if (w.dir !== 0) {
    ctx.fillStyle = '#3a1f0a';
    const hx = wx + (w.dir > 0 ? half + 12 : -half - 30);
    ctx.fillRect(hx, wy + 4, 18, 14);
    ctx.fillRect(hx + (w.dir > 0 ? 14 : -4), wy - 2, 6, 8);
  }
  ctx.fillStyle = '#7a4b25';
  ctx.fillRect(wx - half, wy, half * 2, 16);
  ctx.fillStyle = '#5a3416';
  ctx.fillRect(wx - half, wy + 14, half * 2, 4);
  ctx.fillStyle = '#e8d4a4';
  ctx.beginPath();
  ctx.ellipse(wx, wy + 2, half + 2, 8, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(wx - half + 6, wy + 20, 6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(wx + half - 6, wy + 20, 6, 0, Math.PI * 2); ctx.fill();
  drawCargoBar(wx - half + 5, wy + 4, half * 2 - 10, 8, w);
}

function drawCar(wx, wy, w) {
  ctx.fillStyle = '#8a2a1a';
  ctx.fillRect(wx - 24, wy + 2, 48, 16);
  ctx.fillRect(wx + (w.dir >= 0 ? 18 : -28), wy + 6, 14, 8);
  ctx.fillStyle = '#1a0e06';
  ctx.fillRect(wx - 20, wy - 2, 30, 6);
  ctx.fillStyle = '#a8c8d8';
  ctx.fillRect(wx - 18, wy, 12, 4);
  ctx.fillRect(wx - 4, wy, 12, 4);
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(wx - 16, wy + 22, 6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(wx + 16, wy + 22, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffe680';
  if (w.dir !== 0) {
    ctx.beginPath();
    ctx.arc(wx + (w.dir > 0 ? 30 : -30), wy + 10, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  drawCargoBar(wx - 22, wy + 6, 44, 4, w);
}

function drawTruck(wx, wy, w, scale) {
  const len = 60 * scale;
  ctx.fillStyle = '#2a4a7a';
  ctx.fillRect(wx + (w.dir > 0 ? len/2 - 16 : -len/2), wy, 16, 18);
  ctx.fillStyle = '#7a4b25';
  ctx.fillRect(wx - len/2, wy - 4, len - 18, 22);
  ctx.fillStyle = '#a8c8d8';
  ctx.fillRect(wx + (w.dir > 0 ? len/2 - 14 : -len/2 + 2), wy + 2, 12, 6);
  ctx.fillStyle = '#222';
  for (const offX of [-len/2 + 8, len/2 - 24, len/2 - 8]) {
    ctx.beginPath(); ctx.arc(wx + offX, wy + 22, 6 * Math.min(scale, 1.15), 0, Math.PI * 2); ctx.fill();
  }
  drawCargoBar(wx - len/2 + 4, wy, len - 26, 10, w);
}

function drawCarreta(wx, wy, w) {
  ctx.fillStyle = '#2a4a7a';
  ctx.fillRect(wx + (w.dir > 0 ? 26 : -42), wy, 18, 22);
  ctx.fillStyle = '#a8c8d8';
  ctx.fillRect(wx + (w.dir > 0 ? 28 : -40), wy + 4, 14, 8);
  ctx.fillStyle = '#dddddd';
  ctx.fillRect(wx - 40, wy - 6, 70, 26);
  ctx.strokeStyle = '#7a7e87';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(wx - 40 + i * 9, wy - 6);
    ctx.lineTo(wx - 40 + i * 9, wy + 20);
    ctx.stroke();
  }
  ctx.fillStyle = '#222';
  for (const offX of [-32, -20, 18, 30, 38]) {
    ctx.beginPath(); ctx.arc(wx + offX, wy + 24, 5, 0, Math.PI * 2); ctx.fill();
  }
  drawCargoBar(wx - 36, wy, 60, 10, w);
}

function drawTrain(wx, wy, w, type) {
  if (type === 'steam') {
    ctx.fillStyle = '#1a0e06';
    ctx.fillRect(wx - 10, wy - 8, 30, 28);
    ctx.fillStyle = '#3a1f0a';
    ctx.fillRect(wx + (w.dir > 0 ? 18 : -34), wy - 2, 16, 18);
    ctx.fillStyle = '#222';
    ctx.fillRect(wx + (w.dir > 0 ? 22 : -30), wy - 18, 8, 12);
    const t = performance.now() / 400;
    ctx.fillStyle = 'rgba(80,80,80,0.6)';
    for (let i = 0; i < 3; i++) {
      const yOff = (t * 15 + i * 8) % 30;
      ctx.beginPath();
      ctx.arc(wx + (w.dir > 0 ? 26 : -26), wy - 22 - yOff, 5 + i, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#9c3a1a';
    ctx.fillRect(wx - 20, wy - 6, 44, 24);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(wx - 18, wy - 4, 40, 4);
    ctx.fillStyle = '#a8c8d8';
    ctx.fillRect(wx + (w.dir > 0 ? 12 : -22), wy + 2, 10, 6);
  }
  ctx.fillStyle = type === 'steam' ? '#5a3416' : '#3a4a7a';
  ctx.fillRect(wx + (w.dir > 0 ? -50 : 28), wy - 4, 40, 22);
  ctx.fillStyle = '#1a0e06';
  ctx.fillRect(wx + (w.dir > 0 ? -50 : 28), wy + 14, 40, 4);
  ctx.fillStyle = '#222';
  for (const offX of [-44, -32, -8, 8, 20]) {
    ctx.beginPath(); ctx.arc(wx + (w.dir > 0 ? offX : -offX), wy + 22, 5, 0, Math.PI * 2); ctx.fill();
  }
  drawCargoBar(wx + (w.dir > 0 ? -48 : 30), wy, 36, 8, w);
}

function drawCargoBar(x, y, width, height, w) {
  if (w.load > 0 && w.product) {
    ctx.fillStyle = R[w.product].color;
    const barW = (w.load / wagonCapacity()) * width;
    ctx.fillRect(x, y, barW, height);
  }
}

function drawCity() {
  ctx.fillStyle = '#a07a4a';
  ctx.beginPath();
  ctx.moveTo(CITY.x - 20, GROUND_Y);
  ctx.lineTo(CITY.x + 30, CITY.y + 20);
  ctx.lineTo(CITY.x + CITY.w + 20, GROUND_Y);
  ctx.closePath();
  ctx.fill();
  const buildings = [
    { x: 20, y: 70, w: 50, h: 100, c: '#a85a2a' },
    { x: 80, y: 40, w: 60, h: 130, c: '#7a4b25' },
    { x: 150, y: 60, w: 45, h: 110, c: '#c46a3a' },
    { x: 200, y: 30, w: 35, h: 140, c: '#5a3416' },
  ];
  for (const b of buildings) {
    ctx.fillStyle = b.c;
    ctx.fillRect(CITY.x + b.x, CITY.y + b.y, b.w, b.h);
    ctx.fillStyle = '#3a1f0a';
    ctx.fillRect(CITY.x + b.x - 2, CITY.y + b.y - 6, b.w + 4, 6);
    ctx.fillStyle = '#f1e3c2';
    for (let row = 0; row < Math.floor(b.h / 20); row++) {
      for (let col = 0; col < Math.floor(b.w / 14); col++) {
        if ((row + col) % 2 === 0) {
          ctx.fillRect(CITY.x + b.x + 4 + col * 14, CITY.y + b.y + 8 + row * 20, 6, 8);
        }
      }
    }
  }
  const cityLabel = (state.currentCity || 'Florianópolis').toUpperCase();
  ctx.font = 'bold 12px Georgia';
  const labelW = Math.max(140, ctx.measureText(cityLabel).width + 20);
  ctx.fillStyle = '#c69042';
  ctx.fillRect(CITY.x + CITY.w / 2 - labelW / 2, CITY.y + 6, labelW, 20);
  ctx.fillStyle = '#1a0e06';
  ctx.textAlign = 'center';
  ctx.fillText(cityLabel, CITY.x + CITY.w / 2, CITY.y + 20);

  if (state.contract) {
    const k = state.contract;
    const pct = clamp(k.delivered / k.need, 0, 1);
    const tpct = clamp(k.elapsed / k.deadline, 0, 1);
    const bx = CITY.x + 10;
    const by = CITY.y - 60;
    ctx.fillStyle = 'rgba(241,227,194,0.95)';
    ctx.fillRect(bx, by, 220, 54);
    ctx.strokeStyle = '#5a3416';
    ctx.strokeRect(bx, by, 220, 54);
    ctx.fillStyle = '#1a0e06';
    ctx.font = 'bold 11px Georgia';
    ctx.textAlign = 'left';
    ctx.fillText(`${R[k.product].name}`, bx + 6, by + 14);
    ctx.font = '11px Georgia';
    ctx.fillText(`${k.delivered}/${k.need}`, bx + 6, by + 28);
    ctx.fillStyle = '#1a0e06';
    ctx.fillRect(bx + 6, by + 32, 208, 4);
    ctx.fillStyle = '#4d7c3a';
    ctx.fillRect(bx + 6, by + 32, 208 * pct, 4);
    ctx.fillStyle = '#1a0e06';
    ctx.fillRect(bx + 6, by + 40, 208, 4);
    ctx.fillStyle = tpct > 0.75 ? '#a82e1c' : '#c69042';
    ctx.fillRect(bx + 6, by + 40, 208 * (1 - tpct), 4);
    ctx.fillStyle = '#1a0e06';
    ctx.font = '10px Georgia';
    ctx.textAlign = 'right';
    ctx.fillText(`${(k.deadline - k.elapsed).toFixed(0)}s`, bx + 214, by + 28);
  }
}

export function draw() {
  drawSky();
  drawGround();
  drawMineShaft();
  drawDeposits();
  drawRoad();
  drawWarehouse();
  drawFactories();
  drawCity();
  drawCart();
  drawWagon();
}
