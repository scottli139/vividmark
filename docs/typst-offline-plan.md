# Typst 离线支持任务计划

> **状态：⏸️ 暂停中**（2026-08-07 修订：对齐 Milkdown WYSIWYG 架构与 typst.ts 0.7.0，全量计划收敛为 MVP 路线）
>
> **2026-08-12 评估结论：维持暂停，Typst 方向整体转向独立产品。** 三轮评估：① 在 VividMark 内做 typst 代码块性价比低——数学公式用 KaTeX（半天 vs 3–4 天）、离线图表用 Mermaid/本地 PlantUML、MVP 中文策略（缺字提示）对主力中文用户半残、机会成本高（WYSIWYG 查找替换/多标签页更高频）；重启触发条件 = 出现真实使用场景，或独立产品验证后回哺基建。② 在 VividMark 内支持 .typ 文档不推荐——无需求证据；Typst 用户已有严格更优的免费工具（VSCode+Tinymist 本地 LSP / typst.app 协作）；「在线平台不方便/不安全」前提不成立（编译器开源，本地工具链成熟）；架构全面冲突 + 产品定位漂移。③ 若做 Typst 能力，以独立编辑器形态做，可行性与工作量分析见 `docs/typst-standalone-editor-plan.md`。
>
> **启动前决策**：如果真实诉求只是数学公式，优先做 KaTeX（PLAN.md Phase 4 待办），成本远低于本计划。Typst 值得做的前提是想要「完整文档排版」能力（图表、排版、数学一体化）。

## 📋 需求概述

为 VividMark 添加 Typst 渲染支持，确保用户在 **离线/弱网环境** 下也能正常使用。

### 目标

