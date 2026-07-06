<script setup>
/* ============================================================
   Dev Tools — 开发者工具集（Vue 3 SFC 迁移版）
   14 个工具：CSS/HTML 压缩、JSON/SQL 格式化、编码/解码、
   哈希、JWT、正则、Diff、Lorem、UUID、时间戳、颜色、Markdown。
   所有计算纯前端完成，无 API 调用。
   ============================================================ */
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { locale } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

// ---------- i18n 文案字典 ----------
const copy = {
  en: {
    title: 'Dev Tools',
    'group.code': 'Code',
    'group.encoding': 'Encoding',
    'group.text': 'Text',
    'group.utility': 'Utility',
    'tool.css': 'CSS Compressor',
    'tool.html': 'HTML Compressor',
    'tool.json': 'JSON Formatter',
    'tool.sql': 'SQL Formatter',
    'tool.encode': 'Encode / Decode',
    'tool.hash': 'Hash Generator',
    'tool.jwt': 'JWT Decoder',
    'tool.md': 'Markdown Preview',
    'tool.regex': 'Regex Tester',
    'tool.diff': 'Diff Checker',
    'tool.lorem': 'Lorem Ipsum',
    'tool.uuid': 'UUID Generator',
    'tool.timestamp': 'Timestamp',
    'tool.color': 'Color Tools',
    'stat.original': 'Original',
    'stat.minified': 'Minified',
    'stat.formatted': 'Formatted',
    'stat.saved': 'Saved',
    'stat.lines': 'Lines',
    'stat.time': 'Time',
    'stat.input': 'Input',
    'stat.output': 'Output',
    'stat.length': 'Length',
    'stat.decoded': 'Decoded',
    'stat.chars': 'Chars',
    'stat.words': 'Words',
    'stat.matches': 'Matches',
    'stat.count': 'Count',
    'stat.hex': 'HEX',
    'stat.rgb': 'RGB',
    'stat.hsl': 'HSL',
    'stat.pattern': 'Pattern',
    'stat.dash': '—',
    'btn.copy': 'Copy',
    'btn.clearAll': 'Clear All',
    'btn.sample': 'Sample',
    'btn.set': 'Set',
    'btn.add': 'Add',
    'label.input': 'Input',
    'label.output': 'Output',
    'label.minified': 'Minified',
    'label.formatted': 'Formatted',
    'label.preview': 'Preview',
    'label.matches': 'Matches',
    'label.diff': 'Diff',
    'label.textA': 'Text A',
    'label.textB': 'Text B',
    'label.header': 'Header',
    'label.payload': 'Payload',
    'label.signature': 'Signature',
    'label.testString': 'Test String',
    'label.markdown': 'Markdown',
    'label.jwtToken': 'JWT Token',
    'label.uuids': 'UUIDs',
    'label.ts2date': 'Timestamp → Date',
    'label.date2ts': 'Date → Timestamp',
    'label.now': 'Now',
    'opt.comments': 'Comments',
    'opt.whitespace': 'Whitespace',
    'opt.colors': 'Colors',
    'opt.zeros': 'Zeros',
    'opt.upper': 'Upper',
    'opt.format': 'Format',
    'opt.minify': 'Minify',
    'ph.css': 'Paste CSS here...',
    'ph.html': 'Paste HTML here...',
    'ph.json': 'Paste JSON here...',
    'ph.sql': 'Paste SQL here...',
    'ph.encode': 'Text to encode / decode...',
    'ph.hash': 'Text to hash...',
    'ph.jwt': 'Paste JWT token...',
    'ph.md': 'Write Markdown...',
    'ph.regex': 'Test string...',
    'ph.diffA': 'Original text...',
    'ph.diffB': 'Modified text...',
    'ph.lorem': 'Click a button to generate...',
    'ph.uuid': 'Click generate to create UUIDs...',
    'ph.ts': 'Unix timestamp',
    'ph.pattern': 'Pattern (e.g. \\d+)',
    'enc.b64-enc': 'Base64 →',
    'enc.b64-dec': '← Base64',
    'enc.url-enc': 'URL →',
    'enc.url-dec': '← URL',
    'enc.uni-enc': 'Unicode →',
    'enc.uni-dec': '← Unicode',
    'lorem.p1': '1 Paragraph',
    'lorem.p3': '3 Paragraphs',
    'lorem.p5': '5 Paragraphs',
    'lorem.s10': '10 Sentences',
    'lorem.w50': '50 Words',
    'uuid.gen5': 'Generate 5',
    'uuid.gen10': 'Generate 10',
    'uuid.gen20': 'Generate 20',
    'msg.copied': 'Copied!',
    'msg.noMatches': 'No matches',
    'msg.invalidJson': 'Invalid JSON',
    'msg.invalidJwt': 'Invalid JWT',
    'msg.invalidRegex': 'Invalid regex',
    'msg.invalidUrl': 'Invalid URL',
    'msg.invalidTs': 'Invalid timestamp',
    'msg.dropCss': 'Drop .css file',
    'msg.empty': '—'
  },
  zh: {
    title: '开发者工具',
    'group.code': '代码',
    'group.encoding': '编码',
    'group.text': '文本',
    'group.utility': '工具',
    'tool.css': 'CSS 压缩',
    'tool.html': 'HTML 压缩',
    'tool.json': 'JSON 格式化',
    'tool.sql': 'SQL 格式化',
    'tool.encode': '编码转换',
    'tool.hash': '哈希生成',
    'tool.jwt': 'JWT 解码',
    'tool.md': 'Markdown 预览',
    'tool.regex': '正则测试',
    'tool.diff': '文本对比',
    'tool.lorem': '占位文本',
    'tool.uuid': 'UUID 生成',
    'tool.timestamp': '时间戳',
    'tool.color': '颜色工具',
    'stat.original': '原始',
    'stat.minified': '压缩后',
    'stat.formatted': '格式化',
    'stat.saved': '节省',
    'stat.lines': '行数',
    'stat.time': '耗时',
    'stat.input': '输入',
    'stat.output': '输出',
    'stat.length': '长度',
    'stat.decoded': '解码',
    'stat.chars': '字符',
    'stat.words': '词数',
    'stat.matches': '匹配',
    'stat.count': '数量',
    'stat.hex': 'HEX',
    'stat.rgb': 'RGB',
    'stat.hsl': 'HSL',
    'stat.pattern': '模式',
    'stat.dash': '—',
    'btn.copy': '复制',
    'btn.clearAll': '全部清空',
    'btn.sample': '示例',
    'btn.set': '设为',
    'btn.add': '添加',
    'label.input': '输入',
    'label.output': '输出',
    'label.minified': '压缩结果',
    'label.formatted': '格式化结果',
    'label.preview': '预览',
    'label.matches': '匹配',
    'label.diff': '差异',
    'label.textA': '文本 A',
    'label.textB': '文本 B',
    'label.header': '头部',
    'label.payload': '载荷',
    'label.signature': '签名',
    'label.testString': '测试文本',
    'label.markdown': 'Markdown',
    'label.jwtToken': 'JWT 令牌',
    'label.uuids': 'UUID 列表',
    'label.ts2date': '时间戳 → 日期',
    'label.date2ts': '日期 → 时间戳',
    'label.now': '当前时间',
    'opt.comments': '注释',
    'opt.whitespace': '空白',
    'opt.colors': '颜色',
    'opt.zeros': '零值',
    'opt.upper': '大写',
    'opt.format': '格式化',
    'opt.minify': '压缩',
    'ph.css': '粘贴 CSS...',
    'ph.html': '粘贴 HTML...',
    'ph.json': '粘贴 JSON...',
    'ph.sql': '粘贴 SQL...',
    'ph.encode': '输入编码 / 解码文本...',
    'ph.hash': '输入要哈希的文本...',
    'ph.jwt': '粘贴 JWT 令牌...',
    'ph.md': '编写 Markdown...',
    'ph.regex': '输入测试文本...',
    'ph.diffA': '原文...',
    'ph.diffB': '修改后...',
    'ph.lorem': '点击按钮生成...',
    'ph.uuid': '点击生成 UUID...',
    'ph.ts': 'Unix 时间戳',
    'ph.pattern': '模式 (如 \\d+)',
    'enc.b64-enc': 'Base64 编码 →',
    'enc.b64-dec': '← Base64 解码',
    'enc.url-enc': 'URL 编码 →',
    'enc.url-dec': '← URL 解码',
    'enc.uni-enc': 'Unicode 编码 →',
    'enc.uni-dec': '← Unicode 解码',
    'lorem.p1': '1 段落',
    'lorem.p3': '3 段落',
    'lorem.p5': '5 段落',
    'lorem.s10': '10 句子',
    'lorem.w50': '50 词',
    'uuid.gen5': '生成 5 个',
    'uuid.gen10': '生成 10 个',
    'uuid.gen20': '生成 20 个',
    'msg.copied': '已复制！',
    'msg.noMatches': '无匹配',
    'msg.invalidJson': 'JSON 无效',
    'msg.invalidJwt': 'JWT 无效',
    'msg.invalidRegex': '正则无效',
    'msg.invalidUrl': 'URL 无效',
    'msg.invalidTs': '时间戳无效',
    'msg.dropCss': '拖放 .css 文件',
    'msg.empty': '—'
  }
}
const t = useT(copy)

