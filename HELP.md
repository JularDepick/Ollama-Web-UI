# Ollama-Web-UI 帮助文档

## 目录

1. [项目简介](#1-项目简介)
2. [环境要求](#2-环境要求)
3. [开发运行](#3-开发运行)
4. [生产构建与部署](#4-生产构建与部署)
5. [部署到局域网](#5-部署到局域网)
6. [Ollama 配置](#6-ollama-配置)
7. [常见问题](#7-常见问题)
8. [项目结构](#8-项目结构)

---

## 1. 项目简介

Ollama-Web-UI 是一个基于 Vue 3 的 Ollama 客户端 Web UI，提供浏览器端的对话交互界面。项目使用 Vite 构建，Pinia 管理状态，支持 Markdown/LaTeX 渲染。

**技术栈**：Vue 3 (Composition API) + Vite 5 + Pinia + showdown + KaTeX

## 2. 环境要求

| 依赖 | 最低版本 | 说明 |
|------|---------|------|
| Node.js | 18+ | 开发/构建必需 |
| npm | 8+ | 包管理 |
| Ollama | 0.1.0+ | 后端服务（本地或远程） |
| 浏览器 | Chrome/Firefox/Edge 最近两年版 | 运行环境 |

> 如果仅需部署构建产物（`dist/` 目录），则无需 Node.js — 任何静态 Web 服务器均可托管。

## 3. 开发运行

### 3.1 安装依赖

```bash
npm install
```

### 3.2 启动开发服务器

```bash
npm run dev
```

默认访问 `http://localhost:5173`。支持热更新（HMR），修改代码后浏览器自动刷新。

### 3.3 开发服务器选项

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（默认端口 5173） |
| `npx vite --host` | 监听所有网络接口，局域网设备可访问 |
| `npx vite --port 3000` | 指定端口 |

### 3.4 浏览器打开后

1. 点击右上角「配置选项」
2. 填写 Ollama 服务地址（如 `http://localhost:11434` 或远程地址）
3. 点击「扫描」加载模型列表
4. 选择模型，开始对话

## 4. 生产构建与部署

### 4.1 构建

```bash
npm run build
```

生成产物位于 `dist/` 目录：
```
dist/
├── index.html
└── assets/
    ├── index-xxx.js       # 应用 JS 逻辑
    ├── index-xxx.css      # 应用样式 + KaTeX 样式
    └── KaTeX_*            # KaTeX 数学字体文件
```

### 4.2 部署到任意静态服务器

将 `dist/` 目录下的**所有文件**部署到 Web 服务器的根目录或子路径。

**Nginx 示例：**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/ollama-web-ui/dist;
    index index.html;

    # 单页应用无需额外配置，纯静态文件
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**IIS 示例：**
1. 在 IIS 管理器中新建网站
2. 物理路径指向 `dist/` 目录
3. 应用程序池选择「无托管代码」
4. 添加 MIME 类型：`.woff2` → `font/woff2`

**PHPTS（PHP 简易服务器）示例：**
将 `dist/` 目录解压到 PHPTS 的 wwwroot 目录即可。

**VS Code Live Server 示例：**
1. 用 VS Code 打开 `dist/` 上级目录
2. 右键 `dist/index.html` → Open with Live Server

### 4.3 子路径部署

如果需要部署到子路径（如 `http://server/ollama-ui/`），修改 `vite.config.js`：

```js
export default defineConfig({
  base: '/ollama-ui/',
  plugins: [vue()],
  resolve: {
    alias: { '@': '/src' }
  }
})
```

然后重新构建：
```bash
npm run build
```

## 5. 部署到局域网

### 5.1 方法一：Vite 开发服务器（临时）

```bash
npx vite --host
```

在同一局域网的其他设备上，访问 `http://你的IP:5173`（如 `http://192.168.1.100:5173`）。

### 5.2 方法二：构建后部署到 Web 服务器

```bash
npm run build
# 将 dist/ 复制到 Web 服务器（如 IIS、Nginx、PHPTS、Apache 等）
```

### 5.3 注意事项

- **CORS**：浏览器访问远程 Ollama 服务时需要配置 CORS。参见[第 6.2 节](#62-cors-跨域配置)
- **HTTPS**：某些浏览器特性（如 Clipboard API）在非 HTTPS 环境下受限，局域网部署建议使用 HTTPS
- **防火墙**：确保 Web 服务器端口在防火墙中开放

## 6. Ollama 配置

### 6.1 基本配置

Ollama 默认监听 `localhost:11434`。可通过环境变量修改：

```bash
# Windows (CMD)
set OLLAMA_HOST=0.0.0.0:11434
ollama serve

# Windows (PowerShell)
$env:OLLAMA_HOST="0.0.0.0:11434"
ollama serve

# Linux / macOS
export OLLAMA_HOST=0.0.0.0:11434
ollama serve
```

### 6.2 CORS 跨域配置

从浏览器访问远程 Ollama 服务时，需要允许跨域请求：

```bash
# 允许所有来源（不推荐生产环境）
set OLLAMA_ORIGINS=*
ollama serve

# 仅允许特定来源
set OLLAMA_ORIGINS=http://192.168.1.100:5173,http://192.168.1.200:80
ollama serve
```

### 6.3 Ollama API 参考

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/tags` | GET | 获取可用模型列表 |
| `/api/generate` | POST | 生成回复（本 UI 使用的端点） |

请求体格式（由 UI 自动构建）：

```json
{
  "model": "模型名称",
  "prompt": "对话提示词",
  "stream": false,
  "options": {
    "temperature": 0.7,
    "num_predict": 2048,
    "num_ctx": 8192
  }
}
```

> 注意：所有生成参数必须嵌套在 `options` 对象中，而非顶层。

## 7. 常见问题

### 7.1 页面打开后无法加载模型列表

**排查步骤：**

1. 确认 Ollama 服务正在运行：`ollama list`
2. 确认服务地址可访问：浏览器访问 `http://你填写的地址/api/tags` 应返回 JSON
3. 检查浏览器控制台（F12 → Console）是否有报错
4. 如果是远程服务，检查 CORS 配置（见 [6.2 节](#62-cors-跨域配置)）

### 7.2 发送消息后提示「请求超时」

- 默认超时时间为 120 秒，大模型生成较慢时请耐心等待
- 检查网络连接
- 检查 Ollama 服务日志

### 7.3 页面完全白屏 / JS 错误

- 确认使用现代浏览器（Chrome 90+ / Firefox 90+ / Edge 90+）
- 清除浏览器缓存后刷新
- 检查浏览器控制台报错

### 7.4 KaTeX 公式显示不正常

- 公式需要用 `$...$`（行内）或 `$$...$$`（块级）包裹
- 如果公式包含特殊字符（如 `<`, `>`），确保前后有空格
- KaTeX 不支持所有 LaTeX 命令，不支持的会回退显示原始文本

### 7.5 代码块复制按钮不工作

- Clipboard API 要求 HTTPS 或 localhost
- 在 HTTP 环境下，使用 `document.execCommand('copy')` 回退方案
- Safari 浏览器对 Clipboard API 限制较严

### 7.6 生产构建后路由/资源 404

如果部署在子路径下，需要修改 `vite.config.js` 中的 `base` 配置（见 [4.3 节](#43-子路径部署)），然后重新构建。

## 8. 项目结构

```
Ollama-Web-UI/
├── index.html                  # Vite 入口 HTML
├── package.json                # 依赖和脚本
├── vite.config.js              # Vite 配置
├── dist/                       # 构建产物（部署此目录）
├── src/
│   ├── main.js                 # Vue 应用入口
│   ├── App.vue                 # 根组件
│   ├── constants.js            # 常量、日志工具
│   ├── assets/css/main.css     # 全局样式
│   ├── components/             # Vue 组件
│   │   ├── Sidebar.vue         # 侧栏（对话列表）
│   │   ├── ChatHeader.vue      # 头部 + 配置入口
│   │   ├── ConfigPanel.vue     # 配置面板
│   │   ├── ChatContainer.vue   # 消息展示容器
│   │   ├── MessageItem.vue     # 单条消息
│   │   ├── MessageInput.vue    # 输入框
│   │   └── ToastNotification.vue # 消息提示
│   ├── stores/
│   │   └── chat.js             # Pinia 状态管理
│   └── utils/
│       ├── markdown.js         # Markdown/KaTeX 渲染管线
│       ├── storage.js          # localStorage 封装
│       └── helpers.js          # 工具函数
├── Claude_Logs.md              # 操作日志
├── HELP.md                     # 本文件
├── LICENSE                     # 许可证
├── README.md                   # 项目说明
└── Update_Plans.md             # 优化计划
```

### npm 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（热更新） |
| `npm run build` | 生产构建，输出 `dist/` |
| `npm run preview` | 本地预览构建产物 |

### 关键依赖

| 包名 | 用途 |
|------|------|
| `vue` ^3.4 | UI 框架 |
| `pinia` ^2.1 | 状态管理 |
| `showdown` ^2.1 | Markdown → HTML 渲染 |
| `katex` ^0.16 | LaTeX 数学公式渲染 |
| `vite` ^5.2 | 构建工具 |
| `@vitejs/plugin-vue` | Vite Vue 3 插件 |
