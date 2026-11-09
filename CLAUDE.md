# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

VividMark is a Markdown editor built with Tauri (Rust backend) + React + TypeScript frontend.

## Code Style

- Use pnpm as package manager
- Run `pnpm format` before committing
- Run `pnpm lint` to check for issues

## Git Commit Convention

- Use conventional commit format: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- Write commit messages in English
- AI-assisted commits: append a `Model: <模型名>` trailer at the end of the commit message (e.g. `Model: Kimi K3 max`), using the model actually used for that commit; purely human commits add no trailer (consistent with `AGENTS.md` Working Agreements)
