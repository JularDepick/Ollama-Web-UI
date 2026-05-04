// ---------- Time Formatting ----------
export function formatTime(timestamp) {
  const d = new Date(timestamp)
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatSeconds(sec) {
  if (sec < 60) return `${sec}秒`
  if (sec < 3600) return `${Math.floor(sec / 60)}分${sec % 60}秒`
  return `${Math.floor(sec / 3600)}时${Math.floor((sec % 3600) / 60)}分`
}

// ---------- ID Generation ----------
export function genId() {
  return Date.now() + Math.random().toString(36).slice(-6)
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
