# 「导出为网站」配置感知方案（MkDocs / VuePress）

> **状态：🚧 部分实施**（2026-08-14 完成设计讨论与真实仓库案例分析；**P1 已于 2026-08-14 落地**：风味探测 / docs_dir 收敛 / nav 原文导航 / frontmatter 底座，新增 36 个单测；`!!!` admonition 双端支持见 P2。P2/P3 待排期）
>
> **结论：可行，分三期。** 保持内置生成器零外部依赖的路线，通过「风味探测 + 配置解析」感知 mkdocs/vuepress 仓库：mkdocs 做深（`nav:` 原文驱动导航），vuepress 诚实 best-effort。核心原则：**配置只影响导航树，从不删减页面**。mkdocs `!!!` admonition 进主解析器（预览/分栏 + WYSIWYG 双端，语法保持往返），站点导出随之自动受益。

## 📋 背景与问题

现状（`src/lib/exportSite.ts` 编排 + `src/lib/siteGenerator.ts` 纯逻辑）：内置静态站点生成器，零外部依赖，镜像目录结构，导航从目录自动推导（数字前缀排序、README/index → index.html、`.md` 互链重写 `.html`、资产原样复制）。

对带 mkdocs/vuepress 配置的文档仓库，存在四个错位：

| 错位 | 说明 |
| --- | --- |
| 范围错 | mkdocs 典型布局 `mkdocs.yml` 在仓库根、文档在 `docs/`；导出会镜像整个仓库，配置文件 / CI 脚本全成「资产」 |
| 导航错 | mkdocs `nav:` / vuepress `sidebar` 的手写标题、顺序、分组被忽略，退回目录推导 |
| 语法错 | mkdocs `!!! note` admonition 渲染不出（应用用 `::: note`，见 `parser.ts` markdown-it-container）；frontmatter 被渲染为 `---` 分隔线，且使 `pageTitleFromMarkdown()` 首行即返回 null、标题检测失效 |
| 资产错 | vuepress `.vuepress/public/*` 约定映射站点根；`.vuepress` 是点开头隐藏目录，当前 Rust 侧读取目录时直接跳过，根引用类图片全断 |

## 🔍 案例仓库分析（设计依据）

本机 `devdocs` 仓库（ HexMeet 开发者中心 ）作为真实案例，暴露了设计的全部模糊点：

- **双配置共存**：根 `mkdocs.yml`（material 主题、`docs_dir: ./docs`、显式 nav）+ vuepress 1.8.2（`docs/.vuepress/config.js` 有完整 `themeConfig.sidebar`）。README 称站点用 VuePress 构建，但 mkdocs.yml 更新更近——处于迁移中期
- **nav 是刻意策展（白名单），不是覆盖不全**：mkdocs nav 只收 ~7 篇；`hjt-platform/HJT-Platform-API-1.4.2/1.4.3.md`（旧版 API）、`rn/`（发版说明）等 20+ 篇故意不进侧栏，只从正文链接进入。**mkdocs 语义本就如此：nav 控制导航可见性，非 nav 页面照常构建、URL 可达；真正不构建要用 `exclude_docs`（1.5+）显式排除**
- nav 含**外链条目**（公司主页 / 隐私政策）——`SiteNavEntry` 需要新增 external 类型
- vuepress config 里有**注释掉的 sidebar 项**、可执行 JS（`require`）——正则提取不可靠的实证
- 双资产约定：mkdocs 引用 `docs/public/logo.png`，vuepress 引用 `/logo.png`（即 `docs/.vuepress/public/`）
- 用户很可能直接打开 `docs/` 子目录而非仓库根——配置文件在上一级

## 🎯 核心决策

### 1. 增强内置生成器，不调用外部工具链

「检测到配置就跑 `mkdocs build` / `vuepress build`」保真度最高，但违背零依赖设计目标，且要处理工具安装检测、vuepress v1/v2 差异、node 环境，脆弱。内置生成器 + 配置感知可离线、可控、可单测。远期可加「本机已装工具链时原生构建」高级选项，不在本方案范围。

### 2. 确定性优先级：mkdocs > vuepress

