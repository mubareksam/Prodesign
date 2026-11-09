/* Real raster tests: selection clipping, undo and transformations on RGBA pixels. */
import { createCanvas, loadImage, Image as NativeImage } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const js=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../android/assets/app/js');
globalThis.window=globalThis;
globalThis.addEventListener=()=>{};
globalThis.document={readyState:'loading',addEventListener(){},createElement(tag){ if (tag!=='canvas') throw Error(tag); return createCanvas(1,1); }};
Object.defineProperty(globalThis,'navigator',{value:{vibrate(){}},configurable:true});
for (const f of ['core.js','doc.js','brushes.js','effects.js','fill.js','selection.js','spritesheet.js','view.js','app.js']) new Function(readFileSync(path.join(js,f),'utf8'))();
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
 d.frames[1].skipped=true;
 const sheet=Q.renderSpriteSheet(d,2,1,true);
 ok(sheet.width===32 && sheet.height===32, 'sprite sheet has expected grid dimensions');
 ok(same(pixel(sheet,1,1),[255,0,0,255]) && same(pixel(sheet,17,1),[0,255,0,255]) && same(pixel(sheet,1,17),[0,0,255,255]), 'sprite sheet includes skipped source frames in row-major order');
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


{
 const d=setup(); d.onion=true; d.onionAlpha=1; d.onionPrevFrames=1; d.onionNextFrames=0; d.onionOriginalColor=true;
 let c=d.activeCel(true).getContext('2d'); c.fillStyle='#ff0000'; c.fillRect(0,0,16,16); d.addFrame(false);
 c=d.activeCel(true).getContext('2d'); c.fillStyle='#0000ff'; c.fillRect(0,0,16,16);
 const canvas=createCanvas(16,16), view=Object.create(Q.View.prototype);
 Object.assign(view,{doc:d,canvas,ctx:canvas.getContext('2d'),dpr:1,scale:1,rot:0,tx:0,ty:0,stroke:null});
 App.playing=false; d.onionAbove=false; view.render();
 ok(same(pixel(canvas,5,5),[0,0,255,255]), 'onion below opaque artwork is correctly covered');
 d.onionAbove=true; view.render(); const above=pixel(canvas,5,5);
 ok(above[0]>150 && above[2]>0, 'onion above artwork renders original-colour ghost');
 d.onionOriginalColor=false; d.onionPrevColor='#00ff00'; view.render();
 ok(pixel(canvas,5,5)[1]>150, 'onion tint is applied when tint mode is selected');
 d.setFrameSkipped(0,true); d.onionIncludeSkipped=false; view.render();
 ok(same(pixel(canvas,5,5),[0,0,255,255]), 'skipped frame is excluded from onion preview');
 d.onionIncludeSkipped=true; view.render(); ok(pixel(canvas,5,5)[1]>150, 'skipped frame can be shown as an onion');
}
{
 const d=setup(); let c=d.activeCel(true).getContext('2d'); c.fillStyle='#ff0000'; c.fillRect(0,0,16,16); d.addLayer();
 c=d.activeCel(true).getContext('2d'); c.fillStyle='#00ff00'; c.fillRect(0,0,16,16);
 const only=createCanvas(16,16); d.composite(only.getContext('2d'),0,{onlyLayer:0});
 ok(same(pixel(only,5,5),[255,0,0,255]), 'active-layer onion compositing excludes other layers');
}
{
 const d=setup(); for(let i=1;i<5;i++) d.addFrame(false);
 d.frames.forEach((f,i)=>{d.activeFrame=i; const c=d.activeCel(true).getContext('2d'); c.fillStyle=['#ff0000','#00ff00','#0000ff','#ffffff','#ffff00'][i]; c.fillRect(0,0,16,16);});
 d.fps=10; d.playMode='pingpong'; d.frames[1].skipped=true; d.frames[3].skipped=true; d.frames[4].duration=60;
 ok(Q.playbackOrder(d).join(',')==='0,2,4,2', 'ping-pong playback skips excluded frames');
 let data=null; Q.saveBytes=(url,mime)=>{if(mime==='image/gif') data=url;return true;}; App.exportGif({}); await new Promise(r=>setTimeout(r,80));
 const root=path.resolve(js,'../../../..'), output=path.join(root,'build','skipped-range.gif'); writeFileSync(output,Buffer.from(data.split(',')[1],'base64'));
 const info=JSON.parse(execFileSync('python3',[path.join(root,'tools/tests/gif_decode.py'),output,'--json'],{encoding:'utf8'}));
 ok(info.frames.length===4 && info.delays.join(',')==='10,10,600,10', 'GIF excludes skipped frames and preserves a 60-tick hold');
 d.setPlayRange(1,3); ok(Q.playbackOrder(d).join(',')==='2', 'playback range filters skipped frames before ping-pong');
 d.frames[2].skipped=true; data=null; App.exportGif({}); await new Promise(r=>setTimeout(r,30));
 ok(!data && Q.playbackOrder(d).length===0, 'GIF export rejects a range with no included frames');
}


