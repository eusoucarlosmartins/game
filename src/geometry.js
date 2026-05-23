// geometry.js — coordenadas do canvas em duas cenas distintas
// Cena 'overworld': mapa com mina + fábricas + cidade
// Cena 'mine': interior da mina (grid + silos + tools)

export const W = 1280;
export const H = 720;

// ---------- Overworld (mapa) ----------
export const OVERWORLD = {
  // Entrada da mina à esquerda — clicável
  mineEntrance: { x: 40,  y: 380, w: 240, h: 260 },
  // Cluster de fábricas no centro
  factoryArea:  { x: 380, y: 280, w: 380, h: 180, gap: 12, slots: 3 },
  // Cidade à direita
  city:         { x: 880, y: 200, w: 340, h: 420 },
  // Estrada por onde a carruagem vai/volta (entre fábricas e cidade)
  road:         { y: 490, x1: 770, x2: 880 },
  // Linha pontilhada decorativa entre mina e fábricas (raw materials "fluem")
  dottedMineToFactory: { y: 500, x1: 280, x2: 380 },
  // Nodos clicáveis (atalhos visíveis no mapa pra abas do sidebar)
  mercadoNode:  { x: 300, y: 540, w: 90,  h: 64 },
  pesquisaNode: { x: 820, y: 540, w: 90,  h: 64 },
};

// Aliases pra manter compatibilidade com módulos existentes (wagon, draw)
export const CITY = OVERWORLD.city;
export const FACTORY_AREA = OVERWORLD.factoryArea;
export const ROAD = OVERWORLD.road;
export const GROUND_Y = 580; // linha de chão visual em overworld (mountains acima)

export function factoryRect(i) {
  const slotW = (FACTORY_AREA.w - (FACTORY_AREA.slots - 1) * FACTORY_AREA.gap) / FACTORY_AREA.slots;
  return {
    x: FACTORY_AREA.x + i * (slotW + FACTORY_AREA.gap),
    y: FACTORY_AREA.y,
    w: slotW,
    h: FACTORY_AREA.h,
  };
}

// ---------- Cena Mina ----------
// O grid em si fica na mesma posição (estável p/ click handlers)
export const MINE_GROUND_Y = 200; // linha entre superfície (silos) e mina
export const TOOLBAR = { x: 1220, y: 220, w: 60, slotH: 65 };
// Botão "Voltar ao Mapa" no canto superior esquerdo
export const MINE_BACK_BTN = { x: 12, y: 12, w: 168, h: 36 };
