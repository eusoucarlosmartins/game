// overworld.js — mapa em isométrico 2.5D (estilo AoE II): chão projetado, prédios
// em volume (caixas + telhados), árvores/unidades em pé ordenadas por profundidade,
// placas e painéis sempre legíveis por cima. Também resolve "o que está sob o dedo".
import { state } from './state.js';
import { R, RECIPE_BY_ID, CFG, CIV_BY_ID } from './data.js';
import { fmtMoney } from './util.js';
import { transportTier } from './progression.js';
import { ingredientHave } from './factories.js';
import { ROAD } from './geometry.js';
import {
  proj, unproj, box, gableRoof, pyramidRoof, facePatch, castShadow, selectFootprint, poly,
} from './iso.js';
import {
  MINE_FP, FACTORY_FP, MERCADO_FP, PESQUISA_FP, CITY_SIGN, CIV_FLAG, centerOf,
} from './layout.js';
import {
  drawIsoTerrain, drawAmbientFlat, ambientObjects, drawAmbientSky, treeObjects, drawShroud,
  VILLAGES, BRIDGE, CLIFF_H,
} from './terrain.js';
import { drawScrollPanel, drawResourceIcon, plate, civColor, civAccent, UI_FONT } from './paint.js';

/** @typedef {import('./layout.js').Footprint} Footprint */
/** @typedef {{depth:number, draw:(ctx:CanvasRenderingContext2D)=>void}} SceneObj */
/** @typedef {{kind:'mine'|'mineSlot'|'factory'|'factorySlot'|'mercado'|'pesquisa', idx:number}} Target */
/** @typedef {Target & {fp: Footprint, h: number, rects: {x:number,y:number,w:number,h:number}[]}} Pickable */

const MINE_H = 54;
const FACTORY_H = 120;

// ---------- Seleção / toque ----------
/** @type {Pickable[]} */
let pickables = [];
// Áreas clicáveis de placas/painéis: coletadas durante o desenho e usadas a partir do frame seguinte
/** @type {Map<string, {x:number,y:number,w:number,h:number}[]>} */
let lastRects = new Map();
/** @type {Map<string, {x:number,y:number,w:number,h:number}[]>} */
let frameRects = new Map();

/** @param {{x:number,y:number,w:number,h:number}} r @param {number} x @param {number} y */
const inRect = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
/** @param {Footprint} f @param {number} gx @param {number} gy @param {number} pad */
const inFp = (f, gx, gy, pad = 0) => gx >= f.x - pad && gx < f.x + f.w + pad && gy >= f.y - pad && gy < f.y + f.d + pad;

/**
 * O que está no ponto (ix, iy) do espaço iso? Placas/painéis primeiro; depois prédios
 * do mais próximo para o mais distante, testando a coluna vertical acima da pegada.
 * @param {number} ix @param {number} iy
 * @returns {Target | null}
 */
export function pickOverworld(ix, iy) {
  for (const p of pickables) {
    if (p.rects.some((r) => inRect(r, ix, iy))) return { kind: p.kind, idx: p.idx };
  }
  const byDepth = [...pickables].sort((a, b) => (b.fp.x + b.fp.y) - (a.fp.x + a.fp.y));
  for (const p of byDepth) {
    for (let z = 0; z <= p.h; z += 4) {
      const g = unproj(ix, iy + z);
      if (inFp(p.fp, g.x, g.y, z === 0 ? 6 : 0)) return { kind: p.kind, idx: p.idx };
    }
  }
  return null;
}

function rebuildPickables() {
  pickables = [];
  frameRects = new Map();
  MINE_FP.forEach((fp, i) => pickables.push({ kind: state.mines[i] ? 'mine' : 'mineSlot', idx: i, fp, h: MINE_H, rects: [] }));
  FACTORY_FP.forEach((fp, i) => pickables.push({
    kind: i < state.factories.length ? 'factory' : 'factorySlot', idx: i, fp, h: i < state.factories.length ? FACTORY_H : 10, rects: [],
  }));
  pickables.push({ kind: 'mercado', idx: 0, fp: MERCADO_FP, h: 44, rects: [] });
  pickables.push({ kind: 'pesquisa', idx: 0, fp: PESQUISA_FP, h: 80, rects: [] });
  for (const p of pickables) p.rects = lastRects.get(`${p.kind}:${p.idx}`) || [];
}

/** @param {Target|null} a @param {string} kind @param {number} idx */
const isTarget = (a, kind, idx) => !!a && a.kind === kind && a.idx === idx;

/** @param {string} kind @param {number} idx @param {{x:number,y:number,w:number,h:number}} r */
function addRect(kind, idx, r) {
  const key = `${kind}:${idx}`;
  const list = frameRects.get(key) || [];
  list.push(r);
  frameRects.set(key, list);
}

