import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  // ── 主进程配置 ─────────────────────────────────────────
  main: {
    plugins: [
      // 将所有 node_modules 外部化（不打包进 bundle，运行时从 node_modules 加载）
      externalizeDepsPlugin(),
    ],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
      },
    },
  },

  // ── Preload 脚本配置 ────────────────────────────────────
  preload: {
    plugins: [externalizeDepsPlugin()],
  },

  // ── 渲染进程配置（React + Tailwind v4） ─────────────────
  renderer: {
    root: 'src/renderer',
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
        },
      },
    },
    plugins: [
      react(),
      tailwindcss(), // Tailwind v4 Vite 插件
    ],
    resolve: {
      alias: {
        // '@' 别名指向 renderer 的 src 目录，兼容现有 App.tsx 中的导入
        '@': resolve('src/renderer/src'),
      },
    },
  },
})
