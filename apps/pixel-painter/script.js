/* ============================================================
   Pixel Painter — 像素画板逻辑
   纯本地 Canvas 像素编辑器：画笔/橡皮/填充/吸管、撤销重做、
   镜像绘制、网格切换、PNG 导出。所有数据保留在浏览器内。
   ============================================================ */
(function () {
  'use strict';

  // ---------- i18n 文案 ----------
  var copy = {
    en: {
      eyebrow: 'Pixel art studio',
      title: 'Pixel Painter',
      lead: 'A tiny browser canvas for pixel art. Pick a tool, choose a color, and start drawing — everything stays on your device.',
      tools: 'Tools',
      toolBrush: 'Brush',
      toolEraser: 'Eraser',
      toolFill: 'Fill',
      toolEyedropper: 'Eyedropper',
      sizeLabel: 'Canvas size',
      mirrorLabel: 'Mirror',
      mirrorNone: 'None',
      mirrorH: 'Horizontal',
      mirrorV: 'Vertical',
      mirrorBoth: 'Both',
      actions: 'Actions',
      undo: 'Undo',
      redo: 'Redo',
      grid: 'Grid',
      clear: 'Clear',
      export: 'Export PNG',
      exportSize: 'Export scale',
      paletteLabel: 'Palette',
      customColor: 'Custom color',
      recentLabel: 'Recent',
      currentLabel: 'Current',
      hint: 'Click and drag to draw. Pick a tool on the left and a color on the right.',
      shortcuts: 'Shortcuts: Ctrl+Z undo · Ctrl+Y redo · B/E/F/I tools · G grid',
      clearConfirm: 'Clear the entire canvas? This can be undone with Ctrl+Z.',
      recentEmpty: 'No colors yet',
      randomPalette: 'Random palette',
      paletteError: 'Failed to load palette'
    },
    zh: {
      eyebrow: '像素画工作室',
      title: '像素画板',
      lead: '一个轻量的浏览器像素画布。选好工具与颜色即可开始创作，所有数据都保留在本地。',
      tools: '工具',
      toolBrush: '画笔',
      toolEraser: '橡皮',
      toolFill: '油漆桶',
      toolEyedropper: '吸管',
      sizeLabel: '画布尺寸',
      mirrorLabel: '镜像',
      mirrorNone: '无',
      mirrorH: '水平',
      mirrorV: '垂直',
      mirrorBoth: '双向',
      actions: '操作',
      undo: '撤销',
      redo: '重做',
      grid: '网格',
      clear: '清空',
      export: '导出 PNG',
      exportSize: '导出倍率',
      paletteLabel: '调色板',
      customColor: '自定义颜色',
      recentLabel: '最近使用',
      currentLabel: '当前颜色',
      hint: '点击并拖动鼠标绘制。在左侧选工具，右侧选颜色。',
      shortcuts: '快捷键：Ctrl+Z 撤销 · Ctrl+Y 重做 · B/E/F/I 切换工具 · G 网格',
      clearConfirm: '确定清空整个画布吗？可用 Ctrl+Z 撤销。',
      recentEmpty: '暂无颜色',
      randomPalette: '随机调色板',
      paletteError: '加载调色板失败'
    }
  };

  // ---------- 常量 ----------
  var PIXEL_SIZE = 24;          // 每个像素格的显示尺寸（内部分辨率）
  var MAX_UNDO = 50;            // 撤销栈最大步数
  var MAX_RECENT = 8;           // 最近使用色最大数量
  // 预设 24 色调色板
  var PRESET = [
    '#000000', '#1a1a2e', '#4a4a6a', '#8b8b9e', '#cccccc', '#ffffff',
    '#7f1d1d', '#dc2626', '#f97316', '#facc15', '#84cc16', '#22c55e',
    '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
    '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#92400e', '#fbbf24'
  ];
  // 透明格的棋盘格两色（明亮主题）
  var CHECKER_A = '#ffffff';
  var CHECKER_B = '#eeeef4';
  var GRID_COLOR = 'rgba(26,26,46,0.18)';

  // ---------- DOM 引用 ----------
  var canvas = document.getElementById('board');
  var ctx = canvas.getContext('2d');
  var toolGrid = document.getElementById('toolGrid');
  var sizeGrid = document.getElementById('sizeGrid');
  var mirrorGrid = document.getElementById('mirrorGrid');
  var undoBtn = document.getElementById('undoBtn');
  var redoBtn = document.getElementById('redoBtn');
  var gridBtn = document.getElementById('gridBtn');
  var clearBtn = document.getElementById('clearBtn');
  var exportBtn = document.getElementById('exportBtn');
  var exportScale = document.getElementById('exportScale');
  var randomPaletteBtn = document.getElementById('randomPaletteBtn');
  var paletteEl = document.getElementById('palette');
  var recentEl = document.getElementById('recent');
  var customColor = document.getElementById('customColor');
  var currentSwatch = document.getElementById('currentSwatch');
  var currentHex = document.getElementById('currentHex');
  var langBtn = document.getElementById('langBtn');

  // ---------- 状态 ----------
  var state = { grid: 16, pixels: emptyPixels(16) };
  var currentTool = 'brush';        // brush | eraser | fill | eyedropper
  var currentColor = '#ec4899';
  var mirrorMode = 'none';          // none | h | v | both
  var showGrid = true;
  var recentColors = [];
  var undoStack = [];
  var redoStack = [];

  // 绘制调度（按需重绘 + requestAnimationFrame）
  var renderPending = false;
  // 拖动绘制时的上一个像素坐标，用于连线插值
  var lastPixel = null;
  var drawing = false;

  // ---------- 工具函数 ----------
  function emptyPixels(grid) {
    return new Array(grid * grid).fill(null);
  }

  function t(key) { return OK.t(key, copy); }

  // 根据网格尺寸重设画布内部分辨率
  function resizeCanvas() {
    canvas.width = state.grid * PIXEL_SIZE;
    canvas.height = state.grid * PIXEL_SIZE;
  }

  // ---------- 渲染 ----------
  function scheduleRender() {
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(render);
  }

  function render() {
    renderPending = false;
    var g = state.grid;
    var ps = PIXEL_SIZE;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 逐格绘制
    for (var y = 0; y < g; y++) {
      for (var x = 0; x < g; x++) {
        var c = state.pixels[y * g + x];
        if (c) {
          ctx.fillStyle = c;
        } else {
          // 透明格画棋盘格底
          ctx.fillStyle = ((x + y) % 2 === 0) ? CHECKER_A : CHECKER_B;
        }
        ctx.fillRect(x * ps, y * ps, ps, ps);
      }
    }
    // 网格线
    if (showGrid) {
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var i = 0; i <= g; i++) {
        var p = i * ps + 0.5;
        ctx.moveTo(p, 0); ctx.lineTo(p, canvas.height);
        ctx.moveTo(0, p); ctx.lineTo(canvas.width, p);
      }
      ctx.stroke();
    }
  }

  // ---------- 坐标映射 ----------
  function eventToPixel(e) {
    var rect = canvas.getBoundingClientRect();
    var cx = (e.clientX - rect.left) * (canvas.width / rect.width);
    var cy = (e.clientY - rect.top) * (canvas.height / rect.height);
    var x = Math.floor(cx / PIXEL_SIZE);
    var y = Math.floor(cy / PIXEL_SIZE);
    if (x < 0 || y < 0 || x >= state.grid || y >= state.grid) return null;
    return { x: x, y: y };
  }

  // ---------- 像素绘制（含镜像） ----------
  function setPixel(x, y, color) {
    var g = state.grid;
    state.pixels[y * g + x] = color;
    if (mirrorMode === 'h' || mirrorMode === 'both') {
      state.pixels[y * g + (g - 1 - x)] = color;
    }
    if (mirrorMode === 'v' || mirrorMode === 'both') {
      state.pixels[(g - 1 - y) * g + x] = color;
    }
    if (mirrorMode === 'both') {
      state.pixels[(g - 1 - y) * g + (g - 1 - x)] = color;
    }
  }

  // Bresenham 直线插值，保证快速拖动不留空隙
  function drawLine(x0, y0, x1, y1, color) {
    var dx = Math.abs(x1 - x0);
    var dy = Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1;
    var sy = y0 < y1 ? 1 : -1;
    var err = dx - dy;
    while (true) {
      setPixel(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  // ---------- 油漆桶填充（flood fill） ----------
  function floodFill(sx, sy, fillCol) {
    var g = state.grid;
    var target = state.pixels[sy * g + sx];
    if (target === fillCol) return;
    var stack = [[sx, sy]];
    while (stack.length) {
      var pt = stack.pop();
      var x = pt[0], y = pt[1];
      if (x < 0 || y < 0 || x >= g || y >= g) continue;
      if (state.pixels[y * g + x] !== target) continue;
      state.pixels[y * g + x] = fillCol;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }

  // 镜像模式下的填充：对镜像点也各自做一次填充
  function fillAt(x, y, color) {
    floodFill(x, y, color);
    var g = state.grid;
    if (mirrorMode === 'h' || mirrorMode === 'both') floodFill(g - 1 - x, y, color);
    if (mirrorMode === 'v' || mirrorMode === 'both') floodFill(x, g - 1 - y, color);
    if (mirrorMode === 'both') floodFill(g - 1 - x, g - 1 - y, color);
  }

  // ---------- 撤销 / 重做 ----------
  function snapshot() {
    return { grid: state.grid, pixels: state.pixels.slice() };
  }

  function pushUndo() {
    undoStack.push(snapshot());
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
    updateUndoRedoUI();
  }

  function applySnapshot(s) {
    state.grid = s.grid;
    state.pixels = s.pixels.slice();
    resizeCanvas();
    syncSizeUI();
    scheduleRender();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    applySnapshot(undoStack.pop());
    updateUndoRedoUI();
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    applySnapshot(redoStack.pop());
    updateUndoRedoUI();
  }

  function updateUndoRedoUI() {
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
  }

  // ---------- 颜色管理 ----------
  function setColor(color) {
    currentColor = color;
    currentSwatch.style.background = color;
    currentHex.textContent = color.toUpperCase();
    customColor.value = color;
    // 调色板高亮
    var swatches = paletteEl.querySelectorAll('.swatch');
    swatches.forEach(function (s) {
      s.classList.toggle('active', s.dataset.color === color);
    });
  }

  function addRecent(color) {
    if (!color) return;
    var idx = recentColors.indexOf(color);
    if (idx !== -1) recentColors.splice(idx, 1);
    recentColors.unshift(color);
    if (recentColors.length > MAX_RECENT) recentColors.length = MAX_RECENT;
    renderRecent();
  }

  function renderPalette() {
    paletteEl.innerHTML = '';
    PRESET.forEach(function (c) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.style.background = c;
      btn.dataset.color = c;
      btn.setAttribute('aria-label', c);
      btn.addEventListener('click', function () { setColor(c); });
      paletteEl.appendChild(btn);
    });
    // 高亮当前色
    setColor(currentColor);
  }

  function loadRandomPalette() {
    var seed = Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    fetch('https://www.thecolorapi.com/scheme?hex=' + seed + '&mode=analogic&count=8')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var colors = [];
        for (var i = 0; i < data.colors.length && colors.length < 8; i++) {
          colors.push('#' + data.colors[i].hex.clean);
        }
        PRESET = colors;
        renderPalette();
      })
      .catch(function () {
        alert(t('paletteError'));
      });
  }

  function renderRecent() {
    recentEl.innerHTML = '';
    if (!recentColors.length) {
      var empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = t('recentEmpty');
      recentEl.appendChild(empty);
      return;
    }
    recentColors.forEach(function (c) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.style.background = c;
      btn.dataset.color = c;
      btn.setAttribute('aria-label', c);
      btn.addEventListener('click', function () { setColor(c); });
      recentEl.appendChild(btn);
    });
  }

  // ---------- 工具 / 尺寸 / 镜像 UI ----------
  function setTool(tool) {
    currentTool = tool;
    var btns = toolGrid.querySelectorAll('.tool-btn');
    btns.forEach(function (b) {
      b.classList.toggle('active', b.dataset.tool === tool);
    });
    // 光标提示
    canvas.style.cursor = (tool === 'eyedropper') ? 'copy' : 'crosshair';
  }

  function syncSizeUI() {
    var btns = sizeGrid.querySelectorAll('.size-btn');
    btns.forEach(function (b) {
      b.classList.toggle('active', Number(b.dataset.size) === state.grid);
    });
  }

  function setSize(newGrid) {
    if (newGrid === state.grid) return;
    pushUndo();                       // 保存旧状态（含旧尺寸），可撤销
    state.grid = newGrid;
    state.pixels = emptyPixels(newGrid);
    resizeCanvas();
    syncSizeUI();
    scheduleRender();
  }

  function setMirror(mode) {
    mirrorMode = mode;
    var btns = mirrorGrid.querySelectorAll('.mirror-btn');
    btns.forEach(function (b) {
      b.classList.toggle('active', b.dataset.mirror === mode);
    });
  }

  function toggleGrid() {
    showGrid = !showGrid;
    gridBtn.classList.toggle('active', showGrid);
    scheduleRender();
  }

  // ---------- 清空 ----------
  function clearCanvas() {
    if (!state.pixels.some(function (p) { return p !== null; })) return;
    if (!window.confirm(t('clearConfirm'))) return;
    pushUndo();
    state.pixels = emptyPixels(state.grid);
    scheduleRender();
  }

  // ---------- 导出 PNG ----------
  function exportPNG() {
    var scale = Number(exportScale.value) || 1;
    var g = state.grid;
    var out = document.createElement('canvas');
    out.width = g * scale;
    out.height = g * scale;
    var octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;
    for (var y = 0; y < g; y++) {
      for (var x = 0; x < g; x++) {
        var c = state.pixels[y * g + x];
        if (c) {
          octx.fillStyle = c;
          octx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
    var url = out.toDataURL('image/png');
    var a = document.createElement('a');
    a.href = url;
    a.download = 'pixel-' + g + 'x' + g + '.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ---------- 绘制交互（pointer 事件统一鼠标 + 触摸） ----------
  function handlePointerDown(e) {
    var p = eventToPixel(e);
    if (!p) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);

    if (currentTool === 'eyedropper') {
      var picked = state.pixels[p.y * state.grid + p.x];
      if (picked) { setColor(picked); addRecent(picked); }
      return;
    }

    drawing = true;
    lastPixel = p;
    pushUndo();   // 一笔开始前保存一次状态，整笔作为一个撤销步

    if (currentTool === 'fill') {
      fillAt(p.x, p.y, currentColor);
      addRecent(currentColor);
      scheduleRender();
      drawing = false;
      return;
    }

    var col = (currentTool === 'eraser') ? null : currentColor;
    setPixel(p.x, p.y, col);
    if (currentTool === 'brush') addRecent(currentColor);
    scheduleRender();
  }

  function handlePointerMove(e) {
    if (!drawing) return;
    var p = eventToPixel(e);
    if (!p) return;
    e.preventDefault();
    if (lastPixel && (lastPixel.x !== p.x || lastPixel.y !== p.y)) {
      var col = (currentTool === 'eraser') ? null : currentColor;
      drawLine(lastPixel.x, lastPixel.y, p.x, p.y, col);
      lastPixel = p;
      scheduleRender();
    }
  }

  function handlePointerUp(e) {
    drawing = false;
    lastPixel = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
  }

  // ---------- 快捷键 ----------
  function handleKeydown(e) {
    var ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
      return;
    }
    if (ctrl && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
      return;
    }
    // 工具快捷键（避免在输入框中触发）
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    switch (e.key.toLowerCase()) {
      case 'b': setTool('brush'); break;
      case 'e': setTool('eraser'); break;
      case 'f': setTool('fill'); break;
      case 'i': setTool('eyedropper'); break;
      case 'g': toggleGrid(); break;
    }
  }

  // ---------- 动态文案（title 等需要手动更新的属性） ----------
  function applyDynamic() {
    var tips = {
      brush: 'B', eraser: 'E', fill: 'F', eyedropper: 'I'
    };
    toolGrid.querySelectorAll('.tool-btn').forEach(function (b) {
      var key = b.dataset.tool;
      var labelKey = { brush: 'toolBrush', eraser: 'toolEraser', fill: 'toolFill', eyedropper: 'toolEyedropper' }[key];
      b.title = t(labelKey) + ' (' + tips[key] + ')';
    });
    undoBtn.title = t('undo') + ' (Ctrl+Z)';
    redoBtn.title = t('redo') + ' (Ctrl+Y)';
    gridBtn.title = t('grid') + ' (G)';
    clearBtn.title = t('clear');
    exportBtn.title = t('export');
    renderRecent(); // recentEmpty 文案随语言变化
  }

  // ---------- 事件绑定 ----------
  function bindEvents() {
    // 工具
    toolGrid.addEventListener('click', function (e) {
      var btn = e.target.closest('.tool-btn');
      if (btn) setTool(btn.dataset.tool);
    });
    // 尺寸
    sizeGrid.addEventListener('click', function (e) {
      var btn = e.target.closest('.size-btn');
      if (btn) setSize(Number(btn.dataset.size));
    });
    // 镜像
    mirrorGrid.addEventListener('click', function (e) {
      var btn = e.target.closest('.mirror-btn');
      if (btn) setMirror(btn.dataset.mirror);
    });
    // 操作
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    gridBtn.addEventListener('click', toggleGrid);
    clearBtn.addEventListener('click', clearCanvas);
    exportBtn.addEventListener('click', exportPNG);
    randomPaletteBtn.addEventListener('click', loadRandomPalette);
    // 自定义颜色
    customColor.addEventListener('input', function () { setColor(customColor.value); });
    // 画布绘制
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    // 快捷键
    window.addEventListener('keydown', handleKeydown);
  }

  // ---------- 初始化 ----------
  function init() {
    resizeCanvas();
    renderPalette();
    renderRecent();
    setColor(currentColor);
    setTool('brush');
    setMirror('none');
    syncSizeUI();
    gridBtn.classList.add('active');   // 默认显示网格
    updateUndoRedoUI();
    bindEvents();
    OK.applyI18n(copy);
    applyDynamic();
    OK.initLangToggle(langBtn, copy, function onToggle() {
      applyDynamic();
    });
    scheduleRender();
  }

  OK.ready(init);
})();
