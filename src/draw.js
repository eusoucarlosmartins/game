// draw.js — renderização do canvas (mina em grid + superfície compacta)
import { state } from './state.js';
import { R, RECIPE_BY_ID, CFG, MINE, TOOLS, SILO_DEFAULT_CAP } from './data.js';
import { fmtMoney, clamp } from './util.js';
import { transportTier, wagonCapacity, currentEra, eraData } from './progression.js';
import {
  W, H, GROUND_Y, FACTORY_AREA, CITY, ROAD, TOOLBAR, factoryRect,
} from './geometry.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ---------- Superfície ----------
function drawSky() {
  const grd = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  grd.addColorStop(0, '#e8c98a');
  grd.addColorStop(1, '#d2a76a');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, GROUND_Y);
  // sol
  ctx.fillStyle = 'rgba(255, 220, 150, 0.55)';
  ctx.beginPath();
  ctx.arc(80, 50, 36, 0, Math.PI * 2);
  ctx.fill();
  // montanhas distantes
  ctx.fillStyle = '#a07a4a';
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y - 16);
  ctx.lineTo(180, 80); ctx.lineTo(280, GROUND_Y - 16);
  ctx.lineTo(380, 100); ctx.lineTo(500, GROUND_Y - 16);
  ctx.lineTo(620, 90); ctx.lineTo(740, GROUND_Y - 16);
  ctx.closePath(); ctx.fill();
  // chão
  ctx.fillStyle = '#8a5a30';
  ctx.fillRect(0, GROUND_Y, W, 8);
  ctx.fillStyle = '#5a3416';
  ctx.fillRect(0, GROUND_Y + 8, W, 4);
}

// ---------- Silos por recurso ----------
function drawSilos() {
  const items = [];
  for (const k in state.warehouse) {
    if (R[k] && R[k].free) continue;
    const stock = state.warehouse[k] || 0;
    if (stock > 0) items.push({ k, n: stock });
  }
  items.sort((a, b) => b.n - a.n);
  const visible = items.slice(0, 8);
  if (visible.length === 0) {
    ctx.fillStyle = '#5a3416';
    ctx.font = 'italic 12px Georgia';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Aloque mineradores em veios expostos para começar a encher silos.', 20, 130);
    return;
  }
  const startX = 20;
  const maxW = 720;
  const siloW = Math.min(90, maxW / visible.length);
  const baseY = GROUND_Y; // base alinhada ao chão
  for (let i = 0; i < visible.length; i++) {
    drawSilo(startX + i * siloW, baseY, siloW - 6, visible[i].k);
  }
}

function drawSilo(x, baseY, w, resourceId) {
  const res = R[resourceId];
  const stock = state.warehouse[resourceId] || 0;
  const cap = (state.silos[resourceId] && state.silos[resourceId].cap) || SILO_DEFAULT_CAP;
  const fillPct = clamp(stock / cap, 0, 1);
  const h = 110;
  const top = baseY - h;
  // base de madeira
  ctx.fillStyle = '#5a3416';
  ctx.fillRect(x, top, w, h);
  ctx.fillStyle = '#7a4b25';
  ctx.fillRect(x + 3, top + 3, w - 6, h - 6);
  // teto triangular
  ctx.fillStyle = '#3a1f0a';
  ctx.beginPath();
  ctx.moveTo(x - 4, top);
  ctx.lineTo(x + w / 2, top - 16);
  ctx.lineTo(x + w + 4, top);
  ctx.closePath();
  ctx.fill();
  // recheio (sobe da base)
  const fillH = (h - 26) * fillPct;
  ctx.fillStyle = res.color;
  ctx.fillRect(x + 6, top + (h - 8) - fillH, w - 12, fillH);
  // moldura
  ctx.strokeStyle = '#1a0e06';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 3, top + 3, w - 6, h - 6);
  // placa com nome (curto)
  ctx.fillStyle = '#c69042';
  ctx.fillRect(x + 4, top + 6, w - 8, 16);
  ctx.fillStyle = '#1a0e06';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const short = res.name.length > 12 ? res.name.slice(0, 11) + '…' : res.name;
  ctx.fillText(short, x + w / 2, top + 14);
  // contador
  ctx.fillStyle = '#1a0e06';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.textBaseline = 'top';
  const cheio = fillPct >= 0.99;
  ctx.fillText(`${Math.floor(stock)}/${cap}${cheio ? ' ★' : ''}`, x + w / 2, baseY + 2);
}

