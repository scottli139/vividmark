# Tauri 框架选型评估：来自 VividMark 的实战报告

> 评估时点：2026-09。项目使用 Tauri 2.10，当时最新稳定版 2.11.5（2026-07-01）。
> 本文不是 benchmark 转载，而是一个真实 Tauri 2.x 生产应用六个多月开发的一手记录。
> 文中每一项结论都标注了本仓库内可验证的出处（文件路径 / commit hash）。

## 0. TL;DR

Tauri 兑现了它的核心承诺——小包体、Rust 后端、Web 前端自由选型、像样的安全模型。但"写一套 Web 代码就能出跨平台桌面应用"的宣传口径与工程现实有明显差距：**省掉的 Chromium 体积，会以"三个系统 WebView 的适配 + 原生缺口补丁"的形式把复杂度账单寄回来**。本项目 3,283 行 Rust 里大头是"补框架"而非"写业务"，就是这张账单的明细。

- **适合**：前端为主 + 中等原生需求的桌面工具；团队有（或愿意养）少量 Rust 能力；看重体积/内存/安全模型。
- **慎重**：重度渲染一致性需求（精密排版、代码对齐）；重度打印/PDF；强依赖真实环境 E2E；完全没有 Rust 能力的团队。
- 按"Web 前端 + Rust 原生开发"双栈项目预算人力，而不是按"纯前端项目加个壳"预算。

## 1. 评估背景：这个项目是什么

**VividMark** 是一个对标 Typora 的 Markdown 编辑器（Tauri 2 + React 19 + TypeScript）：WYSIWYG/源码/分屏/预览四种模式、多窗口 SDI、原生菜单、Dock 菜单、文件关联、PDF 导出、静态站点导出、三平台（macOS/Windows/Linux，含国产玲珑打包）分发。属于桌面应用里"交互密度中上"的一类——不是套壳 Demo，也不是 IDE 级复杂度。

量化指标（截至 2026-09-07）：

| 指标 | 值 | 出处 |
| --- | --- | --- |
| 开发周期 | 2026-02-25 起，约 6.5 个月，170 commits | `git log` |
| 前端代码 | 31,716 行 TS/TSX | `find src -name '*.ts*' \| xargs wc -l` |
| Rust 代码 | 3,283 行（约 1:10） | `wc -l src-tauri/src/*.rs` |
| 测试 | 1,151 个单测（73 文件）+ 66 个 E2E（11 spec） | `pnpm test:run` 实跑 |
| 安装包体积 | **.dmg 5.7 MB**（v0.2.2 本地构建） | `src-tauri/target/release/bundle/dmg/` |
| 应用体积 | **.app 18 MB** | `src-tauri/target/release/bundle/macos/` |

Rust 代码的分布很说明性质：`menu.rs` 701 行（原生菜单）、`pdf.rs` 580 行（PDF 直存）、`window_router.rs` 269 行（多窗口路由）、`dock_menu.rs` 246 行（macOS Dock 菜单）——大头全是框架没管好、应用自己补的原生能力。此外 `Cargo.toml` 需要三个平台各自的专属 crate：macOS 用 `objc2` 全家桶（AppKit/WebKit/PDFKit）、Windows 用 `webview2-com`、Linux 用 `gtk/gdk`。

## 2. Tauri 是什么（30 秒版）

与 Electron 打包整个 Chromium + Node 不同，Tauri 复用**操作系统自带的 WebView**（macOS = WKWebView，Windows = WebView2/Chromium，Linux = WebKitGTK），后端逻辑写在 **Rust** 核心进程里，前后端经 IPC 桥通信。所有优势与代价都从这个架构选择派生。

## 3. 实测成立的优势

### 3.1 体积与资源：宣传属实

