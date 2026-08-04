<template>
  <div class="app-root">
    <!-- U2: Mobile sidebar overlay backdrop -->
    <Transition name="sidebar-overlay-fade">
      <div v-if="store.isMobile && store.mobileSidebarOpen" class="sidebar-overlay-backdrop" @click="closeMobileSidebar"></div>
    </Transition>
    <!-- Mobile panel backdrop -->
    <Transition name="sidebar-overlay-fade">
      <div v-if="store.isMobile && (store.configPanelOpen || store.themePanelOpen)" class="panel-backdrop" @click="closeAllPanels"></div>
    </Transition>
    <Sidebar />
    <div class="main-content">
      <!-- U2: Mobile hamburger toggle (visible only on narrow screens) -->
      <button class="mobile-menu-btn" @click="toggleMobileSidebar">☰</button>
      <ChatHeader />
      <div class="current-config" id="current-config">
        {{ store.selectedModel || '未选择模型' }} | {{ currentConvName }}
        <span v-if="store.currentMessages.length > 0" class="config-stats">| {{ store.currentMessages.length }}条消息 ~{{ store.currentConversationStats.tokenEstimate }}tk</span>
        <span class="save-indicator" :class="store.saveStatus">
          <template v-if="store.saveStatus === 'saving'">保存中...</template>
          <template v-else-if="store.saveStatus === 'saved'">已保存</template>
          <template v-else-if="store.saveStatus === 'error'">保存失败</template>
        </span>
      </div>
      <div v-if="store.isOffline" class="offline-banner">网络已断开，请检查连接</div>
      <div v-if="store.isTempTipShowing" class="chat-temp-tip show">
        服务地址为空或无效，无法发送消息！
      </div>
      <ChatContainer />
      <MessageInput />
    </div>
    <ToastNotification />
    <ConfirmDialog />
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
            <div class="help-tips">
              <div class="help-tips-title">使用提示</div>
              <div class="help-tip">消息支持 Markdown 格式，包括代码块、表格、公式</div>
              <div class="help-tip">右键点击消息或对话可打开更多操作</div>
              <div class="help-tip">在配置面板中可调整模型参数和系统提示词</div>
              <div class="help-tip">支持导出对话为 JSON/Markdown/HTML 格式</div>
            </div>
            <div class="help-stats">
              <div class="help-stats-title">数据统计</div>
              <div class="stats-grid">
                <div class="stat-item">
                  <span class="stat-value">{{ store.globalStats.conversationCount }}</span>
                  <span class="stat-label">对话总数</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value">{{ store.globalStats.totalMessages }}</span>
                  <span class="stat-label">消息总数</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value">{{ store.globalStats.userMessages }}</span>
                  <span class="stat-label">用户消息</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value">{{ store.globalStats.aiMessages }}</span>
                  <span class="stat-label">AI 回复</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value">{{ formatNumber(store.globalStats.tokenEstimate) }}</span>
                  <span class="stat-label">估计 Token</span>
                </div>
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
import ConfirmDialog from './components/ConfirmDialog.vue'

const store = useChatStore()

const currentConvName = computed(() => {
  const conv = store.currentConversation
  return conv ? conv.name : '新对话'
})

// ============ U2: Mobile sidebar ============
function closeMobileSidebar() {
  store.mobileSidebarOpen = false
}

function closeAllPanels() {
  store.configPanelOpen = false
  store.themePanelOpen = false
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
      { keys: isMac() ? '⌘⇧D' : 'Ctrl+Shift+D', desc: '删除当前对话' },
      { keys: isMac() ? '⌘Tab' : 'Ctrl+Tab', desc: '切换到下一个对话' },
      { keys: isMac() ? '⌘⇧Tab' : 'Ctrl+Shift+Tab', desc: '切换到上一个对话' }
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
      { keys: 'Escape', desc: '停止生成 / 关闭弹窗' },
      { keys: isMac() ? '⌘⇧/' : 'Ctrl+Shift+/', desc: '打开/关闭此帮助面板' },
      { keys: isMac() ? '⌘,' : 'Ctrl+,', desc: '打开/关闭配置面板' },
      { keys: isMac() ? '⌘.' : 'Ctrl+.', desc: '打开/关闭主题面板' }
    ]
  },
  {
    title: '搜索',
    items: [
      { keys: isMac() ? '⌘F' : 'Ctrl+F', desc: '聚焦对话搜索' },
      { keys: isMac() ? '⌘⇧F' : 'Ctrl+Shift+F', desc: '打开消息搜索' },
      { keys: isMac() ? '⌘G' : 'Ctrl+G', desc: '搜索当前对话内容' }
    ]
  },
  {
    title: '导出',
    items: [
      { keys: isMac() ? '⌘⇧E' : 'Ctrl+Shift+E', desc: '打开导出菜单' }
    ]
  },
  {
    title: '对话列表',
    items: [
      { keys: '右键点击', desc: '打开上下文菜单' },
      { keys: '拖拽', desc: '重新排序对话' }
    ]
  }
])

