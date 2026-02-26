# VividMark

一款基于 Tauri 2.0 和 React 构建的现代化轻量级 Markdown 编辑器。灵感来源于 Typora，提供简洁、无干扰的写作体验和实时预览功能。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue.svg)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev)
[![AI-Built](https://img.shields.io/badge/100%25%20AI-Built-purple.svg)]()

**[English](README.md) | 简体中文**

## 🌐 官网

访问项目网站: **[https://scottli139.github.io/vividmark](https://scottli139.github.io/vividmark)**

## 功能特性

### 核心编辑器
- **三种视图模式** - 源码模式（编辑）、预览模式（只读）、分屏模式（同步滚动）
- **实时 Markdown 预览** - 即时查看格式化后的内容
- **代码语法高亮** - 基于 highlight.js
- **流畅的过渡动画** - 优化的编辑体验

### 文件操作
- **打开/保存/另存为** - 完整的文件管理，支持原生对话框
- **键盘快捷键** - Cmd/Ctrl + O、S、N 快速访问
- **拖拽打开** - 直接拖拽 Markdown 文件即可打开
- **自动保存** - 无操作 2 秒后自动保存
- **最近文件** - 快速访问最近打开的文件
- **撤销/重做** - 完整的历史记录支持，Cmd/Ctrl + Z / Shift+Z

### 格式化工具
- **行内格式** - 粗体、斜体、删除线、行内代码、链接
- **块级格式** - 标题（H1-H6）、引用、列表、代码块
- **图片插入** - 插入本地图片，自动资产管理
- **表格编辑** - 可视化表格创建，可自定义行列数

### 扩展 Markdown 支持 (MkDocs 风格)
- **表格** - 完整的 GFM 表格支持，包括对齐
  ```markdown
  | 姓名  | 年龄 | 城市  |
  |:------|:---:|------:|
  | Alice | 25  | NYC   |
  | Bob   | 30  | LA    |
  ```

- **提示框** - 精美的提示框，用于提示、警告、说明等
  ```markdown
  ::: tip
  这是一个有用的提示！
  :::

  ::: warning 重要
  这是带有自定义标题的警告。
  :::
  ```
  支持类型: `tip`, `warning`, `info`, `note`, `danger`, `success`, `hint`, `important`, `caution`

- **PlantUML 图表** - 直接在文档中渲染 UML 图表
  ```markdown
  @startuml
  Alice -> Bob: 你好
  Bob --> Alice: 嗨！
  @enduml
  ```

### 用户界面
- **多语言支持** - 英文和简体中文，易于扩展到更多语言
- **深色模式** - 亮色和暗色主题切换
- **侧边栏大纲导航** - 文档大纲，点击标题快速跳转（适用于所有视图模式）
- **简洁的界面** - 极简设计，专注写作
- **同步滚动** - 分屏模式下双向同步滚动

## 技术栈

- **前端**: React 19 + TypeScript + Tailwind CSS 4
- **后端**: Tauri 2.0 (Rust)
- **构建工具**: Vite 7
- **状态管理**: Zustand 5
- **国际化**: i18next + react-i18next
- **Markdown**: markdown-it 及自定义插件
- **扩展语法**: markdown-it-container, plantuml-encoder
- **语法高亮**: highlight.js
- **测试**: Vitest + React Testing Library + Playwright

## AI 开发

本项目**完全由 AI 编程助手构建**：

| 工具 | 模型 |
|------|------|
| [Claude Code CLI](https://github.com/anthropics/claude-code) | GLM model |
| [Kimi CLI](https://www.kimi.com/) | Kimi model |

> 🤖 没有人工编写的代码。每一行代码都是通过 AI 协作生成、审查和优化的。

## 快速开始

### 环境要求

- Node.js 18+
- pnpm（推荐）或 npm
- Rust（用于 Tauri）

### 安装

```bash
# 克隆仓库
git clone https://github.com/scottli139/vividmark.git
cd vividmark

# 安装依赖
pnpm install

# 启动开发服务器
pnpm tauri dev
```

### 构建

```bash
# 构建生产版本
pnpm tauri build
```

## 键盘快捷键

| 快捷键 | 功能 |
|----------|--------|
| `Cmd/Ctrl + O` | 打开文件 |
| `Cmd/Ctrl + S` | 保存文件 |
| `Cmd/Ctrl + Shift + S` | 另存为 |
| `Cmd/Ctrl + N` | 新建文件 |
| `Escape` | 退出编辑模式 |

## 项目结构

```
vividmark/
├── src/                    # React 前端
│   ├── components/
│   │   ├── Editor/         # 核心编辑器组件
│   │   ├── Sidebar/        # 带大纲的侧边栏
│   │   └── Toolbar/        # 工具栏
│   ├── hooks/              # 自定义 React hooks
│   ├── stores/             # Zustand 状态管理
│   ├── lib/
│   │   ├── markdown/       # Markdown 解析
│   │   └── fileOps.ts      # 文件操作
│   └── styles/             # 全局样式
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── lib.rs          # 主要逻辑 + 命令
│   │   └── main.rs         # 入口点
│   ├── Cargo.toml
│   └── tauri.conf.json
└── package.json
```

## 开发状态

查看 [PLAN.md](./PLAN.md) 了解详细的开发进度。

### 已完成
- [x] 第一阶段: 基础框架
- [x] 第二阶段: 核心编辑器
- [x] 第三阶段: 文件操作
- [x] 第四阶段: 编辑增强（视图模式、图片插入、撤销/重做、MkDocs 扩展、表格编辑、多语言支持、大纲导航）
- [x] 第八阶段: 代码规范（ESLint、Prettier、TypeScript 严格模式）
- [x] 第九阶段: 测试基础设施（Vitest、Playwright、CI/CD）
- [x] 第十阶段: 品牌设计（Logo、图标）
- [x] 第十一阶段: 日志系统

### 进行中 / 计划中
- [ ] 第五阶段: 文件管理（文件树、多标签页）
- [ ] 第六阶段: 高级功能（PDF 导出、搜索替换）
- [ ] 第七阶段: 完善与优化（性能、偏好设置）

## 贡献

欢迎贡献！请随时提交 Pull Request。

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 致谢

- 灵感来源于 [Typora](https://typora.io/)
- 使用 [Tauri](https://tauri.app/) 构建
- UI 组件使用 [Tailwind CSS](https://tailwindcss.com/) 设计
