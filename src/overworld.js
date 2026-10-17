// overworld.js — mapa em isométrico 2.5D (estilo AoE II): chão projetado, prédios
// em volume (caixas + telhados), árvores/unidades em pé ordenadas por profundidade,
// placas e painéis sempre legíveis por cima. Também resolve "o que está sob o dedo".
import { state } from './state.js';
import { R, RECIPE_BY_ID, CFG, CIV_BY_ID, ERAS } from './data.js';
import { fmtMoney } from './util.js';
import { transportTier, currentEra } from './progression.js';
import { ingredientHave } from './factories.js';
import { ROAD } from './geometry.js';
import {
  proj, unproj, box, gableRoof, pyramidRoof, facePatch, castShadow, selectFootprint, poly, groundTransform,
} from './iso.js';
import {
  MINE_FP, FACTORY_FP, MERCADO_FP, PESQUISA_FP, CITY_CENTER, CITY_SIGN, CIV_FLAG, centerOf,
} from './layout.js';
import {
  drawIsoTerrain, drawAmbientFlat, ambientObjects, drawAmbientSky, treeObjects, drawShroud,
  VILLAGES, BRIDGE, CLIFF_H, drawVillager, choppableTrees,
} from './terrain.js';
import { SITES, siteState, siteUnlocked } from './sites.js';
import { projectProgress } from './projects.js';
import { ROUTES, ROUTE_BY_ID, carts, pointOn, routeUnlocked } from './trade.js';
import { drawScrollPanel, drawResourceIcon, plate, civColor, civAccent, UI_FONT } from './paint.js';

