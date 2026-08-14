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
- [x] **数学公式 (KaTeX)** ✅ - 行内 `$...$` / 块级 `$$` 围栏，KaTeX 渲染；WYSIWYG 可点击编辑、往返无损；PDF 导出字体内联
- [x] **任务列表 (Checkbox)** ✅ - 支持 `- [ ]` 和 `- [x]` 语法，可点击切换状态，工具栏新增任务列表按钮
- [x] **WYSIWYG 模式 Phase 1** ✅ - 四模式架构完成（WYSIWYG/Source/Preview/Split），默认 WYSIWYG
- [x] **工具栏优化** ✅ - 精简按钮布局，标题下拉菜单，插入/格式下拉菜单，Windows 兼容的语言标签
- [x] ~~WYSIWYG 模式 Phase 2 - 双向同步核心~~（自研 contenteditable 路线已被 Phase 13 P2 Milkdown 路线取代）

### Phase 5: 文件管理 ⏳ (进行中)

- [x] **侧边栏文件树** ✅ - 支持打开文件夹、递归展开、Markdown 文件过滤、可拖拽调整宽度
- [x] **文件夹打开** ✅ - 集成到文件树功能中
- [x] 大纲视图增强 (点击跳转) ✅
- [x] 多窗口（Typora 式 SDI：每文档独立窗口；2026-08-13 方向调整替代原多标签页方案，当日落地：窗口注册表 + 打开路由（聚焦/复用/新建）+ 菜单事件焦点定向 + 跨窗口偏好同步 + 关窗脏确认；会话恢复与 Windows/Linux 单实例留二期）
- [ ] 文件变更监控 (自动重载)

### Phase 6: 高级功能 (进行中)

- [ ] 主题系统 (CSS 主题切换) - 亮/暗/跟随系统三态已完成（Phase 13 P3），CSS 主题包未做
- [ ] 自定义主题编辑
- [x] **导出 PDF** ✅ - 支持将 Markdown 导出为 PDF（通过浏览器打印为 PDF）
- [ ] 导出 HTML
- [ ] 导出 Word（方案见 `docs/word-export-plan.md`，pandoc 路线已 PoC 验证）
- [ ] 站点导出配置感知（P1 mkdocs 核心 ✅ 2026-08-14：风味探测 / docs_dir 收敛 / nav 白名单 / frontmatter；P2 `!!!` 双端 + exclude_docs、P3 vuepress 待排期；方案见 `docs/site-export-config-plan.md`）
- [x] 搜索与替换 ✅（Source/Split 模式，Cmd+F；WYSIWYG 未接，见 Phase 13 P3）

### Phase 7: 打磨优化 (进行中)

- [ ] 性能优化 (大文件处理)
- [x] 原生菜单集成 ✅（2026-08-07 补全段落/格式菜单，见 Phase 13 P5）
- [ ] 系统托盘
- [ ] 快捷键自定义
- [x] 偏好设置面板 ✅（最小可用：主题/语言/侧栏显隐，见 Phase 13 P4）
- [x] 多语言支持 ✅（见 Phase 4）

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
  - [x] 自动构建多平台版本 ✅ (已验证)
  - [x] 自动发布 Release ✅ (已验证)

**测试策略：**

- 单元测试：hooks, utils, store（co-located `__tests__/`）
- 组件测试：Toolbar, Sidebar, FileTree, Menu 等
- E2E 测试：`e2e/`（app / context-menu / drag-drop / file-tree / table-editing / task-list / wysiwyg）

### Phase 10: 品牌设计 ✅ (已完成)

- [x] 设计应用 Logo 图标
  - 使用 SVG 矢量设计 (可无损缩放)
  - 简约现代风格 + 蓝色渐变
  - 核心元素: Markdown # 符号
- [x] 创建图标文件（`src-tauri/icons/` 全尺寸 PNG + icon.icns + icon.ico + Windows Store 各尺寸）
- [ ] 设计应用启动画面 (Splash Screen) - 可选
- [ ] 设计网站/README 横幅图 - 可选

### Phase 11: 日志与诊断系统 ✅ (已完成)