// ---------- Fábricas compactas ----------
function drawFactories() {
  for (let i = 0; i < state.factories.length; i++) {
    const f = state.factories[i];
    const rect = factoryRect(i);
    // base de madeira
    ctx.fillStyle = '#7a4b25';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = '#5a3416';
    ctx.fillRect(rect.x, rect.y, rect.w, 6);
    // janelas
    ctx.fillStyle = '#f1e3c2';
    const winsPerRow = Math.max(2, Math.floor((rect.w - 20) / 26));
    for (let j = 0; j < winsPerRow; j++) {
      ctx.fillRect(rect.x + 10 + j * 26, rect.y + 22, 16, 14);
    }
    // chaminé com fumaça
    ctx.fillStyle = '#3a1f0a';
    ctx.fillRect(rect.x + rect.w - 22, rect.y - 36, 10, 36);
    const t = performance.now() / 500;
    if (f.brewing > 0) {
      for (let k = 0; k < 3; k++) {
        const yOff = (t * 12 + k * 8) % 28;
        ctx.fillStyle = `rgba(80,60,40,${0.4 - k * 0.1})`;
        ctx.beginPath();
        ctx.arc(rect.x + rect.w - 17, rect.y - 40 - yOff, 4 + k, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // placa com nome do produto
    const recipeName = R[f.recipeId]?.name || '—';
    ctx.fillStyle = '#c69042';
    ctx.fillRect(rect.x + 4, rect.y + rect.h - 22, rect.w - 8, 16);
    ctx.fillStyle = '#1a0e06';
    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(recipeName.length > 14 ? recipeName.slice(0, 13) + '…' : recipeName, rect.x + rect.w / 2, rect.y + rect.h - 14);
    // barra de progresso
    const recipe = RECIPE_BY_ID[f.recipeId];
    if (recipe && f.brewing > 0) {
      const pct = 1 - f.brewing / recipe.time;
      ctx.fillStyle = '#1a0e06';
      ctx.fillRect(rect.x + 4, rect.y - 8, rect.w - 8, 4);
      ctx.fillStyle = '#c69042';
      ctx.fillRect(rect.x + 4, rect.y - 8, (rect.w - 8) * pct, 4);
    }
  }
  for (let i = state.factories.length; i < CFG.factorySlotsMax; i++) {
    const rect = factoryRect(i);
    ctx.strokeStyle = 'rgba(122,75,37,0.5)';
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(90,52,22,0.7)';
    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SLOT', rect.x + rect.w / 2, rect.y + rect.h / 2 - 6);
    ctx.fillText(fmtMoney(CFG.factoryCosts[i]), rect.x + rect.w / 2, rect.y + rect.h / 2 + 10);
  }
}

// ---------- Cidade compacta ----------
function drawCity() {
  ctx.fillStyle = '#a07a4a';
  ctx.beginPath();
  ctx.moveTo(CITY.x - 6, GROUND_Y);
  ctx.lineTo(CITY.x + CITY.w / 2, CITY.y + 30);
  ctx.lineTo(CITY.x + CITY.w + 6, GROUND_Y);
  ctx.closePath();
  ctx.fill();
  const buildings = [
    { x: 12, y: 60, w: 36, h: 130, c: '#a85a2a' },
    { x: 52, y: 38, w: 40, h: 152, c: '#7a4b25' },
    { x: 96, y: 70, w: 30, h: 120, c: '#5a3416' },
  ];
  for (const b of buildings) {
    ctx.fillStyle = b.c;
    ctx.fillRect(CITY.x + b.x, CITY.y + b.y, b.w, b.h);
    ctx.fillStyle = '#3a1f0a';
    ctx.fillRect(CITY.x + b.x - 2, CITY.y + b.y - 4, b.w + 4, 4);
    ctx.fillStyle = '#f1e3c2';
    for (let row = 0; row < Math.floor(b.h / 18); row++) {
      for (let col = 0; col < Math.floor(b.w / 12); col++) {
        if ((row + col) % 2 === 0) {
          ctx.fillRect(CITY.x + b.x + 3 + col * 12, CITY.y + b.y + 6 + row * 18, 5, 7);
        }
      }
    }
  }
  // placa com nome
  const cityLabel = (state.currentCity || 'Florianópolis').toUpperCase();
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  const labelW = Math.max(120, ctx.measureText(cityLabel).width + 16);
  ctx.fillStyle = '#c69042';
  ctx.fillRect(CITY.x + CITY.w / 2 - labelW / 2, CITY.y, labelW, 18);
  ctx.fillStyle = '#1a0e06';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cityLabel, CITY.x + CITY.w / 2, CITY.y + 9);
}

// ---------- Estrada + carruagem ----------
function drawRoad() {
  const tier = transportTier();
  if (tier >= 6) {
    ctx.fillStyle = '#6b3f1a';
    ctx.fillRect(ROAD.x1, ROAD.y - 6, ROAD.x2 - ROAD.x1, 14);
    ctx.fillStyle = '#3a1f0a';
    for (let x = ROAD.x1; x < ROAD.x2; x += 14) ctx.fillRect(x, ROAD.y - 4, 8, 12);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ROAD.x1, ROAD.y - 2); ctx.lineTo(ROAD.x2, ROAD.y - 2);
    ctx.moveTo(ROAD.x1, ROAD.y + 6); ctx.lineTo(ROAD.x2, ROAD.y + 6);
    ctx.stroke();
  } else if (tier >= 2) {
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(ROAD.x1, ROAD.y - 6, ROAD.x2 - ROAD.x1, 14);
  } else {
    ctx.fillStyle = '#a07a4a';
    ctx.fillRect(ROAD.x1, ROAD.y - 5, ROAD.x2 - ROAD.x1, 12);
  }
}

function drawWagon() {
  const w = state.wagon;
  const wx = ROAD.x1 + (ROAD.x2 - ROAD.x1) * w.pos;
  const wy = ROAD.y - 12;
  // versão compacta — só uma carruagem (sem progressão visual por tier neste layout)
  ctx.fillStyle = '#7a4b25';
  ctx.fillRect(wx - 14, wy, 28, 12);
  ctx.fillStyle = '#5a3416';
  ctx.fillRect(wx - 14, wy + 10, 28, 3);
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(wx - 10, wy + 14, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(wx + 10, wy + 14, 4, 0, Math.PI * 2); ctx.fill();
  if (w.load > 0 && w.product) {
    ctx.fillStyle = R[w.product].color;
    const barW = clamp(w.load / wagonCapacity(), 0, 1) * 24;
    ctx.fillRect(wx - 12, wy + 2, barW, 6);
  }
}

// ---------- Grid da mina ----------
function drawMineGrid() {
  const { cols, rows, cell, x: gx, y: gy } = MINE;
  if (!state.mine.grid) return;
  // moldura
  ctx.fillStyle = '#6b3f1a';
  ctx.fillRect(gx, gy, cols * cell, rows * cell);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      drawTile(gx + c * cell, gy + r * cell, cell, state.mine.grid[r][c]);
    }
  }
  // FX da dinamite (anéis + estilhaços)
  if (state.mine.tntFx) {
    const fx = state.mine.tntFx;
    const px = gx + (fx.c + 0.5) * cell;
    const py = gy + (fx.r + 0.5) * cell;
    const progress = Math.min(1, (0.8 - fx.t) / 0.8); // 0 → 1
    const alpha = Math.max(0, fx.t / 0.8);
    // anel externo laranja
    ctx.strokeStyle = `rgba(255,140,40,${alpha})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(px, py, cell * 2.2 * progress, 0, Math.PI * 2);
    ctx.stroke();
    // anel interno amarelo
    ctx.strokeStyle = `rgba(255,220,80,${alpha * 0.9})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px, py, cell * 1.4 * progress, 0, Math.PI * 2);
    ctx.stroke();
    // estilhaços
    ctx.fillStyle = `rgba(80,40,20,${alpha})`;
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const dist = cell * 2.6 * progress;
      const sx = px + Math.cos(ang) * dist;
      const sy = py + Math.sin(ang) * dist;
      ctx.fillRect(sx - 2, sy - 2, 4, 4);
    }
  }
  // grade sutil
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    ctx.moveTo(gx, gy + r * cell);
    ctx.lineTo(gx + cols * cell, gy + r * cell);
    ctx.stroke();
  }
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath();
    ctx.moveTo(gx + c * cell, gy);
    ctx.lineTo(gx + c * cell, gy + rows * cell);
    ctx.stroke();
  }
}

