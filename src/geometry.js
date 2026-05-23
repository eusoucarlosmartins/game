// geometry.js — coordenadas do canvas em duas cenas distintas
// Cena 'overworld': mapa com mina + fábricas + cidade
// Cena 'mine': interior da mina (grid + silos + tools)

export const W = 1280;
export const H = 720;
// Mundo do overworld é maior que a viewport — câmera + drag-to-pan.
// Conteúdo inicial fica em (0,0)-(W,H); o mundo se estende pra direita/baixo.
export const WORLD_W = 2560;
export const WORLD_H = 1440;
// Minimap fixo no canto inferior-direito da tela (screen coords)
export const MINIMAP = { x: W - 200, y: H - 116, w: 190, h: 106 };

// ---------- Overworld (mapa) ----------
// Layout estilo mapa: minas pequenas espalhadas pelos 4 cantos,
// cidade + fábricas + mercado/pesquisa concentrados no meio.
export const OVERWORLD = {
  // Minas nos 4 cantos (menores que antes pra dar mais ar ao mapa)
  mineEntrances: [
    { x: 30, y: 130, w: 110, h: 100 },   // M1 superior-esquerda
    { x: 1140, y: 130, w: 110, h: 100 }, // M2 superior-direita
    { x: 30, y: 510, w: 110, h: 100 },   // M3 inferior-esquerda
    { x: 1140, y: 510, w: 110, h: 100 }, // M4 inferior-direita
  ],
  // Cluster de fábricas no centro
  factoryArea:  { x: 280, y: 340, w: 460, h: 180, gap: 12, slots: 3 },
  // Cidade central-direita (mais perto do meio que antes)
  city:         { x: 800, y: 180, w: 320, h: 340 },
  // Estrada curta entre fábricas e cidade
  road:         { y: 480, x1: 740, x2: 800 },
  // Linhas pontilhadas das minas até as fábricas mais próximas
  dottedMineToFactory: [
    { x1: 140, y1: 180, x2: 290, y2: 360 },  // M1 → F1
    { x1: 1140, y1: 180, x2: 730, y2: 360 }, // M2 → F3
    { x1: 140, y1: 560, x2: 290, y2: 520 },  // M3 → F1
    { x1: 1140, y1: 560, x2: 730, y2: 520 }, // M4 → F3
  ],
  // Nodos clicáveis nas laterais (entre os pares de minas)
  mercadoNode:  { x: 170, y: 400, w: 90,  h: 64 },
  pesquisaNode: { x: 1080, y: 400, w: 90,  h: 64 },
};

// Aliases pra manter compatibilidade com módulos existentes (wagon, draw)
export const CITY = OVERWORLD.city;
export const FACTORY_AREA = OVERWORLD.factoryArea;
export const ROAD = OVERWORLD.road;
export const GROUND_Y = 580; // linha de chão visual em overworld (mountains acima)

// Slots 0-2: cluster central original (próximo da estrada da carruagem).
// Slots 3+: espalhados pelos quadrantes expandidos do mundo, viram landmarks
// distantes (similar à referência onde fábricas pontilham o mapa todo).
const EXTRA_FACTORY_POSITIONS = [
  { x: 1500, y: 470, w: 145, h: 180 }, // F4: leste (perto de Itajaí)
  { x: 1700, y: 1000, w: 145, h: 180 }, // F5: sudeste (perto de Criciúma)
];
export function factoryRect(i) {
  if (i < FACTORY_AREA.slots) {
    const slotW = (FACTORY_AREA.w - (FACTORY_AREA.slots - 1) * FACTORY_AREA.gap) / FACTORY_AREA.slots;
    return {
      x: FACTORY_AREA.x + i * (slotW + FACTORY_AREA.gap),
      y: FACTORY_AREA.y,
      w: slotW,
      h: FACTORY_AREA.h,
    };
  }
  return EXTRA_FACTORY_POSITIONS[i - FACTORY_AREA.slots] || EXTRA_FACTORY_POSITIONS[0];
}

// ---------- Cena Mina ----------
// O grid em si fica na mesma posição (estável p/ click handlers)
export const MINE_GROUND_Y = 200; // linha entre superfície (silos) e mina
export const TOOLBAR = { x: 1220, y: 220, w: 60, slotH: 65 };
// Botão "Voltar ao Mapa" no canto superior esquerdo
export const MINE_BACK_BTN = { x: 12, y: 12, w: 168, h: 36 };
