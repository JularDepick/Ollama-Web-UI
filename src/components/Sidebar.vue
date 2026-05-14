<template>
  <div class="sidebar"
    :class="{
      collapsed: isSidebarCollapsed,
      'mobile-overlay': store.isMobile && store.mobileSidebarOpen
    }"
    :style="sidebarStyle"
    @touchstart="onTouchStart"
    @touchend="onTouchEnd"
    @touchmove="onTouchMove">
    <div class="sidebar-header" :style="{ width: sidebarWidth + 'px' }">
      <button class="sidebar-toggle" id="sidebar-toggle-inner" @click="toggleSidebar">☰</button>
      <div class="sidebar-title">对话记录</div>
      <div class="sidebar-controls">
        <button class="sidebar-btn new-btn" title="新建对话" @click="store.createNewConversation()">+</button>
      </div>
    </div>
    <div class="sidebar-search">
      <input type="text" class="sidebar-search-input" placeholder="搜索对话..." v-model="store.conversationSearchTerm" @click.stop>
    </div>
    <!-- F2: Tag filter bar -->
    <div class="sidebar-tag-filter" v-if="store.availableTags.length > 0">
      <button class="tag-chip" :class="{ active: !store.activeTagFilter }" @click="store.activeTagFilter = ''">全部</button>
      <button v-for="tag in store.availableTags" :key="tag"
        class="tag-chip" :class="{ active: store.activeTagFilter === tag }"
        @click="store.activeTagFilter = store.activeTagFilter === tag ? '' : tag">
        {{ tag }}
      </button>
    </div>
    <!-- F3: Cross-conversation search button -->
    <div class="sidebar-msg-search-toggle">
      <button class="msg-search-btn" @click="toggleSearchPanel">
        🔍 {{ store.searchPanelOpen ? '关闭搜索' : '消息搜索' }}
      </button>
    </div>
    <!-- F3: Search results panel -->
    <div v-if="store.searchPanelOpen" class="sidebar-msg-search-panel">
      <div class="msg-search-input-row">
        <input type="text" class="msg-search-input" v-model="store.searchQuery"
          placeholder="搜索所有对话中的消息..." @input="onSearchInput" ref="searchInputRef" spellcheck="false">
        <button v-if="store.searchQuery" class="msg-search-clear" @click="store.searchQuery = ''">×</button>
      </div>
      <div class="msg-search-results">
        <template v-if="store.searchQuery && store.searchResultCount === 0">
          <div class="msg-search-empty">未找到匹配消息</div>
        </template>
        <template v-else-if="store.searchQuery && store.searchResultCount > 0">
          <div class="msg-search-result-count">共 {{ store.searchResultCount }} 条匹配结果</div>
          <div v-for="group in groupedSearchResults" :key="group.convId" class="msg-search-group">
            <div class="msg-search-group-title" @click="switchAndCloseSidebar(group.convId)">{{ group.convName }}</div>
            <div v-for="result in group.results" :key="result.msgId"
              class="msg-search-item" @click="store.navigateToSearchResult(result.convId, result.msgId)">
              <span class="msg-search-item-role">{{ result.role === 'user' ? '我' : 'AI' }}</span>
              <span class="msg-search-item-content">{{ result.content.slice(0, 80) }}{{ result.content.length > 80 ? '...' : '' }}</span>
            </div>
          </div>
        </template>
      </div>
    </div>
    <div class="conversations-list">
      <template v-if="store.filteredConversationIds.length > 0">
        <div v-for="id in store.filteredConversationIds" :key="id"
          class="conversation-item"
          :class="{
            active: id === store.currentConversationId,
            starred: store.conversations[id]?.starredAt,
            'tag-editing': tagEditingId === id,
            'drag-over': dragOverId === id
          }"
          draggable="true"
          @dragstart="onDragStart($event, id)"
          @dragover="onDragOver($event, id)"
          @dragend="onDragEnd"
          @contextmenu.prevent="onConversationContextMenu($event, id)"
          data-contextmenu-trigger>
          <!-- F1: Star button always visible -->
          <button class="star-btn" :class="{ starred: store.conversations[id]?.starredAt }"
            @click.stop="store.toggleStarConversation(id)" :title="store.conversations[id]?.starredAt ? '取消收藏' : '收藏'">
            {{ store.conversations[id]?.starredAt ? '★' : '☆' }}
          </button>
          <div class="conversation-info" @click="onConversationClick(id)">
            <div class="conversation-title" :class="{ editable: renamingId === id }">
              <template v-if="renamingId === id">
                <div class="rename-row">
                  <input type="text" class="rename-input" :data-rename-input="id" v-model="renameText" @keydown="onRenameKeydown(id, $event)" spellcheck="false">
                  <button class="rename-confirm-btn" @click.stop="confirmRename(id)" title="确认">✓</button>
                </div>
              </template>
              <template v-else>
                {{ store.conversations[id]?.name || '未命名' }}
              </template>
            </div>
            <!-- F2: Tag badges -->
            <div class="conversation-tags" v-if="store.conversations[id]?.tags?.length && tagEditingId !== id">
              <span v-for="tag in store.conversations[id].tags" :key="tag" class="tag-badge"
                @click.stop="store.activeTagFilter = store.activeTagFilter === tag ? '' : tag">
                {{ tag }}
              </span>
            </div>
            <div class="conversation-time">
              {{ formatTime(store.conversations[id]?.updateTime) }}
            </div>
          </div>
          <button class="conversation-more" @click.stop="toggleMenu(id)">⋮</button>
          <div class="conversation-actions" :class="{ show: openMenuId === id }">
            <button class="conversation-action-btn tag-mgr-btn" @click.stop="handleTagEdit(id)">标签</button>
            <button class="conversation-action-btn rename-btn" @click.stop="handleRename(id)">重命名</button>
            <button :class="['conversation-action-btn', confirmingDeleteId === id ? 'confirm-delete' : 'delete-btn']" @click.stop="handleDeleteClick(id)">{{ confirmingDeleteId === id ? '确认删除' : '删除' }}</button>
          </div>
          <!-- F2: Inline tag editor -->
          <div v-if="tagEditingId === id" class="tag-editor" @click.stop>
            <div class="tag-editor-header">管理标签</div>
            <div class="tag-editor-input-row">
              <input type="text" class="tag-editor-input" v-model="tagInputText"
                placeholder="输入标签，回车或逗号添加" @keydown="onTagInputKeydown(id, $event)" spellcheck="false">
              <button class="tag-editor-add-btn" @click="addTag(id)">+</button>
            </div>
            <div class="tag-editor-list" v-if="editTags.length > 0 || store.availableTags.length > 0">
              <div class="tag-editor-current" v-if="editTags.length > 0">
                <span v-for="(tag, ti) in editTags" :key="ti" class="tag-editor-tag">
                  {{ tag }}
                  <button class="tag-remove-btn" @click="removeTag(id, ti)">×</button>
                </span>
              </div>
              <div class="tag-editor-suggestions" v-if="suggestionTags.length > 0">
                <span class="tag-editor-suggest-label">可用标签:</span>
                <button v-for="tag in suggestionTags" :key="tag" class="tag-suggest-btn"
                  @click="addTag(id, tag)">+{{ tag }}</button>
              </div>
            </div>
            <div class="tag-editor-actions">
              <button class="tag-editor-done-btn" @click="confirmTags(id)">完成</button>
              <button class="tag-editor-cancel-btn" @click="cancelTagEdit">取消</button>
            </div>
          </div>
        </div>
      </template>
      <div v-else-if="store.conversationSearchTerm || store.activeTagFilter" class="sidebar-empty">无匹配对话</div>
      <div v-else class="empty-state">
        <div class="empty-state-icon">💬</div>
        <div class="empty-state-title">开始对话</div>
        <div class="empty-state-hint">点击右下角 + 新建对话<br>或配置 Ollama 地址后直接发送消息</div>
      </div>
    </div>
    <!-- F5: Stats panel -->
    <div class="sidebar-stats" v-if="store.currentConversationStats.messageCount > 0 && !isSidebarCollapsed">
      <div class="stats-header" @click="statsOpen = !statsOpen">
        <span>对话统计</span>
        <span class="stats-toggle">{{ statsOpen ? '▼' : '▶' }}</span>
      </div>
      <div class="stats-body" :class="{ expanded: statsOpen }">
        <div class="stats-body-inner">
          <div class="stats-row">
            <span class="stats-label">消息数</span>
            <span class="stats-value">{{ store.currentConversationStats.messageCount }}</span>
          </div>
          <div class="stats-row">
            <span class="stats-label">对话数</span>
            <span class="stats-value">{{ Object.keys(store.conversations).length }}</span>
          </div>
          <div class="stats-model-section" v-if="Object.keys(store.currentConversationStats.modelFrequency).length > 0">
            <div class="stats-model-section-title">模型使用</div>
            <div v-for="(count, model) in store.currentConversationStats.modelFrequency" :key="model" class="stats-row">
              <span class="stats-label stats-model-name" :title="model">{{ model }}</span>
              <span class="stats-value">{{ count }}次</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Resize handle -->
    <div class="sidebar-resize-handle" @mousedown="onResizeStart"></div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import { openContextMenu } from '@/composables/useContextMenu'
