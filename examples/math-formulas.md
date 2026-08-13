# 数学公式测试样例（KaTeX）

> 本文档覆盖 VividMark 支持的公式语法与常见样例，可用于测试四种视图模式的渲染效果，或作为日常写作的语法参考。

**快速体验**

- **WYSIWYG 模式**（默认）：输入 `$x^2$` 在闭合 `$` 处自动渲染为公式；点击公式可编辑 LaTeX 源码（Enter 提交，Esc 取消；块级公式双击进入，`Cmd/Ctrl + Enter` 提交）
- **源码模式** `Cmd/Ctrl + /`：查看 / 编辑 Markdown 源码
- **导出 PDF** `Cmd/Ctrl + P`：公式以完整字形输出（字体内嵌）

## 语法速览

| 类型       | 语法                          | 说明                                             |
| ---------- | ----------------------------- | ------------------------------------------------ |
| 行内公式   | `$e=mc^2$`                    | 嵌入段落，随文排布                               |
| 块级公式   | `$$` 独立行围栏，内容多行书写 | 居中独占一行                                     |
| 注意       | 单行 `$$x$$`                  | 解析为**行内**公式（与 remark-math 行为一致），块级请用多行围栏 |

## 1. 行内公式

质能方程 $E = mc^2$ 大概是世界上最著名的公式。勾股定理 $a^2 + b^2 = c^2$ 描述了直角三角形三边关系。根式 $\sqrt{2}$、$\sqrt[3]{x + 1}$ 与分数 $\frac{a}{b}$ 都可以行内书写。复数领域有欧拉恒等式 $e^{i\pi} + 1 = 0$，被誉为最美公式。

## 2. 块级公式

一元二次方程求根公式：

$$
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$

微积分基本定理：

$$
\int_a^b f(x)\,\mathrm{d}x = F(b) - F(a)
$$

## 3. 常用结构

### 3.1 上下标与分数

行内：$x^2$、$x_i$、$x_i^{(n)}$、$10^{-8}$。组合与阶乘：

$$
\binom{n}{k} = \frac{n!}{k!(n - k)!}
$$

### 3.2 求和、乘积与极限

$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
\qquad
\prod_{i=1}^{n} i = n!
$$

$$
\lim_{x \to 0} \frac{\sin x}{x} = 1
\qquad
\lim_{n \to \infty} \left( 1 + \frac{1}{n} \right)^n = e
$$

### 3.3 积分

$$
\int_0^{+\infty} e^{-x^2}\,\mathrm{d}x = \frac{\sqrt{\pi}}{2}
\qquad
\iint_D f(x,y)\,\mathrm{d}x\,\mathrm{d}y
\qquad
\oint_C \vec{F} \cdot \mathrm{d}\vec{r}
$$

### 3.4 希腊字母

小写：$\alpha$ $\beta$ $\gamma$ $\delta$ $\epsilon$ $\varepsilon$ $\theta$ $\lambda$ $\mu$ $\pi$ $\sigma$ $\varphi$ $\psi$ $\omega$

大写：$\Delta$ $\Theta$ $\Lambda$ $\Pi$ $\Sigma$ $\Phi$ $\Psi$ $\Omega$

### 3.5 矩阵与行列式

$$
A = \begin{pmatrix} a & b \\ c & d \end{pmatrix},
\qquad
\det(A) = \begin{vmatrix} a & b \\ c & d \end{vmatrix} = ad - bc
$$

$$
I = \begin{bmatrix} 1 & 0 \\ 0 & 1 \end{bmatrix},
\qquad
\begin{Bmatrix} x \\ y \end{Bmatrix} \in \mathbb{R}^2
$$

### 3.6 分段函数

$$
f(x) = \begin{cases}
x^2, & x \geq 0 \\
-x, & x < 0
\end{cases}
$$

### 3.7 多行对齐推导

$$
\begin{aligned}
(a + b)^2 &= (a + b)(a + b) \\
&= a^2 + ab + ba + b^2 \\
&= a^2 + 2ab + b^2
\end{aligned}
$$

### 3.8 括号自适应大小

