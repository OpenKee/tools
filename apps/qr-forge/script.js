/* ============================================================
   QR Forge — 二维码生成器
   依赖共享对象 OK（i18n / 语言切换 / escape）。
   ============================================================ */

// ---------- DOM 引用 ----------
const langToggle = document.getElementById('langToggle');
const typeTabs = document.getElementById('typeTabs');
const inputArea = document.getElementById('inputArea');
const sizeSelect = document.getElementById('sizeSelect');
const fgColor = document.getElementById('fgColor');
const bgColor = document.getElementById('bgColor');
const fgColorValue = document.getElementById('fgColorValue');
const bgColorValue = document.getElementById('bgColorValue');
const eccSelect = document.getElementById('eccSelect');
const marginRange = document.getElementById('marginRange');
const marginValue = document.getElementById('marginValue');
const generateBtn = document.getElementById('generateBtn');
const previewCard = document.getElementById('previewCard');
const previewEmpty = document.getElementById('previewEmpty');
const previewLoading = document.getElementById('previewLoading');
const previewError = document.getElementById('previewError');
const qrImage = document.getElementById('qrImage');
const downloadBtn = document.getElementById('downloadBtn');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// ---------- i18n 文案字典 ----------
const copy = {
  en: {
    eyebrow: 'QR tool',
    title: 'QR Forge',
    lead: 'Generate and customize QR codes for text, URLs, WiFi, email, and phone — with live preview and PNG download.',
    typeLabel: 'Content type',
    typeText: 'Text',
    typeUrl: 'URL',
    typeWifi: 'WiFi',
    typeEmail: 'Email',
    typePhone: 'Phone',
    labelText: 'Text content',
    labelUrl: 'URL',
    labelSsid: 'Network name (SSID)',
    labelPassword: 'Password',
    labelEncryption: 'Encryption',
    labelEmail: 'Email address',
    labelPhone: 'Phone number',
    placeholderText: 'Enter any text…',
    placeholderUrl: 'https://example.com',
    placeholderSsid: 'MyNetwork',
    placeholderPassword: 'password',
    placeholderEmail: 'name@example.com',
    placeholderPhone: '+1 234 567 890',
    encWpa: 'WPA/WPA2',
    encWep: 'WEP',
    encNone: 'None',
    size: 'Size',
    foreground: 'Foreground',
    background: 'Background',
    ecc: 'Error correction',
    margin: 'Margin',
    generate: 'Generate',
    download: 'Download PNG',
    history: 'History',
    clearHistory: 'Clear',
    noHistory: 'No history yet. Generated codes will appear here.',
    reload: 'Reload this QR code',
    previewEmpty: 'Enter content to generate a QR code',
    generating: 'Generating…',
    generateError: 'Failed to generate QR code. Please try again.',
    downloadError: 'Download failed. Please try again.',
    downloaded: 'Downloaded',
    type_text: 'Text',
    type_url: 'URL',
    type_wifi: 'WiFi',
    type_email: 'Email',
    type_phone: 'Phone',
  },
  zh: {
    eyebrow: '二维码工具',
    title: 'QR Forge',
    lead: '为文本、网址、WiFi、邮箱、电话生成并自定义二维码 — 实时预览，支持下载 PNG。',
    typeLabel: '内容类型',
    typeText: '文本',
    typeUrl: '网址',
    typeWifi: 'WiFi',
    typeEmail: '邮箱',
    typePhone: '电话',
    labelText: '文本内容',
    labelUrl: '网址',
    labelSsid: '网络名称 (SSID)',
    labelPassword: '密码',
    labelEncryption: '加密方式',
    labelEmail: '邮箱地址',
    labelPhone: '电话号码',
    placeholderText: '输入任意文本…',
    placeholderUrl: 'https://example.com',
    placeholderSsid: '我的网络',
    placeholderPassword: '密码',
    placeholderEmail: 'name@example.com',
    placeholderPhone: '+86 138 0000 0000',
    encWpa: 'WPA/WPA2',
    encWep: 'WEP',
    encNone: '无',
    size: '尺寸',
    foreground: '前景色',
    background: '背景色',
    ecc: '容错级别',
    margin: '边距',
    generate: '生成',
    download: '下载 PNG',
    history: '历史记录',
    clearHistory: '清空',
    noHistory: '暂无历史记录。生成的二维码会显示在这里。',
    reload: '重新加载此二维码',
    previewEmpty: '输入内容以生成二维码',
    generating: '生成中…',
    generateError: '二维码生成失败，请重试。',
    downloadError: '下载失败，请重试。',
    downloaded: '已下载',
    type_text: '文本',
    type_url: '网址',
    type_wifi: 'WiFi',
    type_email: '邮箱',
    type_phone: '电话',
  },
};