import { formatTime } from '@/utils/helpers'

const STORAGE_KEY = 'Ollama-Web-UI-SidebarWidth'
const MIN_WIDTH = 180
const MAX_WIDTH = 500

function loadSidebarWidth() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const w = parseInt(saved, 10)
      if (w >= MIN_WIDTH && w <= MAX_WIDTH) return w
    }
  } catch (e) { /* ignore */ }
  return 250
}

function saveSidebarWidth(w) {
  try {
    localStorage.setItem(STORAGE_KEY, String(w))
  } catch (e) { /* ignore */ }
}

const store = useChatStore()
const dragStartId = ref(null)
const dragOverId = ref(null)
const openMenuId = ref(null)
const confirmingDeleteId = ref(null)
const renamingId = ref(null)
const renameText = ref('')
const sidebarWidth = ref(loadSidebarWidth())
const isResizing = ref(false)

// F2: Tag editing state
const tagEditingId = ref(null)
const tagInputText = ref('')
const editTags = ref([])

// F5: Stats toggle
const statsOpen = ref(false)

// U2: Touch gesture state
const touchStartX = ref(0)
const touchStartY = ref(0)
const touchEndX = ref(0)
const touchEndY = ref(0)
const swipingDisabled = ref(false)

// ============ Computed ============
const isSidebarCollapsed = computed(() => {
  if (store.isMobile) {
    return !store.mobileSidebarOpen
  }
  return store.sidebarCollapsed
})

