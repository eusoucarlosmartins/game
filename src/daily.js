// daily.js — desafio diário: missão pré-definida com seed da data,
// mesma pra todos jogadores que entrarem no mesmo dia.
import { state, log } from './state.js';
import { fmtMoney } from './util.js';
import { spawnBurst, spawnText } from './particles.js';
import { CITY } from './geometry.js';

// Pool de desafios. Cada um tem:
// - id, name, desc curto
// - goal(state): retorna { progress, total, met } pra UI
// - setup(state): aplicado no início do desafio (modifica estado inicial)
// - reward: descrição da recompensa (visual, achievement local)
export const DAILY_CHALLENGES = [
  {
    id: 'sprint10',
    name: 'Sprint Industrial',
    desc: 'Cumpra 10 contratos em até 20 dias.',
    setup() { /* condições padrão */ },
    goal(s) {
      const completed = s.contractsCompleted || 0;
      const failed = (s.day || 1) > 20;
      return { progress: completed, total: 10, met: completed >= 10, failed };
    },
  },
  {
    id: 'magnata',
    name: 'Magnata Express',
    desc: 'Acumule $30.000 em ganhos totais em até 25 dias.',
    setup() { },
    goal(s) {
      const earnings = s.totalEarnings || 0;
      const failed = (s.day || 1) > 25;
      return { progress: Math.floor(earnings), total: 30000, met: earnings >= 30000, failed };
    },
  },
  {
    id: 'era5fast',
    name: 'Salto Histórico',
    desc: 'Alcance a Era 5 em até 30 dias.',
    setup() { },
    goal(s) {
      const era = s.eraReached || 1;
      const failed = (s.day || 1) > 30;
      return { progress: era, total: 5, met: era >= 5, failed };
    },
  },
  {
    id: 'aprovacao',
    name: 'Querido pelo Povo',
    desc: 'Mantenha 80%+ aprovação por 15 dias seguidos.',
    setup() { state.approval = 60; },
    goal(s) {
      // Tracking aproximado: usa history pra ver quantos dias em sequência >=80
      const hist = s.history || [];
      let streak = 0, maxStreak = 0;
      for (const h of hist) {
        if (h.approval >= 80) { streak++; maxStreak = Math.max(maxStreak, streak); }
        else streak = 0;
      }
      return { progress: maxStreak, total: 15, met: maxStreak >= 15 };
    },
  },
  {
    id: 'mineiro',
    name: 'Mineiro Persistente',
    desc: 'Cave 500 tiles em até 25 dias.',
    setup() { },
    goal(s) {
      const tiles = s.tilesDug || 0;
      const failed = (s.day || 1) > 25;
      return { progress: tiles, total: 500, met: tiles >= 500, failed };
    },
  },
  {
    id: 'jardineiro',
    name: 'Construtor Cívico',
    desc: 'Conclua 3 projetos de obra em até 30 dias.',
    setup() { },
    goal(s) {
      const done = (s.projects?.completed || []).length;
      const failed = (s.day || 1) > 30;
      return { progress: done, total: 3, met: done >= 3, failed };
    },
  },
];

// Pega o desafio do dia (determinístico por YYYY-MM-DD)
export function todayChallenge() {
  const d = new Date();
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // hash simples da string da data → idx
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const idx = h % DAILY_CHALLENGES.length;
  return { ...DAILY_CHALLENGES[idx], dateKey: key };
}

// Chamado no init quando state.gameMode === 'daily'
export function setupDailyChallenge() {
  const c = todayChallenge();
  state.dailyChallenge = {
    id: c.id,
    name: c.name,
    desc: c.desc,
    dateKey: c.dateKey,
    completedAt: null,
    failedAt: null,
    startedAt: Date.now(),
  };
  c.setup && c.setup();
  log(`📅 Desafio do Dia (${c.dateKey}): ${c.name} — ${c.desc}`, 'good');
}

// Chamado a cada tick pra checar se o desafio terminou
export function checkDailyChallenge() {
  if (!state.dailyChallenge || state.dailyChallenge.completedAt || state.dailyChallenge.failedAt) return;
  const c = DAILY_CHALLENGES.find(x => x.id === state.dailyChallenge.id);
  if (!c) return;
  const status = c.goal(state);
  if (status.met) {
    state.dailyChallenge.completedAt = Date.now();
    log(`🏆 DESAFIO DIÁRIO COMPLETO: ${c.name}!`, 'good');
    const cx = CITY.x + CITY.w / 2;
    const cy = CITY.y + 60;
    spawnBurst(cx, cy, 50, '255,212,74', 'overworld');
    spawnText(cx, cy, '🏆 DESAFIO COMPLETO!', '255,212,74');
  } else if (status.failed) {
    state.dailyChallenge.failedAt = Date.now();
    log(`⏱ Desafio diário "${c.name}" expirou. Tente o de amanhã!`, 'bad');
  }
}

// Pra UI mostrar progresso
export function getDailyStatus() {
  if (!state.dailyChallenge) return null;
  const c = DAILY_CHALLENGES.find(x => x.id === state.dailyChallenge.id);
  if (!c) return null;
  const status = c.goal(state);
  return {
    name: c.name,
    desc: c.desc,
    progress: status.progress,
    total: status.total,
    met: status.met,
    failed: status.failed,
    completedAt: state.dailyChallenge.completedAt,
    failedAt: state.dailyChallenge.failedAt,
  };
}
