# AI Parallel Chat

一个可运行的“平行衍生”聊天网站：主线对话保持整洁，右侧衍生窗口可针对当前上下文深入追问，并在关闭时选择“同步为隐藏记忆”或“纯净销毁”。

## 功能

- Provider Manager：支持 DashScope、DeepSeek、OpenAI、Gemini、Azure OpenAI 和 OpenAI 兼容接口。
- 主线聊天：隐藏记忆会参与后续模型调用，但不会显示在主线 UI。
- 衍生窗口：开启时复制主线当前上下文快照，右侧独立追问。
- 记忆合并：关闭衍生窗口时可选择同步为 `is_hidden=true` 的上下文，或直接删除分支消息。
- 持久化：默认使用 SQLite 保存 Provider、会话、消息和分支，刷新页面可恢复现场。

## 启动

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
npm install --prefix frontend
npm run dev --prefix frontend
```

4. 打开 `http://localhost:5173`，进入“模型设置”添加真实 Provider。

## Provider 配置提示

- OpenAI：`model_name` 可填 `gpt-4.1-mini` 等，通常不需要 `base_url`。
- DeepSeek：`model_name` 可填 `deepseek/deepseek-chat`。
- DashScope：`model_name` 可填 `dashscope/qwen-plus`。
- Gemini：`model_name` 可填 `gemini/gemini-2.0-flash`。
- Azure OpenAI：填写 Azure endpoint 到 `base_url`，`model_name` 填部署名或 LiteLLM 兼容模型名。
- 自定义网关：选择“自定义 OpenAI 兼容”，填写 `base_url`、`api_key` 和模型名。

## 生产化建议

当前实现为了本地可直接跑通，默认把 API Key 存在本地 SQLite。生产环境建议将 Provider 密钥迁移到服务端密钥管理或环境变量，并把 SQLite 替换为 PostgreSQL；临时分支缓存也可以接入 Redis。
