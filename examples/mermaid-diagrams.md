# Mermaid 图表示例（本地离线渲染）

> 本文档覆盖 VividMark 支持的 Mermaid 语法形态与常见图例，可用于测试四种视图模式的渲染效果，或作为日常写作的语法参考。所有图表由内置 mermaid.js 离线渲染（首个图表出现时按需加载），无需联网。

**快速体验**

- **WYSIWYG 模式**（默认）：` ```mermaid ` 代码块上方显示预览图、下方可直接编辑源码，停止输入约 0.5s 后自动刷新
- **源码模式** `Cmd/Ctrl + /`：查看 / 编辑 Markdown 源码；**分屏模式**左源码右预览实时联动
- **暗色模式**：图表随主题自动重新渲染为暗色配色
- **导出 PDF** `Cmd/Ctrl + P` / **导出为网站**：图表以内联 SVG 输出，导出物离线可用

## 语法速览

| 形态     | 语法                                 | 说明                                                     |
| -------- | ------------------------------------ | -------------------------------------------------------- |
| 代码块   | ` ```mermaid ` 围栏                  | 四种视图模式全部支持                                     |
| 离线渲染 | 内置 mermaid.js，无网络请求          | 语法错误时显示错误态与源码（无在线服务回退）             |
| 首次加载 | 首个图表按需加载引擎（chunk 较大）稍慢 | 之后的结果有缓存，同图重复出现即时显示                 |

> 注意：与 PlantUML 不同，Mermaid 没有行内语法，只有围栏代码块一种形态。

## 1. 流程图（flowchart）

```mermaid
flowchart TD
    A[打开文档] --> B{有改动?}
    B -->|是| C[自动保存]
    B -->|否| D[继续编辑]
    C --> D
    D --> E[导出 PDF / 网站]
```

## 2. 时序图（sequenceDiagram）

```mermaid
sequenceDiagram
    participant 用户
    participant VividMark
    participant 渲染引擎
    用户->>VividMark: 输入 mermaid 源码
    VividMark->>渲染引擎: 防抖 0.5s 后请求渲染
    渲染引擎-->>VividMark: 内联 SVG
    VividMark-->>用户: 更新预览图
```

## 3. 类图（classDiagram）

```mermaid
classDiagram
    class Document {
        +String filePath
        +String content
        +save()
        +export(format)
    }
    class Editor {
        +viewMode
        +render()
    }
    class MermaidRenderer {
        +renderSvg(source, dark)
    }
    Editor --> Document : 编辑
    Editor --> MermaidRenderer : 调用
```

## 4. 状态图（stateDiagram-v2）

```mermaid
stateDiagram-v2
    [*] --> 草稿
    草稿 --> 已保存 : 自动保存（2s 空闲）
    已保存 --> 草稿 : 继续编辑
    已保存 --> [*] : 关闭文档
```

## 5. ER 图（erDiagram）

```mermaid
erDiagram
    DOCUMENT ||--o{ DIAGRAM : contains
    DOCUMENT {
        string filePath
        string content
    }
    DIAGRAM {
        string language
        string source
    }
```

## 6. 甘特图（gantt）

```mermaid
gantt
    title VividMark 语法批次计划
    dateFormat YYYY-MM-DD
    section 批次 1-3
    GitHub Alerts       :done, a1, 2026-08-15, 1d
    脚注 / frontmatter  :done, a2, 2026-08-16, 2d
    section 批次 4
    Mermaid             :active, a3, 2026-08-17, 2d
    section 批次 5
    排版增强批           :a4, after a3, 1d
```

## 7. 饼图（pie）

```mermaid
pie title 编辑器使用时长分布
    "WYSIWYG" : 55
    "源码" : 25
    "分屏" : 15
    "预览" : 5
```

## 8. 思维导图（mindmap）

```mermaid
mindmap
  root((VividMark))
    编辑
      WYSIWYG
      源码
      分屏
    图表
      PlantUML
      Mermaid
    导出
      PDF
      静态网站
```

## 9. Git 图（gitGraph）

```mermaid
gitGraph
    commit
    branch feature/mermaid
    checkout feature/mermaid
    commit
    commit
    checkout main
    merge feature/mermaid
    commit
```

## 10. 边界与降级形态

**语法错误**：渲染失败时显示错误样式与源码（不会像 PlantUML 那样回退在线服务）：

```mermaid
flowchart TD
    A[开始] --> B{这是故意写错的语法
```

**空代码块**：` ```mermaid ` 后没有内容时，预览区保持占位、不渲染。

**行内提及**：在行内代码中书写 ` ```mermaid ` 或 `graph TD` 不会触发渲染。

## 更多语法

Mermaid 还支持用户旅程图、时间线（timeline）、象限图、XY 图等，完整语法参考 [Mermaid 官方文档](https://mermaid.js.org/)。内置引擎与 npm 正式版保持同步，不依赖外部资源的语法都可离线使用。
