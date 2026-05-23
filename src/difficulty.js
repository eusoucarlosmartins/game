// difficulty.js — modos de dificuldade aplicados via multiplicadores.
// state.difficulty é setado no início de novo jogo e fica fixo até reset.
import { state } from './state.js';

export const DIFFICULTIES = [
  {
    id: 'easy',
    name: 'Fácil',
    desc: 'Dobro do dinheiro inicial, +30% de mineração e contratos, perdas de aprovação reduzidas.',
    emoji: '🌿',
    mults: { startMoney: 2.0, mineRate: 1.3, contractReward: 1.3, approvalLoss: 0.7 },
  },
  {
    id: 'normal',
    name: 'Normal',
    desc: 'Balanceamento padrão do jogo.',
    emoji: '⚖',
    mults: { startMoney: 1.0, mineRate: 1.0, contractReward: 1.0, approvalLoss: 1.0 },
  },
  {
    id: 'hard',
    name: 'Difícil',
    desc: 'Metade do dinheiro inicial, -20% em mineração e contratos, perdas de aprovação maiores.',
    emoji: '🔥',
    mults: { startMoney: 0.5, mineRate: 0.8, contractReward: 0.8, approvalLoss: 1.3 },
  },
];

const BY_ID = Object.fromEntries(DIFFICULTIES.map(d => [d.id, d]));

export function getDifficulty() {
  return BY_ID[state.difficulty || 'normal'] || BY_ID.normal;
}

export function diffMul(key) {
  return getDifficulty().mults[key] ?? 1;
}

export function setDifficulty(id) {
  if (BY_ID[id]) state.difficulty = id;
}
