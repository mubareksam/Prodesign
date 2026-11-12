/* Headless smoke test for the drawing engine (doc.js + brushes.js + core.js).
 * Stubs the 2D canvas API so the document model, stroke engine, undo history
 * and layer/frame operations can be exercised without a browser.
 * Run:  node tools/tests/engine_smoke.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const JS = path.join(root, 'android/assets/app/js');

const calls = { drawImage: 0, putImageData: 0, fill: 0, fillRect: 0 };

function makeCtx(cv) {
  const ctx = {
    canvas: cv,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetY: 0,
    save() {}, restore() {},
    beginPath() {}, closePath() {}, arc() {}, moveTo() {}, lineTo() {}, fill() { calls.fill++; },
    stroke() {}, rect() {}, clip() {}, ellipse() {},
    clearRect() {}, fillRect() { calls.fillRect++; }, strokeRect() {},
    drawImage() { calls.drawImage++; },
    putImageData() { calls.putImageData++; },
    getImageData(x, y, w, h) {
      return { width: w, height: h, data: new Uint8ClampedArray(Math.max(0, w * h * 4)) };
    },
    createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    setTransform() {}, translate() {}, rotate() {}, scale() {}, resetTransform() {},
    measureText() { return { width: 8 }; }, fillText() {}
  };
  return ctx;
}

globalThis.window = globalThis;
globalThis.performance = { now: () => Date.now() };
globalThis.document = {
  createElement(tag) {
    if (tag !== 'canvas') throw new Error('unexpected element ' + tag);
    const cv = {
      width: 1, height: 1,
      getContext() { if (!this._c) this._c = makeCtx(this); return this._c; },
      toDataURL() { return 'data:image/png;base64,AAAA'; }
    };
    return cv;
  }
};
const navStub = { vibrate() {} };
globalThis.window.addEventListener = () => {};

function load(file) {
  const code = readFileSync(path.join(JS, file), 'utf8');
  new Function('window', 'document', 'navigator', 'performance', code)(
    globalThis, globalThis.document, navStub, globalThis.performance);
}

load('core.js');
load('doc.js');
load('brushes.js');

const Q = globalThis.Q;
let checks = 0;
function ok(cond, label) {
  checks++;
  if (!cond) throw new Error('FAILED: ' + label);
  console.log('  ✓ ' + label);
}

console.log('document + layers');
const doc = new Q.Doc({ width: 128, height: 128, name: 'test' });
ok(doc.layers.length === 1, 'starts with one layer');
ok(doc.frames.length === 1, 'starts with one frame');
ok(doc.activeCel(false) === null, 'cel is allocated lazily');
doc.addLayer();
ok(doc.layers.length === 2, 'addLayer inserts a layer');
ok(doc.frames[0].cels.length === 2, 'cels stay in sync with layers');
doc.addLayer(0);
ok(doc.layers.length === 3, 'layer duplicate works');
doc.moveLayer(2, -1);
ok(doc.activeLayer === 1, 'moveLayer updates the active index');
doc.deleteLayer(1);
ok(doc.layers.length === 2, 'deleteLayer removes one');
doc.history.undo();
ok(doc.layers.length === 3, 'undo restores the deleted layer');

console.log('frames');
doc.addFrame(false);
ok(doc.frames.length === 2, 'addFrame appends');
doc.addFrame(true);
ok(doc.frames.length === 3, 'duplicate frame appends');
doc.moveFrame(2, -1);
ok(doc.activeFrame === 1, 'moveFrame reselects');
doc.deleteFrame(1);
ok(doc.frames.length === 2, 'deleteFrame removes');
doc.history.undo();
ok(doc.frames.length === 3, 'undo restores deleted frame');

console.log('strokes + undo history');
doc.activeFrame = 0;
doc.activeLayer = 0;
const before = doc.history.undoStack.length;
const brush = Q.brushById('studio');
const stroke = new Q.Stroke(doc, brush, [10, 20, 30], 12, 1);
stroke.begin({ x: 10, y: 10, pressure: 0.6, t: 0 });
for (let i = 1; i <= 40; i++) stroke.add({ x: 10 + i * 2, y: 10 + Math.sin(i / 4) * 12, pressure: 0.5 + i / 100, t: i * 8 });
const dirty = stroke.end();
ok(calls.fill > 10, 'stroke stamped with the fill engine');
ok(dirty && dirty.w > 0 && dirty.h > 0, 'stroke tracked a dirty rect');
ok(doc.history.undoStack.length === before + 1, 'one history entry per stroke');
ok(doc.activeCel(false) !== null, 'cel allocated on first paint');
doc.history.undo();
ok(calls.putImageData > 0, 'undo writes pixels back');
ok(doc.history.canRedo(), 'redo becomes available');
doc.history.redo();
ok(!doc.history.canRedo(), 'redo stack drains');

console.log('every brush preset draws');
for (const b of Q.BRUSHES) {
  const s = new Q.Stroke(doc, b, [200, 40, 40], Math.max(2, b.size * 0.4), 0.8);
  s.begin({ x: 20, y: 20, pressure: 0.8, t: 0 });
  for (let i = 1; i <= 25; i++) s.add({ x: 20 + i * 3, y: 20 + i * 1.5, pressure: 0.7, t: i * 9 });
  const d = s.end();
  ok(!!d, 'brush "' + b.name + '" produced a dirty rect');
}

console.log('compositing + export');
const flat = doc.flatten(0);
ok(flat.width === 128 && flat.height === 128, 'flatten matches document size');
const thumb = doc.thumbnail(0, 64);
ok(thumb.width <= 64 || thumb.height <= 64, 'thumbnail is downscaled');
ok(calls.drawImage > 0, 'composite used drawImage');
ok(doc.memoryMB() >= 0, 'memory estimate available: ' + doc.memoryMB() + ' MB');

console.log('merge down');
const d2 = new Q.Doc({ width: 32, height: 32 });
d2.addLayer();
d2.activeCel(true);
d2.mergeDown(1);
ok(d2.layers.length === 1, 'mergeDown collapses two layers');

console.log('structural history regression checks');
const d3 = new Q.Doc({ width: 32, height: 32 });
const original = d3.activeCel(true);
d3.clearLayer(0);
ok(d3.activeCel(false) === null, 'clear removes the cel');
d3.history.undo();
ok(d3.activeCel(false) === original, 'undo clear restores the original cel');
d3.history.redo();
ok(d3.activeCel(false) === null, 'redo clear removes the cel again');
d3.history.undo();
d3.addLayer();
const upper = d3.activeCel(true);
d3.mergeDown(1);
ok(d3.cel(0, 0, false) !== original, 'merge uses a new canvas');
d3.history.undo();
ok(d3.cel(0, 0, false) === original && d3.cel(0, 1, false) === upper, 'undo merge restores both original cels');
d3.history.redo();
ok(d3.layers.length === 1, 'redo reapplies merge');
const d4 = new Q.Doc({ width: 32, height: 32 });
d4.history.beginPixels(d4.activeCel(true));
d4.history.endPixels({ x: -4, y: -3, w: 10, h: 9 });
ok(d4.history.undoStack[0].rect.x === 0 && d4.history.undoStack[0].rect.w === 6, 'pixel history clips dirty rectangles');

console.log('smoothing and symmetry');
const smoothing = new Q.Stroke(new Q.Doc({width:128,height:128}), Q.brushById('studio'), [0,0,0], 10, 1);
smoothing.begin({x:0,y:0,pressure:1,t:1});
const samples = [];
const originalLine = smoothing._lineTo;
smoothing._lineTo = (x,y) => samples.push({x,y});
smoothing.curveAnchor = {x:0,y:0};
smoothing._curveTo({x:10,y:0},{x:10,y:10});
ok(samples.length > 2 && samples.some(p => p.x < 10 && p.y > 0), 'quadratic interpolation rounds corners');
smoothing._lineTo = originalLine;
const p = Q.symmetryPoints('quadrant', 10, 20, 100, 80);
ok(p.length === 4 && p[3].x === 90 && p[3].y === 60, 'quadrant symmetry mirrors both axes');
ok(Q.symmetryPoints('radial', 10, 20, 100, 80).length === 8, 'radial symmetry produces eight copies');
const symDoc = new Q.Doc({width:100,height:80});
symDoc.guide.symmetry = 'quadrant'; symDoc.layer().assisted = true;
const beforeSym = calls.fill;
const symStroke = new Q.Stroke(symDoc, Q.brushById('monoline'), [0,0,0], 10, 1);
symStroke.begin({x:10,y:20,pressure:1,t:1}); symStroke.end();
ok(calls.fill - beforeSym >= 4 && symDoc.history.undoStack.length === 1, 'mirrored stamps share one undo step');

smoothing.dirty = null; smoothing.pending = null;
smoothing._grow(5,5,2); smoothing._grow(30,5,2);
smoothing.pending = null; smoothing._grow(70,5,2);
ok(smoothing.pending.x > 60 && smoothing.dirty.x < 5, 'wet flush bounds stay independent from overall stroke bounds');

console.log(`\nall ${checks} engine checks passed`);
