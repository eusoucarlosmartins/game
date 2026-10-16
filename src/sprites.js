// sprites.js — carregador de SVG sprites via <img> para uso em ctx.drawImage.
// Sprites são carregados em background no boot. Se um sprite falhar ou
// ainda não carregou, o draw usa fallback procedural (nada quebra).

/** @type {Record<string, HTMLImageElement|undefined>} */
export const SPRITES = {};

const SPRITE_IDS = [
  'miner',
  'wagon-horse',
  'church',
  'house-yellow',
  'house-green',
  'factory',
  'tree',
  'mine-entrance',
  'mercado',
  'pesquisa',
];

/**
 * Dispara load de todos os sprites. Retorna promise que resolve quando
 * todos carregaram (ou falharam) — pode-se aguardar ou ignorar.
 * @returns {Promise<void>}
 */
export function loadSprites() {
  const promises = SPRITE_IDS.map((id) => loadOne(id));
  return Promise.all(promises).then(() => undefined);
}

/**
 * @param {string} id
 * @returns {Promise<HTMLImageElement|null>}
 */
function loadOne(id) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      SPRITES[id] = img;
      resolve(img);
    };
    img.onerror = () => {
      console.warn(`[sprites] ${id}.svg não carregou — usando fallback procedural`);
      resolve(null);
    };
    // Caminho relativo pra funcionar tanto em dev (public/) quanto em dist/
    img.src = `./sprites/${id}.svg`;
  });
}

/**
 * Retorna o sprite se carregado, ou null.
 * @param {string} id
 * @returns {HTMLImageElement|null}
 */
export function getSprite(id) {
  return SPRITES[id] || null;
}

/**
 * Helper: desenha sprite se disponível, caso contrário executa fallback().
 * Centraliza no (cx, cy) com largura w, mantendo aspect.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} id
 * @param {number} cx @param {number} cy @param {number} w
 * @param {boolean} flipH   Se true, espelha horizontalmente
 * @param {() => void} fallback
 */
export function drawSpriteCenteredOrFallback(ctx, id, cx, cy, w, flipH, fallback) {
  const img = getSprite(id);
  if (!img) { fallback(); return; }
  const aspect = img.height / img.width;
  const h = w * aspect;
  if (flipH) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  } else {
    ctx.drawImage(img, cx - w / 2, cy - h, w, h);
  }
}
