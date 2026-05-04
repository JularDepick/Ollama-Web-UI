// ============================================================
// Ollama-Web-UI — Main Application Logic
// ============================================================

// ---- Constants ----
const DEBUG_MODE = true;
const LOG_STYLES = {
    USER: 'color:#0099ff;font-weight:bold;',
    MODEL: 'color:#00cc66;font-weight:bold;',
    DATA: 'color:#9933ff;font-weight:bold;',
    SENSITIVE: 'color:#ffcc00;font-weight:bold;',
    ERROR: 'color:#ff3333;font-weight:bold;'
};
const LOG_PREFIX = {
    USER: '[用户操作] ',
    MODEL: '[模型交互] ',
    DATA: '[数据变更] ',
    SENSITIVE: '[敏感操作] ',
    ERROR: '[捕获错误] '
};
const CONST_CONFIG = {
    MODEL_LIST_TIMEOUT: 15000,
    MSG_REPLY_TIMEOUT: 120000,
    STREAM_SPEED_MAP: [0, 16, 32, 64, 128],
    STREAM_TEXT_MAP: ['关闭流式', '16字/秒', '32字/秒', '64字/秒', '128字/秒'],
    CONTEXT_LENGTH_MAP: [4096, 8192, 16384, 32768, 65536, 131072, 262144],
    CONTEXT_LENGTH_TEXT_MAP: ['4k', '8k', '16k', '32k', '64k', '128k', '256k'],
    STREAM_AUTO_SCROLL_TEXT: ['已关闭', '已开启']
};
const STORAGE_KEYS = {
    conversations: 'Ollama-Web-UI-Conversations',
    lastActiveChat: 'Ollama-Web-UI-LastActiveChat',
    selectedModel: 'Ollama-Web-UI-Config-SelectedModel',
    ollamaHost: 'Ollama-Web-UI-Config-OllamaHost',
    streamSpeed: 'Ollama-Web-UI-Config-StreamSpeed',
    contextLength: 'Ollama-Web-UI-Config-ContextLength',
    streamAutoScroll: 'Ollama-Web-UI-Config-StreamAutoScroll'
};
const DEFAULT_CONFIG = {
    ollamaHost: '',
    selectedModel: '',
    streamSpeed: 1,
    streamAutoScroll: 0,
    contextLength: 1
};

// ---- State ----
let isWaitingModelReply = false;
let isTempTipShowing = false;
let conversationSearchTerm = '';
let currentConversationId = '';
let currentModel = '';
let conversations = {};
let OLLAMA_HOST = '';
let lastActiveConvId = '';
let streamSpeed = DEFAULT_CONFIG.streamSpeed;
let contextLength = DEFAULT_CONFIG.contextLength;
let streamAutoScroll = DEFAULT_CONFIG.streamAutoScroll;
let thinkTimerMap = new Map();
let currentStreamingDom = null;
let scrollLockHandler = null;
let inputIsCollapsed = false;

// ---- DOM Cache ----
const sidebar = document.querySelector('.sidebar');
const sidebarToggleInner = document.getElementById('sidebar-toggle-inner');
const sidebarToggleOuter = document.getElementById('sidebar-toggle-outer');
const conversationsList = document.getElementById('conversations-list');
const newChatBtn = document.querySelector('.sidebar-btn.new-btn');
const currentConfigEl = document.getElementById('current-config');
const chatContainer = document.getElementById('chat-container');
const configSelectorToggle = document.querySelector('.config-selector-toggle');
const configSelector = document.getElementById('config-selector');
const ollamaHostInput = document.getElementById('ollama-host-input');
const modelSelect = document.getElementById('model-select');
const streamSpeedSlider = document.getElementById('stream-speed-slider');
const streamSpeedText = document.getElementById('stream-speed-text');
const streamAutoScrollSwitch = document.getElementById('stream-auto-scroll');
const streamAutoScrollText = document.getElementById('stream-auto-scroll-text');
const contextLengthSlider = document.getElementById('context-length-slider');
const contextLengthText = document.getElementById('context-length-text');
const inputContainer = document.getElementById('input-container');
const inputToggleBtn = document.getElementById('input-toggle-btn');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const hostErrorTip = document.getElementById('host-error-tip');
const storageCollapseHeader = document.getElementById('storage-collapse-header');
const storageCollapseBody = document.getElementById('storage-collapse-body');
const clearConfigBtn = document.getElementById('clear-config-btn');
const clearAllBtn = document.getElementById('clear-all-btn');
const chatTempTip = document.getElementById('chat-temp-tip');

// ---- Logger ----
const log = (type, msg) => DEBUG_MODE && console.log(`%c${LOG_PREFIX[type]}${msg}`, LOG_STYLES[type]);
const userLog = (msg) => log('USER', msg);
const modelLog = (msg) => log('MODEL', msg);
const dataLog = (msg) => log('DATA', msg);
const sensitiveLog = (msg) => log('SENSITIVE', msg);
const errorLog = (msg) => log('ERROR', msg);

