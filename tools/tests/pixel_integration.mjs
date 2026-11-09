/* Real raster tests: selection clipping, undo and transformations on RGBA pixels. */
import { createCanvas } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const js=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../android/assets/app/js');
globalThis.window=globalThis;
globalThis.addEventListener=()=>{};
globalThis.document={readyState:'loading',addEventListener(){},createElement(tag){ if (tag!=='canvas') throw Error(tag); return createCanvas(1,1); }};
Object.defineProperty(globalThis,'navigator',{value:{vibrate(){}},configurable:true});
for (const f of ['core.js','doc.js','brushes.js','effects.js','fill.js','selection.js','app.js']) new Function(readFileSync(path.join(js,f),'utf8'))();
const Q=globalThis.Q, App=Q.App;
Q.toast=()=>{}; Q.UI={progress(){},endProgress(){},syncHistory(){},refreshReference(){},syncDoc(){}};
App.markDirty=()=>{};
let n=0;
function ok(v,msg) { if(!v) throw Error('FAILED: '+msg); n++; console.log('  ✓ '+msg); }
function pixel(c,x,y) { return [...c.getContext('2d').getImageData(x,y,1,1).data]; }
function same(a,b) { return a.join(',')===b.join(','); }
function setup() { const d=new Q.Doc({width:16,height:16}); App.doc=d; App.view={selection:null,color:[255,0,0],dirty:false}; return d; }
const mask={x:4,y:4,w:8,h:8};
const pen={id:'test',engine:'fill',spacing:0.05,flow:1};
for (const [name,brush,opacity] of [['dry',pen,1],['wet',{...pen,flow:0.5},0.6]]) {
  const d=setup(), s=new Q.Stroke(d,brush,[255,0,0],8,opacity,mask);
  s.begin({x:4,y:8,pressure:1,t:1}); s.end();
  const cel=d.activeCel(false);
  ok(pixel(cel,4,8)[3]>0 && pixel(cel,2,8)[3]===0, name+' brush clips paint to selection');
  d.history.undo(); ok(pixel(cel,4,8)[3]===0, name+' brush undo restores pixels');
  d.history.redo(); ok(pixel(cel,4,8)[3]>0 && pixel(cel,2,8)[3]===0, name+' brush redo stays clipped');
}
{
 const d=setup(), cel=d.activeCel(true), c=cel.getContext('2d'); c.fillStyle='#0000ff'; c.fillRect(0,0,16,16);
 const s=new Q.Stroke(d,{...pen,eraser:true},[0,0,0],8,1,mask); s.begin({x:4,y:8,pressure:1,t:1}); s.end();
 ok(pixel(cel,4,8)[3]===0 && pixel(cel,2,8)[3]===255, 'eraser is clipped to selection');
 d.history.undo(); ok(same(pixel(cel,4,8),[0,0,255,255]), 'eraser undo restores original pixels');
}
{
 const d=setup(), cel=d.activeCel(true); App.view.selection=mask;
 App.fillAt(5,5); await new Promise(r=>setTimeout(r,75));
 ok(pixel(cel,4,4)[0]===255 && pixel(cel,3,4)[3]===0, 'flood fill is bounded by selection');
 d.history.undo(); ok(pixel(cel,5,5)[3]===0, 'selection flood fill undo restores pixels');
 App.fillAt(2,2); await new Promise(r=>setTimeout(r,50));
 ok(d.history.undoStack.length===0, 'fill outside the selection is rejected');
}
{
 const d=setup(), cel=d.activeCel(true), c=cel.getContext('2d'); c.fillStyle='#123456'; c.fillRect(0,0,16,16); App.view.selection=mask;
 App.applyEffect('invert',1); await new Promise(r=>setTimeout(r,70));
 ok(same(pixel(cel,5,5),[237,203,169,255]) && same(pixel(cel,2,2),[18,52,86,255]), 'effect changes pixels inside selection only');
 d.history.undo(); ok(same(pixel(cel,5,5),[18,52,86,255]), 'selected effect is undoable');
}
{
 const d=setup(), cel=d.activeCel(true), c=cel.getContext('2d'); c.fillStyle='#ff0000'; c.fillRect(1,1,2,2); c.fillStyle='#0000ff'; c.fillRect(8,1,2,2);
 App.view.selection={x:1,y:1,w:2,h:2}; App.moveScaleSelection(4,2,2);
 ok(pixel(cel,1,1)[3]===0 && same(pixel(cel,5,3),[255,0,0,255]) && same(pixel(cel,8,4),[255,0,0,255]), 'move/scale cuts source and draws scaled pixels');
 ok(same(pixel(cel,8,1),[0,0,255,255]), 'move/scale preserves unaffected pixels');
 ok(App.view.selection.x===5 && App.view.selection.y===3 && App.view.selection.w===4, 'selection follows transformed bounds');
 d.history.undo(); ok(same(pixel(cel,1,1),[255,0,0,255]) && pixel(cel,5,3)[3]===0, 'move/scale undo restores source and destination');
 d.history.redo(); ok(pixel(cel,1,1)[3]===0 && pixel(cel,5,3)[0]===255, 'move/scale redo restores transformed pixels');
}

{
 const d=setup(), cel=d.activeCel(true), c=cel.getContext('2d'); c.fillStyle='#ff0000'; c.fillRect(2,2,2,2); c.fillStyle='#0000ff'; c.fillRect(9,9,2,2);
 d.addFrame(false); d.activeFrame=0; App.view.selection={x:2,y:2,w:2,h:2}; App.copySelectionToLayer();
 const copied=d.activeCel(false);
 ok(d.layers.length===2 && same(pixel(copied,2,2),[255,0,0,255]) && pixel(copied,9,9)[3]===0, 'copy selection creates a layer containing only selected pixels');
 ok(d.cel(1,1,false)===null && same(pixel(cel,9,9),[0,0,255,255]), 'copy leaves other frames blank and source unchanged');
 d.history.undo(); ok(d.layers.length===1, 'copy selection undo removes new layer');
 d.history.redo(); ok(d.layers.length===2 && same(pixel(d.activeCel(false),2,2),[255,0,0,255]), 'copy selection redo restores pixels');
}


{
 const d=setup(), cel=d.activeCel(true), c=cel.getContext('2d'); c.fillStyle='#00ff00'; c.fillRect(0,0,4,4);
 App.view.selection={x:0,y:0,w:4,h:4}; App.moveScaleSelection(-2,-1,1);
 ok(pixel(cel,0,0)[1]===255 && pixel(cel,3,3)[3]===0 && App.view.selection.w===2 && App.view.selection.h===3, 'off-canvas transform crops and clamps selection');
 d.history.undo(); ok(pixel(cel,3,3)[1]===255, 'cropped transform can be undone');
}
{
 const d=setup(), cel=d.activeCel(true), c=cel.getContext('2d'); c.fillStyle='#123456'; c.fillRect(0,0,16,16); d.layer().locked=true; App.view.selection=mask;
 App.fillAt(5,5); App.applyEffect('invert',1); App.editSelection('clear'); App.moveScaleSelection(2,2,1);
 await new Promise(r=>setTimeout(r,75));
 ok(same(pixel(cel,5,5),[18,52,86,255]) && d.history.undoStack.length===0, 'locked layer blocks fill, effects, clear and transform without changing pixels');
}

console.log(`all ${n} raster integration checks passed`);
