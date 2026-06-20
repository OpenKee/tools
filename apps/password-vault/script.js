/* ============================================================
   Password Vault — 密码生成器
   依赖共享对象 OK（i18n / 语言切换 / escape）。
   所有随机性均来自 crypto.getRandomValues()，确保密码学安全。
   ============================================================ */

// ---------- DOM 引用 ----------
var langToggle = document.getElementById('langToggle');
var lengthRange = document.getElementById('lengthRange');
var lengthValue = document.getElementById('lengthValue');
var optUpper = document.getElementById('optUpper');
var optLower = document.getElementById('optLower');
var optDigits = document.getElementById('optDigits');
var optSymbols = document.getElementById('optSymbols');
var optExclude = document.getElementById('optExclude');
var generateBtn = document.getElementById('generateBtn');
var batchCount = document.getElementById('batchCount');
var batchBtn = document.getElementById('batchBtn');
var passwordDisplay = document.getElementById('passwordDisplay');
var copyBtn = document.getElementById('copyBtn');
var regenBtn = document.getElementById('regenBtn');
var strengthLevel = document.getElementById('strengthLevel');
var strengthFill = document.getElementById('strengthFill');
var strengthBar = document.querySelector('.strength-bar');
var entropyValue = document.getElementById('entropyValue');
var crackTimeValue = document.getElementById('crackTimeValue');
var countUpper = document.getElementById('countUpper');
var countLower = document.getElementById('countLower');
var countDigit = document.getElementById('countDigit');
var countSymbol = document.getElementById('countSymbol');
var batchSection = document.getElementById('batchSection');
var batchList = document.getElementById('batchList');
var copyBatchBtn = document.getElementById('copyBatchBtn');
var historyList = document.getElementById('historyList');
var clearHistoryBtn = document.getElementById('clearHistoryBtn');

// ---------- i18n 文案字典 ----------
var copy = {
  en: {
    eyebrow: 'Security tool',
    title: 'Password Vault',
    lead: 'Generate cryptographically secure passwords with real-time strength analysis, entropy estimation, and crack-time forecasting.',
    lengthLabel: 'Length',
    optionsLabel: 'Character types',
    optUppercase: 'Uppercase (A–Z)',
    optLowercase: 'Lowercase (a–z)',
    optDigits: 'Digits (0–9)',
    optSymbols: 'Symbols (!@#$…)',
    optExcludeSimilar: 'Exclude similar (0/O/1/l/I)',
    generate: 'Generate',
    regenerate: 'Regenerate',
    copy: 'Copy',
    copied: 'Copied',
    copyAll: 'Copy all',
    strengthLabel: 'Strength analysis',
    entropyLabel: 'Entropy',
    bitsUnit: 'bits',
    crackTimeLabel: 'Estimated crack time',
    compositionLabel: 'Character composition',
    compUppercase: 'Uppercase',
    compLowercase: 'Lowercase',
    compDigits: 'Digits',
    compSymbols: 'Symbols',
    levelWeak: 'Weak',
    levelMedium: 'Medium',
    levelStrong: 'Strong',
    levelVeryStrong: 'Very strong',
    batchLabel: 'Batch generate',
    batchGenerate: 'Generate',
    batchResults: 'Batch results',
    historyLabel: 'History',
    clearHistory: 'Clear',
    noHistory: 'No history yet. Generated passwords will appear here.',
    noBatch: 'Generate a batch to see multiple passwords.',
    noOptions: 'Select at least one character type.',
    emptyPassword: '—',
    copyFailed: 'Copy failed',
    timeInstant: 'Instant',
    timeSecond: 'second',
    timeMinute: 'minute',
    timeHour: 'hour',
    timeDay: 'day',
    timeYear: 'year',
    ariaCopy: 'Copy password',
    ariaRegenerate: 'Regenerate password',
    ariaLength: 'Password length',
    ariaBatchCount: 'Batch count',
    ariaStrength: 'Password strength',
  },
  zh: {
    eyebrow: '安全工具',
    title: 'Password Vault',
    lead: '生成加密安全的随机密码，提供实时强度分析、熵值估算与破解时间预测。',
    lengthLabel: '长度',
    optionsLabel: '字符类型',
    optUppercase: '大写字母 (A–Z)',
    optLowercase: '小写字母 (a–z)',
    optDigits: '数字 (0–9)',
    optSymbols: '特殊符号 (!@#$…)',
    optExcludeSimilar: '排除相似字符 (0/O/1/l/I)',
    generate: '生成密码',
    regenerate: '重新生成',
    copy: '复制',
    copied: '已复制',
    copyAll: '全部复制',
    strengthLabel: '强度分析',
    entropyLabel: '熵值',
    bitsUnit: '位',
    crackTimeLabel: '预估破解时间',
    compositionLabel: '字符组成',
    compUppercase: '大写',
    compLowercase: '小写',
    compDigits: '数字',
    compSymbols: '符号',
    levelWeak: '弱',
    levelMedium: '中',
    levelStrong: '强',
    levelVeryStrong: '极强',
    batchLabel: '批量生成',
    batchGenerate: '生成',
    batchResults: '批量结果',
    historyLabel: '历史记录',
    clearHistory: '清空',
    noHistory: '暂无历史记录。生成的密码会显示在这里。',
    noBatch: '生成批量密码以查看多个结果。',
    noOptions: '请至少选择一种字符类型。',
    emptyPassword: '—',
    copyFailed: '复制失败',
    timeInstant: '瞬间',
    timeSecond: '秒',
    timeMinute: '分',
    timeHour: '小时',
    timeDay: '天',
    timeYear: '年',
    ariaCopy: '复制密码',
    ariaRegenerate: '重新生成密码',
    ariaLength: '密码长度',
    ariaBatchCount: '批量数量',
    ariaStrength: '密码强度',
  },
};

