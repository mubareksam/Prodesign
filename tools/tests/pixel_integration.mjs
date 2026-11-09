/* Real raster tests: selection clipping, undo and transformations on RGBA pixels. */
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const js=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../android/assets/app/js');
globalThis.window=globalThis;
globalThis.addEventListener=()=>{};
globalThis.document={readyState:'loading',addEventListener(){},createElement(tag){ if (tag!=='canvas') throw Error(tag); return createCanvas(1,1); }};
Object.defineProperty(globalThis,'navigator',{value:{vibrate(){}},configurable:true});
for (const f of ['core.js','doc.js','brushes.js','effects.js','fill.js','selection.js','spritesheet.js','app.js']) new Function(readFileSync(path.join(js,f),'utf8'))();
const Q=globalThis.Q, App=Q.App;
Q.toast=()=>{}; Q.UI={progress(){},endProgress(){},syncHistory(){},refreshReference(){},syncDoc(){},refreshTimeline(){},highlightFrame(){}};
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


for (const [name,brush,opacity] of [['dry',pen,1],['wet',{...pen,flow:0.5},0.6]]) {
 const d=setup(), cel=d.activeCel(true), c=cel.getContext('2d');
 c.fillStyle='rgba(0,0,255,0.5)'; c.fillRect(5,4,4,8); d.layer().alphaLocked=true;
 const initial=pixel(cel,5,7)[3], stroke=new Q.Stroke(d,brush,[255,0,0],10,opacity,null);
 stroke.begin({x:5,y:7,pressure:1,t:1}); stroke.end();
 ok(pixel(cel,5,7)[3]===initial && pixel(cel,5,7)[0]>0 && pixel(cel,3,7)[3]===0, name+' alpha-locked brush recolours without changing opacity');
 d.history.undo(); ok(pixel(cel,5,7)[0]===0 && pixel(cel,5,7)[3]===initial, name+' alpha-locked brush undo restores original');
}
{
 const d=setup(), cel=d.activeCel(true), c=cel.getContext('2d'); c.fillStyle='rgba(0,0,255,0.5)'; c.fillRect(4,4,4,4); d.layer().alphaLocked=true;
 const original=pixel(cel,4,4)[3]; App.fillThreshold=12; App.fillAt(4,4); await new Promise(r=>setTimeout(r,75));
 ok(pixel(cel,4,4)[0]===255 && pixel(cel,4,4)[3]===original && pixel(cel,3,4)[3]===0, 'alpha-locked flood fill retains alpha and does not spread into transparency');
 d.history.undo(); App.fillAt(2,2); await new Promise(r=>setTimeout(r,55));
 ok(pixel(cel,2,2)[3]===0 && d.history.undoStack.length===0, 'alpha-locked flood fill rejects transparent seed');
 App.view.selection={x:0,y:0,w:10,h:10}; App.editSelection('fill');
 ok(pixel(cel,4,4)[0]===255 && pixel(cel,4,4)[3]===original && pixel(cel,3,4)[3]===0, 'alpha-locked rectangle fill preserves transparency');
 d.history.undo(); App.applyEffect('blur',0.2); await new Promise(r=>setTimeout(r,75));
 ok(pixel(cel,4,4)[3]===original && pixel(cel,3,4)[3]===0, 'alpha-locked blur preserves the original alpha mask');
 const count=d.history.undoStack.length; App.editSelection('clear'); App.editSelection('flipH'); App.moveScaleSelection(3,0,1); d.clearLayer(0);
 ok(d.history.undoStack.length===count && d.activeCel(false)===cel, 'alpha lock blocks edits that would alter the shape');
}
{
 const d=setup(), cel=d.activeCel(true), c=cel.getContext('2d'); c.fillStyle='rgba(255,0,0,0.5)'; c.fillRect(0,0,2,2); d.bg='#00ff00';
 const saved=[]; Q.saveBytes=(url,mime,name)=>{ saved.push({url,mime,name}); return true; };
 App.exportPng(); App.exportPng(true);
 const normal=createCanvas(16,16), transparent=createCanvas(16,16);
 normal.getContext('2d').drawImage(await loadImage(saved[0].url),0,0); transparent.getContext('2d').drawImage(await loadImage(saved[1].url),0,0);
 ok(same(pixel(normal,5,5),[0,255,0,255]) && pixel(transparent,5,5)[3]===0, 'normal PNG includes background; transparent PNG omits it');
 ok(pixel(transparent,0,0)[3]===127 || pixel(transparent,0,0)[3]===128, 'transparent PNG preserves layer alpha');
 ok(saved[1].name.includes('-transparent.png'), 'transparent PNG has an identifiable filename');
}


