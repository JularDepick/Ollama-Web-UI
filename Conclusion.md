# Ollama-Web-UI

## 概述

纯前端单页 HTML 应用，为本地 Ollama LLM 提供 Web 聊天界面。零构建工具、零框架、无后端服务，浏览器直接打开即可使用。

## 技术栈

- 纯原生 HTML + CSS + JavaScript（全部内联于 `index.html`）
- 第三方库（`lib/`）：jQuery、showdown、KaTeX（均未在主逻辑中使用，预留）
- 数据持久化：浏览器 `localStorage`
- 接入 Ollama HTTP API（`/api/tags`、`/api/generate`）

## 架构

单一入口 `index.html`（约 720 行），包含全部 HTML 结构、样式和逻辑。`include/main.js` 为空文件，计划后续拆分但尚未完成。

## 核心功能

- **对话管理**：创建、重命名、置顶、删除对话，侧边栏展示历史列表
- **消息交互**：通过 Ollama API 发送 prompt 并获取回复，支持上下文构建与截断
- **客户端流式模拟**：API 使用 `stream: false`，前端逐字渲染实现打字机效果，可调节速度
- **配置面板**：Ollama 地址校验、模型选择、流式速度、上下文长度、自动滚动、存储管理
- **快捷键**：Enter 发送 / Shift+Enter 换行
- **两段式删除**：点击一次确认，再点执行，防误操作

## 数据模型

| localStorage Key | 内容 |
|---|---|
| `Ollama-Web-UI-Conversations` | 全部对话（含消息、角色、时间戳、置顶状态） |
| `Ollama-Web-UI-LastActiveChat` | 当前活跃对话 ID |
| `Ollama-Web-UI-Config-*` | 各项配置（模型、地址、速度等） |

## 项目特点

- 无任何依赖安装，打开即用
- 全中文界面
- 纯客户端，数据完全在本地
- 适合本地 LLM 调试与日常对话
