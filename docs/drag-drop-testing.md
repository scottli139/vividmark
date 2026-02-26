# 文件拖放功能测试指南

## 概述

本文档描述了 VividMark 中文件拖放功能的测试策略，包括单元测试、集成测试和手动测试方法。

## 测试架构

```
┌─────────────────────────────────────────────────────────────┐
│                     测试金字塔                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ▲  手动测试 (Manual)                                      │
│  ╱ ╲   - 真实桌面环境验证                                    │
│ ╱   ╲  - macOS/Windows 原生拖放                              │
│╱     ╲                                                      │
│   ▲    E2E 测试 (Playwright)                                │
│  ╱ ╲   - 浏览器环境基础功能验证                              │
│ ╱   ╲  - 无法测试原生拖放事件                                │
│╱     ╲                                                      │
│   ▲    集成测试 (Integration)                               │
│  ╱ ╲   - 组件间交互                                         │
│ ╱   ╲  - Hook 与 Store 集成                                  │
│╱     ╲                                                      │
│ ▲▲▲▲▲ 单元测试 (Vitest)                                     │
│ 大量    - Hook 逻辑测试                                      │
│         - Mock Tauri API                                    │
└─────────────────────────────────────────────────────────────┘
```

## 单元测试

### 运行方式

```bash
# 运行所有测试
pnpm test:run

# 只运行拖放测试
pnpm test:run src/hooks/__tests__/useFileDragDrop.test.ts

# 开发模式（监听）
pnpm test src/hooks/__tests__/useFileDragDrop.test.ts
```

### 测试覆盖

| 测试用例 | 描述 | 状态 |
|---------|------|------|
| 监听器设置 | 验证组件挂载时正确设置 Tauri 事件监听 | ✅ |
| 拖拽进入 | 验证拖拽文件进入窗口时显示覆盖层 | ✅ |
| 拖拽离开 | 验证拖拽离开时隐藏覆盖层 | ✅ |
| 文件投放 | 验证投放文件后调用 openFileByPath | ✅ |
| 无效文件类型 | 验证非 Markdown 文件被拒绝 | ✅ |
| 多文件处理 | 验证多个文件时只处理第一个 | ✅ |
| 清理工作 | 验证组件卸载时移除监听器 | ✅ |
| 打开失败 | 验证文件打开失败时显示错误 | ✅ |
| 监控指标 | 验证 getDragDropMetrics 返回正确格式 | ✅ |

### Mock 策略

```typescript
// Tauri API Mock
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    label: 'main',
    onDragDropEvent: mockOnDragDropEvent,
  }),
}))

// 触发事件的辅助函数
const simulateDragEnter = (paths: string[]) => {
  mockDragDropCallback?.({
    payload: { type: 'enter', paths }
  })
}
```

## E2E 测试

### 限制说明

**Playwright E2E 测试运行在浏览器环境**，无法测试 Tauri 原生拖放事件：

- ❌ 无法触发 `onDragDropEvent` 原生事件
- ❌ 无法模拟系统级文件拖拽
- ✅ 可以测试 UI 渲染和基础交互

### 替代方案

```bash
# 使用 Tauri 的特定测试模式（需要额外配置）
# 当前项目未启用，需要：
# 1. 配置 @tauri-apps/api 在测试环境
# 2. 使用 WebDriver 协议控制 Tauri 应用
```

## 手动测试清单

### 基础功能

| 步骤 | 操作 | 预期结果 | 状态 |
|-----|------|---------|------|
| 1 | 启动应用 | 应用正常加载 | ⬜ |
| 2 | 从 Finder 拖拽 .md 文件 | 显示蓝色覆盖层，显示文件名 | ⬜ |
| 3 | 释放文件 | 文件打开，内容显示在编辑器 | ⬜ |
| 4 | 拖拽图片文件 (.png) | 显示警告："Please drop a Markdown file" | ⬜ |
| 5 | 拖拽时按 Escape | 覆盖层消失 | ⬜ |

### 边缘情况

| 步骤 | 操作 | 预期结果 | 状态 |
|-----|------|---------|------|
| 6 | 拖拽包含未保存更改 | 弹出确认对话框 | ⬜ |
| 7 | 选择取消 | 保持当前文档不变 | ⬜ |
| 8 | 选择确认 | 打开新文件 | ⬜ |
| 9 | 拖拽多个文件 | 只打开第一个 | ⬜ |
| 10 | 拖拽超大文件 (>10MB) | 正常打开或显示错误 | ⬜ |

## 监控与诊断

### 运行时诊断

```javascript
// 在应用控制台执行
getDragDropMetrics()

// 预期输出：
{
  dragEnterCount: 5,    // 拖拽进入次数
  dropCount: 3,         // 投放次数
  successCount: 3,      // 成功打开次数
  errorCount: 0,        // 失败次数
  lastError: undefined  // 最后一次错误信息
}
```

### 日志级别

| 级别 | 使用场景 | 示例 |
|-----|---------|------|
| DEBUG | 详细调试信息 | 原始事件数据、状态变化 |
| INFO | 关键流程节点 | 文件打开成功、监听器设置 |
| WARN | 非致命警告 | 无效文件类型 |
| ERROR | 错误情况 | API 调用失败、异常捕获 |

## CI/CD 集成

```yaml
# .github/workflows/test.yml
- name: Run Unit Tests
  run: pnpm test:run
```

## 参考资源

- [Tauri Testing Guide](https://tauri.app/v1/guides/testing/)
- [Playwright E2E Testing](https://playwright.dev/)
- [Vitest Unit Testing](https://vitest.dev/)
