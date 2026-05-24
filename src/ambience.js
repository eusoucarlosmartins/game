// ambience.js — nuvens e pássaros animados no overworld (puro visual).
// Inicializado preguiçosamente no primeiro update; depois só atualiza posições.
import { state } from './state.js';
import { WORLD_W, WORLD_H } from './geometry.js';
import { currentSeason } from './seasons.js';

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
  // Vacas pastando perto dos vilarejos/fazendas — posições fixas pra estabilidade
  // Partículas de estação (neve, folhas) — atualizadas só se a estação atual exigir
  amb.seasonParticles = [];
  amb.cows = [
    { x: 280, y: 690, phase: Math.random() * Math.PI * 2 },
    { x: 410, y: 700, phase: Math.random() * Math.PI * 2 },
    { x: 580, y: 685, phase: Math.random() * Math.PI * 2 },
    { x: 900, y: 690, phase: Math.random() * Math.PI * 2 },
    { x: 1520, y: 920, phase: Math.random() * Math.PI * 2 },
    { x: 1750, y: 1050, phase: Math.random() * Math.PI * 2 },
    { x: 720, y: 1140, phase: Math.random() * Math.PI * 2 },
    { x: 1480, y: 1180, phase: Math.random() * Math.PI * 2 },
  ];
  // Peixes saltando no rio (timers)
  amb.fishJumps = [];
  amb.nextFishIn = 3 + Math.random() * 5;
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
  // Vacas: só atualiza fase (pra cabeça balançar lentamente)
  for (const cow of amb.cows) cow.phase += dt * 0.8;
  // Peixes saltando: spawn periódico no rio (WORLD_W - 50)
  amb.nextFishIn -= dt;
  if (amb.nextFishIn <= 0) {
    amb.nextFishIn = 4 + Math.random() * 8;
    amb.fishJumps.push({
      x: WORLD_W - 40 + (Math.random() - 0.5) * 20,
      y: 200 + Math.random() * (WORLD_H - 300),
      life: 0.8,
      total: 0.8,
    });
  }
  for (let i = amb.fishJumps.length - 1; i >= 0; i--) {
    amb.fishJumps[i].life -= dt;
    if (amb.fishJumps[i].life <= 0) amb.fishJumps.splice(i, 1);
  }
  // Partículas de estação: neve no inverno, folhas no outono
  const season = currentSeason();
  if (season.id === 'inverno' || season.id === 'outono') {
    // mantém ~60 partículas caindo
    while (amb.seasonParticles.length < 60) {
      amb.seasonParticles.push({
        x: Math.random() * WORLD_W,
        y: -10 + Math.random() * WORLD_H,
        vx: season.id === 'outono' ? -20 + Math.random() * 40 : -8 + Math.random() * 16,
        vy: 25 + Math.random() * 35,
        size: 2 + Math.random() * 2,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 4,
        kind: season.id,
      });
    }
    for (const p of amb.seasonParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.rotSpeed * dt;
      if (p.y > WORLD_H + 10) {
        p.y = -10;
        p.x = Math.random() * WORLD_W;
      }
    }
  } else if (amb.seasonParticles.length > 0) {
    amb.seasonParticles = []; // limpa quando muda pra verão/primavera
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
    ctx.moveTo(b.x - 6, b.y + flap);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(b.x + 6, b.y + flap);
    ctx.stroke();
  }
  // Vacas pastando — corpo branco com manchas pretas, cabeça balançando
  for (const cow of amb.cows) {
    const bob = Math.sin(cow.phase) * 1;
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(cow.x - 8, cow.y + 6, 18, 2);
    // corpo branco
    ctx.fillStyle = '#f1e8d4';
    ctx.fillRect(cow.x - 8, cow.y - 2, 16, 8);
    // manchas pretas
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(cow.x - 6, cow.y - 1, 4, 3);
    ctx.fillRect(cow.x + 1, cow.y + 2, 5, 3);
    // pernas
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(cow.x - 6, cow.y + 6, 1.5, 4);
    ctx.fillRect(cow.x + 5, cow.y + 6, 1.5, 4);
    // cabeça (balançando lentamente)
    ctx.fillStyle = '#f1e8d4';
    ctx.fillRect(cow.x + 8, cow.y + 1 + bob, 5, 4);
    // orelhinha
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(cow.x + 8, cow.y + bob, 1, 1.5);
  }
  // Partículas de estação (neve/folhas) — desenhadas atrás dos prédios
  for (const p of amb.seasonParticles) {
    if (p.kind === 'inverno') {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // outono: folha pequena (retângulo rotacionado em laranja/marrom)
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = '#c97a3a';
      ctx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8);
      ctx.restore();
    }
  }
  // Peixes saltando — arco animado com pequeno respingo
  for (const f of amb.fishJumps) {
    const t = 1 - (f.life / f.total); // 0 → 1
    // arco parabólico do salto
    const arcY = f.y - Math.sin(t * Math.PI) * 14;
    ctx.fillStyle = `rgba(200,180,100,${0.9 - t * 0.5})`;
    // corpo peixe (elipse pequena)
    ctx.beginPath();
    ctx.ellipse(f.x, arcY, 4, 2.5, t * 0.6, 0, Math.PI * 2);
    ctx.fill();
    // cauda
    ctx.fillStyle = `rgba(180,150,80,${0.7 - t * 0.4})`;
    ctx.beginPath();
    ctx.moveTo(f.x - 4, arcY);
    ctx.lineTo(f.x - 7, arcY - 2);
    ctx.lineTo(f.x - 7, arcY + 2);
    ctx.closePath();
    ctx.fill();
    // respingo na queda
    if (t > 0.85) {
      ctx.strokeStyle = `rgba(255,255,255,${(t - 0.85) * 4})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
