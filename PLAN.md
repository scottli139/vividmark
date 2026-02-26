# VividMark 开发计划

> 类似 Typora 的所见即所得 Markdown 编辑器

## 项目信息

- **项目名称**: VividMark
- **技术栈**: Tauri 2.0 + React + TypeScript
- **仓库**: https://github.com/scottli139/vividmark

---

## 开发进度

### Phase 1: 基础框架 ✅ (已完成)

- [x] 项目初始化 (Tauri + React + Vite)
- [x] 配置 TailwindCSS
- [x] 配置 Zustand 状态管理
- [x] 基础布局 (Toolbar + Sidebar + Editor)
- [x] 深色模式切换
- [x] 开发环境验证

### Phase 2: 核心编辑器 ✅ (已完成)

- [x] Markdown 解析 (markdown-it)
- [x] 块级渲染组件
- [x] 块级编辑 (点击编辑，失焦渲染)
- [x] 优化块级切换体验 (减少闪烁)
- [x] 支持行内元素编辑 (粗体、斜体、链接)
- [x] 代码块语法高亮

### Phase 3: 文件操作 ✅ (已完成)

- [x] Rust 后端文件读写命令
- [x] 文件对话框插件集成
- [x] 工具栏文件操作按钮
- [x] 快捷键绑定 (Cmd+O, Cmd+S, Cmd+N)
- [x] 拖拽打开文件
- [x] 最近文件列表
- [x] 自动保存

### Phase 4: 编辑增强 ✅ (核心功能已完成)

- [x] **编辑模式重构** (Source/Preview/Split)
  - 移除块级编辑，改为连续文档编辑
  - Source 模式：直接编辑 Markdown 源码
  - Preview 模式：只读预览
  - Split 模式：左源码右预览，同步滚动
- [x] 快捷键工具栏 (Bold, Italic, Link, etc.)
- [x] **图片插入与预览** ✅
  - 支持点击工具栏插入本地图片
  - 自动复制到 `./assets/` 文件夹
  - Tauri asset 协议预览 + base64 回退
- [x] **撤销/重做栈** ✅
  - 基于栈的历史记录管理
  - 支持 Cmd+Z / Cmd+Shift+Z
- [ ] 表格编辑
- [ ] 数学公式 (KaTeX)
- [ ] 任务列表 (Checkbox)
- [ ] WYSIWYG 模式 (像 Typora 一样直接编辑渲染内容)

### Phase 5: 文件管理 (待开始)

- [ ] 侧边栏文件树
- [ ] 文件夹打开
- [ ] 大纲视图增强 (点击跳转)
- [ ] 多标签页
- [ ] 文件变更监控 (自动重载)

### Phase 6: 高级功能 (待开始)

- [ ] 主题系统 (CSS 主题切换)
- [ ] 自定义主题编辑
- [ ] 导出 PDF
- [ ] 导出 HTML
- [ ] 导出 Word
- [ ] 搜索与替换

### Phase 7: 打磨优化 (待开始)

- [ ] 性能优化 (大文件处理)
- [ ] 原生菜单集成
- [ ] 系统托盘
- [ ] 快捷键自定义
- [ ] 偏好设置面板
- [ ] 多语言支持

---

## 工程化改进 (后续 Session)

### Phase 8: 代码规范配置 ✅ (已完成)

- [x] 配置 ESLint 规则 (flat config, react-hooks, prettier)
- [x] 配置 Prettier 格式化规则
- [x] 配置 TypeScript 严格模式 (已启用 strict, noUnusedLocals, noUnusedParameters)
- [x] 添加 .editorconfig 统一编辑器配置
- [ ] 添加 pre-commit hooks (husky + lint-staged) - 可选
- [ ] 创建 CONTRIBUTING.md 文档 - 可选

**已配置文件：**
```
.prettierrc      # Prettier 配置
.prettierignore  # Prettier 忽略文件
eslint.config.js # ESLint flat config
.editorconfig    # 编辑器统一配置
```

### Phase 9: 自动化测试 ✅ (已完成)