// ---- HTML Escaping (XSS protection) ----
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return text.replace(/[&<>"']/g, function (m) { return map[m]; });
}

// ============================================================
// Markdown Rendering
// ============================================================

let mdConverter = null;

function initMarkdownConverter() {
    if (typeof showdown === 'undefined') return false;
    if (mdConverter) return true;
    mdConverter = new showdown.Converter({
        tables: true,
        tasklists: true,
        strikethrough: true,
        emoji: true,
        simplifiedAutoLink: true,
        simpleLineBreaks: true,
        excludeTrailingPunctuationFromURLs: true,
        literalMidWordUnderscores: true,
        openLinksInNewWindow: true,
        backslashEscapesHTMLTags: true,
        ghCodeBlocks: true,
        ghCompatibleHeaderId: true,
        encodeEmails: true
    });
    return true;
}

function renderMarkdown(text) {
    if (typeof text !== 'string') return '';
    const escaped = escapeHtml(text);
    let html;
    try {
        if (initMarkdownConverter()) {
            html = mdConverter.makeHtml(escaped);
        } else {
            return escaped.replace(/\n/g, '<br>');
        }
    } catch (e) {
        errorLog('Markdown渲染失败: ' + e.message);
        return escaped.replace(/\n/g, '<br>');
    }
    html = secureLinks(html);
    html = sanitizeHtml(html);
    html = enhanceCodeBlocks(html);
    if (window.katex && (text.includes('$$') || text.includes('$'))) {
        html = renderLatex(html);
    }
    return html;
}

function secureLinks(html) {
    return html
        .replace(/<a\s+(?![^>]*rel=)/gi, '<a rel="noopener noreferrer" ')
        .replace(/<a\s/g, '<a target="_blank" ');
}

function sanitizeHtml(html) {
    return html
        .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/href\s*=\s*["']javascript:/gi, 'href="#blocked"');
}

function enhanceCodeBlocks(html) {
    return html
        .replace(/<pre><code class="([^"]*)">/g, (match, langClass) => {
            const lang = langClass.replace(/^language-/, '') || '';
            return '<pre class="code-block" data-lang="' + lang + '"><button class="copy-code-btn" data-code-block="">复制</button><code class="' + langClass + '">';
        })
        .replace(/<pre><code>/g, '<pre class="code-block" data-lang=""><button class="copy-code-btn" data-code-block="">复制</button><code>');
}

function renderLatex(html) {
    html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, expr) => {
        try { return katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false }); }
        catch (e) { return match; }
    });
    html = html.replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (match, expr) => {
        try { return katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false }); }
        catch (e) { return match; }
    });
    return html;
}

// ============================================================
// Toast Notification System
// ============================================================

let toastTimer = null;

function showToast(msg, type = 'info', duration = 2500) {
    const existing = document.querySelector('.toast-notification');
    if (existing) {
        existing.remove();
        if (toastTimer) clearTimeout(toastTimer);
    }
    const toast = document.createElement('div');
    toast.className = 'toast-notification toast-' + type;
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
        toastTimer = null;
    }, duration);
}

// ---- Utility Functions ----
const generateConversationId = () => 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);

const formatTime = (time) => new Date(time).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
});

const getConversationTitle = (conv) => {
    if (!conv || !conv.messages.length) return '新对话';
    const firstUserMsg = conv.messages.find(m => m.role === 'user');
    return firstUserMsg ? firstUserMsg.content.slice(0, 20) + (firstUserMsg.content.length > 20 ? '...' : '') : '新对话';
};

const clearTempPinned = () => {
    document.querySelectorAll('.conversation-item.temp-pinned').forEach(el => el.classList.remove('temp-pinned'));
};

const formatSeconds = (s) => s <= 0 ? '0秒' : `${s}秒`;

const resetAllDeleteButtons = () => {
    document.querySelectorAll('.delete-item, .conversation-action-btn.delete-btn').forEach(btn => {
        btn.classList.remove('confirm-delete');
        btn.textContent = btn.classList.contains('conversation-action-btn') ? '删除对话' : '删除';
    });
};

const mergeContinuousNewlines = (str) => str.replace(/\n+/g, '\n').trim();

const alignMsgToInputTop = () => { chatContainer.scrollTop = chatContainer.scrollHeight; };

// ---- UI: Scroll Lock ----
const lockChatScroll = () => {
    if (scrollLockHandler) return;
    scrollLockHandler = () => { chatContainer.scrollTop = chatContainer.scrollHeight; };
    chatContainer.addEventListener('scroll', scrollLockHandler);
};

const unlockChatScroll = () => {
    if (scrollLockHandler) {
        chatContainer.removeEventListener('scroll', scrollLockHandler);
        scrollLockHandler = null;
    }
};

// ---- UI: Sidebar ----
const toggleSidebar = () => {
    sidebar.classList.toggle('collapsed');
};

const toggleInputContainer = () => {
    inputIsCollapsed = !inputIsCollapsed;
    if (inputIsCollapsed) {
        inputContainer.classList.add('collapsed');
        inputToggleBtn.classList.remove('inner-btn');
        inputToggleBtn.classList.add('fixed-btn');
        inputToggleBtn.textContent = '展开输入框';
        document.body.appendChild(inputToggleBtn);
    } else {
        inputContainer.classList.remove('collapsed');
        inputToggleBtn.classList.remove('fixed-btn');
        inputToggleBtn.classList.add('inner-btn');
        inputToggleBtn.textContent = '收起输入框';
        inputContainer.prepend(inputToggleBtn);
    }
};

// ---- UI: Collapse all panels ----
const collapseAllPanels = () => {
    sidebar.classList.add('collapsed');
    configSelector.classList.remove('open');
    document.querySelectorAll('.msg-more-menu.show').forEach(menu => menu.classList.remove('show'));
    document.querySelectorAll('.conversation-actions.show').forEach(menu => menu.classList.remove('show'));
    resetAllDeleteButtons();
};

// ---- UI: Config Info Bar ----
const updateConfigInfo = () => {
    const conv = currentConversationId ? conversations[currentConversationId] : null;
    const convTitle = conv ? (conv.title || getConversationTitle(conv)) : '新对话';
    const modelName = currentModel || '未选择模型';
    currentConfigEl.textContent = `${modelName} | ${convTitle}`;
};

// ---- UI: Conversation Name Dedup ----
const getAvailableConversationName = (baseName) => {
    const pureName = baseName.trim().slice(0, 8) || '新对话';
    const allNames = Object.values(conversations || {}).map(conv => conv.title);
    let newName = pureName;
    let n = 1;
    while (allNames.includes(newName)) { newName = `${pureName}${n}`; n++; }
    return newName;
};

// ============================================================
// Data Layer
// ============================================================

