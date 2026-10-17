// draw.js — renderização do canvas (mina em grid + superfície compacta)
import { state } from './state.js';
import { R, MINE } from './data.js';
import { fmtMoney, clamp } from './util.js';
import { currentEra, eraData } from './progression.js';
import { getProjectDef } from './projects.js';
import { activeMine, regenCost } from './mine.js';
import { ACH_BY_ID } from './data.js';
import { drawMinimap, minimapLayout } from './terrain.js';
import { applyWorldTransform, applyHudTransform, hudSize, visibleWorldRect, view, worldToScreen } from './camera.js';
import { W, ROAD } from './geometry.js';
import { drawOverworldIso } from './overworld.js';
import { drawMineSurface, drawMineGridVol } from './mineview.js';
import { drawFx } from './fx.js';
import { nextThreat, rivalOf, armyPower } from './military.js';
import { MINE_FP, FACTORY_FP, MERCADO_FP, PESQUISA_FP, CITY_CENTER } from './layout.js';
import { drawScrollPanel as paintScroll, drawResourceIcon as paintIcon, civColor } from './paint.js';

/** @param {number} x @param {number} y @param {number} w @param {number} h */
const drawScrollPanel = (x, y, w, h) => paintScroll(ctx, x, y, w, h);
/** @param {number} x @param {number} y @param {number} size @param {string} id */
const drawResourceIcon = (x, y, size, id) => paintIcon(ctx, x, y, size, id);
// painéis de contrato/projeto no canto do mapa só em telas grandes (no celular há o chip e o painel deslizante)
const wideScreen = () => view.cw > 820 && view.ch > 520;

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

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
  if (t.gas) { title = '☁️ Grisu (gás)'; sub = 'Picareta explode e fere quem estiver perto. Dinamite queima com segurança.'; color = '#b8e080'; }
  else if (t.water) { title = "💧 Lençol d'água"; sub = 'Ao cavar, inunda os túneis próximos por 40s.'; color = '#8ac8f0'; }
  else if (t.flood > 0) { title = 'Túnel inundado'; sub = `Escoa em ${Math.ceil(t.flood)}s — mineradores perto param`; color = '#8ac8f0'; }
  else   if (t.type === 'shaft') { title = 'Poço do Elevador'; sub = 'Trilhos do carrinho — não cavável'; }
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
  // desenhado no HUD (tamanho fixo), preso à posição do cursor na tela
  const sp = worldToScreen('mine', state.mouseX, state.mouseY);
  const hs = hudSize();
  const mx = sp.x / view.hudScale, my = sp.y / view.hudScale;
  let tx = mx + 14;
  let ty = my + 14;
  if (tx + ttW > hs.w - 4) tx = Math.max(4, mx - ttW - 8);
  if (ty + ttH > hs.h - 4) ty = my - ttH - 6;
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
  const hw = hudSize().w;
  const cx = hw / 2;
  const baseY = view.hudTopInset;
  const bw = Math.min(360, hw - 16), bh = 36;
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

function drawOverworldMinimap() {
  const cc = civColor();
  /** @type {{x:number,y:number,w:number,h:number,color:string}[]} */
  const markers = [];
  MINE_FP.forEach((f, i) => {
    const m = state.mines[i];
    if (m) markers.push({ x: f.x + 25, y: f.y + 20, w: f.w - 50, h: f.d - 40, color: m.exhausted ? '#777' : cc });
  });
  for (let i = 0; i < state.factories.length; i++) {
    const f = FACTORY_FP[i];
    markers.push({ x: f.x + 10, y: f.y + 10, w: f.w - 20, h: f.d - 20, color: cc });
  }
  markers.push({ x: CITY_CENTER.x - 120, y: CITY_CENTER.y - 120, w: 240, h: 260, color: cc });
  for (const f of [MERCADO_FP, PESQUISA_FP]) {
    markers.push({ x: f.x + 10, y: f.y + 10, w: f.w - 20, h: f.d - 20, color: '#e8c060' });
  }
  const wx = ROAD.x1 + (ROAD.x2 - ROAD.x1) * state.wagon.pos;
  markers.push({ x: wx - 14, y: ROAD.y - 14, w: 28, h: 28, color: '#ffffff' });
  const hs = hudSize();
  drawMinimap(ctx, markers, minimapLayout(hs.w, hs.h), visibleWorldRect('overworld'));
}

