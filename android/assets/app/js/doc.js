/* Qalam document model: shared layers, sparse animation cels, and history. */
(() => {
  'use strict';
  const Q = window.Q;
  Q.BLEND_MODES = [
    ['source-over','Normal'], ['multiply','Multiply'], ['screen','Screen'], ['overlay','Overlay'],
    ['darken','Darken'], ['lighten','Lighten'], ['color-dodge','Colour dodge'], ['color-burn','Colour burn'],
    ['hard-light','Hard light'], ['soft-light','Soft light'], ['difference','Difference'], ['exclusion','Exclusion'],
    ['hue','Hue'], ['saturation','Saturation'], ['color','Colour'], ['luminosity','Luminosity']
  ];
  let seq = 1;
  function makeLayer(name) { return { id: Q.uid(), name: name || `Layer ${++seq}`, visible: true, opacity: 1, blend: 'source-over' }; }
  class History {
    constructor(doc) { this.doc = doc; this.undoStack = []; this.redoStack = []; this.max = 36; this.snap = null; this.snapCtx = null; this.onchange = null; }
    notify() { if (this.onchange) this.onchange(); }
    structSnapshot() {
      const d = this.doc;
      return { layers: d.layers.map(l => ({ ...l })), frames: d.frames.map(f => ({cels: f.cels.slice(), duration: f.duration || 1})), activeLayer: d.activeLayer, activeFrame: d.activeFrame };
    }
    applyStruct(s) {
      const d = this.doc;
      d.layers = s.layers.map(l => ({ ...l })); d.frames = s.frames.map(f => ({ cels: f.cels.slice(), duration: f.duration || 1 }));
      d.activeLayer = Q.clamp(s.activeLayer, 0, d.layers.length - 1); d.activeFrame = Q.clamp(s.activeFrame, 0, d.frames.length - 1);
    }
    struct(fn) { const before = this.structSnapshot(), result = fn.call(this.doc); this.push({ type:'struct', before, after:this.structSnapshot() }); return result; }
    beginPixels(cel) {
      const d = this.doc;
      if (!this.snap || this.snap.width !== d.width || this.snap.height !== d.height) { this.snap = Q.canvas(d.width, d.height); this.snapCtx = this.snap.getContext('2d'); }
      const c = this.snapCtx;
      c.setTransform(1,0,0,1,0,0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.clearRect(0,0,d.width,d.height);
      if (cel) c.drawImage(cel,0,0);
      this.pixelF = d.activeFrame; this.pixelL = d.activeLayer;
    }
    endPixels(rect) {
      if (!rect || !this.snapCtx) return;
      const x = Math.max(0, Math.floor(rect.x)), y = Math.max(0, Math.floor(rect.y));
      const right = Math.min(this.doc.width, Math.ceil(rect.x + rect.w)), bottom = Math.min(this.doc.height, Math.ceil(rect.y + rect.h));
      if (right <= x || bottom <= y) return;
      const r = { x, y, w:right-x, h:bottom-y };
      this.push({ type:'pixels', f:this.pixelF, l:this.pixelL, rect:r, before:this.snapCtx.getImageData(x,y,r.w,r.h) });
    }
    push(e) { this.undoStack.push(e); if (this.undoStack.length > this.max) this.undoStack.shift(); this.redoStack.length = 0; this.notify(); }
    canUndo() { return !!this.undoStack.length; }
    canRedo() { return !!this.redoStack.length; }
    apply(e, undo) {
      if (e.type === 'struct') this.applyStruct(undo ? e.before : e.after);
      else {
        const r = e.rect, c = this.doc.cel(e.f,e.l,true).getContext('2d'), current = c.getImageData(r.x,r.y,r.w,r.h);
        c.putImageData(e.before,r.x,r.y); e.before = current; this.doc.activeFrame = e.f; this.doc.activeLayer = e.l;
      }
    }
    undo() { const e = this.undoStack.pop(); if (!e) return false; this.apply(e,true); this.redoStack.push(e); this.notify(); return true; }
    redo() { const e = this.redoStack.pop(); if (!e) return false; this.apply(e,false); this.undoStack.push(e); this.notify(); return true; }
    clear() { this.undoStack.length = 0; this.redoStack.length = 0; this.notify(); }
  }
  class Doc {
    constructor(opts = {}) {
      this.id = opts.id || Q.uid(); this.name = opts.name || 'Untitled'; this.width = opts.width || 2048; this.height = opts.height || 2048;
      this.fps = opts.fps || 12; this.bg = opts.bg || '#ffffff'; this.onion = !!opts.onion; this.onionAlpha = opts.onionAlpha == null ? 0.32 : opts.onionAlpha;
      this.playMode = opts.playMode || 'loop'; this.onionFrames = Q.clamp(opts.onionFrames || 1, 1, 4);
      this.onionPrevColor = opts.onionPrevColor || '#ff5a7a'; this.onionNextColor = opts.onionNextColor || '#4fd1c5'; this.guide = Object.assign({type:'off', symmetry:'off', spacing:100}, opts.guide || {});
      this.layers = [makeLayer('Layer 1')]; this.frames = [{ cels:[null], duration:1 }]; this.activeFrame = 0; this.activeLayer = 0;
      this.history = new History(this); this.dirty = true;
    }
    cel(f,l,create) { const frame = this.frames[f]; if (!frame || l < 0 || l >= this.layers.length) return null; if (!frame.cels[l] && create) frame.cels[l] = Q.canvas(this.width,this.height); return frame.cels[l] || null; }
    activeCel(create) { return this.cel(this.activeFrame,this.activeLayer,create); }
    layer(i) { return this.layers[i == null ? this.activeLayer : i] || null; }
    frameCount() { return this.frames.length; }
    blankCels() { return this.layers.map(() => null); }
    cloneCels(cels) { return cels.map(c => c ? Q.copyCanvas(c) : null); }
    addLayer(copyFrom) {
      return this.history.struct(function () {
        const at = this.activeLayer + 1, src = this.layers[copyFrom], layer = makeLayer(src ? src.name + ' copy' : null);
        if (src) { layer.opacity = src.opacity; layer.blend = src.blend; }
        this.layers.splice(at,0,layer);
        for (const f of this.frames) { const c = src && f.cels[copyFrom]; f.cels.splice(at,0,c ? Q.copyCanvas(c) : null); }
        this.activeLayer = at; return at;
      });
    }
    deleteLayer(i) {
      if (this.layers.length < 2) { Q.toast('A canvas needs at least one layer'); return; }
      if (i < 0 || i >= this.layers.length) return;
      return this.history.struct(function () { this.layers.splice(i,1); for (const f of this.frames) f.cels.splice(i,1); this.activeLayer = Q.clamp(this.activeLayer,0,this.layers.length-1); });
    }
    moveLayer(i,dir) {
      const j = i + dir; if (i < 0 || i >= this.layers.length || j < 0 || j >= this.layers.length) return;
      return this.history.struct(function () { this.layers.splice(j,0,this.layers.splice(i,1)[0]); for (const f of this.frames) f.cels.splice(j,0,f.cels.splice(i,1)[0]); this.activeLayer = j; });
    }
    mergeDown(i) {
      if (i <= 0 || i >= this.layers.length) { Q.toast('Nothing below to merge into'); return; }
      return this.history.struct(function () {
        const lower = this.layers[i-1], upper = this.layers[i];
        for (const f of this.frames) {
          if (!f.cels[i-1] && !f.cels[i]) { f.cels.splice(i,1); continue; }
          // Never mutate canvases referenced by an earlier structural snapshot.
          const merged = Q.canvas(this.width,this.height), c = merged.getContext('2d');
          if (f.cels[i-1] && lower.visible) { c.globalAlpha = lower.opacity; c.drawImage(f.cels[i-1],0,0); }
          if (f.cels[i] && upper.visible) { c.globalAlpha = upper.opacity; c.globalCompositeOperation = upper.blend; c.drawImage(f.cels[i],0,0); }
          f.cels[i-1] = merged; f.cels.splice(i,1);
        }
        lower.opacity = 1; lower.blend = 'source-over'; lower.visible = true; this.layers.splice(i,1); this.activeLayer = i-1;
      });
    }
    clearLayer(i) { if (i < 0 || i >= this.layers.length) return; return this.history.struct(function () { for (const f of this.frames) f.cels[i] = null; }); }
    addFrame(duplicate) { return this.history.struct(function () { const at = this.activeFrame+1; this.frames.splice(at,0,{ cels:duplicate ? this.cloneCels(this.frames[this.activeFrame].cels) : this.blankCels(), duration: duplicate ? (this.frames[this.activeFrame].duration || 1) : 1 }); this.activeFrame=at; }); }
    setFrameDuration(i, duration) { if (!this.frames[i]) return; return this.history.struct(function () { this.frames[i].duration = Q.clamp(Math.round(duration) || 1,1,12); }); }
    deleteFrame(i) {
      if (this.frames.length < 2) { Q.toast('A canvas needs at least one frame'); return; }
      if (i < 0 || i >= this.frames.length) return;
      return this.history.struct(function () { this.frames.splice(i,1); this.activeFrame = Q.clamp(this.activeFrame,0,this.frames.length-1); });
    }
    moveFrame(i,dir) { const j = i+dir; if (i < 0 || i >= this.frames.length || j < 0 || j >= this.frames.length) return; return this.history.struct(function () { this.frames.splice(j,0,this.frames.splice(i,1)[0]); this.activeFrame=j; }); }
    setLayerProp(i,key,value) { if (this.layers[i]) return this.history.struct(function () { this.layers[i][key]=value; }); }
    setLayerPropLive(i,key,value) { if (this.layers[i]) this.layers[i][key]=value; }
    composite(ctx,frameIdx,opts = {}) {
      const f = this.frames[frameIdx]; if (!f) return;
      this.layers.forEach((l,i) => { if ((!l.visible && !opts.includeHidden) || !f.cels[i]) return; ctx.save(); ctx.globalAlpha=(opts.alpha == null ? 1 : opts.alpha)*(opts.ignoreOpacity ? 1 : l.opacity); ctx.globalCompositeOperation=l.blend || 'source-over'; ctx.drawImage(f.cels[i],0,0); ctx.restore(); });
    }
    renderFrame(canvas,frameIdx,opts = {}) {
      const c = canvas.getContext('2d'); c.setTransform(1,0,0,1,0,0); c.globalAlpha=1; c.globalCompositeOperation='source-over'; c.clearRect(0,0,canvas.width,canvas.height);
      if (opts.background !== false) { c.fillStyle=opts.background || this.bg; c.fillRect(0,0,canvas.width,canvas.height); }
      this.composite(c,frameIdx,opts); return canvas;
    }
    flatten(frameIdx) { return this.renderFrame(Q.canvas(this.width,this.height),frameIdx); }
    thumbnail(frameIdx,size = 160) {
      const scale = size/Math.max(this.width,this.height), cv = Q.canvas(this.width*scale,this.height*scale), c=cv.getContext('2d');
      c.fillStyle=this.bg; c.fillRect(0,0,cv.width,cv.height); c.save(); c.scale(cv.width/this.width,cv.height/this.height); this.composite(c,frameIdx == null ? this.activeFrame : frameIdx); c.restore(); return cv;
    }
    layerThumbnail(i,size = 46) { const scale=size/Math.max(this.width,this.height), cv=Q.canvas(this.width*scale,this.height*scale), cel=this.cel(this.activeFrame,i,false); if (cel) cv.getContext('2d').drawImage(cel,0,0,cv.width,cv.height); return cv; }
    memoryMB() { return Math.round(this.frames.reduce((n,f) => n+f.cels.filter(Boolean).length,0)*this.width*this.height*4/(1024*1024)); }
  }
  Q.Doc=Doc; Q.History=History; Q.makeLayer=makeLayer;
})();
