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


{
 const d=setup(), source=d.activeCel(true), c=source.getContext('2d'); c.fillStyle='#ff0000'; c.fillRect(10,7,2,2);
 d.addLayer(); d.activeCel(true).getContext('2d').fillRect(0,0,2,2); d.activeLayer=0;
 d.addFrame(false); d.addFrame(false); d.frames[1].skipped=true; d.frames[1].duration=4;
 const replaced=d.cel(1,0,true); replaced.getContext('2d').fillRect(0,0,1,1); d.history.clear();
 const a={x:0,y:0,scale:1,angle:0}, b={x:0,y:0,scale:1,angle:180}, pivot={x:8,y:8};
 ok(d.bakeTransform(0,0,2,'linear',a,b,pivot)===null, 'transform bake accepts two poses');
 ok(pixel(d.cel(0,0,false),10,7)[0]===255 && pixel(d.cel(1,0,false),8,10)[0]===255 && pixel(d.cel(2,0,false),5,8)[0]===255, 'transform frames rotate around the chosen pivot with correct intermediate angles');
 ok(d.frames[1].skipped && d.frames[1].duration===4 && pixel(d.cel(0,1,false),0,0)[3]===255 && d.cel(1,1,false)===null, 'transform leaves timing and other layers unchanged');
 ok(d.history.undoStack.length===1 && d.cel(1,0,false)!==replaced, 'transform replaces cels in one history step');
 d.history.undo(); ok(d.cel(0,0,false)===source && d.cel(1,0,false)===replaced && !d.cel(2,0,false), 'transform undo restores original cel identities');
 d.history.redo(); ok(pixel(d.flatten(2,{background:false}),5,8)[0]===255, 'redo and composite export include transformed artwork');
 const png=d.flatten(2,{background:false}).toBuffer('image/png'), decoded=await loadImage(png), verify=createCanvas(16,16); verify.getContext('2d').drawImage(decoded,0,0); ok(pixel(verify,5,8)[0]===255, 'transformed artwork survives real PNG encode and decode');
}
{
 const d=setup(); const src=d.activeCel(true); src.getContext('2d').fillRect(10,7,2,2); d.addFrame(false); d.addFrame(false); d.addFrame(false); d.addFrame(false);
 const a={x:0,y:0,scale:1,angle:0}, b={x:8,y:0,scale:1,angle:0}, p={x:8,y:8};
 ok(d.bakeTransform(0,0,4,'in',a,b,p)===null && pixel(d.cel(1,0,false),10,7)[3]>0 && pixel(d.cel(2,0,false),12,7)[3]===255, 'transform applies ease-in to frame-index interpolation');
 d.history.undo(); b.x=0; b.scale=2; ok(d.bakeTransform(0,0,4,'linear',a,b,p)===null && pixel(d.cel(4,0,false),13,7)[3]===255 && pixel(d.cel(4,0,false),14,8)[3]===255 && pixel(d.cel(4,0,false),10,7)[3]===0, 'scale uses original cel about selected pivot');
 d.history.undo(); b.scale=1; b.angle=360; ok(d.bakeTransform(0,0,4,'linear',a,b,p)===null && pixel(d.cel(2,0,false),5,8)[3]===255 && pixel(d.cel(4,0,false),10,7)[3]===255, 'rotation can intentionally make a full turn');
}
{
 const d=setup(); const src=d.activeCel(true); src.getContext('2d').fillRect(2,2,1,1); d.addFrame(false); d.addFrame(false); d.history.clear();
 const a={x:0,y:0,scale:1,angle:0}, b={x:-1,y:1,scale:1,angle:0}, p={x:0,y:0};
 ok(d.bakeTransform(0,1,2,'linear',a,b,p)===null && d.cel(0,0,false)===src && pixel(d.cel(2,0,false),1,3)[3]===255, 'out-of-range source is preserved and negative offsets work'); d.history.undo();
 d.layer().locked=true; ok(!!d.bakeTransform(0,0,2,'linear',a,b,p), 'locked layer blocks transform'); d.layer().locked=false; d.layer().alphaLocked=true; ok(!!d.bakeTransform(0,0,2,'linear',a,b,p), 'alpha lock blocks transform'); d.layer().alphaLocked=false;
 ok(!!d.bakeTransform(1,0,2,'linear',a,b,p) && !!d.bakeTransform(0,0,0,'linear',a,b,p) && !!d.bakeTransform(0,0,2,'bad',a,b,p), 'empty source, invalid range and invalid easing are rejected');
 for (const bad of [{...a,scale:0},{...a,scale:5},{...a,angle:1441},{...a,x:Infinity},{...a,y:100}]) ok(!!d.bakeTransform(0,0,2,'linear',bad,b,p), 'out-of-bounds or non-finite pose is rejected');
 ok(!!d.bakeTransform(0,0,2,'linear',a,b,{x:-1,y:0}) && !!d.bakeTransform(0,0,2,'linear',a,b,{x:0,y:17}), 'invalid pivot is rejected');
 ok(d.history.undoStack.length===0 && !d.cel(1,0,false), 'rejected transforms do not change pixels or history');
 d.width=4096; d.height=4096; ok(!!d.bakeTransform(0,0,2,'linear',a,b,p), 'transform allocation cap refuses excessive pixel memory');
}
{
 const d=setup(); d.activeCel(true).getContext('2d').fillRect(1,1,1,1); d.addFrame(false); d.history.clear();
 const originalCanvas=Q.canvas; let count=0; Q.canvas=function (...args) { if (++count===2) throw Error('allocation failed'); return originalCanvas(...args); };
 let failed=false; try { d.bakeTransform(0,0,1,'linear',{x:0,y:0,scale:1,angle:0},{x:1,y:0,scale:1,angle:0},{x:8,y:8}); } catch(e) { failed=true; } finally { Q.canvas=originalCanvas; }
 ok(failed && d.cel(1,0,false)===null && d.history.undoStack.length===0 && pixel(d.cel(0,0,false),1,1)[3]===255, 'transform allocation failure is atomic');
}