// ---------- Tutorial inicial (auto-avança baseado em ações) ----------
const IS_TOUCH = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
const TUTORIAL_STEPS = [
  { scene: 'overworld', msg: IS_TOUCH
    ? '👋 Toque numa ENTRADA DE MINA (os morros com placa ⛏) para começar a cavar. Arraste para mover o mapa e use dois dedos para zoom.'
    : '👋 Clique numa ENTRADA DE MINA (os morros com placa ⛏) para começar a cavar. Arraste para mover e use a roda para zoom.' },
  { scene: 'mine', msg: IS_TOUCH
    ? '⛏ Escolha 👤 Minerador na barra de ferramentas e toque num veio descoberto (Fe ou C).'
    : '⛏ Selecione a ferramenta MINERADOR (👤 ou tecla 4) e clique num veio descoberto (Fe ou C).' },
  { scene: 'mine', msg: '✅ Boa! Minério já flui para os silos. Volte ao mapa para acompanhar contratos e fábricas.' },
];

/** Quebra o texto em linhas que cabem em maxW (com a fonte atual do ctx). @param {string} text @param {number} maxW */
function wrapLines(text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawTutorial() {
  if (!state.tutorial || state.tutorial.dismissed) return;
  const step = state.tutorial.step ?? 0;
  const t = TUTORIAL_STEPS[step];
  if (!t || t.scene !== state.scene) return;
  const hw = hudSize().w;
  const w = Math.min(600, hw - 16);
  ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
  const lines = wrapLines(t.msg, w - 24);
  const lineH = 18;
  const h = 18 + lines.length * lineH + (step === 2 ? 12 : 0);
  const tx = (hw - w) / 2;
  // na mina em tela compacta o topo é onde estão os veios: o tutorial desce para cima da barra de ferramentas
  const ty = view.hudBottomInset > 0
    ? hudSize().h - view.hudBottomInset - h
    : view.hudTopInset + (state.activeEvent ? 44 : 8);
  drawScrollPanel(tx, ty, w, h);
  ctx.fillStyle = '#3a1f0a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((ln, i) => ctx.fillText(ln, tx + w / 2, ty + 9 + lineH / 2 + i * lineH));
  if (step === 2) {
    const left = Math.max(0, state.tutorial.autoDismissIn ?? 0);
    ctx.fillStyle = '#5a3416';
    ctx.font = '10px "Segoe UI"';
    ctx.fillText(`Fecha sozinho em ${Math.ceil(left)}s`, tx + w / 2, ty + h - 9);
  }
}

// ---------- Banner do projeto ativo (overworld) ----------
function drawActiveProjectPanel() {
  if (!state.projects.active) return;
  const def = getProjectDef(state.projects.active.id);
  if (!def) return;
  const prog = state.projects.active.progress;
  const w = 280;
  const reqs = Object.entries(def.requirements);
  const lineH = 18;
  const h = 34 + reqs.length * lineH + 8;
  const x = 10;
  const y = hudSize().h - h - 10 - (state.contract ? 112 : 0);
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
  const w = 300;
  const h = 100;
  const x = 10;
  const y = hudSize().h - h - 10;
  drawScrollPanel(x, y, w, h);
  // título
  ctx.fillStyle = '#3a1f0a';
  ctx.font = 'bold 11px "Segoe UI"';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`📜 PEDIDO DE ${k.city.toUpperCase()}`, x + 8, y + 6);
  // ícone do produto + nome + quantidade
  drawResourceIcon(x + 8, y + 28, 28, k.product);
  ctx.textAlign = 'left';
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

/** Anéis + estilhaços da dinamite. @param {any} mine */
function drawTntFx(mine) {
  const { cell, x: gx, y: gy } = MINE;
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
}

function drawMineScene() {
  const mine = activeMine();
  drawMineSurface(ctx, mine);
  drawMineGridVol(ctx, mine);
  if (mine) drawTntFx(mine);
  drawFx(ctx);
  drawElevator();
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

// ---------- Ataque rival chegando ----------
function drawThreatBanner() {
  const th = nextThreat();
  if (!th) return;
  const r = rivalOf(th.rival);
  const hw = hudSize().w;
  const bw = Math.min(380, hw - 16), bh = 30;
  const x = (hw - bw) / 2;
  const y = view.hudTopInset + (state.activeEvent ? 40 : 0);
  const strong = armyPower() >= th.power;
  ctx.fillStyle = strong ? 'rgba(40,70,40,0.92)' : 'rgba(130,30,20,0.94)';
  ctx.fillRect(x, y, bw, bh);
  ctx.fillStyle = '#ffd44a';
  ctx.fillRect(x, y + bh - 3, bw * Math.max(0, th.eta / th.total), 3);
  ctx.fillStyle = '#f1e3c2';
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fillTextFit(`⚔️ ${r ? r.emoji + ' ' + r.name + 's' : 'Invasores'} em ${Math.ceil(th.eta)}s · força ${th.power} × sua ${armyPower()}`, hw / 2, y + bh / 2 - 1, bw - 12);
}

// ---------- Entry ----------
export function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#140d07';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  applyWorldTransform(ctx, state.scene);
  if (state.scene === 'mine') {
    drawMineScene();
  } else {
    drawOverworldIso(ctx, visibleWorldRect('overworld'), state.mouseX, state.mouseY);
  }
  applyHudTransform(ctx);
  if (state.scene === 'mine') drawTileTooltip();
  if (state.scene !== 'mine') {
    drawOverworldMinimap();
    if (wideScreen()) {
      drawActiveProjectPanel();
      drawContractPanelOverworld();
    }
  }
  drawEventBanner();
  drawThreatBanner();
  drawTutorial();
  drawAchievementToast();
}

/** Texto centralizado que encolhe a fonte até caber em maxW. */
/** @param {string} text @param {number} x @param {number} y @param {number} maxW */
function fillTextFit(text, x, y, maxW) {
  const m = /(\d+)px/.exec(ctx.font);
  let size = m ? +m[1] : 12;
  while (size > 8 && ctx.measureText(text).width > maxW) {
    size -= 1;
    ctx.font = ctx.font.replace(/\d+px/, `${size}px`);
  }
  ctx.fillText(text, x, y);
}

// Toast dourado quando conquista desbloqueia
function drawAchievementToast() {
  if (!state.activeAchievement) return;
  const a = ACH_BY_ID[state.activeAchievement.id];
  if (!a) return;
  const hw = hudSize().w;
  const w = Math.min(440, hw - 16), h = 72;
  const x = (hw - w) / 2;
  const y = view.hudTopInset + 56;
  // moldura dourada vibrante
  ctx.fillStyle = '#c69042';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  ctx.fillStyle = '#3a1f0a';
  ctx.fillRect(x, y, w, h);
  // header
  ctx.fillStyle = '#ffd44a';
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🏆 CONQUISTA DESBLOQUEADA', hw / 2, y + 14);
  // emoji + nome
  ctx.fillStyle = '#f1e3c2';
  ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`${a.emoji}  ${a.name}`, hw / 2, y + 36);
  // descrição
  ctx.fillStyle = 'rgba(241,227,194,0.85)';
  ctx.font = '11px "Segoe UI", Arial, sans-serif';
  fillTextFit(a.desc, hw / 2, y + 56, w - 16);
  // barrinha de tempo
  const total = 5; // TOAST_DURATION
  const pct = Math.max(0, (state.activeAchievement.timeLeft || 0) / total);
  ctx.fillStyle = '#c69042';
  ctx.fillRect(x, y + h - 2, w * pct, 2);
}
