export const DEBUG_MODE = true

export const LOG_STYLES = {
  USER: 'color:#0099ff;font-weight:bold;',
  MODEL: 'color:#00cc66;font-weight:bold;',
  DATA: 'color:#9933ff;font-weight:bold;',
  SENSITIVE: 'color:#ffcc00;font-weight:bold;',
  ERROR: 'color:#ff3333;font-weight:bold;'
}

export const LOG_PREFIX = {
  USER: '[用户操作] ',
  MODEL: '[模型交互] ',
  DATA: '[数据变更] ',
  SENSITIVE: '[敏感操作] ',
  ERROR: '[捕获错误] '
}

export function userLog(msg) {
  if (DEBUG_MODE) console.log(`%c${LOG_PREFIX.USER}${msg}`, LOG_STYLES.USER)
}
export function modelLog(msg) {
  if (DEBUG_MODE) console.log(`%c${LOG_PREFIX.MODEL}${msg}`, LOG_STYLES.MODEL)
}
export function dataLog(msg) {
  if (DEBUG_MODE) console.log(`%c${LOG_PREFIX.DATA}${msg}`, LOG_STYLES.DATA)
}
export function sensitiveLog(msg) {
  if (DEBUG_MODE) console.log(`%c${LOG_PREFIX.SENSITIVE}${msg}`, LOG_STYLES.SENSITIVE)
}
export function errorLog(msg) {
  console.log(`%c${LOG_PREFIX.ERROR}${msg}`, LOG_STYLES.ERROR)
}

export const CONST_CONFIG = {
  MODEL_LIST_TIMEOUT: 15000,
  MSG_REPLY_TIMEOUT: 120000,
  STREAM_SPEED_MAP: [0, 16, 32, 64, 128],
  STREAM_TEXT_MAP: ['关闭流式', '16字/秒', '32字/秒', '64字/秒', '128字/秒'],
  CONTEXT_LENGTH_MAP: [4096, 8192, 16384, 32768, 65536, 131072, 262144],
  CONTEXT_LENGTH_TEXT_MAP: ['4k', '8k', '16k', '32k', '64k', '128k', '256k'],
  STREAM_AUTO_SCROLL_TEXT: ['已关闭', '已开启']
}

export const STORAGE_KEYS = {
  conversations: 'Ollama-Web-UI-Conversations',
  lastActiveChat: 'Ollama-Web-UI-LastActiveChat',
  selectedModel: 'Ollama-Web-UI-Config-SelectedModel',
  ollamaHost: 'Ollama-Web-UI-Config-OllamaHost',
  streamSpeed: 'Ollama-Web-UI-Config-StreamSpeed',
  contextLength: 'Ollama-Web-UI-Config-ContextLength',
  streamAutoScroll: 'Ollama-Web-UI-Config-StreamAutoScroll'
}

export const DEFAULT_CONFIG = {
  ollamaHost: '',
  selectedModel: '',
  streamSpeed: 1,
  streamAutoScroll: 0,
  contextLength: 1
}

// ============================================================
// Theme System
// ============================================================

export const THEMES = {
  default: {
    name: '默认蓝', emoji: '🔵',
    vars: {
      '--primary-color': '#1677ff',
      '--primary-hover': '#0f62d9',
      '--primary-light': '#e8f3ff',
      '--primary-alt': '#1890ff',
      '--bg-white': '#fff',
      '--bg-gray': '#f5f7fa',
      '--bg-gray-light': '#f0f2f5',
      '--text-main': '#333',
      '--text-secondary': '#666',
      '--text-light': '#999',
      '--border-color': '#e5e7eb'
    }
  },
  green: {
    name: '翠绿', emoji: '🟢',
    vars: {
      '--primary-color': '#52c41a',
      '--primary-hover': '#389e0d',
      '--primary-light': '#f6ffed',
      '--primary-alt': '#73d13d',
      '--bg-white': '#fff',
      '--bg-gray': '#f5f7fa',
      '--bg-gray-light': '#f0f2f5',
      '--text-main': '#333',
      '--text-secondary': '#666',
      '--text-light': '#999',
      '--border-color': '#e5e7eb'
    }
  },
  purple: {
    name: '紫色', emoji: '🟣',
    vars: {
      '--primary-color': '#722ed1',
      '--primary-hover': '#531dab',
      '--primary-light': '#f9f0ff',
      '--primary-alt': '#9254de',
      '--bg-white': '#fff',
      '--bg-gray': '#f5f7fa',
      '--bg-gray-light': '#f0f2f5',
      '--text-main': '#333',
      '--text-secondary': '#666',
      '--text-light': '#999',
      '--border-color': '#e5e7eb'
    }
  },
  orange: {
    name: '暖橙', emoji: '🟠',
    vars: {
      '--primary-color': '#fa8c16',
      '--primary-hover': '#d46b08',
      '--primary-light': '#fff7e6',
      '--primary-alt': '#ffa940',
      '--bg-white': '#fff',
      '--bg-gray': '#f5f7fa',
      '--bg-gray-light': '#f0f2f5',
      '--text-main': '#333',
      '--text-secondary': '#666',
      '--text-light': '#999',
      '--border-color': '#e5e7eb'
    }
  },
  red: {
    name: '绯红', emoji: '🔴',
    vars: {
      '--primary-color': '#f5222d',
      '--primary-hover': '#cf1322',
      '--primary-light': '#fff1f0',
      '--primary-alt': '#ff4d4f',
      '--bg-white': '#fff',
      '--bg-gray': '#f5f7fa',
      '--bg-gray-light': '#f0f2f5',
      '--text-main': '#333',
      '--text-secondary': '#666',
      '--text-light': '#999',
      '--border-color': '#e5e7eb'
    }
  },
  dark: {
    name: '暗色', emoji: '🌙',
    vars: {
      '--primary-color': '#1677ff',
      '--primary-hover': '#0f62d9',
      '--primary-light': '#1a2744',
      '--primary-alt': '#4d9aff',
      '--bg-white': '#1e1e1e',
      '--bg-gray': '#141414',
      '--bg-gray-light': '#1a1a1a',
      '--text-main': '#e5e5e5',
      '--text-secondary': '#a0a0a0',
      '--text-light': '#707070',
      '--border-color': '#333'
    }
  }
}

export const THEME_STORAGE_KEY = 'Ollama-Web-UI-Theme'
export const THEME_CUSTOM_COLOR_KEY = 'Ollama-Web-UI-CustomColor'

// Color manipulation utilities
function hexToRgb(hex) {
  const c = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return c ? { r: parseInt(c[1],16), g: parseInt(c[2],16), b: parseInt(c[3],16) } : null
}

function rgbToHex(r, g, b) {
  return '#' + [r,g,b].map(x => Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0')).join('')
}

export function darken(hex, amt) {
  const c = hexToRgb(hex); if (!c) return hex
  return rgbToHex(c.r*(1-amt), c.g*(1-amt), c.b*(1-amt))
}

export function lighten(hex, amt) {
  const c = hexToRgb(hex); if (!c) return hex
  return rgbToHex(c.r+(255-c.r)*amt, c.g+(255-c.g)*amt, c.b+(255-c.b)*amt)
}

export function applyThemeVars(vars) {
  Object.entries(vars).forEach(([key, val]) => {
    document.documentElement.style.setProperty(key, val)
  })
}

export function applyCustomTheme(primary) {
  const vars = {
    '--primary-color': primary,
    '--primary-hover': darken(primary, 0.12),
    '--primary-light': lighten(primary, 0.6),
    '--primary-alt': lighten(primary, 0.15)
  }
  applyThemeVars(vars)
}
