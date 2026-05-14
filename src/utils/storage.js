import { STORAGE_KEYS } from '@/constants'

// ---------- Write Cache (skip-unchanged) ----------
const _writeCache = {}

// ---------- Generic Storage Helpers ----------
export function loadJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function saveJSON(key, value) {
  try {
    const serialized = JSON.stringify(value)
    if (_writeCache[key] === serialized) return true
    localStorage.setItem(key, serialized)
    _writeCache[key] = serialized
    return true
  } catch (e) {
    const msg = e.name === 'QuotaExceededError' || e.code === 22
      ? '存储空间已满，请清理旧数据或导出备份'
      : '保存失败: ' + e.message
    console.error(msg)
    return false
  }
}

export function removeItem(key) {
  localStorage.removeItem(key)
}

// ---------- Conversations ----------
export function loadConversations() {
  return loadJSON(STORAGE_KEYS.conversations, {})
}

export function saveConversations(conversations) {
  return saveJSON(STORAGE_KEYS.conversations, conversations)
}

// ---------- Last Active Chat ----------
export function loadLastActiveChat() {
  return loadJSON(STORAGE_KEYS.lastActiveChat, '')
}

export function saveLastActiveChat(id) {
  saveJSON(STORAGE_KEYS.lastActiveChat, id)
}

// ---------- Config ----------
export function loadConfig(key, fallback = '') {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}

export function saveConfig(key, value) {
  try { localStorage.setItem(key, String(value)) } catch {}
}

// ---------- Batch Clear ----------
export function clearConfigKeys() {
  const keys = [
    STORAGE_KEYS.selectedModel, STORAGE_KEYS.ollamaHost,
    STORAGE_KEYS.streamSpeed, STORAGE_KEYS.contextLength,
    STORAGE_KEYS.streamAutoScroll
  ]
  keys.forEach(k => localStorage.removeItem(k))
}

export function clearAllKeys() {
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k))
}
