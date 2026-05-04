import showdown from 'showdown'
import katex from 'katex'
import 'katex/dist/katex.min.css'

// ---------- Markdown Converter ----------
let mdConverter = null

export function initMarkdownConverter() {
  if (mdConverter) return true
  try {
    mdConverter = new showdown.Converter({
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
  return html.replace(/<pre><code\s+class="([^"]*language-(\w+)[^"]*)">/g, (match, cls, lang) => {
    return `<pre data-lang="${lang}"><button class="copy-code-btn" data-copy>复制</button><code class="${cls}">`
  }).replace(/<pre><code>/g, '<pre><button class="copy-code-btn" data-copy>复制</button><code>')
}

// ---------- KaTeX Rendering ----------
export function renderLatex(html) {
  if (!katex) return html
  // Block math $$...$$
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (_, expr) => {
    try {
      return katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false })
    } catch { return `$$${expr}$$` }
  })
  // Inline math $...$
  html = html.replace(/(?<!\$)\$(\S[^$\n]*?\S)\$(?!\$)/g, (_, expr) => {
    try {
      return katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false })
    } catch { return `$${expr}$` }
  })
  return html
}

// ---------- Main Pipeline ----------
export function renderMarkdown(text) {
  const escaped = escapeHtml(text)
  let html
  try {
    if (initMarkdownConverter()) html = mdConverter.makeHtml(escaped)
    else return escaped.replace(/\n/g, '<br>')
  } catch {
    return escaped.replace(/\n/g, '<br>')
  }
  html = secureLinks(html)
  html = sanitizeHtml(html)
  html = enhanceCodeBlocks(html)
  if (katex && (text.includes('$') || text.includes('\\('))) {
    html = renderLatex(html)
  }
  return html
}
