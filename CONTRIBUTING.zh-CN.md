# 参与贡献 VividMark

**[English](CONTRIBUTING.md) | 简体中文**

感谢你有兴趣参与贡献！VividMark 是一个开源的类 Typora Markdown 编辑器，基于 Tauri 2 + React 19 + TypeScript。欢迎各种形式的贡献——bug 报告、新功能、文档、测试、翻译。

> 🤖 **欢迎使用 AI 辅助贡献。** 本项目 100% 由 AI 构建。你可以自由使用 Claude Code、Kimi CLI、Cursor 等工具——仓库根目录的 `AGENTS.md` 就是为 AI 助手准备好的上下文文件。唯一的标准是 CI 通过。

## 环境搭建

前置条件：Node.js 20+、pnpm、Rust 工具链（桌面端需要）。

```bash
git clone https://github.com/scottli139/vividmark.git
cd vividmark
pnpm install

pnpm dev          # 仅 Vite 开发服务器（浏览器，无 Tauri）
pnpm tauri:dev    # 完整桌面应用（前端 + Rust）
```

## 提交前检查

四条都要跑——CI 会强制执行：

```bash
pnpm tsc -b       # 类型检查。必须用 `tsc -b`（solution 式 tsconfig），
                  # `tsc --noEmit` 在本项目检查不到任何文件
pnpm lint         # ESLint
pnpm format       # Prettier（或 `pnpm format:check`）
pnpm test:run     # 单元测试（Vitest）
pnpm test:e2e     # Playwright E2E，UI 改动建议跑
```

提示：

- 未使用的变量会导致 CI 失败——加 `_` 前缀（如 `_match`）
- 单测中涉及 Tauri 调用时使用 `src/test/mocks/tauri.ts` 的 mock

## Commit 规范

约定式前缀 + 简要描述（中英文均可，与现有提交记录保持一致）：

```
feat: WYSIWYG 查找替换接入
fix: 修复大纲混入代码块注释
docs: update README screenshots
test / chore / style / refactor: ...
```

版本号提升与发布仅由维护者操作（`chore: bump version` + `v*` tag）。

## Pull Request 流程

1. Fork 后从 `main` 切分支，保持 diff 聚焦——一个 PR 只做一件事
2. 填写 PR 模板；有关联 issue 记得链接
3. 确保 CI 全绿（lint + 类型检查 + 单元测试与覆盖率）
4. 小 PR 评审快；大型重构请先在 issue 中讨论

## 值得了解的约定

- **Markdown 源码是唯一事实来源。** WYSIWYG（Milkdown/ProseMirror）与源码（CodeMirror 6）之间必须往返无损——有测试锁定这一点
- **双语同步约定**：`README.md` ↔ `README.zh-CN.md`、`docs/index.html` ↔ `docs/index.zh-CN.html` 必须成对更新；UI 文案要同时进 `src/i18n/locales/en.json` 和 `zh-CN.json`
- **新语法 / 新渲染能力** → 同步在 `examples/` 下添加示例文件（kebab-case，参考 `math-formulas.md`）
- 架构细节、已知踩坑、Tauri 命令与快捷键一览表都在 `docs/implementation-notes.md`——动编辑器代码前先读相关章节

## 从哪里开始

- [`good first issue`](https://github.com/scottli139/vividmark/labels/good%20first%20issue) 标签下的 issue——边界清晰、带实现提示、对新人友好
- [`help wanted`](https://github.com/scottli139/vividmark/labels/help%20wanted) 标签——维护者希望有人帮忙的较大事项
- 想看路线图或提议新方向：`PLAN.md`

有疑问？开一个带 `question` 标签的 issue。