// ---------- 工具分组 ----------
const GROUPS = [
  { id: 'code', tools: ['css', 'html', 'json', 'sql'] },
  { id: 'encoding', tools: ['encode', 'hash', 'jwt'] },
  { id: 'text', tools: ['md', 'regex', 'diff'] },
  { id: 'utility', tools: ['lorem', 'uuid', 'timestamp', 'color'] }
]

// ---------- 每个工具的统计标签配置 ----------
const TOOL_STATS = {
  css: ['stat.original', 'stat.minified', 'stat.saved', 'stat.time'],
  html: ['stat.original', 'stat.minified', 'stat.saved', 'stat.time'],
  json: ['stat.original', 'stat.formatted', 'stat.lines', 'stat.time'],
  sql: ['stat.original', 'stat.formatted', 'stat.lines', 'stat.time'],
  encode: ['stat.input', 'stat.output', 'stat.length', 'stat.dash'],
  hash: ['stat.input', 'stat.dash', 'stat.dash', 'stat.dash'],
  jwt: ['stat.input', 'stat.decoded', 'stat.dash', 'stat.dash'],
  md: ['stat.chars', 'stat.words', 'stat.lines', 'stat.dash'],
  regex: ['stat.pattern', 'stat.matches', 'stat.dash', 'stat.dash'],
  diff: ['stat.lines', 'stat.lines', 'stat.dash', 'stat.dash'],
  lorem: ['stat.length', 'stat.count', 'stat.dash', 'stat.dash'],
  uuid: ['stat.count', 'stat.dash', 'stat.dash', 'stat.dash'],
  timestamp: ['stat.dash', 'stat.dash', 'stat.dash', 'stat.dash'],
  color: ['stat.hex', 'stat.rgb', 'stat.hsl', 'stat.dash']
}

// ---------- SQL 关键字（用于格式化） ----------
const SQL_KW = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN',
  'INNER JOIN', 'ON', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'INSERT INTO',
  'VALUES', 'UPDATE', 'SET', 'DELETE FROM']

// ---------- Lorem 词库 ----------
const LOREM_WORDS = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor ' +
  'incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ' +
  'ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure in reprehenderit ' +
  'voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non ' +
  'proident sunt in culpa qui officia deserunt mollit anim id est laborum').split(' ')

// ---------- 编码按钮配置 ----------
const ENCODE_MODES = [
  { mode: 'b64-enc', label: 'enc.b64-enc' },
  { mode: 'b64-dec', label: 'enc.b64-dec' },
  { mode: 'url-enc', label: 'enc.url-enc' },
  { mode: 'url-dec', label: 'enc.url-dec' },
  { mode: 'uni-enc', label: 'enc.uni-enc' },
  { mode: 'uni-dec', label: 'enc.uni-dec' }
]

// ---------- Lorem 按钮配置 ----------
const LOREM_BUTTONS = [
  { type: 'p', n: 1, label: 'lorem.p1' },
  { type: 'p', n: 3, label: 'lorem.p3' },
  { type: 'p', n: 5, label: 'lorem.p5' },
  { type: 's', n: 10, label: 'lorem.s10' },
  { type: 'w', n: 50, label: 'lorem.w50' }
]

// ---------- UUID 按钮配置 ----------
const UUID_BUTTONS = [
  { n: 5, label: 'uuid.gen5' },
  { n: 10, label: 'uuid.gen10' },
  { n: 20, label: 'uuid.gen20' }
]

// ---------- 示例数据 ----------
const SAMPLES = {
  en: {
    css: 'body{margin:0;padding:0;font-family:sans-serif;background:#fff;color:#333}\n.container{max-width:1200px;margin:0 auto;padding:2rem 1.5rem}\n.header{background:linear-gradient(135deg,#aabbcc,#112233);padding:1rem;border-radius:8px}\n.btn-primary{display:inline-block;background:#3b82f6;color:#fff;padding:.5rem 1rem;border-radius:6px;border:0 solid transparent;font-weight:600}',
    html: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Hello</title>\n</head>\n<body>\n  <h1>Hello</h1>\n  <p>A <strong>sample</strong> page.</p>\n  <!-- remove me -->\n  <ul>\n    <li>A</li>\n    <li>B</li>\n  </ul>\n</body>\n</html>',
    json: JSON.stringify({ name: 'OpenKee', tools: ['Rate Board', 'Crypto Board'], stats: { total: 17, active: true }, config: { theme: 'dark', features: { offline: false } } }),
    sql: "SELECT u.id, u.name, COUNT(o.id) as orders FROM users u LEFT JOIN orders o ON u.id = o.user_id WHERE u.status = 'active' AND u.created_at > '2025-01-01' GROUP BY u.id, u.name HAVING COUNT(o.id) > 5 ORDER BY orders DESC LIMIT 20;",
    md: '# Dev Tools\n\nA collection of **browser-based** utilities.\n\n## Features\n\n- CSS Compressor\n- JSON Formatter\n- Encode / Decode\n\n### Why?\n\n> Every tool runs in your browser.\n\n```js\nconst tool = "dev-tools";\n```\n\n---\n\n| Tool | Status |\n|------|--------|\n| CSS | ✅ |\n| JSON | ✅ |'
  },
  zh: {
    css: 'body{margin:0;padding:0;font-family:sans-serif;background:#fff;color:#333}\n.container{max-width:1200px;margin:0 auto;padding:2rem 1.5rem}\n.header{background:linear-gradient(135deg,#aabbcc,#112233);padding:1rem;border-radius:8px}\n.btn-primary{display:inline-block;background:#3b82f6;color:#fff;padding:.5rem 1rem;border-radius:6px;border:0 solid transparent;font-weight:600}',
    html: '<!DOCTYPE html>\n<html lang="zh">\n<head>\n  <meta charset="UTF-8">\n  <title>你好</title>\n</head>\n<body>\n  <h1>你好</h1>\n  <p>一个 <strong>示例</strong> 页面。</p>\n  <!-- 删除我 -->\n  <ul>\n    <li>A</li>\n    <li>B</li>\n  </ul>\n</body>\n</html>',
    json: JSON.stringify({ 名称: 'OpenKee', 工具: ['汇率看板', '加密看板'], 统计: { 总数: 17, 启用: true }, 配置: { 主题: 'dark', 功能: { 离线: false } } }),
    sql: "SELECT u.id, u.name, COUNT(o.id) as orders FROM users u LEFT JOIN orders o ON u.id = o.user_id WHERE u.status = 'active' AND u.created_at > '2025-01-01' GROUP BY u.id, u.name HAVING COUNT(o.id) > 5 ORDER BY orders DESC LIMIT 20;",
    md: '# 开发者工具\n\n一组 **浏览器端** 实用工具。\n\n## 功能\n\n- CSS 压缩\n- JSON 格式化\n- 编码转换\n\n### 为什么？\n\n> 所有工具都在浏览器中运行。\n\n```js\nconst tool = "dev-tools";\n```\n\n---\n\n| 工具 | 状态 |\n|------|--------|\n| CSS | ✅ |\n| JSON | ✅ |'
  }
}

// ---------- 响应式状态：当前工具 + 各工具输入/输出 ----------
const currentTool = ref('css')

const state = reactive({
  css: { input: '', options: { comments: true, whitespace: true, colors: true, zeros: true } },
  html: { input: '' },
  json: { input: '', mode: 'format' },
  sql: { input: '' },
  encode: { input: '', output: '', error: false },
  hash: { input: '' },
  jwt: { input: '' },
  md: { input: '' },
  regex: { pattern: '', flags: 'g', test: '' },
  diff: { a: '', b: '' },
  lorem: { output: '', stats: ['—', '—', '—', '—'] },
  uuid: { output: '', upper: false, stats: ['—', '—', '—', '—'] },
  timestamp: { tsInput: '', dateInput: '', tsDateOut: null, tsOut: null, tsNow: null },
  color: { picker: '#3b82f6', hex: '#3b82f6', hexVal: '—', rgbVal: '—', hslVal: '—' }
})

// CSS 拖放区激活态
const cssDropActive = ref(false)

// ---------- Toast 提示 ----------
const toast = reactive({ show: false, msg: '' })
let toastTimer = null
function showToast(msg) {
  toast.msg = msg
  toast.show = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.show = false }, 2000)
}

// 复制到剪贴板（带降级方案）
function copyToClipboard(text) {
  if (!text || text === '—') return
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => showToast(t.value('msg.copied')),
      () => fallbackCopy(text)
    )
  } else {
    fallbackCopy(text)
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  try { document.execCommand('copy'); showToast(t.value('msg.copied')) } catch (e) { /* 忽略 */ }
  document.body.removeChild(ta)
}

// ---------- 通用工具函数 ----------
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  return (bytes / 1024).toFixed(1) + ' KB'
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// UTF-8 安全的 Base64 编解码
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  bytes.forEach(b => { binary += String.fromCharCode(b) })
  return btoa(binary)
}

