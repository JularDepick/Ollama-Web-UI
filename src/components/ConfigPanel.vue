<template>
  <div class="config-selector" :class="{ open: store.configPanelOpen }" @click.stop="onConfigAreaClick">
    <div class="config-selector-inner">
      <!-- Tab Bar with animated indicator -->
      <div class="config-tabs" ref="tabsRef">
        <button class="config-tab" :class="{ active: activeTab === 0 }" @click="switchTab(0)" ref="tab0Ref">基本设置</button>
        <button class="config-tab" :class="{ active: activeTab === 1 }" @click="switchTab(1)" ref="tab1Ref">高级设置</button>
        <div class="config-tab-indicator" :style="tabIndicatorStyle"></div>
      </div>

      <!-- Tab Panels: always rendered in DOM, fade transition via opacity -->
      <div class="tab-panels">
        <!-- 基本设置 -->
        <div class="tab-panel" :class="{ active: activeTab === 0 }">
          <div class="config-item">
            <div class="config-item-row">
              <label class="config-label">服务地址</label>
              <div class="host-select-wrapper">
                <div class="host-select-row">
                  <div class="host-select-trigger-wrap">
                    <button class="config-input host-select-trigger" @click="hostDropdownOpen = !hostDropdownOpen">
                      <span>{{ store.ollamaHost || '选择服务地址...' }}</span>
                      <span class="host-select-arrow">▾</span>
                    </button>
                    <div class="host-select-dropdown" v-if="hostDropdownOpen">
                      <div v-if="store.hostHistory.length === 0" class="host-select-empty">暂无历史地址</div>
                      <div v-for="h in store.hostHistory" :key="h" class="host-select-item" :class="{ active: h === store.ollamaHost }" @mousedown.prevent="onHostSelect(h)">
                        <span class="host-select-name">{{ h }}</span>
                        <span class="host-select-del" @mousedown.stop.prevent="onHostDelete(h)" title="删除">×</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="host-add-row">
              <input type="text" class="host-add-input" v-model="customHostInput" placeholder="例如 http://127.0.0.1:114514" size="26" @keydown="onHostAddKeydown" spellcheck="false">
              <button class="config-btn" @click="handleAddHost" :disabled="!customHostInput.trim()">添加</button>
            </div>
            <div id="host-error-tip" :class="{ show: hostError }">{{ hostError }}</div>
          </div>
          <div class="config-item">
            <div class="config-item-row">
              <label class="config-label">切换模型</label>
              <div class="model-select-wrapper">
                <div class="model-select-row">
                  <div class="model-select-trigger-wrap">
                    <button class="config-input model-select-trigger" @click="modelDropdownOpen = !modelDropdownOpen">
                      <span>{{ store.selectedModel || '选择模型...' }}</span>
                      <span class="model-select-arrow">▾</span>
                    </button>
                    <div class="model-select-dropdown" v-if="modelDropdownOpen">
                      <div v-if="store.models.length === 0" class="model-select-empty">暂无可用模型</div>
                      <div v-for="m in store.models" :key="m" class="model-select-item" :class="{ active: m === store.selectedModel }" @mousedown.prevent="selectModel(m)">
                        <span class="model-select-name">{{ m }}</span>
                        <span class="model-select-del" @mousedown.stop.prevent="deleteModel(m)" title="删除">×</span>
                      </div>
                    </div>
                  </div>
                  <button class="config-btn" @click="store.loadModelList()" :disabled="!store.ollamaHost || store.isLoadingModels">{{ store.isLoadingModels ? '加载中...' : '扫描' }}</button>
                </div>
              </div>
            </div>
            <!-- U6: Model loading error state -->
            <div v-if="store.modelLoadError && store.models.length === 0 && !store.isLoadingModels" class="model-error-row">
              <span class="model-error-text">加载失败: {{ store.modelLoadError }}</span>
              <button class="model-retry-btn" @click="store.loadModelList()">重试</button>
            </div>
            <!-- U6: Loading spinner -->
            <div v-if="store.isLoadingModels" class="model-loading-row">
              <span class="model-loading-spinner"></span>
              <span class="model-loading-text">正在扫描模型列表...</span>
            </div>
            <!-- Add custom model -->
            <div class="model-add-row">
              <input type="text" class="model-add-input" v-model="customModelInput" placeholder="输入自定义模型名称..." @keydown="onCustomModelKeydown" spellcheck="false">
              <button class="config-btn" @click="handleAddCustomModel" :disabled="!customModelInput.trim()">添加</button>
            </div>
          </div>

          <!-- 流式速度 -->
          <div class="config-item">
            <div class="config-item-row">
              <label class="config-label">流式速度</label>
              <input type="range" class="stream-speed-slider" min="0" max="4" step="1" :value="store.streamSpeed" @input="onSpeedChange">
              <span class="stream-speed-text">{{ CONST_CONFIG.STREAM_TEXT_MAP[store.streamSpeed] }}</span>
            </div>
          </div>

          <!-- 定位流式输出 -->
          <div class="config-item">
            <div class="config-item-row">
              <label class="config-label">定位流式输出</label>
              <input type="checkbox" class="switch-control" :checked="store.streamAutoScroll === 1" @change="onScrollChange">
              <span class="switch-text">{{ CONST_CONFIG.STREAM_AUTO_SCROLL_TEXT[store.streamAutoScroll] }}</span>
            </div>
          </div>

          <!-- 上下文长度 -->
          <div class="config-item">
            <div class="config-item-row">
              <label class="config-label">上下文长度</label>
              <input type="range" class="context-length-slider" min="0" max="6" step="1" :value="store.contextLength" @input="onContextChange">
              <span class="context-length-text">{{ CONST_CONFIG.CONTEXT_LENGTH_TEXT_MAP[store.contextLength] }}</span>
            </div>
          </div>

          <!-- 本地储存管理 -->
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

        <!-- 高级设置 -->
        <div class="tab-panel" :class="{ active: activeTab === 1 }">
          <!-- B5: 系统提示词 -->
          <div class="config-item">
            <label class="config-label">系统提示词</label>
            <textarea class="system-prompt-textarea" :value="currentSystemPrompt" @input="onSystemPromptChange" placeholder="设置 AI 的角色、行为规范或输出格式，留空则不注入" spellcheck="false" rows="3"></textarea>
          </div>

          <div class="param-divider"></div>

          <!-- B4: 模型参数 -->
          <div class="config-item">
            <div class="config-item-row">
              <label class="config-label">温度 (Temperature)</label>
              <span class="param-value">{{ currentTemperature.toFixed(1) }}</span>
            </div>
            <input type="range" class="param-slider" min="0" max="200" step="1" :value="currentTemperature * 100" @input="onTemperatureChange">
            <div class="param-range-labels">
              <span>精确</span>
              <span>创造性</span>
            </div>
          </div>

          <div class="config-item">
            <div class="config-item-row">
              <label class="config-label">Top-P</label>
              <span class="param-value">{{ currentTopP.toFixed(2) }}</span>
            </div>
            <input type="range" class="param-slider" min="0" max="100" step="1" :value="currentTopP * 100" @input="onTopPChange">
            <div class="param-range-labels">
              <span>0</span>
              <span>1</span>
            </div>
          </div>

          <div class="config-item">
            <div class="config-item-row">
              <label class="config-label">Top-K</label>
              <span class="param-value">{{ currentTopK }}</span>
            </div>
            <input type="range" class="param-slider" min="0" max="100" step="1" :value="currentTopK" @input="onTopKChange">
            <div class="param-range-labels">
              <span>0</span>
              <span>100</span>
            </div>
          </div>

          <div class="config-item">
            <div class="config-item-row">
              <label class="config-label">重复惩罚 (Repeat Penalty)</label>
              <span class="param-value">{{ currentRepeatPenalty.toFixed(1) }}</span>
            </div>
            <input type="range" class="param-slider" min="0" max="200" step="1" :value="currentRepeatPenalty * 100" @input="onRepeatPenaltyChange">
            <div class="param-range-labels">
              <span>0</span>
              <span>2</span>
            </div>
          </div>

          <!-- F4: 模型参数预设 -->
          <div class="config-item preset-section">
            <div class="config-item-row">
              <label class="config-label">参数预设</label>
              <span class="param-value">{{ activePresetName }}</span>
            </div>
            <div class="preset-list">
              <button v-for="preset in store.currentPresets" :key="preset.id"
                class="preset-chip"
                :class="{ active: isPresetActive(preset), builtin: preset.builtin }"
                @click="store.applyPreset(preset)"
                :title="preset.builtin ? '系统预设（不可删除）' : '点击应用，右键删除'">
                {{ preset.name }}
                <span v-if="!preset.builtin" class="preset-remove" @click.stop="store.deletePreset(preset.id)" title="删除预设">×</span>
              </button>
            </div>
            <div class="preset-save-row">
              <input type="text" class="preset-name-input" v-model="presetNameInput"
                placeholder="输入预设名称..." @keydown="onPresetNameKeydown" spellcheck="false">
              <button class="preset-save-btn" @click="handleSavePreset" :disabled="!presetNameInput.trim()">保存当前参数</button>
            </div>
          </div>

          <div class="param-divider"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import { CONST_CONFIG } from '@/constants'

