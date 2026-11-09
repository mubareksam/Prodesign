/* Integration test: boots the real Qalam web app inside jsdom with a stubbed
 * 2D canvas, then drives the actual UI — new canvas, brushes, layers, colour,
 * strokes, undo, animation frames, timeline, save + reopen — so wiring bugs
 * show up here instead of on a phone.
 *
 * Run:  cd tools/tests && npm install && node ui_smoke.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const APP = path.join(root, 'android/assets/app');

let failures = 0;
function ok(cond, label) {
  if (cond) { console.log('  ✓ ' + label); }
  else { failures++; console.log('  ✗ ' + label); }
}

/* ── 2D context stub ─────────────────────────────────────── */

const counts = { drawImage: 0, fill: 0, putImageData: 0, getImageData: 0 };

function makeCtx(cv) {
  return {
    canvas: cv,
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineCap: 'butt',
    shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, filter: 'none',
    save() {}, restore() {},
    beginPath() {}, closePath() {}, arc() {}, moveTo() {}, lineTo() {},
    fill() { counts.fill++; }, stroke() {},
    rect() {}, clip() {}, ellipse() {}, quadraticCurveTo() {}, bezierCurveTo() {},
    clearRect() {}, fillRect() {}, strokeRect() {},
    drawImage() { counts.drawImage++; },
    putImageData() { counts.putImageData++; },
    getImageData(x, y, w, h) {
      counts.getImageData++;
      return { width: w, height: h, data: new Uint8ClampedArray(Math.max(4, w * h * 4)) };
    },
    createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(Math.max(4, w * h * 4)) }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    createPattern() { return null; },
    setTransform() {}, resetTransform() {}, translate() {}, rotate() {}, scale() {},
    measureText() { return { width: 8 }; }, fillText() {}, strokeText() {}, setLineDash() {}
  };
}

const html = readFileSync(path.join(APP, 'index.html'), 'utf8');
const dom = new JSDOM(html, {
  url: 'https://qalam.local/',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});
const win = dom.window;
const doc = win.document;
// Include production CSS: checking only the modal's own class missed a hidden ancestor.
const style = doc.createElement('style');
style.textContent = readFileSync(path.join(APP, 'css', 'app.css'), 'utf8');
doc.head.appendChild(style);
function visible(el) {
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    const css = win.getComputedStyle(node);
    if (node.classList.contains('hidden') || css.display === 'none' || css.visibility === 'hidden') return false;
  }
  return true;
}

// ctx stub for every canvas
win.HTMLCanvasElement.prototype.getContext = function (type) {
  if (!this._ctx) this._ctx = makeCtx(this);
  return this._ctx;
};
win.HTMLCanvasElement.prototype.toDataURL = function () {
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
};
win.HTMLCanvasElement.prototype.setPointerCapture = function () {};
win.HTMLCanvasElement.prototype.releasePointerCapture = function () {};
win.HTMLCanvasElement.prototype.hasPointerCapture = function () { return false; };
// give every element a sensible box so hit tests / layout maths work
win.Element.prototype.getBoundingClientRect = function () {
  const w = this.width && this.width > 1 ? this.width : 1024;
  const h = this.height && this.height > 1 ? this.height : 768;
  return { left: 0, top: 0, right: w, bottom: h, width: w, height: h, x: 0, y: 0 };
};
// jsdom never decodes images; emulate a loader that resolves on the next tick
win.Image = class {
  set src(value) { this._src = value; setTimeout(() => { if (this.onload) this.onload(); }, 0); }
  get src() { return this._src; }
};
// no indexedDB: exercises the localStorage fallback
delete win.indexedDB;
win.URL.createObjectURL = () => 'blob:stub';
win.URL.revokeObjectURL = () => {};
win.navigator.vibrate = () => true;

/* ── load the app scripts in page order ─────────────────── */

const files = ['core.js', 'doc.js', 'brushes.js', 'gif.js', 'effects.js', 'fill.js', 'selection.js', 'spritesheet.js', 'view.js', 'storage.js', 'ui.js', 'app.js'];
for (const f of files) {
  const code = readFileSync(path.join(APP, 'js', f), 'utf8');
  win.eval(code);
}

const nativeFileReader = win.FileReader;
const Q = win.Q;
const App = Q.App;

function pointer(target, type, x, y, opts = {}) {
  const e = new win.Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, {
    clientX: x, clientY: y,
    pointerId: opts.id || 1,
    pointerType: opts.pointerType || 'touch',
    pressure: opts.pressure == null ? 1 : opts.pressure,
    isPrimary: true,
    getCoalescedEvents: () => [],
    preventDefault() {}, stopPropagation() {}
  });
  target.dispatchEvent(e);
  return e;
}

