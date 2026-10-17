// victory.js — três caminhos para vencer (estilo AoE): Maravilha, Conquista e
// Política. Depois de vencer dá para continuar jogando a mesma partida.
import { state } from './state.js';
import { currentEra } from './progression.js';
import { rivals, army } from './military.js';

export const POLITICAL = { era: 6, contracts: 120, approval: 100, day: 90 };

export function victoryProgress() {
  const rv = rivals();
  const terr = army().territories || {};
  return {
    wonder: !!(state.wonder && state.wonder.done),
    conquest: { have: rv.filter((r) => terr[r.id]).length, need: rv.length },
    political: {
      era: currentEra(), contracts: state.contractsCompleted || 0,
      approval: Math.round(state.approval || 0), day: state.day || 0,
    },
  };
}

/** @returns {{kind: 'wonder'|'conquest'|'political', title: string, text: string} | null} */
export function checkVictory() {
  if (state.victory) return null;
  if (state.wonder && state.wonder.won) {
    return { kind: 'wonder', title: 'Vitória pela Maravilha!',
      text: `A Ponte Hercílio Luz atravessa o rio, de pé e iluminada. Em ${state.day} dias, a Tapuia deixou sua marca em Santa Catarina.` };
  }
  const p = victoryProgress();
  if (p.conquest.need > 0 && p.conquest.have >= p.conquest.need) {
    return { kind: 'conquest', title: 'Vitória pela Conquista!',
      text: `Todas as fronteiras renderam-se à Tapuia em ${state.day} dias. Os territórios rivais pagam tributo a Santa Catarina.` };
  }
  const pol = p.political;
  if (pol.era >= POLITICAL.era && pol.contracts >= POLITICAL.contracts && pol.approval >= POLITICAL.approval && pol.day >= POLITICAL.day) {
    return { kind: 'political', title: 'Vitória política!',
      text: `Era final, ${pol.contracts} contratos e aprovação máxima após ${pol.day} dias. Santa Catarina prospera sob a Tapuia.` };
  }
  return null;
}