**目标**：建立完善的日志系统，便于问题诊断和调试 ✅

- [x] 前端日志系统 ✅
  - [x] 创建统一的 logger 工具 (`src/lib/logger.ts`)
  - [x] 支持 log/info/warn/error 级别
  - [x] 开发环境输出到控制台，生产环境可配置
  - [x] 支持日志分类 (模块标签)
- [x] 后端日志增强 ✅
  - [x] 在 Rust 命令中添加诊断日志
  - [x] 记录文件操作路径、大小、耗时
  - [x] 错误时打印详细堆栈和错误类型
  - [x] 添加系统信息启动日志
  - [x] 文件元数据检查（权限、修改时间）
- [x] 关键路径日志覆盖 ✅
  - [x] 文件打开/保存流程
  - [x] Editor content 同步逻辑
  - [x] Store 状态变更
- [ ] 日志查看功能 (可选)
  - [ ] 开发者工具面板
  - [ ] 导出日志文件

**使用方式：**

```typescript
import { createLogger } from './lib/logger'
const logger = createLogger('ModuleName')
logger.info('Opening file:', path)
logger.error('Failed to sync:', error)
```

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

**当前覆盖率：** 80.48% (语句), 70.40% (分支)（2026-08-07 `coverage/coverage-final.json`）

### Phase 13: UX 改进（Typora 对标）⏳ (进行中)

> 差距分析与方案细节见 `docs/ux-improvement-plan.md`

#### P0 — 止血

- [x] 默认视图改为 source（WYSIWYG 完成前不落占位页）；zh-CN wysiwyg 标签"编辑"→"所见即所得"
- [x] 修复 base64 回写 bug（打开文件时预处理内容写入 store，保存会污染 .md）
- [x] 修复 Chars/Words 标签对调与字数统计算法
- [x] 补齐未定义 CSS 变量（--text-primary 等）；窗口标题"未命名"走 i18n
- [x] 大纲解析跳过围栏代码块

#### P1 — 编辑器地基（CodeMirror 6）

- [x] Source/Split 模式 textarea 替换为 CodeMirror 6（markdown 高亮 + 亮暗主题）
- [x] 快捷键：Cmd+B/I/K、Cmd+1~3 标题、列表/引用切换（tooltip 虚标同步根除）
- [x] 智能输入：回车延续列表/任务/引用、空项退出、Tab 缩进、括号配对
- [x] 撤销/重做改用 CM6 history（操作粒度 + 恢复选区），替换全文快照 HistoryManager
- [x] 查找替换面板（Cmd+F，@codemirror/search）
- [x] 图片粘贴/拖拽插入（复用 imageUtils 复制到 assets）
- [x] 预览渲染防抖 120ms，大纲/字数 200ms 防抖
- [x] 状态栏：字数、光标行:列、缩放、视图模式

#### P2 — 真 WYSIWYG（Milkdown/ProseMirror 路线）✅

- [x] Milkdown spike：验证 admonition/任务列表/图片管线插件适配可行性
- [x] WYSIWYG 编辑器落地 + `Cmd+/` 切换 Source（替代自研 contenteditable 路线）
- [x] 自定义语法：admonition 容器节点 / PlantUML 代码块预览 / 本地图片解析 nodeview
- [x] 集成：工具栏事件 viewMode 分流、撤销重做、大纲跳转、初始化脏标记守卫
- [x] 默认视图提为 WYSIWYG（新安装；持久化的用户选择不变）

#### P3 — 桌面质感与高级体验

