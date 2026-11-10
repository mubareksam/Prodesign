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
  let brushSearch = '', brushCategory = 'all';
  let layerSelectionDoc=null, layerSelection=new Set(), layerSelectMode=false;
  let railPreferences={side:'left',position:50};
  let railLayoutFrame=0;
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
    cut: '<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><path d="M8 7l12 10M8 17L20 7"/>',
    paste: '<rect x="6" y="5" width="13" height="16" rx="2"/><path d="M9 5V3h7v2M9 11h7M9 15h7"/>',
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
    star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
    palette: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    harmony: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><circle cx="12" cy="16" r="3"/>',
    transparency: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    invertSelection: '<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 2"/><path d="M8 12h8M12 8v8"/>',
    alphaLock: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 4v4H4M16 20v-4h4M8 12h4V8M12 16v4M16 8h4M8 16H4"/>',
    appearance: '<circle cx="12" cy="12" r="7"/><path d="M12 5v14M12 2v1M12 21v1M2 12h1M21 12h1"/>',
    gestureDelay: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2M8 2h8"/>',
    focus: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><path d="M8 12h8"/>',
    pureHue: '<path d="M12 3C9 7 6 10 6 14a6 6 0 0012 0c0-4-3-7-6-11z"/><path d="M12 9v7M9 12.5h6"/>',
    railLayout: '<path d="M5 4v16M19 4v16M9 8h6M11 6L9 8l2 2M13 14h-4M13 12l2 2-2 2"/><circle cx="5" cy="8" r="2"/><circle cx="19" cy="16" r="2"/>',
    controls: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
    motion: '<path d="M4 18C4 7 9 6 12 12s5 6 8-6"/><circle cx="4" cy="18" r="2"/><circle cx="20" cy="6" r="2"/>',
    findFrame: '<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5L20 20M8 10h4M10 8v4"/>',
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
    UI.applyRailPreferences(Q.Store.meta('railPreferences'),false);
    UI.setTheme(Q.Store.meta('interfaceTheme'),false);

    el('#btnNew').addEventListener('click', function () { UI.newCanvasDialog(); });
    el('#referenceClose').addEventListener('click', function () { UI.closeReference(); });
    el('#referenceZoom').addEventListener('input', function () { UI.resizeReference(); });
    el('#referenceCanvasMode').addEventListener('click',function () { UI.showCanvasReference(); });
    el('#referencePickImage').addEventListener('click',function () { UI.pickReferenceImage(); });
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
    el('#btnRestoreInterface').addEventListener('click', function () { UI.setFocusMode(false); });

    el('#btnUndo').addEventListener('click', function () { app().undo(); });
    el('#btnRedo').addEventListener('click', function () { app().redo(); });
    el('#btnTimeline').addEventListener('click', function () { UI.toggleTimeline(); });
    el('#btnMenu').addEventListener('click', function () { UI.toggleTray('menu'); });
    el('#btnEffects').addEventListener('click', function () { UI.closeTray(); UI.effectsDialog(); });
    el('#btnSelection').addEventListener('click', function () { UI.closeTray(); UI.selectionDialog(); });
    el('#audioImport').addEventListener('change', function () {
      const file=this.files && this.files[0], target=UI.audioTarget;
      this.value=''; UI.audioTarget=null;
      if (file && target) app().importAudioFile(file,target);
    });
    el('#imageImport').addEventListener('change', function () {
      const file=this.files && this.files[0], target=UI.imageTarget;
      this.value=''; UI.imageTarget=null;
      if (file && target) { if (target.kind==='reference') app().loadReferenceFile(file,target); else app().importImageFile(file,target); }
    });

    el('#btnFitCanvas').addEventListener('click', function () { if(app().view && app().doc) { app().view.fit(); Q.toast('Canvas fitted'); } });
    el('#btnBrush').addEventListener('click', function () { app().view.tool='brush'; el('#btnFill').classList.remove('on'); el('#btnEyedrop').classList.remove('on'); UI.syncBrushUi(); UI.toggleTray('brushes'); });
    el('#btnSmudge').addEventListener('click',function () { const v=app().view; if(v.tool==='smudge') v.tool='brush'; else { if(v.brush.eraser) v.brush=app().lastPaintBrush || Q.BRUSHES.find(b=>!b.eraser); v.tool='smudge'; } el('#btnFill').classList.remove('on'); el('#btnEyedrop').classList.remove('on'); UI.syncBrushUi(); Q.hint(v.tool==='smudge' ? 'Smudge the current layer · opacity controls strength' : 'Brush mode',2200); });
    el('#btnLayers').addEventListener('click', function () { UI.toggleTray('layers'); });
    // A tap opens the picker; a drag from the swatch drops the captured colour
    // on the raw canvas. Pointer capture also handles dragging outside the button.
    const swatch=el('#btnColor'); let colorDrag=null, suppressColorClick=false;
    swatch.addEventListener('pointerdown',function (e) {
      if (!app().doc || !app().view || app().view.locked || (e.button!=null && e.button!==0)) return;
      colorDrag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,held:false,color:app().view.color.slice(),doc:app().doc};
      const current=colorDrag; current.timer=setTimeout(function(){ if(colorDrag===current && !current.moved) current.held=true; },600);
      try { swatch.setPointerCapture(e.pointerId); } catch(err) {}
    });
    swatch.addEventListener('pointermove',function (e) {
      if(!colorDrag || colorDrag.id!==e.pointerId) return;
      if(Math.hypot(e.clientX-colorDrag.x,e.clientY-colorDrag.y)>8) { colorDrag.moved=true; colorDrag.held=false; clearTimeout(colorDrag.timer); }
      if(colorDrag.moved) { e.preventDefault(); let dot=document.getElementById('colorDropGhost'); if(!dot) { dot=Q.crel('div','color-drop-ghost'); dot.id='colorDropGhost'; document.body.appendChild(dot); } dot.style.background=Q.rgbToHex(colorDrag.color); dot.style.left=e.clientX+'px'; dot.style.top=e.clientY+'px'; }
    });
    function finishColorDrag(e) {
      if(!colorDrag || colorDrag.id!==e.pointerId) return; const drag=colorDrag; colorDrag=null; clearTimeout(drag.timer);
      const ghost=document.getElementById('colorDropGhost'); if(ghost) ghost.remove();
      if(drag.held && !drag.moved) { suppressColorClick=true; setTimeout(function(){ suppressColorClick=false; },500); if(e.type!=='pointercancel' && app().doc===drag.doc) app().swapPreviousColor(); return; }
      if(!drag.moved) return; suppressColorClick=true; setTimeout(function(){ suppressColorClick=false; },500);
      if(e.type==='pointercancel' || app().doc!==drag.doc || app().view.locked) return;
      const cv=app().view.canvas, r=cv.getBoundingClientRect(), hit=document.elementFromPoint(e.clientX,e.clientY);
      if(e.clientX<r.left || e.clientX>=r.right || e.clientY<r.top || e.clientY>=r.bottom || hit!==cv) { Q.toast('Drop on the canvas to fill'); return; }
      const p=app().view.toDoc(e.clientX-r.left,e.clientY-r.top); app().fillAt(p.x,p.y,drag.color);
    }
    swatch.addEventListener('pointerup',finishColorDrag); swatch.addEventListener('pointercancel',finishColorDrag);
    swatch.addEventListener('click', function () { if(suppressColorClick) { suppressColorClick=false; return; } UI.toggleTray('color'); });
    const eraser=el('#btnEraser'); let erasePress=null, suppressEraserClick=false;
    eraser.addEventListener('pointerdown',function(e) { if(e.button!=null && e.button!==0) return; const p={id:e.pointerId,x:e.clientX,y:e.clientY,held:false}; erasePress=p; p.timer=setTimeout(()=>{ if(erasePress===p) p.held=true; },600); try { eraser.setPointerCapture(e.pointerId); } catch(err) {} });
    eraser.addEventListener('pointermove',function(e) { if(erasePress && e.pointerId===erasePress.id && Math.hypot(e.clientX-erasePress.x,e.clientY-erasePress.y)>8) { clearTimeout(erasePress.timer); erasePress.held=false; erasePress.moved=true; } });
    function finishEraser(e) { if(!erasePress || e.pointerId!==erasePress.id) return; const p=erasePress; erasePress=null; clearTimeout(p.timer); if(p.held || p.moved || e.type==='pointercancel') { suppressEraserClick=true; setTimeout(()=>{suppressEraserClick=false;},500); if(p.held && !p.moved && e.type!=='pointercancel') app().useEraser(true); } }
    eraser.addEventListener('pointerup',finishEraser); eraser.addEventListener('pointercancel',finishEraser);
    eraser.addEventListener('click',function() { if(suppressEraserClick) { suppressEraserClick=false; return; } app().useEraser(false); });
    eraser.addEventListener('contextmenu',function(e){e.preventDefault();});
    el('#btnEyedrop').addEventListener('click', function () {
      const v = app().view;
      v.tool = v.tool === 'eyedrop' ? 'brush' : 'eyedrop';
      el('#btnEyedrop').classList.toggle('on', v.tool === 'eyedrop');
      el('#btnFill').classList.remove('on');
      UI.syncBrushUi(); Q.hint(v.tool === 'eyedrop' ? 'Tap the canvas to pick a colour' : 'Brush mode', 1600);
    });

    el('#btnFill').addEventListener('click', function () {
      const v=app().view; v.tool = v.tool === 'fill' ? 'brush' : 'fill';
      el('#btnFill').classList.toggle('on', v.tool === 'fill'); el('#btnEyedrop').classList.remove('on');
      UI.syncBrushUi(); Q.hint(v.tool === 'fill' ? 'Tap an area to fill the active layer' : 'Brush mode', 1800);
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

    const timelineElement=el('#timeline');
    timelineElement.addEventListener('animationend',function(e) { if(e.target===timelineElement) UI.scheduleRailLayout(); });
    if(window.ResizeObserver) { if(UI.railObserver) UI.railObserver.disconnect(); UI.railObserver=new ResizeObserver(function(){ UI.scheduleRailLayout(); }); UI.railObserver.observe(el('#studio')); UI.railObserver.observe(el('#studio .topbar')); UI.railObserver.observe(timelineElement); }

    window.addEventListener('resize', function () {
      if (app().view) { app().view.resize(); app().view.dirty = true; }
      if (tray === 'color') UI.openTray('color');
      UI.scheduleRailLayout();
    });

    // keyboard shortcuts for desktop testing
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { if (!Q.el('#modal').classList.contains('hidden')) UI.closeModal(); else if (UI.isFocusMode()) UI.setFocusMode(false); else UI.closeTray(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); if (e.shiftKey) app().redo(); else app().undo(); }
      if (e.key === '[' ) app().setSize(app().view.size * 0.85);
      if (e.key === ']' ) app().setSize(app().view.size * 1.18);
    });
    void ICON;
  };

  /* ── gallery ────────────────────────────────────────────── */

  function validGalleryThumb(value) { return typeof value==='string' && /^data:image\/(?:jpeg|png|webp);base64,/i.test(value); }

  UI.renderGallery = function () {
    const grid = Q.el('#galGrid');
    const empty = Q.el('#galEmpty');
    grid.innerHTML = '';
    Q.Store.list().then(function (items) {
      empty.classList.toggle('hidden', items.length > 0);
      items.forEach(function (item) {
        const card = Q.crel('div', 'g-card');
        const open=Q.crel('button','g-open'); open.setAttribute('aria-label','Open artwork: '+(item.name || 'Untitled'));
        if (validGalleryThumb(item.thumb)) {
          const img = Q.crel('img');
          img.src = item.thumb;
          img.alt = item.name || 'artwork';
          open.appendChild(img);
        } else {
          open.appendChild(Q.crel('div', 'g-ph', 'ቀ'));
        }
        const info = Q.crel('div', 'g-info');
        info.appendChild(Q.crel('div', 'g-name', escapeHtml(item.name || 'Untitled')));
        const when = new Date(item.updated || Date.now());
        const sub=Q.crel('div','g-sub'); sub.textContent=(item.frames > 1 ? item.frames + ' frames · ' : '') + (item.w || '?') + '×' + (item.h || '?') + ' · ' + when.toLocaleDateString(); info.appendChild(sub);
        open.appendChild(info); card.appendChild(open);
        open.addEventListener('click',function() { app().openDoc(item.id); });

        const preview = Q.crel('button', 'g-preview', icon(ICON.eye));
        preview.setAttribute('aria-label','Preview artwork: '+(item.name || 'Untitled')); preview.title='Preview artwork';
        preview.addEventListener('click',function(e) { e.stopPropagation(); UI.previewGalleryItem(item); });
        card.appendChild(preview);

        const del = Q.crel('button', 'g-del', icon(ICON.trash));
        del.setAttribute('aria-label','Delete artwork: '+(item.name || 'Untitled')); del.title='Delete artwork';
        del.addEventListener('click', function (e) {
          e.stopPropagation();
          UI.confirm('Delete “‘' + escapeHtml(item.name || 'Untitled') + '”?' , 'This removes the artwork from this device.', function () {
            Q.Store.remove(item.id).then(function () { UI.renderGallery(); });
          });
        });
        card.appendChild(del);

        grid.appendChild(card);
      });
    });
  };

  UI.previewGalleryItem = function (item) {
    if (Q.el('#gallery').classList.contains('hidden') || !item) return;
    const card=Q.crel('div','gallery-preview'), heading=Q.crel('h2'); heading.textContent=item.name || 'Untitled'; card.appendChild(heading);
    const frames=Number.isInteger(item.frames) && item.frames>0 ? item.frames : 1, meta=Q.crel('p','sub'); meta.textContent=(item.w || '?')+' × '+(item.h || '?')+' · '+frames+' frame'+(frames===1 ? '' : 's'); card.appendChild(meta);
    const imageArea=Q.crel('div','gallery-preview-image'), fallback=Q.crel('div','gallery-preview-empty','No saved preview available.');
    if (validGalleryThumb(item.thumb)) {
      const img=Q.crel('img'); img.alt='Saved artwork preview'; img.addEventListener('error',function(){ imageArea.innerHTML=''; imageArea.appendChild(fallback); }); img.src=item.thumb; imageArea.appendChild(img);
    } else imageArea.appendChild(fallback);
    card.appendChild(imageArea);
    card.appendChild(Q.crel('p','sub gallery-preview-note','Read-only saved thumbnail (up to 320 px), from the frame active at the last successful save. It includes the canvas background, but not animated camera or layer motion. It is not a full-resolution or animated preview.'));
    const controls=Q.crel('div','modal-actions'), duplicate=Q.crel('button','btn ghost','Duplicate artwork'), close=Q.crel('button','btn primary','Close');
    duplicate.addEventListener('click',function(){ duplicate.disabled=true; Q.Store.duplicate(item.id).then(function(){ if(card.isConnected) UI.closeModal(); if(!Q.el('#gallery').classList.contains('hidden')) UI.renderGallery(); Q.toast('Saved artwork duplicated'); }).catch(function(){ duplicate.disabled=false; Q.toast('Could not duplicate saved artwork',4000); }); });
    close.addEventListener('click',()=>UI.closeModal()); controls.appendChild(duplicate); controls.appendChild(close); card.appendChild(controls);
    UI.openModal(card); Q.el('#modalBody').classList.add('gallery-preview-modal');
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  UI.isFocusMode = function () { return Q.el('#studio').classList.contains('focus-mode'); };
  UI.setFocusMode = function (enabled) {
    const studio=Q.el('#studio'), restore=Q.el('#btnRestoreInterface');
    if (enabled && (studio.classList.contains('hidden') || !app().doc)) return;
    if (enabled) UI.closeTray();
    studio.classList.toggle('focus-mode',!!enabled); restore.classList.toggle('hidden',!enabled);
    if (!enabled) UI.scheduleRailLayout();
  };

  UI.showGallery = function () {
    UI.setFocusMode(false);
    Q.el('#studio').classList.add('hidden');
    UI.closeReference();
    Q.el('#gallery').classList.remove('hidden');
    UI.closeTray();
    Q.el('#timeline').classList.add('hidden');
    timelineOpen = false;
    UI.renderGallery();
  };

  UI.showStudio = function () {
    UI.setFocusMode(false);
    Q.el('#gallery').classList.add('hidden');
    Q.el('#studio').classList.remove('hidden');
    const v = app().view;
    v.resize();
    v.fit();
    UI.layoutRails();
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
    const traySize=Q.el('#traySizeSlider'), trayOpacity=Q.el('#trayOpacitySlider');
    if(traySize) { traySize.value=Math.round(v.size); Q.el('#traySizeValue').textContent=Math.round(v.size); }
    if(trayOpacity) { trayOpacity.value=Math.round(v.opacity*100); Q.el('#trayOpacityValue').textContent=Math.round(v.opacity*100)+'%'; }
    Q.el('#btnBrush').classList.toggle('on', tray === 'brushes');
    Q.el('#btnSmudge').classList.toggle('on',v.tool==='smudge'); Q.el('#btnSmudge').setAttribute('aria-pressed',v.tool==='smudge' ? 'true' : 'false');
    Q.el('#btnEraser').classList.toggle('on',!!v.brush.eraser); Q.el('#btnEraser').setAttribute('aria-pressed',v.brush.eraser ? 'true' : 'false');
  };

  UI.applyRailPreferences = function (value, persist) {
    railPreferences=Q.sanitizeRailPreferences(value); Q.el('#studio').setAttribute('data-slider-side',railPreferences.side);
    if(persist) Q.Store.meta('railPreferences',railPreferences); UI.layoutRails();
  };
  UI.scheduleRailLayout = function () {
    if (railLayoutFrame) return; railLayoutFrame=requestAnimationFrame(function(){ railLayoutFrame=0; UI.layoutRails(); });
  };
  UI.layoutRails = function () {
    const studio=Q.el('#studio'); if(!studio || studio.classList.contains('hidden') || UI.isFocusMode()) return;
    const box=studio.getBoundingClientRect(), height=studio.clientHeight || box.height || window.innerHeight || 600;
    const topBar=studio.querySelector('.topbar'), topRect=topBar.getBoundingClientRect();
    let top=topBar.offsetHeight || (topRect.height && topRect.height<height/2 ? topRect.height : 52); top=Math.min(height,top+8);
    let bottom=Math.max(top,height-8); const timeline=Q.el('#timeline');
    if(timelineOpen && !timeline.classList.contains('hidden')) { const rect=timeline.getBoundingClientRect(), t=rect.top-box.top; if(rect.height>0 && Number.isFinite(t) && t<bottom) bottom=Math.max(top,t-8); }
    const layout=Q.computeRailLayout(height,top,bottom,railPreferences.position), brush=studio.querySelector('.rail-left'), tools=studio.querySelector('.rail-right');
    brush.style.top=layout.brushTop+'px'; tools.style.top=layout.toolsTop+'px'; brush.style.maxHeight=layout.available+'px'; tools.style.maxHeight=layout.available+'px';
    ['size','opacity'].forEach(function(key) { const wrap=Q.el('#'+key+'Wrap'), input=Q.el('#'+key+'Slider'), span=layout.sliderHeight-28; wrap.style.height=layout.sliderHeight+'px'; input.style.width=span+'px'; input.style.left=((46-span)/2)+'px'; input.style.top=((layout.sliderHeight-44)/2)+'px'; });
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
    const previous=tray; tray = kind;
    const t = Q.el('#tray'); if(previous!==kind) t.scrollTop=0;
    t.classList.remove('hidden'); t.setAttribute('data-panel',kind);
    Q.el('#trayBody').innerHTML = '';
    if (BUILDERS[kind]) BUILDERS[kind](Q.el('#trayBody'));
    UI.syncBrushUi();
    Q.el('#btnBrush').classList.toggle('on', kind === 'brushes');
    Q.el('#btnLayers').classList.toggle('on', kind === 'layers');
    Q.el('#btnColor').classList.toggle('on', kind === 'color');
    Q.el('#btnMenu').classList.toggle('on', kind === 'menu');
    [['#btnBrush','brushes'],['#btnLayers','layers'],['#btnColor','color'],['#btnMenu','menu']].forEach(function(x){ Q.el(x[0]).setAttribute('aria-expanded',kind===x[1] ? 'true' : 'false'); });
  };

  UI.closeTray = function () {
    tray = null;
    Q.el('#tray').classList.add('hidden');
    ['#btnBrush', '#btnLayers', '#btnColor', '#btnMenu'].forEach(function (s) {
      Q.el(s).classList.remove('on'); Q.el(s).setAttribute('aria-expanded','false');
    });
  };

  function trayHead(title, rightNodes) {
    const head = Q.crel('div', 'tray-head panel-head');
    head.appendChild(Q.crel('h3', null, title));
    const row = Q.crel('div', 'row');
    (rightNodes || []).forEach(function (n) { row.appendChild(n); });
    row.appendChild(iconButton('Close panel',ICON.close,function(){ UI.closeTray(); }));
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
    root.appendChild(trayHead('Brush library', [iconButton('Brush size presets',ICON.controls,function () { UI.sizePresetsDialog(); }),iconButton('Brush studio', ICON.wrench, function () { UI.brushStudio(); })]));
    function brushSlider(label,id,value,min,max,change) {
      const row=Q.crel('div','field studio-field'); row.appendChild(Q.crel('label',null,label)); const input=Q.crel('input'); input.id=id+'Slider'; input.type='range'; input.min=min; input.max=max; input.value=value; input.setAttribute('aria-label',label); const out=Q.crel('div','val',value+(id==='trayOpacity'?'%':'')); out.id=id+'Value'; input.addEventListener('input',()=>change(Number(input.value))); row.appendChild(input); row.appendChild(out); root.appendChild(row);
    }
    brushSlider('Brush size in tray','traySize',Math.round(app().view.size),1,240,n=>app().setSize(n));
    brushSlider('Brush opacity in tray','trayOpacity',Math.round(app().view.opacity*100),1,100,n=>app().setOpacity(n/100));
    const filterRow=Q.crel('div','brush-filter'), search=Q.crel('input','select'), categorySelect=Q.crel('select');
    search.type='search'; search.placeholder='Search brushes'; search.setAttribute('aria-label','Search brushes'); search.value=brushSearch;
    categorySelect.setAttribute('aria-label','Brush category'); [['all','All brushes'],['INK','Ink'],['PENCIL','Pencil'],['PAINT','Paint'],['ERASER','Eraser'],['CUSTOM','Custom'],['FAVORITES','Favorites']].forEach(function(item){ const option=Q.crel('option'); option.value=item[0]; option.textContent=item[1]; categorySelect.appendChild(option); }); categorySelect.value=brushCategory; filterRow.appendChild(search); filterRow.appendChild(categorySelect); root.appendChild(filterRow);
    const resultCount=Q.crel('div','layer-sub'); resultCount.setAttribute('role','status'); root.appendChild(resultCount);
    const grid = Q.crel('div', 'brush-grid');
    const favorites=Q.favoriteBrushes();
    Q.BRUSHES.forEach(function (b) {
      const card = Q.crel('button', 'brush-card' + (b.id === app().view.brush.id ? ' on' : ''));
      card.setAttribute('aria-label',b.name+' brush'+(favorites.includes(b.id) ? ', favorite' : ''));
      const cv = Q.crel('canvas');
      cv.width = 180; cv.height = 52; cv.setAttribute('aria-label',b.name+' brush stroke preview');
      const badge = Q.crel('span', 'brush-kind');
      const category = b.eraser ? 'ERASER' : b.engine === 'grain' ? 'PENCIL' : b.engine === 'soft' ? 'PAINT' : 'INK';
      const tip = b.eraser ? '<path d="M4 15l8-9a2 2 0 013 0l5 5-8 9H8zM9 20h11"/>' :
        b.engine === 'grain' ? '<path d="M5 19l3-7L16 4l4 4-8 8zM5 19l7-3M14 6l4 4"/>' :
        b.engine === 'soft' ? '<path d="M16 3c1 5 5 7 5 11a6 6 0 01-12 0c0-4 4-6 7-11zM6 16c0 3-1 4-3 5"/>' :
        '<path d="M12 3l7 7-8 8-6 1 1-6zM12 3l-2 8 3 3 6-4M5 19l-2 2"/>';
      card.dataset.brushName=b.name.toLowerCase(); card.dataset.brushCategory=category; card.dataset.custom=b.custom ? 'true' : 'false'; card.dataset.favorite=favorites.includes(b.id) ? 'true' : 'false';
      badge.innerHTML = icon(tip) + '<span>' + (b.custom ? 'CUSTOM · ' : '') + category + '</span>' + (favorites.includes(b.id) ? icon(ICON.star) : '');
      card.appendChild(badge);
      card.appendChild(cv);
      const brushName=Q.crel('span','brush-name'); brushName.textContent=b.name; card.appendChild(brushName);
      grid.appendChild(card);
      requestAnimationFrame(function () {
        Q.brushPreview(b, cv, document.documentElement.getAttribute('data-theme')==='light' ? [35, 34, 32] : [240, 236, 232]);
      });
      card.addEventListener('click', function () {
        app().setBrush(b.id);
        UI.openTray('brushes');
      });
    });
    root.appendChild(grid);
    function filterBrushes() {
      brushSearch=search.value.slice(0,100); brushCategory=categorySelect.value; const term=brushSearch.trim().toLowerCase(); let count=0;
      grid.querySelectorAll('.brush-card').forEach(function(card) { const match=(!term || card.dataset.brushName.includes(term)) && (brushCategory==='all' || (brushCategory==='CUSTOM' ? card.dataset.custom==='true' : brushCategory==='FAVORITES' ? card.dataset.favorite==='true' : card.dataset.brushCategory===brushCategory)); card.classList.toggle('hidden',!match); if(match) count++; });
      resultCount.textContent=count ? count+' brush'+(count===1 ? '' : 'es') : 'No brushes match';
    }
    search.maxLength=100; search.addEventListener('input',filterBrushes); categorySelect.addEventListener('change',filterBrushes); filterBrushes();

    const head2 = Q.crel('div', 'tray-head');
    head2.style.marginTop = '12px';
    head2.appendChild(Q.crel('h3', null, 'Pressure response'));
    root.appendChild(head2);
    const row = Q.crel('div', 'field');
    row.innerHTML = '<label>Size</label>';
    const r1 = Q.crel('input');
    r1.type = 'range'; r1.min = '0'; r1.max = '100';
    r1.value = Math.round((app().view.brush.pressureSize || 0) * 100);
    if (app().view.brush.syncedEraser) { r1.disabled=true; r1.title='Switch back to the painting brush to edit pressure'; }
    const v1 = Q.crel('div', 'val', String(r1.value));
    r1.addEventListener('input', function () {
      const brush=app().view.brush, value=parseInt(r1.value,10)/100;
      if(brush.custom) { if(!Q.updateCustomBrush(brush,'pressureSize',value)) { r1.value=Math.round(brush.pressureSize*100); Q.toast('Could not save brush',3500); } }
      else { brush.pressureSize=value; const settings=Q.Store.meta('brushSettings') || {}; settings[brush.id]=Object.assign({},settings[brush.id],{pressureSize:value}); Q.Store.meta('brushSettings',settings); }
      v1.textContent = r1.value;
    });
    row.appendChild(r1); row.appendChild(v1);
    root.appendChild(row);
    void fitCanvasToBox;
  }

  UI.sizePresetsDialog = function () {
    const stored=Q.Store.meta('sizePresets'); let presets=Array.isArray(stored) ? [...new Set(stored.filter(v=>Number.isInteger(v) && v>=1 && v<=240))].slice(0,6) : [];
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Brush size presets'));
    card.appendChild(Q.crel('p','sub','Save up to six sizes on this device. Tap a size to use it for the current brush; sizes are shared by all brushes.'));
    const list=Q.crel('div','size-preset-list'); card.appendChild(list);
    function render() {
      list.innerHTML=''; if(!presets.length) list.appendChild(Q.crel('p','sub','No saved sizes yet.'));
      presets.forEach(function(size) { const row=Q.crel('div','size-preset-row'), use=Q.crel('button','btn ghost',size+' px'), remove=Q.crel('button','mini-btn'); remove.innerHTML=icon(ICON.trash); remove.setAttribute('aria-label','Remove size '+size); use.setAttribute('aria-label','Use size '+size); use.addEventListener('click',function(){ app().setSize(size); UI.closeModal(); Q.toast('Brush size '+size); }); remove.addEventListener('click',function(){ presets=presets.filter(v=>v!==size); Q.Store.meta('sizePresets',presets); render(); }); row.appendChild(use); row.appendChild(remove); list.appendChild(row); });
    }
    render(); const error=Q.crel('p','canvas-error'); error.setAttribute('role','alert'); card.appendChild(error);
    const actions=Q.crel('div','modal-actions'), add=Q.crel('button','btn primary','Save current'), close=Q.crel('button','btn ghost','Close');
    add.addEventListener('click',function(){ const size=Math.round(app().view.size); if(presets.includes(size)) { error.textContent='This size is already saved.'; return; } if(presets.length>=6) { error.textContent='Remove a size before adding another.'; return; } presets.push(size); Q.Store.meta('sizePresets',presets); error.textContent=''; render(); }); close.addEventListener('click',()=>UI.closeModal()); actions.appendChild(close); actions.appendChild(add); card.appendChild(actions); UI.openModal(card);
  };

  // Per-device profiles use the existing stamp engines and do not change artwork.
  UI.brushStudio = function () {
    const brush=app().view.brush;
    if(brush.syncedEraser) { Q.toast('Switch back to the painting brush to edit its settings'); return; }
    const card=Q.crel('div'), title=Q.crel('h2'); title.textContent='Brush studio · '+brush.name; card.appendChild(title);
    card.appendChild(Q.crel('p','sub','Tune this brush on this device. Duplicate it to create a separate custom profile. Preview shows a painted mark even for erasers.'));
    const preview=Q.canvas(180,52); preview.className='studio-preview'; preview.setAttribute('aria-label','Live brush preview'); card.appendChild(preview);
    let pending=false; function renderPreview() { if(pending) return; pending=true; requestAnimationFrame(function(){ pending=false; if(preview.isConnected) Q.brushPreview(brush,preview,document.documentElement.getAttribute('data-theme')==='light' ? [35,34,32] : [240,236,232]); }); } renderPreview();
    const fields=[['Spacing','spacing',2,100],['Flow','flow',0,100],['Opacity','opacity',0,100],['Edge hardness','hardness',0,100],['Pressure size','pressureSize',0,100],['Pressure opacity','pressureAlpha',0,100],['Stabilization','streamline',0,90],['Speed size','velocitySize',0,100],['Taper in','taperIn',0,100],['Size jitter','jitter',0,100],['Scatter','scatter',0,100]];
    if(brush.engine==='grain') fields.push(['Grain','grain',0,100]);
    const settings=Q.Store.meta('brushSettings') || {};
    fields.forEach(function(field){
      const row=Q.crel('div','field studio-field'); row.appendChild(Q.crel('label',null,field[0])); const slider=Q.crel('input'); slider.type='range'; slider.min=field[2]; slider.max=field[3]; slider.value=Math.round((brush[field[1]]==null ? 0 : brush[field[1]])*100); slider.setAttribute('aria-label',field[0]);
      const value=Q.crel('div','val',slider.value+'%');
      slider.addEventListener('input',function(){
        const n=Number(slider.value)/100;
        if(brush.custom) { if(!Q.updateCustomBrush(brush,field[1],n)) { slider.value=Math.round((brush[field[1]]||0)*100); Q.toast('Could not save brush',3500); } }
        else { brush[field[1]]=n; settings[brush.id]=Object.assign({},settings[brush.id],{[field[1]]:n}); Q.Store.meta('brushSettings',settings); }
        value.textContent=slider.value+'%'; renderPreview();
      });
      row.appendChild(slider); row.appendChild(value); card.appendChild(row);
    });
    const actions=Q.crel('div','brush-studio-actions');
    const favorite=Q.crel('button','btn ghost'); function syncFavorite() { const on=Q.favoriteBrushes().includes(brush.id); favorite.innerHTML=icon(ICON.star); favorite.appendChild(document.createTextNode(on ? ' Remove favorite' : ' Add favorite')); favorite.setAttribute('aria-pressed',on ? 'true' : 'false'); } syncFavorite();
    favorite.addEventListener('click',function(){ if(!Q.setBrushFavorite(brush,!Q.favoriteBrushes().includes(brush.id))) { Q.toast('Could not save favorite',3500); return; } syncFavorite(); }); actions.appendChild(favorite);
    const duplicate=Q.crel('button','btn ghost','Duplicate brush'); duplicate.addEventListener('click',function(){ const result=Q.createCustomBrush(brush); if(result.error) { Q.toast(result.error,4000); return; } app().setBrush(result.brush.id); UI.brushStudio(); Q.toast('Custom brush created'); }); actions.appendChild(duplicate);
    if(brush.custom) {
      const rename=Q.crel('button','btn ghost','Rename brush'); rename.addEventListener('click',function(){ UI.renameBrushDialog(brush); }); actions.appendChild(rename);
      const del=Q.crel('button','btn danger','Delete brush'); del.addEventListener('click',function(){ UI.confirm('Delete custom brush?', 'This removes the custom brush from this device. Artwork pixels are not changed.',function(){ if(!Q.deleteCustomBrush(brush)) { Q.toast('Could not delete brush',4000); return; } const fallback=Q.brushById('studio'); if(app().lastPaintBrush===brush) app().lastPaintBrush=fallback; if(app().view.brush===brush) app().setBrush(fallback.id); UI.openTray('brushes'); Q.toast('Custom brush deleted'); }); }); actions.appendChild(del);
    }
    const reset=Q.crel('button','btn ghost','Reset'); reset.addEventListener('click',function(){
      if(brush.custom) { if(!Q.resetCustomBrush(brush)) { Q.toast('Could not reset brush',4000); return; } }
      else { const original=Q.BRUSH_DEFAULTS.find(b=>b.id===brush.id); if(!original) return; fields.forEach(f=>delete brush[f[1]]); Object.assign(brush,original); delete settings[brush.id]; Q.Store.meta('brushSettings',settings); }
      UI.brushStudio();
    }); actions.appendChild(reset);
    const done=Q.crel('button','btn primary','Done'); done.addEventListener('click',function(){ UI.closeModal(); UI.openTray('brushes'); }); actions.appendChild(done); card.appendChild(actions); UI.openModal(card); Q.el('#modalBody').scrollTop=0;
  };
  UI.renameBrushDialog = function(brush) {
    if(!brush || !brush.custom || !Q.BRUSHES.includes(brush)) return;
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Rename custom brush')); const row=Q.crel('div','field'); row.appendChild(Q.crel('label',null,'Name')); const input=Q.crel('input','select'); input.value=brush.name; input.maxLength=40; input.setAttribute('aria-label','Custom brush name'); row.appendChild(input); card.appendChild(row);
    const error=Q.crel('p','canvas-error'); error.setAttribute('role','alert'); card.appendChild(error);
    const actions=Q.crel('div','modal-actions'), cancel=Q.crel('button','btn ghost','Cancel'), save=Q.crel('button','btn primary','Save');
    cancel.addEventListener('click',function(){ UI.brushStudio(); }); save.addEventListener('click',function(){ const name=input.value.trim(); if(!name || name.length>40) { error.textContent='Enter a name of up to 40 characters.'; return; } if(!Q.renameCustomBrush(brush,name)) { error.textContent='Could not save this brush.'; return; } UI.brushStudio(); }); actions.appendChild(cancel); actions.appendChild(save); card.appendChild(actions); UI.openModal(card);
  };

  /* ── layers ─────────────────────────────────────────────── */

  UI.pickImage = function () {
    const d=app().doc; if (!d) return;
    app().stopPlay(); referenceGeneration++; UI.imageTarget={doc:d,frame:d.frames[d.activeFrame],layer:d.layer()};
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
    const target=app().doc, frame=target && target.frames[target.activeFrame]; if(!target) return;
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,kind==='solid' ? 'Solid colour layer' : 'Gradient layer'));
    card.appendChild(Q.crel('p','sub','Choose colours with the sliders or HEX. The preview updates before you create a raster layer on this frame; the result is not a live editable gradient.'));
    const preview=Q.crel('canvas','paint-preview'); preview.width=Math.max(1,Math.round(240*target.width/Math.max(target.width,target.height))); preview.height=Math.max(1,Math.round(240*target.height/Math.max(target.width,target.height))); preview.setAttribute('aria-label',kind==='gradient' ? 'Gradient preview' : 'Solid colour preview'); card.appendChild(preview);
    const err=Q.crel('p','canvas-error'); err.setAttribute('role','alert');
    function colorField(label,value) {
      const box=Q.crel('div','paint-colour'), row=Q.crel('div','field'); row.appendChild(Q.crel('label',null,label));
      const swatch=Q.crel('span','paint-swatch'); swatch.setAttribute('aria-hidden','true'); row.appendChild(swatch);
      const hex=Q.crel('input','select'); hex.type='text'; hex.value=value; hex.setAttribute('aria-label',label); row.appendChild(hex); box.appendChild(row);
      const hsv=Q.rgbToHsv(...Q.hexToRgb(value)), controls=[];
      [['Hue',360,hsv[0]],['Saturation',100,hsv[1]*100],['Brightness',100,hsv[2]*100]].forEach(function (spec,i) {
        const line=Q.crel('div','field paint-colour-slider'); line.appendChild(Q.crel('label',null,spec[0])); const input=Q.crel('input'); input.type='range'; input.min=0; input.max=spec[1]; input.value=Math.round(spec[2]); input.setAttribute('aria-label',label+' '+spec[0]); input.className='paint-range paint-'+spec[0].toLowerCase();
        const out=Q.crel('span','val'); line.appendChild(input); line.appendChild(out); box.appendChild(line); controls.push({input,out});
        input.addEventListener('input',function(){ const h=Number(controls[0].input.value),s=Number(controls[1].input.value)/100,v=Number(controls[2].input.value)/100; hex.value=Q.rgbToHex(Q.hsvToRgb(h,s,v)); refresh(); });
      });
      function syncFromHex() { const rgb=Q.hexToRgb(hex.value); if(rgb) { const v=Q.rgbToHsv(...rgb); if(v[1]) controls[0].input.value=Math.round(v[0]); controls[1].input.value=Math.round(v[1]*100); controls[2].input.value=Math.round(v[2]*100); } refresh(); }
      hex.addEventListener('input',syncFromHex); hex.addEventListener('change',syncFromHex);
      const alphaRow=Q.crel('div','field paint-colour-slider'); alphaRow.appendChild(Q.crel('label',null,'Opacity')); const alpha=Q.crel('input'); alpha.type='range'; alpha.min=0; alpha.max=100; alpha.value=100; alpha.setAttribute('aria-label',label+' opacity'); const alphaOut=Q.crel('span','val'); alphaRow.appendChild(alpha); alphaRow.appendChild(alphaOut); box.appendChild(alphaRow); alpha.addEventListener('input',refresh);
      const palette=Q.crel('div','paint-palette'); ['#000000','#ffffff','#ff3b30','#ff9500','#ffdf00','#34c759','#00bcd4','#007aff','#8a4dff','#ed4ca1'].forEach(function(color) { const b=Q.crel('button','paint-palette-swatch'); b.style.background=color; b.setAttribute('aria-label',label+' preset '+color); b.addEventListener('click',function(){hex.value=color; syncFromHex();}); palette.appendChild(b); }); box.appendChild(palette);
      card.appendChild(box); return {hex,swatch,controls,syncFromHex,alpha,alphaOut};
    }
    const first=colorField(kind==='solid' ? 'Colour' : 'Start colour',Q.rgbToHex(app().view.color));
    const second=kind==='gradient' ? colorField('End colour','#ffffff') : null;
    let dir=null,mid=null,angle=null,angleRow=null;
    if (kind==='gradient') {
      const row=Q.crel('div','field'); row.appendChild(Q.crel('label',null,'Direction')); dir=Q.crel('select'); dir.setAttribute('aria-label','Gradient direction'); [['horizontal','Horizontal'],['vertical','Vertical'],['diagonal','Diagonal'],['radial','Radial'],['angle','Custom angle']].forEach(function (v) { const o=Q.crel('option'); o.value=v[0]; o.textContent=v[1]; dir.appendChild(o); }); row.appendChild(dir); card.appendChild(row); dir.addEventListener('change',refresh);
      angleRow=Q.crel('div','field'); angleRow.appendChild(Q.crel('label',null,'Angle')); angle=Q.crel('input'); angle.type='range'; angle.min=-180; angle.max=180; angle.step=1; angle.value=0; angle.setAttribute('aria-label','Gradient angle'); const angleVal=Q.crel('span','val'); angleRow.appendChild(angle); angleRow.appendChild(angleVal); angle._readout=angleVal; angle.addEventListener('input',refresh); card.appendChild(angleRow);
      const midrow=Q.crel('div','field'); midrow.appendChild(Q.crel('label',null,'Midpoint')); mid=Q.crel('input'); mid.type='range'; mid.min=10; mid.max=90; mid.value=50; mid.setAttribute('aria-label','Gradient midpoint'); const val=Q.crel('span','val'); midrow.appendChild(mid); midrow.appendChild(val); card.appendChild(midrow); mid.addEventListener('input',refresh); mid._readout=val;
      const swap=Q.crel('button','btn ghost','Swap colours'); swap.addEventListener('click',function(){ const tmp=first.hex.value; first.hex.value=second.hex.value; second.hex.value=tmp; const alpha=first.alpha.value; first.alpha.value=second.alpha.value; second.alpha.value=alpha; first.syncFromHex(); second.syncFromHex(); }); card.appendChild(swap);
    }
    function refresh() {
      [first,second].filter(Boolean).forEach(function(f){ const rgb=Q.hexToRgb(f.hex.value); if(rgb) f.swatch.style.background=Q.rgbToHex(rgb); f.controls.forEach((c,i)=>{c.out.textContent=c.input.value+(i ? '%' : '°');}); f.alphaOut.textContent=f.alpha.value+'%'; f.swatch.style.opacity=String(Number(f.alpha.value)/100); const hue=Q.rgbToHex(Q.hsvToRgb(Number(f.controls[0].input.value),1,1)); f.controls[1].input.style.setProperty('--hue-color',hue); f.controls[2].input.style.setProperty('--hue-color',hue); });
      if(mid) mid._readout.textContent=mid.value+'%'; if(angle) { angle._readout.textContent=angle.value+'°'; angleRow.classList.toggle('hidden',dir.value!=='angle'); }
      const ctx=preview.getContext('2d'); ctx.clearRect(0,0,preview.width,preview.height);
      const valid=Q.renderPaintFill(ctx,preview.width,preview.height,kind,first.hex.value,second ? second.hex.value : '',dir ? dir.value : '',mid ? Number(mid.value)/100 : 0.5,{angle:angle ? Number(angle.value) : 0,alpha1:Number(first.alpha.value)/100,alpha2:second ? Number(second.alpha.value)/100 : 1});
      err.textContent=valid ? '' : 'Enter a 3- or 6-digit hex colour.'; preview.style.opacity=valid ? '1' : '0.25';
    }
    card.appendChild(err); const actions=Q.crel('div','modal-actions'), cancel=Q.crel('button','btn ghost','Cancel'), create=Q.crel('button','btn primary','Create layer');
    cancel.addEventListener('click',function () { UI.closeModal(); });
    create.addEventListener('click',function () { if(app().doc!==target || target.frames[target.activeFrame]!==frame) { err.textContent='Artwork or frame changed; reopen this dialog.'; return; } if (!Q.hexToRgb(first.hex.value) || (second && !Q.hexToRgb(second.hex.value))) { err.textContent='Enter a 3- or 6-digit hex colour.'; return; } if (app().addPaintLayer(kind,first.hex.value,second ? second.hex.value : '',dir ? dir.value : '',mid ? Number(mid.value)/100 : 0.5,{angle:angle ? Number(angle.value) : 0,alpha1:Number(first.alpha.value)/100,alpha2:second ? Number(second.alpha.value)/100 : 1})) UI.closeModal(); });
    actions.appendChild(cancel); actions.appendChild(create); card.appendChild(actions); UI.openModal(card); refresh();
  };

  function buildLayers(root) {
    const d = app().doc;
    if (!d) return;
    root = root || Q.el('#trayBody');
    root.innerHTML = '';

    if (d.solo) { const restore=Q.crel('button','btn ghost','Restore layer visibility'); restore.addEventListener('click',function(){ app().restoreSolo(); }); root.appendChild(restore); const note=Q.crel('p','sub','Solo is active. Restoring returns saved visibility for existing layers; changes made while soloed are replaced. A clipped layer keeps its base visible.'); root.appendChild(note); }
    const addBtn=iconButton('Add layer or image',ICON.plus,function () { UI.addLayerDialog(); });
    const dupBtn=iconButton('Duplicate layer',ICON.copy,function () { app().duplicateLayer(); });
    const mergeBtn=iconButton('Merge layer down',ICON.merge,function () { app().mergeDownLayer(d.activeLayer); });
    root.appendChild(trayHead('Layers · ' + d.layers.length,[addBtn,dupBtn,mergeBtn]));
    if(layerSelectionDoc!==d) { layerSelectionDoc=d; layerSelection=new Set(); layerSelectMode=false; }
    const live=new Set(d.layers.map(l=>l.id)); layerSelection=new Set([...layerSelection].filter(id=>live.has(id)));
    layerSelection.add(d.layer().id);
    const controls=Q.crel('div','layer-selection-controls');
    const mode=Q.crel('button','chip'+(layerSelectMode ? ' on' : ''),layerSelectMode ? 'Done selecting' : 'Select layers');
    mode.setAttribute('aria-pressed',layerSelectMode ? 'true' : 'false'); mode.addEventListener('click',function(){ layerSelectMode=!layerSelectMode; buildLayers(root); }); controls.appendChild(mode);
    const all=Q.crel('button','chip','Select all'); all.addEventListener('click',function(){ layerSelectMode=true; layerSelection=new Set(d.layers.map(l=>l.id)); buildLayers(root); }); controls.appendChild(all);
    if(layerSelection.size>1) { const batch=Q.crel('button','chip on','Actions · '+layerSelection.size); batch.addEventListener('click',function(){ UI.batchLayerSheet(d,[...layerSelection]); }); controls.appendChild(batch); }
    root.appendChild(controls);
    const hint=Q.crel('div','layer-select-hint',layerSelectMode ? 'Tap layers to add or remove · the active layer stays selected' : 'Swipe a layer right to select it · tap to make it active'); root.appendChild(hint);


    const list = Q.crel('div', 'layer-list');
    for (let i = d.layers.length - 1; i >= 0; i--) {
      const layer = d.layers[i];
      const row = Q.crel('div', 'layer-row' + (i === d.activeLayer ? ' on' : '') + (layerSelection.has(layer.id) && i!==d.activeLayer ? ' multi-selected' : ''));
      row.setAttribute('role','button'); row.setAttribute('tabindex','0'); row.setAttribute('aria-label',layer.name+(i===d.activeLayer ? ', active layer' : '')+(Q.layerTag(layer.tag) ? ', '+Q.layerTag(layer.tag)+' tag' : '')); row.setAttribute('aria-pressed',layerSelection.has(layer.id) ? 'true' : 'false');

      if(Q.layerTag(layer.tag)) { const marker=Q.crel('span','layer-tag tag-'+Q.layerTag(layer.tag)); marker.setAttribute('aria-hidden','true'); row.appendChild(marker); }
      const thumb = Q.crel('div', 'layer-thumb');
      const tcv = d.layerThumbnail(i, 46);
      thumb.appendChild(tcv);
      row.appendChild(thumb);

      const meta = Q.crel('div', 'layer-meta');
      meta.appendChild(Q.crel('div', 'layer-name', escapeHtml(layer.name)));
      const sub = Q.crel('div', 'layer-sub', Math.round(layer.opacity * 100) + '% · ' + (layer.clipped ? 'Normal (clipped)' : blendLabel(layer.blend)) + (layer.locked ? ' · Locked' : '') + (layer.alphaLocked ? ' · Alpha locked' : '') + (d.solo && d.solo.target===layer.id ? ' · Solo' : '') + (layerSelection.size>1 && i===d.activeLayer ? ' · Active' : ''));
      meta.appendChild(sub);
      row.appendChild(meta);

      const tools = Q.crel('div', 'layer-tools');
      const eye = Q.crel('button', 'mini-btn', icon(layer.visible ? ICON.eye : ICON.eyeOff));
      eye.setAttribute('aria-label',(layer.visible ? 'Hide ' : 'Show ')+layer.name); eye.title='Tap visibility · hold to solo or restore'; if(d.solo && d.solo.target===layer.id) eye.classList.add('on');
      let press=null, suppressEye=false;
      eye.addEventListener('pointerdown',function(e){ e.stopPropagation(); const p={id:e.pointerId,x:e.clientX,y:e.clientY,held:false,layerId:layer.id}; press=p; p.timer=setTimeout(()=>{ if(press===p) p.held=true; },600); try { eye.setPointerCapture(e.pointerId); } catch(err) {} });
      eye.addEventListener('pointermove',function(e){ if(press && e.pointerId===press.id && Math.hypot(e.clientX-press.x,e.clientY-press.y)>8) { clearTimeout(press.timer); press.moved=true; press.held=false; } });
      function finishEye(e){ if(!press || e.pointerId!==press.id) return; e.stopPropagation(); const p=press; press=null; clearTimeout(p.timer); if(p.held || p.moved || e.type==='pointercancel') { suppressEye=true; setTimeout(()=>{suppressEye=false;},500); if(p.held && !p.moved && e.type!=='pointercancel' && app().doc===d && d.layers[i] && d.layers[i].id===p.layerId) app().toggleSolo(i); } }
      eye.addEventListener('pointerup',finishEye); eye.addEventListener('pointercancel',finishEye); eye.addEventListener('contextmenu',e=>e.preventDefault());
      eye.addEventListener('click', function (e) { e.stopPropagation(); if(suppressEye) { suppressEye=false; return; } app().setLayerProp(i, 'visible', !layer.visible); buildLayers(root); });
      tools.appendChild(eye);

      const alpha=Q.crel('button','mini-btn alpha-lock'+(layer.alphaLocked ? ' on' : ''),icon(ICON.alphaLock));
      alpha.setAttribute('aria-label',(layer.alphaLocked ? 'Unlock alpha: ' : 'Lock alpha: ')+layer.name); alpha.setAttribute('aria-pressed',layer.alphaLocked ? 'true' : 'false'); alpha.title='Toggle alpha lock';
      alpha.addEventListener('click',function(e) { e.stopPropagation(); if(app().doc!==d || !d.layers[i] || d.layers[i].id!==layer.id) return; app().stopPlay(); app().setLayerProp(i,'alphaLocked',!d.layers[i].alphaLocked); Q.toast(d.layers[i].alphaLocked ? 'Alpha lock on' : 'Alpha lock off'); });
      tools.appendChild(alpha);

      const more = Q.crel('button', 'mini-btn', '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>');
      more.setAttribute('aria-label','Layer options: '+layer.name); more.title='Layer options';
      more.addEventListener('click', function (e) {
        e.stopPropagation();
        UI.layerSheet(i);
      });
      tools.appendChild(more);
      row.appendChild(tools);

      let suppressRowClick=false;
      function toggleSelected() {
        if(app().doc!==d || !d.layers.some(l=>l.id===layer.id) || layer.id===d.layer().id) return;
        if(layerSelection.has(layer.id)) layerSelection.delete(layer.id); else layerSelection.add(layer.id);
        buildLayers(root);
      }
      row.addEventListener('click', function () {
        if(suppressRowClick) { suppressRowClick=false; return; }
        if(app().doc!==d || d.layers[i]!==layer) return;
        if(layerSelectMode) toggleSelected();
        else { d.activeLayer=i; layerSelection=new Set([layer.id]); UI.syncDoc(); }
      });
      row.addEventListener('keydown',function(e){ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); row.click(); } });
      let swipe=null;
      row.addEventListener('pointerdown',function(e){ if(e.target.closest('button') || e.isPrimary===false && e.pointerType==='touch') return; swipe={id:e.pointerId,x:e.clientX,y:e.clientY}; });
      row.addEventListener('pointerup',function(e){
        if(!swipe || swipe.id!==e.pointerId) return;
        const dx=e.clientX-swipe.x, dy=e.clientY-swipe.y; swipe=null;
        if(dx>=45 && dx>Math.abs(dy)*1.5) { suppressRowClick=true; toggleSelected(); setTimeout(()=>{suppressRowClick=false;},500); }
      });
      row.addEventListener('pointercancel',function(){ swipe=null; });
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

  UI.batchLayerSheet = function(d,ids) {
    if(app().doc!==d) return;
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Selected layers · '+ids.length));
    card.appendChild(Q.crel('p','sub','Actions apply to every frame and are undoable. Copies use up to 64 MiB of new cel pixels. Duplicating or reordering can change clipping relationships. Drawing and transforms still affect only the active layer. Restore solo before batch edits.'));
    const grid=Q.crel('div','menu-grid');
    function run(action) {
      if(app().doc!==d) { Q.toast('Artwork changed; select layers again'); return; }
      app().stopPlay(); const error=d.batchLayers(ids,action);
      if(error) { Q.toast(error,4000); return; }
      if(action==='delete') { layerSelection=new Set([d.layer().id]); layerSelectMode=false; }
      app().view.dirty=true; app().markDirty(); UI.syncDoc(); Q.toast('Layers updated · Undo to restore');
    }
    [['Duplicate selected','duplicate',ICON.copy],['Show selected','show',ICON.eye],['Hide selected','hide',ICON.eyeOff],['Lock selected','lock',ICON.alphaLock],['Unlock selected','unlock',ICON.alphaLock],['Move to top','top',ICON.up],['Move to bottom','bottom',ICON.down],['Delete selected','delete',ICON.trash]].forEach(function(item){
      const b=Q.crel('button','menu-item'+(item[1]==='delete' ? ' danger' : '')); b.innerHTML=icon(item[2]); b.appendChild(document.createTextNode(item[0]));
      b.addEventListener('click',function(){ UI.closeModal(); if(item[1]==='delete') UI.confirm('Delete selected layers?', 'This removes the selected layers and their cels in every frame. Locked layers cannot be deleted. Undo restores them.',function(){run('delete');}); else run(item[1]); }); grid.appendChild(b);
    });
    card.appendChild(grid); const close=Q.crel('button','btn ghost','Close'); close.addEventListener('click',UI.closeModal); card.appendChild(close); UI.openModal(card);
  };

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
    const opacity=Q.crel('div','field'); opacity.appendChild(Q.crel('label',null,'Opacity'));
    const slider=Q.crel('input'); slider.type='range'; slider.min=0; slider.max=100; slider.value=Math.round(layer.opacity*100); slider.setAttribute('aria-label','Layer opacity');
    const output=Q.crel('span','val',slider.value+'%'); slider.addEventListener('input',function(){ output.textContent=slider.value+'%'; });
    slider.addEventListener('change',function(){ if(app().doc!==d || !d.layers[i] || d.layers[i].id!==layer.id) return; app().setLayerProp(i,'opacity',Number(slider.value)/100); });
    opacity.appendChild(slider); opacity.appendChild(output); card.appendChild(opacity);
    const tagField=Q.crel('div','field'); tagField.appendChild(Q.crel('label',null,'Colour tag'));
    const tagSelect=Q.crel('select'); tagSelect.setAttribute('aria-label','Layer colour tag');
    Q.LAYER_TAGS.forEach(function(tag){ const option=Q.crel('option'); option.value=tag; option.textContent=tag ? tag[0].toUpperCase()+tag.slice(1) : 'None'; tagSelect.appendChild(option); }); tagSelect.value=Q.layerTag(layer.tag);
    tagSelect.addEventListener('change',function(){ if(app().doc!==d || !d.layers[i] || d.layers[i].id!==layer.id) return; const tag=Q.layerTag(tagSelect.value); if(Q.layerTag(d.layers[i].tag)!==tag) app().setLayerProp(i,'tag',tag); });
    tagField.appendChild(tagSelect); card.appendChild(tagField);



    const actions = Q.crel('div', 'menu-grid');
    const mk = function (label, ico, fn, danger) {
      const b = Q.crel('button', 'menu-item' + (danger ? ' danger' : ''));
      b.innerHTML = icon(ico);
      b.appendChild(document.createTextNode(label));
      b.addEventListener('click', function () { UI.closeModal(); fn(); });
      return b;
    };
    actions.appendChild(mk(d.solo && d.solo.target===layer.id ? 'Restore visibility' : 'Solo layer', ICON.eye, function () { app().toggleSolo(i); }));
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
    return { hue: hsv[1] ? hsv[0] : wheelState.hue, sat: hsv[1], val: hsv[2] };
  }

  function buildColor(root) {
    const hsv = currentHsv();
    wheelState.hue = hsv.hue;
    wheelState.sat = hsv.sat;
    wheelState.val = hsv.val;

    root.appendChild(trayHead('Colour', [iconButton('Saved palette',ICON.palette,function () { UI.savedPaletteDialog(); }), iconButton('Colour harmonies',ICON.harmony,function () { UI.harmonyDialog(applyColor); }), iconButton('Pure hue',ICON.pureHue,function () { applyColor(Q.hsvToRgb(wheelState.hue,1,1)); })]));
    const wrap = Q.crel('div', 'color-wrap');

    const wheel = Q.crel('canvas');
    wheel.id = 'wheel';
    wheel.setAttribute('aria-label','Colour wheel and saturation/value square');
    wheel.title = 'Double-tap the upper-right corner of the square for pure hue';
    wrap.appendChild(wheel);

    const side = Q.crel('div', 'color-side');

    const hexRow = Q.crel('div', 'hexrow');
    const hex = Q.crel('input');
    hex.setAttribute('aria-label','Current hex colour');
    hex.value = Q.rgbToHex(app().view.color);
    hex.addEventListener('change', function () {
      const rgb = Q.hexToRgb(hex.value);
      if (rgb) applyColor(rgb);
      else hex.value = Q.rgbToHex(app().view.color);
    });
    hexRow.appendChild(hex);
    side.appendChild(hexRow);
    side.appendChild(Q.crel('div','layer-sub','Pure hue: use the droplet-plus button or double-tap the square’s upper-right corner.'));

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
      if (h[1]) wheelState.hue = h[0]; wheelState.sat = h[1]; wheelState.val = h[2];
      drawWheel(wheel);
    }
  }

  UI.savedPaletteDialog = function () {
    const target=app().doc; let mode='use', selected=null, active=Q.paletteSets().active;
    const card=Q.crel('div'), heading=Q.crel('h2',null,'Saved palette'); card.appendChild(heading);
    card.appendChild(Q.crel('p','sub','Keep up to 8 device-local palettes of 24 colours. Use swatches, remove or swap them, or extract approximate colours from the active layer. Palettes are not stored in projects.'));
    const setRow=Q.crel('div','field studio-field'); setRow.appendChild(Q.crel('label',null,'Palette')); const setSelect=Q.crel('select'); setSelect.setAttribute('aria-label','Palette set'); setRow.appendChild(setSelect); card.appendChild(setRow);
    const status=Q.crel('p','sub'), grid=Q.crel('div','saved-palette-grid'); card.appendChild(status); card.appendChild(grid);
    const actions=Q.crel('div','palette-actions'), add=Q.crel('button','btn primary','Add current colour'), extract=Q.crel('button','btn ghost','Extract layer colours'), remove=Q.crel('button','btn ghost','Remove mode'), reorder=Q.crel('button','btn ghost','Reorder mode'), sortHue=Q.crel('button','btn ghost','Sort by hue'), sortValue=Q.crel('button','btn ghost','Sort by brightness'), clear=Q.crel('button','btn ghost','Clear palette'), close=Q.crel('button','btn ghost','Close');
    function save(colors,expected) { if(!Q.writeSavedPalette(colors,expected || active)) { Q.toast('Could not save palette on this device',4000); return false; } return true; }
    function draw() {
      const state=Q.paletteSets(); active=state.active; setSelect.innerHTML=''; state.palettes.forEach(function(p){const o=Q.crel('option'); o.value=p.id; o.textContent=p.name; setSelect.appendChild(o);}); setSelect.value=active; setSelect.disabled=!!state.error;
      const colors=Q.readSavedPalette(); if(selected && !colors.includes(selected)) selected=null;
      status.textContent=(state.error ? state.error+' · ' : '')+colors.length+' / 24 colours'+(mode==='remove' ? ' · tap a swatch to remove' : mode==='reorder' ? (selected ? ' · tap a second swatch to swap' : ' · tap a swatch to move') : ''); grid.innerHTML='';
      remove.setAttribute('aria-pressed',mode==='remove' ? 'true' : 'false'); remove.classList.toggle('on',mode==='remove'); reorder.setAttribute('aria-pressed',mode==='reorder' ? 'true' : 'false'); reorder.classList.toggle('on',mode==='reorder'); clear.disabled=!colors.length; sortHue.disabled=sortValue.disabled=colors.length<2;
      colors.forEach(function(hex){ const button=Q.crel('button','saved-palette-swatch'); button.style.background=hex; button.setAttribute('aria-label',(mode==='remove' ? 'Remove ' : mode==='reorder' ? 'Reorder ' : 'Use ')+hex); button.title=hex;
        if(mode==='reorder') { button.setAttribute('aria-pressed',selected===hex ? 'true' : 'false'); button.classList.toggle('selected',selected===hex); }
        button.addEventListener('click',function(){
          const current=Q.readSavedPalette();
          if(mode==='remove') { if(save(current.filter(c=>c!==hex))) draw(); }
          else if(mode==='reorder') { if(!selected) { selected=hex; draw(); } else if(selected===hex) { selected=null; draw(); } else { const a=current.indexOf(selected), b=current.indexOf(hex); if(a>=0 && b>=0) { [current[a],current[b]]=[current[b],current[a]]; if(!save(current)) return; } selected=null; draw(); } }
          else { const rgb=Q.hexToRgb(hex); if(rgb && app().view) { app().setColor(rgb); UI.closeModal(); if(tray==='color') UI.openTray('color'); } }
        }); grid.appendChild(button);
      });
    }
    setSelect.addEventListener('change',function(){ const result=Q.selectPalette(setSelect.value); if(result.error) { Q.toast(result.error,4000); setSelect.value=active; return; } active=result.active; selected=null; mode='use'; draw(); });
    add.addEventListener('click',function(){ const colors=Q.readSavedPalette(), hex=Q.rgbToHex(app().view.color); if(colors.includes(hex)) { Q.toast('Colour is already saved'); return; } if(colors.length>=24) { Q.toast('Palette is full'); return; } colors.push(hex); if(save(colors)) draw(); });
    extract.addEventListener('click',function(){
      if(!target || app().doc!==target) { Q.toast('Artwork changed; reopen the palette'); return; }
      const colors=Q.readSavedPalette(), cel=target.activeCel(false);
      if(colors.length>=24) { Q.toast('Palette is full'); return; }
      if(!cel) { Q.toast('The active layer on this frame is empty'); return; }
      let candidates; try { candidates=Q.extractCelColors(cel,24); } catch(e) { Q.toast('Could not read layer colours',4000); return; }
      let added=0; for(const hex of candidates) if(!colors.includes(hex) && colors.length<24 && added<8) { colors.push(hex); added++; }
      if(!added) { Q.toast(candidates.length ? 'No new colours found' : 'No visible colours found'); return; }
      if(save(colors)) { draw(); Q.toast('Added '+added+' layer colour'+(added===1 ? '' : 's')); }
    });
    remove.addEventListener('click',function(){ mode=mode==='remove' ? 'use' : 'remove'; selected=null; draw(); });
    reorder.addEventListener('click',function(){ mode=mode==='reorder' ? 'use' : 'reorder'; selected=null; draw(); });
    sortHue.addEventListener('click',function(){ if(save(Q.sortPalette(Q.readSavedPalette(),'hue'))) { selected=null; draw(); } });
    sortValue.addEventListener('click',function(){ if(save(Q.sortPalette(Q.readSavedPalette(),'brightness'))) { selected=null; draw(); } });
    clear.addEventListener('click',function(){ const id=active; UI.confirm('Clear saved palette?', 'This clears colours from the selected palette on this device. Other palettes and artwork pixels will not change.',function(){ if(save([],id)) Q.toast('Palette cleared'); }); });
    const manage=Q.crel('button','btn ghost','Manage palettes'), codes=Q.crel('button','btn ghost','Palette HEX codes'); manage.addEventListener('click',function(){UI.paletteManager();}); codes.addEventListener('click',function(){UI.paletteHexDialog();});
    close.addEventListener('click',UI.closeModal); [add,extract,remove,reorder,sortHue,sortValue,manage,codes,clear,close].forEach(b=>actions.appendChild(b)); card.appendChild(actions); UI.openModal(card); Q.el('#modalBody').scrollTop=0; draw();
  };

  UI.paletteManager = function () {
    const state=Q.paletteSets(), active=state.palettes.find(p=>p.id===state.active);
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Manage palettes')); const info=Q.crel('p','sub'); info.textContent=state.error || ('Selected: '+active.name+' · '+state.palettes.length+' / 8 palettes. Palettes are saved on this device, not inside artwork.'); card.appendChild(info);
    const actions=Q.crel('div','palette-actions');
    [['New palette','create'],['Duplicate palette','duplicate'],['Rename palette','rename']].forEach(function(pair){const b=Q.crel('button','btn ghost',pair[0]); b.disabled=!!state.error; b.addEventListener('click',function(){UI.paletteNameDialog(pair[1],state.active);}); actions.appendChild(b);});
    const del=Q.crel('button','btn danger','Delete palette'); del.disabled=!!state.error || state.palettes.length<=1; del.addEventListener('click',function(){ UI.confirm('Delete selected palette?', 'This removes the selected palette and its colours from this device. Artwork and other palettes are unchanged.',function(){const result=Q.managePalette('delete',state.active); if(result.error) Q.toast(result.error,4000); UI.savedPaletteDialog();},'Delete palette'); }); actions.appendChild(del);
    const close=Q.crel('button','btn primary','Back to palette'); close.addEventListener('click',function(){UI.savedPaletteDialog();}); actions.appendChild(close); card.appendChild(actions); UI.openModal(card); Q.el('#modalBody').scrollTop=0;
  };
  UI.paletteNameDialog = function (op,id) {
    const state=Q.paletteSets(), palette=state.palettes.find(p=>p.id===id); if(state.error || !palette || state.active!==id) { Q.toast('Palette changed; reopen the dialog',4000); UI.savedPaletteDialog(); return; }
    const title=op==='create' ? 'New palette' : op==='duplicate' ? 'Duplicate palette' : 'Rename palette', card=Q.crel('div'); card.appendChild(Q.crel('h2',null,title));
    const row=Q.crel('div','field'); row.appendChild(Q.crel('label',null,'Name')); const input=Q.crel('input','select'); input.maxLength=40; input.value=op==='create' ? '' : op==='duplicate' ? palette.name.slice(0,35)+' copy' : palette.name; input.setAttribute('aria-label','Palette name'); row.appendChild(input); card.appendChild(row);
    const error=Q.crel('p','canvas-error'); error.setAttribute('role','alert'); card.appendChild(error); const actions=Q.crel('div','modal-actions'), cancel=Q.crel('button','btn ghost','Cancel'), save=Q.crel('button','btn primary','Save');
    cancel.addEventListener('click',function(){UI.paletteManager();}); save.addEventListener('click',function(){const result=Q.managePalette(op,id,input.value); if(result.error) {error.textContent=result.error;return;} UI.savedPaletteDialog();}); actions.appendChild(cancel); actions.appendChild(save); card.appendChild(actions); UI.openModal(card); Q.el('#modalBody').scrollTop=0;
  };
  UI.paletteHexDialog = function () {
    const state=Q.paletteSets(), id=state.active, palette=state.palettes.find(p=>p.id===id), card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Palette HEX codes'));
    card.appendChild(Q.crel('p','sub','Select and copy the current codes using your device. Paste HEX codes below, separated by spaces, commas or new lines, to add them. Duplicates are skipped; no artwork is changed.'));
    const current=Q.crel('textarea','select palette-textarea'); current.readOnly=true; current.value=palette.colors.join('\n'); current.setAttribute('aria-label','Current palette HEX codes'); card.appendChild(current);
    const input=Q.crel('textarea','select palette-textarea'); input.maxLength=2048; input.placeholder='#ff0000, #00ff00, #0000ff'; input.setAttribute('aria-label','Paste HEX colours'); card.appendChild(input);
    const error=Q.crel('p','canvas-error'); error.setAttribute('role','alert'); card.appendChild(error); const actions=Q.crel('div','palette-actions'), select=Q.crel('button','btn ghost','Select current codes'), add=Q.crel('button','btn primary','Add HEX colours'), close=Q.crel('button','btn ghost','Back to palette');
    select.disabled=!palette.colors.length; select.addEventListener('click',function(){current.focus();current.select();});
    add.disabled=!!state.error; add.addEventListener('click',function(){
      const currentState=Q.paletteSets(); if(currentState.error || currentState.active!==id) {error.textContent=currentState.error || 'Palette changed; reopen this dialog.';return;}
      const parsed=Q.parsePaletteHex(input.value); if(parsed.error) {error.textContent=parsed.error;return;}
      const colors=Q.readSavedPalette(), additions=parsed.colors.filter(c=>!colors.includes(c)); if(!additions.length) {error.textContent='All those colours are already saved.';return;}
      if(colors.length+additions.length>24) {error.textContent='Not enough space; a palette holds 24 colours.';return;}
      if(!Q.writeSavedPalette(colors.concat(additions),id)) {error.textContent='Could not save palette on this device.';return;} UI.savedPaletteDialog(); Q.toast('Added '+additions.length+' colour'+(additions.length===1 ? '' : 's'));
    }); close.addEventListener('click',function(){UI.savedPaletteDialog();}); [select,add,close].forEach(b=>actions.appendChild(b)); card.appendChild(actions); UI.openModal(card); Q.el('#modalBody').scrollTop=0;
  };

  UI.harmonyDialog = function (applyColor) {
    const source=currentHsv(), colors=Q.colorHarmonies(source.hue,source.sat,source.val), card=Q.crel('div');
    card.appendChild(Q.crel('h2',null,'Colour harmonies'));
    card.appendChild(Q.crel('p','sub','Suggestions from the current hue: analogous, complementary, triadic and split complementary. Saturation is at least 50% and brightness at least 65%; neutral colours use the last picker hue. Tap a suggestion to use it. Reopen to generate from your new colour.'));
    const grid=Q.crel('div','harmony-grid');
    colors.forEach(function (entry) {
      const hex=Q.rgbToHex(entry.rgb), b=Q.crel('button','harmony-item'); b.setAttribute('aria-label',entry.name+' '+hex); b.title=entry.name+' '+hex;
      const sample=Q.crel('span','harmony-sample'); sample.style.background=hex; b.appendChild(sample); b.appendChild(Q.crel('span',null,entry.name+' · '+hex));
      b.addEventListener('click',function () { applyColor(entry.rgb); UI.closeModal(); }); grid.appendChild(b);
    }); card.appendChild(grid);
    const close=Q.crel('button','btn ghost','Close'); close.addEventListener('click',()=>UI.closeModal()); card.appendChild(close); UI.openModal(card);
  };

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
    let mode = null, tap = null, lastCornerTap = null;
    // A deliberate double tap in the square's upper-right corner selects the
    // current hue at full saturation and value. Other taps/drags remain picks.
    function inPureCorner(e) {
      const r=canvas.getBoundingClientRect(), S=Math.min(r.width,r.height), R=S/2-2;
      const sq=(R-R*0.16-3)*0.92, x=e.clientX-r.left-r.width/2, y=e.clientY-r.top-r.height/2;
      return sq>0 && x>=sq*0.22 && x<=sq/2 && y>=-sq/2 && y<=-sq*0.22;
    }
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
      tap={id:e.pointerId,x:e.clientX,y:e.clientY,corner:inPureCorner(e),moved:false,time:Q.now()};
      pick(e);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (tap && tap.id===e.pointerId && Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>12) tap.moved=true;
      if (canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) pick(e);
    });
    canvas.addEventListener('pointerup', function (e) {
      const now=Q.now(), valid=tap && tap.id===e.pointerId && tap.corner && !tap.moved && now-tap.time<=350 && inPureCorner(e) && Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<=12;
      if (valid && lastCornerTap && now-lastCornerTap.time<=350 && Math.hypot(e.clientX-lastCornerTap.x,e.clientY-lastCornerTap.y)<=24) {
        wheelState.sat=1; wheelState.val=1;
        const rgb=Q.hsvToRgb(wheelState.hue,1,1); app().setColor(rgb);
        const hexInput=Q.el('#trayBody .hexrow input'); if(hexInput) hexInput.value=Q.rgbToHex(rgb);
        drawWheel(canvas); lastCornerTap=null;
      } else lastCornerTap=valid ? {time:now,x:e.clientX,y:e.clientY} : null;
      tap=null; mode=null;
    });
    canvas.addEventListener('pointercancel', function () { tap=null; lastCornerTap=null; mode=null; });
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
      ['Selection & transform',ICON.copy,()=>UI.selectionDialog()], ['Recolour matching pixels',ICON.swatch,()=>UI.recolorDialog()], ['Clear current cel',ICON.clear,()=>UI.clearCelDialog()], ['Cut, copy & paste',ICON.paste,()=>UI.quickEditDialog()], ['Fill settings',ICON.sparkle,()=>UI.fillSettings()]
    ]);
    group('Canvas & view', [
      ['Canvas background',ICON.sparkle,()=>UI.backgroundDialog()], ['Drawing guides',ICON.sparkle,()=>UI.guideDialog()],
      ['Canvas reference',ICON.photo,()=>{UI.closeTray(); UI.openReference();}], ['Flip canvas',ICON.flip,()=>app().flipCanvas()],
      ['Rotate 90°',ICON.reset,()=>app().view.rotateBy(90)], ['Zoom to fit',ICON.layers,()=>app().view.fit()],
      [app().view.transparentPreview ? 'Show canvas background' : 'Preview transparency',ICON.transparency,()=>{ app().view.transparentPreview=!app().view.transparentPreview; app().view.dirty=true; Q.toast(app().view.transparentPreview ? 'Transparency preview on' : 'Canvas background shown'); root.innerHTML=''; buildMenu(root); }],
      ['Hide interface',ICON.focus,()=>UI.setFocusMode(true)]
    ]);
    const animation=[['Add frame',ICON.film,()=>app().addFrame(true)], ['Animation timeline',ICON.film,()=>{UI.closeTray(); if (!timelineOpen) UI.toggleTimeline();}],
      ['Onion skin',ICON.sparkle,()=>{if (!d) return; d.onion=!d.onion; app().view.dirty=true; app().markDirty(); Q.toast(d.onion ? 'Onion skin on' : 'Onion skin off'); root.innerHTML=''; buildMenu(root);}]];
    if (d && d.frames.length>1) animation.push(['Delete frame',ICON.trash,()=>app().deleteFrame()]);
    group('Animation',animation);
    group('Export', [
      ['Export PNG',ICON.photo,()=>app().exportPng()], ['Transparent PNG',ICON.photo,()=>app().exportPng(true)], ['Export JPEG',ICON.photo,()=>UI.jpegDialog()],
      ['Export GIF',ICON.film,()=>UI.exportDialog()], ['Export PNG frames',ICON.photo,()=>{UI.closeTray(); app().exportPngSequence();}],
      ['Transparent PNG frames',ICON.photo,()=>{UI.closeTray(); app().exportPngSequence(true);}], ['Export sprite sheet',ICON.photo,()=>UI.spriteSheetDialog()],
      ['Export MP4',ICON.film,()=>{UI.closeTray(); UI.mp4Dialog();}]
    ]);
    group('Preferences', [ ['Smudge edge',ICON.controls,()=>UI.smudgePreferences()], ['Interface appearance',ICON.appearance,()=>UI.themeDialog()], ['Pressure & smoothing',ICON.controls,()=>UI.pressurePreferences()], ['Brush slider layout',ICON.railLayout,()=>UI.railPreferencesDialog()], ['Hold gesture timing',ICON.gestureDelay,()=>UI.gesturePreferences()] ]);
    group('File & help', [ ['Artwork details',ICON.controls,()=>UI.artworkDetails()], ['Save now',ICON.save,()=>app().saveNow(true)], ['Gestures & help',ICON.sparkle,()=>UI.helpSheet()], ['About Qelem',ICON.layers,()=>UI.aboutSheet()] ]);

    const info = Q.crel('div', 'layer-sub');
    info.style.margin = '12px 2px 0';
    info.textContent = d ? ('Canvas ' + d.width + '×' + d.height + ' · ' + d.memoryMB() + ' MB · stored on device (' + Q.Store.mode() + ')') : '';
    root.appendChild(info);
  }

  let referenceTimer = 0, referenceGeneration = 0, referenceMode='canvas';
  UI.resizeReference = function () {
    const cv = Q.el('#referenceCanvas'); cv.style.width = (100 * Number(Q.el('#referenceZoom').value) / 100) + '%';
  };
  UI.openReference = function () {
    if (!app().doc) return;
    Q.el('#referenceWindow').classList.remove('hidden'); UI.resizeReference(); UI.refreshReference();
  };
  UI.resetReference = function () {
    clearTimeout(referenceTimer); referenceGeneration++; referenceMode='canvas';
    Q.el('#referenceWindow').classList.add('hidden'); Q.el('#referenceTitle').textContent='Canvas reference';
    const cv=Q.el('#referenceCanvas'); cv.width=1; cv.height=1;
  };
  UI.closeReference = function () { UI.resetReference(); };
  UI.showCanvasReference = function () {
    referenceGeneration++; referenceMode='canvas'; Q.el('#referenceTitle').textContent='Canvas reference'; UI.refreshReference();
  };
  UI.pickReferenceImage = function () {
    if (!app().doc || Q.el('#referenceWindow').classList.contains('hidden')) return;
    const target={kind:'reference',doc:app().doc,generation:++referenceGeneration}; UI.imageTarget=target;
    Q.el('#imageImport').value=''; Q.el('#imageImport').click();
  };
  UI.isReferenceTarget = function (target) { return !!target && target.kind==='reference' && app().doc===target.doc && target.generation===referenceGeneration && !Q.el('#referenceWindow').classList.contains('hidden'); };
  UI.setReferenceImage = function (target,canvas,name) {
    if (!UI.isReferenceTarget(target)) return; clearTimeout(referenceTimer); referenceMode='image';
    Q.el('#referenceTitle').textContent='Image reference'; const cv=Q.el('#referenceCanvas'); cv.width=canvas.width; cv.height=canvas.height; cv.getContext('2d').drawImage(canvas,0,0);
    Q.toast('Reference loaded for this session · not saved in artwork',4000); void name;
  };
  UI.refreshReference = function () {
    if (Q.el('#referenceWindow').classList.contains('hidden') || referenceMode==='image') return;
    clearTimeout(referenceTimer);
    referenceTimer = setTimeout(function () {
      if (!app().doc || referenceMode!=='canvas' || Q.el('#referenceWindow').classList.contains('hidden')) return;
      const thumb = app().doc.thumbnail(app().doc.activeFrame, 260), cv = Q.el('#referenceCanvas');
      cv.width = thumb.width; cv.height = thumb.height; cv.getContext('2d').drawImage(thumb, 0, 0);
    }, 120);
  };

  UI.artworkDetails = function () {
    const d=app().doc; if(!d) return; const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Artwork details'));
    card.appendChild(Q.crel('p','sub',d.width+' × '+d.height+' px · '+d.layers.length+' layers · '+d.frames.length+' frames'));
    const row=Q.crel('div','field'); row.appendChild(Q.crel('label',null,'Name')); const name=Q.crel('input','select'); name.type='text'; name.value=d.name; name.setAttribute('aria-label','Artwork name in details'); row.appendChild(name); card.appendChild(row);
    const error=Q.crel('p','canvas-error'); error.setAttribute('role','alert'); card.appendChild(error);
    const actions=Q.crel('div','modal-actions'), cancel=Q.crel('button','btn ghost','Cancel'), save=Q.crel('button','btn primary','Save'); cancel.addEventListener('click',()=>UI.closeModal()); save.addEventListener('click',function(){ if(app().doc!==d) { error.textContent='Artwork changed; reopen details'; return; } d.name=name.value.trim() || 'Untitled'; Q.el('#docTitle').value=d.name; app().markDirty(true); UI.closeModal(); }); actions.appendChild(cancel); actions.appendChild(save); card.appendChild(actions); UI.openModal(card);
  };

  UI.setTheme = function (theme,persist) {
    theme=theme==='light' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme',theme);
    if(persist) Q.Store.meta('interfaceTheme',theme);
  };
  UI.themeDialog = function () {
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Interface appearance'));
    card.appendChild(Q.crel('p','sub','Choose a light or dark interface. This setting is saved on this device and does not change your artwork, canvas background or exports. The canvas workspace remains dark around the artwork.'));
    const row=Q.crel('div','field studio-field'), select=Q.crel('select'); row.appendChild(Q.crel('label',null,'Appearance')); select.setAttribute('aria-label','Interface appearance');
    [['dark','Dark'],['light','Light']].forEach(function(pair){ const option=Q.crel('option'); option.value=pair[0]; option.textContent=pair[1]; select.appendChild(option); });
    select.value=document.documentElement.getAttribute('data-theme')==='light' ? 'light' : 'dark'; select.addEventListener('change',function(){ UI.setTheme(select.value,true); }); row.appendChild(select); card.appendChild(row);
    const actions=Q.crel('div','modal-actions'), reset=Q.crel('button','btn ghost','Reset'), done=Q.crel('button','btn primary','Done'); reset.addEventListener('click',function(){ UI.setTheme('dark',true); select.value='dark'; }); done.addEventListener('click',()=>UI.closeModal()); actions.appendChild(reset); actions.appendChild(done); card.appendChild(actions); UI.openModal(card);
  };

  UI.smudgePreferences = function () {
    const v=app().view, card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Smudge edge'));
    card.appendChild(Q.crel('p','sub','Set the edge hardness for future smudge strokes. Zero makes a soft falloff; 100% keeps the original hard edge. This device setting does not change existing artwork or painting brushes. The opacity slider controls strength; optional stylus pressure also changes strength. Fingers use full pressure.'));
    const row=Q.crel('div','field studio-field'), slider=Q.crel('input'), out=Q.crel('span','val'); row.appendChild(Q.crel('label',null,'Hardness')); slider.type='range'; slider.min=0; slider.max=100; slider.value=Math.round(Q.sanitizeSmudgeHardness(v.smudgeHardness)*100); slider.setAttribute('aria-label','Smudge edge hardness');
    function update() { v.smudgeHardness=Number(slider.value)/100; out.textContent=slider.value+'%'; Q.Store.meta('smudgeHardness',v.smudgeHardness); }
    out.textContent=slider.value+'%'; slider.addEventListener('input',update); row.appendChild(slider); row.appendChild(out); card.appendChild(row);
    const pressureRow=Q.crel('div','field studio-field'); pressureRow.appendChild(Q.crel('label',null,'Stylus pressure')); const pressure=Q.crel('select'); pressure.setAttribute('aria-label','Smudge stylus pressure'); [['off','Off'],['on','Strength']].forEach(pair=>{ const option=Q.crel('option'); option.value=pair[0]; option.textContent=pair[1]; pressure.appendChild(option); }); pressure.value=v.smudgePressure ? 'on' : 'off'; pressure.addEventListener('change',function(){ v.smudgePressure=pressure.value==='on'; Q.Store.meta('smudgePressure',v.smudgePressure); }); pressureRow.appendChild(pressure); card.appendChild(pressureRow);
    const actions=Q.crel('div','modal-actions'), reset=Q.crel('button','btn ghost','Reset'), done=Q.crel('button','btn primary','Done'); reset.addEventListener('click',function(){ slider.value=100; update(); pressure.value='off'; v.smudgePressure=false; Q.Store.meta('smudgePressure',false); }); done.addEventListener('click',()=>UI.closeModal()); actions.appendChild(reset); actions.appendChild(done); card.appendChild(actions); UI.openModal(card);
  };

  UI.railPreferencesDialog = function () {
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Brush slider layout'));
    card.appendChild(Q.crel('p','sub','Moves the brush button and size/opacity sliders together. Colour and layer tools move to the opposite edge. On short screens or with the timeline open, rails shorten and can scroll; the brush tray also contains horizontal sliders. Vertical positioning may have no effect when space is tight. Settings are saved on this device.'));
    const row=Q.crel('div','field studio-field'); row.appendChild(Q.crel('label',null,'Slider side')); const side=Q.crel('select'); side.setAttribute('aria-label','Brush slider side'); [['left','Left'],['right','Right']].forEach(v=>{const option=Q.crel('option'); option.value=v[0]; option.textContent=v[1]; side.appendChild(option);}); side.value=railPreferences.side; row.appendChild(side); card.appendChild(row);
    const positionRow=Q.crel('div','field studio-field'); positionRow.appendChild(Q.crel('label',null,'Vertical position')); const position=Q.crel('input'); position.type='range'; position.min=0; position.max=100; position.value=railPreferences.position; position.setAttribute('aria-label','Brush slider vertical position'); position.title='0% top, 100% bottom'; const output=Q.crel('div','val',position.value+'%'); positionRow.appendChild(position); positionRow.appendChild(output); card.appendChild(positionRow);
    function change(){ UI.applyRailPreferences({side:side.value,position:Number(position.value)},true); output.textContent=position.value+'%'; }
    side.addEventListener('change',change); position.addEventListener('input',change);
    const actions=Q.crel('div','modal-actions'), reset=Q.crel('button','btn ghost','Reset'), done=Q.crel('button','btn primary','Done'); reset.addEventListener('click',function(){ UI.applyRailPreferences(null,true); UI.railPreferencesDialog(); }); done.addEventListener('click',()=>UI.closeModal()); actions.appendChild(reset); actions.appendChild(done); card.appendChild(actions); UI.openModal(card);
  };

  UI.gesturePreferences = function () {
    const v=app().view, card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Hold gesture timing'));
    card.appendChild(Q.crel('p','sub','Adjust the idle time before a held stroke snaps to QuickShape or a still press picks a colour. Settings apply to new strokes on this device. Detection is checked about every 120 ms, so activation can be slightly later. Shorter times can trigger accidentally. Other gestures and button holds are unchanged.'));
    function slider(label,key) {
      const row=Q.crel('div','field studio-field gesture-delay-row'); row.appendChild(Q.crel('label',null,label));
      const input=Q.crel('input'); input.type='range'; input.min=200; input.max=2000; input.step=20; input.value=v.gestureDelays[key]; input.setAttribute('aria-label',label);
      const output=Q.crel('div','val',input.value+' ms');
      input.addEventListener('input',function(){ const next={...v.gestureDelays}; next[key]=Number(input.value); v.gestureDelays=Q.sanitizeGestureDelays(next); Q.Store.meta('gestureDelays',v.gestureDelays); output.textContent=v.gestureDelays[key]+' ms'; });
      row.appendChild(input); row.appendChild(output); card.appendChild(row);
    }
    slider('QuickShape hold', 'shape'); slider('Eyedropper hold', 'eyedrop');
    const actions=Q.crel('div','modal-actions'), reset=Q.crel('button','btn ghost','Reset'), done=Q.crel('button','btn primary','Done');
    reset.addEventListener('click',function(){ v.gestureDelays=Q.sanitizeGestureDelays(); Q.Store.meta('gestureDelays',v.gestureDelays); UI.gesturePreferences(); });
    done.addEventListener('click',()=>UI.closeModal()); actions.appendChild(reset); actions.appendChild(done); card.appendChild(actions); UI.openModal(card);
  };

  UI.pressurePreferences = function () {
    const v=app().view, card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Pressure & smoothing'));
    card.appendChild(Q.crel('p','sub','These device-wide settings apply to future strokes with every brush and eraser. They do not change saved brush presets or existing artwork. Pressure depends on the stylus and brush; finger input is unchanged. More smoothing can add drawing lag.'));
    function slider(label,min,max,value,change) { const row=Q.crel('div','field studio-field'); row.appendChild(Q.crel('label',null,label)); const input=Q.crel('input'); input.type='range'; input.min=min; input.max=max; input.value=value; input.setAttribute('aria-label',label); const out=Q.crel('div','val',value+'%'); input.addEventListener('input',function(){ change(Number(input.value)); out.textContent=input.value+'%'; }); row.appendChild(input); row.appendChild(out); card.appendChild(row); return input; }
    const pressure=slider('Global pressure curve',50,200,Math.round(v.globalPressure*100),function(n){ v.globalPressure=n/100; Q.Store.meta('globalPressure',v.globalPressure); });
    card.appendChild(Q.crel('p','sub','100% is neutral. Lower values make light pen pressure stronger; higher values make it lighter. Brushes without pressure response remain unchanged.'));
    const smoothing=slider('Extra smoothing',0,90,Math.round(v.globalSmoothing*100),function(n){ v.globalSmoothing=n/100; Q.Store.meta('globalSmoothing',v.globalSmoothing); });
    card.appendChild(Q.crel('p','sub','Extra smoothing builds on each brush’s stabilization and is capped at 90%. Zero keeps each brush’s own setting.'));
    const actions=Q.crel('div','modal-actions'), reset=Q.crel('button','btn ghost','Reset'), done=Q.crel('button','btn primary','Done');
    reset.addEventListener('click',function(){ v.globalPressure=1; v.globalSmoothing=0; Q.Store.meta('globalPressure',1); Q.Store.meta('globalSmoothing',0); UI.pressurePreferences(); }); done.addEventListener('click',()=>UI.closeModal()); actions.appendChild(reset); actions.appendChild(done); card.appendChild(actions); UI.openModal(card); void pressure; void smoothing;
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

  let meshPanel=null, meshOutside=null, meshView=null;
  UI.cancelCanvasTransform = function () {
    if(meshOutside) document.removeEventListener('pointerdown',meshOutside,true); meshOutside=null;
    if(meshPanel) meshPanel.remove(); meshPanel=null;
    if(meshView) {if(meshView.meshTransform && meshView.meshTransform.previewTimer) clearTimeout(meshView.meshTransform.previewTimer); meshView.meshTransform=null;meshView.meshPointer=null;meshView.dirty=true;} meshView=null;
  };
  UI.canvasTransform = function () {
    UI.cancelCanvasTransform(); const result=app().beginCanvasTransform(); if(result.error) {Q.toast(result.error,4000);return;}
    const v=app().view;meshView=v; const panel=Q.crel('div','mesh-toolbar');meshPanel=panel;panel.setAttribute('role','region');panel.setAttribute('aria-label','Canvas transform');
    const title=Q.crel('strong',null,'Canvas transform'); panel.appendChild(title);
    const modes=Q.crel('select');modes.setAttribute('aria-label','Transform style'); [['uniform','Uniform'],['freeform','Freeform'],['rotate','Rotate'],['distort','Distort'],['warp','Warp']].forEach(p=>{const o=Q.crel('option');o.value=p[0];o.textContent=p[1];modes.appendChild(o);});panel.appendChild(modes);
    const quality=Q.crel('select');quality.setAttribute('aria-label','Transform resampling');[['smooth','Smooth'],['nearest','Pixelated']].forEach(p=>{const o=Q.crel('option');o.value=p[0];o.textContent=p[1];quality.appendChild(o);});panel.appendChild(Q.crel('span','mesh-quality-label','Resampling'));panel.appendChild(quality);
    const description=Q.crel('div','mesh-help','Drag a corner to scale or elsewhere to move. Preview is approximate; pixels change on Apply.');panel.appendChild(description);
    const status=Q.crel('div','mesh-status','Original artwork');status.setAttribute('role','status');panel.appendChild(status);v.meshTransform.statusNode=status;
    modes.addEventListener('change',function(){const t=v.meshTransform;if(!t)return;t.mode=modes.value;v.meshPointer=null;v.dirty=true;description.textContent=(modes.value==='warp' ? 'Drag any grid point to warp' : modes.value==='rotate' ? 'Drag corners to rotate around the centre' : modes.value==='distort' ? 'Drag corners to distort (rebuilds inner grid)' : modes.value==='freeform' ? 'Drag corners to resize freely' : 'Drag corners to scale uniformly')+'. Drag elsewhere to move. Preview is approximate; pixels change on Apply.';});
    quality.addEventListener('change',function(){if(v.meshTransform){v.meshTransform.sampling=quality.value;v.requestMeshPreview();}});
    const buttons=Q.crel('div','mesh-buttons'),reset=Q.crel('button','btn ghost','Reset'),cancel=Q.crel('button','btn ghost','Cancel'),apply=Q.crel('button','btn primary','Apply');
    reset.addEventListener('click',function(){if(v.meshTransform){v.meshTransform.points=Q.transformGrid(v.meshTransform.src);v.meshPointer=null;v.requestMeshPreview();v.dirty=true;}}); cancel.addEventListener('click',UI.cancelCanvasTransform);
    apply.addEventListener('click',function(){const r=app().applyCanvasTransform();if(r.error) {Q.toast(r.error,4000);return;} UI.cancelCanvasTransform();Q.toast('Transform applied · Undo to revert',3000);});
    buttons.appendChild(reset);buttons.appendChild(cancel);buttons.appendChild(apply);panel.appendChild(buttons);Q.el('#studio').appendChild(panel);
    meshOutside=function(e){if(!panel.contains(e.target) && e.target!==v.canvas) UI.cancelCanvasTransform();};document.addEventListener('pointerdown',meshOutside,true);
    Q.hint('Drag handles on the canvas · Apply or Cancel below',3000);
  };

  UI.selectionDialog = function () {
    const v=app().view, d=app().doc; if (!d) return;
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Selection & transform'));
    card.appendChild(Q.crel('p','sub', v.selection ? (Q.complexSelection(v.selection) ? (v.selection.runs ? 'Masked selection. The dashed box shows bounds, not the exact selected pixels. Transforms require a rectangle.' : (v.selection.shape==='ellipse' ? 'Ellipse selected. Transforms currently require a rectangle.' : 'Lasso selected. Transforms currently require a rectangle.')) : 'Rectangle selected. Edits affect the current layer and frame.') : 'No selection. Flips and rotation use the whole current layer and frame.'));
    card.appendChild(Q.crel('p','sub','The selection clips brushes, erasers, flood fill and effects. It is temporary and applies to the current layer and frame.'));
    const opRow=Q.crel('div','field'); opRow.appendChild(Q.crel('label',null,'Combine'));
    const op=Q.crel('select'); op.setAttribute('aria-label','Selection combination'); [['replace','Replace'],['add','Add to selection'],['subtract','Subtract from selection']].forEach(function(item){const o=Q.crel('option');o.value=item[0];o.textContent=item[1];op.appendChild(o);}); opRow.appendChild(op); card.appendChild(opRow);
    card.appendChild(Q.crel('p','sub','Combine applies to the next rectangle, ellipse or lasso. Add/subtract need an existing selection and a canvas up to 4 megapixels. Magic wand always replaces. Empty or overly complex results are refused.'));
    function chooseShape(tool,hint) { if(op.value!=='replace' && !v.selection) { Q.toast('Make a selection first',3500); return; } v.selectionOperation=op.value; v.tool=tool; UI.syncBrushUi(); v.selectionDraft=null; Q.el('#btnFill').classList.remove('on'); Q.el('#btnEyedrop').classList.remove('on'); Q.hint(hint,3000); }
    const actions=Q.crel('div','menu-grid');
    function action(label, fn, ico) { const b=Q.crel('button','menu-item'); if(ico) b.innerHTML=icon(ico); b.appendChild(document.createTextNode(label)); b.addEventListener('click',function () { UI.closeModal(); UI.closeTray(); fn(); }); actions.appendChild(b); }
    action('Draw rectangle',function () { chooseShape('select','Drag on the canvas to select a rectangle'); });
    action('Draw ellipse',function () { chooseShape('ellipse','Drag on the canvas to select an ellipse'); });
    action('Draw lasso',function () { chooseShape('lasso','Draw a closed selection around an area'); });
    action('Magic wand',function () { v.tool='wand'; UI.syncBrushUi(); v.selectionDraft=null; Q.el('#btnFill').classList.remove('on'); Q.el('#btnEyedrop').classList.remove('on'); Q.hint('Tap matching pixels · sampling and tolerance in Fill settings',3500); });
    action('Select all',function () { v.selection={x:0,y:0,w:d.width,h:d.height}; v.dirty=true; Q.hint('Entire canvas selected',1600); });
    action('Invert selection',function () { const result=Q.invertSelection(v.selection,d.width,d.height); if(result.error) { Q.toast(result.error,3500); return; } v.selection=result.selection; v.selectionDraft=null; v.dirty=true; Q.hint('Selection inverted · dashed box shows bounds',2500); },ICON.invertSelection);
    action('Deselect',function () { v.selection=null; v.selectionDraft=null; if (v.tool === 'select' || v.tool === 'lasso' || v.tool === 'ellipse' || v.tool === 'wand') v.tool='brush'; v.dirty=true; });
    action(v.selection && Q.complexSelection(v.selection) ? 'Fill selection' : 'Fill rectangle',function () { app().editSelection('fill'); });
    action(v.selection && Q.complexSelection(v.selection) ? 'Clear selection' : 'Clear rectangle',function () { app().editSelection('clear'); });
    action('Copy to layer',function () { app().copySelectionToLayer(); });
    action('Cut, copy & paste',function () { UI.quickEditDialog(); },ICON.paste);
    action('Flip horizontal',function () { app().editSelection('flipH'); });
    action('Flip vertical',function () { app().editSelection('flipV'); });
    action('Rotate 180°',function () { app().editSelection('rotate180'); });
    action('Move / scale',function () { UI.transformDialog(); });
    action('Canvas transform',function () { UI.canvasTransform(); },ICON.controls);
    action('Precise transform',function () { UI.preciseTransformDialog(); },ICON.controls);
    card.appendChild(actions);
    const done=Q.crel('button','btn ghost','Close'); done.addEventListener('click',function () { UI.closeModal(); }); card.appendChild(done); UI.openModal(card);
  };

  UI.jpegDialog = function () {
    const d=app().doc; if(!d) return;
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Export JPEG'));
    card.appendChild(Q.crel('p','sub','Exports the current frame flattened over the canvas background. JPEG has no transparency and is lossy. Camera and layer motion are not applied, just like PNG export.'));
    const row=Q.crel('div','field'); row.appendChild(Q.crel('label',null,'Quality'));
    const sel=Q.crel('select'); sel.setAttribute('aria-label','JPEG quality');
    [['0.5','Small · 50%'],['0.75','Balanced · 75%'],['0.9','High · 90%'],['1','Maximum · 100%']].forEach(function(x){ const o=Q.crel('option'); o.value=x[0]; o.textContent=x[1]; sel.appendChild(o); }); sel.value='0.9'; row.appendChild(sel); card.appendChild(row);
    const actions=Q.crel('div','modal-actions'), cancel=Q.crel('button','btn ghost','Cancel'), save=Q.crel('button','btn primary','Export JPEG');
    cancel.addEventListener('click',UI.closeModal); save.addEventListener('click',function(){ if(app().doc!==d) { Q.toast('Artwork changed; reopen export'); UI.closeModal(); return; } UI.closeModal(); UI.closeTray(); app().exportJpeg(Number(sel.value)); });
    actions.appendChild(cancel); actions.appendChild(save); card.appendChild(actions); UI.openModal(card);
  };

  UI.clearCelDialog = function () {
    app().stopPlay(); const d=app().doc; if (!d) return; UI.closeTray();
    const frame=d.frames[d.activeFrame], layer=d.layer(), cel=d.activeCel(false), undo=d.history.undoStack.slice(), redo=d.history.redoStack.slice();
    if (!layer || !layer.visible) { Q.toast('This layer is hidden'); return; }
    if (layer.locked || layer.alphaLocked) { Q.toast('Unlock the layer and alpha first'); return; }
    if (!cel) { Q.toast('The current cel is already empty'); return; }
    UI.confirm('Clear current cel?', 'This clears the entire active layer on the current frame, ignoring any selection. Other frames are unchanged. Undo can restore it.',function () {
      if (app().doc!==d || d.frames[d.activeFrame]!==frame || d.layer()!==layer || d.activeCel(false)!==cel || !layer.visible || layer.locked || layer.alphaLocked || app().playing || undo.length!==d.history.undoStack.length || redo.length!==d.history.redoStack.length || undo.some((entry,i)=>entry!==d.history.undoStack[i]) || redo.some((entry,i)=>entry!==d.history.redoStack[i])) { Q.toast('Artwork, frame or layer changed; try again',4000); return; }
      app().clearCurrentCel();
    },'Clear cel');
  };

  UI.quickEditDialog = function () {
    app().stopPlay(); const d=app().doc; if(!d) return; UI.closeTray();
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Cut, copy & paste'));
    card.appendChild(Q.crel('p','sub','Cut and copy use the selection on the current layer and frame, or the whole current cel if nothing is selected. Paste ignores the current selection and creates a new top layer on the current frame, at the original canvas coordinates. Pixels beyond the canvas are cropped.'));
    card.appendChild(Q.crel('p','sub','The Qelem clipboard stays in memory across artworks until cleared or the app closes. It is not the system clipboard and is not saved. Undo restores cut pixels or removes a pasted layer; it does not undo clipboard contents.'));
    const clip=app().clipboard, selection=app().view.selection, frame=d.frames[d.activeFrame], layer=d.layer(), cel=d.activeCel(false);
    const bounds=selection ? {x:selection.x,y:selection.y,w:selection.w,h:selection.h} : null;
    const status=Q.crel('p','sub',clip ? 'Clipboard: '+clip.w+' × '+clip.h+' px at ('+clip.x+', '+clip.y+').'+(clip.x+clip.w>d.width || clip.y+clip.h>d.height ? ' Paste will be cropped to this canvas.' : '') : 'Clipboard is empty.'); card.appendChild(status);
    function validSource() { const current=app().view.selection; return app().doc===d && d.frames[d.activeFrame]===frame && d.layer()===layer && d.activeCel(false)===cel && current===selection && (!current || (current.x===bounds.x && current.y===bounds.y && current.w===bounds.w && current.h===bounds.h)); }
    function validPaste() { return app().doc===d && d.frames[d.activeFrame]===frame && app().clipboard===clip; }
    const error=Q.crel('p','canvas-error'); error.setAttribute('role','alert'); card.appendChild(error);
    const grid=Q.crel('div','menu-grid');
    function action(label,ico,fn) { const b=Q.crel('button','menu-item'); b.innerHTML=icon(ico); b.appendChild(document.createTextNode(label)); b.addEventListener('click',function(){ const result=fn(); if(result && result.error) { error.textContent=result.error; return; } UI.closeModal(); }); grid.appendChild(b); }
    action('Cut',ICON.cut,()=>validSource() ? app().copyOrCut(true) : {error:'Artwork, frame, layer or selection changed; reopen Quick Edit'}); action('Copy',ICON.copy,()=>validSource() ? app().copyOrCut(false) : {error:'Artwork, frame, layer or selection changed; reopen Quick Edit'}); action('Paste',ICON.paste,()=>validPaste() ? app().pasteClipboard() : {error:'Artwork, frame or clipboard changed; reopen Quick Edit'});
    action('Clear clipboard',ICON.trash,function(){ if(app().clipboard!==clip) return {error:'Clipboard changed; reopen Quick Edit'}; app().clearClipboard(); Q.toast('Clipboard cleared'); return {}; }); card.appendChild(grid);
    const close=Q.crel('button','btn ghost','Close'); close.addEventListener('click',()=>UI.closeModal()); card.appendChild(close); UI.openModal(card);
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

  UI.preciseTransformDialog = function () {
    app().stopPlay(); const d=app().doc,v=app().view; if(!d) return;
    const selection=v.selection, src=selection ? {x:selection.x,y:selection.y,w:selection.w,h:selection.h} : {x:0,y:0,w:d.width,h:d.height};
    const target={doc:d,frame:d.frames[d.activeFrame],layer:d.layer(),cel:d.activeCel(false),selection:selection,src:src};
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Precise transform'));
    card.appendChild(Q.crel('p','sub','Enter whole-pixel dimensions before rotation, offsets from the original centre and a clockwise angle. This edits the current cel; pixels outside the canvas are cropped. The preview is approximate.'));
    card.appendChild(Q.crel('p','sub','Only rectangles or the whole cel are supported. Rotated selections become an axis-aligned bounding box. Resizing resamples raster artwork; undo restores pixels, not the selection. Temporary allocations are limited to 64 MiB.'));
    const grid=Q.crel('div','transform-grid'); card.appendChild(grid);
    function field(label,value,step){const row=Q.crel('div','transform-field'), name=Q.crel('label',null,label), el=Q.crel('input','select'); el.type='number'; el.step=step; el.value=String(value); el.setAttribute('aria-label',label); row.appendChild(name); row.appendChild(el); grid.appendChild(row); return el;}
    const width=field('Precise width (px)',src.w,'1'), height=field('Precise height (px)',src.h,'1'), dx=field('Precise move X (px)',0,'1'), dy=field('Precise move Y (px)',0,'1'), angle=field('Precise rotation (degrees)',0,'any');
    const row=Q.crel('div','transform-field'), label=Q.crel('label',null,'Resampling'), sampling=Q.crel('select'); sampling.setAttribute('aria-label','Transform resampling'); [['smooth','Smooth'],['nearest','Nearest neighbour (pixel art)']].forEach(x=>{const option=Q.crel('option'); option.value=x[0]; option.textContent=x[1]; sampling.appendChild(option);}); row.appendChild(label); row.appendChild(sampling); grid.appendChild(row);
    const error=Q.crel('p','canvas-error'); error.setAttribute('role','alert'); card.appendChild(error);
    const preview=Q.canvas(192,192); preview.className='precision-preview'; preview.setAttribute('aria-label','Approximate transformed layer preview'); card.appendChild(preview);
    const info=Q.crel('p','sub'); card.appendChild(info);
    const factor=Math.min(192/d.width,192/d.height); preview.width=Math.max(1,Math.round(d.width*factor)); preview.height=Math.max(1,Math.round(d.height*factor));
    function read() {
      if([width,height,dx,dy,angle].some(x=>!x.value.trim() || !Number.isFinite(Number(x.value)))) return {error:'Enter a number in every transform field'};
      if(selection && Q.complexSelection(selection)) return {error:'Use a rectangular selection for this transform'};
      if(!target.cel) return {error:'Draw on this layer first'};
      if(!target.layer || !target.layer.visible) return {error:'This layer is hidden'};
      if(target.layer.locked) return {error:'This layer is locked'}; if(target.layer.alphaLocked) return {error:'Turn off alpha lock to transform'};
      const options={width:Number(width.value),height:Number(height.value),dx:Number(dx.value),dy:Number(dy.value),angle:Number(angle.value),resampling:sampling.value}, plan=Q.planPreciseTransform(src,d.width,d.height,options);
      return plan.error ? plan : {options:options,plan:plan};
    }
    function update() {
      const value=read(); if(value.error) { error.textContent=value.error; info.textContent=''; return null; } error.textContent='';
      const o=value.options,p=value.plan; info.textContent=(p.clipped ? 'Warning: part of the transformed frame lies outside the canvas and will be cropped. ' : '')+'Preview shows the current layer only, not other layers or blend modes.';
      try {
        const c=preview.getContext('2d'), temp=Q.canvas(preview.width,preview.height), tc=temp.getContext('2d'), sx=preview.width/d.width,sy=preview.height/d.height;
        c.clearRect(0,0,preview.width,preview.height); c.drawImage(target.cel,0,0,preview.width,preview.height);
        tc.drawImage(target.cel,0,0,preview.width,preview.height); c.save(); c.scale(sx,sy); c.clearRect(src.x,src.y,src.w,src.h); c.translate(p.cx,p.cy); c.rotate(p.theta); c.imageSmoothingEnabled=o.resampling==='smooth'; c.drawImage(temp,src.x*sx,src.y*sy,src.w*sx,src.h*sy,-o.width/2,-o.height/2,o.width,o.height); c.restore();
      } catch(e) { info.textContent='Preview unavailable on this device; settings are still validated before applying.'; }
      return value;
    }
    [width,height,dx,dy,angle].forEach(el=>el.addEventListener('input',update)); sampling.addEventListener('change',update); update();
    const actions=Q.crel('div','modal-actions'), cancel=Q.crel('button','btn ghost','Cancel'), apply=Q.crel('button','btn primary','Apply');
    cancel.addEventListener('click',()=>UI.closeModal()); apply.addEventListener('click',function(){ const value=update(); if(!value) return; const result=app().preciseTransform(value.options,target); if(result.error) { error.textContent=result.error; return; } UI.closeModal(); });
    actions.appendChild(cancel); actions.appendChild(apply); card.appendChild(actions); UI.openModal(card);
  };

  UI.recolorDialog = function () {
    app().stopPlay(); UI.closeTray(); const d=app().doc, v=app().view; if(!d) return;
    const selection=v.selection, target={doc:d,frame:d.frames[d.activeFrame],layer:d.layer(),cel:d.activeCel(false),selection:selection,bounds:selection ? {x:selection.x,y:selection.y,w:selection.w,h:selection.h} : {x:0,y:0,w:d.width,h:d.height},undo:d.history.undoStack.slice(),redo:d.history.redoStack.slice()};
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Recolour matching pixels'));
    card.appendChild(Q.crel('p','sub','Replace matching non-transparent colours anywhere in the active cel, including disconnected areas. A selection limits the result. Alpha is preserved; other layers and frames are unchanged. Undo restores the pixels.'));
    function colour(label,value) { const row=Q.crel('div','field studio-field'), input=Q.crel('input','select'); row.appendChild(Q.crel('label',null,label)); input.type='text'; input.value=value; input.setAttribute('aria-label',label); row.appendChild(input); card.appendChild(row); return input; }
    const source=colour('Source colour','#000000'), replacement=colour('Replacement colour',Q.rgbToHex(v.color));
    const row=Q.crel('div','field studio-field'), slider=Q.crel('input'); row.appendChild(Q.crel('label',null,'Tolerance')); slider.type='range'; slider.min=0; slider.max=128; slider.value=0; slider.setAttribute('aria-label','Recolour tolerance'); const value=Q.crel('div','val','0'); row.appendChild(slider); row.appendChild(value); card.appendChild(row);
    const preview=Q.canvas(192,192); preview.className='recolor-preview'; preview.setAttribute('aria-label','Recolour preview, tap to sample source'); preview.title='Tap to sample the original active cel'; const scale=Math.min(192/d.width,192/d.height); preview.width=Math.max(1,Math.round(d.width*scale)); preview.height=Math.max(1,Math.round(d.height*scale)); card.appendChild(preview);
    card.appendChild(Q.crel('p','sub','Tap the preview to sample a source pixel from the original cel, or enter HEX colours. Preview is downsampled and approximate, without other layers or animation transforms. RGB tolerance is per channel. Transparent pixels are skipped. Estimated temporary allocations are limited to 64 MiB; existing artwork and history use additional memory.'));
    const error=Q.crel('p','canvas-error'); error.setAttribute('role','alert'); card.appendChild(error);
    function read() { const a=Q.hexToRgb(source.value), b=Q.hexToRgb(replacement.value); if(!a || !b) return {error:'Enter valid 3- or 6-digit HEX colours'}; const t=Number(slider.value), result=app().validateRecolor(target,a,b,t); return result.error ? result : {source:a,replacement:b,tolerance:t}; }
    function update() {
      value.textContent=slider.value; const options=read(); error.textContent=options.error || '';
      try {
        const c=preview.getContext('2d'); c.clearRect(0,0,preview.width,preview.height); if(!target.cel) return;
        c.drawImage(target.cel,0,0,preview.width,preview.height);
        if(!options.error) {
          const image=c.getImageData(0,0,preview.width,preview.height); let mask=null;
          if(selection) { const mc=Q.canvas(preview.width,preview.height), m=mc.getContext('2d'); m.scale(preview.width/d.width,preview.height/d.height); Q.selectionPath(m,selection); m.fillStyle='#000'; m.fill(); const rgba=m.getImageData(0,0,preview.width,preview.height).data; mask=new Uint8Array(preview.width*preview.height); for(let i=0;i<mask.length;i++) mask[i]=rgba[i*4+3]>=128 ? 1 : 0; }
          Q.recolorMatching(image,options.source,options.replacement,options.tolerance,mask); c.putImageData(image,0,0);
        }
      } catch(e) { error.textContent='Preview unavailable on this device; colours are validated before applying.'; }
    }
    [source,replacement,slider].forEach(el=>el.addEventListener('input',update));
    preview.addEventListener('pointerdown',function(e){
      if(!target.cel || app().doc!==d || d.activeCel(false)!==target.cel) return;
      const box=preview.getBoundingClientRect(); if(!box.width || !box.height) return;
      const x=Q.clamp(Math.floor((e.clientX-box.left)/box.width*d.width),0,d.width-1),y=Q.clamp(Math.floor((e.clientY-box.top)/box.height*d.height),0,d.height-1);
      try { const px=target.cel.getContext('2d').getImageData(x,y,1,1).data; if(!px[3]) { error.textContent='Choose a non-transparent source pixel'; return; } source.value=Q.rgbToHex([px[0],px[1],px[2]]); update(); } catch(err) { error.textContent='Could not sample this pixel'; }
    });
    const actions=Q.crel('div','modal-actions'), cancel=Q.crel('button','btn ghost','Cancel'), apply=Q.crel('button','btn primary','Apply'); cancel.addEventListener('click',()=>UI.closeModal());
    apply.addEventListener('click',function(){ const options=read(); if(options.error) { error.textContent=options.error; return; } const result=app().recolorMatching(target,options.source,options.replacement,options.tolerance); if(result.error) error.textContent=result.error; });
    actions.appendChild(cancel); actions.appendChild(apply); card.appendChild(actions); UI.openModal(card); update();
  };

  UI.fillSettings = function () {
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Fill settings'));
    card.appendChild(Q.crel('p','sub','Fill, colour drop and Magic wand share these settings. Choose the active layer or all visible layers as the colour reference, and connected or all matching pixels. Fill changes only the active layer; wand replaces the selection. The canvas background and playback transforms are not sampled.'));
    const row=Q.crel('div','field studio-field'); row.appendChild(Q.crel('label',null,'Tolerance'));
    const slider=Q.crel('input'); slider.type='range'; slider.min=0; slider.max=128; slider.value=app().fillThreshold; slider.setAttribute('aria-label','Fill tolerance');
    const val=Q.crel('div','val',slider.value); slider.addEventListener('input',function () { app().fillThreshold=Number(slider.value); Q.Store.meta('fillThreshold',app().fillThreshold); val.textContent=slider.value; });
    row.appendChild(slider); row.appendChild(val); card.appendChild(row);
    function choice(label,key,options) { const r=Q.crel('div','field studio-field'); r.appendChild(Q.crel('label',null,label)); const select=Q.crel('select'); select.setAttribute('aria-label',label); options.forEach(function(p){const o=Q.crel('option');o.value=p[0];o.textContent=p[1];select.appendChild(o);}); select.value=app()[key]; select.addEventListener('change',function(){app()[key]=select.value;Q.Store.meta(key,select.value);}); r.appendChild(select); card.appendChild(r); }
    choice('Sample layers','fillSource',[['active','Active layer'],['visible','All visible layers']]);
    choice('Match area','fillScope',[['connected','Connected area'],['all','All matching pixels']]);
    card.appendChild(Q.crel('p','sub','Visible-layer sampling and all-matching mode have a 4-megapixel / 64 MiB estimated temporary-memory limit and may be slow on large areas. Alpha lock restricts fill to existing non-transparent pixels; selection clips fill but not the wand.'));
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
    UI.scheduleRailLayout();
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
      tool('Find frame',ICON.findFrame,function () { UI.findFrameDialog(); });
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
    timing.setAttribute('aria-label','Playback timing'); el.appendChild(timing); UI.scheduleRailLayout();
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
    const extra=Q.crel('div','menu-grid');
    const insert=Q.crel('button','menu-item'); insert.innerHTML=icon(ICON.blankFrame); insert.appendChild(document.createTextNode('Insert blank frames')); insert.addEventListener('click',function(){UI.insertBlankFramesDialog();}); extra.appendChild(insert);
    const clearCels=Q.crel('button','menu-item'); clearCels.innerHTML=icon(ICON.clear); clearCels.appendChild(document.createTextNode('Clear cels in range')); clearCels.addEventListener('click',function(){UI.clearCelRangeDialog();}); extra.appendChild(clearCels); card.appendChild(extra);
    const del=Q.crel('button','btn danger','Delete range'); del.addEventListener('click',function () {
      const first=Number(start.value), last=Number(end.value);
      if (!start.value.trim() || !end.value.trim() || !Number.isInteger(first) || !Number.isInteger(last) || first<1 || last<first || last>d.frames.length || last-first+1>=d.frames.length) { error.textContent='Choose a valid range that leaves at least one frame.'; return; }
      UI.confirm('Delete frames '+first+'–'+last+'?', 'This removes all layers in these frames. You can undo this action.', function () { app().deleteFrameRange(first-1,last-1); });
    }); card.appendChild(del);
    const close=Q.crel('button','btn ghost','Close'); close.addEventListener('click',function () { UI.closeModal(); }); card.appendChild(close); UI.openModal(card);
  };

  UI.insertBlankFramesDialog = function () {
    app().stopPlay(); const d=app().doc; if(!d) return; const originalFrames=d.frames.slice();
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Insert blank frames'));
    card.appendChild(Q.crel('p','sub','Insert new blank frames with the chosen hold. Enter 0 to insert before the first frame. Playback range and camera/layer keys stay at their frame numbers, so their timing relative to drawings can change.'));
    function field(label,value,min,max) { const row=Q.crel('div','field'); row.appendChild(Q.crel('label',null,label)); const input=Q.crel('input','select'); input.type='number'; input.min=min; input.max=max; input.step=1; input.value=value; input.setAttribute('aria-label',label); row.appendChild(input); card.appendChild(row); return input; }
    const after=field('Insert after frame',d.activeFrame+1,0,d.frames.length), count=field('Number of blank frames',1,1,60), hold=field('New frame hold',1,1,60), error=Q.crel('p','canvas-error'); error.setAttribute('role','alert'); card.appendChild(error);
    const actions=Q.crel('div','modal-actions'), cancel=Q.crel('button','btn ghost','Cancel'), insert=Q.crel('button','btn primary','Insert');
    cancel.addEventListener('click',function(){ UI.batchFramesDialog(); }); insert.addEventListener('click',function(){
      if(app().doc!==d || d.frames.length!==originalFrames.length || originalFrames.some((f,i)=>d.frames[i]!==f)) { error.textContent='Artwork or frames changed; reopen this dialog.'; return; }
      const a=Number(after.value), n=Number(count.value), h=Number(hold.value);
      if(!after.value.trim() || !count.value.trim() || !hold.value.trim() || !Number.isInteger(a) || a<0 || a>d.frames.length || !Number.isInteger(n) || n<1 || d.frames.length+n>60 || !Number.isInteger(h) || h<1 || h>60) { error.textContent='Enter a valid position, hold 1–60 and a count within the 60-frame limit.'; return; }
      if(app().insertBlankFrames(a,n,h)) UI.closeModal(); else error.textContent='Could not insert frames.';
    }); actions.appendChild(cancel); actions.appendChild(insert); card.appendChild(actions); UI.openModal(card); Q.el('#modalBody').scrollTop=0;
  };

  UI.clearCelRangeDialog = function () {
    app().stopPlay(); const d=app().doc; if(!d) return; const layer=d.layer(), originalFrames=d.frames.slice();
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Clear cels in range'));
    const description=Q.crel('p','sub'); description.textContent='Clear only the active layer ('+layer.name+') across an inclusive frame range, including skipped frames. Other layers, frame timing and metadata remain unchanged. Selection is ignored; undo restores the cels.'; card.appendChild(description);
    function field(label,value) { const row=Q.crel('div','field'); row.appendChild(Q.crel('label',null,label)); const input=Q.crel('input','select'); input.type='number'; input.min=1; input.max=d.frames.length; input.step=1; input.value=value; input.setAttribute('aria-label',label); row.appendChild(input); card.appendChild(row); return input; }
    const start=field('Clear first frame',1), end=field('Clear last frame',d.frames.length), error=Q.crel('p','canvas-error'); error.setAttribute('role','alert'); card.appendChild(error);
    const actions=Q.crel('div','modal-actions'), cancel=Q.crel('button','btn ghost','Cancel'), clear=Q.crel('button','btn danger','Clear cels');
    cancel.addEventListener('click',function(){UI.batchFramesDialog();}); clear.addEventListener('click',function(){
      const a=Number(start.value), b=Number(end.value);
      if(app().doc!==d || d.layer().id!==layer.id || d.frames.length!==originalFrames.length || originalFrames.some((f,i)=>d.frames[i]!==f)) { error.textContent='Artwork, layer or frames changed; reopen this dialog.'; return; }
      if(!start.value.trim() || !end.value.trim() || !Number.isInteger(a) || !Number.isInteger(b) || a<1 || b<a || b>d.frames.length) { error.textContent='Enter a valid inclusive frame range.'; return; }
      if(!d.layer().visible || d.layer().locked || d.layer().alphaLocked) { error.textContent='Show and unlock the layer and alpha first.'; return; }
      if(!d.frames.slice(a-1,b).some(f=>!!f.cels[d.activeLayer])) { error.textContent='No cels to clear in this range.'; return; }
      const frameRefs=d.frames.slice(a-1,b), li=d.activeLayer, celRefs=frameRefs.map(f=>f.cels[li]);
      UI.confirm('Clear these cels?', 'This removes the active layer cels in frames '+a+'–'+b+'. Undo restores them.',function(){
        if(app().doc!==d || d.activeLayer!==li || d.layer().id!==layer.id || frameRefs.some((f,i)=>d.frames[a-1+i]!==f || f.cels[li]!==celRefs[i])) { Q.toast('Artwork, layer or frames changed; reopen the dialog',4000); return; }
        const result=app().clearCelRange(a-1,b-1); if(result) Q.toast(result,4000);
      },'Clear cels');
    }); actions.appendChild(cancel); actions.appendChild(clear); card.appendChild(actions); UI.openModal(card); Q.el('#modalBody').scrollTop=0;
  };

  UI.findFrameDialog = function () {
    app().stopPlay(); const d=app().doc; if(!d) return;
    const card=Q.crel('div'); card.appendChild(Q.crel('h2',null,'Find frame'));
    card.appendChild(Q.crel('p','sub','Jump to a frame number or cycle through matching frame labels. Search includes skipped frames and frames outside the playback range; labels are tags, not groups.'));
    const row=Q.crel('div','field'); row.appendChild(Q.crel('label',null,'Frame number')); const number=Q.crel('input','select'); number.type='number'; number.min=1; number.max=d.frames.length; number.step=1; number.value=d.activeFrame+1; number.setAttribute('aria-label','Frame number'); row.appendChild(number); card.appendChild(row);
    const groupRow=Q.crel('div','field'); groupRow.appendChild(Q.crel('label',null,'Frame label')); const labels=Q.crel('select'); labels.setAttribute('aria-label','Frame label'); const groups=[...new Set(d.frames.map(f=>f.group).filter(g=>typeof g==='string' && g))].sort((a,b)=>a.localeCompare(b));
    if(!groups.length) { const o=Q.crel('option'); o.value=''; o.textContent='No labels'; labels.appendChild(o); }
    groups.forEach(function(g){ const o=Q.crel('option'); o.value=g; o.textContent=g; labels.appendChild(o); }); groupRow.appendChild(labels); card.appendChild(groupRow);
    const status=Q.crel('p','canvas-error'); status.setAttribute('role','status'); card.appendChild(status);
    function go(i) { if(app().doc!==d) { status.textContent='Artwork changed; reopen this dialog.'; return; } app().selectFrame(i); number.value=d.activeFrame+1; status.textContent='Frame '+(d.activeFrame+1)+' selected.'; }
    const actions=Q.crel('div','palette-actions'), jump=Q.crel('button','btn primary','Go to frame'), prev=Q.crel('button','btn ghost','Previous label'), next=Q.crel('button','btn ghost','Next label'), close=Q.crel('button','btn ghost','Close');
    jump.addEventListener('click',function(){const n=Number(number.value); if(!number.value.trim() || !Number.isInteger(n) || n<1 || n>d.frames.length) { status.textContent='Enter a frame number from 1 to '+d.frames.length+'.'; return; } go(n-1);});
    function find(dir) { if(app().doc!==d) { status.textContent='Artwork changed; reopen this dialog.'; return; } const i=Q.findLabeledFrame(d.frames,d.activeFrame,labels.value,dir); if(i<0) status.textContent='No matching label.'; else go(i); }
    prev.disabled=next.disabled=!groups.length; prev.addEventListener('click',function(){find(-1);}); next.addEventListener('click',function(){find(1);}); close.addEventListener('click',UI.closeModal);
    [jump,prev,next,close].forEach(b=>actions.appendChild(b)); card.appendChild(actions); UI.openModal(card); Q.el('#modalBody').scrollTop=0;
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
    button('Draw or replace guide',function () { v.tool='motionGuide'; UI.syncBrushUi(); v.motionDraft=null; Q.el('#btnFill').classList.remove('on'); Q.el('#btnEyedrop').classList.remove('on'); Q.hint('Draw a motion guide on the canvas',3000); });
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
    card.appendChild(Q.crel('p', 'sub', 'Qelem is built for a finger or a stylus. Stylus pressure changes size and opacity when the pen reports it.'));
    const rows = [
      ['One finger / stylus', 'Draw'],
      ['Two fingers', 'Pan, pinch to zoom, twist to rotate'],
      ['Three-finger tap', 'Undo'],
      ['Three-finger swipe down', 'Open cut, copy and paste'],
      ['Three-finger scrub', 'Move all three fingers right-left-right (or left-right-left) to confirm clearing the current cel'],
      ['Four-finger tap', 'Redo'],
      ['Hide interface', 'Actions → Canvas & view; tap the corner button or Android Back to restore'],
      ['Long press', 'Pick a colour (eyedropper)'],
      ['Hold at the end of a stroke', 'Snap a line, circle or ellipse; drag another finger to move, then lift the first to commit'],
      ['Drag the colour swatch', 'Drop on the active layer to flood fill'],
      ['Hold the colour swatch', 'Swap with your previous colour'],
      ['Hold a layer eye', 'Solo that layer; hold again to restore'],
      ['Eraser', 'Tap to toggle eraser; hold to match the current brush'],
      ['Magic wand', 'Select connected pixels via Selection & transform'],
      ['Smudge', 'Drag existing pixels on the active layer; opacity controls strength'],
      ['Fit canvas', 'Tap the fit icon in the tool rail to reset zoom and rotation'],
      ['Alpha lock', 'Tap the checkerboard icon on a layer row to protect transparency'],
      ['Swipe a layer right', 'Add or remove it from the layer selection; opacity is in layer options'],
      ['Double-tap a frame', 'Duplicate, reorder or delete it']
    ];
    rows.forEach(function (r) {
      const line = Q.crel('div', 'field');
      line.style.alignItems = 'flex-start';
      line.innerHTML = '<label style="width:132px">' + r[0] + '</label>';
      const txt = Q.crel('div');
      txt.style.cssText = 'flex:1;font-size:12.5px;color:var(--txt-2)';
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
    card.appendChild(Q.crel('h2', null, 'Qelem'));
    card.appendChild(Q.crel('p', 'sub', 'A paint, sketch and frame-by-frame animation studio for Android. Artwork is stored on this device only — nothing is uploaded.'));
    card.appendChild(Q.crel('p', 'sub', 'Developed by Qmer'));
    card.appendChild(Q.crel('p', 'sub', 'ቀለም (qalam) means “pen” or “ink”.'));
    card.appendChild(Q.crel('p', 'sub', 'Version 6.1'));
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
    body.classList.remove('gallery-preview-modal');
    body.innerHTML = '';
    body.appendChild(node);
    m.classList.remove('hidden');
  };

  UI.closeModal = function () {
    Q.el('#modal').classList.add('hidden');
    Q.el('#modalBody').classList.remove('gallery-preview-modal');
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
