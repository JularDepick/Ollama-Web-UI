import { reactive, computed } from 'vue'

// Shared singleton state — imported by both ContextMenu.vue and trigger components
export const menuState = reactive({
  visible: false,
  x: 0,
  y: 0,
  items: [],
  data: null,
  elementWidth: 0,
  elementHeight: 0
})

let menuElementRef = null

export function setMenuElement(el) {
  menuElementRef = el
}

export function openContextMenu(event, items, data = null) {
  event.preventDefault()
  event.stopPropagation()
  menuState.visible = true
  menuState.x = event.clientX
  menuState.y = event.clientY
  menuState.items = items
  menuState.data = data
  // Dimensions are measured after render for boundary adjustment
  requestAnimationFrame(() => {
    if (menuElementRef) {
      menuState.elementWidth = menuElementRef.offsetWidth
      menuState.elementHeight = menuElementRef.offsetHeight
    }
  })
}

export function closeContextMenu() {
  menuState.visible = false
  menuState.items = []
  menuState.data = null
  menuState.elementWidth = 0
  menuState.elementHeight = 0
}

export const adjustedX = computed(() => {
  if (!menuState.visible) return 0
  const w = menuState.elementWidth || 200
  return Math.min(menuState.x, window.innerWidth - w - 8)
})

export const adjustedY = computed(() => {
  if (!menuState.visible) return 0
  const h = menuState.elementHeight || 200
  return Math.min(menuState.y, window.innerHeight - h - 8)
})
