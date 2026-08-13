# Word（.docx）导出可行性与实现方案

> **状态：📋 方案待评审**（2026-08-13 完成可行性验证，未实施）
>
> **结论：可行。** 推荐「系统 pandoc 外部进程」路线（Typora 同款）——已在本机用真实转换 PoC 验证：数学公式转 Word 原生可编辑 OMML、表格/列表/图片全部结构化保留。核心实现约 300–500 行，预估 1–2 个工作日（含测试）。

## 📋 需求概述

- 需求条目：`docs/REQUIREMENTS.md` FR-040.4「导出为 Word (.docx)」（P2）
- 任务看板：`PLAN.md` Phase 6「导出 Word」
- 对标：Typora 的 Word 导出即基于 pandoc；用户预期得到**结构化的原生 Word 文档**（标题样式、真表格、真列表、可编辑公式），而非 HTML 截图式转换

### 文档内容要素（本项目必须处理的）

| 要素 | 来源 |
| --- | --- |
| 标题 / 段落 / 行内样式（粗斜体、删除线、行内代码、链接） | CommonMark + GFM |
| 表格、任务列表 | GFM 扩展 |
| 代码块（hljs 高亮） | markdown-it `highlight` 钩子 |
| 数学公式（`$...$` / `$$` 多行围栏） | 自写 mathPlugin，对齐 micromark-extension-math 3.x |
| Admonition（`:::note` 等） | markdown-it-container |
| PlantUML 图（代码块 + `@startuml` 行内） | plantuml.com 远程渲染 SVG |
| 本地 / 远程图片 | parser.ts `preprocessImages` |

## ✅ PoC 实测记录（2026-08-13，本机 pandoc 3.10.1 +lua）

测试方法：构造含全部要素的 Markdown（标题、混排行内样式、行内/块级公式、表格、代码块、任务列表、引用、`:::note`、本地 PNG、本地 SVG），`pandoc -f markdown -t docx` 转换后**解包 docx 逐项检查**（PoC 目录 `/tmp/word-export-poc/`，可复跑）。

| 要素 | 结果 | 证据 / 说明 |
| --- | --- | --- |
| 数学公式（行内 + 块级） | ✅ 转 Word 原生 **OMML 公式，Word 内可编辑** | `document.xml` 含 `<m:oMath>` |
| 表格 | ✅ 真 Word 表格（`w:tbl`），非图片 | — |
| 列表 | ✅ 真 Word 编号体系（`numbering.xml`，bullet/decimal） | — |
| 标题 | ✅ 映射 Heading1–6 样式（Word 导航窗格可用） | `w:pStyle="Heading2"` |
| 本地图片 | ✅ 自动嵌入 `word/media/` | — |
| SVG 图片 | ⚠️ SVG 嵌入；PNG 兜底依赖外部 `rsvg-convert`，缺失时仅告警嵌 SVG（现代 Word/365 可显示，旧版/WPS 不稳） | 实测两种环境对比 |
| 任务列表 | ⚠️ 退化为普通 bullet，**勾选状态丢失**（pandoc 3.10 docx writer 行为，markdown/gfm 输入均如此） | 无 ☐/☑ 字符 |
| Admonition | ⚠️ pandoc `fenced_divs` 解析为 Div，docx 中**内容保留、样式全丢** | 无底纹无框 |
| 远程图片 | pandoc 会联网抓取嵌入；离线则失败告警跳过 | 未实测（验证时断网），官方行为 |

## 🔍 方案对比

### A. Pandoc 外部进程（推荐）

Markdown → pandoc CLI → docx。公式/表格/列表/标题样式/大纲全部白捡，保真度天花板，Lua filter 可定制任意映射。

- 优点：保真度最高；实现量最小；转换质量随 pandoc 升级自动改进
- 缺点：外部依赖（见「分发与许可」）；自定义语法需预处理兜底

### B. `docx` npm 库纯前端生成

遍历 markdown-it token 流 → docx 元素（Paragraph/Table/ImageRun…）。