const store = useChatStore()
const activeTab = ref(0)
const tabsRef = ref(null)
const tab0Ref = ref(null)
const tab1Ref = ref(null)

function switchTab(idx) {
  activeTab.value = idx
}

const tabIndicatorStyle = computed(() => {
  const tabs = [tab0Ref.value, tab1Ref.value]
  const el = tabs[activeTab.value]
  if (!el || !tabsRef.value) return { left: '0px', width: '0px' }
  const containerRect = tabsRef.value.getBoundingClientRect()
  const tabRect = el.getBoundingClientRect()
  return {
    left: (tabRect.left - containerRect.left) + 'px',
    width: tabRect.width + 'px'
  }
})
const storageOpen = ref(false)
const hostError = ref('')
const confirmingClear = ref(false)
const customModelInput = ref('')
const customHostInput = ref('')
const hostDropdownOpen = ref(false)
const modelDropdownOpen = ref(false)

// B5: System prompt (reactive via computed — follows conversation switch)
const currentSystemPrompt = computed(() => store.currentConversation?.systemPrompt ?? '')

// B4: Model parameters (per-conversation)
const currentTemperature = computed(() => store.currentConversation?.temperature ?? 0.7)
const currentTopP = computed(() => store.currentConversation?.topP ?? 0.9)
const currentTopK = computed(() => store.currentConversation?.topK ?? 40)
const currentRepeatPenalty = computed(() => store.currentConversation?.repeatPenalty ?? 1.1)