/** @typedef {import('./layout.js').Footprint} Footprint */
/** @typedef {{depth:number, draw:(ctx:CanvasRenderingContext2D)=>void}} SceneObj */
/** @typedef {{kind:'mine'|'mineSlot'|'factory'|'factorySlot'|'mercado'|'pesquisa'|'site', idx:number, site?: string}} Target */
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
    if (p.rects.some((r) => inRect(r, ix, iy))) return { kind: p.kind, idx: p.idx, site: p.site };
  }
  const byDepth = [...pickables].sort((a, b) => (b.fp.x + b.fp.y) - (a.fp.x + a.fp.y));
  for (const p of byDepth) {
    for (let z = 0; z <= p.h; z += 4) {
      const g = unproj(ix, iy + z);
      if (inFp(p.fp, g.x, g.y, z === 0 ? 6 : 0)) return { kind: p.kind, idx: p.idx, site: p.site };
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
  SITES.forEach((def, i) => {
    if (siteVisible(def)) pickables.push({ kind: 'site', idx: i, site: def.id, fp: def, h: SITE_H[def.id] || 30, rects: [] });
  });
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

// A cidade cresce com os contratos cumpridos: lotes ocupados do centro para fora,
// cada casa no estilo da era em que foi erguida, e marcos novos a cada era.
/** @typedef {{x:number,y:number,w:number,d:number,minEra:number,kind:string}} Landmark */
/** @type {Landmark[]} */
const LANDMARKS = [
  { kind: 'fountain', x: 1028, y: 488, w: 34, d: 34, minEra: 2 },
  { kind: 'windmill', x: 1178, y: 196, w: 34, d: 34, minEra: 3 },
  { kind: 'hall', x: 900, y: 352, w: 54, d: 76, minEra: 4 },
  { kind: 'works', x: 1160, y: 556, w: 60, d: 54, minEra: 5 },
  { kind: 'clock', x: 1112, y: 470, w: 30, d: 30, minEra: 6 },
];

const CITY_LOTS = (() => {
  let seed = 4242;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  /** @type {Footprint[]} */
  const lots = [];
  for (let gy = 196; gy <= 676; gy += 58) {
    for (let gx = 892; gx <= 1222; gx += 64) {
      const w = 38 + rnd() * 14, d = 32 + rnd() * 10;
      const x = gx + (rnd() - 0.5) * 10, y = gy + (rnd() - 0.5) * 10;
      const cx = x + w / 2, cy = y + d / 2;
      if (cx > 965 && cx < 1120 && cy > 335 && cy < 470) continue; // marco central
      if (cx > 990 && cx < 1100 && cy > 470 && cy < 640) continue; // praça + placa
      const hitsLandmark = LANDMARKS.some((l) => cx > l.x - 26 && cx < l.x + l.w + 26 && cy > l.y - 22 && cy < l.y + l.d + 22);
      if (hitsLandmark) continue;
      lots.push({ x, y, w, d });
    }
  }
  const dist = (/** @type {Footprint} */ f) => Math.hypot(f.x + f.w / 2 - CITY_CENTER.x, (f.y + f.d / 2 - CITY_CENTER.y) * 1.15);
  return lots.sort((p, q) => dist(p) - dist(q));
})();

/** Quantas casas existem com c contratos cumpridos. @param {number} c */
const housesFor = (c) => Math.min(CITY_LOTS.length, 4 + Math.floor(c * 0.75));
/** Contratos necessários para o lote i existir. @param {number} i */
const contractsForLot = (i) => (i < 4 ? 0 : Math.ceil((i - 3) / 0.75));
/** Era vigente com c contratos. @param {number} c */
function eraAt(c) {
  let era = 1;
  for (let i = 0; i < ERAS.length - 1; i++) if (ERAS[i].nextAt != null && c >= ERAS[i].nextAt) era = ERAS[i + 1].id;
  return era;
}

/** @param {number} c */
export function cityTitle(c) {
  if (c < 3) return 'ARRAIAL';
  if (c < 8) return 'VILA';
  if (c < 15) return 'CIDADE';
  if (c < 25) return 'CIDADE PRÓSPERA';
  return 'METRÓPOLE';
}

/** Momento (ms) em que cada lote/marco apareceu — anima a construção dos novos. */
/** @type {Map<string, number>} */
const bornAt = new Map();
let cityPrimed = false;

/** @param {string} key */
function riseFactor(key) {
  let t0 = bornAt.get(key);
  if (t0 === undefined) {
    t0 = cityPrimed ? performance.now() : -1e9;
    bornAt.set(key, t0);
  }
  return Math.min(1, (performance.now() - t0) / 1600);
}

/**
 * Desenha fn "crescendo" do chão (escala vertical a partir da base) + andaime e poeira.
 * @param {CanvasRenderingContext2D} ctx @param {Footprint} f @param {number} k @param {(ctx:CanvasRenderingContext2D)=>void} fn
 */
function rising(ctx, f, k, fn) {
  if (k >= 1) { fn(ctx); return; }
  const base = proj(f.x + f.w / 2, f.y + f.d / 2);
  const e = 1 - Math.pow(1 - k, 3);
  ctx.save();
  ctx.translate(base.x, base.y);
  ctx.scale(1, Math.max(0.02, e));
  ctx.translate(-base.x, -base.y);
  fn(ctx);
  ctx.restore();
  ctx.strokeStyle = '#8a6a3a';
  ctx.lineWidth = 1.2;
  for (const [gx, gy] of [[f.x, f.y + f.d], [f.x + f.w, f.y + f.d], [f.x + f.w, f.y]]) {
    const a = proj(gx, gy), t = proj(gx, gy, 46);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(t.x, t.y); ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + k * 3;
    ctx.fillStyle = `rgba(200,180,140,${0.5 * (1 - k)})`;
    ctx.beginPath();
    ctx.ellipse(base.x + Math.cos(a) * (18 + k * 20), base.y + Math.sin(a) * (8 + k * 8), 8 + k * 10, 4 + k * 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** @param {'port'|'industrial'|'colonial'} style @param {number} i */
function lotPalette(style, i) {
  const P = style === 'port'
    ? [['#a8c8d8', '#5a3416'], ['#f1e3c2', '#2f5f8a'], ['#d8e8ee', '#8a4a2a'], ['#f4d9a0', '#2f5f8a'], ['#c8dde6', '#a83a22']]
    : style === 'industrial'
      ? [['#b8865a', '#3e3a38'], ['#c8a07a', '#4a4440'], ['#a8806a', '#3e3a38'], ['#d0b090', '#5a3a2a'], ['#c09a7a', '#3e3a38']]
      : [['#e8c87a', '#a82e1c'], ['#b8c8a8', '#8a4a2a'], ['#e0b0a0', '#7a3a1a'], ['#f1e3c2', '#a83a22'], ['#d8c8a0', '#6a4a2a']];
  return P[i % P.length];
}

/** Prédio de um lote no estilo da era em que foi construído. @param {CanvasRenderingContext2D} ctx @param {Footprint} f @param {number} era @param {string[]} pal @param {number} i */
function lotBuilding(ctx, f, era, pal, i) {
  const axis = i % 2 ? 'y' : 'x';
  if (era <= 2) {
    house(ctx, f, 24 + (i % 3) * 3, pal[0], pal[1], axis);
  } else if (era <= 4) {
    // sobrado: dois andares, sacada
    box(ctx, f.x, f.y, f.w, f.d, 44, pal[0]);
    for (const u of [0.25, 0.5, 0.75]) {
      facePatch(ctx, f, 'L', u, 8, 5, 10, '#9cc0d0');
      facePatch(ctx, f, 'L', u, 28, 5, 10, '#9cc0d0');
    }
    facePatch(ctx, f, 'R', 0.5, 28, 5, 10, '#86a8b8');
    facePatch(ctx, f, 'L', 0.5, 23, f.w * 0.8, 2.5, '#4a2a14');
    gableRoof(ctx, f.x, f.y, f.w, f.d, 44, 16, pal[1], axis, pal[0]);
  } else {
    // prédio de tijolo, platibanda e janelas acesas
    const h = 58 + (i % 3) * 10;
    box(ctx, f.x, f.y, f.w, f.d, h, i % 2 ? '#8a4a2e' : '#9a6a4a');
    for (let z = 8; z < h - 8; z += 14) {
      for (const u of [0.22, 0.5, 0.78]) {
        facePatch(ctx, f, 'L', u, z, 5, 8, (i + z) % 3 ? '#ffd27a' : '#6a8aa0');
        facePatch(ctx, f, 'R', u, z, 5, 8, (i + z) % 4 ? '#e8b860' : '#5a7a90');
      }
    }
    box(ctx, f.x - 1, f.y - 1, f.w + 2, f.d + 2, 4, '#5a3020', h);
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {Landmark} l */
function drawLandmark(ctx, l) {
  const t = performance.now() / 1000;
  if (l.kind === 'fountain') {
    const c = proj(l.x + l.w / 2, l.y + l.d / 2);
    ctx.fillStyle = '#8a8478';
    ctx.beginPath(); ctx.ellipse(c.x, c.y, 24, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a8a294';
    ctx.beginPath(); ctx.ellipse(c.x, c.y - 4, 24, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a8aa8';
    ctx.beginPath(); ctx.ellipse(c.x, c.y - 5, 19, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a8478';
    ctx.fillRect(c.x - 2.5, c.y - 22, 5, 17);
    for (let k = 0; k < 8; k++) {
      const ph = (t * 1.2 + k / 8) % 1;
      const a = (k / 8) * Math.PI * 2;
      ctx.fillStyle = `rgba(220,240,250,${0.8 * (1 - ph)})`;
      ctx.beginPath();
      ctx.arc(c.x + Math.cos(a) * ph * 14, c.y - 22 + ph * ph * 18 - Math.sin(ph * Math.PI) * 6 + Math.sin(a) * ph * 6, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (l.kind === 'windmill') {
    box(ctx, l.x + 6, l.y + 6, l.w - 12, l.d - 12, 52, '#e8dcc0');
    pyramidRoof(ctx, l.x + 4, l.y + 4, l.w - 8, l.d - 8, 52, 18, '#8a4a2a');
    facePatch(ctx, { x: l.x + 6, y: l.y + 6, w: l.w - 12, d: l.d - 12 }, 'L', 0.5, 0, 8, 14, '#5a3416');
    const hub = proj(l.x + l.w / 2, l.y + l.d - 6, 48);
    const ang = t * 0.9;
    ctx.save();
    ctx.translate(hub.x, hub.y);
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI / 2);
      ctx.save();
      ctx.rotate(ang);
      ctx.fillStyle = '#f3ead2';
      ctx.strokeStyle = '#5a3416';
      ctx.lineWidth = 1;
      ctx.fillRect(2, -3, 30, 6);
      ctx.strokeRect(2, -3, 30, 6);
      ctx.restore();
    }
    ctx.fillStyle = '#3a2410';
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (l.kind === 'hall') {
    box(ctx, l.x, l.y, l.w, l.d, 40, '#d8c8a0');
    for (const u of [0.2, 0.4, 0.6, 0.8]) facePatch(ctx, l, 'R', u, 4, 8, 22, '#6a4a2a');
    gableRoof(ctx, l.x, l.y, l.w, l.d, 40, 24, '#2f5f8a', 'y', '#d8c8a0');
  } else if (l.kind === 'works') {
    box(ctx, l.x + 44, l.y + 4, 10, 10, 120, '#5e3020');
    box(ctx, l.x + 8, l.y + 30, 10, 10, 100, '#5e3020');
    box(ctx, l.x, l.y, l.w, l.d, 46, '#7a3a1e');
    for (const u of [0.2, 0.4, 0.6, 0.8]) facePatch(ctx, l, 'L', u, 12, 7, 14, '#ffd27a');
    gableRoof(ctx, l.x, l.y, l.w, l.d, 46, 14, '#3e3a38', 'x', '#7a3a1e');
    box(ctx, l.x + 44, l.y + 4, 10, 10, 60, '#5e3020', 60);
    box(ctx, l.x + 8, l.y + 30, 10, 10, 40, '#5e3020', 60);
    const a = proj(l.x + 49, l.y + 9, 120), b = proj(l.x + 13, l.y + 35, 100);
    smoke(ctx, a.x, a.y);
    smoke(ctx, b.x, b.y);
  } else if (l.kind === 'clock') {
    box(ctx, l.x, l.y, l.w, l.d, 150, '#c8b896');
    pyramidRoof(ctx, l.x, l.y, l.w, l.d, 150, 26, '#2f5f8a');
    const c = proj(l.x + l.w / 2, l.y + l.d, 128);
    ctx.fillStyle = '#f3ead2';
    ctx.beginPath(); ctx.ellipse(c.x - 4, c.y, 8, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 1.4;
    const now = new Date();
    for (const [len, ang] of [[6, (now.getMinutes() / 60) * Math.PI * 2], [4, ((now.getHours() % 12) / 12) * Math.PI * 2]]) {
      ctx.beginPath(); ctx.moveTo(c.x - 4, c.y); ctx.lineTo(c.x - 4 + Math.sin(ang) * len, c.y - Math.cos(ang) * len); ctx.stroke();
    }
  }
}

/** Praça calçada que cresce com a cidade (deitada no chão). @param {CanvasRenderingContext2D} ctx */
function drawPlaza(ctx) {
  const era = currentEra();
  if (era < 2) return;
  const n = housesFor(state.contractsCompleted || 0);
  const rx = 70 + Math.min(n, 30) * 3.2;
  ctx.save();
  groundTransform(ctx);
  ctx.fillStyle = 'rgba(150,142,126,0.85)';
  ctx.beginPath(); ctx.ellipse(CITY_CENTER.x, CITY_CENTER.y + 70, rx, rx * 0.75, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(90,84,72,0.35)';
  ctx.lineWidth = 1;
  for (let r = 14; r < rx; r += 14) {
    ctx.beginPath(); ctx.ellipse(CITY_CENTER.x, CITY_CENTER.y + 70, r, r * 0.75, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

/** Bandeirolas de festa sobre a praça quando a aprovação está alta. @param {CanvasRenderingContext2D} ctx */
function drawBunting(ctx) {
  if ((state.approval || 0) < 75) return;
  const a = proj(985, 520, 34), b = proj(1105, 520, 34);
  const t = performance.now() / 1000;
  ctx.strokeStyle = '#3a2410';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + 14, b.x, b.y); ctx.stroke();
  const cols = ['#d83a2a', '#f0c040', '#2f8a4a', '#2f5f8a', civColor()];
  for (let i = 1; i < 12; i++) {
    const u = i / 12;
    const x = (1 - u) * (1 - u) * a.x + 2 * u * (1 - u) * (a.x + b.x) / 2 + u * u * b.x;
    const y = (1 - u) * (1 - u) * a.y + 2 * u * (1 - u) * ((a.y + b.y) / 2 + 14) + u * u * b.y;
    const sw = Math.sin(t * 3 + i) * 1.2;
    ctx.fillStyle = cols[i % cols.length];
    ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y); ctx.lineTo(x + sw, y + 7); ctx.closePath(); ctx.fill();
  }
  for (const p of [a, b]) {
    const g = { x: p.x, y: p.y + 34 };
    ctx.fillStyle = '#4a2a14';
    ctx.fillRect(g.x - 1, p.y, 2, 34);
  }
}

/** @returns {SceneObj[]} */
function cityObjects() {
  const style = CITY_STYLES[state.currentCity] || 'colonial';
  const contracts = state.contractsCompleted || 0;
  const era = currentEra();
  /** @type {SceneObj[]} */
  const out = [];
  /** @param {Footprint} f @param {(ctx:CanvasRenderingContext2D)=>void} fn */
  const add = (f, fn) => out.push({ depth: f.x + f.w / 2 + f.y + f.d / 2, draw: fn });

  const n = housesFor(contracts);
  for (let i = 0; i < n; i++) {
    const f = CITY_LOTS[i];
    const lotEra = eraAt(contractsForLot(i));
    const pal = lotPalette(style, i);
    const k = riseFactor(`lot${i}`);
    add(f, (ctx) => rising(ctx, f, k, (c) => lotBuilding(c, f, lotEra, pal, i)));
  }
  for (const l of LANDMARKS) {
    if (era < l.minEra) continue;
    const k = riseFactor(l.kind);
    add(l, (ctx) => rising(ctx, l, k, (c) => drawLandmark(c, l)));
  }
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
  } else {
    const nave = { x: 1012, y: 350, w: 70, d: 92 };
    add(nave, (ctx) => church(ctx, nave));
  }

  // moradores passeando pela praça (mais gente conforme a cidade cresce)
  const t = performance.now() / 1000;
  const people = Math.min(14, 2 + Math.floor(n / 3));
  const tunics = ['#8a3a2a', '#2f5f8a', '#4a7a3a', '#a8862a', '#6a4a8a', '#8a6a4a'];
  for (let i = 0; i < people; i++) {
    const r = 46 + (i % 4) * 16;
    const dirn = i % 2 ? 1 : -1;
    const ang = t * (0.12 + (i % 3) * 0.03) * dirn + i * 1.9;
    const gx = CITY_CENTER.x + Math.cos(ang) * r;
    const gy = CITY_CENTER.y + 90 + Math.sin(ang) * r * 0.7;
    const p = proj(gx, gy);
    const sdx = -Math.sin(ang) * dirn - Math.cos(ang) * 0.7 * dirn;
    out.push({ depth: gx + gy, draw: (ctx) => drawVillager(ctx, p.x, p.y, sdx >= 0 ? 1 : -1, t * 7 + i, tunics[i % tunics.length], false) });
  }
  cityPrimed = true;
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

// ---------- Postos de coleta (madeira, pedra, argila, areia, petróleo) ----------
/** @type {Record<string, number>} */
const SITE_H = { quarry: 34, claypit: 22, lumber: 44, sandbank: 22, oilwell: 96 };

/** @param {import('./sites.js').SiteDef} def */
const siteVisible = (def) => siteState(def.id).built || siteUnlocked(def.id);

/** Árvores já derrubadas pelos lenhadores (cresce com a madeira colhida). */
function lumberCut() {
  const st = siteState('lumber');
  if (!st.built) return 0;
  return Math.max(0, Math.min(choppableTrees().length - 4, Math.floor((st.harvested || 0) / 10)));
}

/** Marca no chão de cada posto (ou o canteiro, se ainda não construído). @param {CanvasRenderingContext2D} ctx @param {import('./sites.js').SiteDef} def */
function drawSiteGround(ctx, def) {
  const { x, y, w, d } = def;
  const st = siteState(def.id);
  if (!st.built) {
    poly(ctx, [[x, y, 0], [x + w, y, 0], [x + w, y + d, 0], [x, y + d, 0]]);
    ctx.fillStyle = 'rgba(70,46,22,0.35)';
    ctx.fill();
    ctx.setLineDash([5, 3]);
    ctx.strokeStyle = '#efe2bf';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }
  /** @param {number} k @param {string} c */
  const inset = (k, c) => {
    poly(ctx, [[x + k, y + k, 0], [x + w - k, y + k, 0], [x + w - k, y + d - k, 0], [x + k, y + d - k, 0]]);
    ctx.fillStyle = c;
    ctx.fill();
  };
  if (def.id === 'quarry') { inset(0, '#a29c90'); inset(8, '#8a8478'); inset(16, '#726c62'); }
  else if (def.id === 'claypit') { inset(0, '#9a6a48'); inset(8, '#7a4a30'); const p = proj(x + w * 0.4, y + d * 0.55); ctx.fillStyle = 'rgba(90,130,150,0.75)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 10, 4, 0, 0, Math.PI * 2); ctx.fill(); }
  else if (def.id === 'sandbank') { inset(0, '#e6d29a'); inset(10, '#f0e0b0'); }
  else if (def.id === 'lumber') { inset(0, '#9a7a4a'); }
  else if (def.id === 'oilwell') { inset(4, '#7a6a52'); const p = proj(x + w * 0.75, y + d * 0.8); ctx.fillStyle = '#141008'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 9, 3.5, 0, 0, Math.PI * 2); ctx.fill(); }
}

/** @param {CanvasRenderingContext2D} ctx @param {import('./sites.js').SiteDef} def */
function drawSiteStructure(ctx, def) {
  const { x, y, w, d } = def;
  const t = performance.now() / 1000;
  if (def.id === 'quarry') {
    box(ctx, x + w - 22, y + d - 16, 12, 10, 8, '#b8b2a6');
    box(ctx, x + w - 20, y + d - 15, 10, 8, 7, '#a8a296', 8);
    box(ctx, x + 6, y + d - 12, 14, 9, 8, '#b8b2a6');
    // guindaste de madeira
    const a = proj(x + w * 0.5, y + 6, 0), top = proj(x + w * 0.5, y + 6, 40), arm = proj(x + w * 0.5 + 18, y + 6, 36);
    ctx.strokeStyle = '#5a3416'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(top.x, top.y); ctx.lineTo(arm.x, arm.y); ctx.stroke();
    const sway = Math.sin(t) * 2;
    ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(arm.x, arm.y); ctx.lineTo(arm.x + sway, arm.y + 14); ctx.stroke();
    ctx.fillStyle = '#a8a296'; ctx.fillRect(arm.x + sway - 3, arm.y + 14, 6, 5);
  } else if (def.id === 'claypit') {
    for (let i = 0; i < 4; i++) box(ctx, x + w - 12, y + 4 + i * 9, 8, 6, 5, '#b0704a');
  } else if (def.id === 'lumber') {
    const hut = { x: x + 4, y: y + 4, w: 24, d: 20 };
    box(ctx, hut.x, hut.y, hut.w, hut.d, 18, '#8a5a30');
    facePatch(ctx, hut, 'L', 0.5, 0, 6, 11, '#3a2010');
    gableRoof(ctx, hut.x, hut.y, hut.w, hut.d, 18, 11, '#6a4a2a', 'x', '#8a5a30');
    for (let i = 0; i < 3; i++) {
      const p = proj(x + w - 14, y + d - 8 - i * 2, 4 + i * 5);
      ctx.fillStyle = '#7a4a22';
      ctx.fillRect(p.x - 14, p.y - 3, 22, 6);
      ctx.fillStyle = '#c8a06a';
      ctx.beginPath(); ctx.ellipse(p.x + 8, p.y, 3, 3, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else if (def.id === 'sandbank') {
    box(ctx, x + 8, y + 8, 18, 3, 12, '#8a5a30');
    for (let i = 0; i < 3; i++) box(ctx, x + w - 14, y + 6 + i * 10, 8, 7, 6, '#d8c08a');
  } else if (def.id === 'oilwell') {
    // torre de perfuração (treliça)
    const ap = proj(x + 14, y + 14, 92);
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1.3;
    for (const [gx, gy] of [[x + 2, y + 2], [x + 26, y + 2], [x + 26, y + 26], [x + 2, y + 26]]) {
      const b = proj(gx, gy);
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(ap.x, ap.y); ctx.stroke();
    }
    for (let z = 18; z < 90; z += 18) {
      const k = 1 - z / 92;
      poly(ctx, [[x + 14 - 12 * k, y + 14 - 12 * k, z], [x + 14 + 12 * k, y + 14 - 12 * k, z], [x + 14 + 12 * k, y + 14 + 12 * k, z], [x + 14 - 12 * k, y + 14 + 12 * k, z]]);
      ctx.stroke();
    }
    // cavalo-de-pau balançando
    const pivot = proj(x + w - 10, y + d - 12, 18);
    const nod = Math.sin(t * 2.2) * 0.35;
    box(ctx, x + w - 14, y + d - 16, 8, 8, 16, '#4a4a4a');
    ctx.save();
    ctx.translate(pivot.x, pivot.y);
    ctx.rotate(nod);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(-16, -2, 30, 4);
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(-20, -5, 6, 10);
    ctx.restore();
  }
}

/** Trabalhadores animados em cada posto. @param {import('./sites.js').SiteDef} def @returns {SceneObj[]} */
function siteWorkers(def) {
  const st = siteState(def.id);
  if (!st.built || st.workers <= 0) return [];
  const t = performance.now() / 1000;
  /** @type {SceneObj[]} */
  const out = [];
  const cc = civColor();
  for (let i = 0; i < st.workers; i++) {
    let gx, gy, carry = false, dir = 1;
    if (def.id === 'lumber') {
      // vai até a próxima árvore de pé e volta com lenha
      const tree = choppableTrees()[lumberCut() + (i % 3)] || { x: def.x + def.w / 2, y: def.y - 40 };
      const u = (t * 0.18 + i * 0.37) % 2;
      const k = u < 1 ? u : 2 - u;
      gx = def.x + def.w / 2 + (tree.x + 6 - def.x - def.w / 2) * k;
      gy = def.y + 4 + (tree.y + 4 - def.y - 4) * k;
      carry = u >= 1;
      dir = ((u < 1 ? 1 : -1) * ((tree.x - def.x) - (tree.y - def.y))) >= 0 ? 1 : -1;
    } else {
      const a = t * 0.5 + i * 2.1;
      gx = def.x + def.w * (0.3 + 0.4 * ((i * 0.37) % 1)) + Math.sin(a) * 4;
      gy = def.y + def.d * (0.35 + 0.3 * ((i * 0.61) % 1));
      dir = Math.cos(a) >= 0 ? 1 : -1;
    }
    const p = proj(gx, gy);
    out.push({ depth: gx + gy + 1, draw: (ctx) => drawVillager(ctx, p.x, p.y, dir, t * 8 + i, cc, carry) });
  }
  return out;
}

// ---------- Maravilha: Ponte Hercílio Luz sobre o rio ----------
const WB = { x1: 752, x2: 900, y: 326, d: 14, t1: 790, t2: 856 };

const wonderVisible = () => currentEra() >= 6 || projectProgress('maravilha') > 0;

/** @param {CanvasRenderingContext2D} ctx */
function drawWonderBridge(ctx) {
  const p = projectProgress('maravilha');
  const done = p >= 1;
  const t = performance.now() / 1000;
  const towerH = 92 * Math.min(1, p * 2.2);
  const deckP = Math.max(0, Math.min(1, (p - 0.35) / 0.4));
  const cableP = Math.max(0, Math.min(1, (p - 0.7) / 0.3));
  const dz = 16;
  // torres
  for (const tx of [WB.t1, WB.t2]) {
    if (towerH > 2) {
      box(ctx, tx - 4, WB.y - 2, 8, 4, towerH, '#8a8f96');
      box(ctx, tx - 4, WB.y + WB.d - 2, 8, 4, towerH, '#8a8f96');
      if (towerH > 70) box(ctx, tx - 4, WB.y - 2, 8, WB.d + 4, 5, '#6a7078', towerH - 8);
    }
  }
  // tabuleiro
  if (deckP > 0) {
    const x2 = WB.x1 + (WB.x2 - WB.x1) * deckP;
    box(ctx, WB.x1, WB.y, x2 - WB.x1, WB.d, 3, done ? '#a8a29a' : '#9a948a', dz);
    ctx.strokeStyle = '#4a4f56'; ctx.lineWidth = 1;
    for (const gy of [WB.y, WB.y + WB.d]) {
      const a = proj(WB.x1, gy, dz + 9), b = proj(x2, gy, dz + 9);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  // cabos pênseis (catenária) + pendurais
  if (cableP > 0) {
    ctx.strokeStyle = done ? '#e8e0c8' : '#b8b2a0';
    ctx.lineWidth = 1.6;
    for (const gy of [WB.y, WB.y + WB.d]) {
      const pts = [];
      for (let i = 0; i <= 40 * cableP; i++) {
        const gx = WB.x1 + ((WB.x2 - WB.x1) * i) / 40;
        let z;
        if (gx < WB.t1) z = dz + 6 + (towerH - dz - 6) * ((gx - WB.x1) / (WB.t1 - WB.x1));
        else if (gx > WB.t2) z = dz + 6 + (towerH - dz - 6) * ((WB.x2 - gx) / (WB.x2 - WB.t2));
        else { const u = (gx - WB.t1) / (WB.t2 - WB.t1); z = dz + 6 + (towerH - dz - 6) * (4 * (u - 0.5) * (u - 0.5)); }
        pts.push(proj(gx, gy, z));
        if (i % 4 === 0 && gx > WB.x1 + 4) {
          const base = proj(gx, gy, dz + 3);
          ctx.save(); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y); ctx.stroke(); ctx.restore();
        }
      }
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.stroke();
    }
  }
  // andaimes durante a obra
  if (!done && p > 0) {
    ctx.strokeStyle = 'rgba(122,82,40,0.8)'; ctx.lineWidth = 1;
    for (const tx of [WB.t1, WB.t2]) {
      for (let z = 10; z < towerH; z += 14) {
        const a = proj(tx - 7, WB.y - 4, z), b = proj(tx + 7, WB.y + WB.d + 4, z);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
  }
  // luzes e fogos enquanto conta para a vitória
  if (done) {
    for (let i = 0; i < 14; i++) {
      const gx = WB.x1 + ((WB.x2 - WB.x1) * (i + 0.5)) / 14;
      const q = proj(gx, WB.y + WB.d, dz + 10);
      ctx.fillStyle = `rgba(255,230,140,${0.6 + 0.4 * Math.sin(t * 3 + i)})`;
      ctx.beginPath(); ctx.arc(q.x, q.y, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    if (state.wonder && !state.wonder.won) {
      for (let k = 0; k < 3; k++) {
        const ph = (t * 0.6 + k / 3) % 1;
        const c = proj(WB.t1 + (k - 1) * 30 + 30, WB.y, 130 + ph * 60);
        const cols = ['#ffd44a', '#e0553a', '#7ad0ff'];
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          ctx.fillStyle = cols[k];
          ctx.globalAlpha = 1 - ph;
          ctx.fillRect(c.x + Math.cos(a) * ph * 26, c.y + Math.sin(a) * ph * 26, 2, 2);
        }
        ctx.globalAlpha = 1;
      }
    }
  }
}

// ---------- Caravanas de comércio ----------
/** @returns {SceneObj[]} */
function tradeObjects() {
  /** @type {SceneObj[]} */
  const out = [];
  const bob = Math.sin(performance.now() / 140);
  for (const c of carts()) {
    const route = ROUTE_BY_ID[c.route];
    if (!route || (c.dir === 0 && c.u === 0)) continue;
    const p = pointOn(route.path, c.u);
    const ahead = pointOn(route.path, Math.max(0, Math.min(1, c.u + (c.dir >= 0 ? 0.035 : -0.035))));
    out.push({
      depth: p.x + p.y + 6,
      draw: (ctx) => {
        box(ctx, ahead.x - 6, ahead.y - 3, 12, 6, 6, '#6a3e1c', 6 + bob);
        box(ctx, p.x - 8, p.y - 5, 16, 10, 7, '#8a5a2e', 5);
        if (c.cargo && R[c.cargo]) box(ctx, p.x - 6, p.y - 4, 12, 8, 5, R[c.cargo].color, 12);
        const wheel = proj(p.x, p.y + 5, 4);
        ctx.fillStyle = '#2a1a0e';
        ctx.beginPath();
        ctx.ellipse(wheel.x - 5, wheel.y, 3.2, 3.6, 0, 0, Math.PI * 2);
        ctx.ellipse(wheel.x + 5, wheel.y, 3.2, 3.6, 0, 0, Math.PI * 2);
        ctx.fill();
        const mast = proj(p.x, p.y, 14);
        flag(ctx, mast.x, mast.y, 12, 10);
      },
    });
  }
  return out;
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
  drawPlaza(ctx);
  drawAmbientFlat(ctx);

  // sombras + seleção (no chão, por baixo dos prédios)
  MINE_FP.forEach((fp, i) => { if (state.mines[i]) castShadow(ctx, fp.x + 25, fp.y + 20, fp.w - 50, fp.d - 40, MINE_H * 0.7); });
  FACTORY_FP.forEach((fp, i) => { if (i < state.factories.length) { const b = hallOf(fp); castShadow(ctx, b.x, b.y, b.w, b.d, 60); } });
  castShadow(ctx, MERCADO_FP.x + 8, MERCADO_FP.y + 8, MERCADO_FP.w - 16, MERCADO_FP.d - 16, 30);
  castShadow(ctx, PESQUISA_FP.x + 6, PESQUISA_FP.y + 6, PESQUISA_FP.w - 12, PESQUISA_FP.d - 12, 50);
  FACTORY_FP.forEach((fp, i) => { if (i >= state.factories.length) drawFoundation(ctx, fp); });
  for (const def of SITES) if (siteVisible(def)) drawSiteGround(ctx, def);
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
  for (const def of SITES) {
    if (!siteState(def.id).built) continue;
    objs.push({ depth: def.x + def.y + def.w / 2 + def.d / 2, draw: (c) => drawSiteStructure(c, def) });
    objs.push(...siteWorkers(def));
  }
  objs.push(...tradeObjects());
  if (wonderVisible()) objs.push({ depth: WB.x1 + WB.y + 60, draw: drawWonderBridge });
  objs.push(...cityObjects(), ...villageObjects(), ...treeObjects(viewIso, lumberCut()));
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

  drawBunting(ctx);
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
  SITES.forEach((def, i) => {
    if (!siteVisible(def)) return;
    const st = siteState(def.id);
    const p = proj(def.x + def.w / 2, def.y + def.d + 10);
    const hov = isTarget(hover, 'site', i);
    const r = st.built
      ? plate(ctx, p.x, p.y, `${def.emoji} ${def.name.toUpperCase()} · ${st.workers}👷`, { bg: hov ? '#ffe680' : (st.workers ? '#e2b765' : '#d8c8a0'), size: 11 })
      : plate(ctx, p.x, p.y, `CONSTRUIR ${def.emoji} ${def.name.toUpperCase()} · ${fmtMoney(def.cost)}`, {
        bg: hov ? '#ffe680' : 'rgba(26,14,6,0.85)', fg: hov ? '#1a0e06' : '#f1e3c2', size: 10,
      });
    addRect('site', i, r);
  });
  if (wonderVisible()) {
    const wp = proj((WB.x1 + WB.x2) / 2, WB.y + WB.d + 18);
    const prog = Math.round(projectProgress('maravilha') * 100);
    const w = state.wonder;
    const txt = w && w.done ? `🌉 PONTE HERCÍLIO LUZ · vitória em ${Math.ceil(w.countdown)}s`
      : prog > 0 ? `🌉 PONTE HERCÍLIO LUZ · ${prog}%` : '🌉 MARAVILHA: inicie em Projetos';
    plate(ctx, wp.x, wp.y, txt, { bg: w && w.done ? '#ffe680' : '#f1e3c2', size: 11 });
  }
  for (const r of ROUTES) {
    const end = pointOn(r.path, 0.82);
    const q = proj(end.x, end.y);
    plate(ctx, q.x, q.y - 10, `${routeUnlocked(r.id) ? '🐎' : '🔒'} → ${r.name.toUpperCase()}`, { bg: 'rgba(241,227,194,0.92)', size: 10, border: 'rgba(42,22,8,0.7)' });
  }
  const mc = centerOf(MERCADO_FP), pc = centerOf(PESQUISA_FP);
  const pm = proj(mc.x, MERCADO_FP.y + MERCADO_FP.d + 10);
  addRect('mercado', 0, plate(ctx, pm.x, pm.y, '💰 MERCADO', { bg: isTarget(hover, 'mercado', 0) ? '#ffe680' : '#e2b765' }));
  const pp = proj(pc.x, PESQUISA_FP.y + PESQUISA_FP.d + 10);
  addRect('pesquisa', 0, plate(ctx, pp.x, pp.y, '📚 PESQUISA', { bg: isTarget(hover, 'pesquisa', 0) ? '#ffe680' : '#e2b765' }));
  if (state.relics > 0) plate(ctx, pp.x, pp.y + 20, `🏺 ${state.relics} relíquia${state.relics > 1 ? 's' : ''} · +$${state.relics * 30}/dia`, { bg: '#f1e3c2', size: 10 });
  const cs = proj(CITY_SIGN.x, CITY_SIGN.y);
  plate(ctx, cs.x, cs.y, `${(state.currentCity || 'Florianópolis').toUpperCase()} · ${cityTitle(state.contractsCompleted || 0)}`, { bg: '#c69042', size: 13 });
  const civ = state.civilization ? CIV_BY_ID[state.civilization] : null;
  if (civ) {
    const p = proj(CIV_FLAG.x, CIV_FLAG.y, CLIFF_H);
    plate(ctx, p.x + 10, p.y + 12, `${civ.emoji} ${civ.name.toUpperCase()}`, { size: 10, bg: '#f1e3c2' });
  }
}
