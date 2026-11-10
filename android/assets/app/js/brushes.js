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

  // Additional variants share the same tested stamping engines but have distinct dynamics.
  [
    ['fineliner','Fine liner','inking',{size:3, pressureSize:0.15, streamline:0.4}],
    ['calligraphy','Calligraphy','studio',{size:24, pressureSize:0.95, taperIn:0.3}],
    ['dry-ink','Dry ink','technical',{size:12, grain:0.7, flow:0.65}],
    ['graphite','Graphite','pencil',{size:9, grain:0.55, flow:0.55}],
    ['pastel','Soft pastel','charcoal',{size:34, grain:0.65, flow:0.55}],
    ['gouache','Gouache','water',{size:36, hardness:0.65, opacity:0.8, flow:0.7}],
    ['wash','Light wash','water',{size:85, opacity:0.25, flow:0.2}],
    ['spray','Spray','airbrush',{size:95, scatter:0.2, flow:0.08}],
    ['highlighter','Highlighter','marker',{size:42, opacity:0.28, pressureSize:0}],
    ['brush-pen','Brush pen','studio',{size:20,pressureSize:0.95,velocitySize:0.18,taperIn:0.18}],
    ['fine-ink','Needle ink','inking',{size:4,pressureSize:0.4,streamline:0.6}],
    ['sketch','Sketch pencil','technical',{size:10,grain:0.9,flow:0.38,scatter:0.3}],
    ['chalk','Chalk','charcoal',{size:28,grain:0.9,flow:0.5,scatter:0.45}],
    ['crayon','Crayon','pencil',{size:25,grain:0.95,flow:0.65,scatter:0.32}],
    ['soft-paint','Soft paint','water',{size:48,hardness:0.38,opacity:0.65,flow:0.5}],
    ['mist','Fine mist','airbrush',{size:125,flow:0.06,scatter:0.12}],
    ['glaze','Glaze','marker',{size:52,opacity:0.22,flow:0.5}]

  ].forEach(function (entry) {
    const base = Q.BRUSHES.find(function (brush) { return brush.id === entry[2]; });
    Q.BRUSHES.push(Object.assign({}, base, entry[3], { id: entry[0], name: entry[1] }));
  });
  Q.BRUSH_DEFAULTS = Q.BRUSHES.map(function (b) { return Object.assign({}, b); });
  Q.restoreBrushSettings = function (saved) {
    if (!saved || typeof saved !== 'object') return;
    const fields = ['spacing', 'flow', 'opacity', 'hardness', 'grain', 'pressureSize', 'pressureAlpha', 'streamline', 'scatter', 'jitter', 'velocitySize', 'taperIn'];
    Q.BRUSHES.forEach(function (brush) {
      const settings = saved[brush.id];
      if (!settings || typeof settings !== 'object') return;
      fields.forEach(function (key) {
        if (typeof settings[key] === 'number' && isFinite(settings[key])) brush[key] = Q.clamp(settings[key], key === 'spacing' ? 0.02 : 0, 1);
      });
    });
  };

  // Custom profiles are independent copies of existing engines, not imported
  // tips. Keep defaults separately so Reset returns to the copied profile.
  const customKey='qelem-custom-brushes', customFields=['hardness','size','opacity','flow','spacing','pressureSize','pressureAlpha','velocitySize','taperIn','jitter','scatter','streamline','grain'];
  let customRecords=[];
  function validValue(key,v) { return typeof v==='number' && Number.isFinite(v) && v>=(key==='size' ? 1 : key==='spacing' ? 0.02 : 0) && v<=(key==='size' ? 240 : key==='streamline' ? 0.9 : 1); }
  function cleanProfile(p) {
    if(!p || typeof p!=='object' || !['fill','soft','grain'].includes(p.engine) || typeof p.eraser!=='boolean') return null;
    const clean={engine:p.engine,eraser:p.eraser};
    for(const key of customFields) { if(!validValue(key,p[key])) return null; clean[key]=p[key]; }
    return clean;
  }
  function profile(b) {
    const p={engine:b.engine,eraser:!!b.eraser};
    for(const key of customFields) { let n=b[key]; if(!Number.isFinite(n)) n=key==='size' ? 14 : key==='spacing' ? 0.06 : key==='grain' && b.engine==='grain' ? 0.7 : 0; p[key]=Q.clamp(n,key==='size' ? 1 : key==='spacing' ? 0.02 : 0,key==='size' ? 240 : key==='streamline' ? 0.9 : 1); } return p;
  }
  function saveCustom(records) { try { localStorage.setItem(customKey,JSON.stringify(records)); return true; } catch(e) { return false; } }
  function register(rec) { const b={...rec.current,id:rec.id,name:rec.name,custom:true}; Q.BRUSHES.push(b); return b; }
  Q.restoreCustomBrushes = function () {
    Q.BRUSHES=Q.BRUSHES.filter(b=>!b.custom); customRecords=[];
    let input; try { input=JSON.parse(localStorage.getItem(customKey) || '[]'); } catch(e) { return; }
    if(!Array.isArray(input)) return; const seen=new Set(Q.BRUSHES.map(b=>b.id));
    for(const rec of input.slice(0,100)) {
      if(!rec || typeof rec.id!=='string' || !/^custom-[a-z0-9]{1,40}$/.test(rec.id) || seen.has(rec.id) || typeof rec.name!=='string' || !rec.name.trim() || rec.name.length>40) continue;
      const base=cleanProfile(rec.base), current=cleanProfile(rec.current); if(!base || !current || base.engine!==current.engine || base.eraser!==current.eraser) continue;
      const clean={id:rec.id,name:rec.name.trim(),base:base,current:current}; seen.add(rec.id); customRecords.push(clean); register(clean); if(customRecords.length===24) break;
    }
  };
  Q.createCustomBrush = function (source) {
    if(!source || source.syncedEraser || !Q.BRUSHES.includes(source)) return {error:'Choose a library brush first'};
    if(customRecords.length>=24) return {error:'Custom brush limit reached (24)'};
    const id='custom-'+Q.uid(); if(Q.BRUSHES.some(b=>b.id===id) || !/^custom-[a-z0-9]{1,40}$/.test(id)) return {error:'Could not create a unique brush ID'};
    const base=profile(source), rec={id:id,name:source.name.slice(0,35)+' copy',base:base,current:{...base}}, next=customRecords.concat(rec);
    if(!saveCustom(next)) return {error:'Could not save custom brush on this device'}; customRecords=next; return {brush:register(rec)};
  };
  Q.updateCustomBrush = function (brush,key,value) {
    const index=customRecords.findIndex(r=>r.id===brush.id); if(index<0 || !customFields.includes(key) || !validValue(key,value)) return false;
    const next=customRecords.slice(), old=next[index]; next[index]={...old,current:{...old.current,[key]:value}};
    if(!saveCustom(next)) return false; customRecords=next; brush[key]=value; return true;
  };
  Q.renameCustomBrush = function (brush,name) {
    name=typeof name==='string' ? name.trim() : ''; const index=customRecords.findIndex(r=>r.id===brush.id);
    if(index<0 || !name || name.length>40) return false; const next=customRecords.slice(); next[index]={...next[index],name:name};
    if(!saveCustom(next)) return false; customRecords=next; brush.name=name; return true;
  };
  Q.resetCustomBrush = function (brush) {
    const index=customRecords.findIndex(r=>r.id===brush.id); if(index<0) return false;
    const next=customRecords.slice(), old=next[index]; next[index]={...old,current:{...old.base}};
    if(!saveCustom(next)) return false; customRecords=next; Object.assign(brush,old.base); return true;
  };
  Q.deleteCustomBrush = function (brush) {
    const index=customRecords.findIndex(r=>r.id===brush.id); if(index<0) return false;
    const next=customRecords.filter(r=>r.id!==brush.id); if(!saveCustom(next)) return false;
    customRecords=next; const i=Q.BRUSHES.indexOf(brush); if(i>=0) Q.BRUSHES.splice(i,1); return true;
  };

  // Favourites are device-local and only reference brushes that still exist.
  Q.favoriteBrushes = function () {
    try {
      const list=JSON.parse(localStorage.getItem('qelem-favorite-brushes') || '[]');
      if(!Array.isArray(list)) return [];
      const valid=new Set(Q.BRUSHES.map(b=>b.id)), out=[];
      for(const id of list.slice(0,104)) if(typeof id==='string' && valid.has(id) && !out.includes(id)) out.push(id);
      return out;
    } catch(e) { return []; }
  };
  Q.setBrushFavorite = function (brush, favorite) {
    if(!brush || brush.syncedEraser || !Q.BRUSHES.includes(brush)) return false;
    const list=Q.favoriteBrushes().filter(id=>id!==brush.id); if(favorite) list.push(brush.id);
    try { localStorage.setItem('qelem-favorite-brushes',JSON.stringify(list)); return true; } catch(e) { return false; }
  };

  Q.brushById = function (id) {
    for (const b of Q.BRUSHES) if (b.id === id) return b;
    return Q.BRUSHES[0];
  };

  /* ── stamp sprites ──────────────────────────────────────── */

  const spriteCache = new Map();
  const SPRITE_CACHE_LIMIT = 32;
  const SPRITE = 128;

  Q.brushSprite = function (brush, rgb) {
    const key = brush.id + '|' + rgb.join(',') + '|' + (brush.hardness || 0).toFixed(2) + '|' + (brush.grain || 0).toFixed(2);
    if (spriteCache.has(key)) { const hit=spriteCache.get(key); spriteCache.delete(key); spriteCache.set(key,hit); return hit; }

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

    spriteCache.set(key,c); if(spriteCache.size>SPRITE_CACHE_LIMIT) spriteCache.delete(spriteCache.keys().next().value);
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

  function Stroke(doc, brush, rgb, size, opacity, selection, globalSmoothing, preview) {
    this.doc = doc;
    this.brush = brush;
    this.preview = !!preview;
    this.globalSmoothing = Number.isFinite(globalSmoothing) ? Q.clamp(globalSmoothing,0,0.9) : 0;
    this.rgb = rgb;
    this.size = Math.max(0.7, size);
    this.opacity = Q.clamp(opacity, 0.01, 1);
    this.eraser = !!brush.eraser;
    this.alphaLocked = !!(doc.layer && doc.layer() && doc.layer().alphaLocked);
    this.selection = selection ? {x:selection.x,y:selection.y,w:selection.w,h:selection.h,points:selection.points ? selection.points.map(p=>({x:p.x,y:p.y})) : null,runs:selection.runs || null,shape:selection.shape,ellipse:selection.ellipse ? {...selection.ellipse} : null} : null;
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
      this.buf = this.preview ? Q.canvas(doc.width,doc.height) : Q.strokeBuffer(doc.width, doc.height);
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
    this.curveAnchor = { x: pt.x, y: pt.y };
    this.curvePrevious = { x: pt.x, y: pt.y };

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
    const s = Q.clamp(1 - (1 - Q.clamp(b.streamline || 0,0,0.9)) * (1 - this.globalSmoothing), 0, 0.9);
    this.sx += (pt.x - this.sx) * (1 - s);
    this.sy += (pt.y - this.sy) * (1 - s);

    // Quadratic midpoint interpolation rounds corners between sampled pointer
    // events. Coalesced stylus events are used when available by the viewport.
    const previous = this.curvePrevious;
    const next = { x: this.sx, y: this.sy };
    const midpoint = { x: (previous.x + next.x) / 2, y: (previous.y + next.y) / 2 };
    this._curveTo(previous, midpoint);
    this.curvePrevious = next;
  };

  Stroke.prototype._curveTo = function (control, end) {
    const start = this.curveAnchor;
    const length = Q.dist(start.x, start.y, control.x, control.y) + Q.dist(control.x, control.y, end.x, end.y);
    // Bound interpolation overhead while keeping sharp, thin curves smooth.
    const count = Math.max(1, Math.min(64, Math.ceil(length / Math.max(2, this.size * 0.4))));
    for (let i = 1; i <= count; i++) {
      const t = i / count, u = 1 - t;
      this._lineTo(u*u*start.x + 2*u*t*control.x + t*t*end.x,
                   u*u*start.y + 2*u*t*control.y + t*t*end.y);
    }
    this.curveAnchor = end;
  };

  Stroke.prototype._lineTo = function (tx, ty) {
    const step = Math.max(0.7, this.size * (this.brush.spacing || 0.06));
    const d = Q.dist(this.lx, this.ly, tx, ty);
    if (d < step) return;
    const ux = (tx - this.lx) / d, uy = (ty - this.ly) / d;
    const n = Math.floor(d / step);
    for (let i = 1; i <= n; i++) {
      this.len += step;
      this._stamp(this.lx + ux * step * i, this.ly + uy * step * i, this.pressure, this.speed);
    }
    this.lx += ux * step * n;
    this.ly += uy * step * n;
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

  Q.symmetryPoints = function (mode, x, y, width, height) {
    const cx = width / 2, cy = height / 2;
    if (mode === 'vertical') return [{x:x,y:y},{x:width-x,y:y}];
    if (mode === 'horizontal') return [{x:x,y:y},{x:x,y:height-y}];
    if (mode === 'quadrant') return [{x:x,y:y},{x:width-x,y:y},{x:x,y:height-y},{x:width-x,y:height-y}];
    if (mode === 'radial') {
      const out = [], dx = x-cx, dy = y-cy;
      for (let i=0; i<8; i++) { const a=i*Math.PI/4; out.push({x:cx+dx*Math.cos(a)-dy*Math.sin(a),y:cy+dx*Math.sin(a)+dy*Math.cos(a)}); }
      return out;
    }
    return [{x:x,y:y}];
  };

  Stroke.prototype._stamp = function (x, y, pressure, speed) {
    const layer = this.doc.layer && this.doc.layer();
    const mode = layer && layer.assisted && this.doc.guide ? this.doc.guide.symmetry : 'off';
    const points = Q.symmetryPoints(mode, x, y, this.doc.width, this.doc.height);
    for (let i = 0; i < points.length; i++) this._stampOne(points[i].x, points[i].y, pressure, speed);
  };

  Stroke.prototype._stampOne = function (x, y, pressure, speed) {
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
    if (this.selection) { Q.selectionPath(target,this.selection); target.clip(); }
    if (this.eraser) {
      target.globalCompositeOperation = 'destination-out';
      target.globalAlpha = Q.clamp(alpha, 0.01, 1);
    } else {
      target.globalCompositeOperation = this.alphaLocked && !this.wet ? 'source-atop' : 'source-over';
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
    if (!this.dirty) this.dirty = { x: r.x, y: r.y, w: r.w, h: r.h };
    else {
      const x2 = Math.max(this.dirty.x + this.dirty.w, r.x + r.w);
      const y2 = Math.max(this.dirty.y + this.dirty.h, r.y + r.h);
      this.dirty.x = Math.min(this.dirty.x, r.x);
      this.dirty.y = Math.min(this.dirty.y, r.y);
      this.dirty.w = x2 - this.dirty.x;
      this.dirty.h = y2 - this.dirty.y;
    }
    if (!this.pending) this.pending = { x: r.x, y: r.y, w: r.w, h: r.h };
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
    if (this.selection) { Q.selectionPath(ctx,this.selection); ctx.clip(); }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(x, y, w, h);
    if (snap) ctx.drawImage(snap, x, y, w, h, x, y, w, h);
    ctx.globalAlpha = this.opacity;
    if (this.alphaLocked) ctx.globalCompositeOperation = 'source-atop';
    ctx.drawImage(this.buf, x, y, w, h, x, y, w, h);
    ctx.restore();
  };

  Stroke.prototype.end = function () {
    if (this.curvePrevious) this._curveTo(this.curvePrevious, this.curvePrevious);
    this._flush();
    this.doc.history.endPixels(this.selection && this.dirty ? Q.intersectRect(this.dirty, this.selection) : this.dirty);
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
      if (this.selection) { Q.selectionPath(ctx,this.selection); ctx.clip(); }
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

  // A simple pixel-drag smudge, limited to one cel. It samples a small tile
  // before each dab and blends it under a circular, selection-clipped tip.
  function SmudgeStroke(doc,size,strength,selection,hardness) {
    this.doc=doc; this.size=Q.clamp(size,1,240); this.strength=Q.clamp(strength,0.01,1); this.selection=selection; this.hardness=Q.sanitizeSmudgeHardness(hardness);
    this.cel=null; this.ctx=null; this.dirty=null; this.len=0; this.lx=0; this.ly=0;
  }
  SmudgeStroke.prototype.begin=function(pt) {
    this.cel=this.doc.activeCel(false); if(!this.cel) throw Error('empty cel'); this.ctx=this.cel.getContext('2d');
    this.doc.history.beginPixels(this.cel); this.lx=pt.x; this.ly=pt.y;
    const n=Math.ceil(this.size)+2; this.tile=Q.canvas(n,n); this.tileCtx=this.tile.getContext('2d');
    if(this.hardness<1) { this.mask=Q.canvas(n,n); const m=this.mask.getContext('2d'), g=m.createRadialGradient(n/2,n/2,0,n/2,n/2,this.size/2); g.addColorStop(0,'rgba(255,255,255,1)'); if(this.hardness>0) g.addColorStop(this.hardness,'rgba(255,255,255,1)'); g.addColorStop(1,'rgba(255,255,255,0)'); m.fillStyle=g; m.fillRect(0,0,n,n); }

  };
  SmudgeStroke.prototype.add=function(pt) {
    const d=this.doc, x=Q.clamp(pt.x,-this.size,d.width+this.size), y=Q.clamp(pt.y,-this.size,d.height+this.size);
    const dx=x-this.lx,dy=y-this.ly, distance=Math.hypot(dx,dy); if(distance<0.5) return;
    const n=Math.min(256,Math.ceil(distance/Math.max(1,this.size*0.22))), stepX=dx/n,stepY=dy/n, radius=this.size/2, tileSize=this.tile.width;
    let px=this.lx,py=this.ly;
    for(let i=0;i<n;i++) {
      const nx=px+stepX,ny=py+stepY, left=Math.max(0,Math.floor(nx-radius-1)),top=Math.max(0,Math.floor(ny-radius-1)),right=Math.min(d.width,Math.ceil(nx+radius+1)),bottom=Math.min(d.height,Math.ceil(ny+radius+1));
      if(right>left && bottom>top) {
        const t=this.tileCtx; t.clearRect(0,0,tileSize,tileSize); t.drawImage(this.cel,px-tileSize/2,py-tileSize/2,tileSize,tileSize,0,0,tileSize,tileSize);
        if(this.mask) { t.globalCompositeOperation='destination-in'; t.drawImage(this.mask,0,0); t.globalCompositeOperation='source-over'; }
        const c=this.ctx; c.save(); if(this.selection) { Q.selectionPath(c,this.selection); c.clip(); } c.beginPath(); c.arc(nx,ny,radius,0,Math.PI*2); c.clip(); c.globalCompositeOperation='source-over'; c.globalAlpha=this.strength; c.drawImage(this.tile,nx-tileSize/2,ny-tileSize/2); c.restore();
        if(!this.dirty) this.dirty={x:left,y:top,w:right-left,h:bottom-top};
        else { const r=this.dirty, rx=Math.max(r.x+r.w,right),by=Math.max(r.y+r.h,bottom); r.x=Math.min(r.x,left); r.y=Math.min(r.y,top); r.w=rx-r.x; r.h=by-r.y; }
      }
      px=nx; py=ny;
    }
    this.len+=distance; this.lx=x; this.ly=y;
  };
  SmudgeStroke.prototype._flush=function() {};
  SmudgeStroke.prototype.end=function() { if(!this.dirty) return; try { this.doc.history.endPixels(this.dirty); } catch(e) { this.cancel(); Q.toast('Not enough memory to save smudge undo',4000); } };
  SmudgeStroke.prototype.cancel=function() {
    if(!this.ctx || !this.dirty || !this.doc.history.snap) return;
    const r=this.dirty,c=this.ctx; c.save(); c.setTransform(1,0,0,1,0,0); c.globalAlpha=1; c.globalCompositeOperation='source-over'; c.clearRect(r.x,r.y,r.w,r.h); c.drawImage(this.doc.history.snap,r.x,r.y,r.w,r.h,r.x,r.y,r.w,r.h); c.restore(); this.dirty=null;
  };
  Q.SmudgeStroke=SmudgeStroke;

  /* Brush thumbnails render the actual preset engine on a sample path. Eraser
     tips are shown as painted marks so they remain visible on the card. */
  Q.brushPreview = function (brush,canvas,rgb) {
    const c=canvas.getContext('2d'), w=canvas.width,h=canvas.height; c.clearRect(0,0,w,h);
    const doc={width:w,height:h,activeCel:()=>canvas,layer:()=>({alphaLocked:false}),history:{beginPixels(){},endPixels(){},snap:null}};
    const sample=Object.assign({},brush,{eraser:false}), size=Q.clamp(brush.size*0.45,3,18);
    const stroke=new Stroke(doc,sample,rgb || [240,236,232],size,brush.opacity==null ? 1 : brush.opacity,null,0,true);
    stroke.begin({x:6,y:h*0.55,pressure:0.25,t:1});
    for(let i=1;i<=32;i++) { const t=i/32; stroke.add({x:6+t*(w-12),y:h*0.55+Math.sin(t*Math.PI*2)*h*0.18,pressure:0.25+0.75*Math.sin(Math.PI*t),t:1+i*8}); }
    stroke.end();
  };

})();
