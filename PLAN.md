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
- [x] **撤销/重做栈** ✅ - 功能已实现并修复
  - 基于栈的历史记录管理
  - 支持 Cmd+Z / Cmd+Shift+Z
  - [x] 修复 undo/redo bug（使用 getter 函数获取当前内容）
- [x] **MkDocs 扩展语法支持** ✅
  - Admonitions (提示框): `::: tip`, `::: warning`, `::: info`, `::: note`, `::: danger`, `::: success`
  - PlantUML 图表: `@startuml...@enduml` 和代码块 ` ```plantuml ``` `
  - 支持自定义标题 (如 `::: tip 注意`)
  - 使用 PlantUML 在线服务渲染 SVG 图表
- [x] **表格编辑** ✅ - Markdown 表格的可视化编辑，支持插入对话框、行列自定义
- [x] **多语言支持** ✅ - 支持简体中文和英语（可扩展）
- [ ] 数学公式 (KaTeX)
- [ ] 任务列表 (Checkbox)
- [ ] WYSIWYG 模式 (像 Typora 一样直接编辑渲染内容)

### Phase 5: 文件管理 (待开始)

- [ ] 侧边栏文件树
- [ ] 文件夹打开
- [x] 大纲视图增强 (点击跳转) ✅
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

1. ~~**表格编辑支持**~~ ✅ - Markdown 表格的可视化编辑已完成
2. ~~**修复 Undo/Redo**~~ ✅ - 已修复（使用 getter 函数获取最新内容）
3. ~~**多语言支持 (i18n)**~~ ✅ - 支持简体中文和英语
4. ~~**大纲视图增强 (点击跳转)**~~ ✅ - 已完成
5. **数学公式 (KaTeX)** - 支持 LaTeX 公式渲染
6. **任务列表** - Checkbox 任务清单
7. **多标签页** - 同时打开多个文件

### 工程优化

1. **性能优化** - 大文件处理优化
2. **E2E 测试增强** - 完整用户流程测试

### 未来优化任务 (Future Improvements)

#### Split 模式同步滚动优化
- [ ] **同步滚动算法改进** - 当前基于百分比的同步在内容长度差异大时不够精准
  - 可考虑基于 heading/paragraph 位置的智能同步
  - 或实现基于 caret/cursor 位置的精准同步
- [ ] **同步灵敏度调节** - 允许用户调整同步响应速度

#### PlantUML 增强
- [ ] **本地 PlantUML 渲染** - 当前依赖 plantuml.com 在线服务，离线时无法显示
  - 可集成 plantuml.jar 或使用 WASM 版本
- [ ] **PlantUML 编辑模式** - 支持在编辑器中直接编辑 PlantUML 代码并实时预览

#### Admonitions 增强  
- [ ] **可折叠 Admonitions** - 支持 `??? note` 语法（可折叠提示框）
- [ ] **嵌套 Admonitions** - 支持提示框内部嵌套其他 Markdown 元素

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

### 2026-02-26 大纲视图点击跳转实现

**完成工作：**
- ✅ 创建大纲工具模块 (`src/lib/outlineUtils.ts`)
  - `extractOutline()` - 从 Markdown 提取大纲，包含层级、文本、行号、字符位置和索引
  - `calculateScrollPosition()` - 计算滚动位置
  - `scrollToPosition()` - 平滑滚动到指定位置并设置光标（Source/Split 模式）
  - `scrollPreviewToHeading()` - 滚动预览区域到指定标题（Preview 模式）
- ✅ 重构 Sidebar 组件
  - 使用 `extractOutline` 替换原有的简单正则提取
  - 添加大纲项点击事件派发 (`editor-scroll-to-heading`，包含 index 字段)
  - 添加 `cursor-pointer` 和悬停效果
  - 添加 `title` 属性显示完整标题
- ✅ 更新 Editor 组件
  - 监听 `editor-scroll-to-heading` 事件
  - Source/Split 模式：调用 `scrollToPosition` 滚动 textarea + 设置光标
  - Preview 模式：调用 `scrollPreviewToHeading` 滚动预览区域
- ✅ 添加完整测试
  - `outlineUtils.test.ts` - 16 个测试用例（包含 Preview 模式滚动）
  - `Sidebar.test.tsx` - 新增 4 个大纲导航测试用例
  - 所有 305 个测试通过

**技术要点：**
- 使用 CustomEvent 进行组件间通信
- 基于字符位置的精准定位（Source/Split 模式）
- 基于标题索引的定位（Preview 模式）
- 平滑滚动 + 光标定位
- 支持多级标题缩进显示
- 三种视图模式全覆盖

**新增文件：**
- `src/lib/outlineUtils.ts` - 大纲工具函数
- `src/lib/__tests__/outlineUtils.test.ts` - 工具函数测试