不靠 mtime 猜测（git checkout 会刷新 mtime）。理由：mkdocs.yml 是声明式 YAML，可可靠解析；vuepress config 是可执行 JS，注定只能 best-effort。能力不对等时让能做好的赢。零/一/两个配置三种命中都是确定性结果。

### 3. 页面集与导航彻底分离（最重要）

- **导航 = mkdocs nav 配置原文，一项不多**。刻意隐藏（旧版文档、发版说明）的页面绝不出现在侧栏——不做「未收录页面自动追加」（mkdocs 的追加只是缺省兜底且会告警，作者明知留空即策展意图）
- **页面集 = docs_dir 下全部 md，照常导出**。靠正文交叉链接（`.md → .html` 重写已保证）与直接 URL 可达
- **真正排除认 `exclude_docs`**（mkdocs 1.5+ glob，P2）。「故意隐藏」与「故意排除」是配置层的两种语义，照单执行，不发明第三种
- vuepress 同理：`sidebar` 只控制导航可见性，页面集仍由文件系统决定。两生态规则一致

### 4. `docs_dir` 收敛导出范围

mkdocs 风味下导出范围 = `docs_dir`（缺省 `docs/`），仓库根的 `mkdocs.yml`、`package.json`、部署脚本、根 README（讲仓库本身而非站点内容）全部不进导出。

### 5. frontmatter 是三种风味共同的底座

剥离不渲染、读 `title` 做导航标题、`pageTitleFromMarkdown` 跳过 frontmatter 块再取 H1。无配置仓库同样受益（frontmatter 是通用约定）。

### 6. 向上一级探测配置（仅 mkdocs）

打开目录自身无配置时，检查上一级是否存在 `mkdocs.yml` 且其 `docs_dir` 恰好解析到打开目录，是则采信（docsRoot = 打开目录本身）。覆盖「用户直接打开 `docs/`」的真实场景，不过度推广（vuepress 不做向上探测）。

### 7. 优雅降级契约

不支持的语法（pymdownx 系、snippets、Vue 组件等）渲染为可读原文，**导出永不因语法失败**。写进测试。

## 🏗️ 技术设计

### 风味探测

```typescript
type SiteFlavor = 'plain' | 'mkdocs' | 'vuepress'

interface SiteFlavorInfo {
  flavor: SiteFlavor
  /** 导出范围根（相对打开目录，如 'docs'；'' = 打开目录本身） */
  docsRoot: string
  /** mkdocs.yml 绝对路径（mkdocs 风味时存在，供读取解析） */
  mkdocsConfigPath?: string
}
```

探测顺序（命中即停）：

1. 打开目录根有 `mkdocs.yml` / `mkdocs.yaml` → mkdocs，`docsRoot` 取配置 `docs_dir`（缺省 `docs`；目录不存在则告警退回 `''`）
2. 上一级有 `mkdocs.yml` 且其 `docs_dir` 解析回打开目录 → mkdocs，`docsRoot = ''`（决策 6）
3. 打开目录根有 `.vuepress/`（或 `docs/.vuepress/`）→ vuepress，`docsRoot` 相应为 `''` 或 `'docs'`
4. 否则 plain（现状行为 + frontmatter）

探测用现有 `file_exists` / `read_file` / `read_directory` 命令，**零新增 Rust 命令**。实现检查点：Rust `read_directory` 对隐藏目录的跳过逻辑是否只作用于子项——vuepress 风味需能直接读 `<root>/.vuepress/public`（P3）。

### mkdocs 配置解析

```typescript
interface MkdocsConfig {
  siteName?: string
  docsDir?: string
  nav?: MkdocsNavItem[] // 递归：单项 map，标题 → 路径字符串 / URL / 子项数组
  excludeDocs?: string[] // P2，glob
}

function parseMkdocsConfig(yamlText: string): MkdocsConfig
```

