// draw.js — renderização do canvas (mina em grid + superfície compacta)
import { state } from './state.js';
import { R, RECIPE_BY_ID, CFG, MINE, TOOLS, SILO_DEFAULT_CAP } from './data.js';
import { fmtMoney, clamp } from './util.js';
import { transportTier, wagonCapacity, currentEra, eraData } from './progression.js';
import { ingredientHave } from './factories.js';
import { getProjectDef } from './projects.js';
import { activeMine, regenCost } from './mine.js';
import {
  W, H, GROUND_Y, MINE_GROUND_Y, CITY, ROAD,
  OVERWORLD, TOOLBAR, MINE_BACK_BTN, factoryRect,
} from './geometry.js';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

// ---------- Cena MINA: faixa de céu sobre a superfície + chão ----------
function drawMineSky() {
  const grd = ctx.createLinearGradient(0, 0, 0, MINE_GROUND_Y);
  grd.addColorStop(0, '#e8c98a');
  grd.addColorStop(1, '#d2a76a');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, MINE_GROUND_Y);
  // nuvens sutis
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (const c of [[280, 60, 50], [600, 50, 38], [950, 80, 55]]) {
    ctx.beginPath();
    ctx.ellipse(c[0], c[1], c[2], c[2] * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // título com nome da mina ativa
  const mine = activeMine();
  const nameTxt = mine ? `${mine.name.toUpperCase()} — SUPERFÍCIE` : 'SUPERFÍCIE';
  ctx.fillStyle = 'rgba(58,31,10,0.7)';
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(nameTxt, 210, 70);
  // chão
  ctx.fillStyle = '#8a5a30';
  ctx.fillRect(0, MINE_GROUND_Y, W, 8);
  ctx.fillStyle = '#5a3416';
  ctx.fillRect(0, MINE_GROUND_Y + 8, W, 4);
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
    ctx.fillText('Aloque mineradores em veios expostos para começar a encher silos.', 200, 130);
    return;
  }
  const startX = 200; // depois do botão "Voltar ao Mapa"
  const maxW = W - 220;
  const siloW = Math.min(100, maxW / visible.length);
  const baseY = MINE_GROUND_Y; // base alinhada ao chão da mina
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

// ---------- Cidades — 3 estilos por região de SC ----------
const CITY_STYLES = {
  // Litoral: portos
  'Florianópolis': 'port', 'Itajaí': 'port', 'Navegantes': 'port',
  'Balneário Camboriú': 'port', 'Camboriú': 'port', 'Tubarão': 'port',
  // Vale do Itajaí / norte industrial
  'Joinville': 'industrial', 'Blumenau': 'industrial', 'Brusque': 'industrial',
  'Jaraguá do Sul': 'industrial', 'São Bento do Sul': 'industrial',
  'Rio do Sul': 'industrial', 'São José': 'industrial', 'Palhoça': 'industrial',
  'Criciúma': 'industrial',
  // Outras (Lages, Chapecó, etc.) = colonial padrão
};

function drawCity() {
  const cx0 = CITY.x;
  const w = CITY.w;

  // base de terra
  ctx.fillStyle = '#a07a4a';
  ctx.fillRect(cx0 - 6, GROUND_Y - 3, w + 12, 6);

  const style = CITY_STYLES[state.currentCity] || 'colonial';
  if (style === 'port') drawPortCity(cx0, w);
  else if (style === 'industrial') drawIndustrialCity(cx0, w);
  else drawColonialCity(cx0, w);

  drawCitySign(cx0 + w / 2, CITY.y);
}

function drawColonialCity(cx0, w) {
  drawColonialHouse(cx0 + 4,  GROUND_Y, 32, 92, '#e8c87a', '#a82e1c');
  drawColonialChurch(cx0 + w / 2 - 20, GROUND_Y);
  drawColonialHouse(cx0 + w - 36, GROUND_Y, 32, 85, '#b8c8a8', '#8a4a2a');
}

// Cidade portuária: farol listrado + casas claras + ondinhas no chão
function drawPortCity(cx0, w) {
  // Casa esquerda azul-claro
  drawColonialHouse(cx0 + 4, GROUND_Y, 28, 80, '#a8c8d8', '#5a3416');
  // Farol no centro (substitui igreja)
  drawLighthouse(cx0 + w / 2 - 10, GROUND_Y);
  // Casa direita branca
  drawColonialHouse(cx0 + w - 32, GROUND_Y, 28, 70, '#f1e3c2', '#8a4a2a');
  // Ondinhas representando água na frente
  ctx.strokeStyle = '#5a9fc8';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const y = GROUND_Y + 4 + i * 3;
    ctx.beginPath();
    for (let x = cx0 - 4; x <= cx0 + w + 4; x += 6) {
      ctx.lineTo(x, y + Math.sin((x + i * 4) * 0.3) * 1.2);
    }
    ctx.stroke();
  }
}

