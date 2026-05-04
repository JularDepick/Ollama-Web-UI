<template>
  <div class="sidebar" :class="{ collapsed: store.sidebarCollapsed }">
    <div class="sidebar-header">
      <button class="sidebar-toggle" id="sidebar-toggle-inner" @click="store.sidebarCollapsed = true">☰</button>
      <div class="sidebar-title">对话记录</div>
      <div class="sidebar-controls">
        <button class="sidebar-btn new-btn" title="新建对话" @click="store.createNewConversation()">+</button>
      </div>
    </div>
    <div class="sidebar-search">
      <input type="text" class="sidebar-search-input" placeholder="搜索对话..." v-model="store.conversationSearchTerm" @click.stop>
    </div>
    <div class="conversations-list">
      <template v-if="store.filteredConversationIds.length > 0">
        <div v-for="id in store.filteredConversationIds" :key="id"
          class="conversation-item"
          :class="{
            active: id === store.currentConversationId,
            pinned: store.conversations[id]?.pinned && !store.conversations[id]?.tempPinned,
            'temp-pinned': store.conversations[id]?.tempPinned
          }">
          <div class="conversation-info" @click="renamingId === id ? null : store.switchConversation(id)">
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
            <div class="conversation-time">
              {{ formatTime(store.conversations[id]?.updateTime) }}
            </div>
          </div>
          <button class="conversation-more" @click.stop="toggleMenu(id)">⋮</button>
          <div class="conversation-actions" :class="{ show: openMenuId === id }">
            <button class="conversation-action-btn pin-btn" @click.stop="handlePin(id)">{{ store.conversations[id]?.pinned ? '取消置顶' : '置顶' }}</button>
            <button class="conversation-action-btn rename-btn" @click.stop="handleRename(id)">重命名</button>
            <button :class="['conversation-action-btn', confirmingDeleteId === id ? 'confirm-delete' : 'delete-btn']" @click.stop="handleDeleteClick(id)">{{ confirmingDeleteId === id ? '确认删除' : '删除' }}</button>
          </div>
        </div>
      </template>
      <div v-else-if="store.conversationSearchTerm" class="sidebar-empty">无匹配对话</div>
      <div v-else class="empty-state">
        <div class="empty-state-icon">💬</div>
        <div class="empty-state-title">开始对话</div>
        <div class="empty-state-hint">点击右下角 + 新建对话<br>或配置 Ollama 地址后直接发送消息</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import { formatTime } from '@/utils/helpers'

const store = useChatStore()
const openMenuId = ref(null)
const confirmingDeleteId = ref(null)
const renamingId = ref(null)
const renameText = ref('')

function toggleMenu(id) {
  openMenuId.value = openMenuId.value === id ? null : id
  if (openMenuId.value !== id) confirmingDeleteId.value = null
}

function handlePin(id) {
  store.togglePinConversation(id)
  openMenuId.value = null
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

watch(() => store.sidebarCollapsed, (val) => {
  if (val && renamingId.value) cancelRename()
})
onMounted(() => document.addEventListener('click', closeMenuOnOutsideClick))
onUnmounted(() => document.removeEventListener('click', closeMenuOnOutsideClick))
</script>
