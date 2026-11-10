/* Qalam — brush presets and the stroke engine.
 *
 * Stamping model: a pointer path is resampled at a spacing proportional to the
 * brush size, and every sample stamps a shape whose width/alpha follow pressure,
 * speed and taper. Translucent brushes are accumulated in a scratch buffer and
 * composited once per flush, which keeps a stroke at a single, even opacity
 * instead of darkening where it overlaps itself.
 */
(function () {
  'use strict';
  const Q = window.Q;

  Q.BRUSHES = [
    {
      id: 'studio', name: 'Studio pen', engine: 'fill', hardness: 0.85,
      size: 14, opacity: 1, flow: 1, spacing: 0.06,
      pressureSize: 0.9, pressureAlpha: 0.3, velocitySize: 0.35,
      taperIn: 0.12, jitter: 0, scatter: 0, streamline: 0.25
    },
    {
      id: 'inking', name: 'Inking pen', engine: 'fill', hardness: 1,
      size: 7, opacity: 1, flow: 1, spacing: 0.035,
      pressureSize: 0.75, pressureAlpha: 0.15, velocitySize: 0.15,
      taperIn: 0.05, jitter: 0, scatter: 0, streamline: 0.45
    },
    {
      id: 'monoline', name: 'Monoline', engine: 'fill', hardness: 1,
      size: 9, opacity: 1, flow: 1, spacing: 0.04,
      pressureSize: 0, pressureAlpha: 0, velocitySize: 0,
      taperIn: 0, jitter: 0, scatter: 0, streamline: 0.55
    },
    {
      id: 'technical', name: 'Technical pencil', engine: 'grain', hardness: 0.7, grain: 0.5,
      size: 5, opacity: 1, flow: 0.55, spacing: 0.09,
      pressureSize: 0.5, pressureAlpha: 0.85, velocitySize: 0.2,
      taperIn: 0.1, jitter: 0.08, scatter: 0.18, streamline: 0.15
    },
    {
      id: 'pencil', name: '6B pencil', engine: 'grain', hardness: 0.35, grain: 0.85,
      size: 15, opacity: 0.92, flow: 0.42, spacing: 0.11,
      pressureSize: 0.65, pressureAlpha: 0.9, velocitySize: 0.25,
      taperIn: 0.1, jitter: 0.1, scatter: 0.22, streamline: 0.12
    },
    {
      id: 'marker', name: 'Marker', engine: 'soft', hardness: 0.8,
      size: 26, opacity: 0.55, flow: 0.85, spacing: 0.05,
      pressureSize: 0.3, pressureAlpha: 0.35, velocitySize: 0.1,
      taperIn: 0, jitter: 0, scatter: 0, streamline: 0.3
    },
    {
      id: 'airbrush', name: 'Airbrush', engine: 'soft', hardness: 0.05,
      size: 70, opacity: 0.85, flow: 0.12, spacing: 0.07,
      pressureSize: 0.5, pressureAlpha: 0.75, velocitySize: 0,
      taperIn: 0, jitter: 0.05, scatter: 0.05, streamline: 0.2
    },
    {
      id: 'charcoal', name: 'Charcoal', engine: 'grain', hardness: 0.3, grain: 1,
      size: 40, opacity: 0.95, flow: 0.35, spacing: 0.08,
      pressureSize: 0.55, pressureAlpha: 0.85, velocitySize: 0.3,
      taperIn: 0.08, jitter: 0.18, scatter: 0.3, streamline: 0.1
    },
    {
      id: 'water', name: 'Watercolour', engine: 'soft', hardness: 0.15,
      size: 55, opacity: 0.4, flow: 0.3, spacing: 0.05,
      pressureSize: 0.45, pressureAlpha: 0.55, velocitySize: 0.2,
      taperIn: 0.1, jitter: 0.12, scatter: 0.1, streamline: 0.35
    },
    {
      id: 'eraser', name: 'Hard eraser', engine: 'fill', hardness: 1, eraser: true,
      size: 30, opacity: 1, flow: 1, spacing: 0.05,
      pressureSize: 0.6, pressureAlpha: 0, velocitySize: 0,
      taperIn: 0, jitter: 0, scatter: 0, streamline: 0.3
    },
    {
      id: 'soft-eraser', name: 'Soft eraser', engine: 'soft', hardness: 0.1, eraser: true,
      size: 60, opacity: 0.55, flow: 0.6, spacing: 0.06,
      pressureSize: 0.4, pressureAlpha: 0.4, velocitySize: 0,
      taperIn: 0, jitter: 0, scatter: 0, streamline: 0.25
    }
  ];

  Q.brushById = function (id) {
    for (const b of Q.BRUSHES) if (b.id === id) return b;
    return Q.BRUSHES[0];
  };

  /* ── stamp sprites ──────────────────────────────────────── */

  const spriteCache = Object.create(null);
  const SPRITE = 128;

  Q.brushSprite = function (brush, rgb) {
    const key = brush.id + '|' + rgb.join(',') + '|' + (brush.hardness || 0).toFixed(2) + '|' + (brush.grain || 0).toFixed(2);
    if (spriteCache[key]) return spriteCache[key];

    const S = SPRITE, c = Q.canvas(S, S), g = c.getContext('2d');
    const mid = S / 2;

    if (brush.engine === 'grain') {
      const grain = brush.grain == null ? 0.7 : brush.grain;
      const hard = brush.hardness == null ? 0.4 : brush.hardness;
      const img = g.createImageData(S, S);
      const d = img.data;
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const dx = (x - mid) / mid, dy = (y - mid) / mid;
          const r = Math.sqrt(dx * dx + dy * dy);
          let fall = 1 - r;
          if (fall <= 0) continue;
          fall = Math.pow(fall, 0.45 + (1 - hard) * 1.4);
          const speck = Math.random();
          const a = fall * (1 - grain + grain * Math.pow(speck, 2.2));
          const i = (y * S + x) * 4;
          d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
          d[i + 3] = Math.max(0, Math.min(255, Math.round(a * 255)));
        }
      }
      g.putImageData(img, 0, 0);
    } else {
      const hard = Q.clamp(brush.hardness == null ? 0.4 : brush.hardness, 0, 1);
      const grad = g.createRadialGradient(mid, mid, mid * 0.02, mid, mid, mid);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(Math.min(0.97, 0.1 + hard * 0.85), 'rgba(255,255,255,0.95)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, S, S);
    }

    g.globalCompositeOperation = 'source-in';
    g.fillStyle = Q.rgba(rgb, 1);
    g.fillRect(0, 0, S, S);

    spriteCache[key] = c;
    return c;
  };

  /* a single doc-sized scratch canvas reused for wet strokes */
  let strokeBuf = null;
  Q.strokeBuffer = function (w, h) {
    if (!strokeBuf) strokeBuf = Q.canvas(w, h);
    if (strokeBuf.width !== w || strokeBuf.height !== h) {
      strokeBuf.width = w;
      strokeBuf.height = h;
    }
    return strokeBuf;
  };

  /* ── stroke ─────────────────────────────────────────────── */

  function Stroke(doc, brush, rgb, size, opacity) {
    this.doc = doc;
    this.brush = brush;
    this.rgb = rgb;
    this.size = Math.max(0.7, size);
    this.opacity = Q.clamp(opacity, 0.01, 1);
    this.eraser = !!brush.eraser;
    this.ctx = null;
    this.cel = null;
    this.dirty = null;
    this.pending = null;
    this.lx = 0; this.ly = 0;
    this.sx = 0; this.sy = 0;
    this.pressure = 1;
    this.speed = 0;
    this.len = 0;
    this.lastT = 0;
    this.wet = false;
    this.buf = null;
    this.bufCtx = null;
    this.sprite = null;
  }

  Stroke.prototype.begin = function (pt) {
    const doc = this.doc;
    this.cel = doc.activeCel(true);
    this.ctx = this.cel.getContext('2d');
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    doc.history.beginPixels(this.cel);

    this.wet = !this.eraser && (this.opacity < 0.995 || (this.brush.flow != null && this.brush.flow < 0.995));
    if (this.wet) {
      this.buf = Q.strokeBuffer(doc.width, doc.height);
      this.bufCtx = this.buf.getContext('2d');
      this.bufCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.bufCtx.globalAlpha = 1;
      this.bufCtx.globalCompositeOperation = 'source-over';
      this.bufCtx.clearRect(0, 0, doc.width, doc.height);
    }
    this.sprite = this.brush.engine === 'fill' ? null : Q.brushSprite(this.brush, this.rgb);

    this.lx = this.sx = pt.x;
    this.ly = this.sy = pt.y;
    this.pressure = pt.pressure == null ? 1 : pt.pressure;
    this.speed = 0;
    this.len = 0;
    this.lastT = pt.t || Q.now();
    this.dirty = null;
    this.pending = null;

    this._stamp(pt.x, pt.y, this.pressure, 0);
    this._flush();
  };

  Stroke.prototype.add = function (pt) {
    const b = this.brush;
    const t = pt.t || Q.now();
    const dt = Math.max(1, t - this.lastT);
    this.lastT = t;

    const rawD = Q.dist(this.lx, this.ly, pt.x, pt.y);
    const inst = rawD / dt;
    this.speed = Q.lerp(this.speed, inst, 0.35);

    let pressure = pt.pressure == null ? this.pressure : pt.pressure;
    if (pressure <= 0) pressure = 1;
    this.pressure = Q.lerp(this.pressure, pressure, 0.55);

    // streamline: first order filter on the pointer position
    const s = Q.clamp(b.streamline || 0, 0, 0.9);
    this.sx += (pt.x - this.sx) * (1 - s);
    this.sy += (pt.y - this.sy) * (1 - s);

    const tx = this.sx, ty = this.sy;
    const step = Math.max(0.7, this.size * (b.spacing || 0.06));
    let d = Q.dist(this.lx, this.ly, tx, ty);
    if (d < step) return;

    const ux = (tx - this.lx) / d, uy = (ty - this.ly) / d;
    const n = Math.floor(d / step);
    for (let i = 1; i <= n; i++) {
      const x = this.lx + ux * step * i;
      const y = this.ly + uy * step * i;
      this.len += step;
      this._stamp(x, y, this.pressure, this.speed);
    }
    this.lx += ux * step * n;
    this.ly += uy * step * n;
    this._flush();
  };

  Stroke.prototype._width = function (pressure, speed) {
    const b = this.brush;
    let w = this.size;
    if (b.pressureSize) w *= (1 - b.pressureSize) + b.pressureSize * Q.clamp(pressure, 0.03, 1);
    if (b.velocitySize) w *= 1 - b.velocitySize * Q.clamp(speed / 1.8, 0, 1);
    if (b.taperIn) {
      const reach = Math.max(6, this.size * b.taperIn * 8);
      const k = Q.clamp(this.len / reach, 0, 1);
      w *= 0.28 + 0.72 * k;
    }
    if (b.jitter) w *= 1 - b.jitter * Math.random();
    return Math.max(0.6, w);
  };

  Stroke.prototype._stamp = function (x, y, pressure, speed) {
    const b = this.brush;
    const w = this._width(pressure, speed);
    // a wet stroke builds up in the scratch buffer at "flow" and is composited
    // onto the layer at the stroke opacity, so opacity is applied exactly once
    let alpha = (b.flow == null ? 1 : b.flow);
    if (!this.wet) alpha *= this.opacity;
    if (b.pressureAlpha) alpha *= (1 - b.pressureAlpha) + b.pressureAlpha * Q.clamp(pressure, 0.03, 1);
    if (b.taperIn && this.len < this.size * b.taperIn * 8) {
      alpha *= 0.5 + 0.5 * Q.clamp(this.len / Math.max(6, this.size * b.taperIn * 8), 0, 1);
    }
    alpha = Q.clamp(alpha, 0.002, 1);

    let px = x, py = y;
    if (b.scatter) {
      px += (Math.random() - 0.5) * b.scatter * w * 2;
      py += (Math.random() - 0.5) * b.scatter * w * 2;
    }

    const target = this.wet ? this.bufCtx : this.ctx;
    target.save();
    if (this.eraser) {
      target.globalCompositeOperation = 'destination-out';
      target.globalAlpha = Q.clamp(alpha, 0.01, 1);
    } else {
      target.globalCompositeOperation = 'source-over';
      target.globalAlpha = this.wet ? Q.clamp(alpha, 0.01, 1) : alpha;
    }

    if (this.sprite) {
      const r = w * 0.5;
      target.drawImage(this.sprite, px - r, py - r, w, w);
    } else {
      target.beginPath();
      target.arc(px, py, w * 0.5, 0, Math.PI * 2);
      target.fillStyle = Q.rgba(this.rgb, 1);
      target.fill();
    }
    target.restore();

    this._grow(px, py, w);
  };

  Stroke.prototype._grow = function (x, y, w) {
    const pad = w * 0.62 + 3;
    const r = { x: x - pad, y: y - pad, w: pad * 2, h: pad * 2 };
    if (!this.dirty) this.dirty = r;
    else {
      const x2 = Math.max(this.dirty.x + this.dirty.w, r.x + r.w);
      const y2 = Math.max(this.dirty.y + this.dirty.h, r.y + r.h);
      this.dirty.x = Math.min(this.dirty.x, r.x);
      this.dirty.y = Math.min(this.dirty.y, r.y);
      this.dirty.w = x2 - this.dirty.x;
      this.dirty.h = y2 - this.dirty.y;
    }
    if (!this.pending) this.pending = r;
    else {
      const px2 = Math.max(this.pending.x + this.pending.w, r.x + r.w);
      const py2 = Math.max(this.pending.y + this.pending.h, r.y + r.h);
      this.pending.x = Math.min(this.pending.x, r.x);
      this.pending.y = Math.min(this.pending.y, r.y);
      this.pending.w = px2 - this.pending.x;
      this.pending.h = py2 - this.pending.y;
    }
  };

  Stroke.prototype._flush = function () {
    if (!this.wet || !this.pending || !this.ctx) return;
    const doc = this.doc;
    const r = this.pending;
    this.pending = null;

    const x = Math.max(0, Math.floor(r.x));
    const y = Math.max(0, Math.floor(r.y));
    const w = Math.min(doc.width - x, Math.ceil(r.w) + 1);
    const h = Math.min(doc.height - y, Math.ceil(r.h) + 1);
    if (w <= 0 || h <= 0) return;

    const ctx = this.ctx;
    const snap = doc.history.snap;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(x, y, w, h);
    if (snap) ctx.drawImage(snap, x, y, w, h, x, y, w, h);
    ctx.globalAlpha = this.opacity;
    ctx.drawImage(this.buf, x, y, w, h, x, y, w, h);
    ctx.restore();
  };

  Stroke.prototype.end = function () {
    this._flush();
    if (this.wet) {
      // make sure every pending pixel made it into the cel
      this.pending = this.dirty ? { x: this.dirty.x, y: this.dirty.y, w: this.dirty.w, h: this.dirty.h } : null;
      this._flush();
    }
    this.doc.history.endPixels(this.dirty);
    return this.dirty;
  };

  Stroke.prototype.cancel = function () {
    const doc = this.doc;
    if (!this.ctx) return;
    if (this.dirty) {
      const r = this.dirty;
      const x = Math.max(0, Math.floor(r.x)), y = Math.max(0, Math.floor(r.y));
      const w = Math.min(doc.width - x, Math.ceil(r.w) + 1);
      const h = Math.min(doc.height - y, Math.ceil(r.h) + 1);
      const ctx = this.ctx;
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(x, y, w, h);
      if (doc.history.snap) ctx.drawImage(doc.history.snap, x, y, w, h, x, y, w, h);
      ctx.restore();
    }
    this.dirty = null;
    this.pending = null;
  };

  Q.Stroke = Stroke;

  /* brush preview used by the brush picker */
  Q.brushPreview = function (brush, canvas, rgb) {
    const c = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    c.clearRect(0, 0, w, h);
    const doc = {
      width: w, height: h,
      activeCel: function () {
        const cv = Q.canvas(w, h);
        return cv;
      },
      history: { beginPixels: function () { }, endPixels: function () { }, snap: null }
    };
    // simple tapered stroke drawn by hand so previews reflect size/pressure
    const mid = h / 2;
    c.strokeStyle = Q.rgba(rgb || [240, 236, 232], 1);
    c.lineCap = 'round';
    for (let i = 0; i < w; i += 1) {
      const t = i / w;
      const taper = Math.min(1, Math.min(t, 1 - t) * 6);
      const pressure = 0.35 + 0.65 * Math.sin(Math.PI * t);
      const width = (brush.engine === 'fill' ? 3.2 : 5) * taper * (0.5 + pressure * 0.9);
      const y = mid + Math.sin(t * 3.4) * (h * 0.16);
      c.globalAlpha = brush.engine === 'fill' ? 0.95 : 0.6;
      c.fillStyle = Q.rgba(rgb || [240, 236, 232], 1);
      c.beginPath();
      c.arc(i, y, Math.max(0.5, width * 0.5), 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    void doc;
  };
})();
