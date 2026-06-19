/* ============================================================
   OpenKee Tools — Shared Script
   放在 /workspace/shared.js，各 app 通过 ../../shared.js 引用。
   暴露全局对象 window.OK，提供 i18n、语言切换、通用辅助。
   ============================================================ */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'openkee-lang';

  var OK = {
    /* 当前语言：'en' | 'zh' */
    lang: global.localStorage ? (localStorage.getItem(STORAGE_KEY) || 'en') : 'en',

    /**
     * 翻译取值。
     * @param {string} key - 文案 key
     * @param {Object} dict - 形如 { en: {...}, zh: {...} }
     */
    t: function (key, dict) {
      var table = dict[OK.lang] || dict.en || {};
      return table[key] != null ? table[key] : key;
    },

    /**
     * 将页面中所有 [data-i18n] 节点的文本替换为对应翻译。
     * @param {Object} dict - 形如 { en: {...}, zh: {...} }
     */
    applyI18n: function (dict) {
      document.documentElement.lang = OK.lang;
      var nodes = document.querySelectorAll('[data-ok-i18n]');
      nodes.forEach(function (n) {
        n.textContent = OK.t(n.dataset.okI18n, dict);
      });
    },

    /**
     * 初始化语言切换按钮。
     * @param {HTMLButtonElement} btn - 切换按钮
     * @param {Object} dict - 翻译字典
     * @param {Function} [onToggle] - 切换后的回调（通常用于重渲染动态内容）
     */
    initLangToggle: function (btn, dict, onToggle) {
      if (!btn) return;
      btn.setAttribute('aria-label', 'Switch language');
      btn.type = 'button';

      function refresh() {
        btn.textContent = OK.lang === 'en' ? '中文' : 'EN';
      }
      refresh();

      btn.addEventListener('click', function () {
        OK.lang = OK.lang === 'en' ? 'zh' : 'en';
        try { localStorage.setItem(STORAGE_KEY, OK.lang); } catch (e) {}
        OK.applyI18n(dict);
        refresh();
        if (typeof onToggle === 'function') onToggle();
      });
    },

    /**
     * DOM 就绪后执行（兼容老浏览器）。
     */
    ready: function (fn) {
      if (document.readyState !== 'loading') {
        fn();
      } else {
        document.addEventListener('DOMContentLoaded', fn);
      }
    },

    /**
     * 转义 HTML，防止 XSS。
     */
    escape: function (str) {
      return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    /**
     * 简易 fetch 封装，带超时。
     */
    fetchJSON: function (url, opts) {
      opts = opts || {};
      var timeout = opts.timeout || 12000;
      var controller = global.AbortController ? new AbortController() : null;
      var timer = controller ? setTimeout(function () { controller.abort(); }, timeout) : null;
      return fetch(url, Object.assign({}, opts, controller ? { signal: controller.signal } : {}))
        .then(function (r) {
          if (timer) clearTimeout(timer);
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        });
    }
  };

  global.OK = OK;
})(window);
