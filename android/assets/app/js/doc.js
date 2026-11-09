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
  Q.validAudioTrack = function (track) {
    return !!track && typeof track.name==='string' && track.name.length<=100 && typeof track.data==='string' &&
      track.data.length<=Math.ceil((2*1024*1024)/3)*4+64 &&
      /^data:audio\/(mpeg|mp4|wav|ogg|webm);base64,[A-Za-z0-9+/]+={0,2}$/.test(track.data);
  };
  // Sample a polyline by distance rather than by point count; duplicate points are safe.
  Q.motionPathSampler = function (points) {
    const segments=[]; let total=0;
    for (let i=1;i<points.length;i++) {
      const a=points[i-1], b=points[i], length=Math.hypot(b.x-a.x,b.y-a.y);
      if (length>0) { segments.push({a,b,start:total,length}); total+=length; }
    }
    if (!total) return null;
    return function (fraction) {
      const distance=Q.clamp(fraction,0,1)*total;
      const segment=segments.find(s=>distance<=s.start+s.length) || segments[segments.length-1];
      const u=Q.clamp((distance-segment.start)/segment.length,0,1);
      return {x:segment.a.x+(segment.b.x-segment.a.x)*u,y:segment.a.y+(segment.b.y-segment.a.y)*u};
    };
  };
  Q.motionEase = function (t,mode) {
    if (mode==='in') return t*t;
    if (mode==='out') return 1-(1-t)*(1-t);
    if (mode==='inout') return t*t*(3-2*t);
    return t;
  };
  let seq = 1;
  function makeLayer(name) { return { id: Q.uid(), name: name || `Layer ${++seq}`, visible: true, opacity: 1, blend: 'source-over' }; }
  class History {
    constructor(doc) { this.doc = doc; this.undoStack = []; this.redoStack = []; this.max = 36; this.snap = null; this.snapCtx = null; this.onchange = null; }
    notify() { if (this.onchange) this.onchange(); }
    structSnapshot() {
      const d = this.doc;
      return { layers: d.layers.map(l => ({ ...l })), frames: d.frames.map(f => ({cels: f.cels.slice(), duration: f.duration || 1, group: f.group || '', skipped: !!f.skipped})), activeLayer: d.activeLayer, activeFrame: d.activeFrame, bg: d.bg, playRange: d.playRange ? {...d.playRange} : null, motionGuide:d.motionGuide.map(p=>({...p})), motionGuideVisible:d.motionGuideVisible, audioTrack:d.audioTrack ? {...d.audioTrack} : null };
    }
    applyStruct(s) {
      const d = this.doc;
      d.layers = s.layers.map(l => ({ ...l })); d.frames = s.frames.map(f => ({ cels: f.cels.slice(), duration: f.duration || 1, group: f.group || '', skipped: !!f.skipped }));
      d.bg = s.bg || '#ffffff'; d.playRange = s.playRange ? {...s.playRange} : null;
      d.motionGuide = (s.motionGuide || []).map(p=>({...p})); d.motionGuideVisible=!!s.motionGuideVisible;
      d.audioTrack = s.audioTrack ? {...s.audioTrack} : null;
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
      this.playRange = opts.playRange && Number.isInteger(opts.playRange.start) && Number.isInteger(opts.playRange.end) ? {start:opts.playRange.start,end:opts.playRange.end} : null;
      this.motionGuide=Array.isArray(opts.motionGuide) ? opts.motionGuide.slice(0,512).filter(p=>p && Number.isFinite(p.x) && Number.isFinite(p.y)).map(p=>({x:Q.clamp(p.x,0,this.width),y:Q.clamp(p.y,0,this.height)})) : [];
      this.motionGuideVisible=opts.motionGuideVisible !== false;
      this.audioTrack=Q.validAudioTrack(opts.audioTrack) ? {name:opts.audioTrack.name,data:opts.audioTrack.data,muted:!!opts.audioTrack.muted} : null;
      this.playMode = opts.playMode || 'loop'; this.onionFrames = Q.clamp(opts.onionFrames || 1, 1, 4);
      this.onionPrevFrames = Q.clamp(opts.onionPrevFrames == null ? this.onionFrames : Math.round(opts.onionPrevFrames),0,4);
      this.onionNextFrames = Q.clamp(opts.onionNextFrames == null ? this.onionFrames : Math.round(opts.onionNextFrames),0,4);
      this.onionIncludeSkipped = !!opts.onionIncludeSkipped; this.onionLayerOnly = !!opts.onionLayerOnly;
      this.onionOriginalColor = !!opts.onionOriginalColor; this.onionAbove = !!opts.onionAbove;
      this.onionPrevColor = opts.onionPrevColor || '#ff5a7a'; this.onionNextColor = opts.onionNextColor || '#4fd1c5'; this.guide = Object.assign({type:'off', symmetry:'off', spacing:100, horizon:0.5, spread:0.5}, opts.guide || {});
      this.layers = [makeLayer('Layer 1')]; this.frames = [{ cels:[null], duration:1, group:'' }]; this.activeFrame = 0; this.activeLayer = 0;
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
        if (src) { layer.opacity = src.opacity; layer.blend = src.blend; layer.alphaLocked = !!src.alphaLocked; layer.clipped = !!src.clipped; }
        this.layers.splice(at,0,layer);
        for (const f of this.frames) { const c = src && f.cels[copyFrom]; f.cels.splice(at,0,c ? Q.copyCanvas(c) : null); }
        this.activeLayer = at; return at;
      });
    }
    insertImageLayer(canvas, name) {
      if (!canvas || canvas.width!==this.width || canvas.height!==this.height) return false;
      this.history.struct(function () {
        const at=this.activeLayer+1, targetFrame=this.activeFrame;
        this.layers.splice(at,0,makeLayer(String(name || 'Imported image').slice(0,64)));
        this.frames.forEach((frame,i)=>frame.cels.splice(at,0,i===targetFrame ? canvas : null));
        this.activeLayer=at;
      });
      return true;
    }
    copyRegionToLayer(rect) {
      const source = this.activeCel(false); if (!source || !rect) return false;
      // Prepare pixels before changing structure, so allocation errors cannot leave a half-created layer.
      const copied=Q.canvas(this.width,this.height), ctx=copied.getContext('2d');
      ctx.save(); Q.selectionPath(ctx,rect); ctx.clip(); ctx.drawImage(source,rect.x,rect.y,rect.w,rect.h,rect.x,rect.y,rect.w,rect.h); ctx.restore();
      this.history.struct(function () {
        const at=this.activeLayer+1; this.layers.splice(at,0,makeLayer('Selection copy'));
        this.frames.forEach((frame,idx) => { frame.cels.splice(at,0,idx===this.activeFrame ? copied : null); });
        this.activeLayer=at;
      });
      return true;
    }
    deleteLayer(i) {
      if (this.layers.length < 2) { Q.toast('A canvas needs at least one layer'); return; }
      if (i < 0 || i >= this.layers.length) return;
      if (this.layers[i].locked) { Q.toast('Unlock the layer first'); return; }
      return this.history.struct(function () { this.layers.splice(i,1); for (const f of this.frames) f.cels.splice(i,1); this.activeLayer = Q.clamp(this.activeLayer,0,this.layers.length-1); });
    }
    moveLayer(i,dir) {
      const j = i + dir; if (i < 0 || i >= this.layers.length || j < 0 || j >= this.layers.length) return;
      return this.history.struct(function () { this.layers.splice(j,0,this.layers.splice(i,1)[0]); for (const f of this.frames) f.cels.splice(j,0,f.cels.splice(i,1)[0]); this.activeLayer = j; });
    }
    mergeDown(i) {
      if (i <= 0 || i >= this.layers.length) { Q.toast('Nothing below to merge into'); return; }
      if (this.layers[i].locked || this.layers[i-1].locked || this.layers[i].alphaLocked || this.layers[i-1].alphaLocked) { Q.toast('Unlock both layers and alpha first'); return; }
      if (this.layers.some(l=>l.clipped)) { Q.toast('Turn off clipping masks before merging layers',4000); return; }
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
    clearLayer(i) { if (i < 0 || i >= this.layers.length) return; if (this.layers[i].locked || this.layers[i].alphaLocked) { Q.toast('Unlock the layer and alpha first'); return; } return this.history.struct(function () { for (const f of this.frames) f.cels[i] = null; }); }
    addFrame(duplicate) { return this.history.struct(function () { const at = this.activeFrame+1; this.frames.splice(at,0,{ cels:duplicate ? this.cloneCels(this.frames[this.activeFrame].cels) : this.blankCels(), duration: duplicate ? (this.frames[this.activeFrame].duration || 1) : 1, group: duplicate ? (this.frames[this.activeFrame].group || '') : '', skipped: duplicate ? !!this.frames[this.activeFrame].skipped : false }); this.activeFrame=at; }); }
    setFrameDuration(i, duration) { if (!this.frames[i]) return; return this.history.struct(function () { this.frames[i].duration = Q.clamp(Math.round(duration) || 1,1,60); }); }
    setFrameSkipped(i,skipped) { if (!this.frames[i] || !!this.frames[i].skipped === !!skipped) return; return this.history.struct(function () { this.frames[i].skipped=!!skipped; }); }
    setFrameGroup(i, group) { if (!this.frames[i]) return; const name = String(group || '').trim().slice(0, 32); if (this.frames[i].group === name) return; return this.history.struct(function () { this.frames[i].group = name; }); }
    deleteFrame(i) {
      if (this.frames.length < 2) { Q.toast('A canvas needs at least one frame'); return; }
      if (i < 0 || i >= this.frames.length) return;
      return this.history.struct(function () { this.frames.splice(i,1); this.activeFrame = Q.clamp(this.activeFrame,0,this.frames.length-1); this.normalizePlayRange(); });
    }
    moveFrame(i,dir) { const j = i+dir; if (i < 0 || i >= this.frames.length || j < 0 || j >= this.frames.length) return; return this.history.struct(function () { this.frames.splice(j,0,this.frames.splice(i,1)[0]); this.activeFrame=j; }); }
    normalizePlayRange() {
      if (!this.playRange) return;
      const last=this.frames.length-1, start=Q.clamp(this.playRange.start,0,last), end=Q.clamp(this.playRange.end,start,last);
      this.playRange={start:start,end:end};
    }
    setPlayRange(start,end) {
      if (start === null && end === null) { if (this.playRange) this.history.struct(function () { this.playRange=null; }); return true; }
      if (!Number.isInteger(start) || !Number.isInteger(end) || start<0 || end<start || end>=this.frames.length) return false;
      if (!this.playRange || this.playRange.start!==start || this.playRange.end!==end) this.history.struct(function () { this.playRange={start:start,end:end}; });
      return true;
    }
    batchFrames(start,end,operation,value) {
      if (!Number.isInteger(start) || !Number.isInteger(end) || start<0 || end<start || end>=this.frames.length) return false;
      if (operation === 'duplicate' && this.frames.length + end-start+1 > 60) return false;
      if (!['label','hold','reverse','duplicate','skip','include'].includes(operation)) return false;
      let copies;
      if (operation === 'duplicate') copies=this.frames.slice(start,end+1).map(f=>({cels:this.cloneCels(f.cels),duration:f.duration || 1,group:f.group || '',skipped:!!f.skipped}));
      this.history.struct(function () {
        if (operation === 'label') {
          const name=String(value || '').trim().slice(0,32); for (let i=start;i<=end;i++) this.frames[i].group=name;
        } else if (operation === 'hold') {
          const hold=Q.clamp(Math.round(value) || 1,1,60); for (let i=start;i<=end;i++) this.frames[i].duration=hold;
        } else if (operation === 'skip' || operation === 'include') {
          for (let i=start;i<=end;i++) this.frames[i].skipped=operation === 'skip';
        } else if (operation === 'reverse') {
          const reversed=this.frames.slice(start,end+1).reverse(); this.frames.splice(start,reversed.length,...reversed);
          if (this.activeFrame>=start && this.activeFrame<=end) this.activeFrame=start+end-this.activeFrame;
        } else {
          this.frames.splice(end+1,0,...copies); this.activeFrame=end+1;
        }
      });
      return true;
    }
    // Replace this layer's destination cels with independent copies in a single undo step.
    copyCelToRange(source,start,end) {
      if (!Number.isInteger(source) || !Number.isInteger(start) || !Number.isInteger(end) || source<0 || source>=this.frames.length || start<0 || end<start || end>=this.frames.length) return 'Invalid frame range';
      const layer=this.layer(), src=this.cel(source,this.activeLayer,false);
      if (layer.locked || layer.alphaLocked) return 'Unlock the layer and alpha first';
      if (!src) return 'Source cel is empty';
      const targets=[]; for (let i=start;i<=end;i++) if (i!==source) targets.push(i);
      if (!targets.length) return 'Choose at least one destination other than the source';
      // Limit new pixel allocations before touching the document. Existing cels remain
      // in undo history, so peak memory can still be higher than this bound.
      if (this.width*this.height*4*targets.length>64*1024*1024) return 'Too many pixels to copy at once; use a smaller range';
      const copies=targets.map(()=>Q.copyCanvas(src)), li=this.activeLayer;
      this.history.struct(function () { targets.forEach((frame,i)=>{ this.frames[frame].cels[li]=copies[i]; }); });
      return null;
    }
    // Validation is shared by the confirmation UI and the actual atomic operation.
    validateMotionBake(source,start,end,easing,reverse) {
      if (!Number.isInteger(source) || !Number.isInteger(start) || !Number.isInteger(end) || source<0 || source>=this.frames.length || start<0 || end<=start || end>=this.frames.length) return 'Choose a valid source and at least two destination frames';
      if (!['linear','in','out','inout'].includes(easing) || (reverse !== undefined && typeof reverse !== 'boolean')) return 'Choose a valid easing and direction';
      if (this.layer().locked || this.layer().alphaLocked) return 'Unlock the layer and alpha first';
      if (!this.cel(source,this.activeLayer,false)) return 'Source cel is empty';
      if (!Q.motionPathSampler(this.motionGuide)) return 'Draw a motion guide with at least two different points';
      if (this.width*this.height*4*(end-start+1)>64*1024*1024) return 'Too many pixels to generate at once; use a smaller range';
      return null;
    }
    bakeMotionPath(source,start,end,easing,reverse) {
      const error=this.validateMotionBake(source,start,end,easing,reverse); if (error) return error;
      const sampler=Q.motionPathSampler(this.motionGuide), origin=sampler(reverse ? 1 : 0), src=this.cel(source,this.activeLayer,false), li=this.activeLayer;
      const copies=[];
      for (let frame=start;frame<=end;frame++) {
        const t=Q.motionEase((frame-start)/(end-start),easing), p=sampler(reverse ? 1-t : t), cv=Q.canvas(this.width,this.height);
        cv.getContext('2d').drawImage(src,p.x-origin.x,p.y-origin.y); copies.push(cv);
      }
      this.history.struct(function () { copies.forEach((cel,i)=>{ this.frames[start+i].cels[li]=cel; }); });
      return null;
    }
    deleteFrameRange(start,end) {
      if (!Number.isInteger(start) || !Number.isInteger(end) || start<0 || end<start || end>=this.frames.length || end-start+1>=this.frames.length) return false;
      this.history.struct(function () {
        const count=end-start+1, current=this.activeFrame;
        this.frames.splice(start,count);
        this.activeFrame=current<start ? current : current>end ? current-count : Math.min(start,this.frames.length-1);
        this.normalizePlayRange();
      });
      return true;
    }
    setAudioTrack(track) {
      if (track !== null && !Q.validAudioTrack(track)) return false;
      const clean=track ? {name:track.name,data:track.data,muted:!!track.muted} : null;
      this.history.struct(function () { this.audioTrack=clean; }); return true;
    }
    setAudioMuted(muted) {
      if (!this.audioTrack || this.audioTrack.muted===!!muted) return false;
      this.history.struct(function () { this.audioTrack={...this.audioTrack,muted:!!muted}; }); return true;
    }
    setMotionGuide(points) {
      if (!Array.isArray(points) || (points.length!==0 && (points.length<2 || points.length>512))) return false;
      if (points.some(p=>!p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) return false;
      const clean=points.map(p=>({x:Q.clamp(p.x,0,this.width),y:Q.clamp(p.y,0,this.height)}));
      this.history.struct(function () { this.motionGuide=clean; if (clean.length) this.motionGuideVisible=true; }); return true;
    }
    setMotionGuideVisible(visible) {
      visible=!!visible; if (this.motionGuideVisible===visible) return;
      this.history.struct(function () { this.motionGuideVisible=visible; });
    }
    setBackground(color) { if (this.bg === color) return; return this.history.struct(function () { this.bg=color; }); }
    setLayerClipped(i, value) {
      if (!Number.isInteger(i) || !this.layers[i] || (value && !this.layers.slice(0,i).some(l=>!l.clipped))) return false;
      if (!!this.layers[i].clipped !== !!value) this.history.struct(function () { this.layers[i].clipped=!!value; });
      return true;
    }
    clipBase(i) {
      if (!this.layers[i] || !this.layers[i].clipped) return -1;
      for (let n=i-1;n>=0;n--) if (!this.layers[n].clipped) return n;
      return -1;
    }
    clipBuffer() {
      if (!this._clipBuffer || this._clipBuffer.width!==this.width || this._clipBuffer.height!==this.height) this._clipBuffer=Q.canvas(this.width,this.height);
      const g=this._clipBuffer.getContext('2d'); g.setTransform(1,0,0,1,0,0); g.globalAlpha=1; g.globalCompositeOperation='source-over'; g.clearRect(0,0,this.width,this.height);
      return g;
    }
    setLayerProp(i,key,value) { if (this.layers[i]) return this.history.struct(function () { this.layers[i][key]=value; }); }
    setLayerPropLive(i,key,value) { if (this.layers[i]) this.layers[i][key]=value; }
    composite(ctx,frameIdx,opts = {}) {
      const f=this.frames[frameIdx]; if (!f) return;
      const visible=i=>this.layers[i] && (this.layers[i].visible || opts.includeHidden);
      const opacity=i=>opts.ignoreOpacity ? 1 : this.layers[i].opacity;
      const outer=opts.alpha == null ? 1 : opts.alpha;
      const draw=(image,alpha,blend)=>{ ctx.save(); ctx.globalAlpha=outer*alpha; ctx.globalCompositeOperation=blend || 'source-over'; ctx.drawImage(image,0,0); ctx.restore(); };
      if (opts.onlyLayer != null) {
        const i=opts.onlyLayer, layer=this.layers[i];
        if (!layer || !visible(i) || !f.cels[i]) return;
        if (!layer.clipped) { draw(f.cels[i],opacity(i),layer.blend); return; }
        const base=this.clipBase(i);
        if (base<0 || !visible(base) || !f.cels[base]) return;
        const g=this.clipBuffer(); g.globalAlpha=opacity(i); g.drawImage(f.cels[i],0,0);
        g.globalAlpha=opacity(base); g.globalCompositeOperation='destination-in'; g.drawImage(f.cels[base],0,0);
        draw(this._clipBuffer,1,'source-over'); return;
      }
      for (let i=0;i<this.layers.length;) {
        const layer=this.layers[i];
        // An orphaned clipped layer has no base and is not rendered.
        if (layer.clipped) { i++; continue; }
        let end=i+1; while (end<this.layers.length && this.layers[end].clipped) end++;
        if (visible(i) && f.cels[i]) {
          let hasVisibleClip=false;
          for (let j=i+1;j<end;j++) if (visible(j) && f.cels[j] && opacity(j)>0) { hasVisibleClip=true; break; }
          if (!hasVisibleClip) draw(f.cels[i],opacity(i),layer.blend);
          else {
            // Build one clipped stack, preserving the base's alpha. Clipped layers
            // use Normal; the base blend mode applies to the completed stack.
            const g=this.clipBuffer(); g.globalAlpha=opacity(i); g.drawImage(f.cels[i],0,0);
            g.globalCompositeOperation='source-atop';
            for (let j=i+1;j<end;j++) if (visible(j) && f.cels[j]) { g.globalAlpha=opacity(j); g.drawImage(f.cels[j],0,0); }
            draw(this._clipBuffer,1,layer.blend);
          }
        }
        i=end;
      }
    }
    renderFrame(canvas,frameIdx,opts = {}) {
      const c = canvas.getContext('2d'); c.setTransform(1,0,0,1,0,0); c.globalAlpha=1; c.globalCompositeOperation='source-over'; c.clearRect(0,0,canvas.width,canvas.height);
      if (opts.background !== false) { c.fillStyle=opts.background || this.bg; c.fillRect(0,0,canvas.width,canvas.height); }
      this.composite(c,frameIdx,opts); return canvas;
    }
    flatten(frameIdx,opts = {}) { return this.renderFrame(Q.canvas(this.width,this.height),frameIdx,opts); }
    thumbnail(frameIdx,size = 160) {
      const scale = size/Math.max(this.width,this.height), cv = Q.canvas(this.width*scale,this.height*scale), c=cv.getContext('2d');
      c.fillStyle=this.bg; c.fillRect(0,0,cv.width,cv.height); c.save(); c.scale(cv.width/this.width,cv.height/this.height); this.composite(c,frameIdx == null ? this.activeFrame : frameIdx); c.restore(); return cv;
    }
    layerThumbnail(i,size = 46) { const scale=size/Math.max(this.width,this.height), cv=Q.canvas(this.width*scale,this.height*scale), cel=this.cel(this.activeFrame,i,false); if (cel) cv.getContext('2d').drawImage(cel,0,0,cv.width,cv.height); return cv; }
    memoryMB() { return Math.round(this.frames.reduce((n,f) => n+f.cels.filter(Boolean).length,0)*this.width*this.height*4/(1024*1024)); }
  }
  Q.onionNeighbors = function (doc) {
    function collect(direction,limit) {
      const out=[]; let i=doc.activeFrame+direction;
      while (i>=0 && i<doc.frames.length && out.length<limit) {
        if (doc.onionIncludeSkipped || !doc.frames[i].skipped) out.push(i);
        i+=direction;
      }
      return out;
    }
    return {previous:collect(-1,doc.onionPrevFrames),next:collect(1,doc.onionNextFrames)};
  };
  Q.Doc=Doc; Q.History=History; Q.makeLayer=makeLayer;
})();
