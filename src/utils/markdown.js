// ---------- Lazy Library Loading ----------
import { ref } from 'vue'

export const libsReady = ref(false)

const CDN_BASE = 'https://cdn.jsdelivr.net/npm'
const KATEX_VER = 'katex@0.16.9'
const SHOWDOWN_VER = 'showdown@2.1.0'

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    s.onerror = () => reject(new Error('Failed to load: ' + src))
    document.head.appendChild(s)
  })
}

function loadCSS(href) {
  if (document.querySelector('link[href="' + href + '"]')) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const l = document.createElement('link')
    l.rel = 'stylesheet'
    l.href = href
    l.onload = resolve
    l.onerror = () => reject(new Error('Failed to load: ' + href))
    document.head.appendChild(l)
  })
}

// ---------- Lazy Loading Trigger ----------
let _librariesLoaded = false
let _librariesPromise = null

/** Load KaTeX + Showdown on first renderMarkdown() call */
function _loadLibraries() {
  if (_librariesLoaded) return
  if (_librariesPromise) return
  _librariesPromise = Promise.all([
    loadCSS(CDN_BASE + '/' + KATEX_VER + '/dist/katex.min.css'),
    loadScript(CDN_BASE + '/' + KATEX_VER + '/dist/katex.min.js'),
    loadScript(CDN_BASE + '/' + SHOWDOWN_VER + '/dist/showdown.min.js')
  ]).then(function () {
    _librariesLoaded = true
    libsReady.value = true
  }).catch(function (e) {
    console.error('[markdown] CDN图书馆加载失败:', e.message)
  })
}

// ---------- Markdown Converter ----------
let mdConverter = null

export function initMarkdownConverter() {
  if (mdConverter) return true
  if (!window.showdown) return false
  try {
    mdConverter = new window.showdown.Converter({
      tables: true,
      tasklists: true,
      strikethrough: true,
      emoji: true,
      simplifiedAutoLink: true,
      excludeTrailingPunctuationFromURLs: true,
      literalMidWordUnderscores: true,
      openLinksInNewWindow: true,
      backslashEscapesHTMLTags: true,
      ghCodeBlocks: true,
      ghCompatibleHeaderId: true,
      encodeEmails: true
    })
    return true
  } catch { return false }
}

// ---------- HTML Escaping ----------
export function escapeHtml(text) {
  const div = document.createElement('div')
  div.appendChild(document.createTextNode(text))
  return div.innerHTML
}

// ---------- Link Security ----------
export function secureLinks(html) {
  return html
    .replace(/<a\s+(?![^>]*rel=)/gi, '<a rel="noopener noreferrer" ')
    .replace(/<a\s/g, '<a target="_blank" ')
}

// ---------- Sanitize ----------
export function sanitizeHtml(html) {
  return html.replace(/\s*on\w+\s*=\s*(['"]?)[^'"]*\1/gi, '')
}

// ---------- Code Block Enhancement ----------
export function enhanceCodeBlocks(html) {
  return html.replace(/(<pre[^>]*>)\s*(<code[^>]*>)([\s\S]*?)<\/code>/g, (match, pre, code, content) => {
    const langMatch = code.match(/language-(\w+)/)
    const lang = langMatch ? langMatch[1] : ''
    const headerHtml = `<div class="code-header"><span class="code-lang">${lang || ''}</span><button class="copy-code-btn" data-copy>复制</button></div>`
    const lineCount = content.split('\n').length
    const isLong = lineCount > 12
    let result = `<pre${isLong ? ' data-collapsed' : ''}>${headerHtml}${code}${content}</code>`
    if (isLong) result += '<button class="expand-code-btn">展开全部 ▼</button>'
    return result
  })
}

// ---------- KaTeX Rendering (raw text → HTML placeholders) ----------
function processLatex(text) {
  if (!window.katex || (!text.includes('$') && !text.includes('\\[') && !text.includes('\\begin'))) return { text, map: [] }

  const map = []
  let counter = 0
  let result = text

  // Display math: $$...$$
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_, expr) => {
    try {
      const html = window.katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false })
      const key = `§KATEX${counter++}§`
      map.push({ key, html })
      return key
    } catch { return `$$${expr}$$` }
  })

  // Display math: \[...\]
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_, expr) => {
    try {
      const html = window.katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false })
      const key = `§KATEX${counter++}§`
      map.push({ key, html })
      return key
    } catch { return `\\[${expr}\\]` }
  })

  // Display math: \begin{env}...\end{env}
  result = result.replace(/\\begin\{(\w+)\}([\s\S]*?)\\end\{\1\}/g, (_, env, expr) => {
    try {
      const html = window.katex.renderToString(`\\begin{${env}}${expr}\\end{${env}}`, { displayMode: true, throwOnError: false })
      const key = `§KATEX${counter++}§`
      map.push({ key, html })
      return key
    } catch { return `\\begin{${env}}${expr}\\end{${env}}` }
  })

  // Inline math: $...$ (skip if contains Chinese — not math)
  result = result.replace(/(?<!\\)\$(\S[^$]*?\S)\$(?!\\)/g, (_, expr) => {
    if (/[\u4e00-\u9fff\u3000-\u303f]/.test(expr)) return `$${expr}$`
    try {
      const html = window.katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false })
      const key = `§KATEX${counter++}§`
      map.push({ key, html })
      return key
    } catch { return `$${expr}$` }
  })

  return { text: result, map }
}

function restoreLatex(html, map) {
  for (const { key, html: katexHtml } of map) {
    html = html.replace(key, katexHtml)
  }
  return html
}

// ---------- Code Block Copy ----------
export function initCodeBlockCopy() {
  document.addEventListener('click', (e) => {
    // Handle expand/collapse button
    const expandBtn = e.target.closest('.expand-code-btn')
    if (expandBtn) {
      e.stopPropagation()
      const pre = expandBtn.closest('pre')
      if (!pre) return
      if (pre.hasAttribute('data-collapsed')) {
        pre.removeAttribute('data-collapsed')
        expandBtn.textContent = '收起 ▲'
      } else {
        pre.setAttribute('data-collapsed', '')
        expandBtn.textContent = '展开全部 ▼'
      }
      return
    }

    // Handle copy button
    const btn = e.target.closest('.copy-code-btn')
    if (!btn) return
    e.stopPropagation()
    const pre = btn.closest('pre')
    if (!pre) return
    const code = pre.querySelector('code')
    if (!code) return
    const text = code.textContent
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '已复制'
        setTimeout(() => { btn.textContent = '复制' }, 1500)
      })
    } else {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      btn.textContent = '已复制'
      setTimeout(() => { btn.textContent = '复制' }, 1500)
    }
  })
}

// ---------- Main Pipeline ----------
export function renderMarkdown(text) {
  if (!text) return ''

  // Trigger lazy loading on first render (non-blocking — libraries load async)
  _loadLibraries()

  // Step 1: Extract and render LaTeX, replace with placeholders
  const { text: withPlaceholders, map } = processLatex(text)

  // Step 2: Escape HTML (safe — LaTeX placeholders contain no special chars)
  let html = escapeHtml(withPlaceholders)

  // Step 3: Convert markdown to HTML
  try {
    if (initMarkdownConverter()) html = mdConverter.makeHtml(html)
    else return html.replace(/\n/g, '<br>')
  } catch {
    return html.replace(/\n/g, '<br>')
  }

  // Step 4: Post-processing
  html = secureLinks(html)
  html = sanitizeHtml(html)
  html = enhanceCodeBlocks(html)

  // Step 5: Restore rendered LaTeX
  html = restoreLatex(html, map)

  return html
}