- 优点：零外部依赖、完全离线、Vitest 可测、契合全前端架构
- 缺点：需自维护全部结构映射（约 1–2k 行 + 测试）；**数学无成熟 TeX→OMML JS 方案**，只能渲图嵌入（Word 内不可编辑）；工作量约为 A 的 3–5 倍
- 备注：本报告撰写时网络中断，该库最新版本能力（Math/SVG 支持现状）未实时核实，评估基于既有认知

### C. html-to-docx 类库（不可行）

直接转换渲染后 HTML。KaTeX 输出是深层嵌套 span、admonition 依赖 CSS class、任务列表是 `<input>`——转换后全部损坏。`html-docx-js` 的 altChunk 产物只有 MS Word 能打开（WPS/LibreOffice/Google Docs 均失败）。排除。

### D. Rust 侧 docx-rs（不推荐）

Markdown token 流在前端，自定义语法（admonition/数学/PlantUML）Rust 解析器（comrak/pulldown-cmark）均不支持，需重复实现整套解析。纯增成本。排除。

## 🏗️ 推荐架构（方案 A：系统 pandoc）

### 总体流程

```
菜单/MoreMenu → editor-export-word 事件 → exportWord.exportCurrentDocumentToWord()
  → check_pandoc（缓存；缺失 → 引导安装对话框，终止）
  → 保存对话框（默认 <文件名>.docx）
  → wordPreprocess(content)（纯函数，见下）
  → invoke('export_docx', { markdown, outputPath, resourceDir })
       Rust：临时目录写 .md → pandoc 子进程 → 清理 → 返回结果
  → 失败 → alertDialog(messages.exportWordFailed)
```

完全镜像 `exportPdf.ts` 的既有模式（事件名、对话框、日志、错误处理、单测结构）。

### Phase 1：核心管线（约 1–1.5 天）