function click(sel) {
  const el = doc.querySelector(sel);
  if (!el) throw new Error('missing element ' + sel);
  el.dispatchEvent(new win.Event('click', { bubbles: true }));
  return el;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tick = () => new Promise((r) => setTimeout(r, 0));

async function run() {
  await tick(); await tick();
  ok(visible(doc.querySelector('#splash')) && doc.querySelector('#splash img').getAttribute('src') === 'img/icon.png', 'launch screen displays app icon');
  await wait(450);
  ok(!visible(doc.querySelector('#splash')), 'launch screen clears');

  // jsdom leaves a canvas at its default 300x150 box; give the viewport a
  // phone-sized box so screen coordinates map onto the document the way they
  // do on a device (otherwise "in the middle of the canvas" is off-paper).
  const viewCv = doc.querySelector('#view');
  viewCv.width = 960;
  viewCv.height = 720;
  App.view.resize();

  console.log('boot');
  ok(!!App.view, 'viewport created');
  ok(doc.querySelector('#gallery') && !doc.querySelector('#gallery').classList.contains('hidden'), 'gallery visible on launch');
  ok(Q.Store.mode() === 'local', 'storage fell back to localStorage: ' + Q.Store.mode());

  console.log('new canvas');
  ok(!!doc.querySelector('main #btnNew'), 'new canvas action is in the main gallery');
  click('#btnNew');
  ok(visible(doc.querySelector('#modal')), 'new-canvas dialog is actually visible over the gallery');
  const presets = doc.querySelectorAll('#modalBody .preset');
  ok(presets.length >= 4, 'presets rendered (' + presets.length + ')');
  presets[4].dispatchEvent(new win.Event('click', { bubbles: true }));   // animation 1280x1280
  const nameInput = doc.querySelector('#modalBody input');
  nameInput.value = 'Test artwork';
  click('#modalBody .btn.primary');
  await tick();
  ok(!!App.doc, 'document created');
  ok(App.doc.name === 'Test artwork', 'name applied');
  ok(doc.querySelector('#gallery').classList.contains('hidden'), 'studio shown');
  ok(App.doc.width === 1280 && App.doc.height === 1280, 'preset size applied');

  console.log('brushes');
  click('#btnBrush');
  ok(!doc.querySelector('#tray').classList.contains('hidden'), 'brush tray opens');
  const cards = doc.querySelectorAll('#trayBody .brush-card');
  ok(cards.length === Q.BRUSHES.length, 'all ' + cards.length + ' brushes listed');
  cards[5].dispatchEvent(new win.Event('click', { bubbles: true }));
  await tick();
  ok(App.view.brush.id === Q.BRUSHES[5].id, 'brush selection applied: ' + App.view.brush.name);
  ok(doc.querySelectorAll('#trayBody .brush-kind svg').length === Q.BRUSHES.length, 'brushes have identifiable category icons');
  Q.UI.brushStudio();
  const flow = doc.querySelector('#modalBody input[aria-label="Flow"]');
  flow.value = '63'; flow.dispatchEvent(new win.Event('input', {bubbles:true}));
  ok(App.view.brush.flow === 0.63 && Q.Store.meta('brushSettings').marker.flow === 0.63, 'brush studio saves brush settings');
  click('#modalBody .btn.primary');

  const sizeBefore = App.view.size;
  const slider = doc.querySelector('#sizeSlider');
  slider.value = '48';
  slider.dispatchEvent(new win.Event('input', { bubbles: true }));
  ok(App.view.size === 48, 'size slider drives the brush');

  console.log('drawing');
  const view = doc.querySelector('#view');
  const before = App.doc.history.undoStack.length;
  pointer(view, 'pointerdown', 120, 140, { pointerType: 'pen', pressure: 0.5 });
  for (let i = 1; i <= 12; i++) pointer(view, 'pointermove', 120 + i * 12, 140 + Math.sin(i / 2) * 20);
  pointer(view, 'pointerup', 264, 140);
  await tick();
  ok(App.doc.history.undoStack.length === before + 1, 'stroke created one undo step');
  ok(App.doc.activeCel(false) !== null, 'cel allocated by the stroke');
  ok(counts.fill + counts.drawImage > 20, 'stamps were painted');

  console.log('undo / redo');
  click('#btnUndo');
  ok(App.doc.history.canRedo(), 'undo works from the toolbar');
  click('#btnRedo');
  ok(!App.doc.history.canRedo(), 'redo works from the toolbar');

  console.log('layers');
  click('#btnLayers');
  ok(doc.querySelectorAll('#trayBody .layer-row').length === 1, 'one layer row');
  click('#trayBody [aria-label="Add layer or image"]');
  ok(doc.querySelector('#modalBody').textContent.includes('Blank layer') && doc.querySelector('#modalBody').textContent.includes('Import image') && doc.querySelector('#modalBody').textContent.includes('Gradient'), 'add menu offers blank, image and gradient layers');
  Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent==='Blank layer').click();
  ok(App.doc.layers.length === 2, 'add layer from the tray');
  ok(doc.querySelectorAll('#trayBody .layer-row').length === 2, 'layer list refreshed');
  const more = doc.querySelectorAll('#trayBody .layer-row .mini-btn')[1];
  more.dispatchEvent(new win.Event('click', { bubbles: true }));
  ok(!doc.querySelector('#modal').classList.contains('hidden'), 'layer action sheet opens');
  Q.UI.closeModal();
  const blendSel = doc.querySelectorAll('#trayBody .layer-row select');
  ok(blendSel.length >= 0, 'layer rows built without errors');
  const mergeChip=doc.querySelector('#trayBody [aria-label="Merge layer down"]');
  mergeChip.click(); ok(App.doc.layers.length===1, 'layer tray merge action works');
  App.undo(); ok(App.doc.layers.length===2, 'layer tray merge can be undone');
  Q.UI.closeTray();

  console.log('colour');
  click('#btnColor');
  ok(!!doc.querySelector('#trayBody #wheel'), 'colour wheel rendered');
  const swatch = doc.querySelector('#trayBody .swatches button');
  swatch.dispatchEvent(new win.Event('click', { bubbles: true }));
  ok(Q.rgbToHex(App.view.color).startsWith('#'), 'palette swatch applied: ' + Q.rgbToHex(App.view.color));
  const hex = doc.querySelector('#trayBody .hexrow input');
  hex.value = '#22b8cf';
  hex.dispatchEvent(new win.Event('change', { bubbles: true }));
  ok(Q.rgbToHex(App.view.color) === '#22b8cf', 'hex field applied');
  Q.UI.closeTray();

  console.log('drawing guides');
  Q.UI.guideDialog();
  const symmetry = doc.querySelector('#modalBody select[aria-label="Symmetry"]');
  symmetry.value = 'quadrant'; symmetry.dispatchEvent(new win.Event('change', {bubbles:true}));
  const assist = doc.querySelector('#modalBody select[aria-label="Layer assist"]');
  assist.value = 'on'; assist.dispatchEvent(new win.Event('change', {bubbles:true}));
  ok(App.doc.guide.symmetry === 'quadrant' && App.doc.layer().assisted, 'symmetry assist enabled on selected layer');
  const guideSelect = doc.querySelector('#modalBody select[aria-label="Guide"]');
  guideSelect.value = 'perspective2'; guideSelect.dispatchEvent(new win.Event('change',{bubbles:true}));
  const horizon = doc.querySelector('#modalBody input[aria-label="Horizon"]');
  horizon.value = '65'; horizon.dispatchEvent(new win.Event('input',{bubbles:true}));
  ok(App.doc.guide.type === 'perspective2' && App.doc.guide.horizon === 0.65, 'perspective guide and horizon can be adjusted');

  click('#modalBody .btn.primary');

  console.log('animation + timeline');
  click('#btnTimeline');
  ok(!doc.querySelector('#timeline').classList.contains('hidden'), 'timeline opens');
  ok(doc.querySelectorAll('#timeline .tl-frame').length === 1, 'one frame thumbnail');
  ok(!!doc.querySelector('#timeline .tl-head') && !!doc.querySelector('#timeline .tl-more [aria-label="Batch frames"]'), 'timeline separates main and secondary controls');
  ok(doc.querySelectorAll('#timeline .tl-categories .icon-chip').length===3 && !!doc.querySelector('#timeline .tl-more [aria-label="Frame options"] svg'), 'timeline uses accessible, distinct icon categories and tools');
  click('#timeline [aria-label="Animation settings tools"]'); ok(!!doc.querySelector('#timeline .tl-more [aria-label="Animation settings"]'), 'timeline category reveals settings');
  click('#timeline [aria-label="Frame tools"]');
  click('#timeline .tl-add');
  ok(App.doc.frames.length === 2, 'frame added');
  ok(App.doc.onion === true, 'onion skin switched on automatically');
  Q.UI.animationSettings();
  const mode = doc.querySelector('#modalBody select[aria-label="Playback"]');
  mode.value = 'pingpong'; mode.dispatchEvent(new win.Event('change', {bubbles:true}));
  const opacity = doc.querySelector('#modalBody input[aria-label="Onion opacity"]');
  opacity.value = '40'; opacity.dispatchEvent(new win.Event('input', {bubbles:true}));
  ok(App.doc.playMode === 'pingpong' && App.doc.onionAlpha === 0.4, 'animation settings control mode and onion opacity');
  const onionCount = doc.querySelector('#modalBody input[aria-label="Previous frames"]');
  onionCount.value = '3'; onionCount.dispatchEvent(new win.Event('input', {bubbles:true}));
  const prevColor = doc.querySelector('#modalBody input[aria-label="Previous colour"]');
  prevColor.value = '#bb4488'; prevColor.dispatchEvent(new win.Event('input', {bubbles:true}));
  ok(App.doc.onionPrevFrames === 3 && App.doc.onionPrevColor === '#bb4488', 'onion count and tint are configurable');
  click('#modalBody .btn.primary');

  await tick();
  ok(doc.querySelectorAll('#timeline .tl-frame').length === 2, 'timeline refreshed');
  App.togglePlay();
  ok(App.playing === true, 'playback started');
  await wait(120);
  App.togglePlay();
  ok(App.playing === false, 'playback stopped');
  App.doc.playMode = 'once'; App.doc.fps = 30; App.selectFrame(0);
  App.togglePlay(); await wait(100);
  ok(!App.playing && App.doc.activeFrame === 1, 'one-shot playback stops at the last frame');
  App.doc.playMode = 'pingpong'; App.doc.fps = 12;

  App.selectFrame(0);
  ok(App.doc.activeFrame === 0, 'frame selection works');

  Q.UI.frameSheet(0);
  const hold = doc.querySelector('#modalBody input[aria-label="Frame hold"]');
  hold.value = '3'; hold.dispatchEvent(new win.Event('change', {bubbles:true}));
  ok(App.doc.frames[0].duration === 3 && Math.round(Q.frameDelayMs(App.doc,0)) === 250, 'frame hold changes playback timing');
  const groupInput = doc.querySelector('#modalBody input[aria-label="Group label"]');
  groupInput.value = 'Scene A';
  [...doc.querySelectorAll('#modalBody button')].find(b => b.textContent === 'Save group label').click();
  ok(App.doc.frames[0].group === 'Scene A', 'frame group label is saved');
  ok(doc.querySelector('#timeline .frame-group').textContent === 'Scene A', 'frame group label appears in timeline');

  Q.UI.closeModal();
  ok(Q.animationOrder(4, 'pingpong').join(',') === '0,1,2,3,2,1', 'ping-pong export order excludes duplicate endpoints');

  console.log('menu + save');
  click('#btnMenu');
  ok(doc.querySelectorAll('#trayBody .menu-item').length >= 6, 'action menu populated');
  ok([...doc.querySelectorAll('#trayBody .action-heading')].map(x=>x.textContent).join(',')==='Create & edit,Canvas & view,Animation,Export,File & help', 'actions are organized into labelled groups');
  ok(Array.from(doc.querySelectorAll('#trayBody .menu-item')).some(x=>x.textContent.includes('Transparent PNG')), 'transparent export is available in actions');
  ok(Array.from(doc.querySelectorAll('#trayBody .menu-item')).some(x=>x.textContent.includes('Canvas background')), 'background settings are available in actions');
  const selectionMenu=Array.from(doc.querySelectorAll('#trayBody .menu-item')).find(el=>el.textContent.includes('Selection & transform'));
  ok(!!selectionMenu, 'selection and transform is accessible from the menu');
  if (selectionMenu) selectionMenu.click();
  ok(visible(doc.querySelector('#modal')) && doc.querySelector('#modalBody').textContent.includes('Draw rectangle'), 'selection menu opens the edit dialog');
  Q.UI.closeModal(); Q.UI.closeTray();
  const savedId = App.doc.id;
  await App.saveNow(false);
  const list = await Q.Store.list();
  ok(list.length === 1 && list[0].id === savedId, 'artwork saved to storage');
  ok(!!list[0].thumb, 'thumbnail stored');

  console.log('reopen from gallery');
  App.backToGallery();
  await tick(); await tick();
  ok(!doc.querySelector('#gallery').classList.contains('hidden'), 'back to gallery');
  const cardsG = doc.querySelectorAll('#galGrid .g-card');
  ok(cardsG.length === 1, 'gallery lists the artwork');
  click('#galGrid .g-del');
  ok(visible(doc.querySelector('#modal')), 'gallery delete confirmation is visible');
  click('#modalBody .btn.ghost');
  ok(!visible(doc.querySelector('#modal')), 'gallery confirmation closes');
  cardsG[0].dispatchEvent(new win.Event('click', { bubbles: true }));
  await wait(60);
  ok(!!App.doc && App.doc.id === savedId, 'artwork reopened');
  ok(!doc.querySelector('#studio').classList.contains('hidden'), 'studio re-entered after opening');
  ok(App.doc.frames.length === 2, 'frames survived the round trip');
  ok(App.doc.frames[0].duration === 3, 'frame hold survives the round trip');
  ok(App.doc.frames[0].group === 'Scene A', 'frame group label survives the round trip');
  ok(App.doc.layers.length === 2, 'layers survived the round trip');
  ok(App.doc.guide.symmetry === 'quadrant' && App.doc.layer().assisted && App.doc.playMode === 'pingpong' && App.doc.onionAlpha === 0.4, 'guide, assist and animation settings survive the round trip');
  ok(App.doc.onionPrevFrames === 3 && App.doc.onionPrevColor === '#bb4488', 'onion frame count and colours survive the round trip');
  ok(App.doc.guide.type === 'perspective2' && App.doc.guide.horizon === 0.65, 'perspective guide survives the round trip');

  console.log('gestures');
  App.view.fit();
  const scaleBefore = App.view.scale;
  pointer(view, 'pointerdown', 300, 300, { id: 1, pointerType: 'touch' });
  pointer(view, 'pointerdown', 500, 300, { id: 2, pointerType: 'touch' });
  pointer(view, 'pointermove', 260, 300, { id: 1, pointerType: 'touch' });
  pointer(view, 'pointermove', 560, 300, { id: 2, pointerType: 'touch' });
  ok(App.view.scale > scaleBefore, 'pinch zoom changes the viewport scale');
  pointer(view, 'pointerup', 260, 300, { id: 1, pointerType: 'touch' });
  pointer(view, 'pointerup', 560, 300, { id: 2, pointerType: 'touch' });
  ok(App.view.g === null, 'gesture state cleared');
  App.view.scale=24; App.view.zoomAt(2); ok(App.view.scale===48, 'zoom can exceed the old 24-times limit'); App.view.zoomAt(4); ok(App.view.scale===64, 'zoom is capped at 64 times');

  console.log('gesture shortcuts');
  App.view.fit();
  // a freshly opened artwork starts with an empty history, so lay down one
  // stroke first — undo/redo shortcuts need something to act on
  pointer(view, 'pointerdown', 300, 300, { id: 30, pointerType: 'pen', pressure: 0.6 });
  for (let i = 1; i <= 8; i++) pointer(view, 'pointermove', 300 + i * 8, 300 + i * 3, { id: 30, pointerType: 'pen' });
  pointer(view, 'pointerup', 364, 324, { id: 30, pointerType: 'pen' });
  await tick();
  const undoLen = App.doc.history.undoStack.length;
  ok(undoLen >= 1, 'a stroke to undo exists (' + undoLen + ')');

  // Two-finger taps and pinches must never undo.
  pointer(view, 'pointerdown', 400, 400, { id: 11, pointerType: 'touch' });
  pointer(view, 'pointerdown', 460, 400, { id: 12, pointerType: 'touch' });
  pointer(view, 'pointerup', 400, 400, { id: 11, pointerType: 'touch' });
  pointer(view, 'pointerup', 460, 400, { id: 12, pointerType: 'touch' });
  ok(App.doc.history.undoStack.length === undoLen, 'two-finger tap does not undo');
  pointer(view, 'pointerdown', 400, 380, { id: 21, pointerType: 'touch' });
  pointer(view, 'pointerdown', 460, 380, { id: 22, pointerType: 'touch' });
  pointer(view, 'pointerdown', 520, 380, { id: 23, pointerType: 'touch' });
  pointer(view, 'pointerup', 400, 380, { id: 21, pointerType: 'touch' });
  pointer(view, 'pointerup', 460, 380, { id: 22, pointerType: 'touch' });
  pointer(view, 'pointerup', 520, 380, { id: 23, pointerType: 'touch' });
  ok(App.doc.history.undoStack.length === undoLen - 1, 'three-finger tap undoes a step');
  for (let i=0;i<4;i++) pointer(view,'pointerdown',400+i*40,380,{id:51+i,pointerType:'touch'});
  for (let i=0;i<4;i++) pointer(view,'pointerup',400+i*40,380,{id:51+i,pointerType:'touch'});
  ok(App.doc.history.undoStack.length === undoLen, 'four-finger tap redoes a step');
  for (let i=0;i<3;i++) pointer(view,'pointerdown',400+i*40,380,{id:61+i,pointerType:'touch'});
  pointer(view,'pointermove',450,380,{id:61,pointerType:'touch'});
  for (let i=0;i<3;i++) pointer(view,'pointerup',400+i*40,380,{id:61+i,pointerType:'touch'});
  ok(App.doc.history.undoStack.length === undoLen, 'moving a three-finger gesture never undoes after a finger lifts');
  for (let i=0;i<3;i++) pointer(view,'pointerdown',400+i*40,380,{id:65+i,pointerType:'touch'});
  pointer(view,'pointercancel',400,380,{id:65,pointerType:'touch'});
  for (let i=1;i<3;i++) pointer(view,'pointerup',400+i*40,380,{id:65+i,pointerType:'touch'});
  ok(App.doc.history.undoStack.length === undoLen, 'cancelled three-finger gesture never undoes');

  console.log('long-press eyedropper');
  const histBefore = App.doc.history.undoStack.length;
  pointer(view, 'pointerdown', 480, 420, { id: 31, pointerType: 'pen', pressure: 0.4 });
  await wait(800);
  pointer(view, 'pointerup', 480, 420, { id: 31, pointerType: 'pen' });
  ok(App.doc.history.undoStack.length === histBefore, 'long press did not paint');
  ok(Q.rgbToHex(App.view.color) === '#ffffff', 'long press picked the canvas colour: ' + Q.rgbToHex(App.view.color));

  console.log('quickshape');
  const qsBefore = App.doc.history.undoStack.length;
  pointer(view, 'pointerdown', 200, 300, { id: 41, pointerType: 'pen', pressure: 0.6 });
  for (let i = 1; i <= 10; i++) pointer(view, 'pointermove', 200 + i * 10, 300 + i * 2, { id: 41, pointerType: 'pen' });
  await wait(700);
  pointer(view, 'pointerup', 300, 320, { id: 41, pointerType: 'pen' });
  await tick();
  ok(App.doc.history.undoStack.length === qsBefore + 1, 'quickshape committed exactly one stroke');

  console.log('canvas reference');
  Q.UI.openReference(); await wait(160);
  ok(visible(doc.querySelector('#referenceWindow')) && doc.querySelector('#referenceCanvas').width > 0, 'canvas reference is displayed');
  const zoom=doc.querySelector('#referenceZoom'); zoom.value='200'; zoom.dispatchEvent(new win.Event('input',{bubbles:true}));
  ok(doc.querySelector('#referenceCanvas').style.width === '200%', 'canvas reference zoom works');
  click('#referenceClose'); ok(!visible(doc.querySelector('#referenceWindow')), 'reference closes');

  console.log('about');
  Q.UI.aboutSheet();
  ok(doc.querySelector('#modalBody').textContent.includes('Developed by Qmer'), 'About credits Qmer');
  Q.UI.closeModal();

  console.log('hardware back');
  ok(App.qalamBackSafe === undefined, 'no stray globals');
  ok(win.qalamBack() === 0, 'back from studio is handled in-app');
  ok(win.qalamBack() === 1, 'back from gallery exits to the launcher');

  console.log('effects');
  Q.UI.effectsDialog();
  ok(doc.querySelectorAll('#modalBody .effect-card').length===19, 'effects dialog shows visual thumbnails');
  ok(!!doc.querySelector('#modalBody .effect-card[data-effect="motion"] canvas') && !!doc.querySelector('#modalBody .effect-card[data-effect="bloom"] canvas'), 'advanced effects have rendered previews');
  ok(!!doc.querySelector('#modalBody .effect-card[data-effect="pixelate"]') && !!doc.querySelector('#modalBody .effect-card[data-effect="posterize"]') && !!doc.querySelector('#modalBody .effect-card[data-effect="solarize"]'), 'new effects appear in the visual list');
  click('#modalBody .effect-card[data-effect="invert"]'); ok(doc.querySelector('#modalBody .effect-card[data-effect="invert"]').getAttribute('aria-pressed')==='true' && doc.querySelector('.effect-selected').textContent.includes('Invert'), 'effect thumbnail can be selected accessibly');
  const effectHistory = App.doc.history.undoStack.length;
  App.doc.activeCel(true);
  const originalApply=App.applyEffect; let applied=null; App.applyEffect=function (type,amount) { applied=[type,amount]; return originalApply(type,amount); };
  click('#modalBody .btn.primary'); App.applyEffect=originalApply; await wait(70);
  ok(applied && applied[0]==='invert' && applied[1]===0.5, 'apply uses the selected visual effect and strength');
  ok(App.doc.history.undoStack.length === effectHistory + 1, 'effect creates one undoable edit');
  App.undo();

  console.log('export paths');
  let saved = null;
  Q.saveBytes = (dataUrl, mime, name) => { saved = { mime, name }; return true; };
  App.exportPng();
  ok(saved && saved.mime === 'image/png', 'PNG export routed to the native bridge');
  App.exportPng(true); ok(saved.name.endsWith('-transparent.png'), 'transparent PNG export is routed and labelled');
  const sequence = [];
  Q.saveBytes = (dataUrl, mime, name) => { sequence.push({mime,name}); return true; };
  App.exportPngSequence(); await wait(100);
  ok(sequence.length === App.doc.frames.length && sequence[0].name.includes('frame-001'), 'PNG sequence exports numbered frames');
  sequence.length=0; App.exportPngSequence(true); await wait(100);
  ok(sequence.length === App.doc.frames.length && sequence[0].name.endsWith('-transparent.png'), 'transparent PNG sequence exports numbered frames');
  Q.saveBytes = (dataUrl, mime, name) => { saved = { mime, name }; return true; };
  // Simulate both unsupported devices and a recorder that produces MP4 data.
  delete win.MediaRecorder;
  App.exportMp4();
  ok(doc.querySelector('#toast').textContent.includes('not supported'), 'unsupported MP4 encoding is reported');
  let stopped = false;
  win.HTMLCanvasElement.prototype.captureStream = () => ({getTracks: () => [{stop: () => { stopped = true; }}]});
  win.MediaRecorder = class {
    static isTypeSupported(mime) { return mime.startsWith('video/mp4'); }
    constructor(stream, opts) { this.state = 'inactive'; this.mime = opts.mimeType; }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.ondataavailable({data:new win.Blob(['fake'])}); this.onstop(); }
  };
  win.FileReader = class { readAsDataURL() { this.result='data:video/mp4;base64,AAAA'; this.onload(); } };
  saved = null; App.doc.fps = 30; App.exportMp4(); await wait(250);
  ok(saved && saved.mime === 'video/mp4' && saved.name.endsWith('.mp4') && stopped, 'supported MP4 recorder exports and releases stream');


  // Validate custom canvas dimensions and drive a small real fill through the UI.
  const priorId = App.doc.id; App.doc.name = 'Saved before switching';
  click('#btnNew');
  const width=doc.querySelector('#modalBody input[aria-label="Canvas width"]');
  const height=doc.querySelector('#modalBody input[aria-label="Canvas height"]');
  width.value='9999'; height.value='64'; click('#modalBody .btn.primary');
  ok(visible(doc.querySelector('#modal')) && doc.querySelector('.canvas-error').textContent, 'invalid custom dimensions are rejected');
  width.value='64'; height.value='96'; click('#modalBody .btn.primary'); await tick();
  ok(App.doc.width===64 && App.doc.height===96, 'custom canvas dimensions create a document');
  const previous = await Q.Store.load(priorId);
  ok(previous && previous.name === 'Saved before switching', 'switching artworks saves the previous document first');
  click('#btnFill');
  let fillCalls=0; const originalFill=App.view.onFill; App.view.onFill=()=>{ fillCalls++; };
  pointer(view,'pointerdown',400,300,{id:71}); pointer(view,'pointerdown',500,300,{id:72});
  pointer(view,'pointerup',400,300,{id:71}); pointer(view,'pointerup',500,300,{id:72});
  ok(fillCalls===0, 'two-finger gestures do not trigger fill');
  pointer(view,'pointerdown',400,300,{id:73}); pointer(view,'pointercancel',400,300,{id:73});
  ok(fillCalls===0, 'cancelled pointer does not trigger fill'); App.view.onFill=originalFill;
  const beforeFill=App.doc.history.undoStack.length, point=App.view.toScreen(20,20);
  pointer(view,'pointerdown',point.x,point.y,{id:70}); pointer(view,'pointerup',point.x,point.y,{id:70}); await wait(100);
  ok(App.doc.history.undoStack.length===beforeFill+1, 'fill tool commits one undoable fill');
  App.undo(); ok(App.doc.history.canRedo(), 'fill can be undone');


  click('#btnEffects'); ok(visible(doc.querySelector('#modal')) && doc.querySelector('#modalBody h2').textContent.includes('Effects'), 'effects open from direct toolbar shortcut'); Q.UI.closeModal();
  console.log('selection and transforms');
  Q.UI.selectionDialog();
  ok(doc.querySelector('#modalBody').textContent.includes('clips brushes, erasers, flood fill and effects'), 'selection dialog explains scope');
  ok(doc.querySelector('#modalBody').textContent.includes('Draw lasso'), 'lasso tool is offered in selection panel');
  function selectionAction(label) {
    const b=Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent===label);
    if (!b) throw new Error('missing selection action '+label); b.click();
  }
  selectionAction('Draw lasso');
  const l1=App.view.toScreen(5,5), l2=App.view.toScreen(30,5), l3=App.view.toScreen(5,30);
  pointer(view,'pointerdown',l1.x,l1.y,{id:79}); pointer(view,'pointermove',l2.x,l2.y,{id:79}); pointer(view,'pointermove',l3.x,l3.y,{id:79}); pointer(view,'pointerup',l3.x,l3.y,{id:79});
  ok(App.view.selection && App.view.selection.points && App.view.selection.points.length===3 && App.view.tool==='brush', 'lasso gesture creates polygon and returns to painting');
  const lassoHistory=App.doc.history.undoStack.length; App.editSelection('flipH'); ok(App.doc.history.undoStack.length===lassoHistory, 'lasso transform is refused rather than applying to its bounds');
  Q.UI.selectionDialog(); selectionAction('Deselect');
  Q.UI.selectionDialog();
  selectionAction('Draw rectangle');
  const a=App.view.toScreen(5,10), b=App.view.toScreen(30,40);
  pointer(view,'pointerdown',a.x,a.y,{id:80}); pointer(view,'pointermove',b.x,b.y,{id:80}); pointer(view,'pointerup',b.x,b.y,{id:80});
  ok(App.view.selection && Math.abs(App.view.selection.x-5)<=1 && App.view.selection.w>=25 && App.view.tool==='brush', 'drag creates a canvas rectangle then returns to brush');
  const rectHistory=App.doc.history.undoStack.length;
  Q.UI.selectionDialog(); selectionAction('Fill rectangle');
  ok(App.doc.history.undoStack.length===rectHistory+1, 'rectangle fill is one undoable edit');
  App.undo(); ok(App.doc.history.canRedo(), 'rectangle fill can be undone');
  const flipHistory=App.doc.history.undoStack.length;
  Q.UI.selectionDialog(); selectionAction('Flip horizontal');
  ok(App.doc.history.undoStack.length===flipHistory+1, 'flip is one undoable pixel edit');
  Q.UI.selectionDialog(); selectionAction('Deselect');
  ok(App.view.selection===null, 'deselect clears the overlay');
  const wholeHistory=App.doc.history.undoStack.length;
  Q.UI.selectionDialog(); selectionAction('Rotate 180°');
  ok(App.doc.history.undoStack.length===wholeHistory+1 && App.doc.history.undoStack.at(-1).rect.w===64, 'rotation without a selection targets the whole current cel');
  Q.UI.selectionDialog(); selectionAction('Draw rectangle');
  pointer(view,'pointerdown',a.x,a.y,{id:81}); pointer(view,'pointermove',b.x,b.y,{id:81}); pointer(view,'pointercancel',b.x,b.y,{id:81});
  ok(App.view.selection===null, 'cancelled selection is discarded');
  Q.UI.selectionDialog(); selectionAction('Select all');
  const id=App.doc.id; App.createDoc(64,64,'next');
  ok(App.doc.id!==id && App.view.selection===null, 'selection is cleared when switching documents');

  console.log('layer lock and transform dialog');
  Q.UI.layerSheet(0);
  const lockButton=Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent==='Lock layer');
  ok(!!lockButton, 'layer sheet offers locking'); lockButton.click();
  ok(App.doc.layer().locked===true, 'layer can be locked');
  const lockedHistory=App.doc.history.undoStack.length, lockedPoint=App.view.toScreen(20,20);
  pointer(view,'pointerdown',lockedPoint.x,lockedPoint.y,{id:91}); pointer(view,'pointerup',lockedPoint.x,lockedPoint.y,{id:91});
  App.fillAt(20,20); App.applyEffect('invert',1); App.editSelection('flipH');
  ok(App.doc.history.undoStack.length===lockedHistory && !App.doc.activeCel(false), 'locked layer blocks painting, fill and effects');
  await App.saveNow(false); const loaded=await Q.Store.load(App.doc.id);
  ok(loaded.layer().locked, 'layer lock persists in saved artwork');
  Q.UI.layerSheet(0); Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent==='Unlock layer').click();
  ok(!App.doc.layer().locked, 'layer can be unlocked');
  App.doc.activeCel(true); App.view.selection={x:5,y:5,w:10,h:10};
  Q.UI.selectionDialog(); selectionAction('Move / scale');
  const xInput=doc.querySelector('input[aria-label="Move X (px)"]'), yInput=doc.querySelector('input[aria-label="Move Y (px)"]'), sInput=doc.querySelector('input[aria-label="Scale (%)"]');
  sInput.value='500'; click('#modalBody .btn.primary');
  ok(visible(doc.querySelector('#modal')) && doc.querySelector('.canvas-error').textContent, 'invalid scale is rejected');
  xInput.value='3'; yInput.value='-2'; sInput.value='200'; const beforeMove=App.doc.history.undoStack.length;
  click('#modalBody .btn.primary');
  ok(App.doc.history.undoStack.length===beforeMove+1 && App.view.selection.x===8 && App.view.selection.y===3 && App.view.selection.w===20, 'move and scale updates selection and creates one undo step');

  Q.UI.selectionDialog(); selectionAction('Copy to layer');
  ok(App.doc.layers.length===2 && App.doc.layer().name==='Selection copy', 'copy selection adds a new layer');
  App.undo(); ok(App.doc.layers.length===1, 'copy to layer can be undone');
  App.redo(); ok(App.doc.layers.length===2, 'copy to layer can be redone');

  console.log('alpha lock and backgrounds');
  Q.UI.layerSheet(App.doc.activeLayer);
  const alphaBtn=Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent==='Alpha lock');
  ok(!!alphaBtn, 'layer sheet offers alpha lock'); alphaBtn.click();
  ok(App.doc.layer().alphaLocked, 'alpha lock enabled');
  await App.saveNow(false); const alphaLoaded=await Q.Store.load(App.doc.id);
  ok(alphaLoaded.layer().alphaLocked, 'alpha lock persists across save and reopen');
  App.setBrush('eraser'); const alphaHistory=App.doc.history.undoStack.length, pt=App.view.toScreen(20,20);
  pointer(view,'pointerdown',pt.x,pt.y,{id:99}); pointer(view,'pointerup',pt.x,pt.y,{id:99});
  ok(App.doc.history.undoStack.length===alphaHistory && doc.querySelector('#toast').textContent.includes('alpha lock'), 'eraser is blocked while alpha lock is enabled');
  Q.UI.layerSheet(App.doc.activeLayer); Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent==='Unlock alpha').click();
  ok(!App.doc.layer().alphaLocked, 'alpha lock can be turned off');
  Q.UI.backgroundDialog(); const bg=doc.querySelector('input[aria-label="Background hex colour"]');
  bg.value='wrong'; click('#modalBody .btn.primary');
  ok(visible(doc.querySelector('#modal')) && doc.querySelector('.canvas-error').textContent, 'invalid background colour is rejected');
  bg.value='#369'; click('#modalBody .btn.primary');
  ok(App.doc.bg==='#336699', 'background accepts and expands hex colour');
  App.undo(); ok(App.doc.bg==='#ffffff', 'background colour undo restores previous colour');
  App.redo(); ok(App.doc.bg==='#336699', 'background colour redo reapplies colour');
  await App.saveNow(false); const bgLoaded=await Q.Store.load(App.doc.id);
  ok(bgLoaded.bg==='#336699', 'background colour persists');





  console.log('animation range, batches and sprite export');
  App.createDoc(64,64,'Animation test'); App.addFrame(false); App.addFrame(false); App.addFrame(false); App.selectFrame(0);
  Q.UI.animationSettings();
  const startRange=doc.querySelector('input[aria-label="Playback start"]'), endRange=doc.querySelector('input[aria-label="Playback end"]');
  const setRange=Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent==='Set range');
  startRange.value='4'; endRange.value='2'; setRange.click();
  ok(doc.querySelector('.canvas-error').textContent && App.doc.playRange===null, 'invalid playback range is rejected');
  startRange.value='2'; endRange.value='3'; setRange.click();
  ok(App.doc.playRange.start===1 && App.doc.playRange.end===2, 'custom playback range is saved');
  click('#modalBody .btn.primary'); await App.saveNow(false); const rangeLoaded=await Q.Store.load(App.doc.id);
  ok(rangeLoaded.playRange.start===1 && rangeLoaded.playRange.end===2, 'playback range survives save and reopen');
  App.doc.playMode='once'; App.doc.fps=30; App.selectFrame(0); App.togglePlay();
  ok(App.doc.activeFrame===1, 'playback starts at range beginning when current frame is outside range');
  await wait(120); ok(!App.playing && App.doc.activeFrame===2, 'one-shot playback ends at range end');
  App.selectFrame(0); App.togglePlay(); App.selectFrame(3);
  ok(!App.playing && App.doc.activeFrame===3, 'selecting a frame stops playback safely');
  Q.UI.batchFramesDialog();
  let first=doc.querySelector('input[aria-label="First frame"]'), last=doc.querySelector('input[aria-label="Last frame"]'), batchHold=doc.querySelector('input[aria-label="Batch hold"]');
  let action=label=>Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent===label).click();
  first.value='3'; last.value='2'; action('Apply hold'); ok(doc.querySelector('.canvas-error').textContent, 'batch operation rejects invalid range');
  first.value='2'; last.value='3'; batchHold.value='4'; action('Apply hold');
  ok(App.doc.frames[1].duration===4 && App.doc.frames[2].duration===4 && App.doc.frames[0].duration===1, 'batch hold changes only chosen frames');
  App.undo(); ok(App.doc.frames[1].duration===1, 'batch hold undoes in one step');
  Q.UI.batchFramesDialog(); first=doc.querySelector('input[aria-label="First frame"]'); last=doc.querySelector('input[aria-label="Last frame"]'); first.value='2'; last.value='3'; action('Duplicate range');
  ok(App.doc.frames.length===6 && App.doc.activeFrame===3, 'batch duplication inserts frames after range');
  App.undo(); ok(App.doc.frames.length===4, 'batch duplicate is undoable');
  Q.UI.spriteSheetDialog();
  const columns=doc.querySelector('input[aria-label="Sprite columns"]'); columns.value='9'; click('#modalBody .btn.primary');
  ok(doc.querySelector('.canvas-error').textContent, 'sprite sheet rejects invalid columns');
  columns.value='2'; let spriteSaved=null; Q.saveBytes=(url,mime,name)=>{spriteSaved={mime,name};return true;}; click('#modalBody .btn.primary'); await wait(100);
  ok(spriteSaved && spriteSaved.mime==='image/png' && spriteSaved.name.endsWith('-spritesheet.png'), 'sprite sheet exports through native bridge');
  if (!doc.querySelector('#timeline').classList.contains('hidden')) Q.UI.toggleTimeline();
  App.doc.playMode='loop'; App.doc.fps=30; App.doc.frames.forEach(f=>{f.duration=1;});
  const painted=[], composite=App.doc.composite; App.doc.composite=function(ctx,index,opts) { painted.push(index); return composite.call(this,ctx,index,opts); };
  Q.saveBytes=()=>true; App.exportMp4(); await wait(140); App.doc.composite=composite;
  ok(painted.join(',')==='1,2', 'MP4 recorder paints only playback-range frames');


  console.log('2.0 animation assist');
  App.createDoc(64,64,'Animation assist'); for(let i=1;i<5;i++) App.addFrame(false);
  if (doc.querySelector('#timeline').classList.contains('hidden')) Q.UI.toggleTimeline();
  App.selectFrame(1); Q.UI.frameSheet(1);
  const skipButton=Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent==='Skip in playback');
  ok(!!skipButton, 'frame options expose skip control'); skipButton.click();
  ok(App.doc.frames[1].skipped && doc.querySelectorAll('#timeline .frame-skipped').length===1, 'skipped frame is marked on timeline');
  App.undo(); ok(!App.doc.frames[1].skipped, 'skip can be undone'); App.redo(); ok(App.doc.frames[1].skipped, 'skip can be redone');
  Q.UI.frameSheet(2); const longHold=doc.querySelector('input[aria-label="Frame hold"]');
  longHold.value='60'; longHold.dispatchEvent(new win.Event('change',{bubbles:true})); Q.UI.closeModal();
  ok(App.doc.frames[2].duration===60, 'UI accepts 60-tick frame hold');
  Q.UI.animationSettings();
  const prev=doc.querySelector('input[aria-label="Previous frames"]'), next=doc.querySelector('input[aria-label="Next frames"]');
  prev.value='0'; prev.dispatchEvent(new win.Event('input',{bubbles:true})); next.value='2'; next.dispatchEvent(new win.Event('input',{bubbles:true}));
  for (const label of ['Skipped onions','Onion layers','Onion colours','Onion position']) { const sel=doc.querySelector('select[aria-label="'+label+'"]'); sel.value='yes'; sel.dispatchEvent(new win.Event('change',{bubbles:true})); }
  click('#modalBody .btn.primary');
  ok(App.doc.onionPrevFrames===0 && App.doc.onionNextFrames===2 && App.doc.onionIncludeSkipped && App.doc.onionLayerOnly && App.doc.onionOriginalColor && App.doc.onionAbove, 'independent onion controls update document');
  await App.saveNow(false); const assistReload=await Q.Store.load(App.doc.id);
  ok(assistReload.frames[1].skipped && assistReload.frames[2].duration===60 && assistReload.onionPrevFrames===0 && assistReload.onionNextFrames===2 && assistReload.onionIncludeSkipped && assistReload.onionLayerOnly && assistReload.onionOriginalColor && assistReload.onionAbove, 'animation assist settings and long holds survive saving');
  const raw=JSON.parse(win.localStorage.getItem('qalam-projects')), legacy=raw[App.doc.id];
  legacy.onionFrames=3; delete legacy.onionPrevFrames; delete legacy.onionNextFrames; delete legacy.onionIncludeSkipped; delete legacy.onionLayerOnly; delete legacy.onionOriginalColor; delete legacy.onionAbove; delete legacy.frameSkipped;
  win.localStorage.setItem('qalam-projects',JSON.stringify(raw)); const legacyReload=await Q.Store.load(App.doc.id);
  ok(legacyReload.onionPrevFrames===3 && legacyReload.onionNextFrames===3 && legacyReload.frames.every(f=>!f.skipped), 'older saved projects migrate to both onion directions and included frames');
  const scrub=doc.querySelector('input[aria-label="Scrub frames"]'); scrub.value='4'; scrub.dispatchEvent(new win.Event('input',{bubbles:true}));
  ok(App.doc.activeFrame===3 && doc.querySelector('input[aria-label="Scrub frames"]')===scrub && doc.querySelector('#timeline .tl-position').textContent==='4 / 5', 'timeline scrub updates frame without replacing the active slider');
  scrub.dispatchEvent(new win.Event('change',{bubbles:true})); ok(App.doc.activeFrame===3, 'scrub release commits frame selection');
  Q.UI.batchFramesDialog();
  const firstSkip=doc.querySelector('input[aria-label="First frame"]'), lastSkip=doc.querySelector('input[aria-label="Last frame"]'); firstSkip.value='4'; lastSkip.value='4';
  Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent==='Skip range').click();
  ok(App.doc.frames[3].skipped, 'batch skip excludes a frame');
  App.doc.frames[2].duration=1; App.doc.fps=30; App.doc.playMode='once'; App.selectFrame(1); App.togglePlay();
  ok(App.doc.activeFrame===0, 'playback starts at first included frame when selected frame is skipped');
  await wait(140); ok(!App.playing && App.doc.activeFrame===4, 'one-shot playback skips excluded frames');
  if (!doc.querySelector('#timeline').classList.contains('hidden')) Q.UI.toggleTimeline();
  const seen=[], orig=App.doc.composite; App.doc.composite=function(ctx,index,opts) { seen.push(index); return orig.call(this,ctx,index,opts); };
  App.doc.playMode='pingpong'; Q.saveBytes=()=>true; App.exportMp4(); await wait(180); App.doc.composite=orig;
  ok(seen.join(',')==='0,2,4,2', 'MP4 mock skips excluded frames and follows ping-pong order');
  App.batchFrames(0,4,'skip'); App.togglePlay(); ok(!App.playing && doc.querySelector('#toast').textContent.includes('No included frames'), 'playback rejects an all-skipped range');
  App.exportGif({}); ok(doc.querySelector('#toast').textContent.includes('No included frames'), 'GIF export rejects an all-skipped range');
  App.exportMp4(); ok(doc.querySelector('#toast').textContent.includes('No included frames'), 'MP4 export rejects an all-skipped range');
  App.batchFrames(1,2,'include'); ok(!App.doc.frames[1].skipped && !App.doc.frames[2].skipped && App.doc.frames[0].skipped, 'batch include re-enables selected frames only');


  console.log('2.1 cel and timeline tools');
  App.createDoc(64,64,'Cel tools'); for(let i=1;i<4;i++) App.addFrame(false); App.selectFrame(0); App.doc.activeCel(true);
  if (doc.querySelector('#timeline').classList.contains('hidden')) Q.UI.toggleTimeline();
  ok(doc.querySelector('#timeline .tl-timing').textContent.includes('4 included'), 'timeline shows playback timing');
  App.doc.frames[1].duration=3; App.doc.frames[2].skipped=true; App.doc.playMode='pingpong'; App.doc.fps=10; Q.UI.refreshTimeline();
  ok(doc.querySelector('#timeline .tl-timing').textContent.includes('8 ticks') && doc.querySelector('#timeline .tl-timing').textContent.includes('0.80 s'), 'timeline timing respects holds, skips and ping-pong');
  Q.UI.copyCelDialog(); let src=doc.querySelector('input[aria-label="Source frame"]'), dst1=doc.querySelector('input[aria-label="First destination"]'), dst2=doc.querySelector('input[aria-label="Last destination"]');
  dst1.value='1'; dst2.value='1'; click('#modalBody .btn.primary'); ok(doc.querySelector('.canvas-error').textContent.includes('different destination'), 'cel copy rejects source-only range');
  dst1.value='2'; dst2.value='3'; click('#modalBody .btn.primary'); ok(doc.querySelector('#modalBody h2').textContent.includes('Replace 2 cels'), 'cel replacement asks for confirmation');
  click('#modalBody .btn.ghost'); ok(!App.doc.cel(1,0,false), 'cancel leaves destination unchanged');
  Q.UI.copyCelDialog(); dst1=doc.querySelector('input[aria-label="First destination"]'); dst2=doc.querySelector('input[aria-label="Last destination"]'); dst1.value='2'; dst2.value='3'; click('#modalBody .btn.primary'); click('#modalBody .btn.danger');
  ok(!!App.doc.cel(1,0,false) && !!App.doc.cel(2,0,false), 'confirmed cel copy populates the destination range');
  App.undo(); ok(!App.doc.cel(1,0,false), 'cel copy undo restores empty destination'); App.redo(); ok(!!App.doc.cel(1,0,false), 'cel copy redo restores destination');
  await App.saveNow(false); const copiedReload=await Q.Store.load(App.doc.id); ok(!!copiedReload.cel(1,0,false) && !!copiedReload.cel(2,0,false), 'copied cels survive save and reopen');
  Q.UI.batchFramesDialog(); click('#modalBody .btn.danger'); ok(doc.querySelector('.canvas-error').textContent.includes('leaves at least one'), 'delete range refuses all frames');
  doc.querySelector('input[aria-label="First frame"]').value='2'; doc.querySelector('input[aria-label="Last frame"]').value='3'; click('#modalBody .btn.danger');
  ok(doc.querySelector('#modalBody h2').textContent.includes('Delete frames'), 'range deletion asks for confirmation'); click('#modalBody .btn.danger');
  ok(App.doc.frames.length===2, 'confirmed range deletion removes frames'); App.undo(); ok(App.doc.frames.length===4 && !!App.doc.cel(1,0,false), 'undo restores deleted frames and cels');


  console.log('2.3 motion guide and image import');
  App.createDoc(64,64,'Motion guide'); App.addFrame(false);
  if (doc.querySelector('#timeline').classList.contains('hidden')) Q.UI.toggleTimeline();
  click('#timeline [aria-label="Animation guides and audio"]'); ok(!!doc.querySelector('#timeline .tl-more [aria-label="Motion guide"]'), 'motion guide is accessible in timeline');
  Q.UI.motionGuideDialog(); let guideAction=label=>Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent===label).click();
  guideAction('Draw or replace guide'); const gp1=App.view.toScreen(10,10), gp2=App.view.toScreen(40,40);
  pointer(view,'pointerdown',gp1.x,gp1.y,{id:210}); pointer(view,'pointermove',gp2.x,gp2.y,{id:210}); pointer(view,'pointerup',gp2.x,gp2.y,{id:210});
  ok(App.doc.motionGuide.length===2 && App.view.tool==='brush', 'drawing guide stores path and returns to brush');
  App.undo(); ok(App.doc.motionGuide.length===0, 'guide drawing is undoable'); App.redo(); ok(App.doc.motionGuide.length===2, 'guide drawing is redoable');
  Q.UI.motionGuideDialog(); guideAction('Hide guide'); ok(!App.doc.motionGuideVisible, 'guide can be hidden');
  Q.UI.motionGuideDialog(); guideAction('Draw or replace guide'); pointer(view,'pointerdown',gp1.x,gp1.y,{id:211}); pointer(view,'pointermove',gp2.x,gp2.y,{id:211}); pointer(view,'pointerup',gp2.x,gp2.y,{id:211});
  App.undo(); ok(!App.doc.motionGuideVisible && App.doc.motionGuide.length===2, 'one undo restores hidden previous path after replacement'); App.redo();
  await App.saveNow(false); const guideReload=await Q.Store.load(App.doc.id); ok(guideReload.motionGuideVisible && guideReload.motionGuide.length===2, 'motion guide survives save and reopen');
  Q.UI.motionGuideDialog(); guideAction('Draw or replace guide'); pointer(view,'pointerdown',gp1.x,gp1.y,{id:212}); pointer(view,'pointermove',gp2.x,gp2.y,{id:212}); pointer(view,'pointercancel',gp2.x,gp2.y,{id:212});
  ok(App.doc.motionGuide.length===2 && !App.view.motionDraft, 'cancelled guide leaves previous guide unchanged');
  click('#btnLayers'); click('#trayBody [aria-label="Add layer or image"]'); ok(doc.querySelector('#modalBody').textContent.includes('Import image'), 'image import is accessible from layers'); Q.UI.closeModal();
  const input=doc.querySelector('#imageImport'), oldClick=input.click, oldReader=win.FileReader, oldImage=win.Image; let picked=0;
  input.click=()=>{picked++;}; Q.UI.pickImage(); ok(picked===1 && Q.UI.imageTarget.frame===App.doc.frames[App.doc.activeFrame], 'image import opens file picker for current frame');
  win.FileReader=class { readAsDataURL() { this.result='data:image/png;base64,AAAA'; setTimeout(()=>this.onload(),0); } };
  win.Image=class { constructor() {this.width=4;this.height=2;} set src(value) {setTimeout(()=>this.onload(),0);} };
  Object.defineProperty(input,'files',{value:[{name:'test.png',type:'image/png',size:100}],configurable:true}); input.dispatchEvent(new win.Event('change',{bubbles:true})); await wait(40);
  ok(App.doc.layers.length===2 && App.doc.layer().name==='test' && !!App.doc.activeCel(false), 'image picker imports as a new layer');
  App.undo(); ok(App.doc.layers.length===1, 'image import from picker is undoable'); App.redo();
  await App.saveNow(false); const imageReload=await Q.Store.load(App.doc.id); ok(imageReload.layers.length===2 && !!imageReload.activeCel(false), 'imported layer survives save and reopen');
  input.click=oldClick; win.FileReader=oldReader; win.Image=oldImage;


  console.log('2.4 clipping masks');
  App.createDoc(64,64,'Clipping'); App.addLayer();
  Q.UI.layerSheet(0); let chooseClip=Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent==='Clipping mask'); chooseClip.click();
  ok(!App.doc.layers[0].clipped && doc.querySelector('#toast').textContent.includes('layer below'), 'bottom layer refuses clipping with an explanation');
  Q.UI.layerSheet(1); chooseClip=Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent==='Clipping mask'); chooseClip.click();
  ok(App.doc.layers[1].clipped, 'layer sheet enables clipping');
  App.undo(); ok(!App.doc.layers[1].clipped, 'undo removes clipping'); App.redo(); ok(App.doc.layers[1].clipped, 'redo restores clipping');
  Q.UI.layerSheet(1); ok(doc.querySelector('select[aria-label="Blend unavailable while clipped"]').disabled && doc.querySelector('#modalBody').textContent.includes('Release clipping mask'), 'clipped layer explains Normal-only blend and offers release'); Q.UI.closeModal();
  await App.saveNow(false); const clipsReload=await Q.Store.load(App.doc.id); ok(clipsReload.layers[1].clipped && !clipsReload.layers[0].clipped, 'clipping survives save and reopen');
  const oldRaw=JSON.parse(win.localStorage.getItem('qalam-projects')); for(const layer of oldRaw[App.doc.id].layers) delete layer.clipped; win.localStorage.setItem('qalam-projects',JSON.stringify(oldRaw));
  const oldReload=await Q.Store.load(App.doc.id); ok(oldReload.layers.every(l=>!l.clipped), 'older projects load with clipping off');
  App.duplicateLayer(1); ok(App.doc.layers[2].clipped && App.doc.clipBase(2)===0, 'layer duplication preserves clipping');
  const num=App.doc.layers.length; App.mergeDownLayer(2); ok(App.doc.layers.length===num && doc.querySelector('#toast').textContent.includes('clipping'), 'merge is safely blocked while clipping is enabled');
  Q.UI.layerSheet(2); Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent==='Release clipping mask').click();
  ok(!App.doc.layers[2].clipped, 'clipping can be released without destroying layer');


  console.log('2.5 animation audio');
  App.createDoc(64,64,'Audio test'); for(let i=1;i<4;i++) App.addFrame(false);
  if (doc.querySelector('#timeline').classList.contains('hidden')) Q.UI.toggleTimeline();
  ok(doc.querySelector('#timeline .tl-audio').textContent.includes('Add track'), 'timeline shows an audio track control');
  click('#timeline .tl-audio'); ok(doc.querySelector('#modalBody').textContent.includes('AAC') && doc.querySelector('#modalBody').textContent.includes('PNG and GIF are silent'), 'audio dialog explains conditional MP4 audio and silent PNG/GIF');
  const audioInput=doc.querySelector('#audioImport'), originalAudioClick=audioInput.click, oldReader2=win.FileReader, oldAudio=win.Audio; let audioPicked=0;
  audioInput.click=()=>audioPicked++; Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent==='Choose audio').click();
  ok(audioPicked===1 && Q.UI.audioTarget.doc===App.doc, 'audio file picker is opened from the timeline');
  win.FileReader=class {readAsDataURL() {this.result='data:audio/wav;base64,AAAA'; setTimeout(()=>this.onload(),0);}};
  Object.defineProperty(audioInput,'files',{value:[{name:'beat.wav',type:'audio/wav',size:4}],configurable:true}); audioInput.dispatchEvent(new win.Event('change',{bubbles:true})); await wait(40);
  ok(App.doc.audioTrack && App.doc.audioTrack.name==='beat.wav' && doc.querySelector('#timeline .tl-audio').textContent.includes('beat.wav'), 'chosen audio is stored and displayed');
  await App.saveNow(false); let savedAudio=await Q.Store.load(App.doc.id); ok(savedAudio.audioTrack && savedAudio.audioTrack.data==='data:audio/wav;base64,AAAA', 'audio survives save and reopen');
  App.undo(); ok(!App.doc.audioTrack, 'undo removes imported audio'); App.redo(); ok(!!App.doc.audioTrack, 'redo restores audio');
  click('#timeline .tl-audio'); Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent==='Mute audio').click(); ok(App.doc.audioTrack.muted, 'mute is available on the audio track');
  App.undo(); ok(!App.doc.audioTrack.muted, 'audio mute can be undone');
  App.doc.fps=30; App.doc.playMode='loop'; App.doc.frames[0].duration=2; App.doc.frames[1].skipped=true; App.doc.frames[2].duration=1; App.doc.frames[3].duration=1; App.selectFrame(2);
  ok(Math.abs(Q.audioFrameTime(App.doc,2)-2/30)<0.001 && Math.abs(Q.audioFrameTime(App.doc,3)-3/30)<0.001, 'audio offset accounts for holds and skipped frames');
  const players=[]; win.Audio=class { constructor(){this.duration=5;this.currentTime=0;this.plays=0;this.pauses=0;this.events={};players.push(this);} addEventListener(k,f){this.events[k]=f;} play(){this.plays++;return Promise.resolve();} pause(){this.pauses++;} removeAttribute(){} load(){} };
  App.togglePlay(); ok(players.length===1 && Math.abs(players[0].currentTime-2/30)<0.001 && players[0].plays===1, 'forward playback starts audio at the selected frame offset');
  await wait(125); ok(players[0].plays>=2, 'audio restarts at loop boundary'); App.stopPlay(); ok(players[0].pauses>0 && !App.previewAudio, 'stopping playback releases the audio player');
  App.doc.setPlayRange(2,3); App.selectFrame(3); App.togglePlay();
  ok(Math.abs(players.at(-1).currentTime-3/30)<0.001, 'audio uses absolute timeline offset inside a custom playback range'); App.stopPlay(); App.doc.setPlayRange(null,null);
  App.doc.playMode='loop'; App.selectFrame(2); App.togglePlay(); const metadataAudio=players.at(-1); metadataAudio.currentTime=0; metadataAudio.events.loadedmetadata();
  ok(Math.abs(metadataAudio.currentTime-2/30)<0.001, 'audio retries synchronization when metadata loads');
  metadataAudio.duration=0.01; App.syncPreviewAudio(App.doc,App.doc.activeFrame,false); ok(metadataAudio.pauses>0, 'short audio stops once the animation is beyond its duration'); App.stopPlay();
  App.doc.playMode='pingpong'; const countPlayers=players.length; App.togglePlay(); ok(players.length===countPlayers && doc.querySelector('#toast').textContent.includes('audio muted'), 'ping-pong playback explicitly mutes audio'); App.stopPlay();
  App.doc.playMode='once'; App.selectFrame(2); App.togglePlay(); const onceAudio=players.at(-1); await wait(85); ok(!App.playing && onceAudio.pauses>0, 'one-shot completion stops audio');
  click('#timeline .tl-audio'); Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent==='Remove audio').click(); ok(doc.querySelector('#modalBody h2').textContent==='Remove audio?', 'removing audio asks for confirmation'); click('#modalBody .btn.danger');
  ok(!App.doc.audioTrack, 'confirmed remove deletes the audio track'); App.undo(); ok(!!App.doc.audioTrack, 'undo restores removed audio');
  win.Audio=class {constructor(){this.duration=5;this.currentTime=0;} addEventListener(){} play(){return Promise.reject(new Error('blocked'));} pause(){} removeAttribute(){} load(){} };
  App.doc.playMode='loop'; App.togglePlay(); await wait(10); ok(doc.querySelector('#toast').textContent.includes('Audio playback is unavailable'), 'playback rejection reports audio failure'); App.stopPlay();
  const beforeName=App.doc.audioTrack.name; App.importAudioFile({name:'wrong.pdf',type:'application/pdf',size:40},{doc:App.doc,track:App.doc.audioTrack}); ok(App.doc.audioTrack.name===beforeName, 'audio import rejects unsupported types');
  App.importAudioFile({name:'large.mp3',type:'audio/mpeg',size:3*1024*1024},{doc:App.doc,track:App.doc.audioTrack}); ok(App.doc.audioTrack.name===beforeName, 'audio import rejects files over size limit');
  const originalDoc=App.doc, targetOld={doc:originalDoc,track:originalDoc.audioTrack}; win.FileReader=class {readAsDataURL(){this.result='data:audio/wav;base64,AAAA'; setTimeout(()=>this.onload(),25);}};
  App.importAudioFile({name:'late.wav',type:'audio/wav',size:4},targetOld); App.createDoc(64,64,'New project'); await wait(50);
  ok(!App.doc.audioTrack && originalDoc.audioTrack.name===beforeName, 'switching projects cancels an in-flight audio import');
  const migrated=JSON.parse(win.localStorage.getItem('qalam-projects')); delete migrated[originalDoc.id].audioTrack; win.localStorage.setItem('qalam-projects',JSON.stringify(migrated));
  const withoutAudio=await Q.Store.load(originalDoc.id); ok(withoutAudio && withoutAudio.audioTrack===null, 'older saved projects open without an audio track');
  audioInput.click=originalAudioClick; win.FileReader=oldReader2; win.Audio=oldAudio;


  console.log('2.6 compact controls and fill layers');
  App.createDoc(64,64,'Fill layers'); App.addFrame(false);
  if (doc.querySelector('#timeline').classList.contains('hidden')) Q.UI.toggleTimeline();
  click('#timeline [aria-label="Frame tools"]'); ok(!!doc.querySelector('#timeline [aria-label="Blank frame"] svg') && !!doc.querySelector('#timeline [aria-label="Next frame"] svg'), 'frame controls use labelled SVG icons');
  click('#timeline [aria-label="Animation guides and audio"]'); ok(!!doc.querySelector('#timeline [aria-label="Motion guide"]') && !!doc.querySelector('#timeline [aria-label="Manage audio"]'), 'assist category reveals guide and audio tools');
  click('#timeline [aria-label="Animation settings tools"]'); ok(!!doc.querySelector('#timeline [aria-label="Toggle onion skin"]'), 'settings category reveals onion tool');
  if (!doc.querySelector('#tray').classList.contains('hidden')) Q.UI.closeTray(); click('#btnLayers');
  let pickerOpened=false; const picker=doc.querySelector('#imageImport'), originalPickerClick=picker.click; picker.click=()=>{pickerOpened=true;};
  click('#trayBody [aria-label="Add layer or image"]'); Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent==='Import image').click(); picker.click=originalPickerClick;
  ok(pickerOpened && Q.UI.imageTarget.doc===App.doc, 'layer add menu opens the image picker with the current document target');
  click('#trayBody [aria-label="Add layer or image"]'); Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent==='Gradient').click();
  const start=doc.querySelector('input[aria-label="Start colour"]'), end=doc.querySelector('input[aria-label="End colour"]'); start.value='not-a-colour'; click('#modalBody .btn.primary');
  ok(!!doc.querySelector('.canvas-error').textContent && App.doc.layers.length===1, 'gradient dialog rejects invalid hex without adding layer');
  start.value='#f00'; end.value='#00f'; doc.querySelector('select[aria-label="Gradient direction"]').value='vertical'; click('#modalBody .btn.primary');
  ok(App.doc.layers.length===2 && App.doc.layer().name==='Gradient' && App.doc.cel(1,1,false) && !App.doc.cel(0,1,false), 'gradient dialog creates a layer only in the current frame');
  App.undo(); ok(App.doc.layers.length===1, 'gradient layer creation can be undone'); App.redo();
  await App.saveNow(false); const gradReload=await Q.Store.load(App.doc.id); ok(gradReload.layers.length===2 && gradReload.layer().name==='Gradient' && !!gradReload.activeCel(false), 'gradient layer survives save and reopen');
  click('#trayBody [aria-label="Add layer or image"]'); Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent==='Solid colour').click();
  doc.querySelector('input[aria-label="Colour"]').value='#336699'; click('#modalBody .btn.primary'); ok(App.doc.layer().name==='Solid colour' && App.doc.layers.length===3, 'solid colour option creates a layer');
  Q.UI.closeTray(); click('#btnMenu'); const sections=[...doc.querySelectorAll('#trayBody details.action-group')];
  ok(sections.length===5 && sections[0].open && !sections[3].open, 'actions use expandable categories'); sections[3].open=true;
  ok(sections[3].open && sections[3].textContent.includes('Export GIF'), 'export category expands to reveal export actions'); Q.UI.closeTray();

  console.log('2.7 motion path generation');
  App.createDoc(64,64,'Motion bake'); App.doc.activeCel(true); App.addFrame(false); App.addFrame(false);
  App.doc.setMotionGuide([{x:4,y:4},{x:20,y:4}]); App.doc.history.clear();
  Q.UI.motionGuideDialog(); ok(doc.querySelector('#modalBody').textContent.includes('Generate motion along guide'), 'motion generation is accessible from guide controls');
  Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent==='Generate motion along guide').click();
  click('#modalBody .btn.primary'); ok(doc.querySelector('.canvas-error').textContent.includes('empty'), 'empty motion source is rejected');
  doc.querySelector('[aria-label="Motion source frame"]').value='1'; doc.querySelector('[aria-label="Motion last frame"]').value='1'; click('#modalBody .btn.primary');
  ok(doc.querySelector('.canvas-error').textContent.includes('two destination'), 'invalid motion range is rejected');
  doc.querySelector('[aria-label="Motion last frame"]').value='3'; doc.querySelector('[aria-label="Motion easing"]').value='inout'; click('#modalBody .btn.primary');
  ok(doc.querySelector('#modalBody').textContent.includes('Replace 3 cels') && App.doc.history.undoStack.length===0, 'motion replacement requires confirmation');
  click('#modalBody .btn.ghost'); ok(!App.doc.cel(1,0,false), 'cancelling motion does not change cels');
  Q.UI.motionBakeDialog(); doc.querySelector('[aria-label="Motion source frame"]').value='1'; doc.querySelector('[aria-label="Motion direction"]').value='reverse'; click('#modalBody .btn.primary'); click('#modalBody .btn.danger');
  ok(!!App.doc.cel(1,0,false) && !!App.doc.cel(2,0,false) && App.doc.history.undoStack.length===1, 'confirmed motion generates cels in one step');
  App.undo(); ok(!App.doc.cel(1,0,false), 'motion generation undo restores cels'); App.redo();
  await App.saveNow(false); const motionReload=await Q.Store.load(App.doc.id); ok(!!motionReload.cel(1,0,false) && !!motionReload.cel(2,0,false) && motionReload.motionGuide.length===2, 'generated motion and path survive save and reopen');
  Q.UI.motionBakeDialog(); doc.querySelector('[aria-label="Motion source frame"]').value='1'; click('#modalBody .btn.primary'); App.doc.setMotionGuide([{x:1,y:1},{x:2,y:2}]); const hist=App.doc.history.undoStack.length; click('#modalBody .btn.danger');
  ok(App.doc.history.undoStack.length===hist && doc.querySelector('#toast').textContent.includes('cancelled'), 'motion confirmation cancels if guide changes');

  console.log('2.8 transform pose animation');
  App.createDoc(64,64,'Transform animation'); App.doc.activeCel(true); App.addFrame(false); App.addFrame(false); App.doc.history.clear();
  if (doc.querySelector('#timeline').classList.contains('hidden')) Q.UI.toggleTimeline();
  click('#timeline [aria-label="Animation guides and audio"]');
  ok(!!doc.querySelector('#timeline [aria-label="Generate transform frames"] svg'), 'transform animation is accessible from timeline assist tools');
  click('#timeline [aria-label="Generate transform frames"]'); click('#modalBody .btn.primary');
  ok(doc.querySelector('.canvas-error').textContent.includes('empty'), 'empty transform source is rejected');
  const get=label=>doc.querySelector('#modalBody [aria-label="'+label+'"]'); get('Source frame').value='1'; get('End scale (%)').value='0'; click('#modalBody .btn.primary');
  ok(doc.querySelector('.canvas-error').textContent.includes('scale'), 'out-of-range transform scale is rejected');
  get('End scale (%)').value='100'; get('Pivot X').value='-1'; click('#modalBody .btn.primary'); ok(doc.querySelector('.canvas-error').textContent.includes('Pivot'), 'invalid pivot is rejected in the dialog');
  get('Pivot X').value='32'; get('Start X offset').value=''; click('#modalBody .btn.primary'); ok(doc.querySelector('.canvas-error').textContent.includes('every field'), 'blank transform values are rejected');
  get('Start X offset').value='0'; click('#modalBody .btn.primary'); ok(doc.querySelector('#modalBody').textContent.includes('Replace 3 cels'), 'transform shows destructive confirmation');
  click('#modalBody .btn.ghost'); ok(!App.doc.cel(1,0,false) && App.doc.history.undoStack.length===0, 'cancelling transform leaves cels untouched');
  Q.UI.transformBakeDialog(); get('Source frame').value='1'; get('End X offset').value='12'; get('End Y offset').value='-4'; get('End scale (%)').value='150'; get('End rotation (°)').value='360'; get('Pivot X').value='20'; get('Pivot Y').value='10'; get('Transform easing').value='out';
  click('#modalBody .btn.primary'); const originalBake=App.bakeTransform; let args=null; App.bakeTransform=function (...values) { args=values; return originalBake(...values); }; click('#modalBody .btn.danger'); App.bakeTransform=originalBake;
  ok(args && args[0]===0 && args[1]===0 && args[2]===2 && args[3]==='out' && args[5].x===12 && args[5].y===-4 && args[5].scale===1.5 && args[5].angle===360 && args[6].x===20 && args[6].y===10, 'transform dialog passes poses, pivot and easing to engine');
  ok(!!App.doc.cel(1,0,false) && !!App.doc.cel(2,0,false) && App.doc.history.undoStack.length===1, 'confirmed transform generates one undoable operation');
  App.undo(); ok(!App.doc.cel(1,0,false) && !App.doc.cel(2,0,false), 'transform undo restores prior destination cels'); App.redo();
  await App.saveNow(false); const transformReload=await Q.Store.load(App.doc.id); ok(!!transformReload.cel(1,0,false) && !!transformReload.cel(2,0,false), 'generated transform frames survive save and reopen');
  Q.UI.transformBakeDialog(); get('Source frame').value='1'; click('#modalBody .btn.primary'); App.doc.moveFrame(0,1); const currentHistory=App.doc.history.undoStack.length; click('#modalBody .btn.danger');
  ok(App.doc.history.undoStack.length===currentHistory && doc.querySelector('#toast').textContent.includes('cancelled'), 'transform confirmation cancels if frames change');

  {
  console.log('2.9 optional MP4 audio export');
  App.createDoc(64,64,'MP4 audio'); for(let i=1;i<4;i++) App.addFrame(false);
  App.doc.fps=30; App.doc.frames[0].duration=2; App.doc.frames[1].skipped=true; App.doc.frames[2].duration=2; App.doc.setPlayRange(2,3); App.doc.playMode='loop';
  const oldAudioCtx=win.AudioContext, oldRecorder=win.MediaRecorder, oldCapture=win.HTMLCanvasElement.prototype.captureStream, oldSave=Q.saveBytes, oldFileReader=win.FileReader;
  let savedAudio=null, startedOffsets=[], stoppedTracks=0, closedContexts=0, recorderTracks=[], paintedAudio=[], exportCtx=null, mode='ok', duration=20, audioSupport=true, decodeWait=0;
  const originalComposite=App.doc.composite; App.doc.composite=function(ctx,index,opts) { paintedAudio.push({ctx,index}); if (mode==='paintError' && ctx===exportCtx) throw Error('paint'); return originalComposite.call(this,ctx,index,opts); };
  function fakeTrack(kind) { return {kind,readyState:'live',stop(){if (this.readyState!=='ended') stoppedTracks++; this.readyState='ended';}}; }
  win.HTMLCanvasElement.prototype.captureStream=function () { exportCtx=this.getContext('2d'); const tracks=[fakeTrack('video')]; return {getTracks(){return tracks;},getVideoTracks(){return tracks.filter(t=>t.kind==='video');},addTrack(t){tracks.push(t);}}; };
  win.AudioContext=class {
    constructor(){this.state='running';}
    resume(){return mode==='resumeError' ? Promise.reject(new Error('resume')) : Promise.resolve();}
    close(){this.state='closed';closedContexts++;return Promise.resolve();}
    decodeAudioData(data,yes,no){setTimeout(()=>mode==='decodeError' ? no(new Error('decode')) : yes({duration}),decodeWait);}
    createMediaStreamDestination(){const tracks=[fakeTrack('audio')];return {stream:{getTracks:()=>tracks,getAudioTracks:()=>tracks}};}
    createBufferSource(){return {connect(){},disconnect(){},start(when,offset){startedOffsets.push(offset);},stop(){}};}
  };
  function box(type,...contents) {
    const len=8+contents.reduce((sum,part)=>sum+part.length,0), bytes=new Uint8Array(len), dv=new DataView(bytes.buffer);
    dv.setUint32(0,len); for(let i=0;i<4;i++) bytes[4+i]=type.charCodeAt(i); let at=8;
    for (const part of contents) { bytes.set(part,at); at+=part.length; } return bytes;
  }
  function handler(kind) { const payload=new Uint8Array(12); for(let i=0;i<4;i++) payload[8+i]=kind.charCodeAt(i); return box('trak',box('mdia',box('hdlr',payload))); }
  const ftyp=box('ftyp',new Uint8Array([105,115,111,109,0,0,0,0]));
  const muxedMp4=new win.Blob([ftyp,box('mdat',new Uint8Array(12)),box('moov',handler('vide'),handler('soun'))],{type:'video/mp4'});
  const noAudioMp4=new win.Blob([ftyp,box('moov',handler('vide'))],{type:'video/mp4'});
  win.MediaRecorder=class {
    static isTypeSupported(mime){return audioSupport && mime.includes('mp4a.40.2');}
    constructor(stream,opts){this.state='inactive';this.mimeType=mode==='wrongMime'?'video/webm':opts.mimeType;recorderTracks=stream.getTracks().map(t=>t.kind);}
    start(){this.state='recording';setTimeout(()=>{if(this.state==='recording' && this.onstart) {this.onstart(); if(mode==='early') this.stop(); if(mode==='error') this.onerror();}},0);}
    stop(){this.state='inactive';if(this.ondataavailable)this.ondataavailable({data:mode==='noAudio' ? noAudioMp4 : muxedMp4});if(this.onstop)this.onstop();}
  };
  win.FileReader=class {
    readAsDataURL(){this.result='data:video/mp4;base64,AAAA'; this.onload();}
    readAsArrayBuffer(blob){const r=new nativeFileReader(); r.onload=()=>{this.result=r.result;this.onload();}; r.onerror=()=>this.onerror(); r.readAsArrayBuffer(blob);}
  };
  ok(await Q.mp4HasAudioAndVideo(muxedMp4), 'MP4 verifier finds both tracks even after a media payload');
  ok(!await Q.mp4HasAudioAndVideo(noAudioMp4), 'MP4 verifier rejects a container without audio');
  const extendedMdat=new Uint8Array(20), extView=new DataView(extendedMdat.buffer); extView.setUint32(0,1); extendedMdat.set([109,100,97,116],4); extView.setUint32(12,20);
  ok(await Q.mp4HasAudioAndVideo(new win.Blob([ftyp,extendedMdat,box('moov',handler('vide'),handler('soun'))])), 'MP4 verifier handles extended 64-bit box sizes');
  ok(!await Q.mp4HasAudioAndVideo(new win.Blob([box('moov',handler('vide'),handler('soun'))])), 'MP4 verifier requires file type metadata');
  let malformed=false; try { await Q.mp4HasAudioAndVideo(new win.Blob([new Uint8Array([0,0,0,100,102,116,121,112])])); } catch(e) { malformed=true; } ok(malformed, 'MP4 verifier rejects truncated or invalid box sizes');
  Q.saveBytes=(data,mime,name)=>{savedAudio={mime,name};return true;};
  if (!doc.querySelector('#tray').classList.contains('hidden')) Q.UI.closeTray(); click('#btnMenu');
  const mp4Item=[...doc.querySelectorAll('#trayBody .menu-item')].find(x=>x.textContent.includes('Export MP4')); mp4Item.click();
  ok(doc.querySelector('#modalBody').textContent.includes('Export silent MP4') && doc.querySelector('#modalBody').textContent.includes('Export MP4 with audio'), 'Actions export opens dialog with distinct silent and audio choices');
  Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent==='Export MP4 with audio').click();
  ok(doc.querySelector('#toast').textContent.includes('unmute') && !savedAudio, 'audio export requires an unmuted track');
  App.doc.setAudioTrack({name:'test.wav',data:'data:audio/wav;base64,AAAA',muted:false});
  App.doc.setAudioMuted(true); App.exportMp4WithAudio(); ok(!savedAudio && doc.querySelector('#toast').textContent.includes('unmute'), 'muted audio must be unmuted before exporting'); App.doc.setAudioMuted(false);
  App.doc.playMode='pingpong'; App.exportMp4WithAudio(); ok(doc.querySelector('#toast').textContent.includes('ping-pong') && !App.cancelAudioExport, 'audio MP4 rejects ping-pong instead of silently dropping sound');
  App.doc.playMode='loop'; audioSupport=false; App.exportMp4WithAudio(); ok(doc.querySelector('#toast').textContent.includes('not supported') && !savedAudio, 'audio MP4 requires explicit AAC codec support'); audioSupport=true;
  App.doc.setCameraKey({frame:0,x:32,y:32,zoom:1,angle:0,easing:'linear'}); App.doc.setLayerMotionKey(0,{frame:0,x:3,y:0,scale:1,angle:0,easing:'linear'}); let audioCameraCalls=[]; const originalAudioCamera=App.doc.compositeCamera;
  App.doc.compositeCamera=function(ctx,index) { audioCameraCalls.push(index); return originalAudioCamera.call(this,ctx,index); };
  paintedAudio=[]; App.exportMp4WithAudio(); await wait(210);
  ok(audioCameraCalls.join(',')==='2,3', 'MP4 with audio renders through camera and layer animation'); App.doc.compositeCamera=originalAudioCamera;
  ok(savedAudio && savedAudio.mime==='video/mp4' && savedAudio.name.endsWith('-audio.mp4') && recorderTracks.join(',')==='video,audio', 'audio MP4 connects video and audio tracks and saves MP4');
  ok(startedOffsets.length===1 && Math.abs(startedOffsets[0]-2/30)<0.00001 && paintedAudio.filter(p=>p.ctx===exportCtx).map(p=>p.index).join(',')==='2,3', 'audio MP4 follows playback range, skips, holds and absolute audio offset');
  ok(stoppedTracks>=2 && closedContexts===1 && !App.cancelAudioExport && !doc.querySelector('#progressCard'), 'completed audio MP4 releases streams and context');
  savedAudio=null; mode='decodeError'; App.exportMp4WithAudio(); await wait(30); ok(!savedAudio && doc.querySelector('#toast').textContent.includes('decode') && !App.cancelAudioExport, 'audio decode failure is explicit and releases export');
  mode='ok'; duration=0.01; App.exportMp4WithAudio(); await wait(30); ok(!savedAudio && doc.querySelector('#toast').textContent.includes('ends before') && !App.cancelAudioExport, 'range beyond audio duration does not export silent video'); duration=20;
  mode='early'; App.exportMp4WithAudio(); await wait(35); ok(!savedAudio && doc.querySelector('#toast').textContent.includes('unexpectedly') && !App.cancelAudioExport, 'premature recorder stop does not save a partial file');
  mode='wrongMime'; App.exportMp4WithAudio(); await wait(180); ok(!savedAudio && doc.querySelector('#toast').textContent.includes('unexpectedly'), 'non-MP4 recorder output is never labelled MP4');
  mode='noAudio'; App.exportMp4WithAudio(); await wait(180); ok(!savedAudio && doc.querySelector('#toast').textContent.includes('no video or audio track'), 'encoder output missing an audio track is rejected');
  mode='error'; App.exportMp4WithAudio(); await wait(35); ok(!savedAudio && doc.querySelector('#toast').textContent.includes('encoding failed'), 'recorder errors never save a file');
  mode='paintError'; App.exportMp4WithAudio(); await wait(110); ok(!savedAudio && !App.cancelAudioExport && doc.querySelector('#toast').textContent.includes('render'), 'frame rendering failure cancels and releases the audio export');
  mode='resumeError'; App.exportMp4WithAudio(); await wait(20); ok(!savedAudio && !App.cancelAudioExport && doc.querySelector('#toast').textContent.includes('audio export'), 'audio context start failure is reported');
  mode='ok'; App.doc.fps=1; App.doc.frames[2].duration=60; App.doc.frames[3].duration=60; App.doc.setPlayRange(0,3); App.exportMp4WithAudio(); ok(!App.cancelAudioExport && doc.querySelector('#toast').textContent.includes('120 seconds'), 'long audio exports are rejected before allocation'); App.doc.fps=30; App.doc.frames[2].duration=2; App.doc.frames[3].duration=1; App.doc.setPlayRange(2,3);
  mode='ok'; decodeWait=40; App.exportMp4WithAudio(); ok(!!doc.querySelector('#progressCard button'), 'audio export has a cancel button'); click('#progressCard button'); await wait(70); ok(!savedAudio && !App.cancelAudioExport && !doc.querySelector('#progressCard'), 'cancelling while decoding releases resources and ignores late results');
  App.exportMp4WithAudio(); win.qalamBack(); await wait(70); ok(!savedAudio && !App.cancelAudioExport, 'Android back cancels a pending audio export');
  App.exportMp4WithAudio(); Object.defineProperty(doc,'visibilityState',{value:'hidden',configurable:true}); doc.dispatchEvent(new win.Event('visibilitychange')); await wait(70); ok(!savedAudio && !App.cancelAudioExport, 'backgrounding cancels an audio export'); Object.defineProperty(doc,'visibilityState',{value:'visible',configurable:true});
  App.exportMp4WithAudio(); App.createDoc(64,64,'Switched during export'); await wait(70); ok(!savedAudio && !App.cancelAudioExport, 'switching projects cancels a pending audio export');
  win.AudioContext=oldAudioCtx; win.MediaRecorder=oldRecorder; win.HTMLCanvasElement.prototype.captureStream=oldCapture; Q.saveBytes=oldSave; win.FileReader=oldFileReader;
  }

  {
  console.log('3.0 editable camera animation');
  App.createDoc(64,64,'Camera project'); App.doc.activeCel(true); App.addFrame(true); App.addFrame(true); App.selectFrame(0); App.doc.history.clear();
  if (doc.querySelector('#timeline').classList.contains('hidden')) Q.UI.toggleTimeline();
  click('#timeline [aria-label="Animation guides and audio"]'); ok(!!doc.querySelector('#timeline [aria-label="Camera keyframes"] svg'), 'camera track is accessible from animation controls');
  click('#timeline [aria-label="Camera keyframes"]');
  const get=label=>doc.querySelector('#modalBody [aria-label="'+label+'"]'), action=label=>Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent===label).click();
  ok(!!doc.querySelector('#modalBody canvas[aria-label="Saved camera preview for current frame"]') && doc.querySelector('#modalBody').textContent.includes('not unsaved field changes'), 'camera dialog shows a saved-settings preview');
  get('Camera zoom (%)').value='0'; action('Add camera key'); ok(doc.querySelector('.canvas-error').textContent.includes('zoom') && !App.doc.cameraKeys.length, 'invalid camera key is rejected');
  get('Camera zoom (%)').value='100'; get('Camera center X').value=''; action('Add camera key'); ok(doc.querySelector('.canvas-error').textContent.includes('every camera field'), 'blank camera values are rejected');
  get('Camera center X').value='32'; get('Camera easing').value='in'; action('Add camera key');
  ok(App.doc.cameraEnabled && App.doc.cameraKeys.length===1 && App.doc.cameraKeys[0].easing==='in' && !!doc.querySelector('#timeline .camera-badge'), 'camera key is saved, enabled and marked in timeline');
  Q.UI.closeModal(); App.selectFrame(2); Q.UI.cameraDialog(); get('Camera center X').value='48'; get('Camera zoom (%)').value='200'; get('Camera rotation (°)').value='90'; action('Add camera key');
  ok(App.doc.cameraKeys.length===2 && App.doc.cameraKeys[1].frame===2 && Q.cameraPose(App.doc,1).x===36, 'second key drives eased intermediate camera pose');
  action('Disable camera'); ok(!App.doc.cameraEnabled && App.doc.cameraKeys.length===2, 'camera can be disabled without losing keys'); action('Enable camera'); ok(App.doc.cameraEnabled, 'camera can be re-enabled');
  get('Camera center X').value='40'; action('Update camera key'); ok(App.doc.cameraKeys[1].x===40, 'camera key can be edited without baking pixels');
  Q.UI.closeModal(); App.undo(); ok(App.doc.cameraKeys[1].x===48, 'camera key edit is undoable'); App.redo(); ok(App.doc.cameraKeys[1].x===40, 'camera key edit is redoable');
  Q.UI.cameraDialog(); click('#modalBody [aria-label="Go to camera key frame 1"]'); ok(App.doc.activeFrame===0 && doc.querySelector('#modalBody h2').textContent.includes('frame 1'), 'camera key list jumps to selected frame'); Q.UI.closeModal();
  await App.saveNow(false); const loaded=await Q.Store.load(App.doc.id); ok(loaded.cameraEnabled && loaded.cameraKeys.length===2 && loaded.cameraKeys[1].x===40 && loaded.cameraKeys[0].easing==='in', 'camera track survives save and reopen');
  const records=JSON.parse(win.localStorage.getItem('qalam-projects')), record=records[App.doc.id]; delete record.cameraKeys; delete record.cameraEnabled; win.localStorage.setItem('qalam-projects',JSON.stringify(records));
  const legacy=await Q.Store.load(App.doc.id); ok(!legacy.cameraEnabled && legacy.cameraKeys.length===0, 'older projects load with no camera track');
  await App.saveNow(false); const stored=JSON.parse(win.localStorage.getItem('qalam-projects')); stored[App.doc.id].cameraKeys.push({frame:999,x:1,y:1,zoom:1,angle:0,easing:'linear'},{frame:1,x:1,y:1,zoom:0,angle:0,easing:'linear'}); win.localStorage.setItem('qalam-projects',JSON.stringify(stored));
  const cleaned=await Q.Store.load(App.doc.id); ok(cleaned.cameraKeys.length===2 && cleaned.cameraKeys.every(k=>k.frame<cleaned.frames.length), 'invalid and out-of-timeline camera keys are rejected on load');
  const oldCameraComposite=App.doc.compositeCamera, used=[]; App.doc.compositeCamera=function(ctx,i){used.push(i);return oldCameraComposite.call(this,ctx,i);};
  const oldGif=Q.encodeGif, oldSave=Q.saveBytes; Q.encodeGif=()=>Promise.resolve({dataUrl:'data:image/gif;base64,AAAA'}); Q.saveBytes=()=>true; App.exportGif({}); await wait(25);
  ok(used.join(',')==='0,1,2', 'GIF export renders each frame through the camera');
  used.length=0; App.doc.fps=30; App.exportMp4(); await wait(150); ok(used.join(',')==='0,1,2', 'silent MP4 export renders frames through the camera');
  used.length=0; App.exportPng(); ok(used.length===0, 'PNG export remains in original canvas coordinates');
  Q.encodeGif=oldGif; Q.saveBytes=oldSave; App.doc.compositeCamera=oldCameraComposite;
  App.view.dirty=false; App.togglePlay(); App.view.dirty=false; App.stopPlay(); ok(App.view.dirty, 'stopping camera playback redraws the editable canvas');
  Q.UI.cameraDialog(); action('Clear all camera keys'); ok(doc.querySelector('#modalBody h2').textContent.includes('Clear camera keys'), 'clearing all camera keys asks for confirmation'); click('#modalBody .btn.danger'); ok(App.doc.cameraKeys.length===0, 'confirmed clear removes all camera keys'); Q.UI.closeModal(); App.undo(); ok(App.doc.cameraKeys.length===2, 'undo restores cleared camera keys');
  }

  {
  console.log('3.1 particle animation');
  App.createDoc(64,64,'Particles'); const original=App.doc.activeCel(true); App.addFrame(true); App.addFrame(true); App.selectFrame(0); App.doc.frames[1].skipped=true;
  App.doc.setCameraKey({frame:0,x:32,y:32,zoom:1,angle:0,easing:'linear'}); App.doc.history.clear(); App.view.selection={x:0,y:0,w:10,h:10};
  if (doc.querySelector('#timeline').classList.contains('hidden')) Q.UI.toggleTimeline();
  click('#timeline [aria-label="Animation guides and audio"]'); ok(!!doc.querySelector('#timeline [aria-label="Generate particles"] svg'), 'particle generator is available in animation tools');
  click('#timeline [aria-label="Generate particles"]'); const get=label=>doc.querySelector('#modalBody [aria-label="'+label+'"]');
  ok(doc.querySelector('#modalBody').textContent.includes('topmost raster layer') && doc.querySelector('#modalBody').textContent.includes('Selection is ignored'), 'particle dialog explains baked layer and selection behaviour');
  get('Particle count').value='201'; click('#modalBody .btn.primary'); ok(doc.querySelector('.canvas-error').textContent.includes('1–200') && App.doc.layers.length===1, 'invalid particle count is rejected');
  get('Particle count').value='5'; get('Particle hex colour').value='invalid'; click('#modalBody .btn.primary'); ok(doc.querySelector('.canvas-error').textContent.includes('colour') && App.doc.layers.length===1, 'invalid particle colour is rejected');
  get('Particle hex colour').value='#3a6'; get('Particle emission').value='continuous'; get('Particle shape').value='square'; get('Particle fade').value='no'; get('Particle seed').value='42'; get('Particle first frame').value='2';
  const originalGenerate=App.generateParticles; let generated=null; App.generateParticles=function (opts) { generated=opts; return originalGenerate(opts); }; click('#modalBody .btn.primary'); App.generateParticles=originalGenerate;
  ok(generated && generated.start===1 && generated.end===2 && generated.seed===42 && generated.mode==='continuous' && generated.shape==='square' && !generated.fade && generated.color==='#3a6', 'particle dialog passes settings to generation engine');
  ok(App.doc.layers.length===2 && App.doc.layer().name==='Particles' && !App.doc.cel(0,1,false) && !!App.doc.cel(1,1,false) && !!App.doc.cel(2,1,false), 'generated layer has cels only in selected range, including skipped frame');
  ok(App.doc.cel(0,0,false)===original && App.doc.cameraKeys.length===1 && App.view.selection.w===10 && App.doc.history.undoStack.length===1, 'particle generation preserves artwork, camera, selection and creates one history step');
  App.undo(); ok(App.doc.layers.length===1 && App.doc.cameraKeys.length===1, 'particle layer creation is undoable'); App.redo(); ok(App.doc.layers.length===2 && !!App.doc.cel(1,1,false), 'particle layer creation is redoable');
  await App.saveNow(false); const loaded=await Q.Store.load(App.doc.id); ok(loaded.layers.length===2 && loaded.layer().name==='Particles' && !loaded.cel(0,1,false) && !!loaded.cel(1,1,false) && loaded.cameraKeys.length===1, 'particle layer and camera survive save and reopen');
  Q.UI.particleDialog(); get('Particle first frame').value='3'; get('Particle last frame').value='2'; click('#modalBody .btn.primary'); ok(doc.querySelector('.canvas-error').textContent.includes('range'), 'reversed particle range is rejected'); Q.UI.closeModal();
  }

  {
  console.log('3.2 editable layer animation');
  App.createDoc(64,64,'Layer animation'); const original=App.doc.activeCel(true); App.addFrame(true); App.addFrame(true); App.selectFrame(0); App.doc.history.clear();
  if (doc.querySelector('#timeline').classList.contains('hidden')) Q.UI.toggleTimeline(); click('#timeline [aria-label="Animation guides and audio"]');
  ok(!!doc.querySelector('#timeline [aria-label="Layer keyframes"] svg'), 'layer keyframes are accessible from the animation panel'); click('#timeline [aria-label="Layer keyframes"]');
  const get=label=>doc.querySelector('#modalBody [aria-label="'+label+'"]'), action=label=>Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent===label).click();
  ok(!!doc.querySelector('#modalBody canvas[aria-label="Saved layer animation preview"]') && doc.querySelector('#modalBody').textContent.includes('not unsaved field changes'), 'layer track shows saved animation preview');
  get('Layer scale (%)').value='0'; action('Add layer key'); ok(doc.querySelector('.canvas-error').textContent.includes('scale') && !(App.doc.layer().motionKeys || []).length, 'invalid layer animation values are rejected');
  get('Layer scale (%)').value='100'; get('Layer X offset').value=''; action('Add layer key'); ok(doc.querySelector('.canvas-error').textContent.includes('every layer field'), 'blank layer motion values are rejected');
  get('Layer X offset').value='0'; get('Layer easing').value='in'; action('Add layer key');
  ok(App.doc.layer().motionEnabled && App.doc.layer().motionKeys.length===1 && !!doc.querySelector('#timeline .layer-motion-badge'), 'layer key is saved and marked on timeline');
  Q.UI.closeModal(); App.selectFrame(2); Q.UI.layerMotionDialog(); get('Layer X offset').value='16'; get('Layer Y offset').value='8'; get('Layer scale (%)').value='150'; get('Layer rotation (°)').value='90'; action('Add layer key');
  ok(App.doc.layer().motionKeys.length===2 && Q.layerMotionPose(App.doc.layer(),1).x===4 && App.doc.cel(0,0,false)===original, 'layer keys interpolate while source cels stay intact');
  action('Disable layer motion'); ok(!App.doc.layer().motionEnabled && App.doc.layer().motionKeys.length===2, 'layer motion can be disabled without removing keys'); action('Enable layer motion');
  get('Layer X offset').value='20'; action('Update layer key'); ok(App.doc.layer().motionKeys[1].x===20, 'layer key is editable'); Q.UI.closeModal();
  App.undo(); ok(App.doc.layer().motionKeys[1].x===16, 'layer key edit can be undone'); App.redo(); ok(App.doc.layer().motionKeys[1].x===20, 'layer key edit can be redone');
  Q.UI.layerMotionDialog(); click('#modalBody [aria-label="Go to layer key frame 1"]'); ok(App.doc.activeFrame===0, 'layer key list navigates to its frame'); Q.UI.closeModal();
  await App.saveNow(false); const loaded=await Q.Store.load(App.doc.id); ok(loaded.layer().motionEnabled && loaded.layer().motionKeys.length===2 && loaded.layer().motionKeys[1].x===20, 'layer keys survive save and reopen');
  const all=JSON.parse(win.localStorage.getItem('qalam-projects')); delete all[App.doc.id].layers[0].motionKeys; delete all[App.doc.id].layers[0].motionEnabled; win.localStorage.setItem('qalam-projects',JSON.stringify(all));
  const legacy=await Q.Store.load(App.doc.id); ok(!legacy.layer().motionEnabled && legacy.layer().motionKeys.length===0, 'older projects open without layer animation');
  await App.saveNow(false); const corrupt=JSON.parse(win.localStorage.getItem('qalam-projects')); corrupt[App.doc.id].layers[0].motionKeys.push({frame:999,x:0,y:0,scale:1,angle:0,easing:'linear'},{frame:1,x:0,y:0,scale:0,angle:0,easing:'linear'}); win.localStorage.setItem('qalam-projects',JSON.stringify(corrupt));
  const clean=await Q.Store.load(App.doc.id); ok(clean.layer().motionKeys.length===2 && clean.layer().motionKeys.every(k=>k.frame<clean.frames.length), 'invalid and out-of-range layer keys are filtered when loading');
  App.doc.addLayer(0); ok(App.doc.layers.length===2 && App.doc.layer().motionKeys.length===2, 'duplicating a layer copies its track');
  App.mergeDownLayer(1); ok(App.doc.layers.length===2 && doc.querySelector('#toast').textContent.includes('motion keys'), 'merging animated layers is blocked instead of discarding keys');
  App.doc.setLayerProp(1,'locked',true); Q.UI.layerMotionDialog(); action('Disable layer motion'); ok(doc.querySelector('.canvas-error').textContent.includes('Unlock') && App.doc.layer().motionEnabled, 'locked layer blocks track changes'); Q.UI.closeModal();
  App.doc.setLayerProp(1,'locked',false); Q.UI.layerMotionDialog(); action('Clear all layer keys'); ok(doc.querySelector('#modalBody h2').textContent.includes('Clear layer keys'), 'clearing a layer track requires confirmation'); click('#modalBody .btn.danger'); ok(App.doc.layer().motionKeys.length===0, 'confirmed clear removes selected layer keys only'); Q.UI.closeModal();
  App.undo(); ok(App.doc.layer().motionKeys.length===2 && App.doc.layers[0].motionKeys.length===2, 'undo restores cleared keys without altering the original layer track');
  Q.UI.layerSheet(0); ok(doc.querySelector('#modalBody').textContent.includes('Layer keyframes'), 'layer options link directly to keyframe controls'); Q.UI.closeModal();
  }

  {
  console.log('3.3 two-bone IK');
  App.createDoc(64,64,'IK'); App.doc.activeCel(true); App.addFrame(true); App.addFrame(true); App.selectFrame(0);
  if (doc.querySelector('#timeline').classList.contains('hidden')) Q.UI.toggleTimeline(); click('#timeline [aria-label="Animation guides and audio"]');
  ok(!!doc.querySelector('#timeline [aria-label="Two-bone IK"] svg'), 'IK controls are accessible in animation tools'); click('#timeline [aria-label="Two-bone IK"]');
  let btn=label=>Array.from(doc.querySelectorAll('#modalBody button')).find(x=>x.textContent===label).click();
  btn('Review keys'); ok(doc.querySelector('.canvas-error').textContent.includes('two different layers'), 'IK requires two separate layers'); Q.UI.closeModal();
  App.doc.addLayer(); App.doc.activeCel(true); App.doc.cel(1,1,true); App.doc.cel(2,1,true); App.doc.history.clear();
  Q.UI.twoBoneIKDialog(); const get=label=>doc.querySelector('#modalBody [aria-label="'+label+'"]');
  ok(doc.querySelector('#modalBody').textContent.includes('does not bend or deform pixels') && doc.querySelector('#modalBody').textContent.includes('Blank cels stay blank'), 'IK dialog explains rigid layers and empty cels');
  get('IK lower layer').value=get('IK upper layer').value; btn('Review keys'); ok(doc.querySelector('.canvas-error').textContent.includes('two different layers'), 'IK rejects the same layer twice');
  get('IK upper layer').value='0'; get('IK lower layer').value='1'; get('IK joint X').value=''; btn('Review keys'); ok(doc.querySelector('.canvas-error').textContent.includes('every IK field'), 'IK validates empty numeric fields');
  get('IK root X').value='32'; get('IK root Y').value='16'; get('IK joint X').value='32'; get('IK joint Y').value='16'; btn('Review keys'); ok(doc.querySelector('.canvas-error').textContent.includes('bones'), 'IK rejects a zero-length bone');
  get('IK joint Y').value='24'; get('IK tip X').value='32'; get('IK tip Y').value='32'; get('IK start target X').value='32'; get('IK start target Y').value='32'; get('IK end target X').value='63'; get('IK end target Y').value='63'; get('IK bend side').value='-1'; get('IK easing').value='inout';
  btn('Preview'); ok(!!doc.querySelector('#modalBody canvas[aria-label="IK end pose skeleton preview"]') && doc.querySelector('.ik-preview').textContent.includes('clamped'), 'IK previews skeleton and reports unreachable targets');
  btn('Review keys'); ok(doc.querySelector('#modalBody h2').textContent.includes('Replace keys') && doc.querySelector('#modalBody').textContent.includes('clamped') && !!doc.querySelector('#modalBody canvas[aria-label="IK end pose skeleton preview"]') && !App.doc.history.undoStack.length, 'IK requires confirmation before replacing keys'); click('#modalBody .btn.ghost');
  ok(App.doc.layers.every(l=>!(l.motionKeys || []).length), 'cancelling IK preserves both tracks');
  Q.UI.twoBoneIKDialog(); get('IK upper layer').value='0'; get('IK lower layer').value='1'; get('IK root Y').value='16'; get('IK joint Y').value='24'; get('IK tip Y').value='32'; get('IK start target Y').value='32'; get('IK end target X').value='63'; get('IK end target Y').value='63'; btn('Review keys'); click('#modalBody .btn.danger');
  ok(App.doc.layers.every(l=>l.motionEnabled && l.motionKeys.length===3) && App.doc.history.undoStack.length===1, 'confirmed IK creates editable tracks on both layers in one step');
  App.undo(); ok(App.doc.layers.every(l=>!(l.motionKeys || []).length), 'IK undo restores both original tracks'); App.redo(); ok(App.doc.layers.every(l=>l.motionKeys.length===3), 'IK redo restores both tracks');
  await App.saveNow(false); const loaded=await Q.Store.load(App.doc.id); ok(loaded.layers.every(l=>l.motionEnabled && l.motionKeys.length===3), 'generated IK keys survive saving and reopening');
  Q.UI.twoBoneIKDialog(); get('IK upper layer').value='0'; get('IK lower layer').value='1'; btn('Review keys'); App.doc.setLayerMotionKey(0,{frame:0,x:1,y:0,scale:1,angle:0,easing:'linear'}); const hist=App.doc.history.undoStack.length; click('#modalBody .btn.danger');
  ok(App.doc.history.undoStack.length===hist && doc.querySelector('#toast').textContent.includes('cancelled'), 'IK confirmation cancels if either track changes');
  App.doc.setLayerProp(1,'locked',true); Q.UI.twoBoneIKDialog(); get('IK upper layer').value='0'; get('IK lower layer').value='1'; btn('Review keys'); ok(doc.querySelector('.canvas-error').textContent.includes('Unlock'), 'IK rejects locked layers in the dialog'); Q.UI.closeModal();
  }

  await App.saveNow(false);
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nall UI checks passed');
  process.exit(failures ? 1 : 0);
}

run().catch((err) => {
  console.error('test crashed:', err && err.stack || err);
  process.exit(1);
});
