<template>
  <div class="message" :class="[
    msg.role === 'user' ? 'user-message' : 'ai-message',
    { 'msg-consecutive': isConsecutive }
  ]" :data-msg-id="msg.id"
    @contextmenu.prevent="onMessageContextMenu($event)"
    role="article"
    :aria-label="(msg.role === 'user' ? '用户消息' : 'AI回复') + ': ' + msg.content?.slice(0, 50)">
    <div class="message-avatar">{{ msg.role === 'user' ? '我' : 'AI' }}</div>
    <div class="message-wrapper">
      <div v-if="editingMsgId === msg.id" class="message-content" style="padding:0;border:none;">
        <textarea class="edit-textarea" v-model="editText" ref="editTextareaRef" @keydown="onEditKeydown" spellcheck="false"></textarea>
      </div>
      <div v-else class="message-content" :class="{ collapsed: isLong && !expanded }" v-html="renderedContent"></div>
      <button v-if="isLong && !editingMsgId" class="expand-msg-btn" @click="expanded = !expanded">
        {{ expanded ? '收起' : '展开全部' }}
      </button>
      <!-- Error state with retry button -->
      <div v-if="msg.error" class="message-error-bar" role="alert">
        <span class="error-text">请求失败: {{ msg.error }}</span>
        <button class="retry-btn" @click="store.retryMessage(msg.id)" aria-label="重试发送">重试</button>
      </div>
      <!-- F7: Quote reference bar -->
      <div v-if="msg.replyTo" class="quote-reference" @click="scrollToQuotedMsg">
        <span class="quote-reference-role">{{ msg.replyTo.role === 'user' ? '用户' : 'AI' }}</span>
        <span class="quote-reference-text">{{ msg.replyTo.content.slice(0, 120) }}{{ msg.replyTo.content.length > 120 ? '...' : '' }}</span>
      </div>
      <div class="message-model-tag" v-if="msg.model && msg.role === 'assistant'">{{ msg.model }}</div>
      <!-- Reactions display -->
      <div v-if="msg.reactions && Object.keys(msg.reactions).length > 0" class="message-reactions">
        <button v-for="(count, emoji) in msg.reactions" :key="emoji"
          class="reaction-badge" :class="{ active: msg.userReaction === emoji }"
          @click="toggleReaction(emoji)">
          {{ emoji }} {{ count > 1 ? count : '' }}
        </button>
      </div>
      <div class="msg-controls">
        <template v-if="editingMsgId === msg.id">
          <button class="edit-confirm-btn" @click="confirmEdit">确认</button>
          <button class="edit-cancel-btn" @click="cancelEdit">取消</button>
        </template>
        <template v-else>
          <button class="copy-btn" @click="copyContent" aria-label="复制消息内容">复制</button>
          <button class="copy-btn" @click="handleQuote" :title="msg.role === 'user' ? '引用此消息' : '引用此回复'" aria-label="引用消息">引用</button>
          <div class="reaction-picker-wrapper" ref="reactionWrapperRef">
            <button class="copy-btn reaction-trigger" @click="reactionPickerOpen = !reactionPickerOpen" aria-label="添加表情">😀</button>
            <div v-if="reactionPickerOpen" class="reaction-picker">
              <button v-for="emoji in quickReactions" :key="emoji" class="reaction-option" @click="addReaction(emoji)">{{ emoji }}</button>
            </div>
          </div>
          <button v-if="msg.role === 'user' && msg.id === store.latestUserMsgId" class="copy-btn" @click="handleEdit" aria-label="编辑消息">编辑</button>
          <button v-if="msg.role === 'user' && msg.id === store.latestUserMsgId" class="copy-btn resend-btn" @click="handleResend" aria-label="重新发送消息">重新发送</button>
          <button v-if="msg.role !== 'user' && msg.content && msg.id === store.latestAiMsgId" class="copy-btn" @click="handleStreamAction" :aria-label="store.isStreamingActive && msg.id === store.currentStreamingMsgId ? '直接展示内容' : '流式展示内容'">{{ store.isStreamingActive && msg.id === store.currentStreamingMsgId ? '直接展示' : '流式展示' }}</button>
          <button v-if="msg.role !== 'user' && msg.content && msg.id === store.latestAiMsgId && !store.isWaitingModelReply" class="copy-btn" @click="store.regenerateMessage(msg.id)" aria-label="重新生成回复">重新生成</button>
          <span v-if="msg.role !== 'user' && msg.thinkDuration > 0" class="think-duration">思考时长: {{ formatSeconds(msg.thinkDuration) }}</span>
          <span class="message-time" :title="formatFullTime(msg.sendTime)">{{ formatTime(msg.sendTime) }}</span>
          <div class="msg-more-wrapper" ref="moreWrapperRef">
            <button class="msg-more-btn" @click="toggleMenu" :aria-expanded="menuOpen" aria-haspopup="true" aria-label="更多操作">⋮</button>
            <ul class="msg-more-menu" :class="{ show: menuOpen }" role="menu">
              <li :class="['delete-item', { 'confirm-delete': confirmingDelete }]" @click="handleDeleteClick" role="menuitem">
                {{ confirmingDelete ? '确认删除' : '删除' }}
              </li>
            </ul>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import { openContextMenu } from '@/composables/useContextMenu'
