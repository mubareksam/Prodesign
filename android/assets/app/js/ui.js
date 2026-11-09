/* Qalam — UI: gallery, trays, colour wheel, layers, animation timeline, dialogs. */
(function () {
  'use strict';
  const Q = window.Q;
  const UI = (Q.UI = {});

  const PALETTE = [
    '#1b1b1f', '#3a3a42', '#7a7a86', '#c9c9d1', '#ffffff',
    '#8a1c1c', '#e03131', '#ff8787', '#ffa94d', '#f0b46a',
    '#e8d44d', '#94c748', '#2f9e44', '#0ca678', '#22b8cf',
    '#1c7ed6', '#4c6ef5', '#7048e8', '#ae3ec9', '#e64980',
    '#5c3d2e', '#8d6e63', '#c8a27a', '#f5e6d3'
  ];

  let tray = null;
  let timelineOpen = false;
  let timelineCategory = 'frames';
  let wheelState = { hue: 210, sat: 0.1, val: 0.12, drag: null };

  function app() { return Q.App; }

  /* ── shared bits ────────────────────────────────────────── */

  function icon(path, cls) {
    return '<svg viewBox="0 0 24 24" class="' + (cls || '') + '">' + path + '</svg>';
  }
  const ICON = {
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 6.2A9.6 9.6 0 0112 6c6.5 0 10 6 10 6a17 17 0 01-3 3.6"/><path d="M6.3 7.8A17 17 0 002 12s3.5 6 10 6a9.7 9.7 0 003.6-.7"/>',
    trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5h10"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    merge: '<path d="M12 3v10"/><path d="M8 9l4 4 4-4"/><path d="M4 17h16"/>',
    clear: '<path d="M5 19h14"/><path d="M9 15l7-7 3 3-7 7z"/>',
    play: '<path d="M7 5l12 7-12 7z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    photo: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 15l5-4 4 3 3-3 6 5"/>',
    film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16"/>',
    wrench: '<path d="M14.5 6a4.5 4.5 0 00-5.7 5.7L3 17.5 6.5 21l5.8-5.8A4.5 4.5 0 0018 9l-3 2-2-2z"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    flip: '<path d="M12 3v18"/><path d="M8 7L3 12l5 5z"/><path d="M16 7l5 5-5 5z"/>',
    reset: '<path d="M4 12a8 8 0 1015-4"/><path d="M19 4v5h-5"/>',
    save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h7V3M8 14h8v7H8z"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    swatch: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 16l8-8 8 8"/>',
    gradient: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 5v14M12 5v14M16 5v14"/>',
    controls: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
    motion: '<path d="M4 18C4 7 9 6 12 12s5 6 8-6"/><circle cx="4" cy="18" r="2"/><circle cx="20" cy="6" r="2"/>',
    frameOptions: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h7M7 17h4"/>',
    batch: '<rect x="7" y="7" width="13" height="13" rx="2"/><path d="M4 16V5a1 1 0 011-1h11"/>',
    blankFrame: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 8v8M8 12h8"/>',
    previous: '<path d="M6 5v14M18 6l-8 6 8 6z"/>',
    next: '<path d="M18 5v14M6 6l8 6-8 6z"/>',
    onion: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
    audio: '<path d="M10 17V5l9-2v12"/><circle cx="7" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
    rig: '<circle cx="5" cy="17" r="2"/><circle cx="12" cy="8" r="2"/><circle cx="19" cy="16" r="2"/><path d="M6.5 15.5l4-6M13.5 9.5l4 5"/>',
    layerMotion: '<path d="M3 9l6-4 6 4-6 4zM3 13l6 4 5-3"/><path d="M16 17h5M19 15l2 2-2 2"/>',
    particles: '<circle cx="5" cy="17" r="1.5"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="5" r="2.5"/><path d="M8 15l2-2M15 10l2-3"/>',
    camera: '<rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="12" cy="12.5" r="3.5"/><path d="M7 6l1.5-2h4L14 6"/>',
    tween: '<rect x="3" y="7" width="7" height="7" rx="1"/><path d="M12 12h4M14 10l2 2-2 2"/><rect x="17" y="5" width="4" height="4" rx="1" transform="rotate(25 19 7)"/>'
  };

  function fitCanvasToBox(cv, box) {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = Math.max(1, Math.round((r.width || box || 160) * dpr));
    const h = Math.max(1, Math.round((r.height || 52) * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  }

  UI.toast = Q.toast;

  /* ── init ───────────────────────────────────────────────── */

  UI.init = function () {
    const el = Q.el;

    el('#btnNew').addEventListener('click', function () { UI.newCanvasDialog(); });
    el('#referenceClose').addEventListener('click', function () { UI.closeReference(); });
    el('#referenceZoom').addEventListener('input', function () { UI.resizeReference(); });
    const handle = el('#referenceHandle'); let dragging = null;
    handle.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      const panel = el('#referenceWindow'), r = panel.getBoundingClientRect();
      dragging = { id:e.pointerId, x:e.clientX, y:e.clientY, left:r.left, top:r.top };
      try { handle.setPointerCapture(e.pointerId); } catch (err) {} e.preventDefault();
    });
    handle.addEventListener('pointermove', function (e) {
      if (!dragging || e.pointerId !== dragging.id) return;
      const panel=el('#referenceWindow');
      panel.style.left = Q.clamp(dragging.left + e.clientX - dragging.x, 0, Math.max(0, window.innerWidth - panel.offsetWidth)) + 'px';
      panel.style.top = Q.clamp(dragging.top + e.clientY - dragging.y, 0, Math.max(0, window.innerHeight - 48)) + 'px'; panel.style.right='auto';
    });
    handle.addEventListener('pointerup', function () { dragging=null; });
    handle.addEventListener('pointercancel', function () { dragging=null; });
    el('#btnGallery').addEventListener('click', function () { app().backToGallery(); });

    el('#btnUndo').addEventListener('click', function () { app().undo(); });
    el('#btnRedo').addEventListener('click', function () { app().redo(); });
    el('#btnTimeline').addEventListener('click', function () { UI.toggleTimeline(); });
    el('#btnMenu').addEventListener('click', function () { UI.toggleTray('menu'); });
    el('#btnEffects').addEventListener('click', function () { UI.closeTray(); UI.effectsDialog(); });
    el('#audioImport').addEventListener('change', function () {
      const file=this.files && this.files[0], target=UI.audioTarget;
      this.value=''; UI.audioTarget=null;
      if (file && target) app().importAudioFile(file,target);
    });
    el('#imageImport').addEventListener('change', function () {
      const file=this.files && this.files[0], target=UI.imageTarget;
      this.value=''; UI.imageTarget=null;
      if (file && target) app().importImageFile(file,target);
    });

    el('#btnBrush').addEventListener('click', function () { UI.toggleTray('brushes'); });
    el('#btnLayers').addEventListener('click', function () { UI.toggleTray('layers'); });
    // A tap opens the picker; a drag from the swatch drops the captured colour
    // on the raw canvas. Pointer capture also handles dragging outside the button.
    const swatch=el('#btnColor'); let colorDrag=null, suppressColorClick=false;
    swatch.addEventListener('pointerdown',function (e) {
      if (!app().doc || !app().view || app().view.locked || (e.button!=null && e.button!==0)) return;
      colorDrag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,color:app().view.color.slice(),doc:app().doc};
      try { swatch.setPointerCapture(e.pointerId); } catch(err) {}
    });
    swatch.addEventListener('pointermove',function (e) {
      if(!colorDrag || colorDrag.id!==e.pointerId) return;
      if(Math.hypot(e.clientX-colorDrag.x,e.clientY-colorDrag.y)>8) colorDrag.moved=true;
      if(colorDrag.moved) { e.preventDefault(); let dot=document.getElementById('colorDropGhost'); if(!dot) { dot=Q.crel('div','color-drop-ghost'); dot.id='colorDropGhost'; document.body.appendChild(dot); } dot.style.background=Q.rgbToHex(colorDrag.color); dot.style.left=e.clientX+'px'; dot.style.top=e.clientY+'px'; }
    });
    function finishColorDrag(e) {
      if(!colorDrag || colorDrag.id!==e.pointerId) return; const drag=colorDrag; colorDrag=null;
      const ghost=document.getElementById('colorDropGhost'); if(ghost) ghost.remove();
      if(!drag.moved) return; suppressColorClick=true; setTimeout(function(){ suppressColorClick=false; },500);
      if(e.type==='pointercancel' || app().doc!==drag.doc || app().view.locked) return;
      const cv=app().view.canvas, r=cv.getBoundingClientRect(), hit=document.elementFromPoint(e.clientX,e.clientY);
      if(e.clientX<r.left || e.clientX>=r.right || e.clientY<r.top || e.clientY>=r.bottom || hit!==cv) { Q.toast('Drop on the canvas to fill'); return; }
      const p=app().view.toDoc(e.clientX-r.left,e.clientY-r.top); app().fillAt(p.x,p.y,drag.color);
    }
    swatch.addEventListener('pointerup',finishColorDrag); swatch.addEventListener('pointercancel',finishColorDrag);
    swatch.addEventListener('click', function () { if(suppressColorClick) { suppressColorClick=false; return; } UI.toggleTray('color'); });
    el('#btnEyedrop').addEventListener('click', function () {
      const v = app().view;
      v.tool = v.tool === 'eyedrop' ? 'brush' : 'eyedrop';
      el('#btnEyedrop').classList.toggle('on', v.tool === 'eyedrop');
      el('#btnFill').classList.remove('on');
      Q.hint(v.tool === 'eyedrop' ? 'Tap the canvas to pick a colour' : 'Brush mode', 1600);
    });

    el('#btnFill').addEventListener('click', function () {
      const v=app().view; v.tool = v.tool === 'fill' ? 'brush' : 'fill';
      el('#btnFill').classList.toggle('on', v.tool === 'fill'); el('#btnEyedrop').classList.remove('on');
      Q.hint(v.tool === 'fill' ? 'Tap an area to fill the active layer' : 'Brush mode', 1800);
    });

    const size = el('#sizeSlider');
    size.addEventListener('input', function () {
      app().setSize(parseFloat(size.value));
    });
    const op = el('#opacitySlider');
    op.addEventListener('input', function () {
      app().setOpacity(parseInt(op.value, 10) / 100);
    });

    const title = el('#docTitle');
    title.addEventListener('change', function () {
      if (!app().doc) return;
      app().doc.name = title.value.trim() || 'Untitled';
      app().markDirty(true);
    });
    title.addEventListener('focus', function () { title.select(); });
    title.addEventListener('keydown', function (e) { if (e.key === 'Enter') title.blur(); });

    el('#modal').addEventListener('pointerdown', function (e) {
      if (e.target.id === 'modal') UI.closeModal();
    });

    window.addEventListener('resize', function () {
      if (app().view) { app().view.resize(); app().view.dirty = true; }
      if (tray === 'color') buildColor();
    });

    // keyboard shortcuts for desktop testing
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { UI.closeTray(); UI.closeModal(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); if (e.shiftKey) app().redo(); else app().undo(); }
      if (e.key === '[' ) app().setSize(app().view.size * 0.85);
      if (e.key === ']' ) app().setSize(app().view.size * 1.18);
    });
    void ICON;
  };

  /* ── gallery ────────────────────────────────────────────── */

  UI.renderGallery = function () {
    const grid = Q.el('#galGrid');
    const empty = Q.el('#galEmpty');
    grid.innerHTML = '';
    Q.Store.list().then(function (items) {
      empty.classList.toggle('hidden', items.length > 0);
      items.forEach(function (item) {
        const card = Q.crel('div', 'g-card');
        if (item.thumb) {
          const img = Q.crel('img');
          img.src = item.thumb;
          img.alt = item.name || 'artwork';
          card.appendChild(img);
        } else {
          card.appendChild(Q.crel('div', 'g-ph', 'ቀ'));
        }
        const info = Q.crel('div', 'g-info');
        info.appendChild(Q.crel('div', 'g-name', escapeHtml(item.name || 'Untitled')));
        const when = new Date(item.updated || Date.now());
        info.appendChild(Q.crel('div', 'g-sub',
          (item.frames > 1 ? item.frames + ' frames · ' : '') +
          (item.w || '?') + '×' + (item.h || '?') + ' · ' + when.toLocaleDateString()));
        card.appendChild(info);

        const del = Q.crel('button', 'g-del', icon(ICON.trash));
        del.addEventListener('click', function (e) {
          e.stopPropagation();
          UI.confirm('Delete “‘' + (item.name || 'Untitled') + '”?' , 'This removes the artwork from this device.', function () {
            Q.Store.remove(item.id).then(function () { UI.renderGallery(); });
          });
        });
        card.appendChild(del);

        card.addEventListener('click', function () { app().openDoc(item.id); });
        grid.appendChild(card);
      });
    });
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  UI.showGallery = function () {
    Q.el('#studio').classList.add('hidden');
    UI.closeReference();
    Q.el('#gallery').classList.remove('hidden');
    UI.closeTray();
    Q.el('#timeline').classList.add('hidden');
    timelineOpen = false;
    UI.renderGallery();
  };

  UI.showStudio = function () {
    Q.el('#gallery').classList.add('hidden');
    Q.el('#studio').classList.remove('hidden');
    const v = app().view;
    v.resize();
    v.fit();
    v.dirty = true;
    UI.syncDoc();
  };

  UI.syncDoc = function () {
    const d = app().doc;
    if (!d) return;
    Q.el('#docTitle').value = d.name;
    Q.el('#docMeta').textContent = d.width + ' × ' + d.height + ' · ' +
      (d.frames.length > 1 ? d.frames.length + ' frames · ' : '') + d.layers.length + (d.layers.length > 1 ? ' layers' : ' layer');
    UI.syncBrushUi();
    UI.syncHistory();
    UI.refreshReference();
    if (tray === 'layers') buildLayers(Q.el('#trayBody'));
    if (timelineOpen) buildTimeline();
  };

  UI.syncBrushUi = function () {
    const v = app().view;
    Q.el('#sizeSlider').value = Math.round(v.size);
    Q.el('#sizeVal').textContent = Math.round(v.size);
    Q.el('#opacitySlider').value = Math.round(v.opacity * 100);
    Q.el('#opacityVal').textContent = Math.round(v.opacity * 100);
    const sw = Q.el('#btnColor');
    sw.style.background = Q.rgbToHex(v.color);
    Q.el('#btnBrush').classList.toggle('on', tray === 'brushes');
  };

  UI.syncHistory = function () {
    const d = app().doc;
    Q.el('#btnUndo').disabled = !d || !d.history.canUndo();
    Q.el('#btnRedo').disabled = !d || !d.history.canRedo();
  };

  /* ── trays ──────────────────────────────────────────────── */

  const BUILDERS = {
    brushes: buildBrushes,
    layers: buildLayers,
    color: buildColor,
    menu: buildMenu
  };

  UI.toggleTray = function (kind) {
    if (tray === kind) { UI.closeTray(); return; }
    UI.openTray(kind);
  };

  UI.openTray = function (kind) {
    tray = kind;
    const t = Q.el('#tray');
    t.classList.remove('hidden');
    Q.el('#trayBody').innerHTML = '';
    if (BUILDERS[kind]) BUILDERS[kind](Q.el('#trayBody'));
    UI.syncBrushUi();
    Q.el('#btnBrush').classList.toggle('on', kind === 'brushes');
    Q.el('#btnLayers').classList.toggle('on', kind === 'layers');
    Q.el('#btnColor').classList.toggle('on', kind === 'color');
    Q.el('#btnMenu').classList.toggle('on', kind === 'menu');
  };

  UI.closeTray = function () {
    tray = null;
    Q.el('#tray').classList.add('hidden');
    ['#btnBrush', '#btnLayers', '#btnColor', '#btnMenu'].forEach(function (s) {
      Q.el(s).classList.remove('on');
    });
  };

  function trayHead(title, rightNodes) {
    const head = Q.crel('div', 'tray-head');
    head.appendChild(Q.crel('h3', null, title));
    const row = Q.crel('div', 'row');
    (rightNodes || []).forEach(function (n) { row.appendChild(n); });
    head.appendChild(row);
    return head;
  }

  function chip(label, on, onClick, iconPath) {
    const b = Q.crel('button', 'chip' + (on ? ' on' : ''));
    if (iconPath) b.innerHTML = icon(iconPath);
    b.appendChild(document.createTextNode(label));
    b.addEventListener('click', onClick);
    return b;
  }

  function iconButton(label,ico,fn,on) {
    const b=Q.crel('button','chip icon-chip'+(on ? ' on' : '')); b.innerHTML=icon(ico);
    b.setAttribute('aria-label',label); b.setAttribute('title',label); b.addEventListener('click',fn); return b;
  }

  /* ── brushes ────────────────────────────────────────────── */

  function buildBrushes(root) {
    root.appendChild(trayHead('Brush library', [chip('Brush studio', false, function () { UI.brushStudio(); }, ICON.wrench)]));
    const grid = Q.crel('div', 'brush-grid');
    Q.BRUSHES.forEach(function (b) {
      const card = Q.crel('button', 'brush-card' + (b.id === app().view.brush.id ? ' on' : ''));
      const cv = Q.crel('canvas');
      cv.width = 132; cv.height = 40;
      const badge = Q.crel('span', 'brush-kind');
      const category = b.eraser ? 'ERASER' : b.engine === 'grain' ? 'PENCIL' : b.engine === 'soft' ? 'PAINT' : 'INK';
      const tip = b.eraser ? '<path d="M4 15l8-9a2 2 0 013 0l5 5-8 9H8zM9 20h11"/>' :
        b.engine === 'grain' ? '<path d="M5 19l3-7L16 4l4 4-8 8zM5 19l7-3M14 6l4 4"/>' :
        b.engine === 'soft' ? '<path d="M16 3c1 5 5 7 5 11a6 6 0 01-12 0c0-4 4-6 7-11zM6 16c0 3-1 4-3 5"/>' :
        '<path d="M12 3l7 7-8 8-6 1 1-6zM12 3l-2 8 3 3 6-4M5 19l-2 2"/>';
      badge.innerHTML = icon(tip) + '<span>' + category + '</span>';
      card.appendChild(badge);
      card.appendChild(cv);
      card.appendChild(Q.crel('span', 'brush-name', b.name));
      grid.appendChild(card);
      requestAnimationFrame(function () {
        Q.brushPreview(b, cv, [240, 236, 232]);
      });
      card.addEventListener('click', function () {
        app().setBrush(b.id);
        UI.openTray('brushes');
      });
    });
    root.appendChild(grid);

    const head2 = Q.crel('div', 'tray-head');
    head2.style.marginTop = '12px';
    head2.appendChild(Q.crel('h3', null, 'Pressure response'));
    root.appendChild(head2);
    const row = Q.crel('div', 'field');
    row.innerHTML = '<label>Size</label>';
    const r1 = Q.crel('input');
    r1.type = 'range'; r1.min = '0'; r1.max = '100';
    r1.value = Math.round((app().view.brush.pressureSize || 0) * 100);
    const v1 = Q.crel('div', 'val', String(r1.value));
    r1.addEventListener('input', function () {
      app().view.brush.pressureSize = parseInt(r1.value, 10) / 100;
      const settings = Q.Store.meta('brushSettings') || {};
      settings[app().view.brush.id] = Object.assign({}, settings[app().view.brush.id], { pressureSize: app().view.brush.pressureSize });
      Q.Store.meta('brushSettings', settings);
      v1.textContent = r1.value;
    });
    row.appendChild(r1); row.appendChild(v1);
    root.appendChild(row);
    void fitCanvasToBox;
  }

  // A focused, local brush editor: adjustments are saved per preset on this device.
  UI.brushStudio = function () {
    const brush = app().view.brush;
    const card = Q.crel('div');
    card.appendChild(Q.crel('h2', null, 'Brush studio · ' + brush.name));
    card.appendChild(Q.crel('p', 'sub', 'Tune this brush. Changes are saved on this device.'));
    const fields = [ ['Spacing','spacing',2,100], ['Flow','flow',0,100], ['Opacity','opacity',0,100],
      ['Edge hardness','hardness',0,100], ['Pressure size','pressureSize',0,100],
      ['Pressure opacity','pressureAlpha',0,100], ['Stabilization','streamline',0,90] ];
    const settings = Q.Store.meta('brushSettings') || {};
    fields.forEach(function (field) {
      const row = Q.crel('div', 'field studio-field');
      row.appendChild(Q.crel('label', null, field[0]));
      const slider = Q.crel('input'); slider.type = 'range'; slider.min = field[2]; slider.max = field[3];
      slider.value = Math.round((brush[field[1]] == null ? 0 : brush[field[1]]) * 100);
      slider.setAttribute('aria-label', field[0]);
      const value = Q.crel('div', 'val', slider.value + '%');
      slider.addEventListener('input', function () {
        brush[field[1]] = Number(slider.value) / 100;
        settings[brush.id] = Object.assign({}, settings[brush.id], { [field[1]]: brush[field[1]] });
        Q.Store.meta('brushSettings', settings); value.textContent = slider.value + '%';
      });
      row.appendChild(slider); row.appendChild(value); card.appendChild(row);
    });
    const actions = Q.crel('div', 'modal-actions');
    const reset = Q.crel('button', 'btn ghost', 'Reset');
    reset.addEventListener('click', function () {
      const original = Q.BRUSH_DEFAULTS.find(function (b) { return b.id === brush.id; });
      Object.assign(brush, original); delete settings[brush.id]; Q.Store.meta('brushSettings', settings); UI.brushStudio();
    });
    const done = Q.crel('button', 'btn primary', 'Done');
    done.addEventListener('click', function () { UI.closeModal(); UI.openTray('brushes'); });
    actions.appendChild(reset); actions.appendChild(done); card.appendChild(actions); UI.openModal(card);
  };

  /* ── layers ─────────────────────────────────────────────── */

  UI.pickImage = function () {
    const d=app().doc; if (!d) return;
    app().stopPlay(); UI.imageTarget={doc:d,frame:d.frames[d.activeFrame],layer:d.layer()};
    Q.el('#imageImport').value=''; Q.el('#imageImport').click();
  };

  UI.addLayerDialog = function () {
    app().stopPlay(); const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Add to layers'));
    card.appendChild(Q.crel('p','sub','New content is added on the current frame; other frames stay empty.'));
    const grid=Q.crel('div','menu-grid');
    function action(label,ico,fn) { const b=Q.crel('button','menu-item'); b.innerHTML=icon(ico); b.appendChild(document.createTextNode(label)); b.addEventListener('click',fn); grid.appendChild(b); }
    action('Blank layer',ICON.plus,function () { UI.closeModal(); app().addLayer(); });
    action('Import image',ICON.photo,function () { UI.closeModal(); UI.pickImage(); });
    action('Solid colour',ICON.swatch,function () { UI.paintLayerDialog('solid'); });
    action('Gradient',ICON.gradient,function () { UI.paintLayerDialog('gradient'); });
    card.appendChild(grid); const close=Q.crel('button','btn ghost','Cancel'); close.addEventListener('click',function () { UI.closeModal(); }); card.appendChild(close); UI.openModal(card);
  };
  UI.paintLayerDialog = function (kind) {
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,kind==='solid' ? 'Solid colour layer' : 'Gradient layer'));
    card.appendChild(Q.crel('p','sub','Creates a full-canvas raster layer on this frame. You can undo it; the fill is not editable as a live gradient.'));
    function colorField(label,value) { const row=Q.crel('div','field'); row.appendChild(Q.crel('label',null,label)); const input=Q.crel('input','select'); input.type='text'; input.value=value; input.setAttribute('aria-label',label); row.appendChild(input); card.appendChild(row); return input; }
    const first=colorField(kind==='solid' ? 'Colour' : 'Start colour',Q.rgbToHex(app().view.color));
    const second=kind==='gradient' ? colorField('End colour','#ffffff') : null;
    let dir=null;
    if (kind==='gradient') { const row=Q.crel('div','field'); row.appendChild(Q.crel('label',null,'Direction')); dir=Q.crel('select'); dir.setAttribute('aria-label','Gradient direction'); [['horizontal','Horizontal'],['vertical','Vertical'],['diagonal','Diagonal'],['radial','Radial']].forEach(function (v) { const o=Q.crel('option'); o.value=v[0]; o.textContent=v[1]; dir.appendChild(o); }); row.appendChild(dir); card.appendChild(row); }
    const err=Q.crel('p','canvas-error'); err.setAttribute('role','alert'); card.appendChild(err);
    const actions=Q.crel('div','modal-actions'), cancel=Q.crel('button','btn ghost','Cancel'), create=Q.crel('button','btn primary','Create layer');
    cancel.addEventListener('click',function () { UI.closeModal(); });
    create.addEventListener('click',function () { if (!Q.hexToRgb(first.value) || (second && !Q.hexToRgb(second.value))) { err.textContent='Enter a 3- or 6-digit hex colour.'; return; } if (app().addPaintLayer(kind,first.value,second ? second.value : '',dir ? dir.value : '')) UI.closeModal(); });
    actions.appendChild(cancel); actions.appendChild(create); card.appendChild(actions); UI.openModal(card);
  };

  function buildLayers(root) {
    const d = app().doc;
    if (!d) return;
    root = root || Q.el('#trayBody');
    root.innerHTML = '';

    const addBtn=iconButton('Add layer or image',ICON.plus,function () { UI.addLayerDialog(); });
    const dupBtn=iconButton('Duplicate layer',ICON.copy,function () { app().duplicateLayer(); });
    const mergeBtn=iconButton('Merge layer down',ICON.merge,function () { app().mergeDownLayer(d.activeLayer); });
    root.appendChild(trayHead('Layers · ' + d.layers.length,[addBtn,dupBtn,mergeBtn]));

    const list = Q.crel('div', 'layer-list');
    for (let i = d.layers.length - 1; i >= 0; i--) {
      const layer = d.layers[i];
      const row = Q.crel('div', 'layer-row' + (i === d.activeLayer ? ' on' : ''));

      const thumb = Q.crel('div', 'layer-thumb');
      const tcv = d.layerThumbnail(i, 46);
      thumb.appendChild(tcv);
      row.appendChild(thumb);

      const meta = Q.crel('div', 'layer-meta');
      meta.appendChild(Q.crel('div', 'layer-name', escapeHtml(layer.name)));
      const sub = Q.crel('div', 'layer-sub', Math.round(layer.opacity * 100) + '% · ' + (layer.clipped ? 'Normal (clipped)' : blendLabel(layer.blend)) + (layer.locked ? ' · Locked' : '') + (layer.alphaLocked ? ' · Alpha locked' : ''));
      meta.appendChild(sub);
      row.appendChild(meta);

      const tools = Q.crel('div', 'layer-tools');
      const eye = Q.crel('button', 'mini-btn', icon(layer.visible ? ICON.eye : ICON.eyeOff));
      eye.addEventListener('click', function (e) {
        e.stopPropagation();
        app().setLayerProp(i, 'visible', !layer.visible);
        buildLayers(root);
      });
      tools.appendChild(eye);

      const more = Q.crel('button', 'mini-btn', '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>');
      more.addEventListener('click', function (e) {
        e.stopPropagation();
        UI.layerSheet(i);
      });
      tools.appendChild(more);
      row.appendChild(tools);

      row.addEventListener('click', function () {
        d.activeLayer = i;
        buildLayers(root);
        UI.syncDoc();
      });

      // horizontal drag on the row adjusts opacity
      attachOpacityDrag(row, i, root);
      list.appendChild(row);
    }
    root.appendChild(list);

    const info = Q.crel('div', 'layer-sub');
    info.style.marginTop = '10px';
    info.textContent = 'Memory used: ' + d.memoryMB() + ' MB across ' + d.frames.length + ' frame(s)';
    root.appendChild(info);
  }

  function blendLabel(id) {
    for (const m of Q.BLEND_MODES) if (m[0] === id) return m[1];
    return 'Normal';
  }

  function attachOpacityDrag(row, idx, root) {
    let startX = 0, startOpacity = 1, dragging = false;
    row.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      startX = e.clientX; startOpacity = app().doc.layers[idx].opacity; dragging = true;
    });
    row.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      const delta = (e.clientX - startX) / 220;
      const val = Q.clamp(startOpacity + delta, 0.02, 1);
      app().view.doc.layers[idx].opacity = val;
      app().view.dirty = true;
      const sub = row.querySelector('.layer-sub');
      if (sub) { const layer=app().doc.layers[idx]; sub.textContent=Math.round(val*100)+'% · '+(layer.clipped ? 'Normal (clipped)' : blendLabel(layer.blend))+(layer.locked ? ' · Locked' : '')+(layer.alphaLocked ? ' · Alpha locked' : ''); }
    });
    row.addEventListener('pointerup', function () {
      if (!dragging) return;
      dragging = false;
      app().commitLayerOpacity(idx, startOpacity);
      void root;
    });
    row.addEventListener('pointercancel', function () { dragging = false; });
  }

  UI.layerSheet = function (i) {
    const d = app().doc;
    const layer = d.layers[i];
    if (!layer) return;
    const card = Q.crel('div');
    card.appendChild(Q.crel('h2', null, 'Layer'));
    card.appendChild(Q.crel('p', 'sub', 'Row ' + (i + 1) + ' of ' + d.layers.length + '. Alpha lock preserves transparency. Clipping uses the nearest unclipped layer below as its base; clipped layers use Normal blend.'));
    if (layer.clipped && d.clipBase(i)<0) card.appendChild(Q.crel('p','sub','This clipped layer has no base and is hidden until you move it above an unclipped layer or turn clipping off.'));
    else if (layer.clipped) card.appendChild(Q.crel('p','sub','Clipped to: '+d.layers[d.clipBase(i)].name));

    const nameField = Q.crel('div', 'field');
    nameField.innerHTML = '<label>Name</label>';
    const input = Q.crel('input');
    input.type = 'text';
    input.value = layer.name;
    input.className = 'select';
    input.style.height = '36px';
    nameField.appendChild(input);
    card.appendChild(nameField);

    const blendField = Q.crel('div', 'field');
    blendField.innerHTML = '<label>Blend</label>';
    const sel = Q.crel('select');
    Q.BLEND_MODES.forEach(function (m) {
      const o = document.createElement('option');
      o.value = m[0]; o.textContent = m[1];
      if (m[0] === layer.blend) o.selected = true;
      sel.appendChild(o);
    });
    if (layer.clipped) { sel.disabled=true; sel.setAttribute('aria-label','Blend unavailable while clipped'); }
    blendField.appendChild(sel);
    card.appendChild(blendField);

    const actions = Q.crel('div', 'menu-grid');
    const mk = function (label, ico, fn, danger) {
      const b = Q.crel('button', 'menu-item' + (danger ? ' danger' : ''));
      b.innerHTML = icon(ico);
      b.appendChild(document.createTextNode(label));
      b.addEventListener('click', function () { UI.closeModal(); fn(); });
      return b;
    };
    actions.appendChild(mk(layer.locked ? 'Unlock layer' : 'Lock layer', ICON.sparkle, function () { app().setLayerProp(i, 'locked', !layer.locked); }));
    actions.appendChild(mk(layer.alphaLocked ? 'Unlock alpha' : 'Alpha lock', ICON.sparkle, function () { app().setLayerProp(i, 'alphaLocked', !layer.alphaLocked); }));
    actions.appendChild(mk(layer.clipped ? 'Release clipping mask' : 'Clipping mask', ICON.layers, function () { app().setLayerClipped(i,!layer.clipped); }));
    actions.appendChild(mk('Layer keyframes', ICON.layerMotion, function () { d.activeLayer=i; UI.syncDoc(); UI.closeTray(); UI.layerMotionDialog(); }));
    actions.appendChild(mk('Move up', ICON.up, function () { app().moveLayer(i, 1); }));
    actions.appendChild(mk('Move down', ICON.down, function () { app().moveLayer(i, -1); }));
    actions.appendChild(mk('Duplicate', ICON.copy, function () { app().duplicateLayer(i); }));
    actions.appendChild(mk('Clear', ICON.clear, function () { app().clearLayer(i); }));
    actions.appendChild(mk('Merge down', ICON.merge, function () { app().mergeDownLayer(i); }));
    actions.appendChild(mk('Delete', ICON.trash, function () { app().deleteLayer(i); }));
    card.appendChild(actions);

    input.addEventListener('change', function () {
      layer.name = input.value.trim() || layer.name;
      app().markDirty(true);
      if (tray === 'layers') buildLayers(Q.el('#trayBody'));
    });
    sel.addEventListener('change', function () {
      app().setLayerProp(i, 'blend', sel.value);
      if (tray === 'layers') buildLayers(Q.el('#trayBody'));
    });

    UI.openModal(card);
  };

  /* ── colour ─────────────────────────────────────────────── */

  function currentHsv() {
    const rgb = app().view.color;
    const hsv = Q.rgbToHsv(rgb[0], rgb[1], rgb[2]);
    return { hue: hsv[0], sat: hsv[1], val: hsv[2] };
  }

  function buildColor(root) {
    const hsv = currentHsv();
    wheelState.hue = hsv.hue;
    wheelState.sat = hsv.sat;
    wheelState.val = hsv.val;

    root.appendChild(trayHead('Colour', []));
    const wrap = Q.crel('div', 'color-wrap');

    const wheel = Q.crel('canvas');
    wheel.id = 'wheel';
    wrap.appendChild(wheel);

    const side = Q.crel('div', 'color-side');

    const hexRow = Q.crel('div', 'hexrow');
    const hex = Q.crel('input');
    hex.value = Q.rgbToHex(app().view.color);
    hex.addEventListener('change', function () {
      const rgb = Q.hexToRgb(hex.value);
      if (rgb) applyColor(rgb);
      else hex.value = Q.rgbToHex(app().view.color);
    });
    hexRow.appendChild(hex);
    side.appendChild(hexRow);

    const sw = Q.crel('div', 'swatches');
    PALETTE.forEach(function (hexv) {
      const b = Q.crel('button');
      b.style.background = hexv;
      b.addEventListener('click', function () {
        const rgb = Q.hexToRgb(hexv);
        if (rgb) applyColor(rgb);
      });
      sw.appendChild(b);
    });
    side.appendChild(sw);

    const recentLabel = Q.crel('div', 'layer-sub', 'Recent');
    side.appendChild(recentLabel);
    const recent = Q.crel('div', 'recent');
    (app().recent || []).slice(0, 12).forEach(function (rgb) {
      const b = Q.crel('button');
      b.style.background = Q.rgbToHex(rgb);
      b.addEventListener('click', function () { applyColor(rgb); });
      recent.appendChild(b);
    });
    side.appendChild(recent);

    wrap.appendChild(side);
    root.appendChild(wrap);

    drawWheel(wheel);
    attachWheel(wheel);

    function applyColor(rgb) {
      app().setColor(rgb);
      hex.value = Q.rgbToHex(rgb);
      const h = Q.rgbToHsv(rgb[0], rgb[1], rgb[2]);
      wheelState.hue = h[0]; wheelState.sat = h[1]; wheelState.val = h[2];
      drawWheel(wheel);
    }
  }

  function drawWheel(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const css = canvas.getBoundingClientRect().width || 190;
    canvas.width = Math.round(css * dpr);
    canvas.height = Math.round(css * dpr);
    const c = canvas.getContext('2d');
    const S = canvas.width, mid = S / 2, R = mid - 2;
    c.clearRect(0, 0, S, S);

    const ring = R * 0.16;
    for (let a = 0; a < 360; a += 2) {
      const a0 = (a - 1.2) * Math.PI / 180, a1 = (a + 1.2) * Math.PI / 180;
      c.beginPath();
      c.arc(mid, mid, R - ring / 2, a0, a1);
      c.lineWidth = ring;
      c.strokeStyle = 'hsl(' + a + ',85%,55%)';
      c.stroke();
    }

    const inner = R - ring - 3;
    const sq = inner * 0.92;
    const x0 = mid - sq / 2, y0 = mid - sq / 2;
    const hueRgb = Q.hsvToRgb(wheelState.hue, 1, 1);
    c.fillStyle = Q.rgbToHex(hueRgb);
    c.fillRect(x0, y0, sq, sq);

    const gw = c.createLinearGradient(x0, 0, x0 + sq, 0);
    gw.addColorStop(0, 'rgba(255,255,255,1)');
    gw.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gw;
    c.fillRect(x0, y0, sq, sq);

    const gb = c.createLinearGradient(0, y0, 0, y0 + sq);
    gb.addColorStop(0, 'rgba(0,0,0,0)');
    gb.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = gb;
    c.fillRect(x0, y0, sq, sq);

    // hue marker
    const ha = wheelState.hue * Math.PI / 180;
    const hx = mid + Math.cos(ha) * (R - ring / 2);
    const hy = mid + Math.sin(ha) * (R - ring / 2);
    c.beginPath(); c.arc(hx, hy, ring * 0.55, 0, Math.PI * 2);
    c.strokeStyle = '#fff'; c.lineWidth = Math.max(1.5, S * 0.012); c.stroke();
    c.beginPath(); c.arc(hx, hy, ring * 0.55, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = Math.max(0.6, S * 0.004); c.stroke();

    // sv marker
    const mx = x0 + wheelState.sat * sq;
    const my = y0 + (1 - wheelState.val) * sq;
    c.beginPath(); c.arc(mx, my, Math.max(5, S * 0.026), 0, Math.PI * 2);
    c.strokeStyle = '#fff'; c.lineWidth = Math.max(1.6, S * 0.012); c.stroke();
    c.beginPath(); c.arc(mx, my, Math.max(5, S * 0.026), 0, Math.PI * 2);
    c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 1; c.stroke();
  }

  function attachWheel(canvas) {
    let mode = null;
    const pick = function (e) {
      const r = canvas.getBoundingClientRect();
      const S = Math.min(r.width, r.height);
      const mid = S / 2;
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      const dist = Math.sqrt(x * x + y * y);
      const R = mid - 2;
      const ring = R * 0.16;
      const inner = R - ring - 3;
      const sq = inner * 0.92;

      if (!mode) mode = dist > inner + 2 ? 'hue' : 'sv';

      if (mode === 'hue') {
        let a = Math.atan2(y, x) * 180 / Math.PI;
        if (a < 0) a += 360;
        wheelState.hue = a;
      } else {
        const x0 = -sq / 2, y0 = -sq / 2;
        wheelState.sat = Q.clamp((x - x0) / sq, 0, 1);
        wheelState.val = 1 - Q.clamp((y - y0) / sq, 0, 1);
      }
      const rgb = Q.hsvToRgb(wheelState.hue, wheelState.sat, wheelState.val);
      app().setColor(rgb);
      const hexInput = Q.el('#trayBody .hexrow input');
      if (hexInput) hexInput.value = Q.rgbToHex(rgb);
      drawWheel(canvas);
    };

    canvas.addEventListener('pointerdown', function (e) {
      canvas.setPointerCapture(e.pointerId);
      pick(e);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) pick(e);
    });
    canvas.addEventListener('pointerup', function () { mode = null; });
    canvas.addEventListener('pointercancel', function () { mode = null; });
  }

  /* ── menu ───────────────────────────────────────────────── */

  function buildMenu(root) {
    const d = app().doc;
    root.appendChild(trayHead('Actions', []));
    function item(label, ico, fn) {
      const b=Q.crel('button','menu-item'); b.innerHTML=icon(ico);
      b.appendChild(document.createTextNode(label)); b.addEventListener('click',fn); return b;
    }
    function group(title, items) {
      const section=Q.crel('details','action-group'); section.open=title==='Create & edit';
      const heading=Q.crel('summary','action-heading'); heading.innerHTML=icon(items[0][1]); heading.appendChild(document.createTextNode(title)); section.appendChild(heading);
      const grid=Q.crel('div','menu-grid'); items.forEach(x=>grid.appendChild(item(x[0],x[1],x[2]))); section.appendChild(grid); root.appendChild(section);
    }
    group('Create & edit', [
      ['New canvas',ICON.plus,()=>UI.newCanvasDialog()], ['Import image as layer',ICON.photo,()=>UI.pickImage()], ['Effects',ICON.sparkle,()=>UI.effectsDialog()],
      ['Selection & transform',ICON.copy,()=>UI.selectionDialog()], ['Fill settings',ICON.sparkle,()=>UI.fillSettings()]
    ]);
    group('Canvas & view', [
      ['Canvas background',ICON.sparkle,()=>UI.backgroundDialog()], ['Drawing guides',ICON.sparkle,()=>UI.guideDialog()],
      ['Canvas reference',ICON.photo,()=>{UI.closeTray(); UI.openReference();}], ['Flip canvas',ICON.flip,()=>app().flipCanvas()],
      ['Rotate 90°',ICON.reset,()=>app().view.rotateBy(90)], ['Zoom to fit',ICON.layers,()=>app().view.fit()]
    ]);
    const animation=[['Add frame',ICON.film,()=>app().addFrame(true)], ['Animation timeline',ICON.film,()=>{UI.closeTray(); if (!timelineOpen) UI.toggleTimeline();}],
      ['Onion skin',ICON.sparkle,()=>{if (!d) return; d.onion=!d.onion; app().view.dirty=true; app().markDirty(); Q.toast(d.onion ? 'Onion skin on' : 'Onion skin off'); root.innerHTML=''; buildMenu(root);}]];
    if (d && d.frames.length>1) animation.push(['Delete frame',ICON.trash,()=>app().deleteFrame()]);
    group('Animation',animation);
    group('Export', [
      ['Export PNG',ICON.photo,()=>app().exportPng()], ['Transparent PNG',ICON.photo,()=>app().exportPng(true)],
      ['Export GIF',ICON.film,()=>UI.exportDialog()], ['Export PNG frames',ICON.photo,()=>{UI.closeTray(); app().exportPngSequence();}],
      ['Transparent PNG frames',ICON.photo,()=>{UI.closeTray(); app().exportPngSequence(true);}], ['Export sprite sheet',ICON.photo,()=>UI.spriteSheetDialog()],
      ['Export MP4',ICON.film,()=>{UI.closeTray(); UI.mp4Dialog();}]
    ]);
    group('File & help', [ ['Save now',ICON.save,()=>app().saveNow(true)], ['Gestures & help',ICON.sparkle,()=>UI.helpSheet()], ['About Qalam',ICON.layers,()=>UI.aboutSheet()] ]);

    const info = Q.crel('div', 'layer-sub');
    info.style.margin = '12px 2px 0';
    info.textContent = d ? ('Canvas ' + d.width + '×' + d.height + ' · ' + d.memoryMB() + ' MB · stored on device (' + Q.Store.mode() + ')') : '';
    root.appendChild(info);
  }

  let referenceTimer = 0;
  UI.resizeReference = function () {
    const cv = Q.el('#referenceCanvas'); cv.style.width = (100 * Number(Q.el('#referenceZoom').value) / 100) + '%';
  };
  UI.openReference = function () {
    if (!app().doc) return;
    Q.el('#referenceWindow').classList.remove('hidden'); UI.resizeReference(); UI.refreshReference();
  };
  UI.closeReference = function () { clearTimeout(referenceTimer); Q.el('#referenceWindow').classList.add('hidden'); };
  UI.refreshReference = function () {
    if (Q.el('#referenceWindow').classList.contains('hidden')) return;
    clearTimeout(referenceTimer);
    referenceTimer = setTimeout(function () {
      if (!app().doc || Q.el('#referenceWindow').classList.contains('hidden')) return;
      const thumb = app().doc.thumbnail(app().doc.activeFrame, 260), cv = Q.el('#referenceCanvas');
      cv.width = thumb.width; cv.height = thumb.height; cv.getContext('2d').drawImage(thumb, 0, 0);
    }, 120);
  };


  UI.backgroundDialog = function () {
    const d=app().doc; if (!d) return;
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Canvas background'));
    card.appendChild(Q.crel('p','sub','Changes the background for every frame. Normal PNG, GIF and MP4 include it; transparent PNG exports omit it. Undo restores the previous colour.'));
    const row=Q.crel('div','field'); row.appendChild(Q.crel('label',null,'Hex colour'));
    const input=Q.crel('input','select'); input.type='text'; input.value=d.bg; input.setAttribute('aria-label','Background hex colour'); row.appendChild(input); card.appendChild(row);
    const error=Q.crel('p','canvas-error'); error.setAttribute('role','alert'); card.appendChild(error);
    const actions=Q.crel('div','modal-actions'), current=Q.crel('button','btn ghost','Use brush colour'), apply=Q.crel('button','btn primary','Apply');
    current.addEventListener('click',function () { input.value=Q.rgbToHex(app().view.color); });
    apply.addEventListener('click',function () { const rgb=Q.hexToRgb(input.value); if (!rgb) { error.textContent='Enter a valid 3- or 6-digit hex colour.'; return; } app().setBackground(Q.rgbToHex(rgb)); UI.closeModal(); UI.closeTray(); });
    actions.appendChild(current); actions.appendChild(apply); card.appendChild(actions); UI.openModal(card);
  };

  UI.selectionDialog = function () {
    const v=app().view, d=app().doc; if (!d) return;
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Selection & transform'));
    card.appendChild(Q.crel('p','sub', v.selection ? ((v.selection.points || v.selection.runs) ? (v.selection.runs ? 'Magic wand selected. The dashed box shows bounds, not the exact selected pixels. Transforms require a rectangle.' : 'Lasso selected. Transforms currently require a rectangle.') : 'Rectangle selected. Edits affect the current layer and frame.') : 'No selection. Flips and rotation use the whole current layer and frame.'));
    card.appendChild(Q.crel('p','sub','The selection clips brushes, erasers, flood fill and effects. It is temporary and applies to the current layer and frame.'));
    const actions=Q.crel('div','menu-grid');
    function action(label, fn) { const b=Q.crel('button','menu-item',label); b.addEventListener('click',function () { UI.closeModal(); UI.closeTray(); fn(); }); actions.appendChild(b); }
    action('Draw rectangle',function () {
      v.tool='select'; v.selectionDraft=null; Q.el('#btnFill').classList.remove('on'); Q.el('#btnEyedrop').classList.remove('on');
      Q.hint('Drag on the canvas to select a rectangle',3000);
    });
    action('Draw lasso',function () { v.tool='lasso'; v.selectionDraft=null; Q.el('#btnFill').classList.remove('on'); Q.el('#btnEyedrop').classList.remove('on'); Q.hint('Draw a closed selection around an area',3000); });
    action('Magic wand',function () { v.tool='wand'; v.selectionDraft=null; Q.el('#btnFill').classList.remove('on'); Q.el('#btnEyedrop').classList.remove('on'); Q.hint('Tap connected pixels on the active layer · tolerance in Fill settings',3500); });
    action('Select all',function () { v.selection={x:0,y:0,w:d.width,h:d.height}; v.dirty=true; Q.hint('Entire canvas selected',1600); });
    action('Deselect',function () { v.selection=null; v.selectionDraft=null; if (v.tool === 'select' || v.tool === 'lasso' || v.tool === 'wand') v.tool='brush'; v.dirty=true; });
    action(v.selection && (v.selection.points || v.selection.runs) ? 'Fill selection' : 'Fill rectangle',function () { app().editSelection('fill'); });
    action(v.selection && (v.selection.points || v.selection.runs) ? 'Clear selection' : 'Clear rectangle',function () { app().editSelection('clear'); });
    action('Copy to layer',function () { app().copySelectionToLayer(); });
    action('Flip horizontal',function () { app().editSelection('flipH'); });
    action('Flip vertical',function () { app().editSelection('flipV'); });
    action('Rotate 180°',function () { app().editSelection('rotate180'); });
    action('Move / scale',function () { UI.transformDialog(); });
    card.appendChild(actions);
    const done=Q.crel('button','btn ghost','Close'); done.addEventListener('click',function () { UI.closeModal(); }); card.appendChild(done); UI.openModal(card);
  };

  UI.transformDialog = function () {
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Move / scale'));
    card.appendChild(Q.crel('p','sub','Moves and scales the selected rectangle, or the whole current cel. Pixels outside the canvas are cropped. Values are applied without a live preview.'));
    function field(label, initial) {
      const row=Q.crel('div','field'); row.appendChild(Q.crel('label',null,label));
      const input=Q.crel('input','select'); input.type='number'; input.value=initial; input.setAttribute('aria-label',label); row.appendChild(input); card.appendChild(row); return input;
    }
    const dx=field('Move X (px)',0), dy=field('Move Y (px)',0), scale=field('Scale (%)',100);
    const error=Q.crel('p','canvas-error'); error.setAttribute('role','alert'); card.appendChild(error);
    const actions=Q.crel('div','modal-actions'), cancel=Q.crel('button','btn ghost','Cancel'), apply=Q.crel('button','btn primary','Apply');
    cancel.addEventListener('click',function () { UI.closeModal(); });
    apply.addEventListener('click',function () {
      const x=Number(dx.value), y=Number(dy.value), pct=Number(scale.value), d=app().doc;
      if (!dx.value.trim() || !dy.value.trim() || !scale.value.trim() || !Number.isInteger(x) || !Number.isInteger(y) || Math.abs(x)>d.width*2 || Math.abs(y)>d.height*2 || !Number.isFinite(pct) || pct<25 || pct>400) {
        error.textContent='Use whole-pixel offsets within twice the canvas size and a scale from 25% to 400%.'; return;
      }
      UI.closeModal(); app().moveScaleSelection(x,y,pct/100);
    });
    actions.appendChild(cancel); actions.appendChild(apply); card.appendChild(actions); UI.openModal(card);
  };

  UI.fillSettings = function () {
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Fill settings'));
    card.appendChild(Q.crel('p','sub','Fill and Magic wand use connected pixels on the active layer. Higher tolerance includes similar colours. Drag the top colour swatch onto the canvas to fill.'));
    const row=Q.crel('div','field studio-field'); row.appendChild(Q.crel('label',null,'Tolerance'));
    const slider=Q.crel('input'); slider.type='range'; slider.min=0; slider.max=128; slider.value=app().fillThreshold; slider.setAttribute('aria-label','Fill tolerance');
    const val=Q.crel('div','val',slider.value); slider.addEventListener('input',function () { app().fillThreshold=Number(slider.value); Q.Store.meta('fillThreshold',app().fillThreshold); val.textContent=slider.value; });
    row.appendChild(slider); row.appendChild(val); card.appendChild(row);
    const actions=Q.crel('div','modal-actions'), done=Q.crel('button','btn primary','Done'); done.addEventListener('click',function () { UI.closeModal(); }); actions.appendChild(done); card.appendChild(actions); UI.openModal(card);
  };

  UI.effectsDialog = function () {
    const card = Q.crel('div'); card.appendChild(Q.crel('h2', null, 'Effects'));
    card.appendChild(Q.crel('p', 'sub', 'Applies to the selected layer and current frame. The change can be undone.'));
    card.appendChild(Q.crel('p','sub','Adjust strength to preview the current cel below. The small preview is approximate; Apply processes the original pixels. Thumbnails use an offline sample.'));
    const options=[['blur','Gaussian-like blur'],['motion','Motion blur'],['sharpen','Sharpen'],['bloom','Bloom'],['glitch','Glitch'],['pixelate','Pixelate'],['posterize','Posterize'],['solarize','Solarize'],['grayscale','Grayscale'],['invert','Invert'],['sepia','Sepia'],['brightness','Brightness'],['saturation','Saturation'],['contrast','Contrast'],['hue','Hue shift'],['noise','Noise'],['chromatic','Chromatic shift'],['halftone','Halftone'],['threshold','Threshold']];
    let selected='blur';
    const selectedName=Q.crel('div','effect-selected','Selected: Gaussian-like blur'); card.appendChild(selectedName);
    const grid=Q.crel('div','effects-grid'); grid.setAttribute('role','group'); grid.setAttribute('aria-label','Choose effect');
    options.forEach(function (option) {
      const b=Q.crel('button','effect-card'+(option[0]===selected ? ' on' : '')); b.setAttribute('data-effect',option[0]); b.setAttribute('aria-label',option[1]); b.setAttribute('aria-pressed',option[0]===selected ? 'true' : 'false');
      try { b.appendChild(Q.effectPreviewCanvas(option[0])); } catch(e) { b.appendChild(Q.crel('div','effect-fallback')); }
      b.appendChild(Q.crel('span',null,option[1])); b.addEventListener('click',function () {
        selected=option[0]; selectedName.textContent='Selected: '+option[1]; refreshEffectPreview();
        grid.querySelectorAll('.effect-card').forEach(function (item) { const active=item===b; item.classList.toggle('on',active); item.setAttribute('aria-pressed',active ? 'true' : 'false'); });
      }); grid.appendChild(b);
    }); card.appendChild(grid);
    const preview=Q.canvas(192,192); preview.className='effect-live-preview'; preview.setAttribute('aria-label','Current layer effect preview'); card.appendChild(preview);
    const previewStatus=Q.crel('p','sub',''); card.appendChild(previewStatus);
    const effectDoc=app().doc, effectLayer=effectDoc && effectDoc.layer(), effectCel=effectDoc && effectDoc.activeCel(false), selection=app().view.selection;
    const original=Q.canvas(192,192); let previewReady=false;
    try { if(effectCel) { const factor=Math.min(192/effectDoc.width,192/effectDoc.height); preview.width=original.width=Math.max(1,Math.round(effectDoc.width*factor)); preview.height=original.height=Math.max(1,Math.round(effectDoc.height*factor)); original.getContext('2d').drawImage(effectCel,0,0,original.width,original.height); previewReady=true; } else previewStatus.textContent='Draw on this layer to preview an effect.'; } catch(e) { previewStatus.textContent='Preview is unavailable on this device.'; }
    function refreshEffectPreview() {
      if(!previewReady) return;
      try {
        const context=preview.getContext('2d'), scratch=Q.canvas(preview.width,preview.height), sc=scratch.getContext('2d'); sc.drawImage(original,0,0);
        const image=sc.getImageData(0,0,scratch.width,scratch.height), alpha=effectLayer.alphaLocked ? new Uint8Array(scratch.width*scratch.height) : null;
        if(alpha) for(let i=0;i<alpha.length;i++) alpha[i]=image.data[i*4+3];
        Q.applyPixelEffect(image,selected,Number(amount.value)/100);
        if(alpha) for(let i=0;i<alpha.length;i++) image.data[i*4+3]=alpha[i]; sc.putImageData(image,0,0);
        context.clearRect(0,0,preview.width,preview.height); context.drawImage(original,0,0);
        context.save(); if(selection) { context.scale(preview.width/effectDoc.width,preview.height/effectDoc.height); Q.selectionPath(context,selection); context.clip(); context.setTransform(1,0,0,1,0,0); } context.clearRect(0,0,preview.width,preview.height); context.drawImage(scratch,0,0); context.restore();
        previewStatus.textContent='Approximate preview of this cel; blur radius is shown at preview scale.';
      } catch(e) { previewStatus.textContent='Preview is unavailable on this device.'; }
    }
    const amountRow=Q.crel('div','field studio-field'); amountRow.appendChild(Q.crel('label',null,'Strength'));
    const amount=Q.crel('input'); amount.type='range'; amount.min=0; amount.max=100; amount.value=50; amount.setAttribute('aria-label','Effect strength');
    const value=Q.crel('div','val','50%'); amount.addEventListener('input',function () { value.textContent=amount.value+'%'; refreshEffectPreview(); });
    amountRow.appendChild(amount); amountRow.appendChild(value); card.appendChild(amountRow); refreshEffectPreview();
    const actions=Q.crel('div','modal-actions'), cancel=Q.crel('button','btn ghost','Cancel'), apply=Q.crel('button','btn primary','Apply');
    cancel.addEventListener('click',function () { UI.closeModal(); });
    apply.addEventListener('click',function () { UI.closeModal(); UI.closeTray(); app().applyEffect(selected,Number(amount.value)/100); });
    actions.appendChild(cancel); actions.appendChild(apply); card.appendChild(actions); UI.openModal(card);
  };

  UI.guideDialog = function () {
    const d = app().doc, card = Q.crel('div');
    if (!d) return;
    card.appendChild(Q.crel('h2', null, 'Drawing guides'));
    card.appendChild(Q.crel('p', 'sub', 'Guides appear on the canvas only. Symmetry assist mirrors strokes on the selected layer.'));
    function selectField(label, values, current, onChange) {
      const row = Q.crel('div', 'field studio-field'); row.appendChild(Q.crel('label', null, label));
      const select = Q.crel('select'); select.setAttribute('aria-label', label);
      values.forEach(function (v) { const option = Q.crel('option'); option.value = v[0]; option.textContent = v[1]; select.appendChild(option); });
      select.value = current; select.addEventListener('change', function () { onChange(select.value); app().view.dirty = true; app().markDirty(); });
      row.appendChild(select); card.appendChild(row);
    }
    selectField('Guide', [['off','Off'],['grid','2D grid'],['isometric','Isometric'],['perspective1','1-point perspective'],['perspective2','2-point perspective'],['perspective3','3-point perspective'],['symmetry','Symmetry']], d.guide.type, function (value) { d.guide.type = value; });
    selectField('Symmetry', [['off','Off'],['vertical','Vertical'],['horizontal','Horizontal'],['quadrant','Quadrant'],['radial','Radial (8-fold)']], d.guide.symmetry, function (value) { d.guide.symmetry = value; if (value !== 'off') { d.guide.type = 'symmetry'; card.querySelector('select[aria-label="Guide"]').value = 'symmetry'; } });
    selectField('Layer assist', [['off','Off'],['on','On — selected layer']], d.layer().assisted ? 'on' : 'off', function (value) { d.setLayerProp(d.activeLayer,'assisted',value === 'on'); });
    const row = Q.crel('div', 'field studio-field'); row.appendChild(Q.crel('label', null, 'Grid spacing'));
    const range = Q.crel('input'); range.type='range'; range.min='32'; range.max='500'; range.value=d.guide.spacing; range.setAttribute('aria-label','Grid spacing');
    const val = Q.crel('div','val',String(range.value)); range.addEventListener('input', function () { d.guide.spacing=Number(range.value); val.textContent=range.value; app().view.dirty=true; app().markDirty(); });
    row.appendChild(range); row.appendChild(val); card.appendChild(row);
    [['Horizon','horizon',20,80],['Point spread','spread',20,100]].forEach(function (field) {
      const r=Q.crel('div','field studio-field'); r.appendChild(Q.crel('label',null,field[0]));
      const input=Q.crel('input'); input.type='range'; input.min=field[2]; input.max=field[3]; input.value=Math.round((d.guide[field[1]] == null ? 0.5 : d.guide[field[1]])*100); input.setAttribute('aria-label',field[0]);
      const value=Q.crel('div','val',input.value+'%'); input.addEventListener('input',function () { d.guide[field[1]]=Number(input.value)/100; value.textContent=input.value+'%'; app().view.dirty=true; app().markDirty(); });
      r.appendChild(input); r.appendChild(value); card.appendChild(r);
    });
    const actions=Q.crel('div','modal-actions'), done=Q.crel('button','btn primary','Done');
    done.addEventListener('click',function () { UI.closeModal(); UI.closeTray(); }); actions.appendChild(done); card.appendChild(actions); UI.openModal(card);
  };

  UI.animationSettings = function () {
    app().stopPlay();
    const d = app().doc, card = Q.crel('div'); if (!d) return;
    card.appendChild(Q.crel('h2', null, 'Animation settings'));
    card.appendChild(Q.crel('p', 'sub', 'Playback and onion skin settings for this artwork.'));
    function slider(label,key,min,max,mult) {
      const row=Q.crel('div','field studio-field'); row.appendChild(Q.crel('label',null,label));
      const input=Q.crel('input'); input.type='range'; input.min=min; input.max=max; input.value=Math.round(d[key]*mult); input.setAttribute('aria-label',label);
      const value=Q.crel('div','val',String(input.value)); input.addEventListener('input',function () { d[key]=Number(input.value)/mult; value.textContent=input.value; app().view.dirty=true; app().markDirty(); });
      row.appendChild(input); row.appendChild(value); card.appendChild(row);
    }
    slider('FPS','fps',1,30,1); slider('Onion opacity','onionAlpha',0,100,100); slider('Previous frames','onionPrevFrames',0,4,1); slider('Next frames','onionNextFrames',0,4,1);
    [['Previous colour','onionPrevColor'], ['Next colour','onionNextColor']].forEach(function (entry) {
      const row=Q.crel('div','field studio-field'); row.appendChild(Q.crel('label',null,entry[0]));
      const color=Q.crel('input'); color.type='color'; color.value=d[entry[1]]; color.setAttribute('aria-label',entry[0]);
      color.addEventListener('input',function () { d[entry[1]]=color.value; app().view.dirty=true; app().markDirty(); }); row.appendChild(color); card.appendChild(row);
    });
    function onionOption(label,key,choices) {
      const row=Q.crel('div','field studio-field'); row.appendChild(Q.crel('label',null,label)); const select=Q.crel('select'); select.setAttribute('aria-label',label);
      choices.forEach(function (v) { const option=Q.crel('option'); option.value=v[0]; option.textContent=v[1]; select.appendChild(option); });
      select.value=d[key] ? 'yes' : 'no'; select.addEventListener('change',function () { d[key]=select.value === 'yes'; app().view.dirty=true; app().markDirty(); }); row.appendChild(select); card.appendChild(row);
    }
    onionOption('Skipped onions','onionIncludeSkipped',[['no','Hide skipped frames'],['yes','Show skipped frames']]);
    onionOption('Onion layers','onionLayerOnly',[['no','All visible layers'],['yes','Active layer only']]);
    onionOption('Onion colours','onionOriginalColor',[['no','Tinted'],['yes','Original colours']]);
    onionOption('Onion position','onionAbove',[['no','Below artwork'],['yes','Above artwork']]);
    const row=Q.crel('div','field studio-field'); row.appendChild(Q.crel('label',null,'Playback'));
    const select=Q.crel('select'); select.setAttribute('aria-label','Playback');
    [['loop','Loop'],['pingpong','Ping-pong'],['once','One-shot']].forEach(function (v) { const o=Q.crel('option'); o.value=v[0]; o.textContent=v[1]; select.appendChild(o); });
    select.value=d.playMode; select.addEventListener('change',function () { d.playMode=select.value; app().markDirty(); }); row.appendChild(select); card.appendChild(row);
    const bounds=Q.playbackBounds(d);
    const rangeInfo=Q.crel('p','sub','Preview, GIF and MP4 use this range and omit skipped frames. PNG frames and sprite sheets export all source frames.'); card.appendChild(rangeInfo);
    const rangeFields=Q.crel('div','canvas-dimensions');
    function rangeField(label,initial) { const wrap=Q.crel('label'); wrap.textContent=label; const input=Q.crel('input','select'); input.type='number'; input.min=1; input.max=d.frames.length; input.value=initial; input.setAttribute('aria-label',label); wrap.appendChild(input); rangeFields.appendChild(wrap); return input; }
    const start=rangeField('Playback start',bounds.start+1), end=rangeField('Playback end',bounds.end+1); card.appendChild(rangeFields);
    const rangeError=Q.crel('p','canvas-error'); rangeError.setAttribute('role','alert'); card.appendChild(rangeError);
    const rangeActions=Q.crel('div','modal-actions'), setRange=Q.crel('button','btn ghost','Set range'), all=Q.crel('button','btn ghost','All frames');
    setRange.addEventListener('click',function () {
      if (!start.value.trim() || !end.value.trim() || !d.setPlayRange(Number(start.value)-1,Number(end.value)-1)) { rangeError.textContent='Enter a valid start and end within the timeline.'; return; }
      rangeError.textContent=''; app().markDirty(); Q.toast('Playback range saved'); UI.refreshTimeline();
    });
    all.addEventListener('click',function () { d.setPlayRange(null,null); start.value=1; end.value=d.frames.length; rangeError.textContent=''; app().markDirty(); UI.refreshTimeline(); Q.toast('Using all frames'); });
    rangeActions.appendChild(setRange); rangeActions.appendChild(all); card.appendChild(rangeActions);
    const actions=Q.crel('div','modal-actions'), done=Q.crel('button','btn primary','Done'); done.addEventListener('click',function () { UI.closeModal(); UI.refreshTimeline(); }); actions.appendChild(done); card.appendChild(actions); UI.openModal(card);
  };

  /* ── animation timeline ─────────────────────────────────── */

  UI.toggleTimeline = function () {
    const el = Q.el('#timeline');
    timelineOpen = !timelineOpen;
    el.classList.toggle('hidden', !timelineOpen);
    Q.el('#btnTimeline').classList.toggle('on', timelineOpen);
    if (timelineOpen) buildTimeline();
  };

  function buildTimeline() {
    const d = app().doc;
    const el = Q.el('#timeline');
    if (!d) return;
    el.classList.remove('hidden');
    el.innerHTML = '';

    const head=Q.crel('div','tl-head'), categories=Q.crel('div','tl-categories'), more=Q.crel('div','tl-more');
    head.appendChild(Q.crel('div','tl-title','Animation · '+d.frames.length+' frames'));
    const fps=chip(d.fps+' fps',false,function () { d.fps=d.fps>=30 ? 6 : d.fps+2; app().markDirty(true); buildTimeline(); },null); fps.setAttribute('aria-label','Cycle frames per second, current '+d.fps); fps.title='Cycle frames per second'; head.appendChild(fps);
    head.appendChild(iconButton(app().playing ? 'Stop playback' : 'Play animation',app().playing ? ICON.pause : ICON.play,function () { app().togglePlay(); }));
    head.appendChild(iconButton('Duplicate frame',ICON.plus,function () { app().addFrame(true); }));
    [['frames','Frame tools',ICON.film],['settings','Animation settings tools',ICON.controls],['assist','Animation guides and audio',ICON.motion]].forEach(function (entry) {
      const selected=timelineCategory===entry[0], button=iconButton(entry[1],entry[2],function () { timelineCategory=entry[0]; buildTimeline(); },selected);
      button.setAttribute('aria-pressed',selected ? 'true' : 'false'); categories.appendChild(button);
    });
    function tool(label,ico,fn,on) { const button=iconButton(label,ico,fn,on); if (typeof on==='boolean') button.setAttribute('aria-pressed',on ? 'true' : 'false'); more.appendChild(button); }
    if (timelineCategory==='frames') {
      tool('Frame options',ICON.frameOptions,function () { UI.frameSheet(d.activeFrame); });
      tool('Batch frames',ICON.batch,function () { UI.batchFramesDialog(); });
      tool('Copy cel',ICON.copy,function () { UI.copyCelDialog(); });
      tool('Blank frame',ICON.blankFrame,function () { app().addFrame(false); });
      tool('Previous frame',ICON.previous,function () { app().selectFrame(Math.max(0,d.activeFrame-1)); });
      tool('Next frame',ICON.next,function () { app().selectFrame(Math.min(d.frames.length-1,d.activeFrame+1)); });
    } else if (timelineCategory==='settings') {
      tool('Animation settings',ICON.controls,function () { UI.animationSettings(); });
      tool('Toggle onion skin',ICON.onion,function () { d.onion=!d.onion; app().view.dirty=true; app().markDirty(true); buildTimeline(); },d.onion);
    } else {
      tool('Motion guide',ICON.motion,function () { UI.motionGuideDialog(); });
      tool('Camera keyframes',ICON.camera,function () { UI.cameraDialog(); },d.cameraEnabled && d.cameraKeys.length>0);
      tool('Layer keyframes',ICON.layerMotion,function () { UI.layerMotionDialog(); },!!d.layer().motionEnabled && (d.layer().motionKeys || []).length>0);
      tool('Two-bone IK',ICON.rig,function () { UI.twoBoneIKDialog(); });
      tool('Generate particles',ICON.particles,function () { UI.particleDialog(); });
      tool('Generate transform frames',ICON.tween,function () { UI.transformBakeDialog(); });
      tool('Manage audio',ICON.audio,function () { UI.audioDialog(); });
    }
    el.appendChild(head); el.appendChild(categories); el.appendChild(more);
    const track=Q.crel('button','tl-audio',d.audioTrack ? ('Audio · '+d.audioTrack.name+(d.audioTrack.muted ? ' · muted' : '')) : 'Audio · Add track');
    track.setAttribute('aria-label','Manage animation audio'); track.addEventListener('click',function () { UI.audioDialog(); }); el.appendChild(track);

    const strip = Q.crel('div', 'tl-frames'), bounds=Q.playbackBounds(d);
    d.frames.forEach(function (fr, i) {
      const outside=i<bounds.start || i>bounds.end;
      const b = Q.crel('button', 'tl-frame' + (i === d.activeFrame ? ' on' : '') + (outside ? ' out-range' : '') + (fr.skipped ? ' skipped' : ''));
      const cv = d.thumbnail(i, 112);
      const small = Q.canvas(72, 72 * (d.height / d.width));
      small.getContext('2d').drawImage(cv, 0, 0, small.width, small.height);
      b.appendChild(small);
      b.appendChild(Q.crel('span', 'n', String(i + 1) + ((fr.duration || 1) > 1 ? ' · ' + fr.duration + '×' : '')));
      if (fr.skipped) { const badge=Q.crel('span','frame-skipped','Skipped'); b.appendChild(badge); }
      const cameraKey=d.cameraKeys.some(k=>k.frame===i); if (cameraKey) { const badge=Q.crel('span','camera-badge','Camera key'); b.appendChild(badge); }
      const layerKey=(d.layer().motionKeys || []).some(k=>k.frame===i); if (layerKey) b.appendChild(Q.crel('span','layer-motion-badge','Layer key'));
      if (fr.group) { const tag = Q.crel('span', 'frame-group'); tag.textContent = fr.group; b.appendChild(tag); }
      b.setAttribute('aria-label', 'Frame ' + (i + 1) + (fr.group ? ', group ' + fr.group : '') + (outside ? ', outside playback range' : '') + (fr.skipped ? ', skipped in playback' : '') + (cameraKey ? ', camera keyframe' : '') + (layerKey ? ', selected layer keyframe' : ''));
      b.addEventListener('click', function () { app().selectFrame(i); });
      b.addEventListener('dblclick', function () { UI.frameSheet(i); });
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); UI.frameSheet(i); });
      strip.appendChild(b);
    });

    const add = Q.crel('button', 'tl-add', icon(ICON.plus)); add.setAttribute('aria-label','Duplicate frame');
    add.addEventListener('click', function () { app().addFrame(true); });
    strip.appendChild(add);
    el.appendChild(strip);
    const scrubRow=Q.crel('div','tl-scrub'), readout=Q.crel('span','tl-position',String(d.activeFrame+1)+' / '+d.frames.length);
    const scrub=Q.crel('input'); scrub.type='range'; scrub.min=1; scrub.max=d.frames.length; scrub.step=1; scrub.value=d.activeFrame+1; scrub.disabled=app().playing; scrub.setAttribute('aria-label','Scrub frames');
    scrub.addEventListener('input',function () { d.activeFrame=Q.clamp(Number(scrub.value)-1,0,d.frames.length-1); app().view.dirty=true; UI.highlightFrame(d.activeFrame); UI.refreshReference(); });
    scrub.addEventListener('change',function () { app().selectFrame(Number(scrub.value)-1); });
    scrubRow.appendChild(scrub); scrubRow.appendChild(readout); el.appendChild(scrubRow);
    const stats=Q.playbackStats(d), timing=Q.crel('div','tl-timing',stats.frames ? stats.frames+' included · '+stats.ticks+' ticks · '+stats.seconds.toFixed(2)+' s estimated per cycle' : 'No included frames in playback range');
    timing.setAttribute('aria-label','Playback timing'); el.appendChild(timing);
  }

  UI.highlightFrame = function (i) {
    Q.els('#timeline .tl-frame').forEach(function (b, index) { b.classList.toggle('on', index === i); });
    const input=Q.el('#timeline input[aria-label="Scrub frames"]'), readout=Q.el('#timeline .tl-position');
    if (input) input.value=i+1; if (readout && app().doc) readout.textContent=(i+1)+' / '+app().doc.frames.length;
  };

  UI.frameSheet = function (i) {
    app().stopPlay();
    const card = Q.crel('div');
    card.appendChild(Q.crel('h2', null, 'Frame ' + (i + 1)));
    card.appendChild(Q.crel('p', 'sub', 'Frames are duplicated when added so you can build on the previous drawing.'));
    const row = Q.crel('div', 'field studio-field'); row.appendChild(Q.crel('label', null, 'Frame hold'));
    const duration = Q.crel('input'); duration.type='range'; duration.min=1; duration.max=60; duration.value=app().doc.frames[i].duration || 1; duration.setAttribute('aria-label','Frame hold');
    const val = Q.crel('div','val',duration.value + '×');
    duration.addEventListener('input', function () { val.textContent=duration.value + '×'; });
    duration.addEventListener('change', function () { app().doc.setFrameDuration(i,Number(duration.value)); app().markDirty(); UI.refreshTimeline(); });
    row.appendChild(duration); row.appendChild(val); card.appendChild(row);
    const groupRow = Q.crel('div', 'field studio-field'); groupRow.appendChild(Q.crel('label', null, 'Group label'));
    const group = Q.crel('input'); group.className = 'select'; group.type = 'text'; group.maxLength = 32; group.value = app().doc.frames[i].group || ''; group.placeholder = 'Optional scene name'; group.setAttribute('aria-label', 'Group label');
    groupRow.appendChild(group); card.appendChild(groupRow);
    const saveGroup = Q.crel('button', 'btn', 'Save group label');
    saveGroup.addEventListener('click', function () { app().doc.setFrameGroup(i, group.value); app().markDirty(); UI.refreshTimeline(); Q.toast('Frame label saved'); });
    card.appendChild(saveGroup);
    const grid = Q.crel('div', 'menu-grid');
    const mk = function (label, ico, fn) {
      const b = Q.crel('button', 'menu-item');
      b.innerHTML = icon(ico);
      b.appendChild(document.createTextNode(label));
      b.addEventListener('click', function () { UI.closeModal(); fn(); });
      return b;
    };
    grid.appendChild(mk(app().doc.frames[i].skipped ? 'Include in playback' : 'Skip in playback', ICON.sparkle, function () { const d=app().doc; d.setFrameSkipped(i,!d.frames[i].skipped); app().view.dirty=true; app().markDirty(); UI.syncDoc(); }));
    grid.appendChild(mk('Duplicate', ICON.copy, function () { app().selectFrame(i); app().addFrame(true); }));
    grid.appendChild(mk('Blank frame', ICON.plus, function () { app().selectFrame(i); app().addFrame(false); }));
    grid.appendChild(mk('Move left', ICON.up, function () { app().moveFrame(i, -1); }));
    grid.appendChild(mk('Move right', ICON.down, function () { app().moveFrame(i, 1); }));
    grid.appendChild(mk('Delete', ICON.trash, function () { app().deleteFrame(i); }));
    card.appendChild(grid);
    UI.openModal(card);
  };

  UI.batchFramesDialog = function () {
    app().stopPlay(); const d=app().doc; if (!d) return;
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Batch frames'));
    card.appendChild(Q.crel('p','sub','Apply to an inclusive range of frame numbers. Each operation is one undo step. Labels are tags, not nested groups. Duplicates are inserted after the range.'));
    function field(label,value,type) { const row=Q.crel('div','field'); row.appendChild(Q.crel('label',null,label)); const input=Q.crel('input','select'); input.type=type || 'number'; input.value=value; input.setAttribute('aria-label',label); row.appendChild(input); card.appendChild(row); return input; }
    const start=field('First frame',1), end=field('Last frame',d.frames.length), hold=field('Batch hold',1), label=field('Batch label','','text'); label.maxLength=32;
    const error=Q.crel('p','canvas-error'); error.setAttribute('role','alert'); card.appendChild(error);
    const grid=Q.crel('div','menu-grid');
    function action(text,op) { const b=Q.crel('button','menu-item',text); b.addEventListener('click',function () {
      const first=Number(start.value), last=Number(end.value), ticks=Number(hold.value);
      if (!start.value.trim() || !end.value.trim() || !Number.isInteger(first) || !Number.isInteger(last) || first<1 || last<first || last>d.frames.length) { error.textContent='Enter a valid inclusive frame range.'; return; }
      if (op==='hold' && (!hold.value.trim() || !Number.isInteger(ticks) || ticks<1 || ticks>60)) { error.textContent='Hold must be a whole number from 1 to 60.'; return; }
      if (op==='duplicate' && d.frames.length+(last-first+1)>60) { error.textContent='Duplicating this range exceeds the 60-frame limit.'; return; }
      if (app().batchFrames(first-1,last-1,op,op==='label' ? label.value : ticks)) UI.closeModal();
    }); grid.appendChild(b); }
    action('Apply label','label'); action('Apply hold','hold'); action('Skip range','skip'); action('Include range','include'); action('Reverse range','reverse'); action('Duplicate range','duplicate'); card.appendChild(grid);
    const del=Q.crel('button','btn danger','Delete range'); del.addEventListener('click',function () {
      const first=Number(start.value), last=Number(end.value);
      if (!start.value.trim() || !end.value.trim() || !Number.isInteger(first) || !Number.isInteger(last) || first<1 || last<first || last>d.frames.length || last-first+1>=d.frames.length) { error.textContent='Choose a valid range that leaves at least one frame.'; return; }
      UI.confirm('Delete frames '+first+'–'+last+'?', 'This removes all layers in these frames. You can undo this action.', function () { app().deleteFrameRange(first-1,last-1); });
    }); card.appendChild(del);
    const close=Q.crel('button','btn ghost','Close'); close.addEventListener('click',function () { UI.closeModal(); }); card.appendChild(close); UI.openModal(card);
  };

  UI.mp4Dialog = function () {
    const d=app().doc; if (!d) return; app().stopPlay();
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Export MP4'));
    card.appendChild(Q.crel('p','sub','Records one animation cycle in real time, using playback range, frame holds and skipped frames. Keep the app open during export. MP4 support depends on the Android WebView.'));
    card.appendChild(Q.crel('p','sub','With audio: uses the unmuted project track, beginning at the playback range’s timeline offset. Requires forward playback and AAC-in-MP4 recording support; audio exports are limited to 120 seconds. Sync may drift and audio ends when the file ends. The app checks for video and audio tracks before saving, but cannot confirm audible sound. Verify the saved file on your device.'));
    const actions=Q.crel('div','menu-grid');
    function action(label,fn) { const b=Q.crel('button','menu-item',label); b.addEventListener('click',function () { UI.closeModal(); fn(); }); actions.appendChild(b); }
    action('Export silent MP4',function () { app().exportMp4(); });
    action('Export MP4 with audio',function () { app().exportMp4WithAudio(); });
    card.appendChild(actions); const close=Q.crel('button','btn ghost','Cancel'); close.addEventListener('click',function () { UI.closeModal(); }); card.appendChild(close); UI.openModal(card);
  };

  UI.audioDialog = function () {
    app().stopPlay(); const d=app().doc; if (!d) return;
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Animation audio'));
    card.appendChild(Q.crel('p','sub',d.audioTrack ? 'Track: '+d.audioTrack.name+(d.audioTrack.muted ? ' (muted)' : '') : 'No audio track added.'));
    card.appendChild(Q.crel('p','sub','Choose one MP3, M4A, WAV, OGG or WebM file up to 2 MiB. Audio begins at the first included frame and is muted during ping-pong preview. Optional MP4 audio export requires AAC-capable MP4 recording and forward playback; PNG and GIF are silent. Playback and format support depend on the device.'));
    const actions=Q.crel('div','menu-grid');
    function action(label,fn) { const b=Q.crel('button','menu-item',label); b.addEventListener('click',fn); actions.appendChild(b); }
    action(d.audioTrack ? 'Replace audio' : 'Choose audio',function () { UI.closeModal(); UI.audioTarget={doc:d,track:d.audioTrack}; Q.el('#audioImport').value=''; Q.el('#audioImport').click(); });
    if (d.audioTrack) {
      action(d.audioTrack.muted ? 'Unmute audio' : 'Mute audio',function () { d.setAudioMuted(!d.audioTrack.muted); app().markDirty(); UI.closeModal(); UI.refreshTimeline(); });
      action('Remove audio',function () { UI.confirm('Remove audio?', 'The audio track can be restored with Undo.',function () { d.setAudioTrack(null); app().markDirty(); UI.refreshTimeline(); }); });
    }
    card.appendChild(actions); const close=Q.crel('button','btn ghost','Close'); close.addEventListener('click',function () { UI.closeModal(); }); card.appendChild(close); UI.openModal(card);
  };

  UI.twoBoneIKDialog = function () {
    app().stopPlay(); const d=app().doc; if (!d) return;
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Two-bone IK keys'));
    card.appendChild(Q.crel('p','sub','Use two separate layers drawn in a common rest pose. Enter the root, joint and tip in canvas pixels, then move the tip between two targets. The solver rotates whole layers rigidly and creates one editable motion key per frame. It does not bend or deform pixels. Blank cels stay blank.'));
    function section(label) { card.appendChild(Q.crel('h3','transform-heading',label)); const box=Q.crel('div','transform-grid'); card.appendChild(box); return box; }
    function numberField(box,label,value,step) { const row=Q.crel('div','transform-field'), text=Q.crel('label',null,label), input=Q.crel('input','select'); input.type='number'; input.step=step || 'any'; input.value=String(Math.round(value*100)/100); input.setAttribute('aria-label',label); row.appendChild(text); row.appendChild(input); box.appendChild(row); return input; }
    function selectField(box,label,items,value) { const row=Q.crel('div','transform-field'), text=Q.crel('label',null,label), input=Q.crel('select'); input.setAttribute('aria-label',label); items.forEach(function (v) { const option=Q.crel('option'); option.value=String(v[0]); option.textContent=v[1]; input.appendChild(option); }); input.value=String(value); row.appendChild(text); row.appendChild(input); box.appendChild(row); return input; }
    const layerBox=section('Bone layers and frames'), layerChoices=d.layers.map((l,i)=>[i,(i+1)+'. '+l.name]);
    const upper=selectField(layerBox,'IK upper layer',layerChoices,d.activeLayer), lower=selectField(layerBox,'IK lower layer',layerChoices,d.activeLayer===0 ? 1 : 0);
    const start=numberField(layerBox,'IK first frame',1,'1'), end=numberField(layerBox,'IK last frame',d.frames.length,'1');
    const bones=section('Rest pose: bone joints on original artwork'), rx=numberField(bones,'IK root X',d.width/2), ry=numberField(bones,'IK root Y',d.height/4), jx=numberField(bones,'IK joint X',d.width/2), jy=numberField(bones,'IK joint Y',d.height/2), tx=numberField(bones,'IK tip X',d.width/2), ty=numberField(bones,'IK tip Y',d.height*3/4);
    const targets=section('Tip target movement'), fx=numberField(targets,'IK start target X',d.width/2), fy=numberField(targets,'IK start target Y',d.height*3/4), ex=numberField(targets,'IK end target X',d.width*0.65), ey=numberField(targets,'IK end target Y',d.height*0.65);
    const bend=selectField(targets,'IK bend side',[[1,'Side A'],[-1,'Side B']],1), easing=selectField(targets,'IK easing',[['linear','Linear'],['in','Ease in'],['out','Ease out'],['inout','Ease in and out']],'linear');
    card.appendChild(Q.crel('p','sub','Targets beyond reach are clamped to the nearest reachable point. Each generated frame replaces any existing keys on both chosen layers in the range and enables those tracks; keys outside the range stay. Holds and skipped frames do not change interpolation. Drawings are not copied, so populate the cels first.'));
    const error=Q.crel('p','canvas-error'); error.setAttribute('role','alert'); card.appendChild(error); const preview=Q.crel('div','ik-preview'); card.appendChild(preview);
    function read() {
      const fields=[start,end,rx,ry,jx,jy,tx,ty,fx,fy,ex,ey];
      if (fields.some(v=>!v.value.trim() || !Number.isFinite(Number(v.value)))) { error.textContent='Enter a number in every IK field.'; return null; }
      const o={upper:Number(upper.value),lower:Number(lower.value),start:Number(start.value)-1,end:Number(end.value)-1,root:{x:Number(rx.value),y:Number(ry.value)},joint:{x:Number(jx.value),y:Number(jy.value)},tip:{x:Number(tx.value),y:Number(ty.value)},from:{x:Number(fx.value),y:Number(fy.value)},to:{x:Number(ex.value),y:Number(ey.value)},bend:Number(bend.value),easing:easing.value};
      const plan=d.planTwoBoneIK(o); if (plan.error) { error.textContent=plan.error; return null; } error.textContent=''; return {options:o,plan:plan};
    }
    function showPreview(value) {
      preview.innerHTML=''; const o=value.options, p=value.plan.endPose, s=192/Math.max(d.width,d.height), cv=Q.canvas(Math.max(1,Math.round(d.width*s)),Math.max(1,Math.round(d.height*s))), c=cv.getContext('2d');
      c.fillStyle='#25252d'; c.fillRect(0,0,cv.width,cv.height); c.save(); c.scale(cv.width/d.width,cv.height/d.height);
      c.lineWidth=Math.max(d.width,d.height)/90; c.strokeStyle='#f0b46a'; c.beginPath(); c.moveTo(o.root.x,o.root.y); c.lineTo(p.elbow.x,p.elbow.y); c.lineTo(p.end.x,p.end.y); c.stroke();
      function dot(point,color) { c.fillStyle=color; c.beginPath(); c.arc(point.x,point.y,Math.max(d.width,d.height)/45,0,Math.PI*2); c.fill(); }
      dot(o.root,'#ffffff'); dot(p.elbow,'#7ddbd1'); dot(p.end,'#f0b46a'); if (p.clamped) dot(p.target,'#ff6f7b'); c.restore();
      cv.className='camera-preview'; cv.setAttribute('aria-label','IK end pose skeleton preview'); preview.appendChild(cv);
      preview.appendChild(Q.crel('p','sub','End pose skeleton only, not the artwork. '+value.plan.clamped+' of '+(o.end-o.start+1)+' target positions are clamped.'));
    }
    const actions=Q.crel('div','modal-actions'), cancel=Q.crel('button','btn ghost','Cancel'), inspect=Q.crel('button','btn ghost','Preview'), review=Q.crel('button','btn primary','Review keys');
    cancel.addEventListener('click',function () { UI.closeModal(); }); inspect.addEventListener('click',function () { const v=read(); if (v) try { showPreview(v); } catch(e) { error.textContent='Could not render the skeleton preview.'; } });
    review.addEventListener('click',function () {
      const v=read(); if (!v) return; try { showPreview(v); } catch(e) { error.textContent='Could not render the skeleton preview.'; return; } const o=v.options, a=d.layers[o.upper], b=d.layers[o.lower], oldA=a.motionKeys, oldB=b.motionKeys, frames=d.frames.slice(o.start,o.end+1);
      UI.confirm('Replace keys on both layers?', 'This creates '+(o.end-o.start+1)+' keys per layer and replaces existing keys in the range. '+v.plan.clamped+' target positions are clamped. Source pixels stay unchanged; undo restores both tracks.',function () {
        if (app().doc!==d || d.layers[o.upper]!==a || d.layers[o.lower]!==b || a.motionKeys!==oldA || b.motionKeys!==oldB || a.locked || b.locked || frames.some((f,i)=>d.frames[o.start+i]!==f)) { Q.toast('IK cancelled because the artwork changed',4000); return; }
        const result=app().applyTwoBoneIK(o); if (result.error) Q.toast(result.error,4000);
      },'Generate');
      const confirmation=document.getElementById('modalBody').firstElementChild; confirmation.insertBefore(preview,confirmation.querySelector('.modal-actions'));
    }); actions.appendChild(cancel); actions.appendChild(inspect); actions.appendChild(review); card.appendChild(actions); UI.openModal(card);
  };

  UI.layerMotionDialog = function () {
    app().stopPlay(); const d=app().doc; if (!d) return;
    const index=d.activeLayer, frame=d.activeFrame, layer=d.layer(), keys=layer.motionKeys || [];
    const existing=keys.find(k=>k.frame===frame), pose=existing || Q.layerMotionPose(layer,frame);
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Layer keyframes · frame '+(frame+1)));
    card.appendChild(Q.crel('p','sub','Layer: '+layer.name+'. Animate its position, scale and rotation without changing its cels. Playback, GIF and MP4 show the motion; editing, PNG and sprite sheets use original pixels. Keys belong to frame positions, not drawings.'));
    card.appendChild(Q.crel('p','sub','Track '+(layer.motionEnabled && keys.length ? 'on' : 'off or empty')+' · '+keys.length+' key'+(keys.length===1?'':'s')+(existing ? ' · this frame has a key' : ' · showing interpolated pose')+(layer.locked ? ' · unlock layer to edit keys' : '')));
    try {
      const s=192/Math.max(d.width,d.height), preview=Q.canvas(Math.max(1,Math.round(d.width*s)),Math.max(1,Math.round(d.height*s))), c=preview.getContext('2d');
      c.fillStyle=d.bg; c.fillRect(0,0,preview.width,preview.height); c.save(); c.scale(preview.width/d.width,preview.height/d.height); d.compositeCamera(c,frame); c.restore();
      preview.className='camera-preview'; preview.setAttribute('aria-label','Saved layer animation preview'); card.appendChild(preview);
      card.appendChild(Q.crel('p','sub','Preview includes all saved layer tracks and the camera, not unsaved field changes.'));
    } catch(e) { card.appendChild(Q.crel('p','sub','Animation preview could not be drawn on this device.')); }
    const grid=Q.crel('div','transform-grid');
    function field(label,value) { const row=Q.crel('div','transform-field'), text=Q.crel('label',null,label), input=Q.crel('input','select'); input.type='number'; input.step='any'; input.value=String(Math.round(value*100)/100); input.setAttribute('aria-label',label); row.appendChild(text); row.appendChild(input); grid.appendChild(row); return input; }
    const x=field('Layer X offset',pose.x), y=field('Layer Y offset',pose.y), scale=field('Layer scale (%)',pose.scale*100), angle=field('Layer rotation (°)',pose.angle); card.appendChild(grid);
    const row=Q.crel('div','field studio-field'); row.appendChild(Q.crel('label',null,'Ease to next')); const easing=Q.crel('select'); easing.setAttribute('aria-label','Layer easing');
    [['linear','Linear'],['in','Ease in'],['out','Ease out'],['inout','Ease in and out']].forEach(function (choice) { const option=Q.crel('option'); option.value=choice[0]; option.textContent=choice[1]; easing.appendChild(option); }); easing.value=pose.easing; row.appendChild(easing); card.appendChild(row);
    card.appendChild(Q.crel('p','sub','Offsets are in canvas pixels; uniform scale 10–400%. Rotation is clockwise around the canvas center, from −1440° to 1440°. The earlier key controls easing. Spacing follows frame numbers, not holds. Pixels outside the canvas are cropped.'));
    const error=Q.crel('p','canvas-error'); error.setAttribute('role','alert'); card.appendChild(error);
    function updated() { app().view.dirty=true; app().markDirty(); UI.syncDoc(); UI.layerMotionDialog(); }
    function editable() { if (d.layer()!==layer || d.activeLayer!==index || app().doc!==d) { error.textContent='Layer changed; reopen the controls.'; return false; } if (layer.locked) { error.textContent='Unlock the layer to edit its keys.'; return false; } return true; }
    const actions=Q.crel('div','menu-grid');
    function button(label,fn) { const b=Q.crel('button','menu-item',label); b.addEventListener('click',fn); actions.appendChild(b); }
    button(existing ? 'Update layer key' : 'Add layer key',function () {
      if (!editable()) return;
      if ([x,y,scale,angle].some(v=>!v.value.trim() || !Number.isFinite(Number(v.value)))) { error.textContent='Enter a number in every layer field.'; return; }
      const key={frame:frame,x:Number(x.value),y:Number(y.value),scale:Number(scale.value)/100,angle:Number(angle.value),easing:easing.value};
      if (!d.setLayerMotionKey(index,key)) { error.textContent='Offsets must be within four canvas sizes, scale 10–400%, rotation −1440° to 1440°; maximum 60 keys.'; return; }
      updated(); Q.toast('Layer key saved · Undo to revert');
    });
    if (existing) button('Remove this layer key',function () { if (editable() && d.removeLayerMotionKey(index,frame)) updated(); });
    if (keys.length) {
      button(layer.motionEnabled ? 'Disable layer motion' : 'Enable layer motion',function () { if (editable() && d.setLayerMotionEnabled(index,!layer.motionEnabled)) updated(); });
      button('Clear all layer keys',function () { if (!editable()) return; UI.confirm('Clear layer keys?', 'All keys for this layer will be removed; undo can restore them.',function () { if (app().doc!==d || d.layer()!==layer || layer.locked) { Q.toast('Layer changed or is locked',4000); return; } if (d.clearLayerMotion(index)) updated(); },'Clear'); });
    }
    card.appendChild(actions);
    if (keys.length) { card.appendChild(Q.crel('h3','transform-heading','Jump to layer key')); const list=Q.crel('div','camera-key-list'); keys.forEach(function (k) { const b=Q.crel('button','chip','Frame '+(k.frame+1)); b.setAttribute('aria-label','Go to layer key frame '+(k.frame+1)); b.addEventListener('click',function () { UI.closeModal(); app().selectFrame(k.frame); UI.layerMotionDialog(); }); list.appendChild(b); }); card.appendChild(list); }
    const close=Q.crel('button','btn ghost','Done'); close.addEventListener('click',function () { UI.closeModal(); }); card.appendChild(close); UI.openModal(card);
  };

  UI.particleDialog = function () {
    app().stopPlay(); const d=app().doc; if (!d) return;
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Generate particle layer'));
    card.appendChild(Q.crel('p','sub','Create a new topmost raster layer across existing frames. Other layers are untouched. Dots follow simple seeded ballistic motion; these are baked cels, not a live particle system. Undo removes the layer.'));
    function section(name) { card.appendChild(Q.crel('h3','transform-heading',name)); const grid=Q.crel('div','transform-grid'); card.appendChild(grid); return grid; }
    function field(grid,label,value,step) { const row=Q.crel('div','transform-field'), text=Q.crel('label',null,label), input=Q.crel('input','select'); input.type='number'; input.step=step || 'any'; input.value=String(value); input.setAttribute('aria-label',label); row.appendChild(text); row.appendChild(input); grid.appendChild(row); return input; }
    function choice(grid,label,choices) { const row=Q.crel('div','transform-field'), text=Q.crel('label',null,label), input=Q.crel('select'); input.setAttribute('aria-label',label); choices.forEach(function (v) { const option=Q.crel('option'); option.value=v[0]; option.textContent=v[1]; input.appendChild(option); }); row.appendChild(text); row.appendChild(input); grid.appendChild(row); return input; }
    const range=section('Frames and emission'), start=field(range,'Particle first frame',1,'1'), end=field(range,'Particle last frame',d.frames.length,'1'), count=field(range,'Particle count',24,'1'), life=field(range,'Particle life (frames)',Math.min(15,d.frames.length),'1');
    const mode=choice(range,'Particle emission',[['burst','Burst at start'],['continuous','Stagger over range']]), seed=field(range,'Particle seed',1,'1');
    const motion=section('Emitter and movement'), x=field(motion,'Emitter X',d.width/2), y=field(motion,'Emitter Y',d.height/2), angle=field(motion,'Direction (degrees)',-90), spread=field(motion,'Spread (degrees)',100), speed=field(motion,'Speed (px per frame)',Math.max(1,Math.round(Math.max(d.width,d.height)/30))), gravity=field(motion,'Gravity (px per frame squared)',0.15);
    const appearance=section('Appearance'), radius=field(appearance,'Particle radius (px)',Math.max(2,Math.min(32,Math.round(Math.max(d.width,d.height)/100)))), opacity=field(appearance,'Particle opacity (%)',100);
    const shape=choice(appearance,'Particle shape',[['circle','Circle'],['square','Square']]), fade=choice(appearance,'Particle fade',[['yes','Fade over life'],['no','Constant opacity']]);
    const colorRow=Q.crel('div','transform-field'), colorLabel=Q.crel('label',null,'Particle hex colour'), color=Q.crel('input','select'); color.type='text'; color.value=Q.rgbToHex(app().view.color); color.setAttribute('aria-label','Particle hex colour'); colorRow.appendChild(colorLabel); colorRow.appendChild(color); appearance.appendChild(colorRow);
    card.appendChild(Q.crel('p','sub','Direction is in degrees: right 0, down 90, up −90. Gravity is positive downward. The seed reproduces the same pattern. Age is measured in frame numbers, not holds or playback time; skipped frames are generated too. Particles outside the canvas are cropped. Selection is ignored. A 64 MiB new-cel limit applies; existing layers and history use additional memory.'));
    const error=Q.crel('p','canvas-error'); error.setAttribute('role','alert'); card.appendChild(error);
    const actions=Q.crel('div','modal-actions'), cancel=Q.crel('button','btn ghost','Cancel'), generate=Q.crel('button','btn primary','Generate layer');
    cancel.addEventListener('click',function () { UI.closeModal(); }); generate.addEventListener('click',function () {
      const inputs=[start,end,count,life,seed,x,y,angle,spread,speed,gravity,radius,opacity];
      if (inputs.some(v=>!v.value.trim() || !Number.isFinite(Number(v.value)))) { error.textContent='Enter a number in every particle field.'; return; }
      const options={start:Number(start.value)-1,end:Number(end.value)-1,count:Number(count.value),life:Number(life.value),mode:mode.value,seed:Number(seed.value),x:Number(x.value),y:Number(y.value),angle:Number(angle.value),spread:Number(spread.value),speed:Number(speed.value),gravity:Number(gravity.value),radius:Number(radius.value),opacity:Number(opacity.value)/100,shape:shape.value,fade:fade.value==='yes',color:color.value};
      const msg=app().generateParticles(options); if (msg) { error.textContent=msg; return; } UI.closeModal();
    }); actions.appendChild(cancel); actions.appendChild(generate); card.appendChild(actions); UI.openModal(card);
  };

  UI.cameraDialog = function () {
    app().stopPlay(); const d=app().doc; if (!d) return;
    const frame=d.activeFrame, existing=d.cameraKeys.find(k=>k.frame===frame), pose=existing || Q.cameraPose(d,frame);
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Camera keyframes · frame '+(frame+1)));
    card.appendChild(Q.crel('p','sub','Add or edit a camera key on the selected frame. The camera is non-destructive: it affects playback, GIF and MP4, but editing and PNG/sprite exports remain uncropped. Keys attach to frame positions, not drawings.'));
    const state=Q.crel('p','sub','Camera '+(d.cameraEnabled && d.cameraKeys.length ? 'on' : 'off or empty')+' · '+d.cameraKeys.length+' key'+(d.cameraKeys.length===1?'':'s')+(existing ? ' · this frame has a key' : ' · showing interpolated pose')); card.appendChild(state);
    try {
      const previewScale=192/Math.max(d.width,d.height), preview=Q.canvas(Math.max(1,Math.round(d.width*previewScale)),Math.max(1,Math.round(d.height*previewScale))), c=preview.getContext('2d');
      c.fillStyle=d.bg; c.fillRect(0,0,preview.width,preview.height); c.save(); c.scale(preview.width/d.width,preview.height/d.height); d.compositeCamera(c,frame); c.restore();
      preview.className='camera-preview'; preview.setAttribute('aria-label','Saved camera preview for current frame'); card.appendChild(preview);
      card.appendChild(Q.crel('p','sub','Preview shows saved settings, not unsaved field changes.'));
    } catch(e) { card.appendChild(Q.crel('p','sub','Camera preview could not be drawn on this device.')); }
    const grid=Q.crel('div','transform-grid');
    function field(label,value) { const row=Q.crel('div','transform-field'), text=Q.crel('label',null,label), input=Q.crel('input','select'); input.type='number'; input.step='any'; input.value=String(Math.round(value*100)/100); input.setAttribute('aria-label',label); row.appendChild(text); row.appendChild(input); grid.appendChild(row); return input; }
    const x=field('Camera center X',pose.x), y=field('Camera center Y',pose.y), zoom=field('Camera zoom (%)',pose.zoom*100), angle=field('Camera rotation (°)',pose.angle); card.appendChild(grid);
    const row=Q.crel('div','field studio-field'); row.appendChild(Q.crel('label',null,'Ease to next')); const easing=Q.crel('select'); easing.setAttribute('aria-label','Camera easing');
    [['linear','Linear'],['in','Ease in'],['out','Ease out'],['inout','Ease in and out']].forEach(function (choice) { const option=Q.crel('option'); option.value=choice[0]; option.textContent=choice[1]; easing.appendChild(option); }); easing.value=pose.easing; row.appendChild(easing); card.appendChild(row);
    card.appendChild(Q.crel('p','sub','Center is in canvas pixels; zoom 25–400%, rotation −1440° to 1440°. Positive rotation turns the camera clockwise, making artwork appear counterclockwise. Between keys, values interpolate by frame number using the earlier key’s easing. Holds and skips do not change interpolation.'));
    const error=Q.crel('p','canvas-error'); error.setAttribute('role','alert'); card.appendChild(error);
    function updated() { app().view.dirty=true; app().markDirty(); UI.refreshTimeline(); UI.cameraDialog(); }
    const actions=Q.crel('div','menu-grid');
    function button(label,fn) { const b=Q.crel('button','menu-item',label); b.addEventListener('click',fn); actions.appendChild(b); }
    button(existing ? 'Update camera key' : 'Add camera key',function () {
      if ([x,y,zoom,angle].some(v=>!v.value.trim() || !Number.isFinite(Number(v.value)))) { error.textContent='Enter a number in every camera field.'; return; }
      const key={frame:frame,x:Number(x.value),y:Number(y.value),zoom:Number(zoom.value)/100,angle:Number(angle.value),easing:easing.value};
      if (!d.setCameraKey(key)) { error.textContent='Center must be on the canvas, zoom 25–400%, rotation −1440° to 1440°; maximum 60 keys.'; return; }
      updated(); Q.toast('Camera key saved · Undo to revert');
    });
    if (existing) button('Remove this camera key',function () { d.removeCameraKey(frame); updated(); });
    if (d.cameraKeys.length) {
      button(d.cameraEnabled ? 'Disable camera' : 'Enable camera',function () { d.setCameraEnabled(!d.cameraEnabled); updated(); });
      button('Clear all camera keys',function () { UI.confirm('Clear camera keys?', 'All camera keys will be removed; undo can restore them.',function () { if (app().doc!==d) return; d.clearCameraKeys(); updated(); },'Clear'); });
    }
    card.appendChild(actions);
    if (d.cameraKeys.length) { const label=Q.crel('h3','transform-heading','Jump to camera key'); card.appendChild(label); const keys=Q.crel('div','camera-key-list'); d.cameraKeys.forEach(function (k) { const b=Q.crel('button','chip','Frame '+(k.frame+1)); b.setAttribute('aria-label','Go to camera key frame '+(k.frame+1)); b.addEventListener('click',function () { UI.closeModal(); app().selectFrame(k.frame); UI.cameraDialog(); }); keys.appendChild(b); }); card.appendChild(keys); }
    const close=Q.crel('button','btn ghost','Done'); close.addEventListener('click',function () { UI.closeModal(); }); card.appendChild(close); UI.openModal(card);
  };

  UI.motionGuideDialog = function () {
    app().stopPlay(); const d=app().doc, v=app().view; if (!d) return;
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Animation motion guide'));
    card.appendChild(Q.crel('p','sub','Draw one saved path as a guide, then optionally generate translated cels along it. The guide itself does not appear in exports.'));
    const actions=Q.crel('div','menu-grid');
    function button(label,fn) { const b=Q.crel('button','menu-item',label); b.addEventListener('click',function () { UI.closeModal(); fn(); }); actions.appendChild(b); }
    button('Draw or replace guide',function () { v.tool='motionGuide'; v.motionDraft=null; Q.el('#btnFill').classList.remove('on'); Q.el('#btnEyedrop').classList.remove('on'); Q.hint('Draw a motion guide on the canvas',3000); });
    button(d.motionGuideVisible ? 'Hide guide' : 'Show guide',function () { d.setMotionGuideVisible(!d.motionGuideVisible); v.dirty=true; app().markDirty(); });
    button('Clear guide',function () { if (d.motionGuide.length) d.setMotionGuide([]); v.dirty=true; app().markDirty(); });
    button('Generate motion along guide',function () { UI.motionBakeDialog(); });
    card.appendChild(actions); const close=Q.crel('button','btn ghost','Close'); close.addEventListener('click',function () { UI.closeModal(); }); card.appendChild(close); UI.openModal(card);
  };

  UI.motionBakeDialog = function () {
    app().stopPlay(); const d=app().doc; if (!d) return;
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Generate path motion'));
    card.appendChild(Q.crel('p','sub','Copies the source cel on the current layer into every frame of the range, translating it along the guide in the selected direction. Existing cels in the range are replaced, including the source if it is in range and skipped frames. Positions use frame numbers, not holds or playback timing. Pixels outside the canvas are cropped. Undo restores all replaced cels.'));
    function field(label,value) { const row=Q.crel('div','field'); row.appendChild(Q.crel('label',null,label)); const input=Q.crel('input','select'); input.type='number'; input.min=1; input.max=d.frames.length; input.value=value; input.setAttribute('aria-label',label); row.appendChild(input); card.appendChild(row); return input; }
    const source=field('Motion source frame',d.activeFrame+1), first=field('Motion first frame',1), last=field('Motion last frame',d.frames.length);
    const row=Q.crel('div','field'); row.appendChild(Q.crel('label',null,'Easing')); const easing=Q.crel('select'); easing.setAttribute('aria-label','Motion easing');
    [['linear','Linear'],['in','Ease in'],['out','Ease out'],['inout','Ease in and out']].forEach(function (choice) { const option=Q.crel('option'); option.value=choice[0]; option.textContent=choice[1]; easing.appendChild(option); }); row.appendChild(easing); card.appendChild(row);
    const directionRow=Q.crel('div','field'); directionRow.appendChild(Q.crel('label',null,'Path direction')); const direction=Q.crel('select'); direction.setAttribute('aria-label','Motion direction');
    [['forward','Start to end'],['reverse','End to start']].forEach(function (choice) { const option=Q.crel('option'); option.value=choice[0]; option.textContent=choice[1]; direction.appendChild(option); }); directionRow.appendChild(direction); card.appendChild(directionRow);
    const error=Q.crel('p','canvas-error'); error.setAttribute('role','alert'); card.appendChild(error);
    const actions=Q.crel('div','modal-actions'), cancel=Q.crel('button','btn ghost','Cancel'), review=Q.crel('button','btn primary','Review replacement');
    cancel.addEventListener('click',function () { UI.closeModal(); }); review.addEventListener('click',function () {
      if (!source.value.trim() || !first.value.trim() || !last.value.trim()) { error.textContent='Enter a source and destination range.'; return; }
      const src=Number(source.value)-1, start=Number(first.value)-1, end=Number(last.value)-1, mode=easing.value, reverse=direction.value==='reverse';
      const msg=d.validateMotionBake(src,start,end,mode,reverse); if (msg) { error.textContent=msg; return; }
      const layer=d.layer(), cel=d.cel(src,d.activeLayer,false), guide=d.motionGuide;
      UI.confirm('Replace '+(end-start+1)+' cels?', 'This replaces the current layer in every frame of the range, including skipped frames. The change is undoable.',function () {
        if (app().doc!==d || d.layer()!==layer || d.cel(src,d.activeLayer,false)!==cel || d.motionGuide!==guide) { Q.toast('Motion cancelled because the artwork changed',4000); return; }
        const result=app().bakeMotionPath(src,start,end,mode,reverse); if (result) Q.toast(result,4000);
      },'Generate');
    }); actions.appendChild(cancel); actions.appendChild(review); card.appendChild(actions); UI.openModal(card);
  };

  UI.transformBakeDialog = function () {
    app().stopPlay(); const d=app().doc; if (!d) return;
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Generate transform frames'));
    card.appendChild(Q.crel('p','sub','Interpolate two numeric poses of the entire source cel (selection is ignored), then bake the results into the current layer. Existing cels in the range are replaced after confirmation, including skipped frames and the source if in range. Undo restores them. This is not a live or editable keyframe track.'));
    function numberField(container,label,value,step) {
      const row=Q.crel('div','transform-field'); const text=Q.crel('label',null,label), input=Q.crel('input','select');
      input.type='number'; input.step=step || '1'; input.value=String(value); input.setAttribute('aria-label',label); row.appendChild(text); row.appendChild(input); container.appendChild(row); return input;
    }
    function section(label) { const title=Q.crel('h3','transform-heading',label); card.appendChild(title); const box=Q.crel('div','transform-grid'); card.appendChild(box); return box; }
    const frames=section('Frames');
    const source=numberField(frames,'Source frame',d.activeFrame+1), firstFrame=numberField(frames,'First frame',1), lastFrame=numberField(frames,'Last frame',d.frames.length);
    function pose(label) { const box=section(label); return {x:numberField(box,label+' X offset',0,'any'),y:numberField(box,label+' Y offset',0,'any'),scale:numberField(box,label+' scale (%)',100,'any'),angle:numberField(box,label+' rotation (°)',0,'any')}; }
    const from=pose('Start'), to=pose('End'), pivotBox=section('Pivot in canvas pixels');
    const px=numberField(pivotBox,'Pivot X',d.width/2,'any'), py=numberField(pivotBox,'Pivot Y',d.height/2,'any');
    card.appendChild(Q.crel('p','sub','Offsets are relative to the source. Positive rotation is clockwise around the pivot. Scale is 10–400%; rotation follows the entered numbers, allowing full turns. Movement is by frame number, not hold time. Off-canvas pixels are cropped and resampling can soften artwork.'));
    const row=Q.crel('div','field studio-field'); row.appendChild(Q.crel('label',null,'Easing')); const easing=Q.crel('select'); easing.setAttribute('aria-label','Transform easing');
    [['linear','Linear'],['in','Ease in'],['out','Ease out'],['inout','Ease in and out']].forEach(function (choice) { const option=Q.crel('option'); option.value=choice[0]; option.textContent=choice[1]; easing.appendChild(option); }); row.appendChild(easing); card.appendChild(row);
    const error=Q.crel('p','canvas-error'); error.setAttribute('role','alert'); card.appendChild(error);
    const actions=Q.crel('div','modal-actions'), cancel=Q.crel('button','btn ghost','Cancel'), review=Q.crel('button','btn primary','Review replacement');
    cancel.addEventListener('click',function () { UI.closeModal(); }); review.addEventListener('click',function () {
      const fields=[source,firstFrame,lastFrame,from.x,from.y,from.scale,from.angle,to.x,to.y,to.scale,to.angle,px,py];
      if (fields.some(input=>!input.value.trim() || !Number.isFinite(Number(input.value)))) { error.textContent='Enter a number in every field.'; return; }
      const src=Number(source.value)-1, start=Number(firstFrame.value)-1, end=Number(lastFrame.value)-1, mode=easing.value;
      const read=p=>({x:Number(p.x.value),y:Number(p.y.value),scale:Number(p.scale.value)/100,angle:Number(p.angle.value)});
      const a=read(from), b=read(to), pivot={x:Number(px.value),y:Number(py.value)};
      const msg=d.validateTransformBake(src,start,end,mode,a,b,pivot); if (msg) { error.textContent=msg; return; }
      const layer=d.layer(), cel=d.cel(src,d.activeLayer,false), frames=d.frames.slice(start,end+1);
      UI.confirm('Replace '+(end-start+1)+' cels?', 'This bakes new pixels into the current layer in every selected frame, including skipped frames. The change is undoable.',function () {
        if (app().doc!==d || d.layer()!==layer || d.cel(src,d.activeLayer,false)!==cel || frames.some((frame,i)=>d.frames[start+i]!==frame)) { Q.toast('Transform cancelled because the artwork changed',4000); return; }
        const result=app().bakeTransform(src,start,end,mode,a,b,pivot); if (result) Q.toast(result,4000);
      },'Generate');
    }); actions.appendChild(cancel); actions.appendChild(review); card.appendChild(actions); UI.openModal(card);
  };

  UI.copyCelDialog = function () {
    app().stopPlay(); const d=app().doc; if (!d) return;
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Copy cel to frames'));
    card.appendChild(Q.crel('p','sub','Copy the current layer from the source frame to an inclusive range. Existing cels on that layer will be replaced, including in skipped frames. Other layers and frame timing are unchanged. The source is never overwritten. Undo restores the previous cels.'));
    function field(label,value) { const row=Q.crel('div','field'); row.appendChild(Q.crel('label',null,label)); const input=Q.crel('input','select'); input.type='number'; input.min=1; input.max=d.frames.length; input.value=value; input.setAttribute('aria-label',label); row.appendChild(input); card.appendChild(row); return input; }
    const source=field('Source frame',d.activeFrame+1), first=field('First destination',1), last=field('Last destination',d.frames.length);
    const error=Q.crel('p','canvas-error'); error.setAttribute('role','alert'); card.appendChild(error);
    const actions=Q.crel('div','modal-actions'), cancel=Q.crel('button','btn ghost','Cancel'), next=Q.crel('button','btn primary','Review replacement');
    cancel.addEventListener('click',function () { UI.closeModal(); }); next.addEventListener('click',function () {
      const a=Number(source.value), b=Number(first.value), c=Number(last.value);
      if (!source.value.trim() || !first.value.trim() || !last.value.trim() || !Number.isInteger(a) || !Number.isInteger(b) || !Number.isInteger(c) || a<1 || a>d.frames.length || b<1 || c<b || c>d.frames.length || (b===c && a===b)) { error.textContent='Enter a valid source and at least one different destination.'; return; }
      if (d.layer().locked || d.layer().alphaLocked) { error.textContent='Unlock the layer and alpha first.'; return; }
      if (!d.cel(a-1,d.activeLayer,false)) { error.textContent='Source cel is empty.'; return; }
      const count=c-b+1-(a>=b && a<=c ? 1 : 0);
      if (d.width*d.height*4*count>64*1024*1024) { error.textContent='Too many pixels to copy at once; use a smaller range.'; return; }
      UI.confirm('Replace '+count+' cel'+(count===1?'':'s')+'?', 'Existing artwork on the current layer in the destination frames will be replaced. Undo restores it.', function () { const result=app().copyCelToRange(a-1,b-1,c-1); if (result) Q.toast(result,4000); }, 'Replace');
    }); actions.appendChild(cancel); actions.appendChild(next); card.appendChild(actions); UI.openModal(card);
  };

  UI.spriteSheetDialog = function () {
    app().stopPlay(); const d=app().doc; if (!d) return;
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Export sprite sheet'));
    card.appendChild(Q.crel('p','sub','One tile per source frame in timeline order, including skipped frames; playback range, ping-pong and holds are not included. Empty grid cells are transparent. Maximum: 8192 pixels per side and 16 megapixels.'));
    const row=Q.crel('div','field'); row.appendChild(Q.crel('label',null,'Columns')); const cols=Q.crel('input','select'); cols.type='number'; cols.min=1; cols.max=d.frames.length; cols.value=Math.min(4,d.frames.length); cols.setAttribute('aria-label','Sprite columns'); row.appendChild(cols); card.appendChild(row);
    const srow=Q.crel('div','field'); srow.appendChild(Q.crel('label',null,'Scale')); const scale=Q.crel('select'); scale.setAttribute('aria-label','Sprite scale');
    [['0.25','25%'],['0.5','50%'],['1','100%']].forEach(function (a) { const option=Q.crel('option'); option.value=a[0]; option.textContent=a[1]; scale.appendChild(option); }); srow.appendChild(scale); card.appendChild(srow);
    const brow=Q.crel('div','field'); brow.appendChild(Q.crel('label',null,'Background')); const background=Q.crel('select'); background.setAttribute('aria-label','Sprite background');
    [['transparent','Transparent'],['canvas','Canvas colour']].forEach(function (a) { const option=Q.crel('option'); option.value=a[0]; option.textContent=a[1]; background.appendChild(option); }); brow.appendChild(background); card.appendChild(brow);
    const info=Q.crel('p','sub'); const error=Q.crel('p','canvas-error'); error.setAttribute('role','alert'); card.appendChild(info); card.appendChild(error);
    function update() { const l=Q.spriteSheetLayout(d,Number(cols.value),Number(scale.value)); info.textContent=l ? 'Output: '+l.width+' × '+l.height+' px · tiles '+l.tileW+' × '+l.tileH+' px' : 'Invalid size or too large for export.'; return l; }
    cols.addEventListener('input',update); scale.addEventListener('change',update); update();
    const actions=Q.crel('div','modal-actions'), cancel=Q.crel('button','btn ghost','Cancel'), save=Q.crel('button','btn primary','Export');
    cancel.addEventListener('click',function () { UI.closeModal(); }); save.addEventListener('click',function () { if (!update()) { error.textContent='Choose valid columns and a smaller scale.'; return; } const n=Number(cols.value), factor=Number(scale.value), transparent=background.value==='transparent'; UI.closeModal(); UI.closeTray(); app().exportSpriteSheet(n,factor,transparent); });
    actions.appendChild(cancel); actions.appendChild(save); card.appendChild(actions); UI.openModal(card);
  };

  UI.helpSheet = function () {
    const card = Q.crel('div');
    card.appendChild(Q.crel('h2', null, 'Gestures & tools'));
    card.appendChild(Q.crel('p', 'sub', 'Qalam is built for a finger or a stylus. Stylus pressure changes size and opacity when the pen reports it.'));
    const rows = [
      ['One finger / stylus', 'Draw'],
      ['Two fingers', 'Pan, pinch to zoom, twist to rotate'],
      ['Three-finger tap', 'Undo'],
      ['Four-finger tap', 'Redo'],
      ['Long press', 'Pick a colour (eyedropper)'],
      ['Hold at the end of a stroke', 'Snap a line, circle or ellipse; drag another finger to move, then lift the first to commit'],
      ['Drag the colour swatch', 'Drop on the active layer to flood fill'],
      ['Magic wand', 'Select connected pixels via Selection & transform'],
      ['Drag a layer row sideways', 'Change layer opacity'],
      ['Double-tap a frame', 'Duplicate, reorder or delete it']
    ];
    rows.forEach(function (r) {
      const line = Q.crel('div', 'field');
      line.style.alignItems = 'flex-start';
      line.innerHTML = '<label style="width:132px">' + r[0] + '</label>';
      const txt = Q.crel('div');
      txt.style.cssText = 'flex:1;font-size:12.5px;color:#b9b9c4';
      txt.textContent = r[1];
      line.appendChild(txt);
      card.appendChild(line);
    });
    const actions = Q.crel('div', 'modal-actions');
    const close = Q.crel('button', 'btn primary', 'Got it');
    close.addEventListener('click', function () { UI.closeModal(); });
    actions.appendChild(close);
    card.appendChild(actions);
    UI.openModal(card);
  };

  UI.aboutSheet = function () {
    const card = Q.crel('div');
    card.appendChild(Q.crel('h2', null, 'Qalam'));
    card.appendChild(Q.crel('p', 'sub', 'A paint, sketch and frame-by-frame animation studio for Android. Artwork is stored on this device only — nothing is uploaded.'));
    card.appendChild(Q.crel('p', 'sub', 'Developed by Qmer'));
    card.appendChild(Q.crel('p', 'sub', 'ቀለም (qalam) means “pen” or “ink”.'));
    card.appendChild(Q.crel('p', 'sub', 'Version 2.0'));
    const actions = Q.crel('div', 'modal-actions');
    const close = Q.crel('button', 'btn primary', 'Close');
    close.addEventListener('click', function () { UI.closeModal(); });
    actions.appendChild(close);
    card.appendChild(actions);
    UI.openModal(card);
  };

  UI.refreshTimeline = function () {
    if (timelineOpen) buildTimeline();
  };

  /* ── dialogs ────────────────────────────────────────────── */

  UI.openModal = function (node) {
    const m = Q.el('#modal');
    const body = Q.el('#modalBody');
    body.innerHTML = '';
    body.appendChild(node);
    m.classList.remove('hidden');
  };

  UI.closeModal = function () {
    Q.el('#modal').classList.add('hidden');
  };

  UI.confirm = function (title, text, onYes, yesLabel) {
    const card = Q.crel('div');
    card.appendChild(Q.crel('h2', null, title));
    card.appendChild(Q.crel('p', 'sub', text));
    const actions = Q.crel('div', 'modal-actions');
    const no = Q.crel('button', 'btn ghost', 'Cancel');
    no.addEventListener('click', function () { UI.closeModal(); });
    const yes = Q.crel('button', 'btn danger', yesLabel || 'Delete');
    yes.addEventListener('click', function () { UI.closeModal(); onYes(); });
    actions.appendChild(no); actions.appendChild(yes);
    card.appendChild(actions);
    UI.openModal(card);
  };

  const PRESETS = [
    { name: 'Square', w: 2048, h: 2048, note: '2048 × 2048' },
    { name: 'Portrait', w: 1600, h: 2133, note: '1600 × 2133' },
    { name: 'Landscape', w: 2133, h: 1600, note: '2133 × 1600' },
    { name: 'HD frame', w: 1920, h: 1080, note: '1920 × 1080' },
    { name: 'Animation', w: 1280, h: 1280, note: '1280 × 1280' },
    { name: 'Story', w: 1080, h: 1920, note: '1080 × 1920' }
  ];

  UI.newCanvasDialog = function () {
    let chosen = PRESETS[0];
    const card = Q.crel('div');
    card.appendChild(Q.crel('h2', null, 'New canvas'));
    card.appendChild(Q.crel('p', 'sub', 'Pick a size. You can animate on any canvas by adding frames.'));

    const nameField = Q.crel('div', 'field');
    nameField.innerHTML = '<label>Name</label>';
    const nameInput = Q.crel('input');
    nameInput.type = 'text';
    nameInput.value = 'Untitled';
    nameInput.className = 'select';
    nameInput.style.height = '36px';
    nameField.appendChild(nameInput);
    card.appendChild(nameField);

    const widthInput = Q.crel('input'), heightInput = Q.crel('input');
    [widthInput, heightInput].forEach(function (input) { input.type='number'; input.min='64'; input.max='4096'; input.className='select'; input.inputMode='numeric'; });
    widthInput.value = chosen.w; heightInput.value = chosen.h;
    widthInput.setAttribute('aria-label','Canvas width'); heightInput.setAttribute('aria-label','Canvas height');
    const grid = Q.crel('div', 'preset-grid');
    PRESETS.forEach(function (p) {
      const b = Q.crel('button', 'preset' + (p === chosen ? ' on' : ''));
      const pv = Q.crel('div', 'pv');
      pv.style.aspectRatio = String(p.w / p.h);
      const txt = Q.crel('div');
      txt.appendChild(Q.crel('div', 'pn', p.name));
      txt.appendChild(Q.crel('div', 'pd', p.note));
      b.appendChild(pv); b.appendChild(txt);
      b.addEventListener('click', function () {
        chosen = p; widthInput.value = p.w; heightInput.value = p.h;
        Q.els('.preset', grid).forEach(function (n) { n.classList.remove('on'); });
        b.classList.add('on');
      });
      grid.appendChild(b);
    });
    card.appendChild(grid);
    const dimensions = Q.crel('div', 'canvas-dimensions');
    function dimension(label, input) { const field=Q.crel('label'); field.textContent=label; field.appendChild(input); dimensions.appendChild(field); }
    dimension('Width (px)', widthInput); dimension('Height (px)', heightInput); card.appendChild(dimensions);
    [widthInput, heightInput].forEach(function (input) { input.addEventListener('input', function () { Q.els('.preset', grid).forEach(function (n) { n.classList.remove('on'); }); }); });
    const error = Q.crel('p', 'canvas-error'); error.setAttribute('role','alert'); card.appendChild(error);

    const actions = Q.crel('div', 'modal-actions');
    const cancel = Q.crel('button', 'btn ghost', 'Cancel');
    cancel.addEventListener('click', function () { UI.closeModal(); });
    const go = Q.crel('button', 'btn primary', 'Create');
    go.addEventListener('click', function () {
      const w=Number(widthInput.value), h=Number(heightInput.value);
      if (!Number.isInteger(w) || !Number.isInteger(h) || w < 64 || h < 64 || w > 4096 || h > 4096) {
        error.textContent='Enter whole dimensions from 64 to 4096 pixels.'; return;
      }
      UI.closeModal();
      app().createDoc(w, h, nameInput.value.trim() || 'Untitled');
    });
    actions.appendChild(cancel); actions.appendChild(go);
    card.appendChild(actions);
    UI.openModal(card);
    void fitCanvasToBox;
  };

  UI.exportDialog = function () {
    const d = app().doc;
    if (!d) return;
    let scale = 1, loop = d.playMode === 'once' ? -1 : 0;
    const card = Q.crel('div');
    card.appendChild(Q.crel('h2', null, 'Export animation'));
    card.appendChild(Q.crel('p', 'sub', d.frames.length + ' frames at ' + d.fps + ' fps. Saved to Pictures/Qalam.'));

    const scaleField = Q.crel('div', 'field');
    scaleField.innerHTML = '<label>Size</label>';
    const sel = Q.crel('select');
    [[1, '100%'], [0.5, '50%'], [1.5, '150%']].forEach(function (o) {
      const opt = document.createElement('option');
      opt.value = String(o[0]); opt.textContent = o[1] + ' · ' + Math.round(d.width * o[0]) + '×' + Math.round(d.height * o[0]);
      sel.appendChild(opt);
    });
    sel.addEventListener('change', function () { scale = parseFloat(sel.value); });
    scaleField.appendChild(sel);
    card.appendChild(scaleField);

    const loopField = Q.crel('div', 'field');
    loopField.innerHTML = '<label>Loop</label>';
    const loopSel = Q.crel('select');
    [[0, 'Forever'], [-1, 'Once']].forEach(function (o) {
      const opt = document.createElement('option');
      opt.value = String(o[0]); opt.textContent = o[1];
      loopSel.appendChild(opt);
    });
    loopSel.value = String(loop);
    loopSel.addEventListener('change', function () { loop = parseInt(loopSel.value, 10); });
    loopField.appendChild(loopSel);
    card.appendChild(loopField);

    const actions = Q.crel('div', 'modal-actions');
    const cancel = Q.crel('button', 'btn ghost', 'Cancel');
    cancel.addEventListener('click', function () { UI.closeModal(); });
    const go = Q.crel('button', 'btn primary', 'Export GIF');
    go.addEventListener('click', function () {
      UI.closeModal();
      app().exportGif({ scale: scale, loop: loop });
    });
    actions.appendChild(cancel); actions.appendChild(go);
    card.appendChild(actions);
    UI.openModal(card);
  };

  UI.progress = function (title, text, value, onCancel) {
    let node = document.getElementById('progressCard');
    if (!node) {
      node = Q.crel('div');
      node.id = 'progressCard';
      const card = Q.crel('div');
      card.appendChild(Q.crel('h2', null, title));
      const p = Q.crel('p', 'sub', text);
      p.id = 'progressText';
      card.appendChild(p);
      const bar = Q.crel('div');
      bar.style.cssText = 'height:8px;border-radius:6px;background:#242430;overflow:hidden;margin-top:6px';
      const fill = Q.crel('div');
      fill.id = 'progressFill';
      fill.style.cssText = 'height:100%;width:0%;background:linear-gradient(90deg,#f0b46a,#ffd9a0);transition:width .2s';
      bar.appendChild(fill);
      card.appendChild(bar);
      if (onCancel) { const cancel=Q.crel('button','btn ghost','Cancel export'); cancel.addEventListener('click',onCancel); card.appendChild(cancel); }
      node.appendChild(card);
      UI.openModal(node);
    }
    const fillEl = document.getElementById('progressFill');
    if (fillEl) fillEl.style.width = Math.round((value || 0) * 100) + '%';
    const textEl = document.getElementById('progressText');
    if (textEl && text) textEl.textContent = text;
  };

  UI.endProgress = function () {
    const node = document.getElementById('progressCard');
    if (node) node.remove();
    UI.closeModal();
  };

  UI.refreshLayersIfOpen = function () {
    if (tray === 'layers') buildLayers(Q.el('#trayBody'));
  };

  UI.refreshMenuIfOpen = function () {
    if (tray === 'menu') buildMenu(Q.el('#trayBody'));
  };
})();
