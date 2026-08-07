# VividMark 开发日志（Session 记录）

> 本文档为历史开发日志归档，自 `PLAN.md` 迁出（2026-08-07）。
> 任务进度看板在 `PLAN.md`，实现细节知识库在 `docs/implementation-notes.md`。

---

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

### 2026-08-05 P4 侧栏/工具栏 UI 优化 + P3 关联项落地

**完成工作：**

- ✅ **主题地基**：Tailwind `@custom-variant dark`（`dark:` 变体从系统媒体查询改为跟随应用内 `.dark` class，挂 documentElement）；新增 persisted `themeMode`（light/dark/system，默认 system）+ persist v1 migrate/merge；`isDarkMode` 改为派生非持久化；新增 `src/lib/theme.ts` 与 `--hover-bg`/`--active-bg`/`--color-text-muted` 变量，组件 Tailwind 硬编码灰色全部收编
- ✅ **菜单原语**：新增 `src/components/Menu/`（Dropdown / ContextMenu / MenuPanel / menuPosition.ts），FormatMenu/HeadingDropdown/InsertMenu 重构复用
- ✅ **工具栏精简**：缩放三按钮、原生语言 `<select>`、导出 PDF 按钮移除；新增 MoreMenu（缩放/导出 PDF/语言勾选/设置）
- ✅ **设置面板**：`SettingsDialog.tsx`（主题三态/语言/侧栏显隐）；store 新增非持久化 `isSettingsOpen`，`showSidebar` 转 persisted
- ✅ **侧栏重组**：移除"当前文件"区块；tab 精简为「文件/大纲」（persisted `sidebarTab`，默认大纲）；最近文件过滤（不限 5 条）；宽度持久化 `sidebarWidth`（默认 224，clamp 180-400）
- ✅ **大纲增强**：`OutlineTree.tsx` 树渲染 + chevron 折叠；位置跟随（source/split 走 cursorLine，wysiwyg 走 `wysiwygActiveHeadingPlugin.ts` → `activeHeadingIndex`）
- ✅ **文件树增强**：Rust 新命令 create_file/create_folder/rename_path/delete_path；头部过滤输入框；自绘右键菜单（ContextMenu）；行内新建/重命名；删除走 confirmDialog；collect/apply 展开路径刷新
- ✅ **macOS 融合标题栏**：`titleBarStyle: Overlay` + `hiddenTitle`；新增 `src/lib/platform.ts`；Toolbar `data-tauri-drag-region` + traffic light 预留（pl-78px）+ 自绘居中标题（<760px 隐藏）
- ✅ **i18n**：新增 key 三处同步（en.json / zh-CN.json / test setup）

**测试规模：** 33 个测试文件、567+ 用例全部通过（`pnpm test:run`）

---

### 2026-08-05 原生菜单（Native Menu）落地

**完成工作：**

- ✅ **Rust 菜单构建**：新建 `src-tauri/src/menu.rs`（`build_menu` + en/zh-CN 文案字典）；macOS 布局 App/File/Edit/View/Window，Windows/Linux 布局 File（含 Settings/Exit）/Edit/View/Window/Help；Open Recent 动态子菜单；Edit 的 Undo/Redo 用自定义项转发编辑器 history（不用系统级 undo）
- ✅ **事件转发与状态命令**：`lib.rs` 注册 `on_menu_event` → emit `native-menu-event`；新增 command `rebuild_menu` / `set_menu_item_enabled` / `set_menu_item_checked`
- ✅ **前端对接**：新建 `src/lib/nativeMenu.ts`（`handleMenuAction` 分发 + store 订阅同步 undo/redo 可用态、视图模式/主题勾选态、语言与最近文件触发菜单重建）；`App.tsx` 启动接线
- ✅ **Find 接入**：`CodeMirrorEditor` 监听 `editor-find` → `openSearchPanel`（仅 source/split 生效，WYSIWYG 查找留待后续）
- ✅ **测试**：`nativeMenu.test.ts` 21 条分发用例；全套 588 用例通过；tsc/lint/format/cargo check 全绿

**关键机制：** 带 accelerator 的键（Cmd+O/S/N 等）在桌面端被 OS 拦截，webview 收不到 keydown —— 桌面端快捷键由菜单事件驱动，`useKeyboardShortcuts` 仅作浏览器 dev/E2E 环境入口，两环境互不重迭。

**新增文件：**

- `src-tauri/src/menu.rs`、`src/lib/nativeMenu.ts`、`src/lib/__tests__/nativeMenu.test.ts`