import { renderMarkdown, libsReady } from '@/utils/markdown'
import { formatTime, formatFullTime, formatSeconds } from '@/utils/helpers'

const props = defineProps({
  msg: Object,
  isConsecutive: Boolean
})

const store = useChatStore()
const menuOpen = ref(false)
const confirmingDelete = ref(false)
const moreWrapperRef = ref(null)
const editingMsgId = ref(null)
const editText = ref('')
const editTextareaRef = ref(null)
const expanded = ref(false)

// Reactions
const reactionPickerOpen = ref(false)
const reactionWrapperRef = ref(null)
const quickReactions = ['👍', '👎', '❤️', '😄', '😮', '😢', '🎉', '🤔']

const isLong = computed(() => {
  if (!props.msg.content) return false
  return props.msg.content.length > 500 || props.msg.content.split('\n').length > 15
})

const renderedContent = computed(() => {
  libsReady.value
  if (!props.msg.content) return ''
  let html = renderMarkdown(props.msg.content)
  // Highlight in-chat search matches
  const q = store.inChatSearchQuery?.trim()
  if (q && store.inChatSearchOpen) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escaped})`, 'gi')
    html = html.replace(regex, '<mark class="in-chat-highlight">$1</mark>')
  }
  return html
})

function addReaction(emoji) {
  if (!props.msg.reactions) props.msg.reactions = {}
  if (props.msg.userReaction === emoji) {
    // Remove reaction
    props.msg.reactions[emoji] = (props.msg.reactions[emoji] || 1) - 1
    if (props.msg.reactions[emoji] <= 0) delete props.msg.reactions[emoji]
    props.msg.userReaction = null
  } else {
    // Remove previous reaction if exists
    if (props.msg.userReaction && props.msg.reactions[props.msg.userReaction]) {
      props.msg.reactions[props.msg.userReaction]--
      if (props.msg.reactions[props.msg.userReaction] <= 0) delete props.msg.reactions[props.msg.userReaction]
    }
    // Add new reaction
    props.msg.reactions[emoji] = (props.msg.reactions[emoji] || 0) + 1
    props.msg.userReaction = emoji
  }
  reactionPickerOpen.value = false
  store.persistConversations()
}

function toggleReaction(emoji) {
  addReaction(emoji)
}

function copyContent() {
  const text = props.msg.content
  if (!text) return
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      store.showToast('已复制', 'success')
    }).catch(() => fallbackCopy(text))
  } else {
    fallbackCopy(text)
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
  store.showToast('已复制', 'success')
}

// F7: Quote handlers
function handleQuote() {
  store.setQuotedMessage(props.msg)
  store.showToast('已引用该消息', 'info')
}

function scrollToQuotedMsg() {
  if (!props.msg.replyTo || !props.msg.replyTo.id) return
  const el = document.querySelector(`[data-msg-id="${props.msg.replyTo.id}"]`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('quote-target-highlight')
    setTimeout(() => el.classList.remove('quote-target-highlight'), 2000)
  }
}

function handleEdit() {
  menuOpen.value = false
  editingMsgId.value = props.msg.id
  editText.value = props.msg.content
  nextTick(() => {
    editTextareaRef.value?.focus()
  })
}

function confirmEdit() {
  if (!editText.value.trim()) return
  store.saveEditedMessage(props.msg.id, editText.value)
  editingMsgId.value = null
}

function cancelEdit() {
  editingMsgId.value = null
}

function onEditKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    confirmEdit()
  } else if (e.key === 'Escape') {
    cancelEdit()
  }
}

function handleResend() {
  store.resendMessage(props.msg.id)
}

function handleStreamAction() {
  if (store.isStreamingActive && props.msg.id === store.currentStreamingMsgId) {
    store.skipStreaming()
  } else {
    store.replayStreaming(props.msg.id)
  }
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value
  if (!menuOpen.value) confirmingDelete.value = false
}

function handleDeleteClick() {
  if (!confirmingDelete.value) {
    confirmingDelete.value = true
  } else {
    store.deleteMessage(props.msg.id)
    menuOpen.value = false
    confirmingDelete.value = false
  }
}

// U5: Message context menu
function onMessageContextMenu(event) {
  const items = [
    { label: '复制内容', icon: '📋', handler: () => copyContent() },
    { label: '引用回复', icon: '💬', handler: () => handleQuote() },
  ]
  if (props.msg.role === 'assistant' && props.msg.content && props.msg.id === store.latestAiMsgId && !store.isWaitingModelReply) {
    items.push({ label: '重新生成', icon: '🔄', handler: () => store.regenerateMessage(props.msg.id) })
  }
  items.push({ divider: true })
  items.push({ label: '删除消息', icon: '🗑️', cls: 'danger', handler: () => { store.showConfirm('删除消息', '确认删除此消息？').then(ok => { if (ok) store.deleteMessage(props.msg.id) }) } })
  openContextMenu(event, items, { msgId: props.msg.id })
}

function onDocClick(e) {
  if (menuOpen.value && moreWrapperRef.value) {
    if (!moreWrapperRef.value.contains(e.target)) {
      menuOpen.value = false
      confirmingDelete.value = false
    }
  }
  if (reactionPickerOpen.value && reactionWrapperRef.value) {
    if (!reactionWrapperRef.value.contains(e.target)) {
      reactionPickerOpen.value = false
    }
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<style scoped>
.edit-textarea{width:100%;min-height:80px;padding:10px 16px;border:2px solid var(--primary-color);border-radius:var(--radius-main);font-size:15px;outline:none;resize:vertical;background:var(--bg-white);color:var(--text-main);font-family:inherit;line-height:1.6;user-select:text;}
.edit-confirm-btn,.edit-cancel-btn{padding:4px 16px;border-radius:var(--radius-sm);font-size:13px;cursor:pointer;border:none;transition:all 0.2s;}
.edit-confirm-btn{background:var(--primary-color);color:#fff;}
.edit-confirm-btn:hover{background:var(--primary-hover);}
.edit-cancel-btn{background:var(--bg-gray);color:var(--text-secondary);border:1px solid var(--border-color);}
.edit-cancel-btn:hover{background:var(--border-color);}

/* F7: Quote reference bar */
.quote-reference {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 6px 10px;
  margin: 4px 18px 4px 0;
  background: var(--bg-gray);
  border-left: 3px solid var(--primary-color);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
  font-size: 13px;
}

.quote-reference:hover {
  background: var(--primary-light);
}

.quote-reference-role {
  font-weight: 600;
  color: var(--primary-color);
  font-size: 12px;
  white-space: nowrap;
  flex-shrink: 0;
}

.quote-reference-text {
  color: var(--text-secondary);
  word-break: break-all;
  line-height: 1.4;
}

/* Highlight animation when scrolling to quoted message */
@keyframes quoteHighlight {
  0% { background-color: var(--primary-light); }
  100% { background-color: transparent; }
}

.quote-target-highlight {
  animation: quoteHighlight 2s ease-out;
}

.message-model-tag{font-size:11px;color:var(--text-light);margin:2px 0 4px;padding:0 2px;}

.message-error-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding: 6px 10px;
  background: rgba(245, 34, 45, 0.08);
  border: 1px solid rgba(245, 34, 45, 0.2);
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.error-text {
  color: var(--text-danger);
  flex: 1;
}

.message-error-bar .retry-btn {
  border-color: var(--text-danger);
  color: var(--text-danger);
  padding: 2px 10px;
  font-size: 12px;
  border: 1px solid var(--text-danger);
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.message-error-bar .retry-btn:hover {
  background: var(--text-danger);
  color: #fff;
}

/* Message collapse/expand */
.message-content.collapsed {
  max-height: 200px;
  overflow: hidden;
  position: relative;
}

.message-content.collapsed::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(transparent, var(--msg-ai-bg, #fff));
  pointer-events: none;
}

.expand-msg-btn {
  display: inline-block;
  margin-top: 4px;
  padding: 2px 12px;
  font-size: 12px;
  color: var(--primary-color);
  background: transparent;
  border: 1px solid var(--primary-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.expand-msg-btn:hover {
  background: var(--primary-color);
  color: #fff;
}

/* Reactions */
.message-reactions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.reaction-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 8px;
  font-size: 12px;
  background: var(--bg-gray);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.reaction-badge:hover {
  background: var(--primary-light);
  border-color: var(--primary-color);
}

.reaction-badge.active {
  background: var(--primary-light);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.reaction-picker-wrapper {
  position: relative;
  display: inline-block;
}

.reaction-trigger {
  font-size: 14px;
  padding: 2px 6px;
}

.reaction-picker {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 2px;
  padding: 6px 8px;
  background: var(--bg-white);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  z-index: 100;
  animation: fadeIn 0.15s ease-out;
}

.reaction-option {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.1s;
}

.reaction-option:hover {
  background: var(--bg-gray);
}

/* In-chat search highlights */
.message-content :deep(.in-chat-highlight) {
  background: rgba(255, 193, 7, 0.3);
  color: inherit;
  padding: 1px 2px;
  border-radius: 2px;
  box-shadow: 0 0 0 2px rgba(255, 193, 7, 0.5);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(4px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>
