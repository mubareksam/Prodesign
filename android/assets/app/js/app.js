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
    ready: false
  });

  /* ── boot ───────────────────────────────────────────────── */

  App.init = function () {
    const canvas = Q.el('#view');
    App.view = new Q.View(canvas);

    const v = App.view;
    v.onDocChange = function () { App.markDirty(); };
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
    App.stopPlay();
    App.doc = doc;
    const v = App.view;
    v.doc = doc;
    v.locked = false;
    v.tool = 'brush';
    Q.UI.showStudio();
    Q.el('#btnEyedrop').classList.remove('on');
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
    const d = App.doc;
    if (!d) return;
    d.deleteFrame(idx == null ? d.activeFrame : idx);
    App.view.dirty = true;
    Q.UI.syncDoc();
    Q.UI.refreshTimeline();
    App.markDirty();
  };

  App.selectFrame = function (i) {
    if (!App.doc) return;
    App.doc.activeFrame = Q.clamp(i, 0, App.doc.frames.length - 1);
    App.view.dirty = true;
    Q.UI.syncDoc();
    Q.UI.refreshTimeline();
  };

  App.moveFrame = function (i, dir) {
    App.doc.moveFrame(i, dir);
    App.view.dirty = true;
    Q.UI.syncDoc();
    Q.UI.refreshTimeline();
    App.markDirty();
  };

  App.togglePlay = function () {
    const d = App.doc;
    if (!d) return;
    if (App.playing) { App.stopPlay(); return; }
    if (d.frames.length < 2) { Q.toast('Add a frame first'); return; }
    App.playing = true;
    App.view.locked = true;
    const start = d.activeFrame;
    let frame = start;
    const step = function () {
      if (!App.playing) return;
      frame = (frame + 1) % d.frames.length;
      d.activeFrame = frame;
      App.view.dirty = true;
      App.playTimer = setTimeout(step, Math.max(33, 1000 / d.fps));
    };
    App.playTimer = setTimeout(step, Math.max(33, 1000 / d.fps));
    Q.UI.refreshTimeline();
    Q.toast('Playing ' + d.fps + ' fps');
  };

  App.stopPlay = function () {
    if (!App.playing) return;
    App.playing = false;
    clearTimeout(App.playTimer);
    App.playTimer = 0;
    if (App.view) App.view.locked = false;
    Q.UI.refreshTimeline();
  };

  App.flipCanvas = function () {
    const d = App.doc;
    if (!d) return;
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

  App.exportPng = function () {
    const d = App.doc;
    if (!d) return;
    const cv = d.flatten(d.activeFrame);
    Q.saveBytes(cv.toDataURL('image/png'), 'image/png', 'Qelem-' + Q.stamp() + '.png');
    Q.toast('PNG saved to Pictures/Qelem');
  };

  App.exportGif = function (opts) {
    const d = App.doc;
    if (!d) return;
    opts = opts || {};
    if (d.frames.length < 2) { Q.toast('Add frames to export an animation'); return; }
    const scale = opts.scale || 1;
    const w = Math.max(2, Math.round(d.width * scale));
    const h = Math.max(2, Math.round(d.height * scale));

    Q.UI.progress('Rendering animation', 'Building ' + d.frames.length + ' frames…', 0);
    const frames = [];
    for (let i = 0; i < d.frames.length; i++) {
      const cv = Q.canvas(w, h);
      const c = cv.getContext('2d');
      c.fillStyle = d.bg;
      c.fillRect(0, 0, w, h);
      c.save();
      c.scale(w / d.width, h / d.height);
      d.composite(c, i);
      c.restore();
      frames.push(cv);
    }

    Q.encodeGif(frames, {
      delayCs: Math.round(100 / d.fps),
      loop: opts.loop == null ? 0 : opts.loop,
      background: d.bg,
      onProgress: function (p) {
        Q.UI.progress('Encoding GIF', Math.round(p * 100) + '%', p);
      }
    }).then(function (res) {
      Q.UI.endProgress();
      const name = 'Qelem-' + Q.stamp() + '.gif';
      const ok = Q.saveBytes(res.dataUrl, 'image/gif', name);
      Q.toast(ok ? 'GIF saved to Pictures/Qelem' : 'Could not save the GIF', 2600);
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