{
 const d=setup(); for(let i=1;i<5;i++) d.addFrame(false); d.history.clear();
 const first={frame:0,x:8,y:8,zoom:1,angle:0,easing:'in'}, last={frame:4,x:12,y:4,zoom:2,angle:90,easing:'linear'};
 ok(d.setCameraKey(last) && d.setCameraKey(first) && d.cameraEnabled && d.cameraKeys[0].frame===0, 'camera keys are sorted and enable the camera');
 const middle=Q.cameraPose(d,2); ok(middle.x===9 && middle.y===7 && middle.zoom===1.25 && middle.angle===22.5, 'camera interpolates center, zoom and rotation using the earlier key easing');
 ok(Q.cameraPose(d,-1).x===8 && Q.cameraPose(d,10).x===12, 'camera holds first and last pose beyond keys');
 d.frames[1].duration=5; d.frames[1].skipped=true; ok(Q.cameraPose(d,2).x===9, 'camera timing is frame-index based regardless of holds and skips');
 const mid={frame:2,x:4,y:8,zoom:1,angle:-45,easing:'out'}; d.setCameraKey(mid); ok(Q.cameraPose(d,2).x===4 && Q.cameraPose(d,3).x===10, 'camera supports an editable intermediate key and outgoing easing');
 const hist=d.history.undoStack.length; ok(!d.setCameraKey({...mid,x:-1}) && !d.setCameraKey({...mid,zoom:0}) && !d.setCameraKey({...mid,angle:Infinity}) && !d.setCameraKey({...mid,easing:'wrong'}) && !d.setCameraKey({...mid,frame:5}) && d.history.undoStack.length===hist, 'invalid camera settings are rejected without history changes');
 d.removeCameraKey(2); ok(d.cameraKeys.length===2, 'camera key can be removed'); d.history.undo(); ok(d.cameraKeys.length===3 && Q.cameraPose(d,2).x===4, 'camera key removal is undoable');
 d.setCameraEnabled(false); ok(!d.cameraEnabled, 'camera can be disabled non-destructively'); d.history.undo(); ok(d.cameraEnabled, 'camera toggle can be undone');
 d.deleteFrame(4); ok(!d.cameraKeys.some(k=>k.frame===4), 'deleting frames removes keys outside timeline'); d.history.undo(); ok(d.cameraKeys.some(k=>k.frame===4), 'undo restores out-of-range key after frame deletion');
 d.deleteFrameRange(1,4); ok(d.cameraKeys.length===1 && d.cameraKeys[0].frame===0, 'batch frame deletion trims keys outside timeline'); d.history.undo(); ok(d.cameraKeys.length===3, 'batch deletion undo restores camera keys');
}
{
 const d=setup(), src=d.activeCel(true); src.getContext('2d').fillStyle='#ff0000'; src.getContext('2d').fillRect(10,7,2,2);
 const cv=createCanvas(16,16), ctx=cv.getContext('2d'); d.setCameraKey({frame:0,x:10,y:8,zoom:1,angle:0,easing:'linear'});
 d.compositeCamera(ctx,0); ok(pixel(cv,8,7)[0]===255 && pixel(cv,10,7)[3]===0, 'camera output pans artwork without changing pixels');
 ok(pixel(src,10,7)[0]===255 && pixel(d.flatten(0,{background:false}),10,7)[0]===255, 'source cel and PNG flatten ignore camera');
 d.setCameraEnabled(false); ctx.clearRect(0,0,16,16); d.compositeCamera(ctx,0); ok(pixel(cv,10,7)[0]===255 && pixel(cv,8,7)[3]===0, 'disabled camera renders original artwork');
 d.setCameraKey({frame:0,x:8,y:8,zoom:2,angle:0,easing:'linear'}); ctx.clearRect(0,0,16,16); d.compositeCamera(ctx,0);
 ok(pixel(cv,13,7)[0]===255 && pixel(cv,10,7)[3]===0, 'camera zoom renders around chosen center');
 d.setCameraKey({frame:0,x:8,y:8,zoom:1,angle:90,easing:'linear'}); ctx.clearRect(0,0,16,16); d.compositeCamera(ctx,0);
 ok(pixel(cv,8,5)[0]===255, 'camera rotation inversely rotates the artwork about the camera center');
 const canvas=createCanvas(16,16), view=Object.create(Q.View.prototype); Object.assign(view,{doc:d,canvas,ctx:canvas.getContext('2d'),dpr:1,scale:1,rot:0,tx:0,ty:0,stroke:null});
 App.playing=false; view.render(); ok(pixel(canvas,10,7)[0]===255 && pixel(canvas,8,5)[0]===255 && pixel(canvas,8,5)[1]===255, 'editing view remains untransformed');
 App.playing=true; view.render(); ok(pixel(canvas,8,5)[0]===255 && pixel(canvas,8,5)[1]===0 && pixel(canvas,10,7)[1]===255, 'playback view displays camera transform'); App.playing=false;
}
{
 const d=setup(), base=d.activeCel(true); base.getContext('2d').fillRect(10,6,4,4); d.addLayer(); const clipped=d.activeCel(true); clipped.getContext('2d').fillStyle='#ff0000'; clipped.getContext('2d').fillRect(8,4,8,8); d.setLayerClipped(1,true);
 d.setCameraKey({frame:0,x:10,y:8,zoom:1,angle:0,easing:'linear'}); const cv=createCanvas(16,16); d.compositeCamera(cv.getContext('2d'),0);
 ok(pixel(cv,9,7)[0]===255 && pixel(cv,5,7)[3]===0, 'camera preserves non-destructive layer clipping');
}


{
 const d=setup(), c=d.activeCel(true).getContext('2d'); c.fillStyle='#ff0000'; c.fillRect(10,7,2,2); d.addFrame(true); d.setCameraKey({frame:0,x:10,y:8,zoom:1,angle:0,easing:'linear'});
 const oldGif=Q.encodeGif, oldSave=Q.saveBytes; let frames=null; Q.encodeGif=(list)=>{frames=list;return Promise.resolve({dataUrl:'data:image/gif;base64,AA=='});}; Q.saveBytes=()=>true;
 App.exportGif({}); await new Promise(r=>setTimeout(r,20));
 ok(frames && pixel(frames[0],8,7)[0]===255 && pixel(frames[0],8,7)[1]===0 && pixel(frames[0],10,7)[1]===255, 'GIF frame raster actually contains the camera-composited view');
 const sheet=Q.renderSpriteSheet(d,2,1,true); ok(pixel(sheet,10,7)[0]===255 && pixel(sheet,8,7)[3]===0, 'sprite sheet keeps raw source coordinates even with camera enabled');
 Q.encodeGif=oldGif; Q.saveBytes=oldSave;
}