const sidebarStyle = computed(() => {
  if (store.isMobile) {
    // On mobile, sidebar width is fixed 250px (not resizable)
    return { width: '250px' }
  }
  return { width: sidebarWidth.value + 'px' }
})

const suggestionTags = computed(() => {
  if (!tagEditingId.value) return []
  return store.availableTags.filter(t => !editTags.value.includes(t))
})

function toggleSidebar() {
  if (store.isMobile) {
    store.mobileSidebarOpen = !store.mobileSidebarOpen
  } else {
    store.sidebarCollapsed = !store.sidebarCollapsed
  }
}

function onConversationClick(id) {
  store.switchConversation(id)
  // Close sidebar on mobile after selecting a conversation
  if (store.isMobile) {
    store.mobileSidebarOpen = false
  }
}

// U2: Touch gesture handlers
function onTouchStart(e) {
  if (swipingDisabled.value) return
  touchStartX.value = e.touches[0].clientX
  touchStartY.value = e.touches[0].clientY
  touchEndX.value = touchStartX.value
  touchEndY.value = touchStartY.value
}

function onTouchMove(e) {
  if (swipingDisabled.value) return
  touchEndX.value = e.touches[0].clientX
  touchEndY.value = e.touches[0].clientY
}

function onTouchEnd(e) {
  if (swipingDisabled.value) return
  const dx = touchEndX.value - touchStartX.value
  const dy = touchEndY.value - touchStartY.value

  // Only handle horizontal swipes (ignore vertical scrolling)
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return

  if (dx > 0 && isSidebarCollapsed.value) {
    // Swipe right → open sidebar
    if (store.isMobile) {
      store.mobileSidebarOpen = true
    } else {
      store.sidebarCollapsed = false
    }
  } else if (dx < 0 && !isSidebarCollapsed.value) {
    // Swipe left → close sidebar
    if (store.isMobile) {
      store.mobileSidebarOpen = false
    } else {
      store.sidebarCollapsed = true
    }
  }
}