**修改文件：**

- `src-tauri/src/lib.rs`、`src/App.tsx`、`src/components/Editor/CodeMirrorEditor.tsx`、`src/test/mocks/tauri.ts`

---

### 2026-08-05 WYSIWYG 编辑体验补全（代码块高亮 / admonition 新建 / 快捷键）

**完成工作：**

- ✅ **代码块语法高亮**：新增 `codeHighlightPlugin.ts`——highlight.js（与预览同引擎，零新依赖）分词 → PM inline decorations 挂全局 `.hljs-*` 类；`Map<lang+code, spans>` 缓存（200 条 FIFO），只有变更块重新分词；只认显式 language（plantuml/未知语言跳过）
- ✅ **代码块语言输入框**：扩展 `plantUmlCodeBlockView.ts`——非 plantuml 块右上角渲染 `lang` 输入框（Enter/blur 提交 `setNodeMarkup`，Escape 还原），pre 加 `hljs` class 与预览基色一致；输入 `plantuml` 自动重建为预览双区
- ✅ **Admonition 编辑器内新建**：新增 `AdmonitionDialog.tsx`（9 类型网格复用 `.admonition` CSS 迷你预览 + 可选自定义标题）；InsertMenu 新增「提示框」项；`insertWysiwygSnippet` 光标修正扩到 admonition；source 模式经 `editor-insert` 零改动可用
- ✅ **WYSIWYG 快捷键**：`wysiwygFormat.ts` 新增 `wysiwygShortcutPlugin`（Mod-K 链接、Mod-1/2/3 标题，复用工具栏同一套实现；Mod-B/I 走 Milkdown 自带 keymap）
- ✅ **i18n**：`toolbar.tooltip.admonition` + `dialog.insertAdmonition/admonitionType/admonitionTitle` 三处同步（en / zh-CN / test setup）

**测试规模：** 新增 21 条用例（codeHighlight 5 / codeBlockLangInput 7 / admonitionInsert 4 / wysiwygShortcuts 3 / Toolbar 2），全套 38 文件 612 用例通过；tsc/lint/format 全绿

**新增文件：**

- `src/components/Editor/codeHighlightPlugin.ts`、`src/components/AdmonitionDialog.tsx`
- `src/components/Editor/__tests__/{codeHighlight,codeBlockLangInput,admonitionInsert,wysiwygShortcuts}.test.ts`

**修改文件：**

- `src/components/Editor/{wysiwygPlugins,plantUmlCodeBlockView,wysiwygFormat}.ts(x)`、`src/components/Toolbar/{Toolbar,InsertMenu}.tsx`、`src/styles/globals.css`、`src/i18n/locales/{en,zh-CN}.json`、`src/test/setup.ts`

---

### 2026-08-06 中文 IME（WKWebView）组合输入系列问题修复

用户实测中发现的一串纠缠问题，经事件级日志（临时探针写入 /tmp 日志文件）逐一钉死机制后修复；全套 654 用例通过：

- ✅ **幻影 `\`/空格垃圾**：浏览器在组合输入时往 DOM 插无属性 `<br>` 占位，被 PM 回读成 hardbreak/空格 → `strictBrParserPlugin`（裸 br `ignore:true` 整块忽略；带 `data-type` 的真 hardbreak 保留）+ `hardbreakCleanupPlugin`（compositionend 后 50ms 延迟清理残留，上屏事务在 composing 态 dispatch 不能插手）
- ✅ **回车拼接/被吞**：PM 的 `inOrNearComposition` kludge 吞掉 compositionend 后 500ms 内首个 keydown → `imeEnterGuardPlugin` 在 capture 阶段接管该 Enter（读写 PM 的 compositionEndedAt 保持同步，stopImmediatePropagation 保证只分一次段）
- ✅ **`<!-- -->` 注释包裹**：真凶是 CodeMirror defaultKeymap 的 `Mod-/` → toggleComment（Cmd+/ 切视图时顺手注释了当前行）——已从 CM keymap 移除该绑定
- ✅ **Enter 单换行模型**（用户约定）：普通段落 Enter = 软换行（行间无空行），Enter×2 = 新段落；列表/标题/代码块不变。坑：Milkdown `hardbreakClearMarkPlugin` 会重置带 hardbreak meta 的节点 attrs（isInline 被抹掉）→ 插入事务不带该 meta；prosemirror 原版 splitListItem 与 Milkdown 列表不兼容 → 用 splitListItemCommand
- ✅ **软换行渲染**：isInline hardbreak 默认渲染为不换行的 span → `hardbreakView` nodeview 渲染为 `<br>`
- ✅ **智能引号替换**（`'` 变全角）：WYSIWYG 根设 `autocorrect/autocapitalize=off`，代码块 `spellcheck=false`（CM6 默认已关）
- ✅ **Admonition 序列化加固**：结束围栏前强制空行 + 丢弃尾部空段落（修 `<br />\n:::` 被 html 块吞掉围栏）；`explodeParagraph` 保留原始 break 节点（硬换行往返保真）
- ✅ **AdmonitionDialog 选中态**：ring（box-shadow）被 `.admonition` 的 box-shadow 覆盖 → 改 outline