function particleOptions(overrides={}) { return {start:0,end:2,count:1,life:2,seed:1,mode:'burst',shape:'circle',fade:false,x:8,y:8,angle:0,spread:0,speed:0,gravity:0,radius:3,opacity:1,color:'#f00',...overrides}; }
{
 const d=setup(), base=d.activeCel(true); base.getContext('2d').fillStyle='#0000ff'; base.getContext('2d').fillRect(1,1,2,2);
 d.addLayer(); d.activeCel(true).getContext('2d').fillRect(1,1,2,2); d.setLayerClipped(1,true); d.addFrame(false); d.addFrame(false); d.addFrame(false); d.frames[1].skipped=true; d.frames[2].duration=5; d.history.clear();
 const originalBase=d.cel(0,0,false), originalClip=d.cel(0,1,false), layerCount=d.layers.length;
 ok(d.generateParticles(particleOptions())===null && d.layers.length===layerCount+1 && d.activeLayer===2 && d.layer().name==='Particles', 'particle generation adds a topmost ordinary layer');
 ok(d.cel(0,0,false)===originalBase && d.cel(0,1,false)===originalClip && d.layer(1).clipped && d.clipBase(1)===0, 'particles preserve existing cels and clipping base');
 ok(same(pixel(d.cel(0,2,false),8,8),[255,0,0,255]) && pixel(d.cel(1,2,false),8,8)[0]===255 && pixel(d.cel(2,2,false),8,8)[3]===0 && !d.cel(3,2,false), 'particle cels obey life and range and are blank outside range');
 ok(d.frames[1].skipped && d.frames[2].duration===5 && !!d.cel(1,2,false), 'particles include skipped frames without altering frame timing');
 ok(d.history.undoStack.length===1, 'particle layer creation is one undo step'); d.history.undo();
 ok(d.layers.length===2 && d.cel(0,0,false)===originalBase && d.clipBase(1)===0, 'undo removes particle layer and retains original artwork');
 d.history.redo(); ok(d.layers.length===3 && pixel(d.cel(0,2,false),8,8)[0]===255, 'redo restores generated particle pixels');
 const png=d.flatten(0,{background:false}); ok(pixel(png,8,8)[0]===255, 'particles appear in exported composited frames');
}
{
 const d=setup(); d.addFrame(false); d.addFrame(false); d.addFrame(false); d.history.clear();
 const options=particleOptions({start:1,end:3,mode:'continuous',count:3,life:1,shape:'square',fade:false,x:7,y:7,radius:3,color:'00ff00'});
 ok(d.generateParticles(options)===null && !d.cel(0,1,false), 'staggered particles start only in chosen range');
 ok([1,2,3].every(f=>pixel(d.cel(f,1,false),7,7)[1]===255), 'staggered births produce particles on successive frames');
 ok(pixel(d.cel(1,1,false),5,5)[1]===255, 'square particle shape renders with normalised hex colour');
}
{
 const d=setup(); d.addFrame(false); d.addFrame(false); const o=particleOptions({fade:true,life:3,opacity:0.6,radius:4}); d.generateParticles(o);
 const a0=pixel(d.cel(0,1,false),8,8)[3], a1=pixel(d.cel(1,1,false),8,8)[3], a2=pixel(d.cel(2,1,false),8,8)[3];
 ok(a0>a1 && a1>a2 && a2>0, 'particle fade decreases opacity over lifetime');
}
{
 const d=setup(); d.addFrame(false); d.addFrame(false); d.generateParticles(particleOptions({x:3,y:4,speed:3,gravity:2,radius:2,life:3}));
 function center(canvas) { const data=canvas.getContext('2d').getImageData(0,0,16,16).data; let x=0,y=0,w=0; for(let i=0;i<256;i++){const a=data[i*4+3]; x+=(i%16)*a; y+=Math.floor(i/16)*a; w+=a;} return [x/w,y/w]; }
 const a=center(d.cel(0,1,false)), b=center(d.cel(1,1,false)), c=center(d.cel(2,1,false));
 ok(b[0]>a[0]+1 && c[0]>b[0]+1 && c[1]>b[1]+1, 'particle direction, speed and gravity move particles across frames');
 d.history.undo(); d.generateParticles(particleOptions({x:15,y:8,speed:4096,radius:2,life:3}));
 ok(pixel(d.cel(1,1,false),15,8)[3]===0, 'particles moving outside the canvas are cropped');
}
{
 function make(seed) { const d=setup(); for(let i=1;i<4;i++) d.addFrame(false); const o=particleOptions({end:3,seed,count:16,life:4,spread:360,speed:2.5,gravity:0.2,radius:1.5,opacity:0.7}); d.generateParticles(o); return d.cel(3,1,false).getContext('2d').getImageData(0,0,16,16).data; }
 const a=make(77), b=make(77), c=make(78);
 ok(Buffer.from(a).equals(Buffer.from(b)), 'same seed reproduces identical particle pixels');
 ok(!Buffer.from(a).equals(Buffer.from(c)), 'different seeds change particle pattern');
}
{
 const d=setup(); d.addFrame(false); d.addFrame(false); d.history.clear(); const o=particleOptions();
 const bad=[{...o,start:-1},{...o,end:3},{...o,count:0},{...o,count:201},{...o,life:0},{...o,seed:-1},{...o,seed:1.2},{...o,shape:'triangle'},{...o,fade:'yes'},{...o,x:-1},{...o,y:17},{...o,angle:361},{...o,spread:361},{...o,speed:Infinity},{...o,gravity:257},{...o,radius:0},{...o,opacity:0},{...o,color:'not-colour'}];
 ok(bad.every(v=>!!d.generateParticles(v)) && d.layers.length===1 && !d.history.undoStack.length, 'invalid particle options do not change document or history');
 d.width=4096; d.height=4096; ok(!!d.generateParticles(o) && d.layers.length===1, 'particle generation refuses allocations over 64 MiB');
}
{
 const d=setup(); d.addFrame(false); d.addFrame(false); d.history.clear(); const original=Q.canvas; let count=0; Q.canvas=function (...args) { if (++count===2) throw Error('allocation failed'); return original(...args); };
 let failed=false; try { d.generateParticles(particleOptions()); } catch(e) { failed=true; } finally { Q.canvas=original; }
 ok(failed && d.layers.length===1 && d.frames.every(f=>f.cels.length===1) && d.history.undoStack.length===0, 'particle canvas allocation failure is atomic');
}


{
 const d=setup(); for(let i=1;i<5;i++) d.addFrame(false); d.history.clear();
 const a={frame:0,x:0,y:0,scale:1,angle:0,easing:'in'}, b={frame:4,x:8,y:4,scale:2,angle:90,easing:'linear'};
 ok(d.setLayerMotionKey(0,b) && d.setLayerMotionKey(0,a) && d.layer().motionEnabled && d.layer().motionKeys[0].frame===0, 'layer keyframes are sorted and enabled');
 const pose=Q.layerMotionPose(d.layer(),2); ok(pose.x===2 && pose.y===1 && pose.scale===1.25 && pose.angle===22.5, 'layer transform interpolates using outgoing easing');
 ok(Q.layerMotionPose(d.layer(),-1).x===0 && Q.layerMotionPose(d.layer(),5).x===8, 'layer animation holds endpoint poses');
 d.frames[1].duration=6; d.frames[1].skipped=true; ok(Q.layerMotionPose(d.layer(),2).x===2, 'layer interpolation uses frame positions, not skipped frames or holds');
 d.setLayerMotionKey(0,{...b,frame:2,x:3,easing:'out'}); ok(Q.layerMotionPose(d.layer(),3).x===6.75, 'intermediate layer key applies its own easing');
 const n=d.history.undoStack.length; const bad=[{...a,frame:5},{...a,x:100},{...a,y:Infinity},{...a,scale:0},{...a,angle:1441},{...a,easing:'invalid'}];
 ok(bad.every(k=>!d.setLayerMotionKey(0,k)) && d.history.undoStack.length===n, 'invalid layer keys do not change history');
 d.layer().locked=true; ok(!d.setLayerMotionKey(0,a) && !d.removeLayerMotionKey(0,0) && !d.clearLayerMotion(0) && !d.setLayerMotionEnabled(0,false), 'locked layers protect animation keys'); d.layer().locked=false;
 d.setLayerMotionEnabled(0,false); ok(!d.hasLayerMotion() && d.layer().motionKeys.length===3, 'layer animation can be disabled without losing keys'); d.history.undo(); ok(d.hasLayerMotion(), 'layer animation toggle is undoable');
 d.addLayer(0); ok(d.layers.length===2 && d.layer().motionKeys.length===3 && d.layer().motionKeys!==d.layers[0].motionKeys, 'duplicating a layer independently copies motion keys');
 d.setLayerMotionKey(1,{...a,x:7}); ok(d.layer(0).motionKeys[0].x===0, 'editing duplicated track does not change original');
 const length=d.layers.length; d.mergeDown(1); ok(d.layers.length===length, 'merging is blocked when either layer has motion keys');
 d.deleteFrame(4); ok(d.layers.every(l=>!(l.motionKeys || []).some(k=>k.frame===4)), 'deleting frames removes out-of-range layer keys'); d.history.undo(); ok(d.layers.every(l=>l.motionKeys.some(k=>k.frame===4)), 'undo restores trimmed layer keys');
 d.deleteFrameRange(1,4); ok(d.layers.every(l=>l.motionKeys.length===1), 'batch frame deletion trims all layer tracks'); d.history.undo(); ok(d.layers.every(l=>l.motionKeys.length===3), 'undo restores all layer tracks after batch deletion');
}
{
 const d=setup(), cel=d.activeCel(true), c=cel.getContext('2d'); c.fillStyle='#ff0000'; c.fillRect(2,3,2,2); d.addFrame(true); d.addFrame(true);
 d.setLayerMotionKey(0,{frame:0,x:0,y:0,scale:1,angle:0,easing:'linear'}); d.setLayerMotionKey(0,{frame:2,x:4,y:2,scale:1,angle:0,easing:'linear'});
 const cv=createCanvas(16,16); d.compositeCamera(cv.getContext('2d'),1);
 ok(pixel(cv,4,4)[0]===255 && pixel(cv,2,3)[3]===0, 'animation moves only rendered layer pixels');
 ok(pixel(d.cel(1,0,false),2,3)[0]===255 && pixel(d.flatten(1,{background:false}),2,3)[0]===255, 'source cels and PNG flatten are not transformed');
 d.setLayerMotionEnabled(0,false); cv.getContext('2d').clearRect(0,0,16,16); d.compositeCamera(cv.getContext('2d'),1); ok(pixel(cv,2,3)[0]===255, 'disabled layer animation shows original pixels');
 d.setLayerMotionKey(0,{frame:1,x:4,y:0,scale:2,angle:0,easing:'linear'}); cv.getContext('2d').clearRect(0,0,16,16); d.compositeCamera(cv.getContext('2d'),1);
 ok(pixel(cv,1,0)[3]===255, 'layer scale uses the canvas center as pivot and crops off-canvas pixels');
 d.setLayerMotionKey(0,{frame:1,x:0,y:0,scale:1,angle:90,easing:'linear'}); cv.getContext('2d').clearRect(0,0,16,16); d.compositeCamera(cv.getContext('2d'),1); ok(pixel(cv,12,2)[0]===255, 'layer rotation is clockwise around canvas center');
 const screen=createCanvas(16,16), view=Object.create(Q.View.prototype); Object.assign(view,{doc:d,canvas:screen,ctx:screen.getContext('2d'),dpr:1,scale:1,rot:0,tx:0,ty:0,stroke:null});
 d.activeFrame=1; App.playing=false; view.render(); ok(pixel(screen,2,3)[1]===0 && pixel(screen,12,2)[1]===255, 'editing view uses original untransformed layer');
 App.playing=true; view.render(); ok(pixel(screen,12,2)[1]===0 && pixel(screen,2,3)[1]===255, 'playback view displays layer animation'); App.playing=false;
}
{
 const d=setup(); let c=d.activeCel(true).getContext('2d'); c.fillStyle='#0000ff'; c.fillRect(3,4,4,4); d.addLayer(); c=d.activeCel(true).getContext('2d'); c.fillStyle='#ff0000'; c.fillRect(4,4,2,4); d.setLayerClipped(1,true);
 const k={frame:0,x:4,y:0,scale:1,angle:0,easing:'linear'}; d.setLayerMotionKey(0,k); d.setLayerMotionKey(1,k);
 const cv=createCanvas(16,16), ctx=cv.getContext('2d'); d.compositeCamera(ctx,0);
 ok(pixel(cv,8,5)[0]===255 && pixel(cv,7,5)[2]===255 && pixel(cv,4,5)[3]===0, 'animated base and clipped layer move together without losing clip mask');
 d.setLayerMotionKey(1,{...k,x:0}); ctx.clearRect(0,0,16,16); d.compositeCamera(ctx,0);
 ok(pixel(cv,8,5)[2]===255 && pixel(cv,4,5)[3]===0, 'clipped layer uses its independent transform and remains masked by animated base');
 d.setCameraKey({frame:0,x:10,y:8,zoom:1,angle:0,easing:'linear'}); ctx.clearRect(0,0,16,16); d.compositeCamera(ctx,0);
 ok(pixel(cv,6,5)[2]===255 && pixel(cv,4,5)[3]===0, 'camera transform composes after animated layer and clipping');
}
{
 const d=setup(); let c=d.activeCel(true).getContext('2d'); c.fillStyle='#ff0000'; c.fillRect(14,6,2,2);
 d.setLayerMotionKey(0,{frame:0,x:4,y:0,scale:1,angle:0,easing:'linear'}); d.setCameraKey({frame:0,x:12,y:8,zoom:1,angle:0,easing:'linear'});
 const cv=createCanvas(16,16); d.compositeCamera(cv.getContext('2d'),0);
 ok(pixel(cv,14,6)[3]===0, 'layer motion is cropped at canvas before camera moves');
}


