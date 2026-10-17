// fx.js — efeitos passageiros da mina: lascas, textos flutuantes e tremor de câmera.
// Nada daqui é salvo; tudo some sozinho.

/** @typedef {{x:number,y:number,vx:number,vy:number,life:number,max:number,color:string,size:number}} Particle */
/** @typedef {{x:number,y:number,text:string,color:string,life:number,max:number}} FloatText */

/** @type {Particle[]} */
const particles = [];
/** @type {FloatText[]} */
const texts = [];
export const shake = { amount: 0 };
let last = 0;

/** Lascas saindo de um ponto. @param {number} x @param {number} y @param {string} color @param {number} [n] @param {number} [power] */
export function fxBurst(x, y, color, n = 10, power = 1) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (40 + Math.random() * 90) * power;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40 * power, life: 0, max: 0.5 + Math.random() * 0.4, color, size: 2 + Math.random() * 2.5 });
  }
  if (particles.length > 400) particles.splice(0, particles.length - 400);
}

/** Texto subindo e sumindo. @param {number} x @param {number} y @param {string} text @param {string} [color] */
export function fxText(x, y, text, color = '#ffd44a') {
  texts.push({ x, y, text, color, life: 0, max: 1.3 });
  if (texts.length > 30) texts.shift();
}

/** @param {number} amount pixels de tremor */
export function fxShake(amount) {
  shake.amount = Math.max(shake.amount, amount);
}

/** Desenha e avança os efeitos (espaço do mundo da mina). @param {CanvasRenderingContext2D} ctx */
export function drawFx(ctx) {
  const now = performance.now() / 1000;
  const dt = last ? Math.min(0.05, now - last) : 0;
  last = now;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt;
    if (p.life >= p.max) { particles.splice(i, 1); continue; }
    p.vy += 260 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    ctx.globalAlpha = 1 - p.life / p.max;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 13px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i];
    t.life += dt;
    if (t.life >= t.max) { texts.splice(i, 1); continue; }
    const k = t.life / t.max;
    ctx.globalAlpha = 1 - k * k;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(t.text, t.x + 1, t.y - k * 34 + 1);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y - k * 34);
  }
  ctx.globalAlpha = 1;
  shake.amount = Math.max(0, shake.amount - dt * 30);
}

/** Deslocamento atual do tremor. */
export function shakeOffset() {
  if (shake.amount <= 0.1) return { x: 0, y: 0 };
  return { x: (Math.random() - 0.5) * shake.amount, y: (Math.random() - 0.5) * shake.amount };
}
