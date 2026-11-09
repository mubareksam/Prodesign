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
load('effects.js');
load('fill.js');
load('selection.js');
load('spritesheet.js');

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

console.log('frame timing and effects');
const timing = new Q.Doc({width:4,height:4});
timing.setFrameDuration(0, 4);
ok(timing.frames[0].duration === 4, 'frame hold set');
timing.history.undo();
ok(timing.frames[0].duration === 1, 'frame hold undo');
timing.history.redo();
timing.addFrame(true);
ok(timing.frames[1].duration === 4, 'duplicating a frame copies its hold');
const image = {width:1,height:1,data:new Uint8ClampedArray([10,20,30,127])};
Q.applyPixelEffect(image,'invert',1);
ok(image.data[0] === 245 && image.data[1] === 235 && image.data[2] === 225 && image.data[3] === 127, 'invert preserves alpha');
const blur = {width:3,height:1,data:new Uint8ClampedArray([0,0,0,255, 255,255,255,255, 0,0,0,255])};
Q.applyPixelEffect(blur,'blur',0.01);
ok(blur.data[0] === 128 && blur.data[4] === 85 && blur.data[8] === 128, 'blur averages neighbours at image edges');
const alphaBlur = {width:2,height:1,data:new Uint8ClampedArray([255,0,0,255, 0,0,0,0])};
Q.applyPixelEffect(alphaBlur,'blur',0.01);
ok(alphaBlur.data[0] >= 250 && alphaBlur.data[4] >= 250 && alphaBlur.data[3] > 0, 'blur preserves colours across transparent edges');
const line = {width:3,height:1,data:new Uint8ClampedArray([0,0,0,255, 255,255,255,255, 0,0,0,255])};
Q.applyPixelEffect(line, 'motion', 0.01);
ok(line.data[0] === 128 && line.data[4] === 85, 'horizontal motion blur averages nearby pixels');
const sharp = {width:3,height:1,data:new Uint8ClampedArray([100,100,100,255, 150,150,150,255, 100,100,100,255])};
Q.applyPixelEffect(sharp, 'sharpen', 1);
ok(sharp.data[4] > 150 && sharp.data[3] === 255, 'sharpen increases local contrast without changing alpha');
const glow = {width:3,height:1,data:new Uint8ClampedArray([255,255,255,255, 0,0,0,0, 0,0,0,0])};
Q.applyPixelEffect(glow, 'bloom', 0.2);
ok(glow.data[7] > 0 && glow.data[4] > 0, 'bloom extends highlights into transparent neighbours');
const glitch = {width:3,height:1,data:new Uint8ClampedArray([10,0,0,255, 20,0,0,255, 30,0,0,255])};
Q.applyPixelEffect(glitch, 'glitch', 0.04);
ok(glitch.data[4] === 10, 'glitch displaces pixels in bands');
const scene = new Q.Doc({width:4,height:4});
scene.setFrameGroup(0, 'Scene A'); scene.addFrame(true);
ok(scene.frames[1].group === 'Scene A', 'duplicating frame keeps group label');
scene.history.undo(); scene.history.undo();
ok(scene.frames[0].group === '', 'frame group assignment is undoable');
scene.history.redo();
ok(scene.frames[0].group === 'Scene A', 'frame group assignment can be redone');


console.log('scanline flood fill');
const pixels = new Uint8ClampedArray(5 * 3 * 4);
for (let y=0; y<3; y++) { const i=(y*5+2)*4; pixels[i]=pixels[i+1]=pixels[i+2]=0; pixels[i+3]=255; }
const region = {width:5,height:3,data:pixels};
const rect=Q.floodFill(region,0,1,[220,30,40],0);
ok(rect.x===0 && rect.y===0 && rect.w===2 && rect.h===3, 'fill stops at an opaque boundary and reports dirty bounds');
ok(pixels[0]===220 && pixels[3]===255 && pixels[(4*4)+3]===0, 'fill changes only connected pixels');
ok(Q.floodFill(region,0,0,[220,30,40],0)===null, 'fill skips an identical colour');
const shades={width:3,height:1,data:new Uint8ClampedArray([100,100,100,255, 105,105,105,255, 140,140,140,255])};
Q.floodFill(shades,0,0,[0,0,0],10);
ok(shades.data[4]===0 && shades.data[8]===140, 'fill tolerance includes similar colours only');