- [x] macOS 融合标题栏 ✅（Overlay + hiddenTitle + 自绘居中标题）
- [x] 右键菜单 ✅（自绘 ContextMenu；文件树 + 编辑器三区域 Source/WYSIWYG/Preview 已接入，WYSIWYG 上下文感知：表格行列增删/链接/图片/代码块；不依赖原生菜单）
- [x] 原生菜单 ✅（macOS App/File/Edit/View/Window 菜单栏，Windows/Linux 适配布局；2026-08-05）
- [x] 多窗口 + 会话恢复（Typora 式 SDI；2026-08-13 方向调整替代原多标签页方案，多窗口当日落地 ✅；会话恢复留二期）
- [x] 主题系统（部分）✅ - 亮/暗/跟随系统三态 + 控件颜色收编 CSS 变量（CSS 主题包/自定义主题未做）
- [ ] 专注模式 / 打字机模式
- [x] 统一自绘对话框（替换原生 confirm/alert，修复 WKWebView 下 Cancel 失效吞内容）
- [x] 大纲位置高亮跟随 ✅；文件树搜索与文件管理 ✅；设置面板 ✅（最小可用：主题/语言/侧栏显隐）
- [x] PlantUML 离线化 ✅（2026-08-14：@plantuml/core 本地引擎，全链路 + 暗色 + PDF/站点导出内联 SVG）
- [ ] Mermaid 支持；HTML/Word 导出

#### 附加修复与品牌（2026-08-04/05）✅

- [x] 修复：裸相对路径图片（images/x.png）不显示；isTauri() 改查 `__TAURI_INTERNALS__`（convertFileSrc 此前在生产从未生效）
- [x] 修复：WysiwygEditor 懒创建 + 创建失败自愈与错误提示（HMR 陈旧状态导致无法编辑）
- [x] Logo 重设计（V + 光标）+ macOS 图标 80% 安全区（修复 Dock 图标过大）；安装版应用已更新至 v0.1.4 新构建

#### P4 — 侧栏与工具栏 UI/UX 优化 ✅ (已完成，2026-08-05)

> 用户反馈：主界面侧边栏和工具栏 UI 与使用体验不够理想，需重点优化。与多项后续任务存在关联，宜统一规划而非零散修补。

**工具栏**：

- [x] 信息架构精简 ✅：低频操作（导出 PDF、语言、缩放）已移入自绘 MoreMenu（缩放/导出/语言/设置）与设置面板，常驻控件大幅收敛
- [x] 语言选择器原生 `<select>` 已移除 ✅：语言切换并入 MoreMenu（自绘 Dropdown，带勾选态）
- [x] 关联任务：**原生菜单** ✅（已落地，承载迁出的低频操作）、**macOS 融合标题栏** ✅（P3）、**主题系统** ✅（P3）、**设置面板** ✅（P3）、**slash menu/悬浮格式条**（WYSIWYG 补全，仍为独立后续项）

**侧边栏**：

- [x] 信息架构重组 ✅：移除"当前文件"区块，tab 精简为「文件/大纲」（persisted `sidebarTab`，默认大纲）；最近文件支持过滤（不再限 5 条）
- [x] 大纲增强 ✅：当前位置高亮跟随（P3）、chevron 层级折叠（OutlineTree）
- [x] 文件树增强 ✅：搜索过滤、新建/重命名/删除、右键菜单（自绘 ContextMenu 已落地，不等原生菜单）、第一层目录 + 当前文件父链展开策略
- [x] 侧栏宽度持久化 ✅（persisted `sidebarWidth`，默认 224，clamp 180-400）
- [ ] 关联任务：**多窗口**（Typora 式 SDI；原多标签页的标签栏/侧栏联动设想随方向调整作废，P3）、**设置面板**（侧栏默认显隐/宽度，P3）

#### P5 — Typora 对标第二梯队 ✅ (已完成，2026-08-07)

> 用户反馈：侧边栏不够精致（对标 Typora）、Dock 无右键菜单、菜单不全、标题栏无法拖动、Finder「打开方式」无 VividMark。