function drawTile(px, py, cell, t) {
  if (!t.revealed) {
    // neblina
    ctx.fillStyle = '#0a0604';
    ctx.fillRect(px, py, cell, cell);
    return;
  }
  if (t.type === 'air') {
    ctx.fillStyle = '#1a0e06';
    ctx.fillRect(px, py, cell, cell);
    // vigas decorativas
    ctx.fillStyle = '#5a3416';
    ctx.fillRect(px, py, cell, 3);
    ctx.fillRect(px, py + cell - 3, cell, 3);
    return;
  }
  if (t.type === 'dirt') {
    ctx.fillStyle = '#8a5a30';
    ctx.fillRect(px, py, cell, cell);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i < 5; i++) {
      const dx = ((px * 13 + i * 7) % (cell - 3));
      const dy = ((py * 17 + i * 11) % (cell - 3));
      ctx.fillRect(px + dx, py + dy, 3, 2);
    }
    return;
  }
  if (t.type === 'stone') {
    ctx.fillStyle = '#7d7d7d';
    ctx.fillRect(px, py, cell, cell);
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(px + 4, py + 4, cell - 8, cell - 8);
    ctx.fillStyle = '#a0a0a0';
    ctx.fillRect(px + 8, py + 6, 6, 4);
    ctx.fillRect(px + 18, py + 14, 5, 5);
    return;
  }
  if (t.type === 'ore') {
    const res = R[t.resource];
    // fundo levemente mais escuro pra destacar chips coloridos
    ctx.fillStyle = '#4a3020';
    ctx.fillRect(px, py, cell, cell);
    // chips coloridos do minério
    ctx.fillStyle = res.color;
    const n = Math.max(4, Math.floor(t.amount / 4));
    for (let i = 0; i < n; i++) {
      const dx = (px * 7 + i * 5) % (cell - 10);
      const dy = (py * 11 + i * 7) % (cell - 14);
      ctx.fillRect(px + 4 + dx, py + 14 + dy, 6, 5);
    }
    const era = eraData(currentEra());
    const locked = !era.deposits.includes(t.resource);
    // moldura amarela quando minerador alocado
    if (t.worker) {
      ctx.strokeStyle = '#ffd44a';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 2, py + 2, cell - 4, cell - 4);
    }
    // === Label de identificação (pílula escura + texto dourado) ===
    const label = resAbbrev(t.resource);
    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    const labelW = Math.max(22, ctx.measureText(label).width + 8);
    ctx.fillStyle = 'rgba(20,10,5,0.88)';
    ctx.fillRect(px + cell / 2 - labelW / 2, py + 1, labelW, 14);
    ctx.fillStyle = locked ? '#9a8a6a' : '#ffd44a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, px + cell / 2, py + 8);
    // === Quantidade restante (canto inferior direito, pequeno) ===
    if (!locked) {
      const amt = Math.ceil(t.amount);
      ctx.font = 'bold 10px Arial, sans-serif';
      const amtTxt = amt + '';
      const amtW = ctx.measureText(amtTxt).width + 4;
      ctx.fillStyle = 'rgba(20,10,5,0.75)';
      ctx.fillRect(px + cell - amtW - 1, py + cell - 12, amtW, 11);
      ctx.fillStyle = '#f1e3c2';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(amtTxt, px + cell - 3, py + cell - 6);
    }
    if (t.worker) drawMinerSprite(px + 8, py + cell - 4);
    // === Cadeado se bloqueado pela era ===
    if (locked) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(px, py + 16, cell, cell - 16);
      ctx.fillStyle = '#ffd44a';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔒', px + cell / 2, py + cell / 2 + 8);
    }
  }
}

