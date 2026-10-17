// iso.js — projeção isométrica 2:1 do mapa (estilo AoE II) + primitivas 3D.
// "Chão" = coordenadas lógicas 1280x720 (as mesmas da geometria do jogo).
// "Iso"  = espaço da cena do mapa, onde a câmera trabalha.
import { W, H } from './geometry.js';

export const ISO_A = 0.72; // meia-largura de 1 unidade de chão na tela
export const ISO_B = 0.36; // meia-altura (2:1)
const PAD_TOP = 96;        // espaço acima do vértice norte (planalto elevado, árvores altas)
const PAD_SIDE = 16;
const PAD_BOTTOM = 20;
export const ISO_OX = H * ISO_A + PAD_SIDE;
export const ISO_OY = PAD_TOP;
export const ISO_W = (W + H) * ISO_A + 2 * PAD_SIDE;
export const ISO_H = (W + H) * ISO_B + PAD_TOP + PAD_BOTTOM;

/** Chão → iso. @param {number} gx @param {number} gy @param {number} [z] altura em px de tela */
export function proj(gx, gy, z = 0) {
  return { x: (gx - gy) * ISO_A + ISO_OX, y: (gx + gy) * ISO_B + ISO_OY - z };
}

/** Iso → chão (no plano z=0). @param {number} ix @param {number} iy */
export function unproj(ix, iy) {
  const u = (ix - ISO_OX) / ISO_A;
  const v = (iy - ISO_OY) / ISO_B;
  return { x: (u + v) / 2, y: (v - u) / 2 };
}

/** Faz o ctx desenhar em coordenadas de chão já projetadas (afim). @param {CanvasRenderingContext2D} ctx */
export function groundTransform(ctx) {
  ctx.transform(ISO_A, ISO_B, -ISO_A, ISO_B, ISO_OX, ISO_OY);
}

/** @param {string} hex '#rrggbb' @param {number} f -1..1 (escurece/clareia) */
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f));
  return `rgb(${ch[0]},${ch[1]},${ch[2]})`;
}

/** @param {CanvasRenderingContext2D} ctx @param {number[][]} pts [gx, gy, z][] */
export function poly(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([gx, gy, z], i) => {
    const p = proj(gx, gy, z || 0);
    if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
  });
  ctx.closePath();
}

const EDGE = 'rgba(30,18,8,0.55)';

/**
 * Caixa sobre o chão. (x, y) = canto norte da pegada; w ao longo de +gx, d ao longo de +gy.
 * Faces visíveis: frente-esquerda (gy = y+d), frente-direita (gx = x+w) e topo.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x @param {number} y @param {number} w @param {number} d @param {number} h
 * @param {string} color cor base (as faces derivam dela)
 * @param {number} [z0] elevação da base
 */
export function box(ctx, x, y, w, d, h, color, z0 = 0) {
  const z1 = z0 + h;
  ctx.lineWidth = 1;
  ctx.strokeStyle = EDGE;
  poly(ctx, [[x, y + d, z0], [x + w, y + d, z0], [x + w, y + d, z1], [x, y + d, z1]]);
  ctx.fillStyle = shade(color, -0.08);
  ctx.fill(); ctx.stroke();
  poly(ctx, [[x + w, y, z0], [x + w, y + d, z0], [x + w, y + d, z1], [x + w, y, z1]]);
  ctx.fillStyle = shade(color, -0.3);
  ctx.fill(); ctx.stroke();
  poly(ctx, [[x, y, z1], [x + w, y, z1], [x + w, y + d, z1], [x, y + d, z1]]);
  ctx.fillStyle = shade(color, 0.12);
  ctx.fill(); ctx.stroke();
}

/**
 * Telhado de duas águas. axis 'x' = cumeeira ao longo de gx; 'y' = ao longo de gy.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x @param {number} y @param {number} w @param {number} d
 * @param {number} z base do telhado @param {number} rh altura da cumeeira
 * @param {string} color @param {'x'|'y'} [axis] @param {string} [wall] cor da empena
 */