- [x] **标题栏拖拽修复** ✅：capabilities 补 `core:window:allow-start-dragging`（tauri 2.10 起非默认权限）+ Toolbar 分组容器补 `data-tauri-drag-region`（drag.js 只查 e.target 无上溯）；双击最大化顺带恢复
- [x] **原生菜单补全（Typora 结构）** ✅：新增段落（标题 1-6 ⌘1-6/正文 ⌘0/引用/无序/有序/任务/代码块/分割线/表格/图像/提示框）与格式（加粗 ⌘B/斜体 ⌘I/删除线/行内代码/链接 ⌘K/图像）顶级菜单；文件菜单加打开文件夹 ⇧⌘O/在 Finder 中显示；编辑菜单加粘贴为纯文本 ⇧⌘V；视图菜单加侧栏 tab ⌃⌘1/2 与源码切换 ⌘/；实际大小改 ⇧⌘0（⌘0 让位正文）
- [x] **格式能力补齐** ✅：FormatType 增加 h4-h6/ol/paragraph（CM 纯函数 + Milkdown 双端实现），原生菜单/右键菜单/快捷键三入口同源
- [x] **工具栏二轮精简** ✅：只留侧边栏切换/撤销重做/视图切换/暗色/⋮更多；文件操作与格式化入口全部由菜单+右键菜单+快捷键覆盖；表格/提示框对话框改由 `app-open-dialog` 事件触发
- [x] **macOS Dock 右键菜单** ✅：objc2 运行时给 tao AppDelegate 追加 `applicationDockMenu:`（新建/打开/最近文件/清空），点击复用 native-menu-event 通道
- [x] **文件关联（Open With）** ✅：`bundle.fileAssociations` 声明 md/markdown/mdown/mkd；`RunEvent::Opened` → 排队 + `file-open-request` 事件 → 前端打开（冷启动队列补偿）；仅打包安装后生效
- [x] **侧边栏精致化** ✅：实心「打开文件夹」按钮、最近文件行 hover 底色/圆角/大图标、过滤框内嵌搜索图标、空态居中插画、大纲行 hover 底色、文件树选中态改 accent 淡底圆角行

#### P6 — 极简工具栏与 macOS 窗口修复 ✅ (已完成，2026-08-14)

> 用户反馈：红绿灯不居中（先正后跳）、红灯无法关窗、工具栏仍不够简洁、菜单折行、hover 太弱。

- [x] **窗口无法关闭修复** ✅：tauri 2.10 ACL 收紧致 `allow-destroy` 非默认，`onCloseRequested` 未 preventDefault 后的 JS destroy() 被静默拒绝——capabilities 补授；文件菜单 Close Window 显式中文文案
- [x] **红绿灯垂直居中** ✅：创建时 trafficLightPosition 生效，但前端 setTitle 触发 AppKit 重置按钮位置——新增 `set_window_title` 命令（titlebar.rs），设题后显式重排红绿灯
- [x] **工具栏三轮精简** ✅：只剩 ⋮更多菜单；undo/redo 归编辑菜单、主题三态入更多菜单、视图模式移状态栏点按下拉（Dropdown 加 openUp）、侧栏开关移状态栏左侧；e2e 选择器迁移（viewMode.ts helper）
- [x] **侧栏视觉统一** ✅：OpenFolderButton 公共组件（侧栏/文件树空态共用，ghost 样式替代实心）、字号/颜色层级细化
- [x] **菜单细节** ✅：菜单项 whitespace-nowrap 不折行；--hover-bg 双主题加强，三按钮 hover 统一为圆角底色

---

## 下一步行动

### 功能开发

**第一波（约 9 天，顺序含依赖约束，依据见两份方案文档的「依赖与顺序约束」章节）：**

1. **站点导出配置感知 P1** ✅（2026-08-14 完成）— mkdocs 核心（风味探测 / docs_dir 收敛 / nav 原文导航 / frontmatter 纯函数；`yaml` 依赖引入；36 个新单测）。方案 `docs/site-export-config-plan.md`
2. **frontmatter 双端** ✅（2026-08-14 完成）— 预览/导出剥离 + 大纲去噪 + WYSIWYG 只读 atom 节点（remark-frontmatter + 只读 nodeview，`$remark` options 坑已记入 notes；17 个新单测）
3. **站点导出配置感知 P2** — `!!!` admonition 双端 + `exclude_docs`（FR-020.10）
4. **GitHub Alerts**（语法批次 1 / FR-023.1；0.5 天，可提前热身）
5. **脚注**（语法批次 2 / FR-023.2）
6. **站点导出配置感知 P3** — vuepress best-effort；站点导出管线至此定型
7. **Mermaid**（语法批次 4 / FR-021.5；复用 PlantUML 占位符 + 懒加载基建；导出侧内联须等上项定型）
8. **排版批**（语法批次 5 / FR-023.4：`==` / `^` / `~` / emoji 预览侧先行）

