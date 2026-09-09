# 换行（`<br>`）

Markdown 支持内联 HTML：`<br>` 在预览与所见即所得中都渲染为换行，
表格单元格内尤其常用（与 GitHub 渲染一致）。

## 段落内换行

第一行<br>第二行<br />第三行<br/>第四行

## 表格单元格内换行

| method      | 请求字段                                                   | 说明                                                                     |
| ----------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| login       | server_host, server_port,<br>auth_type, username, password | auth_type ∈ password / account_token；<br>account_token 时 username 必填 |
| joinMeeting | meeting_number, password,<br>mic_on, camera_on             | 已登录：正常入会；<br>未登录走 anonymousJoinConference                   |

## 独立 `<br />` 行

两个段落之间夹一个独立 `<br />` 行，会产生额外的视觉空行：

上文段落
<br />
下文段落

## 边界与变体

- 大小写不敏感：<BR> 同样渲染为换行
- 其余内联 HTML（如 <b>加粗</b>、<span>span</span>）：预览按 HTML 渲染，所见即所得中保持字面显示（保存后源码不变）