function isMac() {
  return navigator.platform?.toLowerCase().includes('mac')
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
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
  // Escape: cancel generation or close panels/menus
  if (e.key === 'Escape') {
    // Priority 1: Confirm dialog (modal)
    if (store.confirmVisible) {
      // Handled by ConfirmDialog's own handler
      return
    }
    // Priority 2: Cancel generation
    if (store.isWaitingModelReply) {
      store.cancelGeneration()
      e.preventDefault()
      return
    }
    // Priority 3: Help panel
    if (store.helpPanelOpen) {
      store.helpPanelOpen = false
      e.preventDefault()
      return
    }
    // Priority 4: Context menu
    if (menuState.visible) {
      closeContextMenu()
      e.preventDefault()
      return
    }
    // Priority 5: In-chat search
    if (store.inChatSearchOpen) {
      store.toggleInChatSearch()
      e.preventDefault()
      return
    }
    // Priority 6: Config/theme panels
    if (store.configPanelOpen || store.themePanelOpen) {
      store.configPanelOpen = false
      store.themePanelOpen = false
      e.preventDefault()
      return
    }
    // Priority 7: Sidebar (only if open)
    if (store.isMobile) {
      if (store.mobileSidebarOpen) {
        store.mobileSidebarOpen = false
        e.preventDefault()
      }
    } else if (!store.sidebarCollapsed) {
      store.sidebarCollapsed = true
      e.preventDefault()
    }
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
    if (store.currentConversationId) {
      store.showConfirm('删除对话', '确认删除当前对话？').then(ok => {
        if (ok) store.deleteConversation(store.currentConversationId)
      })
    }
    return
  }

  // Ctrl+,: toggle config panel
  if ((e.ctrlKey || e.metaKey) && e.key === ',') {
    e.preventDefault()
    store.configPanelOpen = !store.configPanelOpen
    if (store.configPanelOpen) store.themePanelOpen = false
    return
  }

  // Ctrl+.: toggle theme panel
  if ((e.ctrlKey || e.metaKey) && e.key === '.') {
    e.preventDefault()
    store.themePanelOpen = !store.themePanelOpen
    if (store.themePanelOpen) store.configPanelOpen = false
    return
  }

  // Ctrl+Shift+E: open export menu (toggle header export dropdown)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'e' || e.key === 'E')) {
    e.preventDefault()
    const exportBtn = document.querySelector('.export-btn')
    if (exportBtn) exportBtn.click()
    return
  }

  // Ctrl+F: focus sidebar search
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault()
    if (store.sidebarCollapsed) store.sidebarCollapsed = false
    nextTick(() => {
      const searchInput = document.querySelector('.sidebar-search-input')
      if (searchInput) searchInput.focus()
    })
    return
  }

  // Ctrl+G: toggle in-conversation search
  if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
    e.preventDefault()
    store.toggleInChatSearch()
    return
  }

  // Ctrl+Shift+F: toggle message search panel
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
    e.preventDefault()
    if (store.sidebarCollapsed) store.sidebarCollapsed = false
    store.searchPanelOpen = !store.searchPanelOpen
    if (store.searchPanelOpen) {
      nextTick(() => {
        const msgSearchInput = document.querySelector('.msg-search-input')
        if (msgSearchInput) msgSearchInput.focus()
      })
    }
    return
  }

  // Ctrl+Tab / Ctrl+Shift+Tab: quick switch conversation
  if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
    e.preventDefault()
    const ids = store.filteredConversationIds
    if (ids.length < 2) return
    const currentIdx = ids.indexOf(store.currentConversationId)
    let nextIdx
    if (e.shiftKey) {
      // Ctrl+Shift+Tab: go to previous
      nextIdx = currentIdx <= 0 ? ids.length - 1 : currentIdx - 1
    } else {
      // Ctrl+Tab: go to next
      nextIdx = currentIdx >= ids.length - 1 ? 0 : currentIdx + 1
    }
    store.switchConversation(ids[nextIdx])
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

function handleBeforeUnload(e) {
  // Warn if AI is generating
  if (store.isWaitingModelReply) {
    e.preventDefault()
    e.returnValue = 'AI 正在生成回复，确定要离开吗？'
    return e.returnValue
  }
  // Warn if there's unsaved draft
  const draft = store.getDraft(store.currentConversationId)
  if (draft && draft.trim()) {
    e.preventDefault()
    e.returnValue = '输入框中有未发送的内容，确定要离开吗？'
    return e.returnValue
  }
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
