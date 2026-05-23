// ambience.js — nuvens e pássaros animados no overworld (puro visual).
// Inicializado preguiçosamente no primeiro update; depois só atualiza posições.
import { state } from './state.js';
import { WORLD_W, WORLD_H } from './geometry.js';

function initAmbience() {
  const amb = state.ambience;
  if (amb.initialized) return;
  // 6 nuvens distribuídas em y=20..160 (céu), com tamanhos e velocidades variadas
  amb.clouds = [];
  for (let i = 0; i < 6; i++) {
    amb.clouds.push({
      x: Math.random() * WORLD_W,
      y: 20 + Math.random() * 130,
      w: 80 + Math.random() * 100,
      h: 24 + Math.random() * 18,
      speed: 6 + Math.random() * 10,
      opacity: 0.55 + Math.random() * 0.3,
    });
  }
  amb.birds = [];
  amb.nextBirdIn = 4 + Math.random() * 8;
  amb.initialized = true;
}

export function updateAmbience(dt) {
  const amb = state.ambience;
  if (!amb) return;
  initAmbience();
  // Nuvens andam pra direita; wrap quando saem
  for (const c of amb.clouds) {
    c.x += c.speed * dt;
    if (c.x > WORLD_W + c.w) {
      c.x = -c.w;
      c.y = 20 + Math.random() * 130;
    }
  }
  // Pássaros: spawn periódico, voam diagonal, despawn quando saem
  amb.nextBirdIn -= dt;
  if (amb.nextBirdIn <= 0 && amb.birds.length < 5) {
    amb.nextBirdIn = 6 + Math.random() * 14;
    // Grupo de 2-4 pássaros voando juntos
    const count = 2 + Math.floor(Math.random() * 3);
    const baseX = -40;
    const baseY = 60 + Math.random() * 280;
    const vx = 80 + Math.random() * 60;
    const vy = (Math.random() - 0.5) * 20;
    for (let i = 0; i < count; i++) {
      amb.birds.push({
        x: baseX - i * 30,
        y: baseY + (i % 2) * 14 - 7,
        vx, vy,
        flapPhase: Math.random() * Math.PI * 2,
        life: 40, // sobe se sair da tela
      });
    }
  }
  for (let i = amb.birds.length - 1; i >= 0; i--) {
    const b = amb.birds[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.flapPhase += dt * 12;
    b.life -= dt;
    if (b.x > WORLD_W + 50 || b.y < -20 || b.y > WORLD_H || b.life <= 0) {
      amb.birds.splice(i, 1);
    }
  }
}

export function drawAmbience(ctx) {
  const amb = state.ambience;
  if (!amb || !amb.initialized) return;
  // Nuvens (atrás de tudo, mas dentro do translate do overworld)
  for (const c of amb.clouds) {
    ctx.fillStyle = `rgba(255,250,240,${c.opacity * 0.55})`;
    // Forma de nuvem: 3-4 elipses sobrepostas
    ctx.beginPath();
    ctx.ellipse(c.x + c.w * 0.3, c.y, c.w * 0.35, c.h * 0.7, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x + c.w * 0.55, c.y - c.h * 0.2, c.w * 0.32, c.h * 0.85, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x + c.w * 0.78, c.y + c.h * 0.05, c.w * 0.28, c.h * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Pássaros — V simples com flap animado
  for (const b of amb.birds) {
    const flap = Math.sin(b.flapPhase) * 4;
    ctx.strokeStyle = 'rgba(40,28,20,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Asa esquerda
    ctx.moveTo(b.x - 6, b.y + flap);
    ctx.lineTo(b.x, b.y);
    // Asa direita
    ctx.lineTo(b.x + 6, b.y + flap);
    ctx.stroke();
  }
}
