const CACHE_NAME = "mahjong-scorebook-v15-confirm-modal-fix";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const requestUrl = new URL(request.url);

  // SupabaseやCDNなど、別ドメインへの通信は一切キャッシュしない。
  // ブラウザーが常にネットワークから最新データを取得する。
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // GET以外の保存・更新・削除通信はService Workerで処理しない。
  if (request.method !== "GET") {
    return;
  }

  // HTMLの画面遷移はネットワーク優先。
  // オフライン時だけ、保存済みのindex.htmlを表示する。
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache =>
              cache.put("./index.html", copy)
            );
          }
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // manifestやアイコンなど、同一ドメインの静的ファイルはキャッシュ利用。
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        if (!response || !response.ok) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return response;
      });
    })
  );
});