$$
\left( \frac{1}{2} \right)
\left[ \sum_{i=1}^{n} i \right]
\left\{ x \in \mathbb{R} \mid x > 0 \right\}
\left| \frac{a}{b} \right|
$$

### 3.9 文本、字体与颜色

$$
\text{加速度 } a = \frac{\mathrm{d}v}{\mathrm{d}t},
\qquad
\mathbf{F} = m\mathbf{a},
\qquad
\mathbb{R}^n,
\qquad
\mathcal{L}
$$

$$
\color{#e74c3c}{E} = m\color{#3498db}{c}^2
\qquad
\boxed{x = \frac{-b \pm \sqrt{\Delta}}{2a}}
$$

### 3.10 向量与修饰符号

行内一览：$\vec{a}$、$\overrightarrow{AB}$、$\hat{e}_x$、$\bar{x}$、$\dot{x}$、$\ddot{x}$、$\overline{AB}$、$\widetilde{f}$、$\hat{f}$。

## 4. 著名公式集锦

欧拉公式：

$$
e^{i\theta} = \cos\theta + i\sin\theta
$$

傅里叶变换：

$$
\hat{f}(\xi) = \int_{-\infty}^{+\infty} f(x)\, e^{-2\pi i x \xi}\,\mathrm{d}x
$$

薛定谔方程：

$$
i\hbar \frac{\partial}{\partial t} \Psi = -\frac{\hbar^2}{2m} \nabla^2 \Psi
$$

麦克斯韦方程组（两条）：

$$
\nabla \cdot \vec{E} = \frac{\rho}{\varepsilon_0}
\qquad
\nabla \times \vec{B} = \mu_0 \vec{J} + \mu_0 \varepsilon_0 \frac{\partial \vec{E}}{\partial t}
$$

## 5. 与其他语法混排

### 列表

- 无序列表中的公式：$a^2 + b^2 = c^2$
- 有序列表同理：$e^{i\pi} + 1 = 0$
- [ ] 任务列表里的公式 $x_1 + x_2 = x_3$
- [x] 已完成任务里的公式 $\sqrt{16} = 4$

### 引用

> 在自然科学的皇后——数学中，$e^{i\pi} + 1 = 0$ 汇聚了最重要的五个常数。

### 提示框（Admonition）

::: tip 微积分基本定理
若 $f$ 在 $[a, b]$ 上连续，则：

$$
\int_a^b f(x)\,\mathrm{d}x = F(b) - F(a)
$$

其中 $F$ 是 $f$ 的任一原函数。
:::

### 表格

| 名称         | 公式                                                                   |
| ------------ | ---------------------------------------------------------------------- |
| 圆的面积     | $S = \pi r^2$                                                          |
| 正态分布密度 | $f(x) = \frac{1}{\sqrt{2\pi}\,\sigma}\, e^{-\frac{(x-\mu)^2}{2\sigma^2}}$ |
| 等差数列求和 | $S_n = \frac{n(a_1 + a_n)}{2}$                                         |

注意：表格单元格内的公式**不能含裸 `|`**（会被当作列分隔符），绝对值请写成 `\lvert x \rvert`。

## 6. 边界与注意事项

1. **货币金额会被误解析**：`$5 and $10` 中的 `$5 and $` 会被视为公式（remark-math 无货币保护）。涉及金额时请转义：`\$5 和 \$10` → \$5 和 \$10。
2. **字面美元符号**：`\$` 转义后原样输出，不参与公式解析。
3. **未闭合的 `$` 保持原文**：$x 这样不会解析，页面照常渲染。
4. **错误公式不炸页面**：$\invalidcommand{$ 仅显示红色错误提示，不影响其他内容。
5. **单行 `$$x$$` 是行内公式**：块级公式必须用多行围栏（`$$` 独占一行）；WYSIWYG 保存后单行形式会被规整为 `$x$`。
6. **公式内的 `%` 是注释符**：百分号写作 `\%`，例如 $50\%$。
7. **公式内的 `_` `*` `\` 等 Markdown 特殊字符无需转义**：`$...$` 与 `$$` 围栏内部按 LaTeX 规则解析，不受 Markdown 语法干扰。

---

参考：[KaTeX 支持的全部命令与符号](https://katex.org/docs/supported.html)
