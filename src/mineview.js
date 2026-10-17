// mineview.js — interior da mina com volume: blocos com topo iluminado e bordas
// sombreadas, túneis com fundo/chão/escoras, minérios em cristais facetados,
// luz das lanternas dos mineradores. A grade estática fica em cache e só é
// refeita quando algo muda (cavou, revelou, minério diminuiu).
import { state } from './state.js';
import { R, MINE, SILO_DEFAULT_CAP } from './data.js';
import { W } from './geometry.js';
import { currentEra, eraData } from './progression.js';
import { shade } from './iso.js';
import { resAbbrev, UI_FONT, civColor } from './paint.js';

const RES = 2;
const GW = MINE.cols * MINE.cell;
const GH = MINE.rows * MINE.cell;

/** @param {number} r @param {number} c @param {number} k */
function hash(r, c, k) {
  let h = (r * 73856093) ^ (c * 19349663) ^ (k * 83492791);
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** @param {any} t */
const isSolid = (t) => !!t && t.revealed && (t.type === 'dirt' || t.type === 'stone' || t.type === 'ore');
/** @param {any} t */
const isOpen = (t) => !!t && t.revealed && (t.type === 'air' || t.type === 'shaft');

const BASE = { dirt: '#8a5a30', stone: '#7c766c', ore: '#5e5046' };

/** @type {HTMLCanvasElement | null} */
let cache = null;
let cacheSig = '';
let cacheMineId = '';
/** Lampiões pendurados nas escoras (posição no mundo), para a luz dinâmica. @type {{x:number,y:number}[]} */
let lamps = [];

/** @param {any} mine */
function signature(mine) {
  let s = '';
  for (let r = 0; r < MINE.rows; r++) {
    for (let c = 0; c < MINE.cols; c++) {
      const t = mine.grid[r][c];
      if (!t.revealed) { s += '.'; continue; }
      s += t.type[0];
      if (t.type === 'ore') s += t.resource + Math.ceil(t.amount / 5);
    }
  }
  return s;
}

/** Cristal facetado. @param {CanvasRenderingContext2D} g @param {number} x @param {number} y @param {number} s @param {string} color @param {number} tilt */
function crystal(g, x, y, s, color, tilt) {
  g.save();
  g.translate(x, y);
  g.rotate(tilt);
  const pts = [[0, -s], [s * 0.45, -s * 0.35], [s * 0.4, s * 0.5], [-s * 0.4, s * 0.5], [-s * 0.45, -s * 0.35]];
  g.beginPath();
  pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.beginPath(); g.moveTo(0, -s); g.lineTo(-s * 0.45, -s * 0.35); g.lineTo(-s * 0.4, s * 0.5); g.lineTo(-s * 0.05, s * 0.5); g.closePath();
  g.fillStyle = shade(color, 0.35);
  g.fill();
  g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.45, -s * 0.35); g.lineTo(s * 0.4, s * 0.5); g.lineTo(s * 0.1, s * 0.5); g.closePath();
  g.fillStyle = shade(color, -0.35);
  g.fill();
  g.beginPath();
  pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
  g.closePath();
  g.strokeStyle = 'rgba(20,10,5,0.6)';
  g.lineWidth = 0.8;
  g.stroke();
  g.restore();
}

/** @param {CanvasRenderingContext2D} g @param {number} x @param {number} y @param {number} w @param {number} h @param {string} side @param {number} a */
function edgeShade(g, x, y, w, h, side, a) {
  const grd = side === 'top' ? g.createLinearGradient(0, y, 0, y + h)
    : side === 'bottom' ? g.createLinearGradient(0, y + h, 0, y)
      : side === 'left' ? g.createLinearGradient(x, 0, x + w, 0)
        : g.createLinearGradient(x + w, 0, x, 0);
  grd.addColorStop(0, `rgba(0,0,0,${a})`);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(x, y, w, h);
}

