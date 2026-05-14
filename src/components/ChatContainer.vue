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
      <!-- U9: Messages with mount animation (CSS fires on element creation) -->
      <template v-for="(msg, idx) in visibleMessages" :key="msg.id">
        <div v-if="shouldShowTimeSeparator(msg, idx)" class="time-separator">
          <span>{{ formatTime(msg.sendTime) }}</span>
        </div>
        <MessageItem :msg="msg" :isConsecutive="isConsecutive(msg, idx)" />
      </template>
      <!-- U7: Skeleton with fade transition -->
      <Transition name="skeleton-fade">
        <div v-if="store.isWaitingModelReply && !streamingContentVisible" class="skeleton-loading" key="skeleton">
          <div class="skeleton-message">
            <div class="skeleton-avatar skeleton-shimmer"></div>
            <div class="skeleton-bubble">
              <div class="skeleton-line skeleton-shimmer" :style="{ width: '85%' }"></div>
              <div class="skeleton-line skeleton-shimmer" :style="{ width: '60%' }"></div>
            </div>
          </div>
          <div class="skeleton-footer">
            <div class="skeleton-dot"></div>
            <div class="skeleton-dot"></div>
            <div class="skeleton-dot"></div>
            <span class="skeleton-think-text">思考中...</span>
            <span class="think-time">思考时长: {{ thinkSeconds }}秒</span>
          </div>
        </div>
      </Transition>
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

<style scoped>
/* ===== U7: Skeleton fade transition ===== */
.skeleton-fade-enter-active {
  animation: skeletonFadeIn 0.25s ease-out;
}

.skeleton-fade-leave-active {
  animation: skeletonFadeOut 0.2s ease-out;
}

@keyframes skeletonFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes skeletonFadeOut {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-8px);
  }
}

/* ===== Skeleton Screen ===== */
.skeleton-loading {
  margin-bottom: 20px;
  max-width: 75%;
  animation: skeletonFadeIn 0.3s ease-out;
}

.skeleton-message {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
}

.skeleton-bubble {
  width: auto;
  max-width: 100%;
  min-width: 200px;
  background: var(--msg-ai-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-main);
  border-top-left-radius: 4px;
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.skeleton-line {
  height: 14px;
  border-radius: 4px;
}

/* Shimmer effect keyframes */
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    var(--bg-gray) 25%,
    var(--border-color) 50%,
    var(--bg-gray) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

/* Footer: dots + text */
.skeleton-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0 4px 52px;
}

.skeleton-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary-color);
  animation: skeletonDot 1.4s infinite ease-in-out both;
}

.skeleton-dot:nth-child(1) {
  animation-delay: -0.32s;
}
.skeleton-dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes skeletonDot {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.skeleton-think-text {
  font-size: 14px;
  color: var(--text-secondary);
  margin-left: 2px;
}

.think-time {
  font-size: 12px;
  color: var(--text-secondary);
}


</style>
