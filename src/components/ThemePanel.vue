<template>
  <div class="theme-selector" :class="{ open: store.themePanelOpen }" @click.stop>
    <div class="theme-selector-inner">
      <div class="theme-section-title">预设主题</div>
      <div class="theme-grid">
        <div v-for="(t, id) in THEMES" :key="id"
          class="theme-card"
          :class="{ active: store.currentTheme === id && !store.customColor }"
          @click="store.selectTheme(id)">
          <div class="theme-swatch" :style="{ background: t.vars['--primary-color'] }"></div>
          <div class="theme-name">{{ t.emoji }} {{ t.name }}</div>
        </div>
      </div>
      <div class="theme-divider"></div>
      <div class="theme-section-title">自定义主题色</div>
      <div class="theme-custom-row">
        <input type="color" class="theme-color-picker" :value="store.customColor || '#1677ff'"
          @input="onColorInput">
        <input type="text" class="theme-color-text" :value="store.customColor || '#1677ff'"
          @input="onColorText" placeholder="#1677ff" spellcheck="false">
        <button class="theme-apply-btn" @click="applyColor">应用</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useChatStore } from '@/stores/chat'
import { THEMES } from '@/constants'

const store = useChatStore()
const colorInput = ref(store.customColor || '#1677ff')

function onColorInput(e) {
  colorInput.value = e.target.value
}

function onColorText(e) {
  colorInput.value = e.target.value
}

function applyColor() {
  let c = colorInput.value.trim()
  if (/^[a-f\d]{6}$/i.test(c)) c = '#' + c
  if (/^#[a-f\d]{6}$/i.test(c)) {
    store.setCustomColor(c)
  } else {
    store.showToast('无效的颜色值，格式如 #1677ff', 'warning')
  }
}
</script>

<style scoped>
.theme-selector {
  position: fixed;
  top: 60px;
  right: 88px;
  z-index: 1001;
  background: var(--bg-white);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease-out;
  border: 1px solid var(--border-color);
  width: calc(100% - 32px);
  max-width: 340px;
}
.theme-selector.open {
  max-height: 450px;
  overflow-y: auto;
}
.theme-selector-inner {
  padding: 16px;
}
.theme-section-title {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 10px;
  font-weight: 500;
}
.theme-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}
.theme-card {
  border: 2px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 10px 8px;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
  background: var(--bg-white);
}
.theme-card:hover {
  border-color: var(--primary-color);
}
.theme-card.active {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(22,119,255,0.15);
}
.theme-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  margin: 0 auto 6px;
  border: 1px solid var(--border-light);
}
.theme-name {
  font-size: 12px;
  color: var(--text-main);
  white-space: nowrap;
}
.theme-divider {
  height: 1px;
  background: var(--border-color);
  margin: 14px 0;
}
.theme-custom-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.theme-color-picker {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  padding: 2px;
  background: var(--bg-white);
}
.theme-color-text {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 13px;
  outline: none;
  font-family: 'JetBrains Mono', monospace;
  background: var(--bg-white);
  color: var(--text-main);
}
.theme-color-text:focus {
  border-color: var(--primary-color);
}
.theme-apply-btn {
  padding: 6px 14px;
  background: var(--primary-color);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}
.theme-apply-btn:hover {
  background: var(--primary-hover);
}
</style>