function drawLighthouse(x, baseY) {
  const w = 20, h = 130;
  const top = baseY - h;
  // base larga
  ctx.fillStyle = '#5a3416';
  ctx.fillRect(x - 4, baseY - 14, w + 8, 14);
  // torre listrada vermelho/branco
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#f1e3c2' : '#a82e1c';
    ctx.fillRect(x, top + 20 + i * 18, w, 18);
  }
  // topo (sala da lanterna)
  ctx.fillStyle = '#5a3416';
  ctx.fillRect(x - 4, top + 12, w + 8, 10);
  ctx.fillStyle = '#ffe680';
  ctx.fillRect(x + 2, top, w - 4, 14);
  ctx.strokeStyle = '#3a1f0a';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 2, top, w - 4, 14);
  // teto cônico
  ctx.fillStyle = '#3a1f0a';
  ctx.beginPath();
  ctx.moveTo(x - 4, top);
  ctx.lineTo(x + w / 2, top - 14);
  ctx.lineTo(x + w + 4, top);
  ctx.closePath();
  ctx.fill();
  // farol "piscando" (raio amarelo translúcido oscilante)
  const t = performance.now() / 600;
  const beam = (Math.sin(t) + 1) / 2;
  ctx.fillStyle = `rgba(255,230,128,${0.15 + 0.25 * beam})`;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, top + 6);
  ctx.lineTo(x + w / 2 - 40, top - 30);
  ctx.lineTo(x + w / 2 + 40, top - 30);
  ctx.closePath();
  ctx.fill();
}

// Cidade industrial: chaminés altas com fumaça + prédio de tijolo
function drawIndustrialCity(cx0, w) {
  // Fábrica esquerda (grande, com chaminé)
  drawFactoryBuilding(cx0 + 4, GROUND_Y, 44, 110, '#8a3a1a', '#5a2010');
  // Prédio central (mais alto)
  drawIndustrialBlock(cx0 + w / 2 - 18, GROUND_Y, 36, 150);
  // Fábrica direita (menor)
  drawFactoryBuilding(cx0 + w - 38, GROUND_Y, 30, 85, '#6a4020', '#4a2010');
}

function drawFactoryBuilding(x, baseY, w, h, faceColor, roofColor) {
  const top = baseY - h;
  // corpo de tijolo
  ctx.fillStyle = faceColor;
  ctx.fillRect(x, top, w, h);
  // padrão de tijolos (linhas horizontais)
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  for (let y = top + 6; y < baseY - 6; y += 6) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke();
  }
  // telhado plano escuro
  ctx.fillStyle = roofColor;
  ctx.fillRect(x - 2, top - 4, w + 4, 6);
  // rodapé
  ctx.fillStyle = '#1a0e06';
  ctx.fillRect(x, baseY - 4, w, 4);
  // chaminé com fumaça
  const chimX = x + w - 10;
  const chimTop = top - 36;
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(chimX, chimTop, 8, 36);
  ctx.fillRect(chimX - 2, chimTop, 12, 4);
  // fumaça animada
  const t = performance.now() / 400;
  for (let i = 0; i < 4; i++) {
    const yOff = (t * 18 + i * 12) % 50;
    ctx.fillStyle = `rgba(80,60,40,${0.5 - i * 0.1})`;
    ctx.beginPath();
    ctx.arc(chimX + 4, chimTop - yOff, 4 + i, 0, Math.PI * 2);
    ctx.fill();
  }
  // janelas industriais (grade)
  ctx.fillStyle = '#a8c8d8';
  for (let row = 0; row < Math.floor(h / 22); row++) {
    for (let col = 0; col < Math.floor(w / 14); col++) {
      ctx.fillRect(x + 4 + col * 14, top + 8 + row * 22, 8, 10);
    }
  }
}

