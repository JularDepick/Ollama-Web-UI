<template>
  <button id="input-toggle-btn" @click="toggleInput" :aria-expanded="!store.inputCollapsed" aria-controls="message-input-area">
    {{ store.inputCollapsed ? '展开输入框' : '收起输入框' }}
  </button>
  <div class="input-container" :class="{ collapsed: store.inputCollapsed, 'drag-over': isDragOver }" id="message-input-area" role="region" aria-label="消息输入区域"
    @dragover.prevent="onDragOver" @dragleave="onDragLeave" @drop.prevent="onDrop">
    <div class="input-wrapper">
      <!-- F7: Quote preview bar -->
      <div v-if="store.quotedMessage" class="quote-preview-bar">
        <span class="quote-preview-role">{{ store.quotedMessage.role === 'user' ? '用户' : 'AI' }}</span>
        <span class="quote-preview-text">{{ store.quotedMessage.content.slice(0, 100) }}{{ store.quotedMessage.content.length > 100 ? '...' : '' }}</span>
        <button class="quote-preview-cancel" @click="store.clearQuotedMessage()" title="取消引用">×</button>
      </div>
      <div class="textarea-wrap">
        <textarea id="message-input" ref="textareaRef"
          v-model="inputText"
          :placeholder="placeholderText"
          :disabled="store.isWaitingModelReply && !store.isStreamingActive"
          @keydown="onKeydown"
          @input="onInput"
          spellcheck="false">
        </textarea>
        <!-- Quick action buttons -->
        <div v-if="inputText.length > 0 && !store.isWaitingModelReply" class="quick-actions">
          <button class="quick-action-btn" @click="clearInput" title="清空输入">✕</button>
        </div>
      </div>
      <button v-if="store.isWaitingModelReply" id="stop-button" @click="store.cancelGeneration()" title="停止生成" aria-label="停止生成">■</button>
      <button v-else id="send-button" :disabled="!canSend" @click="handleSend" aria-label="发送消息">➤</button>
    </div>
    <!-- Snippets panel -->
    <Transition name="snippets-slide">
      <div v-if="snippetsOpen" class="snippets-panel" ref="snippetsPanelRef">
        <div class="snippets-header">
          <span class="snippets-title">常用片段</span>
          <button v-if="inputText.trim()" class="snippets-save-btn" @click="handleSaveSnippet" title="保存当前输入为片段">+ 保存</button>
          <button class="snippets-close" @click="snippetsOpen = false">×</button>
        </div>
        <div class="snippets-list" v-if="store.snippets.length > 0">
          <div v-for="s in store.snippets" :key="s.id" class="snippet-item" @click="handleInsertSnippet(s)">
            <span class="snippet-name">{{ s.name }}</span>
            <span class="snippet-preview">{{ s.content.slice(0, 50) }}{{ s.content.length > 50 ? '...' : '' }}</span>
            <button class="snippet-delete" @click.stop="store.deleteSnippet(s.id)" title="删除片段">×</button>
          </div>
        </div>
        <div v-else class="snippets-empty">暂无保存的片段</div>
      </div>
    </Transition>
    <div class="input-footer">
      <div class="input-footer-left">
        <button class="snippets-toggle" @click="snippetsOpen = !snippetsOpen" :class="{ active: snippetsOpen }" title="常用片段">📌</button>
        <span class="input-hint">Enter 发送 | Shift+Enter 换行</span>
      </div>
      <div v-if="inputText.length > 0" class="input-stats" :class="{ warning: inputText.length > 2000, danger: inputText.length > 4000 }">
        <span class="input-char-count">{{ inputText.length }} 字</span>
        <span class="input-token-estimate">~{{ estimateTokens(inputText) }} tk</span>
        <span v-if="inputText.length > 2000" class="input-limit-warn">较长</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '@/stores/chat'

const store = useChatStore()
const inputText = ref('')
const textareaRef = ref(null)
const isDragOver = ref(false)
const snippetsOpen = ref(false)
const snippetsPanelRef = ref(null)
const canSend = computed(() => {
  return (store.isStreamingActive || !store.isWaitingModelReply) && inputText.value.trim().length > 0 && !!store.ollamaHost
})