// ---------- 字符集定义 ----------
var UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
var LOWER = 'abcdefghijklmnopqrstuvwxyz';
var DIGITS = '0123456789';
var SYMBOLS = '!@#$%^&*()-_=+[]{}|;:,.<>?/~';
// 排除相似字符集合
var SIMILAR = '0Oo1lI|`';

// ---------- 应用状态 ----------
var lang = OK.lang;
var currentPassword = '';
var history = [];
var batchPasswords = [];

// ---------- 工具函数 ----------
function t(key) {
  return OK.t(key, copy);
}

// 从字符串中移除相似字符
function filterSimilar(str) {
  var result = '';
  for (var i = 0; i < str.length; i++) {
    if (SIMILAR.indexOf(str[i]) === -1) result += str[i];
  }
  return result;
}

// 基于当前选项构造可用字符集数组（已过滤相似字符）
function buildSets() {
  var sets = [];
  if (optUpper.checked) sets.push(optExclude.checked ? filterSimilar(UPPER) : UPPER);
  if (optLower.checked) sets.push(optExclude.checked ? filterSimilar(LOWER) : LOWER);
  if (optDigits.checked) sets.push(optExclude.checked ? filterSimilar(DIGITS) : DIGITS);
  if (optSymbols.checked) sets.push(optExclude.checked ? filterSimilar(SYMBOLS) : SYMBOLS);
  // 过滤后可能为空字符串，剔除
  return sets.filter(function (s) { return s.length > 0; });
}

// 拼接完整字符池
function buildPool(sets) {
  return sets.join('');
}

/**
 * 密码学安全的随机整数 [0, max)。
 * 使用拒绝采样消除取模偏差。
 */
function secureRandomInt(max) {
  if (max <= 0) return 0;
  var range = 4294967296; // 2^32
  var limit = range - (range % max); // 最大可接受边界
  var arr = new Uint32Array(1);
  var x;
  do {
    crypto.getRandomValues(arr);
    x = arr[0];
  } while (x >= limit);
  return x % max;
}

/**
 * 生成密码。
 * 保证每个已选字符集至少出现一次（当长度足够时），再用 Fisher-Yates 洗牌。
 */
