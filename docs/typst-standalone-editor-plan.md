# 独立 Typst 编辑器：预研与可行性分析

> **状态：📋 预研完成，未立项**（2026-08-12）
>
> **核心结论**：Typst 能力**不并入 VividMark**（代码块 MVP 与 .typ 文档支持经评估均不值得，结论已写回 `typst-offline-plan.md` 头部）。若启动 Typst 方向，以**独立产品**形态做「轻量、原生、离线的 Typst 编辑器」。本文档为该方向的可行性评估与预研，供立项决策使用。
>
> **产品形态预期（先立对）**：Typst 是可编程排版语言，真 WYSIWYG 不现实（官方 typst.app 也不是所见即所得）。产品上限 = 「源码 + 逐键即时预览」双栏，即**原生、离线版的 Overleaf 单体体验**，对标 Typora 的设想不成立。

---

## 1. 市场与需求判断（2026-08-12 事实核查）

- **LaTeX 仍是学术投稿事实标准**：IEEE / Springer LNCS / ACM / Elsevier 及大学学位办仍要求 LaTeX 源文件；arXiv 也只收 LaTeX 源码；几乎没有期刊接受 .typ 投稿（[Typst 论坛](https://forum.typst.app/t/which-scientific-journals-are-accepting-typst-files-as-article-submission-at-current-date/2571)、[LetX 2026 对比](https://letx.app/blog/latex-vs-typst-2026/)）
- **Typst 的真实主流用法是混合流**：Typst 起草（语法干净、编译快、报错友好）→ 投稿前转 LaTeX（[underleaf.ai](https://www.underleaf.ai/blog/typst-vs-latex)）。强势场景是格式自主可控的写作：草稿、笔记、简历、幻灯片、课程报告、部分学位论文模板
- **「typst.app 在线平台不方便/不安全」不构成需求缺口**：Typst 编译器 Apache-2.0 开源，本地工具链成熟且免费——官方 CLI（`typst watch` 本地即时编译）+ [Tinymist](https://github.com/Myriad-Dreamin/tinymist)（LSP 补全/诊断 + typst-preview 即时预览，VSCode/Neovim/Zed 可接）。在乎本地/隐私的用户已有严格更优的答案，文件不出本机
- **真正的生态位空白**：轻量、原生、离线、开箱即用的独立 GUI 编辑器（不装 VSCode、不依赖云端）。现有竞品 [typstwriter](https://github.com/Bzero/typstwriter)（PyQt）、[Typesetter](https://codeberg.org/haydn/typesetter)、Typstify（商业）均无霸主
- **预期管理**：Typst 用户群小且高度技术化（恰恰是最不怕 VSCode 的人群），作为获取用户的产品冷启动会慢；作为个人兴趣项目 / 押注 Typst 增长 / 练手新架构，则成本可控、天花板明确

---

## 2. 能力天花板（能做到什么程度）

按成熟度分层：

- **基础层**：源码编辑 + **毫秒级增量预览**。Typst 增量编译在会话内生效，实测重编译约 26ms（comemo 增量引擎，见 [Zed 预览 RFC](https://github.com/zed-industries/zed/discussions/51633)）——逐键即时预览，比 LaTeX 生态任何工具快一个数量级
- **进阶层**：双向定位（点击预览跳源码、滚动同步）、诊断面板、多页 SVG 分页渲染、原生 PDF 导出
- **智能层**：外挂 Tinymist → 补全、悬停文档、诊断、跳转定义全套。做到这层 = **VSCode+Tinymist 的能力装进 10MB 级原生应用**，与当前最好的 Typst 编辑体验同级——这就是天花板
- **生态层**：Typst 包仓库（模板/包下载缓存）；字体走系统 fontdb——**CJK 问题天然解决**（对比 WASM 路线需内置 15–20MB 字体）
- **做不到**：真 WYSIWYG（布局依赖代码执行结果）

---

## 3. 技术路线对比

前提认知：Typst 编译内核只有 Rust 形态，但**开发者可以全程不碰 Rust**——社区已包出各语言绑定与预编译二进制。

| 维度                      | ① Tauri + sidecar 二进制（≈纯 TS）✅ 推荐 | ② Node 原生绑定（Electron）                                                                               | ③ Python（PySide6 + [typst-py](https://pypi.org/project/typst/)） | ④ WASM（typst.ts，纯 Web）                              |
| ------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------- |
| 要写的语言                | TypeScript                                | TypeScript                                                                                                | Python                                                            | TypeScript                                              |
| 编译性能                  | 原生（sidecar 内增量，毫秒级）            | 原生（napi）                                                                                              | 原生（Rust 绑定）                                                 | WASM，最慢                                              |
| CJK 字体                  | **系统字体，天然解决**                    | 系统字体                                                                                                  | 系统字体                                                          | **必须内置字体，+15~20MB**                              |
| 安装包体积                | 小（app ~10MB + sidecar 30~40MB）         | 大（Electron +150MB）                                                                                     | 中（PyInstaller ~50MB）                                           | 小，但 WASM 21MB+字体                                   |
| 集成深度（点击跳转/诊断） | 中→高（取决于 sidecar 选型）              | 高                                                                                                        | 中                                                                | 高（自带位置映射）                                      |
| 主要风险                  | 低（sidecar 是官方/社区发布物）           | native addon 跨平台分发，有 [Linux 构建段错误报告](https://github.com/Myriad-Dreamin/typst.ts/issues/813) | Qt 编辑控件远不如 CM6，UI 生态弱；typstwriter 已占坑              | 回到 VividMark 暂停计划的那堆坑（字体/体积/版本 churn） |

②③④ 各有硬伤；嵌入式 Rust（Tauri + 直接依赖 typst crate）集成最深但唯一需要写 Rust，作为 ① 的后续升级路径保留。

---

## 4. 推荐架构（sidecar 路线）

**Tauri + React + CodeMirror 6 + tinymist 一个 sidecar 撑起全部后端**（Zed 同款架构，见其 [RFC #51633](https://github.com/zed-industries/zed/discussions/51633)）：

```
CM6 前端（TypeScript）
   │  LSP (JSON-RPC/stdio) ──→ 补全 / 诊断 / 悬停 / 跳转定义
   ▼
tinymist 预编译二进制（sidecar，Tauri shell 插件拉起，零 Rust 代码）
   │  preview server (WebSocket) ──→ 增量 SVG 分页 + 位置映射 + 滚动同步
   ▼
comemo 增量编译（~26ms 重编译，进程内常驻）
```

要点：

- **tinymist**（Apache-2.0，活跃维护）一个二进制同时给 LSP 智能 + typst-preview 即时预览 + 位置映射（VSCode 预览即这套）；自己只写 TypeScript 客户端
- PDF 导出：tinymist / 官方 `typst` CLI 直出
- 系统字体 = CJK 零成本；Typst 升级 = 换 sidecar 二进制，无需改代码
- **降级起步方案**：不用 tinymist 预览协议时，官方 `typst watch --format svg` 输出临时目录 + 前端监听刷新——预览体验几乎一致，只丢点击跳源码，集成风险趋近于零。**MVP 建议从此起步**
- 后续若需更深集成（内存级位置映射、更丰富诊断），仅替换编译服务层为嵌入式 typst crate，前端不动
- 复用 VividMark 资产：Tauri 脚手架、原生菜单（menu.rs）、Dock 菜单、文件关联、文件树、设置/i18n/主题、release CI——约占编辑器 30–40% 代码量，是实打实的提前量

---

## 5. 工作量估算（全职当量）

### 5.1 sidecar 架构（推荐）

| 阶段     | 内容                                                                        | 估时                  |
| -------- | --------------------------------------------------------------------------- | --------------------- |
| **MVP**  | 脚手架 + 文件操作 + 菜单（VividMark 搬运）                                  | 3–4 天                |
|          | sidecar 编译管线：进程管理 + `typst watch` SVG 刷新（或 tinymist 预览对接） | 2–4 天                |
|          | 预览面板 + 滚动同步 + 错误展示（stderr 诊断解析）                           | 2–3 天                |
|          | CM6 基础高亮（tokenizer 级）                                                | 1–2 天                |
|          | PDF 导出（sidecar 直出）                                                    | 0.5 天                |
| **小计** | **能打字、逐键即时预览、能出 PDF**                                          | **约 1.5–2 周**       |
| **V1**   | CM6 ↔ LSP 桥接（有社区桥接包可参考，维护状态需 spike 验证）                 | 1–2 周                |
|          | 点击预览跳源码（tinymist 位置映射）                                         | 2–3 天                |
|          | 主题/i18n/设置/错误态打磨 + 打包发布                                        | 1–1.5 周              |
| **小计** | **能力对标 VSCode+Tinymist，体验更轻**                                      | **累计约 1–1.5 个月** |

### 5.2 备选：嵌入式 Rust 架构（Tauri + typst crate）

仅记录供对比：MVP 约 2–3 周（World trait 实现 5–8 天为核心难点），V1 累计约 1.5–2 个月。集成最深、无 sidecar 分发，但需要写并维护 Rust。

---

## 6. 主要风险

- **CM6 ↔ LSP 客户端集成**：无成熟现成胶水（社区桥接包维护状态需验证），是 V1 最大不确定项；降级为「诊断面板 + 手动编译」体验仍及格
- **CM6 无现成权威 Typst Lezer 语法包**：MVP 用简化 tokenizer 高亮顶上；完整 Lezer grammar 是 1–2 周独立工作（LSP 接入后诊断比高亮更重要，可延后）
- **tinymist 预览协议耦合**：协议为 VSCode webview 场景设计，跟随其发布周期；预览 UX 定制空间受限
- **竞争现实**：真正的对手是免费的 VSCode+Tinymist 和零安装的 typst.app；差异化只有**原生、离线、轻量、专注写作**
- **受众规模**：Typst 用户群小且技术化，冷启动慢，用户增长预期放低

---

## 7. 立项前 Spike（两个验证点，通过再开工）

1. **半天**：命令行跑通 `typst watch --format svg` + 前端轮播刷新，确认逐键预览流畅度
2. **一天**：拉起 tinymist sidecar，从 Node 侧连通 LSP（stdio JSON-RPC）与预览 WebSocket

两个 spike 都通，剩余工作全部落在编辑器 UI / 文件管理 / 菜单等成熟能力区间，无未知深渊。

---

## 🔗 参考资源

- [Typst 官方](https://typst.app/) / [开源说明（编译器可嵌入）](https://typst.app/open-source/) / [Typst Universe 包仓库](https://typst.app/universe/)
- [Tinymist（LSP + 预览）](https://github.com/Myriad-Dreamin/tinymist) / [文档](https://myriaddreamin.github.io/tinymist/)
- [typst.ts（WASM/Node 路线，不推荐但可参考）](https://github.com/Myriad-Dreamin/typst.ts)
- [Zed 编辑器 Typst 预览 RFC（sidecar 架构蓝本）](https://github.com/zed-industries/zed/discussions/51633)
- 同类竞品：[typstwriter](https://github.com/Bzero/typstwriter) / [Typesetter](https://codeberg.org/haydn/typesetter) / [Typstify](https://typstify.com/)

---

_创建时间: 2026-08-12_
_关联文档: `docs/typst-offline-plan.md`（VividMark 内集成方案，维持暂停）_