**修改文件：**
- `src/components/Sidebar/Sidebar.tsx` - 集成大纲点击跳转
- `src/components/Editor/Editor.tsx` - 监听滚动事件，支持三种模式
- `src/components/Sidebar/__tests__/Sidebar.test.tsx` - 添加导航测试

---

### 2025-02-26 多语言支持 (i18n) 实现

**完成工作：**
- ✅ 配置 i18next + react-i18next 国际化框架
  - 安装依赖: `i18next`, `react-i18next`, `i18next-browser-languagedetector`
  - 创建 `src/i18n/index.ts` 配置文件
  - 支持语言检测和 localStorage 持久化
- ✅ 创建翻译文件
  - `src/i18n/locales/en.json` - 英文翻译 (67+ 条)
  - `src/i18n/locales/zh-CN.json` - 简体中文翻译
  - 支持变量插值 (如 `{{shortcut}}`)
- ✅ 重构所有组件使用翻译
  - `Toolbar.tsx` - 工具栏按钮 tooltip 和视图模式标签
  - `Sidebar.tsx` - 侧边栏标题和统计标签
  - `TableDialog.tsx` - 对话框标题和按钮
  - `App.tsx` - 拖放提示文本
  - `useKeyboardShortcuts.ts` - 快捷键描述
  - `useFileDragDrop.ts` - 消息提示
- ✅ 添加语言切换 UI
  - 在 Toolbar 添加语言选择下拉框
  - 显示国旗和语言名称
  - 支持实时切换
- ✅ Store 集成
  - 添加 `language` 状态到 editorStore
  - 持久化语言偏好到 localStorage
  - `App.tsx` 自动同步 store 和 i18next
- ✅ 改进字数统计（支持中英文）
  - 新的统计算法支持 Unicode 字符
  - 正确计算中文字数
- ✅ 添加测试
  - `src/i18n/__tests__/i18n.test.ts` - i18n 配置和翻译测试
  - 更新现有组件测试以支持 i18n mock
  - 所有 285 个测试通过

**更新文档：**
- ✅ 更新 README.md - 添加多语言支持特性
- ✅ 更新 AGENTS.md - 添加 i18n 实现指南
- ✅ 更新 PLAN.md - 标记 Phase 4 多语言支持完成

**实现细节：**
```typescript
// 使用翻译
const { t, i18n } = useTranslation()

// 带变量的翻译
t('toolbar.tooltip.save', { shortcut: 'Cmd+S' })

// 语言切换
const { language, setLanguage } = useEditorStore()
setLanguage('zh-CN')
i18n.changeLanguage('zh-CN')
```

**新增文件：**
- `src/i18n/index.ts` - i18n 配置
- `src/i18n/locales/en.json` - 英文翻译
- `src/i18n/locales/zh-CN.json` - 中文翻译
- `src/i18n/__tests__/i18n.test.ts` - i18n 测试

---

### 2025-02-26 修复 Undo/Redo 功能

**问题描述：**
Undo/Redo 功能存在 bug，撤销时无法正确回到上一个状态。

**根本原因：**
`useHistory` hook 使用 `useCallback` 依赖了 `content` 状态，但 Editor 中实际编辑使用的是 `localContent`。当调用 `undo`/`redo` 时，`content` 参数是旧的值，不是当前的 `localContent`。

**修复方案：**
1. 修改 `useHistory` hook，接受一个 `getContent` 函数而不是 `content` 值
2. 在 `Editor.tsx` 中使用 `useRef` 保存最新的 `localContent`
3. 提供一个 `getCurrentContent` 回调函数给 `useHistory`
4. 确保初始化时将初始内容推入历史记录
5. 修复文件打开时的历史记录清空逻辑

**修改文件：**
- `src/hooks/useHistory.ts` - 使用 getter 函数获取当前内容
- `src/components/Editor/Editor.tsx` - 使用 ref 和回调函数
- `src/lib/historyManager.ts` - 优化 undo 逻辑，修复返回上一个状态的问题

**新增测试：**
- `src/lib/__tests__/historyManager.test.ts` - 16 个测试用例
- `src/hooks/__tests__/useHistory.test.ts` - 12 个测试用例

**测试验证：**
- 所有 270 个单元测试通过
- Lint 和 TypeScript 类型检查通过

---

### 2025-02-26 表格编辑功能实现

**完成工作：**
- ✅ 实现表格插入对话框组件 (`TableDialog.tsx`)
  - 支持选择行数和列数（1-50 行，1-20 列）
  - 实时预览表格结构
  - 可通过 +/- 按钮或直接输入调整数值
- ✅ 创建表格工具函数模块 (`tableUtils.ts`)
  - `generateTable()` - 生成 Markdown 表格
  - `parseTable()` - 解析 Markdown 表格
  - `addTableRow()` / `addTableColumn()` - 添加行列
  - `deleteTableRow()` / `deleteTableColumn()` - 删除行列
  - `formatTable()` - 格式化表格对齐
  - `isValidTable()` - 验证表格有效性
