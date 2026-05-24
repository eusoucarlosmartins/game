// draw.js — renderização do canvas (mina em grid + superfície compacta)
import { state } from './state.js';
import { R, RECIPE_BY_ID, CFG, MINE, TOOLS, SILO_DEFAULT_CAP } from './data.js';
import { fmtMoney, clamp } from './util.js';
import { transportTier, wagonCapacity, currentEra, eraData } from './progression.js';
import { ingredientHave } from './factories.js';
import { getProjectDef } from './projects.js';
import { activeMine, regenCost } from './mine.js';
import {
  W, H, WORLD_W, WORLD_H, GROUND_Y, MINE_GROUND_Y, CITY, ROAD,
  OVERWORLD, TOOLBAR, MINE_BACK_BTN, MINIMAP, factoryRect, unlockedWorldSize,
} from './geometry.js';
import { drawParticles } from './particles.js';
import { topPopup } from './achievements.js';
import { drawAmbience } from './ambience.js';
import { mineNeedsAttention, cityCanDeliver, marketNeedsAttention, researchNeedsAttention } from './ui.js';
import { getDailyStatus } from './daily.js';

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
    drawSingleFactory(i, state.factories[i]);
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

// Fábrica estilo industrial 1900: tijolo vermelho, telhado de 2 águas,
// janelas em grade com vidro azulado, chaminé grossa com tijolos, porta
// grande de carga, faixa decorativa com o produto.
function drawSingleFactory(idx, f) {
  const rect = factoryRect(idx);
  const x = rect.x, y = rect.y, w = rect.w, h = rect.h;
  const product = R[f.recipeId];
  const productColor = product?.color || '#c69042';
  const recipe = RECIPE_BY_ID[f.recipeId];

  // Sombra no chão
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x - 4, y + h - 2, w + 8, 4);

  // === Telhado de duas águas (acima do prédio) ===
  const roofH = 22;
  ctx.fillStyle = '#5a2a1a'; // telhado escuro
  ctx.beginPath();
  ctx.moveTo(x - 6, y);
  ctx.lineTo(x + w / 2, y - roofH);
  ctx.lineTo(x + w + 6, y);
  ctx.closePath();
  ctx.fill();
  // Telhas (linhas horizontais sobre o telhado)
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    const ry = y - (roofH / 5) * i;
    const inset = (roofH / 5) * i * (w / 2 + 6) / roofH;
    ctx.beginPath();
    ctx.moveTo(x - 6 + inset, ry);
    ctx.lineTo(x + w + 6 - inset, ry);
    ctx.stroke();
  }

  // === Parede de tijolos ===
  ctx.fillStyle = '#8a3a1a';
  ctx.fillRect(x, y, w, h);
  // Textura de tijolos (linhas horizontais + verticais escalonadas)
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let row = 0; row < Math.floor(h / 7); row++) {
    const ry = y + row * 7;
    ctx.fillRect(x, ry, w, 1);
    const offset = row % 2 === 0 ? 0 : 14;
    for (let bx = offset; bx < w; bx += 28) {
      ctx.fillRect(x + bx, ry, 1, 7);
    }
  }
  // Faixa lateral (vigas estruturais nas pontas)
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(x, y, 4, h);
  ctx.fillRect(x + w - 4, y, 4, h);
  // Faixa decorativa no topo (cornija)
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(x - 2, y, w + 4, 6);
  ctx.fillStyle = '#c69042';
  ctx.fillRect(x - 2, y + 6, w + 4, 2);

  // === Janelas industriais ===
  // 2 fileiras de janelas em grade
  const winW = 12, winH = 16, winGap = 8;
  const winRowY = [y + 18, y + 42];
  const winsPerRow = Math.max(2, Math.floor((w - 24) / (winW + winGap)));
  const winStartX = x + (w - (winsPerRow * winW + (winsPerRow - 1) * winGap)) / 2;
  for (let row = 0; row < winRowY.length; row++) {
    if (winRowY[row] + winH > y + h - 32) break; // não desenha sob a porta
    for (let j = 0; j < winsPerRow; j++) {
      const wx = winStartX + j * (winW + winGap);
      const wy = winRowY[row];
      // moldura escura
      ctx.fillStyle = '#1a0e06';
      ctx.fillRect(wx - 1, wy - 1, winW + 2, winH + 2);
      // vidro com tom levemente brilhante quando ativa
      const glowing = f.brewing > 0;
      ctx.fillStyle = glowing ? '#ffe8a4' : '#a8c8d8';
      ctx.fillRect(wx, wy, winW, winH);
      // cruz da janela (estrutura de vidro)
      ctx.strokeStyle = '#1a0e06';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(wx + winW / 2, wy); ctx.lineTo(wx + winW / 2, wy + winH);
      ctx.moveTo(wx, wy + winH / 2); ctx.lineTo(wx + winW, wy + winH / 2);
      ctx.stroke();
    }
  }

  // === Porta de carga (centro inferior) ===
  const doorW = 26, doorH = 30;
  const doorX = x + w / 2 - doorW / 2;
  const doorY = y + h - doorH - 22;
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(doorX - 2, doorY - 2, doorW + 4, doorH + 4);
  ctx.fillStyle = '#5a3416';
  ctx.fillRect(doorX, doorY, doorW, doorH);
  // tábuas verticais
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(doorX + (doorW / 4) * i, doorY);
    ctx.lineTo(doorX + (doorW / 4) * i, doorY + doorH);
    ctx.stroke();
  }
  // ferragens (cantos)
  ctx.fillStyle = '#444';
  ctx.fillRect(doorX + 2, doorY + 2, 3, 3);
  ctx.fillRect(doorX + doorW - 5, doorY + 2, 3, 3);
  ctx.fillRect(doorX + 2, doorY + doorH - 5, 3, 3);
  ctx.fillRect(doorX + doorW - 5, doorY + doorH - 5, 3, 3);

  // === Chaminé grossa de tijolos ===
  const chimX = x + w - 28;
  const chimW = 14;
  const chimH = 52;
  const chimTop = y - chimH - 4;
  // base alargada
  ctx.fillStyle = '#5a2a1a';
  ctx.fillRect(chimX - 2, chimTop + chimH - 8, chimW + 4, 8);
  // corpo de tijolo
  ctx.fillStyle = '#8a3a1a';
  ctx.fillRect(chimX, chimTop, chimW, chimH);
  // textura de tijolo
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let i = 0; i < Math.floor(chimH / 5); i++) {
    ctx.fillRect(chimX, chimTop + i * 5, chimW, 1);
  }
  for (let i = 0; i < Math.floor(chimH / 5); i++) {
    if (i % 2 === 0) ctx.fillRect(chimX + chimW / 2, chimTop + i * 5, 1, 5);
    else ctx.fillRect(chimX, chimTop + i * 5, 1, 5);
  }
  // bordo escuro no topo da chaminé
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(chimX - 2, chimTop, chimW + 4, 4);

  // Fumaça animada quando brewing
  if (f.brewing > 0) {
    const t = performance.now() / 350;
    for (let k = 0; k < 4; k++) {
      const yOff = (t * 14 + k * 12) % 50;
      const drift = Math.sin((t + k) * 2) * 4;
      ctx.fillStyle = `rgba(90,75,55,${0.55 - k * 0.12})`;
      ctx.beginPath();
      ctx.arc(chimX + chimW / 2 + drift, chimTop - 4 - yOff, 5 + k * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // === Faixa de identificação (rótulo da empresa) ===
  // Cor da empresa = cor do produto (visual identity)
  const labelY = y + h - 18;
  ctx.fillStyle = '#1a0e06';
  ctx.fillRect(x + 4, labelY - 1, w - 8, 14);
  ctx.fillStyle = productColor;
  ctx.fillRect(x + 6, labelY + 1, w - 12, 10);
  // nome do produto centralizado
  const recipeName = product?.name || '—';
  ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#1a0e06';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    recipeName.length > 16 ? recipeName.slice(0, 15) + '…' : recipeName,
    x + w / 2, labelY + 6,
  );

  // === Barra de progresso da batelada (em cima) ===
  if (recipe && f.brewing > 0) {
    const pct = 1 - f.brewing / recipe.time;
    ctx.fillStyle = '#1a0e06';
    ctx.fillRect(x + 4, y - 6, w - 8, 5);
    // Barra com cor do produto
    ctx.fillStyle = productColor;
    ctx.fillRect(x + 5, y - 5, (w - 10) * pct, 3);
    // borda dourada quando perto de completar
    if (pct > 0.85) {
      ctx.strokeStyle = '#ffd44a';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 4, y - 6, w - 8, 5);
    }
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

  // Casas extras de crescimento (1 a cada ~3 contratos cumpridos)
  drawCityGrowthBuildings(cx0, w);

  drawCitySign(cx0 + w / 2, CITY.y);
  drawCityDeliverableBadge();
}

// Badge flutuante "✓ X entregar!" sobre a cidade quando há produto suficiente
// pra atender o contrato. Pulsa em verde pra chamar atenção.
function drawCityDeliverableBadge() {
  // Agrega TODOS contratos ativos: total pronto pra entregar agora
  const ks = state.contracts || [];
  if (ks.length === 0) return;
  let totalReady = 0;
  let totalNeed = 0;
  for (const k of ks) {
    const have = state.products[k.product] || 0;
    const need = k.need - k.delivered;
    totalReady += Math.min(have, need);
    totalNeed += need;
  }
  if (totalReady <= 0) return;
  const enough = totalReady >= totalNeed;
  const cx = CITY.x + CITY.w / 2;
  const cy = CITY.y + CITY.h + 6;
  const t = performance.now() / 600;
  const pulse = 0.7 + 0.3 * (Math.sin(t * 1.5) + 1) / 2;
  const color = enough ? '77,160,77' : '218,165,32';
  const icon = enough ? '✓' : '↑';
  const label = enough ? `${icon} Entregar ${totalNeed}!` : `${icon} ${totalReady} pronto`;
  ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
  const w = ctx.measureText(label).width + 18;
  // moldura escura
  ctx.fillStyle = '#1a0e06';
  ctx.fillRect(cx - w / 2 - 2, cy - 13, w + 4, 26);
  // fundo pulsante
  ctx.fillStyle = `rgba(${color},${0.8 + 0.2 * pulse})`;
  ctx.fillRect(cx - w / 2, cy - 11, w, 22);
  // texto
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy);
}

