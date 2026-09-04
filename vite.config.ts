import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vite.dev/config/
export default defineConfig({
  // Windows 下 cargo 构建写入 src-tauri/target 的 exe 会被 chokidar 盯上并以
  // EBUSY 崩溃（Tauri 官方模板同款配置；POSIX 无此问题但同样减少无效监听）
  server: {
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    // PlantUML 本地引擎（@plantuml/core，TeaVM 编译）按需静态拷贝到 vendor/plantuml/，
    // 运行时由 src/lib/plantuml.ts 懒加载（首个 UML 图出现时才加载 ~8.6MB）
    // v4 API：rename.stripBase=true 扁平拷贝（默认会保留 node_modules 目录结构）
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@plantuml/core/{plantuml.js,viz-global.js,openiconic.js,LICENSE}',
          dest: 'vendor/plantuml',
          rename: { stripBase: true },
        },
      ],
    }),
  ],
})