function drawIndustrialBlock(x, baseY, w, h) {
  const top = baseY - h;
  // prédio cinza-escuro
  ctx.fillStyle = '#5a5a5a';
  ctx.fillRect(x, top, w, h);
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(x, top, w, 8);
  // rodapé
  ctx.fillStyle = '#1a0e06';
  ctx.fillRect(x, baseY - 4, w, 4);
  // grade densa de janelas
  ctx.fillStyle = '#ffd44a';
  for (let row = 0; row < Math.floor(h / 14); row++) {
    for (let col = 0; col < Math.floor(w / 9); col++) {
      ctx.fillRect(x + 2 + col * 9, top + 12 + row * 14, 5, 6);
    }
  }
  // antena/mastro no topo
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(x + w / 2 - 1, top - 16, 2, 16);
  // luz piscante
  const t = performance.now() / 300;
  if (Math.sin(t) > 0) {
    ctx.fillStyle = '#ff6040';
    ctx.beginPath();
    ctx.arc(x + w / 2, top - 18, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
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
  const mine = activeMine();
  if (!mine || !mine.grid) return;
  // moldura
  ctx.fillStyle = '#6b3f1a';
  ctx.fillRect(gx, gy, cols * cell, rows * cell);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      drawTile(gx + c * cell, gy + r * cell, cell, mine.grid[r][c]);
    }
  }
  // FX da dinamite (anéis + estilhaços)
  if (mine.tntFx) {
    const fx = mine.tntFx;
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
  if (t.type === 'shaft') {
    // Poço do elevador (fundo preto + 2 trilhos verticais)
    ctx.fillStyle = '#0a0604';
    ctx.fillRect(px, py, cell, cell);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(px + 6, py, 3, cell);
    ctx.fillRect(px + cell - 9, py, 3, cell);
    // vigas horizontais a cada 2 tiles
    ctx.fillStyle = '#5a3416';
    ctx.fillRect(px, py + cell - 3, cell, 3);
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
    const selected = state.tool === id;
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
  const mine = activeMine();
  if (!mine || !mine.grid) return;
  if (state.mouseY < MINE.y) return;
  if (state.mouseX >= MINE.x + MINE.cols * MINE.cell) return;
  if (state.mouseY >= MINE.y + MINE.rows * MINE.cell) return;
  const c = Math.floor((state.mouseX - MINE.x) / MINE.cell);
  const r = Math.floor((state.mouseY - MINE.y) / MINE.cell);
  if (c < 0 || c >= MINE.cols || r < 0 || r >= MINE.rows) return;
  const t = mine.grid[r][c];
  if (!t.revealed) return;
  // monta as linhas do tooltip
  let title, sub, color = '#f1e3c2';
  if (t.type === 'shaft') { title = 'Poço do Elevador'; sub = 'Trilhos do carrinho — não cavável'; }
  else if (t.type === 'air') { title = 'Túnel'; sub = 'Vazio (pode atravessar)'; }
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

// ---------- Cena OVERWORLD: mapa ----------
function drawOverworldBg() {
  // Fundo papel envelhecido com gradiente
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#d4b478');
  grd.addColorStop(0.5, '#c9a76a');
  grd.addColorStop(1, '#b89058');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);
  // Textura sutil (pontilhado)
  ctx.fillStyle = 'rgba(80,50,20,0.08)';
  for (let i = 0; i < 240; i++) {
    const x = (i * 137) % W;
    const y = (i * 89) % H;
    ctx.fillRect(x, y, 2, 2);
  }
  // Linha de horizonte com montanhas longe
  ctx.fillStyle = '#9a7a4a';
  ctx.beginPath();
  ctx.moveTo(0, 180);
  ctx.lineTo(130, 80); ctx.lineTo(230, 170);
  ctx.lineTo(340, 60); ctx.lineTo(480, 160);
  ctx.lineTo(620, 90); ctx.lineTo(770, 170);
  ctx.lineTo(900, 70); ctx.lineTo(1080, 160);
  ctx.lineTo(1280, 90); ctx.lineTo(1280, 0);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  // Sombras das montanhas
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, 170, W, 14);
  // Algumas árvores espalhadas (clusters verdes)
  const trees = [
    [60, 240], [110, 270], [160, 260],
    [320, 250], [350, 230], [380, 250],
    [620, 260], [660, 250], [700, 230],
    [840, 250], [880, 230],
    [80, 660], [140, 680], [200, 670],
    [580, 660], [640, 670], [700, 660],
    [990, 600], [1100, 620], [1200, 640],
  ];
  for (const [tx, ty] of trees) {
    drawTree(tx, ty);
  }
}

function drawTree(x, y) {
  ctx.fillStyle = '#4a6a3a';
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a5a2a';
  ctx.beginPath();
  ctx.arc(x + 4, y - 4, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a3416';
  ctx.fillRect(x - 2, y + 8, 4, 8);
}

function drawMineEntrances() {
  for (let i = 0; i < OVERWORLD.mineEntrances.length; i++) {
    const rect = OVERWORLD.mineEntrances[i];
    const mine = state.mines[i];
    if (mine) {
      drawMineEntrance(rect, mine, i);
    } else {
      drawEmptyMineSlot(rect, i);
    }
  }
}

function drawEmptyMineSlot(e, idx) {
  // outline tracejado
  ctx.strokeStyle = 'rgba(122,75,37,0.55)';
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = 2;
  ctx.strokeRect(e.x, e.y, e.w, e.h);
  ctx.setLineDash([]);
  // ícone "+" central
  ctx.fillStyle = 'rgba(90,52,22,0.55)';
  ctx.font = 'bold 38px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+', e.x + e.w / 2, e.y + e.h / 2 - 10);
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.fillText('NOVA MINA', e.x + e.w / 2, e.y + e.h / 2 + 18);
  ctx.font = '9px "Segoe UI"';
  ctx.fillStyle = 'rgba(90,52,22,0.7)';
  ctx.fillText(`SLOT ${idx + 1}`, e.x + e.w / 2, e.y + 14);
  // hover destaca
  const hovering =
    state.mouseX >= e.x && state.mouseX < e.x + e.w &&
    state.mouseY >= e.y && state.mouseY < e.y + e.h;
  if (hovering) {
    ctx.strokeStyle = 'rgba(255,220,80,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(e.x - 3, e.y - 3, e.w + 6, e.h + 6);
  }
}

function drawMineEntrance(e, mine, idx) {
  // Colina marrom com base maior
  ctx.fillStyle = '#8a5a30';
  ctx.beginPath();
  ctx.moveTo(e.x - 10, e.y + e.h);
  ctx.bezierCurveTo(e.x, e.y + e.h * 0.2, e.x + e.w * 0.4, e.y - 10, e.x + e.w * 0.5, e.y);
  ctx.bezierCurveTo(e.x + e.w * 0.6, e.y - 10, e.x + e.w, e.y + e.h * 0.2, e.x + e.w + 10, e.y + e.h);
  ctx.closePath();
  ctx.fill();
  // Sombra na base
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(e.x - 10, e.y + e.h - 6, e.w + 20, 6);
  // Pedrinhas na colina (textura)
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  for (let i = 0; i < 12; i++) {
    const px = e.x + ((i * 23) % (e.w - 20)) + 10;
    const py = e.y + 40 + ((i * 31) % (e.h - 80));
    ctx.fillRect(px, py, 3, 2);
  }
  // Abertura da caverna (arco escuro)
  const caveX = e.x + e.w / 2;
  const caveY = e.y + e.h * 0.55;
  const caveW = e.w * 0.42;
  const caveH = e.h * 0.42;
  ctx.fillStyle = '#1a0e06';
  ctx.beginPath();
  ctx.moveTo(caveX - caveW / 2, caveY + caveH);
  ctx.lineTo(caveX - caveW / 2, caveY + caveH * 0.35);
  ctx.bezierCurveTo(caveX - caveW / 2, caveY, caveX + caveW / 2, caveY, caveX + caveW / 2, caveY + caveH * 0.35);
  ctx.lineTo(caveX + caveW / 2, caveY + caveH);
  ctx.closePath();
  ctx.fill();
  // Vigas de madeira em volta da caverna
  ctx.fillStyle = '#5a3416';
  ctx.fillRect(caveX - caveW / 2 - 5, caveY + caveH * 0.35, 5, caveH * 0.65);
  ctx.fillRect(caveX + caveW / 2, caveY + caveH * 0.35, 5, caveH * 0.65);
  ctx.fillRect(caveX - caveW / 2 - 5, caveY + caveH * 0.35 - 5, caveW + 10, 6);
  // Trilhos saindo da caverna
  ctx.strokeStyle = '#3a1f0a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(caveX - 10, caveY + caveH);
  ctx.lineTo(caveX - 22, e.y + e.h + 6);
  ctx.moveTo(caveX + 10, caveY + caveH);
  ctx.lineTo(caveX + 22, e.y + e.h + 6);
  ctx.stroke();
  // Mini carrinho parado na entrada (decorativo)
  ctx.fillStyle = '#5a3416';
  ctx.fillRect(caveX - 12, caveY + caveH + 6, 24, 12);
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(caveX - 7, caveY + caveH + 20, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(caveX + 7, caveY + caveH + 20, 3, 0, Math.PI * 2); ctx.fill();
  // Placa com nome da mina + status
  const signCx = caveX;
  const signCy = e.y + e.h + 24;
  const exhausted = mine && mine.exhausted;
  const isActive = idx === state.activeMineIdx && state.scene === 'mine';
  const mineName = (mine && mine.name) ? mine.name.toUpperCase() : `MINA ${idx + 1}`;
  const txt = exhausted ? `🚫 ${mineName} (ESGOTADA)` : `⛏ ${mineName}`;
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  const sw = ctx.measureText(txt).width + 22;
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(signCx - sw / 2 - 2, signCy - 14, sw + 4, 28);
  ctx.fillStyle = exhausted ? '#7a5a3a' : '#c69042';
  ctx.fillRect(signCx - sw / 2, signCy - 12, sw, 24);
  ctx.fillStyle = '#1a0e06';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(txt, signCx, signCy);
  // Pulsa quando o mouse está em cima (mais forte se for a ativa)
  const hovering =
    state.mouseX >= e.x && state.mouseX < e.x + e.w &&
    state.mouseY >= e.y && state.mouseY < e.y + e.h + 40;
  const t = performance.now() / 600;
  let pulse = (Math.sin(t) + 1) / 2 * (exhausted ? 0.2 : 0.6);
  if (hovering) pulse = 1;
  if (isActive) pulse = Math.max(pulse, 0.8);
  const color = exhausted ? '120,120,120' : (isActive ? '255,180,80' : '255,220,80');
  ctx.strokeStyle = `rgba(${color},${0.25 + 0.55 * pulse})`;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(signCx - sw / 2, signCy - 12, sw, 24);
  // Aplica leve dim na entrada inteira se esgotada
  if (exhausted) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(e.x - 14, e.y - 6, e.w + 28, e.h + 18);
  }
}

function drawDottedRoute(x1, y1, x2, y2) {
  ctx.strokeStyle = 'rgba(58,31,10,0.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawOverworld() {
  drawOverworldBg();
  // Vilarejos decorativos (entre as áreas principais)
  drawVillage(480, 270, 'LAGES',         0.7);
  drawVillage(680, 245, 'SÃO JOAQUIM',   0.6);
  drawVillage(560, 660, 'CHAPECÓ',       0.7);
  // Rotas pontilhadas decorativas para vilarejos
  drawDottedRoute(280, 280, 470, 260);
  drawDottedRoute(530, 270, 670, 250);
  drawDottedRoute(380, 460, 540, 640);
  // Rotas das minas até as fábricas (raw materials)
  for (const d of OVERWORLD.dottedMineToFactory) {
    drawDottedRoute(d.x1, d.y1, d.x2, d.y2);
  }
  drawMineEntrances();
  drawMercadoNode();
  drawPesquisaNode();
  drawFactories();
  drawFactoryRecipePanels();
  drawCity();
  drawRoad();
  drawWagon();
  drawActiveProjectPanel();
  drawContractPanelOverworld();
}

// Nodo do Mercado — clicável (abre aba Mercado)
function drawMercadoNode() {
  const n = OVERWORLD.mercadoNode;
  const { x, y, w, h } = n;
  // base / fundo de tijolo
  ctx.fillStyle = '#8a3a1a';
  ctx.fillRect(x, y + 8, w, h - 8);
  // padrão de tijolos
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  for (let yy = y + 14; yy < y + h - 4; yy += 6) {
    ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke();
  }
  // toldo listrado amarelo/vermelho
  ctx.fillStyle = '#e8c060';
  ctx.fillRect(x - 6, y + 4, w + 12, 12);
  ctx.fillStyle = '#a82e1c';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(x - 6 + i * (w + 12) / 5, y + 4, (w + 12) / 10, 12);
  }
  // mercadorias (caixas + barril)
  ctx.fillStyle = '#7a4b25';
  ctx.fillRect(x + 8, y + 26, 16, 18);
  ctx.fillRect(x + 28, y + 26, 16, 18);
  ctx.fillRect(x + 48, y + 26, 16, 18);
  // moeda dourada na fachada
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(x + w - 14, y + 32, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a0e06';
  ctx.lineWidth = 1;
  ctx.stroke();
  // placa "MERCADO"
  drawNodeLabel(x, y + h, w, 'MERCADO', 'overworld');
  drawNodeHoverHighlight(n);
}

// Nodo da Pesquisa — clicável (abre Upgrades)
function drawPesquisaNode() {
  const n = OVERWORLD.pesquisaNode;
  const { x, y, w, h } = n;
  // corpo branco (estilo colonial caiado)
  ctx.fillStyle = '#f1e3c2';
  ctx.fillRect(x, y, w, h);
  // base escura
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(x, y + h - 4, w, 4);
  // telhado triangular azul (acadêmico)
  ctx.fillStyle = '#2a4a7a';
  ctx.beginPath();
  ctx.moveTo(x - 6, y);
  ctx.lineTo(x + w / 2, y - 16);
  ctx.lineTo(x + w + 6, y);
  ctx.closePath();
  ctx.fill();
  // livro/pergaminho na fachada
  ctx.fillStyle = '#a82e1c';
  ctx.fillRect(x + w / 2 - 14, y + 20, 28, 22);
  ctx.fillStyle = '#f1e3c2';
  ctx.fillRect(x + w / 2 - 12, y + 22, 24, 18);
  ctx.strokeStyle = '#1a0e06';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + 22);
  ctx.lineTo(x + w / 2, y + 40);
  ctx.stroke();
  // estrelas (pontos de pesquisa)
  ctx.fillStyle = '#ffd44a';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★', x + 12, y + 14);
  ctx.fillText('★', x + w - 12, y + 14);
  // placa "PESQUISA"
  drawNodeLabel(x, y + h, w, 'PESQUISA', 'overworld');
  drawNodeHoverHighlight(n);
}