{
 const d=setup(), c=d.activeCel(true).getContext('2d'); c.fillStyle='#ff0000'; c.fillRect(2,4,2,2); d.addFrame(true);
 d.setLayerMotionKey(0,{frame:0,x:0,y:0,scale:1,angle:0,easing:'linear'}); d.setLayerMotionKey(0,{frame:1,x:5,y:0,scale:1,angle:0,easing:'linear'});
 let frames; const oldGif=Q.encodeGif, oldSave=Q.saveBytes; Q.encodeGif=list=>{frames=list;return Promise.resolve({dataUrl:'data:image/gif;base64,AA=='});}; Q.saveBytes=()=>true;
 App.exportGif({}); await new Promise(r=>setTimeout(r,20));
 ok(pixel(frames[0],2,4)[0]===255 && pixel(frames[0],2,4)[1]===0 && pixel(frames[1],7,4)[0]===255 && pixel(frames[1],7,4)[1]===0 && pixel(frames[1],2,4)[1]===255, 'GIF captures actual per-layer motion without changing cels');
 const sheet=Q.renderSpriteSheet(d,2,1,true); ok(pixel(sheet,18,4)[0]===255 && pixel(sheet,23,4)[3]===0, 'sprite sheet uses original source pixels for animated layer');
 Q.encodeGif=oldGif; Q.saveBytes=oldSave;
}
{
 const d=setup(); let c=d.activeCel(true).getContext('2d'); c.fillStyle='#0000ff'; c.fillRect(0,0,16,16); d.addLayer(); c=d.activeCel(true).getContext('2d'); c.fillStyle='#ff0000'; c.fillRect(2,4,2,2); d.layer().opacity=0.5;
 d.setLayerMotionKey(1,{frame:0,x:4,y:0,scale:1,angle:0,easing:'linear'});
 const cv=createCanvas(16,16); d.compositeCamera(cv.getContext('2d'),0); const p=pixel(cv,6,4);
 ok(p[0]>=125 && p[0]<=130 && p[2]>=125 && p[2]<=130 && p[3]===255 && pixel(cv,2,4)[2]===255, 'animated layers respect layer opacity and background compositing');
}


{
 const d=setup(); let c=d.activeCel(true).getContext('2d'); c.fillStyle='#00ff00'; c.fillRect(0,0,16,16); d.addLayer(); c=d.activeCel(true).getContext('2d'); c.fillStyle='#ff0000'; c.fillRect(2,4,2,2); d.layer().blend='multiply';
 d.setLayerMotionKey(1,{frame:0,x:4,y:0,scale:1,angle:0,easing:'linear'}); const cv=createCanvas(16,16); d.compositeCamera(cv.getContext('2d'),0);
 ok(same(pixel(cv,6,4),[0,0,0,255]) && same(pixel(cv,2,4),[0,255,0,255]), 'animated layer retains its blend mode at the transformed position');
}


