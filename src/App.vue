<template>
  <div class="app-root">
    <!-- U2: Mobile sidebar overlay backdrop -->
    <Transition name="sidebar-overlay-fade">
      <div v-if="store.isMobile && store.mobileSidebarOpen" class="sidebar-overlay-backdrop" @click="closeMobileSidebar"></div>
    </Transition>
    <Sidebar />
    <div class="main-content">
      <!-- U2: Mobile hamburger toggle (visible only on narrow screens) -->
      <button class="mobile-menu-btn" @click="toggleMobileSidebar">☰</button>
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
    <!-- U5: Context Menu -->
    <ContextMenu />
    <!-- U8: Keyboard shortcuts help panel -->
    <Transition name="modal-fade-slide">
      <div v-if="store.helpPanelOpen" class="help-panel-overlay" @click.self="closeHelpPanel">
        <div class="help-panel" @click.stop>
          <div class="help-panel-header">
            <span>键盘快捷键</span>
            <button class="help-panel-close" @click="closeHelpPanel" ref="helpPanelCloseRef">×</button>
          </div>
          <div class="help-panel-body">
            <div class="shortcut-group" v-for="group in shortcutGroups" :key="group.title">
              <div class="shortcut-group-title">{{ group.title }}</div>
              <div class="shortcut-row" v-for="item in group.items" :key="item.keys">
                <span class="shortcut-keys">{{ item.keys }}</span>
                <span class="shortcut-desc">{{ item.desc }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, nextTick } from 'vue'
import { useChatStore } from '@/stores/chat'
import { closeContextMenu } from '@/composables/useContextMenu'
import Sidebar from './components/Sidebar.vue'
import ChatHeader from './components/ChatHeader.vue'
import ChatContainer from './components/ChatContainer.vue'
import MessageInput from './components/MessageInput.vue'
import ToastNotification from './components/ToastNotification.vue'
import ContextMenu from './components/ContextMenu.vue'

const store = useChatStore()

const currentConvName = computed(() => {
  const conv = store.currentConversation
  return conv ? conv.name : '新对话'
})

// ============ U2: Mobile sidebar ============
function closeMobileSidebar() {
  store.mobileSidebarOpen = false
}

function toggleMobileSidebar() {
  store.mobileSidebarOpen = !store.mobileSidebarOpen
}

// ============ U8: Shortcut help panel ============
const helpPanelCloseRef = ref(null)

const shortcutGroups = computed(() => [
  {
    title: '导航',
    items: [
      { keys: isMac() ? '⌘N' : 'Ctrl+N', desc: '新建对话' },
      { keys: isMac() ? '⌘⇧D' : 'Ctrl+Shift+D', desc: '删除当前对话' }
    ]
  },
  {
    title: '消息',
    items: [
      { keys: 'Enter', desc: '发送消息' },
      { keys: 'Shift+Enter', desc: '换行' },
      { keys: isMac() ? '⌘Enter' : 'Ctrl+Enter', desc: '发送消息（备选）' }
    ]
  },
  {
    title: '面板',
    items: [
      { keys: 'Escape', desc: '关闭所有弹窗/菜单/面板' },
      { keys: isMac() ? '⌘⇧/' : 'Ctrl+Shift+/', desc: '打开/关闭此帮助面板' }
    ]
  },
  {
    title: '对话列表',
    items: [
      { keys: '右键点击', desc: '打开上下文菜单' }
    ]
  }
])

function isMac() {
  return navigator.platform?.toLowerCase().includes('mac')
}

function closeHelpPanel() {
  store.helpPanelOpen = false
}

// ============ U8: Focus trap ============
function getActivePanel() {
  if (store.helpPanelOpen) return 'help'
  return null
}

