/* ============================================================
   Markdown Studio — 实时预览的 Markdown 编辑器
   依赖共享对象 OK（i18n / 语言切换 / escape）。
   Markdown 解析器自行实现，不引入外部库。
   ============================================================ */

// ---------- DOM 引用 ----------
var langToggle = document.getElementById('langToggle');
var editor = document.getElementById('editor');
var preview = document.getElementById('preview');
var stats = document.getElementById('stats');
var toolbar = document.querySelector('.toolbar');
var sampleBtn = document.getElementById('sampleBtn');
var importBtn = document.getElementById('importBtn');
var exportMdBtn = document.getElementById('exportMdBtn');
var exportHtmlBtn = document.getElementById('exportHtmlBtn');
var githubRenderBtn = document.getElementById('githubRenderBtn');
var fileInput = document.getElementById('fileInput');

// ---------- i18n 文案字典 ----------
var copy = {
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
};

// 工具栏按钮动作 -> 文案 key 映射（用于动态设置 title/aria-label）
var ACTION_TIPS = {
  bold: 'boldTip', italic: 'italicTip', strike: 'strikeTip',
  h1: 'h1Tip', h2: 'h2Tip', h3: 'h3Tip',
  ul: 'ulTip', ol: 'olTip', task: 'taskTip',
  link: 'linkTip', image: 'imageTip',
  code: 'codeTip', codeblock: 'codeblockTip',
  quote: 'quoteTip', hr: 'hrTip', table: 'tableTip'
};

// ---------- 示例文档（双语） ----------
var SAMPLE = {
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
};

// ---------- 应用状态 ----------
var lang = OK.lang;
var renderTimer = null;
var syncLock = false; // 同步滚动防互触锁

// ---------- 工具函数 ----------
function t(key) {
  return OK.t(key, copy);
}

// 转义 HTML（防 XSS），复用共享方法
function escapeHtml(s) {
  return OK.escape(s);
}

// 净化链接地址，禁止 javascript: 等危险协议
function sanitizeUrl(url) {
  var u = String(url == null ? '' : url).trim();
  if (!u) return '';
  // 允许的协议
  if (/^(https?:|mailto:|tel:|ftp:|data:image\/)/i.test(u)) return u;
  // 相对链接 / 锚点 / 当前页
  if (u.charAt(0) === '#' || u.charAt(0) === '/' || u.charAt(0) === '?') return u;
  if (u.indexOf(':') === -1) return u; // 无协议的相对路径
  return ''; // 其他协议一律拒绝
}

// ============================================================
// Markdown 解析器（自行实现，简易版）
// ============================================================