{
 const root={x:4,y:4}, joint={x:8,y:4}, tip={x:12,y:4}, target={x:8,y:8};
 const a=Q.solveTwoBoneIK(root,joint,tip,target,1), b=Q.solveTwoBoneIK(root,joint,tip,target,-1), dist=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y);
 ok(Math.abs(dist(root,a.elbow)-4)<1e-7 && Math.abs(dist(a.elbow,a.end)-4)<1e-7 && dist(a.end,target)<1e-7 && !a.clamped, 'IK solver preserves bone lengths and reaches a reachable target');
 ok(Math.abs(dist(root,b.elbow)-4)<1e-7 && dist(a.elbow,b.elbow)>1 && dist(b.end,target)<1e-7, 'IK bend side chooses the other elbow solution');
 const far=Q.solveTwoBoneIK(root,joint,tip,{x:16,y:16},1); ok(far.clamped && Math.abs(dist(root,far.end)-8)<1e-7 && Math.abs(dist(far.elbow,far.end)-4)<1e-7, 'IK clamps unreachable targets without changing bone lengths');
 const inner=Q.solveTwoBoneIK({x:0,y:0},{x:5,y:0},{x:7,y:0},{x:0,y:0},1); ok(inner.clamped && Math.abs(dist(inner.end,{x:0,y:0})-3)<1e-7 && Math.abs(dist(inner.elbow,inner.end)-2)<1e-7, 'IK clamps targets closer than unequal bone minimum reach');
 const coincident=Q.solveTwoBoneIK(root,joint,{x:4,y:4},root,1); ok(!coincident.clamped && dist(coincident.end,root)<1e-7 && Math.abs(dist(coincident.elbow,root)-4)<1e-7, 'IK handles equal-bone coincident targets without division by zero');
 ok(Q.solveTwoBoneIK(root,root,tip,target,1)===null, 'IK rejects zero-length bones');
}
function ikOptions(overrides={}) { return {upper:0,lower:1,start:0,end:2,root:{x:4,y:4},joint:{x:8,y:4},tip:{x:12,y:4},from:{x:12,y:4},to:{x:8,y:8},bend:1,easing:'linear',...overrides}; }
{
 const d=setup(); const upper=d.activeCel(true); upper.getContext('2d').fillStyle='#ff0000'; upper.getContext('2d').fillRect(4,3,4,2); d.addLayer(); const lower=d.activeCel(true); lower.getContext('2d').fillStyle='#0000ff'; lower.getContext('2d').fillRect(8,3,4,2);
 d.addFrame(true); d.addFrame(true); d.addFrame(true); d.frames[1].skipped=true; d.frames[2].duration=4;
 const existing={frame:3,x:1,y:2,scale:1,angle:5,easing:'out'}; d.setLayerMotionKey(0,existing); d.setLayerMotionKey(1,existing); d.history.clear();
 const o=ikOptions(), plan=d.planTwoBoneIK(o); ok(!plan.error && plan.clamped===0 && d.history.undoStack.length===0, 'IK plan is non-mutating');
 const result=d.applyTwoBoneIK(o); ok(!result.error && d.history.undoStack.length===1 && d.layers.every(l=>l.motionEnabled && l.motionKeys.length===4), 'IK creates both layer tracks in one undo step');
 function transform(k,p) { const a=k.angle*Math.PI/180, dx=p.x-8, dy=p.y-8; return {x:8+k.x+Math.cos(a)*dx-Math.sin(a)*dy,y:8+k.y+Math.sin(a)*dx+Math.cos(a)*dy}; }
 for(let i=0;i<=2;i++) {
   const target={x:12-2*i,y:4+2*i}, expected=Q.solveTwoBoneIK(o.root,o.joint,o.tip,target,1), u=d.layers[0].motionKeys.find(k=>k.frame===i), l=d.layers[1].motionKeys.find(k=>k.frame===i);
   const near=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y)<1e-6;
   ok(near(transform(u,o.root),o.root) && near(transform(u,o.joint),expected.elbow) && near(transform(l,o.joint),expected.elbow) && near(transform(l,o.tip),expected.end), 'IK frame '+i+' connects rigid layers at solved joints');
 }
 ok(d.layers[0].motionKeys.at(-1).frame===3 && d.layers[0].motionKeys.at(-1).x===1 && d.frames[1].skipped && d.frames[2].duration===4, 'IK preserves outside keys, skipped status and holds');
 ok(d.cel(0,0,false)===upper && d.cel(0,1,false)===lower, 'IK does not modify raster cels');
 const cv=createCanvas(16,16); d.compositeCamera(cv.getContext('2d'),2); ok(pixel(cv,4,6)[0]===255 && pixel(cv,6,8)[2]===255, 'generated IK keys actually render both rigid layers at the solved pose');
 d.history.undo(); ok(d.layers.every(l=>l.motionKeys.length===1 && l.motionKeys[0].frame===3), 'one undo restores both pre-existing tracks');
 d.history.redo(); ok(d.layers.every(l=>l.motionKeys.length===4) && d.cel(0,0,false)===upper, 'redo restores generated keys and original cels');
}
{
 const d=setup(); d.addLayer(); d.addFrame(false); d.addFrame(false); d.history.clear(); const o=ikOptions();
 const invalid=[{...o,upper:1},{...o,end:0},{...o,end:3},{...o,bend:0},{...o,easing:'other'},{...o,root:{x:-1,y:1}},{...o,joint:o.root},{...o,to:{x:NaN,y:0}}];
 ok(invalid.every(x=>!!d.applyTwoBoneIK(x).error) && d.history.undoStack.length===0, 'invalid IK settings do not change tracks or history');
 d.layer(0).locked=true; ok(!!d.applyTwoBoneIK(o).error && d.history.undoStack.length===0, 'IK refuses locked layers'); d.layer(0).locked=false;
 const clamped=d.planTwoBoneIK({...o,to:{x:16,y:16},easing:'in'}); ok(!clamped.error && clamped.clamped>0 && clamped.endPose.clamped, 'IK planning reports how many targets exceed reach');
}

