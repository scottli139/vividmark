# Markdown 扩展语法支持盘点与方案

> **状态：📋 盘点完成，方案待评审**（2026-08-14）
>
> **结论：** 按「双端成本不对称」决策——预览侧（markdown-it）插件生态成熟、零往返风险，可积极加；WYSIWYG 侧（Milkdown/ProseMirror）每条语法必须先定往返策略再动手。第一梯队推荐：**GitHub Alerts > 脚注 > frontmatter > Mermaid**；第二梯队 `==`/`^`/`~`/emoji 作一次排版增强批。

## 🧱 现状基线与成本模型

**已支持**：

| 端 | 配置 |
| --- | --- |
| 预览/分栏/导出（markdown-it） | `html/linkify/typographer/breaks` 全开；表格、删除线 `~~`；自研：`:::` admonition、KaTeX 数学（`$` 系）、PlantUML（围栏 + 行内，离线渲染） |
| WYSIWYG（Milkdown/ProseMirror） | commonmark 预设（剔除 remark-preserve-empty-line）+ gfm 预设（表格/删除线/任务列表/自动链接）；自研：admonition / PlantUML / 数学 / 本地图片 nodeview，往返无损有测试锁定 |

**成本模型（每条新语法的决策模式）**：

- **预览侧**：markdown-it 插件或自写 rule，只影响渲染、不写源码 → 零往返风险，可先行
- **WYSIWYG 侧**：Markdown 源码是唯一事实来源，需要 remark mdast 变换 + mdast-util-to-markdown 序列化 + PM schema/nodeview 三件套；**没建模的语法在 WYSIWYG 保存时会被改写或丢失**——这是每条语法的首要设计问题
- 站点导出与 PDF 走共享 `parseMarkdown`，预览侧的新语法自动受益（异步渲染类如图表需按 PlantUML 的占位符/内联 SVG 基建另行接入）

## 📊 第一梯队

### 1. GitHub Alerts（`> [!NOTE]`）—— 推荐最先做

```markdown
> [!NOTE]
> 普通提示。Obsidian callouts 同源，另有 `> [!note]-` 折叠标记语法。
```

- **生态**：GitHub 原生渲染（2023 起），Obsidian callouts 同源；类型 NOTE/TIP/IMPORTANT/WARNING/CAUTION 与 `admonitionTypes` 全部对得上
- **现状**：渲染为普通引用块，无样式（优雅降级，不丢内容）
- **往返策略**：本质是 blockquote + 首行标记文本，**天然无损，无需自定义 schema**——这是它便宜的根本原因
- **方案**：
  - 预览侧：blockquote 后处理 rule（首个段落匹配 `[!TYPE]` → 套 `<div class="admonition">` 结构，直接复用现有 admonition CSS）
  - WYSIWYG 侧 v1：纯 CSS `:has()` 装饰（DOM 中 blockquote 首段含 `[!NOTE]` 即上色加图标），标记行作为文本保留可见可编辑，零 schema 变更
  - v2（可选）：nodeview 隐藏标记行、类型切换器
- **坑**：Obsidian 折叠标记 `+`/`-` v1 不识别（原样保留文本，无损）；标记行大小写不敏感（GitHub 要求大写，Obsidian 不敏感——按不敏感处理）

### 2. 脚注（Footnotes）

```markdown
正文引用[^1]。

[^1]: 脚注定义，可多行缩进续行。
```

- **生态**：pandoc、mkdocs `footnotes` 扩展、Typora、Obsidian；文档类内容高频
- **现状**：显示为字面文本
- **方案**：
  - 预览侧：`markdown-it-footnote`（成熟插件，文末集中渲染 + 回链）
  - WYSIWYG 侧：remark 注册 micromark-extension-footnote（解析）+ mdast-util-footnote 的 to-markdown 扩展（序列化）；PM 建模为两个极简节点——`footnote_reference` 行内 atom（显示序号）+ `footnote_definition` 块节点（显示原文本块）
- **往返策略**：靠 mdast-util-footnote 官方序列化；测试锁定「引用与定义对应关系、多引用同定义、未引用定义保留」
- **坑**：定义位置归一化（markdown-it 统一渲到文末，与源码位置无关）；重复 id；definition 在 WYSIWYG 中的移动/删除语义

### 3. YAML frontmatter

- **生态**：Hugo/Jekyll/mkdocs 生态、Obsidian、几乎所有静态站点与笔记工具
- **现状**：预览渲染成 `---` 分隔线 + 文本；导出侧已列入配置感知方案底座（`docs/site-export-config-plan.md` 决策 5）
- **方案**：
  - 预览侧：渲染前剥离（`parseFrontmatter` 纯函数，与导出方案共用）
  - WYSIWYG 侧：**策略 A（建议）**——micromark-extension-frontmatter + mdast-util-frontmatter 解析/序列化，PM 建模为只读 atom 块节点（显示 YAML 原文，编辑走 Source 模式）；策略 B（备选）——不进编辑文档、保存时回贴（类似 base64 预处理思路），更简单但整篇仅 frontmatter 时有边缘
- **往返策略**：策略 A 靠 mdast-util-frontmatter 官方序列化，原文逐字节保留
- **坑**：无闭合 `---` 按正文处理；文档中间出现的 `---` 是分割线不是 frontmatter（仅文档开头生效）

### 4. Mermaid

````markdown
```mermaid
graph TD; A-->B
```
````