function focusTrap(e, panelType) {
  const panel = panelType === 'help'
    ? document.querySelector('.help-panel')
    : null
  if (!panel) return
  const focusable = panel.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

// ============ U8: Global keyboard handler ============
function handleKeydown(e) {
  // Determine if we're in an editable element
  const tag = document.activeElement?.tagName
  const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    || document.activeElement?.isContentEditable
    || document.activeElement?.closest('[contenteditable]')

  // Global shortcuts that work everywhere
  // Escape: close all panels/menus
  if (e.key === 'Escape') {
    if (store.helpPanelOpen) {
      store.helpPanelOpen = false
      e.preventDefault()
      return
    }
    if (menuState.visible) {
      closeContextMenu()
      e.preventDefault()
      return
    }
    store.configPanelOpen = false
    store.themePanelOpen = false
    if (store.isMobile) {
      store.mobileSidebarOpen = false
    } else {
      store.sidebarCollapsed = true
    }
    e.preventDefault()
    return
  }

  // Ctrl+Shift+/ : toggle help panel (works everywhere)
  if (e.ctrlKey && e.shiftKey && e.key === '/') {
    e.preventDefault()
    if (store.helpPanelOpen) {
      store.helpPanelOpen = false
    } else {
      store.helpPanelOpen = true
      nextTick(() => {
        const closeBtn = document.querySelector('.help-panel-close')
        closeBtn?.focus()
      })
    }
    return
  }

  // Ctrl+N: new conversation (works everywhere)
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault()
    store.createNewConversation()
    return
  }

  // Ctrl+Shift+D: delete current conversation with confirmation
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
    e.preventDefault()
    if (store.currentConversationId && confirm('确认删除当前对话？')) {
      store.deleteConversation(store.currentConversationId)
    }
    return
  }

  // Shortcuts that should not fire when editing
  if (isEditable) {
    // Ctrl+Enter / Cmd+Enter: send message
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      // The input component already handles Enter, but Ctrl+Enter is a backup trigger
      // Dispatch a custom event that MessageInput can listen to
      e.preventDefault()
      const sendBtn = document.getElementById('send-button')
      if (sendBtn && !sendBtn.disabled) {
        sendBtn.click()
      }
    }
    return
  }

  // Focus trap: Tab cycling within open panels
  if (e.key === 'Tab') {
    const activePanel = getActivePanel()
    if (activePanel) {
      focusTrap(e, activePanel)
      return
    }
  }
}

// ============ Resize handler (U2) ============
function handleResize() {
  store.updateIsMobile()
}

// ============ Open/close modal focus management ============
function onFocusIn(e) {
  // Auto-focus first element when help panel opens
  if (store.helpPanelOpen && !document.activeElement?.closest('.help-panel')) {
    const closeBtn = document.querySelector('.help-panel-close')
    closeBtn?.focus()
  }
}

// Click-away handlers
function handleDocClick(e) {
  // Skip if clicking on code block interactive elements (copy/expand buttons)
  if (e.target.closest('.copy-code-btn, .expand-code-btn, .code-header')) return

  // Close config panel when clicking outside
  if (store.configPanelOpen) {
    const selector = e.target.closest('.config-selector, .config-selector-toggle, .config-btn')
    if (!selector) store.configPanelOpen = false
  }

  // Close theme panel when clicking outside
  if (store.themePanelOpen) {
    const selector = e.target.closest('.theme-selector, .theme-selector-toggle, .theme-btn')
    if (!selector) store.themePanelOpen = false
  }

  // Close sidebar when clicking on main content (desktop only)
  if (!store.isMobile && !store.sidebarCollapsed) {
    const sidebar = e.target.closest('.sidebar')
    const toggle = e.target.closest('.sidebar-toggle')
    if (!sidebar && !toggle) store.sidebarCollapsed = true
  }

  // Close help panel when clicking outside
  if (store.helpPanelOpen) {
    const panel = e.target.closest('.help-panel')
    if (!panel) store.helpPanelOpen = false
  }
}

function handleBeforeUnload() {
  // cleanup if needed
}

// Import menuState for Escape handler
import { menuState } from '@/composables/useContextMenu'

onMounted(() => {
  store.initialize()
  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('click', handleDocClick)
  document.addEventListener('focusin', onFocusIn)
  window.addEventListener('resize', handleResize)
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('click', handleDocClick)
  document.removeEventListener('focusin', onFocusIn)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('beforeunload', handleBeforeUnload)
})
</script>