const saveConversations = () => {
    try {
        localStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify(conversations));
        if (currentConversationId) {
            localStorage.setItem(STORAGE_KEYS.lastActiveChat, currentConversationId);
        }
    } catch (e) {
        errorLog('保存对话失败: ' + e.message);
    }
};

const loadFromStorage = () => {
    try {
        const convStr = localStorage.getItem(STORAGE_KEYS.conversations);
        if (convStr) {
            conversations = JSON.parse(convStr);
            // Fix B1: ensure message IDs are populated
            Object.keys(conversations).forEach(id => {
                const conv = conversations[id];
                if (!conv.hasOwnProperty('pinned')) conv.pinned = false;
                if (conv.messages) {
                    conv.messages = conv.messages.map(m => ({
                        id: m.id || Date.now() + Math.random().toString(36).substr(2, 8),
                        role: m.role,
                        content: m.content,
                        sendTime: m.sendTime || Date.now(),
                        thinkDuration: m.thinkDuration || 0
                    }));
                }
            });
            const pinnedConvs = Object.values(conversations).filter(c => c.pinned).sort((a, b) => b.updateTime - a.updateTime);
            const normalIds = Object.keys(conversations).filter(id => !conversations[id].pinned).sort((a, b) => b - a);
            const allIds = [...pinnedConvs.map(c => c.id), ...normalIds];
            const defaultId = allIds.length > 0 ? allIds[0] : '';
            const lastActiveId = localStorage.getItem(STORAGE_KEYS.lastActiveChat);
            currentConversationId = (lastActiveId && conversations[lastActiveId]) ? lastActiveId : defaultId;
            lastActiveConvId = currentConversationId;
        } else {
            initNewConversation();
        }
    } catch (e) {
        errorLog('加载存储异常: ' + e.message);
        conversations = {};
        initNewConversation();
    }

    currentModel = localStorage.getItem(STORAGE_KEYS.selectedModel) || DEFAULT_CONFIG.selectedModel;
    OLLAMA_HOST = localStorage.getItem(STORAGE_KEYS.ollamaHost) || DEFAULT_CONFIG.ollamaHost;
    streamSpeed = parseInt(localStorage.getItem(STORAGE_KEYS.streamSpeed)) || DEFAULT_CONFIG.streamSpeed;
    streamSpeed = streamSpeed < 0 || streamSpeed > 4 ? DEFAULT_CONFIG.streamSpeed : streamSpeed;
    contextLength = parseInt(localStorage.getItem(STORAGE_KEYS.contextLength)) || DEFAULT_CONFIG.contextLength;
    contextLength = contextLength < 0 || contextLength > 6 ? DEFAULT_CONFIG.contextLength : contextLength;
    streamAutoScroll = parseInt(localStorage.getItem(STORAGE_KEYS.streamAutoScroll)) || DEFAULT_CONFIG.streamAutoScroll;

    ollamaHostInput.value = OLLAMA_HOST;
    streamSpeedSlider.value = streamSpeed;
    streamSpeedText.textContent = CONST_CONFIG.STREAM_TEXT_MAP[streamSpeed];
    streamAutoScrollSwitch.checked = streamAutoScroll === 1;
    streamAutoScrollText.textContent = CONST_CONFIG.STREAM_AUTO_SCROLL_TEXT[streamAutoScroll];
    contextLengthSlider.value = contextLength;
    contextLengthText.textContent = CONST_CONFIG.CONTEXT_LENGTH_TEXT_MAP[contextLength];
};

const initNewConversation = () => {
    const newName = getAvailableConversationName('新对话');
    const newId = generateConversationId();
    conversations[newId] = {
        id: newId, title: newName, model: '',
        createTime: Date.now(), updateTime: Date.now(),
        messages: [], pinned: false
    };
    currentConversationId = newId;
    lastActiveConvId = newId;
    saveConversations();
};

// ---- Config Save Helpers ----
const saveStreamSpeed = (val) => {
    streamSpeed = val;
    localStorage.setItem(STORAGE_KEYS.streamSpeed, val);
    streamSpeedText.textContent = CONST_CONFIG.STREAM_TEXT_MAP[val];
    if (currentStreamingDom) {
        completeStreamMessage(currentStreamingDom, currentStreamingDom.dataset.fullContent);
    }
};

const saveContextLength = (val) => {
    contextLength = val;
    localStorage.setItem(STORAGE_KEYS.contextLength, val);
    contextLengthText.textContent = CONST_CONFIG.CONTEXT_LENGTH_TEXT_MAP[val];
};

const saveStreamAutoScroll = (val) => {
    streamAutoScroll = val ? 1 : 0;
    localStorage.setItem(STORAGE_KEYS.streamAutoScroll, streamAutoScroll);
    streamAutoScrollText.textContent = CONST_CONFIG.STREAM_AUTO_SCROLL_TEXT[streamAutoScroll];
};

const saveSelectedModel = (model) => {
    currentModel = model;
    localStorage.setItem(STORAGE_KEYS.selectedModel, model);
    if (currentConversationId) {
        conversations[currentConversationId].model = model;
        saveConversations();
    }
    updateConfigInfo();
};

// ============================================================
// Ollama Host Validation
// ============================================================

const checkHostValid = (host) => new Promise(resolve => {
    try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), CONST_CONFIG.MODEL_LIST_TIMEOUT);
        fetch(`${host}/api/tags`, { method: 'GET', signal: controller.signal })
            .then(res => resolve(res.ok))
            .catch(() => resolve(false));
    } catch (e) {
        resolve(false);
    }
});

