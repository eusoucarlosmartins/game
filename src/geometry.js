// geometry.js — coordenadas do canvas (novo layout: mina ocupa boa parte da tela)
export const W = 1280;
export const H = 720;
export const GROUND_Y = 200; // linha de chão (superfície <-> mina)

// Superfície: silos à esquerda, fábricas + cidade à direita
export const FACTORY_AREA = { x: 760, y: 60, w: 300, h: 130, gap: 6, slots: 3 };
export const CITY = { x: 1090, y: 8, w: 140, h: 182 };
export const ROAD = { y: GROUND_Y - 12, x1: FACTORY_AREA.x + FACTORY_AREA.w + 6, x2: CITY.x };

// Painel de ferramentas (à direita do grid)
export const TOOLBAR = { x: 1220, y: 220, w: 60, slotH: 65 };

export function factoryRect(i) {
  const slotW = (FACTORY_AREA.w - (FACTORY_AREA.slots - 1) * FACTORY_AREA.gap) / FACTORY_AREA.slots;
  return { x: FACTORY_AREA.x + i * (slotW + FACTORY_AREA.gap), y: FACTORY_AREA.y, w: slotW, h: FACTORY_AREA.h };
}
