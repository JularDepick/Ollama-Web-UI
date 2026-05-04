<template>
  <div class="input-container" ref="inputContainerRef">
    <button id="input-toggle-btn" class="inner-btn" @click="toggleInput">
      {{ store.inputCollapsed ? '展开输入框' : '收起输入框' }}
    </button>
    <div class="input-wrapper">
      <textarea id="message-input" ref="textareaRef"
        v-model="inputText"
        :placeholder="store.isWaitingModelReply ? '等待模型回复中...' : '输入消息(Enter发送，Shift+Enter换行)...'"
        :disabled="store.isWaitingModelReply"
        @keydown="onKeydown"
        @input="autoResize"
        spellcheck="false">
      </textarea>
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
const inputContainerRef = ref(null)

const canSend = computed(() => {
  return !store.isWaitingModelReply && inputText.value.trim().length > 0 && !!store.ollamaHost
})

function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = '56px'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
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
    textareaRef.value.style.height = '56px'
  }
  store.sendMessage(msg)
}

function toggleInput() {
  store.inputCollapsed = !store.inputCollapsed
}
</script>