const saveOllamaHost = async () => {
    const oldHost = OLLAMA_HOST;
    const newHost = ollamaHostInput.value.trim();
    hostErrorTip.classList.remove('show');

    if (!newHost) {
        ollamaHostInput.value = oldHost;
        return;
    }

    const urlReg = /^https?:\/\/.+$/;
    if (!urlReg.test(newHost)) {
        hostErrorTip.textContent = '格式无效，请输入 http/https 开头的合法 URL';
        hostErrorTip.classList.add('show');
        return;
    }

    try {
        const isValid = await checkHostValid(newHost);
        if (isValid) {
            OLLAMA_HOST = newHost;
            localStorage.setItem(STORAGE_KEYS.ollamaHost, newHost);
            await loadModelList();
        } else {
            hostErrorTip.textContent = '地址连通失败，请检查地址是否正确';
            hostErrorTip.classList.add('show');
        }
    } catch (e) {
        hostErrorTip.textContent = '校验异常: ' + e.message;
        hostErrorTip.classList.add('show');
    }
};

// ============================================================
// Model List
// ============================================================

const loadModelList = async () => {
    if (!OLLAMA_HOST) return;
    try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), CONST_CONFIG.MODEL_LIST_TIMEOUT);
        const res = await fetch(`${OLLAMA_HOST}/api/tags`, { method: 'GET', signal: controller.signal });
        if (!res.ok) throw new Error(`接口异常: ${res.status} ${res.statusText}`);
        const resData = await res.json();
        const models = resData.models || [];
        modelSelect.innerHTML = '';
        if (models.length === 0) {
            modelSelect.innerHTML = '<option value="">暂无可用模型</option>';
            updateConfigInfo();
            return;
        }
        // Fix B6: ensure models is an array before iterating
        if (Array.isArray(models)) {
            models.forEach(md => {
                const opt = document.createElement('option');
                opt.value = md.name;
                opt.textContent = md.name;
                modelSelect.appendChild(opt);
            });
        }
        if (currentModel && models.some(md => md.name === currentModel)) {
            // keep current
        } else if (models.length > 0) {
            currentModel = models[0].name;
        }
        saveSelectedModel(currentModel);
        modelSelect.value = currentModel;
        updateConfigInfo();
    } catch (e) {
        modelSelect.innerHTML = '<option value="">加载失败</option>';
        updateConfigInfo();
        errorLog('模型加载失败: ' + e.message);
    }
};

// ============================================================
// Chat: System Messages
// ============================================================

const showSystemMessage = (content, actions = null) => {
    const dom = document.createElement('div');
    dom.className = 'message system-message';
    dom.dataset.system = 'true';
    let actionHtml = '';
    if (actions && Array.isArray(actions)) {
        actionHtml = '<div class="system-actions">';
        actions.forEach(act => {
            actionHtml += `<button class="system-action-btn ${act.type || ''}" data-action="${act.key}">${escapeHtml(act.text)}</button>`;
        });
        actionHtml += '</div>';
    }
    dom.innerHTML = `<div class="message-avatar">💡</div><div class="message-wrapper"><div class="message-content">${escapeHtml(content)}${actionHtml}</div><div class="msg-controls"><span class="message-time">${formatTime(Date.now())}</span></div></div>`;
    chatContainer.appendChild(dom);
    if (actions && Array.isArray(actions)) {
        actions.forEach(act => {
            if (act.callback) {
                dom.querySelector(`[data-action="${act.key}"]`)
                    .addEventListener('click', () => { act.callback(); dom.remove(); });
            }
        });
    }
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return dom;
};

const clearSystemMessages = () => {
    document.querySelectorAll('.message.system-message').forEach(el => el.remove());
};

// ============================================================
// Chat: Streaming
// ============================================================

const completeStreamMessage = (dom, fullContent) => {
    if (!dom) return;
    const timerId = dom.dataset.timerId;
    if (timerId) cancelAnimationFrame(timerId);
    dom.querySelector('.message-content').innerHTML = renderMarkdown(fullContent);
    dom.dataset.streaming = 'false';
    unlockChatScroll();
    if (currentStreamingDom === dom) currentStreamingDom = null;
    if (streamAutoScroll === 1) chatContainer.scrollTop = chatContainer.scrollHeight;
    updateStreamButtonStatus();
};

const splitContentByChar = (content) => {
    const result = [];
    let word = '';
    for (let ch of content) {
        if (/[\u4e00-\u9fa5，。！？；：""''（）【】、·]/.test(ch)) {
            if (word) { result.push(word); word = ''; }
            result.push(ch);
        } else if (/^\s$/.test(ch)) {
            if (word) { result.push(word); word = ''; }
            result.push(ch);
        } else {
            word += ch;
        }
    }
    if (word) result.push(word);
    return result;
};

const resetStreamMessage = (dom, fullContent, startIdx = 0) => {
    if (!dom || streamSpeed === 0) return;
    if (currentStreamingDom && currentStreamingDom !== dom) {
        completeStreamMessage(currentStreamingDom, currentStreamingDom.dataset.fullContent);
    }
    alignMsgToInputTop();
    if (streamAutoScroll === 1) lockChatScroll();
    const oldTimer = dom.dataset.timerId;
    if (oldTimer) cancelAnimationFrame(oldTimer);
    const speed = CONST_CONFIG.STREAM_SPEED_MAP[streamSpeed];
    const interval = 1000 / speed;
    const charList = splitContentByChar(fullContent);
    let currentIdx = startIdx;
    const startTime = performance.now();

    function streamFrame(timestamp) {
        const expected = Math.floor((timestamp - startTime) / interval);
        const targetIdx = Math.min(expected, charList.length);
        if (currentIdx < targetIdx) {
            currentIdx = targetIdx;
            const showContent = charList.slice(0, currentIdx).join('');
            dom.querySelector('.message-content').innerHTML = escapeHtml(showContent).replace(/\n/g, '<br>');
            dom.dataset.currentIndex = currentIdx;
        }
        if (currentIdx >= charList.length) {
            dom.dataset.streaming = 'false';
            unlockChatScroll();
            currentStreamingDom = null;
            if (streamAutoScroll === 1) chatContainer.scrollTop = chatContainer.scrollHeight;
            updateStreamButtonStatus();
            return;
        }
        dom.dataset.timerId = requestAnimationFrame(streamFrame);
    }

    dom.dataset.timerId = requestAnimationFrame(streamFrame);
    dom.dataset.streaming = 'true';
    currentStreamingDom = dom;
    updateStreamButtonStatus();
};

