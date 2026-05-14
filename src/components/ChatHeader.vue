<template>
  <div class="chat-header">
    <button class="sidebar-toggle" id="sidebar-toggle-outer" @click="store.sidebarCollapsed = !store.sidebarCollapsed">☰</button>
    <span class="header-title">Ollama-Web-UI</span>
    <div class="header-actions">
      <div class="export-wrapper" ref="exportWrapperRef">
        <button class="header-btn export-btn" @click="exportMenuOpen = !exportMenuOpen">导出</button>
        <div class="export-dropdown" :class="{ show: exportMenuOpen }">
          <button class="export-option" @click="handleExport('json')">当前对话 (JSON)</button>
          <button class="export-option" @click="handleExport('markdown')">当前对话 (Markdown)</button>
          <button class="export-option" @click="handleExport('all')">全部对话 (JSON)</button>
        </div>
      </div>
      <button class="header-btn theme-btn" @click="store.themePanelOpen = !store.themePanelOpen">页面选项</button>
      <button class="header-btn config-btn" @click="store.configPanelOpen = !store.configPanelOpen">配置选项</button>
    </div>
    <ConfigPanel />
    <ThemePanel />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import ConfigPanel from './ConfigPanel.vue'
import ThemePanel from './ThemePanel.vue'

const store = useChatStore()
const exportMenuOpen = ref(false)
const exportWrapperRef = ref(null)

function handleExport(type) {
  exportMenuOpen.value = false
  if (type === 'json') store.exportCurrentConversationJson()
  else if (type === 'markdown') store.exportCurrentConversationMarkdown()
  else if (type === 'all') store.exportAllConversations()
}

function onDocClick(e) {
  if (exportMenuOpen.value && exportWrapperRef.value) {
    if (!exportWrapperRef.value.contains(e.target)) {
      exportMenuOpen.value = false
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
</style>
