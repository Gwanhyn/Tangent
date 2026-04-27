# Tangent

一个可运行的“平行衍生”聊天网站：主线对话保持整洁，右侧衍生窗口可针对当前上下文深入追问，并在关闭时选择“同步为隐藏记忆”或“纯净快照”。

## 功能

- Provider Manager：支持 DashScope、DeepSeek、OpenAI、Gemini、Azure OpenAI 和 OpenAI 兼容接口。
- Markdown 渲染：支持 GFM 表格/任务列表、代码高亮、一键复制和 KaTeX 数学公式。
- 流式交互：主线与衍生窗口都支持 SSE 打字机输出、乐观更新和停止生成。
- 二次编辑：用户消息可编辑重发，保存后自动删除该消息之后的对话并重新生成。
- 主线聊天：隐藏记忆会参与后续模型调用，但不会显示在主线 UI。
- 衍生窗口：开启时复制主线当前上下文快照，右侧独立追问，并可选择不同模型协作。
- 分支追溯：主线会显示分支标记，点击可回看历史衍生快照。
- 划词触发：选中主线文本后可直接基于这段内容开启衍生窗口。
- 记忆合并：关闭衍生窗口时可调用模型提炼 100 字左右摘要，并作为隐藏上下文写回主线。
- 持久化：默认使用 SQLite 保存 Provider、会话、消息和分支，刷新页面可恢复现场。

## 启动

### Windows 一键启动

项目根目录提供了 `start.bat`，在 Windows 下双击即可启动完整前后端。

脚本会自动检查 `python`、`node`、`npm`，缺少依赖时会安装后端和前端依赖，然后分别打开后端与前端终端窗口，并自动访问 `http://localhost:5173`。

也可以在 PowerShell 中从项目根目录运行：

```powershell
.\start.bat
```

启动后请保持脚本打开的两个终端窗口运行：后端服务位于 `http://127.0.0.1:8000`，前端页面位于 `http://localhost:5173`。

### 手动启动

如果需要手动排查或单独启动服务，可以按下面步骤运行。

1. 安装后端依赖：

```powershell
python -m pip install -r backend/requirements.txt
```

2. 启动后端：

```powershell
python -m uvicorn app.main:app --app-dir backend --reload --port 8000
```

3. 安装并启动前端：

```powershell
Set-Location frontend
npm install
npm run dev
```

4. 打开 `http://localhost:5173`，进入“模型设置”添加真实 Provider。

## Provider 配置提示

- OpenAI：`model_name` 可填 `gpt-4.1-mini` 等，通常不需要 `base_url`。
- DeepSeek：`model_name` 可填 `deepseek/deepseek-chat`。
- SiliconFlow 上的 DeepSeek：`base_url` 可填 `https://api.siliconflow.cn`，系统会自动补为 `/v1`；`model_name` 可填 `deepseek-ai/DeepSeek-V3` 或模型列表中的其他 DeepSeek 模型。
- DashScope：`model_name` 可填 `dashscope/qwen-plus`。
- Gemini：`model_name` 可填 `gemini/gemini-2.0-flash`。
- Azure OpenAI：填写 Azure endpoint 到 `base_url`，`model_name` 填部署名或 LiteLLM 兼容模型名。
- 自定义网关：选择“自定义 OpenAI 兼容”，填写 `base_url`、`api_key` 和模型名。

## 生产化建议

当前实现为了本地可直接跑通，默认把 API Key 存在本地 SQLite。生产环境建议将 Provider 密钥迁移到服务端密钥管理或环境变量，并把 SQLite 替换为 PostgreSQL；临时分支缓存也可以接入 Redis。
