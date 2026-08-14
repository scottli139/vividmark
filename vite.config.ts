import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vite.dev/config/
export default defineConfig({
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