// U5: Conversation context menu
function onConversationContextMenu(event, id) {
  const conv = store.conversations[id]
  const isStarred = !!conv?.starredAt
  const items = [
    { label: '编辑名称', icon: '✏️', handler: () => handleRename(id) },
    { label: isStarred ? '取消收藏' : '收藏', icon: isStarred ? '★' : '☆', handler: () => store.toggleStarConversation(id) },
    { label: '添加标签', icon: '🏷️', handler: () => handleTagEdit(id) },
    { label: '导出对话', icon: '📤', handler: () => store.exportCurrentConversationJson() },
    { divider: true },
    { label: '删除对话', icon: '🗑️', cls: 'danger', handler: () => { if (confirm('确认删除该对话？')) store.deleteConversation(id) } }
  ]
  openContextMenu(event, items, { convId: id })
}

function switchAndCloseSidebar(convId) {
  store.switchConversation(convId)
  if (store.isMobile) {
    store.mobileSidebarOpen = false
  }
}

// ============ Resize ============
function onResizeStart(e) {
  if (store.isMobile) return // No resize on mobile
  isResizing.value = true
  e.preventDefault()
}

function onResizeMove(e) {
  if (!isResizing.value) return
  if (store.isMobile) return
  const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, e.clientX))
  sidebarWidth.value = newWidth
}

function onResizeEnd() {
  if (isResizing.value) {
    isResizing.value = false
    if (!store.isMobile) {
      saveSidebarWidth(sidebarWidth.value)
    }
  }
}

onMounted(() => {
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
})

// U4: Drag to reorder
function onDragStart(e, id) {
  dragStartId.value = id
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', id)
  e.target.classList.add('dragging')
}

function onDragOver(e, id) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  if (id !== dragStartId.value && id !== dragOverId.value) {
    dragOverId.value = id
  }
}

function onDragEnd(e) {
  e.target.classList.remove('dragging')
  if (dragStartId.value && dragOverId.value && dragStartId.value !== dragOverId.value) {
    store.reorderConversation(dragStartId.value, Date.now())
    store.reorderConversation(dragOverId.value, Date.now() - 1)
    store.persistConversations()
  }
  dragStartId.value = null
  dragOverId.value = null
}

function toggleMenu(id) {
  openMenuId.value = openMenuId.value === id ? null : id
  if (openMenuId.value !== id) confirmingDeleteId.value = null
  if (tagEditingId.value && tagEditingId.value !== id) {
    cancelTagEdit()
  }
}

function handleRename(id) {
  renamingId.value = id
  const conv = store.conversations[id]
  renameText.value = conv?.name || ''
  openMenuId.value = null
  nextTick(() => {
    const input = document.querySelector(`[data-rename-input="${id}"]`)
    input?.focus()
    input?.select()
  })
}

function onRenameKeydown(id, e) {
  if (e.key === 'Enter') {
    e.preventDefault()
    confirmRename(id)
  } else if (e.key === 'Escape') {
    cancelRename()
  }
}

function confirmRename(id) {
  if (renamingId.value !== id) return
  if (renameText.value.trim()) {
    store.renameConversation(id, renameText.value.trim())
  }
  renamingId.value = null
}

function cancelRename() {
  renamingId.value = null
}

function handleDeleteClick(id) {
  if (confirmingDeleteId.value !== id) {
    confirmingDeleteId.value = id
  } else {
    store.deleteConversation(id)
    confirmingDeleteId.value = null
    openMenuId.value = null
  }
}

function closeMenuOnOutsideClick(e) {
  openMenuId.value = null
  confirmingDeleteId.value = null
}

// F2: Tag editor handlers
function handleTagEdit(id) {
  openMenuId.value = null
  tagEditingId.value = id
  const conv = store.conversations[id]
  editTags.value = conv?.tags ? [...conv.tags] : []
  tagInputText.value = ''
  nextTick(() => {
    const input = document.querySelector('.tag-editor-input')
    input?.focus()
  })
}

function onTagInputKeydown(id, e) {
  if (e.key === 'Enter') {
    e.preventDefault()
    addTag(id)
  } else if (e.key === ',' || e.key === '，') {
    e.preventDefault()
    addTag(id)
  } else if (e.key === 'Escape') {
    cancelTagEdit()
  }
}

