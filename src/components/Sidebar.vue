<template>
  <div class="sidebar" :class="{ collapsed: store.sidebarCollapsed }">
    <div class="sidebar-header">
      <button class="sidebar-toggle" @click="store.sidebarCollapsed = true">☰</button>
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
          <div class="conversation-info" @click="store.switchConversation(id)">
            <div class="conversation-title">
              {{ store.conversations[id]?.name || '未命名' }}
            </div>
            <div class="conversation-time">
              {{ formatTime(store.conversations[id]?.updateTime) }}
            </div>
          </div>
          <button class="conversation-more" @click.stop="toggleMenu(id)">⋮</button>
          <div class="conversation-actions" :class="{ show: openMenuId === id }">
            <button class="conversation-action-btn pin-btn" @click.stop="handlePin(id)">{{ store.conversations[id]?.pinned ? '取消置顶' : '置顶' }}</button>
            <button class="conversation-action-btn rename-btn" @click.stop="handleRename(id)">重命名</button>
            <button class="conversation-action-btn delete-btn" @click.stop="handleDelete(id)">删除</button>
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
  <button v-if="store.sidebarCollapsed" class="sidebar-toggle" id="sidebar-toggle-outer" @click="store.sidebarCollapsed = false">☰</button>
</template>

<script setup>
import { ref } from 'vue'
import { useChatStore } from '@/stores/chat'
import { formatTime } from '@/utils/helpers'

const store = useChatStore()
const openMenuId = ref(null)

function toggleMenu(id) {
  openMenuId.value = openMenuId.value === id ? null : id
}

function handlePin(id) {
  store.togglePinConversation(id)
  openMenuId.value = null
}

function handleRename(id) {
  const conv = store.conversations[id]
  if (!conv) return
  const newName = prompt('输入新名称:', conv.name)
  if (newName && newName.trim()) {
    store.renameConversation(id, newName.trim())
  }
  openMenuId.value = null
}

function handleDelete(id) {
  if (confirm('确定删除此对话？')) {
    store.deleteConversation(id)
  }
  openMenuId.value = null
}

// Close menu on outside click
document.addEventListener('click', () => { openMenuId.value = null })
</script>
