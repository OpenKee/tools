<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { escapeHtml } from '../lib/format.js'
import { UiBadge, UiButton, UiCard, UiIconButton, UiPage, UiPageHead, UiTextarea } from '../components/ui/index.js'
import copy from '../copy/markdown-studio.js'

defineProps({ embedded: { type: Boolean, default: false } })

const t = useT(copy)

const SAMPLE = {
  en: [
    '# Markdown Studio',
    '',
    'A live-preview **Markdown** editor. Type on the left, see the result on the right.',
    '',
    '## Text formatting',
    '',
    'You can write **bold**, *italic*, ~~strikethrough~~ and `inline code`.',
    '',
    '## Headings',
    '',
    '### This is an H3',
    '',
    '## Lists',
    '',
    '- Unordered item',
    '- Another item',
    '',
    '1. Ordered item one',
    '2. Ordered item two',
    '',
    '- [x] Completed task',
    '- [ ] Todo task',
    '',
    '## Links & images',
    '',
    '[OpenKee on GitHub](https://github.com/OpenKee)',
    '',
    '## Blockquote',
    '',
    '> Simplicity is the soul of efficiency.',
    '> — Austin Freeman',
    '',
    '## Code block',
    '',
    '```js',
    'function hello(name) {',
    '  return "Hello, " + name;',
    '}',
    '```',
    '',
    '## Table',
    '',
    '| Feature | Status |',
    '| ------- | :----: |',
    '| Live preview | ✓ |',
    '| Export | ✓ |',
    '| Import | ✓ |',
    '',
    '## Divider',
    '',
    '---',
    '',
    'Start editing to see your changes!',
  ].join('\n'),
  zh: [
    '# Markdown Studio',
    '',
    '一个实时预览的 **Markdown** 编辑器。在左侧输入，右侧即时查看效果。',
    '',
    '## 文本格式',
    '',
    '你可以写 **粗体**、*斜体*、~~删除线~~ 和 `行内代码`。',
    '',
    '## 标题',
    '',
    '### 这是一个三级标题',
    '',
    '## 列表',
    '',
    '- 无序列表项',
    '- 另一个列表项',
    '',
    '1. 有序列表第一项',
    '2. 有序列表第二项',
    '',
    '- [x] 已完成的任务',
    '- [ ] 待办任务',
    '',
    '## 链接与图片',
    '',
    '[GitHub 上的 OpenKee](https://github.com/OpenKee)',
    '',
    '## 引用块',
    '',
    '> 简洁是效率的灵魂。',
    '> —— 奥斯汀·弗里曼',
    '',
    '## 代码块',
    '',
    '```js',
    'function hello(name) {',
    '  return "你好，" + name;',
    '}',
    '```',
    '',
    '## 表格',
    '',
    '| 功能 | 状态 |',
    '| ------- | :----: |',
    '| 实时预览 | ✓ |',
    '| 导出 | ✓ |',
    '| 导入 | ✓ |',
    '',
    '## 分隔线',
    '',
    '---',
    '',
    '开始编辑，查看你的改动！',
  ].join('\n'),
}

const editorRef = ref(null)
const previewRef = ref(null)
const fileInputRef = ref(null)

function getEditorEl() {
  const instance = editorRef.value
  if (!instance) return null
  return instance.$el?.querySelector?.('textarea') || null
}

const editorText = ref('')
const renderedHtml = ref('')

const notice = ref('')
let noticeTimer = null
function showNotice(text) {
  notice.value = text
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(function () {
    notice.value = ''
  }, 3000)
}
let renderTimer = null
let syncLock = false

function sanitizeUrl(url) {
  const u = String(url == null ? '' : url).trim()
  if (!u) return ''

  if (/^(https?:|mailto:|tel:|ftp:|data:image\/)/i.test(u)) return u

  if (u.charAt(0) === '#' || u.charAt(0) === '/' || u.charAt(0) === '?') return u
  if (u.indexOf(':') === -1) return u
  return ''
}