function drawNodeLabel(x, y, w, text, scene) {
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(x - 2, y + 2, w + 4, 16);
  ctx.fillStyle = '#c69042';
  ctx.fillRect(x, y + 4, w, 12);
  ctx.fillStyle = '#1a0e06';
  ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + 10);
  void scene;
}

function drawNodeHoverHighlight(n) {
  const hovering =
    state.mouseX >= n.x && state.mouseX < n.x + n.w &&
    state.mouseY >= n.y && state.mouseY < n.y + n.h + 22;
  const t = performance.now() / 700;
  const pulse = hovering ? 1 : (Math.sin(t) + 1) / 2 * 0.6;
  if (pulse > 0.1) {
    ctx.strokeStyle = `rgba(255,220,80,${0.25 + 0.55 * pulse})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(n.x - 4, n.y - 4, n.w + 8, n.h + 30);
  }
}

// ---------- Tutorial inicial (auto-avança baseado em ações) ----------
const TUTORIAL_STEPS = [
  { scene: 'overworld', msg: '👋 Clique na ENTRADA DA MINA à esquerda para começar a cavar.' },
  { scene: 'mine', msg: '⛏ Selecione a ferramenta MINERADOR (👤 ou tecla 4) e clique num veio descoberto (Fe ou C).' },
  { scene: 'mine', msg: '✅ Boa! Minério já flui para os silos. Volte ao mapa para acompanhar contratos e fábricas.' },
];

function drawTutorial() {
  if (!state.tutorial || state.tutorial.dismissed) return;
  const step = state.tutorial.step ?? 0;
  const t = TUTORIAL_STEPS[step];
  if (!t || t.scene !== state.scene) return;
  const w = 560;
  const h = 56;
  const tx = (W - w) / 2;
  const ty = state.scene === 'overworld' ? 200 : 90;
  drawScrollPanel(tx, ty, w, h);
  ctx.fillStyle = '#3a1f0a';
  ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t.msg, tx + w / 2, ty + h / 2 - 4);
  if (step === 2) {
    const left = Math.max(0, state.tutorial.autoDismissIn ?? 0);
    ctx.fillStyle = '#5a3416';
    ctx.font = '10px "Segoe UI"';
    ctx.fillText(`Fecha sozinho em ${Math.ceil(left)}s`, tx + w / 2, ty + h - 8);
  }
}

// Vilarejo decorativo (não interativo) — só pra dar densidade ao mapa
function drawVillage(x, baseY, name, scale = 0.7) {
  const houses = [
    { dx: -14, dy: 0, w: 18, h: 22, face: '#e8c87a', roof: '#a82e1c' },
    { dx: 6,   dy: -4, w: 14, h: 26, face: '#b8c8a8', roof: '#8a4a2a' },
  ];
  for (const b of houses) {
    const hx = x + b.dx * scale;
    const top = baseY - b.h * scale;
    const w = b.w * scale, h = b.h * scale;
    ctx.fillStyle = b.face;
    ctx.fillRect(hx, top, w, h);
    ctx.fillStyle = '#3a1f0a';
    ctx.fillRect(hx, baseY - 2, w, 2);
    // telhado
    ctx.fillStyle = b.roof;
    ctx.beginPath();
    ctx.moveTo(hx - 2, top);
    ctx.lineTo(hx + w / 2, top - 6 * scale);
    ctx.lineTo(hx + w + 2, top);
    ctx.closePath();
    ctx.fill();
    // janelinha
    ctx.fillStyle = '#a8c8d8';
    ctx.fillRect(hx + 2, top + 4 * scale, 3 * scale, 4 * scale);
  }
  // mini árvore ao lado
  drawTree(x + 22 * scale, baseY + 2);
  // placa com nome
  ctx.fillStyle = '#3a1f0a';
  ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const tw = ctx.measureText(name).width + 8;
  ctx.fillStyle = 'rgba(241,227,194,0.85)';
  ctx.fillRect(x - tw / 2, baseY + 6, tw, 13);
  ctx.fillStyle = '#3a1f0a';
  ctx.fillText(name, x, baseY + 8);
}

// ---------- Helpers: ícone de recurso + scroll/painel ----------
function drawResourceIcon(x, y, size, resourceId) {
  const res = R[resourceId];
  if (!res) return;
  ctx.fillStyle = res.color;
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = '#1a0e06';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, size, size);
  // texto da abreviação em cima, com sombra escura por contraste
  ctx.font = `bold ${Math.floor(size * 0.45)}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(20,10,5,0.85)';
  ctx.fillRect(x, y + size - Math.floor(size * 0.55), size, Math.floor(size * 0.55));
  ctx.fillStyle = '#ffd44a';
  ctx.fillText(resAbbrev(resourceId), x + size / 2, y + size - Math.floor(size * 0.28));
}

function drawScrollPanel(x, y, w, h) {
  // moldura escura
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  // papel envelhecido
  ctx.fillStyle = '#f1e3c2';
  ctx.fillRect(x, y, w, h);
  // textura de linhas horizontais sutis
  ctx.strokeStyle = 'rgba(122,75,37,0.12)';
  ctx.lineWidth = 1;
  for (let i = 10; i < h; i += 9) {
    ctx.beginPath();
    ctx.moveTo(x + 4, y + i);
    ctx.lineTo(x + w - 4, y + i);
    ctx.stroke();
  }
}

// ---------- Mini painel de receita acima de cada fábrica ----------
function drawFactoryRecipePanels() {
  for (let i = 0; i < state.factories.length; i++) {
    const f = state.factories[i];
    const rect = factoryRect(i);
    drawFactoryRecipePanel(rect, f);
  }
}

function drawFactoryRecipePanel(rect, factory) {
  const recipe = RECIPE_BY_ID[factory.recipeId];
  if (!recipe) return;
  const product = R[factory.recipeId];
  // posição: pouco acima do prédio
  const pw = rect.w;
  const ph = 44;
  const px = rect.x;
  const py = rect.y - ph - 8;
  drawScrollPanel(px, py, pw, ph);
  // input principal (primeiro ingrediente da receita)
  const inputs = Object.entries(recipe.in);
  const [inputId, need] = inputs[0];
  const have = ingredientHave(inputId);
  const haveStr = R[inputId].free ? '∞' : Math.floor(have);
  const inputOk = have >= need;
  // ícone do input + texto have/need
  const iconSize = 22;
  drawResourceIcon(px + 4, py + 4, iconSize, inputId);
  ctx.fillStyle = inputOk ? '#1a0e06' : '#a82e1c';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${haveStr}/${need}`, px + 4 + iconSize + 4, py + 4 + iconSize / 2);
  // se houver +1 ingredientes, marca discreto
  if (inputs.length > 1) {
    ctx.fillStyle = '#5a3416';
    ctx.font = '9px "Segoe UI"';
    ctx.fillText(`+${inputs.length - 1}`, px + 4 + iconSize + 4, py + iconSize + 10);
  }
  // seta no centro
  ctx.fillStyle = '#c69042';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('→', px + pw / 2, py + ph / 2);
  // output: ícone + estoque/cap
  const outHave = state.products[factory.recipeId] || 0;
  const outCap = CFG.factoryStockMax;
  drawResourceIcon(px + pw - 4 - iconSize, py + 4, iconSize, factory.recipeId);
  ctx.fillStyle = '#1a0e06';
  ctx.font = 'bold 11px "Segoe UI"';
  ctx.textAlign = 'right';
  ctx.fillText(`${outHave}/${outCap}`, px + pw - 4 - iconSize - 4, py + 4 + iconSize / 2);
  // barra fina de progresso da batelada em andamento
  if (factory.brewing > 0) {
    const pct = 1 - factory.brewing / recipe.time;
    ctx.fillStyle = '#5a3416';
    ctx.fillRect(px + 4, py + ph - 5, pw - 8, 3);
    ctx.fillStyle = '#c69042';
    ctx.fillRect(px + 4, py + ph - 5, (pw - 8) * pct, 3);
  }
  // hover destaca o painel inteiro
  const fullRect = { x: px, y: py, w: pw, h: ph + rect.h + 8 };
  const hovering =
    state.mouseX >= fullRect.x && state.mouseX < fullRect.x + fullRect.w &&
    state.mouseY >= fullRect.y && state.mouseY < fullRect.y + fullRect.h;
  if (hovering) {
    ctx.strokeStyle = 'rgba(255,220,80,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x - 3, py - 3, pw + 6, ph + rect.h + 14);
  }
  // suprime nome do produto: já fica na placa amarela do prédio
  product; // referenciada implicitamente via outHave/cap
}

// ---------- Banner do projeto ativo (overworld) ----------
function drawActiveProjectPanel() {
  if (!state.projects.active) return;
  const def = getProjectDef(state.projects.active.id);
  if (!def) return;
  const prog = state.projects.active.progress;
  const x = 20, y = 56;
  const w = 280;
  const reqs = Object.entries(def.requirements);
  const lineH = 18;
  const h = 34 + reqs.length * lineH + 8;
  drawScrollPanel(x, y, w, h);
  // título
  ctx.fillStyle = '#3a1f0a';
  ctx.font = 'bold 13px "Segoe UI"';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('🏗 Construindo:', x + 8, y + 6);
  ctx.fillStyle = '#5a3416';
  ctx.font = 'bold 14px "Segoe UI"';
  ctx.fillText(def.name.toUpperCase(), x + 8, y + 22);
  // barras de cada requisito
  let row = 0;
  for (const [res, need] of reqs) {
    const have = Math.min(prog[res] || 0, need);
    const pct = clamp(have / need, 0, 1);
    const ry = y + 44 + row * lineH;
    drawResourceIcon(x + 8, ry, 14, res);
    ctx.fillStyle = '#1a0e06';
    ctx.font = '11px "Segoe UI"';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(R[res].name, x + 28, ry + 7);
    // barra
    const barX = x + 140;
    const barW = w - 140 - 50;
    ctx.fillStyle = '#1a0e06';
    ctx.fillRect(barX, ry + 4, barW, 6);
    ctx.fillStyle = pct >= 1 ? '#4d7c3a' : '#c69042';
    ctx.fillRect(barX, ry + 4, barW * pct, 6);
    // X/Y
    ctx.fillStyle = '#3a1f0a';
    ctx.font = 'bold 10px "Segoe UI"';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.floor(have)}/${need}`, x + w - 8, ry + 7);
    row++;
  }
}