function resAbbrev(id) {
  return ({
    coal:'CVO', iron_ore:'FRO', copper_ore:'CBR', zinc_ore:'ZNC', lead:'CHB',
    silver_ore:'PRT', gold_ore:'OUR', sulfur:'ENX', saltpeter:'SLT', oil:'PET',
    wood:'MAD', stone:'PED', clay:'ARG', sand:'ARE', diamond:'DIA', ruby:'RUB',
  })[id] || id.slice(0, 3).toUpperCase();
}

function drawMinerSprite(cx, by) {
  const t = performance.now() / 200;
  const swing = Math.sin(t) * 3;
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(cx - 3, by - 12, 6, 8);
  ctx.fillStyle = '#8a6a4d';
  ctx.fillRect(cx - 3, by - 18, 6, 5);
  ctx.fillStyle = '#c69042';
  ctx.fillRect(cx - 4, by - 19, 8, 2);
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx + 3, by - 8);
  ctx.lineTo(cx + 8 + swing, by - 14 - Math.abs(swing));
  ctx.stroke();
}

// ---------- Toolbar ----------
function drawToolbar() {
  const order = ['pick', 'tnt', 'compass', 'miner'];
  const icons = { pick: '⛏', tnt: 'TNT', compass: '◇', miner: '👤' };
  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    const x = TOOLBAR.x;
    const y = TOOLBAR.y + i * TOOLBAR.slotH;
    const selected = state.mine.tool === id;
    ctx.fillStyle = selected ? '#c69042' : '#5a3416';
    ctx.fillRect(x - 3, y - 3, TOOLBAR.w + 6, TOOLBAR.w + 6);
    ctx.fillStyle = '#1a0e06';
    ctx.fillRect(x, y, TOOLBAR.w, TOOLBAR.w);
    ctx.fillStyle = selected ? '#ffd44a' : '#f1e3c2';
    ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icons[id], x + TOOLBAR.w / 2, y + TOOLBAR.w / 2);
    ctx.fillStyle = '#f1e3c2';
    ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(TOOLS[id].name, x + TOOLBAR.w / 2, y + TOOLBAR.w + 3);
  }
}

// ---------- Entry ----------
export function draw() {
  drawSky();
  drawSilos();
  drawFactories();
  drawCity();
  drawRoad();
  drawWagon();
  drawMineGrid();
  drawToolbar();
}
