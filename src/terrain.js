// terrain.js — mapa estilo Age of Empires: terreno pré-renderizado (grama, penhasco,
// rio, florestas, trilhas) + ambiente animado (água, animais, aldeões, nuvens, minimapa)
import { W, H, OVERWORLD } from './geometry.js';

/** @typedef {[number, number]} Pt */

/** @param {number} seed */
function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** @type {Pt[]} */
export const RIVER = [[842, -20], [830, 50], [818, 140], [836, 255], [812, 375], [825, 490], [846, 600], [824, 740]];
export const BRIDGE = { x1: 790, x2: 862 };
const RIVER_GAP = { x1: 796, x2: 860 };

/** Trilhas de terra de cada mina até o pátio das fábricas (aldeões andam nelas). @type {Pt[][]} */
export const MINE_PATHS = [
  [[178, 262], [255, 292], [325, 332], [386, 362]],
  [[184, 420], [270, 412], [386, 402]],
  [[182, 578], [255, 525], [325, 474], [386, 444]],
  [[182, 688], [235, 615], [262, 525], [325, 476], [386, 446]],
];
/** @type {Pt[][]} */
const OTHER_PATHS = [
  [[345, 532], [362, 492], [402, 464]],
  [[560, 466], [660, 486], [772, 490]],
  [[695, 540], [702, 496]],
  [[560, 654], [470, 622], [394, 590]],
  [[300, 218], [292, 285]],
  [[320, 214], [500, 202], [690, 206]],
  [[878, 490], [930, 538], [990, 578]],
];

export const VILLAGES = [
  { x: 300, y: 212, name: 'LAGES', scale: 0.75 },
  { x: 700, y: 200, name: 'SÃO JOAQUIM', scale: 0.65 },
  { x: 560, y: 660, name: 'CHAPECÓ', scale: 0.75 },
];

/** @param {number} x */
function cliffEdge(x) {
  return 76 + 13 * Math.sin(x * 0.012 + 0.5) + 7 * Math.sin(x * 0.037 + 2) + 3 * Math.sin(x * 0.11);
}
const CLIFF_FACE = 26;

// ---------- Amostragem de polilinhas (pra animar coisas ao longo de trilhas/rio) ----------
/** @param {Pt[]} pts */
function makeSampler(pts) {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) {
    acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = acc[acc.length - 1];
  /** @param {number} u 0..1 */
  function at(u) {
    const d = Math.max(0, Math.min(1, u)) * total;
    let i = 1;
    while (i < acc.length - 1 && acc[i] < d) i++;
    const seg = acc[i] - acc[i - 1] || 1;
    const k = (d - acc[i - 1]) / seg;
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k, dx: (bx - ax) / len, dy: (by - ay) / len };
  }
  return { total, at };
}
const riverSampler = makeSampler(RIVER);
const mineSamplers = MINE_PATHS.map(makeSampler);

/** @param {CanvasRenderingContext2D} g @param {Pt[]} pts */
function tracePath(g, pts) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const last = pts[pts.length - 1];
  g.lineTo(last[0], last[1]);
}

/**
 * @param {CanvasRenderingContext2D} g
 * @param {number} cx @param {number} cy @param {number} rx @param {number} ry
 * @param {string} rgb "r,g,b" @param {number} alpha
 */
