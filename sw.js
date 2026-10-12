// Offline support: cache-first for the game's own files, refreshed in the background.
const CACHE = 'sa2-v1.0.0';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/main.js', 'js/engine.js', 'js/game.js', 'js/input.js', 'js/font.js', 'js/render.js', 'js/audio.js',
  'js/phone.js', 'js/screens.js', 'js/settings.js', 'js/i18n.js', 'js/strings_orig.js', 'js/touch.js', 'js/portmenu.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  ...['back', 'bomb', 'crane', 'crates', 'font', 'hat', 'jumps', 'lives', 'wall', 'logo2', 'mos', 'siemens', 'title', 'tick',
    'man', 'man2', 'man3', 'man4', 'woman', 'woman2', 'iconman', 'iconman2', 'iconman3', 'iconman4', 'icwoman', 'icwoman2'].map((n) => `assets/img/${n}.png`),
  ...['bang', 'ouch', 'jump', 'tick', 'boxland', 'cranedrp'].map((n) => `assets/snd/${n}.wav`),
  ...['title', 'gameover', 'extra', 'fullrow'].map((n) => `assets/mus/${n}.mid`),
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req, { ignoreSearch: true });
      const net = fetch(req)
        .then((res) => {
          if (res.ok) c.put(req, res.clone());
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
