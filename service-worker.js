const CACHE_NAME = 'chongdam-mobile-v1';

// 설치 시 캐시할 정적 파일
const STATIC_ASSETS = [
  './chongdam_digital_twin.html',
  './output/chongdam_bridge.glb',
  './icon-192.png',
  './icon-512.png',
  './manifest.json',
];

// 네트워크 우선으로 처리할 패턴 (실시간 데이터)
const NETWORK_FIRST_PATTERNS = [
  /sensor_data\.json$/,   // 현재 JSON (추후 API URL로 교체)
  /\/api\//,              // 추후 API 엔드포인트
];

// ── 설치 ─────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] 정적 파일 캐싱 중...');
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(e => console.warn('[SW] 캐시 실패:', url, e))
        )
      );
    })
  );
  self.skipWaiting();
});

// ── 활성화 ───────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] 구 캐시 삭제:', k);
          return caches.delete(k);
        })
      )
    )
  );
  self.clients.claim();
});

// ── 요청 가로채기 ────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // 네트워크 우선 (실시간 데이터)
  const isNetworkFirst = NETWORK_FIRST_PATTERNS.some(p => p.test(url));

  if (isNetworkFirst) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // 캐시 우선 → 없으면 네트워크 후 캐시 저장
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return res;
        });
      })
    );
  }
});