function parseInline(text) {
  const slots = []

  function stash(html) {
    slots.push(html)
    return '\u0000' + (slots.length - 1) + '\u0000'
  }

  text = text.replace(/`([^`]+)`/g, function (m, code) {
    return stash('<code>' + escapeHtml(code) + '</code>')
  })

  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, function (m, alt, url, title) {
    const u = sanitizeUrl(url)
    if (!u) return escapeHtml(m)
    const tAttr = title ? ' title="' + escapeHtml(title) + '"' : ''
    return stash('<img src="' + escapeHtml(u) + '" alt="' + escapeHtml(alt) + '"' + tAttr + ' />')
  })

  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, function (m, label, url, title) {
    const u = sanitizeUrl(url)
    if (!u) return escapeHtml(m)
    const tAttr = title ? ' title="' + escapeHtml(title) + '"' : ''
    return stash(
      '<a href="' + escapeHtml(u) + '"' + tAttr + ' target="_blank" rel="noreferrer">' + parseInline(label) + '</a>',
    )
  })

  text = escapeHtml(text)

  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  text = text.replace(/\*([^*]+?)\*/g, '<em>$1</em>')

  // eslint-disable-next-line no-control-regex
  text = text.replace(/\u0000(\d+)\u0000/g, function (m, idx) {
    return slots[Number(idx)]
  })

  return text
}

function isTableSeparator(line) {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && /\|/.test(line) && /[-:]/.test(line)
}

function splitTableRow(line) {
  const s = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return s.split('|').map(function (c) {
    return c.trim()
  })
}

function parseTableAligns(line) {
  return splitTableRow(line).map(function (c) {
    if (/^:.*:$/.test(c)) return 'center'
    if (/:$/.test(c)) return 'right'
    if (/^:/.test(c)) return 'left'
    return null
  })
}

function buildTable(header, aligns, bodyRows) {
  const th = header
    .map(function (c, i) {
      const a = aligns[i] ? ' style="text-align:' + aligns[i] + '"' : ''
      return '<th' + a + '>' + parseInline(c) + '</th>'
    })
    .join('')
  const trs = bodyRows
    .map(function (row) {
      const tds = row
        .map(function (c, i) {
          const a = aligns[i] ? ' style="text-align:' + aligns[i] + '"' : ''
          return '<td' + a + '>' + parseInline(c) + '</td>'
        })
        .join('')
      return '<tr>' + tds + '</tr>'
    })
    .join('')
  return '<table><thead><tr>' + th + '</tr></thead><tbody>' + trs + '</tbody></table>'
}

function isBlockStart(line) {
  return (
    /^#{1,6}\s/.test(line) ||
    /^```/.test(line) ||
    /^>\s?/.test(line) ||
    /^\s*([-*+]|\d+\.)\s+/.test(line) ||
    /^\s*([-*_])(\s*\1){2,}\s*$/.test(line)
  )
}

function parseList(lines, start) {
  const isOrdered = /^\s*\d+\.\s+/.test(lines[start])
  const items = []
  let i = start
  const n = lines.length

  while (i < n) {
    const m = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(\[[ xX]\]\s+)?(.*)$/)
    if (!m) break
    items.push({ task: m[3] || '', content: m[4] })
    i++
  }

  const lis = items
    .map(function (it) {
      if (it.task) {
        const checked = /^\[[xX]\]/.test(it.task)
        return (
          '<li class="task-item">' +
          '<input type="checkbox" disabled' +
          (checked ? ' checked' : '') +
          ' /> ' +
          parseInline(it.content) +
          '</li>'
        )
      }
      return '<li>' + parseInline(it.content) + '</li>'
    })
    .join('')

  const tag = isOrdered ? 'ol' : 'ul'
  const cls = items.some(function (it) {
    return !!it.task
  })
    ? ' class="task-list"'
    : ''
  return { html: '<' + tag + cls + '>' + lis + '</' + tag + '>', next: i }
}