{
 const d=setup(); d.addLayer(); for(let i=0;i<4;i++) d.addFrame(false);
 const o=ikOptions({end:4,root:{x:8,y:8},joint:{x:12,y:8},tip:{x:16,y:8},from:{x:2,y:9},to:{x:2,y:7},easing:'in'});
 const p=d.planTwoBoneIK(o), q=d.planTwoBoneIK({...o,easing:'linear'});
 ok(!p.error && p.upper.every((k,i,arr)=>Number.isFinite(k.angle) && (!i || Math.abs(k.angle-arr[i-1].angle)<=180)) && p.lower.every((k,i,arr)=>Number.isFinite(k.angle) && (!i || Math.abs(k.angle-arr[i-1].angle)<=180)), 'IK angles remain finite and continuous across the 180-degree boundary');
 ok(!q.error && Math.abs(p.upper[1].angle-q.upper[1].angle)>0.01, 'IK target easing changes intermediate generated poses');
}
{
 const d=setup(), cel=d.activeCel(true), c=cel.getContext('2d'); c.fillStyle='#112233'; c.fillRect(0,0,16,16); c.fillStyle='#ffffff'; c.fillRect(2,2,8,8); c.fillStyle='#112233'; c.fillRect(6,4,4,4);
 App.fillThreshold=0; App.wandAt(3,3); await new Promise(r=>setTimeout(r,75)); const sel=App.view.selection, m=Q.selectionMask(sel);
 ok(!!sel.runs && m[(3-sel.y)*sel.w+3-sel.x]===1 && m[(5-sel.y)*sel.w+7-sel.x]===0, 'wand selects connected colour and excludes enclosed holes');
 const st=new Q.Stroke(d,pen,[255,0,0],14,1,sel); st.begin({x:6,y:5,pressure:1,t:1}); st.end();
 ok(pixel(cel,3,3)[0]===255 && same(pixel(cel,7,5),[17,34,51,255]), 'brush clips to exact wand mask rather than its bounds'); d.history.undo();
 App.fillAt(3,3,[0,255,0]); await new Promise(r=>setTimeout(r,75)); ok(same(pixel(cel,3,3),[0,255,0,255]) && same(pixel(cel,7,5),[17,34,51,255]), 'colour-drop fill obeys connected wand selection');
 d.history.undo(); ok(same(pixel(cel,3,3),[255,255,255,255]), 'colour-drop fill is undoable');
 App.editSelection('flipH'); ok(d.history.undoStack.length===0 && same(pixel(cel,3,3),[255,255,255,255]), 'wand mask blocks unsupported rectangular transforms');
 App.applyEffect('invert',1); await new Promise(r=>setTimeout(r,75)); ok(same(pixel(cel,3,3),[0,0,0,255]) && same(pixel(cel,7,5),[17,34,51,255]), 'effects use the exact wand mask');
}
{
 const im={width:4,height:1,data:new Uint8ClampedArray([100,100,100,255,108,100,100,255,140,100,100,255,100,100,100,255])};
 const a=Q.floodSelect(im,0,0,0),b=Q.floodSelect(im,0,0,10); ok(a.w===1 && b.w===2, 'wand tolerance includes similar connected colours, not disconnected matches');
 const huge={width:2,height:4097,data:new Uint8ClampedArray(2*4097*4)}; ok(!!Q.floodSelect(huge,0,0,0).error, 'wand rejects selections exceeding its complexity cap');
}
{
 const original=createCanvas(32,32); original.getContext('2d').fillStyle='#fff'; original.getContext('2d').fillRect(15,15,2,2);
 const a=original.getContext('2d').getImageData(0,0,32,32),b=original.getContext('2d').getImageData(0,0,32,32); Q.applyPixelEffect(a,'blur',0.1); Q.applyPixelEffect(b,'blur',0.9);
 ok(a.data[(15*32+15)*4+3]>b.data[(15*32+15)*4+3] && b.data[(15*32+21)*4+3]>a.data[(15*32+21)*4+3], 'blur strength changes spread and intensity');
}
{
 globalThis.requestAnimationFrame=()=>{}; Q.hint=()=>{}; Q.haptic=()=>{};
 const cv=createCanvas(100,100); cv.getBoundingClientRect=()=>({left:0,top:0,width:100,height:100}); cv.addEventListener=()=>{}; cv.setPointerCapture=()=>{};
 const view=new Q.View(cv),d=new Q.Doc({width:100,height:100}); view.doc=d; view.brush=pen; view.size=2; view.color=[255,0,0]; view.onDocChange=()=>{}; view.scale=1;view.tx=0;view.ty=0;
 const ev=(type,id,x,y,pointerType='pen')=>({type,pointerId:id,clientX:x,clientY:y,pointerType,pressure:1,timeStamp:Date.now()});
 view._down(ev('pointerdown',1,50,30)); for(let i=1;i<=72;i++) {const a=i*Math.PI*2/72;view._move(ev('pointermove',1,40+10*Math.cos(a),30+10*Math.sin(a)));} view._disarmHold(); view._quickShape();
 ok(view.quickShape && view.quickShape.closed && view.quickShape.circle && view.quickShape.box.w===view.quickShape.box.h && d.history.undoStack.length===0, 'closed held stroke becomes an uncommitted ellipse preview');
 view._down(ev('pointerdown',2,50,50,'touch')); view._move(ev('pointermove',2,60,55,'touch'));
 ok(Math.abs(view.quickShape.box.x-40)<1 && Math.abs(view.quickShape.box.y-25)<1 && !view.g, 'second finger moves snapped stylus ellipse without starting pinch');
 view._up(ev('pointerup',1,50,30)); view._up(ev('pointerup',2,60,55,'touch'));
 const cel=d.activeCel(false); ok(!view.quickShape && d.history.undoStack.length===1 && pixel(cel,50,25)[3]>0 && pixel(cel,40,15)[3]===0, 'lifting first pointer commits moved ellipse once at adjusted location');
 const image=cel.getContext('2d').getImageData(0,0,100,100); Q.floodFill(image,50,35,[0,0,255],0,false); ok(image.data[(35*100+50)*4+2]===255 && image.data[(0*100+0)*4+3]===0, 'snapped ellipse encloses a fillable region');
 d.history.undo(); ok(pixel(cel,50,25)[3]===0, 'quickshape undo removes the entire committed shape');
 view._down(ev('pointerdown',3,10,10)); view._move(ev('pointermove',3,40,10)); view._disarmHold(); view._quickShape(); view._up(ev('pointercancel',3,40,10)); ok(!view.quickShape && d.history.undoStack.length===0 && pixel(cel,15,10)[3]===0, 'cancelled quickshape does not commit pixels or history');
}

{
 const d=setup(); const c0=d.activeCel(true); c0.getContext('2d').fillStyle='#ff0000'; c0.getContext('2d').fillRect(0,0,16,16);
 d.addLayer(); const c1=d.activeCel(true); c1.getContext('2d').fillStyle='#0000ff'; c1.getContext('2d').fillRect(0,0,8,16);
 d.addLayer(); d.layer(2).visible=false; d.history.clear(); const ids=d.layers.map(l=>l.id);
 d.toggleSolo(1); ok(d.layers.map(l=>l.visible).join(',')==='false,true,false' && d.solo.target===ids[1] && d.history.undoStack.length===1, 'solo hides other layers in one history entry');
 let rendered=createCanvas(16,16); d.composite(rendered.getContext('2d'),0); ok(same(pixel(rendered,3,3),[0,0,255,255]) && pixel(rendered,12,3)[3]===0,'solo changes the real composite');
 d.history.undo(); ok(d.layers.map(l=>l.visible).join(',')==='true,true,false' && !d.solo,'undo restores pre-solo visibility and state');
 d.history.redo(); ok(d.layers.map(l=>l.visible).join(',')==='false,true,false' && d.solo.target===ids[1],'redo restores solo and state');
 d.toggleSolo(0); ok(d.layers.map(l=>l.visible).join(',')==='true,false,false','switching solo layers preserves original visibility snapshot');
 d.moveLayer(0,1); d.restoreSolo(); ok(d.layers.find(l=>l.id===ids[0]).visible && d.layers.find(l=>l.id===ids[1]).visible && !d.layers.find(l=>l.id===ids[2]).visible,'restore follows layer identity after reordering');
 d.history.undo(); ok(!!d.solo && d.layers.find(l=>l.id===ids[0]).visible,'undo restore reinstates solo state');
 d.addLayer(); const added=d.layer().id; d.restoreSolo(); ok(d.layers.find(l=>l.id===added).visible && d.layers.find(l=>l.id===ids[1]).visible, 'restore leaves newly added layers untouched and restores original layers');
}
{
 const d=setup(); d.activeCel(true).getContext('2d').fillRect(0,0,10,10); d.addLayer(); d.activeCel(true).getContext('2d').fillRect(0,0,5,5); d.setLayerClipped(1,true); d.history.clear();
 d.toggleSolo(1); ok(d.layer(0).visible && d.layer(1).visible, 'soloing clipped layer also keeps its base visible');
 const cv=createCanvas(16,16); d.composite(cv.getContext('2d'),0); ok(pixel(cv,2,2)[3]===255,'clipped layer remains compositable while soloed');
 d.restoreSolo(); ok(!d.solo && d.history.undoStack.length===2,'clipped solo can be restored');
}
{
 const d=setup(), cel=d.activeCel(true); cel.getContext('2d').fillStyle='#ff0000';cel.getContext('2d').fillRect(0,0,16,16);
 const source={...pen,flow:0.5,pressureSize:0.7,spacing:0.3}, clone={...source,eraser:true,syncedEraser:true};
 const stroke=new Q.Stroke(d,clone,[255,0,0],8,0.6,{x:0,y:0,w:8,h:16}); stroke.begin({x:6,y:8,pressure:1,t:1});stroke.end();
 ok(pixel(cel,6,8)[3]<255 && pixel(cel,9,8)[3]===255 && !source.eraser,'matched eraser uses brush flow and respects selection without mutating the paint preset');
 d.history.undo(); ok(pixel(cel,6,8)[3]===255,'matched eraser is undoable');
}

