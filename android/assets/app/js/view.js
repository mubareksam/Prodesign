/* Qalam — canvas viewport: rendering, pan/zoom/rotate, stylus input and the
 * Procreate-style gestures (two-finger pan/pinch/rotate, three-finger tap undo,
 * four-finger tap redo, long-press eyedropper, hold-to-snap QuickShape).
 */
(function () {
  'use strict';
  const Q = window.Q;

  function View(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.doc = null;
    this.scale = 1;
    this.rot = 0;
    this.tx = 0;
    this.ty = 0;
    this.dirty = true;
    this.stroke = null;
    this.pointers = new Map();
    this.g = null;                 // transform gesture
    this.gestureTap = false;
    this.tapCount = 0;
    this.brush = Q.BRUSHES[0];
    this.color = [24, 24, 26];
    this.size = 14;
    this.opacity = 1;
    this.tool = 'brush';
    this.onDocChange = null;
    this.onStrokeEnd = null;
    this.onUndo = null;
    this.onRedo = null;
    this.onPick = null;
    this.lastPointerType = 'touch';
    this.holdTimer = 0;
    this.holdStart = 0;
    this.onion = null;
    this.showGrid = false;
    this._loop = this._loop.bind(this);
    this._bindEvents();
    this.resize();
    requestAnimationFrame(this._loop);
  }

  /* ── geometry ───────────────────────────────────────────── */

  View.prototype.resize = function () {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * this.dpr));
    const h = Math.max(1, Math.round(rect.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.cssW = rect.width;
    this.cssH = rect.height;
    this.dirty = true;
  };

  View.prototype.toDoc = function (sx, sy) {
    const dx = sx - this.tx, dy = sy - this.ty;
    const c = Math.cos(-this.rot), s = Math.sin(-this.rot);
    const x = (dx * c - dy * s) / this.scale;
    const y = (dx * s + dy * c) / this.scale;
    return { x: x, y: y };
  };

  View.prototype.toScreen = function (x, y) {
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    return {
      x: this.tx + (x * c - y * s) * this.scale,
      y: this.ty + (x * s + y * c) * this.scale
    };
  };

  View.prototype.fit = function () {
    if (!this.doc) return;
    const pad = 0.86;
    const s = Math.min(this.cssW / this.doc.width, this.cssH / this.doc.height) * pad;
    this.scale = Math.max(0.02, s);
    this.rot = 0;
    this.tx = this.cssW / 2 - this.scale * this.doc.width / 2;
    this.ty = this.cssH / 2 - this.scale * this.doc.height / 2;
    this.dirty = true;
  };

  View.prototype.zoomAt = function (factor, sx, sy) {
    sx = sx == null ? this.cssW / 2 : sx;
    sy = sy == null ? this.cssH / 2 : sy;
    const before = this.toDoc(sx, sy);
    this.scale = Q.clamp(this.scale * factor, 0.02, 24);
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    this.tx = sx - (before.x * c - before.y * s) * this.scale;
    this.ty = sy - (before.x * s + before.y * c) * this.scale;
    this.dirty = true;
  };

  View.prototype.rotateBy = function (deg) {
    const cx = this.cssW / 2, cy = this.cssH / 2;
    const before = this.toDoc(cx, cy);
    this.rot += deg * Math.PI / 180;
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    this.tx = cx - (before.x * c - before.y * s) * this.scale;
    this.ty = cy - (before.x * s + before.y * c) * this.scale;
    this.dirty = true;
  };

  /* ── rendering ──────────────────────────────────────────── */

  View.prototype._loop = function () {
    if (this.dirty) {
      this.dirty = false;
      try { this.render(); } catch (e) { Q.fatal(e); }
    }
    requestAnimationFrame(this._loop);
  };

  View.prototype.onionCanvas = function () {
    if (!this._onionCv) this._onionCv = Q.canvas(this.doc.width, this.doc.height);
    if (this._onionCv.width !== this.doc.width || this._onionCv.height !== this.doc.height) {
      this._onionCv.width = this.doc.width;
      this._onionCv.height = this.doc.height;
    }
    return this._onionCv;
  };

  View.prototype.render = function () {
    const c = this.ctx;
    const doc = this.doc;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#0b0b0e';
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (!doc) return;

    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.translate(this.tx, this.ty);
    c.rotate(this.rot);
    c.scale(this.scale, this.scale);

    // paper
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.55)';
    c.shadowBlur = 26 / this.scale;
    c.shadowOffsetY = 8 / this.scale;
    c.fillStyle = doc.bg;
    c.fillRect(0, 0, doc.width, doc.height);
    c.restore();

    // onion skin
    if (doc.onion && doc.frames.length > 1) {
      const prev = doc.activeFrame - 1, next = doc.activeFrame + 1;
      if (prev >= 0) this._drawOnion(c, prev, '#ff5a7a', doc.onionAlpha * 0.85);
      if (next < doc.frames.length) this._drawOnion(c, next, '#4fd1c5', doc.onionAlpha * 0.85);
    }

    // artwork
    doc.composite(c, doc.activeFrame);

    // selection-free border
    c.lineWidth = 1 / this.scale;
    c.strokeStyle = 'rgba(255,255,255,0.12)';
    c.strokeRect(0, 0, doc.width, doc.height);
  };

  View.prototype._drawOnion = function (c, frameIdx, tint, alpha) {
    const doc = this.doc;
    const cv = this.onionCanvas();
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, cv.width, cv.height);
    doc.composite(g, frameIdx);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = tint;
    g.fillRect(0, 0, cv.width, cv.height);
    g.globalCompositeOperation = 'source-over';

    c.save();
    c.globalAlpha = alpha;
    c.drawImage(cv, 0, 0);
    c.restore();
  };

  View.prototype.pickDoc = function (dx, dy) {
    const doc = this.doc;
    if (!doc) return null;
    const x = Math.floor(dx), y = Math.floor(dy);
    if (x < 0 || y < 0 || x >= doc.width || y >= doc.height) return null;
    const frame = doc.frames[doc.activeFrame];
    if (!frame) return null;

    const rgb = Q.hexToRgb(doc.bg) || [255, 255, 255];
    let r = rgb[0], g = rgb[1], b = rgb[2];
    for (let i = 0; i < doc.layers.length; i++) {
      const layer = doc.layers[i];
      if (!layer.visible) continue;
      const cel = frame.cels[i];
      if (!cel) continue;
      const tmp = Q.canvas(1, 1);
      const tc = tmp.getContext('2d');
      tc.drawImage(cel, x, y, 1, 1, 0, 0, 1, 1);
      const d = tc.getImageData(0, 0, 1, 1).data;
      const a = (d[3] / 255) * layer.opacity;
      if (a <= 0.003) continue;
      r = d[0] * a + r * (1 - a);
      g = d[1] * a + g * (1 - a);
      b = d[2] * a + b * (1 - a);
    }
    return [Math.round(r), Math.round(g), Math.round(b)];
  };

  View.prototype.pick = function (sx, sy) {
    const p = this.toDoc(sx, sy);
    return this.pickDoc(p.x, p.y);
  };

  /* ── input ──────────────────────────────────────────────── */

  View.prototype._bindEvents = function () {
    const cv = this.canvas;
    const self = this;

    cv.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      self._down(e);
    }, { passive: false });

    cv.addEventListener('pointermove', function (e) {
      e.preventDefault();
      self._move(e);
    }, { passive: false });

    const up = function (e) {
      e.preventDefault();
      self._up(e);
    };
    cv.addEventListener('pointerup', up, { passive: false });
    cv.addEventListener('pointercancel', up, { passive: false });
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    window.addEventListener('resize', function () {
      self.resize();
      self.dirty = true;
    });
  };

  View.prototype._pos = function (e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  View.prototype._down = function (e) {
    if (!this.doc || this.locked) return;
    const pos = this._pos(e);
    this.lastPointerType = e.pointerType || 'touch';

    // a *stylus* stroke in progress ignores extra fingers (palm rejection);
    // when the stroke came from a finger, a second finger turns it into a
    // pinch/rotate gesture instead.
    if (this.stroke && this.strokePointerType === 'pen' && e.pointerType !== 'pen') return;

    try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    this.pointers.set(e.pointerId, {
      id: e.pointerId, type: e.pointerType || 'touch',
      x: pos.x, y: pos.y, startX: pos.x, startY: pos.y, t: Q.now(),
      pressure: this._pressure(e)
    });

    if (this.pointers.size === 1) {
      if (this.tool === 'eyedrop') {
        this._eyedropAt(pos.x, pos.y);
        return;
      }
      this._startStroke(pos, e);
    } else if (this.pointers.size === 2) {
      if (this.stroke) { this.stroke.cancel(); this.stroke = null; this.dirty = true; }
      this._startGesture();
    } else {
      // a third (or later) finger joins the running gesture: it only counts
      // toward the tap -> three-finger undo or four-finger redo
      if (this.g) this.g.maxPointers = Math.max(this.g.maxPointers, this.pointers.size);
      this.gestureTap = false;
    }
  };

  View.prototype._move = function (e) {
    const pos = this._pos(e);
    const rec = this.pointers.get(e.pointerId);
    if (!rec) return;
    rec.x = pos.x;
    rec.y = pos.y;

    if (this.g) { this._moveGesture(); return; }

    if (this.stroke && rec.id === this.strokePointerId) {
      const evs = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
      for (let i = 0; i < evs.length; i++) {
        const ev = evs[i];
        const p = this._pos(ev);
        const pt = this.toDoc(p.x, p.y);
        pt.pressure = this._pressure(ev);
        pt.t = Q.now();
        this.stroke.add(pt);
      }
      this._lastStampTime = Q.now();
      this.dirty = true;
    }
  };

  View.prototype._up = function (e) {
    const rec = this.pointers.get(e.pointerId);
    if (!rec) return;
    this.pointers.delete(e.pointerId);

    if (this.g) {
      const remaining = this.pointers.size;
      if (remaining === 0) {
        const tap = !this.g.moved;
        const n = this.g.maxPointers;
        this.g = null;
        if (tap) {
          if (n === 3) { if (this.onUndo) this.onUndo(); }
          else if (n === 4) { if (this.onRedo) this.onRedo(); }
        }
      } else if (remaining === 1) {
        // continue with the remaining finger for panning, without rotating
        this._startGesture();
      }
      return;
    }

    if (this.stroke && rec.id === this.strokePointerId) {
      const wasTap = Q.dist(rec.startX, rec.startY, rec.x, rec.y) < 6 && (Q.now() - rec.t) < 320;
      this._endStroke(wasTap);
    }
  };

  View.prototype._pressure = function (e) {
    const p = (e.pointerType === 'pen' || e.pointerType === 'mouse')
      ? (e.pressure || 0)
      : 1;
    if (p <= 0.001) return e.pointerType === 'pen' ? 0.35 : 1;
    return Q.clamp(p, 0.04, 1);
  };

  View.prototype._startStroke = function (pos, e) {
    const doc = this.doc;
    const layer = doc.layer(doc.activeLayer);
    if (!layer || !layer.visible) {
      Q.toast('This layer is hidden');
      return;
    }
    const p = this.toDoc(pos.x, pos.y);
    this.strokePointerId = e.pointerId;
    this.strokePointerType = e.pointerType || 'touch';
    const brushOpacity = this.opacity * (this.brush.opacity == null ? 1 : this.brush.opacity);
    this.stroke = new Q.Stroke(doc, this.brush, this.color, this.size, brushOpacity);
    this.stroke.begin({ x: p.x, y: p.y, pressure: this._pressure(e), t: Q.now() });
    this.strokeStartScreen = { x: pos.x, y: pos.y };
    if (this.onDrawStart) this.onDrawStart();
    this.strokeStartDoc = p;
    this.dirty = true;
    this._armHold();
  };

  View.prototype._endStroke = function (wasTap) {
    const stroke = this.stroke;
    if (!stroke) return;
    this._disarmHold();
    stroke.end();
    this.stroke = null;
    this.dirty = true;
    if (this.onStrokeEnd) this.onStrokeEnd(wasTap);
    if (this.onDocChange) this.onDocChange();
  };

  View.prototype._armHold = function () {
    const self = this;
    this._disarmHold();
    this.holdStart = Q.now();
    this.holdTimer = setInterval(function () {
      if (!self.stroke) { self._disarmHold(); return; }
      const idle = Q.now() - (self._lastStampTime || self.holdStart);
      if (idle < 380) return;
      if (self.stroke.len > self.stroke.size * 0.8) {
        self._disarmHold();
        self._quickShape();
      } else if (idle > 520) {
        self._disarmHold();
        self._holdEyedrop();
      }
    }, 120);
  };

  View.prototype._disarmHold = function () {
    if (this.holdTimer) { clearInterval(this.holdTimer); this.holdTimer = 0; }
  };

  // Press and hold without dragging: pick the colour under the pen and drop the dot.
  View.prototype._holdEyedrop = function () {
    const stroke = this.stroke;
    if (!stroke) return;
    const px = stroke.lx, py = stroke.ly;
    const rgb = this.pickDoc(px, py);
    stroke.cancel();
    this.stroke = null;
    this.dirty = true;
    if (rgb && this.onPick) {
      this.onPick(rgb);
      Q.haptic(14);
    }
  };

  View.prototype._quickShape = function () {
    const stroke = this.stroke;
    const doc = this.doc;
    if (!stroke || !stroke.cel) return;

    const p0 = this.strokeStartDoc;
    const p1 = { x: stroke.lx, y: stroke.ly };
    const w = Q.dist(p0.x, p0.y, p1.x, p1.y);
    const bbox = stroke.dirty;
    if (!bbox || w < 8) return;

    const closed = w < Math.max(bbox.w, bbox.h) * 0.55;
    stroke.cancel();
    this.stroke = null;

    // replay the idealised shape through a fresh stroke so it picks up brush dynamics
    const shape = closed ? this._ellipsePoints(bbox) : [p0, p1];
    const bop = this.opacity * (this.brush.opacity == null ? 1 : this.brush.opacity);
    const s2 = new Q.Stroke(doc, this.brush, this.color, this.size, bop);
    s2.begin({ x: shape[0].x, y: shape[0].y, pressure: 0.7, t: Q.now() });
    for (let i = 1; i < shape.length; i++) {
      s2.add({ x: shape[i].x, y: shape[i].y, pressure: 0.9, t: Q.now() + i });
    }
    s2.end();
    this.stroke = null;
    this.dirty = true;
    Q.haptic(12);
    Q.hint(closed ? 'Quickshape · ellipse' : 'Quickshape · line', 1200);
    if (this.onDocChange) this.onDocChange();
  };

  View.prototype._ellipsePoints = function (bbox) {
    const rx = bbox.w / 2, ry = bbox.h / 2;
    const cx = bbox.x + rx, cy = bbox.y + ry;
    const n = 76;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
    }
    return pts;
  };

  View.prototype._eyedropAt = function (sx, sy) {
    const rgb = this.pick(sx, sy);
    if (!rgb) return;
    if (this.onPick) this.onPick(rgb);
    Q.haptic(10);
  };

  /* ── transform gestures ─────────────────────────────────── */

  View.prototype._startGesture = function () {
    const pts = [];
    this.pointers.forEach(function (p) { pts.push(p); });
    if (pts.length < 1) { this.g = null; return; }
    let cx = 0, cy = 0;
    for (const p of pts) { cx += p.x; cy += p.y; }
    cx /= pts.length; cy /= pts.length;

    const prevMax = this.g ? this.g.maxPointers : 0;
    this.g = {
      maxPointers: Math.max(prevMax, pts.length),
      moved: false,
      startScale: this.scale,
      startRot: this.rot,
      startCx: cx, startCy: cy,
      anchor: this.toDoc(cx, cy),
      startDist: pts.length > 1 ? Q.dist(pts[0].x, pts[0].y, pts[1].x, pts[1].y) : 0,
      startAngle: pts.length > 1 ? Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) : 0
    };
  };

  View.prototype._moveGesture = function () {
    const g = this.g;
    const pts = [];
    this.pointers.forEach(function (p) { pts.push(p); });
    if (!pts.length) return;
    let cx = 0, cy = 0;
    for (const p of pts) { cx += p.x; cy += p.y; }
    cx /= pts.length; cy /= pts.length;

    let scale = g.startScale, rot = g.startRot;
    if (pts.length > 1) {
      const dist = Q.dist(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
      if (g.startDist > 8) scale = Q.clamp(g.startScale * (dist / g.startDist), 0.02, 24);
      const ang = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
      let da = ang - g.startAngle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      rot = g.startRot + da;
    }

    if (Math.abs(cx - g.startCx) > 10 || Math.abs(cy - g.startCy) > 10 ||
        Math.abs(scale / g.startScale - 1) > 0.04 || Math.abs(rot - g.startRot) > 0.05) {
      g.moved = true;
    }

    this.scale = scale;
    this.rot = rot;
    const c = Math.cos(rot), s = Math.sin(rot);
    this.tx = cx - (g.anchor.x * c - g.anchor.y * s) * scale;
    this.ty = cy - (g.anchor.x * s + g.anchor.y * c) * scale;
    this.dirty = true;
  };

  Q.View = View;
})();