实测 .dmg 安装包 5.7 MB、.app 18 MB（含本地 PlantUML 引擎与全部前端资产）。Electron 同等功能应用的典型参考值是安装包 60–80 MB、安装后 150 MB+（[社区对比，2026](https://www.cmsj.in/post/tauri-3-0-preview-xia-yi-dai-zhuo-mian-kuang-jia/)）。对分发体积敏感的场景（企业内部下发、网速差的用户群），这是决定性优势。

### 3.2 Web 技术栈零损耗复用

CodeMirror 6、Milkdown/ProseMirror、KaTeX、Mermaid、PlantUML（TeaVM 编译的 WASM 引擎）、Vitest + Playwright 测试链——全部按浏览器原样工作，没有一行为"桌面化"而写的适配代码。前端框架完全自由（本项目 React 19，换 Vue/Svelte/Solid 没有区别），这一点显著强于 Qt 类方案。

### 3.3 Rust 后端是一等公民，不是胶水

- 文件变更监听：`notify` 按窗口监听父目录 + 300ms 防抖 + 窗口销毁释放（[file_watch.rs](../src-tauri/src/file_watch.rs)，123 行）
- PDF 直存：macOS 走 `NSPrintOperation(SaveJob)` + PDFKit 重建书签大纲，Windows 走 WebView2 `PrintToPdf`（[pdf.rs](../src-tauri/src/pdf.rs)，580 行）
- 静态站点导出：Rust 批量写盘镜像目录树

这类需求在 Electron 里要么依赖原生 node 模块（ABI 兼容地狱），要么性能吃亏。Tauri 的 Rust 侧拿到的是完整系统 API 访问权 + 零 GC 停顿。

### 3.4 安全模型设计理念优秀

capabilities 机制 = 命令白名单 + 窗口作用域（`windows: ["*"]`）+ 插件权限集，默认拒绝。对"要读本地文件、要开外链"的文档类应用，这比 Electron 默认全开的 Node 集成安全一个量级。（代价见 5.2——同一个机制也是升级事故的源头。）

### 3.5 官方插件与构建分发链路成熟

dialog / fs / shell / clipboard-manager / log 五个官方插件覆盖了本项目约八成的系统交互；`tauri build` 一条命令出三平台安装包，GitHub Actions matrix + tag 触发 Release 的工作流（[release.yml](../.github/workflows/release.yml)）开箱即用程度高。

### 3.6 维护活跃度可信

2.0 稳定版（2024-10）之后保持高频 patch：截至评估时最新为 [2.11.5（2026-07-01）](https://github.com/tauri-apps/tauri/releases)。issue 响应与安全修复节奏正常。

## 4. 成本与坑（全部来自实战，核心章节）

### 4.1 三个 WebView 的碎片化是最大的隐性成本

Tauri 复用系统 WebView 换来体积，代价是要同时面对三套引擎的怪癖——**这比 Electron 的单 Chromium 一致性更伤**：

| 现象 | 影响 | 出处 |
| --- | --- | --- |
| WKWebView 不支持 SVG `dominant-baseline="central"` | Mermaid 时序图文字偏高约 0.35em，只能后处理改写 SVG 坐标 | `src/lib/mermaid.ts`；implementation-notes「Mermaid」 |
| WKWebView 中文 IME 组合输入 | ProseMirror 幻影节点、回车吞键，需要专门插件链兜底 | implementation-notes「中文 IME 组合输入系列问题」 |
| WKWebView 多窗口 localStorage 各自独立 | 跨窗口偏好同步不能用标准 storage 事件，被迫走 Tauri 事件广播 | `src/lib/` prefs-sync 通道；AGENTS.md「多窗口」 |
| WebKitGTK 未绑定 `print_to_pdf` | Linux PDF 导出只能回退系统打印对话框，三平台三条代码路径 | `src-tauri/src/pdf.rs` |
| WebKitGTK 2.46 对字体别名返回零度量字体 | 玲珑包内全部文字向上顶偏，需在每个字体栈补 Linux 实体字体名兜底 | commit `2397d93` |
| WebView 不保证全角:半角 = 2:1 | 代码块中英文 ASCII 图对齐**无解**，只能建议用户改用图表 | AGENTS.md「Known Issues」 |

更结构性的是**测试缺口**：Playwright 只能驱动 Chromium，本项目 66 个 E2E 全部跑在 Vite dev server（Chromium）上，上面这些真实 WebView 行为一个都覆盖不到，只能靠真机冒烟（`e2e/plantuml.spec.ts`、`e2e/mermaid.spec.ts` 就是这个定位）。Electron 的 Playwright 能直接驱动打包后的真实运行环境，Tauri 至今没有等价物。

### 4.2 权限系统在 minor 版本变动，造成已有功能静默失效

- clipboard-manager 2.3.2 起 `default` 权限集被清空 → 升级一个小版本，桌面端复制/粘贴被 ACL **静默拒绝**，无报错无提示
- tauri 2.10+ 窗口类权限（set-title / start-dragging / destroy）变为非默认 → 标题失效、窗口拖不动、**窗口无法关闭**

安全收紧方向正确，但缺少 deprecation 过渡与运行时诊断。"升级小版本 → 功能无声坏掉"是最伤框架信心的故障类型。出处：`src-tauri/capabilities/`、AGENTS.md「Window title」「编辑器右键菜单」。

### 4.3 框架级陷阱：命令线程模型（0.9.1 hotfix 完整案例）

本项目最严重的一次事故（commit `af9ddb9`，2026-09-07）：Windows 上按 Ctrl+N 新建窗口后**整个应用假死**。

- 现象链：`build()` 创建 WebView2 控制器时挂起，OS 窗口已创建但不绘制、透明却吃点击——一个僵尸顶层窗口盖在所有窗口上；Win32 层 `Responding=True`、CPU 0%，极具迷惑性
- 真因：两个建窗命令是**同步命令**——Tauri 同步命令在主线程执行，而事件循环运转后在主线程 `build()` 会自死锁（WebView2 完成回调要由事件循环派发，事件循环被 `build()` 自身阻塞；wry#583 家族问题）
- 修复：命令改 `#[tauri::command(async)]`，worker 线程建窗；macOS/Linux 因线程亲和性要求保持主线程建窗，还要 setup 记录主线程 id 做分流
- 排查过程走通了两条弯路（改 decorations 时序、强制主线程建窗）才定位

官方文档确实写了"建窗命令必须 async"，但**编译期不拦、运行期不报错、只在特定平台以"假死"形态爆发**——这类陷阱的成本远高于 API 直接报错。

### 4.4 周边原生库（muda / tao / wry）成熟度不足，补丁下沉到应用侧

原生菜单库 muda 本项目踩了个遍：

- GTK 后端静默丢弃 `Minimize`/`Maximize`/`Quit` 等预定义项（白名单只放行 Separator/剪贴板/About）→ Linux 下全部改自定义项
- muda 给每个菜单项打包 16px 空 GtkImage 占位，把文字右推 22px → 应用自写 `strip_menubar_icon_placeholders()` 摘除，且在 setup / rebuild / 建新窗口三处都要调用
- CheckMenuItem 点击由原生自动翻转勾选，与 JS 状态分叉；**菜单重建后 check/enabled 回到构建默认值，必须重同步一轮**
- 启动时 `isFocused()` 可能为 false 导致初始菜单重建被跳过 → 菜单标签停在构建默认语言，聚焦回调必须补 rebuild

窗口层 tao：macOS 红绿灯位置会被 `setTitle` 重置 → 被迫封装专用命令 `set_window_title`（[titlebar.rs](../src-tauri/src/titlebar.rs)）设题后重排红绿灯；Dock 菜单直接 `class_addMethod` 挂钩 tao 的 AppDelegate（[dock_menu.rs](../src-tauri/src/dock_menu.rs)），**tao 一升级就要回归验证**。JS API 侧也有毛边：`ResizeDirection` 类型在 api 2.10 未导出，需本地复刻。

### 4.5 平台差异渗入功能设计的每个层面

- **快捷键两条链路**：macOS/Linux 带 accelerator 的组合键被 OS 拦截（webview 收不到 keydown），必须走"原生菜单事件 → `emit_to_focused` → 前端分发"；Windows（无原生菜单）与浏览器 dev 由 `useKeyboardShortcuts.ts` 全量接管——两套实现，键位表手工对齐
- **无边框窗口三种去装饰时序**：Linux 建窗时 `decorations(false)`；Windows 必须建窗成功后 `set_decorations(false)`；macOS 走 Overlay + hiddenTitle 另一套
- **Windows 无原生菜单**：整个菜单栏前端重画（`src/components/Menu/MenuBar.tsx` + 纯函数构建器 `src/lib/menuBar.ts`），Cut/Copy/Paste/About 等预定义项全部自实现平替
- **PDF 三平台三条路径**：见 4.1

### 4.6 开发体验与工具链

- **Windows 下 `tauri:dev` 必崩**（commit `d49f9ad`）：cargo 构建持续写入 `src-tauri/target` 的 exe/dll，vite 的 chokidar watcher 盯上被占用文件即 EBUSY 退出，`beforeDevCommand` 非零终止导致 dev 启动即挂。修法是官方模板同款 `server.watch.ignored`——但**官方模板有而脚手架文档不强调**，Windows 新用户必踩
- 文件关联（Open With）只在打包安装后生效，开发期测不了
- Windows/Linux 的 argv 打开、单实例机制至今要自己做（本项目未接）
- E2E 测不到真 WebView：见 4.1

### 4.7 分发最后一公里

- 未签名应用：macOS Gatekeeper 要用户手动 `xattr -rd com.apple.quarantine`，Windows SmartScreen 拦截——**签名证书年费是独立开发者的真实固定成本**
- Linux 碎片化：为覆盖 UOS 20 等老系统专门维护了玲珑（Linglong）打包方案（[linglong/](../linglong/README.md)），一周之内踩了：pnpm 12 移除 `--fetch-retries` 导致裸装 latest 构建漂移（`3f44fe9`）、需显式安装 patchelf（`20a360d`）、桌面快捷方式 `%F` 占位符无法启动（`bf40031`）、`linglong.yaml` base 版本号格式与 ll-builder 1.13+ 不兼容（`e4df4f7`）、WebKitGTK 字体零度量（`2397d93`）。**这不全是 Tauri 的锅，但"Tauri on Linux"的实际交付面就是这些的组合**

## 5. 切片验证：近一周（2026-09-02 ~ 09-07）的 21 个提交

| 分类 | 数量 | 提交 |
| --- | --- | --- |
| 平台适配 / 框架陷阱修复 | 4 | `af9ddb9`（Windows 建窗死锁）、`d49f9ad`（Windows dev 必崩）、`436d1f5`（Windows 无边框+自绘菜单栏）、`8f5541c`（Linux 无边框+菜单修复） |
| 打包 / 分发（玲珑为主） | 9 | `2e25525` `3c49b3e` `e4df4f7` `6621fd9` `2397d93` `1c6e1e0` `bf40031` `20a360d` `3f44fe9` |
| 发版 / 版本号 | 5 | `3b0f5a8` `4e96cef` `aa39c96` `11be5d9` `318d866` |
| 文档 / 杂项 | 3 | `28cfdf8` `4c0be1e` `6e674a3` |
| **纯产品功能（与桌面平台无关的用户价值）** | **0** | — |

**诚实声明**：这一周是 Windows/Linux 无边框里程碑落地 + 首次三平台发版的集中期，属于平台成本的"显性化一周"，不代表平均周（此前数周的主体是 WYSIWYG、语法扩展等纯前端功能，Tauri 存在感很低）。但它精确展示了 Tauri 项目会**周期性**进入的成本形态：每扩一个平台、每发一次版、每升级一次框架，就要支付一笔与产品价值无关的适配税。

## 6. 与 Electron 的对比（2026 视角）

| 维度 | Tauri 2.x | Electron | 备注 |
| --- | --- | --- | --- |
| 安装包体积 | **实测 5.7 MB** | 典型 60–80 MB | Tauri 决定性优势 |
| 内存占用 | 30–80 MB（参考值） | 150–300 MB（参考值） | 多窗口下 Tauri 每窗独立 WebView 进程，优势收窄 |
| 渲染一致性 | **三引擎碎片化**（本项目最大痛点） | 完全一致（单一 Chromium） | Electron 决定性优势 |
| E2E 可测性 | 只能测 Chromium，真 WebView 行为不可测 | Playwright 直接驱动真实环境 | Electron 优势 |
| 后端能力 | **Rust：系统 API 一等访问、零 GC** | Node.js：生态大但原生模块 ABI 痛苦 | 各有胜负，重系统交互 Tauri 胜 |
| 安全模型 | **capabilities 默认拒绝** | Node 集成默认偏开放，靠自觉 | Tauri 优势 |
| 后端语言门槛 | **要求 Rust（含平台原生 API）** | 纯 JS 到底 | Electron 优势 |
| 生态规模 | npm 周下载 ~15 万级 | 仍居第一（VS Code/Slack/Discord 验证过上限） | [第三方盘点，2026](https://dyrnq.com/a-panoramic-view-of-popular-international-front-end-frameworks-2025-2026/) |
| 移动端 | iOS/Android 可用但年轻（[官方文档](https://v2.tauri.app/develop/)） | 无 | Tauri 潜在优势 |
| 升级回归风险 | minor 版本两次静默破坏本项目功能 | 大版本跳跃也大，但 API 面更稳定可预期 | 本项目体感 Tauri 更频繁 |

其他方案一句话：渲染一致性 + 复杂排版刚需看 Flutter Desktop / Qt；Mac-only 且追求极致体验直接原生 SwiftUI；Kotlin 团队看 Compose Multiplatform；极简内部工具可以考虑更轻的壳（Neutralino 等），但生态更薄。

## 7. 生态现状与治理风险（截至 2026-09）

- **版本线**：稳定线 2.11.x；Tauri 3.0 有社区预览讨论但无官方正式版，选型按 2.x 评估
- **移动端**：`tauri ios dev` / `tauri android dev` 已可用，相对桌面仍年轻，坑密度可参考桌面 1.x 时期
- **上游治理**：tao / wry / muda / WebKitGTK 的演进节奏不完全受 Tauri 团队控制。本项目的直接证据：clipboard 权限清空（插件 2.3.2）、窗口权限非默认化（core 2.10）、wry#583 家族死锁、WebKitGTK 2.46 字体度量变化——**"升级 Tauri = 安排一轮三平台回归测试"必须计入排期**
- **社区**：官方插件质量可靠；社区插件参差，关键路径建议自研或选型时验证维护状态

## 8. 选型自测清单

回答以下问题，"是"越多越适合 Tauri：

1. 团队里是否有人能写（或愿意学）Rust？——本项目的 Dock 菜单、PDF、窗口路由没有一样绕得开
2. 产品是否以内容展示/编辑为主，而非像素级渲染一致性强需？
3. 是否看重安装包体积 / 内存 / 安全审计面？
4. 能否接受 E2E 只覆盖 Chromium，真 WebView 行为靠真机抽查？
5. 是否有预算做周期性的"平台适配周"（扩平台、发版、升级框架时）？
6. 目标平台是否以 macOS/Windows 为主？（Linux 桌面是碎片化重灾区，做好为发行版/老系统单独维护打包方案的准备）

反向信号（任一成立就该认真考虑 Electron 或原生）：代码编辑器级对齐刚需；重度打印/PDF 流水线；团队零 Rust 且不打算补；质量体系要求 E2E 覆盖真实运行环境。

## 9. 结论

Tauri 是一个**方向正确、迭代活跃、兑现了核心承诺、但成熟度仍欠火候**的框架。它把应用的"壳"做轻了，却没有消灭桌面开发的复杂度，而是把它从"捆绑 Chromium"转移到了"适配三个系统 WebView + 自补原生缺口"上。对 VividMark 这笔交换是划算的——前端资产完整复用、5.7 MB 安装包、Rust 侧能力扎实——但代价是 3,283 行 Rust、三平台专属 crate、和 `AGENTS.md` 里一整页平台 gotchas。

给读者的最终建议：**把 Tauri 当"Web 前端 + Rust 原生开发"的双栈技术选型来评估，而不是"纯前端项目加个壳"来预期**。按前者预算，它会给你惊喜；按后者预期，你会在第一次三平台发版时收到账单。

---

*本文数据出处：仓库内 `src-tauri/`、`src/lib/`、`docs/implementation-notes.md`、`AGENTS.md`、`linglong/README.md`，及 commit `af9ddb9` `d49f9ad` `2397d93` `3f44fe9` `20a360d` `bf40031` `e4df4f7` 等。外部引用均已内联标注链接。*