// ---------- Painel de contrato acima da cidade ----------
function drawContractPanelOverworld() {
  if (!state.contract) return;
  const k = state.contract;
  const product = R[k.product];
  const x = CITY.x + 10;
  const y = 56;
  const w = CITY.w - 20;
  const h = 100;
  drawScrollPanel(x, y, w, h);
  // título
  ctx.fillStyle = '#3a1f0a';
  ctx.font = 'bold 11px "Segoe UI"';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`📜 PEDIDO DE ${k.city.toUpperCase()}`, x + 8, y + 6);
  // ícone do produto + nome + quantidade
  drawResourceIcon(x + 8, y + 28, 28, k.product);
  ctx.fillStyle = '#1a0e06';
  ctx.font = 'bold 14px "Segoe UI"';
  ctx.textBaseline = 'top';
  ctx.fillText(product.name, x + 42, y + 28);
  ctx.fillStyle = '#5a3416';
  ctx.font = 'bold 16px "Segoe UI"';
  ctx.fillText(`${k.delivered} / ${k.need}`, x + 42, y + 46);
  // progresso entrega
  const pct = clamp(k.delivered / k.need, 0, 1);
  ctx.fillStyle = '#1a0e06';
  ctx.fillRect(x + 8, y + 72, w - 16, 5);
  ctx.fillStyle = '#4d7c3a';
  ctx.fillRect(x + 8, y + 72, (w - 16) * pct, 5);
  // tempo restante
  const tLeft = Math.max(0, k.deadline - k.elapsed);
  const tPct = clamp(1 - k.elapsed / k.deadline, 0, 1);
  ctx.fillStyle = '#1a0e06';
  ctx.fillRect(x + 8, y + 82, w - 16, 5);
  ctx.fillStyle = tLeft < 20 ? '#a82e1c' : '#c69042';
  ctx.fillRect(x + 8, y + 82, (w - 16) * tPct, 5);
  // texto do tempo
  ctx.fillStyle = tLeft < 20 ? '#a82e1c' : '#5a3416';
  ctx.font = 'bold 11px "Segoe UI"';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(`⏱ ${tLeft.toFixed(0)}s`, x + w - 8, y + 6);
}

