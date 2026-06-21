/* ============================================================
   Dev Tools — 开发者工具集
   依赖共享对象 OK（i18n / 语言切换 / escape）。
   17 个工具：CSS/HTML 压缩、JSON/SQL 格式化、JSON→CSV、
   编码转换、哈希、JWT、URL 解析、Markdown 预览、正则测试、
   文本对比、字符串转义、Lorem Ipsum、UUID、时间戳、颜色工具。
   ============================================================ */

(function () {
  'use strict';

  // ========== i18n 文案字典 ==========
  const copy = {
    en: {
      // 顶部栏
      back: '← Tools',
      title: 'Dev Tools',
      // 分组
      'group.code': 'Code',
      'group.encoding': 'Encoding',
      'group.text': 'Text',
      'group.utility': 'Utility',
      // 工具名
      'tool.css': 'CSS Compressor',
      'tool.html': 'HTML Compressor',
      'tool.json': 'JSON Formatter',
      'tool.sql': 'SQL Formatter',
      'tool.csv': 'JSON → CSV',
      'tool.encode': 'Encode / Decode',
      'tool.hash': 'Hash Generator',
      'tool.jwt': 'JWT Decoder',
      'tool.url': 'URL Parser',
      'tool.md': 'Markdown Preview',
      'tool.regex': 'Regex Tester',
      'tool.diff': 'Diff Checker',
      'tool.escape': 'String Escape',
      'tool.lorem': 'Lorem Ipsum',
      'tool.uuid': 'UUID Generator',
      'tool.timestamp': 'Timestamp',
      'tool.color': 'Color Tools',
      'tool.network': 'Network',
      // 统计标签
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
      'stat.rows': 'Rows',
      'stat.params': 'Params',
      'stat.hex': 'HEX',
      'stat.rgb': 'RGB',
      'stat.hsl': 'HSL',
      'stat.pattern': 'Pattern',
      'stat.dash': '—',
      // 网络
      'net.publicIp': 'Public IP',
      'net.location': 'Location',
      'net.isp': 'ISP',
      'net.refresh': 'Refresh',
      'net.loading': 'Loading...',
      'net.error': 'Failed to load',
      // 按钮
      'btn.compress': '🔧 Compress',
      'btn.copy': 'Copy',
      'btn.clear': 'Clear',
      'btn.clearAll': 'Clear All',
      'btn.sample': 'Sample',
      'btn.compare': 'Compare',
      'btn.download': 'Download CSV',
      'btn.set': 'Set',
      'btn.add': 'Add',
      // 标签
      'label.input': 'Input',
      'label.output': 'Output',
      'label.minified': 'Minified',
      'label.formatted': 'Formatted',
      'label.preview': 'Preview',
      'label.results': 'Results',
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
      'label.csvOutput': 'CSV Output',
      'label.urlInput': 'URL',
      'label.queryParams': 'Query Parameters',
      'label.rebuilt': 'Rebuilt URL',
      'label.protocol': 'Protocol',
      'label.host': 'Host',
      'label.path': 'Path',
      'label.hash': 'Hash',
      'label.uuids': 'UUIDs',
      'label.ts2date': 'Timestamp → Date',
      'label.date2ts': 'Date → Timestamp',
      'label.now': 'Now',
      // 选项
      'opt.comments': 'Comments',
      'opt.whitespace': 'Whitespace',
      'opt.colors': 'Colors',
      'opt.zeros': 'Zeros',
      'opt.upper': 'Upper',
      'opt.format': 'Format',
      'opt.minify': 'Minify',
      // 占位符
      'ph.css': 'Paste CSS here...',
      'ph.html': 'Paste HTML here...',
      'ph.json': 'Paste JSON here...',
      'ph.sql': 'Paste SQL here...',
      'ph.csv': 'Paste JSON array here...',
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
      'ph.escape': 'Enter text to escape or transform...',
      'ph.url': 'https://example.com/path?q=1#hash',
      'ph.pattern': 'Pattern (e.g. \\d+)',
      // 编码按钮
      'enc.b64-enc': 'Base64 →',
      'enc.b64-dec': '← Base64',
      'enc.url-enc': 'URL →',
      'enc.url-dec': '← URL',
      'enc.uni-enc': 'Unicode →',
      'enc.uni-dec': '← Unicode',
      // 转义按钮
      'esc.html-esc': 'HTML Escape',
      'esc.html-un': 'HTML Unescape',
      'esc.js-esc': 'JS Escape',
      'esc.js-un': 'JS Unescape',
      'esc.trim': 'Trim',
      'esc.upper': 'UPPER',
      'esc.lower': 'lower',
      'esc.camel': 'camelCase',
      'esc.snake': 'snake_case',
      // Lorem 按钮
      'lorem.p1': '1 Paragraph',
      'lorem.p3': '3 Paragraphs',
      'lorem.p5': '5 Paragraphs',
      'lorem.s10': '10 Sentences',
      'lorem.w50': '50 Words',
      'lorem.loading': 'Loading...',
      'lorem.error': 'API unavailable, using local fallback.',
      // UUID 按钮
      'uuid.gen5': 'Generate 5',
      'uuid.gen10': 'Generate 10',
      'uuid.gen20': 'Generate 20',
      // 消息
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
      // 顶部栏
      back: '← 工具',
      title: '开发者工具',
      // 分组
      'group.code': '代码',
      'group.encoding': '编码',
      'group.text': '文本',
      'group.utility': '工具',
      // 工具名
      'tool.css': 'CSS 压缩',
      'tool.html': 'HTML 压缩',
      'tool.json': 'JSON 格式化',
      'tool.sql': 'SQL 格式化',
      'tool.csv': 'JSON → CSV',
      'tool.encode': '编码转换',
      'tool.hash': '哈希生成',
      'tool.jwt': 'JWT 解码',
      'tool.url': 'URL 解析',
      'tool.md': 'Markdown 预览',
      'tool.regex': '正则测试',
      'tool.diff': '文本对比',
      'tool.escape': '字符串转义',
      'tool.lorem': '占位文本',
      'tool.uuid': 'UUID 生成',
      'tool.timestamp': '时间戳',
      'tool.color': '颜色工具',
      'tool.network': '网络',
      // 统计标签
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
      'stat.rows': '行数',
      'stat.params': '参数',
      'stat.hex': 'HEX',
      'stat.rgb': 'RGB',
      'stat.hsl': 'HSL',
      'stat.pattern': '模式',
      'stat.dash': '—',
      // 网络
      'net.publicIp': '公网 IP',
      'net.location': '位置',
      'net.isp': '运营商',
      'net.refresh': '刷新',
      'net.loading': '加载中...',
      'net.error': '加载失败',
      // 按钮
      'btn.compress': '🔧 压缩',
      'btn.copy': '复制',
      'btn.clear': '清空',
      'btn.clearAll': '全部清空',
      'btn.sample': '示例',
      'btn.compare': '对比',
      'btn.download': '下载 CSV',
      'btn.set': '设为',
      'btn.add': '添加',
      // 标签
      'label.input': '输入',
      'label.output': '输出',
      'label.minified': '压缩结果',
      'label.formatted': '格式化结果',
      'label.preview': '预览',
      'label.results': '结果',
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
      'label.csvOutput': 'CSV 输出',
      'label.urlInput': 'URL',
      'label.queryParams': '查询参数',
      'label.rebuilt': '重建 URL',
      'label.protocol': '协议',
      'label.host': '主机',
      'label.path': '路径',
      'label.hash': '锚点',
      'label.uuids': 'UUID 列表',
      'label.ts2date': '时间戳 → 日期',
      'label.date2ts': '日期 → 时间戳',
      'label.now': '当前时间',
      // 选项
      'opt.comments': '注释',
      'opt.whitespace': '空白',
      'opt.colors': '颜色',
      'opt.zeros': '零值',
      'opt.upper': '大写',
      'opt.format': '格式化',
      'opt.minify': '压缩',
      // 占位符
      'ph.css': '粘贴 CSS...',
      'ph.html': '粘贴 HTML...',
      'ph.json': '粘贴 JSON...',
      'ph.sql': '粘贴 SQL...',
      'ph.csv': '粘贴 JSON 数组...',
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
      'ph.escape': '输入要转义或转换的文本...',
      'ph.url': 'https://example.com/path?q=1#hash',
      'ph.pattern': '模式 (如 \\d+)',
      // 编码按钮
      'enc.b64-enc': 'Base64 编码 →',
      'enc.b64-dec': '← Base64 解码',
      'enc.url-enc': 'URL 编码 →',
      'enc.url-dec': '← URL 解码',
      'enc.uni-enc': 'Unicode 编码 →',
      'enc.uni-dec': '← Unicode 解码',
      // 转义按钮
      'esc.html-esc': 'HTML 转义',
      'esc.html-un': 'HTML 反转义',
      'esc.js-esc': 'JS 转义',
      'esc.js-un': 'JS 反转义',
      'esc.trim': '去空白',
      'esc.upper': '大写',
      'esc.lower': '小写',
      'esc.camel': '驼峰',
      'esc.snake': '下划线',
      // Lorem 按钮
      'lorem.p1': '1 段落',
      'lorem.p3': '3 段落',
      'lorem.p5': '5 段落',
      'lorem.s10': '10 句子',
      'lorem.w50': '50 词',
      // UUID 按钮
      'uuid.gen5': '生成 5 个',
      'uuid.gen10': '生成 10 个',
      'uuid.gen20': '生成 20 个',
      // 消息
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
  };

  // ========== 工具分组 ==========
  const GROUPS = [
    { id: 'code', tools: ['css', 'html', 'json', 'sql', 'csv'] },
    { id: 'encoding', tools: ['encode', 'hash', 'jwt', 'url'] },
    { id: 'text', tools: ['md', 'regex', 'diff', 'escape'] },
    { id: 'utility', tools: ['lorem', 'uuid', 'timestamp', 'color', 'network'] }
  ];

  // ========== DOM 引用 ==========
  const $ = id => document.getElementById(id);
  let currentTool = 'css';
  let currentUrl = null; // URL 解析器当前 URL 对象

  // ========== 通用工具函数 ==========

  // 翻译取值
  function t(key) { return OK.t(key, copy); }

  // 防抖
  function debounce(fn, ms) {
    let timer = null;
    return function () {
      clearTimeout(timer);
      const args = arguments;
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // 显示 Toast 提示
  function showToast(msg) {
    const toast = $('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  // 复制到剪贴板
  function copyToClipboard(text) {
    if (!text || text === '—') return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => showToast(t('msg.copied')),
        () => fallbackCopy(text)
      );
    } else {
      fallbackCopy(text);
    }
  }

  // 兼容旧浏览器的复制方法
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast(t('msg.copied')); } catch (e) { /* 忽略 */ }
    document.body.removeChild(ta);
  }

  // 格式化文件大小
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    return (bytes / 1024).toFixed(1) + ' KB';
  }

  // 转义 HTML
  function escapeHtml(s) { return OK.escape(s); }

  // 转义属性值
  function escapeAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // 更新统计栏数值
  function updateStats(values) {
    for (let i = 0; i < 4; i++) {
      const el = $('stat' + (i + 1));
      if (el) el.textContent = values[i] != null ? String(values[i]) : '—';
    }
  }

  // 重置统计栏
  function resetStats() {
    updateStats(['—', '—', '—', '—']);
    for (let i = 1; i <= 4; i++) {
      const el = $('stat' + i);
      if (el) el.classList.remove('green');
    }
  }

  // 下载文件
  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ========== 示例数据 ==========
  const SAMPLES = {
    en: {
      css: 'body{margin:0;padding:0;font-family:sans-serif;background:#fff;color:#333}\n.container{max-width:1200px;margin:0 auto;padding:2rem 1.5rem}\n.header{background:linear-gradient(135deg,#aabbcc,#112233);padding:1rem;border-radius:8px}\n.btn-primary{display:inline-block;background:#3b82f6;color:#fff;padding:.5rem 1rem;border-radius:6px;border:0 solid transparent;font-weight:600}',
      html: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Hello</title>\n</head>\n<body>\n  <h1>Hello</h1>\n  <p>A <strong>sample</strong> page.</p>\n  <!-- remove me -->\n  <ul>\n    <li>A</li>\n    <li>B</li>\n  </ul>\n</body>\n</html>',
      json: JSON.stringify({ name: 'OpenKee', tools: ['Rate Board', 'Crypto Board'], stats: { total: 17, active: true }, config: { theme: 'dark', features: { offline: false } } }),
      sql: "SELECT u.id, u.name, COUNT(o.id) as orders FROM users u LEFT JOIN orders o ON u.id = o.user_id WHERE u.status = 'active' AND u.created_at > '2025-01-01' GROUP BY u.id, u.name HAVING COUNT(o.id) > 5 ORDER BY orders DESC LIMIT 20;",
      csv: JSON.stringify([
        { id: 1, name: 'Alice', email: 'alice@example.com', address: { city: 'NYC', zip: '10001' } },
        { id: 2, name: 'Bob', email: 'bob@example.com', address: { city: 'LA', zip: '90001' } },
        { id: 3, name: 'Charlie', email: 'charlie@example.com', address: { city: 'Chicago', zip: '60601' } }
      ]),
      md: '# Dev Tools\n\nA collection of **browser-based** utilities.\n\n## Features\n\n- CSS Compressor\n- JSON Formatter\n- Encode / Decode\n\n### Why?\n\n> Every tool runs in your browser.\n\n```js\nconst tool = "dev-tools";\n```\n\n---\n\n| Tool | Status |\n|------|--------|\n| CSS | ✅ |\n| JSON | ✅ |'
    },
    zh: {
      css: 'body{margin:0;padding:0;font-family:sans-serif;background:#fff;color:#333}\n.container{max-width:1200px;margin:0 auto;padding:2rem 1.5rem}\n.header{background:linear-gradient(135deg,#aabbcc,#112233);padding:1rem;border-radius:8px}\n.btn-primary{display:inline-block;background:#3b82f6;color:#fff;padding:.5rem 1rem;border-radius:6px;border:0 solid transparent;font-weight:600}',
      html: '<!DOCTYPE html>\n<html lang="zh">\n<head>\n  <meta charset="UTF-8">\n  <title>你好</title>\n</head>\n<body>\n  <h1>你好</h1>\n  <p>一个 <strong>示例</strong> 页面。</p>\n  <!-- 删除我 -->\n  <ul>\n    <li>A</li>\n    <li>B</li>\n  </ul>\n</body>\n</html>',
      json: JSON.stringify({ 名称: 'OpenKee', 工具: ['汇率看板', '加密看板'], 统计: { 总数: 17, 启用: true }, 配置: { 主题: 'dark', 功能: { 离线: false } } }),
      sql: "SELECT u.id, u.name, COUNT(o.id) as orders FROM users u LEFT JOIN orders o ON u.id = o.user_id WHERE u.status = 'active' AND u.created_at > '2025-01-01' GROUP BY u.id, u.name HAVING COUNT(o.id) > 5 ORDER BY orders DESC LIMIT 20;",
      csv: JSON.stringify([
        { id: 1, 姓名: '张三', 邮箱: 'zhangsan@example.com', 地址: { 城市: '北京', 邮编: '100000' } },
        { id: 2, 姓名: '李四', 邮箱: 'lisi@example.com', 地址: { 城市: '上海', 邮编: '200000' } },
        { id: 3, 姓名: '王五', 邮箱: 'wangwu@example.com', 地址: { 城市: '广州', 邮编: '510000' } }
      ]),
      md: '# 开发者工具\n\n一组 **浏览器端** 实用工具。\n\n## 功能\n\n- CSS 压缩\n- JSON 格式化\n- 编码转换\n\n### 为什么？\n\n> 所有工具都在浏览器中运行。\n\n```js\nconst tool = "dev-tools";\n```\n\n---\n\n| 工具 | 状态 |\n|------|--------|\n| CSS | ✅ |\n| JSON | ✅ |'
    }
  };

  // ========== Lorem Ipsum 词库 ==========
  const LOREM_WORDS = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor ' +
    'incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ' +
    'ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure in reprehenderit ' +
    'voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non ' +
    'proident sunt in culpa qui officia deserunt mollit anim id est laborum').split(' ');

  // ========== 工具实现 ==========

  // ---------- 1. CSS 压缩 ----------
  function cssCompress() {
    const v = $('cssIn').value;
    if (!v.trim()) { $('cssOut').value = ''; resetStats(); return; }
    const t0 = performance.now();
    let r = v;
    // 去注释
    if ($('optCom') && $('optCom').checked) r = r.replace(/\/\*[\s\S]*?\*\//g, '');
    // 去空白
    if ($('optWs') && $('optWs').checked) {
      r = r.replace(/\s+/g, ' ');
      r = r.replace(/\s*\{\s*/g, '{');
      r = r.replace(/\s*\}\s*/g, '}');
      r = r.replace(/\s*;\s*/g, ';');
      r = r.replace(/\s*:\s*/g, ':');
      r = r.replace(/\s*,\s*/g, ',');
      r = r.replace(/;\}/g, '}');
      r = r.trim();
    }
    // 压缩颜色
    if ($('optCol') && $('optCol').checked) {
      r = r.replace(/#([0-9a-fA-F])\1([0-9a-fA-F])\2([0-9a-fA-F])\3/g, '#$1$2$3');
      r = r.replace(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g, (_, R, g, b) => {
        R = parseInt(R); g = parseInt(g); b = parseInt(b);
        if (R > 255 || g > 255 || b > 255) return _;
        const h = '#' + [R, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
        return h[1] === h[2] && h[3] === h[4] && h[5] === h[6] ? '#' + h[1] + h[3] + h[5] : h;
      });
    }
    // 去零值单位
    if ($('optZer') && $('optZer').checked) {
      r = r.replace(/:0(px|em|rem|vh|vw|%|pt|pc|in|mm|cm|ex|ch|lh)/g, ':0');
      r = r.replace(/ 0\.(\d+)/g, ' .$1');
      r = r.replace(/:0\.(\d+)/g, ':.$1');
    }
    const ms = (performance.now() - t0).toFixed(1);
    $('cssOut').value = r;
    const os = new Blob([v]).size, ns = new Blob([r]).size;
    $('stat1').textContent = formatSize(os);
    $('stat2').textContent = formatSize(ns);
    const saved = os ? ((1 - ns / os) * 100).toFixed(1) + '%' : '0%';
    $('stat3').textContent = saved;
    $('stat3').classList.add('green');
    $('stat4').textContent = ms + 'ms';
  }

  // ---------- 2. HTML 压缩 ----------
  function htmlCompress() {
    const v = $('htmlIn').value;
    if (!v.trim()) { $('htmlOut').value = ''; resetStats(); return; }
    const t0 = performance.now();
    const r = v
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .replace(/\s+>/g, '>')
      .replace(/<\s+/g, '<')
      .trim();
    const ms = (performance.now() - t0).toFixed(1);
    $('htmlOut').value = r;
    const os = new Blob([v]).size, ns = new Blob([r]).size;
    $('stat1').textContent = formatSize(os);
    $('stat2').textContent = formatSize(ns);
    const saved = os ? ((1 - ns / os) * 100).toFixed(1) + '%' : '0%';
    $('stat3').textContent = saved;
    $('stat3').classList.add('green');
    $('stat4').textContent = ms + 'ms';
  }

  // ---------- 3. JSON 格式化 ----------
  function jsonFormat() {
    const v = $('jsonIn').value;
    if (!v.trim()) { $('jsonOut').value = ''; $('jsonOut').classList.remove('error-text'); resetStats(); return; }
    const t0 = performance.now();
    try {
      const parsed = JSON.parse(v);
      const modeEl = document.querySelector('input[name="jsonMode"]:checked');
      const output = modeEl && modeEl.value === 'minify'
        ? JSON.stringify(parsed)
        : JSON.stringify(parsed, null, 2);
      $('jsonOut').value = output;
      $('jsonOut').classList.remove('error-text');
      const ms = (performance.now() - t0).toFixed(1);
      const lines = output.split('\n').length;
      $('stat1').textContent = formatSize(new Blob([v]).size);
      $('stat2').textContent = formatSize(new Blob([output]).size);
      $('stat3').textContent = lines;
      $('stat4').textContent = ms + 'ms';
    } catch (e) {
      $('jsonOut').value = t('msg.invalidJson') + ': ' + e.message;
      $('jsonOut').classList.add('error-text');
      $('stat1').textContent = formatSize(new Blob([v]).size);
      $('stat2').textContent = '—';
      $('stat3').textContent = '—';
      $('stat4').textContent = '—';
    }
  }

  // ---------- 4. SQL 格式化 ----------
  function sqlFormat() {
    const v = $('sqlIn').value;
    if (!v.trim()) { $('sqlOut').value = ''; resetStats(); return; }
    const t0 = performance.now();
    const kw = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN',
      'INNER JOIN', 'ON', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'INSERT INTO',
      'VALUES', 'UPDATE', 'SET', 'DELETE FROM'];
    let r = v.replace(/\s+/g, ' ').trim();
    for (const k of kw.sort((a, b) => b.length - a.length)) {
      r = r.replace(new RegExp('\\b' + k.replace(/ /g, '\\s+') + '\\b', 'gi'), '\n' + k);
    }
    const ms = (performance.now() - t0).toFixed(1);
    $('sqlOut').value = r.trim();
    const lines = r.trim().split('\n').length;
    $('stat1').textContent = formatSize(new Blob([v]).size);
    $('stat2').textContent = formatSize(new Blob([r]).size);
    $('stat3').textContent = lines;
    $('stat4').textContent = ms + 'ms';
  }

  // ---------- 5. JSON → CSV ----------
  // 扁平化嵌套对象
  function flattenObject(obj, prefix) {
    prefix = prefix || '';
    const result = {};
    for (const key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
      const newKey = prefix ? prefix + '.' + key : key;
      const val = obj[key];
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        Object.assign(result, flattenObject(val, newKey));
      } else {
        result[newKey] = Array.isArray(val) ? JSON.stringify(val) : val;
      }
    }
    return result;
  }

  function jsonToCsv() {
    const v = $('csvIn').value;
    if (!v.trim()) { $('csvOut').value = ''; $('csvOut').classList.remove('error-text'); resetStats(); return; }
    const t0 = performance.now();
    try {
      const data = JSON.parse(v);
      if (!Array.isArray(data)) throw new Error('Input must be a JSON array');
      if (data.length === 0) {
        $('csvOut').value = '';
        $('csvOut').classList.remove('error-text');
        $('stat1').textContent = formatSize(new Blob([v]).size);
        $('stat2').textContent = '0 B';
        $('stat3').textContent = '0';
        $('stat4').textContent = '0ms';
        return;
      }
      const flatData = data.map(item => flattenObject(item));
      const keys = [];
      flatData.forEach(obj => {
        Object.keys(obj).forEach(k => { if (!keys.includes(k)) keys.push(k); });
      });
      const escCsv = val => {
        const s = String(val == null ? '' : val);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      };
      const header = keys.map(escCsv).join(',');
      const rows = flatData.map(obj => keys.map(k => escCsv(obj[k])).join(','));
      const csv = [header].concat(rows).join('\n');
      $('csvOut').value = csv;
      $('csvOut').classList.remove('error-text');
      const ms = (performance.now() - t0).toFixed(1);
      $('stat1').textContent = formatSize(new Blob([v]).size);
      $('stat2').textContent = formatSize(new Blob([csv]).size);
      $('stat3').textContent = data.length;
      $('stat4').textContent = ms + 'ms';
    } catch (e) {
      $('csvOut').value = t('msg.invalidJson') + ': ' + e.message;
      $('csvOut').classList.add('error-text');
      $('stat1').textContent = formatSize(new Blob([v]).size);
      $('stat2').textContent = '—';
      $('stat3').textContent = '—';
      $('stat4').textContent = '—';
    }
  }

  // ---------- 6. 编码转换 ----------
  // UTF-8 安全的 Base64 编解码
  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary);
  }

  function base64ToUtf8(b64) {
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  }

  function encodeDecode(mode) {
    const input = $('encIn').value;
    if (!input) { $('encOut').value = ''; resetStats(); return; }
    let output = '';
    try {
      switch (mode) {
        case 'b64-enc': output = utf8ToBase64(input); break;
        case 'b64-dec': output = base64ToUtf8(input); break;
        case 'url-enc': output = encodeURIComponent(input); break;
        case 'url-dec': output = decodeURIComponent(input); break;
        case 'uni-enc':
          output = Array.from(input).map(c => {
            const code = c.charCodeAt(0);
            return code > 127 ? '\\u' + code.toString(16).padStart(4, '0') : c;
          }).join('');
          break;
        case 'uni-dec':
          output = input.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
          break;
      }
      $('encOut').value = output;
      $('encOut').classList.remove('error-text');
    } catch (e) {
      $('encOut').value = t('msg.invalidUrl') + ': ' + e.message;
      $('encOut').classList.add('error-text');
    }
    $('stat1').textContent = input.length;
    $('stat2').textContent = output.length;
    $('stat3').textContent = '—';
    $('stat4').textContent = '—';
  }

  // ---------- 7. 哈希生成 ----------
  async function runHash() {
    const v = $('hashIn').value;
    if (!v) {
      $('hSha1').textContent = '—';
      $('hSha256').textContent = '—';
      $('hSha512').textContent = '—';
      resetStats();
      return;
    }
    const enc = new TextEncoder().encode(v);
    const algorithms = [
      { name: 'SHA-1', id: 'hSha1' },
      { name: 'SHA-256', id: 'hSha256' },
      { name: 'SHA-512', id: 'hSha512' }
    ];
    for (const alg of algorithms) {
      try {
        const buf = await crypto.subtle.digest(alg.name, enc);
        const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        $(alg.id).textContent = hex;
      } catch (e) { /* 忽略 */ }
    }
    $('stat1').textContent = v.length;
    $('stat2').textContent = '—';
    $('stat3').textContent = '—';
    $('stat4').textContent = '—';
  }

  // ---------- 8. JWT 解码 ----------
  // base64url 安全解码（UTF-8）
  function b64urlDecode(s) {
    let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  }

  function decodeJwt() {
    const v = $('jwtIn').value.trim();
    if (!v) {
      $('jwtHeader').textContent = '—';
      $('jwtPayload').textContent = '—';
      $('jwtSig').textContent = '—';
      $('jwtHeader').classList.remove('jwt-error');
      resetStats();
      return;
    }
    try {
      const parts = v.split('.');
      if (parts.length < 2) throw new Error('Invalid format');
      const header = JSON.parse(b64urlDecode(parts[0]));
      const payload = JSON.parse(b64urlDecode(parts[1]));
      $('jwtHeader').textContent = JSON.stringify(header, null, 2);
      $('jwtHeader').classList.remove('jwt-error');
      $('jwtPayload').textContent = JSON.stringify(payload, null, 2);
      $('jwtSig').textContent = parts[2] || '(none)';
      $('stat1').textContent = v.length;
      $('stat2').textContent = '—';
      $('stat3').textContent = '—';
      $('stat4').textContent = '—';
    } catch (e) {
      $('jwtHeader').textContent = t('msg.invalidJwt') + ': ' + e.message;
      $('jwtHeader').classList.add('jwt-error');
      $('jwtPayload').textContent = '';
      $('jwtSig').textContent = '';
      $('stat1').textContent = v.length;
      $('stat2').textContent = '—';
      $('stat3').textContent = '—';
      $('stat4').textContent = '—';
    }
  }

  // ---------- 9. URL 解析 ----------
  function parseUrl() {
    const input = $('urlIn').value.trim();
    if (!input) {
      $('urlProtocol').textContent = '—';
      $('urlHost').textContent = '—';
      $('urlPath').textContent = '—';
      $('urlHash').textContent = '—';
      $('queryTable').innerHTML = '';
      $('urlRebuilt').textContent = '—';
      currentUrl = null;
      resetStats();
      return;
    }
    let url;
    try {
      const urlStr = /^[a-zA-Z]+:\/\//.test(input) ? input : 'https://' + input;
      url = new URL(urlStr);
      currentUrl = url;
    } catch (e) {
      $('urlProtocol').textContent = t('msg.invalidUrl');
      $('urlHost').textContent = '—';
      $('urlPath').textContent = '—';
      $('urlHash').textContent = '—';
      $('queryTable').innerHTML = '';
      $('urlRebuilt').textContent = '—';
      currentUrl = null;
      $('stat1').textContent = input.length;
      $('stat2').textContent = '0';
      $('stat3').textContent = '—';
      $('stat4').textContent = '—';
      return;
    }
    $('urlProtocol').textContent = url.protocol;
    $('urlHost').textContent = url.host;
    $('urlPath').textContent = url.pathname;
    $('urlHash').textContent = url.hash || '—';
    renderQueryParams(url);
    rebuildUrl();
    const paramCount = Array.from(url.searchParams).length;
    $('stat1').textContent = input.length;
    $('stat2').textContent = paramCount;
    $('stat3').textContent = '—';
    $('stat4').textContent = '—';
  }

  // 渲染查询参数表格
  function renderQueryParams(url) {
    const table = $('queryTable');
    let html = '';
    url.searchParams.forEach((value, key) => {
      html += '<div class="query-row">' +
        '<input type="text" class="q-key" value="' + escapeAttr(key) + '" />' +
        '<input type="text" class="q-val" value="' + escapeAttr(value) + '" />' +
        '<button class="query-del" data-action="del-param" type="button">×</button>' +
        '</div>';
    });
    html += '<button class="query-add" data-action="add-param" type="button">+ ' + escapeHtml(t('btn.add')) + '</button>';
    table.innerHTML = html;
  }

  // 从表格重建 URL
  function rebuildUrl() {
    if (!currentUrl) return;
    const rows = $('queryTable').querySelectorAll('.query-row');
    const params = new URLSearchParams();
    rows.forEach(row => {
      const key = row.querySelector('.q-key').value;
      const val = row.querySelector('.q-val').value;
      if (key) params.append(key, val);
    });
    const query = params.toString();
    const rebuilt = currentUrl.origin + currentUrl.pathname +
      (query ? '?' + query : '') + currentUrl.hash;
    $('urlRebuilt').textContent = rebuilt;
    $('stat2').textContent = rows.length;
  }

  // 添加查询参数行
  function addQueryParam() {
    const table = $('queryTable');
    const addBtn = table.querySelector('.query-add');
    const row = document.createElement('div');
    row.className = 'query-row';
    row.innerHTML = '<input type="text" class="q-key" value="" placeholder="key" />' +
      '<input type="text" class="q-val" value="" placeholder="value" />' +
      '<button class="query-del" data-action="del-param" type="button">×</button>';
    table.insertBefore(row, addBtn);
    row.querySelector('.q-key').focus();
  }

  // ---------- 10. Markdown 预览 ----------
  // 行内元素解析
  function parseInline(text) {
    let s = escapeHtml(text);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
    s = s.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
    return s;
  }

  function renderMd() {
    const raw = $('mdIn').value;
    const prev = $('mdPrev');
    if (!raw.trim()) {
      prev.innerHTML = '';
      resetStats();
      return;
    }
    const lines = raw.replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let i = 0;
    const n = lines.length;

    while (i < n) {
      const line = lines[i];

      // 代码块
      if (/^```/.test(line)) {
        const code = [];
        i++;
        while (i < n && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
        i++; // 跳过结束围栏
        out.push('<pre><code>' + escapeHtml(code.join('\n')) + '</code></pre>');
        continue;
      }

      // 空行
      if (/^\s*$/.test(line)) { i++; continue; }

      // 标题
      const h = line.match(/^(#{1,3})\s+(.+)$/);
      if (h) {
        const lvl = h[1].length;
        out.push('<h' + lvl + '>' + parseInline(h[2]) + '</h' + lvl + '>');
        i++; continue;
      }

      // 分隔线
      if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

      // 表格
      if (line.includes('|') && i + 1 < n && /^\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && /[-:]/.test(lines[i + 1])) {
        const header = line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        i += 2;
        const bodyRows = [];
        while (i < n && lines[i].includes('|') && lines[i].trim()) {
          bodyRows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
          i++;
        }
        let table = '<table><thead><tr>';
        header.forEach(c => { table += '<th>' + parseInline(c) + '</th>'; });
        table += '</tr></thead><tbody>';
        bodyRows.forEach(row => {
          table += '<tr>';
          header.forEach((_, j) => { table += '<td>' + parseInline(row[j] || '') + '</td>'; });
          table += '</tr>';
        });
        table += '</tbody></table>';
        out.push(table);
        continue;
      }

      // 引用块
      if (/^>\s?/.test(line)) {
        const quote = [];
        while (i < n && /^>\s?/.test(lines[i])) {
          quote.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        out.push('<blockquote>' + parseInline(quote.join(' ')) + '</blockquote>');
        continue;
      }

      // 无序列表
      if (/^[-*]\s+/.test(line)) {
        const items = [];
        while (i < n && /^[-*]\s+/.test(lines[i])) {
          items.push('<li>' + parseInline(lines[i].replace(/^[-*]\s+/, '')) + '</li>');
          i++;
        }
        out.push('<ul>' + items.join('') + '</ul>');
        continue;
      }

      // 段落
      const para = [];
      while (i < n && !/^\s*$/.test(lines[i]) && !/^```/.test(lines[i]) &&
        !/^#{1,3}\s/.test(lines[i]) && !/^[-*]\s+/.test(lines[i]) &&
        !/^>\s?/.test(lines[i]) && !/^---+\s*$/.test(lines[i])) {
        para.push(lines[i]);
        i++;
      }
      if (para.length) out.push('<p>' + parseInline(para.join(' ')) + '</p>');
    }

    prev.innerHTML = out.join('\n');
    const chars = raw.length;
    const words = (raw.match(/\S+/g) || []).length;
    const lineCount = raw.split('\n').length;
    $('stat1').textContent = chars;
    $('stat2').textContent = words;
    $('stat3').textContent = lineCount;
    $('stat4').textContent = '—';
  }

  // ---------- 11. 正则测试 ----------
  function testRegex() {
    const p = $('rxPat').value;
    const f = $('rxFlg').value;
    const input = $('rxIn').value;
    const el = $('rxMatch');
    if (!p || !input) { el.textContent = '—'; resetStats(); return; }
    try {
      const re = new RegExp(p, f);
      const matches = Array.from(input.matchAll(re));
      if (!matches.length) {
        el.textContent = t('msg.noMatches');
        $('stat1').textContent = p;
        $('stat2').textContent = '0';
        $('stat3').textContent = '—';
        $('stat4').textContent = '—';
        return;
      }
      el.innerHTML = matches.map((m, i) =>
        '<div class="regex-match">' +
        '<span class="match-num">#' + (i + 1) + '</span> ' +
        '<span class="match-val">' + escapeHtml(m[0]) + '</span> ' +
        '<span class="match-idx">@' + m.index + '</span>' +
        '</div>'
      ).join('');
      $('stat1').textContent = p;
      $('stat2').textContent = matches.length;
      $('stat3').textContent = '—';
      $('stat4').textContent = '—';
    } catch (e) {
      el.textContent = t('msg.invalidRegex') + ': ' + e.message;
      $('stat1').textContent = p;
      $('stat2').textContent = '—';
      $('stat3').textContent = '—';
      $('stat4').textContent = '—';
    }
  }

  // ---------- 12. 文本对比 ----------
  function runDiff() {
    const a = $('diffA').value.split('\n');
    const b = $('diffB').value.split('\n');
    const out = [];
    const mx = Math.max(a.length, b.length);
    let diffCount = 0;
    for (let i = 0; i < mx; i++) {
      if (a[i] === undefined) {
        out.push('<div class="diff-add">+ ' + escapeHtml(b[i]) + '</div>');
        diffCount++;
      } else if (b[i] === undefined) {
        out.push('<div class="diff-del">- ' + escapeHtml(a[i]) + '</div>');
        diffCount++;
      } else if (a[i] !== b[i]) {
        out.push('<div class="diff-del">- ' + escapeHtml(a[i]) + '</div>');
        out.push('<div class="diff-add">+ ' + escapeHtml(b[i]) + '</div>');
        diffCount++;
      } else {
        out.push('<div>  ' + escapeHtml(a[i]) + '</div>');
      }
    }
    $('diffOut').innerHTML = out.join('') || '—';
    $('stat1').textContent = a.length;
    $('stat2').textContent = b.length;
    $('stat3').textContent = diffCount;
    $('stat4').textContent = '—';
  }

  // ---------- 13. 字符串转义 ----------
  function escapeString(mode) {
    const input = $('escIn').value;
    if (!input) { $('escOut').value = ''; resetStats(); return; }
    let output = input;
    switch (mode) {
      case 'html-esc':
        output = input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        break;
      case 'html-un':
        output = input.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'");
        break;
      case 'js-esc':
        output = input.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'")
          .replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
        break;
      case 'js-un':
        output = input.replace(/\\\\/g, '\\').replace(/\\"/g, '"').replace(/\\'/g, "'")
          .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
        break;
      case 'trim':
        output = input.trim();
        break;
      case 'upper':
        output = input.toUpperCase();
        break;
      case 'lower':
        output = input.toLowerCase();
        break;
      case 'camel':
        output = input.replace(/[_\-\s]+(.)/g, (_, c) => c.toUpperCase())
          .replace(/^./, c => c.toLowerCase());
        break;
      case 'snake':
        output = input.replace(/([A-Z])/g, '_$1').replace(/[\-\s]+/g, '_')
          .replace(/^_/, '').toLowerCase();
        break;
    }
    $('escOut').value = output;
    $('stat1').textContent = input.length;
    $('stat2').textContent = output.length;
    $('stat3').textContent = '—';
    $('stat4').textContent = '—';
  }

  // ---------- 14. Lorem Ipsum ----------
  function genLorem(type, n) {
    let result = '';
    const randWord = () => LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)];
    if (type === 'p') {
      for (let i = 0; i < n; i++) {
        const sentences = 3 + Math.floor(Math.random() * 3);
        for (let j = 0; j < sentences; j++) {
          const wc = 8 + Math.floor(Math.random() * 12);
          const words = [];
          for (let k = 0; k < wc; k++) words.push(randWord());
          let s = words.join(' ');
          s = s.charAt(0).toUpperCase() + s.slice(1) + '. ';
          result += s;
        }
        result += '\n\n';
      }
    } else if (type === 's') {
      for (let i = 0; i < n; i++) {
        const wc = 8 + Math.floor(Math.random() * 12);
        const words = [];
        for (let k = 0; k < wc; k++) words.push(randWord());
        let s = words.join(' ');
        s = s.charAt(0).toUpperCase() + s.slice(1) + '. ';
        result += s;
      }
    } else if (type === 'w') {
      const words = [];
      for (let i = 0; i < n; i++) words.push(randWord());
      result = words.join(' ');
    }
    $('loremOut').value = result.trim();
    $('stat1').textContent = result.length;
    $('stat2').textContent = type === 'p' ? n : type === 's' ? n : n;
    $('stat3').textContent = '—';
    $('stat4').textContent = '—';
  }

  // ---------- 15. UUID 生成 ----------
  function genUuid(n) {
    const upper = $('uuidUpper') && $('uuidUpper').checked;
    const uuids = [];
    for (let i = 0; i < n; i++) {
      let v = crypto.randomUUID();
      if (upper) v = v.toUpperCase();
      uuids.push(v);
    }
    $('uuidOut').value = uuids.join('\n');
    $('stat1').textContent = n;
    $('stat2').textContent = '—';
    $('stat3').textContent = '—';
    $('stat4').textContent = '—';
  }

  // ---------- 16. 时间戳转换 ----------
  function tsToDate() {
    const v = $('tsIn').value.trim();
    const n = parseInt(v);
    if (!n) {
      $('tsDateOut').textContent = t('msg.invalidTs');
      return;
    }
    const d = new Date(v.length > 10 ? n : n * 1000);
    if (isNaN(d.getTime())) {
      $('tsDateOut').textContent = t('msg.invalidTs');
      return;
    }
    $('tsDateOut').innerHTML =
      'ISO: ' + escapeHtml(d.toISOString()) + '<br>' +
      'Local: ' + escapeHtml(d.toLocaleString());
  }

  function dateToTs() {
    const v = $('dateIn').value;
    if (!v) return;
    const d = new Date(v);
    if (isNaN(d.getTime())) return;
    $('tsOut').innerHTML =
      'Seconds: ' + Math.floor(d.getTime() / 1000) + '<br>' +
      'Ms: ' + d.getTime();
  }

  function setNow() {
    const d = new Date();
    $('tsNow').innerHTML =
      'ISO: ' + escapeHtml(d.toISOString()) + '<br>' +
      'Unix: ' + Math.floor(d.getTime() / 1000);
  }

  // ---------- 18. 网络工具 ----------
  async function refreshNetwork() {
    const ipEl = $('netIp');
    const locEl = $('netLoc');
    const ispEl = $('netIsp');
    if (!ipEl || !locEl || !ispEl) return;

    ipEl.textContent = t('net.loading');
    locEl.textContent = t('net.loading');
    ispEl.textContent = t('net.loading');

    try {
      const ipRes = await fetch('https://api.ipify.org?format=json');
      if (!ipRes.ok) throw new Error('IP fetch failed');
      const ipData = await ipRes.json();
      const ip = ipData.ip;

      const infoRes = await fetch('https://ipapi.co/' + ip + '/json/');
      if (!infoRes.ok) throw new Error('Info fetch failed');
      const info = await infoRes.json();

      ipEl.textContent = ip || '—';
      locEl.textContent = [info.city, info.country_name].filter(Boolean).join(', ') || '—';
      ispEl.textContent = info.org || '—';
    } catch (e) {
      ipEl.textContent = t('net.error');
      locEl.textContent = t('net.error');
      ispEl.textContent = t('net.error');
    }
  }

  // ---------- 17. 颜色工具 ----------
  function updateColor(hex, source) {
    hex = String(hex || '').trim().replace(/[^#0-9a-fA-F]/g, '');
    if (!hex.startsWith('#')) hex = '#' + hex;
    // 3 位简写展开
    if (hex.length === 4) {
      hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    hex = hex.toLowerCase();
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    $('cvHex').textContent = hex;
    $('cvRgb').textContent = 'rgb(' + r + ', ' + g + ', ' + b + ')';
    // HSL 转换
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const mx = Math.max(rn, gn, bn), mn = Math.min(rn, gn, bn);
    const l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
      else if (mx === gn) h = ((bn - rn) / d + 2) * 60;
      else h = ((rn - gn) / d + 4) * 60;
    }
    const hsl = 'hsl(' + Math.round(h) + ', ' + Math.round(s * 100) + '%, ' + Math.round(l * 100) + '%)';
    $('cvHsl').textContent = hsl;
    $('colPrev').style.background = hex;
    if (source !== 'picker') $('colPick').value = hex;
    if (source !== 'hex') $('colHex').value = hex;
    $('stat1').textContent = hex;
    $('stat2').textContent = 'rgb(' + r + ',' + g + ',' + b + ')';
    $('stat3').textContent = hsl;
    $('stat4').textContent = '—';
  }

  // ========== 加载示例 ==========
  function loadSample(tool) {
    const samples = SAMPLES[OK.lang] || SAMPLES.en;
    switch (tool) {
      case 'css': $('cssIn').value = samples.css; cssCompress(); break;
      case 'html': $('htmlIn').value = samples.html; htmlCompress(); break;
      case 'json': $('jsonIn').value = samples.json; jsonFormat(); break;
      case 'sql': $('sqlIn').value = samples.sql; sqlFormat(); break;
      case 'csv': $('csvIn').value = samples.csv; jsonToCsv(); break;
      case 'md': $('mdIn').value = samples.md; renderMd(); break;
    }
  }

  // ========== 清空当前工具 ==========
  function clearCurrentTool() {
    const panel = document.querySelector('.tool-panel:not([hidden])');
    if (!panel) return;
    panel.querySelectorAll('textarea, input[type="text"], input[type="datetime-local"]').forEach(el => {
      el.value = '';
    });
    // 重置特定工具的状态
    if (currentTool === 'color') {
      $('colPick').value = '#3b82f6';
      $('colHex').value = '#3b82f6';
      updateColor('#3b82f6');
      return;
    }
    if (currentTool === 'timestamp') {
      $('tsDateOut').textContent = '—';
      $('tsOut').textContent = '—';
      $('tsNow').textContent = '—';
    } else if (currentTool === 'hash') {
      $('hSha1').textContent = '—';
      $('hSha256').textContent = '—';
      $('hSha512').textContent = '—';
    } else if (currentTool === 'jwt') {
      $('jwtHeader').textContent = '—';
      $('jwtPayload').textContent = '—';
      $('jwtSig').textContent = '—';
      $('jwtHeader').classList.remove('jwt-error');
    } else if (currentTool === 'url') {
      $('urlProtocol').textContent = '—';
      $('urlHost').textContent = '—';
      $('urlPath').textContent = '—';
      $('urlHash').textContent = '—';
      $('queryTable').innerHTML = '';
      $('urlRebuilt').textContent = '—';
      currentUrl = null;
    } else if (currentTool === 'regex') {
      $('rxMatch').textContent = '—';
    } else if (currentTool === 'diff') {
      $('diffOut').textContent = '—';
    } else if (currentTool === 'md') {
      $('mdPrev').innerHTML = '';
    }
    resetStats();
  }

  // ========== 操作栏模板 ==========
  function renderActionsBar(toolId) {
    const bar = $('actionsBar');
    const templates = {
      css: '<button class="btn primary" data-action="compress" data-ok-i18n="btn.compress">🔧 Compress</button>' +
        '<button class="btn danger" data-action="clear-all" data-ok-i18n="btn.clearAll">Clear All</button>' +
        '<div class="options">' +
        '<label><input type="checkbox" id="optCom" checked><span data-ok-i18n="opt.comments">Comments</span></label>' +
        '<label><input type="checkbox" id="optWs" checked><span data-ok-i18n="opt.whitespace">Whitespace</span></label>' +
        '<label><input type="checkbox" id="optCol" checked><span data-ok-i18n="opt.colors">Colors</span></label>' +
        '<label><input type="checkbox" id="optZer" checked><span data-ok-i18n="opt.zeros">Zeros</span></label>' +
        '</div>',
      html: '<button class="btn danger" data-action="clear-all" data-ok-i18n="btn.clearAll">Clear All</button>',
      json: '<button class="btn danger" data-action="clear-all" data-ok-i18n="btn.clearAll">Clear All</button>' +
        '<div class="options">' +
        '<label><input type="radio" name="jsonMode" value="format" checked><span data-ok-i18n="opt.format">Format</span></label>' +
        '<label><input type="radio" name="jsonMode" value="minify"><span data-ok-i18n="opt.minify">Minify</span></label>' +
        '</div>',
      sql: '<button class="btn danger" data-action="clear-all" data-ok-i18n="btn.clearAll">Clear All</button>',
      csv: '<button class="btn primary" data-action="download-csv" data-ok-i18n="btn.download">Download CSV</button>' +
        '<button class="btn danger" data-action="clear-all" data-ok-i18n="btn.clearAll">Clear All</button>',
      encode: '<button class="btn danger" data-action="clear-all" data-ok-i18n="btn.clearAll">Clear All</button>',
      hash: '<button class="btn danger" data-action="clear-all" data-ok-i18n="btn.clearAll">Clear All</button>',
      jwt: '<button class="btn" data-action="copy-payload" data-ok-i18n="btn.copy">Copy Payload</button>' +
        '<button class="btn danger" data-action="clear-all" data-ok-i18n="btn.clearAll">Clear All</button>',
      url: '<button class="btn danger" data-action="clear-all" data-ok-i18n="btn.clearAll">Clear All</button>',
      md: '<button class="btn danger" data-action="clear-all" data-ok-i18n="btn.clearAll">Clear All</button>',
      regex: '<button class="btn danger" data-action="clear-all" data-ok-i18n="btn.clearAll">Clear All</button>',
      diff: '<button class="btn primary" data-action="compare" data-ok-i18n="btn.compare">Compare</button>' +
        '<button class="btn danger" data-action="clear-all" data-ok-i18n="btn.clearAll">Clear All</button>',
      escape: '<button class="btn" data-action="esc" data-mode="html-esc" data-ok-i18n="esc.html-esc">HTML Escape</button>' +
        '<button class="btn" data-action="esc" data-mode="html-un" data-ok-i18n="esc.html-un">HTML Unescape</button>' +
        '<button class="btn" data-action="esc" data-mode="js-esc" data-ok-i18n="esc.js-esc">JS Escape</button>' +
        '<button class="btn" data-action="esc" data-mode="js-un" data-ok-i18n="esc.js-un">JS Unescape</button>' +
        '<button class="btn" data-action="esc" data-mode="trim" data-ok-i18n="esc.trim">Trim</button>' +
        '<button class="btn" data-action="esc" data-mode="upper" data-ok-i18n="esc.upper">UPPER</button>' +
        '<button class="btn" data-action="esc" data-mode="lower" data-ok-i18n="esc.lower">lower</button>' +
        '<button class="btn" data-action="esc" data-mode="camel" data-ok-i18n="esc.camel">camelCase</button>' +
        '<button class="btn" data-action="esc" data-mode="snake" data-ok-i18n="esc.snake">snake_case</button>' +
        '<button class="btn danger" data-action="clear-all" data-ok-i18n="btn.clearAll">Clear All</button>',
      lorem: '<button class="btn" data-action="lorem" data-type="p" data-n="1" data-ok-i18n="lorem.p1">1 Paragraph</button>' +
        '<button class="btn" data-action="lorem" data-type="p" data-n="3" data-ok-i18n="lorem.p3">3 Paragraphs</button>' +
        '<button class="btn" data-action="lorem" data-type="p" data-n="5" data-ok-i18n="lorem.p5">5 Paragraphs</button>' +
        '<button class="btn" data-action="lorem" data-type="s" data-n="10" data-ok-i18n="lorem.s10">10 Sentences</button>' +
        '<button class="btn" data-action="lorem" data-type="w" data-n="50" data-ok-i18n="lorem.w50">50 Words</button>' +
        '<button class="btn danger" data-action="clear-all" data-ok-i18n="btn.clearAll">Clear All</button>',
      uuid: '<button class="btn primary" data-action="uuid" data-n="5" data-ok-i18n="uuid.gen5">Generate 5</button>' +
        '<button class="btn primary" data-action="uuid" data-n="10" data-ok-i18n="uuid.gen10">Generate 10</button>' +
        '<button class="btn primary" data-action="uuid" data-n="20" data-ok-i18n="uuid.gen20">Generate 20</button>' +
        '<div class="options">' +
        '<label><input type="checkbox" id="uuidUpper"><span data-ok-i18n="opt.upper">Upper</span></label>' +
        '</div>' +
        '<button class="btn danger" data-action="clear-all" data-ok-i18n="btn.clearAll">Clear All</button>',
      timestamp: '<button class="btn" data-action="set-now" data-ok-i18n="btn.set">Set Now</button>' +
        '<button class="btn danger" data-action="clear-all" data-ok-i18n="btn.clearAll">Clear All</button>',
      color: '<button class="btn danger" data-action="clear-all" data-ok-i18n="btn.clearAll">Clear All</button>',
      network: '<button class="btn primary" data-action="net-refresh" data-ok-i18n="net.refresh">Refresh</button>'
    };
    bar.innerHTML = templates[toolId] || '';
    // 翻译新添加的元素
    OK.applyI18n(copy);
    applyPlaceholders();
  }

  // ========== 工具切换 ==========
  // 每个工具的统计标签配置
  const TOOL_STATS = {
    css: ['stat.original', 'stat.minified', 'stat.saved', 'stat.time'],
    html: ['stat.original', 'stat.minified', 'stat.saved', 'stat.time'],
    json: ['stat.original', 'stat.formatted', 'stat.lines', 'stat.time'],
    sql: ['stat.original', 'stat.formatted', 'stat.lines', 'stat.time'],
    csv: ['stat.original', 'stat.output', 'stat.rows', 'stat.time'],
    encode: ['stat.input', 'stat.output', 'stat.length', 'stat.dash'],
    hash: ['stat.input', 'stat.dash', 'stat.dash', 'stat.dash'],
    jwt: ['stat.input', 'stat.decoded', 'stat.dash', 'stat.dash'],
    url: ['stat.input', 'stat.params', 'stat.dash', 'stat.dash'],
    md: ['stat.chars', 'stat.words', 'stat.lines', 'stat.dash'],
    regex: ['stat.pattern', 'stat.matches', 'stat.dash', 'stat.dash'],
    diff: ['stat.lines', 'stat.lines', 'stat.dash', 'stat.dash'],
    escape: ['stat.input', 'stat.output', 'stat.dash', 'stat.dash'],
    lorem: ['stat.length', 'stat.count', 'stat.dash', 'stat.dash'],
    uuid: ['stat.count', 'stat.dash', 'stat.dash', 'stat.dash'],
    timestamp: ['stat.dash', 'stat.dash', 'stat.dash', 'stat.dash'],
    color: ['stat.hex', 'stat.rgb', 'stat.hsl', 'stat.dash'],
    network: ['stat.dash', 'stat.dash', 'stat.dash', 'stat.dash']
    };

  function switchTool(toolId) {
    currentTool = toolId;
    // 更新侧边栏激活状态
    document.querySelectorAll('.tool-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === toolId);
    });
    // 显示/隐藏面板
    document.querySelectorAll('.tool-panel').forEach(panel => {
      panel.hidden = panel.dataset.toolPanel !== toolId;
    });
    // 更新统计标签
    const stats = TOOL_STATS[toolId] || TOOL_STATS.css;
    for (let i = 0; i < 4; i++) {
      const el = $('statL' + (i + 1));
      if (el) el.textContent = t(stats[i]);
    }
    resetStats();
    // 渲染操作栏
    renderActionsBar(toolId);
    // 执行工具的初始化
    initTool(toolId);
  }

  // 工具初始化（切换到该工具时执行）
  function initTool(toolId) {
    switch (toolId) {
      case 'css': cssCompress(); break;
      case 'html': htmlCompress(); break;
      case 'json': jsonFormat(); break;
      case 'sql': sqlFormat(); break;
      case 'csv': jsonToCsv(); break;
      case 'hash': runHash(); break;
      case 'jwt': decodeJwt(); break;
      case 'url': parseUrl(); break;
      case 'md': renderMd(); break;
      case 'regex': testRegex(); break;
      case 'diff': runDiff(); break;
      case 'color': updateColor($('colHex').value || '#3b82f6'); break;
      case 'timestamp': setNow(); break;
      case 'network': refreshNetwork(); break;
      // encode, escape, lorem, uuid 不需要初始化（等待用户操作）
    }
  }

  // ========== 侧边栏生成 ==========
  function buildSidebar() {
    const sidebar = $('sidebar');
    let html = '';
    GROUPS.forEach(group => {
      html += '<div class="sidebar-group">';
      html += '<div class="sidebar-label" data-group="' + group.id + '">' + escapeHtml(t('group.' + group.id)) + '</div>';
      group.tools.forEach(toolId => {
        const active = toolId === currentTool ? ' active' : '';
        html += '<button class="tool-tab' + active + '" data-tool="' + toolId + '" type="button">' +
          escapeHtml(t('tool.' + toolId)) + '</button>';
      });
      html += '</div>';
    });
    sidebar.innerHTML = html;
  }

  // ========== 占位符翻译 ==========
  function applyPlaceholders() {
    document.querySelectorAll('[data-ok-i18n-ph]').forEach(el => {
      el.placeholder = t(el.dataset.okI18nPh);
    });
  }

  // ========== 更新编码按钮文案 ==========
  function updateEncodeButtons() {
    document.querySelectorAll('[data-action="enc"]').forEach(btn => {
      btn.textContent = t('enc.' + btn.dataset.mode);
    });
  }

  // ========== 语言应用 ==========
  function applyLanguage() {
    // 翻译所有 data-ok-i18n 元素
    OK.applyI18n(copy);
    // 翻译占位符
    applyPlaceholders();
    // 更新侧边栏（工具名）
    document.querySelectorAll('.sidebar-label').forEach(el => {
      el.textContent = t('group.' + el.dataset.group);
    });
    document.querySelectorAll('.tool-tab').forEach(btn => {
      btn.textContent = t('tool.' + btn.dataset.tool);
    });
    // 更新统计标签
    const stats = TOOL_STATS[currentTool] || TOOL_STATS.css;
    for (let i = 0; i < 4; i++) {
      const el = $('statL' + (i + 1));
      if (el) el.textContent = t(stats[i]);
    }
    // 更新编码按钮文案
    updateEncodeButtons();
    // 重新执行当前工具以更新动态内容
    initTool(currentTool);
  }

  // ========== 事件绑定 ==========

  // 侧边栏点击（事件委托）
  function bindSidebar() {
    $('sidebar').addEventListener('click', e => {
      const btn = e.target.closest('.tool-tab');
      if (btn) switchTool(btn.dataset.tool);
    });
  }

  // 面板内按钮点击（事件委托）
  function bindPanels() {
    $('panels').addEventListener('click', e => {
      const netRefreshBtn = e.target.closest('#netRefresh');
      if (netRefreshBtn) { refreshNetwork(); return; }

      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const panel = btn.closest('.tool-panel');
      if (!panel) return;
      const toolId = panel.dataset.toolPanel;
      const action = btn.dataset.action;

      // 通用操作：复制输出
      if (action === 'copy-output') {
        const target = btn.dataset.target;
        if (target) copyToClipboard($(target).value);
        return;
      }
      // 通用操作：复制文本
      if (action === 'copy-text') {
        const target = btn.dataset.target;
        if (target) copyToClipboard($(target).textContent);
        return;
      }
      // 通用操作：清空输入
      if (action === 'clear-input') {
        const input = panel.querySelector('textarea:not([readonly]), input[type="text"]');
        if (input) {
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }
      // 通用操作：示例
      if (action === 'sample') {
        loadSample(toolId);
        return;
      }
      // 编码转换
      if (action === 'enc') {
        encodeDecode(btn.dataset.mode);
        return;
      }
      // URL 查询参数操作
      if (action === 'del-param') {
        btn.closest('.query-row').remove();
        rebuildUrl();
        return;
      }
      if (action === 'add-param') {
        addQueryParam();
        return;
      }
      // 时间戳操作
      if (action === 'ts2date') { tsToDate(); return; }
      if (action === 'date2ts') { dateToTs(); return; }
      if (action === 'set-now') { setNow(); return; }
    });
  }

  // 操作栏点击（事件委托）
  function bindActionsBar() {
    $('actionsBar').addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;

      if (action === 'clear-all') { clearCurrentTool(); return; }
      if (action === 'compress') { cssCompress(); return; }
      if (action === 'compare') { runDiff(); return; }
      if (action === 'net-refresh') { refreshNetwork(); return; }
      if (action === 'download-csv') {
        const v = $('csvOut').value;
        if (v) downloadFile('data.csv', v, 'text/csv;charset=utf-8');
        return;
      }
      if (action === 'copy-payload') {
        copyToClipboard($('jwtPayload').textContent);
        return;
      }
      if (action === 'esc') { escapeString(btn.dataset.mode); return; }
      if (action === 'lorem') { genLorem(btn.dataset.type, parseInt(btn.dataset.n)); return; }
      if (action === 'uuid') { genUuid(parseInt(btn.dataset.n)); return; }
      if (action === 'set-now') { setNow(); return; }
    });

    // JSON 模式切换
    $('actionsBar').addEventListener('change', e => {
      if (e.target.name === 'jsonMode') jsonFormat();
      if (e.target.id === 'uuidUpper') { /* 仅影响下次生成 */ }
    });
  }

  // 输入事件绑定
  function bindInputs() {
    // CSS
    $('cssIn').addEventListener('input', debounce(cssCompress, 400));
    // CSS 选项变化时重新压缩
    $('actionsBar').addEventListener('change', e => {
      if (currentTool === 'css' && e.target.id.startsWith('opt')) cssCompress();
    });

    // HTML
    $('htmlIn').addEventListener('input', debounce(htmlCompress, 400));

    // JSON
    $('jsonIn').addEventListener('input', debounce(jsonFormat, 400));

    // SQL
    $('sqlIn').addEventListener('input', debounce(sqlFormat, 400));

    // CSV
    $('csvIn').addEventListener('input', debounce(jsonToCsv, 400));

    // Hash
    $('hashIn').addEventListener('input', debounce(runHash, 400));

    // JWT
    $('jwtIn').addEventListener('input', debounce(decodeJwt, 400));

    // Markdown
    $('mdIn').addEventListener('input', debounce(renderMd, 300));

    // Regex
    $('rxPat').addEventListener('input', debounce(testRegex, 300));
    $('rxFlg').addEventListener('input', debounce(testRegex, 300));
    $('rxIn').addEventListener('input', debounce(testRegex, 300));

    // Diff
    $('diffA').addEventListener('input', debounce(runDiff, 400));
    $('diffB').addEventListener('input', debounce(runDiff, 400));

    // URL
    $('urlIn').addEventListener('input', debounce(parseUrl, 400));
    $('queryTable').addEventListener('input', rebuildUrl);

    // Escape（仅更新统计，输出由按钮触发）
    $('escIn').addEventListener('input', debounce(() => {
      $('stat1').textContent = $('escIn').value.length;
      $('stat2').textContent = $('escOut').value.length;
    }, 400));

    // Timestamp
    $('tsIn').addEventListener('input', debounce(tsToDate, 400));
    $('dateIn').addEventListener('input', debounce(dateToTs, 400));

    // Color
    $('colPick').addEventListener('input', e => updateColor(e.target.value, 'picker'));
    $('colHex').addEventListener('input', e => updateColor(e.target.value, 'hex'));
  }

  // CSS 拖放上传
  function bindDragDrop() {
    const dropZone = $('cssDropZone');
    const cssPanel = document.querySelector('[data-tool-panel="css"] .pane-body');
    if (!cssPanel || !dropZone) return;

    cssPanel.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.classList.add('active');
    });
    cssPanel.addEventListener('dragleave', e => {
      if (e.target === cssPanel) dropZone.classList.remove('active');
    });
    cssPanel.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('active');
      const f = e.dataTransfer.files[0];
      if (f && (f.type === 'text/css' || f.name.endsWith('.css'))) {
        const r = new FileReader();
        r.onload = () => {
          $('cssIn').value = r.result;
          cssCompress();
        };
        r.readAsText(f);
      }
    });
  }

  // ========== 初始化 ==========
  OK.ready(function () {
    buildSidebar();
    bindSidebar();
    bindPanels();
    bindActionsBar();
    bindInputs();
    bindDragDrop();
    OK.initLangToggle($('langBtn'), copy, applyLanguage);
    applyLanguage();
    switchTool('css');
  });

})();
