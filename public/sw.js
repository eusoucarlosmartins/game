// sw.js — service worker para Tapuia (PWA offline-capable)
// Estratégia: stale-while-revalidate
//   - Servir do cache se houver
//   - Atualizar o cache em background
//   - Fallback offline retorna o index.html cacheado
// IMPORTANTE: bumpe a versão sempre que tiver mudança quebra-cache.
const CACHE = 'tapuia-v42';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // Pre-cacheia somente o shell; assets com hash entram on-demand
      Promise.all(APP_SHELL.map((u) => c.add(u).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const old = (await caches.keys()).filter((k) => k !== CACHE);
    await Promise.all(old.map((k) => caches.delete(k)));
    await self.clients.claim();
    // Atualização (havia cache de versão anterior): recarrega as abas abertas
    // para ninguém continuar rodando o código antigo servido do cache.
    if (old.length) {
      const wins = await self.clients.matchAll({ type: 'window' });
      wins.forEach((w) => w.navigate(w.url).catch(() => {}));
    }
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((resp) => {
        if (resp && resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
        }
        return resp;
      }).catch(() => cached || caches.match('./index.html'));
      return cached || fetchPromise;
    })
  );
});