{
 const v=Object.create(Q.View.prototype); v.globalPressure=1;
 const event={pointerType:'pen',pressure:0.25}; ok(Math.abs(v._pressure(event)-0.25)<1e-7,'neutral global pressure preserves pen input');
 v.globalPressure=0.5; const soft=v._pressure(event); v.globalPressure=2; const hard=v._pressure(event);
 ok(Math.abs(soft-0.5)<1e-7 && Math.abs(hard-0.0625)<1e-7 && v._pressure({pointerType:'touch',pressure:0.2})===1,'global pressure curve adjusts stylus but not finger');
 const brush={...pen,pressureSize:1,streamline:0}, make=p=>{ const d=setup(), st=new Q.Stroke(d,brush,[255,0,0],12,1,null); st.begin({x:8,y:8,pressure:p,t:1}); st.end(); return d.activeCel(false); };
 const light=make(soft), firm=make(hard); ok(pixel(light,10,8)[3]>pixel(firm,10,8)[3], 'global pressure changes raster footprint for a pressure-sensitive brush');
 const d=setup(), a=new Q.Stroke(d,brush,[0,0,0],2,1,null,0),b=new Q.Stroke(d,brush,[0,0,0],2,1,null,0.5);
 a.begin({x:0,y:0,pressure:1,t:1}); a.add({x:10,y:0,pressure:1,t:2}); a.cancel();
 b.begin({x:0,y:0,pressure:1,t:1}); b.add({x:10,y:0,pressure:1,t:2}); b.cancel();
 ok(a.sx===10 && b.sx===5 && brush.streamline===0,'global smoothing changes stroke tracking without modifying brush presets');
}
{
 const d=setup(), input=createCanvas(4,2); input.getContext('2d').fillStyle='#1234ef';input.getContext('2d').fillRect(0,0,4,2);
 const f={name:'ref.png',type:'image/png',size:100,data:input.toDataURL('image/png')}, target={doc:d,token:1}; let selected=null, token=1, delay=0;
 Q.UI.isReferenceTarget=t=>App.doc===t.doc && t.token===token; Q.UI.setReferenceImage=(t,cv)=>{if(Q.UI.isReferenceTarget(t)) selected=cv;};
 globalThis.Image=NativeImage; globalThis.FileReader=class {readAsDataURL(file){this.result=file.data; setTimeout(()=>this.onload(),delay);}};
 const before=d.history.undoStack.length; App.loadReferenceFile(f,target); await new Promise(r=>setTimeout(r,70));
 ok(selected && same(pixel(selected,1,1),[18,52,239,255]) && d.layers.length===1 && !d.activeCel(false) && d.history.undoStack.length===before, 'external reference preserves real image pixels without changing the artwork');
 const exportCanvas=d.flatten(0,{background:false}); ok(pixel(exportCanvas,1,1)[3]===0,'external reference is excluded from exported artwork');
 selected=null; App.loadReferenceFile({...f,type:'application/pdf'},target); App.loadReferenceFile({...f,size:17*1024*1024},target); await new Promise(r=>setTimeout(r,40)); ok(!selected,'reference rejects unsupported and oversized files');
 const huge=createCanvas(8193,1); App.loadReferenceFile({...f,data:huge.toDataURL('image/png')},target); await new Promise(r=>setTimeout(r,50)); ok(!selected,'reference rejects excessive decoded dimensions');
 delay=30; App.loadReferenceFile(f,target); token++; await new Promise(r=>setTimeout(r,100)); ok(!selected,'stale reference picker results cannot replace a newer reference');
}


function precisionTarget(d) { const sel=App.view.selection; return {doc:d,frame:d.frames[d.activeFrame],layer:d.layer(),cel:d.activeCel(false),selection:sel,src:sel ? {x:sel.x,y:sel.y,w:sel.w,h:sel.h} : {x:0,y:0,w:d.width,h:d.height}}; }
function precisionOptions(opts={}) { return {width:2,height:4,dx:0,dy:0,angle:90,resampling:'nearest',...opts}; }
{
 const src={x:4,y:4,w:2,h:4}, p=Q.planPreciseTransform(src,16,16,precisionOptions());
 ok(!p.error && p.bounds.x===3 && p.bounds.y===5 && p.bounds.w===4 && p.bounds.h===2 && !p.clipped,'precision geometry calculates exact cardinal-rotation bounds');
 const off=Q.planPreciseTransform(src,16,16,precisionOptions({dx:15,angle:45})); ok(!off.error && off.clipped && off.rect.w<=16,'precision geometry reports off-canvas cropping');
 const invalid=[{width:0},{height:2.5},{dx:33},{dy:NaN},{angle:361},{angle:Infinity},{resampling:'bad'}];
 ok(invalid.every(o=>Q.planPreciseTransform(src,16,16,precisionOptions(o)).error),'precision geometry rejects invalid sizes, offsets, angles and sampling');
 ok(Q.planPreciseTransform(src,16,16,precisionOptions({angle:360})).unchanged,'full-turn identity is recognised as unchanged');
 ok(!!Q.planPreciseTransform({x:0,y:0,w:4096,h:4096},4096,4096,precisionOptions({width:4096,height:4096})).error,'precision geometry enforces temporary allocation cap');
}
{
 const d=setup(),cel=d.activeCel(true),c=cel.getContext('2d'); c.fillStyle='#ff0000';c.fillRect(4,4,2,2);c.fillStyle='#0000ff';c.fillRect(4,6,2,2); c.fillStyle='#00ff00';c.fillRect(12,12,1,1);
 d.addFrame(false); d.activeFrame=0; App.view.selection={x:4,y:4,w:2,h:4};d.history.clear(); const t=precisionTarget(d),r=App.preciseTransform(precisionOptions(),t);
 ok(!r.error && same(pixel(cel,6,5),[255,0,0,255]) && same(pixel(cel,3,5),[0,0,255,255]),'90 degree precise rotation produces correct clockwise coloured pixels');
 ok(pixel(cel,4,4)[3]===0 && same(pixel(cel,12,12),[0,255,0,255]) && d.history.undoStack.length===1,'precision transform clears the source and preserves unrelated pixels in one undo step');
 const exported=d.flatten(0,{background:false});ok(same(pixel(exported,6,5),[255,0,0,255]) && !d.cel(1,0,false),'precise pixels appear in exports and other frames remain untouched');
 ok(App.view.selection.x===3 && App.view.selection.y===5 && App.view.selection.w===4 && App.view.selection.h===2,'rotated selection becomes its axis-aligned bounding rectangle');
 d.history.undo();ok(same(pixel(cel,4,4),[255,0,0,255]) && same(pixel(cel,4,7),[0,0,255,255]) && pixel(cel,3,5)[3]===0,'precision transform undo restores exact original pixels');
 d.history.redo();ok(same(pixel(cel,6,5),[255,0,0,255]) && same(pixel(cel,3,5),[0,0,255,255]),'precision transform redo restores transformed pixels');
}
{
 const d=setup(),cel=d.activeCel(true),c=cel.getContext('2d'); c.fillStyle='#ff0000';c.fillRect(4,4,2,4); App.view.selection={x:4,y:4,w:2,h:4};d.history.clear();
 const result=App.preciseTransform(precisionOptions({width:4,height:2,dx:3,dy:1,angle:0}),precisionTarget(d));
 ok(!result.error && same(pixel(cel,6,6),[255,0,0,255]) && same(pixel(cel,9,7),[255,0,0,255]) && pixel(cel,10,7)[3]===0,'precision resize uses requested independent width and height and centre offset');
 d.history.undo(); App.view.selection={x:4,y:4,w:2,h:4}; const off=App.preciseTransform(precisionOptions({dx:-5,angle:0}),precisionTarget(d));
 ok(!off.error && off.clipped && pixel(cel,4,4)[3]===0 && d.history.undoStack.length===1,'off-canvas precision transform crops pixels but remains undoable'); d.history.undo(); ok(pixel(cel,4,4)[3]===255,'undo restores pixels cropped by the precise transform');
}
{
 const d=setup(),cel=d.activeCel(true);cel.getContext('2d').fillRect(4,4,2,4);App.view.selection={x:4,y:4,w:2,h:4};d.history.clear();const t=precisionTarget(d), original=Q.canvas;
 let calls=0; Q.canvas=(w,h)=>{if(++calls===2) throw Error('allocation');return original(w,h);}; const r=App.preciseTransform(precisionOptions(),t); Q.canvas=original;
 ok(!!r.error && d.history.undoStack.length===0 && pixel(cel,4,4)[3]===255,'failed precision allocation leaves pixels and history unchanged');
 App.view.locked=true;ok(!!App.preciseTransform(precisionOptions(),t).error && d.history.undoStack.length===0,'precision transform refuses to run during another operation');App.view.locked=false;
 d.layer().locked=true;ok(!!App.preciseTransform(precisionOptions(),t).error && d.history.undoStack.length===0,'precision transform respects layer lock');d.layer().locked=false; d.layer().alphaLocked=true;ok(!!App.preciseTransform(precisionOptions(),t).error,'precision transform respects alpha lock');d.layer().alphaLocked=false;
 App.view.selection={x:4,y:4,w:2,h:4,points:[{x:4,y:4},{x:6,y:4},{x:4,y:8}]};ok(!!App.preciseTransform(precisionOptions(),precisionTarget(d)).error,'precision transform refuses non-rectangular masks');
 App.view.selection={x:4,y:4,w:2,h:4};const stale=precisionTarget(d);App.view.selection.x=3;ok(!!App.preciseTransform(precisionOptions(),stale).error && d.history.undoStack.length===0,'precision transform refuses stale selection geometry');
}


