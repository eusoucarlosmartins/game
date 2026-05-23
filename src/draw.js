// @ts-nocheck
// draw.js — renderização do canvas (mina em grid + superfície compacta)
import { state } from './state.js';
import { R, RECIPE_BY_ID, CFG, MINE, TOOLS, SILO_DEFAULT_CAP } from './data.js';
import { fmtMoney, clamp } from './util.js';
import { transportTier, wagonCapacity, currentEra, eraData } from './progression.js';
import { W, GROUND_Y, CITY, ROAD, TOOLBAR, factoryRect } from './geometry.js';

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

// ---------- Cidade colonial brasileira ----------
function drawCity() {
  const cx0 = CITY.x;
  const w = CITY.w;

  // base de terra (chão da cidade)
  ctx.fillStyle = '#a07a4a';
  ctx.fillRect(cx0 - 6, GROUND_Y - 3, w + 12, 6);

  // Casa esquerda (amarela com telha vermelha)
  drawColonialHouse(cx0 + 4,  GROUND_Y, 32, 92, '#e8c87a', '#a82e1c');
  // Igreja no centro (mais alta, com torre)
  drawColonialChurch(cx0 + w / 2 - 20, GROUND_Y);
  // Casa direita (verde com telha)
  drawColonialHouse(cx0 + w - 36, GROUND_Y, 32, 85, '#b8c8a8', '#8a4a2a');

  // Placa "WESTERN" no topo
  drawCitySign(cx0 + w / 2, CITY.y);
}

function drawColonialHouse(x, baseY, w, h, faceColor, roofColor) {
  const top = baseY - h;
  // paredes
  ctx.fillStyle = faceColor;
  ctx.fillRect(x, top, w, h);
  // rodapé escuro
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(x, baseY - 5, w, 5);
  // telhado triangular
  ctx.fillStyle = roofColor;
  ctx.beginPath();
  ctx.moveTo(x - 4, top);
  ctx.lineTo(x + w / 2, top - 14);
  ctx.lineTo(x + w + 4, top);
  ctx.closePath();
  ctx.fill();
  // beirado sombreado
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x - 4, top, w + 8, 2);
  // ripas do telhado (telhas)
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const r = i / 4;
    const lx = x - 4 + (w + 8) * r;
    const ly = top - 14 * (1 - Math.abs(r - 0.5) * 2);
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, top); ctx.stroke();
  }
  // porta central
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(x + w / 2 - 4, baseY - 20, 8, 15);
  // maçaneta
  ctx.fillStyle = '#c69042';
  ctx.fillRect(x + w / 2 + 2, baseY - 13, 1.5, 2);
  // janelas (2 se cabe, 1 se for casa estreita)
  const wins = w >= 28 ? 2 : 1;
  for (let i = 0; i < wins; i++) {
    const wx = wins === 2 ? (i === 0 ? x + 4 : x + w - 12) : x + w / 2 - 4;
    const wy = top + 14;
    ctx.fillStyle = '#a8c8d8';
    ctx.fillRect(wx, wy, 8, 10);
    ctx.strokeStyle = '#3a1f0a';
    ctx.lineWidth = 1;
    ctx.strokeRect(wx, wy, 8, 10);
    // cruz da janela
    ctx.beginPath();
    ctx.moveTo(wx + 4, wy); ctx.lineTo(wx + 4, wy + 10);
    ctx.moveTo(wx, wy + 5); ctx.lineTo(wx + 8, wy + 5);
    ctx.stroke();
  }
}

