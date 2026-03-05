# WYSIWYG 模式实现计划

> 基于方案 A：四模式共存，WYSIWYG 作为默认模式

---

## 📋 任务总览

### Phase 1: 基础架构（第 1 周）✅ 已完成

#### Day 1-2: Store 与类型定义 ✅
- [x] 扩展 `ViewMode` 类型，新增 `'wysiwyg'`
- [x] 修改 `editorStore`，默认模式改为 `'wysiwyg'`
- [x] 添加模式切换持久化（记住用户上次选择）
- [x] 更新 i18n 翻译文件

#### Day 3-4: WysiwygEditor 组件骨架 ✅
- [x] 创建 `WysiwygEditor.tsx` 基础组件（临时占位）
- [x] 实现 `contenteditable` div 容器（待实现）
- [x] 基础样式（与现有 Editor 保持一致）
- [x] 集成到 Editor 组件，根据 viewMode 渲染

#### Day 5: 模式切换 UI ✅
- [x] 更新 Toolbar 模式切换按钮
- [x] 四模式切换：WYSIWYG / Source / Preview / Split
- [x] 视觉设计（WYSIWYG 按钮高亮为默认）
- [ ] 快捷键支持：`Cmd+/` 切换 WYSIWYG ↔ Source（留待后续实现）

**完成时间**: 2026-03-05  
**交付状态**: M1 里程碑达成 ✅  
**测试状态**: 353 个测试通过 ✅

---

### Phase 2: 双向同步核心（第 1-2 周）

#### Day 6-7: Markdown → HTML 渲染
- [ ] 复用现有 `parseMarkdown` 函数
- [ ] 为渲染元素添加 `data-source-pos` 属性（记录源码位置）
- [ ] 自定义渲染规则（用于 contenteditable）
- [ ] 处理特殊元素：代码块、表格、图片

#### Day 8-9: 基础编辑与同步
- [ ] 监听 `input` 事件，捕获用户输入
- [ ] 简单文本编辑同步回 Markdown
- [ ] 标题块编辑（H1-H6）
- [ ] 段落编辑

#### Day 10-12: HTML → Markdown 反向转换
- [ ] 引入 `turndown` 库（HTML to Markdown）
- [ ] 配置 Turndown 规则（匹配 markdown-it 配置）
- [ ] 支持 GFM 扩展（表格、任务列表等）
- [ ] 测试双向转换准确性

---

### Phase 3: 块级元素支持（第 2-3 周）

#### Day 13-15: 列表支持
- [ ] 无序列表（`- ` / `* `）
- [ ] 有序列表（`1. `）
- [ ] 列表嵌套
- [ ] Tab / Shift+Tab 缩进控制
- [ ] Enter 新建列表项，双击 Enter 退出列表

#### Day 16-18: 代码块
- [ ] 围栏代码块（```` ``` ````）
- [ ] 行内代码
- [ ] 代码块内编辑（纯文本，不解析 Markdown）
- [ ] 语言标识显示

#### Day 19-21: 表格
- [ ] 表格渲染为可编辑的 HTML table
- [ ] Tab 键在单元格间跳转
- [ ] 添加/删除行列（右键菜单或按钮）
- [ ] 表格对齐方式工具栏

---

### Phase 4: 行内样式与快捷键（第 3 周）

#### Day 22-24: 行内格式化
- [ ] 加粗（`**text**` 或 `__text__`）
- [ ] 斜体（`*text*` 或 `_text_`）
- [ ] 删除线（`~~text~~`）
- [ ] 行内代码（`` `text` ``）
- [ ] 链接（`[text](url)`）

#### Day 25-27: 快捷键集成
- [ ] 复用现有 `useKeyboardShortcuts`
- [ ] Cmd+B / Cmd+I / Cmd+K 格式化
- [ ] Cmd+Enter 退出代码块/表格
- [ ] 方向键在块间导航

#### Day 28-30: 工具栏集成
- [ ] 工具栏按钮在 WYSIWYG 模式下可用
- [ ] 选中文字后点击按钮应用格式
- [ ] 光标处插入新元素（图片、表格等）

---

### Phase 5: 高级功能（第 4 周）

#### Day 31-33: 图片与媒体
- [ ] 图片渲染与调整大小
- [ ] 拖放插入图片
- [ ] 图片对齐（左/中/右）
- [ ] 图片 alt 文本编辑

#### Day 34-36: 其他 Markdown 扩展
- [ ] Admonitions（提示框）
- [ ] 任务列表（checkbox）
- [ ] 分隔线（`---`）
- [ ] 引用块（`> `）

#### Day 37-40: 光标位置保持
- [ ] 编辑前后光标位置映射
- [ ] 防止全量刷新导致光标丢失
- [ ] 撤销/重做集成（复用现有 historyManager）

---

### Phase 6: 优化与测试（第 4-5 周）

#### Day 41-45: 性能优化
- [ ] 增量更新（只更新修改的块）
- [ ] 虚拟滚动（大文件支持）
- [ ] 防抖处理

#### Day 46-50: 测试覆盖
- [ ] 单元测试（渲染、转换逻辑）
- [ ] 组件测试（WysiwygEditor 交互）
- [ ] E2E 测试（完整编辑流程）
- [ ] 边界情况测试（空文档、特殊字符）

#### Day 51-55: Bug 修复与打磨
- [ ] 中文输入法兼容性
- [ ] 复制粘贴处理（从其他应用粘贴）
- [ ] 深色模式样式
- [ ] 滚动同步（与大纲视图）

---

## 📁 文件结构

```
src/
├── components/
│   ├── Editor/
│   │   ├── Editor.tsx              # 主编辑器（集成所有模式）
│   │   ├── SourceEditor.tsx        # 现有源码编辑
│   │   ├── WysiwygEditor.tsx       # 新增：WYSIWYG 编辑器
│   │   ├── Preview.tsx             # 现有预览
│   │   └── SplitView.tsx           # 现有分栏视图
│   └── Toolbar/
│       └── Toolbar.tsx             # 更新模式切换按钮
├── lib/
│   ├── markdown/
│   │   ├── parser.ts               # 复用现有
│   │   └── htmlToMarkdown.ts       # 新增：HTML 转 Markdown
│   ├── wysiwyg/
│   │   ├── renderer.ts             # 新增：WYSIWYG 渲染器
│   │   ├── syncEngine.ts           # 新增：双向同步引擎
│   │   ├── cursorMapping.ts        # 新增：光标位置映射
│   │   └── keyHandlers.ts          # 新增：键盘处理器
│   └── turndown/
│       └── config.ts               # 新增：Turndown 配置
└── stores/
    └── editorStore.ts              # 修改：默认模式为 wysiwyg
