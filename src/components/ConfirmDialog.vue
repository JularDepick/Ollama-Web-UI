<template>
  <Transition name="modal-fade-slide">
    <div v-if="store.confirmVisible" class="confirm-overlay" @click.self="onCancel" @keydown="onKeydown" tabindex="-1" ref="overlayRef" role="dialog" aria-modal="true" :aria-label="store.confirmTitle">
      <div class="confirm-dialog" @click.stop>
        <div class="confirm-title" id="confirm-title">{{ store.confirmTitle }}</div>
        <div class="confirm-message" id="confirm-message">{{ store.confirmMessage }}</div>
        <div class="confirm-actions">
          <button class="confirm-btn cancel" @click="onCancel" ref="cancelBtnRef" aria-label="取消操作">取消</button>
          <button class="confirm-btn ok" @click="onConfirm" ref="okBtnRef" aria-label="确认操作">确认</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useChatStore } from '@/stores/chat'

const store = useChatStore()
const overlayRef = ref(null)
const okBtnRef = ref(null)

watch(() => store.confirmVisible, (val) => {
  if (val) {
    nextTick(() => {
      overlayRef.value?.focus()
      okBtnRef.value?.focus()
    })
  }
})

function onKeydown(e) {
  if (e.key === 'Escape') {
    onCancel()
  } else if (e.key === 'Enter') {
    onConfirm()
  }
}

function onConfirm() {
  if (store.confirmResolve) store.confirmResolve(true)
  store.confirmVisible = false
  store.confirmResolve = null
}

function onCancel() {
  if (store.confirmResolve) store.confirmResolve(false)
  store.confirmVisible = false
  store.confirmResolve = null
}
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100001;
}

.confirm-dialog {
  background: var(--bg-white);
  border-radius: var(--radius-main);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  padding: 24px;
  min-width: 300px;
  max-width: 400px;
  animation: confirmSlideIn 0.2s ease-out;
}

@keyframes confirmSlideIn {
  from { opacity: 0; transform: translateY(-10px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.confirm-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 8px;
}

.confirm-message {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 20px;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.confirm-btn {
  padding: 8px 20px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.confirm-btn.cancel {
  background: var(--bg-gray);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.confirm-btn.cancel:hover {
  background: var(--border-color);
}

.confirm-btn.ok {
  background: var(--primary-color);
  color: #fff;
}

.confirm-btn.ok:hover {
  background: var(--primary-hover);
}
</style>
