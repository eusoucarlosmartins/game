// seasons.js — sistema de estações do ano que afetam mineração, fábricas,
// transporte e mercado. Ciclo de 20 dias (5 dias por estação) baseado em
// state.day. Idéia: planejamento estratégico de longo prazo — saber que o
// inverno trava produção te força a estocar antes.
import { state } from './state.js';

export const SEASONS = [
  {
    id: 'verao',
    name: 'Verão',
    emoji: '☀',
    color: '#f5d27a',
    mults: { mine: 1.0, factory: 1.0, wagon: 1.0, market: 1.15 },
    desc: 'Turistas no porto — mercado paga +15%.',
  },
  {
    id: 'outono',
    name: 'Outono',
    emoji: '🍂',
    color: '#c97a3a',
    mults: { mine: 1.0, factory: 1.1, wagon: 1.0, market: 1.0 },
    desc: 'Colheita farta — fábricas +10%.',
  },
  {
    id: 'inverno',
    name: 'Inverno',
    emoji: '❄',
    color: '#aac8d8',
    mults: { mine: 0.85, factory: 1.0, wagon: 0.9, market: 1.0 },
    desc: 'Frio nas serras — mineração -15%, transporte -10%.',
  },
  {
    id: 'primavera',
    name: 'Primavera',
    emoji: '🌸',
    color: '#d8a4c8',
    mults: { mine: 1.05, factory: 1.05, wagon: 1.05, market: 1.0 },
    desc: 'Tudo floresce — +5% em quase tudo.',
  },
];

const DAYS_PER_SEASON = 5;
const SEASONS_PER_YEAR = 4;
const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS_PER_YEAR; // 20

export function currentSeason() {
  const dayInYear = ((state.day - 1) % DAYS_PER_YEAR);
  const idx = Math.floor(dayInYear / DAYS_PER_SEASON);
  return SEASONS[idx] || SEASONS[0];
}

export function seasonMul(key) {
  return currentSeason().mults[key] ?? 1;
}

export function currentYear() {
  return Math.floor((state.day - 1) / DAYS_PER_YEAR) + 1;
}

export function dayInSeason() {
  const dayInYear = ((state.day - 1) % DAYS_PER_YEAR);
  return (dayInYear % DAYS_PER_SEASON) + 1;
}