const presetNameInput = ref('')

// F4: Check if a preset matches current parameters
function isPresetActive(preset) {
  return currentTemperature.value === preset.temperature
    && currentTopP.value === preset.topP
    && currentTopK.value === preset.topK
    && currentRepeatPenalty.value === preset.repeatPenalty
}

const activePresetName = computed(() => {
  const conv = store.currentConversation
  if (!conv) return ''
  const match = store.currentPresets.find(p =>
    conv.temperature === p.temperature &&
    conv.topP === p.topP &&
    conv.topK === p.topK &&
    conv.repeatPenalty === p.repeatPenalty
  )
  return match ? match.name : '自定义'
})

function handleSavePreset() {
  const name = presetNameInput.value.trim()
  if (!name) return
  store.savePreset(name)
  presetNameInput.value = ''
}

function onPresetNameKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault()
    handleSavePreset()
  }
}

const hostRegex = /^https?:\/\/.+/

function handleAddCustomModel() {
  const name = customModelInput.value.trim()
  if (!name) return
  if (store.addCustomModel(name)) {
    customModelInput.value = ''
  }
}

function onCustomModelKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault()
    handleAddCustomModel()
  }
}

function onHostSelect(host) {
  store.setOllamaHost(host)
  store.addHostToHistory(host)
  store.models = []
  store.selectedModel = ''
  hostDropdownOpen.value = false
  hostError.value = ''
  store.loadModelList()
}

function onHostDelete(host) {
  store.removeHostFromHistory(host)
}

function handleAddHost() {
  const val = customHostInput.value.trim()
  if (!val) return
  if (!hostRegex.test(val)) {
    hostError.value = '服务地址格式错误，需以 http:// 或 https:// 开头'
    return
  }
  hostError.value = ''
  store.setOllamaHost(val)
  store.addHostToHistory(val)
  store.models = []
  store.selectedModel = ''
  customHostInput.value = ''
  store.loadModelList()
}

function onHostAddKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault()
    handleAddHost()
  }
}

function selectModel(name) {
  store.setSelectedModel(name)
  store.setCurrentModel(name)
  modelDropdownOpen.value = false
}