- 完全离线渲染 Typst 代码块（` `typst ```）
- 零外部网络依赖（无需 CDN）
- 合理的包体积增量（内置 Latin 字体 < 5MB；内置中文需上调预算，见「待决策事项」）
- 三视图一致可用：WYSIWYG（默认）/ Source+Preview / Split

---

## 🚀 MVP 路线（核心路径，约 3–4 个工作日）

### Phase 1: 调研复核（原调研结论基于 typst.ts 0.5.4，已过时）

| #   | 任务                    | 描述                                                                                                                    | 预估工时 |
| --- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| 1.1 | 复核 typst.ts 0.7.0 API | npm latest 已到 0.7.0（0.8.0 在 rc），初始化方式、WASM 产物形态、字体配置 API 均需重新确认                              | 2h       |
| 1.2 | 确认 WASM 产物清单      | 0.5.x 时代的 `typst_ts_web_compiler_bg.wasm` / `typst_ts_renderer_bg.wasm` 文件名与拆分方式可能已变化，以实际包内容为准 | 0.5h     |
| 1.3 | 体积实测                | WASM + 最小字体集压缩后大小，验证 < 5MB 预算                                                                            | 1h       |
| 1.4 | 字体选型确认            | New Computer Modern + Libertinus（OFL 1.1），CJK 策略见「待决策事项」                                                   | 0.5h     |

**产出：** 更新的技术选型记录（可直接写回本文件）、字体清单、体积实测数据

### Phase 2: 资源准备

| #   | 任务               | 描述                                                        | 预估工时 |
| --- | ------------------ | ----------------------------------------------------------- | -------- |
| 2.1 | 资源目录结构       | `public/typst/`（dev）+ `src-tauri/resources/`（打包）      | 0.5h     |
| 2.2 | 资源下载脚本       | `scripts/download-typst-assets.mjs`（版本锁定，可重复执行） | 2h       |
| 2.3 | 下载 WASM + 字体   | 以 Phase 1 确认的清单为准；OFL 许可文件一并归档             | 1h       |
| 2.4 | Tauri 资源打包配置 | `tauri.conf.json` 的 `bundle.resources`                     | 1h       |

### Phase 3: 前端集成

| #   | 任务                  | 描述                                                                                  | 预估工时 |
| --- | --------------------- | ------------------------------------------------------------------------------------- | -------- |
| 3.1 | 添加依赖              | `pnpm add @myriaddreamin/typst.ts`（锁定调研验证过的版本）                            | 0.5h     |
| 3.2 | 初始化模块            | `src/lib/typst/init.ts`：懒加载（首次遇到 typst 代码块才加载 WASM）                   | 3h       |
| 3.3 | dev / prod 双环境加载 | dev 走 Vite 静态资源，prod 走 Tauri 资源目录（参照 `src/lib/platform.ts` 的环境判定） | 2h       |
| 3.4 | 字体加载              | 内置 Latin 字体注册；失败时回退并提示                                                 | 1.5h     |

### Phase 4: 渲染接入（双编辑器都要接）

| #   | 任务                       | 描述                                                                                                                                                                                     | 预估工时 |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 4.1 | 预览侧（markdown-it）      | `src/lib/markdown/parser.ts` 的 `highlight` 钩子加 `typst` 分支，参照 PlantUML 模式（`parser.ts:44-46`）；异步渲染复用现有 `parseMarkdownAsync` 管线（**扩展而非修改接口**，接口已存在） | 3h       |
| 4.2 | **WYSIWYG 侧（Milkdown）** | 原计划缺失的关键一块：纯 DOM `$view` nodeview + `$remark` mdast 变换，参照 `plantUmlCodeBlockView.ts` 与 `admonitionView.ts`；必须保证 markdown 往返无损（有序列化测试锁定）             | 4h       |
| 4.3 | 错误处理与回退             | 编译失败回退为带错误提示的代码块（参照 `renderPlantUML` 的 error 分支），不阻塞文档其余部分                                                                                              | 1h       |

### Phase 5: MVP 测试

| #   | 任务     | 描述                                             | 预估工时 |
| --- | -------- | ------------------------------------------------ | -------- |
| 5.1 | 单元测试 | parser typst 分支、nodeview 序列化往返、错误回退 | 2h       |
| 5.2 | 离线验证 | 断网 / 飞行模式下三视图渲染验证                  | 1h       |
| 5.3 | 体积验证 | 最终安装包大小对比                               | 0.5h     |

---

## 🧩 后续扩展（非 MVP，按需排期）

| 模块     | 内容                                                                          | 原优先级 |
| -------- | ----------------------------------------------------------------------------- | -------- |
| 性能     | 编译结果缓存（内存起步）、typst.ts 增量渲染                                   | P1/P2    |
| 视觉     | `.typst-render` 样式、WASM 加载 Loading、深色模式 SVG 适配                    | P1       |
| 中文字体 | 系统字体扫描（Rust `get_system_fonts` 命令 + 回退链 + 缓存）；或内置 Noto CJK | P2       |
| 质量     | 性能基准（WASM 加载/渲染耗时）、跨平台验证                                    | P1       |
| 发布     | README（中英）、用户文档、CHANGELOG、版本发布                                 | P1       |

---

## 📄 后续方向：.typ 文档支持（独立特性，不在本计划 MVP 内）

> **2026-08-12 结论：不推荐在 VividMark 内实施。** 理由见文件头部评估结论；.typ 能力若做，走独立产品，见 `docs/typst-standalone-editor-plan.md`。本节分析保留备查（冲突清单与前置重构路径仍然有效）。

本计划的 typst 仅指 **md 文档内的 ```typst 代码块**（宿主是 Markdown，与现有架构零冲突）。让 VividMark 直接打开/编辑 `.typ` 文件是大一档的独立特性，需单独立项，**不要与本计划捆绑实施**。

### 为什么冲突面大

当前架构没有文件类型抽象（store 无 `fileType` 字段），「Markdown 源码是唯一事实来源」贯穿每一层：

- **WYSIWYG**：Milkdown/ProseMirror 的 schema 就是 mdast，typst 源码无法往返，`.typ` 实际只能 Source 模式，`viewMode` 切换需按文件类型门控
- **格式化动作会写坏 typst**：Cmd+B 包 `**`、标题加 `#`，而 typst 语法是 `*bold*` / `= 标题`，`#` 是函数调用前缀；原生菜单/右键菜单/快捷键三入口的 format 动作对 typst 全部有害
- **预览管线**：markdown-it 会把 typst 源码渲染成垃圾，需按文件类型切到「typst 编译 → SVG」的另一条管线；admonition/PlantUML 等 md 扩展不适用
- **大纲**：`outlineUtils` 只认 `#` 标题，typst 是 `= 标题`，大纲会是空的（字数统计通用，无冲突）
- **插入类功能**：图片插入产出 `![]()`（typst 要 `#image("path")`）；表格/提示框对话框插入的都是 md 构造
- **PDF 导出**：现有管线 md→HTML→浏览器打印，typst 应走自己的编译产物
- **文件入口硬编码**（已核实）：文件树过滤 `fileTreeUtils.ts:235`、拖拽校验 `useFileDragDrop.ts:77`、打开/另存过滤器与 `Untitled.md` 命名（`fileOps.ts:28,74`、`editorStore.ts:184`）、文件关联 `tauri.conf.json:42-50`、i18n 文案多处写死「Markdown 文件」

