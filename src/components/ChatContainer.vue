<template>
  <div class="chat-container" id="chat-container" ref="containerRef">
    <template v-if="store.currentMessages.length === 0 && !store.isWaitingModelReply">
      <div class="empty-state">
        <div class="empty-state-icon">💬</div>
        <div class="empty-state-title">开始新的对话</div>
        <div class="empty-state-hint">在下方的输入框中输入消息开始聊天<br>Enter 发送，Shift+Enter 换行</div>
      </div>
    </template>
    <template v-for="(msg, idx) in store.currentMessages" :key="msg.id">
      <div v-if="shouldShowTimeSeparator(msg, idx)" class="time-separator">
        <span>{{ formatTime(msg.sendTime) }}</span>
      </div>
      <MessageItem :msg="msg" :isConsecutive="isConsecutive(msg, idx)" />
    </template>
    <div v-if="store.isWaitingModelReply" class="loading">
      <div class="message-avatar">AI</div>
      <div class="loading-content">
        <div class="loading-dot"></div>
        <div class="loading-dot"></div>
        <div class="loading-dot"></div>
        <span>思考中...</span>
        <span class="think-time">思考时长: {{ thinkSeconds }}秒</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, computed } from 'vue'
import { useChatStore } from '@/stores/chat'
import { formatTime } from '@/utils/helpers'
import MessageItem from './MessageItem.vue'

const store = useChatStore()
const containerRef = ref(null)
const thinkSeconds = ref(0)
let thinkTimer = null

// Auto scroll on new messages
watch(() => store.currentMessages.length, async () => {
  await nextTick()
  scrollToBottom()
})

watch(() => store.isWaitingModelReply, (val) => {
  if (val) {
    thinkSeconds.value = 0
    thinkTimer = setInterval(() => { thinkSeconds.value++ }, 1000)
    nextTick(() => scrollToBottom())
  } else {
    if (thinkTimer) { clearInterval(thinkTimer); thinkTimer = null }
  }
})

function scrollToBottom() {
  if (store.streamAutoScroll && containerRef.value) {
    containerRef.value.scrollTop = containerRef.value.scrollHeight
  }
}

function shouldShowTimeSeparator(msg, idx) {
  if (idx === 0) return true
  const prev = store.currentMessages[idx - 1]
  if (!prev || !prev.sendTime || !msg.sendTime) return false
  return msg.sendTime - prev.sendTime > 300000 // 5 min
}

function isConsecutive(msg, idx) {
  if (idx === 0) return false
  const prev = store.currentMessages[idx - 1]
  if (!prev) return false
  return prev.role === msg.role && (msg.sendTime - prev.sendTime) < 300000
}
</script>