function generatePassword(length, sets) {
  var pool = buildPool(sets);
  if (!pool || length <= 0) return '';
  var chars = [];
  // 先从每个集合各取一个，保证覆盖
  var ensureCount = Math.min(sets.length, length);
  for (var i = 0; i < ensureCount; i++) {
    chars.push(sets[i][secureRandomInt(sets[i].length)]);
  }
  // 填充剩余长度
  for (var j = ensureCount; j < length; j++) {
    chars.push(pool[secureRandomInt(pool.length)]);
  }
  // Fisher-Yates 洗牌（使用安全随机）
  for (var k = chars.length - 1; k > 0; k--) {
    var idx = secureRandomInt(k + 1);
    var tmp = chars[k];
    chars[k] = chars[idx];
    chars[idx] = tmp;
  }
  return chars.join('');
}

// 计算熵值（bits）= 长度 * log2(字符池大小)
function calcEntropy(length, poolSize) {
  if (poolSize <= 0 || length <= 0) return 0;
  return length * Math.log2(poolSize);
}

// 根据熵值判定强度等级
function strengthFromEntropy(entropy) {
  if (entropy < 35) return 'weak';
  if (entropy < 60) return 'medium';
  if (entropy < 120) return 'strong';
  return 'verystrong';
}

// 强度等级文案
function levelLabel(level) {
  if (level === 'weak') return t('levelWeak');
  if (level === 'medium') return t('levelMedium');
  if (level === 'strong') return t('levelStrong');
  return t('levelVeryStrong');
}

// 分析密码字符组成
function analyzeComposition(pwd) {
  var counts = { upper: 0, lower: 0, digit: 0, symbol: 0 };
  for (var i = 0; i < pwd.length; i++) {
    var ch = pwd[i];
    if (UPPER.indexOf(ch) !== -1) counts.upper++;
    else if (LOWER.indexOf(ch) !== -1) counts.lower++;
    else if (DIGITS.indexOf(ch) !== -1) counts.digit++;
    else counts.symbol++;
  }
  return counts;
}

// 时间单位单词（处理英文复数）
function unitWord(n, key) {
  var word = t(key);
  if (lang === 'en' && n !== 1) return word + 's';
  return word;
}

/**
 * 估算破解时间。
 * 假设离线快速攻击 1e10 次/秒，平均需要尝试 2^entropy / 2 次。
 */
function formatCrackTime(entropy) {
  if (entropy <= 0) return t('timeInstant');
  var guesses = Math.pow(2, entropy) / 2;
  var seconds = guesses / 1e10;
  if (!isFinite(seconds) || seconds < 1) return t('timeInstant');

  var minute = 60, hour = 3600, day = 86400, year = 31536000;
  var val, key;
  if (seconds < minute) { val = seconds; key = 'timeSecond'; }
  else if (seconds < hour) { val = seconds / minute; key = 'timeMinute'; }
  else if (seconds < day) { val = seconds / hour; key = 'timeHour'; }
  else if (seconds < year) { val = seconds / day; key = 'timeDay'; }
  else { val = seconds / year; key = 'timeYear'; }

  // 极大年数使用科学计数法
  if (key === 'timeYear' && val >= 1e6) {
    return val.toExponential(2) + ' ' + unitWord(val, key);
  }
  var rounded = val < 10 ? Math.round(val * 10) / 10 : Math.round(val);
  return rounded + ' ' + unitWord(rounded, key);
}

// ---------- 渲染：密码显示 ----------
function renderPassword(pwd) {
  currentPassword = pwd;
  if (!pwd) {
    passwordDisplay.textContent = t('emptyPassword');
    passwordDisplay.classList.add('empty');
    return;
  }
  passwordDisplay.textContent = pwd;
  passwordDisplay.classList.remove('empty');
}