{
 const d=setup(), cel=d.activeCel(true), c=cel.getContext('2d'); c.fillStyle='#ff0000'; c.fillRect(0,0,1,1); c.fillStyle='#0000ff'; c.fillRect(1,0,1,1); c.fillStyle='#00ff00'; c.fillRect(3,0,1,1);
 App.view.selection={x:0,y:0,w:2,h:1}; App.applyEffect('pixelate',0.01); await new Promise(r=>setTimeout(r,75));
 const mixed=pixel(cel,0,0); ok(mixed[0]===128 && mixed[2]===128 && same(pixel(cel,3,0),[0,255,0,255]), 'pixelate affects only selected pixels');
 d.history.undo(); ok(same(pixel(cel,0,0),[255,0,0,255]) && same(pixel(cel,1,0),[0,0,255,255]), 'pixelate is undoable');
}


{
 const d=setup(); const source=d.activeCel(true); source.getContext('2d').fillStyle='#ff0000'; source.getContext('2d').fillRect(0,0,4,4);
 d.addFrame(false); const original=d.activeCel(true); original.getContext('2d').fillStyle='#0000ff'; original.getContext('2d').fillRect(0,0,4,4);
 d.addFrame(false); d.frames[2].skipped=true; d.frames[2].duration=9; d.addLayer(); d.activeCel(true).getContext('2d').fillRect(0,0,1,1); const other=d.cel(2,1,false); d.activeLayer=0;
 ok(d.copyCelToRange(0,0,2)===null && same(pixel(d.cel(1,0,false),1,1),[255,0,0,255]) && same(pixel(d.cel(2,0,false),1,1),[255,0,0,255]), 'cel copying replaces destination pixels including skipped frames');
 ok(d.cel(2,1,false)===other && d.frames[2].duration===9 && d.frames[2].skipped, 'cel copying leaves other layers and frame metadata intact');
 d.cel(1,0,false).getContext('2d').clearRect(0,0,4,4);
 ok(pixel(source,1,1)[0]===255 && pixel(d.cel(2,0,false),1,1)[0]===255, 'each copied cel is independent from source and other copies');
 d.history.undo(); ok(d.cel(1,0,false)===original && same(pixel(original,1,1),[0,0,255,255]) && d.cel(2,0,false)===null, 'undo restores overwritten and empty destination cels');
 d.history.redo(); ok(d.cel(2,0,false) && pixel(d.cel(2,0,false),1,1)[0]===255, 'redo restores copied cels');
 d.layer().locked=true; ok(!!d.copyCelToRange(0,1,1), 'cel copy respects layer lock'); d.layer().locked=false; d.layer().alphaLocked=true; ok(!!d.copyCelToRange(0,1,1), 'cel copy respects alpha lock');
 d.layer().alphaLocked=false; const old=d.cel(2,0,false), savedCopy=Q.copyCanvas; let attempts=0; Q.copyCanvas=(cv)=>{ if (++attempts===2) throw Error('allocation'); return savedCopy(cv); };
 try { d.copyCelToRange(0,1,2); } catch(e) {} Q.copyCanvas=savedCopy; ok(d.cel(2,0,false)===old, 'failed allocation leaves every destination unchanged');
}
{
 const d=setup(); for(let i=0;i<4;i++) d.addFrame(false); d.activeFrame=4; d.setPlayRange(2,4); d.frames[1].skipped=true; d.frames[2].duration=3;
 ok(d.deleteFrameRange(1,3) && d.frames.length===2 && d.activeFrame===1 && d.playRange.start===1 && d.playRange.end===1, 'delete range clamps current frame and positional playback range');
 d.history.undo(); ok(d.frames.length===5 && d.activeFrame===4 && d.frames[1].skipped && d.frames[2].duration===3 && d.playRange.start===2, 'undo range deletion restores frames, metadata, selection and playback range');
 d.history.redo(); ok(d.frames.length===2, 'redo range deletion removes the same frames');
 ok(!d.deleteFrameRange(0,1) && d.frames.length===2, 'range deletion refuses to remove every frame');
}
{
 const d=setup(); for(let i=0;i<3;i++) d.addFrame(false); d.fps=10; d.frames[1].skipped=true; d.frames[2].duration=3; d.playMode='pingpong';
 let stats=Q.playbackStats(d); ok(stats.frames===3 && stats.ticks===8 && stats.seconds===0.8, 'timing statistics include holds, skips and ping-pong return');
 d.setPlayRange(1,1); stats=Q.playbackStats(d); ok(stats.frames===0 && stats.ticks===0 && stats.seconds===0, 'timing reports empty when selected range is all skipped');
}


