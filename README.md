# Ollama-Web-UI
由豆包AI、Trae提供代码生成，我提供修正提示词，为本地Ollama客户端适配的网页版交互UI。依赖Ollama客户端的局域网端口API，实现与Ollama部署的本地模型或Ollama云模型进行带上下文的交互。

---

## 使用流程(基础版)
1. 访问Ollama官网 https://ollama.com/ 下载Ollama客户端并安装
<img width="50%" height="auto" alt="image" src="https://github.com/user-attachments/assets/a0f9f9e0-28d2-4ac4-a96e-7e327354cb17" />

2. 注册Ollama官网个人账号
3. 启动Ollama客户端，登录账号，测试模型可用性
4. 下载本仓库Release包，解压到合适目录后，使用浏览器打开 index.html 文件
5. 点击页面右上角的配置选项，配置正确的Ollama服务地址，回车加载
<img width="50%" height="auto" alt="image" src="https://github.com/user-attachments/assets/3384a199-a3a5-4b9b-80ba-ef612e2f6a7c" />

6. 开始使用

---

## 相关教程
### 部署到Windows的热点局域网
1. 下载Web服务器软件如PHPTS或使用Windows系统原生的IIS服务，自行配置网站人口到本地已下载的Ollama-Web-UI的Release解压后的目录
2. 在已连接Windows本机热点的其他设备上尝试通过 Windows局域网IP地址:Web服务器监听端口 访问Ollama-Web-UI页面
<img width="" height="500px" alt="image" src="https://github.com/user-attachments/assets/9f018f85-5aec-498c-801c-25cf01e2b1c0" />
3. 正常使用
---

## 相关问题及解决方案
### 如何自定义Ollama服务地址
  - 创建环境变量 OLLAMA_HOST=你自定义的地址(带端口号) 后重启Ollama服务或客户端
  - 如果需要允许外部直接访问Ollama服务地址，还需要创建环境变量 OLLAMA_ORIGINS=*
