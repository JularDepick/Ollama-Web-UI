import { defineStore } from 'pinia'
import { ref, computed, nextTick } from 'vue'
import {
  CONST_CONFIG, STORAGE_KEYS, DEFAULT_CONFIG,
  THEMES, THEME_STORAGE_KEY, THEME_CUSTOM_COLOR_KEY,
  applyThemeVars, applyCustomTheme
} from '@/constants'
import { loadJSON, saveJSON, loadConfig, saveConfig, loadConversations, loadLastActiveChat, saveLastActiveChat } from '@/utils/storage'
import { genId, mergeContinuousNewlines } from '@/utils/helpers'

export const useChatStore = defineStore('chat', () => {
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

  // ============ Config State ============
  const ollamaHost = ref(loadConfig(STORAGE_KEYS.ollamaHost, DEFAULT_CONFIG.ollamaHost))
  const selectedModel = ref(loadConfig(STORAGE_KEYS.selectedModel, DEFAULT_CONFIG.selectedModel))
  const streamSpeed = ref(clamp(Number(loadConfig(STORAGE_KEYS.streamSpeed, DEFAULT_CONFIG.streamSpeed)), 0, 4))
  const contextLength = ref(clamp(Number(loadConfig(STORAGE_KEYS.contextLength, DEFAULT_CONFIG.contextLength)), 0, 6))
  const streamAutoScroll = ref(Number(loadConfig(STORAGE_KEYS.streamAutoScroll, DEFAULT_CONFIG.streamAutoScroll)))
  const models = ref(loadJSON(STORAGE_KEYS.modelList, []))
  const isLoadingModels = ref(false)
  const modelLoadError = ref('')

  function persistModelList() {
    models.value.sort((a, b) => a.localeCompare(b))
    saveJSON(STORAGE_KEYS.modelList, models.value)
  }

  // ============ Host History ============
  const hostHistory = ref(loadJSON(STORAGE_KEYS.hostHistory, []))

  function persistHostHistory() {
    hostHistory.value.sort((a, b) => a.localeCompare(b))
    saveJSON(STORAGE_KEYS.hostHistory, hostHistory.value)
  }

  function addHostToHistory(host) {
    if (!host) return
    if (!hostHistory.value.includes(host)) {
      hostHistory.value.push(host)
    }
    if (hostHistory.value.length > 50) hostHistory.value = hostHistory.value.slice(0, 50)
    persistHostHistory()
  }

  function removeHostFromHistory(host) {
    const idx = hostHistory.value.indexOf(host)
    if (idx !== -1) {
      hostHistory.value.splice(idx, 1)
      persistHostHistory()
      if (hostHistory.value.length === 0) {
        ollamaHost.value = ''
        saveConfig(STORAGE_KEYS.ollamaHost, '')
      }
    }
  }

  // ============ Conversation State ============
  const conversations = ref(loadConversations())
  const currentConversationId = ref(loadLastActiveChat())
  const conversationSearchTerm = ref('')

  // ============ UI State ============
  const sidebarCollapsed = ref(true)
  const configPanelOpen = ref(false)
  const inputCollapsed = ref(false)
  const searchPanelOpen = ref(false)
  const searchQuery = ref('')
  const isWaitingModelReply = ref(false)
  const isTempTipShowing = ref(false)
  const isOffline = ref(false)
  const toastMessage = ref('')
  const toastType = ref('info')
  const toastVisible = ref(false)

  // ============ Mobile State (U2) ============
  const isMobile = ref(window.innerWidth <= 768)
  const mobileSidebarOpen = ref(false)

  function updateIsMobile() {
    isMobile.value = window.innerWidth <= 768
    // Sync mobile sidebar state with collapsed state on resize cross threshold
    if (isMobile.value && !sidebarCollapsed.value) {
      mobileSidebarOpen.value = true
      sidebarCollapsed.value = true
    }
    if (!isMobile.value) {
      mobileSidebarOpen.value = false
    }
  }

  // ============ Help Panel State (U8) ============
  const helpPanelOpen = ref(false)

  // ============ Quote State (F7) ============
  const quotedMessage = ref(null)

  function setQuotedMessage(msg) {
    quotedMessage.value = msg ? { id: msg.id, content: msg.content, role: msg.role } : null
  }

  function clearQuotedMessage() {
    quotedMessage.value = null
  }

  // ============ Message Search State (F3) ============
  const searchResults = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return []
    const results = []
    Object.values(conversations.value).forEach(conv => {
      if (!conv.messages || !conv.messages.length) return
      conv.messages.forEach(msg => {
        if (msg.content && msg.content.toLowerCase().includes(q)) {
          results.push({
            msgId: msg.id,
            convId: conv.id,
            convName: conv.name || '未命名',
            role: msg.role,
            content: msg.content,
            sendTime: msg.sendTime
          })
        }
      })
    })
    return results
  })

  const searchResultCount = computed(() => searchResults.value.length)

  function navigateToSearchResult(convId, msgId) {
    searchPanelOpen.value = false
    if (convId !== currentConversationId.value) {
      switchConversation(convId)
    }
    // Scroll to message after switch
    setTimeout(() => {
      const el = document.querySelector(`[data-msg-id="${msgId}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('search-target-highlight')
        setTimeout(() => el.classList.remove('search-target-highlight'), 2000)
      }
    }, 100)
  }

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
      if (ca.starredAt && !cb.starredAt) return -1
      if (!ca.starredAt && cb.starredAt) return 1
      if (ca.starredAt && cb.starredAt) return cb.starredAt - ca.starredAt
      if (ca.pinned && !cb.pinned) return -1
      if (!ca.pinned && cb.pinned) return 1
      // Custom sort order (drag reorder) takes precedence over updateTime
      if (ca.sortOrder !== cb.sortOrder) return (ca.sortOrder || 0) - (cb.sortOrder || 0)
      return (cb.updateTime || 0) - (ca.updateTime || 0)
    })
  })

  // ============ Tag State ============
  const activeTagFilter = ref('')

  const availableTags = computed(() => {
    const tagSet = new Set()
    Object.values(conversations.value).forEach(conv => {
      if (conv.tags && conv.tags.length) {
        conv.tags.forEach(t => tagSet.add(t))
      }
    })
    return Array.from(tagSet).sort()
  })

  const filteredConversationIds = computed(() => {
    let ids = sortedConversationIds.value
    // Search term filter
    const term = conversationSearchTerm.value.trim().toLowerCase()
    if (term) {
      ids = ids.filter(id => {
        const conv = conversations.value[id]
        return conv.name && conv.name.toLowerCase().includes(term)
      })
    }
    // Tag filter
    if (activeTagFilter.value) {
      ids = ids.filter(id => {
        const conv = conversations.value[id]
        return conv.tags && conv.tags.includes(activeTagFilter.value)
      })
    }
    return ids
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
      starredAt: 0,
      tempPinned: false,
      updateTime: Date.now(),
      systemPrompt: '',
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      repeatPenalty: 1.1,
      currentModel: selectedModel.value,
      presets: []
    }
    currentConversationId.value = id
    persistConversations()
    persistLastActiveChat()
    sidebarCollapsed.value = true
    return id
  }

  function deleteConversation(id) {
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

  function toggleStarConversation(id) {
    const conv = conversations.value[id]
    if (conv) {
      if (conv.starredAt) {
        conv.starredAt = 0
      } else {
        conv.starredAt = Date.now()
      }
      persistConversations()
    }
  }

  function setConversationTags(id, tags) {
    const conv = conversations.value[id]
    if (conv) {
      conv.tags = tags
      persistConversations()
    }
  }

  function reorderConversation(id, targetOrder) {
    const conv = conversations.value[id]
    if (conv) {
      conv.sortOrder = targetOrder
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
  }

  // ============ Model Parameter Presets (F4) ============
  const BUILT_IN_PRESETS = [
    { id: 'preset-balanced', name: 'Balanced 均衡', builtin: true, temperature: 0.7, topP: 0.9, topK: 40, repeatPenalty: 1.1 },
    { id: 'preset-creative', name: 'Creative 创意', builtin: true, temperature: 1.0, topP: 1.0, topK: 60, repeatPenalty: 0.9 },
    { id: 'preset-precise', name: 'Precise 精准', builtin: true, temperature: 0.3, topP: 0.5, topK: 20, repeatPenalty: 1.3 }
  ]

  const currentPresets = computed(() => {
    const conv = currentConversation.value
    if (!conv) return BUILT_IN_PRESETS
    const custom = conv.presets || []
    return [...BUILT_IN_PRESETS, ...custom.map(p => ({ ...p, builtin: false }))]
  })

  function savePreset(name) {
    const conv = conversations.value[currentConversationId.value]
    if (!conv || !name.trim()) return
    if (!conv.presets) conv.presets = []
    const preset = {
      id: 'preset-custom-' + genId(),
      name: name.trim(),
      builtin: false,
      temperature: conv.temperature ?? 0.7,
      topP: conv.topP ?? 0.9,
      topK: conv.topK ?? 40,
      repeatPenalty: conv.repeatPenalty ?? 1.1
    }
    conv.presets.push(preset)
    persistConversations()
    showToast('预设 "' + preset.name + '" 已保存', 'success')
  }

  function deletePreset(presetId) {
    const conv = conversations.value[currentConversationId.value]
    if (!conv || !conv.presets) return
    const idx = conv.presets.findIndex(p => p.id === presetId)
    if (idx === -1) return
    const name = conv.presets[idx].name
    conv.presets.splice(idx, 1)
    persistConversations()
    showToast('预设 "' + name + '" 已删除', 'info')
  }

  function applyPreset(preset) {
    const conv = conversations.value[currentConversationId.value]
    if (!conv) return
    conv.temperature = preset.temperature
    conv.topP = preset.topP
    conv.topK = preset.topK
    conv.repeatPenalty = preset.repeatPenalty
    conv.updateTime = Date.now()
    persistConversations()
    showToast('已应用预设: ' + preset.name, 'success')
  }

  // ============ Per-Conversation Parameter Actions (B4, B5) ============
  function setSystemPrompt(text) {
    const conv = conversations.value[currentConversationId.value]
    if (conv) {
      conv.systemPrompt = text
      conv.updateTime = Date.now()
      persistConversations()
    }
  }

  function setTemperature(val) {
    const conv = conversations.value[currentConversationId.value]
    if (conv) { conv.temperature = val; persistConversations() }
  }

  function setTopP(val) {
    const conv = conversations.value[currentConversationId.value]
    if (conv) { conv.topP = val; persistConversations() }
  }

  function setTopK(val) {
    const conv = conversations.value[currentConversationId.value]
    if (conv) { conv.topK = val; persistConversations() }
  }

  function setRepeatPenalty(val) {
    const conv = conversations.value[currentConversationId.value]
    if (conv) { conv.repeatPenalty = val; persistConversations() }
  }

  function setCurrentModel(val) {
    const conv = conversations.value[currentConversationId.value]
    if (conv) {
      conv.currentModel = val
      conv.updateTime = Date.now()
      persistConversations()
    }
  }

  // ============ Conversation Stats (F5) ============
  const currentConversationStats = computed(() => {
    const conv = currentConversation.value
    if (!conv || !conv.messages || !conv.messages.length) {
      return { messageCount: 0, tokenEstimate: 0, modelFrequency: {} }
    }
    const msgs = conv.messages
    const modelFreq = {}
    let totalChars = 0
    msgs.forEach(m => {
      totalChars += (m.content || '').length
      const modelName = m.model || '未知'
      modelFreq[modelName] = (modelFreq[modelName] || 0) + 1
    })
    return {
      messageCount: msgs.length,
      tokenEstimate: Math.max(1, Math.round(totalChars / 4)),
      modelFrequency: modelFreq
    }
  })

  // ============ Export Functions (B2) ============
  function exportCurrentConversationJson() {
    const conv = currentConversation.value
    if (!conv || !conv.messages.length) {
      showToast('当前对话无消息可导出', 'warning')
      return
    }
    const data = JSON.stringify({
      name: conv.name,
      exportTime: new Date().toISOString(),
      messages: conv.messages.map(m => ({
        role: m.role,
        content: m.content,
        sendTime: m.sendTime
      }))
    }, null, 2)
    downloadFile(data, `对话-${conv.name || '未命名'}.json`, 'application/json')
    showToast('已导出 JSON', 'success')
  }

  function exportCurrentConversationMarkdown() {
    const conv = currentConversation.value
    if (!conv || !conv.messages.length) {
      showToast('当前对话无消息可导出', 'warning')
      return
    }
    const timeStr = new Date().toLocaleString()
    let md = `# ${conv.name || '未命名对话'}\n\n导出时间: ${timeStr}\n\n---\n\n`
    for (const msg of conv.messages) {
      const label = msg.role === 'user' ? '**用户**' : '**AI**'
      md += `### ${label}\n\n${msg.content}\n\n---\n\n`
    }
    downloadFile(md, `对话-${conv.name || '未命名'}.md`, 'text/markdown')
    showToast('已导出 Markdown', 'success')
  }

  function exportAllConversations() {
    const convs = conversations.value
    const ids = Object.keys(convs)
    if (ids.length === 0) {
      showToast('没有可导出的对话', 'warning')
      return
    }
    const exportData = {}
    ids.forEach(id => {
      const c = convs[id]
      if (c.messages && c.messages.length) {
        exportData[id] = {
          name: c.name,
          updateTime: c.updateTime,
          messages: c.messages.map(m => ({ role: m.role, content: m.content, sendTime: m.sendTime }))
        }
      }
    })
    const data = JSON.stringify(exportData, null, 2)
    downloadFile(data, `全部对话-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')
    showToast('已批量导出', 'success')
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
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
    isLoadingModels.value = true
    modelLoadError.value = ''
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), CONST_CONFIG.MODEL_LIST_TIMEOUT)
      const res = await fetch(`${ollamaHost.value}/api/tags`, { method: 'GET', signal: controller.signal })
      clearTimeout(timeoutId)
      if (!res.ok) throw new Error(`接口异常: ${res.status} ${res.statusText}`)
      const resData = await res.json()
      const fetchedModels = resData.models || []
      const apiNames = fetchedModels.map(m => m.name)

      // Merge API names into existing list (deduplicate, don't overwrite)
      apiNames.forEach(name => {
        if (!models.value.includes(name)) {
          models.value.push(name)
        }
      })
      persistModelList()

      if (apiNames.length === 0) {
        showToast('暂无可用模型', 'warning')
      } else if (!selectedModel.value || !models.value.includes(selectedModel.value)) {
        selectedModel.value = apiNames[0]
        saveConfig(STORAGE_KEYS.selectedModel, selectedModel.value)
      }
    } catch (e) {
      modelLoadError.value = e.message
      showToast('模型加载失败: ' + e.message, 'error')
    } finally {
      isLoadingModels.value = false
    }
  }

  function addCustomModel(name) {
    const trimmed = name.trim()
    if (!trimmed || models.value.includes(trimmed)) {
      showToast('模型名称无效或已存在', 'warning')
      return false
    }
    models.value.push(trimmed)
    persistModelList()
    if (!selectedModel.value) {
      selectedModel.value = trimmed
      saveConfig(STORAGE_KEYS.selectedModel, trimmed)
    }
    return true
  }

  function removeModel(name) {
    const idx = models.value.indexOf(name)
    if (idx === -1) return
    models.value.splice(idx, 1)
    persistModelList()
    if (selectedModel.value === name) {
      selectedModel.value = models.value[0] || ''
      saveConfig(STORAGE_KEYS.selectedModel, selectedModel.value)
    }
  }

  function clearConfigData() {
    const keys = [
      STORAGE_KEYS.selectedModel, STORAGE_KEYS.ollamaHost,
      STORAGE_KEYS.streamSpeed, STORAGE_KEYS.contextLength,
      STORAGE_KEYS.streamAutoScroll, STORAGE_KEYS.modelList
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
    localStorage.removeItem(THEME_STORAGE_KEY)
    localStorage.removeItem(THEME_CUSTOM_COLOR_KEY)
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
    currentTheme.value = 'default'
    customColor.value = ''
    createNewConversation()
    showToast('所有数据已清除，初始化新会话', 'success')
  }

  // ============ Message Actions ============
  function addMessage(role, content, extra = {}) {
    const conv = conversations.value[currentConversationId.value]
    const msg = {
      id: genId(),
      role,
      content,
      sendTime: Date.now(),
      thinkDuration: extra.thinkDuration || 0,
      model: conv?.currentModel || selectedModel.value,
      ...extra
    }
    // F7: Attach quote info if exists for user messages
    if (role === 'user' && quotedMessage.value) {
      msg.replyTo = { ...quotedMessage.value }
      clearQuotedMessage()
    }
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

    const msgs = conv.messages.filter(m => m.content).map(m => {
      // F7: Embed quote at the beginning of content if present
      let content = m.content
      if (m.replyTo && m.replyTo.content) {
        const roleLabel = m.replyTo.role === 'user' ? '用户' : 'AI'
        const preview = m.replyTo.content.slice(0, 200)
        content = `> 引用于 ${roleLabel}:\n> ${preview.replace(/\n/g, '\n> ')}\n\n${content}`
      }
      return { role: m.role, content }
    })

    // Prepend system prompt if non-empty
    if (conv.systemPrompt && conv.systemPrompt.trim()) {
      msgs.unshift({ role: 'system', content: conv.systemPrompt.trim() })
    }

    let total = msgs.reduce((sum, m) => sum + m.content.length, 0)
    while (total > maxChars && msgs.length > 1) {
      const removeIdx = msgs[0].role === 'system' ? 1 : 0
      total -= msgs[removeIdx].content.length
      msgs.splice(removeIdx, 1)
    }
    return msgs
  }

  // ============ API / Streaming ============
  let activeAbortController = null
  let activeTimeoutId = null
  const editMessageText = ref('')

  /** Validate and normalize message content */
  function validateSendMessage(msgContent) {
    const msg = mergeContinuousNewlines(msgContent)
    return msg || null
  }

  /** @returns {Promise<string>} message content from the Ollama API */
  async function executeApiCall(messages, signal) {
    const model = currentConversation.value?.currentModel || selectedModel.value
    const res = await fetch(`${ollamaHost.value}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: currentConversation.value?.temperature ?? 0.7,
          top_p: currentConversation.value?.topP ?? 0.9,
          top_k: currentConversation.value?.topK ?? 40,
          repeat_penalty: currentConversation.value?.repeatPenalty ?? 1.1,
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
    return resData.message?.content || ''
  }

  /** Handle typewriter/rendering and persistence after a successful API call */
  async function handleStreamResult(aiMsg, fullContent, thinkStartTime) {
    const speed = CONST_CONFIG.STREAM_SPEED_MAP[streamSpeed.value] || 0
    if (speed > 0 && fullContent) {
      isStreamingActive.value = true
      await typewriteMessage(aiMsg, fullContent, thinkStartTime)
      isStreamingActive.value = false
      scrollTrigger.value++
    } else {
      const thinkDuration = Math.floor((Date.now() - thinkStartTime) / 1000)
      updateAiMessage(aiMsg, fullContent, thinkDuration)
    }
    currentStreamingMsgId.value = null
    persistConversations()
  }

  /** Handle API errors: toast, log, cleanup empty AI message */
  function handleSendError(e, failedPayload, aiMsg) {
    clearTimeout(activeTimeoutId)
    activeTimeoutId = null
    currentStreamingMsgId.value = null

    if (e.name === 'AbortError') {
      showToast('请求超时或已取消', 'error')
    } else {
      showToast('请求失败: ' + e.message, 'error')
    }

    // Clean up empty AI message
    const conv = conversations.value[currentConversationId.value]
    if (conv) {
      const idx = conv.messages.findIndex(m => m.id === aiMsg.id)
      if (idx !== -1 && conv.messages[idx].content === '') {
        conv.messages.splice(idx, 1)
      }
      persistConversations()
    }
  }

  /**
   * Shared AI call flow: abort setup → API call → stream/error → finally cleanup.
   * Used by both sendMessage and saveEditedMessage.
   */
  async function _executeSendFlow(aiMsg, failedPayload) {
    if (activeTimeoutId) clearTimeout(activeTimeoutId)
    if (activeAbortController) activeAbortController.abort()
    activeAbortController = new AbortController()
    const signal = activeAbortController.signal
    activeTimeoutId = setTimeout(() => activeAbortController.abort(), CONST_CONFIG.MSG_REPLY_TIMEOUT)

    const thinkStartTime = Date.now()

    try {
      const fullContent = await executeApiCall(buildMessages(), signal)
      await handleStreamResult(aiMsg, fullContent, thinkStartTime)
    } catch (e) {
      handleSendError(e, failedPayload, aiMsg)
    } finally {
      isWaitingModelReply.value = false
      isStreamingActive.value = false
      activeAbortController = null
    }
  }

  async function sendMessage(msgContent) {
    const msg = validateSendMessage(msgContent)
    if (!msg) return

    // Ensure a conversation exists
    if (!currentConversationId.value || !conversations.value[currentConversationId.value]) {
      createNewConversation()
    }

    isWaitingModelReply.value = true
    clearToast()
    isStreamingActive.value = false
    latestAiMsgId.value = ''

    // Add user message
    addMessage('user', msg)
    latestUserMsgId.value = conversations.value[currentConversationId.value].messages.slice(-1)[0].id

    // Create pending AI message
    const aiMsg = addMessage('assistant', '', { thinkDuration: 0 })
    scrollTrigger.value++
    latestAiMsgId.value = aiMsg.id
    currentStreamingMsgId.value = aiMsg.id

    await _executeSendFlow(aiMsg, msg)
  }

  async function typewriteMessage(aiMsg, fullContent, thinkStartTime) {
    const speed = CONST_CONFIG.STREAM_SPEED_MAP[streamSpeed.value] || 16
    const delay = Math.max(8, Math.floor(1000 / speed))
    const totalLen = fullContent.length

    return new Promise(resolve => {
      const startTime = performance.now()
      let lastRenderedPos = 0

      function frame() {
        if (!isStreamingActive.value) {
          // Aborted — show full content
          updateAiMessage(aiMsg, fullContent, Math.floor((Date.now() - thinkStartTime) / 1000))
          resolve()
          return
        }

        const elapsed = performance.now() - startTime
        const pos = Math.min(totalLen, Math.floor(elapsed / delay))

        // Only re-render when we cross a newline or accumulate enough chars
        const nextNewline = fullContent.indexOf('\n', lastRenderedPos)
        if (nextNewline >= 0 && nextNewline < pos) {
          updateAiMessage(aiMsg, fullContent.slice(0, nextNewline + 1), Math.floor((Date.now() - thinkStartTime) / 1000))
          lastRenderedPos = nextNewline + 1
        } else if (pos - lastRenderedPos > 300) {
          // Fallback: render if too many chars without a newline
          updateAiMessage(aiMsg, fullContent.slice(0, pos), Math.floor((Date.now() - thinkStartTime) / 1000))
          lastRenderedPos = pos
        }

        if (pos >= totalLen) {
          updateAiMessage(aiMsg, fullContent, Math.floor((Date.now() - thinkStartTime) / 1000))
          resolve()
        } else {
          requestAnimationFrame(frame)
        }
      }

      requestAnimationFrame(frame)
    })
  }

  function updateAiMessage(aiMsg, content, thinkDuration) {
    const conv = conversations.value[currentConversationId.value]
    if (!conv) return
    const idx = conv.messages.findIndex(m => m.id === aiMsg.id)
    if (idx === -1) return
    conv.messages[idx].content = content
    conv.messages[idx].thinkDuration = thinkDuration
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

    // Trigger API resend — same flow as sendMessage
    isWaitingModelReply.value = true
    clearToast()
    isStreamingActive.value = false
    latestAiMsgId.value = ''

    const aiMsg = addMessage('assistant', '', { thinkDuration: 0 })
    scrollTrigger.value++
    latestAiMsgId.value = aiMsg.id
    currentStreamingMsgId.value = aiMsg.id

    await _executeSendFlow(aiMsg, newContent)
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
      if (!conv.hasOwnProperty('starredAt')) { conv.starredAt = 0; needsSave = true }
      if (!conv.hasOwnProperty('tags')) { conv.tags = []; needsSave = true }
      if (!conv.hasOwnProperty('tempPinned')) { conv.tempPinned = false; needsSave = true }
      if (!conv.hasOwnProperty('updateTime')) { conv.updateTime = Date.now(); needsSave = true }
      if (!conv.hasOwnProperty('systemPrompt')) { conv.systemPrompt = ''; needsSave = true }
      if (!conv.hasOwnProperty('temperature')) { conv.temperature = 0.7; needsSave = true }
      if (!conv.hasOwnProperty('topP')) { conv.topP = 0.9; needsSave = true }
      if (!conv.hasOwnProperty('topK')) { conv.topK = 40; needsSave = true }
      if (!conv.hasOwnProperty('repeatPenalty')) { conv.repeatPenalty = 1.1; needsSave = true }
      if (!conv.hasOwnProperty('currentModel')) { conv.currentModel = selectedModel.value; needsSave = true }
      if (!conv.hasOwnProperty('presets')) { conv.presets = []; needsSave = true }
      if (!conv.hasOwnProperty('sortOrder')) { conv.sortOrder = conv.updateTime || Date.now(); needsSave = true }
      // Ensure message IDs
      const before = conv.messages.length
      conv.messages = conv.messages.filter(msg => msg && msg.content && msg.content.trim().length > 0)
      if (conv.messages.length !== before) needsSave = true
      conv.messages.forEach((msg, i) => {
        if (!msg.id) { msg.id = genId(); needsSave = true }
        if (!msg.sendTime) { msg.sendTime = Date.now() - (conv.messages.length - i) * 1000; needsSave = true }
        if (!msg.hasOwnProperty('model')) { msg.model = conv.currentModel || ''; needsSave = true }
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

    // Ensure current host is in history
    if (ollamaHost.value && /^https?:\/\//.test(ollamaHost.value) && !hostHistory.value.includes(ollamaHost.value)) {
      hostHistory.value.push(ollamaHost.value)
      persistHostHistory()
    }

    // Online/offline detection
    isOffline.value = !navigator.onLine
    window.addEventListener('online', () => { isOffline.value = false })
    window.addEventListener('offline', () => { isOffline.value = true })
  }

  return {
    // State
    ollamaHost, selectedModel, streamSpeed, contextLength, streamAutoScroll, models, isLoadingModels, modelLoadError,
    conversations, currentConversationId, conversationSearchTerm,
    sidebarCollapsed, configPanelOpen, inputCollapsed, searchPanelOpen, searchQuery,
    isWaitingModelReply, isTempTipShowing, isOffline,
    toastMessage, toastType, toastVisible,
    isMobile, mobileSidebarOpen, updateIsMobile, helpPanelOpen,
    currentStreamingMsgId, latestAiMsgId, latestUserMsgId, isStreamingActive, scrollTrigger,
    quotedMessage, setQuotedMessage, clearQuotedMessage,
    searchResults, searchResultCount, navigateToSearchResult,
    // Getters
    currentConversation, currentMessages,
    sortedConversationIds, filteredConversationIds, hasConversations,
    // Actions
    showToast, clearToast,
    createNewConversation, deleteConversation, renameConversation, reorderConversation,
    togglePinConversation, toggleStarConversation,
    activeTagFilter, availableTags, setConversationTags,
    currentConversationStats, switchConversation,
    setOllamaHost, setSelectedModel, setStreamSpeed, setContextLength, setStreamAutoScroll,
    loadModelList, clearConfigData, clearAllData,
    addCustomModel, removeModel, hostHistory, addHostToHistory, removeHostFromHistory,
    setSystemPrompt, setTemperature, setTopP, setTopK, setRepeatPenalty, setCurrentModel,
    currentPresets, savePreset, deletePreset, applyPreset,
    exportCurrentConversationJson, exportCurrentConversationMarkdown, exportAllConversations,
    addMessage, deleteMessage, sendMessage, saveEditedMessage, resendMessage, replayStreaming, skipStreaming,
    persistConversations, initialize,
    selectTheme, setCustomColor
  }
})
