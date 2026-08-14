# PlantUML 图表示例（本地离线渲染）

> 本文档覆盖 VividMark 支持的 PlantUML 语法形态与常见图例，可用于测试四种视图模式的渲染效果，或作为日常写作的语法参考。所有图表由内置本地引擎（@plantuml/core）离线渲染，无需联网。

**快速体验**

- **WYSIWYG 模式**（默认）：` ```plantuml ` 代码块上方显示预览图、下方可直接编辑源码，停止输入约 0.5s 后自动刷新
- **源码模式** `Cmd/Ctrl + /`：查看 / 编辑 Markdown 源码；**分屏模式**左源码右预览实时联动
- **暗色模式**：图表随主题自动重新渲染为暗色配色
- **导出 PDF** `Cmd/Ctrl + P` / **导出为网站**：图表以内联 SVG 输出，导出物离线可用

## 语法速览

| 形态       | 语法                                     | 说明                                                         |
| ---------- | ---------------------------------------- | ------------------------------------------------------------ |
| 代码块     | ` ```plantuml ` 围栏                     | **推荐**，四种视图模式全部支持；块内书写完整 `@startuml...@enduml` |
| 行内块     | 独立段落直接书写 `@startuml...@enduml`   | 在 源码/分屏/预览 模式渲染；WYSIWYG 模式显示为源码文本       |
| 离线渲染   | 内置引擎，无网络请求                     | 渲染失败时回退 PlantUML 在线服务                             |
| 首次加载   | 首张图渲染需加载引擎（约数 MB）稍慢      | 之后的结果有缓存，同图重复出现即时显示                       |

> 注意：`@startuml` 与 `@enduml` 标记必须书写（两种形态都需要）；`!include` 远程资源与 emoji sprite 未内置，引用外部主题的写法在离线环境不可用。

## 1. 时序图

```plantuml
@startuml
用户 -> VividMark : 打开文档
VividMark -> 本地引擎 : 渲染 PlantUML
本地引擎 --> VividMark : 内联 SVG
VividMark --> 用户 : 展示图表
@enduml
```

## 2. 类图

```plantuml
@startuml
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

class PlantUmlEngine {
  +renderSvg(source)
}

Editor --> Document : 编辑
Editor --> PlantUmlEngine : 调用
Document ..> PlantUmlEngine : 内嵌图表
@enduml
```

## 3. 活动图

```plantuml
@startuml
start
:输入 PlantUML 源码;
if (语法正确?) then (是)
  :本地引擎渲染;
  :显示 SVG 图表;
else (否)
  :显示错误示意图;
endif
stop
@enduml
```

## 4. 用例图

```plantuml
@startuml
left to right direction
actor 写作者
rectangle VividMark {
  usecase "编辑 Markdown" as UC1
  usecase "绘制 UML" as UC2
  usecase "导出 PDF" as UC3
  usecase "导出网站" as UC4
}
写作者 --> UC1
写作者 --> UC2
写作者 --> UC3
写作者 --> UC4
@enduml
```

## 5. 状态图

```plantuml
@startuml
[*] --> 草稿
草稿 --> 已保存 : 自动保存（2s 空闲）
已保存 --> 草稿 : 继续编辑
草稿 --> 已保存 : Cmd+S
已保存 --> [*] : 关闭文档
@enduml
```

## 6. 组件图

```plantuml
@startuml
package "前端 (React)" {
  [WYSIWYG 编辑器]
  [源码编辑器]
  [预览渲染器]
}

package "桌面端 (Tauri/Rust)" {
  [文件读写]
  [PDF 导出]
  [原生菜单]
}

[WYSIWYG 编辑器] --> [文件读写] : 保存
[预览渲染器] --> [PDF 导出] : 生成 PDF
@enduml
```

## 7. 行内语法示例

下面这段没有用围栏，直接以 `@startuml` 独立段落书写。它在**源码/分屏/预览**模式下会渲染为图表；在 WYSIWYG 模式下显示为源码文本（该模式的行内语法支持是后续项）。

@startuml
Alice -> Bob: 行内语法
Bob --> Alice: 无需围栏
@enduml

## 更多语法

PlantUML 还支持部署图、ER 图、甘特图、思维导图等，完整语法参考 [PlantUML 官方文档](https://plantuml.com/)。本地引擎与官方版本保持同步，绝大多数不依赖外部资源的语法都可离线使用。
