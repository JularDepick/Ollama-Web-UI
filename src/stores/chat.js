import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  CONST_CONFIG, STORAGE_KEYS, DEFAULT_CONFIG,
  THEMES, THEME_STORAGE_KEY, THEME_CUSTOM_COLOR_KEY,
  applyThemeVars, applyCustomTheme,
  userLog, modelLog, dataLog, sensitiveLog, errorLog
} from '@/constants'
import { loadJSON, saveJSON, loadConfig, saveConfig, loadConversations, saveConversations, loadLastActiveChat, saveLastActiveChat } from '@/utils/storage'
import { genId, mergeContinuousNewlines, startThinkTimer } from '@/utils/helpers'
import { renderMarkdown, escapeHtml } from '@/utils/markdown'

export const useChatStore = defineStore('chat', () => {
  // ============ Config State ============
  const ollamaHost = ref(loadConfig(STORAGE_KEYS.ollamaHost, DEFAULT_CONFIG.ollamaHost))
  const selectedModel = ref(loadConfig(STORAGE_KEYS.selectedModel, DEFAULT_CONFIG.selectedModel))
  const streamSpeed = ref(Number(loadConfig(STORAGE_KEYS.streamSpeed, DEFAULT_CONFIG.streamSpeed)))
  const contextLength = ref(Number(loadConfig(STORAGE_KEYS.contextLength, DEFAULT_CONFIG.contextLength)))
  const streamAutoScroll = ref(Number(loadConfig(STORAGE_KEYS.streamAutoScroll, DEFAULT_CONFIG.streamAutoScroll)))
  const models = ref([])

  // ============ Conversation State ============
  const conversations = ref(loadConversations())
  const currentConversationId = ref(loadLastActiveChat())
  const conversationSearchTerm = ref('')

  // ============ UI State ============
  const sidebarCollapsed = ref(true)
  const configPanelOpen = ref(false)
  const inputCollapsed = ref(false)
  const isWaitingModelReply = ref(false)
  const isTempTipShowing = ref(false)
  const toastMessage = ref('')
  const toastType = ref('info')
  const toastVisible = ref(false)

  // ============ Streaming State ============
  const currentStreamingMsgId = ref(null)

  // ============ Theme ============
  const themePanelOpen = ref(false)
  const currentTheme = ref(loadConfig(THEME_STORAGE_KEY, 'default'))
  const customColor = ref(loadConfig(THEME_CUSTOM_COLOR_KEY, ''))

  function selectTheme(id) {
    currentTheme.value = id
    customColor.value = ''
    saveConfig(THEME_STORAGE_KEY, id)
    localStorage.removeItem(THEME_CUSTOM_COLOR_KEY)
    if (id === 'custom') return
    const theme = THEMES[id]
    if (theme) applyThemeVars(theme.vars)
  }

  function setCustomColor(color) {
    customColor.value = color
    currentTheme.value = 'custom'
    saveConfig(THEME_CUSTOM_COLOR_KEY, color)
    saveConfig(THEME_STORAGE_KEY, 'custom')
    applyCustomTheme(color)
  }

  // ============ Getters ============
  const currentConversation = computed(() => {
    if (!currentConversationId.value) return null
    return conversations.value[currentConversationId.value] || null
  })

  const currentMessages = computed(() => {
    const conv = currentConversation.value
    return conv ? conv.messages : []
  })

  const sortedConversationIds = computed(() => {
    const ids = Object.keys(conversations.value)
    return ids.sort((a, b) => {
      const ca = conversations.value[a]
      const cb = conversations.value[b]
      if (ca.tempPinned && !cb.tempPinned) return -1
      if (!ca.tempPinned && cb.tempPinned) return 1
      if (ca.pinned && !cb.pinned) return -1
      if (!ca.pinned && cb.pinned) return 1
      return (cb.updateTime || 0) - (ca.updateTime || 0)
    })
  })

  const filteredConversationIds = computed(() => {
    const term = conversationSearchTerm.value.trim().toLowerCase()
    if (!term) return sortedConversationIds.value
    return sortedConversationIds.value.filter(id => {
      const conv = conversations.value[id]
      return conv.name && conv.name.toLowerCase().includes(term)
    })
  })

  const hasConversations = computed(() => Object.keys(conversations.value).length > 0)

  // ============ Toast ============
  let toastTimer = null
  function showToast(msg, type = 'info', duration = 2500) {
    toastMessage.value = msg
    toastType.value = type
    toastVisible.value = true
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { toastVisible.value = false }, duration)
  }

  // ============ Storage (with change detection) ============
  let _lastConvJSON = JSON.stringify(conversations.value)

  function persistConversations() {
    const json = JSON.stringify(conversations.value)
    if (json === _lastConvJSON) return true
    _lastConvJSON = json
    return saveJSON(STORAGE_KEYS.conversations, conversations.value)
  }

  function persistLastActiveChat() {
    saveLastActiveChat(currentConversationId.value)
  }

  // ============ Conversation CRUD ============
  function createNewConversation(name = '新对话') {
    const id = genId()
    conversations.value[id] = {
      id,
      name,
      messages: [],
      pinned: false,
      tempPinned: false,
      updateTime: Date.now()
    }
    currentConversationId.value = id
    persistConversations()
    persistLastActiveChat()
    sidebarCollapsed.value = true
    userLog(`新建对话: ${id}`)
    return id
  }

  function deleteConversation(id) {
    sensitiveLog(`删除对话: ${id}`)
    const ids = Object.keys(conversations.value)
    if (ids.length === 1 && ids[0] === id) {
      // Deleting last conversation — create a new one
      delete conversations.value[id]
      createNewConversation()
      return
    }
    delete conversations.value[id]
    if (currentConversationId.value === id) {
      const remaining = Object.keys(conversations.value)
      currentConversationId.value = remaining[0] || ''
      if (!currentConversationId.value) createNewConversation()
    }
    persistConversations()
    persistLastActiveChat()
  }

  function renameConversation(id, newName) {
    if (conversations.value[id]) {
      conversations.value[id].name = newName
      conversations.value[id].updateTime = Date.now()
      persistConversations()
    }
  }

  function togglePinConversation(id) {
    if (conversations.value[id]) {
      conversations.value[id].pinned = !conversations.value[id].pinned
      persistConversations()
    }
  }

  function switchConversation(id) {
    if (id === currentConversationId.value) return
    if (isWaitingModelReply.value) {
      showToast('请等待当前消息回复完成', 'warning')
      return
    }
    currentConversationId.value = id
    persistLastActiveChat()
    userLog(`切换到对话: ${id}`)
  }

  // ============ Config Actions ============
  function setOllamaHost(host) {
    ollamaHost.value = host
    saveConfig(STORAGE_KEYS.ollamaHost, host)
  }

  function setSelectedModel(model) {
    selectedModel.value = model
    saveConfig(STORAGE_KEYS.selectedModel, model)
  }

  function setStreamSpeed(speed) {
    streamSpeed.value = speed
    saveConfig(STORAGE_KEYS.streamSpeed, String(speed))
  }

  function setContextLength(val) {
    contextLength.value = val
    saveConfig(STORAGE_KEYS.contextLength, String(val))
  }

  function setStreamAutoScroll(val) {
    streamAutoScroll.value = val
    saveConfig(STORAGE_KEYS.streamAutoScroll, String(val))
  }

  async function loadModelList() {
    if (!ollamaHost.value) return
    try {
      const controller = new AbortController()
      setTimeout(() => controller.abort(), CONST_CONFIG.MODEL_LIST_TIMEOUT)
      const res = await fetch(`${ollamaHost.value}/api/tags`, { method: 'GET', signal: controller.signal })
      if (!res.ok) throw new Error(`接口异常: ${res.status} ${res.statusText}`)
      const resData = await res.json()
      const fetchedModels = resData.models || []
      models.value = fetchedModels
      if (!Array.isArray(fetchedModels) || fetchedModels.length === 0) {
        showToast('暂无可用模型', 'warning')
        return
      }
      if (selectedModel.value && fetchedModels.some(m => m.name === selectedModel.value)) {
        // keep current
      } else {
        selectedModel.value = fetchedModels[0].name
        saveConfig(STORAGE_KEYS.selectedModel, selectedModel.value)
      }
    } catch (e) {
      models.value = []
      errorLog('模型加载失败: ' + e.message)
      showToast('模型加载失败: ' + e.message, 'error')
    }
  }

  function clearConfigData() {
    const keys = [
      STORAGE_KEYS.selectedModel, STORAGE_KEYS.ollamaHost,
      STORAGE_KEYS.streamSpeed, STORAGE_KEYS.contextLength,
      STORAGE_KEYS.streamAutoScroll
    ]
    keys.forEach(k => localStorage.removeItem(k))
    ollamaHost.value = DEFAULT_CONFIG.ollamaHost
    selectedModel.value = DEFAULT_CONFIG.selectedModel
    streamSpeed.value = DEFAULT_CONFIG.streamSpeed
    contextLength.value = DEFAULT_CONFIG.contextLength
    streamAutoScroll.value = DEFAULT_CONFIG.streamAutoScroll
    models.value = []
    showToast('配置已清除，恢复默认值', 'success')
  }

  function clearAllData() {
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k))
    conversations.value = {}
    currentConversationId.value = ''
    ollamaHost.value = DEFAULT_CONFIG.ollamaHost
    selectedModel.value = DEFAULT_CONFIG.selectedModel
    streamSpeed.value = DEFAULT_CONFIG.streamSpeed
    contextLength.value = DEFAULT_CONFIG.contextLength
    streamAutoScroll.value = DEFAULT_CONFIG.streamAutoScroll
    models.value = []
    _lastConvJSON = '{}'
    createNewConversation()
    showToast('所有数据已清除，初始化新会话', 'success')
  }

  // ============ Message Actions ============
  function addMessage(role, content, extra = {}) {
    const msg = {
      id: genId(),
      role,
      content,
      sendTime: Date.now(),
      thinkDuration: extra.thinkDuration || 0,
      ...extra
    }
    const conv = conversations.value[currentConversationId.value]
    if (conv) {
      conv.messages.push(msg)
      conv.updateTime = Date.now()
      persistConversations()
    }
    return msg
  }

  function deleteMessage(msgId) {
    const conv = currentConversation.value
    if (!conv) return
    const idx = conv.messages.findIndex(m => m.id === msgId)
    if (idx !== -1) {
      conv.messages.splice(idx, 1)
      conv.updateTime = Date.now()
      persistConversations()
    }
  }

  function buildContextPrompt(newMsg) {
    const conv = currentConversation.value
    if (!conv || !conv.messages.length) return newMsg
    let prompt = '以下是对话历史，请基于历史回答最新问题：\n\n'
    conv.messages.forEach(m => {
      if (m.role) prompt += `${m.role === 'user' ? '用户' : 'AI'}：${m.content}\n`
    })
    prompt += `用户：${newMsg}\nAI：`
    return prompt
  }

  // ============ API / Streaming ============
  let activeAbortController = null

  async function sendMessage(msgContent) {
    const msg = mergeContinuousNewlines(msgContent)
    if (!msg) return

    // Ensure a conversation exists
    if (!currentConversationId.value || !conversations.value[currentConversationId.value]) {
      createNewConversation()
    }

    isWaitingModelReply.value = true
    showToast('', '', 0) // clear any existing toast

    // Add user message
    addMessage('user', msg)

    // Create pending AI message
    const aiMsg = addMessage('assistant', '', { thinkDuration: 0 })
    currentStreamingMsgId.value = aiMsg.id

    // Build context
    const prompt = buildContextPrompt(msg)

    // Abort previous request if any
    if (activeAbortController) {
      activeAbortController.abort()
    }
    activeAbortController = new AbortController()
    const signal = activeAbortController.signal
    const timeoutId = setTimeout(() => activeAbortController.abort(), CONST_CONFIG.MSG_REPLY_TIMEOUT)

    const thinkStartTime = Date.now()

    try {
      const reqBody = {
        model: selectedModel.value,
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 2048,
          num_ctx: CONST_CONFIG.CONTEXT_LENGTH_MAP[contextLength.value]
        }
      }

      const res = await fetch(`${ollamaHost.value}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
        signal
      })

      clearTimeout(timeoutId)
      if (!res.ok) throw new Error(`API异常: ${res.status}`)

      const resData = await res.json()
      const thinkDuration = Math.floor((Date.now() - thinkStartTime) / 1000)
      const fullContent = resData.response || ''

      // Update AI message
      const conv = conversations.value[currentConversationId.value]
      if (conv) {
        const targetMsg = conv.messages.find(m => m.id === aiMsg.id)
        if (targetMsg) {
          targetMsg.content = fullContent
          targetMsg.thinkDuration = thinkDuration
        }
        conv.updateTime = Date.now()
      }
      currentStreamingMsgId.value = null
      persistConversations()
      modelLog(`模型回复完成 (${thinkDuration}秒)`)

    } catch (e) {
      clearTimeout(timeoutId)
      currentStreamingMsgId.value = null
      if (e.name === 'AbortError') {
        showToast('请求超时或已取消', 'error')
        errorLog('请求被中止')
      } else {
        showToast('请求失败: ' + e.message, 'error')
        errorLog('请求异常: ' + e.message)
      }
      // Clean up empty AI message
      const conv = conversations.value[currentConversationId.value]
      if (conv) {
        const idx = conv.messages.findIndex(m => m.id === aiMsg.id)
        if (idx !== -1) {
          if (conv.messages[idx].content === '') {
            conv.messages.splice(idx, 1)
          }
        }
        persistConversations()
      }
    } finally {
      isWaitingModelReply.value = false
      activeAbortController = null
    }
  }

  // ============ Initialization ============
  function initialize() {
    // Apply saved theme
    if (customColor.value && currentTheme.value === 'custom') {
      applyCustomTheme(customColor.value)
    } else if (THEMES[currentTheme.value]) {
      applyThemeVars(THEMES[currentTheme.value].vars)
    }

    // Ensure conversations structure is valid
    const convs = conversations.value
    let needsSave = false
    Object.keys(convs).forEach(id => {
      const conv = convs[id]
      if (!conv.messages) { conv.messages = []; needsSave = true }
      if (!conv.hasOwnProperty('pinned')) { conv.pinned = false; needsSave = true }
      if (!conv.hasOwnProperty('tempPinned')) { conv.tempPinned = false; needsSave = true }
      if (!conv.hasOwnProperty('updateTime')) { conv.updateTime = Date.now(); needsSave = true }
      // Ensure message IDs
      conv.messages.forEach((msg, i) => {
        if (!msg.id) { msg.id = genId(); needsSave = true }
        if (!msg.sendTime) { msg.sendTime = Date.now() - (conv.messages.length - i) * 1000; needsSave = true }
      })
    })
    if (needsSave) persistConversations()

    // Load last active conversation or create new one
    const lastId = currentConversationId.value
    if (lastId && convs[lastId]) {
      // valid
    } else if (Object.keys(convs).length > 0) {
      currentConversationId.value = sortedConversationIds.value[0]
      persistLastActiveChat()
    } else {
      createNewConversation()
    }

    // Auto-fetch models if host is configured
    if (ollamaHost.value) {
      loadModelList()
    }
  }

  return {
    // State
    ollamaHost, selectedModel, streamSpeed, contextLength, streamAutoScroll, models,
    conversations, currentConversationId, conversationSearchTerm,
    sidebarCollapsed, configPanelOpen, inputCollapsed,
    isWaitingModelReply, isTempTipShowing,
    toastMessage, toastType, toastVisible,
    currentStreamingMsgId,
    themePanelOpen, currentTheme, customColor,
    // Getters
    currentConversation, currentMessages,
    sortedConversationIds, filteredConversationIds, hasConversations,
    // Actions
    showToast,
    createNewConversation, deleteConversation, renameConversation,
    togglePinConversation, switchConversation,
    setOllamaHost, setSelectedModel, setStreamSpeed, setContextLength, setStreamAutoScroll,
    loadModelList, clearConfigData, clearAllData,
    addMessage, deleteMessage, sendMessage,
    persistConversations, initialize,
    selectTheme, setCustomColor
  }
})