**新增文件**：`strictBrParserPlugin.ts`、`hardbreakCleanupPlugin.ts`、`imeEnterGuardPlugin.ts`、`hardbreakView.ts`（+ 对应测试）
**机制详解**：`docs/implementation-notes.md`「中文 IME 组合输入系列问题（最终形态）」

### 2026-08-06 编辑器右键菜单（P0+P1+P2 全量落地）

右键菜单从文件树扩展到编辑器三区域，分层「纯函数构建 → 薄壳分发」：

- ✅ **Source（CodeMirror）**：撤销/重做、剪切/复制/粘贴、全选/查找、行内格式组（format:\* 复用 editor-format 通道）
- ✅ **Preview**：复制/全选/导出 PDF；链接落点给打开/复制链接，图片落点给复制图片地址
- ✅ **WYSIWYG 上下文感知**：表格（增删行列/删整表，表头禁删行）、链接（打开/复制/移除）、图片（删除）、代码块（复制代码）；右键落点在选区外先移光标再解析上下文
- ✅ **剪贴板**：新增 `@tauri-apps/plugin-clipboard-manager`（npm+Cargo+capability 全链路），`src/lib/clipboard.ts` 桌面/浏览器双通道
- ✅ **纯函数层**：`src/lib/contextMenu.ts`（三区域构建器 + 平台快捷键标注）+ `src/hooks/useContextMenu.ts`；i18n `contextMenu.*` 26 键三处同步
- ✅ **测试**：lib 构建器 12 例 + wysiwyg 上下文 14 例（真实 Milkdown 编辑器验证表格删除等 PM transaction 的 markdown 往返）；E2E `context-menu.spec.ts` 7 例（三区域弹出/disabled 态/格式动作/表格与链接上下文组）
- **机制与坑**：`docs/implementation-notes.md`「2026-08-06 编辑器右键菜单」

**2026-08-07 补充（Typora 化重组）**：

- ✅ **MenuPanel 子菜单能力**：`MenuSubmenuItem.children`（一层嵌套，hover 展开、右缘翻左、底部上收）
- ✅ **菜单结构对齐 Typora**：段落▸（WYSIWYG 含「正文」）/ 格式▸ / 插入▸（图像/表格/代码块/水平分割线）
- ✅ **在上方/下方插入段落**：当前顶层块前后插空段落并落入光标，解决表格/代码块贴边时 WYSIWYG 难以分段
- ✅ 测试：MenuPanel 子菜单 5 例 + 插入段落/正文/分割线动作 5 例；E2E 更新为子菜单交互 + 新增插入段落用例（8/8）

### 2026-08-07 文件树右键菜单 Typora 化扩展

参考 Typora 文件树菜单，新增四项能力（跳过不适用项：多窗口/文档列表/显示简介/自动填充）：

- ✅ **打开**（仅文件）/ **创建副本**（`a.md` → `a copy.md`，重名递增 ` copy N`，文件夹递归复制）/ **复制文件路径**（clipboard 封装）/ **在 Finder 中显示**（非 macOS 文案为「在文件管理器中显示」）
- ✅ **Rust 新命令**：`copy_path`（目录递归复制）、`reveal_in_folder`（macOS `open -R`；Windows `explorer /select,`；Linux xdg-open 父目录）
- ✅ 空白区菜单补「在 Finder 中显示」（作用于根目录）；i18n `fileTree.*` 6 键三处同步
- ✅ 测试：`copyNameCandidate` 纯函数 5 例 + FileTree 菜单/副本/复制路径/reveal 7 例

### 2026-08-07 P5：Typora 对标第二梯队（菜单/Dock/文件关联/拖拽/侧栏/工具栏）

**完成工作：**

