// reset.js — "começo do zero" global: na primeira abertura após um lançamento com
// época nova, apaga saves/preferências do jogo e os caches do app neste aparelho.
// Para zerar todo mundo de novo no futuro, basta trocar RESET_EPOCH.
export const RESET_EPOCH = '2026-10-17';
export const EPOCH_KEY = 'tapuia_epoch';

/**
 * @param {Storage} [storage]
 * @returns {boolean} true se apagou dados (jogador tinha uma época antiga ou nenhuma)
 */
export function freshStartIfNeeded(storage = globalThis.localStorage) {
  try {
    if (storage.getItem(EPOCH_KEY) === RESET_EPOCH) return false;
    const keys = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith('tapuia')) keys.push(k);
    }
    for (const k of keys) storage.removeItem(k);
    storage.setItem(EPOCH_KEY, RESET_EPOCH);
    if (typeof caches !== 'undefined') {
      caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))).catch(() => {});
    }
    return keys.length > 0;
  } catch {
    return false;
  }
}