export function gableRoof(ctx, x, y, w, d, z, rh, color, axis = 'x', wall) {
  const o = 4; // beiral
  const X0 = x - o, X1 = x + w + o, Y0 = y - o, Y1 = y + d + o, zt = z + rh;
  ctx.lineWidth = 1;
  ctx.strokeStyle = EDGE;
  if (axis === 'x') {
    const ym = y + d / 2;
    poly(ctx, [[X0, Y0, z], [X1, Y0, z], [X1, ym, zt], [X0, ym, zt]]);
    ctx.fillStyle = shade(color, -0.25); ctx.fill(); ctx.stroke();
    if (wall) {
      poly(ctx, [[x + w, y, z], [x + w, y + d, z], [x + w, ym, zt]]);
      ctx.fillStyle = shade(wall, -0.3); ctx.fill(); ctx.stroke();
    }
    poly(ctx, [[X0, Y1, z], [X1, Y1, z], [X1, ym, zt], [X0, ym, zt]]);
    ctx.fillStyle = color; ctx.fill(); ctx.stroke();
    poly(ctx, [[X1, Y0, z], [X1, Y1, z], [X1, ym, zt]]);
    ctx.fillStyle = shade(color, -0.35); ctx.fill(); ctx.stroke();
  } else {
    const xm = x + w / 2;
    poly(ctx, [[X0, Y0, z], [X0, Y1, z], [xm, Y1, zt], [xm, Y0, zt]]);
    ctx.fillStyle = shade(color, -0.1); ctx.fill(); ctx.stroke();
    if (wall) {
      poly(ctx, [[x, y + d, z], [x + w, y + d, z], [xm, y + d, zt]]);
      ctx.fillStyle = shade(wall, -0.08); ctx.fill(); ctx.stroke();
    }
    poly(ctx, [[X1, Y0, z], [X1, Y1, z], [xm, Y1, zt], [xm, Y0, zt]]);
    ctx.fillStyle = shade(color, -0.32); ctx.fill(); ctx.stroke();
    poly(ctx, [[X0, Y1, z], [X1, Y1, z], [xm, Y1, zt]]);
    ctx.fillStyle = shade(color, -0.18); ctx.fill(); ctx.stroke();
  }
}

/** Telhado piramidal (4 águas até um ápice). */
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} w @param {number} d @param {number} z @param {number} rh @param {string} color */
export function pyramidRoof(ctx, x, y, w, d, z, rh, color) {
  const o = 3;
  const X0 = x - o, X1 = x + w + o, Y0 = y - o, Y1 = y + d + o;
  const ax = x + w / 2, ay = y + d / 2, az = z + rh;
  ctx.lineWidth = 1;
  ctx.strokeStyle = EDGE;
  poly(ctx, [[X0, Y1, z], [X1, Y1, z], [ax, ay, az]]);
  ctx.fillStyle = shade(color, -0.05); ctx.fill(); ctx.stroke();
  poly(ctx, [[X1, Y0, z], [X1, Y1, z], [ax, ay, az]]);
  ctx.fillStyle = shade(color, -0.32); ctx.fill(); ctx.stroke();
}

/**
 * Retângulo pintado numa face vertical (janela/porta). face 'L' = gy=y+d, 'R' = gx=x+w.
 * u = posição ao longo da face (0..1), z = altura da base, fw/fh = tamanho (chão/px).
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x:number,y:number,w:number,d:number}} b
 * @param {'L'|'R'} face @param {number} u @param {number} z @param {number} fw @param {number} fh @param {string} color
 */
export function facePatch(ctx, b, face, u, z, fw, fh, color) {
  ctx.fillStyle = color;
  if (face === 'L') {
    const gx = b.x + b.w * u, gy = b.y + b.d + 0.1;
    poly(ctx, [[gx - fw / 2, gy, z], [gx + fw / 2, gy, z], [gx + fw / 2, gy, z + fh], [gx - fw / 2, gy, z + fh]]);
  } else {
    const gy = b.y + b.d * u, gx = b.x + b.w + 0.1;
    poly(ctx, [[gx, gy - fw / 2, z], [gx, gy + fw / 2, z], [gx, gy + fw / 2, z + fh], [gx, gy - fw / 2, z + fh]]);
  }
  ctx.fill();
}

/** Sombra projetada no chão (sol a oeste/noroeste). @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} w @param {number} d @param {number} h */
export function castShadow(ctx, x, y, w, d, h) {
  const sx = h * 0.75, sy = -h * 0.2;
  const pts = [[x, y], [x + w, y], [x + w, y + d], [x, y + d]];
  const hull = convexHull([...pts, ...pts.map(([a, b]) => [a + sx, b + sy])]);
  ctx.fillStyle = 'rgba(10,20,5,0.24)';
  poly(ctx, hull.map(([a, b]) => [a, b, 0]));
  ctx.fill();
}

/** Monotone chain. @param {number[][]} pts @returns {number[][]} */
function convexHull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  /** @param {number[]} o @param {number[]} a @param {number[]} b */
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  /** @type {number[][]} */ const lo = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  /** @type {number[][]} */ const up = [];
  for (const q of p.reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/** Contorno de seleção da pegada (losango branco, como prédio selecionado no AoE). */
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} w @param {number} d */
export function selectFootprint(ctx, x, y, w, d) {
  poly(ctx, [[x - 6, y - 6, 0], [x + w + 6, y - 6, 0], [x + w + 6, y + d + 6, 0], [x - 6, y + d + 6, 0]]);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
