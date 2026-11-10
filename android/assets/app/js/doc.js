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
  Q.validCameraKey = function (key,width,height) {
    return !!key && Number.isInteger(key.frame) && key.frame>=0 && key.frame<=10000 &&
      Number.isFinite(key.x) && key.x>=0 && key.x<=width && Number.isFinite(key.y) && key.y>=0 && key.y<=height &&
      Number.isFinite(key.zoom) && key.zoom>=0.25 && key.zoom<=4 && Number.isFinite(key.angle) && Math.abs(key.angle)<=1440 &&
      ['linear','in','out','inout'].includes(key.easing);
  };
  Q.cameraPose = function (doc,frame) {
    const keys=doc.cameraKeys;
    if (!keys.length) return {x:doc.width/2,y:doc.height/2,zoom:1,angle:0,easing:'linear'};
    if (frame<=keys[0].frame) return {...keys[0]};
    if (frame>=keys[keys.length-1].frame) return {...keys[keys.length-1]};
    for (let i=0;i<keys.length-1;i++) {
      const a=keys[i], b=keys[i+1]; if (frame>b.frame) continue;
      const t=Q.motionEase((frame-a.frame)/(b.frame-a.frame),a.easing), lerp=k=>a[k]+(b[k]-a[k])*t;
      return {x:lerp('x'),y:lerp('y'),zoom:lerp('zoom'),angle:lerp('angle'),easing:a.easing};
    }
  };
  Q.validLayerMotionKey = function (key,width,height) {
    return !!key && Number.isInteger(key.frame) && key.frame>=0 && key.frame<=10000 &&
      Number.isFinite(key.x) && Math.abs(key.x)<=width*4 && Number.isFinite(key.y) && Math.abs(key.y)<=height*4 &&
      Number.isFinite(key.scale) && key.scale>=0.1 && key.scale<=4 && Number.isFinite(key.angle) && Math.abs(key.angle)<=1440 &&
      ['linear','in','out','inout'].includes(key.easing);
  };
  Q.layerMotionPose = function (layer,frame) {
    const keys=layer.motionKeys || [];
    if (!keys.length) return {x:0,y:0,scale:1,angle:0,easing:'linear'};
    if (frame<=keys[0].frame) return {...keys[0]};
    if (frame>=keys[keys.length-1].frame) return {...keys[keys.length-1]};
    for (let i=0;i<keys.length-1;i++) {
      const a=keys[i], b=keys[i+1]; if (frame>b.frame) continue;
      const t=Q.motionEase((frame-a.frame)/(b.frame-a.frame),a.easing), lerp=k=>a[k]+(b[k]-a[k])*t;
      return {x:lerp('x'),y:lerp('y'),scale:lerp('scale'),angle:lerp('angle'),easing:a.easing};
    }
  };
  Q.sanitizeLayerMotion = function (layer,width,height) {
    const out=[];
    if (Array.isArray(layer.motionKeys)) layer.motionKeys.slice(0,60).forEach(k=>{
      if (!Q.validLayerMotionKey(k,width,height)) return;
      const index=out.findIndex(existing=>existing.frame===k.frame), key={frame:k.frame,x:k.x,y:k.y,scale:k.scale,angle:k.angle,easing:k.easing};
      if (index>=0) out.splice(index,1); out.push(key);
    });
    return out.sort((a,b)=>a.frame-b.frame);
  };
  function copyLayer(layer) { return {...layer,motionKeys:(layer.motionKeys || []).map(k=>({...k}))}; }
  // Analytic planar two-bone IK; targets outside reach are clamped to the
  // nearest possible distance, while the requested bend side is maintained.
  Q.solveTwoBoneIK = function (root,joint,tip,target,bend) {
    const l1=Math.hypot(joint.x-root.x,joint.y-root.y), l2=Math.hypot(tip.x-joint.x,tip.y-joint.y);
    if (!(l1>0.5 && l2>0.5) || (bend!==1 && bend!==-1)) return null;
    let dx=target.x-root.x, dy=target.y-root.y, distance=Math.hypot(dx,dy);
    if (distance<1e-9) { dx=tip.x-root.x; dy=tip.y-root.y; let size=Math.hypot(dx,dy); if (size<1e-9) { dx=joint.x-root.x; dy=joint.y-root.y; size=l1; } dx/=size; dy/=size; }
    else { dx/=distance; dy/=distance; }
    const reach=Q.clamp(distance,Math.abs(l1-l2),l1+l2);
    let elbow;
    if (reach<1e-9) elbow={x:root.x+(joint.x-root.x)*bend,y:root.y+(joint.y-root.y)*bend};
    else {
      const cosine=Q.clamp((l1*l1+reach*reach-l2*l2)/(2*l1*reach),-1,1), sine=Math.sqrt(Math.max(0,1-cosine*cosine))*bend;
      elbow={x:root.x+l1*(dx*cosine-dy*sine),y:root.y+l1*(dy*cosine+dx*sine)};
    }
    return {elbow:elbow,end:{x:root.x+dx*reach,y:root.y+dy*reach},clamped:Math.abs(reach-distance)>1e-7};
  };
  let seq = 1;
  function makeLayer(name) { return { id: Q.uid(), name: name || `Layer ${++seq}`, visible: true, opacity: 1, blend: 'source-over' }; }
  class History {
    constructor(doc) { this.doc = doc; this.undoStack = []; this.redoStack = []; this.max = 36; this.snap = null; this.snapCtx = null; this.onchange = null; }
    notify() { if (this.onchange) this.onchange(); }
    structSnapshot() {
      const d = this.doc;
      return { layers: d.layers.map(copyLayer), frames: d.frames.map(f => ({cels: f.cels.slice(), duration: f.duration || 1, group: f.group || '', skipped: !!f.skipped})), activeLayer: d.activeLayer, activeFrame: d.activeFrame, bg: d.bg, playRange: d.playRange ? {...d.playRange} : null, motionGuide:d.motionGuide.map(p=>({...p})), motionGuideVisible:d.motionGuideVisible, cameraEnabled:d.cameraEnabled, cameraKeys:d.cameraKeys.map(k=>({...k})), audioTrack:d.audioTrack ? {...d.audioTrack} : null, solo:d.solo ? {target:d.solo.target,visibility:d.solo.visibility.map(v=>({...v}))} : null };
    }
    applyStruct(s) {
      const d = this.doc;
      d.layers = s.layers.map(copyLayer); d.frames = s.frames.map(f => ({ cels: f.cels.slice(), duration: f.duration || 1, group: f.group || '', skipped: !!f.skipped }));
      d.bg = s.bg || '#ffffff'; d.playRange = s.playRange ? {...s.playRange} : null;
      d.motionGuide = (s.motionGuide || []).map(p=>({...p})); d.motionGuideVisible=!!s.motionGuideVisible;
      d.audioTrack = s.audioTrack ? {...s.audioTrack} : null;
      d.solo = s.solo ? {target:s.solo.target,visibility:s.solo.visibility.map(v=>({...v}))} : null;
      d.cameraEnabled=!!s.cameraEnabled; d.cameraKeys=(s.cameraKeys || []).map(k=>({...k}));
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
      this.cameraEnabled=!!opts.cameraEnabled;
      this.cameraKeys=[];
      if (Array.isArray(opts.cameraKeys)) opts.cameraKeys.slice(0,60).forEach(k=>{ if (Q.validCameraKey(k,this.width,this.height)) { const key={frame:k.frame,x:k.x,y:k.y,zoom:k.zoom,angle:k.angle,easing:k.easing}; this.cameraKeys=this.cameraKeys.filter(existing=>existing.frame!==key.frame); this.cameraKeys.push(key); } });
      this.cameraKeys.sort((a,b)=>a.frame-b.frame);
      this.audioTrack=Q.validAudioTrack(opts.audioTrack) ? {name:opts.audioTrack.name,data:opts.audioTrack.data,muted:!!opts.audioTrack.muted} : null;
      this.playMode = opts.playMode || 'loop'; this.onionFrames = Q.clamp(opts.onionFrames || 1, 1, 4);
      this.onionPrevFrames = Q.clamp(opts.onionPrevFrames == null ? this.onionFrames : Math.round(opts.onionPrevFrames),0,4);
      this.onionNextFrames = Q.clamp(opts.onionNextFrames == null ? this.onionFrames : Math.round(opts.onionNextFrames),0,4);
      this.onionIncludeSkipped = !!opts.onionIncludeSkipped; this.onionLayerOnly = !!opts.onionLayerOnly;
      this.onionOriginalColor = !!opts.onionOriginalColor; this.onionAbove = !!opts.onionAbove;
      this.onionPrevColor = opts.onionPrevColor || '#ff5a7a'; this.onionNextColor = opts.onionNextColor || '#4fd1c5'; this.guide = Object.assign({type:'off', symmetry:'off', spacing:100, horizon:0.5, spread:0.5}, opts.guide || {});
      this.solo=null;
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
        if (src) { layer.opacity = src.opacity; layer.blend = src.blend; layer.alphaLocked = !!src.alphaLocked; layer.clipped = !!src.clipped; layer.motionEnabled=!!src.motionEnabled; layer.motionKeys=(src.motionKeys || []).map(k=>({...k})); }
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
      if ((this.layers[i].motionKeys || []).length || (this.layers[i-1].motionKeys || []).length) { Q.toast('Remove motion keys from both layers before merging',4000); return; }
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
      return this.history.struct(function () { this.frames.splice(i,1); this.activeFrame = Q.clamp(this.activeFrame,0,this.frames.length-1); this.normalizePlayRange(); this.normalizeCameraKeys(); });
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
    // Interpolate two numeric poses, then rasterize every frame before recording
    // a single structural edit. The original is never incrementally resampled.
    validateTransformBake(source,start,end,easing,first,last,pivot) {
      if (!Number.isInteger(source) || !Number.isInteger(start) || !Number.isInteger(end) || source<0 || source>=this.frames.length || start<0 || end<=start || end>=this.frames.length) return 'Choose a valid source and at least two destination frames';
      if (!['linear','in','out','inout'].includes(easing)) return 'Choose a valid easing';
      if (this.layer().locked || this.layer().alphaLocked) return 'Unlock the layer and alpha first';
      if (!this.cel(source,this.activeLayer,false)) return 'Source cel is empty';
      const validPose=p=>p && ['x','y','scale','angle'].every(k=>Number.isFinite(p[k])) && Math.abs(p.x)<=this.width*4 && Math.abs(p.y)<=this.height*4 && p.scale>=0.1 && p.scale<=4 && Math.abs(p.angle)<=1440;
      if (!validPose(first) || !validPose(last)) return 'Offsets must be within four canvas sizes, scale 10–400%, and rotation −1440° to 1440°';
      if (!pivot || !Number.isFinite(pivot.x) || !Number.isFinite(pivot.y) || pivot.x<0 || pivot.x>this.width || pivot.y<0 || pivot.y>this.height) return 'Pivot must be inside the canvas';
      if (this.width*this.height*4*(end-start+1)>64*1024*1024) return 'Too many pixels to generate at once; use a smaller range';
      return null;
    }
    bakeTransform(source,start,end,easing,first,last,pivot) {
      const error=this.validateTransformBake(source,start,end,easing,first,last,pivot); if (error) return error;
      const src=this.cel(source,this.activeLayer,false), li=this.activeLayer, copies=[];
      for (let frame=start;frame<=end;frame++) {
        const t=Q.motionEase((frame-start)/(end-start),easing), lerp=k=>first[k]+(last[k]-first[k])*t;
        const cv=Q.canvas(this.width,this.height), c=cv.getContext('2d');
        c.translate(pivot.x+lerp('x'),pivot.y+lerp('y')); c.rotate(lerp('angle')*Math.PI/180); c.scale(lerp('scale'),lerp('scale')); c.translate(-pivot.x,-pivot.y); c.drawImage(src,0,0);
        copies.push(cv);
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
        this.normalizePlayRange(); this.normalizeCameraKeys();
      });
      return true;
    }
    // Generate deterministic particles as new raster cels on a topmost layer.
    // All cels are rendered before structure/history change so failure is atomic.
    validateParticles(o) {
      if (!o || !Number.isInteger(o.start) || !Number.isInteger(o.end) || o.start<0 || o.end<o.start || o.end>=this.frames.length) return 'Choose a valid frame range';
      if (!['burst','continuous'].includes(o.mode) || !['circle','square'].includes(o.shape) || typeof o.fade!=='boolean') return 'Choose valid particle options';
      if (!Number.isInteger(o.count) || o.count<1 || o.count>200 || !Number.isInteger(o.life) || o.life<1 || o.life>60 || !Number.isInteger(o.seed) || o.seed<0 || o.seed>2147483647) return 'Use 1–200 particles, life 1–60 frames, and an integer seed from 0 to 2147483647';
      if (!Number.isFinite(o.x) || !Number.isFinite(o.y) || o.x<0 || o.x>this.width || o.y<0 || o.y>this.height) return 'Emitter must be on the canvas';
      if (!Number.isFinite(o.angle) || Math.abs(o.angle)>360 || !Number.isFinite(o.spread) || o.spread<0 || o.spread>360 || !Number.isFinite(o.speed) || o.speed<0 || o.speed>4096 || !Number.isFinite(o.gravity) || Math.abs(o.gravity)>256) return 'Check direction, spread, speed and gravity';
      if (!Number.isFinite(o.radius) || o.radius<1 || o.radius>256 || !Number.isFinite(o.opacity) || o.opacity<=0 || o.opacity>1 || !Q.hexToRgb(o.color)) return 'Use a valid colour, radius 1–256 px and opacity over 0–100%';
      if (this.width*this.height*4*(o.end-o.start+1)>64*1024*1024) return 'Too many pixels to generate at once; use a smaller frame range';
      return null;
    }
    generateParticles(o) {
      const error=this.validateParticles(o); if (error) return error;
      const frameCount=o.end-o.start+1, color=Q.rgbToHex(Q.hexToRgb(o.color)); let seed=o.seed>>>0;
      function random() { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; }
      const particles=[];
      for (let i=0;i<o.count;i++) {
        const angle=(o.angle+(random()-0.5)*o.spread)*Math.PI/180, speed=o.speed*(0.65+0.35*random());
        particles.push({birth:o.mode==='burst' ? 0 : Math.floor(i*frameCount/o.count),vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,radius:o.radius*(0.7+0.3*random())});
      }
      const cels=[];
      for (let f=0;f<frameCount;f++) {
        const cv=Q.canvas(this.width,this.height), c=cv.getContext('2d'); c.fillStyle=color;
        particles.forEach(function (p) {
          const age=f-p.birth; if (age<0 || age>=o.life) return;
          const x=o.x+p.vx*age, y=o.y+p.vy*age+0.5*o.gravity*age*age;
          if (x+p.radius<0 || x-p.radius>cv.width || y+p.radius<0 || y-p.radius>cv.height) return;
          c.globalAlpha=o.opacity*(o.fade ? 1-age/o.life : 1);
          if (o.shape==='square') c.fillRect(x-p.radius,y-p.radius,p.radius*2,p.radius*2);
          else { c.beginPath(); c.arc(x,y,p.radius,0,Math.PI*2); c.fill(); }
        });
        cels.push(cv);
      }
      this.history.struct(function () {
        const at=this.layers.length; this.layers.push(makeLayer('Particles'));
        this.frames.forEach((frame,i)=>frame.cels.push(i>=o.start && i<=o.end ? cels[i-o.start] : null));
        this.activeLayer=at;
      });
      return null;
    }
    normalizeCameraKeys() {
      this.cameraKeys=this.cameraKeys.filter(k=>k.frame<this.frames.length);
      this.layers.forEach(layer=>{ layer.motionKeys=(layer.motionKeys || []).filter(k=>k.frame<this.frames.length); });
    }
    setCameraKey(key) {
      if (!Q.validCameraKey(key,this.width,this.height) || key.frame>=this.frames.length) return false;
      if (!this.cameraKeys.some(k=>k.frame===key.frame) && this.cameraKeys.length>=60) return false;
      const copy={frame:key.frame,x:key.x,y:key.y,zoom:key.zoom,angle:key.angle,easing:key.easing};
      this.history.struct(function () { this.cameraKeys=this.cameraKeys.filter(k=>k.frame!==copy.frame); this.cameraKeys.push(copy); this.cameraKeys.sort((a,b)=>a.frame-b.frame); this.cameraEnabled=true; }); return true;
    }
    removeCameraKey(frame) {
      if (!this.cameraKeys.some(k=>k.frame===frame)) return false;
      this.history.struct(function () { this.cameraKeys=this.cameraKeys.filter(k=>k.frame!==frame); }); return true;
    }
    clearCameraKeys() { if (!this.cameraKeys.length) return false; this.history.struct(function () { this.cameraKeys=[]; }); return true; }
    setCameraEnabled(enabled) { enabled=!!enabled; if (this.cameraEnabled===enabled) return false; this.history.struct(function () { this.cameraEnabled=enabled; }); return true; }
    setLayerMotionKey(index,key) {
      const layer=this.layers[index]; if (!layer || layer.locked || !Q.validLayerMotionKey(key,this.width,this.height) || key.frame>=this.frames.length) return false;
      const keys=layer.motionKeys || [];
      if (!keys.some(k=>k.frame===key.frame) && keys.length>=60) return false;
      const copy={frame:key.frame,x:key.x,y:key.y,scale:key.scale,angle:key.angle,easing:key.easing};
      this.history.struct(function () { const target=this.layers[index]; target.motionKeys=(target.motionKeys || []).filter(k=>k.frame!==copy.frame).concat([copy]).sort((a,b)=>a.frame-b.frame); target.motionEnabled=true; }); return true;
    }
    removeLayerMotionKey(index,frame) {
      const layer=this.layers[index]; if (!layer || layer.locked || !(layer.motionKeys || []).some(k=>k.frame===frame)) return false;
      this.history.struct(function () { const target=this.layers[index]; target.motionKeys=target.motionKeys.filter(k=>k.frame!==frame); }); return true;
    }
    clearLayerMotion(index) {
      const layer=this.layers[index]; if (!layer || layer.locked || !(layer.motionKeys || []).length) return false;
      this.history.struct(function () { this.layers[index].motionKeys=[]; }); return true;
    }
    setLayerMotionEnabled(index,value) {
      const layer=this.layers[index]; if (!layer || layer.locked || !!layer.motionEnabled===!!value) return false;
      this.history.struct(function () { this.layers[index].motionEnabled=!!value; }); return true;
    }
    hasLayerMotion() { return this.layers.some(layer=>layer.motionEnabled && (layer.motionKeys || []).length); }
    // Plan every key first; no changes occur until both tracks are valid.
    planTwoBoneIK(o) {
      if (!o || !Number.isInteger(o.upper) || !Number.isInteger(o.lower) || o.upper===o.lower || !this.layers[o.upper] || !this.layers[o.lower]) return {error:'Choose two different layers'};
      if (this.layers[o.upper].locked || this.layers[o.lower].locked) return {error:'Unlock both layers first'};
      if (!Number.isInteger(o.start) || !Number.isInteger(o.end) || o.start<0 || o.end<=o.start || o.end>=this.frames.length) return {error:'Choose at least two existing destination frames'};
      if (!['linear','in','out','inout'].includes(o.easing) || (o.bend!==1 && o.bend!==-1)) return {error:'Choose valid easing and bend side'};
      const validPoint=p=>p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x>=0 && p.x<=this.width && p.y>=0 && p.y<=this.height;
      if (![o.root,o.joint,o.tip,o.from,o.to].every(validPoint)) return {error:'All joint and target points must be on the canvas'};
      if (Math.hypot(o.joint.x-o.root.x,o.joint.y-o.root.y)<=0.5 || Math.hypot(o.tip.x-o.joint.x,o.tip.y-o.joint.y)<=0.5) return {error:'Both bones must be longer than half a pixel'};
      const retained=idx=>(this.layers[idx].motionKeys || []).filter(k=>k.frame<o.start || k.frame>o.end).map(k=>({...k}));
      const upper=retained(o.upper), lower=retained(o.lower), count=o.end-o.start+1;
      if (upper.length+count>60 || lower.length+count>60) return {error:'Each layer is limited to 60 keys'};
      const center={x:this.width/2,y:this.height/2}, restUpper=Math.atan2(o.joint.y-o.root.y,o.joint.x-o.root.x), restLower=Math.atan2(o.tip.y-o.joint.y,o.tip.x-o.joint.x);
      function key(frame,reference,destination,angle,previous) {
        let degrees=angle*180/Math.PI; while (degrees>180) degrees-=360; while (degrees<=-180) degrees+=360;
        if (previous!=null) { while (degrees-previous>180) degrees-=360; while (degrees-previous< -180) degrees+=360; }
        const r=degrees*Math.PI/180, dx=reference.x-center.x, dy=reference.y-center.y;
        return {frame:frame,x:destination.x-center.x-(Math.cos(r)*dx-Math.sin(r)*dy),y:destination.y-center.y-(Math.sin(r)*dx+Math.cos(r)*dy),scale:1,angle:degrees,easing:'linear'};
      }
      let clamped=0, lastUpper=null, lastLower=null, endPose=null;
      for (let frame=o.start;frame<=o.end;frame++) {
        const t=Q.motionEase((frame-o.start)/(o.end-o.start),o.easing), target={x:o.from.x+(o.to.x-o.from.x)*t,y:o.from.y+(o.to.y-o.from.y)*t};
        const solved=Q.solveTwoBoneIK(o.root,o.joint,o.tip,target,o.bend); if (!solved) return {error:'Could not solve these bones'};
        const upperAngle=Math.atan2(solved.elbow.y-o.root.y,solved.elbow.x-o.root.x)-restUpper;
        const lowerAngle=Math.atan2(solved.end.y-solved.elbow.y,solved.end.x-solved.elbow.x)-restLower;
        const u=key(frame,o.root,o.root,upperAngle,lastUpper), l=key(frame,o.joint,solved.elbow,lowerAngle,lastLower);
        if (!Q.validLayerMotionKey(u,this.width,this.height) || !Q.validLayerMotionKey(l,this.width,this.height)) return {error:'Generated motion exceeds layer offset or rotation limits'};
        upper.push(u); lower.push(l); lastUpper=u.angle; lastLower=l.angle; if (solved.clamped) clamped++; endPose={...solved,target:target};
      }
      return {upper:upper.sort((a,b)=>a.frame-b.frame),lower:lower.sort((a,b)=>a.frame-b.frame),clamped:clamped,endPose:endPose};
    }
    applyTwoBoneIK(o) {
      const plan=this.planTwoBoneIK(o); if (plan.error) return plan;
      this.history.struct(function () { this.layers[o.upper].motionKeys=plan.upper; this.layers[o.upper].motionEnabled=true; this.layers[o.lower].motionKeys=plan.lower; this.layers[o.lower].motionEnabled=true; });
      return {clamped:plan.clamped};
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
    restoreSolo() {
      if (!this.solo) return false;
      this.history.struct(function () { const visibility=new Map(this.solo.visibility.map(v=>[v.id,v.visible])); this.layers.forEach(l=>{ if (visibility.has(l.id)) l.visible=visibility.get(l.id); }); this.solo=null; }); return true;
    }
    toggleSolo(index) {
      const layer=this.layers[index]; if (!layer) return false;
      if (this.solo && this.solo.target===layer.id) return this.restoreSolo();
      this.history.struct(function () {
        if (!this.solo) this.solo={target:layer.id,visibility:this.layers.map(l=>({id:l.id,visible:!!l.visible}))};
        else { const old=new Set(this.solo.visibility.map(v=>v.id)); this.layers.forEach(l=>{ if(!old.has(l.id)) this.solo.visibility.push({id:l.id,visible:!!l.visible}); }); this.solo.target=layer.id; }
        const base=layer.clipped ? this.clipBase(index) : -1;
        this.layers.forEach((l,i)=>{ l.visible=i===index || i===base; });
      }); return true;
    }
    setLayerProp(i,key,value) { if (this.layers[i]) return this.history.struct(function () { this.layers[i][key]=value; }); }
    setLayerPropLive(i,key,value) { if (this.layers[i]) this.layers[i][key]=value; }
    composite(ctx,frameIdx,opts = {}) {
      const f=this.frames[frameIdx]; if (!f) return;
      const visible=i=>this.layers[i] && (this.layers[i].visible || opts.includeHidden);
      const opacity=i=>opts.ignoreOpacity ? 1 : this.layers[i].opacity;
      const outer=opts.alpha == null ? 1 : opts.alpha;
      const transform=(context,i)=>{
        const layer=this.layers[i]; if (!opts.animated || !layer.motionEnabled || !(layer.motionKeys || []).length) return;
        const p=Q.layerMotionPose(layer,frameIdx);
        context.translate(this.width/2+p.x,this.height/2+p.y); context.rotate(p.angle*Math.PI/180); context.scale(p.scale,p.scale); context.translate(-this.width/2,-this.height/2);
      };
      const draw=(image,alpha,blend,layerIndex)=>{ ctx.save(); ctx.globalAlpha=outer*alpha; ctx.globalCompositeOperation=blend || 'source-over'; if (layerIndex!=null) transform(ctx,layerIndex); ctx.drawImage(image,0,0); ctx.restore(); };
      const bufferLayer=(g,index,alpha,blend)=>{ g.save(); g.globalAlpha=alpha; g.globalCompositeOperation=blend; transform(g,index); g.drawImage(f.cels[index],0,0); g.restore(); };
      if (opts.onlyLayer != null) {
        const i=opts.onlyLayer, layer=this.layers[i];
        if (!layer || !visible(i) || !f.cels[i]) return;
        if (!layer.clipped) { draw(f.cels[i],opacity(i),layer.blend,i); return; }
        const base=this.clipBase(i);
        if (base<0 || !visible(base) || !f.cels[base]) return;
        const g=this.clipBuffer(); bufferLayer(g,i,opacity(i),'source-over'); bufferLayer(g,base,opacity(base),'destination-in');
        draw(this._clipBuffer,1,'source-over',null); return;
      }
      for (let i=0;i<this.layers.length;) {
        const layer=this.layers[i];
        if (layer.clipped) { i++; continue; }
        let end=i+1; while (end<this.layers.length && this.layers[end].clipped) end++;
        if (visible(i) && f.cels[i]) {
          let hasVisibleClip=false;
          for (let j=i+1;j<end;j++) if (visible(j) && f.cels[j] && opacity(j)>0) { hasVisibleClip=true; break; }
          if (!hasVisibleClip) draw(f.cels[i],opacity(i),layer.blend,i);
          else {
            const g=this.clipBuffer(); bufferLayer(g,i,opacity(i),'source-over');
            for (let j=i+1;j<end;j++) if (visible(j) && f.cels[j]) bufferLayer(g,j,opacity(j),'source-atop');
            draw(this._clipBuffer,1,layer.blend,null);
          }
        }
        i=end;
      }
    }
    // Animation transforms are never applied to the editable source cels.
    compositeCamera(ctx,frameIdx) {
      const camera=this.cameraEnabled && this.cameraKeys.length, animated=this.hasLayerMotion();
      if (!camera && !animated) { this.composite(ctx,frameIdx); return; }
      ctx.save(); ctx.beginPath(); ctx.rect(0,0,this.width,this.height); ctx.clip();
      if (camera) {
        const pose=Q.cameraPose(this,frameIdx);
        ctx.translate(this.width/2,this.height/2); ctx.scale(pose.zoom,pose.zoom); ctx.rotate(-pose.angle*Math.PI/180); ctx.translate(-pose.x,-pose.y);
        ctx.beginPath(); ctx.rect(0,0,this.width,this.height); ctx.clip();
      }
      this.composite(ctx,frameIdx,{animated:true}); ctx.restore();
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