const streamShowMessage = (content, dom, isStream = true) => new Promise(resolve => {
    const fmtContent = content.replace(/\s{2,}/g, ' ');
    dom.dataset.fullContent = fmtContent;
    dom.dataset.currentIndex = 0;
    dom.dataset.streaming = 'false';
    if (!isStream || streamSpeed === 0 || !content) {
        completeStreamMessage(dom, fmtContent);
    } else {
        resetStreamMessage(dom, fmtContent, 0);
    }
    resolve();
});

// ---- Stream Button ----
const updateStreamButtonStatus = () => {
    document.querySelectorAll('.stream-btn').forEach(btn => btn.remove());
    const allAiMessages = document.querySelectorAll('.ai-message');
    if (allAiMessages.length === 0) return;
    const lastAiMsg = allAiMessages[allAiMessages.length - 1];
    const isStreaming = lastAiMsg.dataset.streaming === 'true';
    const msgCtrl = lastAiMsg.querySelector('.msg-controls');
    if (!msgCtrl) return;
    const streamBtn = document.createElement('button');
    streamBtn.className = 'copy-btn stream-btn';
    streamBtn.textContent = isStreaming ? '跳过流式输出' : '体验流式输出';
    streamBtn.onclick = () => {
        if (isWaitingModelReply) return;
        if (isStreaming) {
            completeStreamMessage(lastAiMsg, lastAiMsg.dataset.fullContent);
        } else {
            resetStreamMessage(lastAiMsg, lastAiMsg.dataset.fullContent, 0);
        }
    };
    msgCtrl.insertBefore(streamBtn, msgCtrl.children[1]);
};

// ---- Think Timer ----
const startThinkTimer = (dom) => {
    let sec = 0;
    const timeDom = dom.querySelector('.think-time');
    const timer = setInterval(() => { sec++; timeDom.textContent = `思考时长: ${formatSeconds(sec)}`; }, 1000);
    thinkTimerMap.set(dom, timer);
    return timer;
};

const stopThinkTimer = (dom) => {
    const timer = thinkTimerMap.get(dom);
    if (timer) clearInterval(timer);
    thinkTimerMap.delete(dom);
};

// ============================================================
// Chat: Message Actions
// ============================================================

const copyMessageContent = (msgId) => {
    try {
        const conv = conversations[currentConversationId];
        if (!conv || !conv.messages) return;
        const msg = conv.messages.find(t => t.id === msgId);
        if (msg) navigator.clipboard.writeText(msg.content);
    } catch (e) {
        errorLog('复制失败: ' + e.message);
    }
};

const toggleDeleteConfirm = (e, msgId) => {
    e.stopPropagation();
    const btn = e.target.closest('.delete-item');
    if (!btn) return;
    if (btn.classList.contains('confirm-delete')) {
        deleteSingleMessage(msgId);
        resetAllDeleteButtons();
    } else {
        resetAllDeleteButtons();
        btn.classList.add('confirm-delete');
        btn.textContent = '确认删除';
    }
};

const deleteSingleMessage = (msgId) => {
    const conv = conversations[currentConversationId];
    if (!conv || !conv.messages) return;
    const idx = conv.messages.findIndex(t => t.id === msgId);
    if (idx !== -1) {
        conv.messages.splice(idx, 1);
        conv.updateTime = Date.now();
        saveConversations();
        renderCurrentConversation();
    }
};

// ============================================================
// Conversation: List Rendering
// ============================================================

