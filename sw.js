// 최소 서비스워커 — PWA 설치(바탕화면 아이콘) 활성화용. 네트워크 우선(별도 캐시 없음).
self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) { self.clients.claim(); });
self.addEventListener('fetch', function (e) { /* 네트워크로 통과 */ });