**后续波次：**

- **Word 导出**（Phase 6 / FR-040.4；pandoc 路线 PoC 已验证；排在语法线收尾后，`wordPreprocess` 语法映射一次覆盖到位——方案 `docs/word-export-plan.md`）
- **WYSIWYG 补全** - 查找替换接入、slash menu / 悬浮格式条（排在语法批次之后，插入入口覆盖新语法）、`@startuml` 裸行内形态支持（当前显示为源码文本，渲染仅 Source/Preview/Split）
- **多窗口会话恢复** - 重启后重开窗口组（多窗口二期项，含 Windows/Linux 单实例 + argv 文件关联）
- **文件变更监控** - 外部修改自动重载（Phase 5；与多窗口/自动保存的冲突策略需同期设计）
- **主题系统** - CSS 主题包 / 自定义主题编辑（Phase 6 / 13 P3；宜在语法面定型后梳理覆盖面）
- **专注模式 / 打字机模式**（Phase 13 P3）
- **导出 HTML**（Phase 6 / FR-040.2/.3；已发 good first issue #5）
- ~~Mermaid 支持~~（已并入第一波第 7 项；Typst 方案经 2026-08-12 评估维持暂停、倾向转为独立产品，见 `docs/typst-offline-plan.md` 头部结论与 `docs/typst-standalone-editor-plan.md`）

### 体验与优化

- **性能优化** - 大文件处理（Phase 7）
- **Split 模式同步滚动精准化** - 当前基于百分比，内容长度差异大时不精准；可考虑基于 heading/段落位置或 caret 位置的智能同步、灵敏度调节
- ~~**PlantUML 增强** - 本地渲染~~ ✅（2026-08-14：`@plantuml/core` TeaVM 引擎离线渲染 + 暗色适配 + PDF/站点导出内联 SVG，失败回退在线服务；「编辑器内编辑 + 实时预览」已由 WYSIWYG 双区 / Split 覆盖）
- **Admonitions 增强** - `??? note` 可折叠语法（已发 good first issue #4）；嵌套支持

### 工程化

- **E2E 测试增强** - 完整用户流程（打开→编辑→保存、拖拽打开、快捷键；已发 good first issue #3）
- **Editor 组件 / fileOps 测试补全**（Phase 12 剩余项；已发 good first issue #6）
- **贡献者基建** ✅（2026-08-14：CONTRIBUTING 双语版、bug/feature issue 表单模板、PR 模板、CODE_OF_CONDUCT、README 贡献区）；pre-commit hooks (husky + lint-staged) - 可选
- 日志查看面板 / 日志导出 - 可选
- 启动画面 / 官网横幅图 - 可选

### 社区与推广

- **SEO** ✅（2026-08-14）：Pages 站点关键词 title/description、OG/Twitter 卡片（og-image 1200×630）、JSON-LD 结构化数据、中英 hreflang 互链、sitemap.xml + robots.txt；Search Console 已验证站点并提交 sitemap。待办：Bing Webmaster Tools 提交
- **站外收录**：awesome-markdown-editors PR mundimark#220（待合并）；HelloGitHub 自荐 521xueweihan/HelloGitHub#3538（人工月刊筛选）；AlternativeTo 待办——新账号 7 天反垃圾限制，2026-08-21 后提交 listing 并挂 Typora/Obsidian/MarkText alternative
- **社区协作**：Windows/Linux 测试招募 #1（pinned，维护者仅有 macOS）；good first issue #2（i18n 新语言）/ #3 / #4 / #5 / #6；候选未发放：Mermaid（已是第一波第 7 项，不重复发）、文件变更监控、Split 滚动精准化（help wanted 级）

---

## Session 记录

历史开发日志已归档至 `docs/session-log.md`（2026-08-07 自本文件迁出）。

---

## 启动命令

```bash
pnpm tauri:dev     # 开发模式（前端 + Rust）
pnpm tauri:build   # 构建
```

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
