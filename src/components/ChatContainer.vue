<template>
  <div class="chat-wrapper">
    <div class="chat-container" id="chat-container" ref="containerRef" @scroll="onScroll" role="log" aria-label="对话记录" aria-live="polite" :class="{ 'switching': isSwitching }">
      <template v-if="visibleMessages.length === 0 && !store.isWaitingModelReply">
        <div class="empty-state">
          <div class="empty-state-icon">💬</div>
          <div class="empty-state-title">开始新的对话</div>
          <div class="empty-state-hint">在下方的输入框中输入消息开始聊天</div>
          <div class="empty-state-tips">
            <div class="tip-item">
              <span class="tip-icon">⌨️</span>
              <span class="tip-text"><kbd>Enter</kbd> 发送，<kbd>Shift+Enter</kbd> 换行</span>
            </div>
            <div class="tip-item">
              <span class="tip-icon">💡</span>
              <span class="tip-text">试试问一些问题，如"解释量子计算"</span>
            </div>
            <div class="tip-item">
              <span class="tip-icon">🔧</span>
              <span class="tip-text">按 <kbd>Ctrl+,</kbd> 打开配置面板</span>
            </div>
            <div class="tip-item">
              <span class="tip-icon">❓</span>
              <span class="tip-text">按 <kbd>Ctrl+Shift+/</kbd> 查看所有快捷键</span>
            </div>
          </div>
        </div>
      </template>
      <!-- Load more messages button -->
      <div v-if="hasMoreMessages" class="load-more-container">
        <button class="load-more-btn" @click="loadMoreMessages">
          加载更早的消息 ({{ store.currentMessages.length - displayCount }} 条)
        </button>
      </div>
      <!-- U9: Messages with mount animation (CSS fires on element creation) -->
      <template v-for="(msg, idx) in visibleMessages" :key="msg.id">
        <div v-if="shouldShowTimeSeparator(msg, idx)" class="time-separator">
          <span>{{ formatFullTime(msg.sendTime) }}</span>
        </div>
        <MessageItem :msg="msg" :isConsecutive="isConsecutive(msg, idx)" />
      </template>
      <!-- U7: Skeleton with fade transition -->
      <Transition name="skeleton-fade">
        <div v-if="store.isWaitingModelReply && !streamingContentVisible" class="skeleton-loading" key="skeleton" role="status" aria-label="AI 正在思考">
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
    <!-- In-conversation search bar -->
    <Transition name="search-bar-slide">
      <div v-if="store.inChatSearchOpen" class="in-chat-search-bar">
        <input type="text" class="in-chat-search-input" v-model="store.inChatSearchQuery"
          placeholder="搜索当前对话..." @keydown="onSearchKeydown" ref="searchInputRef" spellcheck="false">
        <span class="in-chat-search-count" v-if="store.inChatSearchQuery">
          {{ store.inChatSearchTotal > 0 ? (store.inChatSearchIndex + 1) + '/' + store.inChatSearchTotal : '无匹配' }}
        </span>
        <button class="in-chat-search-nav" @click="store.prevInChatSearchResult()" :disabled="!store.inChatSearchTotal" title="上一个">▲</button>
        <button class="in-chat-search-nav" @click="store.nextInChatSearchResult()" :disabled="!store.inChatSearchTotal" title="下一个">▼</button>
        <button class="in-chat-search-close" @click="store.toggleInChatSearch()" title="关闭搜索">×</button>
      </div>
    </Transition>
    <button v-if="showScrollUpBtn" class="scroll-up-btn" @click="forceScrollToTop" aria-label="滚动到顶部">↑</button>
    <button v-if="showScrollDownBtn" class="scroll-down-btn" @click="forceScrollToBottom" aria-label="滚动到底部">↓</button>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, computed, onMounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import { formatTime, formatFullTime } from '@/utils/helpers'
import MessageItem from './MessageItem.vue'

const store = useChatStore()
const containerRef = ref(null)
const searchInputRef = ref(null)
const thinkSeconds = ref(0)
const showScrollDownBtn = ref(false)
const showScrollUpBtn = ref(false)
const isSwitching = ref(false)
let thinkTimer = null

// Message pagination
const MESSAGE_PAGE_SIZE = 50
const displayCount = ref(MESSAGE_PAGE_SIZE)

