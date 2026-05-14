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
  streamAutoScroll: 'Ollama-Web-UI-Config-StreamAutoScroll',
  codeBg: 'Ollama-Web-UI-Config-CodeBg',
  codeText: 'Ollama-Web-UI-Config-CodeText',
  modelList: 'Ollama-Web-UI-Config-ModelList',
  hostHistory: 'Ollama-Web-UI-Config-HostHistory'
}

export const DEFAULT_CONFIG = {
  ollamaHost: '',
  selectedModel: '',
  streamSpeed: 1,
  streamAutoScroll: 1,
  contextLength: 1
}

// ============================================================
// Theme System
// ============================================================

export const THEMES = {
  default: {
    name: '默认蓝', emoji: '🔵',
    vars: {
      '--primary-color': '#1677ff', '--primary-rgb': '22,119,255',
      '--primary-hover': '#0f62d9', '--primary-light': '#e8f3ff',
      '--primary-alt': '#1890ff',
      '--bg-white': '#fff', '--bg-gray': '#f5f7fa', '--bg-gray-light': '#f0f2f5',
      '--bg-dark': '#1e1e1e',
      '--text-main': '#333', '--text-secondary': '#666',
      '--text-light': '#999', '--text-muted': '#888',
      '--text-danger': '#e53e3e', '--danger-hover': '#c93737',
      '--border-color': '#e5e7eb', '--border-light': '#eee',
      '--code-bg': '#f5f7fa', '--code-text': '#333',
      '--code-btn-color': '#666', '--code-btn-hover-bg': '#ccc',
      '--pinned-bg': '#e6f7ff', '--temp-pinned-bg': '#f0f5ff',
      '--input-bg': '#f5f7fa', '--loading-bg': '#fff',
      '--msg-ai-bg': '#fff'
    }
  },
  green: {
    name: '翠绿', emoji: '🟢',
    vars: {
      '--primary-color': '#52c41a', '--primary-rgb': '82,196,26',
      '--primary-hover': '#389e0d', '--primary-light': '#f6ffed',
      '--primary-alt': '#73d13d',
      '--bg-white': '#fff', '--bg-gray': '#f5f7fa', '--bg-gray-light': '#f0f2f5',
      '--bg-dark': '#1e1e1e',
      '--text-main': '#333', '--text-secondary': '#666',
      '--text-light': '#999', '--text-muted': '#888',
      '--text-danger': '#e53e3e', '--danger-hover': '#c93737',
      '--border-color': '#e5e7eb', '--border-light': '#eee',
      '--code-bg': '#f5f7fa', '--code-text': '#333',
      '--code-btn-color': '#666', '--code-btn-hover-bg': '#ccc',
      '--pinned-bg': '#e6f7ff', '--temp-pinned-bg': '#f0f5ff',
      '--input-bg': '#f5f7fa', '--loading-bg': '#fff',
      '--msg-ai-bg': '#fff'
    }
  },
  purple: {
    name: '紫色', emoji: '🟣',
    vars: {
      '--primary-color': '#722ed1', '--primary-rgb': '114,46,209',
      '--primary-hover': '#531dab', '--primary-light': '#f9f0ff',
      '--primary-alt': '#9254de',
      '--bg-white': '#fff', '--bg-gray': '#f5f7fa', '--bg-gray-light': '#f0f2f5',
      '--bg-dark': '#1e1e1e',
      '--text-main': '#333', '--text-secondary': '#666',
      '--text-light': '#999', '--text-muted': '#888',
      '--text-danger': '#e53e3e', '--danger-hover': '#c93737',
      '--border-color': '#e5e7eb', '--border-light': '#eee',
      '--code-bg': '#f5f7fa', '--code-text': '#333',
      '--code-btn-color': '#666', '--code-btn-hover-bg': '#ccc',
      '--pinned-bg': '#e6f7ff', '--temp-pinned-bg': '#f0f5ff',
      '--input-bg': '#f5f7fa', '--loading-bg': '#fff',
      '--msg-ai-bg': '#fff'
    }
  },
  orange: {
    name: '暖橙', emoji: '🟠',
    vars: {
      '--primary-color': '#fa8c16', '--primary-rgb': '250,140,22',
      '--primary-hover': '#d46b08', '--primary-light': '#fff7e6',
      '--primary-alt': '#ffa940',
      '--bg-white': '#fff', '--bg-gray': '#f5f7fa', '--bg-gray-light': '#f0f2f5',
      '--bg-dark': '#1e1e1e',
      '--text-main': '#333', '--text-secondary': '#666',
      '--text-light': '#999', '--text-muted': '#888',
      '--text-danger': '#e53e3e', '--danger-hover': '#c93737',
      '--border-color': '#e5e7eb', '--border-light': '#eee',
      '--code-bg': '#f5f7fa', '--code-text': '#333',
      '--code-btn-color': '#666', '--code-btn-hover-bg': '#ccc',
      '--pinned-bg': '#e6f7ff', '--temp-pinned-bg': '#f0f5ff',
      '--input-bg': '#f5f7fa', '--loading-bg': '#fff',
      '--msg-ai-bg': '#fff'
    }
  },
  red: {
    name: '绯红', emoji: '🔴',
    vars: {
      '--primary-color': '#f5222d', '--primary-rgb': '245,34,45',
      '--primary-hover': '#cf1322', '--primary-light': '#fff1f0',
      '--primary-alt': '#ff4d4f',
      '--bg-white': '#fff', '--bg-gray': '#f5f7fa', '--bg-gray-light': '#f0f2f5',
      '--bg-dark': '#1e1e1e',
      '--text-main': '#333', '--text-secondary': '#666',
      '--text-light': '#999', '--text-muted': '#888',
      '--text-danger': '#e53e3e', '--danger-hover': '#c93737',
      '--border-color': '#e5e7eb', '--border-light': '#eee',
      '--code-bg': '#f5f7fa', '--code-text': '#333',
      '--code-btn-color': '#666', '--code-btn-hover-bg': '#ccc',
      '--pinned-bg': '#e6f7ff', '--temp-pinned-bg': '#f0f5ff',
      '--input-bg': '#f5f7fa', '--loading-bg': '#fff',
      '--msg-ai-bg': '#fff'
    }
  },
  dark: {
    name: '暗色', emoji: '🌙',
    vars: {
      '--primary-color': '#1677ff', '--primary-rgb': '22,119,255',
      '--primary-hover': '#0f62d9', '--primary-light': '#1a2744',
      '--primary-alt': '#4d9aff',
      '--bg-white': '#1e1e1e', '--bg-gray': '#141414', '--bg-gray-light': '#1a1a1a',
      '--bg-dark': '#141414',
      '--text-main': '#e5e5e5', '--text-secondary': '#a0a0a0',
      '--text-light': '#707070', '--text-muted': '#666',
      '--text-danger': '#fc8181', '--danger-hover': '#e53e3e',
      '--border-color': '#333', '--border-light': '#444',
      '--code-bg': '#2d2d2d', '--code-text': '#d4d4d4',
      '--code-btn-color': '#aaa', '--code-btn-hover-bg': '#666',
      '--pinned-bg': '#1a2744', '--temp-pinned-bg': '#1a1a2e',
      '--input-bg': '#2a2a2a', '--loading-bg': '#2a2a2a',
      '--msg-ai-bg': '#2a2a2a'
    }
  },
  aurora: {
    name: '极光', emoji: '🌌',
    vars: {
      '--primary-color': '#089981', '--primary-rgb': '8,153,145',
      '--primary-hover': '#067a68', '--primary-light': '#e6faf6',
      '--primary-alt': '#36cfc9',
      '--bg-white': '#fafefe', '--bg-gray': '#f0faf8', '--bg-gray-light': '#e8f5f2',
      '--bg-dark': '#1a1a2e',
      '--text-main': '#1a3a3a', '--text-secondary': '#4a7a72',
      '--text-light': '#8ab0a8', '--text-muted': '#7a9a92',
      '--text-danger': '#d95c5c', '--danger-hover': '#c14040',
      '--border-color': '#c8e6de', '--border-light': '#dceee8',
      '--code-bg': '#f0faf8', '--code-text': '#1a3a3a',
      '--code-btn-color': '#5a9a92', '--code-btn-hover-bg': '#b8ded6',
      '--pinned-bg': '#d4f0ea', '--temp-pinned-bg': '#e0f5f0',
      '--input-bg': '#f0faf8', '--loading-bg': '#fafefe',
      '--msg-ai-bg': '#fafefe'
    }
  },
  ocean: {
    name: '海洋', emoji: '🌊',
    vars: {
      '--primary-color': '#006dbf', '--primary-rgb': '0,109,191',
      '--primary-hover': '#005499', '--primary-light': '#e3f0fa',
      '--primary-alt': '#3399cc',
      '--bg-white': '#f5faff', '--bg-gray': '#e8f2fa', '--bg-gray-light': '#deecf5',
      '--bg-dark': '#0a1628',
      '--text-main': '#0a2a44', '--text-secondary': '#3a5a7a',
      '--text-light': '#7a9ab8', '--text-muted': '#6a8aa8',
      '--text-danger': '#d94a4a', '--danger-hover': '#c03535',
      '--border-color': '#b8d4e8', '--border-light': '#cce0f0',
      '--code-bg': '#e8f2fa', '--code-text': '#0a2a44',
      '--code-btn-color': '#4a7aa0', '--code-btn-hover-bg': '#aac4d8',
      '--pinned-bg': '#cce0f0', '--temp-pinned-bg': '#d6e8f5',
      '--input-bg': '#e8f2fa', '--loading-bg': '#f5faff',
      '--msg-ai-bg': '#f5faff'
    }
  },
  retro: {
    name: '复古', emoji: '📜',
    vars: {
      '--primary-color': '#b8860b', '--primary-rgb': '184,134,11',
      '--primary-hover': '#9a7209', '--primary-light': '#fef7e0',
      '--primary-alt': '#d4a843',
      '--bg-white': '#fef9ef', '--bg-gray': '#f8f0e0', '--bg-gray-light': '#f2e8d0',
      '--bg-dark': '#2a1f0a',
      '--text-main': '#3a2a0a', '--text-secondary': '#6a5a3a',
      '--text-light': '#9a8a6a', '--text-muted': '#8a7a5a',
      '--text-danger': '#b84a30', '--danger-hover': '#9a3a28',
      '--border-color': '#dcd0b8', '--border-light': '#e8dec8',
      '--code-bg': '#f8f0e0', '--code-text': '#3a2a0a',
      '--code-btn-color': '#7a6a4a', '--code-btn-hover-bg': '#d0c0a0',
      '--pinned-bg': '#f0e4c8', '--temp-pinned-bg': '#f5ecd8',
      '--input-bg': '#f8f0e0', '--loading-bg': '#fef9ef',
      '--msg-ai-bg': '#fef9ef'
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

function hexToRgbStr(hex) {
  const c = hexToRgb(hex)
  return c ? `${c.r},${c.g},${c.b}` : ''
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
  // Auto-compute --primary-rgb if only --primary-color is provided
  if (vars['--primary-color'] && !vars['--primary-rgb']) {
    vars['--primary-rgb'] = hexToRgbStr(vars['--primary-color'])
  }
  Object.entries(vars).forEach(([key, val]) => {
    document.documentElement.style.setProperty(key, val)
  })
}

export function applyCustomTheme(primary) {
  const vars = {
    '--primary-color': primary,
    '--primary-rgb': hexToRgbStr(primary),
    '--primary-hover': darken(primary, 0.12),
    '--primary-light': lighten(primary, 0.6),
    '--primary-alt': lighten(primary, 0.15),
    // Keep backgrounds/foregrounds light by default
    '--bg-white': '#fff', '--bg-gray': '#f5f7fa', '--bg-gray-light': '#f0f2f5',
    '--bg-dark': '#1e1e1e',
    '--text-main': '#333', '--text-secondary': '#666',
    '--text-light': '#999', '--text-muted': '#888',
    '--text-danger': '#e53e3e', '--danger-hover': '#c93737',
    '--border-color': '#e5e7eb', '--border-light': '#eee',
    '--code-bg': '#f5f7fa', '--code-text': '#333',
    '--code-btn-color': '#666', '--code-btn-hover-bg': '#ccc',
    '--pinned-bg': lighten(primary, 0.85),
    '--temp-pinned-bg': lighten(primary, 0.9),
    '--input-bg': '#f5f7fa', '--loading-bg': '#fff',
    '--msg-ai-bg': '#fff'
  }
  applyThemeVars(vars)
}
