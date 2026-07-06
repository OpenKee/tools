<script setup>
/* ============================================================
   Markdown Studio — 实时预览的 Markdown 编辑器（Vue 3 SFC 迁移版）
   - 共享 i18n：useT（来自 ../i18n.js），语言切换由 AppHeader 负责
   - 共享工具：locale（来自 ../ok.js）
   - 共享组件：AppHeader / AppFooter
   - Markdown 解析器自行实现，不引入外部库；通过 v-html 输出，
     解析器内部对所有文本节点做 HTML 转义，链接经白名单协议过滤，保证安全。
   ============================================================ */
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { locale } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

// ---------- i18n 文案字典 ----------
const copy = {
  en: {
    eyebrow: 'Markdown editor',
    title: 'Markdown Studio',
    lead: 'A live-preview Markdown editor with a formatting toolbar, word count, import/export and synced scrolling.',
    editor: 'Editor',
    preview: 'Preview',
    sample: 'Sample',
    import: 'Import',
    exportMd: 'Export .md',
    exportHtml: 'Export .html',
    renderGithub: 'GitHub Render',
    renderFail: 'GitHub render failed, using local renderer.',
    empty: 'Nothing to preview yet. Start typing on the left.',
    chars: 'chars',
    words: 'words',
    lines: 'lines',
    promptUrl: 'Link URL',
    promptImgUrl: 'Image URL',
    promptImgAlt: 'Image alt text',
    linkText: 'link text',
    imageAlt: 'image',
    codeText: 'code',
    boldTip: 'Bold (Ctrl+B)',
    italicTip: 'Italic (Ctrl+I)',
    strikeTip: 'Strikethrough',
    h1Tip: 'Heading 1',
    h2Tip: 'Heading 2',
    h3Tip: 'Heading 3',
    ulTip: 'Unordered list',
    olTip: 'Ordered list',
    taskTip: 'Task list',
    linkTip: 'Link (Ctrl+K)',
    imageTip: 'Image',
    codeTip: 'Inline code',
    codeblockTip: 'Code block',
    quoteTip: 'Blockquote',
    hrTip: 'Horizontal rule',
    tableTip: 'Table',
    importFail: 'Failed to read file. Please try again.',
    imported: 'Imported'
  },
  zh: {
    eyebrow: 'Markdown 编辑器',
    title: 'Markdown Studio',
    lead: '实时预览的 Markdown 编辑器，带格式化工具栏、字数统计、导入导出与同步滚动。',
    editor: '编辑器',
    preview: '预览',
    sample: '示例',
    import: '导入',
    exportMd: '导出 .md',
    exportHtml: '导出 .html',
    renderGithub: 'GitHub 渲染',
    renderFail: 'GitHub 渲染失败，已切换到本地渲染。',
    empty: '暂无内容可预览，请在左侧开始输入。',
    chars: '字符',
    words: '词数',
    lines: '行',
    promptUrl: '链接地址',
    promptImgUrl: '图片地址',
    promptImgAlt: '图片替代文本',
    linkText: '链接文本',
    imageAlt: '图片',
    codeText: '代码',
    boldTip: '加粗 (Ctrl+B)',
    italicTip: '斜体 (Ctrl+I)',
    strikeTip: '删除线',
    h1Tip: '一级标题',
    h2Tip: '二级标题',
    h3Tip: '三级标题',
    ulTip: '无序列表',
    olTip: '有序列表',
    taskTip: '任务列表',
    linkTip: '链接 (Ctrl+K)',
    imageTip: '图片',
    codeTip: '行内代码',
    codeblockTip: '代码块',
    quoteTip: '引用块',
    hrTip: '分隔线',
    tableTip: '表格',
    importFail: '文件读取失败，请重试。',
    imported: '已导入'
  }
}

const t = useT(copy)

// ---------- 示例文档（双语） ----------
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
    'Start editing to see your changes!'
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
    '开始编辑，查看你的改动！'
  ].join('\n')
}

