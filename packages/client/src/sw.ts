const CACHE_NAME = 'clinic-shell-v1';
const SHELL_URL = '/';

interface ServiceWorkerEvent {
  waitUntil(promise: Promise<unknown>): void;
  request?: Request;
  respondWith?(response: Promise<Response>): void;
}

const SW = self as unknown as {
  addEventListener(type: 'install' | 'activate' | 'fetch', listener: (event: ServiceWorkerEvent) => void): void;
  skipWaiting(): void;
  clients: { claim(): Promise<void> };
  caches: CacheStorage;
};

SW.addEventListener('install', (event) => {
  event.waitUntil(
    SW.caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(SHELL_URL))
      .then(() => SW.skipWaiting()),
  );
});

SW.addEventListener('activate', (event) => {
  event.waitUntil(
    SW.caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => SW.caches.delete(key))),
      )
      .then(() => SW.clients.claim()),
  );
});

SW.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!request || request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith?.(networkFirst(request));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith?.(cacheFirst(request));
  }
});

async function networkFirst(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await SW.caches.open(CACHE_NAME);
      await cache.put(SHELL_URL, response.clone());
    }
    return response;
  } catch {
    const cached = await SW.caches.match(SHELL_URL);
    if (cached) {
      return cached;
    }
    return new Response('You are offline', { status: 503, statusText: 'Offline' });
  }
}

async function cacheFirst(request: Request): Promise<Response> {
  const cached = await SW.caches.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    const cache = await SW.caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}