function renderMarkdown(src) {
  const text = String(src == null ? '' : src).replace(/\r\n?/g, '\n')
  const lines = text.split('\n')
  const out = []
  let i = 0
  const n = lines.length

  while (i < n) {
    const line = lines[i]

    const fence = line.match(/^```\s*(\w*)\s*$/)
    if (fence) {
      const codeLang = fence[1] || ''
      const codeLines = []
      i++
      while (i < n && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i])
        i++
      }
      i++
      const cls = codeLang ? ' class="lang-' + escapeHtml(codeLang) + '"' : ''
      out.push('<pre><code' + cls + '>' + escapeHtml(codeLines.join('\n')) + '</code></pre>')
      continue
    }

    if (/^\s*$/.test(line)) {
      i++
      continue
    }

    const h = line.match(/^(#{1,6})\s+(.*?)(?:\s+#{1,6})?$/)
    if (h) {
      const lvl = h[1].length
      out.push('<h' + lvl + '>' + parseInline(h[2]) + '</h' + lvl + '>')
      i++
      continue
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push('<hr />')
      i++
      continue
    }

    if (/\|/.test(line) && i + 1 < n && isTableSeparator(lines[i + 1])) {
      const header = splitTableRow(line)
      const aligns = parseTableAligns(lines[i + 1])
      i += 2
      const bodyRows = []
      while (i < n && /\|/.test(lines[i]) && !/^\s*$/.test(lines[i])) {
        bodyRows.push(splitTableRow(lines[i]))
        i++
      }
      out.push(buildTable(header, aligns, bodyRows))
      continue
    }

    if (/^>\s?/.test(line)) {
      const quoteLines = []
      while (i < n && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }

      out.push('<blockquote>' + renderMarkdown(quoteLines.join('\n')) + '</blockquote>')
      continue
    }

    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const list = parseList(lines, i)
      out.push(list.html)
      i = list.next
      continue
    }

    const paraLines = []
    while (i < n && !/^\s*$/.test(lines[i]) && !isBlockStart(lines[i])) {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length) {
      out.push('<p>' + parseInline(paraLines.join('\n')) + '</p>')
    }
  }

  return out.join('\n')
}

function doRender() {
  renderedHtml.value = renderMarkdown(editorText.value)
}

watch(editorText, () => {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(function () {
    renderTimer = null
    doRender()
  }, 200)
})

const stats = computed(() => {
  const text = editorText.value
  const chars = text.length
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const enWords = (text.replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9]+/g) || []).length
  const words = cjk + enWords
  const lines = text === '' ? 0 : text.split('\n').length
  return { chars, words, lines }
})

function editSelection(transform) {
  const editor = getEditorEl()
  if (!editor) return
  const start = editor.selectionStart
  const end = editor.selectionEnd
  const value = editor.value
  const selected = value.slice(start, end)
  const result = transform(selected, value, start, end)
  editorText.value = result.value

  nextTick(() => {
    editor.focus()
    editor.selectionStart = result.selStart
    editor.selectionEnd = result.selEnd
  })
}

function wrap(before, after, placeholder) {
  editSelection(function (sel, val, start, end) {
    const text = sel.length ? sel : placeholder
    const newVal = val.slice(0, start) + before + text + after + val.slice(end)
    const s = start + before.length
    return { value: newVal, selStart: s, selEnd: s + text.length }
  })
}

function prefixLines(prefix) {
  editSelection(function (sel, val, start, end) {
    const lineStart = val.lastIndexOf('\n', start - 1) + 1
    let lineEnd = val.indexOf('\n', end)
    if (lineEnd === -1) lineEnd = val.length
    const block = val.slice(lineStart, lineEnd)
    const newBlock = block
      .split('\n')
      .map(function (l) {
        return prefix + l
      })
      .join('\n')
    const newVal = val.slice(0, lineStart) + newBlock + val.slice(lineEnd)
    return { value: newVal, selStart: lineStart, selEnd: lineStart + newBlock.length }
  })
}

function insertAtCursor(text) {
  editSelection(function (sel, val, start, end) {
    const newVal = val.slice(0, start) + text + val.slice(end)
    return { value: newVal, selStart: start, selEnd: start + text.length }
  })
}

function handleAction(action) {
  switch (action) {
    case 'bold':
      wrap('**', '**', t.value('boldTip').replace(/\s*\(.*\)$/, ''))
      break
    case 'italic':
      wrap('*', '*', t.value('italicTip').replace(/\s*\(.*\)$/, ''))
      break
    case 'strike':
      wrap('~~', '~~', t.value('strikeTip'))
      break
    case 'h1':
      prefixLines('# ')
      break
    case 'h2':
      prefixLines('## ')
      break
    case 'h3':
      prefixLines('### ')
      break
    case 'ul':
      prefixLines('- ')
      break
    case 'ol':
      prefixLines('1. ')
      break
    case 'task':
      prefixLines('- [ ] ')
      break
    case 'link': {
      const url = window.prompt(t.value('promptUrl'), 'https://')
      if (url === null) return
      const linkUrl = url || 'https://'
      wrap('[', '](' + linkUrl + ')', t.value('linkText'))
      break
    }
    case 'image': {
      const imgUrl = window.prompt(t.value('promptImgUrl'), 'https://')
      if (imgUrl === null) return
      const alt = window.prompt(t.value('promptImgAlt'), t.value('imageAlt'))
      if (alt === null) return
      const u = imgUrl || 'https://'
      const a = alt || t.value('imageAlt')
      insertAtCursor('![' + a + '](' + u + ')')
      break
    }
    case 'code':
      wrap('`', '`', t.value('codeText'))
      break
    case 'codeblock':
      wrap('\n```\n', '\n```\n', t.value('codeText'))
      break
    case 'quote':
      prefixLines('> ')
      break
    case 'hr':
      insertAtCursor('\n---\n')
      break
    case 'table':
      insertAtCursor('\n| Column A | Column B |\n| --- | --- |\n| 1 | 2 |\n')
      break
    default:
      break
  }
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  setTimeout(function () {
    URL.revokeObjectURL(url)
  }, 1000)
}

function exportMd() {
  downloadFile('markdown-studio.md', editorText.value, 'text/markdown;charset=utf-8')
}

function exportHtml() {
  const body = renderedHtml.value || ''
  const css =
    'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;' +
    'max-width:780px;margin:40px auto;padding:0 20px;color:#24292e;line-height:1.65;}' +
    'code,pre{font-family:"JetBrains Mono",SFMono-Regular,Menlo,Consolas,monospace;}' +
    'code{background:#f6f8fa;padding:.15em .4em;border-radius:4px;font-size:.85em;}' +
    'pre{background:#f6f8fa;padding:.9em 1em;border-radius:6px;overflow:auto;}' +
    'pre code{background:none;padding:0;}' +
    'blockquote{border-left:.25em solid #e1e4e8;padding:.2em 1em;color:#6a737d;background:#f6f8fa;}' +
    'h1,h2{border-bottom:1px solid #e1e4e8;padding-bottom:.3em;}' +
    'table{border-collapse:collapse;width:100%;}th,td{border:1px solid #e1e4e8;padding:.45em .85em;}' +
    'th{background:#f6f8fa;}img{max-width:100%;}a{color:#0366d6;}'
  const html =
    '<!DOCTYPE html>\n<html lang="' +
    (i18nState.lang === 'zh' ? 'zh' : 'en') +
    '">\n<head>\n' +
    '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>Markdown Studio</title>\n<style>' +
    css +
    '</style>\n</head>\n<body>\n' +
    body +
    '\n</body>\n</html>'
  downloadFile('markdown-studio.html', html, 'text/html;charset=utf-8')
}

function importFile(file) {
  if (!file) return
  const reader = new FileReader()
  reader.onload = function () {
    editorText.value = String(reader.result || '')
  }
  reader.onerror = function () {
    showNotice(t.value('importFail'))
  }
  reader.readAsText(file)
}

function syncScroll(source, target) {
  if (syncLock) return
  if (!source || !target) return
  syncLock = true
  const sMax = source.scrollHeight - source.clientHeight
  const tMax = target.scrollHeight - target.clientHeight
  const ratio = sMax > 0 ? source.scrollTop / sMax : 0
  target.scrollTop = ratio * (tMax > 0 ? tMax : 0)

  requestAnimationFrame(function () {
    syncLock = false
  })
}

function onEditorScroll() {
  syncScroll(getEditorEl(), previewRef.value)
}
function onPreviewScroll() {
  syncScroll(previewRef.value, getEditorEl())
}

function onEditorKeydown(e) {
  if (e.ctrlKey || e.metaKey) {
    const key = e.key.toLowerCase()
    if (key === 'b') {
      e.preventDefault()
      handleAction('bold')
      return
    }
    if (key === 'i') {
      e.preventDefault()
      handleAction('italic')
      return
    }
    if (key === 'k') {
      e.preventDefault()
      handleAction('link')
      return
    }
  }

  if (e.key === 'Tab') {
    e.preventDefault()
    const editor = getEditorEl()
    if (!editor) return
    const start = editor.selectionStart
    const end = editor.selectionEnd
    editorText.value = editor.value.slice(0, start) + '  ' + editor.value.slice(end)
    nextTick(() => {
      editor.selectionStart = editor.selectionEnd = start + 2
    })
  }
}

function loadSample() {
  editorText.value = SAMPLE[i18nState.lang] || SAMPLE.en
  nextTick(() => {
    getEditorEl()?.focus()
  })
}

function onImportClick() {
  if (fileInputRef.value) fileInputRef.value.click()
}

function onFileChange(e) {
  const file = e.target.files && e.target.files[0]
  importFile(file)
  e.target.value = ''
}

async function renderWithGitHub() {
  const text = editorText.value
  try {
    const res = await fetch('https://api.github.com/markdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, mode: 'gfm' }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error('GitHub API returned ' + res.status)
    const html = await res.text()
    renderedHtml.value = html
  } catch (e) {
    renderedHtml.value = renderMarkdown(text)
    showNotice(t.value('renderFail'))
  }
}

onMounted(() => {
  editorText.value = SAMPLE[i18nState.lang] || SAMPLE.en
  doRender()
})
</script>

<template>
  <UiPage class="markdown-studio-app" :title="t('title')" spacing="compact" :embedded="embedded">
    <UiPageHead compact :level="embedded ? 2 : 1" :title="t('title')" :description="t('lead')" />

    <UiCard as="div" class="toolbar" padding="sm" role="toolbar" aria-label="Markdown formatting toolbar">
      <div class="toolbar-group">
        <UiIconButton :label="t('boldTip')" variant="ghost" size="sm" @click="handleAction('bold')">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M6 4h7a4 4 0 0 1 0 8H6z" />
            <path d="M6 12h8a4 4 0 0 1 0 8H6z" />
          </svg>
        </UiIconButton>
        <UiIconButton :label="t('italicTip')" variant="ghost" size="sm" @click="handleAction('italic')">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <line x1="19" y1="4" x2="10" y2="4" />
            <line x1="14" y1="20" x2="5" y2="20" />
            <line x1="15" y1="4" x2="9" y2="20" />
          </svg>
        </UiIconButton>
        <UiIconButton :label="t('strikeTip')" variant="ghost" size="sm" @click="handleAction('strike')">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M16 4H9a3 3 0 0 0-2.83 4" />
            <path d="M14 12a4 4 0 0 1 0 8H6" />
            <line x1="4" y1="12" x2="20" y2="12" />
          </svg>
        </UiIconButton>
      </div>

      <div class="toolbar-group">
        <UiButton
          class="h-btn"
          variant="ghost"
          size="sm"
          :title="t('h1Tip')"
          :aria-label="t('h1Tip')"
          @click="handleAction('h1')"
        >
          H1
        </UiButton>
        <UiButton
          class="h-btn"
          variant="ghost"
          size="sm"
          :title="t('h2Tip')"
          :aria-label="t('h2Tip')"
          @click="handleAction('h2')"
        >
          H2
        </UiButton>
        <UiButton
          class="h-btn"
          variant="ghost"
          size="sm"
          :title="t('h3Tip')"
          :aria-label="t('h3Tip')"
          @click="handleAction('h3')"
        >
          H3
        </UiButton>
      </div>

      <div class="toolbar-group">
        <UiIconButton :label="t('ulTip')" variant="ghost" size="sm" @click="handleAction('ul')">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <line x1="9" y1="6" x2="20" y2="6" />
            <line x1="9" y1="12" x2="20" y2="12" />
            <line x1="9" y1="18" x2="20" y2="18" />
            <circle cx="4.5" cy="6" r="1.1" fill="currentColor" stroke="none" />
            <circle cx="4.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
            <circle cx="4.5" cy="18" r="1.1" fill="currentColor" stroke="none" />
          </svg>
        </UiIconButton>
        <UiIconButton :label="t('olTip')" variant="ghost" size="sm" @click="handleAction('ol')">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <line x1="10" y1="6" x2="20" y2="6" />
            <line x1="10" y1="12" x2="20" y2="12" />
            <line x1="10" y1="18" x2="20" y2="18" />
            <path d="M4 5h2v1L4 8v1h3" />
            <path d="M4 12h3" />
            <path d="M6 17H4c0-1 2-1 2-2 0-1-2-1-2 0" />
          </svg>
        </UiIconButton>
        <UiIconButton :label="t('taskTip')" variant="ghost" size="sm" @click="handleAction('task')">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="4 12 8 16 16 6" />
            <line x1="11" y1="6" x2="20" y2="6" />
            <line x1="11" y1="12" x2="20" y2="12" />
            <line x1="11" y1="18" x2="20" y2="18" />
          </svg>
        </UiIconButton>
      </div>

      <div class="toolbar-group">
        <UiIconButton :label="t('linkTip')" variant="ghost" size="sm" @click="handleAction('link')">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </UiIconButton>
        <UiIconButton :label="t('imageTip')" variant="ghost" size="sm" @click="handleAction('image')">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </UiIconButton>
      </div>

      <div class="toolbar-group">
        <UiIconButton :label="t('codeTip')" variant="ghost" size="sm" @click="handleAction('code')">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </UiIconButton>
        <UiIconButton :label="t('codeblockTip')" variant="ghost" size="sm" @click="handleAction('codeblock')">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <polyline points="9 9 7 12 9 15" />
            <polyline points="15 9 17 12 15 15" />
          </svg>
        </UiIconButton>
      </div>

      <div class="toolbar-group">
        <UiIconButton :label="t('quoteTip')" variant="ghost" size="sm" @click="handleAction('quote')">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <line x1="3" y1="6" x2="3" y2="18" />
            <line x1="8" y1="6" x2="8" y2="18" />
            <line x1="13" y1="6" x2="21" y2="6" />
            <line x1="13" y1="10" x2="21" y2="10" />
            <line x1="13" y1="14" x2="21" y2="14" />
            <line x1="13" y1="18" x2="21" y2="18" />
          </svg>
        </UiIconButton>
        <UiIconButton :label="t('hrTip')" variant="ghost" size="sm" @click="handleAction('hr')">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <line x1="4" y1="12" x2="20" y2="12" />
          </svg>
        </UiIconButton>
        <UiIconButton :label="t('tableTip')" variant="ghost" size="sm" @click="handleAction('table')">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="12" y1="3" x2="12" y2="21" />
          </svg>
        </UiIconButton>
      </div>
    </UiCard>

    <section class="workspace" aria-label="Editor and preview">
      <UiCard class="pane editor-pane" padding="none" :label="t('editor')">
        <UiTextarea
          ref="editorRef"
          v-model="editorText"
          :rows="20"
          monospace
          resize="none"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          aria-label="Markdown source editor"
          @keydown="onEditorKeydown"
          @scroll="onEditorScroll"
        />
      </UiCard>
      <UiCard class="pane preview-pane" padding="none" :label="t('preview')">
        <div
          ref="previewRef"
          class="preview md-preview"
          :data-empty="t('empty')"
          role="region"
          aria-label="Rendered preview"
          tabindex="0"
          v-html="renderedHtml"
          @scroll="onPreviewScroll"
        ></div>
      </UiCard>
    </section>

    <div class="statusbar">
      <div class="stats" aria-live="polite">
        <UiBadge size="sm" mono class="stat-chip"
          ><b>{{ stats.chars }}</b> {{ t('chars') }}</UiBadge
        >
        <UiBadge size="sm" mono class="stat-chip"
          ><b>{{ stats.words }}</b> {{ t('words') }}</UiBadge
        >
        <UiBadge size="sm" mono class="stat-chip"
          ><b>{{ stats.lines }}</b> {{ t('lines') }}</UiBadge
        >
      </div>
      <UiBadge v-if="notice" variant="down" size="sm" class="status-notice" role="status">{{ notice }}</UiBadge>
      <div class="status-actions">
        <UiButton variant="ghost" size="sm" @click="loadSample">{{ t('sample') }}</UiButton>
        <UiButton variant="ghost" size="sm" @click="onImportClick">{{ t('import') }}</UiButton>
        <UiButton variant="ghost" size="sm" @click="exportMd">{{ t('exportMd') }}</UiButton>
        <UiButton variant="ghost" size="sm" @click="exportHtml">{{ t('exportHtml') }}</UiButton>
        <UiButton variant="ghost" size="sm" @click="renderWithGitHub">{{ t('renderGithub') }}</UiButton>
        <input
          ref="fileInputRef"
          type="file"
          accept=".md,.markdown,.txt,text/markdown,text/plain"
          hidden
          @change="onFileChange"
        />
      </div>
    </div>
  </UiPage>
</template>

<style scoped>
.toolbar {
  position: sticky;
  top: 0;
  z-index: 5;
  margin-bottom: 0.9rem;
}

.toolbar :deep(.ui-card-body) {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  padding-right: 0.4rem;
  border-right: 1px solid var(--ok-line);
}

.toolbar-group:last-child {
  border-right: none;
  padding-right: 0;
}

.h-btn {
  font-family: var(--ok-mono);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.workspace {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem;
  height: calc(100vh - 330px);
  min-height: 420px;
}

.pane {
  min-height: 0;
  overflow: hidden;
}

.pane :deep(.ui-card-head) {
  flex: 0 0 auto;
  align-items: center;
  margin-bottom: 0;
  padding: 0.55rem 0.9rem;
  border-bottom: 1px solid var(--ok-line);
  background: var(--ok-bg);
}

.pane :deep(.ui-card-label) {
  font-family: var(--ok-mono);
  letter-spacing: 0.08em;
}

.pane :deep(.ui-card-body) {
  min-height: 0;
  flex: 1 1 auto;
  gap: 0;
}

.editor-pane :deep(.ui-textarea) {
  flex: 1 1 auto;
  min-height: 0;
  padding: 0.85rem 1rem;
  border: 0;
  border-radius: 0;
  background: var(--ok-panel);
}

.editor-pane :deep(.ui-textarea textarea) {
  height: 100%;
  min-height: 0;
  font-size: 0.86rem;
  line-height: 1.65;
  resize: none;
  tab-size: 2;
  -moz-tab-size: 2;
}

.preview-pane :deep(.ui-card-body) {
  overflow: hidden;
}

.preview {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 1.1rem 1.3rem;
  background: var(--ok-panel);
}

.preview:empty::before {
  content: attr(data-empty);
  color: var(--ok-muted);
  font-size: 0.88rem;
}

.statusbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 0.9rem;
  padding: 0.6rem 0.9rem;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-surface);
  background: var(--ok-panel);
  box-shadow: var(--ok-shadow-card);
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.stat-chip {
  font-family: var(--ok-mono);
}

.stat-chip b {
  color: var(--ok-text);
  font-weight: 600;
}

.status-notice {
  flex: 1 1 auto;
  justify-content: center;
  white-space: normal;
  text-align: center;
}

.status-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.md-preview {
  font-family: var(--ok-font);
  font-size: 0.92rem;
  line-height: 1.65;
  color: var(--ok-text);
  word-wrap: break-word;
}

.md-preview :deep(> *:first-child) {
  margin-top: 0;
}
.md-preview :deep(> *:last-child) {
  margin-bottom: 0;
}

.md-preview :deep(h1),
.md-preview :deep(h2),
.md-preview :deep(h3),
.md-preview :deep(h4),
.md-preview :deep(h5),
.md-preview :deep(h6) {
  margin-top: 1.6em;
  margin-bottom: 0.6em;
  font-weight: 600;
  line-height: 1.25;
}

.md-preview :deep(h1) {
  font-size: 1.9em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--ok-line);
}
.md-preview :deep(h2) {
  font-size: 1.5em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--ok-line);
}
.md-preview :deep(h3) {
  font-size: 1.25em;
}
.md-preview :deep(h4) {
  font-size: 1em;
}
.md-preview :deep(h5) {
  font-size: 0.9em;
  color: var(--ok-muted);
}
.md-preview :deep(h6) {
  font-size: 0.82em;
  color: var(--ok-muted);
}

.md-preview :deep(p) {
  margin: 0 0 1em;
}

.md-preview :deep(a) {
  color: var(--ok-accent);
}
.md-preview :deep(a:hover) {
  text-decoration: underline;
}

.md-preview :deep(strong) {
  font-weight: 600;
}
.md-preview :deep(em) {
  font-style: italic;
}

.md-preview :deep(ul),
.md-preview :deep(ol) {
  margin: 0 0 1em;
  padding-left: 1.6em;
}

.md-preview :deep(li) {
  margin: 0.25em 0;
}

.md-preview :deep(ul.task-list),
.md-preview :deep(.task-list) {
  list-style: none;
  padding-left: 0.4em;
}

.md-preview :deep(.task-item) {
  list-style: none;
  display: flex;
  align-items: flex-start;
  gap: 0.45em;
}

.md-preview :deep(.task-item input[type='checkbox']) {
  margin: 0.4em 0 0;
  accent-color: var(--ok-accent);
}

.md-preview :deep(blockquote) {
  margin: 0 0 1em;
  padding: 0.2em 1em;
  color: var(--ok-muted);
  border-left: 0.25em solid var(--ok-line);
  background: var(--ok-bg);
  border-radius: 0 var(--ok-radius-sm) var(--ok-radius-sm) 0;
}

.md-preview :deep(blockquote > *:first-child) {
  margin-top: 0;
}
.md-preview :deep(blockquote > *:last-child) {
  margin-bottom: 0;
}

.md-preview :deep(code) {
  font-family: var(--ok-mono);
  font-size: 0.85em;
  background: var(--ok-bg);
  color: var(--ok-text);
  padding: 0.15em 0.4em;
  border-radius: var(--ok-radius-sm);
}

.md-preview :deep(pre) {
  margin: 0 0 1em;
  padding: 0.9em 1em;
  background: var(--ok-bg);
  border-radius: var(--ok-radius-sm);
  overflow: auto;
  line-height: 1.5;
}

.md-preview :deep(pre code) {
  font-family: var(--ok-mono);
  font-size: 0.82em;
  background: transparent;
  padding: 0;
  border-radius: 0;
  color: var(--ok-text);
  white-space: pre;
}

.md-preview :deep(hr) {
  margin: 1.4em 0;
  border: none;
  border-top: 2px solid var(--ok-line);
}

.md-preview :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--ok-radius-sm);
}

.md-preview :deep(table) {
  margin: 0 0 1em;
  border-collapse: collapse;
  width: 100%;
  display: block;
  overflow-x: auto;
}

.md-preview :deep(th),
.md-preview :deep(td) {
  padding: 0.45em 0.85em;
  border: 1px solid var(--ok-line);
  text-align: left;
}

.md-preview :deep(th) {
  background: var(--ok-bg);
  font-weight: 600;
}

.md-preview :deep(tr:nth-child(even) td) {
  background: var(--ok-bg);
}

@media (max-width: 860px) {
  .workspace {
    grid-template-columns: 1fr;
    height: auto;
  }
  .pane {
    height: 420px;
  }
  .toolbar {
    position: static;
  }
}

@media (max-width: 520px) {
  .statusbar {
    flex-direction: column;
    align-items: stretch;
  }
  .status-actions {
    justify-content: space-between;
  }
  .status-actions :deep(.ui-btn) {
    flex: 1 1 auto;
  }
  .pane {
    height: 360px;
  }
}
</style>
