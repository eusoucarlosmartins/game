// geometry.js — constantes de geometria do canvas (compartilhado entre sim e draw)
import { NUM_DEPOSITS } from './data.js';

export const W = 1280;
export const H = 720;
export const GROUND_Y = 320;
export const WAREHOUSE = { x: 80, y: 180, w: 130, h: 140 };
export const FACTORY_AREA = { x: 230, y: 180, w: 590, h: 140, gap: 10, slots: 3 };
export const CITY = { x: 1000, y: 150, w: 240, h: 170 };
export const MINE_SHAFT = { x: 100, top: GROUND_Y, bottom: H - 110, w: 50 };
export const TUNNEL = { x: 160, y: H - 160, w: W - 170, h: 90 };
export const DEPOSIT_W = TUNNEL.w / NUM_DEPOSITS;
export const ROAD = { y: GROUND_Y, x1: FACTORY_AREA.x + FACTORY_AREA.w + 20, x2: CITY.x };

export function factoryRect(i) {
  const slotW = (FACTORY_AREA.w - (FACTORY_AREA.slots - 1) * FACTORY_AREA.gap) / FACTORY_AREA.slots;
  return { x: FACTORY_AREA.x + i * (slotW + FACTORY_AREA.gap), y: FACTORY_AREA.y, w: slotW, h: FACTORY_AREA.h };
}
