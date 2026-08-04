<template>
  <div class="chat-header">
    <button class="sidebar-toggle" id="sidebar-toggle-outer" @click="store.sidebarCollapsed = !store.sidebarCollapsed" :aria-expanded="!store.sidebarCollapsed" aria-controls="sidebar" aria-label="切换侧边栏">☰</button>
    <span class="header-title">Ollama-Web-UI</span>
    <div class="header-actions">
      <!-- Connection status indicator -->
      <div class="connection-status" :class="store.connectionStatus" :title="connectionTitle">
        <span class="status-dot"></span>
        <span class="status-text">{{ connectionLabel }}</span>
      </div>
      <!-- Searchable model selector -->
      <div v-if="store.models.length > 0" class="model-selector-wrapper" ref="modelSelectorRef">
        <div class="model-selector-display" @click="toggleModelDropdown" :class="{ active: modelDropdownOpen }">
          <span class="model-selector-text">{{ store.selectedModel || '选择模型' }}</span>
          <span class="model-selector-arrow">▾</span>
        </div>
        <div v-if="modelDropdownOpen" class="model-dropdown">
          <input type="text" class="model-search-input" v-model="modelSearch" placeholder="搜索模型..." ref="modelSearchRef" @click.stop>
          <div class="model-list">
            <div v-for="m in filteredModels" :key="m" class="model-option" :class="{ selected: m === store.selectedModel }" @click="selectModel(m)">
              <span class="model-option-name">{{ m }}</span>
              <span v-if="store.modelPerformance[m]" class="model-option-perf">
                {{ store.modelPerformance[m].lastTokensPerSecond }}c/s
              </span>
            </div>
            <div v-if="filteredModels.length === 0" class="model-empty">未找到匹配模型</div>
          </div>
        </div>
      </div>
      <div class="export-wrapper" ref="exportWrapperRef">
        <button class="header-btn export-btn" @click="exportMenuOpen = !exportMenuOpen" :aria-expanded="exportMenuOpen" aria-haspopup="true" aria-label="导出选项">导出</button>
        <div class="export-dropdown" :class="{ show: exportMenuOpen }" role="menu">
          <button class="export-option" @click="handleExport('json')" role="menuitem">当前对话 (JSON)</button>
          <button class="export-option" @click="handleExport('markdown')" role="menuitem">当前对话 (Markdown)</button>
          <button class="export-option" @click="handleExport('all')" role="menuitem">全部对话 (JSON)</button>
          <button class="export-option" @click="handleExport('html')" role="menuitem">当前对话 (HTML)</button>
          <button class="export-option" @click="handleExport('print')" role="menuitem">打印/导出 PDF</button>
          <button class="export-option" @click="handleExport('text')" role="menuitem">复制对话文本</button>
          <div class="export-divider" role="separator"></div>
          <button class="export-option export-danger" @click="handleClearChat" role="menuitem">清空当前对话</button>
        </div>
      </div>
      <button class="header-btn theme-btn" @click="store.themePanelOpen = !store.themePanelOpen" :aria-expanded="store.themePanelOpen" aria-label="页面选项">页面选项</button>
      <button class="header-btn config-btn" @click="store.configPanelOpen = !store.configPanelOpen" :aria-expanded="store.configPanelOpen" aria-label="配置选项">配置选项</button>
    </div>
    <ConfigPanel />
    <ThemePanel />
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import ConfigPanel from './ConfigPanel.vue'
import ThemePanel from './ThemePanel.vue'

const store = useChatStore()
const exportMenuOpen = ref(false)
const exportWrapperRef = ref(null)
const modelDropdownOpen = ref(false)
const modelSearch = ref('')
const modelSearchRef = ref(null)
const modelSelectorRef = ref(null)

const filteredModels = computed(() => {
  const q = modelSearch.value.trim().toLowerCase()
  if (!q) return store.models
  return store.models.filter(m => m.toLowerCase().includes(q))
})

const connectionLabel = computed(() => {
  const map = { connected: '已连接', disconnected: '断开', checking: '检测中', unknown: '未配置' }
  return map[store.connectionStatus] || '未知'
})

const connectionTitle = computed(() => {
  if (!store.ollamaHost) return '请先配置 Ollama 地址'
  const map = {
    connected: `已连接: ${store.ollamaHost}`,
    disconnected: `连接断开: ${store.ollamaHost}`,
    checking: '正在检测连接...',
    unknown: '未检测连接状态'
  }
  return map[store.connectionStatus] || ''
})

