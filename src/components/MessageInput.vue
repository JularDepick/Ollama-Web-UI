<template>
  <button id="input-toggle-btn" @click="toggleInput">
    {{ store.inputCollapsed ? '展开输入框' : '收起输入框' }}
  </button>
  <div class="input-container" :class="{ collapsed: store.inputCollapsed }">
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
          :placeholder="store.isWaitingModelReply ? '等待模型回复中...' : '输入消息(Enter发送，Shift+Enter换行)...'"
          :disabled="store.isWaitingModelReply && !store.isStreamingActive"
          @keydown="onKeydown"
          spellcheck="false">
        </textarea>
      </div>
      <button id="send-button" :disabled="!canSend" @click="handleSend">➤</button>
    </div>
    <div class="input-hint">Enter 发送 | Shift+Enter 换行</div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useChatStore } from '@/stores/chat'

const store = useChatStore()
const inputText = ref('')
const textareaRef = ref(null)
const canSend = computed(() => {
  return (store.isStreamingActive || !store.isWaitingModelReply) && inputText.value.trim().length > 0 && !!store.ollamaHost
})

function onKeydown(e) {
  // Enter (or Ctrl+Enter) to send, Shift+Enter for newline
  if ((e.key === 'Enter' && !e.shiftKey) || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
    e.preventDefault()
    handleSend()
  }
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
  store.sendMessage(msg)
}

function toggleInput() {
  store.inputCollapsed = !store.inputCollapsed
}
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
  resize: vertical;
  background: var(--input-bg);
  color: var(--text-main);
  transition: border-color 0.2s, box-shadow 0.2s;
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
</style>