const triangle=()=>Q.lassoSelection([{x:2,y:2},{x:14,y:2},{x:2,y:14}],16,16);
for (const [name,brush,opacity] of [['dry',pen,1],['wet',{...pen,flow:0.5},0.6],['eraser',{...pen,eraser:true},1]]) {
 const d=setup(), cel=d.activeCel(true), c=cel.getContext('2d'); if(name==='eraser') {c.fillStyle='#0000ff';c.fillRect(0,0,16,16);}
 const stroke=new Q.Stroke(d,brush,[255,0,0],20,opacity,triangle()); stroke.begin({x:8,y:8,pressure:1,t:1}); stroke.end();
 if(name==='eraser') ok(pixel(cel,4,4)[3]===0 && pixel(cel,12,12)[3]===255, 'lasso clips eraser to polygon');
 else ok(pixel(cel,4,4)[0]>0 && pixel(cel,12,12)[3]===0, 'lasso clips '+name+' brush to polygon');
 d.history.undo(); ok(name==='eraser' ? pixel(cel,4,4)[3]===255 : pixel(cel,4,4)[3]===0, 'lasso '+name+' stroke is undoable');
}
{
 const d=setup(), cel=d.activeCel(true), c=cel.getContext('2d'); c.fillStyle='#0000ff'; c.fillRect(0,0,16,16); App.view.selection=triangle();
 App.fillAt(12,12); await new Promise(r=>setTimeout(r,75)); ok(same(pixel(cel,4,4),[0,0,255,255]) && d.history.undoStack.length===0, 'flood fill outside lasso but inside bounds does not fill');
 App.fillAt(4,4); await new Promise(r=>setTimeout(r,75));
 ok(pixel(cel,4,4)[0]===255 && same(pixel(cel,12,12),[0,0,255,255]), 'lasso bounds flood fill to polygon');
 d.history.undo(); ok(same(pixel(cel,4,4),[0,0,255,255]), 'lasso flood fill is undoable');
 App.applyEffect('invert',1); await new Promise(r=>setTimeout(r,75));
 ok(same(pixel(cel,4,4),[255,255,0,255]) && same(pixel(cel,12,12),[0,0,255,255]), 'lasso bounds effects to polygon');
 d.history.undo(); App.editSelection('clear'); ok(pixel(cel,4,4)[3]===0 && pixel(cel,12,12)[3]===255, 'lasso clear protects outside pixels'); d.history.undo();
 App.editSelection('fill'); ok(pixel(cel,4,4)[0]===255 && same(pixel(cel,12,12),[0,0,255,255]), 'lasso fill protects outside pixels'); d.history.undo();
 App.copySelectionToLayer(); ok(pixel(d.activeCel(false),4,4)[3]===255 && pixel(d.activeCel(false),12,12)[3]===0, 'copy to layer copies only lasso shape'); d.history.undo();
 const count=d.history.undoStack.length; App.editSelection('flipH'); App.moveScaleSelection(1,1,1); ok(d.history.undoStack.length===count && same(pixel(cel,12,12),[0,0,255,255]), 'unsupported lasso transforms refuse to modify bounding rectangle');
}