function softEllipse(g, cx, cy, rx, ry, rgb, alpha) {
  g.save();
  g.translate(cx, cy);
  g.scale(1, ry / rx);
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  grd.addColorStop(0, `rgba(${rgb},${alpha})`);
  grd.addColorStop(0.65, `rgba(${rgb},${alpha * 0.85})`);
  grd.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grd;
  g.beginPath();
  g.arc(0, 0, rx, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// ---------- Pintura estática ----------
/** @param {CanvasRenderingContext2D} g @param {() => number} rnd */
function paintGrass(g, rnd) {
  g.fillStyle = '#6a8a35';
  g.fillRect(0, 0, W, H);
  const patch = ['127,156,69', '92,122,44', '138,162,76', '107,132,54', '150,160,80', '84,112,40'];
  for (let i = 0; i < 90; i++) {
    const r = 40 + rnd() * 110;
    softEllipse(g, rnd() * W, rnd() * H, r, r * (0.5 + rnd() * 0.4), patch[i % patch.length], 0.32);
  }
  const speck = ['#5a7a2c', '#7d9d44', '#58772a', '#86a44c', '#4c6a24', '#93ab55'];
  for (let i = 0; i < 6000; i++) {
    g.fillStyle = speck[i % speck.length];
    g.globalAlpha = 0.35 + rnd() * 0.4;
    g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2.5, 1 + rnd() * 1.5);
  }
  g.globalAlpha = 1;
  g.strokeStyle = 'rgba(62,88,28,0.55)';
  g.lineWidth = 1;
  for (let i = 0; i < 1100; i++) {
    const x = rnd() * W, y = rnd() * H;
    g.beginPath();
    g.moveTo(x - 2, y - 3); g.lineTo(x, y); g.lineTo(x + 2, y - 3);
    g.stroke();
  }
  const flowers = ['#f4e48a', '#ffffff', '#e8a0b8', '#f0c060'];
  for (let i = 0; i < 160; i++) {
    g.fillStyle = flowers[i % flowers.length];
    g.fillRect(rnd() * W, rnd() * H, 1.5, 1.5);
  }
}

/** @param {CanvasRenderingContext2D} g @param {number} cx @param {number} cy @param {number} rx @param {number} ry @param {() => number} rnd */
function dirtFoundation(g, cx, cy, rx, ry, rnd) {
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = 0.25 + rnd() * 0.3;
    softEllipse(g, cx + Math.cos(a) * rx * 0.8, cy + Math.sin(a) * ry * 0.8, rx * r, ry * r * 1.4, '146,114,66', 0.55);
  }
  softEllipse(g, cx, cy, rx, ry, '152,120,72', 0.95);
  softEllipse(g, cx, cy, rx * 0.7, ry * 0.7, '166,134,84', 0.5);
  for (let i = 0; i < rx * ry * 0.02; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.85;
    g.fillStyle = rnd() < 0.5 ? 'rgba(110,84,48,0.6)' : 'rgba(196,170,120,0.6)';
    g.fillRect(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, 1.5 + rnd() * 2, 1 + rnd());
  }
}

/** @param {CanvasRenderingContext2D} g @param {Pt[]} pts @param {() => number} rnd */
function dirtPath(g, pts, rnd) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  tracePath(g, pts);
  g.strokeStyle = 'rgba(96,74,40,0.35)';
  g.lineWidth = 20;
  g.stroke();
  g.strokeStyle = '#97764a';
  g.lineWidth = 14;
  g.stroke();
  g.strokeStyle = 'rgba(176,146,98,0.7)';
  g.lineWidth = 6;
  g.setLineDash([10, 7]);
  g.stroke();
  g.setLineDash([]);
  const s = makeSampler(pts);
  for (let i = 0; i < s.total / 3; i++) {
    const p = s.at(rnd());
    const off = (rnd() - 0.5) * 12;
    g.fillStyle = rnd() < 0.5 ? 'rgba(90,66,36,0.55)' : 'rgba(200,176,128,0.5)';
    g.fillRect(p.x - p.dy * off, p.y + p.dx * off, 1.5, 1.5);
  }
}

/** @param {CanvasRenderingContext2D} g */
function paintRiver(g) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const layers = [
    [70, '#b9a370'], [62, '#cdb985'], [52, '#5d8f8c'], [44, '#3f7590'],
    [34, '#30607e'], [18, '#29546f'],
  ];
  for (const [w, c] of layers) {
    tracePath(g, RIVER);
    g.strokeStyle = /** @type {string} */ (c);
    g.lineWidth = /** @type {number} */ (w);
    g.stroke();
  }
  tracePath(g, RIVER);
  g.strokeStyle = 'rgba(220,240,240,0.35)';
  g.lineWidth = 1.5;
  g.setLineDash([3, 9]);
  g.lineDashOffset = 0;
  g.translate(-17, 0); g.stroke(); g.translate(34, 0); g.stroke(); g.translate(-17, 0);
  g.setLineDash([]);
  // juncos nas margens
  g.strokeStyle = 'rgba(70,96,40,0.9)';
  g.lineWidth = 1;
  for (let i = 0; i < 70; i++) {
    const p = riverSampler.at((i * 0.6180339) % 1);
    const side = i % 2 ? 1 : -1;
    const bx = p.x - p.dy * side * 30, by = p.y + p.dx * side * 30;
    for (let k = -2; k <= 2; k += 2) {
      g.beginPath(); g.moveTo(bx + k, by); g.lineTo(bx + k * 1.6, by - 6); g.stroke();
    }
  }
}

