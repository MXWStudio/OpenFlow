import type { UserConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'node:module'
import { resolve } from 'path'

// The CommonJS entry avoids a Babel ESM interop deadlock in newer Node runtimes.
const require = createRequire(import.meta.url)
const { defineConfig, externalizeDepsPlugin } = require('electron-vite') as typeof import('electron-vite')

const devCspPlugin = {
  name: 'openflow-dev-csp',
  apply: 'serve' as const,
  transformIndexHtml(html: string) {
    return html.replace(
      "script-src 'self';",
      "script-src 'self' 'unsafe-inline';"
    )
  },
}

export default defineConfig({
  // ── 主进程配置 ─────────────────────────────────────────
  main: {
    plugins: [externalizeDepsPlugin()],
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

  // ── 渲染进程配置（React）────────────────────────────────
  renderer: {
    root: 'src/renderer',
    server: {
      host: '127.0.0.1'
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
        },
      },
    },
    plugins: [
      devCspPlugin,
      react(),
    ],
    resolve: {
      alias: {
        // '@' 别名指向 renderer 的 src 目录，兼容现有 App.tsx 中的导入
        '@': resolve('src/renderer/src'),
      },
    },
  },
} satisfies UserConfig)
