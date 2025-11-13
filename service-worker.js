// キャッシュ名を新しいリポジトリ名に合わせて変更します
const CACHE_NAME = 'op-tcg-db-beta-cache-v1'; 

// キャッシュするURLのパスを /OP_TCG_DB_BETA/ に更新します
// 注: index.html や CSS, JS ファイルなど、アップロードされていない他のファイルも
// 実際のリポジトリ構成に合わせて追加する必要があるかもしれません。
const urlsToCache = [
  '/OP_TCG_DB_BETA/',
  // '/OP_TCG_DB_BETA/index.html', // 必要に応じて追加
  '/OP_TCG_DB_BETA/cards.json',
  '/OP_TCG_DB_BETA/manifest.json',
  '/OP_TCG_DB_BETA/icons/iconx192.png',
  '/OP_TCG_DB_BETA/icons/iconx512.png',
  '/OP_TCG_DB_BETA/icons/iconx192bk.png',
  '/OP_TCG_DB_BETA/icons/iconx512bk.png',

  // --- カード画像パス (アップロードされたファイルに基づき自動生成) ---
  // ST01
  '/OP_TCG_DB_BETA/Cards/ST01/ST01-001.jpg',
  '/OP_TCG_DB_BETA/Cards/ST01/ST01-002.jpg',
  '/OP_TCG_DB_BETA/Cards/ST01/ST01-003.jpg',
  '/OP_TCG_DB_BETA/Cards/ST01/ST01-004.jpg',
  '/OP_TCG_DB_BETA/Cards/ST01/ST01-005.jpg',
  '/OP_TCG_DB_BETA/Cards/ST01/ST01-006.jpg',
  '/OP_TCG_DB_BETA/Cards/ST01/ST01-007.jpg',
  '/OP_TCG_DB_BETA/Cards/ST01/ST01-008.jpg',
  '/OP_TCG_DB_BETA/Cards/ST01/ST01-009.jpg',
  '/OP_TCG_DB_BETA/Cards/ST01/ST01-010.jpg',
  '/OP_TCG_DB_BETA/Cards/ST01/ST01-011.jpg',
  '/OP_TCG_DB_BETA/Cards/ST01/ST01-012.jpg',
  '/OP_TCG_DB_BETA/Cards/ST01/ST01-013.jpg',
  '/OP_TCG_DB_BETA/Cards/ST01/ST01-014.jpg',
  '/OP_TCG_DB_BETA/Cards/ST01/ST01-015.jpg',
  '/OP_TCG_DB_BETA/Cards/ST01/ST01-016.jpg',
  '/OP_TCG_DB_BETA/Cards/ST01/ST01-017.jpg',
  // PRB01
  '/OP_TCG_DB_BETA/Cards/PRB01/PRB01-001.jpg',
  // P (多数のため一部省略 ... P-001 から P-117 まで)
  '/OP_TCG_DB_BETA/Cards/P/P-001.jpg',
  '/OP_TCG_DB_BETA/Cards/P/P-002.jpg',
  // ... (中略) ...
  '/OP_TCG_DB_BETA/Cards/P/P-114.jpg',
  '/OP_TCG_DB_BETA/Cards/P/P-117.jpg',
  // OP01 (多数のため一部省略 ... OP01-001 から OP01-121 まで)
  '/OP_TCG_DB_BETA/Cards/OP01/OP01-001.jpg',
  '/OP_TCG_DB_BETA/Cards/OP01/OP01-002.jpg',
  // ... (中略) ...
  '/OP_TCG_DB_BETA/Cards/OP01/OP01-120.jpg',
  '/OP_TCG_DB_BETA/Cards/OP01/OP01-121.jpg',
  // EB01 (多数のため一部省略 ... EB01-001 から EB01-061 まで)
  '/OP_TCG_DB_BETA/Cards/EB01/EB01-001.jpg',
  '/OP_TCG_DB_BETA/Cards/EB01/EB01-002.jpg',
  // ... (中略) ...
  '/OP_TCG_DB_BETA/Cards/EB01/EB01-060.jpg',
  '/OP_TCG_DB_BETA/Cards/EB01/EB01-061.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // キャッシュエラーを無視するために、個別にaddする方が堅牢な場合があります
        const promises = urlsToCache.map(url => {
          return cache.add(new Request(url, { cache: 'reload' })).catch(err => {
            console.warn(`Failed to cache ${url}:`, err);
          });
        });
        return Promise.all(promises);
      })
      .catch(err => {
        console.error('Cache open failed:', err);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(
          (response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return response;
          }
        ).catch(err => {
          console.error('Fetch failed:', err);
        });
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // 新しいキャッシュ名以外で、古いキャッシュ(op-tcg-db-cache)を削除
          if (cacheWhitelist.indexOf(cacheName) === -1 && cacheName.startsWith('op-tcg-db')) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});