{
 const d=setup(),cel=d.activeCel(true),c=cel.getContext('2d'); c.fillStyle='#ff0000';c.fillRect(2,2,4,4);c.fillStyle='#0000ff';c.fillRect(12,12,2,2);
 d.addFrame(false);d.activeFrame=0;App.view.selection={x:2,y:2,w:4,h:4};d.history.clear();App.clipboard=null;
 const result=App.copyOrCut(false); ok(!result.error && App.clipboard.x===2 && App.clipboard.w===4 && same(pixel(App.clipboard.canvas,1,1),[255,0,0,255]) && d.history.undoStack.length===0,'copy stores selected active-layer pixels without altering history');
 const paste=App.pasteClipboard(); ok(!paste.error && d.layers.length===2 && d.activeLayer===1 && same(pixel(d.activeCel(false),3,3),[255,0,0,255]) && pixel(d.activeCel(false),12,12)[3]===0 && !d.cel(1,1,false),'paste creates a top layer only on current frame at original coordinates');
 const flat=d.flatten(0,{background:false});ok(same(pixel(flat,3,3),[255,0,0,255]) && same(pixel(flat,12,12),[0,0,255,255]),'pasted pixels appear in exports without changing underlying artwork');
 d.history.undo();ok(d.layers.length===1 && !!App.clipboard,'undo paste removes new layer but keeps clipboard'); d.history.redo();ok(d.layers.length===2 && same(pixel(d.activeCel(false),3,3),[255,0,0,255]),'redo paste restores pixels');
}
{
 const d=setup(),cel=d.activeCel(true),c=cel.getContext('2d'); c.fillStyle='#00ff00';c.fillRect(0,0,16,16);
 App.view.selection={x:2,y:2,w:8,h:8,points:[{x:2,y:2},{x:10,y:2},{x:2,y:10}]}; d.history.clear();const r=App.copyOrCut(true);
 ok(!r.error && pixel(cel,3,3)[3]===0 && pixel(cel,8,8)[1]===255 && pixel(App.clipboard.canvas,1,1)[1]===255 && pixel(App.clipboard.canvas,6,6)[3]===0,'cut follows the lasso mask rather than its bounding box');
 ok(d.history.undoStack.length===1,'cut is a single pixel history entry');d.history.undo();ok(pixel(cel,3,3)[1]===255 && !!App.clipboard,'undo cut restores pixels but leaves clipboard intact');
 d.history.redo();ok(pixel(cel,3,3)[3]===0,'redo cut restores removed region');
}
{
 const d=setup(),cel=d.activeCel(true),c=cel.getContext('2d');c.fillStyle='#123456';c.fillRect(0,0,16,16);c.fillStyle='#fff';c.fillRect(2,2,6,6);c.fillStyle='#123456';c.fillRect(4,4,2,2);
 App.fillThreshold=0;App.wandAt(3,3);await new Promise(r=>setTimeout(r,70));const r=App.copyOrCut(true);
 ok(!r.error && pixel(cel,3,3)[3]===0 && same(pixel(cel,4,4),[18,52,86,255]) && pixel(App.clipboard.canvas,2,2)[3]===0,'wand cut and copy preserve holes in the selected mask');
}
{
 const d=setup(),cel=d.activeCel(true),c=cel.getContext('2d');c.fillStyle='#abcdef';c.fillRect(0,0,16,16);App.view.selection={x:10,y:10,w:6,h:6};App.clipboard=null;d.history.clear();
 d.layer().locked=true;ok(!!App.copyOrCut(true).error && !App.clipboard && d.history.undoStack.length===0,'cut refuses locked layers without replacing clipboard');ok(!App.copyOrCut(false).error,'copy is permitted from locked layers');
 d.layer().locked=false;d.layer().alphaLocked=true;const saved=App.clipboard;ok(!!App.copyOrCut(true).error && App.clipboard===saved,'cut refuses alpha-locked layers and retains existing clipboard'); d.layer().alphaLocked=false;
 const canvasFn=Q.canvas; let calls=0;Q.canvas=(w,h)=>{if(++calls===2) throw Error('allocation');return canvasFn(w,h);};const r=App.copyOrCut(true);Q.canvas=canvasFn;
 ok(!!r.error && App.clipboard===saved && same(pixel(cel,10,10),[171,205,239,255]) && d.history.undoStack.length===0,'failed cut allocation does not change pixels, clipboard or history');
 const other=new Q.Doc({width:12,height:12});App.doc=other;App.view={selection:null,color:[0,0,0],dirty:false};const pasted=App.pasteClipboard();ok(!pasted.error && pasted.cropped && same(pixel(other.activeCel(false),10,10),[171,205,239,255]),'cross-document paste crops at smaller canvas bounds');
 const tiny=new Q.Doc({width:8,height:8});App.doc=tiny;ok(!!App.pasteClipboard().error && tiny.layers.length===1,'fully off-canvas clipboard is rejected without adding a layer');
 const currentClipboard=App.clipboard; const otherCanvas=Q.canvas; Q.canvas=()=>{throw Error('allocation');};App.doc=other;const failedPaste=App.pasteClipboard();Q.canvas=otherCanvas;ok(!!failedPaste.error && other.layers.length===2 && App.clipboard===currentClipboard,'paste allocation failure preserves document and clipboard');
 App.clearClipboard();ok(!App.clipboard && !!App.pasteClipboard().error,'clearing clipboard releases content');
}

{
 const d=new Q.Doc({width:4096,height:4096}); d.frames[0].cels[0]={}; App.doc=d;App.view={selection:null,locked:false}; App.clipboard={sentinel:true};
 ok(!!App.copyOrCut(false).error && !!App.copyOrCut(true).error && App.clipboard.sentinel && d.history.undoStack.length===0,'oversized copy and cut are refused before allocations or edits');
}

console.log(`all ${n} raster integration checks passed`);
