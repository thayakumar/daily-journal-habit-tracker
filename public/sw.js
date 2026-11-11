const CACHE_NAME = 'journal-workspace-v2';
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('journal-') && key !== CACHE_NAME).map(key => caches.delete(key)))),
    clients.claim(),
  ]));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Never cache Google Sheets requests, third-party data, or writes.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) {
      const clone = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)));
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    if (event.request.mode === 'navigate') {
      const shell = await caches.match(self.registration.scope);
      if (shell) return shell;
    }
    return new Response('Offline. Open the app online once to cache it on this device.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }));
});