### 建议实施路径（若立项）

1. **前置重构：引入 `fileType` 抽象**——按扩展名派生（`md` / `typ`）存入 store，上述每个冲突点变为「按 fileType 分流」的机械工作
2. **`.typ` MVP 砍到最小**：Source-only（CM6，typst 语法高亮可先无）+ typst 编译预览 + 文件入口（树/拖拽/对话框/关联）放开 `.typ`；WYSIWYG、格式化菜单、插入对话框、图片插入全部禁用——不做「双语法适配」
3. **复用本计划的基础设施**：WASM 懒加载、字体加载、错误回退、离线资源打包全部可直接复用，这也是「先做代码块 MVP」的另一重价值
4. 注意：`.txt` 今天走 md 管线无碍是因为纯文本没有主动语法；typst 的 `#`/`=`/`*` 会被 md 功能误伤，不能照搬这个先例

---

## 🎯 待决策事项

| #   | 问题            | 选项                                                                            | 建议                                                                                        |
| --- | --------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | 中文支持策略    | A. 内置 Noto CJK（+15~20MB，超原体积预算）/ B. 系统字体扫描 / C. 缺字时提示安装 | **MVP 用 C + 内置 Latin 兜底**；中文用户为主，B 建议紧随 MVP 排期；A 仅在体积预算上调后考虑 |
| 2   | WASM 加载时机   | A. 启动时 / B. 首次使用时                                                       | B（懒加载）——已定，无需再议                                                                 |
| 3   | 字体回退        | A. 严格 / B. 宽松                                                               | B（用户体验优先）                                                                           |
| 4   | 缓存策略        | A. 内存 / B. IndexedDB / C. 两者                                                | 从 A 开始（后续扩展再做 B）                                                                 |
| 5   | 与 KaTeX 的关系 | A. typst 内含数学，跳过 KaTeX / B. 两者都做                                     | 若本计划启动则 A；否则先做 KaTeX（PLAN.md Phase 4）                                         |

---

## 📦 资源清单（以 Phase 1 复核结果为准，以下为 0.5.x 时代参考值）

### 依赖

```json
{
  "dependencies": {
    "@myriaddreamin/typst.ts": "^0.7.0"
  }
}
```

### WASM 文件（0.5.x 参考，文件名/拆分需重新确认）

| 文件          | 大小 | 来源     |
| ------------- | ---- | -------- |
| compiler WASM | ~3MB | npm 包内 |
| renderer WASM | ~2MB | npm 包内 |

### 字体文件（最小 Latin 集，OFL 1.1）

| 字体                              | 大小（估） |
| --------------------------------- | ---------- |
| NewComputerModern-Regular.otf     | ~200KB     |
| NewComputerModern-Italic.otf      | ~150KB     |
| NewComputerModernMath-Regular.otf | ~400KB     |
| LibertinusSerif-Regular.otf       | ~300KB     |
| **合计**                          | **~1MB**   |

### 字体文件（中文扩展，如需内置）

| 字体                     | 大小  | 许可    |
| ------------------------ | ----- | ------- |
| NotoSansCJK-Regular.ttc  | ~15MB | OFL 1.1 |
| NotoSerifCJK-Regular.ttc | ~20MB | OFL 1.1 |

---

## ✅ MVP 完成检查清单

- [ ] typst 代码块离线渲染（断网可用）
- [ ] WYSIWYG nodeview 渲染 + markdown 往返无损测试
- [ ] 预览/分屏模式渲染正常
- [ ] 渲染失败回退为代码块 + 错误提示
- [ ] 安装包体积增量符合预算
- [ ] 单元测试通过

---

## 🔗 参考资源

- [typst.ts 文档](https://myriad-dreamin.github.io/typst.ts/)
- [typst.ts GitHub](https://github.com/Myriad-Dreamin/typst.ts)
- [Typst 官方文档](https://typst.app/docs/)
- [OFL 许可证](https://scripts.sil.org/OFL)

---

_创建时间: 2026-03-02_
_最后更新: 2026-08-07（对齐 Milkdown 架构 + typst.ts 0.7.0，收敛为 MVP；补充 .typ 文档支持方向）_
_负责人: TBD_
