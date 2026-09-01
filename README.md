# AI 学习辅助（Chrome / Edge 扩展）

框选练习题，侧边栏给出建议答案和解析。只有你点「填入建议」才会改页面表单，**从不自动提交**。

用于课后练习、公开试卷、自学核对。不要拿到正式考试、锁机浏览器或监考系统里用。

## 能做什么

- 选中题干后：工具栏图标打开侧边栏、右键「解析选中题目」、或 `Alt+Shift+A`
- 调用你自己配置的 OpenAI 兼容接口（DeepSeek / OpenAI / 本地网关）
- 不确定时标黄，并禁用填入
- 普通 HTML 的单选 / 多选 / 填空，确认后才写入对应控件

## 不会做什么

- 隐藏自身、伪装页面、绕过防作弊或焦点检测
- 不经确认就填完整张卷并提交
- 针对某个考试平台写专用脚本

## 加载

1. Chrome 打开 `chrome://extensions`，或 Edge 打开 `edge://extensions`
2. 打开「开发人员模式」
3. 「加载已解压的扩展程序」，选本目录 `ai-study-assistant`
4. 扩展图标 → 选项页，填写 API Base、模型名、API Key

默认 Base：`https://api.deepseek.com/v1`  
默认模型：`deepseek-chat`  
也可填 `https://api.openai.com/v1` 或本地 `http://127.0.0.1:8000/v1`

Key 只存在本机 `chrome.storage.local`。

## 试用

用浏览器打开 [`examples/practice.html`](examples/practice.html)，选中第一题文字，按 `Alt+Shift+A`。解析完成后点「填入建议」，核对选项是否变化；页面上的提交按钮会被练习页自己拦住。

若以 `file://` 打开练习页，需在扩展「详细信息」里勾选「允许访问文件网址」。也可以用任意本地静态服务器打开该 HTML。

## 权限说明

| 权限 | 用途 |
| --- | --- |
| `storage` | 保存接口配置和最近一次解析 |
| `activeTab` / `scripting` | 读取当前页选区，确认后填入 |
| `contextMenus` | 右键解析 |
| `sidePanel` | 侧边栏 |
| 网页访问 | 调用你填写的 LLM 接口；内容脚本只读选区和邻近表单 |

## 目录

```
ai-study-assistant/
  manifest.json
  icons/
  src/background.js
  src/content.js
  src/sidepanel.html
  src/options.html
  src/lib/llm.js
  examples/practice.html
```