{
 const d=setup(); d.addFrame(false); const source=createCanvas(4,2); const c=source.getContext('2d'); c.fillStyle='#ff0000'; c.fillRect(0,0,4,2);
 let delay=0; globalThis.Image=NativeImage; globalThis.FileReader=class {readAsDataURL(file) { this.result=file.data; setTimeout(()=>this.onload(),delay); }};
 const f={name:'red.png',type:'image/png',size:256,data:source.toDataURL('image/png')}, target={doc:d,frame:d.frames[d.activeFrame],layer:d.layer()};
 App.importImageFile(f,target); await new Promise(r=>setTimeout(r,100));
 ok(d.layers.length===2 && same(pixel(d.cel(1,1,false),6,7),[255,0,0,255]) && pixel(d.cel(1,1,false),0,0)[3]===0, 'imported raster is centred without enlarging and preserves transparency');
 ok(!d.cel(0,1,false) && same(pixel(d.flatten(1,{background:false}),6,7),[255,0,0,255]), 'imported layer appears in export only on the selected frame');
 d.history.undo(); ok(d.layers.length===1, 'image import undo removes layer'); d.history.redo(); ok(d.layers.length===2 && pixel(d.cel(1,1,false),6,7)[0]===255, 'image import redo restores pixels');
 const before=d.layers.length;
 const huge=createCanvas(8193,1); App.importImageFile({...f,data:huge.toDataURL('image/png')},{doc:d,frame:d.frames[d.activeFrame],layer:d.layer()}); await new Promise(r=>setTimeout(r,60)); ok(d.layers.length===before, 'oversized decoded dimensions are rejected');
 App.importImageFile({...f,type:'application/pdf'}, {doc:d,frame:d.frames[d.activeFrame],layer:d.layer()}); await new Promise(r=>setTimeout(r,30)); ok(d.layers.length===before, 'non-image file is rejected');
 App.importImageFile({...f,size:17*1024*1024},{doc:d,frame:d.frames[d.activeFrame],layer:d.layer()}); await new Promise(r=>setTimeout(r,30)); ok(d.layers.length===before, 'oversized image file is rejected');
 delay=30; App.importImageFile(f,{doc:d,frame:d.frames[d.activeFrame],layer:d.layer()}); d.activeFrame=0; await new Promise(r=>setTimeout(r,100)); ok(d.layers.length===before, 'switching frames during image load cancels import');
}
{
 const d=setup(); d.setMotionGuide([{x:2,y:2},{x:14,y:14}]);
 const exported=d.flatten(0,{background:false}); ok(pixel(exported,8,8)[3]===0, 'motion guide is not included in flattened export');
 const canvas=createCanvas(16,16), view=Object.create(Q.View.prototype); Object.assign(view,{doc:d,canvas,ctx:canvas.getContext('2d'),dpr:1,scale:1,rot:0,tx:0,ty:0,stroke:null});
 view.render(); ok(pixel(canvas,3,3)[0]>200 && pixel(canvas,3,3)[1]<200, 'motion guide is visible in editor overlay');
}


