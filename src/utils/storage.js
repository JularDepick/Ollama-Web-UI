import { STORAGE_KEYS } from '@/constants'

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
    localStorage.setItem(key, serialized)
    return true
  } catch (e) {
    console.error('保存失败:', e.message)
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
  try { localStorage.setItem(STORAGE_KEYS.lastActiveChat, id) } catch {}
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