const renderConversationsList = () => {
    conversationsList.innerHTML = '';
    const allConvs = Object.values(conversations);
    const filteredIds = Object.keys(conversations).filter(id => {
        if (!conversationSearchTerm) return true;
        const conv = conversations[id];
        const title = (conv.title || getConversationTitle(conv)).toLowerCase();
        return title.includes(conversationSearchTerm.toLowerCase());
    });
    const pinnedConvs = allConvs.filter(c => c.pinned && filteredIds.includes(c.id)).sort((a, b) => b.updateTime - a.updateTime);
    const normalIds = filteredIds.filter(id => !conversations[id].pinned).sort((a, b) => b - a);
    const allIds = [...pinnedConvs.map(c => c.id), ...normalIds];
    if (allIds.length === 0) {
        if (conversationSearchTerm) {
            const emptyDom = document.createElement('div');
            emptyDom.className = 'conversation-item';
            emptyDom.textContent = '无匹配对话';
            conversationsList.appendChild(emptyDom);
        } else {
            const emptyDom = document.createElement('div');
            emptyDom.className = 'empty-state';
            emptyDom.innerHTML = '<div class="empty-state-icon">💬</div><div class="empty-state-title">开始对话</div><div class="empty-state-hint">点击右下角 + 新建对话<br>或配置 Ollama 地址后直接发送消息</div>';
            conversationsList.appendChild(emptyDom);
        }
        return;
    }
    allIds.forEach(id => {
        const conv = conversations[id];
        const itemDom = document.createElement('div');
        itemDom.className = `conversation-item ${id === currentConversationId ? 'active' : ''} ${conv.pinned ? 'pinned' : ''} ${id === lastActiveConvId && !conv.pinned ? 'temp-pinned' : ''}`;
        itemDom.dataset.id = id;

        const infoDom = document.createElement('div');
        infoDom.className = 'conversation-info';
        const titleInput = document.createElement('input');
        titleInput.className = 'conversation-title';
        titleInput.value = conv.title || getConversationTitle(conv);
        titleInput.addEventListener('blur', () => {
            if (!titleInput.classList.contains('editable')) return;
            const newTitle = getAvailableConversationName(titleInput.value.trim());
            if (newTitle && newTitle !== conv.title) {
                conversations[id].title = newTitle;
                saveConversations();
                if (id === currentConversationId) updateConfigInfo();
            }
            titleInput.classList.remove('editable');
        });
        titleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { titleInput.blur(); e.stopPropagation(); }
        });
        const timeDom = document.createElement('div');
        timeDom.className = 'conversation-time';
        timeDom.textContent = formatTime(conv.updateTime);
        infoDom.appendChild(titleInput);
        infoDom.appendChild(timeDom);

        const moreBtn = document.createElement('button');
        moreBtn.className = 'conversation-more';
        moreBtn.innerHTML = '⋮';
        const actionDom = document.createElement('div');
        actionDom.className = 'conversation-actions';

        moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.conversation-actions').forEach(d => {
                if (d !== actionDom) d.classList.remove('show');
            });
            actionDom.classList.toggle('show');
        });
        actionDom.addEventListener('click', e => e.stopPropagation());

        const pinBtn = document.createElement('button');
        pinBtn.className = 'conversation-action-btn pin-btn';
        pinBtn.textContent = conv.pinned ? '取消置顶' : '置顶';
        pinBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            conversations[id].pinned = !conversations[id].pinned;
            saveConversations();
            renderConversationsList();
            moreBtn.click();
        });

        const renameBtn = document.createElement('button');
        renameBtn.className = 'conversation-action-btn rename-btn';
        renameBtn.textContent = '重命名';
        renameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            titleInput.classList.add('editable');
            titleInput.focus();
            titleInput.select();
            moreBtn.click();
        });

        const delBtn = document.createElement('button');
        delBtn.className = 'conversation-action-btn delete-btn';
        delBtn.textContent = '删除对话';
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (delBtn.classList.contains('confirm-delete')) {
                delete conversations[id];
                saveConversations();
                // Fix B2: handle empty conversations after delete
                const remainingIds = Object.keys(conversations);
                if (remainingIds.length > 0) {
                    currentConversationId = remainingIds[0];
                } else {
                    currentConversationId = '';
                    initNewConversation();
                }
                lastActiveConvId = currentConversationId;
                renderConversationsList();
                renderCurrentConversation();
                updateConfigInfo();
                moreBtn.click();
                resetAllDeleteButtons();
            } else {
                resetAllDeleteButtons();
                delBtn.classList.add('confirm-delete');
                delBtn.textContent = '确认删除';
            }
        });

        actionDom.appendChild(pinBtn);
        actionDom.appendChild(renameBtn);
        actionDom.appendChild(delBtn);
        itemDom.appendChild(infoDom);
        itemDom.appendChild(moreBtn);
        itemDom.appendChild(actionDom);
        conversationsList.appendChild(itemDom);
    });
};

// ============================================================
// Conversation: Current Rendering
// ============================================================

const renderCurrentConversation = () => {
    chatContainer.innerHTML = '';
    chatTempTip.classList.remove('show');
    isTempTipShowing = false;
    if (!currentConversationId || !conversations[currentConversationId] || !conversations[currentConversationId].messages) return;
    const messages = conversations[currentConversationId].messages;
    // Batch mount: use DocumentFragment to minimize reflows
    const fragment = document.createDocumentFragment();
    messages.forEach((msg) => addMessageToUI(msg, true, fragment));
    chatContainer.appendChild(fragment);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    updateStreamButtonStatus();
};

// ============================================================
// Chat: Add Message to UI
// ============================================================

const addMessageToUI = (msg, isHistory = false, parentEl = null) => {
    const { id, role, content, sendTime, thinkDuration } = msg;
    const isUser = role === 'user';
    if (isUser && (content.includes('loading-state') || !content)) return;

    const msgDom = document.createElement('div');
    msgDom.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
    msgDom.dataset.msgId = id;

    const thinkHtml = !isUser && thinkDuration > 0
        ? `<span class="think-duration">思考时长: ${formatSeconds(thinkDuration)}</span>` : '';

    // No inline onclick — handled by event delegation
    msgDom.innerHTML =
        `<div class="message-avatar">${isUser ? '我' : 'AI'}</div>` +
        `<div class="message-wrapper">` +
        `<div class="message-content"></div>` +
        `<div class="msg-controls">` +
        `<button class="copy-btn" data-msg-id="${id}">复制</button>` +
        `<div class="msg-more-wrapper">` +
        `<button class="msg-more-btn" data-msg-id="${id}">⋮</button>` +
        `<ul class="msg-more-menu">` +
        `<li class="delete-item" data-msg-id="${id}">删除</li>` +
        `</ul></div>` +
        `${thinkHtml}` +
        `<span class="message-time">${formatTime(sendTime)}</span>` +
        `</div></div>`;

    if (parentEl) {
        parentEl.appendChild(msgDom);
    } else {
        chatContainer.appendChild(msgDom);
    }

    const contentEl = msgDom.querySelector('.message-content');
    if (!isUser) {
        streamShowMessage(content.replace(/\s{2,}/g, ' '), msgDom, !isHistory);
    } else {
        contentEl.innerHTML = renderMarkdown(content);
    }
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return msgDom;
};

// ============================================================
// Chat: Context Building
// ============================================================

const buildContextPrompt = (newMsg) => {
    const conv = currentConversationId ? conversations[currentConversationId] : null;
    if (!conv || !conv.messages) return newMsg;
    let prompt = '以下是对话历史，请基于历史回答最新问题：\n\n';
    conv.messages.forEach(m => {
        if (m.role) prompt += `${m.role === 'user' ? '用户' : 'AI'}：${m.content}\n`;
    });
    prompt += `用户：${newMsg}\nAI：`;
    return prompt;
};

// ============================================================
// Chat: Send Message
// ============================================================

const createNewConversationWithName = (baseTitle) => {
    const newName = getAvailableConversationName(baseTitle);
    const newId = generateConversationId();
    conversations[newId] = {
        id: newId, title: newName, model: currentModel,
        createTime: Date.now(), updateTime: Date.now(),
        messages: [], pinned: false
    };
    clearTempPinned();
    lastActiveConvId = newId;
    currentConversationId = newId;
    saveConversations();
    renderConversationsList();
    renderCurrentConversation();
    updateConfigInfo();
    messageInput.focus();
    return newId;
};