// ---------- Cena MINA: grid + silos + tools + botão voltar ----------
function drawBackBtn() {
  const b = MINE_BACK_BTN;
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
  // hover effect
  const hovering =
    state.mouseX >= b.x && state.mouseX < b.x + b.w &&
    state.mouseY >= b.y && state.mouseY < b.y + b.h;
  ctx.fillStyle = hovering ? '#d8a056' : '#c69042';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = '#1a0e06';
  ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('← Voltar ao Mapa', b.x + b.w / 2, b.y + b.h / 2);
}

function drawMineScene() {
  drawMineSky();
  drawSilos();
  drawMineGrid();
  drawElevator();
  drawToolbar();
  drawBackBtn();
  drawMineSwitcher();
  drawExhaustedOverlay();
}

// Cabine + cabo do elevador na coluna 0 do grid
function drawElevator() {
  const mine = activeMine();
  if (!mine) return;
  const col = 0;
  const x = MINE.x + col * MINE.cell;
  const yTop = MINE.y;
  const totalH = MINE.rows * MINE.cell;
  // estrutura de superfície (cabeça do elevador, acima do grid)
  const headW = MINE.cell + 12;
  const headH = 36;
  ctx.fillStyle = '#5a3416';
  ctx.fillRect(x - 6, yTop - headH, headW, headH);
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(x - 6, yTop - headH, headW, 4);
  // roldana no topo
  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.arc(x + MINE.cell / 2, yTop - headH + 14, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a3a3a';
  ctx.beginPath();
  ctx.arc(x + MINE.cell / 2, yTop - headH + 14, 2, 0, Math.PI * 2);
  ctx.fill();
  // posição do car
  const carY = yTop + mine.elevator.y * (totalH - MINE.cell);
  // cabo
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + MINE.cell / 2, yTop - headH + 14);
  ctx.lineTo(x + MINE.cell / 2, carY + 2);
  ctx.stroke();
  // car
  ctx.fillStyle = '#7a4b25';
  ctx.fillRect(x + 4, carY + 4, MINE.cell - 8, MINE.cell - 12);
  ctx.fillStyle = '#5a3416';
  ctx.fillRect(x + 4, carY + 6, MINE.cell - 8, 3);
  // rodas
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(x + 10, carY + MINE.cell - 10, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + MINE.cell - 10, carY + MINE.cell - 10, 3, 0, Math.PI * 2); ctx.fill();
  // mini carga visível (variando)
  const t = performance.now() / 1000;
  if (Math.sin(t * 0.7) > 0) {
    ctx.fillStyle = '#1f1c1a';
    ctx.fillRect(x + 8, carY + 8, MINE.cell - 16, 6);
  }
}