// ---------- Peças ----------
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y */
function smoke(ctx, x, y) {
  const t = performance.now() / 1000;
  for (let k = 0; k < 4; k++) {
    const ph = (t * 0.45 + k / 4) % 1;
    ctx.fillStyle = `rgba(235,232,225,${0.55 * (1 - ph)})`;
    ctx.beginPath();
    ctx.arc(x + Math.sin(t + k) * 3 + ph * 10, y - ph * 40, 4 + ph * 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} h @param {number} [w] */
function flag(ctx, x, y, h, w = 18) {
  const t = performance.now() / 1000;
  ctx.fillStyle = '#3a2614';
  ctx.fillRect(x - 1, y - h, 2, h);
  ctx.beginPath();
  ctx.moveTo(x + 1, y - h);
  for (let i = 0; i <= 4; i++) ctx.lineTo(x + 1 + (i * w) / 4, y - h + Math.sin(t * 6 - i) * 1.4 + i * 0.6);
  for (let i = 4; i >= 0; i--) ctx.lineTo(x + 1 + (i * w) / 4, y - h + w * 0.55 + Math.sin(t * 6 - i) * 1.4 - i * 0.6);
  ctx.closePath();
  ctx.fillStyle = civColor();
  ctx.fill();
  ctx.strokeStyle = civAccent();
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Casa colonial pequena. @param {CanvasRenderingContext2D} ctx @param {Footprint} f @param {number} h @param {string} wall @param {string} roof @param {'x'|'y'} axis */
function house(ctx, f, h, wall, roof, axis) {
  box(ctx, f.x, f.y, f.w, f.d, h, wall);
  facePatch(ctx, f, 'L', 0.5, 0, Math.min(8, f.w * 0.2), h * 0.55, '#4a2a14');
  facePatch(ctx, f, 'L', 0.2, h * 0.45, 5, h * 0.3, '#9cc0d0');
  facePatch(ctx, f, 'L', 0.8, h * 0.45, 5, h * 0.3, '#9cc0d0');
  facePatch(ctx, f, 'R', 0.5, h * 0.45, 5, h * 0.3, '#86a8b8');
  gableRoof(ctx, f.x, f.y, f.w, f.d, h, Math.max(10, Math.min(f.w, f.d) * 0.42), roof, axis, wall);
}

// ---------- Minas ----------
/** @param {CanvasRenderingContext2D} ctx @param {Footprint} fp @param {any} mine */
function drawMine(ctx, fp, mine) {
  const c = centerOf(fp);
  const base = proj(c.x, c.y);
  const rx = (fp.w + fp.d) / 2 * 0.72 * 0.62, ry = rx * 0.5, hh = MINE_H;
  // morro
  ctx.beginPath();
  ctx.moveTo(base.x - rx, base.y);
  ctx.bezierCurveTo(base.x - rx * 0.9, base.y - hh * 0.9, base.x - rx * 0.3, base.y - hh * 1.15, base.x + rx * 0.1, base.y - hh);
  ctx.bezierCurveTo(base.x + rx * 0.6, base.y - hh * 0.9, base.x + rx * 0.95, base.y - hh * 0.4, base.x + rx, base.y);
  ctx.ellipse(base.x, base.y, rx, ry, 0, 0, Math.PI, false);
  ctx.closePath();
  const g = ctx.createLinearGradient(base.x - rx, base.y - hh, base.x + rx, base.y);
  g.addColorStop(0, '#a88660');
  g.addColorStop(0.55, '#8a6a46');
  g.addColorStop(1, '#5e4630');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,18,8,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // tufo de grama no topo + pedras
  ctx.fillStyle = '#6f8f3a';
  ctx.beginPath();
  ctx.ellipse(base.x - rx * 0.15, base.y - hh * 0.98, rx * 0.42, hh * 0.16, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(40,26,14,0.35)';
  for (let i = 0; i < 10; i++) {
    const a = (i * 2.39) % (Math.PI * 2);
    ctx.fillRect(base.x + Math.cos(a) * rx * 0.6, base.y - hh * 0.45 + Math.sin(a) * hh * 0.3, 3, 2);
  }
  // boca da mina (na face que olha para o jogador) com escoras de madeira
  const m = proj(c.x - 4, fp.y + fp.d - 18);
  const mw = 13, mh = 24;
  ctx.fillStyle = '#120a04';
  ctx.beginPath();
  ctx.moveTo(m.x - mw, m.y);
  ctx.lineTo(m.x - mw, m.y - mh * 0.6);
  ctx.quadraticCurveTo(m.x, m.y - mh * 1.2, m.x + mw, m.y - mh * 0.6);
  ctx.lineTo(m.x + mw, m.y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#6a4220';
  ctx.fillRect(m.x - mw - 3, m.y - mh * 0.7, 4, mh * 0.7);
  ctx.fillRect(m.x + mw - 1, m.y - mh * 0.7, 4, mh * 0.7);
  ctx.fillRect(m.x - mw - 4, m.y - mh * 0.78, mw * 2 + 8, 4);
  // trilhos saindo
  ctx.strokeStyle = '#4a3a2a';
  ctx.lineWidth = 1.5;
  const r1 = proj(c.x - 8, fp.y + fp.d + 10), r2 = proj(c.x + 4, fp.y + fp.d + 10);
  ctx.beginPath();
  ctx.moveTo(m.x - 5, m.y); ctx.lineTo(r1.x, r1.y);
  ctx.moveTo(m.x + 5, m.y); ctx.lineTo(r2.x, r2.y);
  ctx.stroke();
  // carrinho de minério
  const cartG = { x: c.x + 2, y: fp.y + fp.d + 2 };
  box(ctx, cartG.x - 6, cartG.y - 4, 12, 8, 7, '#6a4a2a', 2);
  if (mine && !mine.exhausted) {
    const tp = proj(cartG.x, cartG.y, 9);
    ctx.fillStyle = '#2a2420';
    ctx.beginPath(); ctx.ellipse(tp.x, tp.y, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  }
  // ouro/pedra ao pé do morro
  if (mine && !mine.exhausted) orePile(ctx, proj(fp.x + fp.w - 8, fp.y + fp.d - 22));
  if (mine && mine.exhausted) {
    ctx.fillStyle = 'rgba(30,30,30,0.45)';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y - hh * 0.45, rx * 1.05, hh * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {{x:number,y:number}} p */
function orePile(ctx, p) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(p.x + 2, p.y + 2, 13, 4, 0, 0, Math.PI * 2); ctx.fill();
  for (const [dx, dy, r, c] of /** @type {[number,number,number,string][]} */ ([[-7, 0, 5, '#8a8478'], [6, 1, 5, '#7d776c'], [-2, -3, 5.5, '#d4a520'], [4, -6, 4, '#e8c040'], [-5, -6, 3.5, '#f0d060']])) {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(p.x + dx, p.y + dy, r, r * 0.72, 0, 0, Math.PI * 2); ctx.fill();
  }
  const glint = (Math.sin(performance.now() / 400) + 1) / 2;
  ctx.fillStyle = `rgba(255,255,220,${0.4 + 0.6 * glint})`;
  ctx.fillRect(p.x + 2, p.y - 8, 2, 2);
}

// ---------- Fábricas ----------
/** @param {Footprint} fp */
const hallOf = (fp) => ({ x: fp.x + 6, y: fp.y + 10, w: fp.w - 12, d: fp.d - 20 });

/** @param {CanvasRenderingContext2D} ctx @param {Footprint} fp @param {any} f */
function drawFactory(ctx, fp, f) {
  const b = hallOf(fp);
  const hh = 46;
  const brewing = f.brewing > 0;
  // chaminé atrás
  const ch = { x: b.x + b.w - 16, y: b.y + 2, w: 11, d: 11 };
  box(ctx, ch.x, ch.y, ch.w, ch.d, 96, '#6e3a22');
  box(ctx, ch.x - 1, ch.y - 1, ch.w + 2, ch.d + 2, 5, '#3a2014', 96);
  box(ctx, b.x, b.y, b.w, b.d, hh, '#a24e2c');
  // faixas de tijolo
  ctx.strokeStyle = 'rgba(60,20,8,0.28)';
  ctx.lineWidth = 1;
  for (let z = 8; z < hh; z += 8) {
    const a = proj(b.x, b.y + b.d, z), c = proj(b.x + b.w, b.y + b.d, z), e = proj(b.x + b.w, b.y, z);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.lineTo(e.x, e.y); ctx.stroke();
  }
  const win = brewing ? '#ffd27a' : '#9cc0d0';
  for (const u of [0.14, 0.32, 0.68, 0.86]) facePatch(ctx, b, 'L', u, 22, 7, 13, win);
  for (const u of [0.25, 0.5, 0.75]) facePatch(ctx, b, 'R', u, 22, 7, 13, brewing ? '#e8b860' : '#7898a8');
  facePatch(ctx, b, 'L', 0.5, 0, 16, 20, '#3a2010');
  gableRoof(ctx, b.x, b.y, b.w, b.d, hh, 22, '#4e4a48', 'x', '#a24e2c');
  // a chaminé passa por cima do telhado
  box(ctx, ch.x, ch.y, ch.w, ch.d, 30, '#6e3a22', 66);
  box(ctx, ch.x - 1, ch.y - 1, ch.w + 2, ch.d + 2, 5, '#3a2014', 96);
  if (brewing) { const top = proj(ch.x + ch.w / 2, ch.y + ch.d / 2, 101); smoke(ctx, top.x, top.y); }
  const fl = proj(b.x + 4, b.y + b.d, hh + 8);
  flag(ctx, fl.x, fl.y, 22);
}

/** Canteiro de obra. @param {CanvasRenderingContext2D} ctx @param {Footprint} fp */
function drawFoundation(ctx, fp) {
  const b = hallOf(fp);
  poly(ctx, [[b.x, b.y, 0], [b.x + b.w, b.y, 0], [b.x + b.w, b.y + b.d, 0], [b.x, b.y + b.d, 0]]);
  ctx.fillStyle = 'rgba(70,46,22,0.45)';
  ctx.fill();
  ctx.setLineDash([5, 3]);
  ctx.strokeStyle = '#efe2bf';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.setLineDash([]);
  for (const [gx, gy] of [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.d], [b.x, b.y + b.d]]) {
    const p = proj(gx, gy);
    ctx.fillStyle = '#5a3416';
    ctx.fillRect(p.x - 1.5, p.y - 10, 3, 11);
  }
  // pilha de tábuas
  box(ctx, b.x + b.w * 0.55, b.y + b.d * 0.35, 22, 10, 6, '#b88a52');
}

/** @param {CanvasRenderingContext2D} ctx @param {Footprint} fp @param {any} factory @param {number} i */
function drawRecipePanel(ctx, fp, factory, i) {
  const recipe = RECIPE_BY_ID[factory.recipeId];
  if (!recipe) return;
  const top = proj(fp.x + fp.w / 2, fp.y + fp.d / 2, FACTORY_H + 6);
  const pw = 136, ph = 40;
  const px = Math.round(top.x - pw / 2), py = Math.round(top.y - ph);
  drawScrollPanel(ctx, px, py, pw, ph);
  const [inputId, need] = Object.entries(recipe.in)[0];
  const have = ingredientHave(inputId);
  const haveStr = R[inputId].free ? '∞' : String(Math.floor(have));
  const icon = 20;
  drawResourceIcon(ctx, px + 4, py + 4, icon, inputId);
  ctx.font = `bold 12px ${UI_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = have >= need ? '#1a0e06' : '#a82e1c';
  ctx.fillText(`${haveStr}/${need}`, px + 28, py + 14);
  ctx.fillStyle = '#8b5e1f';
  ctx.textAlign = 'center';
  ctx.fillText('→', px + pw / 2 + 4, py + 14);
  drawResourceIcon(ctx, px + pw - 4 - icon, py + 4, icon, factory.recipeId);
  ctx.fillStyle = '#1a0e06';
  ctx.textAlign = 'right';
  ctx.fillText(`${state.products[factory.recipeId] || 0}/${CFG.factoryStockMax}`, px + pw - 28, py + 14);
  if (factory.brewing > 0) {
    const pct = 1 - factory.brewing / recipe.time;
    ctx.fillStyle = '#5a3416';
    ctx.fillRect(px + 4, py + ph - 9, pw - 8, 4);
    ctx.fillStyle = '#c69042';
    ctx.fillRect(px + 4, py + ph - 9, (pw - 8) * pct, 4);
  }
  addRect('factory', i, { x: px, y: py, w: pw, h: ph });
}

// ---------- Mercado e Pesquisa ----------
/** @param {CanvasRenderingContext2D} ctx */
function drawMercado(ctx) {
  const f = MERCADO_FP;
  const b = { x: f.x + 8, y: f.y + 8, w: f.w - 16, d: f.d - 16 };
  box(ctx, b.x, b.y, b.w, b.d, 16, '#8a5a30');
  // postes
  for (const [gx, gy] of [[b.x, b.y + b.d], [b.x + b.w, b.y + b.d], [b.x + b.w, b.y]]) {
    const a = proj(gx, gy, 0), t = proj(gx, gy, 34);
    ctx.strokeStyle = '#4a2a14'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(t.x, t.y); ctx.stroke();
  }
  // toldo listrado inclinado
  const n = 6, X0 = b.x - 4, X1 = b.x + b.w + 4;
  for (let i = 0; i < n; i++) {
    const xa = X0 + ((X1 - X0) * i) / n, xb = X0 + ((X1 - X0) * (i + 1)) / n;
    poly(ctx, [[xa, b.y - 4, 42], [xb, b.y - 4, 42], [xb, b.y + b.d + 6, 30], [xa, b.y + b.d + 6, 30]]);
    ctx.fillStyle = i % 2 ? '#f0d070' : '#b8321e';
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,20,10,0.4)'; ctx.lineWidth = 1; ctx.stroke();
  }
  poly(ctx, [[X1, b.y - 4, 42], [X1, b.y + b.d + 6, 30], [X1, b.y + b.d + 6, 26], [X1, b.y - 4, 38]]);
  ctx.fillStyle = '#8a2414'; ctx.fill();
  // mercadorias
  box(ctx, b.x + 4, b.y + b.d + 6, 10, 8, 8, '#c08a4a');
  box(ctx, b.x + 18, b.y + b.d + 8, 9, 7, 7, '#a87038');
  const barrel = proj(b.x + b.w - 6, b.y + b.d + 10);
  ctx.fillStyle = '#7a4a22';
  ctx.beginPath(); ctx.ellipse(barrel.x, barrel.y - 6, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3a2010'; ctx.stroke();
  const coin = proj(b.x + b.w / 2, b.y + b.d / 2, 52);
  ctx.fillStyle = '#ffd34a';
  ctx.beginPath(); ctx.arc(coin.x, coin.y + Math.sin(performance.now() / 500) * 2, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#7a5a10'; ctx.lineWidth = 1; ctx.stroke();
}

/** @param {CanvasRenderingContext2D} ctx */
function drawPesquisa(ctx) {
  const f = PESQUISA_FP;
  const b = { x: f.x + 6, y: f.y + 6, w: f.w - 12, d: f.d - 12 };
  box(ctx, b.x, b.y, b.w, b.d, 36, '#efe4c8');
  for (const u of [0.2, 0.4, 0.6, 0.8]) facePatch(ctx, b, 'L', u, 14, 6, 14, '#5a7fa8');
  for (const u of [0.3, 0.7]) facePatch(ctx, b, 'R', u, 14, 6, 14, '#4a6a90');
  facePatch(ctx, b, 'L', 0.5, 0, 12, 18, '#5a3416');
  pyramidRoof(ctx, b.x, b.y, b.w, b.d, 36, 20, '#35588a');
  // cúpula/observatório
  const cx = b.x + b.w / 2 - 8, cy = b.y + b.d / 2 - 8;
  box(ctx, cx, cy, 16, 16, 14, '#efe4c8', 46);
  const dome = proj(cx + 8, cy + 8, 60);
  ctx.fillStyle = '#c69042';
  ctx.beginPath(); ctx.ellipse(dome.x, dome.y, 11, 9, 0, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = 'rgba(40,20,10,0.5)'; ctx.stroke();
  ctx.fillStyle = '#ffd44a';
  ctx.font = `bold 11px ${UI_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('★', dome.x, dome.y - 12);
}

// ---------- Cidade ----------
const CITY_STYLES = /** @type {Record<string, 'port'|'industrial'>} */ ({
  'Florianópolis': 'port', 'Itajaí': 'port', 'Navegantes': 'port',
  'Balneário Camboriú': 'port', 'Camboriú': 'port', 'Tubarão': 'port',
  'Joinville': 'industrial', 'Blumenau': 'industrial', 'Brusque': 'industrial',
  'Jaraguá do Sul': 'industrial', 'São Bento do Sul': 'industrial',
  'Rio do Sul': 'industrial', 'São José': 'industrial', 'Palhoça': 'industrial',
  'Criciúma': 'industrial',
});

/** @returns {SceneObj[]} */
function cityObjects() {
  const style = CITY_STYLES[state.currentCity] || 'colonial';
  /** @type {SceneObj[]} */
  const out = [];
  /** @param {Footprint} f @param {(ctx:CanvasRenderingContext2D)=>void} fn */
  const add = (f, fn) => out.push({ depth: f.x + f.w / 2 + f.y + f.d / 2, draw: fn });
  const palette = style === 'port'
    ? [['#a8c8d8', '#5a3416'], ['#f1e3c2', '#2f5f8a'], ['#d8e8ee', '#8a4a2a'], ['#f4d9a0', '#2f5f8a'], ['#c8dde6', '#a83a22']]
    : style === 'industrial'
      ? [['#9a5a3a', '#3e3a38'], ['#b07a50', '#4a4440'], ['#8a6a5a', '#3e3a38'], ['#a8806a', '#5a3a2a'], ['#c09a7a', '#3e3a38']]
      : [['#e8c87a', '#a82e1c'], ['#b8c8a8', '#8a4a2a'], ['#e0b0a0', '#7a3a1a'], ['#f1e3c2', '#a83a22'], ['#d8c8a0', '#6a4a2a']];
  const houses = [
    { x: 905, y: 290, w: 52, d: 40 }, { x: 1150, y: 285, w: 52, d: 42 },
    { x: 905, y: 470, w: 56, d: 44 }, { x: 1150, y: 465, w: 56, d: 44 }, { x: 1035, y: 535, w: 62, d: 40 },
  ];
  houses.forEach((f, i) => add(f, (ctx) => house(ctx, f, 26 + (i % 2) * 6, palette[i][0], palette[i][1], i % 2 ? 'y' : 'x')));
  if (style === 'port') {
    const f = { x: 1060, y: 365, w: 34, d: 34 };
    add(f, (ctx) => lighthouse(ctx, f));
    const g = { x: 975, y: 380, w: 60, d: 50 };
    add(g, (ctx) => house(ctx, g, 34, '#f1e3c2', '#2f5f8a', 'y'));
  } else if (style === 'industrial') {
    const f = { x: 985, y: 350, w: 90, d: 70 };
    add(f, (ctx) => {
      box(ctx, f.x + 70, f.y + 6, 12, 12, 110, '#5e3020');
      box(ctx, f.x, f.y, f.w, f.d, 60, '#8a3a1e');
      for (const u of [0.15, 0.35, 0.55, 0.75, 0.9]) for (const z of [12, 34]) facePatch(ctx, f, 'L', u, z, 8, 12, '#ffd27a');
      for (const u of [0.25, 0.5, 0.75]) for (const z of [12, 34]) facePatch(ctx, f, 'R', u, z, 8, 12, '#d8b060');
      box(ctx, f.x + 70, f.y + 6, 12, 12, 50, '#5e3020', 60);
      const top = proj(f.x + 76, f.y + 12, 110);
      smoke(ctx, top.x, top.y);
    });
    const o = { x: 1100, y: 380, w: 40, d: 40 };
    add(o, (ctx) => {
      box(ctx, o.x, o.y, o.w, o.d, 96, '#6a6a6a');
      for (let z = 10; z < 90; z += 14) for (const u of [0.25, 0.5, 0.75]) {
        facePatch(ctx, o, 'L', u, z, 6, 7, '#ffd44a');
        facePatch(ctx, o, 'R', u, z, 6, 7, '#d8b040');
      }
    });
  } else {
    const nave = { x: 1012, y: 350, w: 70, d: 92 };
    add(nave, (ctx) => church(ctx, nave));
  }
  return out;
}

/** @param {CanvasRenderingContext2D} ctx @param {Footprint} n */
function church(ctx, n) {
  box(ctx, n.x, n.y, n.w, n.d, 44, '#f3ead2');
  for (const u of [0.25, 0.5, 0.75]) facePatch(ctx, n, 'R', u, 18, 7, 16, '#8aa8c8');
  gableRoof(ctx, n.x, n.y, n.w, n.d, 44, 28, '#b0402a', 'y', '#f3ead2');
  // torre na fachada (frente-esquerda)
  const t = { x: n.x + n.w / 2 - 15, y: n.y + n.d - 8, w: 30, d: 26 };
  box(ctx, t.x, t.y, t.w, t.d, 100, '#f3ead2');
  facePatch(ctx, t, 'L', 0.5, 0, 12, 24, '#5a3416');
  facePatch(ctx, t, 'L', 0.5, 72, 10, 14, '#2a1a10');
  facePatch(ctx, t, 'R', 0.5, 72, 9, 14, '#2a1a10');
  facePatch(ctx, t, 'L', 0.5, 40, 8, 12, '#8aa8c8');
  pyramidRoof(ctx, t.x, t.y, t.w, t.d, 100, 34, '#b0402a');
  const top = proj(t.x + t.w / 2, t.y + t.d / 2, 134);
  ctx.fillStyle = '#3a2410';
  ctx.fillRect(top.x - 1, top.y - 14, 2.5, 14);
  ctx.fillRect(top.x - 5, top.y - 10, 10, 2.5);
}

/** @param {CanvasRenderingContext2D} ctx @param {Footprint} f */
function lighthouse(ctx, f) {
  for (let i = 0; i < 6; i++) box(ctx, f.x + i, f.y + i, f.w - 2 * i, f.d - 2 * i, 18, i % 2 ? '#b8321e' : '#f3ead2', i * 18);
  const z = 108;
  box(ctx, f.x + 6, f.y + 6, f.w - 12, f.d - 12, 14, '#ffe680', z);
  pyramidRoof(ctx, f.x + 4, f.y + 4, f.w - 8, f.d - 8, z + 14, 14, '#3a2a20');
  const lamp = proj(f.x + f.w / 2, f.y + f.d / 2, z + 7);
  const beam = (Math.sin(performance.now() / 600) + 1) / 2;
  ctx.fillStyle = `rgba(255,230,128,${0.12 + 0.22 * beam})`;
  ctx.beginPath();
  ctx.moveTo(lamp.x, lamp.y);
  ctx.lineTo(lamp.x - 90, lamp.y - 40);
  ctx.lineTo(lamp.x - 90, lamp.y + 10);
  ctx.closePath();
  ctx.fill();
}

// ---------- Vilarejos, bandeira, carroça, estrada ----------
/** @returns {SceneObj[]} */
function villageObjects() {
  /** @type {SceneObj[]} */
  const out = [];
  for (const v of VILLAGES) {
    const a = { x: v.x - 26, y: v.y - 12, w: 20, d: 16 };
    const b = { x: v.x + 4, y: v.y - 16, w: 18, d: 15 };
    out.push({ depth: a.x + a.y + 18, draw: (ctx) => house(ctx, a, 14, '#e8c87a', '#a82e1c', 'x') });
    out.push({ depth: b.x + b.y + 16, draw: (ctx) => house(ctx, b, 17, '#b8c8a8', '#8a4a2a', 'y') });
  }
  return out;
}

/** @param {CanvasRenderingContext2D} ctx */
function drawCivFlagPole(ctx) {
  if (!state.civilization) return;
  const p = proj(CIV_FLAG.x, CIV_FLAG.y, CLIFF_H);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(p.x + 4, p.y + 1, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
  flag(ctx, p.x, p.y, 56, 34);
}

/** @param {CanvasRenderingContext2D} ctx */
function drawWagon(ctx) {
  const w = state.wagon;
  const gx = ROAD.x1 + (ROAD.x2 - ROAD.x1) * w.pos;
  const gy = ROAD.y;
  const dir = w.dir >= 0 ? 1 : -1;
  const onBridge = gx > BRIDGE.x1 && gx < BRIDGE.x2 ? 3 : 0;
  const t = performance.now() / 140;
  // cavalo à frente
  const hx = gx + dir * 20;
  const legs = proj(hx, gy, onBridge);
  ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 1.5;
  for (const k of [-4, -1, 2, 5]) {
    const sw = Math.sin(t + k) * 1.5;
    ctx.beginPath(); ctx.moveTo(legs.x + k, legs.y - 8); ctx.lineTo(legs.x + k + sw, legs.y); ctx.stroke();
  }
  box(ctx, hx - 8, gy - 3, 16, 6, 7, '#7a4a22', 7 + onBridge);
  box(ctx, hx + dir * 8 - 3, gy - 2, 6, 4, 6, '#6a3e1c', 12 + onBridge);
  // carroça
  box(ctx, gx - 12, gy - 7, 24, 14, 9, '#8a5a2e', 6 + onBridge);
  if (w.load > 0 && w.product && R[w.product]) box(ctx, gx - 9, gy - 5, 18, 10, 5, R[w.product].color, 15 + onBridge);
  for (const wx of [gx - 7, gx + 7]) {
    const p = proj(wx, gy + 7, 5 + onBridge);
    ctx.fillStyle = '#2a1a0e';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 4, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a6a3a';
    ctx.beginPath(); ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2); ctx.fill();
  }
}

/** Estrada calçada (tier) + ponte. Deitado no chão. @param {CanvasRenderingContext2D} ctx */
function drawRoadAndBridge(ctx) {
  const tier = transportTier();
  const y = ROAD.y;
  if (tier >= 2) {
    for (const [a, b] of [[ROAD.x1 - 30, BRIDGE.x1], [BRIDGE.x2, ROAD.x2 + 30]]) {
      poly(ctx, [[a, y - 8, 0], [b, y - 8, 0], [b, y + 8, 0], [a, y + 8, 0]]);
      ctx.fillStyle = '#7a756a'; ctx.fill();
    }
  }
  const z = 3;
  // sombra na água
  poly(ctx, [[BRIDGE.x1, y + 10, 0], [BRIDGE.x2, y + 10, 0], [BRIDGE.x2, y + 15, 0], [BRIDGE.x1, y + 15, 0]]);
  ctx.fillStyle = 'rgba(0,20,30,0.35)'; ctx.fill();
  poly(ctx, [[BRIDGE.x1, y - 10, z], [BRIDGE.x2, y - 10, z], [BRIDGE.x2, y + 10, z], [BRIDGE.x1, y + 10, z]]);
  ctx.fillStyle = tier >= 2 ? '#9a9386' : '#8a5a2e'; ctx.fill();
  ctx.strokeStyle = tier >= 2 ? 'rgba(50,44,36,0.45)' : 'rgba(40,20,8,0.5)';
  ctx.lineWidth = 1;
  for (let gx = BRIDGE.x1 + 5; gx < BRIDGE.x2; gx += 5) {
    const a = proj(gx, y - 10, z), b = proj(gx, y + 10, z);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  // corrimãos
  ctx.strokeStyle = tier >= 2 ? '#6a6458' : '#4a2a12';
  ctx.lineWidth = 2;
  for (const gy of [y - 10, y + 10]) {
    const a = proj(BRIDGE.x1, gy, z + 8), b = proj(BRIDGE.x2, gy, z + 8);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    for (let gx = BRIDGE.x1; gx <= BRIDGE.x2; gx += 18) {
      const p0 = proj(gx, gy, z), p1 = proj(gx, gy, z + 8);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
  }
  if (tier >= 6) {
    ctx.strokeStyle = '#9a9a9a'; ctx.lineWidth = 1.5;
    for (const gy of [y - 3, y + 3]) {
      const a = proj(ROAD.x1 - 30, gy, 1), b = proj(ROAD.x2 + 30, gy, 1);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
}

// ---------- Cena ----------
/**
 * Desenha o mapa. Chamar com a transformação da câmera (espaço iso) ativa.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x:number,y:number,w:number,h:number}} viewIso
 * @param {number} hoverX @param {number} hoverY ponteiro em coords iso (ou -1)
 */
export function drawOverworldIso(ctx, viewIso, hoverX, hoverY) {
  rebuildPickables();
  // painéis/placas entram no pickables durante o desenho; o hover usa o do frame anterior
  const hover = hoverX >= 0 ? pickOverworld(hoverX, hoverY) : null;

  drawIsoTerrain(ctx);
  drawRoadAndBridge(ctx);
  drawAmbientFlat(ctx);

  // sombras + seleção (no chão, por baixo dos prédios)
  MINE_FP.forEach((fp, i) => { if (state.mines[i]) castShadow(ctx, fp.x + 25, fp.y + 20, fp.w - 50, fp.d - 40, MINE_H * 0.7); });
  FACTORY_FP.forEach((fp, i) => { if (i < state.factories.length) { const b = hallOf(fp); castShadow(ctx, b.x, b.y, b.w, b.d, 60); } });
  castShadow(ctx, MERCADO_FP.x + 8, MERCADO_FP.y + 8, MERCADO_FP.w - 16, MERCADO_FP.d - 16, 30);
  castShadow(ctx, PESQUISA_FP.x + 6, PESQUISA_FP.y + 6, PESQUISA_FP.w - 12, PESQUISA_FP.d - 12, 50);
  FACTORY_FP.forEach((fp, i) => { if (i >= state.factories.length) drawFoundation(ctx, fp); });
  if (hover) {
    const p = pickables.find((q) => q.kind === hover.kind && q.idx === hover.idx);
    if (p && p.kind !== 'mineSlot') selectFootprint(ctx, p.fp.x, p.fp.y, p.fp.w, p.fp.d);
  }

  /** @type {SceneObj[]} */
  const objs = [];
  MINE_FP.forEach((fp, i) => {
    const m = state.mines[i];
    if (m) objs.push({ depth: fp.x + fp.y + fp.w / 2 + fp.d / 2, draw: (c) => drawMine(c, fp, m) });
  });
  FACTORY_FP.forEach((fp, i) => {
    const f = state.factories[i];
    if (f) objs.push({ depth: fp.x + fp.y + fp.w / 2 + fp.d / 2, draw: (c) => drawFactory(c, fp, f) });
  });
  objs.push({ depth: MERCADO_FP.x + MERCADO_FP.y + 60, draw: drawMercado });
  objs.push({ depth: PESQUISA_FP.x + PESQUISA_FP.y + 70, draw: drawPesquisa });
  objs.push({ depth: CIV_FLAG.x + CIV_FLAG.y - 400, draw: drawCivFlagPole });
  objs.push({ depth: ROAD.x1 + (ROAD.x2 - ROAD.x1) * state.wagon.pos + ROAD.y + 12, draw: drawWagon });
  objs.push(...cityObjects(), ...villageObjects(), ...treeObjects(viewIso));
  objs.push(...ambientObjects({
    activeMines: MINE_FP.map((_, i) => !!state.mines[i] && !state.mines[i].exhausted),
    playerColor: civColor(),
  }));
  objs.sort((a, b) => a.depth - b.depth);
  for (const o of objs) o.draw(ctx);

  // névoa sobre os slots de mina não comprados
  MINE_FP.forEach((fp, i) => {
    if (state.mines[i]) return;
    const c = proj(fp.x + fp.w / 2, fp.y + fp.d / 2);
    drawShroud(ctx, { x: c.x - 80, y: c.y - 60, w: 160, h: 110 }, isTarget(hover, 'mineSlot', i));
  });

  drawAmbientSky(ctx);
  drawLabels(ctx, hover);
  lastRects = frameRects;
}

/** Placas e painéis: sempre por cima, texto nítido. @param {CanvasRenderingContext2D} ctx @param {Target|null} hover */
function drawLabels(ctx, hover) {
  for (const v of VILLAGES) {
    const p = proj(v.x, v.y + 14);
    plate(ctx, p.x, p.y, v.name, { bg: 'rgba(241,227,194,0.92)', size: 10, border: 'rgba(42,22,8,0.7)' });
  }
  MINE_FP.forEach((fp, i) => {
    const m = state.mines[i];
    const c = centerOf(fp);
    if (m) {
      const p = proj(c.x + 6, fp.y + fp.d + 16);
      const name = m.name.toUpperCase();
      const r = plate(ctx, p.x, p.y, m.exhausted ? `🚫 ${name} (ESGOTADA)` : `⛏ ${name}`, {
        bg: m.exhausted ? '#9a8a7a' : civAccent(),
      });
      if (isTarget(hover, 'mine', i)) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4); }
      addRect('mine', i, r);
    } else {
      const p = proj(c.x, c.y);
      const hov = isTarget(hover, 'mineSlot', i);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = hov ? '#ffe680' : '#e2b765';
      ctx.font = `bold 28px ${UI_FONT}`;
      ctx.fillText('+', p.x, p.y - 14);
      ctx.font = `bold 12px ${UI_FONT}`;
      ctx.fillText('NOVA MINA', p.x, p.y + 8);
      ctx.font = `italic 10px ${UI_FONT}`;
      ctx.fillStyle = 'rgba(241,227,194,0.85)';
      ctx.fillText('terra inexplorada', p.x, p.y + 22);
      addRect('mineSlot', i, { x: p.x - 60, y: p.y - 36, w: 120, h: 70 });
    }
  });
  FACTORY_FP.forEach((fp, i) => {
    const f = state.factories[i];
    const front = proj(fp.x + fp.w / 2, fp.y + fp.d + 2);
    if (f) {
      const name = R[f.recipeId]?.name || '—';
      const r = plate(ctx, front.x, front.y + 10, name, { bg: civAccent(), size: 11 });
      addRect('factory', i, r);
      drawRecipePanel(ctx, fp, f, i);
    } else {
      const c = proj(fp.x + fp.w / 2, fp.y + fp.d / 2);
      const r = plate(ctx, c.x, c.y - 6, `CONSTRUIR · ${fmtMoney(CFG.factoryCosts[i])}`, {
        bg: isTarget(hover, 'factorySlot', i) ? '#ffe680' : 'rgba(26,14,6,0.85)', fg: isTarget(hover, 'factorySlot', i) ? '#1a0e06' : '#f1e3c2', size: 11,
      });
      addRect('factorySlot', i, r);
    }
  });
  const mc = centerOf(MERCADO_FP), pc = centerOf(PESQUISA_FP);
  const pm = proj(mc.x, MERCADO_FP.y + MERCADO_FP.d + 10);
  addRect('mercado', 0, plate(ctx, pm.x, pm.y, '💰 MERCADO', { bg: isTarget(hover, 'mercado', 0) ? '#ffe680' : '#e2b765' }));
  const pp = proj(pc.x, PESQUISA_FP.y + PESQUISA_FP.d + 10);
  addRect('pesquisa', 0, plate(ctx, pp.x, pp.y, '📚 PESQUISA', { bg: isTarget(hover, 'pesquisa', 0) ? '#ffe680' : '#e2b765' }));
  const cs = proj(CITY_SIGN.x, CITY_SIGN.y);
  plate(ctx, cs.x, cs.y, (state.currentCity || 'Florianópolis').toUpperCase(), { bg: '#c69042', size: 13 });
  const civ = state.civilization ? CIV_BY_ID[state.civilization] : null;
  if (civ) {
    const p = proj(CIV_FLAG.x, CIV_FLAG.y, CLIFF_H);
    plate(ctx, p.x + 10, p.y + 12, `${civ.emoji} ${civ.name.toUpperCase()}`, { size: 10, bg: '#f1e3c2' });
  }
}
