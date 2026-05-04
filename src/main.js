import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/css/main.css'
import { THEMES, THEME_STORAGE_KEY, THEME_CUSTOM_COLOR_KEY, applyThemeVars, applyCustomTheme } from '@/constants'
import { initCodeBlockCopy } from '@/utils/markdown'

// Pre-apply theme to prevent FOUC
const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'default'
const savedCustomColor = localStorage.getItem(THEME_CUSTOM_COLOR_KEY) || ''
if (savedCustomColor && savedTheme === 'custom') {
  applyCustomTheme(savedCustomColor)
} else if (THEMES[savedTheme]) {
  applyThemeVars(THEMES[savedTheme].vars)
}

const app = createApp(App)

app.config.errorHandler = (err, _instance, info) => {
  console.error(`[Vue Error] ${info}:`, err)
}

window.addEventListener('error', (e) => {
  console.error('[Uncaught Error]:', e.error?.message || e.message)
})

window.addEventListener('unhandledrejection', (e) => {
  console.error('[Unhandled Promise]:', e.reason?.message || e.reason)
})

app.use(createPinia())
app.mount('#app')

initCodeBlockCopy()
