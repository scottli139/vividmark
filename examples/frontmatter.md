---
title: Frontmatter 示例
description: 演示 VividMark 的 YAML frontmatter 双端支持
date: 2026-08-14
draft: false
tags:
  - markdown
  - frontmatter
---

# YAML Frontmatter

本文档顶部有一段 **YAML frontmatter**（`---` 围栏包裹的元数据块），它在不同视图下的表现：

- **WYSIWYG**：显示为只读的 Frontmatter 卡片（编辑请切到源码模式）
- **源码**：原样显示，可自由编辑
- **预览 / 分屏**：剥离不渲染（不再错误地显示为分割线 + 文本）
- **导出 PDF / 导出为网站**：同样剥离；站点导出还会用 `title` 作为页面标题

## 语法要点

frontmatter 必须位于**文档最开头**，由一对 `---` 行围栏：

```yaml
---
title: 页面标题
draft: false
tags:
  - a
  - b
---
```

## 边界情况

### 文档中间的 `---` 不是 frontmatter

下面这条线只是一条普通的分割线（它不处于文档开头）：

---

### 无闭合围栏按正文处理

如果开头的 `---` 之后没有闭合的 `---`，整块按普通正文渲染。

### YAML 语法错误时保守保留

frontmatter 内容不是合法 YAML 时，VividMark 不会强行剥离，原文按普通 Markdown 渲染。

## 常见用途

- **静态站点**：mkdocs / vuepress / Hugo / Jekyll 的页面元数据（标题、日期、草稿标记）
- **笔记工具**：Obsidian 的属性面板数据
- **VividMark 站点导出**：`title` 字段优先作为页面标题与导航名
