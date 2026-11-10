/* Qalam — canvas viewport: rendering, pan/zoom/rotate, stylus input and the
 * Gestures: two-finger pan/pinch/rotate, three-finger undo/swipe for quick edit, four-finger redo,
 * long-press eyedropper and hold-to-snap QuickShape.
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
    this.quickShape = null;
    this.pointers = new Map();
    this.g = null;                 // transform gesture
    this.gestureTap = false;
    this.tapCount = 0;
    this.brush = Q.BRUSHES[0];
    this.color = [24, 24, 26];
    this.size = 14;
    this.opacity = 1;
    this.globalPressure = 1;
    this.globalSmoothing = 0;
    this.smudgeHardness = 1;
    this.tool = 'brush';
    this.onDocChange = null;
    this.onStrokeEnd = null;
    this.onUndo = null;
    this.onRedo = null;
    this.onQuickEdit = null;
    this.onClearCel = null;
    this.onPick = null;
    this.onFill = null;
    this.selection = null;
    this.selectionDraft = null;
    this.selectionOperation = 'replace';
    this.motionDraft = null;
    this.lastPointerType = 'touch';
    this.holdTimer = 0;
    this.holdStart = 0;
    this.gestureDelays = Q.sanitizeGestureDelays();
    this.onion = null;
    this.showGrid = false;
    this.transparentPreview = false;
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
    this.scale = Q.clamp(this.scale * factor, 0.02, 64);
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
      if (this.stroke) this.stroke._flush();
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
    c.fillStyle = '#393a3e';
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (!doc) return;

    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.translate(this.tx, this.ty);
    c.rotate(this.rot);
    c.scale(this.scale, this.scale);

    // paper
    c.save();
    // Avoid re-rasterizing a large blurred shadow on every pen movement.
    if (!this.stroke) {
      c.shadowColor = 'rgba(0,0,0,0.55)';
      c.shadowBlur = 26 / this.scale;
      c.shadowOffsetY = 8 / this.scale;
    }
    if (this.transparentPreview) {
      if (!this._checker) {
        const tile=Q.canvas(32,32), t=tile.getContext('2d'); t.fillStyle='#eeeeee'; t.fillRect(0,0,32,32); t.fillStyle='#bbbbbb'; t.fillRect(0,0,16,16); t.fillRect(16,16,16,16); this._checker=tile;
      }
      c.fillStyle=c.createPattern(this._checker,'repeat') || '#eeeeee';
    } else c.fillStyle = doc.bg;
    c.fillRect(0, 0, doc.width, doc.height);
    c.restore();

    // During playback show the non-destructive camera output without editing overlays.
    if (Q.App && Q.App.playing && ((doc.cameraEnabled && doc.cameraKeys.length) || doc.hasLayerMotion())) {
      doc.compositeCamera(c,doc.activeFrame);
      c.lineWidth=1/this.scale; c.strokeStyle='rgba(255,255,255,0.12)'; c.strokeRect(0,0,doc.width,doc.height);
      return;
    }

    // Onion skins can appear beneath or above the current artwork.
    if (!doc.onionAbove) this._drawOnionSkins(c,doc);
    doc.composite(c, doc.activeFrame);
    if (doc.onionAbove) this._drawOnionSkins(c,doc);

    this._drawGuide(c, doc);
    this._drawMotionGuide(c, doc);

    // QuickShape is a temporary outline until the original pointer is lifted.
    if (this.quickShape) {
      const q=this.quickShape; c.save(); c.strokeStyle=Q.rgbToHex(q.color); c.globalAlpha=q.opacity; c.lineWidth=Math.max(1,q.size); c.lineCap='round'; c.lineJoin='round'; c.beginPath();
      if(q.closed) c.ellipse(q.box.x+q.box.w/2,q.box.y+q.box.h/2,q.box.w/2,q.box.h/2,0,0,Math.PI*2);
      else { c.moveTo(q.start.x,q.start.y); c.lineTo(q.end.x,q.end.y); } c.stroke(); c.restore();
    }
    // Selection is an editing overlay, never part of the exported artwork.
    const selection = this.selectionDraft || this.selection;
    if (selection) {
      c.save(); c.lineWidth = 2 / this.scale; c.strokeStyle = '#111111';
      if (selection.runs) { c.beginPath(); c.rect(selection.x,selection.y,selection.w,selection.h); } else Q.selectionPath(c,selection); c.stroke();
      c.strokeStyle = '#ffffff'; c.setLineDash([6 / this.scale, 4 / this.scale]);
      if (selection.runs) { c.beginPath(); c.rect(selection.x,selection.y,selection.w,selection.h); } else Q.selectionPath(c,selection); c.stroke(); c.restore();
    }

    // Canvas border
    c.lineWidth = 1 / this.scale;
    c.strokeStyle = 'rgba(255,255,255,0.12)';
    c.strokeRect(0, 0, doc.width, doc.height);
  };

  View.prototype._drawOnionSkins = function (c,doc) {
    if (!doc.onion || doc.frames.length<2 || (Q.App && Q.App.playing)) return;
    const neighbors=Q.onionNeighbors(doc);
    // Draw distant eligible cels first; the nearest has the strongest tint.
    for (let n=Math.max(neighbors.previous.length,neighbors.next.length)-1;n>=0;n--) {
      const alpha=doc.onionAlpha*0.85/(n+1);
      if (neighbors.previous[n] != null) this._drawOnion(c,neighbors.previous[n],doc.onionPrevColor,alpha);
      if (neighbors.next[n] != null) this._drawOnion(c,neighbors.next[n],doc.onionNextColor,alpha);
    }
  };

  View.prototype._drawMotionGuide = function (c,doc) {
    const points=this.motionDraft || (doc.motionGuideVisible ? doc.motionGuide : []);
    if (!points || points.length<2) return;
    c.save(); c.beginPath(); c.rect(0,0,doc.width,doc.height); c.clip();
    c.lineWidth=2/this.scale; c.strokeStyle='#ff9d26'; c.setLineDash([7/this.scale,5/this.scale]); c.beginPath();
    c.moveTo(points[0].x,points[0].y); for(let i=1;i<points.length;i++) c.lineTo(points[i].x,points[i].y); c.stroke();
    c.setLineDash([]); c.fillStyle='#ff9d26';
    for (const p of [points[0],points[points.length-1]]) { c.beginPath(); c.arc(p.x,p.y,4/this.scale,0,Math.PI*2); c.fill(); }
    c.restore();
  };

  View.prototype._drawGuide = function (c, doc) {
    const guide = doc.guide;
    if (!guide || guide.type === 'off') return;
    const w = doc.width, h = doc.height, spacing = Q.clamp(Number(guide.spacing) || 100, 32, 500);
    c.save(); c.beginPath(); c.rect(0,0,w,h); c.clip(); c.lineWidth = 1 / this.scale;
    c.strokeStyle = 'rgba(35,110,210,0.5)'; c.beginPath();
    if (guide.type === 'grid') {
      for (let x = spacing; x < w; x += spacing) { c.moveTo(x,0); c.lineTo(x,h); }
      for (let y = spacing; y < h; y += spacing) { c.moveTo(0,y); c.lineTo(w,y); }
    } else if (guide.type === 'isometric') {
      for (let y = spacing; y < h; y += spacing) { c.moveTo(0,y); c.lineTo(w,y); }
      const slope = 0.57735;
      for (let x = -h/slope; x < w+h/slope; x += spacing*2) {
        c.moveTo(x,0); c.lineTo(x+h/slope,h);
        c.moveTo(x,0); c.lineTo(x-h/slope,h);
      }
    } else if (guide.type === 'perspective1' || guide.type === 'perspective2' || guide.type === 'perspective3') {
      const horizon = h * Q.clamp(Number(guide.horizon) || 0.5, 0.2, 0.8);
      const spread = w * Q.clamp(Number(guide.spread) || 0.5, 0.2, 1);
      const points = guide.type === 'perspective1' ? [{x:w/2,y:horizon}] : [{x:w/2-spread,y:horizon},{x:w/2+spread,y:horizon}];
      if (guide.type === 'perspective3') points.push({x:w/2,y:-h*0.6});
      c.moveTo(0,horizon); c.lineTo(w,horizon);
      points.forEach(function (p) {
        for (let x=0; x<=w; x+=spacing) { c.moveTo(p.x,p.y); c.lineTo(x,0); c.moveTo(p.x,p.y); c.lineTo(x,h); }
        for (let y=0; y<=h; y+=spacing) { c.moveTo(p.x,p.y); c.lineTo(0,y); c.moveTo(p.x,p.y); c.lineTo(w,y); }
      });
    } else if (guide.type === 'symmetry') {
      if (guide.symmetry === 'vertical' || guide.symmetry === 'quadrant' || guide.symmetry === 'radial') { c.moveTo(w/2,0); c.lineTo(w/2,h); }
      if (guide.symmetry === 'horizontal' || guide.symmetry === 'quadrant' || guide.symmetry === 'radial') { c.moveTo(0,h/2); c.lineTo(w,h/2); }
      if (guide.symmetry === 'radial') { const reach = Math.max(w,h); c.moveTo(w/2-reach,h/2-reach); c.lineTo(w/2+reach,h/2+reach); c.moveTo(w/2-reach,h/2+reach); c.lineTo(w/2+reach,h/2-reach); }
    }
    c.stroke(); c.restore();
  };

  View.prototype._drawOnion = function (c, frameIdx, tint, alpha) {
    const doc = this.doc;
    const cv = this.onionCanvas();
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, cv.width, cv.height);
    doc.composite(g, frameIdx, doc.onionLayerOnly ? {onlyLayer:doc.activeLayer} : {});
    if (!doc.onionOriginalColor) {
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = tint; g.fillRect(0, 0, cv.width, cv.height);
      g.globalCompositeOperation = 'source-over';
    }

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

  View.prototype.cancelActiveInput = function () {
    this._disarmHold(); if (this.stroke) { this.stroke.cancel(); this.stroke=null; }
    this.quickShape=null; this.pointers.clear(); this.g=null; this.selectionDraft=null; this.motionDraft=null; this.dirty=true;
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

    if (this.quickShape) {
      const rec=this.pointers.get(e.pointerId); rec.shapeAdjust=true; rec.previousDoc=this.toDoc(pos.x,pos.y); return;
    }
    if (this.pointers.size === 1) {
      if (this.tool === 'eyedrop') {
        this._eyedropAt(pos.x, pos.y);
        return;
      }
      if (this.tool === 'fill' || this.tool === 'wand') { this.pointers.get(e.pointerId).pendingFill = this.tool; return; }
      if (this.tool === 'motionGuide') { const rec=this.pointers.get(e.pointerId), p=this.toDoc(pos.x,pos.y); rec.guidePoints=[{x:Q.clamp(p.x,0,this.doc.width),y:Q.clamp(p.y,0,this.doc.height)}]; this.motionDraft=rec.guidePoints; return; }
      if (this.tool === 'select' || this.tool === 'lasso' || this.tool === 'ellipse') {
        const rec=this.pointers.get(e.pointerId), p=this.toDoc(pos.x,pos.y);
        rec.selectStart=p; rec.selectionOperation=this.selectionOperation || 'replace'; rec.selectionBase=this.selection; rec.selectEllipse=this.tool==='ellipse'; if (this.tool === 'lasso') rec.lassoPoints=[p]; this.selectionDraft=null; return;
      }
      this._startStroke(pos, e);
    } else if (this.pointers.size === 2) {
      this.selectionDraft=null; this.motionDraft=null; this.dirty=true;
      if (this.stroke) { this.stroke.cancel(); this.stroke = null; this.dirty = true; }
      this._startGesture();
    } else {
      // Additional fingers count toward undo/redo only if the gesture stays still.
      if (this.g) {
        this.g.maxPointers = Math.max(this.g.maxPointers, this.pointers.size);
        const pts=[...this.pointers.values()];
        if (pts.length===3 && this.g.maxPointers===3 && !this.g.editSwipe && !this.g.cancelled && !this.g.moved && pts.every(p=>p.type==='touch') && Q.now()-Math.min(...pts.map(p=>p.t))<300) {
          this.g.editSwipe={started:Q.now(),points:pts.map(p=>({id:p.id,x:p.x,y:p.y,endX:p.x,endY:p.y,minX:p.x,maxX:p.x,minY:p.y,maxY:p.y})),anchor:pts.reduce((n,p)=>n+p.x,0)/3,extreme:null,dir:0,turns:0,scrubInvalid:false};
        }
      }
      this.gestureTap = false;
    }
  };

  View.prototype._move = function (e) {
    const pos = this._pos(e);
    const rec = this.pointers.get(e.pointerId);
    if (!rec) return;
    rec.x = pos.x;
    rec.y = pos.y;
    if (this.g && Q.dist(rec.startX,rec.startY,rec.x,rec.y)>10) this.g.moved=true;
    if (this.g && this.g.editSwipe) {
      const swipe=this.g.editSwipe, point=swipe.points.find(p=>p.id===rec.id);
      if(point) {
        point.endX=rec.x; point.endY=rec.y; point.minX=Math.min(point.minX,rec.x); point.maxX=Math.max(point.maxX,rec.x); point.minY=Math.min(point.minY,rec.y); point.maxY=Math.max(point.maxY,rec.y);
        if (this.pointers.size!==3 || this.g.maxPointers!==3) swipe.scrubInvalid=true;
        else {
          const x=swipe.points.reduce((n,p)=>n+p.endX,0)/3, threshold=36;
          if (!swipe.dir && Math.abs(x-swipe.anchor)>=threshold) { swipe.dir=x>swipe.anchor ? 1 : -1; swipe.extreme=x; }
          else if (swipe.dir) {
            if ((x-swipe.extreme)*swipe.dir>0) swipe.extreme=x;
            else if ((x-swipe.extreme)*swipe.dir<=-threshold) { swipe.dir=-swipe.dir; swipe.extreme=x; swipe.turns++; }
          }
        }
      }
    }

    if (this.quickShape) {
      if (rec.shapeAdjust) { const p=this.toDoc(pos.x,pos.y), q=this.quickShape, dx=p.x-rec.previousDoc.x,dy=p.y-rec.previousDoc.y; q.box.x+=dx; q.box.y+=dy; q.start.x+=dx; q.start.y+=dy; q.end.x+=dx; q.end.y+=dy; rec.previousDoc=p; this.dirty=true; } return;
    }
    if (rec.shapeAdjust) return;
    if (this.g) { this._moveGesture(); return; }
    if (rec.guidePoints) {
      const p=this.toDoc(pos.x,pos.y), points=rec.guidePoints, last=points[points.length-1];
      const pt={x:Q.clamp(p.x,0,this.doc.width),y:Q.clamp(p.y,0,this.doc.height)};
      if (points.length<512 && Q.dist(last.x,last.y,pt.x,pt.y)*this.scale>=3) points.push(pt);
      this.dirty=true; return;
    }
    if (rec.selectStart) {
      const p=this.toDoc(pos.x,pos.y);
      if (rec.lassoPoints) {
        const points=rec.lassoPoints, last=points[points.length-1];
        if (points.length<2048 && Q.dist(last.x,last.y,p.x,p.y)*this.scale>=2) points.push(p);
        this.selectionDraft=Q.lassoSelection(points,this.doc.width,this.doc.height);
      } else this.selectionDraft=rec.selectEllipse ? Q.ellipseSelection(rec.selectStart,p,this.doc.width,this.doc.height) : Q.selectionRect(rec.selectStart,p,this.doc.width,this.doc.height);
      this.dirty=true; return;
    }

    if (this.stroke && rec.id === this.strokePointerId) {
      const samples = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
      const evs = samples && samples.length ? samples : [e];
      for (let i = 0; i < evs.length; i++) {
        const ev = evs[i];
        const p = this._pos(ev);
        const pt = this.toDoc(p.x, p.y);
        pt.pressure = this._pressure(ev);
        pt.t = ev.timeStamp || Q.now();
        const b=this.shapeBounds; if (b) { b.minX=Math.min(b.minX,pt.x); b.minY=Math.min(b.minY,pt.y); b.maxX=Math.max(b.maxX,pt.x); b.maxY=Math.max(b.maxY,pt.y); b.end={x:pt.x,y:pt.y}; }
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
    if (this.quickShape) {
      if (rec.id===this.quickShape.pointerId) { if(e.type==='pointercancel') { this.quickShape=null; this.dirty=true; } else this._commitQuickShape(); }
      return;
    }
    if (rec.shapeAdjust) return;

    if (this.g) {
      if (e.type === 'pointercancel') this.g.cancelled=true;
      const remaining = this.pointers.size;
      if (remaining === 0) {
        const g=this.g, tap = !g.moved && !g.cancelled && Q.now()-g.started < 500, n=g.maxPointers, swipe=g.editSwipe;
        const edit=n===3 && !g.cancelled && swipe && Q.now()-swipe.started<1100 && swipe.points.every(p=>{ const dx=p.endX-p.x,dy=p.endY-p.y; return dy>=55 && Math.abs(dx)<=Math.max(30,dy*0.5); });
        const scrub=n===3 && !g.cancelled && swipe && !swipe.scrubInvalid && Q.now()-swipe.started<2000 && swipe.turns>=2 && swipe.points.every(p=>p.maxX-p.minX>=50 && p.maxY-p.minY<=40);
        this.g = null;
        if (scrub) { if(this.onClearCel) this.onClearCel(); }
        else if (edit) { if(this.onQuickEdit) this.onQuickEdit(); }
        else if (tap) {
          if (n === 3) { if (this.onUndo) this.onUndo(); }
          else if (n === 4) { if (this.onRedo) this.onRedo(); }
        }
      } else if (remaining === 1) {
        // continue with the remaining finger for panning, without rotating
        this._startGesture();
      }
      return;
    }

    if (rec.guidePoints) {
      if (e.type !== 'pointercancel' && rec.guidePoints.length>=2) { this.doc.setMotionGuide(rec.guidePoints); Q.hint('Animation guide saved',1800); }
      this.motionDraft=null; this.tool='brush'; this.dirty=true; return;
    }
    if (rec.selectStart) {
      if (e.type !== 'pointercancel' && this.selectionDraft) {
        if(rec.selectionOperation==='replace') { this.selection=this.selectionDraft; Q.hint('Selection ready · open Menu → Selection & transform',2500); }
        else if(this.selection!==rec.selectionBase) Q.toast('Selection changed; try again',3500);
        else { const result=Q.combineSelections(rec.selectionBase,this.selectionDraft,rec.selectionOperation,this.doc.width,this.doc.height); if(result.error) Q.toast(result.error,4000); else { this.selection=result.selection; Q.hint('Selection updated · dashed box shows bounds',2500); } }
      }
      this.selectionDraft=null; this.selectionOperation='replace'; this.tool='brush'; this.dirty=true; return;
    }
    if (e.type !== 'pointercancel' && rec.pendingFill && Q.dist(rec.startX, rec.startY, rec.x, rec.y) < 6 && this.onFill) {
      const point = this.toDoc(rec.x, rec.y); if (rec.pendingFill === 'wand' && this.onWand) { this.onWand(point.x,point.y); this.tool='brush'; } else if (rec.pendingFill === 'fill') this.onFill(point.x, point.y); return;
    }
    if (this.stroke && rec.id === this.strokePointerId) {
      const wasTap = Q.dist(rec.startX, rec.startY, rec.x, rec.y) < 6 && (Q.now() - rec.t) < 320;
      if(e.type==='pointercancel' && this.stroke instanceof Q.SmudgeStroke) { this.stroke.cancel(); this.stroke=null; this.dirty=true; } else this._endStroke(wasTap);
    }
  };

  View.prototype._pressure = function (e) {
    const p = (e.pointerType === 'pen' || e.pointerType === 'mouse')
      ? (e.pressure || 0)
      : 1;
    if (e.pointerType !== 'pen') return p <= 0.001 ? 1 : Q.clamp(p,0.04,1);
    const raw=p<=0.001 ? 0.35 : Q.clamp(p,0.04,1);
    return Q.clamp(Math.pow(raw,this.globalPressure),0.04,1);
  };

  View.prototype._startStroke = function (pos, e) {
    const doc = this.doc;
    const layer = doc.layer(doc.activeLayer);
    if (!layer || !layer.visible) {
      Q.toast('This layer is hidden');
      return;
    }
    if (layer.locked) { Q.toast('This layer is locked'); return; }
    if (this.tool==='smudge' && layer.alphaLocked) { Q.toast('Turn off alpha lock to smudge'); return; }
    if (this.tool==='smudge' && !doc.activeCel(false)) { Q.toast('Draw on this layer first'); return; }
    if (this.tool!=='smudge' && layer.alphaLocked && this.brush.eraser) { Q.toast('Turn off alpha lock to erase'); return; }
    const p = this.toDoc(pos.x, pos.y);
    this.strokePointerId = e.pointerId;
    this.strokePointerType = e.pointerType || 'touch';
    const brushOpacity = this.opacity * (this.brush.opacity == null ? 1 : this.brush.opacity);
    try {
      this.stroke = this.tool==='smudge' ? new Q.SmudgeStroke(doc,this.size,this.opacity,this.selection,this.smudgeHardness) : new Q.Stroke(doc, this.brush, this.color, this.size, brushOpacity, this.selection, this.globalSmoothing);
      this.stroke.begin({ x: p.x, y: p.y, pressure: this._pressure(e), t: Q.now() });
    } catch(err) { this.stroke=null; Q.toast('Could not start stroke on this device',4000); return; }
    this._lastStampTime = Q.now();
    this.strokeStartScreen = { x: pos.x, y: pos.y };
    if (this.onDrawStart) this.onDrawStart();
    this.strokeStartDoc = p;
    this.shapeBounds={minX:p.x,minY:p.y,maxX:p.x,maxY:p.y,end:{x:p.x,y:p.y}};
    this.dirty = true;
    if(this.tool!=='smudge') this._armHold();
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
    // Capture preferences at stroke start; a settings change cannot alter an
    // in-progress hold. Polling means activation can be up to ~120 ms later.
    const delays=Q.sanitizeGestureDelays(this.gestureDelays);
    this.holdTimer = setInterval(function () {
      if (!self.stroke) { self._disarmHold(); return; }
      const idle = Q.now() - (self._lastStampTime || self.holdStart);
      if (self.stroke.len > self.stroke.size * 0.8) {
        if (idle < delays.shape) return;
        self._disarmHold();
        self._quickShape();
      } else if (idle > delays.eyedrop) {
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
    const stroke=this.stroke, b=this.shapeBounds; if (!stroke || !stroke.cel || !b) return;
    const start=this.strokeStartDoc, end=b.end, width=b.maxX-b.minX, height=b.maxY-b.minY;
    const closed=width>=8 && height>=8 && Q.dist(start.x,start.y,end.x,end.y)<Math.max(width,height)*0.35 && stroke.len>Math.max(width,height)*1.5;
    if (!closed && Q.dist(start.x,start.y,end.x,end.y)<8) return;
    const circle=closed && width/height>=0.8 && width/height<=1.25;
    const side=(width+height)/2, box=circle ? {x:(b.minX+b.maxX-side)/2,y:(b.minY+b.maxY-side)/2,w:side,h:side} : {x:b.minX,y:b.minY,w:width,h:height};
    const q={pointerId:this.strokePointerId,doc:this.doc,frame:this.doc.activeFrame,layer:this.doc.activeLayer,closed:closed,circle:circle,box:box,start:{...start},end:{...end},brush:this.brush,color:this.color.slice(),size:this.size,opacity:this.opacity,selection:this.selection,globalSmoothing:this.globalSmoothing};
    stroke.cancel(); this.stroke=null; this.quickShape=q; this.dirty=true; Q.haptic(12);
    Q.hint(closed ? (circle ? 'Circle snapped · drag with another finger to move, release to commit' : 'Ellipse snapped · drag with another finger to move, release to commit') : 'Line snapped · drag with another finger to move, release to commit',3000);
  };
  View.prototype._commitQuickShape = function () {
    const q=this.quickShape; this.quickShape=null; this.dirty=true;
    if (!q || this.doc!==q.doc || q.doc.activeFrame!==q.frame || q.doc.activeLayer!==q.layer || q.doc.layer().locked) { Q.toast('QuickShape cancelled'); return; }
    const shape=q.closed ? this._ellipsePoints(q.box) : [q.start,q.end], bop=q.opacity*(q.brush.opacity==null ? 1 : q.brush.opacity);
    const stroke=new Q.Stroke(q.doc,q.brush,q.color,q.size,bop,q.selection,q.globalSmoothing);
    stroke.begin({x:shape[0].x,y:shape[0].y,pressure:0.7,t:Q.now()});
    for(let i=1;i<shape.length;i++) stroke.add({x:shape[i].x,y:shape[i].y,pressure:0.9,t:Q.now()+i});
    stroke.end(); if(this.onDocChange) this.onDocChange(); if(this.onStrokeEnd) this.onStrokeEnd(false);
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
      moved: this.g ? this.g.moved : false,
      cancelled: this.g ? this.g.cancelled : false,
      editSwipe: this.g ? this.g.editSwipe : null,
      started: this.g ? this.g.started : Q.now(),
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
    if (g.maxPointers>=3) return; // three/four-finger gestures never zoom or pan
    const pts = [];
    this.pointers.forEach(function (p) { pts.push(p); });
    if (!pts.length) return;
    let cx = 0, cy = 0;
    for (const p of pts) { cx += p.x; cy += p.y; }
    cx /= pts.length; cy /= pts.length;

    let scale = g.startScale, rot = g.startRot;
    if (pts.length > 1) {
      const dist = Q.dist(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
      if (g.startDist > 8) scale = Q.clamp(g.startScale * (dist / g.startDist), 0.02, 64);
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
