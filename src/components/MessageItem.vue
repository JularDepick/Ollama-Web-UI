<template>
  <div class="message" :class="msg.role === 'user' ? 'user-message' : 'ai-message'" :data-msg-id="msg.id">
    <div class="message-avatar">{{ msg.role === 'user' ? '我' : 'AI' }}</div>
    <div class="message-wrapper">
      <div class="message-content" v-html="renderedContent"></div>
      <div class="msg-controls">
        <button class="copy-btn" @click="copyContent">复制</button>
        <div class="msg-more-wrapper">
          <button class="msg-more-btn" @click="menuOpen = !menuOpen">⋮</button>
          <ul class="msg-more-menu" :class="{ show: menuOpen }">
            <li class="delete-item" @click="handleDelete">删除</li>
          </ul>
        </div>
        <span v-if="!isUser && msg.thinkDuration > 0" class="think-duration">思考时长: {{ formatSeconds(msg.thinkDuration) }}</span>
        <span class="message-time">{{ formatTime(msg.sendTime) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useChatStore } from '@/stores/chat'
import { renderMarkdown } from '@/utils/markdown'
import { formatTime, formatSeconds } from '@/utils/helpers'

const props = defineProps({
  msg: Object,
  isConsecutive: Boolean
})

const store = useChatStore()
const menuOpen = ref(false)

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

function handleDelete() {
  store.deleteMessage(props.msg.id)
  menuOpen.value = false
}
</script>
