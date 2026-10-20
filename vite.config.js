import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  // 保留默认 public 目录，构建时将 public/app.json 复制到产物根目录（发布接口要求）
  publicDir: 'public',
  plugins: [
    uni(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['static/icons/favicon.svg'],
      manifest: {
        name: 'PDF 工具箱',
        short_name: 'PDF工具箱',
        description: '常用 PDF 处理工具：图片转PDF、PDF合并、PDF拆分、去水印、加水印、PDF转图片，全部本地处理。',
        theme_color: '#2f6bff',
        background_color: '#f5f7fa',
        display: 'standalone',
        // 桌面端安装后让内容延伸到标题栏区域，消除顶部空白条；移动端自动回退 standalone
        display_override: ['window-controls-overlay', 'standalone'],
        lang: 'zh-CN',
        id: '/',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'static/icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'static/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'static/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // pdf.worker 以 .mjs 输出，默认 glob 不包含，需显式加入
        globPatterns: ['**/*.{js,mjs,css,html,ico,png,svg,webmanifest,woff2}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024
      }
    })
  ]
})