- ✅ 在 Toolbar 添加表格插入按钮
- ✅ 添加完整的单元测试（80+ 测试用例）
  - `tableUtils.test.ts` - 40 个测试用例
  - `TableDialog.test.tsx` - 20 个测试用例
  - `Toolbar.test.tsx` - 新增表格相关测试
- ✅ 添加 E2E 测试 (`table-editing.spec.ts`)
- ✅ 增强表格样式（隔行变色、悬停效果、对齐支持）
- ✅ 支持 GFM 表格对齐语法 (`:---`, `:---:`, `---:`)

**依赖：**
- 无新增依赖，使用现有 markdown-it 表格支持

**技术要点：**
- 使用 `markdown-it` 内置的 GFM 表格支持
- 对话框使用 Portal 模式渲染在 body 层级
- 表格工具支持完整的 CRUD 操作（供未来扩展使用）

---

### 2025-02-26 MkDocs 扩展语法支持

**完成工作：**
- ✅ 实现 Admonitions (提示框) 支持
  - 支持类型: tip, warning, info, note, danger, success, hint, important, caution
  - 支持自定义标题 (如 `::: tip 注意`)
  - 添加彩色边框和图标样式 (深色模式适配)
- ✅ 实现 PlantUML 图表渲染
  - 支持行内语法 `@startuml...@enduml`
  - 支持代码块语法 ` ```plantuml ``` `
  - 使用 PlantUML 在线服务 (plantuml.com) 渲染 SVG
- ✅ 添加 14 个测试用例覆盖新功能
- ✅ 更新 CSS 样式文件

**依赖安装：**
```bash
pnpm add markdown-it-container plantuml-encoder
pnpm add -D @types/markdown-it-container
```

**使用示例：**
```markdown
::: tip
提示内容
:::

::: warning 开发工具
警告内容
:::

@startuml
Alice -> Bob: Hello
@enduml
```

---

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

---

### 2025-02-26 Git 仓库清理

**完成工作：**
- ✅ 移除不应该提交到 git 的生成文件
- ✅ 更新 `.gitignore` 配置
- ✅ 推送清理后的仓库到远程

**移除的文件/目录：**
| 文件/目录 | 文件数 | 说明 |
|-----------|--------|------|
| `coverage/` | 24 | Vitest 测试覆盖率报告 |
| `test-results/` | 3 | Playwright 测试结果 |
| `playwright-report/` | 1 | Playwright HTML 报告 |
| `.claude/` | 1 | Claude 本地权限配置 |
| **总计** | **29** | |

**更新的 `.gitignore`：**
```gitignore
# Test coverage & results
coverage
test-results
playwright-report

# Claude local settings
.claude/
```

**提交记录：**
```
1d82819 chore: 移除不应该提交的生成文件 (coverage, test-results)
0489ddd chore: 移除 Claude 本地配置文件
fd1aa12 chore: 移除 Playwright 测试报告
```

**Git 管理最佳实践：**
1. 生成文件（测试报告、覆盖率、构建输出）不应提交
2. 本地配置（IDE、工具配置）不应提交
3. 敏感信息（token、密钥）绝对不应提交
4. 大文件应使用 Git LFS 或排除

---

### 2026-02-26 Release 0.1.0 发布

**完成工作：**
- ✅ 编译 macOS Release 版本 (0.1.0)
- ✅ 创建 GitHub Release 并上传 dmg 安装包
- ✅ 创建中英文双版本 README
- ✅ 创建中英文双版本 GitHub Pages
- ✅ 添加 MkDocs 特色说明

**版本号同步：**
- `package.json`: 0.0.0 → 0.1.0
- `src-tauri/tauri.conf.json`: 0.1.0 (无需变更)
- `src-tauri/Cargo.toml`: 0.1.0 (无需变更)

**发布的文件：**
| 文件 | 说明 |
|------|------|
| `VividMark_0.1.0_aarch64.dmg` | macOS Apple Silicon 安装包 |

**Release 地址：** https://github.com/scottli139/vividmark/releases/tag/v0.1.0

**GitHub Pages 地址：**
- 英文版: https://scottli139.github.io/vividmark
- 中文版: https://scottli139.github.io/vividmark/index.zh-CN.html

**提交记录：**
```
7d514a4 chore: bump version to 0.1.0
dc270e4 docs: highlight MkDocs support as key feature
eb33688 docs: add Chinese version of README and GitHub Pages
```

**新增文档：**
- `README.zh-CN.md` - 中文项目说明
- `docs/index.zh-CN.html` - 中文官网页面
- 语言切换器 (`EN | 中`)

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
