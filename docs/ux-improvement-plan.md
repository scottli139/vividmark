# VividMark × Typora 体验差距分析与改进方案

> 2026-08-04 制定。任务看板见 `PLAN.md`「UX 改进」一节，本文档记录分析与方案细节。
>
> **进度**：P0 / P1 / P2 已完成（2026-08-04，WYSIWYG 经 Milkdown 落地并提为默认模式）；P3 原生菜单/右键菜单/融合标题栏/设置面板等已落地（2026-08-05/06）；P5 第二梯队（菜单补全段落/格式、Dock 菜单、文件关联、拖拽修复、工具栏二轮精简、侧栏精致化）已完成（2026-08-07）。

## 一、现状诊断

### 1. 致命问题：Typora 的核心卖点尚未实现

- **默认的 WYSIWYG 模式是占位页**：`src/components/Editor/Editor.tsx` 的 wysiwyg 分支只渲染 "Coming soon" 占位内容，而 `editorStore.ts` 默认 `viewMode: 'wysiwyg'` —— 新用户首次打开应用无法输入。
- **编辑器本体是裸 `<textarea>`**：无语法高亮、无编辑辅助，依赖中没有 CodeMirror/TipTap/ProseMirror 等任何编辑器内核。
- Typora 标志性体验（边输入边渲染、光标处展开源码标记、`**bold**` 实时转换、表格可视化编辑、图片粘贴插入）一项都没有。

### 2. 正确性 bug

| Bug | 位置 | 后果 |
| --- | --- | --- |
| base64 回写 | `src/lib/fileOps.ts` `openFileByPath` | 打开文件时把图片预处理成 base64 后的内容写入 store，自动保存会把 base64 写回磁盘，污染/膨胀用户的 .md 文件 |
| Chars/Words 标签对调 | `Sidebar.tsx` 底部统计 | "Words" 显示总字符数，"Chars" 显示词数，且词数算法对英文按字母计数 |
| CSS 变量未定义 | `--text-primary` / `--text-secondary` / `--color-text` / `--color-text-secondary` 被十余处引用但 `:root` 未定义 | 颜色靠继承兜底，暗色模式下存在样式债 |
| 窗口标题硬编码中文 | `Toolbar.tsx` | 英文界面标题栏出现"未命名" |
| tooltip 虚标快捷键 | `Toolbar.tsx` / `FormatMenu.tsx` / `HeadingDropdown.tsx` | 宣称的 Cmd+B/I/K、Ctrl+1/2/3 无任何绑定 |
| 大纲混入代码块注释 | `outlineUtils.ts` `extractOutline` | 代码块里的 `# 注释` 被当成标题 |

### 3. 编辑体验断层

- 快捷键体系缺失：加粗/斜体/标题/链接全靠鼠标点工具栏
- 无智能输入行为：回车不延续列表、Tab 把焦点移出编辑器、无括号配对
- 图片只能按钮插入：不支持粘贴、不支持拖入
- 表格只有插入对话框：`tableUtils.ts` 里写好的行列增删函数没有任何 UI 调用
- 撤销粒度过粗：500ms 停顿才快照一次；撤销后光标位置不恢复
- 无查找替换（REQUIREMENTS 的 P0 需求 FR-003.5）

### 4. 应用外壳与视觉差距

- macOS 上原生标题栏 + Web 工具栏双层 chrome
- 无状态栏、无原生菜单、无右键菜单、无多标签页、无设置面板、无会话恢复
- markdown 主题缺 hr 样式、h4-h6 规则、紧凑列表间距；不跟随系统暗色模式
- `confirm()`/`alert()` 原生弹窗与自绘对话框风格割裂
- 性能隐患：每次按键无防抖全量 `md.render`；大纲/字数每次按键全量重算；撤销栈存 100 份全文快照

### 5. 值得保留的底子

亮暗主题与 Admonition/任务列表/PlantUML 样式完成度高；分栏滚动同步防循环、拖拽反馈遮罩、打印 CSS 注入、日志基建、i18n 覆盖完整。

## 二、改进方案

### P0 — 止血（1~2 天，不改架构）

1. 默认视图改为 `source`；zh-CN 的 wysiwyg 标签"编辑"改为"所见即所得"
2. 修 base64 回写 bug：`openFileByPath` 只把原始内容写入 store，base64 预处理只用于渲染管线
3. 修 Chars/Words 对调与字数统计算法（Words = 拉丁词序列 + CJK 单字；Chars = 总字符数）
4. 补齐/清理未定义 CSS 变量；窗口标题走 i18n
5. 大纲解析跳过围栏代码块