// ---------- 各类型输入字段配置 ----------
const FIELD_CONFIGS = {
  text: [
    { key: 'text', label: 'labelText', kind: 'textarea', placeholder: 'placeholderText' },
  ],
  url: [
    { key: 'url', label: 'labelUrl', kind: 'input', inputType: 'url', placeholder: 'placeholderUrl' },
  ],
  wifi: [
    { key: 'ssid', label: 'labelSsid', kind: 'input', inputType: 'text', placeholder: 'placeholderSsid' },
    { key: 'password', label: 'labelPassword', kind: 'input', inputType: 'text', placeholder: 'placeholderPassword' },
    { key: 'encryption', label: 'labelEncryption', kind: 'select', options: [
      { value: 'WPA', label: 'encWpa' },
      { value: 'WEP', label: 'encWep' },
      { value: 'nopass', label: 'encNone' },
    ] },
  ],
  email: [
    { key: 'email', label: 'labelEmail', kind: 'input', inputType: 'email', placeholder: 'placeholderEmail' },
  ],
  phone: [
    { key: 'phone', label: 'labelPhone', kind: 'input', inputType: 'tel', placeholder: 'placeholderPhone' },
  ],
};

// ---------- 应用状态 ----------
let lang = OK.lang;
const state = {
  type: 'text',
  inputs: { text: '', url: '', ssid: '', password: '', encryption: 'WPA', email: '', phone: '' },
  options: { size: 256, fgColor: '#1a1a2e', bgColor: '#ffffff', ecc: 'M', margin: 4 },
};
const history = [];
let debounceTimer = null;
let currentRequestToken = 0; // 用于丢弃过期的图片加载回调

// ---------- 工具函数 ----------
function t(key) {
  return OK.t(key, copy);
}

// 根据类型与输入拼装二维码数据
function buildData(type, inputs) {
  switch (type) {
    case 'text':
      return inputs.text || '';
    case 'url':
      return inputs.url || '';
    case 'wifi': {
      const enc = inputs.encryption || 'WPA';
      const ssid = inputs.ssid || '';
      const pass = inputs.password || '';
      // WiFi 二维码标准格式
      return 'WIFI:T:' + enc + ';S:' + ssid + ';P:' + pass + ';;';
    }
    case 'email':
      return 'mailto:' + (inputs.email || '');
    case 'phone':
      return 'tel:' + (inputs.phone || '');
    default:
      return '';
  }
}

// 构造二维码 API 地址（颜色去掉 # 前缀）
function buildQrUrl(data, opts) {
  const size = opts.size;
  const color = (opts.fgColor || '#000000').replace('#', '');
  const bgcolor = (opts.bgColor || '#ffffff').replace('#', '');
  const ecc = opts.ecc;
  const margin = opts.margin;
  const params = new URLSearchParams();
  params.set('size', size + 'x' + size);
  params.set('data', data);
  params.set('color', color);
  params.set('bgcolor', bgcolor);
  params.set('ecc', ecc);
  params.set('margin', String(margin));
  return 'https://api.qrserver.com/v1/create-qr-code/?' + params.toString();
}

// 生成历史条目的展示标签
function buildHistoryLabel(type, data) {
  const clean = data
    .replace(/^WIFI:T:.*;S:/, '')
    .replace(/;P:.*;;$/, '')
    .replace(/^mailto:/, '')
    .replace(/^tel:/, '');
  const label = clean || data;
  return label.length > 48 ? label.slice(0, 48) + '…' : label;
}