// Smooth transition when switching conversations
watch(() => store.currentConversationId, () => {
  isSwitching.value = true
  showScrollDownBtn.value = false
  showScrollUpBtn.value = false
  displayCount.value = MESSAGE_PAGE_SIZE
  setTimeout(() => {
    isSwitching.value = false
  }, 150)
})

const streamingContentVisible = computed(() => {
  const msgs = store.currentMessages
  return msgs.length > 0 && msgs[msgs.length - 1].content.length > 0
})

const hasMoreMessages = computed(() => {
  return store.currentMessages.length > displayCount.value
})

const visibleMessages = computed(() => {
  let msgs = store.currentMessages
  if (store.isWaitingModelReply && msgs.length > 0) {
    const last = msgs[msgs.length - 1]
    if (last.role === 'assistant' && !last.content && !last.error) {
      msgs = msgs.slice(0, -1)
    }
  }
  // Show only the last N messages
  if (msgs.length > displayCount.value) {
    return msgs.slice(msgs.length - displayCount.value)
  }
  return msgs
})

function loadMoreMessages() {
  displayCount.value += MESSAGE_PAGE_SIZE
}

function onScroll() {
  checkScrollPosition()
}

function checkScrollPosition() {
  const el = containerRef.value
  if (!el) return
  const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  showScrollDownBtn.value = distFromBottom > 100
  showScrollUpBtn.value = el.scrollTop > 200
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

function forceScrollToTop() {
  const el = containerRef.value
  if (!el) return
  showScrollUpBtn.value = false
  const start = el.scrollTop
  if (start <= 0) return
  const duration = 500
  const startTime = performance.now()
  function scroll(t) {
    const p = Math.min((t - startTime) / duration, 1)
    const ease = 1 - Math.pow(1 - p, 3)
    el.scrollTop = start * (1 - ease)
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

function onSearchKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault()
    if (e.shiftKey) {
      store.prevInChatSearchResult()
    } else {
      store.nextInChatSearchResult()
    }
  } else if (e.key === 'Escape') {
    store.toggleInChatSearch()
  }
}

// Focus search input when search opens
watch(() => store.inChatSearchOpen, (val) => {
  if (val) {
    nextTick(() => searchInputRef.value?.focus())
  }
})

// Reset search index when query changes
watch(() => store.inChatSearchQuery, () => {
  store.inChatSearchIndex = 0
})

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

/* Conversation switching transition */
.chat-container.switching {
  opacity: 0.6;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.chat-container:not(.switching) {
  opacity: 1;
  transition: opacity 0.15s ease;
}

/* Empty state tips */
.empty-state-tips {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 320px;
}

.tip-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--bg-gray);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--text-secondary);
}

.tip-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.tip-text {
  line-height: 1.4;
}

.tip-text kbd {
  display: inline-block;
  padding: 1px 6px;
  font-size: 12px;
  font-family: monospace;
  background: var(--bg-white);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.1);
}

/* Load more messages */
.load-more-container {
  display: flex;
  justify-content: center;
  padding: 12px 0;
}

.load-more-btn {
  padding: 8px 20px;
  font-size: 13px;
  color: var(--primary-color);
  background: var(--primary-light);
  border: 1px solid var(--primary-color);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.load-more-btn:hover {
  background: var(--primary-color);
  color: #fff;
}

/* In-conversation search bar */
.in-chat-search-bar {
  position: absolute;
  top: 8px;
  right: 16px;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--bg-white);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-main);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.in-chat-search-input {
  width: 200px;
  padding: 5px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 13px;
  outline: none;
  background: var(--input-bg);
  color: var(--text-main);
}

.in-chat-search-input:focus {
  border-color: var(--primary-color);
}

.in-chat-search-count {
  font-size: 12px;
  color: var(--text-light);
  white-space: nowrap;
  min-width: 40px;
  text-align: center;
}

.in-chat-search-nav {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
  background: var(--bg-gray);
  color: var(--text-secondary);
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.in-chat-search-nav:hover:not(:disabled) {
  background: var(--primary-light);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.in-chat-search-nav:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.in-chat-search-close {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-light);
  font-size: 16px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
}

.in-chat-search-close:hover {
  background: var(--bg-gray);
  color: var(--text-danger);
}

/* Search bar transition */
.search-bar-slide-enter-active {
  animation: searchBarIn 0.2s ease-out;
}

.search-bar-slide-leave-active {
  animation: searchBarOut 0.15s ease-in;
}

@keyframes searchBarIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes searchBarOut {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-10px); }
}
</style>
