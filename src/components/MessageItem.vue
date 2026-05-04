<template>
  <div class="message" :class="msg.role === 'user' ? 'user-message' : 'ai-message'" :data-msg-id="msg.id">
    <div class="message-avatar">{{ msg.role === 'user' ? '我' : 'AI' }}</div>
    <div class="message-wrapper">
      <div v-if="editingMsgId === msg.id" class="message-content" style="padding:0;border:none;">
        <textarea class="edit-textarea" v-model="editText" ref="editTextareaRef" @keydown="onEditKeydown" spellcheck="false"></textarea>
      </div>
      <div v-else class="message-content" v-html="renderedContent"></div>
      <div class="msg-controls">
        <template v-if="editingMsgId === msg.id">
          <button class="edit-confirm-btn" @click="confirmEdit">确认</button>
          <button class="edit-cancel-btn" @click="cancelEdit">取消</button>
        </template>
        <template v-else>
          <button class="copy-btn" @click="copyContent">复制</button>
          <button v-if="msg.role === 'user'" class="edit-btn" @click="handleEdit">编辑</button>
          <button v-if="msg.role === 'user' && msg.id === store.latestUserMsgId" class="resend-btn" @click="handleResend">重新发送</button>
          <button v-if="msg.role !== 'user' && msg.content && msg.id === store.latestAiMsgId" class="stream-btn" @click="handleStreamAction">{{ store.isStreamingActive && msg.id === store.currentStreamingMsgId ? '直接展示' : '流式展示' }}</button>
          <span v-if="msg.role !== 'user' && msg.thinkDuration > 0" class="think-duration">思考时长: {{ formatSeconds(msg.thinkDuration) }}</span>
          <span class="message-time">{{ formatTime(msg.sendTime) }}</span>
          <div class="msg-more-wrapper" ref="moreWrapperRef">
            <button class="msg-more-btn" @click="toggleMenu">⋮</button>
            <ul class="msg-more-menu" :class="{ show: menuOpen }">
              <li :class="['delete-item', { 'confirm-delete': confirmingDelete }]" @click="handleDeleteClick">
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
import { renderMarkdown } from '@/utils/markdown'
import { formatTime, formatSeconds } from '@/utils/helpers'

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

const renderedContent = computed(() => {
  if (props.msg.role === 'user') {
    return renderMarkdown(props.msg.content)
  }
  return props.msg.content ? renderMarkdown(props.msg.content) : ''
})

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

function onDocClick(e) {
  if (menuOpen.value && moreWrapperRef.value) {
    if (!moreWrapperRef.value.contains(e.target)) {
      menuOpen.value = false
      confirmingDelete.value = false
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
</style>