// ---------- 渲染：强度分析 ----------
function renderStrength(pwd, poolSize) {
  var entropy = pwd ? calcEntropy(pwd.length, poolSize) : 0;
  var level = pwd ? strengthFromEntropy(entropy) : null;

  // 强度条填充宽度（熵值映射到 0-128 bits 区间）
  var pct = Math.min(100, (entropy / 128) * 100);
  strengthFill.style.width = pct + '%';
  strengthFill.className = 'strength-fill' + (level ? ' level-' + level : '');

  // 等级标签
  strengthLevel.className = 'strength-level' + (level ? ' level-' + level : '');
  strengthLevel.textContent = level ? levelLabel(level) : '—';

  // 无障碍属性
  strengthBar.setAttribute('aria-valuenow', String(Math.round(entropy)));
  strengthBar.setAttribute('aria-label', t('ariaStrength'));

  // 熵值与破解时间
  entropyValue.textContent = pwd ? entropy.toFixed(1) : '—';
  crackTimeValue.textContent = pwd ? formatCrackTime(entropy) : '—';

  // 字符组成
  var counts = pwd ? analyzeComposition(pwd) : { upper: 0, lower: 0, digit: 0, symbol: 0 };
  countUpper.textContent = counts.upper;
  countLower.textContent = counts.lower;
  countDigit.textContent = counts.digit;
  countSymbol.textContent = counts.symbol;
}

// ---------- 生成并展示 ----------
function generateAndShow() {
  var sets = buildSets();
  if (sets.length === 0) {
    // 未选择任何字符类型，给出提示
    renderPassword('');
    renderStrength('', 0);
    passwordDisplay.textContent = t('noOptions');
    passwordDisplay.classList.add('empty');
    return;
  }
  var length = Number(lengthRange.value);
  var poolSize = buildPool(sets).length;
  var pwd = generatePassword(length, sets);
  renderPassword(pwd);
  renderStrength(pwd, poolSize);
  addToHistory(pwd, poolSize);
}

// ---------- 历史记录 ----------
function addToHistory(pwd, poolSize) {
  if (!pwd) return;
  // 与最近一条相同则跳过
  if (history.length && history[0].password === pwd) return;

  var entropy = calcEntropy(pwd.length, poolSize);
  var level = strengthFromEntropy(entropy);
  var now = new Date();
  var timeStr = now.toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  history.unshift({
    password: pwd,
    entropy: entropy,
    level: level,
    timeStr: timeStr,
  });
  // 最多保留 20 条
  if (history.length > 20) history.length = 20;
  renderHistory();
}

function renderHistory() {
  if (!history.length) {
    historyList.innerHTML = '<p class="history-empty">' + OK.escape(t('noHistory')) + '</p>';
    return;
  }
  var html = history.map(function (h, i) {
    return '<button class="history-item" data-idx="' + i + '" type="button" aria-label="' +
      OK.escape(t('copy')) + '">' +
      '<span class="history-level level-' + h.level + '">' + OK.escape(levelLabel(h.level)) + '</span>' +
      '<span class="history-pwd" title="' + OK.escape(h.password) + '">' + OK.escape(h.password) + '</span>' +
      '<span class="history-time">' + OK.escape(h.timeStr) + '</span>' +
      '</button>';
  }).join('');
  historyList.innerHTML = html;

  // 点击历史项复制该密码
  var items = historyList.querySelectorAll('.history-item');
  for (var i = 0; i < items.length; i++) {
    (function (btn, idx) {
      btn.addEventListener('click', function () {
        copyToClipboard(history[idx].password);
      });
    })(items[i], i);
  }
}

// ---------- 批量生成 ----------
function generateBatch() {
  var sets = buildSets();
  if (sets.length === 0) {
    batchPasswords = [];
    renderBatch();
    passwordDisplay.textContent = t('noOptions');
    passwordDisplay.classList.add('empty');
    return;
  }
  var length = Number(lengthRange.value);
  var poolSize = buildPool(sets).length;
  var count = Number(batchCount.value);
  batchPasswords = [];
  for (var i = 0; i < count; i++) {
    batchPasswords.push(generatePassword(length, sets));
  }
  renderBatch();
}