- YAML 解析引入 `yaml` 包（~40KB、零传递依赖、久经考验；手写 YAML 子集解析是坑，nav 标题含冒号/括号的引号转义自己处理必然漏）
- nav 路径统一剥 `./` 前缀 → `mdHrefToHtml` 同款映射（`README/index → index.html`）
- nav 指向的文件不存在：跳过该项 + warn 日志（mkdocs 会构建失败，我们降级）
- nav 标题优先于页面 H1（nav 显示与 `<title>`）；未收录页面退回 frontmatter `title` → H1 → 文件名
- `siteName` 作站点标题（现状取目录名）

### 导航模型扩展

`SiteNavEntry` 增加 `external` 类型：

```typescript
interface SiteNavEntry {
  type: 'page' | 'dir' | 'external' // external 新增
  title: string
  htmlPath?: string
  externalUrl?: string // external：新窗口打开（target="_blank" rel="noopener"）
  children?: SiteNavEntry[]
}
```

mkdocs 风味下 `buildNavFromMkdocsNav(nav, pages)` **取代** `buildNavModel`（无自动推导、无追加）；plain / vuepress 风味维持 `buildNavModel` 目录推导。`renderNavHtml` / `flattenNavTitles` 适配 external。

### frontmatter

```typescript
function parseFrontmatter(content: string): { data: Record<string, unknown> | null; body: string }
```

文档开头 `---` 围栏块用 `yaml` 解析；导出渲染前剥离 body，`title` 注入标题表。`pageTitleFromMarkdown` 先跳 frontmatter 再扫 H1（修复失效）。

### mkdocs `!!!` admonition（P2，主解析器双端支持）

结论：`!!!` 支持进**主解析器**（预览/分栏 + WYSIWYG），不做导出侧专用插件——`exportSite` 与预览共用 `parseMarkdown`，主解析器支持后站点导出自动受益。两端难度不对称：

**预览/分栏（markdown-it 侧，约半天）**：自写块级 rule——**不能复用 markdown-it-container**（它靠成对围栏定界，而 mkdocs `!!!` 无结束围栏，内容范围由「后续 4 空格缩进的行」决定）。规则：匹配 `^!!!\s*([a-z]+)\s*(?:"([^"]*)"|(.*))?$` → 消费后续缩进行/空行 → dedent 后 `md.block` 递归解析。产出 HTML 复用现有 `<div class="admonition">` 结构与 CSS，视觉零成本；类型名对齐 `admonitionTypes`，未识别类型按 note 处理；标题剥引号是唯一的语法差异点。

**WYSIWYG（Milkdown/ProseMirror 侧，约一天）**：扩展 `admonitionPlugin.ts` 现有三段式，有一个硬性约束与一个技术难点：

- **硬性约束：必须 `!!!` 进、`!!!` 出（语法保持往返）**。Markdown 源码是唯一事实来源，WYSIWYG 保存 = PM 文档重新序列化；若把 `!!!` 归一成 `:::` 写回，用户在 WYSIWYG 里编辑并保存 mkdocs 文档后源码围栏被改写——而 Python-Markdown 只认 `!!!`，`:::` 在 mkdocs 站点退化为普通文本，等于弄坏用户的 mkdocs 构建。因此 PM 节点增加 `syntax: 'colon' | 'bang'` attr，序列化按 attr 分支。
- **技术难点：缩进信息到 mdast 层已被抹掉**。`!!! note\n    内容\n\n    第二段` 经 commonmark 解析变成「标记行融合段落 + 缩进代码块兄弟节点」，多段内容归属无法从 mdast 可靠复原。故解析侧不在 remark 变换里做，而是加**文本级预处理**，挂在 Milkdown 解析之前（`defaultValueCtx` 与 `replaceAll` 两个入口均收原始 markdown 字符串，挂点现成）：按空行分块 → 识别 `!!!` 首行 → 收集后续缩进块并 dedent（Python-Markdown 自己的 block processor 同款做法）→ 转成内部 `:::` 形式并编码 bang 来源，现有 mdast 变换识别后置 `syntax: 'bang'`。
- **序列化**：`admonitionToMarkdown` 按 attr 分支，bang 形式输出 `!!! type "title"` + 内容每行加 4 空格缩进。nodeview 不动（DOM 相同，仅多一个 attr）。
- 用户在 WYSIWYG 里**新建** admonition 仍默认 `:::`（应用原生语法）；bang 仅来自源码，编辑其类型/标题/内容时保持 bang 写回。

