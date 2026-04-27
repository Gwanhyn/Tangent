# Tangent 1.0 研发改进协议 (Technical Specification)

## 一、 全局布局与多栏独立控制
**目标**：消除滚动耦合，建立三栏独立操作空间。

* **1.1 独立滚动容器 (Independent Scrolling)**：
    * **架构**：父容器 `height: 100vh; overflow: hidden;`。
    * **左栏 (Sidebar)**、**中栏 (Primary Flow)**、**右栏 (Branch/Parallel Pane)** 必须分别设置 `overflow-y: auto;`。
    * **交互逻辑**：当某一栏正在生成内容（Streaming）时，该栏自动锁定到底部滚动，不影响其他两栏的阅读位置。
* **1.2 侧边进度导航条 (Context Timeline)**：
    * **UI表现**：在中栏和右栏的侧边缘（靠近滚动条处）显示一条极细的淡色垂直轮廓。
    * **节点表示**：每一组“提问-回答”对应一个点或短杠。
    * **悬浮交互**：鼠标移至节点，节点轻微放大并弹出浮窗显示问题缩略（Max 20字），点击节点，主视图立即滚动至该对话位置。

---

## 二、 侧边栏与会话管理 (Sidebar & History)
**目标**：提升会话索引效率，消除视觉拥挤。

* **2.1 会话项渲染**：
    * **自动摘要 (Auto-Summary)**：调用后端 API 对首轮对话进行 10-15 字的意图提炼。
    * **防溢出处理**：使用 `text-overflow: ellipsis; white-space: nowrap;`。严禁出现横向滚动条。
    * **悬浮增强**：鼠标悬停在会话项上 0.5s 后，弹出 Tooltip 显示完整摘要内容。
* **2.2 模型引擎管理 (Engines)**：
    * 底部“模型设置”更名为 **Engines / 模型配置**。
    * 点击弹出独立的配置面板，支持多 Provider (DashScope, OpenAI, DeepSeek, etc.)。

---

## 三、 平行衍生模式 (Parallel Branching)
**目标**：收缩工具栏，突出对话内容。

* **3.1 极简工具栏**：
    * 右栏开启后，将“记忆注入 (Context Injection)”等开关由文字按钮改为 **Icon-Only 按钮**（例如：大脑图标表示记忆，分支图标表示模式）。
    * 按钮组放置在右栏顶部或输入框右上角，减小视觉占用。
* **3.2 模式切换按钮**：
    * 主界面右上角“开启衍生”统一改为：`[Branch Icon] Branch Out`。
* **3.3 交互生命周期**：
    * **发送即渲染 (Optimistic UI)**：用户点击发送，气泡立即生成。
    * **流式渲染 (Markdown Streaming)**：集成 `react-markdown`，确保代码块高亮 (Prism.js/Shiki) 和 $LaTeX$ 实时渲染。
    * **中断与编辑**：增加 `Stop Generating` 按钮和用户消息的 `Edit` 悬浮图标。

---

## 四、 术语标准化与国际化 (Copy & Localization)
**目标**：去除口语化，建立专业工具的语感。

### 4.1 核心术语表
| 位置 | 英文术语 (Primary) | 中文术语 (Secondary) | 说明 |
| :--- | :--- | :--- | :--- |
| **顶部 Header** | Primary Flow | 主线程 | 强调对话核心轴。 |
| **衍生窗格标题** | Side-probe / Branch | 衍生分支 | 体现侧边探针的精准感。 |
| **空态页面引导** | Ready to Branch Out? | 准备好派生分支了吗？ | 启发式引导。 |
| **记忆同步开关** | Memory Persistence | 记忆持久化 | 强调上下文是否存入数据库。 |
| **融合功能** | Knowledge Integration | 知识集成 | 关闭模式后的记忆合并过程。 |

### 4.2 国际化与偏好设置 (Settings & L10n)
* **中英切换**：提供全局 Toggle，切换后界面所有 UI 文体、Tooltip 及占位符同步更新。
* **分窗自定义 (Pane Personalization)**：
    * 在设置页面提供 **Color Mode (分色模式)**。
    * 用户可分别为“主线程”和“衍生分支”设置背景色（如：主线为米色/深灰，衍生线为浅蓝调/深蓝调），通过色差快速区分认知空间。
    * **字体缩放**：全局调整对话字体大小（12px - 18px）。

---

## 五、 UI 视觉细节打磨
**目标**：通过细节提升“工业级”美感。

* **5.1 品牌区 (Branding)**：
    * 左上角移除“切线式...”说明文字。仅保留 Logo 和版本号（如：`Tangent v1.0`）。
* **5.2 报错反馈 (Error Handling)**：
    * 将红色的 `Failed to fetch` 移除。改为非侵入式的 **Toast (吐司弹窗)**，显示在屏幕右上方，3秒自动消失。
* **5.3 字体方案 (Typography)**：
    * **正文**：优先调用 `Inter`, `-apple-system`, `PingFang SC`。
    * **代码**：强制使用 `JetBrains Mono` 或 `Fira Code`。
* **5.4 输入框 (Input)**：
    * 占位符改为：`Message Tangent... (Ctrl + Enter to send)`。

---

## 六、 待实现功能 Checkbox (供开发者对照)

- [ ] [前端] 实现三栏 `H-screen` Flex 布局，禁用全局滚动。
- [ ] [前端] 开发 `Context Timeline` 组件，实现节点跳转逻辑。
- [ ] [前端] 集成 Markdown 渲染器，支持 SSE 流式数据解析。
- [ ] [后端] 会话保存逻辑支持 `Parent_Thread_ID` 字段，实现分支关联。
- [ ] [设置] 增加 `ThemeStore` 支持独立配置主/分窗口颜色。
- [ ] [国际化] 编写 `en.json` 和 `zh.json` 映射表。
