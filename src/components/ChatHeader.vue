<template>
  <div class="chat-header">
    <button class="sidebar-toggle" id="sidebar-toggle-outer" @click="store.sidebarCollapsed = !store.sidebarCollapsed">☰</button>
    Ollama-Web-UI
    <button class="theme-selector-toggle" @click="store.themePanelOpen = !store.themePanelOpen">页面选项</button>
    <button class="config-selector-toggle" @click="store.configPanelOpen = !store.configPanelOpen">配置选项</button>
    <ConfigPanel />
    <ThemePanel />
  </div>
</template>

<script setup>
import { useChatStore } from '@/stores/chat'
import ConfigPanel from './ConfigPanel.vue'
import ThemePanel from './ThemePanel.vue'
const store = useChatStore()
</script>