| # | 任务 | 描述 | 预估 |
| --- | --- | --- | --- |
| 1.1 | `src/lib/wordPreprocess.ts`（新） | 纯函数预处理管线，Vitest 可测：① 任务列表 `- [ ]/- [x]` → `- ☐/- ☑`（复用 parser.ts 的 `TASK_LIST_REGEX`，补回 pandoc 丢失的勾选状态）；② PlantUML 处理见 1.2；③ 数学公式 Phase 1 原样透传（pandoc `tex_math_dollars` 兼容 `$...$` 与 `$$` 多行围栏，分歧见「已知边界」） | 3h |
| 1.2 | PlantUML 预下载 | 复用 `getPlantUmlSvgUrl` 的编码，改调 **`/plantuml/png/` 端点**下载 PNG → 写临时目录 → Markdown 改写为本地绝对路径图片引用（```plantuml 代码块与 `@startuml` 行内两处都处理，对齐 parser.ts 的两处入口）。离线/下载失败 → 保留原代码块（pandoc 渲为代码块）并 warn 日志，不阻断导出。绕开 rsvg-convert 依赖，旧版 Word/WPS 也稳 | 3h |
| 1.3 | `src-tauri/src/word.rs`（新） | `check_pandoc()` → 探测 pandoc（见「探测策略」）；`export_docx(markdown, outputPath, resource_dir)` → `std::env::temp_dir()` 建唯一子目录写 `.md` → `std::process::Command` 执行 `pandoc -f markdown -t docx --resource-path=<resource_dir> -o <output>` → 无论成败清理临时目录。30s 超时；stderr 回传前端。Rust 直调进程与文件 IO，**无需新增 capabilities 权限** | 4h |
| 1.4 | `src/lib/exportWord.ts`（新） | 镜像 `exportPdf.ts`：pandoc 检测缓存 → 保存对话框（filters docx）→ 预处理 → `invoke('export_docx')` → 错误 `alertDialog`。浏览器 dev/E2E 环境（`!isTauri()`）提示仅桌面端可用 | 2h |
| 1.5 | pandoc 缺失引导 | 检测失败时对话框说明「导出 Word 需要安装 Pandoc」+ 平台安装指引（macOS `brew install pandoc` / Windows `winget install pandoc` / Linux 包管理器），附 pandoc.org 链接（shell plugin 打开，已有 `shell:default`） | 1h |
| 1.6 | 接线 | 见「接线点清单」 | 2h |
| 1.7 | 单元测试 | 见「测试计划」 | 3h |

**产出：** macOS/Windows/Linux 桌面端可用的 Word 导出，公式可编辑、图表为 PNG。

### Phase 2：保真增强（可选，各约 0.5 天）

| # | 任务 | 描述 |
| --- | --- | --- |
| 2.1 | reference-doc 样式模板 | `--reference-doc` 提供品牌字体/字号/表格样式模板（pandoc 官方机制，模板需手工在 Word 里改样式后归档） |
| 2.2 | Admonition Lua filter | pandoc `--lua-filter` 把 Div（`:::note` 等）渲染为单格底纹表格，恢复视觉保真。filter 文件随 `bundle.resources` 打包 |
| 2.3 | 数学规范化 | 用 mathPlugin 同款规则扫描出数学段，统一改写为 pandoc 无歧义定界形式，消除「货币保护」分歧（见「已知边界」） |
| 2.4 | 代码块高亮 | pandoc 默认对 docx 代码块做语法着色（`--highlight-style` 可选主题），与 hljs 配色对齐到接近即可 |

### Phase 3：分发增强（可选）

| # | 任务 | 描述 |
| --- | --- | --- |
| 3.1 | sidecar 打包 pandoc | CI 按平台下载官方二进制 → Tauri sidecar。每平台安装包 +30–40MB，与「轻量」定位冲突，仅在用户反馈安装门槛过高时做。许可见下节 |

## 🔌 接线点清单（锚点精确到现有代码）

| 位置 | 改动 |
| --- | --- |
| `src-tauri/src/menu.rs` | `Labels`/`MenuLabels` 加 `export_word` 字段（zh「导出 Word…」/ en「Export Word…」，对照 40/103/161 行）；`file_submenu` 在 `export-pdf`（332 行）后插入 `export-word` 项，**不设 accelerator**（Cmd+P 已给 PDF） |
| `src/lib/nativeMenu.ts` | `handleMenuAction` 加 `case 'export-word'`（对照 101 行），dispatch `editor-export-word` |
| `src/components/Toolbar/MoreMenu.tsx` | 菜单数组在 `export-pdf`（56 行）后加 `export-word`；`handleClick` 加分支（对照 37 行） |
| `src/lib/contextMenu.ts` | 365 行的 `export-pdf` 后加 `export-word`（是否进编辑器右键菜单见「待决策事项」） |
| `src/components/Editor/Editor.tsx` | 与 241 行 `editor-export-pdf` 监听并列，注册 `editor-export-word` → `exportWord()` |
| `src-tauri/src/lib.rs` | `mod word;` + `generate_handler!` 注册 `check_pandoc` / `export_docx` |
| `src/i18n/locales/{en,zh-CN}.json` | 新增 `menu.exportWord`、`toolbar.tooltip.exportWord`、`contextMenu.exportWord`、`messages.exportWordFailed`、`messages.pandocNotFound`（含安装指引变量插值） |
| `src/test/setup.ts` | mock 翻译表补上述 key（对照 60/148 行） |
| `AGENTS.md` | Tauri Commands 表加 `check_pandoc`/`export_docx`；快捷键表无需动（无 accelerator） |

### pandoc 探测策略（关键坑）

macOS **GUI 应用 PATH 极简**（`/usr/bin:/bin:…`），用户经 brew 装的 pandoc 在 `/usr/local/bin` 或 `/opt/homebrew/bin`，裸 `pandoc` 必然 spawn 失败。`check_pandoc` 必须按序探测：

1. 绝对路径候选：macOS `/opt/homebrew/bin/pandoc`、`/usr/local/bin/pandoc`；Windows `%LOCALAPPDATA%\Pandoc\pandoc.exe`、`C:\Program Files\Pandoc\pandoc.exe`；Linux `/usr/bin/pandoc`、`/usr/local/bin/pandoc`、`~/.local/bin/pandoc`
2. 裸 `pandoc`（PATH 兜底，Windows 安装器会写 PATH）
3. 每个候选执行 `--version` 解析首行 `pandoc X.Y.Z`，返回 `{ path, version }`；全部失败返回未安装
4. 探测结果连同**可用路径**一起缓存，`export_docx` 使用该绝对路径，避免二次探测

## 📦 分发与许可

- **Phase 1 只支持系统 pandoc**（Typora 同款引导），零包体积、零许可证问题
- sidecar 打包（Phase 3）：pandoc 为 GPL-2.0，作为独立子进程调用属 mere aggregation，业界通行做法认为不传染主程序（MIT）；需在 `THIRD_PARTY_NOTICES` 声明并附许可证文本。release.yml 增加按平台下载 pandoc 的步骤
- pandoc 依赖极少的运行时（单静态二进制），三平台均有官方构建

## ⚠️ 已知边界与降级

| 场景 | 行为 | 对策 |
| --- | --- | --- |
| 数学「货币保护」分歧 | 应用对齐 micromark-extension-math（无保护），pandoc `tex_math_dollars` 有保护（开 `$` 后须紧跟非空白、闭 `$` 前须非空白且后非数字）。「$5 和 $10」类文本应用渲染为公式、pandoc 视为字面文本 | Phase 1 接受（pandoc 偏保守，方向安全）；Phase 2.3 规范化消除 |
| 任务列表 | 预处理后为 ☐/☑ 符号字符，Word 中不是可点击 checkbox 控件 | 可接受（Typora 相同）；真控件需 docx 内容控件，pandoc 不支持 |
| Admonition | Phase 1 内容保留、无样式（标题行 + 正文段落） | Phase 2.2 Lua filter |
| PlantUML 离线 | 下载失败保留源码代码块 | warn 日志 + 导出结果告知用户 |
| PlantUML 远程图片 | 依赖 plantuml.com 可达（与应用预览行为一致，非新增约束） | — |
| 其他远程图片 | pandoc 联网抓取；离线告警跳过该图 | 可接受 |
| 大文档 | pandoc 处理 MB 级文档秒级完成，30s 超时充足 | — |

## 🧪 测试计划

**单元测试（Vitest）：**

- `src/lib/__tests__/wordPreprocess.test.ts`：任务列表勾选/未勾选/嵌套缩进转换；PlantUML 代码块与行内 `@startuml` 改写（mock 下载成功/失败/离线三态）；数学公式透传不误改 `$` 字面量场景
- `src/lib/__tests__/exportWord.test.ts`：镜像 `exportPdf.test.ts` 结构——**fresh-import 模式**（pandoc 检测有模块级缓存，每用例重新 `import`）；覆盖：检测缺失→引导对话框、用户取消保存、invoke 成功、invoke 失败→alertDialog、非 Tauri 环境降级
- 更新既有测试：`nativeMenu.test.ts`（对照 83 行 export-pdf 用例）、`MoreMenu`/`Toolbar.test.tsx`（对照 181 行事件断言）、`contextMenu.test.ts`（210 行 id 列表快照会随新菜单项变化）

**手动验证矩阵：** 导出产物在 MS Word / WPS / LibreOffice / Google Docs 四家打开，核对公式可编辑、表格结构、图片显示、中文字体。

**E2E：** Playwright 为浏览器环境（无 pandoc），仅覆盖「菜单项可见且点击派发事件」，不断言真实导出。

## ❓ 待决策事项

1. **编辑器右键菜单是否加入「导出 Word」**（`contextMenu.ts`）：PDF 在列，为一致性建议加入；若嫌菜单过长可只进原生菜单 + MoreMenu
2. **Phase 2/3 启动时机**：建议 Phase 1 发布后按用户反馈排期
3. **reference-doc 的品牌样式**：需要产品侧确认默认字体（中文字体栈、标题色）后再做模板