- [x] 配置 Vitest 单元测试
- [x] 添加 React Testing Library 组件测试
- [x] 配置 Playwright E2E 测试
- [x] 添加测试脚本和覆盖率报告
- [x] **配置 GitHub Actions CI/CD** ✅
  - [x] 自动运行 TypeScript 类型检查
  - [x] 自动运行 ESLint + Prettier 检查
  - [x] 自动运行单元测试 (Vitest)
  - [ ] 自动构建多平台版本
  - [ ] 自动发布 Release

**测试策略：**
- 单元测试：hooks, utils, store
- 组件测试：Editor, Toolbar, Sidebar
- E2E 测试：文件操作、编辑流程

**已创建测试文件：**
```
src/
├── components/
│   ├── Editor/__tests__/Editor.test.tsx    # 待添加
│   ├── Toolbar/__tests__/Toolbar.test.tsx
│   └── Sidebar/__tests__/Sidebar.test.tsx
├── stores/__tests__/editorStore.test.ts
├── hooks/__tests__/
│   ├── useAutoSave.test.ts
│   └── useTextFormat.test.ts
└── lib/markdown/__tests__/parser.test.ts

e2e/
├── file-operations.spec.ts   # 文件操作 E2E
└── basic-editing.spec.ts     # 基础编辑 E2E
```

### Phase 11: 日志与诊断系统 ✅ (已完成)

**目标**：建立完善的日志系统，便于问题诊断和调试 ✅

- [x] 前端日志系统 ✅
  - [x] 创建统一的 logger 工具 (`src/lib/logger.ts`)
  - [x] 支持 log/info/warn/error 级别
  - [x] 开发环境输出到控制台，生产环境可配置
  - [x] 支持日志分类 (模块标签)
- [ ] 后端日志增强 (可选)
  - [ ] 在 Rust 命令中添加诊断日志
  - [ ] 记录文件操作路径、大小、耗时
  - [ ] 错误时打印详细堆栈
- [x] 关键路径日志覆盖 ✅
  - [x] 文件打开/保存流程
  - [x] Editor content 同步逻辑
  - [x] Store 状态变更
- [ ] 日志查看功能 (可选)
  - [ ] 开发者工具面板
  - [ ] 导出日志文件

**日志规范：**
```typescript
// 前端日志示例
import { fileOpsLogger } from './lib/logger'
fileOpsLogger.info('[FileOps] Opening file:', path)
fileOpsLogger.error('[Editor] Failed to sync blocks:', error)
```

**实现文件：**
- `src/lib/logger.ts` - 日志系统核心
- 使用方式：`createLogger('ModuleName')` 或预配置的 `fileOpsLogger`, `editorLogger`

### Phase 12: 测试增强 ✅ (部分完成)

**目标**：增加测试覆盖率，防止类似问题再次发生

- [x] 核心工具函数测试 ✅
  - [x] `imageUtils.ts` - 22 个测试 (isLocalPath, isUrl, extractImagePath)
  - [x] `parser.ts` - 41 个测试 (Markdown 解析、图片渲染、异步解析)
- [x] 组件测试 ✅
  - [x] Toolbar 组件测试
  - [x] Sidebar 组件测试
- [x] Hooks 测试 ✅
  - [x] useAutoSave 测试
  - [x] useTextFormat 测试
- [x] Store 测试 ✅
  - [x] editorStore 测试
- [ ] Editor 组件核心逻辑测试
  - [ ] content 同步逻辑测试 (外部更新 vs 用户编辑)
  - [ ] 边界情况测试 (空文件、大文件、特殊字符)
- [ ] fileOps 集成测试
  - [ ] mock Tauri invoke 测试文件操作流程
  - [ ] 错误处理测试
- [ ] E2E 测试增强
  - [ ] 打开文件 -> 编辑 -> 保存 完整流程
  - [ ] 拖拽打开文件
  - [ ] 快捷键操作

**当前覆盖率：** 60.28% (语句), 62.43% (分支)

### Phase 10: 品牌设计 ✅ (已完成)

- [x] 设计应用 Logo 图标
  - 使用 SVG 矢量设计 (可无损缩放)
  - 简约现代风格 + 蓝色渐变
  - 核心元素: Markdown # 符号
- [x] 创建图标文件
  - [x] 32x32.png
  - [x] 128x128.png
  - [x] 128x128@2x.png
  - [x] 512x512.png
  - [x] icon.icns (macOS)
  - [x] icon.ico (Windows)
  - [x] Windows Store 图标 (30-310px)