function deleteModel(name) {
  store.removeModel(name)
}

function onConfigAreaClick(e) {
  if (modelDropdownOpen.value) {
    const wrapper = document.querySelector('.model-select-wrapper')
    if (wrapper && !wrapper.contains(e.target)) {
      modelDropdownOpen.value = false
    }
  }
  if (hostDropdownOpen.value) {
    const wrapper = document.querySelector('.host-select-wrapper')
    if (wrapper && !wrapper.contains(e.target)) {
      hostDropdownOpen.value = false
    }
  }
}

function onDocClick(e) {
  const el = document.querySelector('.config-selector')
  if (el && !el.contains(e.target)) {
    hostDropdownOpen.value = false
    modelDropdownOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))

function onSpeedChange(e) {
  store.setStreamSpeed(Number(e.target.value))
}

function onScrollChange(e) {
  store.setStreamAutoScroll(e.target.checked ? 1 : 0)
}

function onContextChange(e) {
  store.setContextLength(Number(e.target.value))
}

// B5 handlers
function onSystemPromptChange(e) {
  store.setSystemPrompt(e.target.value)
}

// B4 handlers
function onTemperatureChange(e) {
  store.setTemperature(Number(e.target.value) / 100)
}

function onTopPChange(e) {
  store.setTopP(Number(e.target.value) / 100)
}

function onTopKChange(e) {
  store.setTopK(Number(e.target.value))
}

function onRepeatPenaltyChange(e) {
  store.setRepeatPenalty(Number(e.target.value) / 100)
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

<style scoped>
.config-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 16px;
  border-bottom: 2px solid var(--border-color);
  position: relative;
}

.config-tab {
  flex: 1;
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  font-weight: 500;
  transition: color 0.2s ease;
  position: relative;
  z-index: 1;
}

.config-tab:hover {
  color: var(--text-main);
}

.config-tab.active {
  color: var(--primary-color);
  font-weight: 600;
}

/* Animated underline indicator */
.config-tab-indicator {
  position: absolute;
  bottom: -2px;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--primary-color);
  transition: left 0.25s cubic-bezier(0.4, 0, 0.2, 1), width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 2;
}

/* Tab Panels — fade transition, always in DOM */
.tab-panels {
  position: relative;
}

.tab-panel {
  transition: opacity 0.25s ease, visibility 0.25s ease;
  opacity: 0;
  visibility: hidden;
  position: absolute;
  width: 100%;
  top: 0;
  left: 0;
}

.tab-panel.active {
  opacity: 1;
  visibility: visible;
  position: relative;
}

/* B5: System Prompt Textarea */
.system-prompt-textarea {
  width: 100%;
  min-height: 72px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--input-bg);
  color: var(--text-main);
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s;
  line-height: 1.5;
}

.system-prompt-textarea:focus {
  border-color: var(--primary-color);
}

/* B4: Parameter Sliders */
.param-slider {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--border-color);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  margin: 8px 0 2px;
}

.param-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--primary-color);
  cursor: pointer;
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.param-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary-color);
  min-width: 36px;
  text-align: right;
}

.param-range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-light);
  padding: 0 2px;
}

.param-divider {
  height: 1px;
  background: var(--border-color);
  margin: 12px 0;
}

/* F4: Preset Section */
.preset-section {
  margin-bottom: 8px;
}

.preset-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 6px 0;
}

.preset-chip {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-white);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.preset-chip:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.preset-chip.active {
  background: var(--primary-color);
  color: #fff;
  border-color: var(--primary-color);
}

.preset-chip.builtin {
  border-style: dashed;
}

.preset-remove {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-light);
  cursor: pointer;
  line-height: 1;
  padding: 0 0 0 2px;
}

.preset-remove:hover {
  color: var(--text-danger);
}

.preset-save-row {
  display: flex;
  gap: 4px;
  margin-top: 6px;
}

.preset-name-input {
  flex: 1;
  font-size: 12px;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--input-bg);
  color: var(--text-main);
  outline: none;
}

.preset-name-input:focus {
  border-color: var(--primary-color);
}

.preset-save-btn {
  font-size: 11px;
  padding: 4px 8px;
  border: 1px solid var(--primary-color);
  border-radius: var(--radius-sm);
  background: var(--primary-color);
  color: #fff;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s;
}