const sendMessageToOllama = async (msgContent) => {
    const isConvListEmpty = Object.keys(conversations).length === 0;
    const isNoSelectedConv = !currentConversationId || !conversations[currentConversationId];
    if (isConvListEmpty || isNoSelectedConv) {
        createNewConversationWithName('新对话');
    }

    if (!OLLAMA_HOST || !/^https?:\/\/.+$/.test(OLLAMA_HOST)) {
        showToast('服务地址为空或无效', 'warning');
        if (!isTempTipShowing) {
            isTempTipShowing = true;
            chatTempTip.classList.add('show');
            setTimeout(() => { chatTempTip.classList.remove('show'); isTempTipShowing = false; }, 3000);
        }
        return;
    }
    if (!currentModel) { showToast('请先选择模型', 'warning'); return; }

    if (currentStreamingDom) {
        completeStreamMessage(currentStreamingDom, currentStreamingDom.dataset.fullContent);
    }

    const msg = mergeContinuousNewlines(msgContent);
    if (!msg) { sendButton.disabled = false; return; }

    isWaitingModelReply = true;
    sendButton.disabled = true;
    const sendStartTime = Date.now();

    const userMsg = {
        id: Date.now() + Math.random().toString(36).slice(-6),
        role: 'user', content: msg, sendTime: Date.now(), thinkDuration: 0
    };
    addMessageToUI(userMsg);
    conversations[currentConversationId].messages.push(userMsg);
    saveConversations();

    const loadingDom = addMessageToUI({
        id: 'loading-' + Date.now(), role: 'assistant',
        content: '', sendTime: Date.now(), thinkDuration: 0
    });
    loadingDom.className = 'loading';
    loadingDom.innerHTML =
        `<div class="message-avatar">AI</div>` +
        `<div class="loading-content">` +
        `<div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div>` +
        `<span>思考中...</span><span class="think-time">思考时长: 0秒</span></div>`;
    startThinkTimer(loadingDom);

    try {
        const prompt = buildContextPrompt(msg);
        const reqBody = {
            model: currentModel, prompt: prompt,
            stream: false,
            options: {
                temperature: 0.7,
                num_predict: 2048,
                num_ctx: CONST_CONFIG.CONTEXT_LENGTH_MAP[contextLength]
            }
        };
        const controller = new AbortController();
        setTimeout(() => controller.abort(), CONST_CONFIG.MSG_REPLY_TIMEOUT);

        const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqBody),
            signal: controller.signal
        });
        const endTime = Date.now();
        const thinkDuration = Math.floor((endTime - sendStartTime) / 1000);
        stopThinkTimer(loadingDom);
        loadingDom.remove();

        if (!res.ok) throw new Error(`请求失败: ${res.status} ${res.statusText}`);
        const resData = await res.json();
        const aiReply = resData.response || '';

        const aiMsg = {
            id: Date.now() + Math.random().toString(36).slice(-6),
            role: 'assistant', content: aiReply,
            sendTime: Date.now(), thinkDuration: thinkDuration
        };
        addMessageToUI(aiMsg);
        conversations[currentConversationId].messages.push(aiMsg);
        conversations[currentConversationId].updateTime = Date.now();
        saveConversations();
        renderConversationsList();
        renderCurrentConversation();
        updateConfigInfo();
        updateStreamButtonStatus();
    } catch (e) {
        stopThinkTimer(loadingDom);
        loadingDom.remove();
        errorLog('发送失败: ' + e.message);
        showToast('发送失败: ' + e.message, 'error', 4000);
    } finally {
        isWaitingModelReply = false;
        sendButton.disabled = false;
        messageInput.focus();
    }
};

// ============================================================
// Event Delegation (replaces inline onclick)
// ============================================================

// Chat Container Delegation
chatContainer.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.copy-btn[data-msg-id]');
    if (copyBtn) {
        e.stopPropagation();
        copyMessageContent(copyBtn.dataset.msgId);
        return;
    }
    const moreBtn = e.target.closest('.msg-more-btn');
    if (moreBtn) {
        e.stopPropagation();
        resetAllDeleteButtons();
        const menu = moreBtn.nextElementSibling;
        if (menu) menu.classList.toggle('show');
        return;
    }
    const codeCopyBtn = e.target.closest('.copy-code-btn');
    if (codeCopyBtn) {
        e.stopPropagation();
        const code = codeCopyBtn.nextElementSibling;
        if (code) {
            const text = code.textContent || code.innerText;
            navigator.clipboard.writeText(text).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            });
        }
        return;
    }
    const delItem = e.target.closest('.delete-item');
    if (delItem) {
        toggleDeleteConfirm(e, delItem.dataset.msgId);
        return;
    }
    if (e.target.closest('.msg-more-menu')) {
        e.stopPropagation();
        return;
    }
    const convItem = e.target.closest('.conversation-item');
    if (convItem && !e.target.closest('.conversation-more') && !e.target.closest('.conversation-actions')) {
        const id = convItem.dataset.id;
        if (id && conversations[id]) {
            clearTempPinned();
            lastActiveConvId = id;
            currentConversationId = id;
            renderConversationsList();
            renderCurrentConversation();
            currentModel = conversations[id].model || currentModel;
            saveSelectedModel(currentModel);
            updateConfigInfo();
            clearSystemMessages();
            sidebar.classList.add('collapsed');
        }
        return;
    }
});

// Panel collapse on non-interactive area
chatContainer.addEventListener('click', collapseAllPanels);
inputContainer.addEventListener('click', collapseAllPanels);

