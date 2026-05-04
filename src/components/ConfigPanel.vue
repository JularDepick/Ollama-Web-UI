<template>
  <div class="config-selector" :class="{ open: store.configPanelOpen }" @click.stop>
    <div class="config-selector-inner">
      <div class="config-item">
        <div class="config-item-row">
          <label class="config-label">服务地址</label>
          <input type="text" class="config-input" :value="store.ollamaHost" @input="onHostInput" placeholder="示例: http://192.168.1.1:114514" spellcheck="false">
        </div>
        <div id="host-error-tip" :class="{ show: hostError }">{{ hostError }}</div>
      </div>
      <div class="config-item">
        <div class="config-item-row">
          <label class="config-label">切换模型</label>
          <select class="config-input" :value="store.selectedModel" @change="onModelChange">
            <option v-if="store.models.length === 0" value="">暂无可用模型</option>
            <option v-for="m in store.models" :key="m.name" :value="m.name">{{ m.name }}</option>
          </select>
          <button class="config-btn" @click="store.loadModelList()" :disabled="!store.ollamaHost">扫描</button>
        </div>
      </div>
      <div class="config-item">
        <div class="config-item-row">
          <label class="config-label">流式速度</label>
          <input type="range" class="stream-speed-slider" min="0" max="4" step="1" :value="store.streamSpeed" @input="onSpeedChange">
          <span class="stream-speed-text">{{ CONST_CONFIG.STREAM_TEXT_MAP[store.streamSpeed] }}</span>
        </div>
      </div>
      <div class="config-item">
        <div class="config-item-row">
          <label class="config-label">定位流式输出</label>
          <input type="checkbox" class="switch-control" :checked="store.streamAutoScroll === 1" @change="onScrollChange">
          <span class="switch-text">{{ CONST_CONFIG.STREAM_AUTO_SCROLL_TEXT[store.streamAutoScroll] }}</span>
        </div>
      </div>
      <div class="config-item">
        <div class="config-item-row">
          <label class="config-label">上下文长度</label>
          <input type="range" class="context-length-slider" min="0" max="6" step="1" :value="store.contextLength" @input="onContextChange">
          <span class="context-length-text">{{ CONST_CONFIG.CONTEXT_LENGTH_TEXT_MAP[store.contextLength] }}</span>
        </div>
      </div>
      <div class="storage-collapse">
        <div class="storage-collapse-header" :class="{ expanded: storageOpen }" @click="storageOpen = !storageOpen">本地储存管理</div>
        <div class="storage-collapse-body" :class="{ expanded: storageOpen }">
          <div class="storage-btn-group">
            <button class="config-btn" @click="store.clearConfigData()">清除配置选项储存数据</button>
            <button class="config-btn danger" :class="{ 'confirm-delete': confirmingClear }" @click="handleClearAll">{{ confirmingClear ? '确认清除' : '清除所有相关储存数据' }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useChatStore } from '@/stores/chat'
import { CONST_CONFIG } from '@/constants'

const store = useChatStore()
const storageOpen = ref(false)
const hostError = ref('')
const confirmingClear = ref(false)

const hostRegex = /^https?:\/\/.+/

function onHostInput(e) {
  const val = e.target.value.trim()
  store.setOllamaHost(val)
  if (val && !hostRegex.test(val)) {
    hostError.value = '服务地址格式错误，需以 http:// 或 https:// 开头'
  } else {
    hostError.value = ''
  }
}

function onModelChange(e) {
  store.setSelectedModel(e.target.value)
}

function onSpeedChange(e) {
  store.setStreamSpeed(Number(e.target.value))
}

function onScrollChange(e) {
  store.setStreamAutoScroll(e.target.checked ? 1 : 0)
}

function onContextChange(e) {
  store.setContextLength(Number(e.target.value))
}

function handleClearAll() {
  if (!confirmingClear.value) {
    confirmingClear.value = true
    setTimeout(() => { confirmingClear.value = false }, 4000)
  } else {
    store.clearAllData()
    confirmingClear.value = false
  }
}
</script>