const placeholderText = computed(() => {
  if (store.isWaitingModelReply) return '等待模型回复中...'
  if (!store.ollamaHost) return '请先配置 Ollama 地址...'
  if (!store.selectedModel) return '请先选择模型...'
  return '输入消息，Enter 发送...'
})

// Restore draft when conversation changes
watch(() => store.currentConversationId, (newId, oldId) => {
  // Save current draft before switching
  if (oldId && inputText.value.trim()) {
    store.saveDraft(oldId, inputText.value)
  }
  // Restore draft for new conversation
  if (newId) {
    const draft = store.getDraft(newId)
    inputText.value = draft
  }
})

// Save draft on input change (debounced internally)
let saveDraftTimer = null
function onInput() {
  autoResize()
  clearTimeout(saveDraftTimer)
  saveDraftTimer = setTimeout(() => {
    if (store.currentConversationId) {
      store.saveDraft(store.currentConversationId, inputText.value)
    }
  }, 500)
}

function onKeydown(e) {
  // Enter (or Ctrl+Enter) to send, Shift+Enter for newline
  if ((e.key === 'Enter' && !e.shiftKey) || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
    e.preventDefault()
    handleSend()
  }
}

function onDragOver(e) {
  isDragOver.value = true
}

function onDragLeave() {
  isDragOver.value = false
}

function onDrop(e) {
  isDragOver.value = false
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  const file = files[0]
  if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.json') || file.name.endsWith('.txt')) {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target.result
      if (inputText.value) {
        inputText.value += '\n\n'
      }
      inputText.value += `[文件: ${file.name}]\n${content}`
      autoResize()
      store.showToast('文件内容已添加到输入框', 'success')
    }
    reader.readAsText(file)
  } else {
    store.showToast('仅支持文本文件拖放', 'warning')
  }
}

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, window.innerHeight * 0.5) + 'px'
}

function handleSend() {
  if (!canSend.value) return
  if (!store.ollamaHost) {
    store.isTempTipShowing = true
    setTimeout(() => { store.isTempTipShowing = false }, 3000)
    return
  }
  const msg = inputText.value
  inputText.value = ''
  if (textareaRef.value) {
    textareaRef.value.style.height = '60px'
  }
  // Clear draft after sending
  store.clearDraft(store.currentConversationId)
  store.sendMessage(msg)
}

function toggleInput() {
  store.inputCollapsed = !store.inputCollapsed
}

function clearInput() {
  inputText.value = ''
  if (textareaRef.value) {
    textareaRef.value.style.height = '60px'
  }
  store.clearDraft(store.currentConversationId)
}

function handleInsertSnippet(snippet) {
  const content = store.insertSnippet(snippet.id)
  if (content) {
    if (inputText.value) {
      inputText.value += '\n'
    }
    inputText.value += content
    autoResize()
    snippetsOpen.value = false
  }
}

function handleSaveSnippet() {
  const text = inputText.value.trim()
  if (!text) return
  const name = text.slice(0, 30).replace(/\n/g, ' ')
  store.saveSnippet(name, text)
}

// Close snippets panel on outside click
function onDocClick(e) {
  if (snippetsOpen.value && snippetsPanelRef.value && !snippetsPanelRef.value.contains(e.target) && !e.target.closest('.snippets-toggle')) {
    snippetsOpen.value = false
  }
}

// Estimate token count (rough: ~1.5 chars per token for Chinese, ~4 for English)
function estimateTokens(text) {
  if (!text) return 0
  const chineseChars = (text.match(/[一-鿿]/g) || []).length
  const otherChars = text.length - chineseChars
  return Math.ceil(chineseChars * 0.7 + otherChars / 4)
}

// Restore draft on mount
onMounted(() => {
  if (store.currentConversationId) {
    const draft = store.getDraft(store.currentConversationId)
    if (draft) {
      inputText.value = draft
    }
  }
  document.addEventListener('click', onDocClick)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
})
</script>

<style scoped>
.textarea-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
}

