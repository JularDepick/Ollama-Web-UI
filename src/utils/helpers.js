// ---------- Time Formatting ----------
export function formatTime(timestamp) {
  if (!timestamp) return ''
  const now = Date.now()
  const diff = now - timestamp
  const d = new Date(timestamp)
  const pad = n => String(n).padStart(2, '0')
  const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`

  const today = new Date()
  if (d.toDateString() === today.toDateString()) return timeStr

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${timeStr}`

  return `${d.getMonth() + 1}/${d.getDate()} ${timeStr}`
}

export function formatFullTime(timestamp) {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function formatSeconds(sec) {
  if (sec < 60) return `${sec}秒`
  if (sec < 3600) return `${Math.floor(sec / 60)}分${sec % 60}秒`
  return `${Math.floor(sec / 3600)}时${Math.floor((sec % 3600) / 60)}分`
}

// ---------- ID Generation ----------
let _idCounter = 0
export function genId() {
  if (crypto.randomUUID) return crypto.randomUUID().slice(0, 8)
  return Date.now().toString(36) + (++_idCounter).toString(36) + Math.random().toString(36).slice(-4)
}

// ---------- Think Time Timer ----------
export function startThinkTimer(el, onUpdate) {
  const start = Date.now()
  const interval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - start) / 1000)
    onUpdate(el, elapsed)
    if (!el.isConnected) clearInterval(interval)
  }, 1000)
  return interval
}

// ---------- Content Helpers ----------
export function mergeContinuousNewlines(text) {
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

export function truncateText(text, maxLen = 50) {
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

// ---------- Debounce ----------
export function debounce(fn, delay = 300) {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}