function drawColonialChurch(x, baseY) {
  const w = 40, h = 110;
  const top = baseY - h;
  // corpo branco (caiado)
  ctx.fillStyle = '#f1e3c2';
  ctx.fillRect(x, top, w, h);
  // rodapé
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(x, baseY - 5, w, 5);
  // telhado triangular (vermelho)
  ctx.fillStyle = '#a82e1c';
  ctx.beginPath();
  ctx.moveTo(x - 4, top);
  ctx.lineTo(x + w / 2, top - 14);
  ctx.lineTo(x + w + 4, top);
  ctx.closePath();
  ctx.fill();
  // torre central (sobe acima do telhado)
  const tx = x + w / 2 - 6;
  const ty = top - 38;
  ctx.fillStyle = '#f1e3c2';
  ctx.fillRect(tx, ty, 12, 40);
  // teto piramidal da torre
  ctx.fillStyle = '#a82e1c';
  ctx.beginPath();
  ctx.moveTo(tx - 3, ty);
  ctx.lineTo(tx + 6, ty - 14);
  ctx.lineTo(tx + 15, ty);
  ctx.closePath();
  ctx.fill();
  // arco do sino
  ctx.fillStyle = '#1a0e06';
  ctx.beginPath();
  ctx.arc(tx + 6, ty + 12, 5, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(tx + 1, ty + 12, 10, 4);
  // cruz no topo
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(tx + 5, ty - 22, 2, 10);
  ctx.fillRect(tx + 3, ty - 18, 6, 2);
  // porta arqueada principal
  ctx.fillStyle = '#5a3416';
  ctx.beginPath();
  ctx.arc(x + w / 2, baseY - 14, 6, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x + w / 2 - 6, baseY - 14, 12, 9);
  // detalhe vertical na porta
  ctx.strokeStyle = '#3a1f0a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, baseY - 20);
  ctx.lineTo(x + w / 2, baseY - 5);
  ctx.stroke();
  // janela arqueada acima da porta
  const jy = top + 30;
  ctx.fillStyle = '#a8c8d8';
  ctx.beginPath();
  ctx.arc(x + w / 2, jy, 5, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x + w / 2 - 5, jy, 10, 8);
  ctx.strokeStyle = '#3a1f0a';
  ctx.beginPath();
  ctx.arc(x + w / 2, jy, 5, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.strokeRect(x + w / 2 - 5, jy, 10, 8);
}

function drawCitySign(centerX, topY) {
  const cityLabel = (state.currentCity || 'Florianópolis').toUpperCase();
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  const labelW = Math.max(120, ctx.measureText(cityLabel).width + 18);
  const labelH = 18;
  // moldura escura
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(centerX - labelW / 2 - 2, topY - 2, labelW + 4, labelH + 4);
  // tabuleta de madeira
  ctx.fillStyle = '#c69042';
  ctx.fillRect(centerX - labelW / 2, topY, labelW, labelH);
  // textura de grão da madeira
  ctx.strokeStyle = 'rgba(122,75,37,0.4)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = topY + (labelH / 4) * i;
    ctx.beginPath(); ctx.moveTo(centerX - labelW / 2 + 4, y); ctx.lineTo(centerX + labelW / 2 - 4, y); ctx.stroke();
  }
  // texto
  ctx.fillStyle = '#1a0e06';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cityLabel, centerX, topY + labelH / 2);
  // pregos nos cantos
  ctx.fillStyle = '#5a3416';
  for (const dx of [-labelW / 2 + 5, labelW / 2 - 5]) {
    ctx.beginPath();
    ctx.arc(centerX + dx, topY + labelH / 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // cordas pendurando da tabuleta (efeito "western swing")
  ctx.strokeStyle = '#3a1f0a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(centerX - labelW / 2, topY);
  ctx.lineTo(centerX - labelW / 2 - 6, topY - 6);
  ctx.moveTo(centerX + labelW / 2, topY);
  ctx.lineTo(centerX + labelW / 2 + 6, topY - 6);
  ctx.stroke();
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
  const t = performance.now() / 220;
  const swing = Math.sin(t) * 3;
  // pernas
  ctx.fillStyle = '#2a1810';
  ctx.fillRect(cx - 4, by - 6, 3, 6);
  ctx.fillRect(cx + 1, by - 6, 3, 6);
  // tronco azul
  ctx.fillStyle = '#3a4a7a';
  ctx.fillRect(cx - 4, by - 14, 8, 9);
  // cinto
  ctx.fillStyle = '#5a3416';
  ctx.fillRect(cx - 4, by - 7, 8, 2);
  // cabeça rosada
  ctx.fillStyle = '#d8a878';
  ctx.fillRect(cx - 3, by - 19, 6, 5);
  // bigode
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(cx - 2, by - 16, 4, 1);
  // chapéu dourado
  ctx.fillStyle = '#c69042';
  ctx.fillRect(cx - 5, by - 20, 10, 2);
  ctx.fillRect(cx - 3, by - 22, 6, 2);
  // picareta com cabo de madeira + ponta de aço
  ctx.strokeStyle = '#5a3416';
  ctx.lineWidth = 2;
  const hx = cx + 4, hy = by - 12;
  const px = hx + 8 + swing;
  const py = hy - 6 - Math.abs(swing);
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(px, py);
  ctx.stroke();
  ctx.fillStyle = '#8c95a1';
  ctx.fillRect(px - 2, py - 2, 5, 3);
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

// ---------- Tooltip do tile sob o mouse ----------
function drawTileTooltip() {
  if (state.mouseX < 0 || state.mouseY < 0) return;
  if (!state.mine.grid) return;
  if (state.mouseY < MINE.y) return;
  if (state.mouseX >= MINE.x + MINE.cols * MINE.cell) return;
  if (state.mouseY >= MINE.y + MINE.rows * MINE.cell) return;
  const c = Math.floor((state.mouseX - MINE.x) / MINE.cell);
  const r = Math.floor((state.mouseY - MINE.y) / MINE.cell);
  if (c < 0 || c >= MINE.cols || r < 0 || r >= MINE.rows) return;
  const t = state.mine.grid[r][c];
  if (!t.revealed) return;
  // monta as linhas do tooltip
  let title, sub, color = '#f1e3c2';
  if (t.type === 'air') { title = 'Túnel'; sub = 'Vazio (pode atravessar)'; }
  else if (t.type === 'dirt') { title = 'Terra'; sub = 'Cavar: $5'; }
  else if (t.type === 'stone') { title = 'Pedra'; sub = 'Cavar: $12'; }
  else if (t.type === 'ore') {
    const era = eraData(currentEra());
    const locked = !era.deposits.includes(t.resource);
    title = R[t.resource].name;
    sub = `Quantidade: ${Math.ceil(t.amount)} · ${t.worker ? 'minerador ativo' : 'sem trabalhador'}`;
    if (locked) { sub += ' · 🔒 era bloqueia'; color = '#ffb060'; }
    else color = R[t.resource].color;
  }
  // posiciona o tooltip (evita sair da tela)
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  const titleW = ctx.measureText(title).width;
  ctx.font = '11px "Segoe UI", Arial, sans-serif';
  const subW = ctx.measureText(sub).width;
  const ttW = Math.max(titleW, subW) + 16;
  const ttH = 38;
  let tx = state.mouseX + 14;
  let ty = state.mouseY + 14;
  if (tx + ttW > W) tx = state.mouseX - ttW - 8;
  if (ty + ttH > MINE.y + MINE.rows * MINE.cell) ty = state.mouseY - ttH - 4;
  ctx.fillStyle = 'rgba(20,10,5,0.92)';
  ctx.fillRect(tx, ty, ttW, ttH);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(tx, ty, ttW, ttH);
  ctx.fillStyle = color;
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(title, tx + 8, ty + 6);
  ctx.fillStyle = '#f1e3c2';
  ctx.font = '11px "Segoe UI", Arial, sans-serif';
  ctx.fillText(sub, tx + 8, ty + 22);
}

// ---------- Banner do evento ativo ----------
function drawEventBanner() {
  if (!state.activeEvent) return;
  const e = state.activeEvent;
  const cx = W / 2;
  const baseY = 0;
  const bw = 360, bh = 36;
  // moldura
  const bg = e.kind === 'bad' ? 'rgba(120,40,30,0.92)'
            : e.kind === 'good' ? 'rgba(40,80,50,0.92)'
            : 'rgba(60,40,20,0.92)';
  ctx.fillStyle = bg;
  ctx.fillRect(cx - bw / 2, baseY, bw, bh);
  // barra de progresso de tempo
  const pct = clamp(e.timeLeft / (e.total || 1), 0, 1);
  ctx.fillStyle = e.kind === 'bad' ? '#d05a3a' : '#c69042';
  ctx.fillRect(cx - bw / 2, baseY + bh - 4, bw * pct, 4);
  // texto
  const icon = e.kind === 'good' ? '✨' : e.kind === 'bad' ? '⚠' : '📰';
  ctx.fillStyle = '#f1e3c2';
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${icon} ${e.name}`, cx - bw / 2 + 10, baseY + 12);
  ctx.font = '11px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(241,227,194,0.85)';
  ctx.fillText(e.desc, cx - bw / 2 + 10, baseY + 26);
  // contador
  ctx.fillStyle = '#f1e3c2';
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.ceil(e.timeLeft)}s`, cx + bw / 2 - 10, baseY + 18);
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
  drawEventBanner();
  drawTileTooltip();
}
