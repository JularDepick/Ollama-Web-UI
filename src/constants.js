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