#message-input {
  width: 100%;
  padding: 14px 18px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-main) var(--radius-main) 4px var(--radius-main);
  font-size: 15px;
  outline: none;
  resize: none;
  height: 60px;
  min-height: 60px;
  max-height: 50vh;
  overflow-y: auto;
  background: var(--input-bg);
  color: var(--text-main);
  transition: border-color 0.2s, box-shadow 0.2s;
  line-height: 1.5;
}

#message-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.1);
  background: var(--bg-white);
}

/* F7: Quote preview bar */
.quote-preview-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  margin-bottom: 6px;
  background: var(--primary-light);
  border: 1px solid var(--primary-color);
  border-radius: var(--radius-sm);
  font-size: 13px;
  animation: quoteSlideIn 0.2s ease-out;
}

.quote-preview-role {
  font-weight: 600;
  color: var(--primary-color);
  font-size: 12px;
  white-space: nowrap;
  flex-shrink: 0;
}

.quote-preview-text {
  flex: 1;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quote-preview-cancel {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--text-light);
  padding: 0 4px;
  line-height: 1;
  flex-shrink: 0;
}

.quote-preview-cancel:hover {
  color: var(--text-danger);
}

@keyframes quoteSlideIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Input footer with hint and stats */
.input-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.input-stats {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--text-light);
  transition: color 0.2s;
}

.input-stats.warning {
  color: var(--warning-color, #f5a623);
}

.input-stats.danger {
  color: var(--text-danger);
}

.input-char-count {
  color: inherit;
}

.input-token-estimate {
  color: inherit;
  font-weight: 500;
}

.input-limit-warn {
  font-size: 11px;
  padding: 0 4px;
  background: currentColor;
  color: var(--bg-white);
  border-radius: 2px;
  opacity: 0.8;
}

/* Quick action buttons */
.quick-actions {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
}

.quick-action-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: var(--bg-gray);
  color: var(--text-light);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  padding: 0;
}

.quick-action-btn:hover {
  background: var(--border-color);
  color: var(--text-secondary);
}

/* Drag and drop */
.input-container.drag-over {
  border: 2px dashed var(--primary-color);
  background: var(--primary-light);
}

.input-container.drag-over #message-input {
  border-color: var(--primary-color);
}

/* Snippets */
.snippets-toggle {
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.15s;
  opacity: 0.6;
}

.snippets-toggle:hover,
.snippets-toggle.active {
  opacity: 1;
  background: var(--primary-light);
}

.snippets-panel {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  max-height: 240px;
  background: var(--bg-white);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-main) var(--radius-main) 0 0;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  z-index: 20;
  overflow: hidden;
}

.snippets-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.snippets-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}

.snippets-save-btn {
  padding: 2px 10px;
  font-size: 12px;
  background: var(--primary-light);
  color: var(--primary-color);
  border: 1px solid var(--primary-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.snippets-save-btn:hover {
  background: var(--primary-color);
  color: #fff;
}

.snippets-close {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: var(--text-light);
  padding: 0 4px;
}

.snippets-close:hover {
  color: var(--text-danger);
}

.snippets-list {
  overflow-y: auto;
  flex: 1;
}

.snippet-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.1s;
  border-bottom: 1px solid var(--border-light);
}

.snippet-item:hover {
  background: var(--primary-light);
}

.snippet-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-main);
  white-space: nowrap;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.snippet-preview {
  flex: 1;
  font-size: 12px;
  color: var(--text-light);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snippet-delete {
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  color: var(--text-light);
  padding: 0 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.snippet-item:hover .snippet-delete {
  opacity: 1;
}

.snippet-delete:hover {
  color: var(--text-danger);
}

.snippets-empty {
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: var(--text-light);
}

/* Snippets panel transition */
.snippets-slide-enter-active {
  animation: snippetsIn 0.2s ease-out;
}

.snippets-slide-leave-active {
  animation: snippetsOut 0.15s ease-in;
}

@keyframes snippetsIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes snippetsOut {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(8px); }
}

/* Input footer left section */
.input-footer-left {
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