// ---------- DOM 引用 ----------
const editorRef = ref(null)
const previewRef = ref(null)
const fileInputRef = ref(null)

// ---------- 应用状态 ----------
const editorText = ref('')
const renderedHtml = ref('')
let renderTimer = null
let syncLock = false // 同步滚动防互触锁

// ---------- 工具函数 ----------
// HTML 转义（防 XSS），用于 Markdown 解析器内部构建安全 HTML
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// 净化链接地址，禁止 javascript: 等危险协议
function sanitizeUrl(url) {
  const u = String(url == null ? '' : url).trim()
  if (!u) return ''
  // 允许的协议
  if (/^(https?:|mailto:|tel:|ftp:|data:image\/)/i.test(u)) return u
  // 相对链接 / 锚点 / 当前页
  if (u.charAt(0) === '#' || u.charAt(0) === '/' || u.charAt(0) === '?') return u
  if (u.indexOf(':') === -1) return u // 无协议的相对路径
  return '' // 其他协议一律拒绝
}

// ============================================================
// Markdown 解析器（自行实现，简易版）
// ============================================================

// ---------- 行内元素解析 ----------
function parseInline(text) {
  const slots = []
  // 占位：把已构造好的 HTML 片段存起来，最后再还原
  function stash(html) {
    slots.push(html)
    return '\u0000' + (slots.length - 1) + '\u0000'
  }

  // 1. 行内代码（最先处理，内部不再做其他转换）
  text = text.replace(/`([^`]+)`/g, function (m, code) {
    return stash('<code>' + escapeHtml(code) + '</code>')
  })

  // 2. 图片 ![alt](url "title")
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, function (m, alt, url, title) {
    const u = sanitizeUrl(url)
    if (!u) return escapeHtml(m)
    const tAttr = title ? ' title="' + escapeHtml(title) + '"' : ''
    return stash('<img src="' + escapeHtml(u) + '" alt="' + escapeHtml(alt) + '"' + tAttr + ' />')
  })

  // 3. 链接 [text](url "title")
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, function (m, label, url, title) {
    const u = sanitizeUrl(url)
    if (!u) return escapeHtml(m)
    const tAttr = title ? ' title="' + escapeHtml(title) + '"' : ''
    return stash('<a href="' + escapeHtml(u) + '"' + tAttr + ' target="_blank" rel="noreferrer">' + parseInline(label) + '</a>')
  })

  // 4. 转义剩余 HTML（占位符不含特殊字符，不受影响）
  text = escapeHtml(text)

  // 5. 粗体 / 删除线 / 斜体（标记字符 * ~ 不会被转义）
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  text = text.replace(/\*([^*]+?)\*/g, '<em>$1</em>')

  // 6. 还原占位
  text = text.replace(/\u0000(\d+)\u0000/g, function (m, idx) {
    return slots[Number(idx)]
  })

  return text
}

// ---------- 表格辅助 ----------
function isTableSeparator(line) {
  // 形如 | --- | :--: | --: | 的分隔行
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && /\|/.test(line) && /[-:]/.test(line)
}

function splitTableRow(line) {
  const s = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return s.split('|').map(function (c) { return c.trim() })
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
  const th = header.map(function (c, i) {
    const a = aligns[i] ? ' style="text-align:' + aligns[i] + '"' : ''
    return '<th' + a + '>' + parseInline(c) + '</th>'
  }).join('')
  const trs = bodyRows.map(function (row) {
    const tds = row.map(function (c, i) {
      const a = aligns[i] ? ' style="text-align:' + aligns[i] + '"' : ''
      return '<td' + a + '>' + parseInline(c) + '</td>'
    }).join('')
    return '<tr>' + tds + '</tr>'
  }).join('')
  return '<table><thead><tr>' + th + '</tr></thead><tbody>' + trs + '</tbody></table>'
}

// ---------- 判断某行是否是块级元素起始 ----------
function isBlockStart(line) {
  return /^#{1,6}\s/.test(line) ||
    /^```/.test(line) ||
    /^>\s?/.test(line) ||
    /^\s*([-*+]|\d+\.)\s+/.test(line) ||
    /^\s*([-*_])(\s*\1){2,}\s*$/.test(line)
}