// Global document click
document.addEventListener('click', (e) => {
    const openMenus = document.querySelectorAll('.msg-more-menu.show, .conversation-actions.show');
    openMenus.forEach(menu => {
        if (!menu.contains(e.target) && !e.target.closest('.msg-more-wrapper, .conversation-more')) {
            menu.classList.remove('show');
        }
    });
    const sidebarOpen = !sidebar.classList.contains('collapsed');
    const clickInSidebar = sidebar.contains(e.target);
    const clickToggle = sidebarToggleOuter.contains(e.target) || sidebarToggleInner.contains(e.target);
    if (sidebarOpen && !clickInSidebar && !clickToggle) {
        sidebar.classList.add('collapsed');
    }
});

// ============================================================
// Event Listeners (DOM bindings)
// ============================================================

sidebarToggleOuter.addEventListener('click', toggleSidebar);
sidebarToggleInner.addEventListener('click', toggleSidebar);
inputToggleBtn.addEventListener('click', toggleInputContainer);

ollamaHostInput.addEventListener('blur', saveOllamaHost);
ollamaHostInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveOllamaHost();
});

modelSelect.addEventListener('change', () => saveSelectedModel(modelSelect.value));

streamSpeedSlider.addEventListener('input', () => saveStreamSpeed(parseInt(streamSpeedSlider.value)));
contextLengthSlider.addEventListener('input', () => saveContextLength(parseInt(contextLengthSlider.value)));
streamAutoScrollSwitch.addEventListener('change', () => saveStreamAutoScroll(streamAutoScrollSwitch.checked));

configSelectorToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = configSelector.classList.contains('open');
    configSelector.classList.toggle('open');
    if (!isOpen) {
        storageCollapseHeader.classList.remove('expanded');
        storageCollapseBody.classList.remove('expanded');
        const currentInputVal = ollamaHostInput.value.trim();
        if (currentInputVal !== OLLAMA_HOST) {
            ollamaHostInput.value = OLLAMA_HOST;
            hostErrorTip.classList.remove('show');
        }
    }
});

messageInput.addEventListener('input', () => {
    if (messageInput.value.trim() === '') {
        messageInput.style.height = '56px';
    } else {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
    }
});
messageInput.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' && !e.shiftKey) || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        const msg = messageInput.value.trim();
        if (msg) {
            messageInput.value = '';
            messageInput.style.height = '56px';
            sendMessageToOllama(msg);
        }
    } else if (e.key === 'Enter' && e.shiftKey) {
        setTimeout(() => {
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
        }, 0);
    }
});

sendButton.addEventListener('click', () => {
    const msg = messageInput.value.trim();
    if (msg) {
        messageInput.value = '';
        messageInput.style.height = '56px';
        sendMessageToOllama(msg);
    }
});

newChatBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    createNewConversationWithName('新对话');
});

storageCollapseHeader.addEventListener('click', () => {
    storageCollapseHeader.classList.toggle('expanded');
    storageCollapseBody.classList.toggle('expanded');
});

clearConfigBtn.addEventListener('click', () => {
    const configKeys = [
        STORAGE_KEYS.selectedModel, STORAGE_KEYS.ollamaHost,
        STORAGE_KEYS.streamSpeed, STORAGE_KEYS.contextLength,
        STORAGE_KEYS.streamAutoScroll
    ];
    configKeys.forEach(key => localStorage.removeItem(key));
    loadFromStorage();
    showToast('配置已清除，恢复默认值', 'success');
});

clearAllBtn.addEventListener('click', () => {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    conversations = {};
    currentConversationId = '';
    loadFromStorage();
    renderConversationsList();
    renderCurrentConversation();
    showToast('所有数据已清除，初始化新会话', 'success');
});

// ============================================================
// Keyboard Shortcuts
// ============================================================

document.addEventListener('keydown', (e) => {
    // Ctrl+N: new conversation
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        createNewConversationWithName('新对话');
        return;
    }
    // Ctrl+L: clear current conversation (with confirmation via second press)
    if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        const conv = currentConversationId ? conversations[currentConversationId] : null;
        if (conv && conv.messages && conv.messages.length > 0) {
            conv.messages = [];
            conv.updateTime = Date.now();
            saveConversations();
            renderCurrentConversation();
            updateConfigInfo();
        }
        return;
    }
    // Esc: close all panels
    if (e.key === 'Escape') {
        collapseAllPanels();
        if (configSelector.classList.contains('open')) configSelector.classList.remove('open');
        return;
    }
});

// ============================================================
// Page Cleanup
// ============================================================

window.addEventListener('beforeunload', () => {
    // Clear all streaming timers
    thinkTimerMap.forEach(timer => clearInterval(timer));
    thinkTimerMap.clear();
    if (currentStreamingDom && currentStreamingDom.dataset.timerId) {
        cancelAnimationFrame(parseInt(currentStreamingDom.dataset.timerId));
    }
    if (scrollLockHandler) {
        chatContainer.removeEventListener('scroll', scrollLockHandler);
    }
});

// ============================================================
// Initialization
// ============================================================

window.addEventListener('load', async () => {
    loadFromStorage();
    renderConversationsList();
    renderCurrentConversation();
    updateConfigInfo();
    await loadModelList();
    messageInput.focus();
    // Add sidebar search
    const searchWrap = document.createElement('div');
    searchWrap.className = 'sidebar-search';
    const searchInput = document.createElement('input');
    searchInput.className = 'sidebar-search-input';
    searchInput.type = 'text';
    searchInput.placeholder = '搜索对话...';
    searchInput.addEventListener('input', () => {
        conversationSearchTerm = searchInput.value.trim();
        renderConversationsList();
    });
    searchWrap.appendChild(searchInput);
    sidebar.insertBefore(searchWrap, conversationsList);
    // Add shortcut hint
    const hint = document.createElement('div');
    hint.className = 'input-hint';
    hint.textContent = 'Enter 发送 · Shift+Enter 换行 · Ctrl+N 新建 · Ctrl+L 清屏 · Esc 关闭';
    inputContainer.appendChild(hint);
});
