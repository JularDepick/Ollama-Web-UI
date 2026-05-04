<template>
  <div class="chat-header">
    <button v-if="!store.sidebarCollapsed" class="sidebar-toggle" id="sidebar-toggle-inner" @click="store.sidebarCollapsed = true">☰</button>
    <button v-else class="sidebar-toggle" id="sidebar-toggle-inner" @click="store.sidebarCollapsed = false">☰</button>
    Ollama-Web-UI
    <button class="config-selector-toggle" @click="store.configPanelOpen = !store.configPanelOpen">配置选项</button>
    <ConfigPanel />
  </div>
</template>

<script setup>
import { useChatStore } from '@/stores/chat'
import ConfigPanel from './ConfigPanel.vue'
const store = useChatStore()
</script>
