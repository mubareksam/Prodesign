/* Qalam — application shell: wires the document, viewport, UI and storage. */
(function () {
  'use strict';
  const Q = window.Q;

  const App = (Q.App = {
    doc: null,
    view: null,
    playing: false,
    playTimer: 0,
    recent: [],
    autosaveTimer: 0,
    ready: false,
    fillThreshold: 12,
    previousColor: null,
    lastPaintBrush: null,
    clipboard: null
  });

  /* ── boot ───────────────────────────────────────────────── */

  App.init = function () {
    const canvas = Q.el('#view');
    App.view = new Q.View(canvas);

    const v = App.view;
    v.onDocChange = function () { App.markDirty(); };
    v.onFill = function (x, y) { App.fillAt(x, y); };
    v.onWand = function (x, y) { App.wandAt(x, y); };
    v.onStrokeEnd = function () { App.markDirty(); App.pushRecentColor(); };
    v.onUndo = function () { App.undo(); };
    v.onRedo = function () { App.redo(); };
    v.onQuickEdit = function () { Q.UI.closeTray(); Q.UI.quickEditDialog(); };
    v.onClearCel = function () { Q.UI.clearCelDialog(); };
    v.onDrawStart = function () {
      if (!Q.el('#tray').classList.contains('hidden')) Q.UI.closeTray();
    };
    v.onPick = function (rgb) {
      App.setColor(rgb);
      v.tool = 'brush'; Q.UI.syncBrushUi();
      Q.el('#btnEyedrop').classList.remove('on');
      Q.toast('Picked ' + Q.rgbToHex(rgb));
    };

    Q.UI.init();
    // Do not let a slow storage provider keep the launch screen on top forever.
    setTimeout(function () { Q.el('#splash').classList.add('hidden'); }, 400);

    v.gestureDelays=Q.sanitizeGestureDelays(Q.Store.meta('gestureDelays'));
    const threshold = Q.Store.meta('fillThreshold');
    if (typeof threshold === 'number') App.fillThreshold = Q.clamp(threshold, 0, 128);
    const pressure=Q.Store.meta('globalPressure'), smoothing=Q.Store.meta('globalSmoothing');
    v.smudgeHardness=Q.sanitizeSmudgeHardness(Q.Store.meta('smudgeHardness'));
    v.globalPressure=Number.isFinite(pressure) ? Q.clamp(pressure,0.5,2) : 1;
    v.globalSmoothing=Number.isFinite(smoothing) ? Q.clamp(smoothing,0,0.9) : 0;
    Q.restoreBrushSettings(Q.Store.meta('brushSettings'));
    const savedBrush = Q.Store.meta('brush');
    const savedRecent = Q.Store.meta('recent');
    if (savedRecent && savedRecent.length) App.recent = savedRecent;
    if (savedBrush) v.brush = Q.brushById(savedBrush);
    App.lastPaintBrush = v.brush.eraser ? Q.BRUSHES.find(b=>!b.eraser) : v.brush;
    App.previousColor = Q.hexToRgb(Q.Store.meta('previousColor'));
    v.size = v.brush.size;
    v.color = Q.hexToRgb(Q.Store.meta('color')) || [24, 24, 26];
    v.opacity = 1;

    Q.Store.init().then(function (mode) {
      App.ready = true;
      Q.UI.showGallery();
      if (mode === 'local') {
        Q.toast('Using limited local storage — export often', 3200);
      }
    }).catch(function () {
      App.ready = true;
      Q.UI.showGallery();
      Q.toast('Storage unavailable — artwork will not persist', 4000);
    });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') { if (App.cancelAudioExport) App.cancelAudioExport(); App.stopPlay(); App.saveNow(false); }
    });

    // 0 = the app handled the back gesture, 1 = nothing left to close
    window.qalamBack = function () {
      if (App.cancelAudioExport) { App.cancelAudioExport(); return 0; }
      if (!Q.el('#modal').classList.contains('hidden')) { Q.UI.closeModal(); return 0; }
      if (Q.UI.isFocusMode()) { Q.UI.setFocusMode(false); return 0; }
      if (!Q.el('#tray').classList.contains('hidden')) { Q.UI.closeTray(); return 0; }
      if (!Q.el('#referenceWindow').classList.contains('hidden')) { Q.UI.closeReference(); return 0; }
      if (App.playing) { App.togglePlay(); return 0; }
      if (!Q.el('#studio').classList.contains('hidden')) { App.backToGallery(); return 0; }
      return 1;
    };

    requestAnimationFrame(function () {
      Q.hint('Three-finger tap undo · pinch & twist to zoom and rotate', 4200);
    });
  };

  /* ── documents ──────────────────────────────────────────── */

  App.createDoc = function (w, h, name) {
    const doc = new Q.Doc({ width: w, height: h, name: name || 'Untitled' });
    if (w * h > 1200 * 1200) doc.onion = false;
    App.adoptDoc(doc, true);
  };

  App.openDoc = function (id) {
    Q.Store.load(id).then(function (doc) {
      if (!doc) { Q.toast('Could not open that artwork'); return; }
      App.adoptDoc(doc, false);
    });
  };

  App.adoptDoc = function (doc, isNew) {
    if (App.cancelAudioExport) App.cancelAudioExport();
    App.stopPlay();
    if (App.view) App.view.cancelActiveInput();
    if (Q.UI.resetReference) Q.UI.resetReference();
    // Serialize the previous artwork before switching documents, including when
    // New canvas is opened from the studio before the autosave timer fires.
    if (App.doc && App.doc.id !== doc.id) { clearTimeout(App.autosaveTimer); App.saveNow(false); }
    App.doc = doc;
    const v = App.view;
    v.doc = doc;
    v.locked = false;
    v.tool = 'brush'; v.selection = null; v.selectionDraft = null; v.selectionOperation='replace'; v.motionDraft = null; v.transparentPreview = false;
    Q.UI.showStudio();
    Q.el('#btnEyedrop').classList.remove('on');
    Q.el('#btnFill').classList.remove('on');
    v.resize();
    v.fit();
    v.dirty = true;
    Q.Store.meta('lastDoc', doc.id);
    // keep the page in sync when layer/frame structure changes
    doc.history.onchange = function () {
      Q.UI.syncHistory();
      App.markDirty();
    };
    if (isNew) {
      App.saveNow(false);
      Q.hint('Draw with a finger or stylus · pinch to zoom', 2600);
    }
  };

  App.backToGallery = function () {
    App.stopPlay();
    if (Q.UI.resetReference) Q.UI.resetReference();
    if (App.view) App.view.cancelActiveInput();
    App.saveNow(false);
    if (App.doc) Q.Store.meta('lastDoc', App.doc.id);
    Q.UI.showGallery();
  };

  /* ── editing ────────────────────────────────────────────── */

  App.undo = function () {
    App.stopPlay();
    if (!App.doc) return;
    if (App.doc.history.undo()) {
      App.view.dirty = true;
      Q.UI.syncDoc();
      App.markDirty();
      Q.haptic(6);
    }
  };

  App.redo = function () {
    App.stopPlay();
    if (!App.doc) return;
    if (App.doc.history.redo()) {
      App.view.dirty = true;
      Q.UI.syncDoc();
      App.markDirty();
      Q.haptic(6);
    }
  };

  App.setBrush = function (id) {
    const b = Q.brushById(id);
    if (!b.eraser) App.lastPaintBrush=b;
    App.view.brush = b;
    App.view.tool = 'brush';
    Q.el('#btnFill').classList.remove('on'); Q.el('#btnEyedrop').classList.remove('on');
    App.view.size = b.size;
    App.view.opacity = 1;
    Q.Store.meta('brush', id);
    Q.UI.syncBrushUi();
  };

  App.setSize = function (n) {
    App.view.size = Q.clamp(n, 1, 240);
    Q.UI.syncBrushUi();
  };

  App.setOpacity = function (v) {
    App.view.opacity = Q.clamp(v, 0.01, 1);
    Q.UI.syncBrushUi();
  };

  App.setColor = function (rgb) {
    const v=App.view; if (Q.rgbToHex(v.color)!==Q.rgbToHex(rgb)) { App.previousColor=v.color.slice(); Q.Store.meta('previousColor',Q.rgbToHex(App.previousColor)); }
    v.color = rgb.slice();
    Q.Store.meta('color', Q.rgbToHex(rgb));
    Q.UI.syncBrushUi();
    App.pushRecentColor();
  };

  App.swapPreviousColor = function () {
    if (!App.previousColor || Q.rgbToHex(App.previousColor)===Q.rgbToHex(App.view.color)) { Q.toast('Choose another colour first'); return false; }
    App.setColor(App.previousColor); Q.toast('Switched to previous colour'); return true;
  };
  App.useEraser = function (sync) {
    const v=App.view;
    if (sync) {
      const source=v.brush.eraser ? App.lastPaintBrush : v.brush;
      if (!source || source.eraser) { Q.toast('Choose a painting brush first'); return; }
      App.lastPaintBrush=source; v.brush={...source,eraser:true,syncedEraser:true}; Q.toast('Eraser matched to '+source.name);
    } else if (v.brush.eraser) { v.brush=App.lastPaintBrush || Q.BRUSHES.find(b=>!b.eraser); Q.toast('Painting brush'); }
    else { App.lastPaintBrush=v.brush; v.brush=Q.brushById('eraser'); Q.toast('Eraser'); }
    v.tool='brush'; Q.el('#btnFill').classList.remove('on'); Q.el('#btnEyedrop').classList.remove('on'); Q.UI.syncBrushUi();
  };
  App.toggleSolo = function (index) {
    const d=App.doc; if(!d || !d.toggleSolo(index)) return; App.view.dirty=true; Q.UI.syncDoc(); App.markDirty();
    Q.toast(d.solo && d.layer(index).clipped ? 'Solo includes the clipping base' : d.solo ? 'Layer soloed · hold eye again to restore' : 'Visibility restored',3000);
  };
  App.restoreSolo = function () { if(!App.doc || !App.doc.restoreSolo()) return; App.view.dirty=true; Q.UI.syncDoc(); App.markDirty(); Q.toast('Visibility restored'); };

  App.pushRecentColor = function () {
    const c = App.view.color;
    const key = Q.rgbToHex(c);
    App.recent = App.recent.filter(function (r) { return Q.rgbToHex(r) !== key; });
    App.recent.unshift(c);
    App.recent = App.recent.slice(0, 12);
    Q.Store.meta('recent', App.recent);
  };

  App.setLayerProp = function (i, key, value) {
    App.doc.setLayerProp(i, key, value);
    App.view.dirty = true;
    Q.UI.syncDoc();
  };

  App.setLayerClipped = function (i,value) {
    if (!App.doc || !App.doc.setLayerClipped(i,value)) { Q.toast('Add a layer below before enabling clipping',4000); return; }
    App.view.dirty=true; Q.UI.syncDoc(); App.markDirty();
  };

  App.commitLayerOpacity = function (i, before) {
    const d = App.doc;
    if (!d) return;
    const current = d.layers[i].opacity;
    d.layers[i].opacity = before == null ? 1 : before;
    d.setLayerProp(i, 'opacity', current);
    App.view.dirty = true;
    App.markDirty();
    Q.UI.syncDoc();
  };

  App.addLayer = function () {
    App.stopPlay();
    App.doc.addLayer();
    App.view.dirty = true;
    Q.UI.syncDoc();
    App.markDirty();
  };

  // Shared renderer keeps the small preview and final raster mathematically aligned.
  Q.paintFillOptions = function (options) {
    options=options || {}; const angle=options.angle == null ? 0 : Number(options.angle), alpha1=options.alpha1 == null ? 1 : Number(options.alpha1), alpha2=options.alpha2 == null ? 1 : Number(options.alpha2);
    if(!Number.isFinite(angle) || Math.abs(angle)>180 || !Number.isFinite(alpha1) || alpha1<0 || alpha1>1 || !Number.isFinite(alpha2) || alpha2<0 || alpha2>1) return null;
    return {angle,alpha1,alpha2};
  };
  Q.renderPaintFill = function (c,w,h,kind,first,second,direction,midpoint,options) {
    const a=Q.hexToRgb(first), b=Q.hexToRgb(second), o=Q.paintFillOptions(options);
    if (!a || !o || !['solid','gradient'].includes(kind) || (kind==='gradient' && (!b || !['horizontal','vertical','diagonal','radial','angle'].includes(direction)))) return false;
    const mid=midpoint == null ? 0.5 : Number(midpoint); if(!Number.isFinite(mid) || mid<0.1 || mid>0.9) return false;
    if(kind==='solid') c.fillStyle=Q.rgba(a,o.alpha1);
    else {
      let g;
      if(direction==='radial') g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,Math.hypot(w,h)/2);
      else if(direction==='angle') { const t=o.angle*Math.PI/180, dx=Math.cos(t),dy=Math.sin(t), length=(Math.abs(w*dx)+Math.abs(h*dy))/2; g=c.createLinearGradient(w/2-dx*length,h/2-dy*length,w/2+dx*length,h/2+dy*length); }
      else g=c.createLinearGradient(0,0,direction==='vertical' ? 0 : w,direction==='horizontal' ? 0 : h);
      const sum=o.alpha1+o.alpha2, middle=a.map((v,i)=>sum ? (v*o.alpha1+b[i]*o.alpha2)/sum : (v+b[i])/2);
      g.addColorStop(0,Q.rgba(a,o.alpha1)); g.addColorStop(mid,Q.rgba(middle.map(Math.round),sum/2)); g.addColorStop(1,Q.rgba(b,o.alpha2)); c.fillStyle=g;
    }
    c.fillRect(0,0,w,h); return true;
  };
  // Fill a new raster layer on the current frame; prepare it before changing history.
  App.addPaintLayer = function (kind,first,second,direction,midpoint,options) {
    App.stopPlay(); const d=App.doc;
    if (!d || !Q.hexToRgb(first) || (kind==='gradient' && !Q.hexToRgb(second)) || !['solid','gradient'].includes(kind)) { Q.toast('Enter valid hex colours',4000); return false; }
    if (kind==='gradient' && !['horizontal','vertical','diagonal','radial','angle'].includes(direction)) { Q.toast('Choose a gradient direction',4000); return false; }
    if ((midpoint!=null && (!Number.isFinite(Number(midpoint)) || Number(midpoint)<0.1 || Number(midpoint)>0.9)) || !Q.paintFillOptions(options)) { Q.toast('Choose a valid midpoint, angle and opacity',4000); return false; }
    try {
      const cv=Q.canvas(d.width,d.height), c=cv.getContext('2d');
      if(!Q.renderPaintFill(c,d.width,d.height,kind,first,second,direction,midpoint,options)) return false;
      d.insertImageLayer(cv,kind==='solid' ? 'Solid colour' : 'Gradient');
      App.view.dirty=true; Q.UI.syncDoc(); Q.UI.refreshTimeline(); App.markDirty(); Q.toast('Layer added · Undo to remove'); return true;
    } catch(e) { Q.toast('Could not create this layer on this device',4000); return false; }
  };

  // User-selected images only; imported pixels become a new layer in one frame.
  App.importImageFile = function (file,target) {
    if (!file || !target || !target.doc) return;
    const type=String(file.type || '').toLowerCase(), name=String(file.name || 'Imported image');
    if (!/^image\/(png|jpeg|webp|gif)$/.test(type) && !(type==='' && /\.(png|jpe?g|webp|gif)$/i.test(name))) { Q.toast('Choose a PNG, JPEG, WebP or GIF image',4000); return; }
    if (!Number.isFinite(file.size) || file.size<=0 || file.size>16*1024*1024) { Q.toast('Choose an image file smaller than 16 MiB',4000); return; }
    function valid() { return App.doc===target.doc && App.doc.frames[App.doc.activeFrame]===target.frame && App.doc.layer()===target.layer && !App.playing; }
    if (!valid()) { Q.toast('Import cancelled because the artwork, frame or layer changed',4000); return; }
    const reader=new FileReader();
    reader.onerror=function () { Q.toast('Could not read the selected image',4000); };
    reader.onload=function () {
      if (!valid()) { Q.toast('Import cancelled because the artwork, frame or layer changed',4000); return; }
      const img=new Image();
      img.onerror=function () { Q.toast('Could not decode the selected image',4000); };
      img.onload=function () {
        if (!valid()) { Q.toast('Import cancelled because the artwork, frame or layer changed',4000); return; }
        const w=img.naturalWidth || img.width, h=img.naturalHeight || img.height, d=target.doc;
        if (!w || !h || w>8192 || h>8192 || w*h>16777216) { Q.toast('Image dimensions exceed the import limit',4000); return; }
        try {
          const canvas=Q.canvas(d.width,d.height), ctx=canvas.getContext('2d');
          const scale=Math.min(1,d.width/w,d.height/h), dw=Math.max(1,Math.round(w*scale)), dh=Math.max(1,Math.round(h*scale));
          ctx.drawImage(img,Math.floor((d.width-dw)/2),Math.floor((d.height-dh)/2),dw,dh);
          const label=name.replace(/\.[^.]+$/,'').slice(0,64) || 'Imported image';
          d.insertImageLayer(canvas,label); App.view.dirty=true; Q.UI.syncDoc(); Q.UI.refreshTimeline(); App.markDirty();
          Q.toast('Image imported as a layer · Undo to remove',4000);
        } catch (e) { Q.toast('Could not import this image on this device',4000); }
      };
      img.src=reader.result;
    };
    try { reader.readAsDataURL(file); } catch (e) { Q.toast('Could not read the selected image',4000); }
  };

  // The reference is a temporary UI-only bitmap, never inserted in a project.
  App.loadReferenceFile = function (file,target) {
    if (!file || !target || !Q.UI.isReferenceTarget(target)) return;
    const type=String(file.type || '').toLowerCase(), name=String(file.name || 'Reference image');
    if (!/^image\/(png|jpeg|webp|gif)$/.test(type) && !(type==='' && /\.(png|jpe?g|webp|gif)$/i.test(name))) { Q.toast('Choose a PNG, JPEG, WebP or GIF image',4000); return; }
    if (!Number.isFinite(file.size) || file.size<=0 || file.size>16*1024*1024) { Q.toast('Choose an image file smaller than 16 MiB',4000); return; }
    const reader=new FileReader(); reader.onerror=()=>Q.toast('Could not read the reference image',4000);
    reader.onload=function () {
      if (!Q.UI.isReferenceTarget(target)) return;
      const img=new Image(); img.onerror=()=>Q.toast('Could not decode the reference image',4000);
      img.onload=function () {
        if (!Q.UI.isReferenceTarget(target)) return;
        const w=img.naturalWidth || img.width,h=img.naturalHeight || img.height;
        if (!w || !h || w>8192 || h>8192 || w*h>16777216) { Q.toast('Image dimensions exceed the reference limit',4000); return; }
        try { const scale=Math.min(1,2048/w,2048/h), cv=Q.canvas(Math.max(1,Math.round(w*scale)),Math.max(1,Math.round(h*scale))); cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height); Q.UI.setReferenceImage(target,cv,name); }
        catch(e) { Q.toast('Could not open the reference image on this device',4000); }
      }; img.src=reader.result;
    };
    try { reader.readAsDataURL(file); } catch(e) { Q.toast('Could not read the reference image',4000); }
  };

  App.duplicateLayer = function (idx) {
    const d = App.doc;
    const from = idx == null ? d.activeLayer : idx;
    d.addLayer(from);
    App.view.dirty = true;
    Q.UI.syncDoc();
    App.markDirty();
  };

  App.deleteLayer = function (idx) {
    App.doc.deleteLayer(idx == null ? App.doc.activeLayer : idx);
    App.view.dirty = true;
    Q.UI.syncDoc();
    App.markDirty();
  };

  App.moveLayer = function (idx, dir) {
    App.doc.moveLayer(idx, dir);
    App.view.dirty = true;
    Q.UI.syncDoc();
    App.markDirty();
  };

  App.mergeDownLayer = function (idx) {
    App.doc.mergeDown(idx);
    App.view.dirty = true;
    Q.UI.syncDoc();
    App.markDirty();
  };

  App.clearCurrentCel = function () {
    const d=App.doc; if (!d || !d.clearCurrentCel()) return false;
    App.view.dirty=true; Q.UI.syncDoc(); Q.UI.refreshTimeline(); App.markDirty();
    Q.toast('Current cel cleared · Undo to restore'); return true;
  };

  App.clearLayer = function (idx) {
    App.doc.clearLayer(idx);
    App.view.dirty = true;
    App.markDirty();
  };

  /* ── frames ─────────────────────────────────────────────── */

  App.addFrame = function (duplicate) {
    App.stopPlay();
    const d = App.doc;
    if (!d) return;
    if (d.frames.length >= 60) { Q.toast('Frame limit reached (60)'); return; }
    d.addFrame(!!duplicate);
    if (d.frames.length > 1) d.onion = true;
    App.view.dirty = true;
    Q.UI.syncDoc();
    Q.UI.refreshTimeline();
    App.markDirty();
  };

  App.deleteFrame = function (idx) {
    App.stopPlay();
    const d = App.doc;
    if (!d) return;
    d.deleteFrame(idx == null ? d.activeFrame : idx);
    App.view.dirty = true;
    Q.UI.syncDoc();
    Q.UI.refreshTimeline();
    App.markDirty();
  };

  App.selectFrame = function (i) {
    App.stopPlay();
    if (!App.doc) return;
    App.doc.activeFrame = Q.clamp(i, 0, App.doc.frames.length - 1);
    App.view.dirty = true;
    Q.UI.syncDoc();
    Q.UI.refreshTimeline();
    App.markDirty();
  };

  App.moveFrame = function (i, dir) {
    App.stopPlay();
    App.doc.moveFrame(i, dir);
    App.view.dirty = true;
    Q.UI.syncDoc();
    Q.UI.refreshTimeline();
    App.markDirty();
  };

  // One export cycle; ping-pong excludes duplicated endpoints.
  Q.playbackBounds = function (doc) {
    const last=Math.max(0,doc.frames.length-1), range=doc.playRange;
    const start=range ? Q.clamp(range.start,0,last) : 0;
    return {start:start,end:range ? Q.clamp(range.end,start,last) : last};
  };
  Q.animationOrder = function (count, mode, start, end) {
    if (count<=0) return [];
    start=Q.clamp(Number.isInteger(start) ? start : 0,0,count-1);
    end=Q.clamp(Number.isInteger(end) ? end : count-1,start,count-1);
    const order = [];
    for (let i=start;i<=end;i++) order.push(i);
    if (mode === 'pingpong') for (let i=end-1;i>start;i--) order.push(i);
    return order;
  };
  Q.playableFrames = function (doc) {
    const bounds=Q.playbackBounds(doc), frames=[];
    for (let i=bounds.start;i<=bounds.end;i++) if (!doc.frames[i].skipped) frames.push(i);
    return frames;
  };
  Q.playbackOrder = function (doc) {
    const frames=Q.playableFrames(doc), result=frames.slice();
    if (doc.playMode === 'pingpong') for (let i=frames.length-2;i>0;i--) result.push(frames[i]);
    return result;
  };
  Q.frameDelayMs = function (doc, index) {
    return 1000 * (doc.frames[index].duration || 1) / Q.clamp(doc.fps, 1, 30);
  };

  // Audio is anchored at the first included timeline frame, not the playback range.
  Q.audioFrameTime = function (doc,index) {
    let ticks=0; for (let i=0;i<index && i<doc.frames.length;i++) if (!doc.frames[i].skipped) ticks+=doc.frames[i].duration || 1;
    return ticks / Q.clamp(doc.fps,1,30);
  };
  App.syncPreviewAudio = function (d,frame,restart,forceSeek) {
    const audio=App.previewAudio; if (!audio || !App.playing || App.doc!==d) return;
    const time=Q.audioFrameTime(d,frame);
    if (Number.isFinite(audio.duration) && time>=audio.duration) { audio.pause(); return; }
    try { if (restart || forceSeek || Math.abs(audio.currentTime-time)>0.2) audio.currentTime=time; }
    catch(e) { /* Metadata may not be ready; loadedmetadata will retry. */ }
    if (restart) try {
      const p=audio.play();
      if (p && p.catch) p.catch(function () { if (App.previewAudio===audio && App.playing) Q.toast('Audio playback is unavailable on this device',4000); });
    } catch(e) { if (App.previewAudio===audio && App.playing) Q.toast('Audio playback is unavailable on this device',4000); }
  };
  App.startPreviewAudio = function (d,frame) {
    if (!d.audioTrack || d.audioTrack.muted || d.playMode==='pingpong') return;
    try {
      const audio=new Audio(); App.previewAudio=audio;
      audio.preload='auto'; audio.src=d.audioTrack.data;
      audio.addEventListener('loadedmetadata',function () { if (App.previewAudio===audio && App.playing) App.syncPreviewAudio(d,d.activeFrame,false,true); });
      audio.addEventListener('error',function () { if (App.previewAudio===audio && App.playing) Q.toast('Audio format is not supported on this device',4000); });
      App.syncPreviewAudio(d,frame,true);
    } catch(e) { App.previewAudio=null; Q.toast('Audio playback is unavailable on this device',4000); }
  };

  App.importAudioFile = function (file,target) {
    if (!file || !target || !target.doc) return;
    const ext=String(file.name || '').toLowerCase().split('.').pop();
    const types={mp3:'mpeg',m4a:'mp4',mp4:'mp4',wav:'wav',ogg:'ogg',oga:'ogg',webm:'webm'};
    const mimes={'audio/mpeg':'mpeg','audio/mp3':'mpeg','audio/mp4':'mp4','audio/x-m4a':'mp4','audio/wav':'wav','audio/x-wav':'wav','audio/ogg':'ogg','audio/webm':'webm'};
    const declared=String(file.type || '').toLowerCase();
    const type=mimes[declared] || ((!declared || declared==='application/octet-stream') ? types[ext] : null);
    if (!type) { Q.toast('Choose an MP3, M4A, WAV, OGG or WebM audio file',4000); return; }
    if (!Number.isFinite(file.size) || file.size<=0 || file.size>2*1024*1024) { Q.toast('Audio file must be 2 MiB or smaller',4000); return; }
    function valid() { return App.doc===target.doc && App.doc.audioTrack===target.track && !App.playing; }
    if (!valid()) { Q.toast('Audio import cancelled because the project changed',4000); return; }
    const reader=new FileReader();
    reader.onerror=function () { Q.toast('Could not read the audio file',4000); };
    reader.onload=function () {
      if (!valid()) { Q.toast('Audio import cancelled because the project changed',4000); return; }
      const value=String(reader.result || ''), prefix=value.indexOf(',');
      if (prefix<0 || !/;base64$/i.test(value.slice(0,prefix))) { Q.toast('Could not read the audio file',4000); return; }
      const track={name:String(file.name || 'Audio').slice(0,100),data:'data:audio/'+type+';base64,'+value.slice(prefix+1),muted:false};
      if (!target.doc.setAudioTrack(track)) { Q.toast('Invalid audio file',4000); return; }
      Q.UI.refreshTimeline(); App.markDirty(); Q.toast('Audio track added · Undo to remove',4000);
    };
    try { reader.readAsDataURL(file); } catch(e) { Q.toast('Could not read the audio file',4000); }
  };

  App.togglePlay = function () {
    const d = App.doc;
    if (!d) return;
    if (App.playing) { App.stopPlay(); return; }
    if (d.frames.length < 2) { Q.toast('Add a frame first'); return; }
    const frames=Q.playableFrames(d);
    if (!frames.length) { Q.toast('No included frames in the playback range',4000); return; }
    App.playing = true; App.view.locked = true;
    let position=frames.indexOf(d.activeFrame), direction=1;
    if (position<0) position=0;
    d.activeFrame=frames[position]; App.view.dirty=true;
    App.startPreviewAudio(d,d.activeFrame);
    const step=function () {
      if (!App.playing) return;
      if (d.playMode === 'once' && position === frames.length-1) { App.stopPlay(); return; }
      let wrapped=false;
      if (d.playMode === 'pingpong') {
        if (frames.length>1) {
          if (position+direction>=frames.length || position+direction<0) direction*=-1;
          position+=direction;
        }
      } else { wrapped=position>=frames.length-1; position=wrapped ? 0 : position+1; }
      d.activeFrame=frames[position]; App.view.dirty=true; Q.UI.highlightFrame(d.activeFrame);
      App.syncPreviewAudio(d,d.activeFrame,wrapped);
      App.playTimer=setTimeout(step,Q.frameDelayMs(d,d.activeFrame));
    };
    App.playTimer=setTimeout(step,Q.frameDelayMs(d,d.activeFrame));
    Q.UI.refreshTimeline(); Q.toast(d.audioTrack && !d.audioTrack.muted && d.playMode==='pingpong' ? 'Playing · audio muted in ping-pong mode' : 'Playing '+d.fps+' fps',4000);
  };

  App.stopPlay = function () {
    if (!App.playing) return;
    App.playing = false;
    const audio=App.previewAudio; App.previewAudio=null;
    if (audio) { try { audio.pause(); audio.removeAttribute('src'); audio.load(); } catch(e) {} }
    clearTimeout(App.playTimer);
    App.playTimer = 0;
    if (App.view) { App.view.locked = false; App.view.dirty = true; }
    Q.UI.refreshTimeline();
  };

  App.batchFrames = function (start,end,operation,value) {
    App.stopPlay(); const d=App.doc; if (!d) return false;
    try {
      if (!d.batchFrames(start,end,operation,value)) { Q.toast('Invalid range or frame limit reached'); return false; }
      App.view.dirty=true; Q.UI.syncDoc(); Q.UI.refreshTimeline(); App.markDirty();
      Q.toast('Frames updated · Undo to revert'); return true;
    } catch (err) { Q.toast('Could not update frames on this device',4000); return false; }
  };

  Q.playbackStats = function (doc) {
    const order=Q.playbackOrder(doc), ticks=order.reduce((sum,i)=>sum+(doc.frames[i].duration || 1),0);
    return {frames:Q.playableFrames(doc).length, ticks:ticks, seconds:ticks/Q.clamp(doc.fps,1,30)};
  };
  App.copyCelToRange = function (source,start,end) {
    App.stopPlay(); const d=App.doc; if (!d) return 'No document';
    try {
      const error=d.copyCelToRange(source,start,end); if (error) return error;
      App.view.dirty=true; Q.UI.syncDoc(); Q.UI.refreshTimeline(); App.markDirty(); Q.toast('Cels copied · Undo to revert'); return null;
    } catch (err) { return 'Could not copy cels on this device'; }
  };
  App.bakeMotionPath = function (source,start,end,easing,reverse) {
    App.stopPlay(); const d=App.doc; if (!d) return 'No document';
    try {
      const error=d.bakeMotionPath(source,start,end,easing,reverse); if (error) return error;
      App.view.dirty=true; Q.UI.syncDoc(); Q.UI.refreshTimeline(); App.markDirty(); Q.toast('Motion generated · Undo to restore'); return null;
    } catch (err) { return 'Could not generate motion on this device'; }
  };
  App.applyTwoBoneIK = function (options) {
    App.stopPlay(); const d=App.doc; if (!d) return {error:'No document'};
    try {
      const result=d.applyTwoBoneIK(options); if (result.error) return result;
      App.view.dirty=true; Q.UI.syncDoc(); Q.UI.refreshTimeline(); App.markDirty();
      Q.toast(result.clamped ? 'IK keys created · '+result.clamped+' frame(s) clamped to reach' : 'IK keys created · Undo to revert',4000); return result;
    } catch (err) { return {error:'Could not generate IK keys on this device'}; }
  };
  App.generateParticles = function (options) {
    App.stopPlay(); const d=App.doc; if (!d) return 'No document';
    try {
      const error=d.generateParticles(options); if (error) return error;
      App.view.dirty=true; Q.UI.syncDoc(); Q.UI.refreshTimeline(); App.markDirty(); Q.toast('Particle layer created · Undo to remove'); return null;
    } catch (err) { return 'Could not generate particles on this device'; }
  };
  App.bakeTransform = function (source,start,end,easing,first,last,pivot) {
    App.stopPlay(); const d=App.doc; if (!d) return 'No document';
    try {
      const error=d.bakeTransform(source,start,end,easing,first,last,pivot); if (error) return error;
      App.view.dirty=true; Q.UI.syncDoc(); Q.UI.refreshTimeline(); App.markDirty(); Q.toast('Transform frames generated · Undo to restore'); return null;
    } catch (err) { return 'Could not generate transform frames on this device'; }
  };
  App.deleteFrameRange = function (start,end) {
    App.stopPlay(); const d=App.doc; if (!d || !d.deleteFrameRange(start,end)) return false;
    App.view.dirty=true; Q.UI.syncDoc(); Q.UI.refreshTimeline(); App.markDirty(); Q.toast('Frames deleted · Undo to restore'); return true;
  };

  App.flipCanvas = function () {
    const d = App.doc;
    if (!d) return;
    if (d.layers.some(l=>l.locked || l.alphaLocked)) { Q.toast('Unlock all layers and alpha before flipping the canvas'); return; }
    d.history.struct(function () {
      for (const f of d.frames) {
        for (let i = 0; i < f.cels.length; i++) {
          const cel = f.cels[i];
          if (!cel) continue;
          const flipped = Q.canvas(d.width, d.height);
          const c = flipped.getContext('2d');
          c.translate(d.width, 0);
          c.scale(-1, 1);
          c.drawImage(cel, 0, 0);
          f.cels[i] = flipped;
        }
      }
    });
    App.view.dirty = true;
    App.markDirty();
    Q.toast('Canvas flipped');
  };

  /* ── saving / exporting ─────────────────────────────────── */

  App.markDirty = function (immediate) {
    Q.UI.syncHistory();
    Q.UI.refreshReference();
    if (immediate) { App.saveNow(false); return; }
    clearTimeout(App.autosaveTimer);
    App.autosaveTimer = setTimeout(function () { App.saveNow(false); }, 2500);
  };

  App.saveNow = function (announce) {
    const d = App.doc;
    if (!d) return Promise.resolve(false);
    let thumb = null;
    try {
      thumb = d.thumbnail(d.activeFrame, 320).toDataURL('image/jpeg', 0.72);
    } catch (e) { thumb = null; }
    return Q.Store.save(d, thumb).then(function () {
      if (announce) Q.toast('Saved');
      return true;
    }).catch(function (err) {
      console.warn('save failed', err);
      if (announce) Q.toast('Could not save');
      return false;
    });
  };


  // Rectangle operations affect only the selected layer and current animation frame.
  App.editSelection = function (operation) {
    const d=App.doc, v=App.view;
    if (!d) return;
    const layer=d.layer();
    if (!layer || !layer.visible) { Q.toast('This layer is hidden'); return; }
    if (layer.locked) { Q.toast('This layer is locked'); return; }
    if (layer.alphaLocked && operation !== 'fill') { Q.toast('Turn off alpha lock for this edit'); return; }
    const sel=v.selection;
    if (sel && Q.complexSelection(sel) && (operation === 'flipH' || operation === 'flipV' || operation === 'rotate180')) { Q.toast('Non-rectangular transforms are not yet supported; use a rectangle'); return; }
    if (!sel && (operation === 'clear' || operation === 'fill')) { Q.toast('Draw a rectangle or select all first'); return; }
    const r=sel || {x:0,y:0,w:d.width,h:d.height};
    const cel=d.activeCel(operation === 'fill');
    if (!cel) { Q.toast('Draw on this layer first'); return; }
    const ctx=cel.getContext('2d');
    try {
      let image=null;
      if (operation === 'flipH' || operation === 'flipV' || operation === 'rotate180') {
        image=ctx.getImageData(r.x,r.y,r.w,r.h);
        Q.flipImage(image, operation !== 'flipV', operation !== 'flipH');
      } else if (operation !== 'clear' && operation !== 'fill') return;
      d.history.beginPixels(cel);
      if (image) ctx.putImageData(image,r.x,r.y);
      else {
        ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha=1; ctx.globalCompositeOperation=layer.alphaLocked ? 'source-atop' : 'source-over';
        if (sel) { Q.selectionPath(ctx,sel); ctx.clip(); }
        if (operation === 'clear') ctx.clearRect(r.x,r.y,r.w,r.h);
        else { ctx.fillStyle=Q.rgbToHex(v.color); ctx.fillRect(r.x,r.y,r.w,r.h); }
        ctx.restore();
      }
      d.history.endPixels(r); v.dirty=true; App.markDirty(); Q.toast('Edit applied · Undo to revert');
    } catch (err) { Q.toast('Could not edit this area on this device',4000); }
  };

  App.copySelectionToLayer = function () {
    const d=App.doc, v=App.view; if (!d) return;
    if (!v.selection) { Q.toast('Draw a rectangle or select all first'); return; }
    if (!d.activeCel(false)) { Q.toast('Draw on this layer first'); return; }
    try {
      d.copyRegionToLayer(v.selection); v.dirty=true; Q.UI.syncDoc(); App.markDirty();
      Q.toast('Selection copied to a new layer · Undo to revert');
    } catch (err) { Q.toast('Could not copy selection on this device',4000); }
  };

  // Session-only clipboard of pixels from one layer and one frame, never the OS clipboard.
  App.copyOrCut = function (cut) {
    const d=App.doc,v=App.view; if(!d || App.playing || v.locked) return {error:'Stop playback or the current operation first'};
    const layer=d.layer(), cel=d.activeCel(false), sel=v.selection;
    if(!layer || !cel) return {error:'Draw on this layer first'};
    if(cut && !layer.visible) return {error:'This layer is hidden'};
    if(cut && layer.locked) return {error:'This layer is locked'};
    if(cut && layer.alphaLocked) return {error:'Turn off alpha lock before cutting'};
    const r=sel ? {x:sel.x,y:sel.y,w:sel.w,h:sel.h} : {x:0,y:0,w:d.width,h:d.height};
    if (![r.x,r.y,r.w,r.h].every(Number.isInteger) || r.x<0 || r.y<0 || r.w<1 || r.h<1 || r.x+r.w>d.width || r.y+r.h>d.height) return {error:'Choose a valid selection'};
    if (r.w*r.h*4*(cut ? 4 : 1)> (cut ? 64 : 32)*1024*1024) return {error:cut ? 'Cut exceeds the 64 MiB temporary-memory limit' : 'Copy exceeds the 32 MiB clipboard limit'};
    try {
      const copy=Q.canvas(r.w,r.h), cc=copy.getContext('2d'); cc.save();
      if(sel) { cc.translate(-r.x,-r.y); Q.selectionPath(cc,sel); cc.clip(); cc.drawImage(cel,r.x,r.y,r.w,r.h,r.x,r.y,r.w,r.h); }
      else cc.drawImage(cel,r.x,r.y,r.w,r.h,0,0,r.w,r.h); cc.restore();
      if(cut) {
        const stage=Q.canvas(r.w,r.h), sc=stage.getContext('2d'), ctx=cel.getContext('2d'); sc.drawImage(cel,r.x,r.y,r.w,r.h,0,0,r.w,r.h);
        if(sel) { sc.save(); sc.translate(-r.x,-r.y); sc.globalCompositeOperation='destination-out'; Q.selectionPath(sc,sel); sc.fillStyle='#000'; sc.fill(); sc.restore(); }
        else sc.clearRect(0,0,r.w,r.h);
        const before=ctx.getImageData(r.x,r.y,r.w,r.h), after=sc.getImageData(0,0,r.w,r.h);
        ctx.putImageData(after,r.x,r.y); d.history.push({type:'pixels',f:d.activeFrame,l:d.activeLayer,rect:r,before:before}); v.dirty=true; App.markDirty();
      }
      App.clipboard={canvas:copy,x:r.x,y:r.y,w:r.w,h:r.h}; Q.toast(cut ? 'Cut · Undo restores the pixels' : 'Copied to Qelem clipboard',3000); return {};
    } catch(err) { return {error:'Could not '+(cut ? 'cut' : 'copy')+' this area on this device'}; }
  };
  App.pasteClipboard = function () {
    const d=App.doc,v=App.view, clip=App.clipboard;
    if(!d || App.playing || v.locked) return {error:'Stop playback or the current operation first'};
    if(!clip) return {error:'Copy or cut pixels first'};
    if(clip.x>=d.width || clip.y>=d.height) return {error:'Copied area is outside this canvas'};
    if(d.width*d.height*4>64*1024*1024) return {error:'Paste exceeds the 64 MiB new-cel limit'};
    try {
      const cv=Q.canvas(d.width,d.height); cv.getContext('2d').drawImage(clip.canvas,clip.x,clip.y);
      d.insertPastedLayer(cv); v.dirty=true; Q.UI.syncDoc(); Q.UI.refreshTimeline(); App.markDirty(); Q.toast('Pasted as a new top layer · Undo to remove',3500);
      return {cropped:clip.x+clip.w>d.width || clip.y+clip.h>d.height};
    } catch(err) { return {error:'Could not paste this area on this device'}; }
  };
  App.clearClipboard = function () { App.clipboard=null; };

  App.moveScaleSelection = function (dx, dy, scale) {
    const d=App.doc, v=App.view; if (!d) return;
    const layer=d.layer(), cel=d.activeCel(false);
    if (!layer || !layer.visible) { Q.toast('This layer is hidden'); return; }
    if (layer.locked) { Q.toast('This layer is locked'); return; }
    if (layer.alphaLocked) { Q.toast('Turn off alpha lock to transform'); return; }
    if (!cel) { Q.toast('Draw on this layer first'); return; }
    if (!Number.isInteger(dx) || !Number.isInteger(dy) || Math.abs(dx)>d.width*2 || Math.abs(dy)>d.height*2 || !Number.isFinite(scale) || scale<0.25 || scale>4) { Q.toast('Invalid transform'); return; }
    if (v.selection && Q.complexSelection(v.selection)) { Q.toast('Non-rectangular transforms are not yet supported; use a rectangle'); return; }
    const src=v.selection || {x:0,y:0,w:d.width,h:d.height};
    const dst={x:src.x+dx,y:src.y+dy,w:Math.max(1,Math.round(src.w*scale)),h:Math.max(1,Math.round(src.h*scale))};
    if (dx===0 && dy===0 && dst.w===src.w && dst.h===src.h) { Q.toast('Nothing changed'); return; }
    const x=Math.min(src.x,dst.x), y=Math.min(src.y,dst.y);
    const right=Math.max(src.x+src.w,dst.x+dst.w), bottom=Math.max(src.y+src.h,dst.y+dst.h);
    const rect=Q.intersectRect({x:x,y:y,w:right-x,h:bottom-y},{x:0,y:0,w:d.width,h:d.height});
    try {
      const copy=Q.canvas(src.w,src.h), temp=copy.getContext('2d'), ctx=cel.getContext('2d');
      temp.drawImage(cel,src.x,src.y,src.w,src.h,0,0,src.w,src.h);
      d.history.beginPixels(cel);
      ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
      ctx.clearRect(src.x,src.y,src.w,src.h);
      ctx.drawImage(copy,0,0,src.w,src.h,dst.x,dst.y,dst.w,dst.h); ctx.restore();
      d.history.endPixels(rect);
      if (v.selection) v.selection=Q.intersectRect(dst,{x:0,y:0,w:d.width,h:d.height});
      v.dirty=true; App.markDirty(); Q.toast('Transform applied · Undo to revert');
    } catch (err) { Q.toast('Could not transform this area on this device',4000); }
  };

  // Render to a bounded staging canvas and prepare undo pixels before touching the cel.
  App.preciseTransform = function (o,target) {
    const d=App.doc,v=App.view; if(!d || !target || target.doc!==d || d.frames[d.activeFrame]!==target.frame || d.layer()!==target.layer || d.activeCel(false)!==target.cel || v.selection!==target.selection) return {error:'Artwork, frame, layer or selection changed; reopen the transform'};
    if(App.playing || v.locked) return {error:'Stop playback or the current operation first'};
    const layer=d.layer(),cel=d.activeCel(false); if(!layer.visible) return {error:'This layer is hidden'};
    if(layer.locked) return {error:'This layer is locked'}; if(layer.alphaLocked) return {error:'Turn off alpha lock to transform'};
    if(!cel) return {error:'Draw on this layer first'}; if(v.selection && Q.complexSelection(v.selection)) return {error:'Use a rectangular selection for this transform'};
    const src=v.selection || {x:0,y:0,w:d.width,h:d.height};
    if (src.x!==target.src.x || src.y!==target.src.y || src.w!==target.src.w || src.h!==target.src.h) return {error:'Selection changed; reopen the transform'};
    const plan=Q.planPreciseTransform(src,d.width,d.height,o); if(plan.error) return plan; if(plan.unchanged) return {error:'Nothing changed'};
    const r=plan.rect;
    try {
      const copy=Q.canvas(src.w,src.h), stage=Q.canvas(r.w,r.h), c=stage.getContext('2d'), ctx=cel.getContext('2d');
      copy.getContext('2d').drawImage(cel,src.x,src.y,src.w,src.h,0,0,src.w,src.h);
      c.drawImage(cel,r.x,r.y,r.w,r.h,0,0,r.w,r.h); c.clearRect(src.x-r.x,src.y-r.y,src.w,src.h);
      c.save(); c.translate(plan.cx-r.x,plan.cy-r.y); c.rotate(plan.theta); c.imageSmoothingEnabled=o.resampling==='smooth'; c.drawImage(copy,0,0,src.w,src.h,-o.width/2,-o.height/2,o.width,o.height); c.restore();
      const before=ctx.getImageData(r.x,r.y,r.w,r.h), after=c.getImageData(0,0,r.w,r.h);
      ctx.putImageData(after,r.x,r.y); d.history.push({type:'pixels',f:d.activeFrame,l:d.activeLayer,rect:r,before:before});
      if(v.selection) v.selection=Q.intersectRect(plan.bounds,{x:0,y:0,w:d.width,h:d.height});
      v.dirty=true; App.markDirty(); Q.toast('Transform applied · Undo to revert',3000); return {clipped:plan.clipped};
    } catch(err) { return {error:'Could not transform this area on this device'}; }
  };

  App.wandAt = function (x,y) {
    const d=App.doc, v=App.view; if(!d || v.locked || x<0 || y<0 || x>=d.width || y>=d.height) return;
    const layer=d.layer(), cel=d.activeCel(false), frame=d.activeFrame, layerIndex=d.activeLayer;
    if(!layer || !layer.visible) { Q.toast('This layer is hidden'); return; }
    v.locked=true; Q.UI.progress('Selecting','Finding connected pixels on the current layer…',0);
    setTimeout(function () { try {
      if(App.doc!==d || d.activeFrame!==frame || d.activeLayer!==layerIndex || d.activeCel(false)!==cel) { Q.toast('Selection cancelled'); return; }
      const image=cel ? cel.getContext('2d').getImageData(0,0,d.width,d.height) : Q.canvas(d.width,d.height).getContext('2d').getImageData(0,0,d.width,d.height);
      const result=Q.floodSelect(image,x,y,App.fillThreshold); if(result && result.error) { Q.toast(result.error,4000); return; }
      if(result) { v.selection=result; v.dirty=true; Q.toast('Connected area selected · Menu → Selection & transform',3000); }
    } catch(e) { Q.toast('Could not select this area',4000); } finally { Q.UI.endProgress(); v.locked=false; } },40);
  };

  App.fillAt = function (x, y, droppedColor) {
    const d = App.doc;
    if (!d || x < 0 || y < 0 || x >= d.width || y >= d.height) return;
    const layer = d.layer();
    if (!layer || !layer.visible) { Q.toast('This layer is hidden'); return; }
    if (layer.locked) { Q.toast('This layer is locked'); return; }
    const bounds=App.view.selection ? {...App.view.selection} : {x:0,y:0,w:d.width,h:d.height};
    if (x < bounds.x || y < bounds.y || x >= bounds.x+bounds.w || y >= bounds.y+bounds.h) { Q.toast('Tap inside the selection'); return; }
    const cel = d.activeCel(true), color = (droppedColor || App.view.color).slice(), tolerance = App.fillThreshold, alphaLocked=!!layer.alphaLocked;
    App.view.locked = true;
    Q.UI.progress('Filling', 'Processing the current layer…', 0);
    setTimeout(function () {
      try {
        if (App.doc !== d || d.activeCel(false) !== cel) { Q.UI.endProgress(); return; }
        const ctx=cel.getContext('2d'), image=ctx.getImageData(bounds.x,bounds.y,bounds.w,bounds.h);
        const mask=Q.selectionMask(bounds);
        const rect=Q.floodFill(image,x-bounds.x,y-bounds.y,color,tolerance,alphaLocked,mask);
        if (rect) {
          d.history.beginPixels(cel); ctx.putImageData(image,bounds.x,bounds.y); d.history.endPixels({x:rect.x+bounds.x,y:rect.y+bounds.y,w:rect.w,h:rect.h});
          App.view.dirty=true; App.markDirty();
        }
        Q.UI.endProgress(); Q.toast(rect ? 'Filled · Undo to revert' : 'Nothing to fill');
      } catch (err) { Q.UI.endProgress(); Q.toast('Could not fill this canvas',4000); }
      finally { App.view.locked = false; }
    }, 40);
  };

  // Recolour raw pixels of one current cel, bounded by selection and memory.
  App.validateRecolor = function (target, source, replacement, tolerance) {
    const d=App.doc, v=App.view;
    if(!d || !target || target.doc!==d || d.frames[d.activeFrame]!==target.frame || d.layer()!==target.layer || d.activeCel(false)!==target.cel || v.selection!==target.selection || App.playing) return {error:'Artwork, frame, layer or selection changed; reopen recolour'};
    if(!target.cel) return {error:'Draw on this layer first'};
    if(!target.layer.visible || target.layer.locked) return {error:'Show and unlock this layer first'};
    if(!Array.isArray(source) || !Array.isArray(replacement) || source.length!==3 || replacement.length!==3 || !source.concat(replacement).every(n=>Number.isInteger(n) && n>=0 && n<=255) || !Number.isInteger(tolerance) || tolerance<0 || tolerance>128) return {error:'Enter valid colours and tolerance'};
    const r=target.bounds, s=v.selection;
    if(!r || ![r.x,r.y,r.w,r.h].every(Number.isInteger) || r.x<0 || r.y<0 || r.w<1 || r.h<1 || r.x+r.w>d.width || r.y+r.h>d.height || (s && (s.x!==r.x || s.y!==r.y || s.w!==r.w || s.h!==r.h))) return {error:'Selection changed; reopen recolour'};
    const complex=!!(s && Q.complexSelection(s));
    if(4*d.width*d.height+(complex ? 13 : 8)*r.w*r.h>64*1024*1024) return {error:'Recolour exceeds the 64 MiB temporary-memory limit'};
    if(target.undo.length!==d.history.undoStack.length || target.redo.length!==d.history.redoStack.length || target.undo.some((e,i)=>e!==d.history.undoStack[i]) || target.redo.some((e,i)=>e!==d.history.redoStack[i])) return {error:'Artwork changed; reopen recolour'};
    return {};
  };
  App.recolorMatching = function (target,source,replacement,tolerance) {
    const check=App.validateRecolor(target,source,replacement,tolerance); if(check.error) return check;
    const d=App.doc,v=App.view, r=target.bounds; v.locked=true; Q.UI.progress('Recolouring','Processing the current layer…',0);
    const progressNode=document.getElementById ? document.getElementById('progressCard') : null;
    setTimeout(function() {
      try {
        const valid=App.validateRecolor(target,source,replacement,tolerance); if(valid.error) { Q.toast(valid.error,4000); return; }
        const ctx=target.cel.getContext('2d'), image=ctx.getImageData(r.x,r.y,r.w,r.h), mask=target.selection ? Q.selectionMask(target.selection) : null;
        const rect=Q.recolorMatching(image,source,replacement,tolerance,mask);
        if(rect) {
          // Acquire undo data before touching the cel, so an allocation failure
          // cannot leave an unrecorded edit.
          const changed={x:r.x+rect.x,y:r.y+rect.y,w:rect.w,h:rect.h};
          d.history.beginPixels(target.cel);
          const before=d.history.snapCtx.getImageData(changed.x,changed.y,changed.w,changed.h);
          try { ctx.putImageData(image,r.x,r.y,rect.x,rect.y,rect.w,rect.h); }
          catch(err) { try { ctx.putImageData(before,changed.x,changed.y); } catch(ignored) {} throw err; }
          d.history.push({type:'pixels',f:d.activeFrame,l:d.activeLayer,rect:changed,before:before});
          v.dirty=true; Q.UI.syncDoc(); App.markDirty();
        }
        Q.toast(rect ? 'Recoloured · Undo to restore' : 'No matching pixels changed');
      } catch(err) { Q.toast('Could not recolour on this device',4000); }
      finally { if(!progressNode || document.getElementById('progressCard')===progressNode) Q.UI.endProgress(); if(App.view===v && App.doc===d && !App.playing) v.locked=false; }
    },40);
    return {started:true};
  };

  App.applyEffect = function (kind, amount) {
    const d = App.doc, cel = d && d.activeCel(false);
    if (!cel) { Q.toast('Draw on this layer first'); return; }
    if (d.layer().locked) { Q.toast('This layer is locked'); return; }
    const bounds=App.view.selection ? {...App.view.selection} : {x:0,y:0,w:d.width,h:d.height}, alphaLocked=!!d.layer().alphaLocked;
    if (amount <= 0) { Q.toast('Choose an effect strength'); return; }
    Q.UI.progress('Applying effect', 'Processing the current layer…', 0);
    setTimeout(function () {
      try {
        if (App.doc !== d || d.activeCel(false) !== cel) { Q.UI.endProgress(); Q.toast('Effect cancelled'); return; }
        const ctx = cel.getContext('2d');
        const image = ctx.getImageData(bounds.x, bounds.y, bounds.w, bounds.h);
        const mask=Q.selectionMask(bounds), original=mask ? new Uint8ClampedArray(image.data) : null;
        const alpha=alphaLocked ? new Uint8Array(image.width*image.height) : null;
        if (alpha) for (let i=0; i<alpha.length; i++) alpha[i]=image.data[i*4+3];
        Q.applyPixelEffect(image, kind, amount);
        if (alpha) for (let i=0; i<alpha.length; i++) image.data[i*4+3]=alpha[i];
        if (mask) for (let i=0;i<mask.length;i++) if (!mask[i]) for (let c=0;c<4;c++) image.data[i*4+c]=original[i*4+c];
        d.history.beginPixels(cel);
        ctx.putImageData(image, bounds.x, bounds.y);
        d.history.endPixels(bounds);
        App.view.dirty = true; App.markDirty();
        Q.UI.endProgress(); Q.toast('Effect applied · Undo to revert');
      } catch (err) {
        Q.UI.endProgress(); Q.toast('Could not apply effect on this device', 4000);
      }
    }, 30);
  };

  App.setBackground = function (color) {
    const d=App.doc; if (!d || !/^#[0-9a-f]{6}$/i.test(color)) return;
    d.setBackground(color); App.view.dirty=true; Q.UI.syncDoc(); App.markDirty();
  };

  App.exportPng = function (transparent) {
    App.stopPlay();
    const d = App.doc;
    if (!d) return;
    const cv = d.flatten(d.activeFrame, {background: transparent ? false : d.bg});
    const ok = Q.saveBytes(cv.toDataURL('image/png'), 'image/png', 'Qelem-' + Q.stamp() + (transparent ? '-transparent' : '') + '.png');
    Q.toast(ok ? 'PNG saved' : 'Could not save PNG');
  };

  App.exportJpeg = function (quality) {
    App.stopPlay(); const d=App.doc; if(!d) return false;
    if(!Number.isFinite(quality) || quality<0 || quality>1) { Q.toast('Invalid JPEG quality'); return false; }
    try {
      const cv=d.flatten(d.activeFrame,{background:d.bg}), data=cv.toDataURL('image/jpeg',quality);
      if(!data.startsWith('data:image/jpeg;base64,')) { Q.toast('JPEG export is not supported on this device',4000); return false; }
      const ok=Q.saveBytes(data,'image/jpeg','Qelem-'+Q.stamp()+'.jpg'); Q.toast(ok ? 'JPEG saved' : 'Could not save JPEG'); return !!ok;
    } catch(e) { Q.toast('Could not export JPEG on this device',4000); return false; }
  };

  App.exportPngSequence = function (transparent) {
    App.stopPlay();
    const d = App.doc; if (!d) return;
    const stamp = Q.stamp(), total = d.frames.length;
    let index = 0, saved = 0;
    Q.UI.progress('Exporting PNG sequence', 'Preparing frames…', 0);
    function step() {
      try {
        const png = d.flatten(index, {background: transparent ? false : d.bg}).toDataURL('image/png');
        const number = String(index + 1).padStart(3, '0');
        if (Q.saveBytes(png, 'image/png', 'Qelem-' + stamp + '-frame-' + number + (transparent ? '-transparent' : '') + '.png')) saved++;
        index++;
        if (index < total) { Q.UI.progress('Exporting PNG sequence', index + ' / ' + total, index / total); setTimeout(step, 0); }
        else { Q.UI.endProgress(); Q.toast('Saved ' + saved + ' of ' + total + ' PNG frames', 4000); }
      } catch (err) { Q.UI.endProgress(); Q.toast('Sequence stopped after ' + saved + ' frames', 4000); }
    }
    setTimeout(step, 30);
  };

  App.exportSpriteSheet = function (columns,scale,transparent) {
    App.stopPlay(); const d=App.doc; if (!d) return;
    if (!Q.spriteSheetLayout(d,columns,scale)) { Q.toast('Sprite sheet is too large or settings are invalid',4000); return; }
    Q.UI.progress('Exporting sprite sheet','Rendering frames…',0);
    setTimeout(function () {
      try {
        if (App.doc!==d) { Q.UI.endProgress(); return; }
        const sheet=Q.renderSpriteSheet(d,columns,scale,transparent);
        const ok=Q.saveBytes(sheet.toDataURL('image/png'),'image/png','Qelem-'+Q.stamp()+'-spritesheet.png');
        Q.UI.endProgress(); Q.toast(ok ? 'Sprite sheet saved' : 'Could not save sprite sheet');
      } catch (err) { Q.UI.endProgress(); Q.toast('Could not create sprite sheet on this device',4000); }
    },40);
  };

  // MediaRecorder MP4 is optional on Android WebView. Never label WebM as MP4.
  App.exportMp4 = function () {
    App.stopPlay();
    const d = App.doc;
    if (!d || d.frames.length < 2) { Q.toast('Add at least two frames first'); return; }
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) { Q.toast('MP4 encoding is not supported on this device', 4000); return; }
    const mime = ['video/mp4;codecs=avc1.42E01E', 'video/mp4'].find(function (v) { return MediaRecorder.isTypeSupported(v); });
    if (!mime) { Q.toast('MP4 encoding is not supported on this device', 4000); return; }
    const scale = Math.min(1, 1280 / Math.max(d.width, d.height));
    const w = Math.max(2, Math.floor(d.width * scale / 2) * 2), h = Math.max(2, Math.floor(d.height * scale / 2) * 2);
    const canvas = Q.canvas(w, h), ctx = canvas.getContext('2d');
    if (!canvas.captureStream) { Q.toast('Video capture is not supported on this device', 4000); return; }
    let stream, recorder, timer, finished = false;
    const chunks = [], fps = Q.clamp(d.fps, 1, 30), order=Q.playbackOrder(d);
    if (!order.length) { Q.toast('No included frames in the playback range',4000); return; }
    function cleanup() { clearTimeout(timer); if (stream) stream.getTracks().forEach(function (track) { track.stop(); }); Q.UI.endProgress(); }
    function fail(message) { if (finished) return; finished = true; try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch (e) {} cleanup(); Q.toast(message, 4000); }
    function paint(index) {
      ctx.fillStyle = d.bg; ctx.fillRect(0, 0, w, h);
      ctx.save(); ctx.scale(w / d.width, h / d.height); d.compositeCamera(ctx, index); ctx.restore();
    }
    try {
      paint(order[0]); stream = canvas.captureStream(fps);
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4000000 });
      recorder.ondataavailable = function (event) { if (event.data && event.data.size) chunks.push(event.data); };
      recorder.onerror = function () { fail('MP4 encoding failed on this device'); };
      recorder.onstop = function () {
        if (finished) return;
        finished = true; cleanup();
        if (!chunks.length) { Q.toast('MP4 encoder returned no video', 4000); return; }
        const reader = new FileReader();
        reader.onerror = function () { Q.toast('Could not prepare MP4', 4000); };
        reader.onload = function () {
          const ok = Q.saveBytes(reader.result, 'video/mp4', 'Qelem-' + Q.stamp() + '.mp4');
          Q.toast(ok ? 'MP4 saved (Movies/Qalam on Android 10+)' : 'Could not save MP4', 4000);
        };
        reader.readAsDataURL(new Blob(chunks, { type: 'video/mp4' }));
      };
      Q.UI.progress('Exporting MP4', 'Recording one animation loop…', 0);
      recorder.start();
      let position = 0;
      function next() {
        position++;
        if (position >= order.length) { try { recorder.stop(); } catch (err) { fail('MP4 encoder stopped unexpectedly'); } return; }
        paint(order[position]); timer = setTimeout(next, Q.frameDelayMs(d, order[position]));
      }
      timer = setTimeout(next, Q.frameDelayMs(d, order[position]));
    } catch (err) { fail('Could not start MP4 export on this device'); }
  };

  // Read only MP4 metadata (not the potentially huge media payload), and require
  // both video and sound handler tracks before presenting the result as audio MP4.
  Q.mp4HasAudioAndVideo = async function (blob) {
    function read(start,end) {
      return new Promise(function (resolve,reject) {
        const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error('MP4 read failed'));
        reader.readAsArrayBuffer(blob.slice(start,end));
      });
    }
    function header(view,pos,limit) {
      if (pos+8>limit) throw Error('Truncated MP4 box');
      let size=view.getUint32(pos), head=8;
      const type=String.fromCharCode(view.getUint8(pos+4),view.getUint8(pos+5),view.getUint8(pos+6),view.getUint8(pos+7));
      if (size===1) { if (pos+16>limit) throw Error('Truncated extended MP4 box'); size=view.getUint32(pos+8)*4294967296+view.getUint32(pos+12); head=16; }
      else if (size===0) size=limit-pos;
      if (!Number.isSafeInteger(size) || size<head || pos+size>limit) throw Error('Invalid MP4 box size');
      return {type,size,head};
    }
    function children(view,start,end) {
      const result=[]; let pos=start;
      while (pos<end) { if (result.length>=10000) throw Error('Too many MP4 boxes'); const box=header(view,pos,end); result.push({type:box.type,start:pos+box.head,end:pos+box.size}); pos+=box.size; }
      return result;
    }
    let pos=0, count=0, hasFtyp=false, hasTracks=false;
    while (pos<blob.size && count++<10000) {
      // A header can be parsed without reading or copying an mdat payload.
      const hdr=new DataView(await read(pos,Math.min(pos+16,blob.size)));
      if (hdr.byteLength<8) throw Error('Truncated MP4');
      let size=hdr.getUint32(0), head=8;
      const type=String.fromCharCode(hdr.getUint8(4),hdr.getUint8(5),hdr.getUint8(6),hdr.getUint8(7));
      if (size===1) { if (hdr.byteLength<16) throw Error('Truncated MP4'); size=hdr.getUint32(8)*4294967296+hdr.getUint32(12); head=16; }
      else if (size===0) size=blob.size-pos;
      if (!Number.isSafeInteger(size) || size<head || pos+size>blob.size) throw Error('Invalid MP4 size');
      if (type==='ftyp' && size>=head+8) hasFtyp=true;
      if (type==='moov') {
        if (size>16*1024*1024) throw Error('MP4 metadata too large');
        const view=new DataView(await read(pos+head,pos+size)), handlers=[];
        children(view,0,view.byteLength).filter(b=>b.type==='trak').forEach(function (trak) {
          children(view,trak.start,trak.end).filter(b=>b.type==='mdia').forEach(function (mdia) {
            children(view,mdia.start,mdia.end).filter(b=>b.type==='hdlr').forEach(function (handler) {
              if (handler.end-handler.start<12) throw Error('Invalid MP4 handler');
              handlers.push(String.fromCharCode(view.getUint8(handler.start+8),view.getUint8(handler.start+9),view.getUint8(handler.start+10),view.getUint8(handler.start+11)));
            });
          });
        });
        hasTracks=handlers.includes('vide') && handlers.includes('soun');
      }
      pos+=size;
    }
    return pos===blob.size && hasFtyp && hasTracks;
  };

  // Optional AAC-in-MP4 export. The selected forward range is rendered in real
  // time, while one decoded local track is routed into the recorder, not speakers.
  // Reject unsupported paths instead of silently exporting a video without audio.
  App.exportMp4WithAudio = function () {
    App.stopPlay(); const d=App.doc;
    if (App.cancelAudioExport) { Q.toast('An audio export is already in progress',4000); return; }
    if (!d || d.frames.length<2) { Q.toast('Add at least two frames first',4000); return; }
    if (!d.audioTrack || d.audioTrack.muted) { Q.toast('Add and unmute an audio track first',4000); return; }
    if (d.playMode==='pingpong') { Q.toast('Audio MP4 export requires forward playback, not ping-pong',4000); return; }
    const order=Q.playableFrames(d); if (!order.length) { Q.toast('No included frames in the playback range',4000); return; }
    if (order.reduce((sum,i)=>sum+Q.frameDelayMs(d,i),0)>120000) { Q.toast('Audio MP4 is limited to 120 seconds; shorten the range or holds',4000); return; }
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) { Q.toast('MP4 with AAC audio is not supported on this device',4000); return; }
    let mime;
    try { mime=['video/mp4;codecs="avc1.42E01E,mp4a.40.2"','video/mp4;codecs="avc1.4D401F,mp4a.40.2"','video/mp4;codecs="avc1.64001F,mp4a.40.2"'].find(v=>MediaRecorder.isTypeSupported(v)); } catch(e) { Q.toast('MP4 with AAC audio is not supported on this device',4000); return; }
    const AudioCtx=window.AudioContext || window.webkitAudioContext;
    if (!mime || !AudioCtx) { Q.toast('MP4 with AAC audio is not supported on this device',4000); return; }
    const scale=Math.min(1,1280/Math.max(d.width,d.height)), w=Math.max(2,Math.floor(d.width*scale/2)*2), h=Math.max(2,Math.floor(d.height*scale/2)*2);
    let context,stream,source,destination,recorder,timer,guard,finished=false,started=false,completed=false;
    const chunks=[], fps=Q.clamp(d.fps,1,30), offset=Q.audioFrameTime(d,order[0]), track=d.audioTrack;
    function releaseMedia() {
      if (source) { try { source.stop(); } catch(e) {} try { source.disconnect(); } catch(e) {} source=null; }
      if (stream) { try { stream.getTracks().forEach(t=>t.stop()); } catch(e) {} stream=null; }
      if (destination) { try { destination.stream.getTracks().forEach(t=>t.stop()); } catch(e) {} destination=null; }
      if (context) { try { const p=context.close(); if (p && p.catch) p.catch(()=>{}); } catch(e) {} context=null; }
    }
    function cleanup() {
      clearTimeout(timer); clearTimeout(guard); releaseMedia();
      App.cancelAudioExport=null; Q.UI.endProgress();
    }
    function fail(message) {
      if (finished) return; finished=true;
      try { if (recorder && recorder.state!=='inactive') recorder.stop(); } catch(e) {}
      cleanup(); Q.toast(message,4000);
    }
    App.cancelAudioExport=function () { fail('Audio MP4 export cancelled'); };
    Q.UI.progress('Exporting MP4 with audio','Preparing audio…',0,App.cancelAudioExport);
    guard=setTimeout(()=>fail('Audio preparation timed out on this device'),15000);
    try {
      context=new AudioCtx();
      if (!context.createMediaStreamDestination || !context.createBufferSource || !context.decodeAudioData) { fail('Audio export is not supported on this device'); return; }
      const encoded=track.data.slice(track.data.indexOf(',')+1), binary=atob(encoded), bytes=new Uint8Array(binary.length);
      for (let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
      // Resume synchronously from the export-button gesture, before async decoding.
      const resume=context.resume ? context.resume() : Promise.resolve();
      Promise.resolve(resume).then(function () {
        if (finished) return;
        if (context.state && context.state!=='running') { fail('Audio export could not start on this device'); return; }
        context.decodeAudioData(bytes.buffer,function (buffer) {
          if (finished) return;
          if (!buffer || !Number.isFinite(buffer.duration) || buffer.duration<=offset) { fail('Audio ends before this playback range; choose silent export or another range'); return; }
          try {
            const canvas=Q.canvas(w,h), ctx=canvas.getContext('2d');
            if (!canvas.captureStream) { fail('Video capture is not supported on this device'); return; }
            function paint(index) { ctx.fillStyle=d.bg; ctx.fillRect(0,0,w,h); ctx.save(); ctx.scale(w/d.width,h/d.height); d.compositeCamera(ctx,index); ctx.restore(); }
            paint(order[0]); stream=canvas.captureStream(fps);
            const videoTracks=stream.getVideoTracks ? stream.getVideoTracks() : [];
            destination=context.createMediaStreamDestination(); const audioTracks=destination.stream.getAudioTracks();
            if (!stream.addTrack || !videoTracks.length || videoTracks[0].readyState==='ended' || !audioTracks.length || audioTracks[0].readyState==='ended') { fail('Audio capture is not supported on this device'); return; }
            stream.addTrack(audioTracks[0]); source=context.createBufferSource(); source.buffer=buffer; source.connect(destination);
            recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:4000000,audioBitsPerSecond:128000});
            recorder.ondataavailable=function (event) { if (event.data && event.data.size) chunks.push(event.data); };
            recorder.onerror=function () { fail('MP4 audio encoding failed on this device'); };
            recorder.onstart=function () {
              if (finished || started) return; started=true; clearTimeout(guard);
              try {
                if (context.state && context.state!=='running') { fail('Audio export was interrupted'); return; }
                source.start(0,offset); let position=0;
                Q.UI.progress('Exporting MP4 with audio','Recording one forward animation cycle…',0);
                function next() {
                  if (finished) return;
                  try {
                    if (App.doc!==d || (context.state && context.state!=='running') || audioTracks[0].readyState==='ended' || videoTracks[0].readyState==='ended') { fail('Audio export was interrupted'); return; }
                    position++;
                    if (position>=order.length) { completed=true; guard=setTimeout(()=>fail('MP4 encoder did not finish'),15000); try { recorder.stop(); } catch(e) { fail('MP4 encoder stopped unexpectedly'); } return; }
                    paint(order[position]); Q.UI.progress('Exporting MP4 with audio','Recording frame '+(position+1)+' / '+order.length,position/order.length);
                    timer=setTimeout(next,Q.frameDelayMs(d,order[position]));
                  } catch(e) { fail('Could not render MP4 on this device'); }
                }
                timer=setTimeout(next,Q.frameDelayMs(d,order[0]));
              } catch(e) { fail('Could not start audio in MP4 export'); }
            };
            recorder.onstop=function () {
              if (finished) return;
              if (!started || !completed || !chunks.length || (recorder.mimeType && !/^video\/mp4(?:;|$)/i.test(recorder.mimeType))) { fail('MP4 encoding ended unexpectedly; no file saved'); return; }
              clearTimeout(timer); clearTimeout(guard); releaseMedia();
              const blob=new Blob(chunks,{type:'video/mp4'});
              Q.UI.progress('Exporting MP4 with audio','Checking video and audio tracks…',1);
              guard=setTimeout(()=>fail('MP4 track verification timed out; no file saved'),15000);
              Q.mp4HasAudioAndVideo(blob).then(function (valid) {
                if (finished) return;
                if (!valid) { fail('MP4 has no video or audio track; no file saved'); return; }
                finished=true; cleanup();
                const reader=new FileReader(); reader.onerror=function () { Q.toast('Could not prepare MP4',4000); };
                reader.onload=function () { const ok=Q.saveBytes(reader.result,'video/mp4','Qelem-'+Q.stamp()+'-audio.mp4'); Q.toast(ok ? 'MP4 with audio saved (Movies/Qalam on Android 10+)' : 'Could not save MP4',4000); };
                try { reader.readAsDataURL(blob); } catch(e) { Q.toast('Could not prepare MP4',4000); }
              }).catch(function () { fail('Could not verify MP4 audio and video tracks; no file saved'); });
            };
            clearTimeout(guard); guard=setTimeout(()=>fail('MP4 encoder did not start'),15000); recorder.start();
          } catch(e) { fail('Could not start MP4 with audio on this device'); }
        },function () { fail('Could not decode the audio track on this device'); });
      }).catch(function () { fail('Could not start audio export on this device'); });
    } catch(e) { fail('Could not prepare MP4 with audio on this device'); }
  };

  App.exportGif = function (opts) {
    App.stopPlay();
    const d = App.doc;
    if (!d) return;
    opts = opts || {};
    if (d.frames.length < 2) { Q.toast('Add frames to export an animation'); return; }
    const scale = opts.scale || 1;
    const w = Math.max(2, Math.round(d.width * scale));
    const h = Math.max(2, Math.round(d.height * scale));

    const included=Q.playableFrames(d), order=Q.playbackOrder(d);
    if (!order.length) { Q.toast('No included frames in the playback range',4000); return; }
    Q.UI.progress('Rendering animation', 'Building selected playback range…', 0);
    const frames = [];
    for (const i of included) {
      const cv = Q.canvas(w, h);
      const c = cv.getContext('2d');
      c.fillStyle = d.bg;
      c.fillRect(0, 0, w, h);
      c.save();
      c.scale(w / d.width, h / d.height);
      d.compositeCamera(c, i);
      c.restore();
      frames[i] = cv;
    }

    Q.encodeGif(order.map(function (i) { return frames[i]; }), {
      delayCs: Math.round(100 / d.fps),
      delaysCs: order.map(function (i) { return Math.max(2, Math.round(Q.frameDelayMs(d, i) / 10)); }),
      loop: opts.loop == null ? (d.playMode === 'once' ? -1 : 0) : opts.loop,
      background: d.bg,
      onProgress: function (p) {
        Q.UI.progress('Encoding GIF', Math.round(p * 100) + '%', p);
      }
    }).then(function (res) {
      Q.UI.endProgress();
      const name = 'Qelem-' + Q.stamp() + '.gif';
      const ok = Q.saveBytes(res.dataUrl, 'image/gif', name);
      Q.toast(ok ? 'GIF saved to Pictures/Qalam' : 'Could not save the GIF', 2600);
    }).catch(function (err) {
      Q.UI.endProgress();
      Q.fatal(err);
    });
  };

  /* ── start ──────────────────────────────────────────────── */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', App.init);
  } else {
    App.init();
  }
})();
