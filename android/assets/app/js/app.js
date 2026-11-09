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
    fillThreshold: 12
  });

  /* ── boot ───────────────────────────────────────────────── */

  App.init = function () {
    const canvas = Q.el('#view');
    App.view = new Q.View(canvas);

    const v = App.view;
    v.onDocChange = function () { App.markDirty(); };
    v.onFill = function (x, y) { App.fillAt(x, y); };
    v.onStrokeEnd = function () { App.markDirty(); App.pushRecentColor(); };
    v.onUndo = function () { App.undo(); };
    v.onRedo = function () { App.redo(); };
    v.onDrawStart = function () {
      if (!Q.el('#tray').classList.contains('hidden')) Q.UI.closeTray();
    };
    v.onPick = function (rgb) {
      App.setColor(rgb);
      v.tool = 'brush';
      Q.el('#btnEyedrop').classList.remove('on');
      Q.toast('Picked ' + Q.rgbToHex(rgb));
    };

    Q.UI.init();
    // Do not let a slow storage provider keep the launch screen on top forever.
    setTimeout(function () { Q.el('#splash').classList.add('hidden'); }, 400);

    const threshold = Q.Store.meta('fillThreshold');
    if (typeof threshold === 'number') App.fillThreshold = Q.clamp(threshold, 0, 128);
    Q.restoreBrushSettings(Q.Store.meta('brushSettings'));
    const savedBrush = Q.Store.meta('brush');
    const savedRecent = Q.Store.meta('recent');
    if (savedRecent && savedRecent.length) App.recent = savedRecent;
    if (savedBrush) v.brush = Q.brushById(savedBrush);
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
      if (document.visibilityState === 'hidden') App.saveNow(false);
    });

    // 0 = the app handled the back gesture, 1 = nothing left to close
    window.qalamBack = function () {
      if (!Q.el('#modal').classList.contains('hidden')) { Q.UI.closeModal(); return 0; }
      if (!Q.el('#tray').classList.contains('hidden')) { Q.UI.closeTray(); return 0; }
      if (!Q.el('#referenceWindow').classList.contains('hidden')) { Q.UI.closeReference(); return 0; }
      if (App.playing) { App.togglePlay(); return 0; }
      if (!Q.el('#studio').classList.contains('hidden')) { App.backToGallery(); return 0; }
      return 1;
    };

    requestAnimationFrame(function () {
      Q.hint('Two-finger tap undo · pinch & twist to zoom and rotate', 4200);
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
    App.stopPlay();
    // Serialize the previous artwork before switching documents, including when
    // New canvas is opened from the studio before the autosave timer fires.
    if (App.doc && App.doc.id !== doc.id) { clearTimeout(App.autosaveTimer); App.saveNow(false); }
    App.doc = doc;
    const v = App.view;
    v.doc = doc;
    v.locked = false;
    v.tool = 'brush'; v.selection = null; v.selectionDraft = null;
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
    App.saveNow(false);
    if (App.doc) Q.Store.meta('lastDoc', App.doc.id);
    Q.UI.showGallery();
  };

  /* ── editing ────────────────────────────────────────────── */

  App.undo = function () {
    if (!App.doc) return;
    if (App.doc.history.undo()) {
      App.view.dirty = true;
      Q.UI.syncDoc();
      App.markDirty();
      Q.haptic(6);
    }
  };

  App.redo = function () {
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
    App.view.color = rgb;
    Q.Store.meta('color', Q.rgbToHex(rgb));
    Q.UI.syncBrushUi();
    App.pushRecentColor();
  };

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
    App.doc.addLayer();
    App.view.dirty = true;
    Q.UI.syncDoc();
    App.markDirty();
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
    const step=function () {
      if (!App.playing) return;
      if (d.playMode === 'once' && position === frames.length-1) { App.stopPlay(); return; }
      if (d.playMode === 'pingpong') {
        if (frames.length>1) {
          if (position+direction>=frames.length || position+direction<0) direction*=-1;
          position+=direction;
        }
      } else position=position>=frames.length-1 ? 0 : position+1;
      d.activeFrame=frames[position]; App.view.dirty=true; Q.UI.highlightFrame(d.activeFrame);
      App.playTimer=setTimeout(step,Q.frameDelayMs(d,d.activeFrame));
    };
    App.playTimer=setTimeout(step,Q.frameDelayMs(d,d.activeFrame));
    Q.UI.refreshTimeline(); Q.toast('Playing '+d.fps+' fps');
  };

  App.stopPlay = function () {
    if (!App.playing) return;
    App.playing = false;
    clearTimeout(App.playTimer);
    App.playTimer = 0;
    if (App.view) App.view.locked = false;
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

  App.moveScaleSelection = function (dx, dy, scale) {
    const d=App.doc, v=App.view; if (!d) return;
    const layer=d.layer(), cel=d.activeCel(false);
    if (!layer || !layer.visible) { Q.toast('This layer is hidden'); return; }
    if (layer.locked) { Q.toast('This layer is locked'); return; }
    if (layer.alphaLocked) { Q.toast('Turn off alpha lock to transform'); return; }
    if (!cel) { Q.toast('Draw on this layer first'); return; }
    if (!Number.isInteger(dx) || !Number.isInteger(dy) || Math.abs(dx)>d.width*2 || Math.abs(dy)>d.height*2 || !Number.isFinite(scale) || scale<0.25 || scale>4) { Q.toast('Invalid transform'); return; }
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

  App.fillAt = function (x, y) {
    const d = App.doc;
    if (!d || x < 0 || y < 0 || x >= d.width || y >= d.height) return;
    const layer = d.layer();
    if (!layer || !layer.visible) { Q.toast('This layer is hidden'); return; }
    if (layer.locked) { Q.toast('This layer is locked'); return; }
    const bounds=App.view.selection ? {...App.view.selection} : {x:0,y:0,w:d.width,h:d.height};
    if (x < bounds.x || y < bounds.y || x >= bounds.x+bounds.w || y >= bounds.y+bounds.h) { Q.toast('Tap inside the selection'); return; }
    const cel = d.activeCel(true), color = App.view.color.slice(), tolerance = App.fillThreshold, alphaLocked=!!layer.alphaLocked;
    App.view.locked = true;
    Q.UI.progress('Filling', 'Processing the current layer…', 0);
    setTimeout(function () {
      try {
        if (App.doc !== d || d.activeCel(false) !== cel) { Q.UI.endProgress(); return; }
        const ctx=cel.getContext('2d'), image=ctx.getImageData(bounds.x,bounds.y,bounds.w,bounds.h);
        const rect=Q.floodFill(image,x-bounds.x,y-bounds.y,color,tolerance,alphaLocked);
        if (rect) {
          d.history.beginPixels(cel); ctx.putImageData(image,bounds.x,bounds.y); d.history.endPixels({x:rect.x+bounds.x,y:rect.y+bounds.y,w:rect.w,h:rect.h});
          App.view.dirty=true; App.markDirty();
        }
        Q.UI.endProgress(); Q.toast(rect ? 'Filled · Undo to revert' : 'Nothing to fill');
      } catch (err) { Q.UI.endProgress(); Q.toast('Could not fill this canvas',4000); }
      finally { App.view.locked = false; }
    }, 40);
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
        const alpha=alphaLocked ? new Uint8Array(image.width*image.height) : null;
        if (alpha) for (let i=0; i<alpha.length; i++) alpha[i]=image.data[i*4+3];
        Q.applyPixelEffect(image, kind, amount);
        if (alpha) for (let i=0; i<alpha.length; i++) image.data[i*4+3]=alpha[i];
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
    const ok = Q.saveBytes(cv.toDataURL('image/png'), 'image/png', 'Qalam-' + Q.stamp() + (transparent ? '-transparent' : '') + '.png');
    Q.toast(ok ? 'PNG saved' : 'Could not save PNG');
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
        if (Q.saveBytes(png, 'image/png', 'Qalam-' + stamp + '-frame-' + number + (transparent ? '-transparent' : '') + '.png')) saved++;
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
        const ok=Q.saveBytes(sheet.toDataURL('image/png'),'image/png','Qalam-'+Q.stamp()+'-spritesheet.png');
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
      ctx.save(); ctx.scale(w / d.width, h / d.height); d.composite(ctx, index); ctx.restore();
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
          const ok = Q.saveBytes(reader.result, 'video/mp4', 'Qalam-' + Q.stamp() + '.mp4');
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
      d.composite(c, i);
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
      const name = 'Qalam-' + Q.stamp() + '.gif';
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