### vuepress best-effort（P3）

- `.vuepress/public/*` 复制到站点根（vuepress 风味专属规则）
- config 的 `title` / `description` 正则提取（`title:\s*['"](...)['"]`），提到「尽力而为」，不做受限求值（见待决策 2）
- 导航不做 sidebar 解析，退回目录推导 + frontmatter title
- README.md 目录首页约定、`:::` 容器语法与现有实现天然兼容，零成本

### 导出结果反馈

成功提示带风味信息（不打断流程），如：「已导出到 …（检测到 MkDocs 配置，导航按 mkdocs.yml 生成）」。i18n 新增对应 key。

## 📅 分阶段任务

### P1：mkdocs 配置感知核心（约 1.5 天）

| # | 任务 | 描述 | 预估 |
| --- | --- | --- | --- |
| 1.1 | 依赖 + 解析纯函数 | `yaml` 依赖；`parseMkdocsConfig` / `parseFrontmatter`（`siteGenerator.ts` 或新 `siteConfig.ts`，纯函数可单测） | 3h |
| 1.2 | 风味探测 | `detectSiteFlavor`（含向上一级、docs_dir 存在性回退） | 2h |
| 1.3 | nav 模型扩展 | external 类型；`buildNavFromMkdocsNav`（标题/顺序原文、外链、缺文件跳过、**不追加**）；`renderNavHtml` 适配 | 3h |
| 1.4 | 编排接入 | `exportSite.ts`：探测 → docsRoot 子树收敛 → 读配置 → nav/标题注入（nav > frontmatter > H1 > 文件名）→ frontmatter 剥离渲染 → 结果提示带风味 | 3h |
| 1.5 | i18n + 单测 | 见测试计划 | 4h |

**产出**：mkdocs 仓库导出 = 范围收敛 docs_dir + 导航忠实配置意图 + 全页面正文链接可达；无配置仓库行为不变 + frontmatter 支持。

### P2：mkdocs `!!!` 语法双端支持 + 排除（约 2 天）

| # | 任务 | 描述 | 预估 |
| --- | --- | --- | --- |
| 2.1 | `!!!` 预览/分栏支持 | markdown-it 自写块级 rule（缩进定界，**不复用** markdown-it-container），产出复用现有 admonition HTML/CSS | 4h |
| 2.2 | `!!!` WYSIWYG 支持 | 文本预处理器（`!!!` 缩进块 → 内部 `:::` 形式 + bang 来源编码）+ PM 节点 `syntax` attr + 序列化分支 + 往返测试 | 8h |
| 2.3 | `exclude_docs` glob 过滤 | 页面与资产同滤（相对 docs_dir 路径匹配） | 2h |

**产出**：mkdocs 文档在预览/分栏直接渲染 `!!!` 提示框；WYSIWYG 可编辑且保存后源码围栏原样保持（`!!!` 不被改写为 `:::`）；站点导出经共享 `parseMarkdown` 自动获得同样渲染。

### P3：vuepress best-effort（约 0.5 天）

| # | 任务 | 描述 |
| --- | --- | --- |
| 3.1 | `.vuepress/public` → 站点根 | 含隐藏目录读取检查点验证 |
| 3.2 | config title 正则提取 | 站点名尽力而为 |

## 🔗 依赖与顺序约束（2026-08-14 补充）

1. **前置已清**：`yaml` 依赖已拍板引入（2026-08-14），P1 无阻塞待决项，可直接开工
2. **frontmatter 三层拆分**（与 `docs/syntax-extensions-plan.md` 批次 3 协同）：`parseFrontmatter` 纯函数随本方案 P1 落地（任务 1.4 的 nav 标题注入依赖它）；预览剥离（3a）与 WYSIWYG 只读 atom 节点（3b）是语法方案的独立增量，不阻塞本方案
3. **热点文件串行**：P2 的 `!!!` 双端支持改动 `parser.ts` / `wysiwygPlugins.ts`（全部语法批次的共同热点，remark 注册顺序敏感），与语法扩展方案的各批次统一排队、不并行分支；P2.2 预处理器挂 `defaultValueCtx` / `replaceAll` 两个 Milkdown 入口（`WysiwygEditor.tsx`）
4. **导出管线定型顺序**：本方案 P1–P3 期间 `exportSite.ts` 编排层大幅重写；Mermaid（语法方案批次 4）的导出侧内联 SVG（`exportSite.ts` / `exportPdf.ts`）必须等 P3 完成后接入，避免互相返工

