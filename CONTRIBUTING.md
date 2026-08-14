# Contributing to VividMark

**English | [简体中文](CONTRIBUTING.zh-CN.md)**

Thanks for your interest in contributing! VividMark is an open-source, Typora-like Markdown editor built with Tauri 2 + React 19 + TypeScript. All kinds of contributions are welcome — bug reports, features, docs, tests, and translations.

> 🤖 **AI-assisted contributions are welcome.** This project is 100% AI-built. Feel free to use Claude Code, Kimi CLI, Cursor or any other assistant — `AGENTS.md` at the repo root is a ready-made context file written exactly for that purpose. The only bar is that CI passes.

## Getting Started

Prerequisites: Node.js 20+, pnpm, and a Rust toolchain (for the desktop app).

```bash
git clone https://github.com/scottli139/vividmark.git
cd vividmark
pnpm install

pnpm dev          # Vite dev server only (browser, no Tauri)
pnpm tauri:dev    # Full desktop app (frontend + Rust)
```

## Before You Commit

Run all four — CI enforces them:

```bash
pnpm tsc -b       # Type check. Must be `tsc -b` (solution-style tsconfig);
                  # `tsc --noEmit` checks nothing here
pnpm lint         # ESLint
pnpm format       # Prettier (or `pnpm format:check`)
pnpm test:run     # Unit tests (Vitest)
pnpm test:e2e     # Playwright E2E, optional but recommended for UI changes
```

Tips:

- Unused variables fail CI — prefix with `_` (e.g. `_match`)
- Tauri calls in unit tests need mocks from `src/test/mocks/tauri.ts`

## Commit Convention

Conventional prefix + concise summary (Chinese or English both fine, matching the existing log):

```
feat: WYSIWYG 查找替换接入
fix: 修复大纲混入代码块注释
docs: update README screenshots
test / chore / style / refactor: ...
```

Version bumps and releases are maintainer-only (`chore: bump version` + `v*` tag).

## Pull Requests

1. Fork, branch from `main`, keep the diff focused — one change per PR
2. Fill in the PR template; link the related issue if any
3. Make sure CI is green (lint + typecheck + unit tests with coverage)
4. Small PRs get reviewed fast; large refactors should be discussed in an issue first

## House Rules Worth Knowing

- **Single source of truth is Markdown source.** WYSIWYG (Milkdown/ProseMirror) and Source (CodeMirror 6) must round-trip losslessly — there are tests locking this in
- **Bilingual by convention**: `README.md` ↔ `README.zh-CN.md` and `docs/index.html` ↔ `docs/index.zh-CN.html` must be updated together. UI strings go into `src/i18n/locales/en.json` **and** `zh-CN.json`
- **New syntax / rendering capability** → also add an example file under `examples/` (kebab-case, see `math-formulas.md`)
- Deep architecture notes, known pitfalls and the full Tauri command/shortcut tables live in `docs/implementation-notes.md` — read the relevant section before touching editor code

## Where to Start

- Issues labeled [`good first issue`](https://github.com/scottli139/vividmark/labels/good%20first%20issue) — scoped, documented, newcomer-friendly
- Issues labeled [`help wanted`](https://github.com/scottli139/vividmark/labels/help%20wanted) — bigger pieces the maintainer would love help with
- `PLAN.md` shows the roadmap if you want to propose something new

Questions? Open an issue with the `question` label.