// ---------- 行内元素解析 ----------
function parseInline(text) {
  var slots = [];
  // 占位：把已构造好的 HTML 片段存起来，最后再还原
  function stash(html) {
    slots.push(html);
    return '\u0000' + (slots.length - 1) + '\u0000';
  }

  // 1. 行内代码（最先处理，内部不再做其他转换）
  text = text.replace(/`([^`]+)`/g, function (m, code) {
    return stash('<code>' + escapeHtml(code) + '</code>');
  });

  // 2. 图片 ![alt](url "title")
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, function (m, alt, url, title) {
    var u = sanitizeUrl(url);
    if (!u) return escapeHtml(m);
    var tAttr = title ? ' title="' + escapeHtml(title) + '"' : '';
    return stash('<img src="' + escapeHtml(u) + '" alt="' + escapeHtml(alt) + '"' + tAttr + ' />');
  });

  // 3. 链接 [text](url "title")
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, function (m, label, url, title) {
    var u = sanitizeUrl(url);
    if (!u) return escapeHtml(m);
    var tAttr = title ? ' title="' + escapeHtml(title) + '"' : '';
    return stash('<a href="' + escapeHtml(u) + '"' + tAttr + ' target="_blank" rel="noreferrer">' + parseInline(label) + '</a>');
  });

  // 4. 转义剩余 HTML（占位符不含特殊字符，不受影响）
  text = escapeHtml(text);

  // 5. 粗体 / 删除线 / 斜体（标记字符 * ~ 不会被转义）
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  text = text.replace(/\*([^*]+?)\*/g, '<em>$1</em>');

  // 6. 还原占位
  text = text.replace(/\u0000(\d+)\u0000/g, function (m, idx) {
    return slots[Number(idx)];
  });

  return text;
}

// ---------- 表格辅助 ----------
function isTableSeparator(line) {
  // 形如 | --- | :--: | --: | 的分隔行
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && /\|/.test(line) && /[-:]/.test(line);
}

function splitTableRow(line) {
  var s = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return s.split('|').map(function (c) { return c.trim(); });
}

function parseTableAligns(line) {
  return splitTableRow(line).map(function (c) {
    if (/^:.*:$/.test(c)) return 'center';
    if (/:$/.test(c)) return 'right';
    if (/^:/.test(c)) return 'left';
    return null;
  });
}

function buildTable(header, aligns, bodyRows) {
  var th = header.map(function (c, i) {
    var a = aligns[i] ? ' style="text-align:' + aligns[i] + '"' : '';
    return '<th' + a + '>' + parseInline(c) + '</th>';
  }).join('');
  var trs = bodyRows.map(function (row) {
    var tds = row.map(function (c, i) {
      var a = aligns[i] ? ' style="text-align:' + aligns[i] + '"' : '';
      return '<td' + a + '>' + parseInline(c) + '</td>';
    }).join('');
    return '<tr>' + tds + '</tr>';
  }).join('');
  return '<table><thead><tr>' + th + '</tr></thead><tbody>' + trs + '</tbody></table>';
}

// ---------- 判断某行是否是块级元素起始 ----------
function isBlockStart(line) {
  return /^#{1,6}\s/.test(line) ||
    /^```/.test(line) ||
    /^>\s?/.test(line) ||
    /^\s*([-*+]|\d+\.)\s+/.test(line) ||
    /^\s*([-*_])(\s*\1){2,}\s*$/.test(line);
}

// ---------- 列表解析 ----------
// 返回 { html, next }，next 为下一条待处理行索引
function parseList(lines, start) {
  var isOrdered = /^\s*\d+\.\s+/.test(lines[start]);
  var items = [];
  var i = start;
  var n = lines.length;

  while (i < n) {
    var m = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(\[[ xX]\]\s+)?(.*)$/);
    if (!m) break;
    items.push({ task: m[3] || '', content: m[4] });
    i++;
  }

  var lis = items.map(function (it) {
    if (it.task) {
      var checked = /^\[[xX]\]/.test(it.task);
      return '<li class="task-item">' +
        '<input type="checkbox" disabled' + (checked ? ' checked' : '') + ' /> ' +
        parseInline(it.content) + '</li>';
    }
    return '<li>' + parseInline(it.content) + '</li>';
  }).join('');

  var tag = isOrdered ? 'ol' : 'ul';
  var cls = items.some(function (it) { return !!it.task; }) ? ' class="task-list"' : '';
  return { html: '<' + tag + cls + '>' + lis + '</' + tag + '>', next: i };
}