### P1 — 编辑器地基：引入 CodeMirror 6（约 1 周）

Source 模式是 WYSIWYG 交付前的主战场，textarea 已经到头。CM6 一次性解决一大半断层：

- 语法高亮 + 快捷键：`@codemirror/lang-markdown` + 自定义 keymap 实现 Cmd+B/I/K、Cmd+1~6 标题、列表/引用切换（tooltip 虚标问题顺带根除）
- 智能输入：`markdownKeymap` 的 `insertNewlineContinueMarkup` 实现回车延续列表/任务/引用、空项回车退出；`indentWithTab` 支持 Tab 缩进
- 正确的撤销：CM6 history 按操作分组、恢复选区，替换 100 份全文快照的 `HistoryManager`
- 查找替换：`@codemirror/search` 面板（Cmd+F/H）
- 图片粘贴/拖拽插入：CM6 domEventHandlers 复用 `imageUtils` 复制到 assets 的逻辑
- 性能：预览渲染加 100~150ms 防抖；大纲/字数统计随防抖走；CM6 视口内渲染解决大文件卡顿
- 状态栏：字数、光标行:列、缩放、视图模式

CM6 同时是 P2 的 Source 模式底座（Typora 的源码模式同样需要体面的源码编辑器），投入不浪费。

### P2 — 真 WYSIWYG（核心决策，先做 spike）

放弃既有文档规划的"自研 contenteditable + 位置映射 + turndown"路线（光标映射、中文 IME、跨 WebView 一致性全是高风险项），改为 **Milkdown（ProseMirror 内核，markdown 原生）**：

- 开箱即有 Typora 式体验：输入 `## ` 即时渲染、光标处显示源码标记、快捷键、撤销、IME 处理经过验证
- GFM 表格、任务列表有现成插件；admonition/PlantUML 需写自定义 node（工作量集中在此）
- 与 P1 的 CM6 Source 模式组合成 Typora 双模：`Cmd+/` 在 WYSIWYG ↔ Source 间切换，Markdown 源码是两个模式共同的单一事实来源

落地方式：先做 1~2 天 spike 验证 admonition/任务列表/图片管线的插件适配可行性，再决定全面替换。spike 发现硬障碍再退回自研路线。

### P3 — 桌面应用质感与高级体验

> 2026-08-13 方向调整：「多标签页」改为 **Typora 式多窗口（SDI，每文档独立窗口）**，详见 PLAN.md。

- macOS `titleBarStyle` 融合标题栏；原生菜单 + 右键菜单；多窗口 + 会话恢复
- 主题系统（Typora 式 CSS 主题 + 跟随系统暗色）；专注模式 / 打字机模式
- 统一自绘对话框替换 confirm/alert；大纲当前位置高亮跟随；文件树搜索与文件管理
- 设置面板；KaTeX、Mermaid、PlantUML 离线化；HTML/Word 导出

### P4 — 侧栏与工具栏 UI/UX 优化（高优先级，2026-08-05 用户反馈）

用户反馈主界面侧边栏与工具栏体验不够理想。问题清单（诊断详见本文件一节）：

**工具栏**：约 20 个常驻控件、信息密度过高，与 Typora「极简 + 快捷键/菜单」取向相反；低频操作（导出 PDF、语言、缩放）应评估移入菜单/设置；语言选择器是原生 `<select>`，风格不统一。**关联**：原生菜单（承载迁出操作）、macOS 融合标题栏（一体化布局）、主题系统（控件样式收编主题变量）、设置面板（工具栏可配置）、slash menu/悬浮格式条（落地后工具栏可弱化）。

**侧边栏**：当前文件/最近文件/大纲/文件树的信息架构需重排；最近文件无搜索；大纲无当前位置跟随与折叠；文件树只读（无搜索/新建/重命名/右键菜单，且打开即全部展开）；宽度不持久化。**关联**：多标签页（信息架构联动）、原生菜单（文件树右键）、设置面板/会话恢复（宽度等偏好持久化）。

建议作为下一阶段主线，与 P3 关联项统一规划实施。

## 三、顺序理由

P0 止住第一印象流血点和数据损坏 bug；P1 让产品在 WYSIWYG 交付前就有一个能用的编辑器，且是 P2 的 Source 底座；P2 用成熟内核兑现 Typora 核心卖点，避免在自研 contenteditable 上消耗数月；P3 各项彼此独立，可按节奏穿插。