{
 const d=setup(), base=d.activeCel(true), b=base.getContext('2d'); b.fillStyle='rgba(0,0,255,0.5)'; b.fillRect(2,2,6,6);
 d.addLayer(); let top=d.activeCel(true), t=top.getContext('2d'); t.fillStyle='#ff0000'; t.fillRect(0,0,16,16); d.setLayerClipped(1,true);
 let flat=d.flatten(0,{background:false}); let p=pixel(flat,4,4);
 ok(p[0]>250 && p[2]===0 && Math.abs(p[3]-128)<=1, 'clipped layer preserves semi-transparent base alpha');
 ok(pixel(flat,10,10)[3]===0, 'clipped layer does not draw outside base');
 d.layers[1].opacity=0.5; flat=d.flatten(0,{background:false}); p=pixel(flat,4,4);
 ok(Math.abs(p[0]-128)<=3 && Math.abs(p[2]-127)<=3 && Math.abs(p[3]-128)<=1, 'clip opacity blends colour without increasing base alpha');
 d.layers[0].opacity=0.5; p=pixel(d.flatten(0,{background:false}),4,4); ok(Math.abs(p[3]-64)<=1, 'base opacity applies once to clipped stack');
 d.layers[0].visible=false; ok(pixel(d.flatten(0,{background:false}),4,4)[3]===0, 'hidden base hides its clipping stack');
 d.layers[0].visible=true; d.layers[0].opacity=1; d.layers[1].opacity=1;
 const only=createCanvas(16,16); d.composite(only.getContext('2d'),0,{onlyLayer:1});
 ok(pixel(only,4,4)[0]>250 && Math.abs(pixel(only,4,4)[3]-128)<=1 && pixel(only,10,10)[3]===0, 'single-layer onion composite respects base mask');
 const screen=createCanvas(16,16), view=Object.create(Q.View.prototype); Object.assign(view,{doc:d,canvas:screen,ctx:screen.getContext('2d'),dpr:1,scale:1,rot:0,tx:0,ty:0,stroke:null});
 App.playing=false; view.render(); ok(pixel(screen,4,4)[0]>250 && pixel(screen,10,10)[1]>240, 'canvas preview displays clipping inside and background outside base');
 const buffer=d._clipBuffer; d.flatten(0,{background:false}); ok(buffer===d._clipBuffer, 'clipping buffer is reused across renders');
 d.layers[1].blend='multiply'; p=pixel(d.flatten(0,{background:false}),4,4); ok(p[0]>250 && p[2]===0, 'clipped layer uses Normal even when a stored blend mode exists');
 d.addLayer(); const third=d.activeCel(true), c=third.getContext('2d'); c.fillStyle='#00ff00'; c.fillRect(3,3,2,2); d.setLayerClipped(2,true);
 flat=d.flatten(0,{background:false}); ok(pixel(flat,3,3)[1]>250 && pixel(flat,6,6)[0]>250 && pixel(flat,10,10)[3]===0, 'multiple clipped layers stack within the same base');
 const sheet=Q.renderSpriteSheet(d,1,1,true); ok(pixel(sheet,3,3)[1]>250 && pixel(sheet,10,10)[3]===0, 'transparent sprite sheet respects clipping');
 d.addFrame(false); d.cel(1,1,true).getContext('2d').fillRect(0,0,16,16); ok(pixel(d.flatten(1,{background:false}),4,4)[3]===0, 'missing base cel hides clipped artwork in that frame');
 d.activeFrame=0; d.moveLayer(0,1); flat=d.flatten(0,{background:false}); ok(pixel(flat,6,6)[2]>250 && pixel(flat,3,3)[1]>250 && pixel(flat,10,10)[3]===0, 'orphan clipping is hidden and upper layers rebind after reorder');
}


{
 const d=setup(), bg=d.activeCel(true).getContext('2d'); bg.fillStyle='#808080'; bg.fillRect(0,0,16,16);
 d.addLayer(); const base=d.activeCel(true).getContext('2d'); base.fillStyle='rgba(0,0,255,0.5)'; base.fillRect(0,0,8,8); d.layers[1].blend='multiply';
 d.addLayer(); const clip=d.activeCel(true).getContext('2d'); clip.fillStyle='#ff0000'; clip.fillRect(0,0,16,16); d.setLayerClipped(2,true);
 const expected=createCanvas(16,16), e=expected.getContext('2d'); e.fillStyle='#808080'; e.fillRect(0,0,16,16); e.globalCompositeOperation='multiply'; e.fillStyle='rgba(255,0,0,0.5)'; e.fillRect(0,0,8,8);
 const out=d.flatten(0,{background:false}); ok(same(pixel(out,4,4),pixel(expected,4,4)) && same(pixel(out,12,12),[128,128,128,255]), 'base blend mode applies to completed clipped stack over lower artwork');
 d.setLayerClipped(2,false); const released=d.flatten(0,{background:false}); ok(same(pixel(released,12,12),[255,0,0,255]), 'releasing mask reveals intact pixels outside base');
 d.history.undo(); ok(same(pixel(d.flatten(0,{background:false}),12,12),[128,128,128,255]), 'undo release restores clipping without changing pixels');
}