// ---------- 主解析：块级元素 ----------
function renderMarkdown(src) {
  var text = String(src == null ? '' : src).replace(/\r\n?/g, '\n');
  var lines = text.split('\n');
  var out = [];
  var i = 0;
  var n = lines.length;

  while (i < n) {
    var line = lines[i];

    // 代码块围栏
    var fence = line.match(/^```\s*(\w*)\s*$/);
    if (fence) {
      var codeLang = fence[1] || '';
      var codeLines = [];
      i++;
      while (i < n && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // 跳过结束围栏（若存在）
      var cls = codeLang ? ' class="lang-' + escapeHtml(codeLang) + '"' : '';
      out.push('<pre><code' + cls + '>' + escapeHtml(codeLines.join('\n')) + '</code></pre>');
      continue;
    }

    // 空行
    if (/^\s*$/.test(line)) { i++; continue; }

    // 标题
    var h = line.match(/^(#{1,6})\s+(.*?)(?:\s+#{1,6})?$/);
    if (h) {
      var lvl = h[1].length;
      out.push('<h' + lvl + '>' + parseInline(h[2]) + '</h' + lvl + '>');
      i++; continue;
    }

    // 分隔线
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push('<hr />');
      i++; continue;
    }

    // 表格：当前行含 | 且下一行是分隔行
    if (/\|/.test(line) && i + 1 < n && isTableSeparator(lines[i + 1])) {
      var header = splitTableRow(line);
      var aligns = parseTableAligns(lines[i + 1]);
      i += 2;
      var bodyRows = [];
      while (i < n && /\|/.test(lines[i]) && !/^\s*$/.test(lines[i])) {
        bodyRows.push(splitTableRow(lines[i]));
        i++;
      }
      out.push(buildTable(header, aligns, bodyRows));
      continue;
    }

    // 引用块
    if (/^>\s?/.test(line)) {
      var quoteLines = [];
      while (i < n && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      // 引用内部递归解析（支持多行段落、嵌套标题等）
      out.push('<blockquote>' + renderMarkdown(quoteLines.join('\n')) + '</blockquote>');
      continue;
    }

    // 列表
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      var list = parseList(lines, i);
      out.push(list.html);
      i = list.next;
      continue;
    }

    // 普通段落（连续非空、非块级起始行合并）
    var paraLines = [];
    while (i < n && !/^\s*$/.test(lines[i]) && !isBlockStart(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      out.push('<p>' + parseInline(paraLines.join('\n')) + '</p>');
    }
  }

  return out.join('\n');
}

// ============================================================
// GitHub Markdown API 渲染
// ============================================================
function renderWithGitHub() {
  var text = editor.value;
  fetch('https://api.github.com/markdown', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text, mode: 'gfm' })
  })
    .then(function (res) {
      if (!res.ok) throw new Error('GitHub API returned ' + res.status);
      return res.text();
    })
    .then(function (html) {
      preview.innerHTML = html;
    })
    .catch(function () {
      preview.innerHTML = renderMarkdown(text);
      alert(t('renderFail'));
    });
}

// ============================================================
// 预览渲染 + 字数统计
// ============================================================
function render() {
  var src = editor.value;
  var html = renderMarkdown(src);
  if (html) {
    preview.innerHTML = html;
  } else {
    preview.innerHTML = '';
    preview.setAttribute('data-empty', t('empty'));
  }
  updateStats();
}

// 防抖渲染（200ms）
function scheduleRender() {
  if (renderTimer) clearTimeout(renderTimer);
  renderTimer = setTimeout(function () {
    renderTimer = null;
    render();
  }, 200);
}

// 字数统计：字符数 / 单词数（中文按字符、英文按词）/ 行数
function updateStats() {
  var text = editor.value;
  var chars = text.length;
  var cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  var enWords = (text.replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9]+/g) || []).length;
  var words = cjk + enWords;
  var lines = text === '' ? 0 : text.split('\n').length;
  stats.innerHTML =
    '<span><b>' + chars + '</b> ' + t('chars') + '</span>' +
    '<span><b>' + words + '</b> ' + t('words') + '</span>' +
    '<span><b>' + lines + '</b> ' + t('lines') + '</span>';
}

// ============================================================
// 工具栏：选区编辑操作
// ============================================================

// 通用：对当前选区执行变换，返回新文本与新选区
function editSelection(transform) {
  var start = editor.selectionStart;
  var end = editor.selectionEnd;
  var value = editor.value;
  var selected = value.slice(start, end);
  var result = transform(selected, value, start, end);
  editor.value = result.value;
  editor.focus();
  editor.selectionStart = result.selStart;
  editor.selectionEnd = result.selEnd;
  // 触发输入事件以更新预览
  editor.dispatchEvent(new Event('input', { bubbles: true }));
}

// 用前后缀包裹选区（无选区时插入占位文本并选中）
function wrap(before, after, placeholder) {
  editSelection(function (sel, val, start, end) {
    var text = sel.length ? sel : placeholder;
    var newVal = val.slice(0, start) + before + text + after + val.slice(end);
    var s = start + before.length;
    return { value: newVal, selStart: s, selEnd: s + text.length };
  });
}

// 给选区涉及的每一行加前缀（标题、列表、引用）
function prefixLines(prefix) {
  editSelection(function (sel, val, start, end) {
    var lineStart = val.lastIndexOf('\n', start - 1) + 1;
    var lineEnd = val.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = val.length;
    var block = val.slice(lineStart, lineEnd);
    var newBlock = block.split('\n').map(function (l) { return prefix + l; }).join('\n');
    var newVal = val.slice(0, lineStart) + newBlock + val.slice(lineEnd);
    return { value: newVal, selStart: lineStart, selEnd: lineStart + newBlock.length };
  });
}

// 在光标处插入文本（无选区）或替换选区
function insertAtCursor(text) {
  editSelection(function (sel, val, start, end) {
    var newVal = val.slice(0, start) + text + val.slice(end);
    return { value: newVal, selStart: start, selEnd: start + text.length };
  });
}

// 各动作处理
function handleAction(action) {
  switch (action) {
    case 'bold':
      wrap('**', '**', t('boldTip').replace(/\s*\(.*\)$/, ''));
      break;
    case 'italic':
      wrap('*', '*', t('italicTip').replace(/\s*\(.*\)$/, ''));
      break;
    case 'strike':
      wrap('~~', '~~', t('strikeTip'));
      break;
    case 'h1':
      prefixLines('# ');
      break;
    case 'h2':
      prefixLines('## ');
      break;
    case 'h3':
      prefixLines('### ');
      break;
    case 'ul':
      prefixLines('- ');
      break;
    case 'ol':
      prefixLines('1. ');
      break;
    case 'task':
      prefixLines('- [ ] ');
      break;
    case 'link': {
      var url = window.prompt(t('promptUrl'), 'https://');
      if (url === null) return;
      var linkUrl = url || 'https://';
      wrap('[', '](' + linkUrl + ')', t('linkText'));
      break;
    }
    case 'image': {
      var imgUrl = window.prompt(t('promptImgUrl'), 'https://');
      if (imgUrl === null) return;
      var alt = window.prompt(t('promptImgAlt'), t('imageAlt'));
      if (alt === null) return;
      var u = imgUrl || 'https://';
      var a = alt || t('imageAlt');
      insertAtCursor('![' + a + '](' + u + ')');
      break;
    }
    case 'code':
      wrap('`', '`', t('codeText'));
      break;
    case 'codeblock':
      wrap('\n```\n', '\n```\n', t('codeText'));
      break;
    case 'quote':
      prefixLines('> ');
      break;
    case 'hr':
      insertAtCursor('\n---\n');
      break;
    case 'table':
      insertAtCursor('\n| Column A | Column B |\n| --- | --- |\n| 1 | 2 |\n');
      break;
    default:
      break;
  }
}

// ============================================================
// 导入 / 导出
// ============================================================

// 触发文件下载（Blob + URL.createObjectURL）
function downloadFile(filename, content, mime) {
  var blob = new Blob([content], { type: mime });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 释放 blob URL
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

// 导出 .md
function exportMd() {
  downloadFile('markdown-studio.md', editor.value, 'text/markdown;charset=utf-8');
}

// 导出 .html（带基础样式的独立文档）
function exportHtml() {
  var body = preview.innerHTML || '';
  var css =
    'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;' +
    'max-width:780px;margin:40px auto;padding:0 20px;color:#24292e;line-height:1.65;}' +
    'code,pre{font-family:"JetBrains Mono",SFMono-Regular,Menlo,Consolas,monospace;}' +
    'code{background:#f6f8fa;padding:.15em .4em;border-radius:4px;font-size:.85em;}' +
    'pre{background:#f6f8fa;padding:.9em 1em;border-radius:6px;overflow:auto;}' +
    'pre code{background:none;padding:0;}' +
    'blockquote{border-left:.25em solid #e1e4e8;padding:.2em 1em;color:#6a737d;background:#f6f8fa;}' +
    'h1,h2{border-bottom:1px solid #e1e4e8;padding-bottom:.3em;}' +
    'table{border-collapse:collapse;width:100%;}th,td{border:1px solid #e1e4e8;padding:.45em .85em;}' +
    'th{background:#f6f8fa;}img{max-width:100%;}a{color:#0366d6;}';
  var html = '<!DOCTYPE html>\n<html lang="' + (lang === 'zh' ? 'zh' : 'en') + '">\n<head>\n' +
    '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>Markdown Studio</title>\n<style>' + css + '</style>\n</head>\n<body>\n' +
    body + '\n</body>\n</html>';
  downloadFile('markdown-studio.html', html, 'text/html;charset=utf-8');
}

// 导入 .md 文件
function importFile(file) {
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    editor.value = String(reader.result || '');
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  };
  reader.onerror = function () {
    alert(t('importFail'));
  };
  reader.readAsText(file);
}

// ============================================================
// 同步滚动
// ============================================================
function syncScroll(source, target) {
  if (syncLock) return;
  syncLock = true;
  var sMax = source.scrollHeight - source.clientHeight;
  var tMax = target.scrollHeight - target.clientHeight;
  var ratio = sMax > 0 ? source.scrollTop / sMax : 0;
  target.scrollTop = ratio * (tMax > 0 ? tMax : 0);
  // 下一帧释放锁，避免反向事件循环
  requestAnimationFrame(function () { syncLock = false; });
}

// ============================================================
// 语言应用
// ============================================================
function applyLanguage() {
  lang = OK.lang;
  OK.applyI18n(copy);
  // 工具栏按钮的 title / aria-label（按钮含 SVG，不能用 data-ok-i18n 覆盖 textContent）
  toolbar.querySelectorAll('.tb-btn').forEach(function (btn) {
    var key = ACTION_TIPS[btn.dataset.action];
    if (!key) return;
    var tip = t(key);
    btn.title = tip;
    btn.setAttribute('aria-label', tip);
  });
  // 预览空状态文案
  preview.setAttribute('data-empty', t('empty'));
  // 重新渲染统计文案
  updateStats();
}

// ============================================================
// 事件绑定
// ============================================================

// 编辑器输入（防抖渲染）
editor.addEventListener('input', scheduleRender);

// 工具栏点击（事件委托）
toolbar.addEventListener('click', function (e) {
  var btn = e.target.closest('.tb-btn');
  if (!btn) return;
  var action = btn.dataset.action;
  if (action) handleAction(action);
});

// 键盘快捷键：Ctrl+B / Ctrl+I / Ctrl+K
editor.addEventListener('keydown', function (e) {
  if (!(e.ctrlKey || e.metaKey)) return;
  var key = e.key.toLowerCase();
  if (key === 'b') { e.preventDefault(); handleAction('bold'); }
  else if (key === 'i') { e.preventDefault(); handleAction('italic'); }
  else if (key === 'k') { e.preventDefault(); handleAction('link'); }
});

// Tab 键插入两个空格（编辑器内不切焦）
editor.addEventListener('keydown', function (e) {
  if (e.key !== 'Tab') return;
  e.preventDefault();
  var start = editor.selectionStart;
  var end = editor.selectionEnd;
  editor.value = editor.value.slice(0, start) + '  ' + editor.value.slice(end);
  editor.selectionStart = editor.selectionEnd = start + 2;
  editor.dispatchEvent(new Event('input', { bubbles: true }));
});

// 同步滚动
editor.addEventListener('scroll', function () { syncScroll(editor, preview); });
preview.addEventListener('scroll', function () { syncScroll(preview, editor); });

// 示例文档
sampleBtn.addEventListener('click', function () {
  editor.value = SAMPLE[lang] || SAMPLE.en;
  editor.dispatchEvent(new Event('input', { bubbles: true }));
  editor.focus();
});

// 导入
importBtn.addEventListener('click', function () { fileInput.click(); });
fileInput.addEventListener('change', function () {
  importFile(fileInput.files && fileInput.files[0]);
  fileInput.value = ''; // 允许重复导入同一文件
});

// 导出
exportMdBtn.addEventListener('click', exportMd);
exportHtmlBtn.addEventListener('click', exportHtml);

// GitHub 渲染
githubRenderBtn.addEventListener('click', renderWithGitHub);

// ============================================================
// 初始化
// ============================================================
OK.initLangToggle(langToggle, copy, applyLanguage);
applyLanguage();
// 首次加载示例文档，便于直接体验
editor.value = SAMPLE[lang] || SAMPLE.en;
render();