console.log('rectangular editing');
const bounds=Q.selectionRect({x:6.2,y:5.2},{x:-3,y:1.3},5,6);
ok(bounds.x===0 && bounds.y===1 && bounds.w===5 && bounds.h===5, 'selection normalizes reverse drag and clips to canvas');
ok(Q.selectionRect({x:-9,y:0},{x:-2,y:5},5,6)===null, 'selection outside canvas is rejected');
function sample() { return {width:3,height:2,data:new Uint8ClampedArray([1,11,21,31, 2,12,22,32, 3,13,23,33, 4,14,24,34, 5,15,25,35, 6,16,26,36])}; }
function ids(img) { return Array.from(img.data).filter((_,i)=>i%4===0).join(','); }
const hor=sample(); Q.flipImage(hor,true,false);
ok(ids(hor)==='3,2,1,6,5,4' && hor.data[3]===33, 'horizontal flip preserves complete RGBA pixels');
const ver=sample(); Q.flipImage(ver,false,true);
ok(ids(ver)==='4,5,6,1,2,3', 'vertical flip handles non-square images');
const rot=sample(); Q.flipImage(rot,true,true);
ok(ids(rot)==='6,5,4,3,2,1', '180 degree rotation swaps opposite pixels');
Q.flipImage(rot,true,true);
ok(ids(rot)==='1,2,3,4,5,6', 'rotating twice restores image');


console.log('layer protection');
Q.toast = () => {};
const protectedDoc = new Q.Doc({width:16,height:16});
protectedDoc.addLayer(); const protectedCel=protectedDoc.activeCel(true);
protectedDoc.setLayerProp(1,'locked',true); const lockCount=protectedDoc.history.undoStack.length;
protectedDoc.clearLayer(1); protectedDoc.deleteLayer(1); protectedDoc.mergeDown(1);
ok(protectedDoc.layers.length===2 && protectedDoc.activeCel(false)===protectedCel && protectedDoc.history.undoStack.length===lockCount, 'locked layer cannot be cleared, deleted or merged');
protectedDoc.history.undo(); ok(!protectedDoc.layers[1].locked, 'lock toggle is undoable');
protectedDoc.history.redo(); ok(protectedDoc.layers[1].locked, 'lock toggle is redoable');
protectedDoc.setLayerProp(1,'locked',false); protectedDoc.setLayerProp(0,'locked',true); protectedDoc.mergeDown(1);
ok(protectedDoc.layers.length===2, 'cannot merge into a locked lower layer');
const intersection=Q.intersectRect({x:0,y:0,w:5,h:5},{x:3,y:2,w:5,h:3});
ok(intersection.x===3 && intersection.y===2 && intersection.w===2 && intersection.h===3, 'selection intersection bounds dirty regions');
ok(Q.intersectRect({x:0,y:0,w:1,h:1},{x:1,y:1,w:2,h:2})===null, 'disjoint selection intersection is empty');


console.log('background and alpha-lock history');
const themed=new Q.Doc({width:16,height:16}); themed.setBackground('#123456');
ok(themed.bg==='#123456', 'canvas background colour changes');
themed.history.undo(); ok(themed.bg==='#ffffff', 'background change can be undone');
themed.history.redo(); ok(themed.bg==='#123456', 'background change can be redone');
themed.setLayerProp(0,'alphaLocked',true); themed.addLayer(0);
ok(themed.layer().alphaLocked, 'duplicating a layer preserves its alpha-lock setting');
const alphaCount=themed.history.undoStack.length; themed.mergeDown(1); themed.clearLayer(1);
ok(themed.layers.length===2 && themed.history.undoStack.length===alphaCount, 'alpha-locked layers cannot be cleared or merged');
themed.setLayerProp(1,'alphaLocked',false); themed.mergeDown(1);
ok(themed.layers.length===2, 'merge also protects an alpha-locked lower layer');