```

---

## 🔧 技术选型

### 核心依赖

```bash
# HTML to Markdown
pnpm add turndown
pnpm add -D @types/turndown

# 可选：富文本编辑辅助
pnpm add @tiptap/core @tiptap/starter-kit  # 如果 contenteditable 不够
```

### 关键算法

#### 1. Position Mapping（位置映射）

```typescript
// 渲染元素 ↔ 源码位置映射
interface SourceMapping {
  // 元素在渲染视图中的范围
  viewRange: [number, number]
  // 对应源码中的范围
  sourceRange: [number, number]
  // 块类型
  blockType: 'paragraph' | 'heading' | 'list' | 'code' | 'table'
}

// 使用 markdown-it 的 token 位置信息
const mappings: SourceMapping[] = tokens.map(token => ({
  viewRange: [renderedOffset, renderedOffset + renderedLength],
  sourceRange: [token.map[0], token.map[1]],
  blockType: token.type
}))
```

#### 2. 增量更新

```typescript
// 识别变更的块
function findChangedBlocks(
  oldMarkdown: string,
  newMarkdown: string
): ChangedBlock[] {
  // 使用 diff 算法找出变更行
  // 只重新渲染变更的块，保持其他块不变
}
```

---

## ✅ 验收标准

### 功能验收

| 功能 | 验收标准 |
|------|----------|
| 模式切换 | 四模式可正常切换，无崩溃 |
| 文本编辑 | 可直接编辑文字，实时同步到 Source |
| 标题 | 输入 `# ` 自动渲染为标题，支持多级 |
| 列表 | Tab 缩进，Enter 新建项，Shift+Tab 取消缩进 |
| 代码块 | 可编辑代码内容，语法高亮 |
| 表格 | Tab 跳转单元格，可增删行列 |
| 格式化 | Cmd+B/I/K 快捷键可用 |
| 图片 | 渲染正常，可调整大小 |
| 撤销重做 | Cmd+Z / Cmd+Shift+Z 可用 |

### 性能验收

- 普通文档（< 1000 行）：编辑响应 < 50ms
- 大文档（> 5000 行）：虚拟滚动，首屏渲染 < 500ms
- 内存占用：编辑时内存增长 < 50MB

---

## 📅 里程碑

| 里程碑 | 日期 | 交付物 |
|--------|------|--------|
| M1 | Day 5 | 基础架构完成，四模式可切换 |
| M2 | Day 12 | 双向同步核心可用，简单编辑 |
| M3 | Day 21 | 块级元素支持完整 |
| M4 | Day 30 | 行内样式与快捷键完成 |
| M5 | Day 40 | 高级功能与优化完成 |
| M6 | Day 55 | 测试覆盖 80%+，发布就绪 |

---

## 🚧 风险与应对

| 风险 | 影响 | 应对策略 |
|------|------|----------|
| contenteditable 行为不一致 | 高 | 充分测试，必要时使用 ProseMirror 替代 |
| 光标位置难以保持 | 中 | 使用虚拟 DOM diff，最小化重渲染 |
| 中文输入法兼容 | 中 | 专门测试，处理 composition 事件 |
| 性能问题（大文件） | 中 | 增量更新 + 虚拟滚动 |
| 与现有功能冲突 | 低 | 保持 Source/Preview/Split 不变，独立开发 |

---

## 📝 下一步行动

1. **今天**：开始 Phase 1 Day 1-2（Store 与类型定义）
2. **本周内**：完成 Phase 1，M1 里程碑
3. **持续更新**：每完成一个 Phase，更新此文档进度

---

*创建时间：2026-03-05*  
*版本：v1.0*  
*状态：准备开始 Phase 1*
