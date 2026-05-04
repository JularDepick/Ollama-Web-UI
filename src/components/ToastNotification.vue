<template>
  <div class="toast-notification" :class="{ show: store.toastVisible, ['toast-' + store.toastType]: true }">
    {{ store.toastMessage }}
  </div>
</template>

<script setup>
import { useChatStore } from '@/stores/chat'
const store = useChatStore()
</script>
