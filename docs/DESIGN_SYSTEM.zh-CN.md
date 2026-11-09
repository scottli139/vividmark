# VividMark 设计系统

**[English](DESIGN_SYSTEM.md) | 简体中文**

VividMark 使用一套零新增依赖的轻量设计系统：**Tailwind CSS 4 + CSS 设计 Token + React 通用组件**。目标是在保留 Typora 式克制、桌面高密度界面的同时，让颜色、尺寸和组件行为有唯一来源，避免每处 UI 重新发明样式。

## 原则

1. **Token 优先**：新 UI 不直接写十六进制颜色、Tailwind 灰色色板或静态内联字号。
2. **组件优先**：常规按钮、文本输入和模态框先使用 `src/components/ui/`，不要复制第三套按钮或弹层样式。
3. **语义化**：业务组件使用背景、表面、边框、主次文字等语义色，不根据亮暗主题分别写颜色。
4. **渐进迁移**：旧 CSS 变量继续可用；修改旧组件时优先迁移到语义类与通用组件，不要求一次性重写全部 UI。
5. **领域样式隔离**：Markdown 渲染、代码高亮、Admonition 等领域配色仍归 `globals.css` 管理，不强行套入应用控件组件。

## 文件职责

| 位置 | 职责 |
| --- | --- |
| `src/styles/tokens.css` | 唯一的设计 Token 来源：Tailwind 主题映射、颜色、字体、间距、圆角、控件高度、动画和阴影 |
| `src/styles/globals.css` | 全局基础样式与 Markdown、代码高亮等领域样式；导入 `tokens.css` |
| `src/components/ui/` | 无业务语义的通用组件 |
| `src/components/Menu/` | 下拉、右键和菜单栏专用菜单原语 |
| `src/components/__tests__/designGuard.test.ts` | 静态拦截组件中的硬编码视觉样式 |

## 设计 Token

### 颜色

组件优先使用 Tailwind 语义类；需要与旧代码共存时，可以继续使用对应 CSS 变量。

| 语义 | Tailwind 示例 | CSS 变量 |
| --- | --- | --- |
| 页面 / 编辑器背景 | `bg-background` | `--editor-bg` |
| 侧栏 / 一级表面 | `bg-surface` | `--sidebar-bg` |
| 工具栏背景 | `bg-toolbar` | `--toolbar-bg` |
| 边框 / 分隔线 | `border-border` | `--editor-border` |
| 主要文字 | `text-foreground` | `--text-primary` |
| 次级文字 | `text-secondary` | `--color-text-secondary` |
| 占位 / 禁用文字 | `text-muted` | `--color-text-muted` |
| 强调 / 聚焦 | `bg-accent`、`text-accent` | `--accent-color` |
| 强调色悬停 | `hover:bg-accent-hover` | `--accent-hover` |
| 强调色上的文字 | `text-on-accent` | `--on-accent` |
| 中性悬停 / 激活 | `bg-hover`、`bg-active` | `--hover-bg`、`--active-bg` |
| 危险操作 | `bg-danger`、`text-danger` | `--danger-color` |
| 模态框遮罩 | `bg-overlay` | `--overlay-color` |

亮暗主题只改变 `:root` / `.dark` 中的 Token 值，业务组件不新增 `.dark` 颜色分支。

### 字体与排版

- `--font-ui`：应用 UI 字体栈；同时映射为 Tailwind `font-sans`。
- `--font-code`：代码与等宽文本；同时映射为 `font-mono`。
- 字号 Token 为 10 / 12 / 13 / 14 / 16 / 18 / 20px，对应 `--font-size-*`。
- 常规正文和按钮使用 Tailwind `text-sm`（14px），密集列表与辅助信息使用 `text-xs`（12px）或既有的 13px 密度规格。
- 编辑器动态缩放仍由编辑器逻辑计算字号，不属于静态内联字号违规。

### 间距、圆角与尺寸

- 间距遵循 4px 网格，Token 为 `--space-1` 至 `--space-8`；布局中优先使用 Tailwind 的 `p-2`、`gap-3`、`mt-6` 等等价刻度。
- 圆角为 2 / 4 / 6 / 8 / 10px：`rounded-xs` / `rounded-sm` / `rounded-md` / `rounded-lg` / `rounded-xl`。
- 控件高度：紧凑 28px、标准 32px、宽松 36px，对应 `--control-height-sm` / `md` / `lg`。
- 动画统一使用 `--duration-fast`（150ms）和 `--duration-normal`（200ms）。
- 模态框与浮层使用 `shadow-overlay`，不要在业务组件中重新组合阴影色值。

## 通用组件

从 `src/components/ui` 统一导入。

### Button

```tsx
<Button onClick={handleSave}>Save</Button>
<Button variant="secondary" onClick={onClose}>Cancel</Button>
<Button variant="ghost" size="sm">More</Button>
<Button variant="danger">Delete</Button>
<Button variant="secondary" size="icon" aria-label="Add">+</Button>
```

- 变体：`primary`（默认）、`secondary`、`ghost`、`danger`。
- 尺寸：`md`（默认 32px）、`sm`（28px）、`icon`（32×32px）。
- 默认 `type="button"`，避免在表单中意外提交；支持 `ref`、禁用态和原生 button 属性。
- 菜单项、窗口控制、分段选择器等拥有特殊交互角色的控件可以继续使用专用组件。

### TextField

```tsx
<TextField value={title} onChange={(event) => setTitle(event.target.value)} />
<TextField inputSize="sm" placeholder="Filter files" />
<TextField invalid aria-label="Required field" />
```

`TextField` 统一背景、边框、聚焦环、占位文字和禁用态。`inputSize` 避免与原生 input 的 `size` 属性冲突。

### Modal

```tsx
<Modal onClose={onClose} className="w-96" aria-label={t('settings.title')}>
  <ModalContent />
</Modal>
```

`Modal` 统一遮罩、面板、阴影、Esc 关闭和点遮罩关闭。调用方负责标题、内容与底部操作；组件仅在打开时挂载。确认框的 Enter、插入对话框的 Mod+Enter 等业务快捷键仍由调用方处理。

## 新增 UI 的流程

1. 先查 `src/components/ui/` 与 `src/components/Menu/` 是否已有合适组件。
2. 颜色与尺寸先查 `tokens.css`；确需新规格时，在 Token 层增加语义值，不在业务组件中写字面颜色。
3. 复用通用组件，并用 `className` 添加布局类；不要复制组件内部视觉样式。
4. 为新增组件补行为测试。视觉相关改动至少运行相关组件测试和 `designGuard.test.ts`。
5. 若新增 Token、组件或修改上述约定，同步更新本文档与 `AGENTS.md` 的精简说明。

## 当前迁移范围

已接入：确认 / 提示框、设置、关于、插入表格、插入 Admonition、打开文件夹按钮、文件树搜索与行内命名、最近文件搜索、Windows 关闭按钮危险色。

设计守卫当前检查：十六进制颜色、Tailwind 灰色 / Slate 等硬编码中性色板、静态内联 `fontSize` 和字符串内联 `fontFamily`。它是有意的轻量静态检查，不替代代码评审和真实界面验收。
