<template>
  <Transition name="toast-slide">
    <div v-if="store.toastVisible" class="toast-notification" :class="'toast-' + store.toastType">
      <span class="toast-icon">{{ toastIcon }}</span>
      <span class="toast-message">{{ store.toastMessage }}</span>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { useChatStore } from '@/stores/chat'

const store = useChatStore()

const toastIcon = computed(() => {
  switch (store.toastType) {
    case 'success': return '✓'
    case 'error': return '✕'
    case 'warning': return '⚠'
    default: return 'ℹ'
  }
})
</script>

<style scoped>
.toast-notification {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  color: #fff;
  z-index: 100000;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-width: 90%;
  white-space: nowrap;
}

.toast-icon {
  font-size: 16px;
  font-weight: bold;
  flex-shrink: 0;
}

.toast-message {
  overflow: hidden;
  text-overflow: ellipsis;
}

.toast-info {
  background: var(--primary-color);
}

.toast-success {
  background: #52c41a;
}

.toast-warning {
  background: #faad14;
}

.toast-error {
  background: #ff4d4f;
}

/* Transition */
.toast-slide-enter-active {
  animation: toastSlideIn 0.3s ease-out;
}

.toast-slide-leave-active {
  animation: toastSlideOut 0.2s ease-in;
}

@keyframes toastSlideIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

@keyframes toastSlideOut {
  from {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  to {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }
}
</style>