{
 const d=setup(), base=d.activeCel(true).getContext('2d'); base.fillStyle='#0000ff'; base.fillRect(0,0,8,8);
 d.addLayer(); const upper=d.activeCel(true).getContext('2d'); upper.fillStyle='#ff0000'; upper.fillRect(0,0,16,16); d.setLayerClipped(1,true); d.addFrame(true);
 let result=null; Q.saveBytes=(url,mime)=>{if(mime==='image/gif') result=url;return true;}; App.exportGif({}); await new Promise(r=>setTimeout(r,100));
 const image=await loadImage(Buffer.from(result.split(',')[1],'base64')), canvas=createCanvas(16,16); canvas.getContext('2d').drawImage(image,0,0);
 ok(pixel(canvas,3,3)[0]>240 && pixel(canvas,12,12)[0]>240 && pixel(canvas,12,12)[1]>240, 'real GIF export includes masked pixels and canvas background outside base');
}


{
 const d=setup(); d.addFrame(false); d.activeFrame=1; const oldCount=d.history.undoStack.length;
 ok(App.addPaintLayer('solid','ff0000','','') && d.layers.length===2 && same(pixel(d.activeCel(false),4,4),[255,0,0,255]), 'solid colour creates a full-canvas layer and accepts hex without hash');
 ok(!d.cel(0,1,false), 'new colour layer is blank on other frames');
 d.history.undo(); ok(d.layers.length===1 && d.history.undoStack.length===oldCount, 'colour layer creation is one undo step');
 d.history.redo(); ok(d.layers.length===2 && pixel(d.activeCel(false),4,4)[0]===255, 'redo restores solid layer pixels');
 const before=d.layers.length; ok(!App.addPaintLayer('gradient','invalid','#fff','vertical') && d.layers.length===before, 'invalid gradient colour is rejected without edits');
}
for (const dir of ['horizontal','vertical','diagonal','radial']) {
 const d=setup(); ok(App.addPaintLayer('gradient','#ff0000','#0000ff',dir), dir+' gradient layer can be created');
 const cel=d.activeCel(false), start=dir==='radial' ? pixel(cel,8,8) : pixel(cel,0,0), end=dir==='horizontal' ? pixel(cel,15,0) : dir==='vertical' ? pixel(cel,0,15) : pixel(cel,15,15);
 ok(start[0]>start[2] && end[2]>end[0] && start[3]===255 && end[3]===255, dir+' gradient has expected colours and opacity');
 d.history.undo(); ok(d.layers.length===1, dir+' gradient is undoable'); d.history.redo(); ok(d.layers.length===2, dir+' gradient is redoable');
}
{
 const normal=Q.effectPreviewCanvas('invert'), gray=Q.effectPreviewCanvas('grayscale');
 ok(normal.width===64 && normal.height===48 && !same(pixel(normal,5,5),pixel(gray,5,5)), 'effect thumbnail samples use the actual pixel effect engine');
 for (const effect of ['blur','motion','sharpen','bloom','glitch','pixelate','posterize','solarize','grayscale','invert','sepia','brightness','saturation','contrast','hue','noise','chromatic','halftone','threshold']) {
   const cv=Q.effectPreviewCanvas(effect); ok(cv.width===64 && pixel(cv,5,5)[3]>0, effect+' thumbnail renders offline');
 }
}