// ---------- 列表解析 ----------
// 返回 { html, next }，next 为下一条待处理行索引
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

  const lis = items.map(function (it) {
    if (it.task) {
      const checked = /^\[[xX]\]/.test(it.task)
      return '<li class="task-item">' +
        '<input type="checkbox" disabled' + (checked ? ' checked' : '') + ' /> ' +
        parseInline(it.content) + '</li>'
    }
    return '<li>' + parseInline(it.content) + '</li>'
  }).join('')

  const tag = isOrdered ? 'ol' : 'ul'
  const cls = items.some(function (it) { return !!it.task }) ? ' class="task-list"' : ''
  return { html: '<' + tag + cls + '>' + lis + '</' + tag + '>', next: i }
}

// ---------- 主解析：块级元素 ----------
function renderMarkdown(src) {
  const text = String(src == null ? '' : src).replace(/\r\n?/g, '\n')
  const lines = text.split('\n')
  const out = []
  let i = 0
  const n = lines.length

  while (i < n) {
    const line = lines[i]

    // 代码块围栏
    const fence = line.match(/^```\s*(\w*)\s*$/)
    if (fence) {
      const codeLang = fence[1] || ''
      const codeLines = []
      i++
      while (i < n && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i])
        i++
      }
      i++ // 跳过结束围栏（若存在）
      const cls = codeLang ? ' class="lang-' + escapeHtml(codeLang) + '"' : ''
      out.push('<pre><code' + cls + '>' + escapeHtml(codeLines.join('\n')) + '</code></pre>')
      continue
    }

    // 空行
    if (/^\s*$/.test(line)) { i++; continue }

    // 标题
    const h = line.match(/^(#{1,6})\s+(.*?)(?:\s+#{1,6})?$/)
    if (h) {
      const lvl = h[1].length
      out.push('<h' + lvl + '>' + parseInline(h[2]) + '</h' + lvl + '>')
      i++; continue
    }

    // 分隔线
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push('<hr />')
      i++; continue
    }

    // 表格：当前行含 | 且下一行是分隔行
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

    // 引用块
    if (/^>\s?/.test(line)) {
      const quoteLines = []
      while (i < n && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      // 引用内部递归解析（支持多行段落、嵌套标题等）
      out.push('<blockquote>' + renderMarkdown(quoteLines.join('\n')) + '</blockquote>')
      continue
    }

    // 列表
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const list = parseList(lines, i)
      out.push(list.html)
      i = list.next
      continue
    }

    // 普通段落（连续非空、非块级起始行合并）
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

// ============================================================
// 预览渲染 + 字数统计
// ============================================================
function doRender() {
  renderedHtml.value = renderMarkdown(editorText.value)
}

// 防抖渲染（200ms）
watch(editorText, () => {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(function () {
    renderTimer = null
    doRender()
  }, 200)
})

// 字数统计：字符数 / 单词数（中文按字符、英文按词）/ 行数
const stats = computed(() => {
  const text = editorText.value
  const chars = text.length
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const enWords = (text.replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9]+/g) || []).length
  const words = cjk + enWords
  const lines = text === '' ? 0 : text.split('\n').length
  return { chars, words, lines }
})

// ============================================================
// 工具栏：选区编辑操作
// ============================================================

// 通用：对当前选区执行变换，返回新文本与新选区
function editSelection(transform) {
  const editor = editorRef.value
  if (!editor) return
  const start = editor.selectionStart
  const end = editor.selectionEnd
  const value = editor.value
  const selected = value.slice(start, end)
  const result = transform(selected, value, start, end)
  editorText.value = result.value
  // 等待 v-model 更新 textarea 后，恢复选区
  nextTick(() => {
    editor.focus()
    editor.selectionStart = result.selStart
    editor.selectionEnd = result.selEnd
  })
}

// 用前后缀包裹选区（无选区时插入占位文本并选中）
function wrap(before, after, placeholder) {
  editSelection(function (sel, val, start, end) {
    const text = sel.length ? sel : placeholder
    const newVal = val.slice(0, start) + before + text + after + val.slice(end)
    const s = start + before.length
    return { value: newVal, selStart: s, selEnd: s + text.length }
  })
}

// 给选区涉及的每一行加前缀（标题、列表、引用）
function prefixLines(prefix) {
  editSelection(function (sel, val, start, end) {
    const lineStart = val.lastIndexOf('\n', start - 1) + 1
    let lineEnd = val.indexOf('\n', end)
    if (lineEnd === -1) lineEnd = val.length
    const block = val.slice(lineStart, lineEnd)
    const newBlock = block.split('\n').map(function (l) { return prefix + l }).join('\n')
    const newVal = val.slice(0, lineStart) + newBlock + val.slice(lineEnd)
    return { value: newVal, selStart: lineStart, selEnd: lineStart + newBlock.length }
  })
}

// 在光标处插入文本（无选区）或替换选区
function insertAtCursor(text) {
  editSelection(function (sel, val, start, end) {
    const newVal = val.slice(0, start) + text + val.slice(end)
    return { value: newVal, selStart: start, selEnd: start + text.length }
  })
}

// 各动作处理
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

// ============================================================
// 导入 / 导出
// ============================================================

// 触发文件下载（Blob + URL.createObjectURL）
function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 释放 blob URL
  setTimeout(function () { URL.revokeObjectURL(url) }, 1000)
}

// 导出 .md
function exportMd() {
  downloadFile('markdown-studio.md', editorText.value, 'text/markdown;charset=utf-8')
}

// 导出 .html（带基础样式的独立文档）
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
  const html = '<!DOCTYPE html>\n<html lang="' + (i18nState.lang === 'zh' ? 'zh' : 'en') + '">\n<head>\n' +
    '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>Markdown Studio</title>\n<style>' + css + '</style>\n</head>\n<body>\n' +
    body + '\n</body>\n</html>'
  downloadFile('markdown-studio.html', html, 'text/html;charset=utf-8')
}

// 导入 .md 文件
function importFile(file) {
  if (!file) return
  const reader = new FileReader()
  reader.onload = function () {
    editorText.value = String(reader.result || '')
  }
  reader.onerror = function () {
    alert(t.value('importFail'))
  }
  reader.readAsText(file)
}

// ============================================================
// 同步滚动
// ============================================================
function syncScroll(source, target) {
  if (syncLock) return
  if (!source || !target) return
  syncLock = true
  const sMax = source.scrollHeight - source.clientHeight
  const tMax = target.scrollHeight - target.clientHeight
  const ratio = sMax > 0 ? source.scrollTop / sMax : 0
  target.scrollTop = ratio * (tMax > 0 ? tMax : 0)
  // 下一帧释放锁，避免反向事件循环
  requestAnimationFrame(function () { syncLock = false })
}

function onEditorScroll() { syncScroll(editorRef.value, previewRef.value) }
function onPreviewScroll() { syncScroll(previewRef.value, editorRef.value) }

// ============================================================
// 键盘事件
// ============================================================
function onEditorKeydown(e) {
  // Ctrl+B / Ctrl+I / Ctrl+K
  if (e.ctrlKey || e.metaKey) {
    const key = e.key.toLowerCase()
    if (key === 'b') { e.preventDefault(); handleAction('bold'); return }
    if (key === 'i') { e.preventDefault(); handleAction('italic'); return }
    if (key === 'k') { e.preventDefault(); handleAction('link'); return }
  }
  // Tab 键插入两个空格（编辑器内不切焦）
  if (e.key === 'Tab') {
    e.preventDefault()
    const editor = editorRef.value
    if (!editor) return
    const start = editor.selectionStart
    const end = editor.selectionEnd
    editorText.value = editor.value.slice(0, start) + '  ' + editor.value.slice(end)
    nextTick(() => {
      editor.selectionStart = editor.selectionEnd = start + 2
    })
  }
}

// ============================================================
// 示例 / 导入 / GitHub 渲染
// ============================================================
function loadSample() {
  editorText.value = SAMPLE[i18nState.lang] || SAMPLE.en
  nextTick(() => {
    if (editorRef.value) editorRef.value.focus()
  })
}

function onImportClick() {
  if (fileInputRef.value) fileInputRef.value.click()
}

function onFileChange(e) {
  const file = e.target.files && e.target.files[0]
  importFile(file)
  e.target.value = '' // 允许重复导入同一文件
}

// GitHub Markdown API 渲染
async function renderWithGitHub() {
  const text = editorText.value
  try {
    const res = await fetch('https://api.github.com/markdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, mode: 'gfm' })
    })
    if (!res.ok) throw new Error('GitHub API returned ' + res.status)
    const html = await res.text()
    renderedHtml.value = html
  } catch (e) {
    renderedHtml.value = renderMarkdown(text)
    alert(t.value('renderFail'))
  }
}

// ============================================================
// 初始化
// ============================================================
onMounted(() => {
  // 首次加载示例文档，便于直接体验
  editorText.value = SAMPLE[i18nState.lang] || SAMPLE.en
  doRender()
})
</script>

<template>
  <div class="markdown-studio-app">
    <!-- 顶部栏：语言切换由 AppHeader 内部处理 -->
    <AppHeader />

    <main class="shell">
      <!-- 页头 -->
      <header class="masthead">
        <div>
          <p class="eyebrow">{{ t('eyebrow') }}</p>
          <h1>{{ t('title') }}</h1>
          <p class="lead">{{ t('lead') }}</p>
        </div>
      </header>

      <!-- 格式化工具栏 -->
      <div class="toolbar" role="toolbar" aria-label="Markdown formatting toolbar">
        <div class="toolbar-group">
          <button class="tb-btn" type="button" :title="t('boldTip')" :aria-label="t('boldTip')" @click="handleAction('bold')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h7a4 4 0 0 1 0 8H6z"/><path d="M6 12h8a4 4 0 0 1 0 8H6z"/></svg>
          </button>
          <button class="tb-btn" type="button" :title="t('italicTip')" :aria-label="t('italicTip')" @click="handleAction('italic')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
          </button>
          <button class="tb-btn" type="button" :title="t('strikeTip')" :aria-label="t('strikeTip')" @click="handleAction('strike')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" y1="12" x2="20" y2="12"/></svg>
          </button>
        </div>

        <div class="toolbar-group">
          <button class="tb-btn" type="button" :title="t('h1Tip')" :aria-label="t('h1Tip')" @click="handleAction('h1')"><span class="tb-text">H1</span></button>
          <button class="tb-btn" type="button" :title="t('h2Tip')" :aria-label="t('h2Tip')" @click="handleAction('h2')"><span class="tb-text">H2</span></button>
          <button class="tb-btn" type="button" :title="t('h3Tip')" :aria-label="t('h3Tip')" @click="handleAction('h3')"><span class="tb-text">H3</span></button>
        </div>

        <div class="toolbar-group">
          <button class="tb-btn" type="button" :title="t('ulTip')" :aria-label="t('ulTip')" @click="handleAction('ul')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4.5" cy="6" r="1.1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.1" fill="currentColor" stroke="none"/></svg>
          </button>
          <button class="tb-btn" type="button" :title="t('olTip')" :aria-label="t('olTip')" @click="handleAction('ol')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><path d="M4 5h2v1L4 8v1h3"/><path d="M4 12h3"/><path d="M6 17H4c0-1 2-1 2-2 0-1-2-1-2 0"/></svg>
          </button>
          <button class="tb-btn" type="button" :title="t('taskTip')" :aria-label="t('taskTip')" @click="handleAction('task')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 12 8 16 16 6"/><line x1="11" y1="6" x2="20" y2="6"/><line x1="11" y1="12" x2="20" y2="12"/><line x1="11" y1="18" x2="20" y2="18"/></svg>
          </button>
        </div>

        <div class="toolbar-group">
          <button class="tb-btn" type="button" :title="t('linkTip')" :aria-label="t('linkTip')" @click="handleAction('link')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </button>
          <button class="tb-btn" type="button" :title="t('imageTip')" :aria-label="t('imageTip')" @click="handleAction('image')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </button>
        </div>

        <div class="toolbar-group">
          <button class="tb-btn" type="button" :title="t('codeTip')" :aria-label="t('codeTip')" @click="handleAction('code')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          </button>
          <button class="tb-btn" type="button" :title="t('codeblockTip')" :aria-label="t('codeblockTip')" @click="handleAction('codeblock')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><polyline points="9 9 7 12 9 15"/><polyline points="15 9 17 12 15 15"/></svg>
          </button>
        </div>

        <div class="toolbar-group">
          <button class="tb-btn" type="button" :title="t('quoteTip')" :aria-label="t('quoteTip')" @click="handleAction('quote')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="6" x2="3" y2="18"/><line x1="8" y1="6" x2="8" y2="18"/><line x1="13" y1="6" x2="21" y2="6"/><line x1="13" y1="10" x2="21" y2="10"/><line x1="13" y1="14" x2="21" y2="14"/><line x1="13" y1="18" x2="21" y2="18"/></svg>
          </button>
          <button class="tb-btn" type="button" :title="t('hrTip')" :aria-label="t('hrTip')" @click="handleAction('hr')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="12" x2="20" y2="12"/></svg>
          </button>
          <button class="tb-btn" type="button" :title="t('tableTip')" :aria-label="t('tableTip')" @click="handleAction('table')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
          </button>
        </div>
      </div>

      <!-- 编辑器 + 预览 双栏 -->
      <section class="workspace" aria-label="Editor and preview">
        <div class="pane editor-pane">
          <div class="pane-head"><span>{{ t('editor') }}</span></div>
          <textarea
            ref="editorRef"
            v-model="editorText"
            class="editor"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            aria-label="Markdown source editor"
            @keydown="onEditorKeydown"
            @scroll="onEditorScroll"
          ></textarea>
        </div>
        <div class="pane preview-pane">
          <div class="pane-head"><span>{{ t('preview') }}</span></div>
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
        </div>
      </section>

      <!-- 状态栏：字数统计 + 操作 -->
      <div class="statusbar">
        <div class="stats" aria-live="polite">
          <span><b>{{ stats.chars }}</b> {{ t('chars') }}</span>
          <span><b>{{ stats.words }}</b> {{ t('words') }}</span>
          <span><b>{{ stats.lines }}</b> {{ t('lines') }}</span>
        </div>
        <div class="status-actions">
          <button class="ok-btn-ghost" type="button" @click="loadSample">{{ t('sample') }}</button>
          <button class="ok-btn-ghost" type="button" @click="onImportClick">{{ t('import') }}</button>
          <button class="ok-btn-ghost" type="button" @click="exportMd">{{ t('exportMd') }}</button>
          <button class="ok-btn-ghost" type="button" @click="exportHtml">{{ t('exportHtml') }}</button>
          <button class="ok-btn-ghost" type="button" @click="renderWithGitHub">{{ t('renderGithub') }}</button>
          <input
            ref="fileInputRef"
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            hidden
            @change="onFileChange"
          />
        </div>
      </div>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Markdown Studio — 实时预览的 Markdown 编辑器
   浅色 GitHub 风格主题。:root 变量改为根元素类，避免污染全局。
   ============================================================ */

.markdown-studio-app {
  --bg: #fafafa;
  --panel: #ffffff;
  --line: #e1e4e8;
  --text: #24292e;
  --muted: #6a737d;
  --accent: #0366d6;
  --accent-soft: #f1f8ff;
  --code-bg: #f6f8fa;
  --code-text: #24292e;

  /* 共享组件主题映射（覆盖 shared.css 默认值，作用于本组件子树） */
  --ok-bg: var(--bg);
  --ok-panel: var(--panel);
  --ok-line: var(--line);
  --ok-text: var(--text);
  --ok-muted: var(--muted);
  --ok-accent: var(--accent);
  --ok-accent-soft: var(--accent-soft);
  --ok-footer-line: var(--line);
  --ok-footer-text: var(--muted);
  --ok-footer-link: var(--accent);
  --ok-topbar-line: rgba(128, 128, 128, 0.1);
  color-scheme: light;

  /* 应用专用 token */
  --mono: "JetBrains Mono", "SFMono-Regular", "SF Mono", Menlo, Consolas, monospace;
  --sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --radius: 8px;
  --radius-sm: 4px;
  --shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 16px rgba(36, 41, 46, 0.05);

  font-family: var(--sans);
  color: var(--text);
  background: var(--bg);
}

.markdown-studio-app a { color: var(--accent); text-decoration: none; }
.markdown-studio-app h1,
.markdown-studio-app h2,
.markdown-studio-app h3,
.markdown-studio-app h4,
.markdown-studio-app p,
.markdown-studio-app strong,
.markdown-studio-app span,
.markdown-studio-app small { margin: 0; }

/* ---------- 主容器 ---------- */
.shell {
  width: min(1280px, calc(100% - 1.5rem));
  margin: 0 auto;
  padding: 1rem 0 2rem;
}

/* ---------- 页头 ---------- */
.masthead {
  display: flex;
  justify-content: space-between;
  align-items: end;
  padding: 0.3rem 0 1.1rem;
  border-bottom: 1px solid var(--line);
  gap: 1rem;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--accent);
}

.masthead h1 {
  margin-top: 0.25rem;
  font-size: clamp(1.9rem, 5vw, 2.8rem);
  line-height: 0.98;
  letter-spacing: -0.04em;
  font-weight: 800;
}

.lead {
  margin-top: 0.5rem;
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.6;
  max-width: 60ch;
}

.header-right {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

/* ---------- 工具栏 ---------- */
.toolbar {
  margin-top: 1.1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
  padding: 0.45rem 0.55rem;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  position: sticky;
  top: 0;
  z-index: 5;
}

.toolbar-group {
  display: flex;
  gap: 0.15rem;
  align-items: center;
  padding-right: 0.4rem;
  border-right: 1px solid var(--line);
}

.toolbar-group:last-child {
  border-right: none;
  padding-right: 0;
}

.tb-btn {
  font: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}

.tb-btn:hover {
  background: var(--accent-soft);
  color: var(--accent);
}

.tb-btn:active {
  background: var(--accent);
  color: #fff;
}

.tb-btn .tb-text {
  font-family: var(--mono);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

/* ---------- 双栏工作区 ---------- */
.workspace {
  margin-top: 0.9rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem;
  height: calc(100vh - 280px);
  min-height: 420px;
}

.pane {
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
  min-height: 0; /* 让内部可滚动区域正确收缩 */
}

.pane-head {
  flex: 0 0 auto;
  padding: 0.5rem 0.9rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  background: var(--bg);
  border-bottom: 1px solid var(--line);
}

/* ---------- 编辑器 ---------- */
.editor {
  flex: 1 1 auto;
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  padding: 1rem 1.1rem;
  font-family: var(--mono);
  font-size: 0.86rem;
  line-height: 1.65;
  color: var(--text);
  background: var(--panel);
  tab-size: 2;
  -moz-tab-size: 2;
}

.editor::placeholder {
  color: var(--muted);
}

/* ---------- 预览 ---------- */
.preview {
  flex: 1 1 auto;
  overflow: auto;
  padding: 1.1rem 1.3rem;
  background: var(--panel);
}

.preview:empty::before {
  content: attr(data-empty);
  color: var(--muted);
  font-size: 0.88rem;
}

/* ---------- 状态栏 ---------- */
.statusbar {
  margin-top: 0.9rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.6rem 0.9rem;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.stats {
  font-family: var(--mono);
  font-size: 0.76rem;
  color: var(--muted);
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.stats b {
  color: var(--text);
  font-weight: 600;
}

.status-actions {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

/* ============================================================
   预览区 Markdown 排版（GitHub 风格）
   v-html 渲染的子元素不带 scoped 属性，需使用 :deep() 穿透。
   ============================================================ */
.md-preview {
  font-family: var(--sans);
  font-size: 0.92rem;
  line-height: 1.65;
  color: var(--text);
  word-wrap: break-word;
}

.md-preview :deep(>*:first-child) { margin-top: 0; }
.md-preview :deep(>*:last-child) { margin-bottom: 0; }

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

.md-preview :deep(h1) { font-size: 1.9em; padding-bottom: 0.3em; border-bottom: 1px solid var(--line); }
.md-preview :deep(h2) { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid var(--line); }
.md-preview :deep(h3) { font-size: 1.25em; }
.md-preview :deep(h4) { font-size: 1em; }
.md-preview :deep(h5) { font-size: 0.9em; color: var(--muted); }
.md-preview :deep(h6) { font-size: 0.82em; color: var(--muted); }

.md-preview :deep(p) { margin: 0 0 1em; }

.md-preview :deep(a) { color: var(--accent); }
.md-preview :deep(a:hover) { text-decoration: underline; }

.md-preview :deep(strong) { font-weight: 600; }
.md-preview :deep(em) { font-style: italic; }

.md-preview :deep(ul),
.md-preview :deep(ol) {
  margin: 0 0 1em;
  padding-left: 1.6em;
}

.md-preview :deep(li) { margin: 0.25em 0; }

/* 任务列表：去除默认圆点，复选框与文本对齐 */
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

.md-preview :deep(.task-item input[type="checkbox"]) {
  margin: 0.4em 0 0;
  accent-color: var(--accent);
}

.md-preview :deep(blockquote) {
  margin: 0 0 1em;
  padding: 0.2em 1em;
  color: var(--muted);
  border-left: 0.25em solid var(--line);
  background: var(--code-bg);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.md-preview :deep(blockquote >*:first-child) { margin-top: 0; }
.md-preview :deep(blockquote >*:last-child) { margin-bottom: 0; }

/* 行内代码 */
.md-preview :deep(code) {
  font-family: var(--mono);
  font-size: 0.85em;
  background: var(--code-bg);
  color: var(--code-text);
  padding: 0.15em 0.4em;
  border-radius: var(--radius-sm);
}

/* 代码块 */
.md-preview :deep(pre) {
  margin: 0 0 1em;
  padding: 0.9em 1em;
  background: var(--code-bg);
  border-radius: var(--radius-sm);
  overflow: auto;
  line-height: 1.5;
}

.md-preview :deep(pre code) {
  font-family: var(--mono);
  font-size: 0.82em;
  background: transparent;
  padding: 0;
  border-radius: 0;
  color: var(--code-text);
  white-space: pre;
}

.md-preview :deep(hr) {
  margin: 1.4em 0;
  border: none;
  border-top: 2px solid var(--line);
}

.md-preview :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-sm);
}

/* 表格 */
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
  border: 1px solid var(--line);
  text-align: left;
}

.md-preview :deep(th) {
  background: var(--code-bg);
  font-weight: 600;
}

.md-preview :deep(tr:nth-child(even) td) {
  background: var(--bg);
}

/* ---------- 响应式：移动端上下布局 ---------- */
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
  .shell {
    width: calc(100% - 1rem);
  }
  .masthead {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.6rem;
  }
  .statusbar {
    flex-direction: column;
    align-items: stretch;
  }
  .status-actions {
    justify-content: space-between;
  }
  .status-actions :deep(.ok-btn-ghost) {
    flex: 1 1 auto;
  }
  .pane {
    height: 360px;
  }
}
</style>