function renderBatch() {
  if (!batchPasswords.length) {
    batchList.innerHTML = '<p class="batch-empty">' + OK.escape(t('noBatch')) + '</p>';
    return;
  }
  var html = batchPasswords.map(function (pwd, i) {
    return '<div class="batch-item">' +
      '<span class="batch-idx">' + (i + 1) + '</span>' +
      '<span class="batch-pwd">' + OK.escape(pwd) + '</span>' +
      '<button class="batch-copy" data-idx="' + i + '" type="button" aria-label="' + OK.escape(t('copy')) + '">' +
      '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
      '</button>' +
      '</div>';
  }).join('');
  batchList.innerHTML = html;

  // 绑定单条复制
  var btns = batchList.querySelectorAll('.batch-copy');
  for (var i = 0; i < btns.length; i++) {
    (function (btn, idx) {
      btn.addEventListener('click', function () {
        copyToClipboard(batchPasswords[idx]);
        flashCopied(btn);
      });
    })(btns[i], i);
  }
}

// ---------- 复制功能 ----------
function copyToClipboard(text) {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () {
      flashCopied(copyBtn);
    }).catch(function () {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

// 降级复制方案
function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    flashCopied(copyBtn);
  } catch (e) {
    // 静默失败
  }
  document.body.removeChild(ta);
}

// 复制成功的视觉反馈
function flashCopied(btn) {
  if (!btn) return;
  var textEl = btn.querySelector('.icon-btn-text');
  var prev = textEl ? textEl.textContent : '';
  btn.classList.add('copied');
  if (textEl) textEl.textContent = t('copied');
  setTimeout(function () {
    btn.classList.remove('copied');
    if (textEl) textEl.textContent = prev || t('copy');
  }, 1200);
}

// 复制全部批量密码
function copyAllBatch() {
  if (!batchPasswords.length) return;
  copyToClipboard(batchPasswords.join('\n'));
  flashCopied(copyBatchBtn);
}

// ---------- 语言应用 ----------
function applyLanguage() {
  lang = OK.lang;
  OK.applyI18n(copy);
  // 同步 aria-label 等动态文本
  lengthRange.setAttribute('aria-label', t('ariaLength'));
  batchCount.setAttribute('aria-label', t('ariaBatchCount'));
  copyBtn.setAttribute('aria-label', t('ariaCopy'));
  regenBtn.setAttribute('aria-label', t('ariaRegenerate'));
  // 重新渲染动态内容
  renderStrength(currentPassword, currentPassword ? calcPoolSizeForCurrent() : 0);
  renderHistory();
  renderBatch();
  // 若当前无密码，根据选项状态显示对应提示
  if (!currentPassword) {
    var sets = buildSets();
    passwordDisplay.textContent = sets.length === 0 ? t('noOptions') : t('emptyPassword');
    passwordDisplay.classList.add('empty');
  }
}

// 计算当前选项下的字符池大小（用于语言切换后重渲染强度）
function calcPoolSizeForCurrent() {
  var sets = buildSets();
  return buildPool(sets).length;
}

// ---------- 事件绑定 ----------
// 长度滑块
lengthRange.addEventListener('input', function () {
  lengthValue.textContent = lengthRange.value;
});

// 选项变化时实时重新生成（即时反馈）
function onOptionChange() {
  generateAndShow();
}
optUpper.addEventListener('change', onOptionChange);
optLower.addEventListener('change', onOptionChange);
optDigits.addEventListener('change', onOptionChange);
optSymbols.addEventListener('change', onOptionChange);
optExclude.addEventListener('change', onOptionChange);

// 生成按钮
generateBtn.addEventListener('click', generateAndShow);

// 重新生成按钮
regenBtn.addEventListener('click', generateAndShow);

// 复制按钮
copyBtn.addEventListener('click', function () {
  copyToClipboard(currentPassword);
});

// 批量生成
batchBtn.addEventListener('click', generateBatch);

// 复制全部
copyBatchBtn.addEventListener('click', copyAllBatch);

// 清空历史
clearHistoryBtn.addEventListener('click', function () {
  history.length = 0;
  renderHistory();
});

// ---------- 初始化 ----------
OK.initLangToggle(langToggle, copy, applyLanguage);
applyLanguage();
// 首次生成
generateAndShow();
