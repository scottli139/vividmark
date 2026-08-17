# Admonitions 提示框

演示 VividMark 的两种提示框语法，双端（WYSIWYG / 预览 / 分屏）均可渲染：

- `:::` 容器（VividMark 原生，markdown-it-container 风格）
- `!!!` 容器（MkDocs / Python-Markdown 风格，无结束围栏，内容由 4 空格缩进定界）

在 WYSIWYG 中编辑 `!!!` 提示框后保存，源码围栏保持 `!!!` 不变（不会被改写为 `:::`）。

## `:::` 语法（原生）

::: tip
这是一个 **提示** 框，支持行内格式与[链接](https://example.com)。
:::

::: warning 自定义标题
带自定义标题的警告框。
:::

## `!!!` 语法（MkDocs）

!!! note
    这是 MkDocs 风格的提示框，内容行缩进 4 个空格。

!!! warning "自定义标题"
    标题用引号包裹（无引号标题 `!!! warning 标题` 同样支持）。

!!! abstract
    未知类型（MkDocs 扩展类型如 abstract/question/example）降级为 note 主题，
    默认标题取原类型名；WYSIWYG 保存后类型名原样保留。

## 全部类型

::: tip
tip
:::

::: warning
warning
:::

::: info
info
:::

::: note
note
:::

::: danger
danger
:::

::: success
success
:::

::: hint
hint
:::

::: important
important
:::

::: caution
caution
:::

## 多段内容与嵌套

!!! note 多段内容
    第一段。

    第二段（空行悬挂，仍归属容器）。

    - 列表条目一
    - 列表条目二

    ```js
    // 容器内的围栏代码块
    const a = 1
    ```

!!! tip 嵌套提示框
    外层内容。

    !!! danger "内层"
        内层内容（再缩进 4 空格）。

## 边界情况

### 未缩进行结束容器

!!! note
    框内内容。

这一行没有缩进，在容器之外。

### 空容器

!!! info

### 围栏代码块内的 `!!!` 不渲染

```text
!!! note
    这只是代码示例，不是提示框
```

### `???` 可折叠语法（暂不支持）

??? note
    可折叠提示框是独立语法构造（details/summary），当前按原文渲染。

### 引用块中的提示框

> !!! tip
>     引用块内的提示框（预览可渲染；WYSIWYG 暂按原文显示，切换不丢内容）。