// ---------- 渲染输入区 ----------
function renderInputs() {
  const fields = FIELD_CONFIGS[state.type] || [];
  inputArea.innerHTML = fields.map(function (f) {
    const val = state.inputs[f.key] != null ? state.inputs[f.key] : '';
    const safeVal = OK.escape(val);
    const labelTxt = t(f.label);
    const ph = t(f.placeholder || '');
    if (f.kind === 'textarea') {
      return '<div class="field-group">' +
        '<label class="field-label" for="inp-' + f.key + '">' + labelTxt + '</label>' +
        '<textarea id="inp-' + f.key + '" class="text-input" rows="3" placeholder="' + ph + '" aria-label="' + labelTxt + '">' + safeVal + '</textarea>' +
        '</div>';
    }
    if (f.kind === 'select') {
      const opts = f.options.map(function (o) {
        const sel = state.inputs[f.key] === o.value ? ' selected' : '';
        return '<option value="' + o.value + '"' + sel + '>' + t(o.label) + '</option>';
      }).join('');
      return '<div class="field-group">' +
        '<label class="field-label" for="inp-' + f.key + '">' + labelTxt + '</label>' +
        '<select id="inp-' + f.key + '" class="text-input" aria-label="' + labelTxt + '">' + opts + '</select>' +
        '</div>';
    }
    const itype = f.inputType || 'text';
    return '<div class="field-group">' +
      '<label class="field-label" for="inp-' + f.key + '">' + labelTxt + '</label>' +
      '<input id="inp-' + f.key + '" class="text-input" type="' + itype + '" placeholder="' + ph + '" value="' + safeVal + '" aria-label="' + labelTxt + '" />' +
      '</div>';
  }).join('');

  // 绑定输入事件
  fields.forEach(function (f) {
    const el = document.getElementById('inp-' + f.key);
    if (!el) return;
    const handler = function () {
      state.inputs[f.key] = el.value;
      scheduleGenerate();
    };
    el.addEventListener('input', handler);
    if (f.kind === 'select') {
      el.addEventListener('change', handler);
    }
  });
}

// ---------- 预览状态控制 ----------
function setPreviewState(stateName) {
  previewCard.classList.remove('show-empty', 'show-loading', 'show-error', 'show-image');
  if (stateName === 'empty') {
    previewCard.classList.add('show-empty');
    downloadBtn.disabled = true;
  } else if (stateName === 'loading') {
    previewCard.classList.add('show-loading');
    downloadBtn.disabled = true;
  } else if (stateName === 'error') {
    previewCard.classList.add('show-error');
    downloadBtn.disabled = true;
  } else if (stateName === 'image') {
    previewCard.classList.add('show-image');
    downloadBtn.disabled = false;
  }
}

// ---------- 生成二维码 ----------
function generate() {
  const data = buildData(state.type, state.inputs);
  // 数据为空时显示空状态
  if (!data || !data.replace(/^(mailto:|tel:)$/, '').trim()) {
    setPreviewState('empty');
    return;
  }

  const url = buildQrUrl(data, state.options);
  const token = ++currentRequestToken;
  setPreviewState('loading');

  // 图片加载成功
  qrImage.onload = function () {
    if (token !== currentRequestToken) return; // 过期请求，丢弃
    setPreviewState('image');
    addToHistory(state.type, state.inputs, state.options, data);
  };

  // 图片加载失败
  qrImage.onerror = function () {
    if (token !== currentRequestToken) return;
    setPreviewState('error');
  };

  // 赋值 src 触发加载（加时间戳避免缓存导致 onload 不触发）
  qrImage.src = url + '&_t=' + token;
  qrImage.alt = t('type_' + state.type) + ' QR code';
}

// 防抖生成（500ms）
function scheduleGenerate() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(function () {
    generate();
  }, 500);
}

// ---------- 历史记录 ----------
function addToHistory(type, inputs, options, data) {
  // 生成签名用于去重（与最近一条比较）
  const signature = type + '|' + data + '|' + options.size + '|' +
    options.fgColor + '|' + options.bgColor + '|' + options.ecc + '|' + options.margin;
  if (history.length && history[0].signature === signature) return; // 与最近一条相同，跳过

  const now = new Date();
  const timeStr = now.toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  history.unshift({
    signature: signature,
    type: type,
    inputs: Object.assign({}, inputs),
    options: Object.assign({}, options),
    data: data,
    label: buildHistoryLabel(type, data),
    timeStr: timeStr,
  });

  // 最多保留 20 条
  if (history.length > 20) history.length = 20;
  renderHistory();
}