{
 const sample=Q.motionPathSampler([{x:0,y:0},{x:2,y:0},{x:2,y:0},{x:2,y:6}]);
 ok(sample(0.5).x===2 && sample(0.5).y===2 && sample(1).y===6, 'path samples are distance based and tolerate duplicate points');
 ok(Q.motionPathSampler([{x:1,y:1},{x:1,y:1}])===null, 'zero-length path is rejected');
 ok(Q.motionEase(0.25,'linear')===0.25 && Q.motionEase(0.25,'in')===0.0625 && Q.motionEase(0.25,'out')===0.4375 && Q.motionEase(0.25,'inout')===0.15625, 'all easing modes interpolate correctly');
}
for (const mode of ['linear','in','out','inout']) {
 const d=setup(); const src=d.activeCel(true), ctx=src.getContext('2d'); ctx.fillStyle='#ff0000'; ctx.fillRect(1,1,1,1);
 for(let i=1;i<5;i++) d.addFrame(false);
 d.cel(2,0,true).getContext('2d').fillRect(10,10,1,1); d.frames[3].skipped=true; d.frames[2].duration=5;
 d.setMotionGuide([{x:1,y:1},{x:13,y:1}]); d.history.clear();
 ok(d.bakeMotionPath(0,0,4,mode)===null, mode+' motion bake succeeds');
 const expect=mode==='linear' ? 4 : mode==='in' ? 2 : mode==='out' ? 6 : 3;
 ok(pixel(d.cel(1,0,false),expect,1)[3]>0 && pixel(d.cel(0,0,false),1,1)[0]===255 && pixel(d.cel(4,0,false),13,1)[0]===255, mode+' motion places start, eased intermediate and end pixels');
 ok(pixel(d.cel(2,0,false),10,10)[3]===0 && d.frames[3].skipped && d.frames[2].duration===5 && !!d.cel(3,0,false), mode+' motion replaces skipped cels without changing timing');
 ok(d.history.undoStack.length===1, mode+' motion is one history step'); d.history.undo();
 ok(d.cel(1,0,false)===null && pixel(d.cel(2,0,false),10,10)[3]===255 && d.cel(0,0,false)===src, mode+' undo restores all source and destination cels');
 d.history.redo(); ok(pixel(d.cel(4,0,false),13,1)[0]===255, mode+' redo restores generated pixels');
 const rendered=d.flatten(4,{background:false}); ok(pixel(rendered,13,1)[0]===255, mode+' generated cels render for exports');
}
{
 const d=setup(); d.activeCel(true).getContext('2d').fillRect(10,4,1,1); d.addFrame(false); d.addFrame(false); d.setMotionGuide([{x:1,y:1},{x:7,y:1}]);
 ok(d.bakeMotionPath(0,0,2,'linear',true)===null && pixel(d.cel(0,0,false),10,4)[3]===255 && pixel(d.cel(1,0,false),7,4)[3]===255 && pixel(d.cel(2,0,false),4,4)[3]===255, 'reverse path motion follows the guide backwards from source position');
}
{
 const d=setup(); d.activeCel(true).getContext('2d').fillRect(15,15,1,1); d.addFrame(false); d.addFrame(false); d.setMotionGuide([{x:2,y:2},{x:7,y:2},{x:7,y:7}]); d.history.clear();
 ok(d.bakeMotionPath(0,1,2,'linear')===null && pixel(d.cel(1,0,false),15,15)[3]===255 && pixel(d.cel(2,0,false),15,15)[3]===0, 'out of range source is preserved and moving beyond canvas crops pixels');
 d.history.undo(); d.layer().locked=true; ok(!!d.bakeMotionPath(0,0,2,'linear') && !d.cel(1,0,false) && d.history.undoStack.length===0, 'locked layer refuses motion without changes');
 d.layer().locked=false; d.layer().alphaLocked=true; ok(!!d.bakeMotionPath(0,0,2,'linear'), 'alpha-locked layer refuses motion'); d.layer().alphaLocked=false;
 ok(!!d.bakeMotionPath(0,0,0,'linear') && !!d.bakeMotionPath(0,0,2,'bad') && !!d.bakeMotionPath(1,0,2,'linear'), 'invalid range, easing and empty source are rejected');
 d.motionGuide=[{x:1,y:1},{x:1,y:1}]; ok(!!d.bakeMotionPath(0,0,2,'linear'), 'zero-length guide refuses motion');
 d.motionGuide=[{x:1,y:1},{x:2,y:1}]; d.width=4096; d.height=4096; ok(!!d.bakeMotionPath(0,0,2,'linear'), 'motion allocation cap prevents oversized operations');
}
{
 const d=setup(); d.activeCel(true).getContext('2d').fillRect(1,1,1,1); d.addFrame(false); d.setMotionGuide([{x:0,y:0},{x:5,y:0}]); d.history.clear();
 const originalCanvas=Q.canvas; let count=0; Q.canvas=function (...args) { if (++count===2) throw Error('allocation failed'); return originalCanvas(...args); };
 let failed=false; try { d.bakeMotionPath(0,0,1,'linear'); } catch(e) { failed=true; } finally { Q.canvas=originalCanvas; }
 ok(failed && d.cel(1,0,false)===null && d.history.undoStack.length===0 && pixel(d.cel(0,0,false),1,1)[3]===255, 'allocation failure leaves every cel and history untouched');
}

console.log(`all ${n} raster integration checks passed`);