- **生态**：GitHub 原生、docs 生态最广的图语法；已在 `PLAN.md` 待办（Known Issues 建议用它替代 ASCII 图）
- **方案**：复用 PlantUML 全套路基建——官方 `mermaid.js`（dynamic import 懒加载，首图出现才加载）；预览侧 fence → 占位符 + 渐进渲染（泛化 `renderPlantUmlPlaceholders` 为通用 diagram 渲染器）；WYSIWYG 双区 nodeview（源码编辑 + 防抖预览，对齐 PlantUML nodeview 模式）；导出侧（PDF/站点）内联 SVG；主题切换按 dark 参数重渲染
- **坑**：mermaid 体积 ~1MB（gzipped ~300KB），必须懒加载；jsdom 跑不了，单测注入假引擎、真引擎冒烟走 e2e（同 PlantUML 测试模式）

## ✍️ 第二梯队：排版增强批（一次做掉）

| 语法 | 示例 | 现状 | 方案要点 |
| --- | --- | --- | --- |
| 高亮 | `==文字==` | 字面文本 | `markdown-it-mark`；WYSIWYG 自写行内 mdast 变换 + PM **mark**（非 node，比 admonition 简单） |
| 上标 / 下标 | `^sup^` / `~sub~` | 字面文本 | `markdown-it-sup` / `markdown-it-sub`；注意单 `~` 与 GFM `~~` 的解析顺序交互 |
| Emoji 短码 | `:smile:` | 字面文本 | **预览侧先行**（`markdown-it-emoji`，源码保持文本零往返风险）；WYSIWYG 可选 remark-gemoji |
| 插入 / 缩写 / 定义列表 | `++ins++` / `*[HTML]:…` / `术语`+`: 定义` | 字面文本 | markdown-it-ins / -abbr / -deflist 现成；优先级低，随批评估 |
| 图片尺寸 | `![a](x.png =100x50)` | 尺寸部分进 URL 导致断图 | 需先选定方言（pandoc `=WxH` 还是 Obsidian `![[img\|300]]`），涉及图片管线，不单随排版批 |

## 🏷️ 第三梯队：生态特定（记录触发条件，不展开方案）

| 语法 | 生态 | 触发条件 |
| --- | --- | --- |
| `???` 折叠提示框 / `===` 内容标签页 / `///` details / `{#id .class}` attr_list / `--8<--` snippets | mkdocs-material / pymdownx | 站点导出配置感知（`docs/site-export-config-plan.md`）落地后按用户反馈 |
| `[[wiki 链接]]` / `![[嵌入]]` / `^块id` | Obsidian / foam | 改变链接解析语义，是产品级决策（笔记工具定位）而非语法插件 |
| `:::{note}` 通用指令 | MyST / JupyterBook（remark-directive 体系） | 与现有 `:::` 容器语法冲突评估后 |
| `[@引用]` 文献引用 / grid tables（合并单元格） | pandoc 学术向 | 有明确用户需求时 |
| `{{#include}}` | mdbook（Rust 生态） | 同上 |

## 🚫 明确不做

- CriticMarkup（审阅批注体系，小众）
- AsciiMath（KaTeX 已覆盖数学需求）
- 任何改变源码语义的「编辑器自动改写」（如 WYSIWYG 保存时把 `!!!` 归一为 `:::`——见配置感知方案 P2 的往返约束）

## 📅 推荐批次

| 批次 | 内容 | 预估 |
| --- | --- | --- |
| 批次 1 | GitHub Alerts（预览装饰 + WYSIWYG CSS 装饰） | 0.5 天 |
| 批次 2 | 脚注（双端，含往返测试） | 1 天 |
| 批次 3 | frontmatter（预览剥离 + WYSIWYG 只读 atom 节点） | 1 天 |
| 批次 4 | Mermaid（复用 PlantUML 基建全链路） | 1.5 天 |
| 批次 5 | 排版增强批：`==` / `^` / `~` / emoji（预览侧先行，WYSIWYG 逐个评估） | 1 天 |

批次间无依赖，可按反馈插单；与站点导出配置感知方案（P1–P3）并行不冲突。

## 🔧 实施约定

每条语法落地时**必须同步**（ checklist ）：

1. **`examples/` 示例文件**：新增对应示例，命名 kebab-case 对齐现有 `math-formulas.md` / `plantuml-diagrams.md` 先例——如 `github-alerts.md`、`footnotes.md`、`frontmatter.md`、`mermaid-diagrams.md`、`typography.md`（排版批合一）。示例需覆盖该语法的全部变体与边界写法（含降级形态），兼作手动验收 fixture
2. **测试**：预览侧进 `parser.test.ts`；WYSIWYG 侧往返进 `wysiwygRoundtrip.test.ts`；与导出/PDF 有交互的补对应用例
3. **文档**：`AGENTS.md` 架构要点（自研语法清单）+ `README.md` / `README.zh-CN.md` 特性列表双版本同步
4. **i18n**：涉及 UI 文案（对话框、菜单）时补 `en` / `zh-CN` 双 locale 与 `src/test/setup.ts` mock 翻译表

## ❓ 待决策事项

1. **批次启动顺序确认**：建议按推荐批次 1→5；若站点导出配置感知先落地，脚注/frontmatter 优先级自然提前（mkdocs 仓库高频）
2. **图片尺寸方言选型**：pandoc `=WxH` vs Obsidian `|width`——影响图片管线设计，单独决策
3. **emoji WYSIWYG 侧是否做**：预览侧先行后按反馈定（纯预览已能满足大部分场景）