function addTag(id, tag) {
  const t = (tag || tagInputText.value).trim()
  if (!t) return
  if (!editTags.value.includes(t)) {
    editTags.value.push(t)
  }
  tagInputText.value = ''
}

function removeTag(id, index) {
  editTags.value.splice(index, 1)
}

function confirmTags(id) {
  store.setConversationTags(id, editTags.value)
  tagEditingId.value = null
  editTags.value = []
  tagInputText.value = ''
}

function cancelTagEdit() {
  tagEditingId.value = null
  editTags.value = []
  tagInputText.value = ''
}

watch(() => store.sidebarCollapsed, (val) => {
  if (val) {
    if (renamingId.value) cancelRename()
    if (tagEditingId.value) cancelTagEdit()
  }
})

// Sync mobileSidebarOpen -> clear local editing state
watch(() => store.mobileSidebarOpen, (val) => {
  if (!val) {
    if (renamingId.value) cancelRename()
    if (tagEditingId.value) cancelTagEdit()
  }
})

// F3: Search panel
const searchInputRef = ref(null)

const groupedSearchResults = computed(() => {
  const results = store.searchResults
  if (!results.length) return []
  const groups = {}
  results.forEach(r => {
    if (!groups[r.convId]) {
      groups[r.convId] = { convId: r.convId, convName: r.convName, results: [] }
    }
    groups[r.convId].results.push(r)
  })
  return Object.values(groups)
})

function toggleSearchPanel() {
  store.searchPanelOpen = !store.searchPanelOpen
  if (store.searchPanelOpen) {
    store.searchQuery = ''
    nextTick(() => searchInputRef.value?.focus())
  }
}

function onSearchInput() {
  // reactive via v-model, no extra logic needed
}

function closeStatsOnOutsideClick(e) {
  if (statsOpen.value) {
    const el = document.querySelector('.sidebar-stats')
    if (el && !el.contains(e.target)) {
      statsOpen.value = false
    }
  }
}

onMounted(() => {
  document.addEventListener('click', closeMenuOnOutsideClick)
  document.addEventListener('click', closeStatsOnOutsideClick)
})
onUnmounted(() => {
  document.removeEventListener('click', closeMenuOnOutsideClick)
  document.removeEventListener('click', closeStatsOnOutsideClick)
})
</script>

<style scoped>
.sidebar-resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 4px;
  height: 100%;
  cursor: col-resize;
  background: transparent;
  transition: background 0.15s;
  z-index: 10000;
}

.sidebar-resize-handle:hover,
.sidebar-resize-handle:active {
  background: var(--primary-color);
}

/* F1: Star button */
.star-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 2px 4px;
  flex-shrink: 0;
  color: var(--text-light);
  transition: color 0.2s, transform 0.15s;
  line-height: 1;
}

.star-btn:hover {
  transform: scale(1.2);
  color: #faad14;
}

.star-btn.starred {
  color: #faad14;
}

/* F2: Tag filter bar */
.sidebar-tag-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-color);
}

.tag-chip {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-white);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.tag-chip:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.tag-chip.active {
  background: var(--primary-color);
  color: #fff;
  border-color: var(--primary-color);
}

/* F2: Tag badges on conversation items */
.conversation-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 2px;
}

.tag-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--primary-light);
  color: var(--primary-color);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.tag-badge:hover {
  background: var(--primary-color);
  color: #fff;
}

/* F2: Inline tag editor */
.tag-editor {
  padding: 8px 10px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-gray-light);
}

.tag-editor-header {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.tag-editor-input-row {
  display: flex;
  gap: 4px;
}

.tag-editor-input {
  flex: 1;
  font-size: 12px;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--input-bg);
  color: var(--text-main);
  outline: none;
}

.tag-editor-input:focus {
  border-color: var(--primary-color);
}

.tag-editor-add-btn {
  padding: 4px 10px;
  font-size: 14px;
  border: 1px solid var(--primary-color);
  border-radius: var(--radius-sm);
  background: var(--primary-color);
  color: #fff;
  cursor: pointer;
}

.tag-editor-add-btn:hover {
  background: var(--primary-hover);
}