// Adiciona prédios pequenos extras flanqueando a cidade conforme cityGrowth sobe.
// Visual: cada nível extra acrescenta 1 casa simples nas laterais.
function drawCityGrowthBuildings(cx0, w) {
  const growth = state.cityGrowth || 0;
  const extras = Math.min(8, Math.floor(growth / 3)); // até 8 casas extras
  for (let i = 0; i < extras; i++) {
    const side = i % 2 === 0 ? -1 : 1; // alterna esquerda/direita
    const idx = Math.floor(i / 2);
    const offset = 16 + idx * 26; // cada par afasta mais da cidade
    const baseX = side < 0 ? cx0 - offset - 18 : cx0 + w + offset;
    const heights = [44, 58, 38, 52, 46];
    const widths = [22, 18, 24, 20, 22];
    const faces  = ['#d8b070', '#c9a460', '#b89058', '#e8c87a', '#a88a4a'];
    const roofs  = ['#a82e1c', '#7a4b25', '#5a3416', '#8a4a2a', '#a8442a'];
    const k = idx % heights.length;
    const top = GROUND_Y - heights[k];
    const ww = widths[k];
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(baseX, GROUND_Y, ww + 2, 3);
    // parede
    ctx.fillStyle = faces[k];
    ctx.fillRect(baseX, top, ww, heights[k]);
    // rodapé escuro
    ctx.fillStyle = '#3a1f0a';
    ctx.fillRect(baseX, GROUND_Y - 3, ww, 3);
    // telhado triangular
    ctx.fillStyle = roofs[k];
    ctx.beginPath();
    ctx.moveTo(baseX - 3, top);
    ctx.lineTo(baseX + ww / 2, top - 9);
    ctx.lineTo(baseX + ww + 3, top);
    ctx.closePath();
    ctx.fill();
    // janela
    ctx.fillStyle = '#a8c8d8';
    ctx.fillRect(baseX + 3, top + 8, 5, 6);
    // porta
    ctx.fillStyle = '#3a1f0a';
    ctx.fillRect(baseX + ww / 2 - 2, GROUND_Y - 11, 4, 8);
  }
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
  // selo de população crescente (baseado em cityGrowth)
  const growth = state.cityGrowth || 0;
  if (growth > 0) {
    const popY = topY + labelH + 4;
    ctx.font = 'bold 10px "Segoe UI", Arial';
    const popTxt = `pop. ${100 + growth * 30}`;
    const pw = ctx.measureText(popTxt).width + 10;
    ctx.fillStyle = 'rgba(20,10,5,0.7)';
    ctx.fillRect(centerX - pw / 2, popY, pw, 12);
    ctx.fillStyle = '#ffd44a';
    ctx.textBaseline = 'middle';
    ctx.fillText(popTxt, centerX, popY + 6);
  }
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
// Rotas de cada fábrica até a cidade. Visual evolui pelo transportTier:
// tier 1 (trilha pontilhada) → tier 2 (cascalho) → tier 3+ (pedra) →
// tier 6+ (ferrovia com dormentes).
function drawRoad() {
  const tier = transportTier();
  for (let i = 0; i < state.factories.length; i++) {
    const fr = factoryRect(i);
    const sx = fr.x + fr.w;
    const sy = fr.y + fr.h / 2;
    const dx = CITY.x;
    const dy = CITY.y + CITY.h / 2;
    drawTieredRoute(sx, sy, dx, dy, tier);
  }
}

function drawTieredRoute(x1, y1, x2, y2, tier) {
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  if (tier >= 6) {
    // Ferrovia: trilhos pretos paralelos + dormentes marrons
    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(ang);
    // base de pedras / lastro
    ctx.fillStyle = '#6a6058';
    ctx.fillRect(0, -7, dist, 14);
    // dormentes
    ctx.fillStyle = '#5a3416';
    for (let s = 4; s < dist - 4; s += 12) {
      ctx.fillRect(s, -7, 6, 14);
    }
    // trilhos
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, -4, dist, 1.5);
    ctx.fillRect(0, 3, dist, 1.5);
    ctx.restore();
  } else if (tier >= 3) {
    // Calçada de pedra: faixa cinza compacta + cantos arredondados
    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(ang);
    ctx.fillStyle = '#7d7670';
    ctx.fillRect(0, -5, dist, 10);
    // detalhe de pedras (linhas claras)
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    for (let s = 6; s < dist - 6; s += 16) {
      ctx.fillRect(s, -4, 8, 1);
      ctx.fillRect(s + 4, 3, 6, 1);
    }
    ctx.restore();
  } else if (tier >= 2) {
    // Estrada de cascalho: faixa marrom-claro
    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(ang);
    ctx.fillStyle = '#a07a4a';
    ctx.fillRect(0, -4, dist, 8);
    // pedrinhas
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let s = 5; s < dist; s += 11) {
      ctx.fillRect(s, -2, 2, 1.5);
    }
    ctx.restore();
  } else {
    // Trilha: linha pontilhada (mesma de antes)
    drawDottedRoute(x1, y1, x2, y2);
  }
}

// Desenha uma carruagem por fábrica, cada uma na sua rota até a cidade
function drawWagon() {
  for (let i = 0; i < state.factories.length; i++) {
    drawOneWagon(i);
  }
}

function drawOneWagon(idx) {
  const factory = state.factories[idx];
  const w = factory?.wagon;
  if (!w) return;
  const fr = factoryRect(idx);
  const sx = fr.x + fr.w;
  const sy = fr.y + fr.h / 2;
  const dx = CITY.x;
  const dy = CITY.y + CITY.h / 2;
  const wx = sx + (dx - sx) * w.pos;
  const wy = sy + (dy - sy) * w.pos - 6;
  const ang = Math.atan2(dy - sy, dx - sx);
  const tier = transportTier();
  // Estilo do veículo varia por tier
  if (tier >= 6) drawTrainCar(wx, wy, ang, w);
  else if (tier >= 3) drawCoveredWagon(wx, wy, ang, w);
  else if (tier >= 2) drawHorseCart(wx, wy, ang, w);
  else drawMuleCart(wx, wy, ang, w);
}

