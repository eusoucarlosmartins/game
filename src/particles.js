// particles.js — sistema simples de partículas pra juice visual
// (floating numbers, sparks, dust). Sem física complexa, só vx/vy + gravidade
// opcional e fade out pela vida.
import { state } from './state.js';

/**
 * @typedef {object} Particle
 * @property {number} x — coord X (depende do scene; ver spawn)
 * @property {number} y
 * @property {number} vx — velocidade X (px/s)
 * @property {number} vy — velocidade Y (px/s)
 * @property {number} life — vida restante (s)
 * @property {number} total vida total inicial (pra calcular alpha)
 * @property {'text'|'spark'|'dust'} type
 * @property {string} scene cena ('overworld' ou 'mine') em que desenhar
 * @property {string} [text] pra type='text'
 * @property {number} [size] tamanho base (px)
 * @property {string} [color] "r,g,b" sem alpha
 * @property {number} [gravity] aceleracao vertical (px/s^2)
 */

/** @param {Partial<Particle>} p */
export function spawn(p) {
  const merged = {
    x: 0, y: 0, vx: 0, vy: 0,
    life: 1,
    type: 'spark',
    scene: 'overworld',
    size: 4,
    color: '255,212,74',
    gravity: 0,
    ...p,
  };
  merged.total = merged.life;
  state.particles.push(merged);
}

/** Floating "+$XXX" verde (good) ou "-$X" vermelho (bad) numa posição */
export function spawnMoneyText(x, y, amount, scene = 'overworld') {
  const good = amount > 0;
  spawn({
    x, y,
    vx: 0, vy: -28,
    life: 1.4,
    type: 'text',
    text: (good ? '+' : '') + (good ? `$${amount}` : `-$${-amount}`),
    color: good ? '77,160,77' : '168,46,28',
    size: 16,
    scene,
  });
}

/** Floating texto genérico (ex: "+10 PP", "+5 aprovação") */
export function spawnText(x, y, text, color = '255,212,74', scene = 'overworld') {
  spawn({
    x, y,
    vx: 0, vy: -22,
    life: 1.3,
    type: 'text',
    text,
    color,
    size: 13,
    scene,
  });
}

/** Vários sparks irradiando de um ponto (ex: TNT, project completed) */
export function spawnBurst(x, y, count = 12, color = '255,180,80', scene = 'overworld') {
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const spd = 60 + Math.random() * 80;
    spawn({
      x, y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      life: 0.5 + Math.random() * 0.4,
      type: 'spark',
      size: 3 + Math.random() * 2,
      color,
      gravity: 200,
      scene,
    });
  }
}

/** Poeira pequena (cavar terra/pedra) */
export function spawnDust(x, y, scene = 'mine') {
  for (let i = 0; i < 5; i++) {
    spawn({
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 4,
      vx: (Math.random() - 0.5) * 30,
      vy: -10 - Math.random() * 30,
      life: 0.4 + Math.random() * 0.3,
      type: 'dust',
      size: 2 + Math.random() * 2,
      color: '180,140,80',
      gravity: 80,
      scene,
    });
  }
}

export function updateParticles(dt) {
  if (!state.particles || state.particles.length === 0) return;
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.gravity) p.vy += p.gravity * dt;
    p.life -= dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

/**
 * Desenha as partículas do scene atual. ctx já deve estar no espaço de coords
 * apropriado (pra overworld: dentro do save+translate da câmera; pra mine:
 * dentro do clip+translate do grid).
 */
export function drawParticles(ctx, scene) {
  if (!state.particles || state.particles.length === 0) return;
  for (const p of state.particles) {
    if (p.scene !== scene) continue;
    const a = Math.min(1, p.life / p.total);
    if (p.type === 'text') {
      ctx.font = `bold ${p.size}px "Segoe UI", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Halo escuro pra legibilidade
      ctx.fillStyle = `rgba(20,10,5,${a * 0.7})`;
      ctx.fillText(p.text, p.x + 1, p.y + 1);
      ctx.fillStyle = `rgba(${p.color},${a})`;
      ctx.fillText(p.text, p.x, p.y);
    } else if (p.type === 'spark') {
      ctx.fillStyle = `rgba(${p.color},${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'dust') {
      ctx.fillStyle = `rgba(${p.color},${a * 0.7})`;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }
}