function base64ToUtf8(b64) {
  const binary = atob(b64)
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

// base64url 安全解码（JWT 用）
function b64urlDecode(s) {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='
  const binary = atob(b64)
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

// ---------- 1. CSS 压缩 ----------
const cssResult = computed(() => {
  const v = state.css.input
  if (!v.trim()) return { output: '', stats: ['—', '—', '—', '—'], green: [false, false, false, false] }
  const t0 = performance.now()
  let r = v
  const o = state.css.options
  // 去注释
  if (o.comments) r = r.replace(/\/\*[\s\S]*?\*\//g, '')
  // 去空白
  if (o.whitespace) {
    r = r.replace(/\s+/g, ' ')
    r = r.replace(/\s*\{\s*/g, '{').replace(/\s*\}\s*/g, '}')
    r = r.replace(/\s*;\s*/g, ';').replace(/\s*:\s*/g, ':')
    r = r.replace(/\s*,\s*/g, ',').replace(/;\}/g, '}')
    r = r.trim()
  }
  // 压缩颜色
  if (o.colors) {
    r = r.replace(/#([0-9a-fA-F])\1([0-9a-fA-F])\2([0-9a-fA-F])\3/g, '#$1$2$3')
    r = r.replace(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g, (_, R, g, b) => {
      R = parseInt(R); g = parseInt(g); b = parseInt(b)
      if (R > 255 || g > 255 || b > 255) return _
      const h = '#' + [R, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
      return h[1] === h[2] && h[3] === h[4] && h[5] === h[6] ? '#' + h[1] + h[3] + h[5] : h
    })
  }
  // 去零值单位
  if (o.zeros) {
    r = r.replace(/:0(px|em|rem|vh|vw|%|pt|pc|in|mm|cm|ex|ch|lh)/g, ':0')
    r = r.replace(/ 0\.(\d+)/g, ' .$1')
    r = r.replace(/:0\.(\d+)/g, ':.$1')
  }
  const ms = (performance.now() - t0).toFixed(1)
  const os = new Blob([v]).size, ns = new Blob([r]).size
  const saved = os ? ((1 - ns / os) * 100).toFixed(1) + '%' : '0%'
  return { output: r, stats: [formatSize(os), formatSize(ns), saved, ms + 'ms'], green: [false, false, true, false] }
})

// ---------- 2. HTML 压缩 ----------
const htmlResult = computed(() => {
  const v = state.html.input
  if (!v.trim()) return { output: '', stats: ['—', '—', '—', '—'], green: [false, false, false, false] }
  const t0 = performance.now()
  const r = v.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><').replace(/\s+>/g, '>').replace(/<\s+/g, '<').trim()
  const ms = (performance.now() - t0).toFixed(1)
  const os = new Blob([v]).size, ns = new Blob([r]).size
  const saved = os ? ((1 - ns / os) * 100).toFixed(1) + '%' : '0%'
  return { output: r, stats: [formatSize(os), formatSize(ns), saved, ms + 'ms'], green: [false, false, true, false] }
})

// ---------- 3. JSON 格式化 ----------
const jsonResult = computed(() => {
  const v = state.json.input
  if (!v.trim()) return { output: '', stats: ['—', '—', '—', '—'], green: [false, false, false, false], error: false }
  const t0 = performance.now()
  try {
    const parsed = JSON.parse(v)
    const output = state.json.mode === 'minify' ? JSON.stringify(parsed) : JSON.stringify(parsed, null, 2)
    const ms = (performance.now() - t0).toFixed(1)
    const lines = output.split('\n').length
    return { output, stats: [formatSize(new Blob([v]).size), formatSize(new Blob([output]).size), lines, ms + 'ms'], green: [false, false, false, false], error: false }
  } catch (e) {
    return { output: t.value('msg.invalidJson') + ': ' + e.message, stats: [formatSize(new Blob([v]).size), '—', '—', '—'], green: [false, false, false, false], error: true }
  }
})

// ---------- 4. SQL 格式化 ----------
const sqlResult = computed(() => {
  const v = state.sql.input
  if (!v.trim()) return { output: '', stats: ['—', '—', '—', '—'], green: [false, false, false, false] }
  const t0 = performance.now()
  let r = v.replace(/\s+/g, ' ').trim()
  for (const k of SQL_KW.sort((a, b) => b.length - a.length)) {
    r = r.replace(new RegExp('\\b' + k.replace(/ /g, '\\s+') + '\\b', 'gi'), '\n' + k)
  }
  const ms = (performance.now() - t0).toFixed(1)
  const out = r.trim()
  const lines = out.split('\n').length
  return { output: out, stats: [formatSize(new Blob([v]).size), formatSize(new Blob([out]).size), lines, ms + 'ms'], green: [false, false, false, false] }
})

// ---------- 5. 编码转换 ----------
function encodeDecode(mode) {
  const input = state.encode.input
  if (!input) { state.encode.output = ''; state.encode.error = false; return }
  let output = ''
  try {
    switch (mode) {
      case 'b64-enc': output = utf8ToBase64(input); break
      case 'b64-dec': output = base64ToUtf8(input); break
      case 'url-enc': output = encodeURIComponent(input); break
      case 'url-dec': output = decodeURIComponent(input); break
      case 'uni-enc':
        output = Array.from(input).map(c => {
          const code = c.charCodeAt(0)
          return code > 127 ? '\\u' + code.toString(16).padStart(4, '0') : c
        }).join('')
        break
      case 'uni-dec':
        output = input.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        break
    }
    state.encode.output = output
    state.encode.error = false
  } catch (e) {
    state.encode.output = t.value('msg.invalidUrl') + ': ' + e.message
    state.encode.error = true
  }
}

const encodeResult = computed(() => ({
  output: state.encode.output,
  stats: state.encode.output ? [state.encode.input.length, state.encode.output.length, '—', '—'] : ['—', '—', '—', '—'],
  green: [false, false, false, false],
  error: state.encode.error
}))

// ---------- 6. 哈希生成（异步：依赖 crypto.subtle） ----------
const hashResult = ref({ sha1: '—', sha256: '—', sha512: '—', stats: ['—', '—', '—', '—'] })

async function runHash() {
  const v = state.hash.input
  if (!v) {
    hashResult.value = { sha1: '—', sha256: '—', sha512: '—', stats: ['—', '—', '—', '—'] }
    return
  }
  const enc = new TextEncoder().encode(v)
  const algs = [['SHA-1', 'sha1'], ['SHA-256', 'sha256'], ['SHA-512', 'sha512']]
  const out = { sha1: '—', sha256: '—', sha512: '—', stats: [v.length, '—', '—', '—'] }
  for (const [name, key] of algs) {
    try {
      const buf = await crypto.subtle.digest(name, enc)
      out[key] = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
    } catch (e) { /* 忽略 */ }
  }
  hashResult.value = out
}

// 输入变化时重新计算哈希
watch(() => state.hash.input, () => { runHash() })

// ---------- 7. JWT 解码 ----------
const jwtResult = computed(() => {
  const v = state.jwt.input.trim()
  if (!v) return { header: '—', payload: '—', sig: '—', error: false, stats: ['—', '—', '—', '—'] }
  try {
    const parts = v.split('.')
    if (parts.length < 2) throw new Error('Invalid format')
    const header = JSON.parse(b64urlDecode(parts[0]))
    const payload = JSON.parse(b64urlDecode(parts[1]))
    return {
      header: JSON.stringify(header, null, 2),
      payload: JSON.stringify(payload, null, 2),
      sig: parts[2] || '(none)',
      error: false,
      stats: [v.length, '—', '—', '—']
    }
  } catch (e) {
    return { header: t.value('msg.invalidJwt') + ': ' + e.message, payload: '', sig: '', error: true, stats: [v.length, '—', '—', '—'] }
  }
})

// ---------- 8. Markdown 预览 ----------
// 行内元素解析（转义后替换）
function parseInline(text) {
  let s = escapeHtml(text)
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>')
  s = s.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
  return s
}

const mdResult = computed(() => {
  const raw = state.md.input
  if (!raw.trim()) return { html: '', stats: ['—', '—', '—', '—'] }
  const lines = raw.replace(/\r\n?/g, '\n').split('\n')
  const out = []
  let i = 0
  const n = lines.length
  while (i < n) {
    const line = lines[i]
    // 代码块
    if (/^```/.test(line)) {
      const code = []
      i++
      while (i < n && !/^```/.test(lines[i])) { code.push(lines[i]); i++ }
      i++
      out.push('<pre><code>' + escapeHtml(code.join('\n')) + '</code></pre>')
      continue
    }
    // 空行
    if (/^\s*$/.test(line)) { i++; continue }
    // 标题
    const h = line.match(/^(#{1,3})\s+(.+)$/)
    if (h) {
      const lvl = h[1].length
      out.push('<h' + lvl + '>' + parseInline(h[2]) + '</h' + lvl + '>')
      i++; continue
    }
    // 分隔线
    if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; continue }
    // 表格
    if (line.includes('|') && i + 1 < n && /^\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && /[-:]/.test(lines[i + 1])) {
      const header = line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
      i += 2
      const bodyRows = []
      while (i < n && lines[i].includes('|') && lines[i].trim()) {
        bodyRows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()))
        i++
      }
      let table = '<table><thead><tr>'
      header.forEach(c => { table += '<th>' + parseInline(c) + '</th>' })
      table += '</tr></thead><tbody>'
      bodyRows.forEach(row => {
        table += '<tr>'
        header.forEach((_, j) => { table += '<td>' + parseInline(row[j] || '') + '</td>' })
        table += '</tr>'
      })
      table += '</tbody></table>'
      out.push(table)
      continue
    }
    // 引用块
    if (/^>\s?/.test(line)) {
      const quote = []
      while (i < n && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      out.push('<blockquote>' + parseInline(quote.join(' ')) + '</blockquote>')
      continue
    }
    // 无序列表
    if (/^[-*]\s+/.test(line)) {
      const items = []
      while (i < n && /^[-*]\s+/.test(lines[i])) {
        items.push('<li>' + parseInline(lines[i].replace(/^[-*]\s+/, '')) + '</li>')
        i++
      }
      out.push('<ul>' + items.join('') + '</ul>')
      continue
    }
    // 段落
    const para = []
    while (i < n && !/^\s*$/.test(lines[i]) && !/^```/.test(lines[i]) &&
      !/^#{1,3}\s/.test(lines[i]) && !/^[-*]\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) && !/^---+\s*$/.test(lines[i])) {
      para.push(lines[i])
      i++
    }
    if (para.length) out.push('<p>' + parseInline(para.join(' ')) + '</p>')
  }
  const chars = raw.length
  const words = (raw.match(/\S+/g) || []).length
  const lineCount = raw.split('\n').length
  return { html: out.join('\n'), stats: [chars, words, lineCount, '—'] }
})

// ---------- 9. 正则测试 ----------
const regexResult = computed(() => {
  const p = state.regex.pattern
  const f = state.regex.flags
  const input = state.regex.test
  if (!p || !input) return { matches: [], error: false, errorMsg: '', noMatches: false, empty: true, stats: ['—', '—', '—', '—'] }
  try {
    const re = new RegExp(p, f)
    const matches = Array.from(input.matchAll(re))
    if (!matches.length) return { matches: [], error: false, errorMsg: '', noMatches: true, empty: false, stats: [p, '0', '—', '—'] }
    return {
      matches: matches.map((m, i) => ({ num: i + 1, val: m[0], idx: m.index })),
      error: false, errorMsg: '', noMatches: false, empty: false,
      stats: [p, matches.length, '—', '—']
    }
  } catch (e) {
    return { matches: [], error: true, errorMsg: t.value('msg.invalidRegex') + ': ' + e.message, noMatches: false, empty: false, stats: [p, '—', '—', '—'] }
  }
})

// ---------- 10. 文本对比 ----------
const diffResult = computed(() => {
  const a = state.diff.a.split('\n')
  const b = state.diff.b.split('\n')
  const out = []
  const mx = Math.max(a.length, b.length)
  let diffCount = 0
  for (let i = 0; i < mx; i++) {
    if (a[i] === undefined) {
      out.push({ type: 'add', text: b[i] })
      diffCount++
    } else if (b[i] === undefined) {
      out.push({ type: 'del', text: a[i] })
      diffCount++
    } else if (a[i] !== b[i]) {
      out.push({ type: 'del', text: a[i] })
      out.push({ type: 'add', text: b[i] })
      diffCount++
    } else {
      out.push({ type: 'same', text: a[i] })
    }
  }
  return { lines: out, stats: [a.length, b.length, diffCount, '—'] }
})

// ---------- 11. Lorem Ipsum ----------
function genLorem(type, n) {
  let result = ''
  const randWord = () => LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)]
  if (type === 'p') {
    for (let i = 0; i < n; i++) {
      const sentences = 3 + Math.floor(Math.random() * 3)
      for (let j = 0; j < sentences; j++) {
        const wc = 8 + Math.floor(Math.random() * 12)
        const words = []
        for (let k = 0; k < wc; k++) words.push(randWord())
        let s = words.join(' ')
        s = s.charAt(0).toUpperCase() + s.slice(1) + '. '
        result += s
      }
      result += '\n\n'
    }
  } else if (type === 's') {
    for (let i = 0; i < n; i++) {
      const wc = 8 + Math.floor(Math.random() * 12)
      const words = []
      for (let k = 0; k < wc; k++) words.push(randWord())
      let s = words.join(' ')
      s = s.charAt(0).toUpperCase() + s.slice(1) + '. '
      result += s
    }
  } else if (type === 'w') {
    const words = []
    for (let i = 0; i < n; i++) words.push(randWord())
    result = words.join(' ')
  }
  state.lorem.output = result.trim()
  state.lorem.stats = [result.length, n, '—', '—']
}

const loremResult = computed(() => ({
  output: state.lorem.output,
  stats: state.lorem.stats
}))

// ---------- 12. UUID 生成 ----------
function genUuid(n) {
  const upper = state.uuid.upper
  const uuids = []
  for (let i = 0; i < n; i++) {
    let v = crypto.randomUUID()
    if (upper) v = v.toUpperCase()
    uuids.push(v)
  }
  state.uuid.output = uuids.join('\n')
  state.uuid.stats = [n, '—', '—', '—']
}

const uuidResult = computed(() => ({
  output: state.uuid.output,
  stats: state.uuid.stats
}))

// ---------- 13. 时间戳转换 ----------
function tsToDate() {
  const v = state.timestamp.tsInput.trim()
  const n = parseInt(v)
  if (!n) { state.timestamp.tsDateOut = null; return }
  const d = new Date(v.length > 10 ? n : n * 1000)
  if (isNaN(d.getTime())) { state.timestamp.tsDateOut = null; return }
  state.timestamp.tsDateOut = { iso: d.toISOString(), local: d.toLocaleString(locale()) }
}

function dateToTs() {
  const v = state.timestamp.dateInput
  if (!v) { state.timestamp.tsOut = null; return }
  const d = new Date(v)
  if (isNaN(d.getTime())) { state.timestamp.tsOut = null; return }
  state.timestamp.tsOut = { seconds: Math.floor(d.getTime() / 1000), ms: d.getTime() }
}

function setNow() {
  const d = new Date()
  state.timestamp.tsNow = { iso: d.toISOString(), unix: Math.floor(d.getTime() / 1000) }
}

// ---------- 14. 颜色工具 ----------
function updateColor(hex, source) {
  hex = String(hex || '').trim().replace(/[^#0-9a-fA-F]/g, '')
  if (!hex.startsWith('#')) hex = '#' + hex
  // 3 位简写展开
  if (hex.length === 4) {
    hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return
  hex = hex.toLowerCase()
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  state.color.hexVal = hex
  state.color.rgbVal = 'rgb(' + r + ', ' + g + ', ' + b + ')'
  // HSL 转换
  const rn = r / 255, gn = g / 255, bn = b / 255
  const mx = Math.max(rn, gn, bn), mn = Math.min(rn, gn, bn)
  const l = (mx + mn) / 2
  let h = 0, s = 0
  if (mx !== mn) {
    const d = mx - mn
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
    if (mx === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60
    else if (mx === gn) h = ((bn - rn) / d + 2) * 60
    else h = ((rn - gn) / d + 4) * 60
  }
  state.color.hslVal = 'hsl(' + Math.round(h) + ', ' + Math.round(s * 100) + '%, ' + Math.round(l * 100) + '%)'
  // 同步另一个输入框
  if (source !== 'picker') state.color.picker = hex
  if (source !== 'hex') state.color.hex = hex
}

const colorResult = computed(() => ({
  stats: [state.color.hexVal, state.color.rgbVal, state.color.hslVal, '—']
}))

// ---------- 当前工具结果聚合 ----------
const currentResult = computed(() => {
  switch (currentTool.value) {
    case 'css': return cssResult.value
    case 'html': return htmlResult.value
    case 'json': return jsonResult.value
    case 'sql': return sqlResult.value
    case 'encode': return encodeResult.value
    case 'hash': return { stats: hashResult.value.stats }
    case 'jwt': return { stats: jwtResult.value.stats }
    case 'md': return mdResult.value
    case 'regex': return { stats: regexResult.value.stats }
    case 'diff': return { stats: diffResult.value.stats }
    case 'lorem': return loremResult.value
    case 'uuid': return uuidResult.value
    case 'timestamp': return { stats: ['—', '—', '—', '—'] }
    case 'color': return colorResult.value
    default: return { stats: ['—', '—', '—', '—'] }
  }
})

// 统计标签（随工具变化）
const statLabels = computed(() => {
  const keys = TOOL_STATS[currentTool.value] || TOOL_STATS.css
  return keys.map(k => t.value(k))
})

// 统计数值
const statValues = computed(() => currentResult.value.stats || ['—', '—', '—', '—'])
// 统计高亮（绿色）
const statGreen = computed(() => currentResult.value.green || [false, false, false, false])

// ---------- 工具切换 ----------
function switchTool(toolId) {
  currentTool.value = toolId
  // 切换到时间戳时刷新"当前时间"
  if (toolId === 'timestamp') setNow()
}

// ---------- 加载示例 ----------
function loadSample(tool) {
  const samples = SAMPLES[i18nState.lang] || SAMPLES.en
  switch (tool) {
    case 'css': state.css.input = samples.css; break
    case 'html': state.html.input = samples.html; break
    case 'json': state.json.input = samples.json; break
    case 'sql': state.sql.input = samples.sql; break
    case 'md': state.md.input = samples.md; break
  }
}

// ---------- 清空当前工具 ----------
function clearCurrentTool() {
  const tool = currentTool.value
  switch (tool) {
    case 'css': state.css.input = ''; break
    case 'html': state.html.input = ''; break
    case 'json': state.json.input = ''; break
    case 'sql': state.sql.input = ''; break
    case 'encode': state.encode.input = ''; state.encode.output = ''; state.encode.error = false; break
    case 'hash': state.hash.input = ''; break
    case 'jwt': state.jwt.input = ''; break
    case 'md': state.md.input = ''; break
    case 'regex': state.regex.pattern = ''; state.regex.test = ''; break
    case 'diff': state.diff.a = ''; state.diff.b = ''; break
    case 'lorem': state.lorem.output = ''; state.lorem.stats = ['—', '—', '—', '—']; break
    case 'uuid': state.uuid.output = ''; state.uuid.stats = ['—', '—', '—', '—']; break
    case 'timestamp':
      state.timestamp.tsInput = ''
      state.timestamp.dateInput = ''
      state.timestamp.tsDateOut = null
      state.timestamp.tsOut = null
      state.timestamp.tsNow = null
      break
    case 'color':
      state.color.picker = '#3b82f6'
      state.color.hex = '#3b82f6'
      updateColor('#3b82f6')
      break
  }
}

// ---------- JWT 复制载荷 ----------
function copyJwtPayload() {
  copyToClipboard(jwtResult.value.payload)
}

// ---------- CSS 拖放上传 ----------
function onCssDragOver(e) {
  e.preventDefault()
  cssDropActive.value = true
}
function onCssDragLeave(e) {
  if (e.target === e.currentTarget) cssDropActive.value = false
}
function onCssDrop(e) {
  e.preventDefault()
  cssDropActive.value = false
  const f = e.dataTransfer.files[0]
  if (f && (f.type === 'text/css' || f.name.endsWith('.css'))) {
    const r = new FileReader()
    r.onload = () => { state.css.input = r.result }
    r.readAsText(f)
  }
}

// ---------- 初始化 ----------
onMounted(() => {
  // 初始化颜色工具的值
  updateColor('#3b82f6')
})
</script>

<template>
  <div class="dev-app">
    <AppHeader :title="t('title')" />

    <!-- 应用主体：侧边栏 + 主区域 -->
    <div class="app">
      <!-- 侧边栏：工具列表 -->
      <aside class="sidebar" aria-label="Tools navigation">
        <div v-for="g in GROUPS" :key="g.id" class="sidebar-group">
          <div class="sidebar-label">{{ t('group.' + g.id) }}</div>
          <button
            v-for="tid in g.tools"
            :key="tid"
            class="tool-tab"
            :class="{ active: currentTool === tid }"
            type="button"
            @click="switchTool(tid)"
          >{{ t('tool.' + tid) }}</button>
        </div>
      </aside>

      <!-- 主区域 -->
      <main class="main">
        <!-- 统计栏：4 个指标，标签随工具变化 -->
        <div class="stats-bar">
          <div v-for="(v, i) in statValues" :key="i" class="stat">
            <div class="v" :class="{ green: statGreen[i] }">{{ v }}</div>
            <div class="l">{{ statLabels[i] }}</div>
          </div>
        </div>

        <!-- 工具面板区 -->
        <div class="panels">
          <!-- 1. CSS 压缩 -->
          <section v-if="currentTool === 'css'" class="tool-panel">
            <div class="dual-grid">
              <div class="pane pane-input">
                <div class="pane-head">
                  <span>{{ t('label.input') }}</span>
                  <div class="pane-actions">
                    <button class="mini-btn" type="button" @click="loadSample('css')">{{ t('btn.sample') }}</button>
                    <button class="mini-btn" type="button" @click="state.css.input = ''">{{ t('btn.clearAll') }}</button>
                  </div>
                </div>
                <div
                  class="pane-body"
                  @dragover="onCssDragOver"
                  @dragleave="onCssDragLeave"
                  @drop="onCssDrop"
                >
                  <textarea v-model="state.css.input" :placeholder="t('ph.css')" spellcheck="false"></textarea>
                  <div class="drop-zone" :class="{ active: cssDropActive }">{{ t('msg.dropCss') }}</div>
                </div>
              </div>
              <div class="pane pane-output">
                <div class="pane-head">
                  <span>{{ t('label.minified') }}</span>
                  <div class="pane-actions">
                    <button class="mini-btn" type="button" @click="copyToClipboard(cssResult.output)">{{ t('btn.copy') }}</button>
                  </div>
                </div>
                <textarea :value="cssResult.output" readonly></textarea>
              </div>
            </div>
          </section>

          <!-- 2. HTML 压缩 -->
          <section v-else-if="currentTool === 'html'" class="tool-panel">
            <div class="dual-grid">
              <div class="pane pane-input">
                <div class="pane-head">
                  <span>{{ t('label.input') }}</span>
                  <div class="pane-actions">
                    <button class="mini-btn" type="button" @click="loadSample('html')">{{ t('btn.sample') }}</button>
                    <button class="mini-btn" type="button" @click="state.html.input = ''">{{ t('btn.clearAll') }}</button>
                  </div>
                </div>
                <textarea v-model="state.html.input" :placeholder="t('ph.html')" spellcheck="false"></textarea>
              </div>
              <div class="pane pane-output">
                <div class="pane-head">
                  <span>{{ t('label.minified') }}</span>
                  <div class="pane-actions">
                    <button class="mini-btn" type="button" @click="copyToClipboard(htmlResult.output)">{{ t('btn.copy') }}</button>
                  </div>
                </div>
                <textarea :value="htmlResult.output" readonly></textarea>
              </div>
            </div>
          </section>

          <!-- 3. JSON 格式化 -->
          <section v-else-if="currentTool === 'json'" class="tool-panel">
            <div class="dual-grid">
              <div class="pane pane-input">
                <div class="pane-head">
                  <span>{{ t('label.input') }}</span>
                  <div class="pane-actions">
                    <button class="mini-btn" type="button" @click="loadSample('json')">{{ t('btn.sample') }}</button>
                    <button class="mini-btn" type="button" @click="state.json.input = ''">{{ t('btn.clearAll') }}</button>
                  </div>
                </div>
                <textarea v-model="state.json.input" :placeholder="t('ph.json')" spellcheck="false"></textarea>
              </div>
              <div class="pane pane-output">
                <div class="pane-head">
                  <span>{{ t('label.formatted') }}</span>
                  <div class="pane-actions">
                    <button class="mini-btn" type="button" @click="copyToClipboard(jsonResult.output)">{{ t('btn.copy') }}</button>
                  </div>
                </div>
                <textarea :value="jsonResult.output" readonly :class="{ 'error-text': jsonResult.error }"></textarea>
              </div>
            </div>
          </section>

          <!-- 4. SQL 格式化 -->
          <section v-else-if="currentTool === 'sql'" class="tool-panel">
            <div class="dual-grid">
              <div class="pane pane-input">
                <div class="pane-head">
                  <span>{{ t('label.input') }}</span>
                  <div class="pane-actions">
                    <button class="mini-btn" type="button" @click="loadSample('sql')">{{ t('btn.sample') }}</button>
                    <button class="mini-btn" type="button" @click="state.sql.input = ''">{{ t('btn.clearAll') }}</button>
                  </div>
                </div>
                <textarea v-model="state.sql.input" :placeholder="t('ph.sql')" spellcheck="false"></textarea>
              </div>
              <div class="pane pane-output">
                <div class="pane-head">
                  <span>{{ t('label.formatted') }}</span>
                  <div class="pane-actions">
                    <button class="mini-btn" type="button" @click="copyToClipboard(sqlResult.output)">{{ t('btn.copy') }}</button>
                  </div>
                </div>
                <textarea :value="sqlResult.output" readonly></textarea>
              </div>
            </div>
          </section>

          <!-- 5. 编码转换 -->
          <section v-else-if="currentTool === 'encode'" class="tool-panel">
            <div class="encode-grid">
              <div class="pane pane-input">
                <div class="pane-head"><span>{{ t('label.input') }}</span></div>
                <textarea v-model="state.encode.input" :placeholder="t('ph.encode')" spellcheck="false"></textarea>
              </div>
              <div class="encode-mid">
                <button
                  v-for="m in ENCODE_MODES"
                  :key="m.mode"
                  class="enc-btn"
                  type="button"
                  @click="encodeDecode(m.mode)"
                >{{ t(m.label) }}</button>
              </div>
              <div class="pane pane-output">
                <div class="pane-head">
                  <span>{{ t('label.output') }}</span>
                  <div class="pane-actions">
                    <button class="mini-btn" type="button" @click="copyToClipboard(state.encode.output)">{{ t('btn.copy') }}</button>
                  </div>
                </div>
                <textarea :value="state.encode.output" readonly :class="{ 'error-text': state.encode.error }"></textarea>
              </div>
            </div>
          </section>

          <!-- 6. 哈希生成 -->
          <section v-else-if="currentTool === 'hash'" class="tool-panel">
            <div class="single-pane">
              <div class="pane-head"><span>{{ t('label.input') }}</span></div>
              <textarea v-model="state.hash.input" :placeholder="t('ph.hash')" spellcheck="false"></textarea>
              <div class="hash-results">
                <div class="hash-item">
                  <span class="hash-label">SHA-1</span>
                  <code class="hash-val">{{ hashResult.sha1 }}</code>
                  <button class="mini-btn" type="button" @click="copyToClipboard(hashResult.sha1)">{{ t('btn.copy') }}</button>
                </div>
                <div class="hash-item">
                  <span class="hash-label">SHA-256</span>
                  <code class="hash-val">{{ hashResult.sha256 }}</code>
                  <button class="mini-btn" type="button" @click="copyToClipboard(hashResult.sha256)">{{ t('btn.copy') }}</button>
                </div>
                <div class="hash-item">
                  <span class="hash-label">SHA-512</span>
                  <code class="hash-val">{{ hashResult.sha512 }}</code>
                  <button class="mini-btn" type="button" @click="copyToClipboard(hashResult.sha512)">{{ t('btn.copy') }}</button>
                </div>
              </div>
            </div>
          </section>

          <!-- 7. JWT 解码 -->
          <section v-else-if="currentTool === 'jwt'" class="tool-panel">
            <div class="single-pane">
              <div class="pane-head"><span>{{ t('label.jwtToken') }}</span></div>
              <textarea v-model="state.jwt.input" :placeholder="t('ph.jwt')" spellcheck="false" class="short-area"></textarea>
              <div class="jwt-sections">
                <div class="jwt-section">
                  <div class="jwt-label">{{ t('label.header') }}</div>
                  <pre class="jwt-pre" :class="{ 'jwt-error': jwtResult.error }">{{ jwtResult.header }}</pre>
                </div>
                <div class="jwt-section">
                  <div class="jwt-label">{{ t('label.payload') }}</div>
                  <pre class="jwt-pre">{{ jwtResult.payload }}</pre>
                </div>
                <div class="jwt-section">
                  <div class="jwt-label">{{ t('label.signature') }}</div>
                  <div class="jwt-pre jwt-sig">{{ jwtResult.sig }}</div>
                </div>
              </div>
            </div>
          </section>

          <!-- 8. Markdown 预览 -->
          <section v-else-if="currentTool === 'md'" class="tool-panel">
            <div class="dual-grid">
              <div class="pane pane-input">
                <div class="pane-head">
                  <span>{{ t('label.markdown') }}</span>
                  <div class="pane-actions">
                    <button class="mini-btn" type="button" @click="loadSample('md')">{{ t('btn.sample') }}</button>
                  </div>
                </div>
                <textarea v-model="state.md.input" :placeholder="t('ph.md')" spellcheck="false"></textarea>
              </div>
              <div class="pane pane-output">
                <div class="pane-head"><span>{{ t('label.preview') }}</span></div>
                <div class="md-preview" v-html="mdResult.html"></div>
              </div>
            </div>
          </section>

          <!-- 9. 正则测试 -->
          <section v-else-if="currentTool === 'regex'" class="tool-panel">
            <div class="single-pane">
              <div class="regex-row">
                <input v-model="state.regex.pattern" class="text-input mono-input" :placeholder="t('ph.pattern')" type="text" spellcheck="false" />
                <input v-model="state.regex.flags" class="text-input mono-input regex-flags" type="text" spellcheck="false" />
              </div>
              <div class="pane-head"><span>{{ t('label.testString') }}</span></div>
              <textarea v-model="state.regex.test" :placeholder="t('ph.regex')" spellcheck="false"></textarea>
              <div class="pane-head"><span>{{ t('label.matches') }}</span></div>
              <div class="regex-results">
                <template v-if="regexResult.empty">—</template>
                <template v-else-if="regexResult.error">{{ regexResult.errorMsg }}</template>
                <template v-else-if="regexResult.noMatches">{{ t('msg.noMatches') }}</template>
                <template v-else>
                  <div v-for="m in regexResult.matches" :key="m.num" class="regex-match">
                    <span class="match-num">#{{ m.num }}</span>
                    <span class="match-val">{{ m.val }}</span>
                    <span class="match-idx">@{{ m.idx }}</span>
                  </div>
                </template>
              </div>
            </div>
          </section>

          <!-- 10. 文本对比 -->
          <section v-else-if="currentTool === 'diff'" class="tool-panel">
            <div class="diff-grid">
              <div class="pane">
                <div class="pane-head"><span>{{ t('label.textA') }}</span></div>
                <textarea v-model="state.diff.a" :placeholder="t('ph.diffA')" spellcheck="false"></textarea>
              </div>
              <div class="pane">
                <div class="pane-head"><span>{{ t('label.textB') }}</span></div>
                <textarea v-model="state.diff.b" :placeholder="t('ph.diffB')" spellcheck="false"></textarea>
              </div>
            </div>
            <div class="diff-output">
              <div class="pane-head"><span>{{ t('label.diff') }}</span></div>
              <div class="diff-result">
                <div v-for="(line, i) in diffResult.lines" :key="i" :class="'diff-' + line.type">
                  {{ line.type === 'add' ? '+ ' : line.type === 'del' ? '- ' : '  ' }}{{ line.text }}
                </div>
                <div v-if="!diffResult.lines.length">—</div>
              </div>
            </div>
          </section>

          <!-- 11. Lorem Ipsum -->
          <section v-else-if="currentTool === 'lorem'" class="tool-panel">
            <div class="single-pane">
              <div class="pane-head">
                <span>{{ t('label.output') }}</span>
                <div class="pane-actions">
                  <button class="mini-btn" type="button" @click="copyToClipboard(state.lorem.output)">{{ t('btn.copy') }}</button>
                </div>
              </div>
              <textarea :value="state.lorem.output" readonly :placeholder="t('ph.lorem')"></textarea>
            </div>
          </section>

          <!-- 12. UUID 生成 -->
          <section v-else-if="currentTool === 'uuid'" class="tool-panel">
            <div class="single-pane">
              <div class="pane-head">
                <span>{{ t('label.uuids') }}</span>
                <div class="pane-actions">
                  <button class="mini-btn" type="button" @click="copyToClipboard(state.uuid.output)">{{ t('btn.copy') }}</button>
                </div>
              </div>
              <textarea :value="state.uuid.output" readonly :placeholder="t('ph.uuid')"></textarea>
            </div>
          </section>

          <!-- 13. 时间戳转换 -->
          <section v-else-if="currentTool === 'timestamp'" class="tool-panel">
            <div class="single-pane ts-pane">
              <div class="ts-section">
                <div class="pane-head"><span>{{ t('label.ts2date') }}</span></div>
                <div class="ts-row">
                  <input v-model="state.timestamp.tsInput" class="text-input mono-input" :placeholder="t('ph.ts')" type="text" spellcheck="false" @input="tsToDate" />
                  <button class="mini-btn" type="button" @click="tsToDate">→</button>
                </div>
                <div class="ts-out">
                  <template v-if="state.timestamp.tsDateOut">
                    ISO: {{ state.timestamp.tsDateOut.iso }}<br>Local: {{ state.timestamp.tsDateOut.local }}
                  </template>
                  <template v-else>—</template>
                </div>
              </div>
              <div class="ts-section">
                <div class="pane-head"><span>{{ t('label.date2ts') }}</span></div>
                <div class="ts-row">
                  <input v-model="state.timestamp.dateInput" class="text-input" type="datetime-local" @input="dateToTs" />
                  <button class="mini-btn" type="button" @click="dateToTs">→</button>
                </div>
                <div class="ts-out">
                  <template v-if="state.timestamp.tsOut">
                    Seconds: {{ state.timestamp.tsOut.seconds }}<br>Ms: {{ state.timestamp.tsOut.ms }}
                  </template>
                  <template v-else>—</template>
                </div>
              </div>
              <div class="ts-section">
                <div class="pane-head">
                  <span>{{ t('label.now') }}</span>
                  <div class="pane-actions">
                    <button class="mini-btn" type="button" @click="setNow">{{ t('btn.set') }}</button>
                  </div>
                </div>
                <div class="ts-out">
                  <template v-if="state.timestamp.tsNow">
                    ISO: {{ state.timestamp.tsNow.iso }}<br>Unix: {{ state.timestamp.tsNow.unix }}
                  </template>
                  <template v-else>—</template>
                </div>
              </div>
            </div>
          </section>

          <!-- 14. 颜色工具 -->
          <section v-else-if="currentTool === 'color'" class="tool-panel">
            <div class="single-pane color-pane">
              <div class="color-picker-row">
                <input
                  type="color"
                  class="color-picker"
                  :value="state.color.picker"
                  @input="updateColor($event.target.value, 'picker')"
                />
                <input
                  :value="state.color.hex"
                  class="text-input mono-input"
                  type="text"
                  spellcheck="false"
                  @input="updateColor($event.target.value, 'hex')"
                />
              </div>
              <div class="hash-results">
                <div class="hash-item">
                  <span class="hash-label">HEX</span>
                  <code class="hash-val">{{ state.color.hexVal }}</code>
                  <button class="mini-btn" type="button" @click="copyToClipboard(state.color.hexVal)">{{ t('btn.copy') }}</button>
                </div>
                <div class="hash-item">
                  <span class="hash-label">RGB</span>
                  <code class="hash-val">{{ state.color.rgbVal }}</code>
                  <button class="mini-btn" type="button" @click="copyToClipboard(state.color.rgbVal)">{{ t('btn.copy') }}</button>
                </div>
                <div class="hash-item">
                  <span class="hash-label">HSL</span>
                  <code class="hash-val">{{ state.color.hslVal }}</code>
                  <button class="mini-btn" type="button" @click="copyToClipboard(state.color.hslVal)">{{ t('btn.copy') }}</button>
                </div>
              </div>
              <div class="color-preview" :style="{ background: state.color.hexVal }"></div>
            </div>
          </section>
        </div>

        <!-- 操作栏：主按钮 + 选项（随工具动态变化） -->
        <div class="actions-bar">
          <!-- CSS 选项 -->
          <template v-if="currentTool === 'css'">
            <button class="btn danger" type="button" @click="clearCurrentTool">{{ t('btn.clearAll') }}</button>
            <div class="options">
              <label><input type="checkbox" v-model="state.css.options.comments"><span>{{ t('opt.comments') }}</span></label>
              <label><input type="checkbox" v-model="state.css.options.whitespace"><span>{{ t('opt.whitespace') }}</span></label>
              <label><input type="checkbox" v-model="state.css.options.colors"><span>{{ t('opt.colors') }}</span></label>
              <label><input type="checkbox" v-model="state.css.options.zeros"><span>{{ t('opt.zeros') }}</span></label>
            </div>
          </template>

          <!-- HTML -->
          <template v-else-if="currentTool === 'html'">
            <button class="btn danger" type="button" @click="clearCurrentTool">{{ t('btn.clearAll') }}</button>
          </template>

          <!-- JSON 选项 -->
          <template v-else-if="currentTool === 'json'">
            <button class="btn danger" type="button" @click="clearCurrentTool">{{ t('btn.clearAll') }}</button>
            <div class="options">
              <label><input type="radio" value="format" v-model="state.json.mode"><span>{{ t('opt.format') }}</span></label>
              <label><input type="radio" value="minify" v-model="state.json.mode"><span>{{ t('opt.minify') }}</span></label>
            </div>
          </template>

          <!-- SQL -->
          <template v-else-if="currentTool === 'sql'">
            <button class="btn danger" type="button" @click="clearCurrentTool">{{ t('btn.clearAll') }}</button>
          </template>

          <!-- 编码 -->
          <template v-else-if="currentTool === 'encode'">
            <button class="btn danger" type="button" @click="clearCurrentTool">{{ t('btn.clearAll') }}</button>
          </template>

          <!-- 哈希 -->
          <template v-else-if="currentTool === 'hash'">
            <button class="btn danger" type="button" @click="clearCurrentTool">{{ t('btn.clearAll') }}</button>
          </template>

          <!-- JWT -->
          <template v-else-if="currentTool === 'jwt'">
            <button class="btn" type="button" @click="copyJwtPayload">{{ t('btn.copy') }}</button>
            <button class="btn danger" type="button" @click="clearCurrentTool">{{ t('btn.clearAll') }}</button>
          </template>

          <!-- Markdown -->
          <template v-else-if="currentTool === 'md'">
            <button class="btn danger" type="button" @click="clearCurrentTool">{{ t('btn.clearAll') }}</button>
          </template>

          <!-- 正则 -->
          <template v-else-if="currentTool === 'regex'">
            <button class="btn danger" type="button" @click="clearCurrentTool">{{ t('btn.clearAll') }}</button>
          </template>

          <!-- Diff -->
          <template v-else-if="currentTool === 'diff'">
            <button class="btn danger" type="button" @click="clearCurrentTool">{{ t('btn.clearAll') }}</button>
          </template>

          <!-- Lorem -->
          <template v-else-if="currentTool === 'lorem'">
            <button
              v-for="b in LOREM_BUTTONS"
              :key="b.label"
              class="btn"
              type="button"
              @click="genLorem(b.type, b.n)"
            >{{ t(b.label) }}</button>
            <button class="btn danger" type="button" @click="clearCurrentTool">{{ t('btn.clearAll') }}</button>
          </template>

          <!-- UUID -->
          <template v-else-if="currentTool === 'uuid'">
            <button
              v-for="b in UUID_BUTTONS"
              :key="b.label"
              class="btn primary"
              type="button"
              @click="genUuid(b.n)"
            >{{ t(b.label) }}</button>
            <div class="options">
              <label><input type="checkbox" v-model="state.uuid.upper"><span>{{ t('opt.upper') }}</span></label>
            </div>
            <button class="btn danger" type="button" @click="clearCurrentTool">{{ t('btn.clearAll') }}</button>
          </template>

          <!-- 时间戳 -->
          <template v-else-if="currentTool === 'timestamp'">
            <button class="btn" type="button" @click="setNow">{{ t('btn.set') }}</button>
            <button class="btn danger" type="button" @click="clearCurrentTool">{{ t('btn.clearAll') }}</button>
          </template>

          <!-- 颜色 -->
          <template v-else-if="currentTool === 'color'">
            <button class="btn danger" type="button" @click="clearCurrentTool">{{ t('btn.clearAll') }}</button>
          </template>
        </div>
      </main>
    </div>

    <!-- Toast 提示 -->
    <div class="toast" :class="{ show: toast.show }" role="status" aria-live="polite">{{ toast.msg }}</div>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   主题变量：原 :root 中的自定义变量迁移到组件根类 .dev-app，
   同时把 --ok-* 共享 token 映射到本应用主题色。
   ============================================================ */
.dev-app {
  /* 应用自有变量 */
  --bg: #0a0a0a;
  --surface: #111;
  --surface-2: #1a1a1a;
  --text: #e5e5e5;
  --muted: #666;
  --border: rgba(255, 255, 255, .08);
  --border-2: rgba(255, 255, 255, .15);
  --accent: #3b82f6;
  --green: #22c55e;
  --red: #ef4444;
  --yellow: #eab308;

  color-scheme: dark;

  /* 映射到 shared.css 真实 token */
  --ok-bg: var(--bg);
  --ok-panel: var(--surface);
  --ok-line: var(--border);
  --ok-text: var(--text);
  --ok-muted: var(--muted);
  --ok-accent: var(--accent);
  --ok-accent-soft: rgba(59, 130, 246, .14);
  --ok-topbar-line: var(--border);
  --ok-footer-line: var(--border);
  --ok-footer-text: var(--muted);
  --ok-footer-link: var(--accent);

  /* 字体 */
  --mono: "JetBrains Mono", "SFMono-Regular", Menlo, monospace;
  --sans: "Inter", system-ui, -apple-system, sans-serif;

  display: flex;
  flex-direction: column;
  min-height: 100vh;
  font-family: var(--sans);
  color: var(--text);
  background: var(--bg);
}

.dev-app a { color: var(--accent); text-decoration: none; }
.dev-app h1, .dev-app h2, .dev-app h3, .dev-app h4, .dev-app p, .dev-app strong, .dev-app span, .dev-app small { margin: 0; }

/* ---------- 应用主体布局 ---------- */
.app {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

/* ---------- 侧边栏 ---------- */
.sidebar {
  width: 180px;
  min-width: 180px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 0.5rem;
  overflow-y: auto;
  flex-shrink: 0;
}

.sidebar-group { margin-bottom: 0.5rem; }

.sidebar-label {
  font-size: 0.6rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
  padding: 0.3rem 0.5rem 0.15rem;
}

.tool-tab {
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  color: var(--muted);
  font: inherit;
  font-size: 0.75rem;
  padding: 0.35rem 0.6rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  display: block;
}

.tool-tab:hover {
  background: rgba(255, 255, 255, .05);
  color: var(--text);
}

.tool-tab.active {
  background: var(--accent);
  color: #fff;
}

/* ---------- 主区域 ---------- */
.main {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* ---------- 统计栏 ---------- */
.stats-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--border);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.stat {
  background: var(--surface);
  padding: 0.6rem 0.8rem;
  text-align: center;
}

.stat .v {
  font-size: 1.2rem;
  font-weight: 800;
  font-family: var(--mono);
}

.stat .v.green { color: var(--green); }

.stat .l {
  font-size: 0.6rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-top: 0.15rem;
}

/* ---------- 面板区 ---------- */
.panels {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.tool-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 双栏布局（输入 | 输出） */
.dual-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  height: 100%;
  overflow: hidden;
}

.pane {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.pane + .pane { border-left: 1px solid var(--border); }

.pane-head {
  flex-shrink: 0;
  padding: 0.5rem 0.8rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.7rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
}

.pane-actions { display: flex; gap: 0.3rem; }

/* 面板内按钮 */
.mini-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--muted);
  font: inherit;
  font-size: 0.65rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.mini-btn:hover {
  border-color: var(--border-2);
  color: var(--text);
}

/* 文本域 */
textarea {
  flex: 1;
  width: 100%;
  resize: none;
  background: var(--bg);
  color: var(--text);
  border: none;
  padding: 0.8rem;
  font-family: var(--mono);
  font-size: 0.82rem;
  line-height: 1.7;
  outline: none;
  tab-size: 2;
  min-height: 0;
}

textarea::placeholder { color: var(--muted); }

textarea.short-area { flex: 0 0 120px; }

textarea[readonly] { background: var(--surface-2); }

/* 文本输入框 */
.text-input {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  font: inherit;
  font-size: 0.82rem;
  padding: 0.45rem 0.7rem;
  border-radius: 6px;
  outline: none;
  width: 100%;
}

.text-input:focus { border-color: var(--accent); }

.mono-input { font-family: var(--mono); }

/* ---------- 单栏面板 ---------- */
.single-pane {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  padding: 0;
}

.single-pane > .pane-head { flex-shrink: 0; }

.single-pane > textarea { flex: 1; }

/* ---------- CSS 拖放区 ---------- */
.pane-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  min-height: 0;
}

.pane-body > textarea { flex: 1; }

.drop-zone {
  position: absolute;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  background: rgba(10, 10, 10, .9);
  border: 2px dashed var(--accent);
  z-index: 10;
  font-size: 1rem;
  color: var(--accent);
  font-weight: 600;
}

.drop-zone.active { display: flex; }

/* ---------- 编码转换三栏 ---------- */
.encode-grid {
  display: grid;
  grid-template-columns: 1fr 140px 1fr;
  height: 100%;
  overflow: hidden;
}

.encode-mid {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.8rem 0.4rem;
  justify-content: center;
  background: var(--surface);
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
}

.enc-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--muted);
  font: inherit;
  font-size: 0.68rem;
  font-weight: 500;
  padding: 0.35rem 0.4rem;
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
  white-space: nowrap;
}

.enc-btn:hover {
  border-color: var(--border-2);
  color: var(--text);
  background: rgba(255, 255, 255, .04);
}

/* ---------- 哈希结果 ---------- */
.hash-results {
  flex-shrink: 0;
  overflow-y: auto;
  border-top: 1px solid var(--border);
}

.hash-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.8rem;
  border-bottom: 1px solid var(--border);
}

.hash-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--muted);
  min-width: 60px;
}

.hash-val {
  flex: 1;
  font-family: var(--mono);
  font-size: 0.78rem;
  word-break: break-all;
  background: transparent;
}

/* ---------- JWT 解码 ---------- */
.jwt-sections {
  flex: 1;
  overflow-y: auto;
  border-top: 1px solid var(--border);
}

.jwt-section {
  padding: 0.5rem 0.8rem;
  border-bottom: 1px solid var(--border);
}

.jwt-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  font-weight: 600;
  margin-bottom: 0.2rem;
}

.jwt-pre {
  font-family: var(--mono);
  font-size: 0.8rem;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}

.jwt-sig { color: var(--muted); }

.jwt-error, .error-text { color: var(--red); }

/* ---------- Markdown 预览 ---------- */
.md-preview {
  flex: 1;
  overflow-y: auto;
  padding: 0.8rem;
  font-size: 0.85rem;
  line-height: 1.7;
}

/* v-html 渲染的 Markdown 内容需要 :deep() 穿透 scoped 限制 */
.md-preview :deep(h1) { font-size: 1.4rem; font-weight: 800; margin: 0.8rem 0 0.4rem; border-bottom: 1px solid var(--border); padding-bottom: 0.2rem; }
.md-preview :deep(h2) { font-size: 1.15rem; font-weight: 700; margin: 0.7rem 0 0.3rem; }
.md-preview :deep(h3) { font-size: 1rem; font-weight: 600; margin: 0.5rem 0 0.2rem; }
.md-preview :deep(p) { margin: 0.4rem 0; }
.md-preview :deep(code) { background: rgba(255, 255, 255, .08); padding: 0.1rem 0.3rem; border-radius: 3px; font-family: var(--mono); font-size: 0.82em; }
.md-preview :deep(pre) { background: rgba(255, 255, 255, .05); border: 1px solid var(--border); border-radius: 6px; padding: 0.7rem; overflow-x: auto; margin: 0.4rem 0; }
.md-preview :deep(pre code) { background: transparent; padding: 0; }
.md-preview :deep(blockquote) { border-left: 3px solid var(--accent); padding-left: 0.7rem; color: var(--muted); margin: 0.4rem 0; }
.md-preview :deep(ul), .md-preview :deep(ol) { padding-left: 1.3rem; margin: 0.4rem 0; }
.md-preview :deep(li) { margin: 0.15rem 0; }
.md-preview :deep(a) { color: var(--accent); }
.md-preview :deep(strong) { font-weight: 700; }
.md-preview :deep(em) { font-style: italic; }
.md-preview :deep(hr) { border: none; border-top: 1px solid var(--border); margin: 0.8rem 0; }
.md-preview :deep(table) { border-collapse: collapse; width: 100%; margin: 0.4rem 0; }
.md-preview :deep(th), .md-preview :deep(td) { border: 1px solid var(--border); padding: 0.3rem 0.5rem; text-align: left; font-size: 0.82rem; }
.md-preview :deep(th) { background: rgba(255, 255, 255, .05); font-weight: 600; }

/* ---------- 正则测试 ---------- */
.regex-row {
  display: flex;
  gap: 0.4rem;
  padding: 0.5rem 0.8rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.regex-flags { width: 55px; text-align: center; flex-shrink: 0; }

.regex-results {
  flex: 1;
  overflow-y: auto;
  padding: 0.8rem;
  font-family: var(--mono);
  font-size: 0.82rem;
  line-height: 1.7;
}

.regex-match { margin-bottom: 0.3rem; }
.regex-match .match-num { color: var(--accent); font-weight: 600; }
.regex-match .match-val { color: var(--green); }
.regex-match .match-idx { color: var(--muted); }

/* ---------- 文本对比 ---------- */
.diff-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.diff-grid .pane + .pane { border-left: 1px solid var(--border); }

.diff-output {
  flex-shrink: 0;
  max-height: 40%;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--border);
  overflow: hidden;
}

.diff-result {
  flex: 1;
  overflow-y: auto;
  padding: 0.8rem;
  font-family: var(--mono);
  font-size: 0.8rem;
  line-height: 1.8;
}

.diff-add { background: rgba(34, 197, 94, .12); color: var(--green); }
.diff-del { background: rgba(239, 68, 68, .12); color: var(--red); }

/* ---------- 时间戳 ---------- */
.ts-pane { padding: 0.8rem; gap: 0.8rem; overflow-y: auto; }

.ts-section { display: flex; flex-direction: column; gap: 0.3rem; }

.ts-section .pane-head { padding: 0.4rem 0; background: transparent; border-bottom: none; }

.ts-row { display: flex; gap: 0.4rem; }

.ts-out {
  padding: 0.6rem;
  font-family: var(--mono);
  font-size: 0.85rem;
  color: var(--muted);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  word-break: break-all;
}

/* ---------- 颜色工具 ---------- */
.color-pane { padding: 0.8rem; gap: 0.8rem; overflow-y: auto; }

.color-picker-row {
  display: flex;
  gap: 0.6rem;
  align-items: center;
}

.color-picker {
  width: 60px;
  height: 40px;
  border: none;
  cursor: pointer;
  background: transparent;
  flex-shrink: 0;
}

.color-preview {
  width: 100%;
  height: 70px;
  border-radius: 8px;
  border: 1px solid var(--border);
  flex-shrink: 0;
}

/* ---------- 操作栏 ---------- */
.actions-bar {
  padding: 0.6rem 1.2rem;
  background: var(--surface);
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.btn {
  height: 2rem;
  padding: 0 1rem;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.btn:hover { background: rgba(255, 255, 255, .06); border-color: var(--border-2); }

.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn.primary:hover { background: #2563eb; }

.btn.danger { color: var(--red); border-color: rgba(239, 68, 68, .3); }
.btn.danger:hover { background: rgba(239, 68, 68, .1); }

.options {
  margin-left: auto;
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.7rem;
  color: var(--muted);
  flex-wrap: wrap;
}

.options label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
  user-select: none;
}

.options input[type="checkbox"] {
  accent-color: var(--green);
  width: 14px;
  height: 14px;
}

.options input[type="radio"] {
  accent-color: var(--accent);
  width: 14px;
  height: 14px;
}

/* ---------- Toast 提示 ---------- */
.toast {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%) translateY(100px);
  background: var(--accent);
  color: #fff;
  padding: 0.5rem 1.2rem;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 600;
  transition: transform 0.3s ease;
  z-index: 100;
  pointer-events: none;
}

.toast.show { transform: translateX(-50%) translateY(0); }

/* ---------- 响应式 ---------- */
@media (max-width: 768px) {
  .sidebar { width: 140px; min-width: 140px; }
  .stats-bar { grid-template-columns: repeat(2, 1fr); }
  .dual-grid { grid-template-columns: 1fr; }
  .pane + .pane { border-left: none; border-top: 1px solid var(--border); }
  .encode-grid { grid-template-columns: 1fr; }
  .encode-mid {
    flex-direction: row;
    border-left: none;
    border-top: 1px solid var(--border);
    border-right: none;
    border-bottom: 1px solid var(--border);
    padding: 0.5rem;
    overflow-x: auto;
  }
  .diff-grid { grid-template-columns: 1fr; }
  .options { margin-left: 0; width: 100%; }
}

@media (max-width: 520px) {
  .sidebar { width: 110px; min-width: 110px; }
  .tool-tab { font-size: 0.7rem; padding: 0.3rem 0.4rem; }
  .actions-bar { padding: 0.5rem 0.8rem; }
}
</style>
