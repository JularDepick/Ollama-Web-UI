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

// ---------- Storage Size Monitoring ----------
export function getStorageUsage() {
  let total = 0
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    const value = localStorage.getItem(key)
    total += (key?.length || 0) + (value?.length || 0)
  }
  // Characters to bytes (UTF-16)
  const bytes = total * 2
  const limit = 5 * 1024 * 1024 // 5MB typical limit
  return {
    bytes,
    limit,
    percent: Math.round((bytes / limit) * 100),
    formatted: formatBytes(bytes),
    limitFormatted: formatBytes(limit)
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export function checkStorageQuota(onWarning) {
  const usage = getStorageUsage()
  if (usage.percent >= 90) {
    onWarning(`存储空间即将用尽 (${usage.percent}%), 请导出备份并清理旧对话`, 'error')
  } else if (usage.percent >= 70) {
    onWarning(`存储空间使用 ${usage.percent}%`, 'warning')
  }
  return usage
}