## 🧪 测试计划

**单元测试（Vitest，全部为纯函数）：**

- `parseMkdocsConfig`：嵌套分组、外链条目、标题含冒号/括号的引号形式、缺 `docs_dir` 缺省、`exclude_docs` 数组
- `detectSiteFlavor`：plain / mkdocs / vuepress / 双配置优先级 / 向上一级命中与不命中（docs_dir 不指回打开目录）/ docs_dir 不存在回退
- `buildNavFromMkdocsNav`：标题优先于 H1、顺序原文、external 渲染、**未收录页面不进导航但仍导出**、nav 缺文件跳过
- `parseFrontmatter`：正常块、无闭合 `---`（按正文处理）、非文档开头不算、title 提取；`pageTitleFromMarkdown` 跳 frontmatter
- `!!!` admonition（预览侧）：各类型、引号/非引号标题、未识别类型降级 note、多段缩进内容、容器内代码块、未缩进行截断（内容结束）
- `!!!` WYSIWYG 往返（照 `wysiwygRoundtrip.test.ts` 模式扩）：`!!!` 进 `!!!` 出、syntax attr 保持、嵌套 admonition、容器内围栏代码块、位于引用/列表内（缩进叠加）、空容器、标题含引号转义、WYSIWYG 新建 admonition 默认 `:::`
- 优雅降级契约：pymdownx/snippets 等未知语法输出可读原文且导出成功
- 编排层：mock invoke/readDirectory 的 `exportSite` 风味分支

**手动验证矩阵：** devdocs 案例仓库（双配置、刻意隐藏页面、外链）+ 纯 mkdocs 仓库 + 纯 vuepress 仓库 + 无配置仓库，检查导航结构、隐藏页面正文链接可达、图片资产、外链条目。

**E2E：** Playwright 为浏览器环境，仅覆盖菜单项派发事件，不断言真实导出（同 PDF/站点现状）。

## ⚠️ 已知边界与降级

| 场景 | 行为 |
| --- | --- |
| vuepress sidebar/nav | 不解析（可执行 JS），退回目录推导 + frontmatter title |
| pymdownx 系（snippets/tabs/inlinehilite 等） | 渲染为可读原文，不报错 |
| mkdocs `???` 折叠提示框 | 不在 P2 范围（独立语法构造，details/summary 语义），渲染为原文；如需要单列后续项 |
| `use_directory_urls` | 不追；导出保持 `.html` 镜像结构（内部自洽，`.md` 互链已重写） |
| mkdocs `extra_css` / 主题（material palette/tabs 等） | 不复刻；css 文件作为资产镜像但不注入页面 |
| mkdocs plugins（search/glightbox/revision-date） | 不追；搜索是站点级 JS 能力，超出生成器范围 |
| mermaid（vuepress 侧常见） | 渲染为代码块（应用本身未支持 mermaid） |
| PlantUML | 现有能力直接覆盖（本地离线渲染，优于案例仓库配置的远程 server） |

## ❓ 待决策事项

1. ~~双配置命中的提示~~ **已决策（2026-08-14）**：导出成功提示带一句「已采用 MkDocs 配置」，不打断流程、不加确认框
2. ~~vuepress config 受限求值~~ **已决策（2026-08-14）**：不做受限求值，仅正则提取 `title`；导航退回目录推导 + frontmatter
3. ~~`yaml` 新依赖引入~~ **已决策（2026-08-14）**：引入 `yaml` 包（~40KB，零传递依赖），用于 mkdocs.yml 与 frontmatter 解析

~~4. mkdocs `!!!` 语法是否进编辑器预览~~ **已决策（2026-08-14）**：进主解析器双端（预览/分栏 + WYSIWYG），语法保持往返，见 P2。
