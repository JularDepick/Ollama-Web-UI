<template>
  <div class="chat-wrapper">
    <div class="chat-container" id="chat-container" ref="containerRef" @scroll="onScroll">
      <template v-if="visibleMessages.length === 0 && !store.isWaitingModelReply">
        <div class="empty-state">
          <div class="empty-state-icon">💬</div>
          <div class="empty-state-title">开始新的对话</div>
          <div class="empty-state-hint">在下方的输入框中输入消息开始聊天<br>Enter 发送，Shift+Enter 换行</div>
        </div>
      </template>
      <template v-for="(msg, idx) in visibleMessages" :key="msg.id">
        <div v-if="shouldShowTimeSeparator(msg, idx)" class="time-separator">
          <span>{{ formatTime(msg.sendTime) }}</span>
        </div>
        <MessageItem :msg="msg" :isConsecutive="isConsecutive(msg, idx)" />
      </template>
      <div v-if="store.isWaitingModelReply && !streamingContentVisible" class="loading">
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
    <button v-if="showScrollDownBtn" class="scroll-down-btn" @click="forceScrollToBottom">↓</button>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, computed, onMounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import { formatTime } from '@/utils/helpers'
import MessageItem from './MessageItem.vue'

const store = useChatStore()
const containerRef = ref(null)
const thinkSeconds = ref(0)
const showScrollDownBtn = ref(false)
let thinkTimer = null

const streamingContentVisible = computed(() => {
  const msgs = store.currentMessages
  return msgs.length > 0 && msgs[msgs.length - 1].content.length > 0
})

const visibleMessages = computed(() => {
  const msgs = store.currentMessages
  if (store.isWaitingModelReply && msgs.length > 0) {
    const last = msgs[msgs.length - 1]
    if (last.role === 'assistant' && !last.content) {
      return msgs.slice(0, -1)
    }
  }
  return msgs
})

function onScroll() {
  checkScrollPosition()
}

function checkScrollPosition() {
  const el = containerRef.value
  if (!el) return
  const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  showScrollDownBtn.value = distFromBottom > 100
}

function scrollToBottom() {
  if (store.streamAutoScroll && containerRef.value) {
    containerRef.value.scrollTop = containerRef.value.scrollHeight
  }
}

function forceScrollToBottom() {
  const el = containerRef.value
  if (!el) return
  showScrollDownBtn.value = false
  const start = el.scrollTop
  const end = el.scrollHeight - el.clientHeight
  if (end <= start) return
  const duration = 500
  const startTime = performance.now()
  function scroll(t) {
    const p = Math.min((t - startTime) / duration, 1)
    const ease = 1 - Math.pow(1 - p, 3)
    el.scrollTop = start + (end - start) * ease
    if (p < 1) requestAnimationFrame(scroll)
  }
  requestAnimationFrame(scroll)
}

// Auto scroll during model reply (new content / typewriter)
watch(() => {
  const msgs = visibleMessages.value
  if (!msgs.length) return 0
  return msgs.length + '-' + msgs[msgs.length - 1].content.length
}, async () => {
  await nextTick()
  if (store.isWaitingModelReply) {
    scrollToBottom()
  }
})

watch(() => store.scrollTrigger, async () => {
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

function shouldShowTimeSeparator(msg, idx) {
  if (idx === 0) return true
  const prev = visibleMessages[idx - 1]
  if (!prev || !prev.sendTime || !msg.sendTime) return false
  return msg.sendTime - prev.sendTime > 300000
}

function isConsecutive(msg, idx) {
  if (idx === 0) return false
  const prev = visibleMessages[idx - 1]
  if (!prev) return false
  return prev.role === msg.role && (msg.sendTime - prev.sendTime) < 300000
}

onMounted(async () => {
  await nextTick()
  if (containerRef.value) {
    containerRef.value.scrollTop = containerRef.value.scrollHeight
  }
  checkScrollPosition()
})
</script>
