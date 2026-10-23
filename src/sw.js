import { precacheAndRoute, cleanupOutdatedCaches, PrecacheFallbackPlugin } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'

// 立即激活并接管所有客户端（等价于 generateSW 模式下 autoUpdate 的行为）
self.skipWaiting()
self.addEventListener('activate', () => self.clients.claim())

// 预缓存全部构建产物（列表由 vite-plugin-pwa 构建时注入 __WB_MANIFEST）
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// 导航请求 NetworkFirst：永远优先走网络拿最新 index.html，绝不返回旧缓存壳页；
// 离线时兜底 precache 中的 index.html，保证 PWA 仍可离线打开
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'toolbox-navigation',
    networkTimeoutSeconds: 3,
    plugins: [
      new PrecacheFallbackPlugin({ fallbackURL: '/toolbox/index.html' })
    ]
  })
)