{
 const d=setup(), colors=['#ff0000','#00ff00','#0000ff'];
 colors.forEach((color,i)=>{ if(i) d.addFrame(false); const c=d.activeCel(true).getContext('2d'); c.fillStyle=color; c.fillRect(0,0,8,8); });
 const sheet=Q.renderSpriteSheet(d,2,1,true);
 ok(sheet.width===32 && sheet.height===32, 'sprite sheet has expected grid dimensions');
 ok(same(pixel(sheet,1,1),[255,0,0,255]) && same(pixel(sheet,17,1),[0,255,0,255]) && same(pixel(sheet,1,17),[0,0,255,255]), 'sprite sheet lays out source frames in row-major order');
 ok(pixel(sheet,12,1)[3]===0 && pixel(sheet,17,17)[3]===0, 'transparent sprite sheet preserves clear areas and unused cells');
 d.bg='#334455'; const opaque=Q.renderSpriteSheet(d,2,1,false);
 ok(same(pixel(opaque,12,1),[51,68,85,255]) && pixel(opaque,17,17)[3]===0, 'sprite sheet background fills tiles but not unused cells');
 let file=null; Q.saveBytes=(url,mime,name)=>{file={url,mime,name}; return true;};
 App.exportSpriteSheet(2,1,true); await new Promise(r=>setTimeout(r,90));
 const decoded=createCanvas(32,32); decoded.getContext('2d').drawImage(await loadImage(file.url),0,0);
 ok(file.name.endsWith('-spritesheet.png') && same(pixel(decoded,17,1),[0,255,0,255]), 'sprite sheet export writes a valid correctly ordered PNG');
}
{
 const d=setup(), colors=['#ff0000','#00ff00','#0000ff','#ffff00'];
 colors.forEach((color,i)=>{if(i) d.addFrame(false); const c=d.activeCel(true).getContext('2d'); c.fillStyle=color; c.fillRect(0,0,16,16); });
 d.playMode='pingpong'; d.fps=10; d.frames[1].duration=2; d.frames[2].duration=3; d.setPlayRange(1,3);
 let captured=null; Q.encodeGif=(frames,opts)=>{captured={frames,opts}; return Promise.resolve({dataUrl:'data:image/gif;base64,AA=='});}; Q.saveBytes=()=>true;
 App.exportGif({}); await new Promise(r=>setTimeout(r,10));
 ok(captured.frames.length===4 && same(pixel(captured.frames[0],1,1),[0,255,0,255]) && same(pixel(captured.frames[3],1,1),[0,0,255,255]), 'GIF export uses selected range in ping-pong order');
 ok(captured.opts.delaysCs.join(',')==='20,30,10,30', 'GIF export preserves holds in playback range');
 ok(Q.animationOrder(4,'loop',1,1).join(',')==='1' && Q.animationOrder(4,'pingpong',1,3).join(',')==='1,2,3,2', 'range order handles single-frame and ping-pong cycles');
}
{
 const d=setup(), cel=d.activeCel(true), c=cel.getContext('2d'); c.fillStyle='#ff0000'; c.fillRect(0,0,3,3); d.layer().locked=true;
 App.flipCanvas(); ok(pixel(cel,0,0)[0]===255 && d.history.undoStack.length===0, 'canvas flip respects locked layers');
 d.layer().locked=false; d.layer().alphaLocked=true; App.flipCanvas();
 ok(pixel(cel,0,0)[0]===255 && d.history.undoStack.length===0, 'canvas flip respects alpha-locked layers');
}


{
 new Function(readFileSync(path.join(js,'gif.js'),'utf8'))();
 const d=setup(); for(let i=1;i<4;i++) d.addFrame(false);
 d.frames.forEach((f,i)=>{d.activeFrame=i; const c=d.activeCel(true).getContext('2d'); c.fillStyle=['#ff0000','#00ff00','#0000ff','#ffff00'][i]; c.fillRect(0,0,16,16);});
 d.playMode='pingpong'; d.fps=10; d.frames[1].duration=2; d.frames[2].duration=3; d.setPlayRange(1,3);
 let gifData=null; Q.saveBytes=(url,mime)=>{ if(mime==='image/gif') gifData=url; return true;}; App.exportGif({});
 await new Promise(r=>setTimeout(r,70)); if (!gifData) throw Error('GIF export did not finish');
 const root=path.resolve(js,'../../../..'), folder=path.join(root,'build'); mkdirSync(folder,{recursive:true});
 const output=path.join(folder,'range-integration.gif'); writeFileSync(output,Buffer.from(gifData.split(',')[1],'base64'));
 const decoded=JSON.parse(execFileSync('python3',[path.join(root,'tools/tests/gif_decode.py'),output,'--json'],{encoding:'utf8'}));
 ok(decoded.frames.length===4 && decoded.delays.join(',')==='20,30,10,30', 'real GIF encoder writes selected ping-pong range and holds');

 d.playMode='once'; d.setPlayRange(2,2); gifData=null; App.exportGif({}); await new Promise(r=>setTimeout(r,50));
 const one=path.join(folder,'range-one.gif'); writeFileSync(one,Buffer.from(gifData.split(',')[1],'base64'));
 const oneInfo=JSON.parse(execFileSync('python3',[path.join(root,'tools/tests/gif_decode.py'),one,'--json'],{encoding:'utf8'}));
 ok(oneInfo.frames.length===1 && oneInfo.delays[0]===30 && !Buffer.from(gifData.split(',')[1],'base64').includes(Buffer.from('NETSCAPE2.0')), 'single-frame one-shot range exports with hold and no loop');

}


{
 const d=setup(), cel=d.activeCel(true), c=cel.getContext('2d'); c.fillStyle='#ff0000'; c.fillRect(0,0,4,4); d.addFrame(false);
 d.batchFrames(0,0,'duplicate'); const copy=d.cel(1,0,false); copy.getContext('2d').clearRect(0,0,4,4);
 ok(pixel(cel,1,1)[0]===255 && pixel(copy,1,1)[3]===0, 'batch frame duplicates are independent pixel canvases');
 d.history.undo(); ok(d.frames.length===2 && pixel(cel,1,1)[0]===255, 'undo batch duplication preserves original pixels');
}

console.log(`all ${n} raster integration checks passed`);