.preset-save-btn:hover {
  background: var(--primary-hover);
}

.preset-save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* U6: Model loading/error states */
.model-error-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0 0 90px;
  font-size: 12px;
}

.model-error-text {
  color: var(--text-danger);
  flex: 1;
  word-break: break-all;
}

.model-retry-btn {
  padding: 3px 10px;
  border: 1px solid var(--primary-color);
  border-radius: var(--radius-sm);
  background: var(--bg-white);
  color: var(--primary-color);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}

.model-retry-btn:hover {
  background: var(--primary-color);
  color: #fff;
}

.model-loading-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0 0 90px;
  font-size: 12px;
  color: var(--text-secondary);
}

.model-loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: modelSpinner 0.6s linear infinite;
  flex-shrink: 0;
}

.model-loading-text {
  color: var(--text-secondary);
}

@keyframes modelSpinner {
  to { transform: rotate(360deg); }
}

/* Host select dropdown (matches model selector style) */
.host-select-wrapper {
  flex: 1;
}

.host-select-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.host-select-trigger-wrap {
  position: relative;
  display: inline-flex;
}

.host-select-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 8px 12px;
  text-align: left;
  font-size: 14px;
  font-family: inherit;
  color: var(--text-main);
  width: auto;
  min-width: 80px;
}

.host-select-trigger span:first-child {
  flex: 1;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.host-select-arrow {
  font-size: 10px;
  color: var(--text-light);
  flex-shrink: 0;
}

.host-select-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 2px;
  background: var(--bg-white);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
  min-width: 100%;
  width: auto;
  white-space: nowrap;
}

.host-select-empty {
  padding: 10px;
  text-align: center;
  color: var(--text-light);
  font-size: 13px;
}

.host-select-item {
  display: flex;
  align-items: center;
  padding: 7px 10px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-main);
  transition: background 0.15s;
}

.host-select-item:hover {
  background: var(--bg-gray);
}

.host-select-item.active {
  color: var(--primary-color);
  font-weight: 600;
}

.host-select-name {
  flex: 1;
  word-break: break-all;
}

.host-select-del {
  flex-shrink: 0;
  width: 20px;
  text-align: center;
  color: var(--text-light);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  line-height: 1;
}

.host-select-del:hover {
  color: var(--text-danger);
}

.host-add-row {
  display: flex;
  gap: 4px;
  margin-top: 6px;
  margin-left: 102px;
}

.host-add-input {
  flex: none;
  font-size: 12px;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--input-bg);
  color: var(--text-main);
  outline: none;
  min-width: 160px;
}

.host-add-input:focus {
  border-color: var(--primary-color);
}

/* Model select dropdown */
.model-select-wrapper {
  flex: 1;
}

.model-select-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-select-trigger-wrap {
  position: relative;
  display: inline-flex;
}

.model-select-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 8px 12px;
  text-align: left;
  font-size: 14px;
  font-family: inherit;
  color: var(--text-main);
  width: auto;
  min-width: 80px;
}

.model-select-trigger span:first-child {
  flex: 1;
  text-align: center;
}

.model-select-arrow {
  font-size: 10px;
  color: var(--text-light);
  flex-shrink: 0;
}

.model-select-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 2px;
  background: var(--bg-white);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
  min-width: 100%;
  width: auto;
  white-space: nowrap;
}

.model-select-empty {
  padding: 10px;
  text-align: center;
  color: var(--text-light);
  font-size: 13px;
}

.model-select-item {
  display: flex;
  align-items: center;
  padding: 7px 10px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-main);
  transition: background 0.15s;
}

.model-select-item:hover {
  background: var(--bg-gray);
}

.model-select-item.active {
  color: var(--primary-color);
  font-weight: 600;
}

.model-select-name {
  flex: 1;
  word-break: break-all;
}

.model-select-del {
  flex-shrink: 0;
  width: 20px;
  text-align: center;
  color: var(--text-light);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  line-height: 1;
}

.model-select-del:hover {
  color: var(--text-danger);
}

.model-add-row {
  display: flex;
  gap: 4px;
  margin-top: 6px;
  margin-left: 102px;
}

.model-add-input {
  flex: 1;
  font-size: 12px;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--input-bg);
  color: var(--text-main);
  outline: none;
}

.model-add-input:focus {
  border-color: var(--primary-color);
}
</style>