// Botões pra alternar entre as minas (canto superior direito, acima da toolbar)
function drawMineSwitcher() {
  if (!state.mines || state.mines.length < 2) return;
  const btnW = 110;
  const btnH = 28;
  const startY = 56;
  for (let i = 0; i < state.mines.length; i++) {
    const m = state.mines[i];
    const x = W - btnW - 14;
    const y = startY + i * (btnH + 6);
    const isActive = i === state.activeMineIdx;
    const exhausted = m.exhausted;
    // moldura
    ctx.fillStyle = '#3a1f0a';
    ctx.fillRect(x - 2, y - 2, btnW + 4, btnH + 4);
    ctx.fillStyle = isActive ? '#c69042' : (exhausted ? '#5a4a3a' : '#a88b56');
    ctx.fillRect(x, y, btnW, btnH);
    ctx.fillStyle = '#1a0e06';
    ctx.font = `bold 11px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      exhausted ? `🚫 ${m.name}` : (isActive ? `● ${m.name}` : m.name),
      x + btnW / 2,
      y + btnH / 2,
    );
  }
}

function drawExhaustedOverlay() {
  const mine = activeMine();
  if (!mine || !mine.exhausted) return;
  // banner principal
  const w = 460, h = 60;
  const x = (W - w) / 2;
  const y = MINE.y + (MINE.rows * MINE.cell) / 2 - 50;
  ctx.fillStyle = 'rgba(20,10,5,0.88)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#a82e1c';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = '#ffd44a';
  ctx.font = 'bold 18px "Segoe UI"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`🚫 ${mine.name} ESGOTADA`, W / 2, y + 22);
  ctx.fillStyle = '#f1e3c2';
  ctx.font = '11px "Segoe UI"';
  ctx.fillText('Pague para regenerar todos os veios, ou volte ao mapa.', W / 2, y + 44);
  // Botão "Regenerar"
  const cost = regenCost(mine.id);
  const bw = 240, bh = 38;
  const bx = (W - bw) / 2;
  const by = y + h + 12;
  const canAfford = state.money >= cost;
  const hovering =
    state.mouseX >= bx && state.mouseX < bx + bw &&
    state.mouseY >= by && state.mouseY < by + bh;
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
  ctx.fillStyle = canAfford ? (hovering ? '#d8a056' : '#c69042') : '#7a5a3a';
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = '#1a0e06';
  ctx.font = 'bold 14px "Segoe UI"';
  ctx.textBaseline = 'middle';
  ctx.fillText(`✨ Regenerar — ${fmtMoney(cost)}`, bx + bw / 2, by + bh / 2);
}

// ---------- Entry ----------
export function draw() {
  if (state.scene === 'mine') {
    drawMineScene();
    drawTileTooltip();
  } else {
    drawOverworld();
  }
  drawEventBanner();
  drawTutorial();
}