// Tier 1: mula puxando carroça simples (visual original)
function drawMuleCart(wx, wy, ang, w) {
  ctx.fillStyle = '#7a4b25';
  ctx.fillRect(wx - 12, wy, 24, 10);
  ctx.fillStyle = '#5a3416';
  ctx.fillRect(wx - 12, wy + 8, 24, 3);
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(wx - 8, wy + 12, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(wx + 8, wy + 12, 3, 0, Math.PI * 2); ctx.fill();
  drawCargo(wx, wy, w, 20);
  if (w.state === 'hauling') {
    // Mula cinza na frente
    const hx = wx + Math.cos(ang) * 14 * w.dir;
    const hy = wy + 4 + Math.sin(ang) * 14 * w.dir;
    ctx.fillStyle = '#888';
    ctx.fillRect(hx - 3, hy - 2, 6, 5);
  }
}

// Tier 2: carroça com cavalo
function drawHorseCart(wx, wy, ang, w) {
  ctx.fillStyle = '#8a5a2a';
  ctx.fillRect(wx - 14, wy - 2, 28, 12);
  ctx.fillStyle = '#5a3416';
  ctx.fillRect(wx - 14, wy + 8, 28, 3);
  ctx.fillStyle = '#1a0e06';
  ctx.beginPath(); ctx.arc(wx - 10, wy + 12, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(wx + 10, wy + 12, 3.5, 0, Math.PI * 2); ctx.fill();
  drawCargo(wx, wy + 1, w, 24);
  if (w.state === 'hauling') {
    const hx = wx + Math.cos(ang) * 16 * w.dir;
    const hy = wy + 4 + Math.sin(ang) * 16 * w.dir;
    // Cavalo marrom
    ctx.fillStyle = '#5a3416';
    ctx.fillRect(hx - 4, hy - 3, 8, 7);
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(hx + 2 * w.dir, hy - 4, 3, 4); // cabeça
  }
}

// Tier 3-5: carroça coberta (estilo conestoga)
function drawCoveredWagon(wx, wy, ang, w) {
  // base
  ctx.fillStyle = '#8a5a2a';
  ctx.fillRect(wx - 16, wy + 2, 32, 10);
  ctx.fillStyle = '#5a3416';
  ctx.fillRect(wx - 16, wy + 10, 32, 3);
  // toldo branco arqueado
  ctx.fillStyle = '#e8d4a4';
  ctx.beginPath();
  ctx.moveTo(wx - 16, wy + 2);
  ctx.quadraticCurveTo(wx, wy - 10, wx + 16, wy + 2);
  ctx.lineTo(wx + 16, wy + 4);
  ctx.lineTo(wx - 16, wy + 4);
  ctx.closePath();
  ctx.fill();
  // listras do toldo
  ctx.strokeStyle = 'rgba(122,75,37,0.3)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(wx - 16 + i * 10, wy + 2);
    ctx.quadraticCurveTo(wx - 11 + i * 10, wy - 7, wx - 6 + i * 10, wy + 2);
    ctx.stroke();
  }
  // rodas grandes
  ctx.fillStyle = '#1a0e06';
  ctx.beginPath(); ctx.arc(wx - 11, wy + 14, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(wx + 11, wy + 14, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#666'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(wx - 11, wy + 14, 4, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(wx + 11, wy + 14, 4, 0, Math.PI * 2); ctx.stroke();
  if (w.state === 'hauling') {
    const hx = wx + Math.cos(ang) * 18 * w.dir;
    const hy = wy + 6 + Math.sin(ang) * 18 * w.dir;
    ctx.fillStyle = '#5a3416';
    ctx.fillRect(hx - 4, hy - 4, 8, 8);
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(hx + 3 * w.dir, hy - 5, 3, 4);
  }
}

// Tier 6+: locomotiva pequena com vagão
function drawTrainCar(wx, wy, ang, w) {
  // vagão atrás (cargo)
  const vx = wx - Math.cos(ang) * 18 * w.dir;
  const vy = wy - Math.sin(ang) * 18 * w.dir;
  ctx.fillStyle = '#5a3416';
  ctx.fillRect(vx - 8, vy + 2, 16, 10);
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(vx - 8, vy + 10, 16, 3);
  ctx.fillStyle = '#1a0e06';
  ctx.beginPath(); ctx.arc(vx - 5, vy + 14, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(vx + 5, vy + 14, 3, 0, Math.PI * 2); ctx.fill();
  // locomotiva
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(wx - 12, wy, 24, 12);
  ctx.fillStyle = '#1a0e06';
  ctx.fillRect(wx - 12, wy + 10, 24, 3);
  // cabine (atrás)
  ctx.fillStyle = '#5a4030';
  ctx.fillRect(wx - 10 * w.dir, wy - 8, 8 * w.dir, 10);
  // janela
  ctx.fillStyle = '#a8c8d8';
  ctx.fillRect(wx - 8 * w.dir, wy - 6, 4 * w.dir, 5);
  // caldeira (frente)
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(wx + 6 * w.dir, wy + 6, 6, 0, Math.PI * 2);
  ctx.fill();
  // chaminé com fumaça
  ctx.fillStyle = '#1a0e06';
  ctx.fillRect(wx + 4 * w.dir, wy - 5, 3, 6);
  if (w.state === 'hauling') {
    const t = performance.now() / 200;
    for (let i = 0; i < 3; i++) {
      const yOff = (t * 18 + i * 6) % 28;
      ctx.fillStyle = `rgba(180,180,180,${0.5 - i * 0.15})`;
      ctx.beginPath();
      ctx.arc(wx + 5 * w.dir, wy - 8 - yOff, 3 + i, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // rodas locomotiva
  ctx.fillStyle = '#1a0e06';
  ctx.beginPath(); ctx.arc(wx - 7, wy + 14, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(wx + 0, wy + 14, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(wx + 7, wy + 14, 3.5, 0, Math.PI * 2); ctx.fill();
  drawCargo(vx, vy + 1, w, 14);
}

// Carga (cor do produto) no compartimento
function drawCargo(wx, wy, w, width) {
  if (w.load > 0 && w.product && R[w.product]) {
    ctx.fillStyle = R[w.product].color;
    const barW = clamp(w.load / wagonCapacity(), 0, 1) * width;
    ctx.fillRect(wx - width / 2, wy + 2, barW, 5);
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
  // Otimização: só renderiza fileiras visíveis (considerando mineCamera.y)
  // O clipping já recorta visualmente, mas evitar laços inúteis é + rápido.
  const visTop = state.mineCamera.y;
  const visBot = state.mineCamera.y + (H - MINE.y);
  const rStart = Math.max(0, Math.floor((visTop - 0) / cell) - 1);
  const rEnd = Math.min(rows, Math.ceil(visBot / cell) + 1);
  for (let r = rStart; r < rEnd; r++) {
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
  // grade sutil — só nas fileiras visíveis
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  for (let r = rStart; r <= rEnd; r++) {
    ctx.beginPath();
    ctx.moveTo(gx, gy + r * cell);
    ctx.lineTo(gx + cols * cell, gy + r * cell);
    ctx.stroke();
  }
  const gTop = gy + rStart * cell;
  const gBot = gy + rEnd * cell;
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath();
    ctx.moveTo(gx + c * cell, gTop);
    ctx.lineTo(gx + c * cell, gBot);
    ctx.stroke();
  }
  // Highlight de tiles cavaeis (quando picareta selecionada): contorno
  // amarelo pulsante mostra onde o player pode escavar a seguir.
  if (state.tool === 'pick') {
    drawDiggableHighlights(mine, rStart, rEnd);
  }
}

function drawDiggableHighlights(mine, rStart, rEnd) {
  const { cols, rows, cell, x: gx, y: gy } = MINE;
  const reached = mine._connectivity;
  if (!reached) return;
  const t = performance.now() / 400;
  const pulse = 0.4 + 0.3 * (Math.sin(t) + 1) / 2;
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(255,212,74,${pulse})`;
  for (let r = rStart; r < rEnd; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = mine.grid[r][c];
      if (!tile || !tile.revealed) continue;
      if (tile.type !== 'dirt' && tile.type !== 'stone' && tile.type !== 'ore') continue;
      // Diggable = vizinho conectado ao elevador
      let connectedNeighbor = false;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (reached[nr][nc]) { connectedNeighbor = true; break; }
      }
      if (!connectedNeighbor) continue;
      ctx.strokeRect(gx + c * cell + 1, gy + r * cell + 1, cell - 2, cell - 2);
    }
  }
}

function drawTile(px, py, cell, t) {
  if (!t) return;
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
  if (t.type === 'water') {
    // Água: fundo escuro + azul ondulado animado
    ctx.fillStyle = '#0a1820';
    ctx.fillRect(px, py, cell, cell);
    const phase = performance.now() / 600;
    ctx.fillStyle = 'rgba(80,140,200,0.85)';
    ctx.beginPath();
    ctx.moveTo(px, py + cell);
    for (let i = 0; i <= cell; i += 4) {
      const wy = py + 8 + Math.sin((i + phase * 50) * 0.2) * 3;
      ctx.lineTo(px + i, wy);
    }
    ctx.lineTo(px + cell, py + cell);
    ctx.closePath();
    ctx.fill();
    // Reflexos brancos
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 3; i++) {
      const lx = px + 5 + ((i * 11 + phase * 8) % (cell - 10));
      ctx.fillRect(lx, py + 14, 4, 1);
    }
    // Símbolo de aviso
    ctx.fillStyle = '#ffd44a';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('💧', px + cell / 2, py + 1);
    return;
  }
  if (t.type === 'gas') {
    // Gás: fundo escuro + bolhas amarelo-esverdeadas animadas
    ctx.fillStyle = '#1a0e06';
    ctx.fillRect(px, py, cell, cell);
    const phase = performance.now() / 400;
    for (let i = 0; i < 6; i++) {
      const bx = px + 4 + ((i * 7 + phase * 4) % (cell - 8));
      const by = py + 6 + ((i * 5 + phase * 6) % (cell - 12));
      const r = 4 + (i % 2) * 2;
      ctx.fillStyle = `rgba(200,220,80,${0.3 + 0.15 * Math.sin(phase + i)})`;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Símbolo de aviso
    ctx.fillStyle = '#ff8030';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('☠', px + cell / 2, py + 1);
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
    emerald:'ESM', mercury:'HG', platinum_ore:'PLT',
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
  else if (t.type === 'water') { title = 'Vazamento de Água'; sub = 'Bombear: $20'; color = '#5a9fc8'; }
  else if (t.type === 'gas') { title = 'Bolsão de Gás Tóxico'; sub = 'Ventilar: $40 · workers próximos saem'; color = '#d0e030'; }
  else if (t.type === 'ore') {
    const era = eraData(currentEra());
    const locked = !era.deposits.includes(t.resource);
    title = R[t.resource].name;
    sub = `Quantidade: ${Math.ceil(t.amount)} · ${t.worker ? 'minerador ativo' : 'sem trabalhador'}`;
    if (locked) { sub += ' · 🔒 era bloqueia'; color = '#ffb060'; }
    else color = R[t.resource].color;
  }
  // posiciona o tooltip em coords de TELA (subtrai mineCamera do Y world)
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  const titleW = ctx.measureText(title).width;
  ctx.font = '11px "Segoe UI", Arial, sans-serif';
  const subW = ctx.measureText(sub).width;
  const ttW = Math.max(titleW, subW) + 16;
  const ttH = 38;
  const screenY = state.mouseY - state.mineCamera.y;
  let tx = state.mouseX + 14;
  let ty = screenY + 14;
  if (tx + ttW > W) tx = state.mouseX - ttW - 8;
  if (ty + ttH > H) ty = screenY - ttH - 4;
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
  // Fundo papel envelhecido com gradiente, cobre o MUNDO inteiro (não só o canvas)
  const grd = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  grd.addColorStop(0, '#d4b478');
  grd.addColorStop(0.5, '#c9a76a');
  grd.addColorStop(1, '#a87f48');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // Textura sutil cobrindo todo o mundo
  ctx.fillStyle = 'rgba(80,50,20,0.07)';
  for (let i = 0; i < 1600; i++) {
    const x = (i * 137) % WORLD_W;
    const y = (i * 89) % WORLD_H;
    ctx.fillRect(x, y, 2, 2);
  }
  // Camada de montanhas mais distante (clara, ao fundo) — repetida por todo o mundo
  ctx.fillStyle = '#a88a5a';
  ctx.beginPath();
  ctx.moveTo(0, 150);
  for (let x = 0; x <= WORLD_W; x += 140) {
    const peak = ((x / 70) | 0) % 2 === 0;
    ctx.lineTo(x + 40, peak ? 50 : 70);
    ctx.lineTo(x + 100, peak ? 140 : 130);
  }
  ctx.lineTo(WORLD_W, 0);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  // Camada de montanhas mais perto (escura, à frente)
  ctx.fillStyle = '#8a6a3e';
  ctx.beginPath();
  ctx.moveTo(0, 190);
  for (let x = 0; x <= WORLD_W; x += 150) {
    const peak = ((x / 75) | 0) % 2 === 0;
    ctx.lineTo(x + 65, peak ? 70 : 90);
    ctx.lineTo(x + 115, peak ? 180 : 170);
  }
  ctx.lineTo(WORLD_W, 0);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  // Sombra na base das montanhas (transição pro chão) — em todo o mundo
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.fillRect(0, 180, WORLD_W, 12);
  // Penhascos avermelhados em primeiro plano (rodapé do canvas)
  drawForegroundCliffs();
  // Vegetação + decorações espalhadas (deterministic scatter)
  drawNatureScatter();
}

// ---- Penhascos/rochas no rodapé do mundo (efeito far-west) ----
function drawForegroundCliffs() {
  // Faixa de areia mais escura no chão do mundo
  ctx.fillStyle = 'rgba(120,80,40,0.25)';
  ctx.fillRect(0, WORLD_H - 60, WORLD_W, 60);
  // Penhascos vermelho-tijolo espalhados pela largura do mundo
  const cliffs = [
    { x: 210, y: WORLD_H - 70, w: 80, h: 50 },
    { x: 310, y: WORLD_H - 90, w: 110, h: 70 },
    { x: 470, y: WORLD_H - 60, w: 70, h: 40 },
    { x: 720, y: WORLD_H - 80, w: 90, h: 60 },
    { x: 1130, y: WORLD_H - 70, w: 95, h: 50 },
    // Novos penhascos no quadrante expandido (direita / abaixo)
    { x: 1500, y: WORLD_H - 80, w: 100, h: 60 },
    { x: 1720, y: WORLD_H - 60, w: 70, h: 40 },
    { x: 1900, y: WORLD_H - 90, w: 120, h: 70 },
    { x: 2200, y: WORLD_H - 70, w: 90, h: 50 },
    { x: 2400, y: WORLD_H - 80, w: 110, h: 60 },
    // Penhascos no meio vertical (separadores naturais)
    { x: 100,  y: 760, w: 90, h: 55 },
    { x: 400,  y: 800, w: 110, h: 65 },
    { x: 800,  y: 770, w: 80, h: 50 },
    { x: 1200, y: 800, w: 120, h: 65 },
    { x: 1600, y: 770, w: 100, h: 55 },
    { x: 2000, y: 800, w: 90, h: 60 },
  ];
  for (const c of cliffs) drawCliff(c.x, c.y, c.w, c.h);
}

function drawCliff(x, y, w, h) {
  // Sombra projetada
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h + 4, w / 2 + 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Massa rochosa principal (terracota)
  ctx.fillStyle = '#b86848';
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w * 0.15, y + h * 0.45);
  ctx.lineTo(x + w * 0.35, y + h * 0.1);
  ctx.lineTo(x + w * 0.55, y + h * 0.35);
  ctx.lineTo(x + w * 0.75, y);
  ctx.lineTo(x + w * 0.95, y + h * 0.4);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
  // Faixa horizontal mais clara (camada geológica)
  ctx.fillStyle = 'rgba(232,180,140,0.35)';
  ctx.fillRect(x + 2, y + h * 0.55, w - 4, 3);
  ctx.fillRect(x + 6, y + h * 0.75, w - 12, 2);
  // Sombras laterais (volume)
  ctx.fillStyle = 'rgba(60,30,15,0.22)';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.55, y + h * 0.35);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w * 0.65, y + h);
  ctx.closePath();
  ctx.fill();
  // Pedrinhas na base
  ctx.fillStyle = '#8a4828';
  for (let i = 0; i < 4; i++) {
    const rx = x + 8 + i * (w - 16) / 4;
    ctx.beginPath();
    ctx.arc(rx, y + h - 2, 3 + (i % 2), 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- Scatter determinístico de árvores, cactos e pedras ----
// Usa um LCG simples pra sempre gerar a mesma cena (estável entre frames)
function lcg(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function inAnyRect(x, y, rects) {
  for (const r of rects) {
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return true;
  }
  return false;
}

function getDecorAvoidRects() {
  return [
    // Áreas das minas (4 slots)
    ...OVERWORLD.mineEntrances.map(r => ({ x: r.x - 14, y: r.y - 14, w: r.w + 28, h: r.h + 60 })),
    // Fábricas (3 slots) + painel de receita acima
    ...[0, 1, 2].map(i => {
      const fr = factoryRect(i);
      return { x: fr.x - 8, y: fr.y - 58, w: fr.w + 16, h: fr.h + 70 };
    }),
    // Mercado e Pesquisa nodes
    { x: OVERWORLD.mercadoNode.x - 10, y: OVERWORLD.mercadoNode.y - 10, w: OVERWORLD.mercadoNode.w + 20, h: OVERWORLD.mercadoNode.h + 30 },
    { x: OVERWORLD.pesquisaNode.x - 10, y: OVERWORLD.pesquisaNode.y - 10, w: OVERWORLD.pesquisaNode.w + 20, h: OVERWORLD.pesquisaNode.h + 30 },
    // Cidade
    { x: CITY.x - 10, y: 50, w: CITY.w + 20, h: H },
    // Painel de projeto ativo (canto superior esquerdo overworld)
    { x: 14, y: 50, w: 290, h: 130 },
    // Vilarejos decorativos
    { x: 460, y: 250, w: 60, h: 50 },
    { x: 660, y: 225, w: 60, h: 50 },
    { x: 540, y: 640, w: 60, h: 50 },
    // Estrada da carruagem
    { x: ROAD.x1 - 4, y: ROAD.y - 14, w: ROAD.x2 - ROAD.x1 + 8, h: 28 },
  ];
}

function drawNatureScatter() {
  const avoid = getDecorAvoidRects();
  const rng = lcg(8675309);
  // Árvores espalhadas pelo MUNDO inteiro (mais densas que antes)
  let placed = 0;
  for (let tries = 0; tries < 800 && placed < 180; tries++) {
    const x = rng() * (WORLD_W - 40) + 20;
    const y = 210 + rng() * (WORLD_H - 280);
    if (inAnyRect(x, y, avoid)) continue;
    const size = 0.55 + rng() * 0.7;
    drawTree(x, y, size);
    placed++;
  }
  // Cactos espalhados pelo mundo (mais na metade direita)
  placed = 0;
  for (let tries = 0; tries < 200 && placed < 30; tries++) {
    const x = 450 + rng() * (WORLD_W - 500);
    const y = 320 + rng() * (WORLD_H - 400);
    if (inAnyRect(x, y, avoid)) continue;
    drawCactus(x, y);
    placed++;
  }
  // Pedras pequenas espalhadas (textura)
  placed = 0;
  for (let tries = 0; tries < 500 && placed < 70; tries++) {
    const x = rng() * (WORLD_W - 30) + 15;
    const y = 210 + rng() * (WORLD_H - 280);
    if (inAnyRect(x, y, avoid)) continue;
    drawSmallRock(x, y, 0.7 + rng() * 0.8);
    placed++;
  }
}

function drawTree(x, y, size = 1) {
  const r = 14 * size;
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.6, r * 0.9, r * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  // tronco
  ctx.fillStyle = '#5a3416';
  ctx.fillRect(x - 2 * size, y + r * 0.4, 4 * size, 9 * size);
  // copa grande (verde médio)
  ctx.fillStyle = '#4a6a3a';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // copa secundária (verde escuro pra dar volume)
  ctx.fillStyle = '#3a5a2a';
  ctx.beginPath();
  ctx.arc(x + r * 0.3, y - r * 0.3, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
  // highlight (verde claro)
  ctx.fillStyle = 'rgba(140,170,90,0.45)';
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

function drawCactus(x, y) {
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y + 12, 8, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // tronco principal
  ctx.fillStyle = '#4f6a3a';
  ctx.fillRect(x - 3, y - 18, 6, 30);
  // topo arredondado
  ctx.beginPath();
  ctx.arc(x, y - 18, 3, Math.PI, Math.PI * 2);
  ctx.fill();
  // braço esquerdo
  ctx.fillRect(x - 9, y - 5, 6, 4);
  ctx.fillRect(x - 9, y - 14, 4, 9);
  ctx.beginPath();
  ctx.arc(x - 7, y - 14, 2, Math.PI, Math.PI * 2);
  ctx.fill();
  // braço direito (mais curto)
  ctx.fillRect(x + 3, y - 10, 5, 3);
  ctx.fillRect(x + 6, y - 16, 3, 6);
  ctx.beginPath();
  ctx.arc(x + 7.5, y - 16, 1.5, Math.PI, Math.PI * 2);
  ctx.fill();
  // detalhe (linhas verticais — espinhos sutis)
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 1, y - 16); ctx.lineTo(x - 1, y + 10);
  ctx.moveTo(x + 1, y - 16); ctx.lineTo(x + 1, y + 10);
  ctx.stroke();
}

function drawSmallRock(x, y, size = 1) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y + 3 * size, 6 * size, 1.6 * size, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a6a48';
  ctx.beginPath();
  ctx.ellipse(x, y, 5 * size, 3.5 * size, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,235,200,0.3)';
  ctx.beginPath();
  ctx.ellipse(x - 1.5 * size, y - 0.5 * size, 1.5 * size, 1 * size, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawRanch(x, y, name) {
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x - 18, y + 18, 50, 4);
  // celeiro (parede vermelha)
  ctx.fillStyle = '#a8442a';
  ctx.fillRect(x - 16, y - 14, 32, 32);
  // telhado escuro
  ctx.fillStyle = '#3a1f0a';
  ctx.beginPath();
  ctx.moveTo(x - 20, y - 14);
  ctx.lineTo(x, y - 26);
  ctx.lineTo(x + 20, y - 14);
  ctx.closePath();
  ctx.fill();
  // X branco característico do celeiro
  ctx.strokeStyle = '#f1e3c2';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 8); ctx.lineTo(x + 10, y + 12);
  ctx.moveTo(x + 10, y - 8); ctx.lineTo(x - 10, y + 12);
  ctx.stroke();
  // porta
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(x - 4, y + 8, 8, 10);
  // cerca à direita
  ctx.fillStyle = '#5a3416';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(x + 20 + i * 6, y + 6, 2, 12);
  }
  ctx.fillRect(x + 20, y + 9, 22, 1.5);
  // placa com o nome
  ctx.font = 'bold 9px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const tw = ctx.measureText(name).width + 8;
  ctx.fillStyle = 'rgba(241,227,194,0.85)';
  ctx.fillRect(x - tw / 2, y + 22, tw, 12);
  ctx.fillStyle = '#3a1f0a';
  ctx.fillText(name, x, y + 23);
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
  // Atenção contextual: se essa mina é a ativa E precisa de ação, pulsa forte dourado
  const attention = isActive ? mineNeedsAttention() : 0;
  const color = exhausted ? '120,120,120'
    : attention > 0 ? '255,212,74'
    : isActive ? '255,180,80'
    : '255,220,80';
  if (attention > 0) pulse = 0.6 + 0.4 * (Math.sin(t * 1.5) + 1) / 2;
  ctx.strokeStyle = `rgba(${color},${0.25 + 0.55 * pulse})`;
  ctx.lineWidth = attention > 0 ? 3.5 : 2.5;
  ctx.strokeRect(signCx - sw / 2, signCy - 12, sw, 24);
  // Ícone de aviso se há ação disponível
  if (attention > 0) {
    ctx.fillStyle = `rgba(255,212,74,${0.7 + 0.3 * pulse})`;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', signCx + sw / 2 + 14, signCy);
  }
  if (exhausted) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(e.x - 14, e.y - 6, e.w + 28, e.h + 18);
  }
}

function drawDottedRoute(x1, y1, x2, y2) {
  // Linha sutil de base (caminho mais claro pra dar continuidade)
  ctx.strokeStyle = 'rgba(58,31,10,0.18)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  // Pontilhado mais denso e marcado por cima
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const step = 9;
  const n = Math.floor(dist / step);
  ctx.fillStyle = 'rgba(58,31,10,0.75)';
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    ctx.beginPath();
    ctx.arc(px, py, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawOverworld() {
  // === Camada do MUNDO (pan + zoom pela câmera) ===
  ctx.save();
  ctx.scale(state.camera.zoom, state.camera.zoom);
  ctx.translate(-state.camera.x, -state.camera.y);
  drawOverworldBg();
  drawAmbience(ctx);
  drawRiver();
  drawDecorativeLandmarks();
  // Rotas mina→fábrica também evoluem visualmente pelo transportTier
  const tier = transportTier();
  for (const d of OVERWORLD.dottedMineToFactory) {
    drawTieredRoute(d.x1, d.y1, d.x2, d.y2, tier);
  }
  drawMineEntrances();
  drawMercadoNode();
  drawPesquisaNode();
  drawFactories();
  drawFactoryRecipePanels();
  drawCity();
  drawRoad();
  drawWagon();
  drawParticles(ctx, 'overworld');
  drawLockedAreaFog();
  ctx.restore();
  // === Camada HUD (fixa na tela) ===
  drawActiveProjectPanel();
  drawContractPanelOverworld();
  drawPanIndicators();
  drawMinimap();
}

// Minimap no canto inferior-direito. Mostra mina/fábrica/cidade como pontos
// e a viewport atual como retângulo amarelo. Click teleporta câmera.
function drawMinimap() {
  const m = MINIMAP;
  // Moldura
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(m.x - 3, m.y - 3, m.w + 6, m.h + 6);
  // Fundo papel
  ctx.fillStyle = 'rgba(212,180,120,0.92)';
  ctx.fillRect(m.x, m.y, m.w, m.h);
  // Textura sutil
  ctx.fillStyle = 'rgba(80,50,20,0.08)';
  for (let i = 0; i < 40; i++) {
    const x = m.x + ((i * 17) % m.w);
    const y = m.y + ((i * 11) % m.h);
    ctx.fillRect(x, y, 1, 1);
  }
  const sx = m.w / WORLD_W;
  const sy = m.h / WORLD_H;
  // Sombreia área ainda bloqueada (proporcionalmente)
  const u = unlockedWorldSize(currentEra());
  if (u.w < WORLD_W || u.h < WORLD_H) {
    ctx.fillStyle = 'rgba(20,12,4,0.55)';
    if (u.w < WORLD_W) ctx.fillRect(m.x + u.w * sx, m.y, (WORLD_W - u.w) * sx, m.h);
    if (u.h < WORLD_H) ctx.fillRect(m.x, m.y + u.h * sy, u.w * sx, (WORLD_H - u.h) * sy);
  }
  // Minas (cavernas marrons)
  ctx.fillStyle = '#5a3416';
  for (let i = 0; i < OVERWORLD.mineEntrances.length; i++) {
    const e = OVERWORLD.mineEntrances[i];
    const mx = m.x + (e.x + e.w / 2) * sx;
    const my = m.y + (e.y + e.h / 2) * sy;
    ctx.beginPath();
    ctx.arc(mx, my, 4, 0, Math.PI * 2);
    ctx.fill();
    // ponto amarelo se a mina existe (foi construída)
    if (state.mines[i]) {
      ctx.fillStyle = '#ffd44a';
      ctx.beginPath();
      ctx.arc(mx, my, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a3416';
    }
  }
  // Fábricas
  ctx.fillStyle = '#a8442a';
  for (let i = 0; i < state.factories.length; i++) {
    const r = factoryRect(i);
    const fx = m.x + (r.x + r.w / 2) * sx;
    const fy = m.y + (r.y + r.h / 2) * sy;
    ctx.fillRect(fx - 2, fy - 2, 4, 4);
  }
  // Cidade (estrela vermelha)
  ctx.fillStyle = '#d04030';
  const cmx = m.x + (CITY.x + CITY.w / 2) * sx;
  const cmy = m.y + (CITY.y + CITY.h / 2) * sy;
  ctx.beginPath();
  ctx.arc(cmx, cmy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd44a';
  ctx.font = 'bold 8px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★', cmx, cmy);
  // Viewport atual (retângulo amarelo) — ajusta tamanho pelo zoom
  const vx = m.x + state.camera.x * sx;
  const vy = m.y + state.camera.y * sy;
  const vw = (W / state.camera.zoom) * sx;
  const vh = (H / state.camera.zoom) * sy;
  ctx.strokeStyle = '#ffd44a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(vx, vy, vw, vh);
  // Indicador de zoom (canto da minimap)
  ctx.fillStyle = 'rgba(20,10,5,0.75)';
  ctx.fillRect(m.x + m.w - 40, m.y - 14, 40, 14);
  ctx.fillStyle = '#ffd44a';
  ctx.font = 'bold 9px "Segoe UI", Arial';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.camera.zoom.toFixed(1) + 'x', m.x + m.w - 4, m.y - 7);
  // Label
  ctx.fillStyle = 'rgba(20,10,5,0.75)';
  ctx.fillRect(m.x, m.y - 14, 46, 14);
  ctx.fillStyle = '#ffd44a';
  ctx.font = 'bold 9px "Segoe UI", Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('MAPA', m.x + 4, m.y - 7);
}

// Áreas ainda bloqueadas (acima do limite da era atual) ficam com névoa
// escura translúcida + texto "DESBLOQUEADO NA ERA N". O fog é desenhado no
// espaço do mundo (dentro do translate da câmera).
function drawLockedAreaFog() {
  const era = currentEra();
  const u = unlockedWorldSize(era);
  if (u.w >= WORLD_W && u.h >= WORLD_H) return; // tudo destravado
  // Faixa vertical à direita (área não destravada horizontalmente)
  ctx.fillStyle = 'rgba(20,12,4,0.55)';
  if (u.w < WORLD_W) {
    ctx.fillRect(u.w, 0, WORLD_W - u.w, WORLD_H);
  }
  // Faixa horizontal embaixo (área não destravada verticalmente)
  if (u.h < WORLD_H) {
    ctx.fillRect(0, u.h, u.w, WORLD_H - u.h);
  }
  // Borda animada na linha de desbloqueio (faixa âmbar pulsante)
  const t = performance.now() / 600;
  const pulse = 0.5 + 0.3 * (Math.sin(t) + 1) / 2;
  ctx.fillStyle = `rgba(255,180,80,${pulse})`;
  if (u.w < WORLD_W) ctx.fillRect(u.w - 2, 0, 4, u.h);
  if (u.h < WORLD_H) ctx.fillRect(0, u.h - 2, u.w, 4);
  // Texto indicando próxima era — centralizado nas áreas bloqueadas
  ctx.fillStyle = '#ffd44a';
  ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const nextEra = Math.min(6, era + 1);
  if (u.w < WORLD_W) {
    ctx.fillText(`🔒 Desbloqueia na Era ${nextEra}`, (u.w + WORLD_W) / 2, u.h / 2);
  }
  if (u.h < WORLD_H && u.w === WORLD_W) {
    ctx.fillText(`🔒 Desbloqueia na Era ${nextEra}`, WORLD_W / 2, (u.h + WORLD_H) / 2);
  }
}

// Setinhas nos cantos pra avisar que dá pra arrastar o mapa
function drawPanIndicators() {
  const u = unlockedWorldSize(currentEra());
  ctx.fillStyle = 'rgba(58,31,10,0.55)';
  ctx.font = 'bold 22px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (state.camera.x > 4) ctx.fillText('◀', 22, H / 2);
  if (state.camera.x < u.w - W / state.camera.zoom - 4) ctx.fillText('▶', W - 22, H / 2);
  if (state.camera.y > 4) ctx.fillText('▲', W / 2, 22);
  if (state.camera.y < u.h - H / state.camera.zoom - 4) ctx.fillText('▼', W / 2, H - 22);
}

// Rio decorativo serpenteando pelo MUNDO inteiro (borda direita do mundo)
function drawRiver() {
  const baseX = WORLD_W - 50;
  // Faixa azul ondulada
  ctx.fillStyle = 'rgba(80,140,180,0.35)';
  ctx.beginPath();
  ctx.moveTo(baseX, 0);
  for (let y = 0; y <= WORLD_H; y += 14) {
    const wave = Math.sin(y * 0.04) * 12;
    ctx.lineTo(baseX + wave, y);
  }
  ctx.lineTo(WORLD_W, WORLD_H);
  ctx.lineTo(WORLD_W, 0);
  ctx.closePath();
  ctx.fill();
  // Ondinhas brancas pra dar movimento
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  for (let y = 20; y < WORLD_H; y += 28) {
    const wave = Math.sin(y * 0.04) * 12;
    ctx.beginPath();
    ctx.moveTo(baseX + wave + 6, y);
    ctx.lineTo(baseX + wave + 14, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(baseX + wave + 20, y + 10);
    ctx.lineTo(baseX + wave + 28, y + 10);
    ctx.stroke();
  }
  // Margem (areia escura) do lado esquerdo do rio
  ctx.fillStyle = 'rgba(120,80,40,0.4)';
  ctx.beginPath();
  ctx.moveTo(baseX - 4, 0);
  for (let y = 0; y <= WORLD_H; y += 14) {
    const wave = Math.sin(y * 0.04) * 12;
    ctx.lineTo(baseX - 4 + wave, y);
  }
  ctx.lineTo(baseX, WORLD_H);
  for (let y = WORLD_H; y >= 0; y -= 14) {
    const wave = Math.sin(y * 0.04) * 12;
    ctx.lineTo(baseX + wave, y);
  }
  ctx.closePath();
  ctx.fill();
}

// Landmarks decorativos espalhados pelo mapa (não interativos).
// Estilo: vila colonial, pueblo, fazenda — pra dar a sensação de "rede de
// cidades" tipo a referência (Rancho Longhorn, Pueblo Blanco, etc.).
function drawDecorativeLandmarks() {
  // === Quadrante inicial (visível no carregamento) ===
  drawVillage(520, 200, 'TUBARÃO', 'pueblo', 0.85);
  drawVillage(680, 280, 'JOINVILLE', 'village', 0.8);
  drawVillage(370, 270, 'BLUMENAU', 'village', 0.75);
  drawVillage(530, 640, 'LAGES', 'pueblo', 0.85);
  drawVillage(870, 640, 'CHAPECÓ', 'fazenda', 0.85);
  drawVillage(210, 320, 'RIO NEGRINHO', 'fazenda', 0.7);
  drawDottedRoute(370, 280, 520, 210);
  drawDottedRoute(520, 215, 680, 285);
  drawDottedRoute(530, 650, 870, 650);

  // === Quadrantes expandidos (apare arrastando o mapa) ===
  // Leste (x > W)
  drawVillage(1450, 220, 'NAVEGANTES', 'pueblo', 0.85);
  drawVillage(1680, 320, 'ITAJAÍ', 'fazenda', 0.85);
  drawVillage(1900, 230, 'BALN. CAMBORIÚ', 'pueblo', 0.8);
  drawVillage(2100, 380, 'PORTO BELO', 'village', 0.75);
  drawVillage(2280, 230, 'BOMBINHAS', 'fazenda', 0.75);
  // Sul (y > H) — abaixo do quadrante inicial
  drawVillage(420, 900, 'BIGUAÇU', 'village', 0.85);
  drawVillage(680, 960, 'SÃO JOSÉ', 'pueblo', 0.9);
  drawVillage(960, 880, 'PALHOÇA', 'fazenda', 0.85);
  drawVillage(220, 1080, 'GAROPABA', 'village', 0.75);
  drawVillage(560, 1180, 'IMBITUBA', 'pueblo', 0.85);
  drawVillage(900, 1100, 'LAGUNA', 'fazenda', 0.85);
  // Sudeste (x > W, y > H)
  drawVillage(1440, 880, 'CRICIÚMA', 'fazenda', 0.9);
  drawVillage(1700, 950, 'ARARANGUÁ', 'village', 0.85);
  drawVillage(2000, 880, 'TORRES', 'pueblo', 0.85);
  drawVillage(2200, 1080, 'PRAIA GRANDE', 'village', 0.75);
  drawVillage(1500, 1180, 'TUBARÃO SUL', 'fazenda', 0.8);
  drawVillage(1850, 1180, 'GRAVATAL', 'pueblo', 0.75);
  // Rotas conectando os quadrantes
  drawDottedRoute(1100, 200, 1450, 220);
  drawDottedRoute(1450, 230, 1680, 320);
  drawDottedRoute(1680, 320, 1900, 240);
  drawDottedRoute(1900, 240, 2100, 380);
  drawDottedRoute(420, 670, 420, 900);
  drawDottedRoute(420, 910, 680, 960);
  drawDottedRoute(680, 960, 960, 880);
  drawDottedRoute(960, 880, 1440, 880);
  drawDottedRoute(1440, 880, 1700, 950);
  drawDottedRoute(1700, 950, 2000, 880);
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
  drawNodeHoverHighlight(n, marketNeedsAttention());
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
  drawNodeHoverHighlight(n, researchNeedsAttention());
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

function drawNodeHoverHighlight(n, attention = 0) {
  const hovering =
    state.mouseX >= n.x && state.mouseX < n.x + n.w &&
    state.mouseY >= n.y && state.mouseY < n.y + n.h + 22;
  const t = performance.now() / 700;
  let pulse = hovering ? 1 : (Math.sin(t) + 1) / 2 * 0.6;
  // Atenção: pulsa mais forte com cor mais quente
  if (attention > 0) pulse = Math.max(pulse, 0.6 + 0.4 * (Math.sin(t * 1.5) + 1) / 2);
  if (pulse > 0.1) {
    const color = attention > 0 ? '255,180,80' : '255,220,80';
    ctx.strokeStyle = `rgba(${color},${0.25 + 0.55 * pulse})`;
    ctx.lineWidth = attention > 0 ? 3 : 2;
    ctx.strokeRect(n.x - 4, n.y - 4, n.w + 8, n.h + 30);
    if (attention > 0) {
      // ícone "!" flutuante acima
      ctx.fillStyle = `rgba(255,212,74,${0.7 + 0.3 * pulse})`;
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', n.x + n.w / 2, n.y - 14);
    }
  }
}

// ---------- Tutorial progressivo (avança conforme o jogador age) ----------
// Cada step tem:
// - scene: em qual cena aparece
// - msg: texto explicativo
// - check(state): retorna true quando o jogador já fez a ação → avança auto
// - autoDismiss?: se true, fecha sozinho em 6s após o check
const TUTORIAL_STEPS = [
  {
    scene: 'overworld',
    msg: '👋 Bem-vindo! Clique numa MINA (cavernas marrons à esquerda/direita) pra começar a cavar.',
    check: (s) => s.scene === 'mine',
  },
  {
    scene: 'mine',
    msg: '⛏ Clique num veio descoberto (CVO/FRO ao lado do elevador) pra alocar minerador. Pra cavar túneis novos, troque pra Picareta (tecla 1).',
    check: (s) => {
      for (const m of (s.mines || [])) {
        if (!m.grid) continue;
        for (const row of m.grid) for (const t of row) if (t.worker) return true;
      }
      return false;
    },
  },
  {
    scene: 'mine',
    msg: '✅ Minerador alocado! Volte ao MAPA (← botão no topo) pra ver as fábricas e a cidade.',
    check: (s) => s.scene === 'overworld',
  },
  {
    scene: 'overworld',
    msg: '🏭 Clique numa FÁBRICA pra trocar a receita. Carruagens automaticamente levam o produto pra cidade.',
    check: (s) => (s.contractsCompleted || 0) >= 1,
  },
  {
    scene: 'overworld',
    msg: '📜 Cumpra contratos pra ganhar dinheiro, PP e avançar de era. Cada era nova libera mais recursos/receitas.',
    autoDismiss: true,
  },
];

function drawTutorial() {
  if (!state.tutorial || state.tutorial.dismissed) return;
  // Avança step quando o check do step atual passa
  const step = state.tutorial.step ?? 0;
  const t = TUTORIAL_STEPS[step];
  if (!t) { state.tutorial.dismissed = true; return; }
  if (t.check && t.check(state)) {
    state.tutorial.step = step + 1;
    state.tutorial.autoDismissIn = 6;
    return;
  }
  if (t.scene !== state.scene) return;
  const w = 560;
  const h = 56;
  const tx = (W - w) / 2;
  const ty = state.scene === 'overworld' ? 180 : 90;
  drawScrollPanel(tx, ty, w, h);
  ctx.fillStyle = '#3a1f0a';
  ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t.msg, tx + w / 2, ty + h / 2 - 4);
  // Indicador de progresso (X/N) + skip
  const stepsTotal = TUTORIAL_STEPS.length;
  ctx.fillStyle = '#5a3416';
  ctx.font = '10px "Segoe UI"';
  ctx.fillText(`Passo ${step + 1}/${stepsTotal} · clique fora pra pular`, tx + w / 2, ty + h - 8);
  if (t.autoDismiss) {
    const left = Math.max(0, state.tutorial.autoDismissIn ?? 0);
    if (left <= 0) state.tutorial.dismissed = true;
  }
}

// Landmark decorativo (não interativo). Estilos: 'village', 'pueblo', 'fazenda'
function drawVillage(x, baseY, name, style = 'village', scale = 0.8) {
  if (style === 'pueblo') drawPuebloStyle(x, baseY, scale);
  else if (style === 'fazenda') drawFazendaStyle(x, baseY, scale);
  else drawVillageStyle(x, baseY, scale);
  // mini árvore ao lado
  drawTree(x + 28 * scale, baseY + 2, 0.55);
  // placa com nome (visível sobre qualquer fundo)
  ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const tw = ctx.measureText(name).width + 10;
  // moldura escura
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(x - tw / 2 - 1, baseY + 6, tw + 2, 15);
  ctx.fillStyle = '#c69042';
  ctx.fillRect(x - tw / 2, baseY + 7, tw, 13);
  ctx.fillStyle = '#1a0e06';
  ctx.fillText(name, x, baseY + 9);
}

// Vilarejo estilo colonial — casinhas com telhado triangular
function drawVillageStyle(x, baseY, scale) {
  const houses = [
    { dx: -18, w: 18, h: 24, face: '#e8c87a', roof: '#a82e1c' },
    { dx: 2,   w: 14, h: 28, face: '#b8c8a8', roof: '#8a4a2a' },
    { dx: 20,  w: 16, h: 22, face: '#d8b878', roof: '#5a3416' },
  ];
  for (const b of houses) {
    const hx = x + b.dx * scale;
    const top = baseY - b.h * scale;
    const w = b.w * scale, h = b.h * scale;
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(hx, baseY, w + 2, 3);
    // parede
    ctx.fillStyle = b.face;
    ctx.fillRect(hx, top, w, h);
    // rodapé
    ctx.fillStyle = '#3a1f0a';
    ctx.fillRect(hx, baseY - 2, w, 2);
    // telhado triangular
    ctx.fillStyle = b.roof;
    ctx.beginPath();
    ctx.moveTo(hx - 2, top);
    ctx.lineTo(hx + w / 2, top - 8 * scale);
    ctx.lineTo(hx + w + 2, top);
    ctx.closePath();
    ctx.fill();
    // janela
    ctx.fillStyle = '#a8c8d8';
    ctx.fillRect(hx + 2 * scale, top + 6 * scale, 4 * scale, 5 * scale);
  }
}

// Pueblo — adobe + igrejinha branca no centro
function drawPuebloStyle(x, baseY, scale) {
  // casa adobe esquerda
  const ax = x - 24 * scale;
  const ah = 22 * scale, aw = 18 * scale;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(ax, baseY, aw + 2, 3);
  ctx.fillStyle = '#d8a868';
  ctx.fillRect(ax, baseY - ah, aw, ah);
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(ax, baseY - 2, aw, 2);
  // telhado plano adobe
  ctx.fillStyle = '#8a5a30';
  ctx.fillRect(ax - 1, baseY - ah - 2, aw + 2, 3);
  // igrejinha branca central
  const cx = x - 5 * scale;
  const cw = 18 * scale, ch = 28 * scale;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(cx, baseY, cw + 2, 3);
  ctx.fillStyle = '#f1e3c2';
  ctx.fillRect(cx, baseY - ch, cw, ch);
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(cx, baseY - 2, cw, 2);
  // telhado triangular vermelho
  ctx.fillStyle = '#a82e1c';
  ctx.beginPath();
  ctx.moveTo(cx - 2, baseY - ch);
  ctx.lineTo(cx + cw / 2, baseY - ch - 8 * scale);
  ctx.lineTo(cx + cw + 2, baseY - ch);
  ctx.closePath();
  ctx.fill();
  // torre sineira pequena
  const tx = cx + cw / 2 - 3 * scale;
  ctx.fillStyle = '#f1e3c2';
  ctx.fillRect(tx, baseY - ch - 14 * scale, 6 * scale, 8 * scale);
  // cruz
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(tx + 2.5 * scale, baseY - ch - 22 * scale, 1.5 * scale, 8 * scale);
  ctx.fillRect(tx + 1.5 * scale, baseY - ch - 19 * scale, 3.5 * scale, 1.5 * scale);
  // casa adobe direita
  const dx = x + 16 * scale;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(dx, baseY, aw + 2, 3);
  ctx.fillStyle = '#c69460';
  ctx.fillRect(dx, baseY - ah * 0.85, aw, ah * 0.85);
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(dx, baseY - 2, aw, 2);
  ctx.fillStyle = '#8a5a30';
  ctx.fillRect(dx - 1, baseY - ah * 0.85 - 2, aw + 2, 3);
}

// Fazenda — celeiro vermelho com X branco + cerca
function drawFazendaStyle(x, baseY, scale) {
  // celeiro principal
  const bw = 32 * scale, bh = 26 * scale;
  const bx = x - bw / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(bx, baseY, bw + 2, 3);
  ctx.fillStyle = '#a8442a';
  ctx.fillRect(bx, baseY - bh, bw, bh);
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(bx, baseY - 2, bw, 2);
  // telhado triangular escuro
  ctx.fillStyle = '#3a1f0a';
  ctx.beginPath();
  ctx.moveTo(bx - 3, baseY - bh);
  ctx.lineTo(bx + bw / 2, baseY - bh - 12 * scale);
  ctx.lineTo(bx + bw + 3, baseY - bh);
  ctx.closePath();
  ctx.fill();
  // X branco característico
  ctx.strokeStyle = '#f1e3c2';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bx + 4, baseY - bh + 4); ctx.lineTo(bx + bw - 4, baseY - 4);
  ctx.moveTo(bx + bw - 4, baseY - bh + 4); ctx.lineTo(bx + 4, baseY - 4);
  ctx.stroke();
  // porta
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(bx + bw / 2 - 4, baseY - 14, 8, 12);
  // cerca à direita
  ctx.fillStyle = '#5a3416';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(bx + bw + 4 + i * 6 * scale, baseY - 14, 2, 14);
  }
  ctx.fillRect(bx + bw + 4, baseY - 8, 22 * scale, 1.5);
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
  const ks = state.contracts || [];
  if (ks.length === 0) return;
  const x = CITY.x + 10;
  const w = CITY.w - 20;
  const cardH = 96;
  const gap = 6;
  for (let i = 0; i < ks.length; i++) {
    const y = 56 + i * (cardH + gap);
    drawContractCard(x, y, w, cardH, ks[i]);
  }
}

function drawContractCard(x, y, w, h, k) {
  const product = R[k.product];
  drawScrollPanel(x, y, w, h);
  ctx.fillStyle = '#3a1f0a';
  ctx.font = 'bold 11px "Segoe UI"';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`📜 ${k.city.toUpperCase()}`, x + 8, y + 6);
  drawResourceIcon(x + 8, y + 24, 26, k.product);
  ctx.fillStyle = '#1a0e06';
  ctx.font = 'bold 12px "Segoe UI"';
  ctx.textBaseline = 'top';
  ctx.fillText(product.name, x + 40, y + 24);
  ctx.fillStyle = '#5a3416';
  ctx.font = 'bold 14px "Segoe UI"';
  ctx.fillText(`${k.delivered} / ${k.need}`, x + 40, y + 40);
  const pct = clamp(k.delivered / k.need, 0, 1);
  ctx.fillStyle = '#1a0e06';
  ctx.fillRect(x + 8, y + 64, w - 16, 5);
  ctx.fillStyle = '#4d7c3a';
  ctx.fillRect(x + 8, y + 64, (w - 16) * pct, 5);
  const tLeft = Math.max(0, k.deadline - k.elapsed);
  const tPct = clamp(1 - k.elapsed / k.deadline, 0, 1);
  ctx.fillStyle = '#1a0e06';
  ctx.fillRect(x + 8, y + 74, w - 16, 5);
  ctx.fillStyle = tLeft < 20 ? '#a82e1c' : '#c69042';
  ctx.fillRect(x + 8, y + 74, (w - 16) * tPct, 5);
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
  drawElevatorHead();
  // Grid e cabo+cabine do elevador são panáveis verticalmente
  // (clipping pra não vazar no céu/HUD)
  ctx.save();
  ctx.beginPath();
  ctx.rect(MINE.x, MINE.y, MINE.cols * MINE.cell, H - MINE.y);
  ctx.clip();
  ctx.translate(0, -state.mineCamera.y);
  drawMineGrid();
  drawElevator();
  drawParticles(ctx, 'mine');
  ctx.restore();
  drawDepthMeter();
  drawToolbar();
  drawBackBtn();
  drawMineSwitcher();
  drawExhaustedOverlay();
}

// Cabeça do elevador (estrutura de superfície) — sempre fixa no topo,
// não pana com o resto da mina.
function drawElevatorHead() {
  const col = 0;
  const x = MINE.x + col * MINE.cell;
  const yTop = MINE.y;
  const headW = MINE.cell + 12;
  const headH = 36;
  ctx.fillStyle = '#5a3416';
  ctx.fillRect(x - 6, yTop - headH, headW, headH);
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(x - 6, yTop - headH, headW, 4);
  // roldana
  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.arc(x + MINE.cell / 2, yTop - headH + 14, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a3a3a';
  ctx.beginPath();
  ctx.arc(x + MINE.cell / 2, yTop - headH + 14, 2, 0, Math.PI * 2);
  ctx.fill();
}

// Mostra a profundidade atual em metros no canto esquerdo do grid
function drawDepthMeter() {
  const topRow = Math.floor(state.mineCamera.y / MINE.cell);
  const bottomRow = Math.min(MINE.rows - 1, Math.floor((state.mineCamera.y + (H - MINE.y) - 1) / MINE.cell));
  const txt = `${topRow}-${bottomRow}m`;
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  const tw = ctx.measureText(txt).width + 14;
  const tx = 12, ty = MINE.y + 8;
  ctx.fillStyle = 'rgba(20,10,5,0.7)';
  ctx.fillRect(tx, ty, tw, 20);
  ctx.fillStyle = '#ffd44a';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('⛰ ' + txt, tx + 5, ty + 11);
  // Barra de profundidade lateral (mostra onde o usuário está na mina toda)
  const maxCam = Math.max(1, MINE.rows * MINE.cell - (H - MINE.y));
  const pct = state.mineCamera.y / maxCam;
  const barX = 12, barY = MINE.y + 36, barW = 8, barH = H - MINE.y - 50;
  ctx.fillStyle = 'rgba(20,10,5,0.55)';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = '#c69042';
  const handleY = barY + barH * pct;
  ctx.fillRect(barX - 2, handleY - 5, barW + 4, 10);
}

// Cabine + cabo do elevador na coluna 0 do grid.
// A cabeça (estrutura de superfície) é desenhada SEPARADA por drawElevatorHead()
// FORA do contexto panned, pra ficar sempre visível no topo.
function drawElevator() {
  const mine = activeMine();
  if (!mine) return;
  const col = 0;
  const x = MINE.x + col * MINE.cell;
  const yTop = MINE.y;
  const totalH = MINE.rows * MINE.cell;
  const headH = 36;
  // posição do car (em world coords da mina; o ctx.translate(-cam.y) já ajusta)
  const carY = yTop + mine.elevator.y * (totalH - MINE.cell);
  // cabo (parte do topo do grid até a cabine)
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + MINE.cell / 2, yTop - headH + 14);
  ctx.lineTo(x + MINE.cell / 2, carY + 2);
  ctx.stroke();
  // Marcar variável headH usado pelo cálculo do cabo
  void headH;
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
// Tooltip flutuante quando o mouse paira sobre um nodo do overworld
// (mina, fábrica, mercado, pesquisa, cidade). Mostra título, status e dica.
function drawNodeTooltip() {
  if (state.isPanning) return;
  if (state.mouseX < 0 || state.mouseY < 0) return;
  // state.mouseX/Y em world coords no overworld — fazemos hit-test simples
  const mx = state.mouseX, my = state.mouseY;
  const hitRect = (r) => mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h;

  let title = '', sub = '', color = '#f1e3c2', tipX = mx, tipY = my;
  // Minas
  for (let i = 0; i < OVERWORLD.mineEntrances.length; i++) {
    const e = OVERWORLD.mineEntrances[i];
    if (!hitRect(e)) continue;
    const mine = state.mines[i];
    if (mine) {
      title = `⛏ ${mine.name}`;
      sub = mine.exhausted ? 'Esgotada — clique pra regenerar' : 'Clique pra entrar e cavar túneis';
      color = mine.exhausted ? '#a82e1c' : '#ffd44a';
    } else {
      title = '+ Nova Mina';
      sub = 'Clique pra comprar uma nova mina';
      color = '#a8d4d8';
    }
    drawTooltipBox(e.x + e.w / 2, e.y + e.h, title, sub, color);
    return;
  }
  // Mercado
  if (hitRect(OVERWORLD.mercadoNode)) {
    title = '💰 Mercado Livre';
    sub = 'Clique pra vender excedente (60-70% do preço)';
    drawTooltipBox(OVERWORLD.mercadoNode.x + OVERWORLD.mercadoNode.w / 2,
      OVERWORLD.mercadoNode.y + OVERWORLD.mercadoNode.h, title, sub, '#c69042');
    return;
  }
  // Pesquisa
  if (hitRect(OVERWORLD.pesquisaNode)) {
    title = '🔬 Pesquisa & Loja';
    sub = `${state.rp || 0} PP disponíveis · Clique pra ver upgrades`;
    drawTooltipBox(OVERWORLD.pesquisaNode.x + OVERWORLD.pesquisaNode.w / 2,
      OVERWORLD.pesquisaNode.y + OVERWORLD.pesquisaNode.h, title, sub, '#a868c8');
    return;
  }
  // Fábricas
  for (let i = 0; i < state.factories.length; i++) {
    const fr = factoryRect(i);
    if (!hitRect(fr)) continue;
    const f = state.factories[i];
    const product = R[f.recipeId];
    title = `🏭 Fábrica ${i + 1}: ${product?.name || '—'}`;
    if (f.brewing > 0) {
      const recipe = RECIPE_BY_ID[f.recipeId];
      const pct = recipe ? Math.round((1 - f.brewing / recipe.time) * 100) : 0;
      sub = `Produzindo... ${pct}% · Clique pra trocar receita`;
    } else {
      sub = 'Idle (falta ingrediente) · Clique pra trocar receita';
    }
    drawTooltipBox(fr.x + fr.w / 2, fr.y + fr.h, title, sub, product?.color || '#c69042');
    return;
  }
  // Slots vazios de fábrica
  for (let i = state.factories.length; i < CFG.factorySlotsMax; i++) {
    const fr = factoryRect(i);
    if (!hitRect(fr)) continue;
    title = `+ Nova Fábrica (slot ${i + 1})`;
    sub = `Custa ${fmtMoney(CFG.factoryCosts[i])} · Clique pra construir`;
    drawTooltipBox(fr.x + fr.w / 2, fr.y + fr.h, title, sub, '#a8d4d8');
    return;
  }
  // Cidade
  if (hitRect(CITY) || hitRect({ x: CITY.x, y: CITY.y - 100, w: CITY.w, h: 100 })) {
    const k = state.contract;
    title = `🏛 ${state.currentCity || 'Cidade'}`;
    if (k) {
      const have = Math.floor(state.products[k.product] || 0);
      sub = `Quer ${k.need - k.delivered}× ${R[k.product]?.name || '?'} (${have} prontos no estoque)`;
      color = have >= k.need - k.delivered ? '#4d7c3a' : '#c69042';
    } else {
      sub = `Aguardando próximo pedido...`;
    }
    drawTooltipBox(CITY.x + CITY.w / 2, CITY.y + CITY.h + 20, title, sub, color);
    return;
  }
  void tipX; void tipY;
}

// Helper: desenha um tooltip flutuante elegante numa posição (em world coords)
function drawTooltipBox(worldX, worldY, title, sub, accentColor) {
  // Como estamos dentro de drawNodeTooltip que é chamada APÓS drawOverworld
  // (fora do save/restore com translate), trabalha em screen coords.
  // Mas mouseX/Y são world coords... então preciso converter:
  const sx = (worldX - state.camera.x) * state.camera.zoom;
  const sy = (worldY - state.camera.y) * state.camera.zoom;
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  const titleW = ctx.measureText(title).width;
  ctx.font = '11px "Segoe UI", Arial, sans-serif';
  const subW = ctx.measureText(sub).width;
  const ttW = Math.max(titleW, subW) + 18;
  const ttH = 40;
  let tx = sx - ttW / 2;
  let ty = sy + 8;
  // Clampa pra dentro da viewport
  if (tx < 4) tx = 4;
  if (tx + ttW > W - 4) tx = W - ttW - 4;
  if (ty + ttH > H - 4) ty = sy - ttH - 12;
  // Background
  ctx.fillStyle = 'rgba(20,10,5,0.95)';
  ctx.fillRect(tx - 1, ty - 1, ttW + 2, ttH + 2);
  ctx.fillStyle = 'rgba(58,31,10,0.98)';
  ctx.fillRect(tx, ty, ttW, ttH);
  // Borda colorida do accent
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(tx, ty, ttW, ttH);
  // Faixa de cor no topo
  ctx.fillStyle = accentColor;
  ctx.fillRect(tx, ty, ttW, 3);
  // Texto
  ctx.fillStyle = accentColor;
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(title, tx + 8, ty + 8);
  ctx.fillStyle = '#f1e3c2';
  ctx.font = '11px "Segoe UI", Arial, sans-serif';
  ctx.fillText(sub, tx + 8, ty + 24);
}

export function draw() {
  if (state.scene === 'mine') {
    drawMineScene();
    drawTileTooltip();
  } else {
    drawOverworld();
    drawNodeTooltip();
  }
  drawEventBanner();
  drawTutorial();
  drawAchievementPopup();
  drawDailyChallengePanel();
}

// Popup grande no topo da tela quando uma conquista é desbloqueada.
// Anima entrada (slide-down) e saída (fade-out) automaticamente.
// Painel pequeno no canto inferior-esquerdo mostrando progresso do daily
function drawDailyChallengePanel() {
  const status = getDailyStatus();
  if (!status) return;
  const x = 14, y = H - 80, w = 240, h = 64;
  ctx.fillStyle = '#1a0e06';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  let bg = '#5a4030';
  if (status.met) bg = '#3a6a3a';
  else if (status.failed) bg = '#6a3a3a';
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#c69042';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
  // Título
  ctx.fillStyle = '#ffd44a';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`📅 ${status.name}${status.met ? ' ✓' : status.failed ? ' ✗' : ''}`, x + 8, y + 6);
  // Descrição
  ctx.fillStyle = '#f1e3c2';
  ctx.font = '10px "Segoe UI"';
  ctx.fillText(status.desc, x + 8, y + 22);
  // Barra de progresso
  const pct = Math.min(1, status.progress / status.total);
  ctx.fillStyle = '#1a0e06';
  ctx.fillRect(x + 8, y + 40, w - 16, 8);
  ctx.fillStyle = status.met ? '#4d7c3a' : status.failed ? '#a82e1c' : '#c69042';
  ctx.fillRect(x + 8, y + 40, (w - 16) * pct, 8);
  // Valor
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px "Segoe UI"';
  ctx.textAlign = 'right';
  const valTxt = `${status.progress.toLocaleString('pt-BR')} / ${status.total.toLocaleString('pt-BR')}`;
  ctx.fillText(valTxt, x + w - 8, y + 52);
}

function drawAchievementPopup() {
  const p = topPopup();
  if (!p) return;
  const def = p.def;
  // Anima: primeiro 0.4s slide-in, último 0.6s fade-out, no meio estável
  const lifeFrac = p.life / p.total;
  let slideIn = 0;
  if (lifeFrac > 0.85) {
    // entrada
    slideIn = (1 - lifeFrac) / 0.15;
  } else {
    slideIn = 1;
  }
  const alpha = lifeFrac < 0.15 ? lifeFrac / 0.15 : 1;
  const popW = 420, popH = 84;
  const x = (W - popW) / 2;
  const targetY = 30;
  const startY = -popH - 10;
  const y = startY + (targetY - startY) * slideIn;
  ctx.globalAlpha = alpha;
  // Moldura escura
  ctx.fillStyle = '#1a0e06';
  ctx.fillRect(x - 4, y - 4, popW + 8, popH + 8);
  // Faixa dourada
  ctx.fillStyle = '#c69042';
  ctx.fillRect(x, y, popW, popH);
  // Borda interna
  ctx.strokeStyle = '#ffd44a';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 4, y + 4, popW - 8, popH - 8);
  // Texto "CONQUISTA DESBLOQUEADA"
  ctx.fillStyle = '#1a0e06';
  ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('🏆 CONQUISTA DESBLOQUEADA', x + 14, y + 10);
  // Nome em destaque
  ctx.fillStyle = '#1a0e06';
  ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`${def.emoji}  ${def.name}`, x + 14, y + 28);
  // Descrição
  ctx.fillStyle = '#3a1f0a';
  ctx.font = '12px "Segoe UI", Arial, sans-serif';
  ctx.fillText(def.desc, x + 14, y + 56);
  ctx.globalAlpha = 1;
}
