<template>
  <Teleport to="body">
    <Transition name="context-menu-transition">
      <div v-if="menuState.visible" class="context-menu-backdrop" @click="close" @contextmenu.prevent="close">
        <div ref="menuElRef" class="context-menu"
          :style="{ left: adjustedX + 'px', top: adjustedY + 'px' }"
          @click.stop @contextmenu.stop>
          <template v-for="(item, idx) in menuState.items" :key="idx">
            <div v-if="item.divider" class="context-menu-divider"></div>
            <div v-else
              class="context-menu-item"
              :class="[item.cls || '']"
              @click="executeItem(item)">
              <span v-if="item.icon" class="context-menu-icon">{{ item.icon }}</span>
              <span class="context-menu-label">{{ item.label }}</span>
              <span v-if="item.shortcut" class="context-menu-shortcut">{{ item.shortcut }}</span>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { menuState, adjustedX, adjustedY, setMenuElement, closeContextMenu } from '@/composables/useContextMenu'

const menuElRef = ref(null)

// Close on Escape
function onKeydown(e) {
  if (e.key === 'Escape' && menuState.visible) {
    closeContextMenu()
  }
}

onMounted(() => {
  setMenuElement(menuElRef.value)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  setMenuElement(null)
  document.removeEventListener('keydown', onKeydown)
})

// Update menu element reference after render
watch(menuElRef, (el) => {
  setMenuElement(el)
})

function close() {
  closeContextMenu()
}

function executeItem(item) {
  if (item.handler) {
    item.handler(menuState.data)
  }
  closeContextMenu()
}
</script>

<style scoped>
.context-menu-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99999;
  background: transparent;
}

.context-menu {
  position: fixed;
  min-width: 160px;
  max-width: 260px;
  background: var(--bg-white);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  z-index: 100000;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-main);
  transition: background 0.12s;
  white-space: nowrap;
}

.context-menu-item:hover {
  background: var(--primary-light);
  color: var(--primary-color);
}

.context-menu-item.danger {
  color: var(--text-danger);
}

.context-menu-item.danger:hover {
  background: #fff1f0;
  color: var(--text-danger);
}

.context-menu-icon {
  width: 18px;
  text-align: center;
  flex-shrink: 0;
  font-size: 14px;
}

.context-menu-label {
  flex: 1;
}

.context-menu-shortcut {
  font-size: 11px;
  color: var(--text-light);
  margin-left: 12px;
}

.context-menu-divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}

/* Transition animations */
.context-menu-transition-enter-active,
.context-menu-transition-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.context-menu-transition-enter-from {
  opacity: 0;
  transform: scale(0.95);
}

.context-menu-transition-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
