import { defineStore } from 'pinia'
import { ref, computed, nextTick } from 'vue'
import {
  CONST_CONFIG, STORAGE_KEYS, DEFAULT_CONFIG,
  THEMES, THEME_STORAGE_KEY, THEME_CUSTOM_COLOR_KEY,
  applyThemeVars, applyCustomTheme
} from '@/constants'
import { loadJSON, saveJSON, loadConfig, saveConfig, loadConversations, loadLastActiveChat, saveLastActiveChat, getStorageUsage, checkStorageQuota } from '@/utils/storage'
import { genId, mergeContinuousNewlines, debounce } from '@/utils/helpers'

export const useChatStore = defineStore('chat', () => {
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

  // ============ Config State ============
  const ollamaHost = ref(loadConfig(STORAGE_KEYS.ollamaHost, DEFAULT_CONFIG.ollamaHost))
  const selectedModel = ref(loadConfig(STORAGE_KEYS.selectedModel, DEFAULT_CONFIG.selectedModel))
  const streamSpeed = ref(clamp(Number(loadConfig(STORAGE_KEYS.streamSpeed, DEFAULT_CONFIG.streamSpeed)), 0, 4))
  const contextLength = ref(clamp(Number(loadConfig(STORAGE_KEYS.contextLength, DEFAULT_CONFIG.contextLength)), 0, 6))
  const streamAutoScroll = ref(Number(loadConfig(STORAGE_KEYS.streamAutoScroll, DEFAULT_CONFIG.streamAutoScroll)))
  const models = ref(loadJSON(STORAGE_KEYS.modelList, []))
  const modelDetails = ref({}) // { modelName: { size, parameter_size, quantization_level, format } }
  const isLoadingModels = ref(false)
  const modelLoadError = ref('')

  // Connection health check
  const connectionStatus = ref('unknown') // 'connected' | 'disconnected' | 'checking' | 'unknown'
  const lastConnectionCheck = ref(0)
  let connectionCheckTimer = null

  // Save status indicator
  const saveStatus = ref('idle') // 'idle' | 'saving' | 'saved' | 'error'
  let saveStatusTimer = null

  // Model performance tracking
  const modelPerformance = ref({}) // { modelName: { lastResponseTime, lastTokensPerSecond, totalCalls, avgResponseTime } }

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
  // In-conversation search
  const inChatSearchOpen = ref(false)
  const inChatSearchQuery = ref('')
  const inChatSearchIndex = ref(0)
  const isWaitingModelReply = ref(false)
  const isTempTipShowing = ref(false)
  const isOffline = ref(false)
  const toastMessage = ref('')
  const toastType = ref('info')
  const toastVisible = ref(false)

  // ============ Confirm Dialog State ============
  const confirmVisible = ref(false)
  const confirmTitle = ref('')
  const confirmMessage = ref('')
  const confirmResolve = ref(null)

  function showConfirm(title, message) {
    return new Promise((resolve) => {
      confirmTitle.value = title
      confirmMessage.value = message
      confirmVisible.value = true
      confirmResolve.value = resolve
    })
  }

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

  // ============ Draft State (auto-save) ============
  const drafts = ref(loadJSON('ollama_drafts', {}))

  function saveDraft(convId, text) {
    if (!convId) return
    if (text && text.trim()) {
      drafts.value[convId] = text
    } else {
      delete drafts.value[convId]
    }
    saveJSON('ollama_drafts', drafts.value)
  }

  function getDraft(convId) {
    return drafts.value[convId] || ''
  }

  function clearDraft(convId) {
    if (convId && drafts.value[convId]) {
      delete drafts.value[convId]
      saveJSON('ollama_drafts', drafts.value)
    }
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

  // ============ In-conversation search ============
  const inChatSearchResults = computed(() => {
    const q = inChatSearchQuery.value.trim().toLowerCase()
    if (!q) return []
    return currentMessages.value
      .filter(m => m.content && m.content.toLowerCase().includes(q))
      .map(m => m.id)
  })

  const inChatSearchTotal = computed(() => inChatSearchResults.value.length)
  const inChatSearchCurrentMsgId = computed(() => {
    const results = inChatSearchResults.value
    if (!results.length) return null
    const idx = Math.min(inChatSearchIndex.value, results.length - 1)
    return results[idx]
  })

  function nextInChatSearchResult() {
    const total = inChatSearchTotal.value
    if (!total) return
    inChatSearchIndex.value = (inChatSearchIndex.value + 1) % total
    scrollToInChatSearchResult()
  }

  function prevInChatSearchResult() {
    const total = inChatSearchTotal.value
    if (!total) return
    inChatSearchIndex.value = (inChatSearchIndex.value - 1 + total) % total
    scrollToInChatSearchResult()
  }

  function scrollToInChatSearchResult() {
    const msgId = inChatSearchCurrentMsgId.value
    if (!msgId) return
    setTimeout(() => {
      const el = document.querySelector(`[data-msg-id="${msgId}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('search-target-highlight')
        setTimeout(() => el.classList.remove('search-target-highlight'), 1500)
      }
    }, 50)
  }

  function toggleInChatSearch() {
    inChatSearchOpen.value = !inChatSearchOpen.value
    if (!inChatSearchOpen.value) {
      inChatSearchQuery.value = ''
      inChatSearchIndex.value = 0
    }
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

  const showArchived = ref(false)
  const archivedCount = computed(() => Object.values(conversations.value).filter(c => c.archived).length)

  const filteredConversationIds = computed(() => {
    let ids = sortedConversationIds.value
    // Archive filter
    if (!showArchived.value) {
      ids = ids.filter(id => !conversations.value[id]?.archived)
    }
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
  const storageUsage = ref({ bytes: 0, limit: 5242880, percent: 0, formatted: '0 B', limitFormatted: '5 MB' })

  function updateStorageUsage() {
    storageUsage.value = getStorageUsage()
  }

  function persistConversations() {
    saveStatus.value = 'saving'
    clearTimeout(saveStatusTimer)
    const result = saveJSON(STORAGE_KEYS.conversations, conversations.value)
    // Check storage quota on every save (throttled by debounce on frequent saves)
    checkStorageQuota(showToast)
    updateStorageUsage()
    saveStatus.value = result ? 'saved' : 'error'
    saveStatusTimer = setTimeout(() => { saveStatus.value = 'idle' }, 2000)
    return result
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
      archived: false,
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

  function duplicateConversation(id) {
    const src = conversations.value[id]
    if (!src) return
    const newId = genId()
    const now = Date.now()
    const newConv = {
      ...JSON.parse(JSON.stringify(src)),
      id: newId,
      name: src.name + ' (副本)',
      messages: src.messages.map(m => ({ ...m, id: genId() })),
      createTime: now,
      updateTime: now,
      sortOrder: now
    }
    conversations.value[newId] = newConv
    currentConversationId.value = newId
    persistConversations()
    persistLastActiveChat()
    showToast('对话已复制', 'success')
  }

  function clearCurrentChat() {
    const conv = conversations.value[currentConversationId.value]
    if (!conv) return
    conv.messages = []
    conv.updateTime = Date.now()
    latestAiMsgId.value = ''
    latestUserMsgId.value = ''
    persistConversations()
    showToast('对话已清空', 'success')
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

  function archiveConversation(id) {
    const conv = conversations.value[id]
    if (conv) {
      conv.archived = true
      conv.archivedAt = Date.now()
      persistConversations()
      showToast('对话已归档', 'success')
      // Switch to another conversation if archiving current
      if (currentConversationId.value === id) {
        const remaining = sortedConversationIds.value.filter(cid => !conversations.value[cid]?.archived)
        currentConversationId.value = remaining[0] || ''
        if (!currentConversationId.value) createNewConversation()
        persistLastActiveChat()
      }
    }
  }

  function unarchiveConversation(id) {
    const conv = conversations.value[id]
    if (conv) {
      conv.archived = false
      conv.archivedAt = 0
      persistConversations()
      showToast('对话已恢复', 'success')
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
  const debouncedPersist = debounce(() => persistConversations(), 500)

  function setSystemPrompt(text) {
    const conv = conversations.value[currentConversationId.value]
    if (conv) {
      conv.systemPrompt = text
      conv.updateTime = Date.now()
      debouncedPersist()
    }
  }

  function setTemperature(val) {
    const conv = conversations.value[currentConversationId.value]
    if (conv) { conv.temperature = val; debouncedPersist() }
  }

  function setTopP(val) {
    const conv = conversations.value[currentConversationId.value]
    if (conv) { conv.topP = val; debouncedPersist() }
  }

  function setTopK(val) {
    const conv = conversations.value[currentConversationId.value]
    if (conv) { conv.topK = val; debouncedPersist() }
  }

  function setRepeatPenalty(val) {
    const conv = conversations.value[currentConversationId.value]
    if (conv) { conv.repeatPenalty = val; debouncedPersist() }
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

  const globalStats = computed(() => {
    const convs = Object.values(conversations.value)
    let totalMessages = 0
    let totalChars = 0
    let userMessages = 0
    let aiMessages = 0
    const modelFreq = {}

    convs.forEach(conv => {
      if (conv.messages) {
        totalMessages += conv.messages.length
        conv.messages.forEach(m => {
          totalChars += (m.content || '').length
          if (m.role === 'user') userMessages++
          else aiMessages++
          if (m.model) {
            modelFreq[m.model] = (modelFreq[m.model] || 0) + 1
          }
        })
      }
    })

    return {
      conversationCount: convs.length,
      totalMessages,
      userMessages,
      aiMessages,
      totalChars,
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

  function backupAllData() {
    const backup = {
      version: 1,
      timestamp: Date.now(),
      conversations: conversations.value,
      settings: {
        ollamaHost: ollamaHost.value,
        selectedModel: selectedModel.value,
        streamSpeed: streamSpeed.value,
        contextLength: contextLength.value,
        streamAutoScroll: streamAutoScroll.value
      },
      templates: templates.value,
      snippets: snippets.value,
      hostHistory: hostHistory.value
    }
    const data = JSON.stringify(backup, null, 2)
    downloadFile(data, `Ollama-Web-UI-备份-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')
    showToast('备份已下载', 'success')
  }

  function restoreBackup(file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const backup = JSON.parse(e.target.result)
        if (!backup.version || !backup.conversations) {
          showToast('备份文件格式无效', 'error')
          return
        }

        // Restore conversations
        conversations.value = backup.conversations

        // Restore settings
        if (backup.settings) {
          if (backup.settings.ollamaHost) {
            ollamaHost.value = backup.settings.ollamaHost
            saveConfig(STORAGE_KEYS.ollamaHost, backup.settings.ollamaHost)
          }
          if (backup.settings.selectedModel) {
            selectedModel.value = backup.settings.selectedModel
            saveConfig(STORAGE_KEYS.selectedModel, backup.settings.selectedModel)
          }
          if (backup.settings.streamSpeed !== undefined) {
            streamSpeed.value = backup.settings.streamSpeed
            saveConfig(STORAGE_KEYS.streamSpeed, String(backup.settings.streamSpeed))
          }
          if (backup.settings.contextLength !== undefined) {
            contextLength.value = backup.settings.contextLength
            saveConfig(STORAGE_KEYS.contextLength, String(backup.settings.contextLength))
          }
          if (backup.settings.streamAutoScroll !== undefined) {
            streamAutoScroll.value = backup.settings.streamAutoScroll
            saveConfig(STORAGE_KEYS.streamAutoScroll, String(backup.settings.streamAutoScroll))
          }
        }

        // Restore templates
        if (backup.templates) {
          templates.value = backup.templates
          persistTemplates()
        }

        // Restore snippets
        if (backup.snippets) {
          snippets.value = backup.snippets
          persistSnippets()
        }

        // Restore host history
        if (backup.hostHistory) {
          hostHistory.value = backup.hostHistory
          persistHostHistory()
        }

        persistConversations()
        showToast('备份已恢复', 'success')
      } catch {
        showToast('恢复失败: 文件解析错误', 'error')
      }
    }
    reader.readAsText(file)
  }

  function exportCurrentConversationHtml() {
    const conv = currentConversation.value
    if (!conv || !conv.messages.length) {
      showToast('当前对话无消息可导出', 'warning')
      return
    }
    const timeStr = new Date().toLocaleString()
    let messagesHtml = ''
    for (const msg of conv.messages) {
      const isUser = msg.role === 'user'
      const label = isUser ? '用户' : 'AI'
      const time = msg.sendTime ? new Date(msg.sendTime).toLocaleTimeString() : ''
      const escapedContent = (msg.content || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
      messagesHtml += `<div class="msg ${isUser ? 'user' : 'ai'}"><div class="msg-header"><span class="msg-label">${label}</span><span class="msg-time">${time}</span></div><div class="msg-content">${escapedContent}</div></div>\n`
    }
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${conv.name || '对话'}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Microsoft YaHei','PingFang SC',sans-serif;max-width:800px;margin:0 auto;padding:24px;background:#f5f7fa;color:#333;line-height:1.6}
h1{font-size:22px;color:#1677ff;border-bottom:2px solid #1677ff;padding-bottom:10px;margin-bottom:12px}
.meta{color:#888;font-size:13px;margin-bottom:24px}
.msg{margin-bottom:16px;padding:14px 18px;border-radius:12px;max-width:85%}
.msg.user{background:linear-gradient(135deg,#1677ff,#4096ff);color:#fff;margin-left:auto;border-top-right-radius:4px}
.msg.ai{background:#fff;border:1px solid #e5e7eb;border-top-left-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.05)}
.msg-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.msg-label{font-size:12px;font-weight:600;opacity:0.8}
.msg-time{font-size:11px;opacity:0.6}
.msg-content{line-height:1.7;font-size:15px;word-break:break-word}
.msg-content code{background:rgba(0,0,0,0.06);padding:1px 5px;border-radius:3px;font-family:'JetBrains Mono',monospace;font-size:14px}
.msg.user .msg-content code{background:rgba(255,255,255,0.2)}
.footer{margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#999}
@media print{body{background:#fff;padding:12px}.msg{break-inside:avoid}}
</style>
</head>
<body>
<h1>${conv.name || '未命名对话'}</h1>
<div class="meta">导出时间: ${timeStr} | 消息数: ${conv.messages.length}</div>
${messagesHtml}
<div class="footer">由 Ollama-Web-UI 导出</div>
</body>
</html>`
    downloadFile(html, `对话-${conv.name || '未命名'}.html`, 'text/html')
    showToast('已导出 HTML', 'success')
  }

  function printConversation() {
    const conv = currentConversation.value
    if (!conv || !conv.messages.length) {
      showToast('当前对话无消息可打印', 'warning')
      return
    }
    const timeStr = new Date().toLocaleString()
    let messagesHtml = ''
    for (const msg of conv.messages) {
      const isUser = msg.role === 'user'
      const label = isUser ? '用户' : 'AI'
      const time = msg.sendTime ? new Date(msg.sendTime).toLocaleTimeString() : ''
      const escapedContent = (msg.content || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
      messagesHtml += `<div class="msg ${isUser ? 'user' : 'ai'}"><div class="msg-header"><span class="msg-label">${label}</span><span class="msg-time">${time}</span></div><div class="msg-content">${escapedContent}</div></div>\n`
    }
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${conv.name || '对话'}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Microsoft YaHei','PingFang SC',sans-serif;max-width:800px;margin:0 auto;padding:24px;background:#fff;color:#333;line-height:1.6}
h1{font-size:22px;color:#1677ff;border-bottom:2px solid #1677ff;padding-bottom:10px;margin-bottom:12px}
.meta{color:#888;font-size:13px;margin-bottom:24px}
.msg{margin-bottom:16px;padding:14px 18px;border-radius:12px;max-width:85%}
.msg.user{background:linear-gradient(135deg,#1677ff,#4096ff);color:#fff;margin-left:auto;border-top-right-radius:4px}
.msg.ai{background:#fff;border:1px solid #e5e7eb;border-top-left-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.05)}
.msg-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.msg-label{font-size:12px;font-weight:600;opacity:0.8}
.msg-time{font-size:11px;opacity:0.6}
.msg-content{line-height:1.7;font-size:15px;word-break:break-word}
.msg-content code{background:rgba(0,0,0,0.06);padding:1px 5px;border-radius:3px;font-family:'JetBrains Mono',monospace;font-size:14px}
.msg.user .msg-content code{background:rgba(255,255,255,0.2)}
.footer{margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#999}
@media print{body{padding:12px}.msg{break-inside:avoid}}
</style>
</head>
<body>
<h1>${conv.name || '未命名对话'}</h1>
<div class="meta">打印时间: ${timeStr} | 消息数: ${conv.messages.length}</div>
${messagesHtml}
<div class="footer">由 Ollama-Web-UI 导出</div>
<script>window.onload=function(){window.print()}<\/script>
</body>
</html>`
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
    } else {
      showToast('请允许弹出窗口以打印', 'warning')
    }
  }

  function copyConversationAsText() {
    const conv = currentConversation.value
    if (!conv || !conv.messages.length) {
      showToast('当前对话无消息可复制', 'warning')
      return
    }
    const timeStr = new Date().toLocaleString()
    let text = `${conv.name || '未命名对话'}\n导出时间: ${timeStr}\n${'─'.repeat(30)}\n\n`
    for (const msg of conv.messages) {
      const label = msg.role === 'user' ? '【用户】' : '【AI】'
      text += `${label}\n${msg.content}\n\n`
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('已复制对话文本', 'success')
      }).catch(() => {
        fallbackCopyText(text)
      })
    } else {
      fallbackCopyText(text)
    }
  }

  function fallbackCopyText(text) {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    showToast('已复制对话文本', 'success')
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

  function importConversations(file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        let imported = 0

        // Handle both single conversation export and batch export
        const entries = data.messages ? { [genId()]: data } : data

        for (const [id, convData] of Object.entries(entries)) {
          if (!convData.messages || !Array.isArray(convData.messages)) continue
          const newId = genId()
          conversations.value[newId] = {
            id: newId,
            name: convData.name || '导入的对话',
            messages: convData.messages.map(m => ({
              id: genId(),
              role: m.role,
              content: m.content || '',
              sendTime: m.sendTime || Date.now(),
              model: m.model || '',
              thinkDuration: m.thinkDuration || 0
            })),
            pinned: false,
            starredAt: 0,
            tempPinned: false,
            updateTime: convData.updateTime || Date.now(),
            systemPrompt: '',
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
            repeatPenalty: 1.1,
            currentModel: selectedModel.value,
            presets: [],
            sortOrder: convData.updateTime || Date.now()
          }
          imported++
        }

        if (imported > 0) {
          persistConversations()
          showToast(`已导入 ${imported} 个对话`, 'success')
        } else {
          showToast('文件格式无效', 'error')
        }
      } catch {
        showToast('导入失败: 文件解析错误', 'error')
      }
    }
    reader.readAsText(file)
  }

  function importMarkdown(file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target.result
        const lines = content.split('\n')
        const messages = []
        let currentRole = null
        let currentContent = []

        for (const line of lines) {
          // Check for role headers like "## 用户" or "## AI"
          if (line.startsWith('## 用户') || line.startsWith('## User')) {
            if (currentRole && currentContent.length) {
              messages.push({ role: currentRole, content: currentContent.join('\n').trim() })
            }
            currentRole = 'user'
            currentContent = []
          } else if (line.startsWith('## AI') || line.startsWith('## Assistant')) {
            if (currentRole && currentContent.length) {
              messages.push({ role: currentRole, content: currentContent.join('\n').trim() })
            }
            currentRole = 'assistant'
            currentContent = []
          } else if (currentRole) {
            currentContent.push(line)
          }
        }
        // Add last message
        if (currentRole && currentContent.length) {
          messages.push({ role: currentRole, content: currentContent.join('\n').trim() })
        }

        if (messages.length === 0) {
          showToast('未找到有效的对话内容', 'warning')
          return
        }

        // Create conversation
        const newId = genId()
        const now = Date.now()
        conversations.value[newId] = {
          id: newId,
          name: file.name.replace(/\.md$/i, '') || '导入的对话',
          messages: messages.map(m => ({
            id: genId(),
            role: m.role,
            content: m.content,
            sendTime: now,
            model: '',
            thinkDuration: 0
          })),
          pinned: false,
          starredAt: 0,
          tempPinned: false,
          archived: false,
          updateTime: now,
          systemPrompt: '',
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          repeatPenalty: 1.1,
          currentModel: selectedModel.value,
          presets: [],
          sortOrder: now
        }
        currentConversationId.value = newId
        persistConversations()
        persistLastActiveChat()
        showToast(`已导入 ${messages.length} 条消息`, 'success')
      } catch {
        showToast('导入失败: Markdown 解析错误', 'error')
      }
    }
    reader.readAsText(file)
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

  async function checkConnection() {
    if (!ollamaHost.value) {
      connectionStatus.value = 'unknown'
      return
    }
    connectionStatus.value = 'checking'
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(`${ollamaHost.value}/api/tags`, { method: 'GET', signal: controller.signal })
      clearTimeout(timeoutId)
      const prev = connectionStatus.value
      connectionStatus.value = res.ok ? 'connected' : 'disconnected'
      lastConnectionCheck.value = Date.now()
      // Notify on status change
      if (prev === 'connected' && !res.ok) {
        showToast('Ollama 连接断开', 'error')
      } else if (prev === 'disconnected' && res.ok) {
        showToast('Ollama 已重新连接', 'success')
      }
    } catch {
      const prev = connectionStatus.value
      connectionStatus.value = 'disconnected'
      lastConnectionCheck.value = Date.now()
      if (prev === 'connected') {
        showToast('Ollama 连接断开', 'error')
      }
    }
  }

  function startConnectionMonitor() {
    if (connectionCheckTimer) clearInterval(connectionCheckTimer)
    connectionCheckTimer = setInterval(checkConnection, 30000) // every 30s
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

      // Store model details
      fetchedModels.forEach(m => {
        modelDetails.value[m.name] = {
          size: m.size || 0,
          parameter_size: m.details?.parameter_size || '',
          quantization_level: m.details?.quantization_level || '',
          format: m.details?.format || ''
        }
      })

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

  /** @returns {Promise<string>} message content from the Ollama API (SSE stream) */
  async function executeApiCall(messages, signal, onChunk) {
    const model = currentConversation.value?.currentModel || selectedModel.value
    const res = await fetch(`${ollamaHost.value}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
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

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let fullContent = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() // keep incomplete line in buffer
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const data = JSON.parse(trimmed)
          if (data.message?.content) {
            fullContent += data.message.content
            if (onChunk) onChunk(fullContent)
          }
          if (data.done) break
        } catch { /* skip malformed lines */ }
      }
    }
    // Process any remaining buffer
    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer.trim())
        if (data.message?.content) {
          fullContent += data.message.content
          if (onChunk) onChunk(fullContent)
        }
      } catch { /* ignore */ }
    }
    return fullContent
  }

  /** Handle persistence and optional typewriter after streaming completes */
  async function handleStreamResult(aiMsg, fullContent, thinkStartTime) {
    const thinkDuration = Math.floor((Date.now() - thinkStartTime) / 1000)
    const speed = CONST_CONFIG.STREAM_SPEED_MAP[streamSpeed.value] || 0
    if (speed > 0 && fullContent) {
      // Typewriter replay effect on already-streamed content
      isStreamingActive.value = true
      await typewriteMessage(aiMsg, fullContent, thinkStartTime)
      isStreamingActive.value = false
      scrollTrigger.value++
    } else {
      updateAiMessage(aiMsg, fullContent, thinkDuration)
    }
    currentStreamingMsgId.value = null
    persistConversations()
  }

  /** Handle API errors: toast, mark message as failed for retry */
  function handleSendError(e, failedPayload, aiMsg) {
    clearTimeout(activeTimeoutId)
    activeTimeoutId = null
    currentStreamingMsgId.value = null

    if (e.name === 'AbortError') {
      // User cancelled — remove the empty AI message
      const conv = conversations.value[currentConversationId.value]
      if (conv) {
        const idx = conv.messages.findIndex(m => m.id === aiMsg.id)
        if (idx !== -1 && conv.messages[idx].content === '') {
          conv.messages.splice(idx, 1)
        }
        persistConversations()
      }
      return
    }

    showToast('请求失败: ' + e.message, 'error')

    // Mark AI message as failed for retry
    const conv = conversations.value[currentConversationId.value]
    if (conv) {
      const idx = conv.messages.findIndex(m => m.id === aiMsg.id)
      if (idx !== -1) {
        conv.messages[idx].error = e.message
        conv.messages[idx].failedPayload = failedPayload
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
      const speed = CONST_CONFIG.STREAM_SPEED_MAP[streamSpeed.value] || 0
      // Real-time streaming callback: update message as chunks arrive
      const onChunk = speed <= 0 ? (content) => {
        const thinkDuration = Math.floor((Date.now() - thinkStartTime) / 1000)
        updateAiMessage(aiMsg, content, thinkDuration)
        scrollTrigger.value++
      } : null

      const fullContent = await executeApiCall(buildMessages(), signal, onChunk)
      await handleStreamResult(aiMsg, fullContent, thinkStartTime)

      // Track model performance
      const responseTime = Date.now() - thinkStartTime
      const currentModel = currentConversation.value?.currentModel || selectedModel.value
      if (currentModel && fullContent) {
        const charCount = fullContent.length
        const tps = charCount / (responseTime / 1000) // chars per second as proxy
        const prev = modelPerformance.value[currentModel] || { totalCalls: 0, avgResponseTime: 0 }
        const newTotal = prev.totalCalls + 1
        const newAvg = ((prev.avgResponseTime * prev.totalCalls) + responseTime) / newTotal
        modelPerformance.value[currentModel] = {
          lastResponseTime: responseTime,
          lastTokensPerSecond: Math.round(tps * 10) / 10,
          totalCalls: newTotal,
          avgResponseTime: Math.round(newAvg)
        }
      }
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

    // Auto-generate title from first message
    const conv = conversations.value[currentConversationId.value]
    if (conv && conv.messages.length === 0 && conv.name === '新对话') {
      conv.name = msg.slice(0, 30) + (msg.length > 30 ? '...' : '')
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

  function cancelGeneration() {
    if (activeAbortController) {
      activeAbortController.abort()
      activeAbortController = null
    }
    isWaitingModelReply.value = false
    isStreamingActive.value = false
    currentStreamingMsgId.value = null
    showToast('已停止生成', 'info')
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

  async function retryMessage(msgId) {
    const conv = conversations.value[currentConversationId.value]
    if (!conv) return
    const idx = conv.messages.findIndex(m => m.id === msgId)
    if (idx === -1 || conv.messages[idx].role !== 'assistant' || !conv.messages[idx].error) return

    const msg = conv.messages[idx]
    const failedPayload = msg.failedPayload

    // Clear error state and reset message
    msg.error = undefined
    msg.failedPayload = undefined
    msg.content = ''
    msg.thinkDuration = 0
    persistConversations()

    isWaitingModelReply.value = true
    clearToast()
    isStreamingActive.value = false
    latestAiMsgId.value = msg.id
    currentStreamingMsgId.value = msg.id
    scrollTrigger.value++

    await _executeSendFlow(msg, failedPayload)
  }

  async function regenerateMessage(msgId) {
    if (isWaitingModelReply.value) return
    const conv = conversations.value[currentConversationId.value]
    if (!conv) return
    const idx = conv.messages.findIndex(m => m.id === msgId)
    if (idx === -1 || conv.messages[idx].role !== 'assistant') return

    // Remove the AI message
    conv.messages.splice(idx, 1)
    conv.updateTime = Date.now()
    persistConversations()

    // Re-send: create new AI message and call API
    isWaitingModelReply.value = true
    clearToast()
    isStreamingActive.value = false
    latestAiMsgId.value = ''

    const aiMsg = addMessage('assistant', '', { thinkDuration: 0 })
    scrollTrigger.value++
    latestAiMsgId.value = aiMsg.id
    currentStreamingMsgId.value = aiMsg.id

    await _executeSendFlow(aiMsg, null)
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
      if (!conv.hasOwnProperty('archived')) { conv.archived = false; needsSave = true }
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
      checkConnection()
      startConnectionMonitor()
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

  // ============ Conversation Templates ============
  const templates = ref(loadJSON(STORAGE_KEYS.templates, []))

  function persistTemplates() {
    saveJSON(STORAGE_KEYS.templates, templates.value)
  }

  function saveTemplate(name) {
    const conv = currentConversation.value
    if (!conv) return
    const template = {
      id: genId(),
      name: name || conv.name,
      systemPrompt: conv.systemPrompt || '',
      model: conv.currentModel || selectedModel.value,
      temperature: conv.temperature ?? 0.7,
      topP: conv.topP ?? 0.9,
      topK: conv.topK ?? 40,
      repeatPenalty: conv.repeatPenalty ?? 1.1,
      createdAt: Date.now()
    }
    templates.value.push(template)
    persistTemplates()
    showToast('模板已保存', 'success')
    return template
  }

  function loadTemplate(templateId) {
    const tpl = templates.value.find(t => t.id === templateId)
    if (!tpl) return
    const conv = currentConversation.value
    if (!conv) return
    conv.systemPrompt = tpl.systemPrompt
    conv.currentModel = tpl.model
    conv.temperature = tpl.temperature
    conv.topP = tpl.topP
    conv.topK = tpl.topK
    conv.repeatPenalty = tpl.repeatPenalty
    if (tpl.model && models.value.includes(tpl.model)) {
      selectedModel.value = tpl.model
      saveConfig(STORAGE_KEYS.selectedModel, tpl.model)
    }
    persistConversations()
    showToast('模板已应用', 'success')
  }

  function deleteTemplate(templateId) {
    const idx = templates.value.findIndex(t => t.id === templateId)
    if (idx === -1) return
    templates.value.splice(idx, 1)
    persistTemplates()
    showToast('模板已删除', 'success')
  }

  // ============ Prompt Snippets ============
  const snippets = ref(loadJSON(STORAGE_KEYS.snippets, []))

  function persistSnippets() {
    saveJSON(STORAGE_KEYS.snippets, snippets.value)
  }

  function saveSnippet(name, content) {
    if (!content || !content.trim()) return
    const snippet = {
      id: genId(),
      name: name || content.slice(0, 30),
      content: content.trim(),
      createdAt: Date.now()
    }
    snippets.value.unshift(snippet)
    persistSnippets()
    showToast('片段已保存', 'success')
    return snippet
  }

  function insertSnippet(snippetId) {
    const s = snippets.value.find(s => s.id === snippetId)
    return s ? s.content : ''
  }

  function deleteSnippet(snippetId) {
    const idx = snippets.value.findIndex(s => s.id === snippetId)
    if (idx === -1) return
    snippets.value.splice(idx, 1)
    persistSnippets()
    showToast('片段已删除', 'success')
  }

  return {
    // State
    ollamaHost, selectedModel, streamSpeed, contextLength, streamAutoScroll, models, modelDetails, isLoadingModels, modelLoadError, storageUsage,
    connectionStatus, checkConnection, saveStatus, modelPerformance,
    conversations, currentConversationId, conversationSearchTerm,
    sidebarCollapsed, configPanelOpen, inputCollapsed, searchPanelOpen, searchQuery,
    isWaitingModelReply, isTempTipShowing, isOffline,
    toastMessage, toastType, toastVisible,
    confirmVisible, confirmTitle, confirmMessage, confirmResolve, showConfirm,
    isMobile, mobileSidebarOpen, updateIsMobile, helpPanelOpen,
    currentStreamingMsgId, latestAiMsgId, latestUserMsgId, isStreamingActive, scrollTrigger,
    quotedMessage, setQuotedMessage, clearQuotedMessage,
    drafts, saveDraft, getDraft, clearDraft,
    templates, saveTemplate, loadTemplate, deleteTemplate,
    snippets, saveSnippet, insertSnippet, deleteSnippet,
    searchResults, searchResultCount, navigateToSearchResult,
    inChatSearchOpen, inChatSearchQuery, inChatSearchIndex, inChatSearchResults, inChatSearchTotal, inChatSearchCurrentMsgId,
    nextInChatSearchResult, prevInChatSearchResult, toggleInChatSearch,
    // Getters
    currentConversation, currentMessages,
    sortedConversationIds, filteredConversationIds, hasConversations,
    // Actions
    showToast, clearToast,
    createNewConversation, deleteConversation, duplicateConversation, clearCurrentChat, renameConversation, reorderConversation,
    togglePinConversation, toggleStarConversation, archiveConversation, unarchiveConversation,
    showArchived, archivedCount,
    activeTagFilter, availableTags, setConversationTags,
    currentConversationStats, globalStats, switchConversation,
    setOllamaHost, setSelectedModel, setStreamSpeed, setContextLength, setStreamAutoScroll,
    loadModelList, clearConfigData, clearAllData,
    addCustomModel, removeModel, hostHistory, addHostToHistory, removeHostFromHistory,
    setSystemPrompt, setTemperature, setTopP, setTopK, setRepeatPenalty, setCurrentModel,
    currentPresets, savePreset, deletePreset, applyPreset,
    exportCurrentConversationJson, exportCurrentConversationMarkdown, exportCurrentConversationHtml, exportAllConversations, importConversations, importMarkdown, copyConversationAsText, printConversation,
    backupAllData, restoreBackup,
    addMessage, deleteMessage, sendMessage, saveEditedMessage, resendMessage, retryMessage, regenerateMessage, replayStreaming, skipStreaming, cancelGeneration,
    persistConversations, initialize,
    selectTheme, setCustomColor
  }
})