console.log('batch animation editing');
const batch=new Q.Doc({width:16,height:16}); batch.addFrame(false); batch.addFrame(false); batch.addFrame(false); batch.activeFrame=1;
ok(batch.setPlayRange(1,2) && batch.playRange.start===1, 'playback range can be set');
batch.history.undo(); ok(batch.playRange===null, 'playback range change is undoable'); batch.history.redo();
ok(!batch.setPlayRange(3,1) && batch.playRange.end===2, 'invalid playback range is rejected');
batch.batchFrames(1,3,'label','Scene A'); batch.batchFrames(1,2,'hold',4);
ok(batch.frames[1].group==='Scene A' && batch.frames[3].group==='Scene A' && batch.frames[1].duration===4, 'batch label and hold update only the requested frames');
batch.history.undo(); ok(batch.frames[1].duration===1 && batch.frames[1].group==='Scene A', 'batch hold is undone in one step');
batch.history.redo(); batch.batchFrames(1,3,'reverse');
ok(batch.frames[1].duration===1 && batch.frames[3].duration===4 && batch.activeFrame===3, 'batch reverse preserves frame data and tracks active frame');
batch.history.undo(); ok(batch.frames[1].duration===4 && batch.activeFrame===1, 'batch reverse is undoable');
const source=batch.cel(1,0,true); batch.batchFrames(1,2,'duplicate');
ok(batch.frames.length===6 && batch.cel(3,0,false)!==source && batch.frames[3].duration===4, 'batch duplicate copies cels and timing into new frames');
batch.history.undo(); ok(batch.frames.length===4 && batch.playRange.start===1 && batch.playRange.end===2, 'batch duplication undo restores frames and range');
batch.history.redo(); ok(batch.frames.length===6, 'batch duplication redo restores frames');
const rangeDoc=new Q.Doc({width:2,height:2}); rangeDoc.addFrame(false); rangeDoc.addFrame(false); rangeDoc.setPlayRange(1,2);
rangeDoc.deleteFrame(2); ok(rangeDoc.playRange.start===1 && rangeDoc.playRange.end===1, 'deleting a frame clamps playback range to the timeline');
rangeDoc.history.undo(); ok(rangeDoc.playRange.end===2 && rangeDoc.frames.length===3, 'undo deletion restores original playback range');
const full=new Q.Doc({width:2,height:2}); for (let i=0;i<59;i++) full.addFrame(false);
const h=full.history.undoStack.length; ok(!full.batchFrames(0,0,'duplicate') && full.frames.length===60 && full.history.undoStack.length===h, 'batch duplicate respects frame limit');
const sheet=Q.spriteSheetLayout({width:64,height:32,frames:[1,2,3]},2,0.5);
ok(sheet.width===64 && sheet.height===32 && sheet.rows===2, 'sprite sheet layout handles partial rows and scale');
ok(Q.spriteSheetLayout({width:4096,height:4096,frames:[1,2,3,4]},2,1)===null, 'sprite sheet rejects oversized output');


console.log('animation assist');
const old=new Q.Doc({width:8,height:8,onionFrames:3});
ok(old.onionPrevFrames===3 && old.onionNextFrames===3, 'legacy onion count migrates to both directions');
const anim=new Q.Doc({width:8,height:8}); for(let i=0;i<4;i++) anim.addFrame(false);
anim.activeFrame=2; anim.onionPrevFrames=2; anim.onionNextFrames=1; anim.setFrameSkipped(1,true);
let neighbors=Q.onionNeighbors(anim);
ok(neighbors.previous.join(',')==='0' && neighbors.next.join(',')==='3', 'onion neighbours skip excluded frames by default');
anim.onionIncludeSkipped=true; neighbors=Q.onionNeighbors(anim);
ok(neighbors.previous.join(',')==='1,0' && neighbors.next.join(',')==='3', 'onion assist can include skipped frames');
anim.onionPrevFrames=0; ok(Q.onionNeighbors(anim).previous.length===0, 'previous onion count can be set to zero');
anim.history.undo(); ok(!anim.frames[1].skipped, 'frame skip is undoable'); anim.history.redo();
anim.activeFrame=1; anim.addFrame(true);
ok(anim.frames[2].skipped, 'duplicating a skipped frame keeps its skip setting'); anim.history.undo();
anim.batchFrames(0,2,'skip'); ok(anim.frames.slice(0,3).every(f=>f.skipped), 'batch skip excludes chosen frames');
anim.history.undo(); ok(!anim.frames[0].skipped && anim.frames[1].skipped, 'batch skip undo restores individual frame flags');
anim.batchFrames(0,2,'include'); ok(anim.frames.slice(0,3).every(f=>!f.skipped), 'batch include re-enables frames');
anim.setFrameSkipped(0,true); anim.batchFrames(0,2,'reverse');
ok(anim.frames[2].skipped && !anim.frames[0].skipped, 'batch reverse moves frame skip flags with their frames');
anim.batchFrames(0,2,'duplicate'); ok(anim.frames[5].skipped && !anim.frames[3].skipped, 'batch duplicate preserves each skip flag');
anim.history.undo(); anim.history.undo(); ok(anim.frames[0].skipped && !anim.frames[2].skipped && anim.frames.length===5, 'undo restores original skipped frames after batch edits');
anim.setFrameDuration(0,60); ok(anim.frames[0].duration===60, 'frame holds support up to sixty ticks');
anim.setFrameDuration(0,200); ok(anim.frames[0].duration===60, 'frame hold is capped at sixty ticks');