function toggleModelDropdown() {
  modelDropdownOpen.value = !modelDropdownOpen.value
  if (modelDropdownOpen.value) {
    modelSearch.value = ''
    nextTick(() => modelSearchRef.value?.focus())
  }
}

function selectModel(m) {
  store.setSelectedModel(m)
  store.setCurrentModel(m)
  modelDropdownOpen.value = false
  modelSearch.value = ''
}

function handleModelChange(model) {
  store.setSelectedModel(model)
  store.setCurrentModel(model)
}

function handleExport(type) {
  exportMenuOpen.value = false
  if (type === 'json') store.exportCurrentConversationJson()
  else if (type === 'markdown') store.exportCurrentConversationMarkdown()
  else if (type === 'all') store.exportAllConversations()
  else if (type === 'html') store.exportCurrentConversationHtml()
  else if (type === 'print') store.printConversation()
  else if (type === 'text') store.copyConversationAsText()
}

function handleClearChat() {
  exportMenuOpen.value = false
  store.showConfirm('清空对话', '确认清空当前对话的所有消息？此操作不可撤销。').then(ok => {
    if (ok) store.clearCurrentChat()
  })
}

function onDocClick(e) {
  if (exportMenuOpen.value && exportWrapperRef.value) {
    if (!exportWrapperRef.value.contains(e.target)) {
      exportMenuOpen.value = false
    }
  }
  if (modelDropdownOpen.value && modelSelectorRef.value) {
    if (!modelSelectorRef.value.contains(e.target)) {
      modelDropdownOpen.value = false
    }
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<style scoped>
/* Override main.css absolute layout: use flex for header actions */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
}

.header-title {
  margin-left: 40px;
  text-align: center;
  flex: 1;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  position: fixed;
  right: 16px;
  top: 30px;
  z-index: 1002;
}

.header-btn {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 3px 10px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
  position: static;
  width: auto;
}

.header-btn.config-btn {
  margin-left: 0;
}

.header-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.header-model-select {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 12px;
  cursor: pointer;
  max-width: 140px;
  outline: none;
  transition: background 0.2s;
  appearance: auto;
}

.header-model-select:hover {
  background: rgba(255, 255, 255, 0.35);
}

.header-model-select option {
  color: #333;
  background: #fff;
}

/* Searchable model selector */
.model-selector-wrapper {
  position: relative;
}

.model-selector-display {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
  max-width: 160px;
  transition: background 0.2s;
  user-select: none;
}

.model-selector-display:hover,
.model-selector-display.active {
  background: rgba(255, 255, 255, 0.35);
}

.model-selector-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-selector-arrow {
  font-size: 10px;
  flex-shrink: 0;
}

.model-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--bg-white);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 200px;
  max-width: 300px;
  z-index: 10000;
  animation: dropdownFadeIn 0.15s ease-out;
}

@keyframes dropdownFadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.model-search-input {
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
  outline: none;
  background: var(--bg-gray);
  color: var(--text-main);
  box-sizing: border-box;
}

.model-search-input::placeholder {
  color: var(--text-light);
}

.model-list {
  max-height: 250px;
  overflow-y: auto;
  padding: 4px 0;
}

.model-option {
  padding: 6px 12px;
  font-size: 13px;
  color: var(--text-main);
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.model-option-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.model-option-perf {
  font-size: 11px;
  color: var(--text-light);
  flex-shrink: 0;
}

.model-option.selected .model-option-perf {
  color: rgba(255, 255, 255, 0.7);
}

.model-option:hover {
  background: var(--primary-light);
}

.model-option.selected {
  background: var(--primary-color);
  color: #fff;
}

.model-option.selected:hover {
  background: var(--primary-hover);
}

.model-empty {
  padding: 12px;
  text-align: center;
  font-size: 13px;
  color: var(--text-light);
}

.export-wrapper {
  position: relative;
}

.export-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--bg-white);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 180px;
  z-index: 10000;
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition: max-height 0.3s ease-out, opacity 0.2s ease-out;
  pointer-events: none;
}

.export-dropdown.show {
  max-height: 200px;
  opacity: 1;
  pointer-events: auto;
}

.export-option {
  display: block;
  width: 100%;
  padding: 10px 14px;
  border: none;
  background: transparent;
  color: var(--text-main);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.export-option:hover {
  background: var(--bg-gray);
  color: var(--primary-color);
}

.export-option + .export-option {
  border-top: 1px solid var(--border-light);
}

.export-divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}

.export-danger {
  color: var(--text-danger);
}

.export-danger:hover {
  background: rgba(245, 34, 45, 0.08);
  color: var(--text-danger);
}
</style>
