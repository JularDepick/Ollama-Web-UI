<template>
  <div class="app-root">
    <Sidebar />
    <div class="main-content">
      <ChatHeader />
      <div class="current-config" id="current-config">
        {{ store.selectedModel || '未选择模型' }} | {{ currentConvName }}
      </div>
      <div v-if="store.isOffline" class="offline-banner">网络已断开，请检查连接</div>
      <div v-if="store.isTempTipShowing" class="chat-temp-tip show">
        服务地址为空或无效，无法发送消息！
      </div>
      <ChatContainer />
      <MessageInput />
    </div>
    <ToastNotification />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import Sidebar from './components/Sidebar.vue'
import ChatHeader from './components/ChatHeader.vue'
import ChatContainer from './components/ChatContainer.vue'
import MessageInput from './components/MessageInput.vue'
import ToastNotification from './components/ToastNotification.vue'

const store = useChatStore()

const currentConvName = computed(() => {
  const conv = store.currentConversation
  return conv ? conv.name : '新对话'
})

function handleKeydown(e) {
  // Ctrl+N: new conversation
  if (e.ctrlKey && e.key === 'n') { e.preventDefault(); store.createNewConversation() }
  // Ctrl+L: clear chat (deletes current conversation messages)
  if (e.ctrlKey && e.key === 'l') {
    e.preventDefault()
    if (store.currentConversation) {
      store.currentConversation.messages = []
      store.persistConversations()
      store.showToast('已清空当前对话', 'info')
    }
  }
  // Esc: close panels
  if (e.key === 'Escape') {
    store.configPanelOpen = false
    store.themePanelOpen = false
    store.sidebarCollapsed = true
  }
}

// Copy code block + click-away handlers
function handleDocClick(e) {
  // Code block copy
  const btn = e.target.closest('.copy-code-btn[data-copy]')
  if (btn) {
    const pre = btn.closest('pre')
    if (!pre) return
    const code = pre.querySelector('code')
    if (!code) return
    const text = code.textContent
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '已复制'
        setTimeout(() => { btn.textContent = '复制' }, 1500)
      })
    }
  }

  // Close config panel when clicking outside
  if (store.configPanelOpen) {
    const selector = e.target.closest('.config-selector, .config-selector-toggle')
    if (!selector) store.configPanelOpen = false
  }

  // Close theme panel when clicking outside
  if (store.themePanelOpen) {
    const selector = e.target.closest('.theme-selector, .theme-selector-toggle')
    if (!selector) store.themePanelOpen = false
  }

  // Close sidebar when clicking on main content
  if (!store.sidebarCollapsed) {
    const sidebar = e.target.closest('.sidebar')
    const toggle = e.target.closest('.sidebar-toggle')
    if (!sidebar && !toggle) store.sidebarCollapsed = true
  }
}

function handleBeforeUnload() {
  // cleanup if needed
}

onMounted(() => {
  store.initialize()
  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('click', handleDocClick)
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('click', handleDocClick)
  window.removeEventListener('beforeunload', handleBeforeUnload)
})
</script>
