# Ollama-Web-UI

基于 Vue 3 的 Ollama 客户端 Web UI，提供浏览器端的对话交互界面。支持主题切换、自定义颜色、代码块样式定制、对话导出等功能。

---

## 技术栈

| 层 | 技术 | 说明 |
|---|------|------|
| 框架 | **Vue 3** (Composition API) | 响应式 UI 框架 |
| 构建 | **Vite 5** | 开发服务器(HMR) + 生产构建 |
| 状态管理 | **Pinia** ^2.1 | 集中管理对话/配置状态 |
| Markdown 渲染 | **showdown** ^2.1 | AI 回复的 Markdown→HTML 管线 |
| 数学公式 | **KaTeX** ^0.16 (CDN 加载) | LaTeX 公式渲染 |
| 数据持久化 | 浏览器 **localStorage** | Pinia store 自动同步 |
| 后端 | **Ollama HTTP API** | `/api/tags` + `/api/generate` |

## 项目结构

```
Ollama-Web-UI/
├── index.html                  # Vite 入口 HTML（含 CSP 策略）
├── package.json                # 依赖和脚本
├── vite.config.js              # Vite 配置
├── vitest.config.js            # Vitest 测试配置
├── playwright.config.js        # E2E 测试配置
├── dist/                       # 构建产物（部署此目录）
├── public/
│   └── pwa-*.svg               # PWA 图标
├── e2e/                        # E2E 测试
├── src/
│   ├── main.js                 # Vue 应用入口 + 全局错误捕获
│   ├── App.vue                 # 根组件（全局事件委托）
│   ├── constants.js            # 常量定义 + 主题系统 + 五级日志工具
│   ├── assets/css/main.css     # 全局样式（CSS 变量体系）
│   ├── components/
│   │   ├── Sidebar.vue         # 侧栏（对话列表 + 搜索 + 置顶 + 统计）
│   │   ├── ChatHeader.vue      # 头部（标题 + 导出/页面选项/配置入口）
│   │   ├── ConfigPanel.vue     # 配置面板（基本/高级 Tab）
│   │   ├── ThemePanel.vue      # 主题面板（预设主题 + 自定义颜色 + 代码块样式）
│   │   ├── ChatContainer.vue   # 消息展示容器（骨架屏 + 分组）
│   │   ├── MessageItem.vue     # 单条消息（Markdown/流式/气泡/引用）
│   │   ├── MessageInput.vue    # 输入框（可收起/展开 + 引用预览）
│   │   ├── ContextMenu.vue     # 右键上下文菜单
│   │   ├── ShortcutHint.vue    # 快捷键提示
│   │   └── ToastNotification.vue # 通知提示（四色 Toast）
│   ├── composables/
│   │   └── useContextMenu.js   # 右键菜单组合式函数
│   ├── stores/
│   │   └── chat.js             # Pinia store（核心状态管理）
│   ├── __tests__/              # 单元测试
│   └── utils/
│       ├── markdown.js         # 渲染管线 + 代码块增强 + 复制
│       ├── storage.js          # localStorage 封装（增量写入）
│       └── helpers.js          # 工具函数（ID 生成、模板等）
├── HELP.md                     # 帮助文档
└── README.md                   # 本文件
```

## 功能特性

- **主题系统**：6 种预设主题（默认蓝、翠绿、紫色、暖橙、绯红、暗色、极光、海洋、复古）+ 自定义主题色
- **代码块样式**：独立自定义代码块背景色和文字颜色
- **对话管理**：新建、搜索、置顶、标签筛选、删除对话
- **对话导出**：导出当前对话（JSON/Markdown）或全部对话（JSON）
- **配置管理**：多服务地址管理、模型选择、流式速度控制、上下文长度设置
- **消息引用**：F7 引用上一条 AI 消息
- **统计面板**：对话数、消息总数等统计信息

## 使用流程

1. 访问 [Ollama 官网](https://ollama.com/) 下载 Ollama 客户端并安装  
   <img width="50%" height="auto" alt="image" src="https://github.com/user-attachments/assets/a0f9f9e0-28d2-4ac4-a96e-7e327354cb17" />

2. 注册 Ollama 官网个人账号
3. 启动 Ollama 客户端，登录账号，测试模型可用性
4. 下载本仓库 Release 包，解压到合适目录后：

   **方式一（开发运行）**：
   ```bash
   npm install
   npm run dev
   ```
   然后在浏览器打开 http://localhost:5173

   **方式二（部署运行）**：
   ```bash
   npm install
   npm run build
   ```
   将 `dist/` 目录部署到任意静态服务器（Nginx、IIS、PHPTS 等），
   或用 VS Code Live Server 直接打开 `dist/index.html` 的上级目录。

5. 点击页面右上角的配置选项，配置正确的 Ollama 服务地址，回车加载  
   <img width="50%" height="auto" alt="image" src="https://github.com/user-attachments/assets/3384a199-a3a5-4b9b-80ba-ef612e2f6a7c" />

6. 选择合适的模型和配置参数，开始使用

## 数据模型

| localStorage Key | 内容 |
|---|---|
| `Ollama-Web-UI-Conversations` | 全部对话（含消息、角色、时间戳、置顶） |
| `Ollama-Web-UI-LastActiveChat` | 当前活跃对话 ID |
| `Ollama-Web-UI-Config-*` | 各项配置（模型、地址、速度等） |

> 存储读写统一通过 `src/utils/storage.js` 封装，增量写入 + 节流。

## npm 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（热更新） |
| `npm run build` | 生产构建，输出 `dist/` |
| `npm run preview` | 本地预览构建产物 |

## 安全

- 所有用户/AI 消息经 `escapeHtml()` + `sanitizeHtml()` 双保险转义
- 链接强制 `target="_blank" rel="noopener noreferrer"`
- CSP 策略已在 `index.html` 中配置

## 交接说明

项目已完成 Vue 3 重构，核心链路稳定。
项目结束原因为 API 配额耗尽，后续接手方需要：

1. 更新 `vite.config.js` 中的 Ollama API 端点配置（如需）
2. 测试与新版 Ollama API 的兼容性

---

## 相关教程

### 部署到局域网
1. 下载 Web 服务器软件（如 Nginx、PHPTS）或使用 Windows IIS 服务，配置网站入口到 `dist/` 目录
2. 在同一局域网的其他设备上通过 `http://Windows局域网IP:端口` 访问
3. 正常使用

---

## 常见问题

### 如何自定义 Ollama 服务地址
- 创建环境变量 `OLLAMA_HOST=你自定义的地址(带端口号)` 后重启 Ollama 服务
- 如果需要允许外部访问，还需要设置 `OLLAMA_ORIGINS=*`

### 更多问题
详见 `HELP.md`。