.tag-editor-list {
  margin-top: 6px;
}

.tag-editor-current {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-editor-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 8px;
  background: var(--primary-light);
  color: var(--primary-color);
}

.tag-remove-btn {
  background: none;
  border: none;
  font-size: 13px;
  cursor: pointer;
  color: var(--text-light);
  padding: 0;
  line-height: 1;
}

.tag-remove-btn:hover {
  color: var(--text-danger);
}

.tag-editor-suggestions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  padding-top: 4px;
  border-top: 1px solid var(--border-light);
}

.tag-editor-suggest-label {
  font-size: 10px;
  color: var(--text-light);
  margin-right: 2px;
}

.tag-suggest-btn {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  border: 1px dashed var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.tag-suggest-btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
  background: var(--primary-light);
}

.tag-editor-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.tag-editor-done-btn {
  flex: 1;
  padding: 4px 0;
  font-size: 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--primary-color);
  color: #fff;
  cursor: pointer;
}

.tag-editor-done-btn:hover {
  background: var(--primary-hover);
}

.tag-editor-cancel-btn {
  flex: 1;
  padding: 4px 0;
  font-size: 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.tag-editor-cancel-btn:hover {
  background: var(--bg-gray);
}

/* F5: Stats panel */
.sidebar-stats {
  border-top: 1px solid var(--border-color);
  background: var(--bg-gray-light);
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}

.stats-header:hover {
  color: var(--text-main);
}

.stats-toggle {
  font-size: 10px;
  transition: transform 0.2s;
}

.stats-body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.35s ease;
}

.stats-body.expanded {
  max-height: 500px;
}

.stats-body-inner {
  padding: 4px 12px 10px;
}

.stats-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 0;
  font-size: 12px;
}

.stats-label {
  color: var(--text-secondary);
}

.stats-value {
  color: var(--text-main);
  font-weight: 600;
}

.stats-model-section {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--border-light);
}

.stats-model-section-title {
  font-size: 11px;
  color: var(--text-light);
  margin-bottom: 2px;
}

.stats-model-name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Adjust conversation-item layout for star button */
.conversation-item {
  display: flex;
  align-items: flex-start;
  gap: 2px;
}

.conversation-info {
  flex: 1;
  min-width: 0;
}

/* F3: Message search panel */
.sidebar-msg-search-toggle {
  padding: 4px 10px;
  border-bottom: 1px solid var(--border-color);
}

.msg-search-btn {
  width: 100%;
  padding: 5px 8px;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}

.msg-search-btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
  background: var(--primary-light);
}

.sidebar-msg-search-panel {
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-gray-light);
}

.msg-search-input-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
}

.msg-search-input {
  flex: 1;
  font-size: 12px;
  padding: 5px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--input-bg);
  color: var(--text-main);
  outline: none;
}

.msg-search-input:focus {
  border-color: var(--primary-color);
}

.msg-search-clear {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: var(--text-light);
  padding: 0 4px;
}

.msg-search-clear:hover {
  color: var(--text-danger);
}

.msg-search-results {
  max-height: 300px;
  overflow-y: auto;
}

.msg-search-empty {
  padding: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--text-light);
}

.msg-search-result-count {
  padding: 4px 10px;
  font-size: 11px;
  color: var(--text-light);
}

.msg-search-group {
  border-top: 1px solid var(--border-light);
}

.msg-search-group-title {
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--primary-color);
  cursor: pointer;
  transition: background 0.1s;
}

.msg-search-group-title:hover {
  background: var(--primary-light);
}

.msg-search-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 4px 10px 4px 20px;
  cursor: pointer;
  transition: background 0.1s;
}

.msg-search-item:hover {
  background: var(--primary-light);
}

.msg-search-item-role {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 18px;
}

.msg-search-item-content {
  font-size: 12px;
  color: var(--text-main);
  word-break: break-all;
  line-height: 1.4;
}

/* U4: Drag states */
.conversation-item[draggable="true"] {
  cursor: grab;
}

.conversation-item[draggable="true"]:active {
  cursor: grabbing;
}

.conversation-item.dragging {
  opacity: 0.4;
}

.conversation-item.drag-over {
  border-color: var(--primary-color);
  border-style: dashed;
  background: var(--primary-light);
}
</style>
