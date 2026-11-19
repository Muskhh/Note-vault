/* 轻记 Service Worker：更新版本时把 CACHE 里的 v1 改成 v2 即可 */
const CACHE = 'qingji-v14';
const ASSETS = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 带超时的网络请求：页面打开先拿网上最新版，超过 2.5 秒视为网络不可用 */
function fetchWithTimeout(req, ms){
  return new Promise((resolve, reject) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => { ctrl.abort(); reject(new Error('timeout')); }, ms);
    fetch(req, { signal: ctrl.signal }).then(
      r => { clearTimeout(timer); resolve(r); },
      err => { clearTimeout(timer); reject(err); }
    );
  });
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  const isPage = e.request.mode === 'navigate' || url.pathname.endsWith('/index.html');
  if (isPage){
    /* 页面：网络优先，拿不到才退回缓存副本 */
    e.respondWith(
      fetchWithTimeout(e.request, 2500).then(resp => {
        if (resp.ok){
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit ||
      fetch(e.request).then(resp => {
        if (resp.ok){
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => caches.match('./index.html'))
    )
  );
});