- [ ] 设计应用启动画面 (Splash Screen) - 可选
- [ ] 设计网站/README 横幅图 - 可选

**已创建文件：**
```
src-tauri/icons/
├── icon.svg           # 矢量源文件
├── icon.png           # 512x512 高清版
├── 32x32.png          # 小图标
├── 128x128.png        # 中等图标
├── 128x128@2x.png     # Retina 图标
├── 512x512.png        # 大图标
├── icon.icns          # macOS 图标包
├── icon.ico           # Windows 图标
├── StoreLogo.png      # Windows Store
└── Square*N*Logo.png  # Windows Store 各尺寸
```

---

## 技术细节

### 核心依赖

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.10.1",
    "@tauri-apps/plugin-dialog": "^2.6.0",
    "@tauri-apps/plugin-fs": "^2.4.5",
    "markdown-it": "^14.1.1",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "zustand": "^5.0.11"
  }
}
```

### 目录结构

```
vividmark/
├── src/                    # React 前端
│   ├── components/
│   │   ├── Editor/         # 核心编辑器
│   │   ├── Sidebar/        # 侧边栏
│   │   └── Toolbar/        # 工具栏
│   ├── hooks/              # 自定义 Hooks
│   ├── stores/             # Zustand 状态
│   ├── lib/
│   │   ├── markdown/       # Markdown 解析
│   │   └── fileOps.ts      # 文件操作
│   ├── styles/             # 全局样式
│   └── App.tsx
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── lib.rs          # 主逻辑 + 命令
│   │   └── main.rs         # 入口
│   ├── Cargo.toml
│   └── tauri.conf.json
└── package.json
```

---

## 下一步行动

### 已完成 ✅

1. ~~**Phase 8: 代码规范配置**~~ ✅ 
2. ~~**Phase 9: 自动化测试**~~ ✅ (CI/CD 已配置，测试覆盖率 60%+)
3. ~~**Phase 10: 品牌设计**~~ ✅
4. ~~**Phase 11: 日志与诊断系统**~~ ✅
5. ~~**Phase 4.1: 撤销/重做**~~ ✅
6. ~~**Phase 4.2: 图片插入与预览**~~ ✅

### 功能开发 (下一迭代)

1. **表格编辑支持** - Markdown 表格的可视化编辑
2. **数学公式 (KaTeX)** - 支持 LaTeX 公式渲染
3. **任务列表** - Checkbox 任务清单
4. **多标签页** - 同时打开多个文件
5. **大纲视图增强** - 点击标题跳转

### 工程优化

1. **性能优化** - 大文件处理优化
2. **E2E 测试增强** - 完整用户流程测试

---

## 启动命令

```bash
cd /Volumes/hagibis1t/huicom/github/markdown/vividmark

# 开发模式
pnpm tauri dev

# 构建
pnpm tauri build
```

---

## Session 记录

### 2025-02-26 图片插入功能实现

**完成工作：**
- ✅ 实现图片插入功能 (Toolbar 图片按钮)
- ✅ 自动复制图片到 `./assets/` 文件夹
- ✅ 使用相对路径引用，保持 Markdown 简洁
- ✅ Tauri asset 协议预览 + base64 回退
- ✅ 添加 35 个测试 (imageUtils.test.ts + parser.test.ts)
- ✅ 修复 CI 类型检查和格式化问题

**提交记录：**
```
41df67d style: fix code formatting with prettier
00cae82 fix: resolve type errors and lint issues from CI
96fe9dc feat: 实现图片插入和预览功能
```

**技术要点：**
- 使用 `convertFileSrc` 转换本地路径为可访问 URL
- 自定义 markdown-it 图片渲染规则
- 异步渲染支持图片预处理
- Protocol-relative URL (`//...`) 边界处理

---

## 注意事项

1. **网络问题**: 使用清华镜像
   - Cargo: `~/.cargo/config.toml` 已配置
   - npm: 自动使用镜像

2. **代理问题**: git 代理已清除，如需恢复:
   ```bash
   git config --global http.proxy http://127.0.0.1:7897
   git config --global https.proxy http://127.0.0.1:7897
   ```
