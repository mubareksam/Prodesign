/* Qalam — small helpers shared by every module. */
(function () {
  'use strict';
  const Q = (window.Q = window.Q || {});

  Q.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  Q.lerp = function (a, b, t) { return a + (b - a) * t; };
  Q.dist = function (x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); };
  Q.uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };
  Q.now = function () { return (window.performance && performance.now) ? performance.now() : Date.now(); };
  Q.raf = function (fn) { return window.requestAnimationFrame(fn); };

  Q.el = function (sel, root) { return (root || document).querySelector(sel); };
  Q.els = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  Q.crel = function (tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  Q.canvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  };

  Q.ctx2d = function (canvas) {
    return canvas.getContext('2d', { alpha: true, desynchronized: true });
  };

  Q.copyCanvas = function (src, dst) {
    dst = dst || Q.canvas(src.width, src.height);
    if (dst.width !== src.width || dst.height !== src.height) { dst.width = src.width; dst.height = src.height; }
    const c = dst.getContext('2d');
    c.clearRect(0, 0, dst.width, dst.height);
    c.drawImage(src, 0, 0);
    return dst;
  };

  Q.debounce = function (fn, ms) {
    let t = 0;
    return function () {
      const args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  };

  /* ── colour ─────────────────────────────────────────────── */

  Q.hsvToRgb = function (h, s, v) {
    h = ((h % 360) + 360) % 360 / 60;
    const c = v * s;
    const x = c * (1 - Math.abs((h % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 1) { r = c; g = x; }
    else if (h < 2) { r = x; g = c; }
    else if (h < 3) { g = c; b = x; }
    else if (h < 4) { g = x; b = c; }
    else if (h < 5) { r = x; b = c; }
    else { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  };

  Q.rgbToHsv = function (r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return [h, max ? d / max : 0, max];
  };

  Q.hexToRgb = function (hex) {
    hex = String(hex || '').replace('#', '').trim();
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    if (hex.length !== 6 || /[^0-9a-f]/i.test(hex)) return null;
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  };

  Q.rgbToHex = function (rgb) {
    return '#' + rgb.map(function (v) {
      const s = Q.clamp(Math.round(v), 0, 255).toString(16);
      return s.length === 1 ? '0' + s : s;
    }).join('');
  };

  Q.rgba = function (rgb, a) {
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (a == null ? 1 : a) + ')';
  };

  /* ── tiny UI helpers ────────────────────────────────────── */

  let toastTimer = 0;
  Q.toast = function (msg, ms) {
    const t = Q.el('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 1900);
  };

  let hintTimer = 0;
  Q.hint = function (msg, ms) {
    const t = Q.el('#hint');
    if (!t) return;
    if (!msg) { t.classList.remove('show'); return; }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 2400);
  };

  Q.haptic = function (ms) {
    if (navigator.vibrate) { try { navigator.vibrate(ms || 8); } catch (e) { /* ignore */ } }
  };

  Q.fatal = function (err) {
    console.error(err);
    let box = document.getElementById('fatal');
    if (!box) {
      box = Q.crel('div');
      box.id = 'fatal';
      document.body.appendChild(box);
    }
    const text = (err && (err.stack || err.message)) || String(err);
    box.textContent = 'Qelem hit an error\n\n' + text;
  };

  window.addEventListener('error', function (e) {
    if (e && e.error) Q.fatal(e.error);
  });
  window.addEventListener('unhandledrejection', function (e) {
    if (e && e.reason) Q.fatal(e.reason);
  });

  /* ── native bridge (absent when running in a plain browser) ── */

  Q.native = function () { return window.QalamNative || null; };

  Q.saveBytes = function (dataUrl, mime, name) {
    const b64 = String(dataUrl).split(',')[1] || '';
    const nat = Q.native();
    if (nat && nat.saveImage) {
      try { return nat.saveImage(b64, mime, name); } catch (e) { console.warn('native save failed', e); }
    }
    // browser fallback so the same code can be tested on a desktop
    try {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      return true;
    } catch (e) {
      return false;
    }
  };

  Q.stamp = function (d) {
    const x = new Date(d || Date.now());
    const p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return x.getFullYear() + p(x.getMonth() + 1) + p(x.getDate()) + '-' + p(x.getHours()) + p(x.getMinutes()) + p(x.getSeconds());
  };
})();