/** @param {any} mine */
function buildCache(mine) {
  const c = cache || document.createElement('canvas');
  c.width = GW * RES;
  c.height = GH * RES;
  const g = c.getContext('2d');
  if (!g) return c;
  g.setTransform(RES, 0, 0, RES, 0, 0);
  g.fillStyle = '#1a120c';
  g.fillRect(0, 0, GW, GH);
  lamps = [];
  const cell = MINE.cell;
  /** @param {number} r @param {number} cc */
  const at = (r, cc) => (r >= 0 && r < MINE.rows && cc >= 0 && cc < MINE.cols ? mine.grid[r][cc] : null);

  for (let r = 0; r < MINE.rows; r++) {
    for (let cc = 0; cc < MINE.cols; cc++) {
      const t = mine.grid[r][cc];
      const x = cc * cell, y = r * cell;
      if (!t.revealed) {
        g.fillStyle = '#0c0805';
        g.fillRect(x, y, cell, cell);
        g.fillStyle = 'rgba(70,52,36,0.25)';
        for (let i = 0; i < 4; i++) g.fillRect(x + hash(r, cc, i) * (cell - 4), y + hash(r, cc, i + 9) * (cell - 3), 3, 2);
        continue;
      }
      if (t.type === 'shaft') {
        g.fillStyle = '#120c08';
        g.fillRect(x, y, cell, cell);
        g.fillStyle = '#5a3a1e';
        for (let k = 6; k < cell; k += 10) g.fillRect(x + 9, y + k, cell - 18, 2.5);
        const rail = g.createLinearGradient(x, 0, x + 4, 0);
        rail.addColorStop(0, '#8a8a8a'); rail.addColorStop(1, '#4a4a4a');
        g.fillStyle = rail;
        g.fillRect(x + 5, y, 4, cell);
        g.fillRect(x + cell - 9, y, 4, cell);
        continue;
      }
      if (t.type === 'air') {
        const wall = g.createLinearGradient(0, y, 0, y + cell);
        wall.addColorStop(0, '#6a4a2e');
        wall.addColorStop(1, '#4a3220');
        g.fillStyle = wall;
        g.fillRect(x, y, cell, cell);
        g.fillStyle = 'rgba(90,66,44,0.35)';
        for (let i = 0; i < 6; i++) g.fillRect(x + hash(r, cc, i) * (cell - 4), y + hash(r, cc, i + 5) * (cell - 4), 3, 2);
        continue;
      }
      // blocos sólidos
      const base = /** @type {string} */ (BASE[/** @type {'dirt'|'stone'|'ore'} */ (t.type)]);
      g.fillStyle = base;
      g.fillRect(x, y, cell, cell);
      if (t.type === 'stone' || t.type === 'ore') {
        // placas de rocha
        for (let i = 0; i < 3; i++) {
          const bx = x + 3 + hash(r, cc, i) * (cell - 16), by = y + 3 + hash(r, cc, i + 3) * (cell - 16);
          const bw = 9 + hash(r, cc, i + 6) * 8, bh = 7 + hash(r, cc, i + 7) * 6;
          g.fillStyle = shade(base, 0.12);
          g.fillRect(bx, by, bw, bh);
          g.fillStyle = shade(base, -0.25);
          g.fillRect(bx, by + bh, bw, 1.5);
          g.fillRect(bx + bw, by, 1.5, bh + 1.5);
        }
      } else {
        for (let i = 0; i < 7; i++) {
          g.fillStyle = i % 2 ? 'rgba(60,34,14,0.45)' : 'rgba(176,130,80,0.35)';
          g.beginPath();
          g.ellipse(x + 4 + hash(r, cc, i) * (cell - 8), y + 4 + hash(r, cc, i + 11) * (cell - 8), 2 + hash(r, cc, i + 2) * 2, 1.5, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  }

  // relevo: faces expostas dos blocos e sombra dentro dos túneis
  for (let r = 0; r < MINE.rows; r++) {
    for (let cc = 0; cc < MINE.cols; cc++) {
      const t = mine.grid[r][cc];
      const x = cc * cell, y = r * cell;
      if (isSolid(t)) {
        const base = /** @type {string} */ (BASE[/** @type {'dirt'|'stone'|'ore'} */ (t.type)]);
        if (isOpen(at(r - 1, cc))) {
          // topo do bloco visível (chão do túnel de cima)
          g.fillStyle = shade(base, 0.32);
          g.fillRect(x, y, cell, 6);
          g.fillStyle = shade(base, 0.5);
          g.fillRect(x, y, cell, 1.5);
          g.fillStyle = 'rgba(0,0,0,0.25)';
          g.fillRect(x, y + 6, cell, 1);
        }
        if (isOpen(at(r, cc - 1))) { g.fillStyle = shade(base, 0.2); g.fillRect(x, y, 3, cell); }
        if (isOpen(at(r, cc + 1))) { g.fillStyle = shade(base, -0.35); g.fillRect(x + cell - 4, y, 4, cell); }
        if (isOpen(at(r + 1, cc))) {
          g.fillStyle = shade(base, -0.45);
          g.fillRect(x, y + cell - 5, cell, 5);
          // pingos de rocha no teto do túnel
          for (let i = 0; i < 2; i++) {
            const sx = x + 6 + hash(r, cc, i + 20) * (cell - 12);
            g.beginPath(); g.moveTo(sx - 3, y + cell); g.lineTo(sx + 3, y + cell); g.lineTo(sx, y + cell + 5 + hash(r, cc, i) * 4); g.closePath();
            g.fillStyle = shade(base, -0.4); g.fill();
          }
        }
        if (t.type === 'ore' && R[t.resource]) {
          const n = Math.max(2, Math.min(6, Math.ceil(t.amount / 6)));
          for (let i = 0; i < n; i++) {
            const px = x + 8 + hash(r, cc, i + 30) * (cell - 16);
            const py = y + 18 + hash(r, cc, i + 40) * (cell - 24);
            crystal(g, px, py, 5 + hash(r, cc, i + 50) * 4, R[t.resource].color, (hash(r, cc, i + 60) - 0.5) * 0.9);
          }
        }
      } else if (t.revealed && t.type === 'air') {
        const up = at(r - 1, cc), dn = at(r + 1, cc), lf = at(r, cc - 1), rt = at(r, cc + 1);
        if (!isOpen(up)) edgeShade(g, x, y, cell, 12, 'top', 0.55);
        if (!isOpen(lf)) edgeShade(g, x, y, 8, cell, 'left', 0.4);
        if (!isOpen(rt)) edgeShade(g, x + cell - 8, y, 8, cell, 'right', 0.45);
        if (!isOpen(dn) || r === MINE.rows - 1) {
          // chão batido com tábuas
          g.fillStyle = '#5a3a20';
          g.fillRect(x, y + cell - 7, cell, 7);
          g.fillStyle = '#7a5230';
          g.fillRect(x, y + cell - 7, cell, 2);
          g.fillStyle = 'rgba(30,18,8,0.5)';
          g.fillRect(x + ((cc * 13) % 18), y + cell - 5, 1, 5);
        }
        // escoras de madeira a cada 3 colunas quando há teto
        if (cc % 3 === 1 && isSolid(up)) {
          g.fillStyle = '#6a4220';
          g.fillRect(x + 3, y, 5, cell - 6);
          g.fillRect(x + cell - 8, y, 5, cell - 6);
          g.fillStyle = '#8a5a2e';
          g.fillRect(x + 3, y, 2, cell - 6);
          g.fillRect(x + cell - 8, y, 2, cell - 6);
          g.fillStyle = '#5a3416';
          g.fillRect(x, y + 1, cell, 5);
          g.fillStyle = '#8a5a2e';
          g.fillRect(x, y + 1, cell, 1.5);
          // lampião pendurado na viga
          g.strokeStyle = '#2a1a0e'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(x + cell / 2, y + 6); g.lineTo(x + cell / 2, y + 11); g.stroke();
          g.fillStyle = '#3a2a1a'; g.fillRect(x + cell / 2 - 3, y + 11, 6, 2);
          g.fillStyle = '#ffd27a'; g.fillRect(x + cell / 2 - 2.5, y + 13, 5, 6);
          g.fillStyle = '#3a2a1a'; g.fillRect(x + cell / 2 - 3, y + 19, 6, 1.5);
          lamps.push({ x: MINE.x + x + cell / 2, y: MINE.y + y + 16 });
        }
      }
      // escuridão caindo na direção da névoa
      if (t.revealed) {
        if (at(r - 1, cc) && !at(r - 1, cc).revealed) edgeShade(g, x, y, cell, 14, 'top', 0.6);
        if (at(r + 1, cc) && !at(r + 1, cc).revealed) edgeShade(g, x, y + cell - 14, cell, 14, 'bottom', 0.6);
        if (at(r, cc - 1) && !at(r, cc - 1).revealed) edgeShade(g, x, y, 14, cell, 'left', 0.6);
        if (at(r, cc + 1) && !at(r, cc + 1).revealed) edgeShade(g, x + cell - 14, y, 14, cell, 'right', 0.6);
      }
    }
  }
  return c;
}

// ---------- Mineiro animado (vetorial, nítido em qualquer zoom) ----------
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y pés @param {number} phase */
function miner(ctx, x, y, phase) {
  const swing = Math.sin(phase);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(x, y, 7, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(x - 4, y - 8, 3, 8);
  ctx.fillRect(x + 1, y - 8, 3, 8);
  ctx.fillStyle = civColor();
  ctx.fillRect(x - 5, y - 17, 10, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + 2, y - 17, 3, 10);
  ctx.fillStyle = '#d9a77a';
  ctx.beginPath(); ctx.arc(x, y - 21, 3.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e0b030';
  ctx.beginPath(); ctx.ellipse(x, y - 24, 5, 3, 0, Math.PI, 0); ctx.fill();
  ctx.fillRect(x - 6, y - 24.5, 12, 1.8);
  ctx.fillStyle = '#fff6c0';
  ctx.beginPath(); ctx.arc(x + 3.5, y - 25, 1.6, 0, Math.PI * 2); ctx.fill();
  // picareta
  const ang = -1.9 + swing * 1.1;
  const hx = x + 3, hy = y - 15;
  const ex = hx + Math.cos(ang) * 12, ey = hy + Math.sin(ang) * 12;
  ctx.strokeStyle = '#6a4220'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.strokeStyle = '#a8a8a8'; ctx.lineWidth = 2;
  const pa = ang + Math.PI / 2;
  ctx.beginPath(); ctx.moveTo(ex - Math.cos(pa) * 5, ey - Math.sin(pa) * 5); ctx.lineTo(ex + Math.cos(pa) * 5, ey + Math.sin(pa) * 5); ctx.stroke();
  // faíscas no golpe
  if (swing > 0.85) {
    for (let i = 0; i < 4; i++) {
      const a = -0.6 + i * 0.45;
      ctx.fillStyle = '#ffe680';
      ctx.fillRect(ex + Math.cos(a) * (4 + i * 2), ey + Math.sin(a) * (4 + i * 2), 1.6, 1.6);
    }
  }
}

/**
 * Grade da mina (cache) + luzes, brilhos, mineradores e rótulos.
 * @param {CanvasRenderingContext2D} ctx espaço do mundo da mina
 * @param {any} mine
 */
export function drawMineGridVol(ctx, mine) {
  if (!mine || !mine.grid) return;
  const sig = signature(mine);
  if (!cache || sig !== cacheSig || mine.id !== cacheMineId) {
    cache = buildCache(mine);
    cacheSig = sig;
    cacheMineId = mine.id;
  }
  const { cell, x: gx, y: gy } = MINE;
  ctx.drawImage(cache, gx, gy, GW, GH);
  // fica mais escuro quanto mais fundo
  const depth = ctx.createLinearGradient(0, gy, 0, gy + GH);
  depth.addColorStop(0, 'rgba(0,0,0,0)');
  depth.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = depth;
  ctx.fillRect(gx, gy, GW, GH);

  const t = performance.now() / 1000;
  const era = eraData(currentEra());
  // marcador do geólogo sobre a névoa (some quando o tile é revelado)
  const hint = state.hintTile;
  if (hint && hint.mineIdx === state.activeMineIdx) {
    const ht = mine.grid[hint.r] && mine.grid[hint.r][hint.c];
    if (!ht || ht.revealed) {
      state.hintTile = null;
    } else {
      const hx = gx + (hint.c + 0.5) * cell, hy = gy + (hint.r + 0.5) * cell;
      const pulse = (Math.sin(t * 4) + 1) / 2;
      ctx.strokeStyle = `rgba(255,212,74,${0.5 + 0.5 * pulse})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(hx, hy, 14 + pulse * 6, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(hx, hy, 4 * 40 / 2 + 8, 0, Math.PI * 2);
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(255,212,74,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffd44a';
      ctx.font = `bold 20px ${UI_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', hx, hy + 1);
    }
  }
  // luz das lanternas
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const l of lamps) {
    const flick = 0.8 + Math.sin(t * 7 + l.x) * 0.08 + Math.sin(t * 11 + l.y) * 0.06;
    const glow = ctx.createRadialGradient(l.x, l.y, 1, l.x, l.y, 46);
    glow.addColorStop(0, `rgba(255,200,110,${0.35 * flick})`);
    glow.addColorStop(1, 'rgba(255,160,70,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(l.x - 46, l.y - 46, 92, 92);
  }
  for (let r = 0; r < MINE.rows; r++) {
    for (let c = 0; c < MINE.cols; c++) {
      const tile = mine.grid[r][c];
      if (!tile.worker) continue;
      const lx = gx + c * cell + 10, ly = gy + r * cell + cell - 22;
      const flick = 0.85 + Math.sin(t * 9 + c) * 0.05 + Math.sin(t * 13 + r) * 0.04;
      const glow = ctx.createRadialGradient(lx, ly, 2, lx, ly, 70);
      glow.addColorStop(0, `rgba(255,190,90,${0.42 * flick})`);
      glow.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(lx - 70, ly - 70, 140, 140);
    }
  }
  ctx.restore();

  // perigos revelados e túneis inundados
  for (let r = 0; r < MINE.rows; r++) {
    for (let c = 0; c < MINE.cols; c++) {
      const tile = mine.grid[r][c];
      const px = gx + c * cell, py = gy + r * cell;
      if (tile.flood > 0) {
        const a = Math.min(1, tile.flood / 6);
        ctx.fillStyle = `rgba(60,130,180,${0.55 * a})`;
        ctx.fillRect(px, py + 8, cell, cell - 8);
        ctx.strokeStyle = `rgba(200,235,250,${0.6 * a})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= cell; x += 4) ctx.lineTo(px + x, py + 9 + Math.sin(t * 4 + x * 0.4 + c) * 1.5);
        ctx.stroke();
        if (tile.flood > 1) {
          ctx.font = `bold 10px ${UI_FONT}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#e8f6ff';
          ctx.fillText(`${Math.ceil(tile.flood)}s`, px + cell / 2, py + cell / 2 + 6);
        }
      }
      if (!tile.revealed || (!tile.gas && !tile.water)) continue;
      if (tile.gas) {
        for (let k = 0; k < 3; k++) {
          const ph = (t * 0.5 + k / 3) % 1;
          ctx.fillStyle = `rgba(150,200,90,${0.35 * (1 - ph)})`;
          ctx.beginPath(); ctx.ellipse(px + cell / 2 + Math.sin(t + k) * 5, py + cell / 2 - ph * 10, 8 + ph * 8, 5 + ph * 4, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.font = `16px ${UI_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tile.gas ? '☁️' : '💧', px + cell / 2, py + cell / 2 + 1);
    }
  }

  // relíquias reveladas: brilho dourado no bloco
  for (let r = 0; r < MINE.rows; r++) {
    for (let c = 0; c < MINE.cols; c++) {
      const tile = mine.grid[r][c];
      if (!tile.revealed || !tile.relic) continue;
      const px = gx + c * cell + cell / 2, py = gy + r * cell + cell / 2;
      const pulse = (Math.sin(t * 3 + c) + 1) / 2;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(px, py, 2, px, py, 26);
      glow.addColorStop(0, `rgba(255,220,120,${0.45 + 0.3 * pulse})`);
      glow.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(px - 26, py - 26, 52, 52);
      ctx.restore();
      ctx.font = `20px ${UI_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏺', px, py + 1);
    }
  }
  for (let r = 0; r < MINE.rows; r++) {
    for (let c = 0; c < MINE.cols; c++) {
      const tile = mine.grid[r][c];
      if (!tile.revealed || tile.type !== 'ore') continue;
      const px = gx + c * cell, py = gy + r * cell;
      const locked = !era.deposits.includes(tile.resource);
      // veio raro (prata, ouro, rubi, diamante): aura colorida pulsando
      if (!locked && R[tile.resource] && R[tile.resource].price >= 25) {
        const pulse = (Math.sin(t * 2.5 + c + r) + 1) / 2;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(px + cell / 2, py + cell / 2, 2, px + cell / 2, py + cell / 2, cell * 0.9);
        g.addColorStop(0, `rgba(255,236,160,${0.25 + 0.25 * pulse})`);
        g.addColorStop(1, 'rgba(255,220,120,0)');
        ctx.fillStyle = g;
        ctx.fillRect(px - cell / 2, py - cell / 2, cell * 2, cell * 2);
        ctx.restore();
      }
      // cintilar
      for (let i = 0; i < 2; i++) {
        const ph = (t * 0.7 + hash(r, c, i + 70)) % 1;
        if (ph > 0.25) continue;
        const a = Math.sin((ph / 0.25) * Math.PI);
        const sx = px + 8 + hash(r, c, i + 30) * (cell - 16), sy = py + 14 + hash(r, c, i + 40) * (cell - 24);
        ctx.strokeStyle = `rgba(255,255,230,${a})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(sx - 3, sy); ctx.lineTo(sx + 3, sy); ctx.moveTo(sx, sy - 3); ctx.lineTo(sx, sy + 3); ctx.stroke();
      }
      if (tile.worker) {
        ctx.strokeStyle = 'rgba(255,212,74,0.85)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px + 1.5, py + 1.5, cell - 3, cell - 3);
        miner(ctx, px + 10, py + cell - 3, t * 7 + c * 1.3);
      }
      // rótulo do minério + quantidade
      const label = resAbbrev(tile.resource);
      ctx.font = `bold 11px ${UI_FONT}`;
      const lw = Math.max(22, ctx.measureText(label).width + 8);
      ctx.fillStyle = 'rgba(16,8,4,0.85)';
      ctx.fillRect(px + cell / 2 - lw / 2, py + 1, lw, 13);
      ctx.fillStyle = locked ? '#9a8a6a' : '#ffd44a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, px + cell / 2, py + 8);
      if (locked) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(px, py + 15, cell, cell - 15);
        ctx.font = `16px ${UI_FONT}`;
        ctx.fillText('🔒', px + cell / 2, py + cell / 2 + 8);
      } else {
        const amt = String(Math.ceil(tile.amount));
        ctx.font = `bold 10px ${UI_FONT}`;
        const aw = ctx.measureText(amt).width + 5;
        ctx.fillStyle = 'rgba(16,8,4,0.78)';
        ctx.fillRect(px + cell - aw - 1, py + cell - 12, aw, 11);
        ctx.fillStyle = '#f1e3c2';
        ctx.textAlign = 'right';
        ctx.fillText(amt, px + cell - 3, py + cell - 6);
      }
    }
  }
}

// ---------- Superfície: céu, colinas, chão e silos cilíndricos ----------
/** @param {CanvasRenderingContext2D} ctx @param {any} mine */
export function drawMineSurface(ctx, mine) {
  const gy = MINE.y;
  const sky = ctx.createLinearGradient(0, 0, 0, gy);
  sky.addColorStop(0, '#8fb8d4');
  sky.addColorStop(0.75, '#d8dcc4');
  sky.addColorStop(1, '#e8d8ae');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, gy);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  const t = performance.now() / 1000;
  for (const [cx, cy, s] of [[260, 50, 1], [640, 36, 0.8], [980, 62, 1.1]]) {
    const x = ((cx + t * 6) % (W + 200)) - 100;
    ctx.beginPath();
    ctx.ellipse(x, cy, 40 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 26 * s, cy - 7 * s, 26 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 24 * s, cy - 4 * s, 22 * s, 10 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // colinas ao fundo
  for (const [col, base, amp, f] of /** @type {[string, number, number, number][]} */ ([['#9ab08a', gy - 34, 26, 0.006], ['#7e9a62', gy - 18, 18, 0.011]])) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    for (let x = 0; x <= W; x += 16) ctx.lineTo(x, base - Math.sin(x * f + base) * amp - Math.sin(x * f * 2.3) * amp * 0.4);
    ctx.lineTo(W, gy);
    ctx.closePath();
    ctx.fill();
  }
  // chão: grama + corte de terra
  ctx.fillStyle = '#6a8a35';
  ctx.fillRect(0, gy - 8, W, 8);
  ctx.fillStyle = '#86a84a';
  ctx.fillRect(0, gy - 8, W, 2);
  ctx.strokeStyle = '#4f6b25';
  ctx.lineWidth = 1;
  for (let x = 4; x < W; x += 9) { ctx.beginPath(); ctx.moveTo(x, gy - 8); ctx.lineTo(x + 2, gy - 12); ctx.stroke(); }
  ctx.fillStyle = '#5a3a1e';
  ctx.fillRect(0, gy - 1, W, 2);
  // nome da mina
  const name = mine ? `${mine.name.toUpperCase()} — SUPERFÍCIE` : 'SUPERFÍCIE';
  ctx.font = `bold 12px ${UI_FONT}`;
  ctx.fillStyle = 'rgba(40,24,10,0.75)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 210, 22);
  drawSilosVol(ctx);
}

/** @param {CanvasRenderingContext2D} ctx */
function drawSilosVol(ctx) {
  const items = [];
  for (const k in state.warehouse) {
    if (R[k] && R[k].free) continue;
    const stock = state.warehouse[k] || 0;
    if (stock > 0) items.push({ k, n: stock });
  }
  items.sort((a, b) => b.n - a.n);
  const visible = items.slice(0, 8);
  if (!visible.length) {
    ctx.fillStyle = '#3a2410';
    ctx.font = `italic 12px ${UI_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Aloque mineradores em veios expostos para começar a encher os silos.', 210, 130);
    return;
  }
  const startX = 210, maxW = W - 230;
  const slot = Math.min(100, maxW / visible.length);
  visible.forEach((it, i) => silo(ctx, startX + i * slot + 6, MINE.y - 8, slot - 16, it.k));
}

/** Silo cilíndrico com visor do nível. @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} baseY @param {number} w @param {string} id */
function silo(ctx, x, baseY, w, id) {
  const res = R[id];
  const stock = state.warehouse[id] || 0;
  const cap = (state.silos[id] && state.silos[id].cap) || SILO_DEFAULT_CAP;
  const pct = Math.max(0, Math.min(1, stock / cap));
  const h = 96, top = baseY - h, ry = w * 0.18;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x + w / 2 + 6, baseY, w * 0.6, ry, 0, 0, Math.PI * 2); ctx.fill();
  const body = ctx.createLinearGradient(x, 0, x + w, 0);
  body.addColorStop(0, '#6a6660');
  body.addColorStop(0.35, '#d8d4c8');
  body.addColorStop(0.6, '#b8b2a4');
  body.addColorStop(1, '#5a5650');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, baseY);
  ctx.ellipse(x + w / 2, baseY, w / 2, ry, 0, Math.PI, 0, true);
  ctx.lineTo(x + w, top);
  ctx.closePath();
  ctx.fill();
  // anéis
  ctx.strokeStyle = 'rgba(60,56,50,0.55)';
  ctx.lineWidth = 1.2;
  for (let yy = top + 18; yy < baseY - 4; yy += 18) {
    ctx.beginPath(); ctx.ellipse(x + w / 2, yy, w / 2, ry, 0, 0, Math.PI); ctx.stroke();
  }
  // visor com o nível
  const vx = x + w * 0.38, vw = w * 0.24, vt = top + 10, vh = h - 22;
  ctx.fillStyle = '#1a120c';
  ctx.fillRect(vx, vt, vw, vh);
  ctx.fillStyle = res.color;
  ctx.fillRect(vx + 1, vt + vh - vh * pct, vw - 2, vh * pct);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(vx + 1, vt, 2, vh);
  // cúpula
  const dome = ctx.createLinearGradient(x, 0, x + w, 0);
  dome.addColorStop(0, '#8a3a22');
  dome.addColorStop(0.4, '#c8603a');
  dome.addColorStop(1, '#6a2a18');
  ctx.fillStyle = dome;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, top, w / 2 + 2, ry + 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 2, top);
  ctx.quadraticCurveTo(x + w / 2, top - w * 0.55, x + w + 2, top);
  ctx.ellipse(x + w / 2, top, w / 2 + 2, ry + 2, 0, 0, Math.PI, false);
  ctx.fill();
  // placa
  const full = pct >= 0.99;
  const label = res.name.length > 12 ? res.name.slice(0, 11) + '…' : res.name;
  ctx.font = `bold 10px ${UI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(20,10,5,0.85)';
  const lw = Math.min(w + 14, ctx.measureText(label).width + 10);
  ctx.fillRect(x + w / 2 - lw / 2, top + 22, lw, 14);
  ctx.fillStyle = '#ffd44a';
  ctx.fillText(label, x + w / 2, top + 29);
  ctx.fillStyle = full ? '#ffd44a' : '#f1e3c2';
  ctx.fillStyle = 'rgba(20,10,5,0.85)';
  const cnt = `${Math.floor(stock)}/${cap}${full ? ' ★' : ''}`;
  const cw = ctx.measureText(cnt).width + 10;
  ctx.fillRect(x + w / 2 - cw / 2, baseY - 20, cw, 14);
  ctx.fillStyle = full ? '#ffd44a' : '#f1e3c2';
  ctx.fillText(cnt, x + w / 2, baseY - 13);
}