- ✅ **标题栏拖拽修复**（根因双重）：① capabilities 缺 `core:window:allow-start-dragging`（tauri 2.10 的 PLUGINS 表中 `start_dragging` 非默认权限，`internal_toggle_maximize` 是默认——所以此前双击放大可用、拖动不行）；② Tauri 注入的 drag.js 只查 `e.target.getAttribute`（无 closest 上溯），Toolbar 子元素覆盖区域全部不触发 → 分组容器补挂 `data-tauri-drag-region`
- ✅ **原生菜单补全**：menu.rs 重构为 App/文件/编辑/段落/格式/视图/窗口（Typora 结构）；`format:*`/`insert:*` id 与右键菜单同源，前端统一转发 editor-format/editor-insert 事件总线；⌘B/I/K/1-6 桌面端改由菜单事件驱动（浏览器仍走 CM/Milkdown keymap，互不重迭）；⌘0 让位「正文」，实际大小改 ⇧⌘0；新增 Rust 命令无（复用 rebuild/checked/enabled），状态同步扩 sidebarTab check 与 file-reveal enabled
- ✅ **格式能力补齐**：`FormatType` + h4/h5/h6/ol/paragraph；CM 侧新增 `matchBlockPrefix`（标题/引用/任务/无序/有序统一识别，顺带修了任务项转其他格式残留 `[ ] ` 的旧 quirk）与 `applyParagraphFormat`（剥前缀）；Milkdown 侧 applyParagraph（列表 liftListItem / 引用 lift / 其他 setBlockType）
- ✅ **工具栏二轮精简**：删除新建/打开/保存/B/I/标题下拉/列表/插入菜单/格式菜单（FormatMenu/HeadingDropdown/InsertMenu 组件文件删除）；图片插入流程抽为 `src/lib/editorActions.ts`（菜单与工具栏共用）；表格/提示框对话框改由 `app-open-dialog` 事件触发
- ✅ **macOS Dock 右键菜单**：新增 `src-tauri/src/dock_menu.rs`——objc2 `class_addMethod` 给 tao AppDelegate 追加 `applicationDockMenu:`（tao/muda/tauri 均无 API；已防御性检测 respondsToSelector 防未来冲突）；菜单项经 tag 索引映射路径，动作 emit `native-menu-event` 复用前端分发；新命令 `update_dock_menu`（非 macOS 为 no-op 桩）；依赖版本与 tao 0.34 对齐（objc2 0.6 / app-kit 0.3）
- ✅ **文件关联**：`bundle.fileAssociations`（md/markdown/mdown/mkd，role=Editor）；`lib.rs` 改 `build().run()` 处理 `RunEvent::Opened` → 排队（`Mutex<Vec>`，防冷启动竞态）+ emit `file-open-request`；新命令 `take_pending_open_files`；前端 `src/lib/openWith.ts`（监听 + 取积压 + 脏文档确认）
- ✅ **侧边栏精致化**：对标 Typora——实心 accent「打开文件夹」按钮；最近文件行 hover 底色 + 圆角 + w-4 图标；过滤框内嵌搜索图标 + rounded-md；空态居中图标文案；大纲行 hover 底色 + 圆角；文件树行 `mx-1 rounded-md`、选中态由实心 accent 白字改为 `accent/15` 淡底 + accent 文字
- ✅ **E2E/单测改写**：app.spec（高频按钮断言 + MoreMenu 断言）、table-editing.spec（app-open-dialog 路径）、wysiwyg.spec（⌘B 键盘路径）；Toolbar.test 重写（23 例）；nativeMenu.test +14 例；markdownEditing +9 例；openWith 4 例

**测试规模：** 全套 46 文件 732 用例通过；E2E 相关 24 例通过；tsc/lint/format/clippy 全绿；`pnpm tauri:dev` 实测菜单/Dock 安装日志正常

**新增文件**：`src-tauri/src/dock_menu.rs`、`src/lib/editorActions.ts`、`src/lib/openWith.ts`（+ 各自测试）

**机制详解**：`docs/implementation-notes.md`「2026-08-07 P5」一节

**当日追加修复（实测反馈）**：

- ✅ 右键打开文件树/最近文件菜单时不再误触分隔条调宽（`useResizable` 补左键判定）；「拖拽调整宽度」tooltip 走 i18n
- ✅ 视图菜单删除「源代码模式」切换项（与四模式 check 项并列易混淆）；⌘/ 仍由 useKeyboardShortcuts 全局处理