function renderHistory() {
  if (!history.length) {
    historyList.innerHTML = '<p class="history-empty">' + t('noHistory') + '</p>';
    return;
  }
  historyList.innerHTML = history.map(function (h, i) {
    return '<button class="history-item" data-idx="' + i + '" type="button" aria-label="' + t('reload') + '">' +
      '<span class="history-type">' + t('type_' + h.type) + '</span>' +
      '<span class="history-label" title="' + OK.escape(h.label) + '">' + OK.escape(h.label) + '</span>' +
      '<span class="history-time">' + h.timeStr + '</span>' +
      '</button>';
  }).join('');

  // 绑定点击重新加载
  historyList.querySelectorAll('.history-item').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const idx = Number(btn.dataset.idx);
      loadFromHistory(idx);
    });
  });
}

// 从历史记录恢复并重新生成
function loadFromHistory(idx) {
  const h = history[idx];
  if (!h) return;
  state.type = h.type;
  state.inputs = Object.assign({}, h.inputs);
  state.options = Object.assign({}, h.options);

  // 同步控件
  syncOptionControls();
  // 同步类型 tabs
  setActiveType(h.type);
  // 重新渲染输入区
  renderInputs();
  // 立即生成
  generate();
}

// ---------- 同步选项控件到 state ----------
function syncOptionControls() {
  sizeSelect.value = String(state.options.size);
  fgColor.value = state.options.fgColor;
  bgColor.value = state.options.bgColor;
  fgColorValue.textContent = state.options.fgColor;
  bgColorValue.textContent = state.options.bgColor;
  eccSelect.value = state.options.ecc;
  marginRange.value = String(state.options.margin);
  marginValue.textContent = state.options.margin;
}

// ---------- 类型 tab 切换 ----------
function setActiveType(type) {
  state.type = type;
  typeTabs.querySelectorAll('.type-tab').forEach(function (tab) {
    const active = tab.dataset.type === type;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

// ---------- 下载 PNG ----------
async function downloadPng() {
  if (downloadBtn.disabled || !qrImage.src) return;
  downloadBtn.disabled = true;
  try {
    // 通过 fetch 获取图片 blob 再触发下载
    const res = await fetch(qrImage.src);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'qr-' + Date.now() + '.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // 释放 blob URL
    setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 1000);
  } catch (e) {
    alert(t('downloadError'));
  } finally {
    downloadBtn.disabled = false;
  }
}

// ---------- 语言应用 ----------
function applyLanguage() {
  lang = OK.lang;
  OK.applyI18n(copy);
  // 重新渲染动态文本（输入区标签、历史类型标签）
  renderInputs();
  renderHistory();
}

// ---------- 事件绑定 ----------
// 类型 tab 点击
typeTabs.addEventListener('click', function (e) {
  const tab = e.target.closest('.type-tab');
  if (!tab) return;
  const type = tab.dataset.type;
  if (type === state.type) return;
  setActiveType(type);
  renderInputs();
  scheduleGenerate();
});

// 尺寸
sizeSelect.addEventListener('change', function () {
  state.options.size = Number(sizeSelect.value);
  scheduleGenerate();
});

// 前景色
fgColor.addEventListener('input', function () {
  state.options.fgColor = fgColor.value;
  fgColorValue.textContent = fgColor.value;
  scheduleGenerate();
});

// 背景色
bgColor.addEventListener('input', function () {
  state.options.bgColor = bgColor.value;
  bgColorValue.textContent = bgColor.value;
  scheduleGenerate();
});

// 容错级别
eccSelect.addEventListener('change', function () {
  state.options.ecc = eccSelect.value;
  scheduleGenerate();
});

// 边距
marginRange.addEventListener('input', function () {
  state.options.margin = Number(marginRange.value);
  marginValue.textContent = marginRange.value;
  scheduleGenerate();
});

// 生成按钮（立即生成）
generateBtn.addEventListener('click', function () {
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
  generate();
});

// 下载按钮
downloadBtn.addEventListener('click', downloadPng);

// 清空历史
clearHistoryBtn.addEventListener('click', function () {
  history.length = 0;
  renderHistory();
});

// ---------- 初始化 ----------
OK.initLangToggle(langToggle, copy, applyLanguage);
applyLanguage();
// 首次生成
generate();