/** @param {CanvasRenderingContext2D} g @param {() => number} rnd */
function paintCliffs(g, rnd) {
  /** @param {number} xa @param {number} xb */
  const segment = (xa, xb) => {
    // planalto
    g.beginPath();
    g.moveTo(xa, -1);
    for (let x = xa; x <= xb; x += 4) g.lineTo(x, cliffEdge(x));
    g.lineTo(xb, -1);
    g.closePath();
    g.fillStyle = '#5b7a2e';
    g.fill();
    g.save();
    g.clip();
    for (let i = 0; i < (xb - xa) * 1.6; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(70,96,34,0.6)' : 'rgba(120,146,64,0.5)';
      g.fillRect(xa + rnd() * (xb - xa), rnd() * 110, 2, 1.5);
    }
    g.restore();
    // sombra projetada no pé
    g.beginPath();
    for (let x = xa; x <= xb; x += 4) g.lineTo(x, cliffEdge(x) + CLIFF_FACE + 4);
    g.strokeStyle = 'rgba(20,30,10,0.28)';
    g.lineWidth = 12;
    g.stroke();
    // face de rocha
    g.beginPath();
    g.moveTo(xa, cliffEdge(xa));
    for (let x = xa; x <= xb; x += 4) g.lineTo(x, cliffEdge(x));
    for (let x = xb; x >= xa; x -= 6) g.lineTo(x, cliffEdge(x) + CLIFF_FACE + Math.sin(x * 0.3) * 3);
    g.closePath();
    const grd = g.createLinearGradient(0, 60, 0, 125);
    grd.addColorStop(0, '#9a8466');
    grd.addColorStop(1, '#5e4c38');
    g.fillStyle = grd;
    g.fill();
    for (let x = xa + 3; x < xb; x += 5 + rnd() * 5) {
      const y0 = cliffEdge(x);
      g.strokeStyle = rnd() < 0.6 ? 'rgba(40,28,18,0.45)' : 'rgba(190,172,140,0.35)';
      g.lineWidth = 1 + rnd();
      g.beginPath();
      g.moveTo(x, y0 + 3);
      g.lineTo(x + (rnd() - 0.5) * 5, y0 + CLIFF_FACE - 2);
      g.stroke();
    }
    g.beginPath();
    for (let x = xa; x <= xb; x += 4) g.lineTo(x, cliffEdge(x));
    g.strokeStyle = '#b8a582';
    g.lineWidth = 2;
    g.stroke();
    // pedregulhos caídos
    for (let i = 0; i < (xb - xa) / 30; i++) {
      const x = xa + rnd() * (xb - xa);
      const y = cliffEdge(x) + CLIFF_FACE + 2 + rnd() * 6;
      boulder(g, x, y, 3 + rnd() * 4);
    }
  };
  segment(0, RIVER_GAP.x1);
  segment(RIVER_GAP.x2, W);
  // cachoeira
  const y0 = cliffEdge(828) - 4;
  g.fillStyle = 'rgba(230,244,248,0.85)';
  g.fillRect(806, y0, 42, CLIFF_FACE + 8);
  g.strokeStyle = 'rgba(150,190,210,0.8)';
  g.lineWidth = 1.5;
  for (let x = 808; x < 846; x += 4) {
    g.beginPath(); g.moveTo(x, y0); g.lineTo(x + 1, y0 + CLIFF_FACE + 8); g.stroke();
  }
  for (let i = 0; i < 9; i++) softEllipse(g, 810 + i * 4.5, y0 + CLIFF_FACE + 10, 8, 5, '240,250,250', 0.8);
  boulder(g, RIVER_GAP.x1 + 4, cliffEdge(RIVER_GAP.x1) + 14, 9);
  boulder(g, RIVER_GAP.x2 - 4, cliffEdge(RIVER_GAP.x2) + 14, 9);
}

