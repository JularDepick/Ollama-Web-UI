import { defineStore } from 'pinia'
import { ref, computed, nextTick } from 'vue'
import {
  CONST_CONFIG, STORAGE_KEYS, DEFAULT_CONFIG,
  THEMES, THEME_STORAGE_KEY, THEME_CUSTOM_COLOR_KEY,
  applyThemeVars, applyCustomTheme,
  userLog, modelLog, sensitiveLog, errorLog
} from '@/constants'
import { saveJSON, loadConfig, saveConfig, loadConversations, loadLastActiveChat, saveLastActiveChat } from '@/utils/storage'
import { genId, mergeContinuousNewlines } from '@/utils/helpers'

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
  const isOffline = ref(false)
  const toastMessage = ref('')
  const toastType = ref('info')
  const toastVisible = ref(false)

  // ============ Streaming State ============
  const currentStreamingMsgId = ref(null)
  const latestAiMsgId = ref('')
  const latestUserMsgId = ref('')
  const isStreamingActive = ref(false)
  const scrollTrigger = ref(0)

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
  function clearToast() {
    toastMessage.value = ''
    toastType.value = 'info'
    toastVisible.value = false
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = null
  }

  function showToast(msg, type = 'info', duration = 2500) {
    toastMessage.value = msg
    toastType.value = type
    toastVisible.value = true
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { toastVisible.value = false }, duration)
  }

  // ============ Storage ============
  function persistConversations() {
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
    // Update latestAiMsgId and latestUserMsgId for the switched conversation
    const conv = conversations.value[id]
    latestAiMsgId.value = ''
    latestUserMsgId.value = ''
    if (conv) {
      for (let i = conv.messages.length - 1; i >= 0; i--) {
        const m = conv.messages[i]
        if (m.role === 'assistant' && m.content && !latestAiMsgId.value) {
          latestAiMsgId.value = m.id
        }
        if (m.role === 'user' && !latestUserMsgId.value) {
          latestUserMsgId.value = m.id
        }
        if (latestAiMsgId.value && latestUserMsgId.value) break
      }
    }
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

  function retrySendMessage() {
    if (failedMessage.value) {
      const msg = failedMessage.value
      failedMessage.value = ''
      sendMessage(msg)
    }
  }

  function clearAllData() {
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k))
    conversations.value = {}
    configPanelOpen.value = false
    themePanelOpen.value = false
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

  function buildMessages() {
    const conv = currentConversation.value
    if (!conv || !conv.messages.length) return []
    const maxTokens = CONST_CONFIG.CONTEXT_LENGTH_MAP[contextLength.value] || 4096
    const maxChars = maxTokens * 2

    const msgs = conv.messages.filter(m => m.content).map(m => ({ role: m.role, content: m.content }))

    let total = msgs.reduce((sum, m) => sum + m.content.length, 0)
    while (total > maxChars && msgs.length > 1) {
      total -= msgs[0].content.length
      msgs.shift()
    }
    return msgs
  }

  // ============ API / Streaming ============
  let activeAbortController = null
  let activeTimeoutId = null
  const failedMessage = ref('')
  const editMessageText = ref('')

  async function sendMessage(msgContent) {
    const msg = mergeContinuousNewlines(msgContent)
    if (!msg) return

    // Ensure a conversation exists
    if (!currentConversationId.value || !conversations.value[currentConversationId.value]) {
      createNewConversation()
    }

    isWaitingModelReply.value = true
    clearToast()
    isStreamingActive.value = false // skip ongoing typewriter
    latestAiMsgId.value = '' // remove "流式展示" button from previous latest

    // Add user message
    addMessage('user', msg)
    latestUserMsgId.value = conversations.value[currentConversationId.value].messages.slice(-1)[0].id

    // Create pending AI message
    const aiMsg = addMessage('assistant', '', { thinkDuration: 0 })
    scrollTrigger.value++
    latestAiMsgId.value = aiMsg.id
    currentStreamingMsgId.value = aiMsg.id

    // Build messages
    const messages = buildMessages()

    // Abort previous request if any
    failedMessage.value = ''
    if (activeTimeoutId) clearTimeout(activeTimeoutId)
    if (activeAbortController) activeAbortController.abort()
    activeAbortController = new AbortController()
    const controller = activeAbortController
    const signal = controller.signal
    activeTimeoutId = setTimeout(() => controller.abort(), CONST_CONFIG.MSG_REPLY_TIMEOUT)

    const thinkStartTime = Date.now()

    try {
      const reqBody = {
        model: selectedModel.value,
        messages,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 2048,
          num_ctx: CONST_CONFIG.CONTEXT_LENGTH_MAP[contextLength.value]
        }
      }

      const res = await fetch(`${ollamaHost.value}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
        signal
      })

      clearTimeout(activeTimeoutId)
      activeTimeoutId = null
      if (!res.ok) throw new Error(`API异常: ${res.status}`)

      const resData = await res.json()
      const fullContent = resData.message?.content || ''
      const thinkDuration = Math.floor((Date.now() - thinkStartTime) / 1000)

      // Typewrite effect: reveal complete response at configured speed
      const speed = CONST_CONFIG.STREAM_SPEED_MAP[streamSpeed.value] || 0
      if (speed > 0 && fullContent) {
        isStreamingActive.value = true
        await typewriteMessage(aiMsg, fullContent, thinkStartTime)
        isStreamingActive.value = false
        scrollTrigger.value++
      } else {
        updateAiMessage(aiMsg, fullContent, thinkDuration)
      }

      currentStreamingMsgId.value = null
      persistConversations()
      modelLog(`模型回复完成 (${thinkDuration}秒, ${(fullContent.length / 1000).toFixed(1)}k字符)`)
      if (!fullContent) errorLog('模型返回了空内容')

    } catch (e) {
      clearTimeout(activeTimeoutId)
      activeTimeoutId = null
      currentStreamingMsgId.value = null
      if (e.name === 'AbortError') {
        showToast('请求超时或已取消', 'error')
        errorLog('请求被中止')
      } else {
        showToast('请求失败: ' + e.message, 'error')
        errorLog('请求异常: ' + e.message)
      }
      // Store failed message for retry
      failedMessage.value = msg
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
      isStreamingActive.value = false
      activeAbortController = null
    }
  }

  async function typewriteMessage(aiMsg, fullContent, thinkStartTime) {
    const speed = CONST_CONFIG.STREAM_SPEED_MAP[streamSpeed.value] || 16
    const delay = Math.max(8, Math.floor(1000 / speed))
    const totalLen = fullContent.length
    let aborted = false

    for (let pos = 1; pos <= totalLen; pos++) {
      if (!isStreamingActive.value) { aborted = true; break }
      updateAiMessage(aiMsg, fullContent.slice(0, pos), Math.floor((Date.now() - thinkStartTime) / 1000))
      await new Promise(r => setTimeout(r, delay))
    }

    if (aborted) {
      updateAiMessage(aiMsg, fullContent, Math.floor((Date.now() - thinkStartTime) / 1000))
    }
  }

  function updateAiMessage(aiMsg, content, thinkDuration) {
    const conv = conversations.value[currentConversationId.value]
    if (!conv) return
    const idx = conv.messages.findIndex(m => m.id === aiMsg.id)
    if (idx === -1) return
    const msgs = [...conv.messages]
    msgs[idx] = { ...msgs[idx], content, thinkDuration }
    conv.messages = msgs
    conv.updateTime = Date.now()
  }

  async function replayStreaming(msgId) {
    if (isWaitingModelReply.value) return
    const msg = findMessage(msgId)
    if (!msg || !msg.content) return
    const speed = CONST_CONFIG.STREAM_SPEED_MAP[streamSpeed.value] || 0
    if (speed <= 0) return
    currentStreamingMsgId.value = msgId
    isStreamingActive.value = true
    await typewriteMessage(msg, msg.content, Date.now())
    isStreamingActive.value = false
    currentStreamingMsgId.value = null
  }

  function skipStreaming() {
    isStreamingActive.value = false
  }

  function findMessage(msgId) {
    const conv = conversations.value[currentConversationId.value]
    if (!conv) return null
    return conv.messages.find(m => m.id === msgId) || null
  }

  async function saveEditedMessage(msgId, newContent) {
    const conv = conversations.value[currentConversationId.value]
    if (!conv) return
    const idx = conv.messages.findIndex(m => m.id === msgId)
    if (idx === -1 || conv.messages[idx].role !== 'user') return

    // Update message in-place and trim subsequent messages
    conv.messages[idx].content = newContent
    conv.messages[idx].sendTime = Date.now()
    conv.messages.splice(idx + 1)
    conv.updateTime = Date.now()
    persistConversations()

    // Trigger API resend
    isWaitingModelReply.value = true
    clearToast()
    isStreamingActive.value = false
    latestAiMsgId.value = ''

    const aiMsg = addMessage('assistant', '', { thinkDuration: 0 })
    scrollTrigger.value++
    latestAiMsgId.value = aiMsg.id
    currentStreamingMsgId.value = aiMsg.id

    const messages = buildMessages()

    failedMessage.value = ''
    if (activeTimeoutId) clearTimeout(activeTimeoutId)
    if (activeAbortController) activeAbortController.abort()
    activeAbortController = new AbortController()
    const signal = activeAbortController.signal
    activeTimeoutId = setTimeout(() => activeAbortController.abort(), CONST_CONFIG.MSG_REPLY_TIMEOUT)

    const thinkStartTime = Date.now()

    try {
      const res = await fetch(`${ollamaHost.value}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel.value,
          messages,
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 2048,
            num_ctx: CONST_CONFIG.CONTEXT_LENGTH_MAP[contextLength.value]
          }
        }),
        signal
      })

      clearTimeout(activeTimeoutId)
      activeTimeoutId = null
      if (!res.ok) throw new Error(`API异常: ${res.status}`)

      const resData = await res.json()
      const fullContent = resData.message?.content || ''
      const thinkDuration = Math.floor((Date.now() - thinkStartTime) / 1000)

      const speed = CONST_CONFIG.STREAM_SPEED_MAP[streamSpeed.value] || 0
      if (speed > 0 && fullContent) {
        isStreamingActive.value = true
        await typewriteMessage(aiMsg, fullContent, thinkStartTime)
        isStreamingActive.value = false
        scrollTrigger.value++
      } else {
        updateAiMessage(aiMsg, fullContent, thinkDuration)
      }

      currentStreamingMsgId.value = null
      persistConversations()
    } catch (e) {
      clearTimeout(activeTimeoutId)
      activeTimeoutId = null
      currentStreamingMsgId.value = null
      if (e.name === 'AbortError') {
        showToast('请求超时或已取消', 'error')
      } else {
        showToast('请求失败: ' + e.message, 'error')
      }
      failedMessage.value = newContent
      const c = conversations.value[currentConversationId.value]
      if (c) {
        const aiIdx = c.messages.findIndex(m => m.id === aiMsg.id)
        if (aiIdx !== -1 && c.messages[aiIdx].content === '') {
          c.messages.splice(aiIdx, 1)
        }
        persistConversations()
      }
      isWaitingModelReply.value = false
      isStreamingActive.value = false
    }
  }

  function resendMessage(msgId) {
    const conv = conversations.value[currentConversationId.value]
    if (!conv) return
    const idx = conv.messages.findIndex(m => m.id === msgId)
    if (idx === -1 || conv.messages[idx].role !== 'user') return

    const content = conv.messages[idx].content
    conv.messages.splice(idx)
    conv.updateTime = Date.now()
    persistConversations()
    sendMessage(content)
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
      const before = conv.messages.length
      conv.messages = conv.messages.filter(msg => msg && msg.content && msg.content.trim().length > 0)
      if (conv.messages.length !== before) needsSave = true
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

    // Set latestAiMsgId and latestUserMsgId for buttons on init
    const currentConv = conversations.value[currentConversationId.value]
    if (currentConv) {
      for (let i = currentConv.messages.length - 1; i >= 0; i--) {
        const m = currentConv.messages[i]
        if (m.role === 'assistant' && m.content && !latestAiMsgId.value) {
          latestAiMsgId.value = m.id
        }
        if (m.role === 'user' && !latestUserMsgId.value) {
          latestUserMsgId.value = m.id
        }
        if (latestAiMsgId.value && latestUserMsgId.value) break
      }
    }

    // Auto-fetch models if host is configured
    if (ollamaHost.value) {
      loadModelList()
    }

    // Online/offline detection
    isOffline.value = !navigator.onLine
    window.addEventListener('online', () => { isOffline.value = false })
    window.addEventListener('offline', () => { isOffline.value = true })

    // Debug: log number of conversations loaded
    userLog(`初始化完成: ${Object.keys(conversations.value).length} 个对话`)
  }

  return {
    // State
    ollamaHost, selectedModel, streamSpeed, contextLength, streamAutoScroll, models,
    conversations, currentConversationId, conversationSearchTerm,
    sidebarCollapsed, configPanelOpen, inputCollapsed,
    isWaitingModelReply, isTempTipShowing, isOffline,
    toastMessage, toastType, toastVisible,
    currentStreamingMsgId, latestAiMsgId, latestUserMsgId, isStreamingActive, scrollTrigger,
    themePanelOpen, currentTheme, customColor, failedMessage, editMessageText,
    // Getters
    currentConversation, currentMessages,
    sortedConversationIds, filteredConversationIds, hasConversations,
    // Actions
    showToast, clearToast,
    createNewConversation, deleteConversation, renameConversation,
    togglePinConversation, switchConversation,
    setOllamaHost, setSelectedModel, setStreamSpeed, setContextLength, setStreamAutoScroll,
    loadModelList, clearConfigData, clearAllData,
    addMessage, deleteMessage, sendMessage, retrySendMessage, saveEditedMessage, resendMessage, replayStreaming, skipStreaming,
    persistConversations, initialize,
    selectTheme, setCustomColor
  }
})