console.log('additional effects');
const poster={width:1,height:1,data:new Uint8ClampedArray([10,100,220,127])}; Q.applyPixelEffect(poster,'posterize',1);
ok(poster.data.join(',')==='0,85,255,127', 'posterize quantizes colour while preserving alpha');
const solar={width:1,height:1,data:new Uint8ClampedArray([64,128,240,255])}; Q.applyPixelEffect(solar,'solarize',1);
ok(solar.data.join(',')==='64,127,15,255', 'solarize inverts bright channels');
const block={width:3,height:1,data:new Uint8ClampedArray([255,0,0,255,0,0,0,0,0,255,0,255])}; Q.applyPixelEffect(block,'pixelate',0.01);
ok(block.data[0]===255 && block.data[3]===128 && block.data[4]===255 && block.data[7]===128 && block.data[9]===255, 'pixelate averages premultiplied colour and handles partial blocks');


console.log('2.1 batch cel and frame operations');
const celDoc=new Q.Doc({width:4096,height:4096}); celDoc.activeCel(true); celDoc.addFrame(false); celDoc.addFrame(false);
const beforeHistory=celDoc.history.undoStack.length;
ok(celDoc.copyCelToRange(0,1,2).includes('Too many pixels') && celDoc.history.undoStack.length===beforeHistory && !celDoc.cel(1,0,false), 'oversized cel copy is rejected without edits or history');
ok(celDoc.copyCelToRange(1,0,0).includes('empty'), 'empty source cel is rejected');
ok(celDoc.copyCelToRange(0,0,0).includes('destination'), 'source-only cel copy is rejected');
ok(celDoc.copyCelToRange(-1,0,1).includes('Invalid'), 'invalid source is rejected');
ok(!celDoc.deleteFrameRange(0,2) && !celDoc.deleteFrameRange(-1,1), 'invalid or all-frame deletion is rejected');


console.log('2.3 animation guide and image layer');
const guided=new Q.Doc({width:100,height:100});
ok(guided.motionGuide.length===0 && guided.motionGuideVisible, 'legacy document defaults to an empty visible animation guide');
ok(!guided.setMotionGuide([{x:1,y:2}]) && !guided.setMotionGuide([{x:0,y:0},{x:NaN,y:2}]), 'invalid paths are rejected');
guided.setMotionGuideVisible(false); guided.setMotionGuide([{x:-5,y:20},{x:120,y:80}]);
ok(guided.motionGuide[0].x===0 && guided.motionGuide[1].x===100 && guided.motionGuideVisible, 'guide is clamped and shown when drawn');
guided.history.undo(); ok(guided.motionGuide.length===0 && !guided.motionGuideVisible, 'one undo restores previous guide and visibility');
guided.history.redo(); ok(guided.motionGuide.length===2 && guided.motionGuideVisible, 'guide redraw is redoable');
const imported=Q.canvas(100,100); guided.addFrame(false); ok(guided.insertImageLayer(imported,'Imported') && guided.layers.length===2 && guided.cel(1,1,false)===imported && !guided.cel(0,1,false), 'import inserts image in current frame only');
guided.history.undo(); ok(guided.layers.length===1 && guided.motionGuide.length===2, 'undo import removes image layer without deleting guide');
guided.history.redo(); ok(guided.cel(1,1,false)===imported, 'redo restores imported cel');


console.log('2.4 layer clipping');
const clips=new Q.Doc({width:16,height:16});
ok(!clips.setLayerClipped(0,true) && !clips.history.canUndo(), 'bottom layer cannot be clipped');
clips.addLayer(); clips.setLayerClipped(1,true); ok(clips.layers[1].clipped && clips.clipBase(1)===0, 'clipped layer targets the nearest base below');
clips.history.undo(); ok(!clips.layers[1].clipped, 'clipping toggle can be undone'); clips.history.redo();
clips.addLayer(1); ok(clips.layers[2].clipped && clips.clipBase(2)===0, 'duplicate keeps clipping and joins same stack');
const oldCount=clips.layers.length, oldUndo=clips.history.undoStack.length; clips.mergeDown(2);
ok(clips.layers.length===oldCount && clips.history.undoStack.length===oldUndo, 'merge is refused while clipping is enabled');
clips.moveLayer(0,1); ok(clips.layers[0].clipped && clips.clipBase(0)===-1 && clips.clipBase(2)===1, 'reorder can orphan and rebind clipped layers');
ok(clips.setLayerClipped(0,false) && !clips.layers[0].clipped, 'orphan clipped layer can be released');
clips.history.undo(); ok(clips.layers[0].clipped, 'undo restores orphan state');

console.log(`\nall ${checks} engine checks passed`);