/** @param {CanvasRenderingContext2D} g @param {number} x @param {number} y @param {number} r */
function boulder(g, x, y, r) {
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath(); g.ellipse(x + r * 0.4, y + r * 0.5, r * 1.1, r * 0.45, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#7d776c';
  g.beginPath(); g.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#a49d90';
  g.beginPath(); g.ellipse(x - r * 0.3, y - r * 0.3, r * 0.45, r * 0.3, 0, 0, Math.PI * 2); g.fill();
}

/** @param {CanvasRenderingContext2D} g @param {number} x @param {number} y @param {number} s @param {() => number} rnd */
function oak(g, x, y, s, rnd) {
  g.fillStyle = 'rgba(15,25,5,0.28)';
  g.beginPath(); g.ellipse(x + 7 * s, y + 1, 14 * s, 5 * s, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#4a2f17';
  g.fillRect(x - 2 * s, y - 9 * s, 4 * s, 10 * s);
  const dark = ['#2c561d', '#335e21', '#28501c', '#3a6324'][Math.floor(rnd() * 4)];
  g.fillStyle = dark;
  for (const [dx, dy, r] of [[0, -17, 11], [-8, -12, 8], [8, -13, 8], [0, -9, 8]]) {
    g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#437528';
  for (const [dx, dy, r] of [[-3, -20, 7], [4, -17, 6], [-7, -14, 4]]) {
    g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#5d9136';
  for (const [dx, dy, r] of [[-5, -23, 3.2], [1, -21, 2.4], [-9, -16, 2]]) {
    g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); g.fill();
  }
}

/** @param {CanvasRenderingContext2D} g @param {number} x @param {number} y @param {number} s */
function pine(g, x, y, s) {
  g.fillStyle = 'rgba(15,25,5,0.28)';
  g.beginPath(); g.ellipse(x + 8 * s, y + 1, 11 * s, 4 * s, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#4a2f17';
  g.fillRect(x - 1.5 * s, y - 6 * s, 3 * s, 7 * s);
  for (let k = 0; k < 3; k++) {
    const by = y - 4 * s - k * 8 * s;
    const hw = (11 - k * 3) * s;
    const top = by - 13 * s;
    g.fillStyle = '#2a5a2a';
    g.beginPath(); g.moveTo(x - hw, by); g.lineTo(x, top); g.lineTo(x + hw, by); g.closePath(); g.fill();
    g.fillStyle = '#1d4220';
    g.beginPath(); g.moveTo(x, by + 1); g.lineTo(x, top); g.lineTo(x + hw, by); g.closePath(); g.fill();
    g.fillStyle = 'rgba(120,170,90,0.35)';
    g.beginPath(); g.moveTo(x - hw * 0.6, by - 3 * s); g.lineTo(x, top); g.lineTo(x - hw * 0.2, by - 2 * s); g.closePath(); g.fill();
  }
}

/** @param {CanvasRenderingContext2D} g @param {number} x @param {number} y */
function berryBush(g, x, y) {
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath(); g.ellipse(x + 3, y + 2, 9, 3, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2f5a22';
  g.beginPath(); g.arc(x - 3, y - 4, 6, 0, Math.PI * 2); g.arc(x + 4, y - 4, 6, 0, Math.PI * 2); g.arc(x, y - 8, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c0283a';
  for (const [dx, dy] of [[-4, -6], [2, -9], [5, -3], [-1, -3], [0, -11]]) g.fillRect(x + dx, y + dy, 2, 2);
}

/** @param {number} x @param {number} y */
function inExclusion(x, y) {
  const zones = [
    [0, 115, 205, 720], [365, 215, 775, 480], [285, 515, 405, 640], [635, 515, 755, 645],
    [868, 190, 1232, 640], [775, 0, 880, 720], [1100, 615, 1280, 720],
  ];
  for (const [x1, y1, x2, y2] of zones) if (x >= x1 && x <= x2 && y >= y1 && y <= y2) return true;
  for (const v of VILLAGES) if (Math.abs(x - v.x) < 40 && Math.abs(y - v.y) < 30) return true;
  for (const p of [...MINE_PATHS, ...OTHER_PATHS]) {
    const s = makeSampler(p);
    for (let u = 0; u <= 1; u += 8 / s.total) {
      const q = s.at(u);
      if (Math.hypot(q.x - x, q.y - y) < 18) return true;
    }
  }
  return false;
}

/** @param {CanvasRenderingContext2D} g @param {() => number} rnd */
function paintForests(g, rnd) {
  /** @type {{x:number,y:number,s:number,kind:'oak'|'pine'|'bush'}[]} */
  const trees = [];
  /** @param {number} x1 @param {number} x2 @param {number} y1 @param {number} y2 @param {number} step */
  const block = (x1, x2, y1, y2, step) => {
    for (let y = y1; y <= y2; y += step) {
      for (let x = x1; x <= x2; x += step) {
        const jx = x + (rnd() - 0.5) * step * 0.9;
        const jy = y + (rnd() - 0.5) * step * 0.7;
        if (jx > RIVER_GAP.x1 - 14 && jx < RIVER_GAP.x2 + 14) continue;
        trees.push({ x: jx, y: jy, s: 0.85 + rnd() * 0.35, kind: rnd() < 0.62 ? 'oak' : 'pine' });
      }
    }
  };
  // planalto: bosque esparso
  for (let x = 12; x < W; x += 26 + rnd() * 30) {
    if (x > RIVER_GAP.x1 - 20 && x < RIVER_GAP.x2 + 20) continue;
    const yMax = cliffEdge(x) - 4;
    if (yMax > 34) trees.push({ x, y: 30 + rnd() * (yMax - 30), s: 0.75 + rnd() * 0.25, kind: rnd() < 0.5 ? 'pine' : 'oak' });
  }
  // linha de floresta densa sob o penhasco
  for (let x = 8; x < W - 4; x += 13) {
    const top = cliffEdge(x) + CLIFF_FACE + 16;
    const bottom = x < 205 ? 122 : 182;
    for (let y = top; y <= bottom; y += 13) {
      const jx = x + (rnd() - 0.5) * 10;
      const jy = y + (rnd() - 0.5) * 8;
      if (jx > RIVER_GAP.x1 - 22 && jx < RIVER_GAP.x2 + 22) continue;
      if (jy > bottom - 12 && rnd() < 0.5) continue;
      trees.push({ x: jx, y: jy, s: 0.85 + rnd() * 0.35, kind: rnd() < 0.62 ? 'oak' : 'pine' });
    }
  }
  block(412, 516, 684, 728, 14);
  block(616, 772, 664, 728, 14);
  block(884, 1094, 690, 728, 14);
  block(1240, 1284, 200, 610, 14);
  // árvores soltas pela campina
  for (let i = 0; i < 220 && trees.length < 900; i++) {
    const x = rnd() * W, y = 190 + rnd() * (H - 190);
    if (inExclusion(x, y)) continue;
    trees.push({ x, y, s: 0.8 + rnd() * 0.3, kind: rnd() < 0.7 ? 'oak' : 'pine' });
  }
  for (const [x, y] of [[905, 652], [925, 662], [948, 650]]) trees.push({ x, y, s: 1, kind: 'bush' });
  trees.sort((a, b) => a.y - b.y);
  for (const t of trees) {
    if (t.kind === 'oak') oak(g, t.x, t.y, t.s, rnd);
    else if (t.kind === 'pine') pine(g, t.x, t.y, t.s);
    else berryBush(g, t.x, t.y);
  }
}

/** @param {CanvasRenderingContext2D} g */
function paintEdgeFog(g) {
  const v = g.createRadialGradient(W / 2, H / 2, 380, W / 2, H / 2, 820);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.38)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  const edge = 22;
  /** @type {[number, number, number, number, number, number, number, number][]} */
  const sides = [
    [0, 0, 0, edge, 0, 0, W, edge], [0, H, 0, H - edge, 0, H - edge, W, edge],
    [0, 0, edge, 0, 0, 0, edge, H], [W, 0, W - edge, 0, W - edge, 0, edge, H],
  ];
  for (const [ax, ay, bx, by, rx, ry, rw, rh] of sides) {
    const grd = g.createLinearGradient(ax, ay, bx, by);
    grd.addColorStop(0, 'rgba(0,0,0,0.75)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(rx, ry, rw, rh);
  }
}

// 2x: continua nítido com zoom e em telas retina
export const TERRAIN_RES = 2;
/** @type {HTMLCanvasElement | null} */
let terrainCache = null;

/** Canvas (1280x720 lógicos × TERRAIN_RES) com todo o terreno estático (gerado uma vez, determinístico). */
export function getTerrainCanvas() {
  if (terrainCache) return terrainCache;
  const c = document.createElement('canvas');
  c.width = W * TERRAIN_RES;
  c.height = H * TERRAIN_RES;
  const g = c.getContext('2d');
  if (!g) return c;
  g.scale(TERRAIN_RES, TERRAIN_RES);
  const rnd = mulberry32(1500);
  paintGrass(g, rnd);
  // fundações de terra batida
  const fa = OVERWORLD.factoryArea;
  dirtFoundation(g, fa.x + fa.w / 2, fa.y + fa.h - 20, fa.w * 0.62, 70, rnd);
  for (const e of OVERWORLD.mineEntrances) dirtFoundation(g, e.x + e.w / 2, e.y + e.h - 16, 92, 30, rnd);
  for (const n of [OVERWORLD.mercadoNode, OVERWORLD.pesquisaNode]) {
    dirtFoundation(g, n.x + n.w / 2, n.y + n.h - 6, 70, 26, rnd);
  }
  for (const v of VILLAGES) dirtFoundation(g, v.x, v.y - 2, 42, 16, rnd);
  dirtFoundation(g, OVERWORLD.city.x + OVERWORLD.city.w / 2, 588, 200, 46, rnd);
  for (const p of [...OTHER_PATHS, ...MINE_PATHS]) dirtPath(g, p, rnd);
  paintRiver(g);
  paintCliffs(g, rnd);
  paintForests(g, rnd);
  // pedras e ouro decorativos na campina
  for (const [x, y, r] of [[240, 470, 5], [252, 476, 4], [610, 560, 4], [360, 650, 5], [1110, 640, 4]]) boulder(g, x, y, r);
  paintEdgeFog(g);
  terrainCache = c;
  return c;
}

// ---------- Elementos animados ----------
/** @param {CanvasRenderingContext2D} ctx @param {number} t segundos */
function drawWater(ctx, t) {
  ctx.lineCap = 'round';
  for (let k = 0; k < 46; k++) {
    const u = (k * 0.0217 + t * 0.012) % 1;
    const p = riverSampler.at(u);
    if (p.y < cliffEdge(p.x) + CLIFF_FACE + 6 && p.y > 0) continue;
    const off = ((k * 37) % 28) - 14;
    const x = p.x - p.dy * off, y = p.y + p.dx * off;
    const a = 0.25 + 0.25 * Math.sin(t * 2 + k);
    ctx.strokeStyle = `rgba(225,245,250,${a})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - p.dx * 4, y - p.dy * 4);
    ctx.lineTo(x + p.dx * 4, y + p.dy * 4);
    ctx.stroke();
  }
  // peixes (ondulações)
  for (let k = 0; k < 3; k++) {
    const p = riverSampler.at(0.42 + k * 0.17);
    const ph = (t * 0.5 + k * 0.33) % 1;
    ctx.strokeStyle = `rgba(230,245,250,${0.6 * (1 - ph)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 2 + ph * 9, 1 + ph * 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // espuma da cachoeira
  const y0 = cliffEdge(828) + CLIFF_FACE + 6;
  for (let i = 0; i < 6; i++) {
    const ph = (t * 1.3 + i / 6) % 1;
    ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - ph)})`;
    ctx.beginPath();
    ctx.arc(808 + i * 7, y0 + ph * 14, 2 + ph * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} facing @param {number} graze */
function sheep(ctx, x, y, facing, graze) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x + 1, y + 3, 7, 2.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a2420';
  for (const dx of [-4, -1, 2, 4]) ctx.fillRect(x + dx, y, 1, 3);
  ctx.fillStyle = '#efeadf';
  ctx.beginPath(); ctx.ellipse(x, y - 2, 6.5, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fbf8f0';
  ctx.beginPath(); ctx.arc(x - 2, y - 4, 2.5, 0, Math.PI * 2); ctx.arc(x + 2, y - 4.5, 2.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a2420';
  ctx.beginPath(); ctx.ellipse(x + facing * 7, y - 3 + graze, 2.4, 1.8, 0, 0, Math.PI * 2); ctx.fill();
}

/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} facing @param {number} t */
function deer(ctx, x, y, facing, t) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x + 1, y + 4, 8, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a3a20';
  for (const dx of [-5, -3, 3, 5]) ctx.fillRect(x + dx, y - 1, 1, 5);
  ctx.fillStyle = '#9a6a3a';
  ctx.beginPath(); ctx.ellipse(x, y - 3, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  const look = Math.sin(t * 0.7) > 0.6 ? -2 : 0;
  ctx.beginPath(); ctx.ellipse(x + facing * 7, y - 7 + look, 2.5, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#4a2f17';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + facing * 7, y - 9 + look); ctx.lineTo(x + facing * 5, y - 13 + look);
  ctx.moveTo(x + facing * 8, y - 9 + look); ctx.lineTo(x + facing * 10, y - 13 + look);
  ctx.stroke();
  ctx.fillStyle = '#f1e3c2';
  ctx.fillRect(x - facing * 7, y - 4, 1.5, 1.5);
}

/**
 * Aldeão AoE: túnica na cor do jogador, chapéu de palha, carrega saco de minério.
 * @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y
 * @param {number} dir @param {number} step @param {string} color @param {boolean} carry
 */
export function drawVillager(ctx, x, y, dir, step, color, carry) {
  const leg = Math.sin(step) * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(x + 1, y + 1, 5, 1.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3a2614';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x - 1, y - 5); ctx.lineTo(x - 1 + leg, y);
  ctx.moveTo(x + 1, y - 5); ctx.lineTo(x + 1 - leg, y);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillRect(x - 3, y - 11, 6, 7);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + 1, y - 11, 2, 7);
  ctx.fillStyle = '#d9a77a';
  ctx.beginPath(); ctx.arc(x, y - 13.5, 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d8b25a';
  ctx.beginPath(); ctx.ellipse(x, y - 15.2, 4, 1.4, 0, 0, Math.PI * 2); ctx.fill();
  if (carry) {
    ctx.fillStyle = '#8a6a3a';
    ctx.beginPath(); ctx.arc(x - dir * 3.5, y - 10, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd44a';
    ctx.fillRect(x - dir * 3.5 - 1, y - 12, 2, 1.5);
  } else {
    ctx.strokeStyle = '#6a4a2a';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x - dir * 2, y - 12); ctx.lineTo(x + dir * 5, y - 17); ctx.stroke();
    ctx.strokeStyle = '#9a9a9a';
    ctx.beginPath(); ctx.moveTo(x + dir * 3, y - 18.5); ctx.lineTo(x + dir * 7, y - 15.5); ctx.stroke();
  }
}

/**
 * Camada animada sobre o terreno (antes dos prédios).
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ activeMines: boolean[], playerColor: string }} opts
 */
export function drawAmbientGround(ctx, opts) {
  const t = performance.now() / 1000;
  drawWater(ctx, t);
  const flock = [[915, 640], [962, 652], [1010, 638], [1060, 660], [990, 672]];
  flock.forEach(([bx, by], i) => {
    const ph = t * 0.12 + i * 1.7;
    const x = bx + Math.sin(ph) * 12;
    const facing = Math.cos(ph) >= 0 ? 1 : -1;
    const graze = Math.sin(t * 1.5 + i) > 0.3 ? 1.5 : 0;
    sheep(ctx, x, by, facing, graze);
  });
  deer(ctx, 575 + Math.sin(t * 0.08) * 20, 190, Math.cos(t * 0.08) >= 0 ? 1 : -1, t);
  deer(ctx, 1150 + Math.sin(t * 0.06 + 2) * 16, 192, Math.cos(t * 0.06 + 2) >= 0 ? 1 : -1, t + 3);
  for (let i = 0; i < mineSamplers.length; i++) {
    if (!opts.activeMines[i]) continue;
    const s = mineSamplers[i];
    for (let k = 0; k < 2; k++) {
      const u = (t * 26 / s.total + k * 0.95 + i * 0.37) % 2;
      const outbound = u < 1;
      const p = s.at(outbound ? u : 2 - u);
      const dir = (outbound ? p.dx : -p.dx) >= 0 ? 1 : -1;
      drawVillager(ctx, p.x, p.y + 2, dir, t * 9 + k, opts.playerColor, outbound);
    }
  }
}

/** Nuvens e pássaros: passam por cima de tudo, abaixo dos painéis. @param {CanvasRenderingContext2D} ctx */
export function drawAmbientSky(ctx) {
  const t = performance.now() / 1000;
  for (let k = 0; k < 3; k++) {
    const x = ((t * 7 + k * 520) % (W + 500)) - 250;
    const y = 170 + k * 200;
    ctx.fillStyle = 'rgba(10,20,5,0.07)';
    ctx.beginPath();
    ctx.ellipse(x, y, 110, 40, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 70, y + 12, 70, 30, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 60, y + 10, 60, 26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let k = 0; k < 2; k++) {
    const a = t * (0.22 + k * 0.07) + k * Math.PI;
    const r = 200 - k * 60;
    const x = 620 + Math.cos(a) * r;
    const y = 360 + Math.sin(a) * r * 0.55;
    const flap = Math.sin(t * 7 + k) * 3;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(x + 30, y + 45, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2a1a10';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - 7, y - flap); ctx.quadraticCurveTo(x - 3, y - 3, x, y);
    ctx.quadraticCurveTo(x + 3, y - 3, x + 7, y - flap);
    ctx.stroke();
  }
}

/**
 * Névoa negra ("terra inexplorada") sobre um slot de mina vazio.
 * @param {CanvasRenderingContext2D} ctx @param {{x:number,y:number,w:number,h:number}} r @param {boolean} hover
 */
export function drawShroud(ctx, r, hover) {
  const t = performance.now() / 1000;
  const a = hover ? 0.7 : 0.9;
  for (let k = 0; k < 9; k++) {
    const cx = r.x + r.w * (0.12 + 0.76 * ((k * 0.37) % 1));
    const cy = r.y + r.h * (0.15 + 0.7 * ((k * 0.61) % 1));
    const rad = 46 + (k % 3) * 14 + Math.sin(t * 0.6 + k) * 4;
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    grd.addColorStop(0, `rgba(6,5,3,${a})`);
    grd.addColorStop(0.6, `rgba(6,5,3,${a * 0.7})`);
    grd.addColorStop(1, 'rgba(6,5,3,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Elipse de seleção estilo AoE (branca, contorno escuro). */
/** @param {CanvasRenderingContext2D} ctx @param {number} cx @param {number} cy @param {number} rx @param {number} ry */
export function drawSelectionEllipse(ctx, cx, cy, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** Bandeirola tremulando na cor do jogador. */
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {string} color @param {string} accent */
export function drawPennant(ctx, x, y, color, accent) {
  const t = performance.now() / 1000;
  ctx.fillStyle = '#3a2614';
  ctx.fillRect(x - 1, y - 22, 2, 22);
  ctx.beginPath();
  ctx.moveTo(x + 1, y - 22);
  for (let i = 0; i <= 4; i++) {
    const px = x + 1 + i * 4;
    ctx.lineTo(px, y - 22 + Math.sin(t * 6 - i) * 1.4 + i * 0.6);
  }
  for (let i = 4; i >= 0; i--) {
    const px = x + 1 + i * 4;
    ctx.lineTo(px, y - 12 + Math.sin(t * 6 - i) * 1.4 - i * 0.6);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** @typedef {{ cx: number, cy: number, hw: number, hh: number }} MinimapLayout */

/** Minimapa no canto inferior direito do HUD. @param {number} hudW @param {number} hudH @returns {MinimapLayout} */
export function minimapLayout(hudW, hudH) {
  const hw = 80, hh = 44;
  return { cx: hudW - hw - 18, cy: hudH - hh - 14, hw, hh };
}

/** @param {MinimapLayout} L @param {number} x @param {number} y mundo → HUD */
function mmPoint(L, x, y) {
  const u = x / W, v = y / H;
  return { x: L.cx + (u - v) * L.hw, y: L.cy - L.hh + (u + v) * L.hh };
}

/** Ponto do HUD → mundo, ou null se fora do losango. @param {MinimapLayout} L @param {number} hx @param {number} hy */
export function minimapToWorld(L, hx, hy) {
  const a = (hx - L.cx) / L.hw;          // u - v
  const b = (hy - (L.cy - L.hh)) / L.hh; // u + v
  const u = (a + b) / 2, v = (b - a) / 2;
  if (u < -0.03 || u > 1.03 || v < -0.03 || v > 1.03) return null;
  return { x: Math.min(W, Math.max(0, u * W)), y: Math.min(H, Math.max(0, v * H)) };
}

/**
 * Minimapa em losango, como no AoE II, com o retângulo da área visível.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x:number,y:number,w:number,h:number,color:string}[]} markers
 * @param {MinimapLayout} L
 * @param {{x:number,y:number,w:number,h:number}} viewRect
 */
export function drawMinimap(ctx, markers, L, viewRect) {
  const { cx, cy, hw, hh } = L;
  const diamond = () => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh); ctx.lineTo(cx + hw, cy); ctx.lineTo(cx, cy + hh); ctx.lineTo(cx - hw, cy);
    ctx.closePath();
  };
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh - 8); ctx.lineTo(cx + hw + 14, cy); ctx.lineTo(cx, cy + hh + 8); ctx.lineTo(cx - hw - 14, cy);
  ctx.closePath();
  const plate = ctx.createLinearGradient(0, cy - hh, 0, cy + hh);
  plate.addColorStop(0, '#8a7a5e');
  plate.addColorStop(1, '#4e4232');
  ctx.fillStyle = plate;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#1a0e06';
  ctx.lineWidth = 2;
  ctx.stroke();
  diamond();
  ctx.save();
  ctx.clip();
  ctx.translate(cx, cy - hh);
  ctx.transform(hw / W, hh / W, -hw / H, hh / H, 0, 0);
  ctx.drawImage(getTerrainCanvas(), 0, 0, W, H);
  for (const m of markers) {
    ctx.fillStyle = '#000';
    ctx.fillRect(m.x - 8, m.y - 8, m.w + 16, m.h + 16);
    ctx.fillStyle = m.color;
    ctx.fillRect(m.x, m.y, m.w, m.h);
  }
  ctx.restore();
  // área visível na tela
  const x1 = Math.max(0, viewRect.x), y1 = Math.max(0, viewRect.y);
  const x2 = Math.min(W, viewRect.x + viewRect.w), y2 = Math.min(H, viewRect.y + viewRect.h);
  if (x2 - x1 < W - 1 || y2 - y1 < H - 1) {
    const pts = [mmPoint(L, x1, y1), mmPoint(L, x2, y1), mmPoint(L, x2, y2), mmPoint(L, x1, y2)];
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  diamond();
  ctx.strokeStyle = '#c69042';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}
