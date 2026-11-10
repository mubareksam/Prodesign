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

{
 const d=setup(), first=d.activeCel(true), c=first.getContext('2d'); c.fillStyle='#ff0000'; c.fillRect(1,1,4,4);
 d.addFrame(false); const second=d.activeCel(true); second.getContext('2d').fillRect(2,2,4,4); d.history.clear(); d.activeFrame=0;
 App.view.selection={x:1,y:1,w:1,h:1}; ok(App.clearCurrentCel() && d.activeCel(false)===null && d.cel(1,0,false)===second && pixel(second,2,2)[3]===255, 'clear cel ignores selection and leaves other frames untouched');
 ok(d.history.undoStack.length===1,'clear cel creates one history entry'); d.history.undo(); ok(d.activeCel(false)===first && pixel(first,1,1)[0]===255 && pixel(first,3,3)[0]===255, 'undo restores entire original cel');
 d.history.redo(); ok(d.activeCel(false)===null && d.cel(1,0,false)===second, 'redo clears current cel only');
 ok(!d.clearCurrentCel() && d.history.undoStack.length===1, 'already unallocated cel does not create history'); d.history.undo();
 for (const flag of ['locked','alphaLocked']) { d.layer()[flag]=true; ok(!d.clearCurrentCel() && d.activeCel(false)===first,flag+' blocks clear cel'); d.layer()[flag]=false; }
 d.layer().visible=false; ok(!d.clearCurrentCel() && d.activeCel(false)===first,'hidden layer blocks clear cel');
}

{
 function target(d) { const s=App.view.selection; return {doc:d,frame:d.frames[d.activeFrame],layer:d.layer(),cel:d.activeCel(false),selection:s,bounds:s ? {x:s.x,y:s.y,w:s.w,h:s.h} : {x:0,y:0,w:d.width,h:d.height},undo:d.history.undoStack.slice(),redo:d.history.redoStack.slice()}; }
 const d=setup(), cel=d.activeCel(true), c=cel.getContext('2d');
 c.fillStyle='#ff0000'; c.fillRect(1,1,2,2); c.fillRect(12,12,2,2); c.fillStyle='#f50000'; c.fillRect(6,6,2,2); c.fillStyle='rgba(255,0,0,0.5)'; c.fillRect(3,8,2,2); c.fillStyle='#0000ff'; c.fillRect(9,1,2,2);
 const alphaBefore=pixel(cel,3,8)[3]; d.addFrame(false); const other=d.activeCel(true); other.getContext('2d').fillRect(1,1,1,1); d.activeFrame=0; d.history.clear();
 ok(App.recolorMatching(target(d),[255,0,0],[0,255,0],10).started,'recolour starts on active cel'); await new Promise(r=>setTimeout(r,70));
 ok(same(pixel(cel,1,1),[0,255,0,255]) && same(pixel(cel,12,12),[0,255,0,255]) && same(pixel(cel,6,6),[0,255,0,255]),'recolour matches disconnected and tolerance-bound pixels');
 ok(pixel(cel,3,8)[1]===255 && pixel(cel,3,8)[3]===alphaBefore && pixel(cel,0,0)[3]===0 && pixel(cel,9,1)[2]===255,'recolour preserves alpha, transparency and unmatched colours');
 ok(pixel(other,1,1)[3]===255 && d.history.undoStack.length===1,'other frames remain untouched and recolour is one undo step');
 d.history.undo(); ok(pixel(cel,1,1)[0]===255 && pixel(cel,3,8)[3]===alphaBefore && pixel(cel,6,6)[0]===245, 'undo restores matching pixels and alpha'); d.history.redo(); ok(pixel(cel,1,1)[1]===255 && pixel(cel,3,8)[3]===alphaBefore,'redo reapplies recolour'); d.history.undo(); d.history.clear();
 App.view.selection={x:0,y:0,w:5,h:5}; App.recolorMatching(target(d),[255,0,0],[0,0,255],0); await new Promise(r=>setTimeout(r,70));
 ok(pixel(cel,1,1)[2]===255 && pixel(cel,12,12)[0]===255 && pixel(cel,3,8)[0]===255,'rectangular selection restricts recolour'); d.history.undo(); d.history.clear();
 App.view.selection={x:0,y:0,w:16,h:16,runs:[{x:1,y:1,w:1},{x:12,y:12,w:1}]}; App.recolorMatching(target(d),[255,0,0],[0,255,0],0); await new Promise(r=>setTimeout(r,70));
 ok(pixel(cel,1,1)[1]===255 && pixel(cel,12,12)[1]===255 && pixel(cel,2,1)[0]===255, 'wand mask limits recolour exactly'); d.history.undo(); d.history.clear();
 App.view.selection={x:0,y:0,w:5,h:5,points:[{x:0,y:0},{x:5,y:0},{x:0,y:5}]}; App.recolorMatching(target(d),[255,0,0],[0,255,0],0); await new Promise(r=>setTimeout(r,70));
 ok(pixel(cel,1,1)[1]===255 && pixel(cel,12,12)[0]===255,'lasso mask limits recolour'); d.history.undo(); d.history.clear(); App.view.selection=null;
 d.layer().alphaLocked=true; App.recolorMatching(target(d),[255,0,0],[0,255,0],0); await new Promise(r=>setTimeout(r,70)); ok(pixel(cel,3,8)[3]===alphaBefore && pixel(cel,3,8)[1]===255,'recolour works with alpha lock while retaining alpha'); d.history.undo(); d.history.clear(); d.layer().alphaLocked=false;
 d.layer().locked=true; ok(!!App.recolorMatching(target(d),[255,0,0],[0,255,0],0).error && d.history.undoStack.length===0,'locked layer rejects recolour'); d.layer().locked=false; d.layer().visible=false; ok(!!App.recolorMatching(target(d),[255,0,0],[0,255,0],0).error,'hidden layer rejects recolour'); d.layer().visible=true;
 App.recolorMatching(target(d),[1,2,3],[0,255,0],0); await new Promise(r=>setTimeout(r,70)); ok(d.history.undoStack.length===0,'no match does not create history');
 const oldSnapGet=d.history.snapCtx.getImageData; d.history.snapCtx.getImageData=()=>{throw Error('out of memory');}; App.recolorMatching(target(d),[255,0,0],[0,255,0],0); await new Promise(r=>setTimeout(r,70)); d.history.snapCtx.getImageData=oldSnapGet; ok(pixel(cel,1,1)[0]===255 && d.history.undoStack.length===0 && !App.view.locked,'undo allocation failure leaves pixels and history unchanged');
 const stale=target(d); App.recolorMatching(stale,[255,0,0],[0,255,0],0); d.activeFrame=1; await new Promise(r=>setTimeout(r,70)); ok(pixel(cel,1,1)[0]===255 && d.history.undoStack.length===0 && !App.view.locked,'stale frame cancels asynchronous recolour safely'); d.activeFrame=0;
 const large={...target(d),bounds:{x:0,y:0,w:4096,h:4096}}; const ow=d.width,oh=d.height; d.width=4096; d.height=4096; ok(App.validateRecolor(large,[0,0,0],[255,0,0],0).error.includes('64 MiB'),'oversized recolour is refused before allocation'); d.width=ow; d.height=oh;
}

console.log('4.7 inverted selections and transparency preview');
{
 const d=setup(), cel=d.activeCel(true), rect={x:4,y:4,w:8,h:8}; let result=Q.invertSelection(rect,16,16);
 ok(!!result.selection && result.selection.runs.length===24,'rectangle inversion produces a bounded run mask');
 App.view.selection=result.selection; App.view.color=[255,0,0]; App.editSelection('fill');
 ok(pixel(cel,2,2)[0]===255 && pixel(cel,4,4)[3]===0 && pixel(cel,15,15)[0]===255,'fill affects the complement and preserves the original rectangle');
 d.history.undo(); ok(pixel(cel,2,2)[3]===0,'inverted selection fill undoes normally');
 const stroke=new Q.Stroke(d,pen,[0,0,255],10,1,App.view.selection); stroke.begin({x:4,y:8,pressure:1,t:1}); stroke.end();
 ok(pixel(cel,3,8)[2]===255 && pixel(cel,4,8)[3]===0,'brush strokes clip against the inverted mask'); d.history.undo();

 result=Q.invertSelection(result.selection,16,16); const double=Q.selectionMask(result.selection);
 ok(result.selection.x===4 && result.selection.y===4 && result.selection.w===8 && result.selection.h===8 && double.every(v=>v===1),'double inversion restores the selected pixels');
 const wand={x:1,y:1,w:4,h:2,runs:[{x:1,y:1,w:2},{x:4,y:2,w:1}]}, inv=Q.invertSelection(wand,16,16).selection, im=Q.selectionMask(inv);
 ok(im[1*inv.w+1]===0 && im[2*inv.w+4]===0 && im[1*inv.w+3]===1,'wand inversion preserves nonrectangular pixel mask');
 const lasso={x:1,y:1,w:6,h:6,points:[{x:1,y:1},{x:7,y:1},{x:1,y:7}]}, lm=Q.selectionMask(lasso), linv=Q.invertSelection(lasso,16,16).selection, lim=Q.selectionMask(linv);
 let consistent=true; for(let y=1;y<7;y++) for(let x=1;x<7;x++) if(lim[y*linv.w+x]===lm[(y-1)*6+x-1]) consistent=false;
 ok(consistent,'lasso inversion uses the same hard mask as editing');
 ok(!!Q.invertSelection(null,16,16).error && !!Q.invertSelection({x:0,y:0,w:16,h:16},16,16).error,'missing and fully selected canvases reject inversion instead of treating empty as all');
 ok(!!Q.invertSelection({x:1,y:0,w:1,h:4096},3,4096).error,'excessive run counts are rejected');
 ok(!!Q.invertSelection({x:0,y:0,w:2049,h:2049,runs:[]},4096,4096).error,'oversized canvases are rejected before allocation');
}
{
 const d=setup(), cel=d.activeCel(true), c=cel.getContext('2d'); c.fillStyle='#ff0000'; c.fillRect(20,20,2,2); c.fillRect(4,4,2,2);
 const out=createCanvas(16,16), view=Object.create(Q.View.prototype); Object.assign(view,{canvas:out,ctx:out.getContext('2d'),doc:d,dpr:1,scale:1,rot:0,tx:0,ty:0,stroke:null,transparentPreview:false,selection:null,selectionDraft:null,motionDraft:null});
 view.render(); ok(same(pixel(out,10,10),[255,255,255,255]),'normal canvas renders the document background');
 view.transparentPreview=true; view.render(); ok(same(pixel(out,10,10),[187,187,187,255]) && pixel(out,4,4)[0]===255 && pixel(out,4,4)[1]===0,'transparency preview shows checker beneath artwork');
 ok(same(pixel(d.flatten(0,{background:d.bg}),10,10),[255,255,255,255]) && pixel(d.flatten(0,{background:false}),10,10)[3]===0,'checker preview does not alter normal or transparent exports');
}

console.log('4.8 smudge, gradient and brush previews');
{
 const d=setup(), cel=d.activeCel(true), ctx=cel.getContext('2d'); ctx.fillStyle='#ff0000'; ctx.fillRect(2,4,4,8); d.history.clear();
 const stroke=new Q.SmudgeStroke(d,6,1,null); stroke.begin({x:4,y:8}); stroke.add({x:11,y:8}); stroke.end();
 ok(pixel(cel,9,8)[0]>200 && pixel(cel,9,8)[3]>0 && d.history.undoStack.length===1,'smudge pulls existing pixels and records one undo');
 d.history.undo(); ok(pixel(cel,9,8)[3]===0 && pixel(cel,4,8)[0]===255,'smudge undo restores original pixels'); d.history.redo(); ok(pixel(cel,9,8)[3]>0,'smudge redo restores dragged pixels'); d.history.undo(); d.history.clear();
 const clipped=new Q.SmudgeStroke(d,6,1,{x:0,y:0,w:8,h:16}); clipped.begin({x:4,y:8}); clipped.add({x:11,y:8}); clipped.end();
 ok(pixel(cel,7,8)[3]>0 && pixel(cel,9,8)[3]===0,'smudge respects the destination selection'); d.history.undo(); d.history.clear();
 const cancel=new Q.SmudgeStroke(d,6,1,null); cancel.begin({x:4,y:8}); cancel.add({x:10,y:8}); cancel.cancel(); ok(pixel(cel,10,8)[3]===0 && d.history.undoStack.length===0,'cancelled smudge restores original pixels without history');
 const tap=new Q.SmudgeStroke(d,6,1,null); tap.begin({x:4,y:8}); tap.end(); ok(d.history.undoStack.length===0,'smudge tap creates no undo step');
 const edge=new Q.SmudgeStroke(d,6,0.5,null); edge.begin({x:0,y:0}); edge.add({x:-4,y:-4}); edge.end(); ok(true,'smudge near canvas edges is safe');
 d.history.clear(); const fail=new Q.SmudgeStroke(d,6,1,null); fail.begin({x:4,y:8}); fail.add({x:10,y:8}); const captured=[...fail.tiles.values()][0].ctx, oldGet=captured.getImageData; captured.getImageData=()=>{throw Error('memory');}; fail.end(); captured.getImageData=oldGet;
 ok(pixel(cel,10,8)[3]===0 && d.history.undoStack.length===0,'undo allocation failure rolls back smudge');

}
{
 const d=setup(), p=createCanvas(16,16), c=p.getContext('2d');
 Q.renderPaintFill(c,16,16,'gradient','#ff0000','#0000ff','horizontal',0.25);
 const before=pixel(p,4,8); ok(Math.abs(before[0]-before[2])<15,'gradient midpoint adjusts the transition centre');
 ok(App.addPaintLayer('gradient','#ff0000','#0000ff','horizontal',0.25) && same(before,pixel(d.activeCel(false),4,8)),'gradient preview and created layer use the same renderer');
 d.history.undo(); const count=d.layers.length; ok(!App.addPaintLayer('gradient','#f00','#00f','horizontal',0.01) && d.layers.length===count,'invalid midpoint refuses creation without history');
 const thumb=createCanvas(180,52); Q.brushPreview(Q.brushById('studio'),thumb,[20,30,40]); let alpha=thumb.getContext('2d').getImageData(0,0,180,52).data; ok(alpha.some((v,i)=>i%4===3 && v>0),'stroke thumbnail renders actual brush marks');
 const other=createCanvas(180,52); Q.brushPreview(Q.brushById('airbrush'),other,[20,30,40]); const pixels=other.getContext('2d').getImageData(0,0,180,52).data; ok(pixels.some((v,i)=>i%4===3 && v>0) && !same([...alpha],[...pixels]),'different brush engines produce different visible thumbnails');
 const art=new Q.Doc({width:32,height:32}), wet=new Q.Stroke(art,{...Q.brushById('marker'),flow:0.5},[255,0,0],8,0.5,null,0); wet.begin({x:8,y:8,pressure:1,t:1}); const scratch=wet.buf, beforeScratch=pixel(scratch,8,8); Q.brushPreview(Q.brushById('wash'),createCanvas(180,52),[240,240,240]); ok(same(pixel(scratch,8,8),beforeScratch) && wet.buf===scratch,'thumbnail rendering cannot clear an active wet-stroke buffer'); wet.end();

}

console.log('4.9 gradient alpha and smudge softness');
{
 const d=setup(), preview=createCanvas(16,16), ctx=preview.getContext('2d'), options={angle:90,alpha1:0,alpha2:1};
 ok(Q.renderPaintFill(ctx,16,16,'gradient','#ff0000','#0000ff','angle',0.5,options),'custom angle and transparent stops render');
 const top=pixel(preview,8,1),bottom=pixel(preview,8,14); ok(top[3]<bottom[3] && bottom[2]>bottom[0],'90-degree gradient fades from top to bottom');
 ok(App.addPaintLayer('gradient','#ff0000','#0000ff','angle',0.5,options) && same(pixel(d.activeCel(false),8,1),top) && same(pixel(d.activeCel(false),8,14),bottom),'alpha gradient preview matches applied raster');
 d.history.undo(); ok(d.layers.length===1,'transparent gradient layer undo works'); d.history.redo(); ok(d.layers.length===2 && same(pixel(d.activeCel(false),8,14),bottom),'transparent gradient layer redo restores pixels');
 const transparentExport=d.flatten(0,{background:false}), opaqueExport=d.flatten(0,{background:d.bg}); ok(pixel(transparentExport,8,1)[3]===top[3] && pixel(opaqueExport,8,1)[3]===255,'transparent export keeps gradient alpha while normal export composites the background');

 const before=d.layers.length; ok(!App.addPaintLayer('gradient','#f00','#00f','angle',0.5,{angle:181,alpha1:0,alpha2:1}) && d.layers.length===before,'invalid angle is refused');
 ok(!App.addPaintLayer('gradient','#f00','#00f','angle',0.5,{angle:0,alpha1:-1,alpha2:1}) && d.layers.length===before,'invalid alpha is refused');
 const zero=createCanvas(16,16); Q.renderPaintFill(zero.getContext('2d'),16,16,'gradient','#f00','#00f','radial',0.5,{alpha1:0,alpha2:0}); ok(pixel(zero,8,8)[3]===0 && pixel(zero,0,0)[3]===0,'fully transparent radial gradient remains transparent');

 const solid=createCanvas(4,4); Q.renderPaintFill(solid.getContext('2d'),4,4,'solid','#336699','','',0.5,{alpha1:0.5}); const sp=pixel(solid,2,2); ok(sp[3]>=126 && sp[3]<=129 && sp[2]>sp[0],'solid layer preview supports opacity');
 const horiz=createCanvas(16,16); Q.renderPaintFill(horiz.getContext('2d'),16,16,'gradient','#f00','#00f','angle',0.5,{angle:0}); ok(pixel(horiz,1,8)[0]>pixel(horiz,1,8)[2] && pixel(horiz,14,8)[2]>pixel(horiz,14,8)[0],'0-degree custom angle runs left to right');
 const reverse=createCanvas(16,16); Q.renderPaintFill(reverse.getContext('2d'),16,16,'gradient','#f00','#00f','angle',0.5,{angle:180}); ok(pixel(reverse,1,8)[2]>pixel(reverse,1,8)[0] && pixel(reverse,14,8)[0]>pixel(reverse,14,8)[2],'180-degree custom angle reverses the gradient');
}
{
 function sample(hardness) { const d=setup(), c=d.activeCel(true), ctx=c.getContext('2d'); ctx.fillStyle='#ff0000'; ctx.fillRect(0,0,8,16); ctx.fillStyle='#0000ff'; ctx.fillRect(8,0,8,16); d.history.clear(); const s=new Q.SmudgeStroke(d,8,1,null,hardness); s.begin({x:5,y:8}); s.add({x:10,y:8}); s.end(); return {d,c}; }
 const hard=sample(1),soft=sample(0); const hardEdge=pixel(hard.c,9,5),softEdge=pixel(soft.c,9,5); ok(hardEdge[0]>softEdge[0] && softEdge[2]>hardEdge[2],'soft smudge edge mixes less at the brush boundary than hard edge');
 const after=pixel(soft.c,9,8); soft.d.history.undo(); ok(same(pixel(soft.c,9,8),[0,0,255,255]),'soft smudge undo restores original'); soft.d.history.redo(); ok(same(pixel(soft.c,9,8),after),'soft smudge redo restores mixed result');
 const cancel=sample(0), fresh=cancel.d, cel=cancel.c; fresh.history.clear(); const snapshot=[...cel.getContext('2d').getImageData(0,0,16,16).data]; const stroke=new Q.SmudgeStroke(fresh,8,0.5,{x:0,y:0,w:8,h:16},0); stroke.begin({x:4,y:8}); stroke.add({x:12,y:8}); stroke.cancel(); ok(same([...cel.getContext('2d').getImageData(0,0,16,16).data],snapshot) && fresh.history.undoStack.length===0,'soft smudge cancellation restores pixels');
}

console.log('5.1 batch layer operations');
{
 const d=setup(); d.activeCel(true).getContext('2d').fillRect(0,0,1,1); d.addLayer(); d.activeCel(true).getContext('2d').fillRect(1,0,1,1); d.addLayer(); d.activeCel(true).getContext('2d').fillRect(2,0,1,1); d.addFrame(false);
 d.activeLayer=0; d.activeCel(true).getContext('2d').fillRect(3,0,1,1); d.activeLayer=2; d.activeCel(true).getContext('2d').fillRect(4,0,1,1);
 const ids=d.layers.map(l=>l.id); d.history.clear();
 ok(d.batchLayers([ids[0],ids[2]],'bottom')==='' && d.layers.map(l=>l.id).join()=== [ids[0],ids[2],ids[1]].join(),'batch reorder preserves relative order');
 ok(pixel(d.cel(0,1,false),2,0)[3]===255 && pixel(d.cel(1,1,false),4,0)[3]===255 && d.layer().id===ids[2],'batch reorder keeps all frame cels and active layer aligned');
 d.history.undo(); ok(d.layers.map(l=>l.id).join()===ids.join() && pixel(d.cel(1,2,false),4,0)[3]===255,'batch reorder undo restores original order and pixels'); d.history.redo(); ok(pixel(d.cel(0,1,false),2,0)[3]===255,'batch reorder redo restores cels');
 ok(d.batchLayers([ids[0],ids[2]],'duplicate')==='' && d.layers.length===5 && d.layers[2].id!==ids[0] && d.layers[3].id!==ids[2],'batch duplicate creates distinct layer IDs');
 ok(pixel(d.cel(0,2,false),0,0)[3]===255 && pixel(d.cel(1,3,false),4,0)[3]===255,'batch duplicate copies cels across frames');
 d.cel(0,2,false).getContext('2d').clearRect(0,0,1,1); ok(pixel(d.cel(0,0,false),0,0)[3]===255,'batch duplicate pixels are independent'); d.history.undo(); ok(d.layers.length===3,'batch duplicate undo removes copies');
 const large=setup(); large.width=large.height=8192; large.frames[0].cels[0]=createCanvas(1,1); large.history.clear(); ok(large.batchLayers([large.layer().id],'duplicate').includes('64 MiB') && large.layers.length===1 && !large.history.canUndo(),'large duplicate is rejected before allocation');
 ok(d.batchLayers([ids[0],ids[2]],'lock')==='' && d.batchLayers([ids[0],ids[2]],'delete').includes('Unlock'),'locked selected layers cannot be deleted');
 ok(d.batchLayers([ids[0],ids[2]],'unlock')==='' && d.batchLayers([ids[0],ids[2]],'delete')==='' && d.layers.length===1,'unlocked selected layers delete together');
 d.history.undo(); ok(d.layers.length===3 && pixel(d.cel(1,1,false),4,0)[3]===255,'delete undo restores all-frame artwork'); d.history.redo(); ok(d.layers.length===1,'delete redo works');
 const historyBefore=d.history.undoStack.length; d.solo={target:ids[1],visibility:[{id:ids[1],visible:true}]}; ok(d.batchLayers([ids[1]],'hide').includes('solo') && d.history.undoStack.length===historyBefore && d.layers[0].visible,'batch operations are refused without mutation while solo is active'); d.solo=null;
 const before=d.history.undoStack.length; ok(d.batchLayers([ids[1]],'delete').includes('at least one') && d.batchLayers([ids[0]],'hide').includes('changed') && d.history.undoStack.length===before,'invalid batch actions do not mutate history');
}
console.log('5.2 ellipse selection and JPEG export');
{
 const d=setup(), sel=Q.ellipseSelection({x:2,y:2},{x:14,y:14},16,16), rev=Q.ellipseSelection({x:14,y:14},{x:2,y:2},16,16);
 ok(sel && sel.shape==='ellipse' && !!sel.ellipse && rev.x===sel.x && rev.w===sel.w,'ellipse drag works in either direction');
 ok(!Q.ellipseSelection({x:4,y:4},{x:4,y:10},16,16) && !Q.ellipseSelection({x:NaN,y:4},{x:4,y:10},16,16),'degenerate or invalid ellipse is rejected');
 const clipped=Q.ellipseSelection({x:-8,y:2},{x:8,y:14},16,16); ok(clipped && clipped.x===0 && clipped.w===8,'off-canvas ellipse clips bounds without reshaping geometry');
 const mask=Q.selectionMask(sel); ok(mask[(8-sel.y)*sel.w+8-sel.x]===1 && mask[(2-sel.y)*sel.w+2-sel.x]===0,'ellipse produces an elliptical mask rather than a bounding rectangle');
 App.view.selection=sel; const cel=d.activeCel(true); App.editSelection('fill');
 ok(pixel(cel,8,8)[0]===255 && pixel(cel,2,2)[3]===0,'fill respects ellipse interior'); d.history.undo(); ok(pixel(cel,8,8)[3]===0,'ellipse fill is undoable');
 const stroke=new Q.Stroke(d,{...pen},[255,0,0],20,1,sel); stroke.begin({x:8,y:8,pressure:1,t:1}); stroke.end();
 ok(pixel(cel,8,8)[0]===255 && pixel(cel,2,2)[3]===0,'brush stroke preserves ellipse clipping'); d.history.undo();
 const ctx=cel.getContext('2d'); ctx.fillStyle='#0000ff'; ctx.fillRect(0,0,16,16); d.history.clear();
 App.fillThreshold=0; App.fillAt(8,8); await new Promise(r=>setTimeout(r,80)); ok(pixel(cel,8,8)[0]===255 && pixel(cel,2,2)[2]===255,'flood fill respects ellipse mask'); d.history.undo();
 App.applyEffect('invert',1); await new Promise(r=>setTimeout(r,80)); ok(pixel(cel,8,8)[0]===255 && pixel(cel,2,2)[2]===255,'effects respect ellipse mask'); d.history.undo();
 App.editSelection('clear'); ok(pixel(cel,8,8)[3]===0 && pixel(cel,2,2)[3]===255,'clear respects ellipse'); d.history.undo();
 const erase=new Q.Stroke(d,{...pen,eraser:true},[0,0,0],20,1,sel); erase.begin({x:8,y:8,pressure:1,t:1}); erase.end(); ok(pixel(cel,8,8)[3]===0 && pixel(cel,2,2)[3]===255,'eraser respects ellipse selection'); d.history.undo();
 const wet=new Q.Stroke(d,{...pen,flow:0.5},[255,0,0],20,0.5,sel); wet.begin({x:8,y:8,pressure:1,t:1}); wet.end(); ok(pixel(cel,8,8)[0]>0 && pixel(cel,2,2)[2]===255,'wet brush respects ellipse selection'); d.history.undo();
 const copy=App.copyOrCut(false); ok(!copy.error && pixel(App.clipboard.canvas,6,6)[3]===255 && pixel(App.clipboard.canvas,0,0)[3]===0,'clipboard copy follows the ellipse rather than the bounding box');
 const edge=Q.ellipseSelection({x:-8,y:2},{x:8,y:14},16,16), edgeMask=Q.selectionMask(edge); ok(edgeMask[(2-edge.y)*edge.w]===1 && edgeMask[7]===0,'off-canvas ellipse keeps the original curve');
 const before=d.history.undoStack.length; App.editSelection('flipH'); App.moveScaleSelection(1,1,1); ok(d.history.undoStack.length===before,'ellipse transforms are rejected rather than editing bounds');
 const inv=Q.invertSelection(sel,16,16); ok(!inv.error && Q.selectionMask(inv.selection)[2*inv.selection.w+2]===1,'ellipse inversion produces an outside mask');
}
{
 const d=setup(); d.bg='#00ff00'; const ctx=d.activeCel(true).getContext('2d'); ctx.fillStyle='#ff0000'; ctx.fillRect(0,0,8,16); let saved=null;
 Q.saveBytes=(url,mime,name)=>{saved={url,mime,name};return true;}; ok(App.exportJpeg(0.9) && saved.mime==='image/jpeg' && saved.name.endsWith('.jpg'),'JPEG export uses correct MIME and filename');
 const decoded=createCanvas(16,16); decoded.getContext('2d').drawImage(await loadImage(saved.url),0,0);
 ok(pixel(decoded,2,8)[0]>220 && pixel(decoded,13,8)[1]>220 && pixel(decoded,13,8)[3]===255,'JPEG encodes active frame with opaque canvas background');
 const prev=saved; ok(!App.exportJpeg(NaN) && !App.exportJpeg(2) && saved===prev,'invalid JPEG quality never saves');
 const old=d.flatten; d.flatten=()=>({toDataURL:()=> 'data:image/png;base64,AAAA'}); ok(!App.exportJpeg(0.9) && saved===prev,'unsupported JPEG encoding is not mislabeled or saved'); d.flatten=old;
}
console.log('5.3 combined selections');
{
 const d=setup(), a={x:1,y:1,w:6,h:6}, b={x:4,y:4,w:8,h:8};
 let result=Q.combineSelections(a,b,'add',16,16); ok(!result.error && result.selection.runs && result.selection.x===1 && result.selection.w===11,'add unions overlapping rectangles');
 const mask=Q.selectionMask(result.selection), test=(m,s,x,y)=>m[(y-s.y)*s.w+x-s.x];
 ok(test(mask,result.selection,2,2) && test(mask,result.selection,10,10) && !test(mask,result.selection,10,2),'union preserves both shapes and excludes empty bounds');
 App.view.selection=result.selection; const cel=d.activeCel(true); App.editSelection('fill'); ok(pixel(cel,2,2)[0]===255 && pixel(cel,10,10)[0]===255 && pixel(cel,10,2)[3]===0,'union selection clips edits'); d.history.undo();
 result=Q.combineSelections(a,b,'subtract',16,16); const cut=result.selection, cm=Q.selectionMask(cut);
 ok(test(cm,cut,2,2) && !test(cm,cut,5,5),'subtract removes only overlap');
 App.view.selection=cut; App.editSelection('fill'); ok(pixel(cel,2,2)[0]===255 && pixel(cel,5,5)[3]===0,'subtract result clips pixels and is undoable'); d.history.undo();
 const ellipse=Q.ellipseSelection({x:3,y:3},{x:13,y:13},16,16), lasso=Q.lassoSelection([{x:0,y:0},{x:8,y:0},{x:0,y:8}],16,16);
 const mixed=Q.combineSelections(ellipse,lasso,'add',16,16).selection, mixedMask=Q.selectionMask(mixed);
 ok(test(mixedMask,mixed,1,1) && test(mixedMask,mixed,8,8) && !test(mixedMask,mixed,13,13),'ellipse and lasso combine using actual shape masks');
 const wand={x:0,y:0,w:4,h:2,runs:[{x:0,y:0,w:2},{x:3,y:1,w:1}]}; const mixed2=Q.combineSelections(wand,{x:0,y:0,w:1,h:1},'subtract',16,16).selection, m2=Q.selectionMask(mixed2);
 ok(!test(m2,mixed2,0,0) && test(m2,mixed2,1,0) && test(m2,mixed2,3,1),'run masks combine correctly, including holes and disconnected pixels');
 ok(Q.combineSelections(a,a,'subtract',16,16).error.includes('empty') && Q.combineSelections(null,b,'add',16,16).error && Q.combineSelections(a,b,'add',4096,4096).error.includes('4 megapixel'),'empty, missing and large selections fail safely');
 const tall={x:0,y:0,w:3,h:4096}, middle={x:1,y:0,w:1,h:4096}; ok(Q.combineSelections(tall,middle,'subtract',3,4096).error.includes('complex'),'more than 4096 runs is rejected');
 const inv=Q.invertSelection(cut,16,16); ok(!inv.error && inv.selection.runs,'combined selections can be inverted');
}
console.log('5.4 custom brush drawing');
{
 const entries=new Map(); globalThis.localStorage={getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,String(v))}; Q.restoreCustomBrushes();
 const source=Q.brushById('airbrush'), before=source.scatter, result=Q.createCustomBrush(source), brush=result.brush;
 ok(brush && brush.custom && brush.engine==='soft' && Q.updateCustomBrush(brush,'scatter',0.42) && source.scatter===before,'custom brush settings are independent of the source');
 const d=setup(), s=new Q.Stroke(d,brush,[255,0,0],10,1,null,0); s.begin({x:3,y:8,pressure:1,t:1}); s.add({x:12,y:8,pressure:1,t:30}); s.end(); const c=d.activeCel(false);
 ok([...c.getContext('2d').getImageData(0,0,16,16).data].some((x,i)=>i%4===3 && x>0),'custom brush paints real pixels'); d.history.undo(); ok([...c.getContext('2d').getImageData(0,0,16,16).data].every((x,i)=>i%4!==3 || x===0),'custom brush stroke can be undone');
 const id=brush.id; Q.restoreCustomBrushes(); ok(Q.brushById(id).scatter===0.42 && Q.brushById(id)!==source,'custom brush settings survive reloading');
 ok(Q.resetCustomBrush(Q.brushById(id)) && Q.brushById(id).scatter===before,'reset restores copied baseline');
 Q.deleteCustomBrush(Q.brushById(id)); delete globalThis.localStorage;
}
console.log('5.5 palette extraction');
{
 const cel=createCanvas(20,10), ctx=cel.getContext('2d'); ctx.fillStyle='#ff0000'; ctx.fillRect(0,0,10,10); ctx.fillStyle='#0000ff'; ctx.fillRect(10,0,5,10); ctx.fillStyle='rgba(0,255,0,0.03)'; ctx.fillRect(15,0,5,10);
 const original=[...ctx.getImageData(0,0,20,10).data], out=Q.extractCelColors(cel,24);
 ok(out.join()==='#ff0000,#0000ff','extract weights visible pixels and excludes nearly transparent pixels');
 ok(Q.extractCelColors(cel,1).join()==='#ff0000' && Q.extractCelColors(null,24).length===0,'extract respects limits and empty sources');
 ok([...ctx.getImageData(0,0,20,10).data].join()===original.join(),'extract does not modify layer pixels');
 const large=createCanvas(1024,512), lc=large.getContext('2d'); lc.fillStyle='#124578'; lc.fillRect(0,0,1024,512); ok(Q.extractCelColors(large,24).join()==='#124578','large layer is sampled through a bounded canvas');
 ok(Q.sortPalette(['#0000ff','#777777','#ff0000'],'hue').join()==='#ff0000,#0000ff,#777777','palette hue sort places neutral colours last');
 ok(Q.sortPalette(['#ffffff','#111111','#888888'],'brightness').join()==='#111111,#888888,#ffffff','palette brightness sort orders by HSV value');
}
console.log('5.6 animation range editing');
{
 const d=new Q.Doc({width:8,height:8});
 const first=d.activeCel(true); first.getContext('2d').fillStyle='#ff0000'; first.getContext('2d').fillRect(1,1,2,2);
 d.addFrame(false); const second=d.activeCel(true); second.getContext('2d').fillStyle='#0000ff'; second.getContext('2d').fillRect(1,1,2,2); d.frames[1].duration=3; d.frames[1].group='Scene'; d.frames[1].skipped=true;
 d.addLayer(); const other=d.activeCel(true); other.getContext('2d').fillStyle='#00ff00'; other.getContext('2d').fillRect(1,1,2,2); d.activeLayer=0;
 d.setPlayRange(0,1); d.setCameraKey({frame:1,x:4,y:4,zoom:1,angle:0,easing:'linear'}); d.history.clear();
 ok(!d.insertBlankFrames(-1,1,1) && !d.insertBlankFrames(0,59,1) && !d.insertBlankFrames(0,1,61) && d.history.undoStack.length===0,'invalid insertions are rejected without history');
 ok(d.insertBlankFrames(1,2,4) && d.frames.length===4 && d.activeFrame===1 && d.frames[1].duration===4 && d.frames[2].duration===4 && d.frames[1].cels.every(c=>!c),'insertion adds sparse blank frames with hold and selects first');
 ok(d.frames[3].cels[0]===second && d.frames[3].cels[1]===other && d.frames[3].skipped && d.frames[3].group==='Scene' && d.frames[3].duration===3,'insertion preserves shifted frame pixels, layers and metadata');
 ok(d.playRange.end===1 && d.cameraKeys[0].frame===1,'insertion keeps playback range and keyframe positions fixed');
 d.history.undo(); ok(d.frames.length===2 && d.frames[1].cels[0]===second && d.frames[1].cels[1]===other && d.playRange.end===1,'undo removes inserted frames and restores timeline');
 d.history.redo(); ok(d.frames.length===4 && d.frames[3].cels[0]===second && d.frames[1].duration===4,'redo restores inserted frames');
 d.history.clear(); const bad=d.clearCelRange(-1,1); ok(!!bad && d.history.undoStack.length===0,'invalid clear range produces no history');
 d.layer().locked=true; ok(!!d.clearCelRange(0,3) && d.frames[0].cels[0]===first,'locked layer refuses clear'); d.layer().locked=false; d.layer().alphaLocked=true; ok(!!d.clearCelRange(0,3),'alpha lock refuses clear'); d.layer().alphaLocked=false; d.layer().visible=false; ok(!!d.clearCelRange(0,3),'hidden layer refuses clear'); d.layer().visible=true;
 ok(d.clearCelRange(0,3)===null && !d.frames[0].cels[0] && !d.frames[3].cels[0] && d.frames[3].cels[1]===other && d.history.undoStack.length===1,'clear range affects only active layer including skipped frames in one history step');
 ok(same(pixel(other,1,1),[0,255,0,255]) && d.frames[3].duration===3 && d.frames[3].group==='Scene','other layer pixels and frame metadata remain intact');
 d.history.undo(); ok(same(pixel(d.frames[0].cels[0],1,1),[255,0,0,255]) && same(pixel(d.frames[3].cels[0],1,1),[0,0,255,255]),'clear undo restores original cel pixels'); d.history.redo(); ok(!d.frames[0].cels[0] && !d.frames[3].cels[0],'clear redo removes cels');
 const history=d.history.undoStack.length; ok(!!d.clearCelRange(0,3) && d.history.undoStack.length===history,'empty clear range is a no-op');
}
{
 const frames=[{group:'A'},{group:'B'},{group:'A',skipped:true},{group:''}];
 ok(Q.findLabeledFrame(frames,0,'A',1)===2 && Q.findLabeledFrame(frames,0,'A',-1)===2 && Q.findLabeledFrame(frames,2,'A',1)===0,'label navigation wraps in both directions and includes skipped frames');
 ok(Q.findLabeledFrame(frames,0,'B',1)===1 && Q.findLabeledFrame(frames,1,'B',1)===1 && Q.findLabeledFrame(frames,0,'missing',1)===-1 && Q.findLabeledFrame(frames,0,'A',0)===-1,'label navigation handles one or no match and invalid direction');
}
console.log('5.7 smudge accuracy and responsiveness');
{
 function make() { const d=new Q.Doc({width:128,height:64}), cel=d.activeCel(true), c=cel.getContext('2d'); c.fillStyle='#ff0000'; c.fillRect(0,0,55,64); c.fillStyle='#0044ff'; c.fillRect(55,0,50,64); d.history.clear(); return {d,cel}; }
 function drag(segments,pressure,on) { const {d,cel}=make(), s=new Q.SmudgeStroke(d,24,0.7,null,0.3,on); let dabs=0, dab=s._dab; s._dab=function(...args){ dabs++; return dab.apply(this,args); }; s.begin({x:35,y:30,pressure}); for(let i=1;i<=segments;i++) s.add({x:35+50*i/segments,y:30,pressure}); s.end(); return {d,cel,dabs}; }
 const sparse=drag(1,1,false), dense=drag(500,1,false), a=[...sparse.cel.getContext('2d').getImageData(0,0,128,64).data], b=[...dense.cel.getContext('2d').getImageData(0,0,128,64).data];
 ok(a.every((v,i)=>v===b[i]) && sparse.dabs===dense.dabs,'fixed-distance smudge produces identical pixels for dense and sparse input along the same path');
 ok(dense.dabs<=12,'high-frequency input does not produce hundreds of redundant dabs');
 const low=drag(50,0.1,true), full=drag(50,1,true), initial=make().cel.getContext('2d').getImageData(0,0,128,64).data, lowPixels=low.cel.getContext('2d').getImageData(0,0,128,64).data, highPixels=full.cel.getContext('2d').getImageData(0,0,128,64).data;
 const diff=arr=>arr.reduce((sum,v,i)=>sum+Math.abs(v-initial[i]),0); ok(diff(lowPixels)<diff(highPixels),'optional low stylus pressure reduces smudge strength');
 const d=new Q.Doc({width:32,height:16}), cel=d.activeCel(true), c=cel.getContext('2d'); c.fillStyle='#ff0000'; c.fillRect(12,0,20,16); const stroke=new Q.SmudgeStroke(d,10,1,null,1); stroke.begin({x:7,y:8}); stroke.add({x:17,y:8}); stroke.end(); ok(pixel(cel,13,8)[3]<255,'transparent source pixels can reduce destination alpha while smudging');
}
{
 const d=new Q.Doc({width:384,height:256}), cel=d.activeCel(true), ctx=cel.getContext('2d'); ctx.fillStyle='#e72114'; ctx.fillRect(0,0,180,256); ctx.fillStyle='#1b4fff'; ctx.fillRect(180,0,204,256);
 const before=[...ctx.getImageData(0,0,384,256).data]; d.history.clear(); d.history.beginPixels=()=>{throw Error('full snapshot forbidden');};
 const s=new Q.SmudgeStroke(d,36,0.8,null,0.5); s.begin({x:100,y:128}); s.add({x:250,y:128}); s.end(); const after=[...ctx.getImageData(0,0,384,256).data];
 ok(d.history.undoStack.length===1 && d.history.undoStack[0].type==='pixelTiles' && d.history.snap===null && d.history.undoStack[0].tiles.length<=6,'smudge captures only touched undo tiles instead of full canvas');
 ok(d.history.undo() && same([...ctx.getImageData(0,0,384,256).data],before),'multi-tile smudge undo exactly restores pixels'); ok(d.history.redo() && same([...ctx.getImageData(0,0,384,256).data],after),'multi-tile smudge redo exactly restores pixels'); d.history.undo(); d.history.clear();
 const cancel=new Q.SmudgeStroke(d,36,0.8,null,0.5); cancel.begin({x:100,y:128}); cancel.add({x:250,y:128}); cancel.cancel(); ok(same([...ctx.getImageData(0,0,384,256).data],before) && !d.history.canUndo(),'multi-tile cancellation restores all pixels');
 const failing=new Q.SmudgeStroke(d,36,0.8,null,0.5); failing.begin({x:90,y:128}); failing.add({x:110,y:128}); failing.tileBytes=64*1024*1024; failing.add({x:280,y:128}); ok(failing.failed && same([...ctx.getImageData(0,0,384,256).data],before) && !d.history.canUndo(),'undo memory limit rolls back the entire in-progress smudge');
 const test=new Q.SmudgeStroke(d,36,0.8,null,1); test.begin({x:100,y:128}); test.add({x:250,y:128}); test.end(); const old=ctx.getImageData; ctx.getImageData=()=>{throw Error('memory');}; ok(!d.history.undo() && d.history.canUndo(),'undo readback failure retains history'); ctx.getImageData=old; ok(d.history.undo() && same([...ctx.getImageData(0,0,384,256).data],before),'undo can be retried after a readback failure');
}
{
 const d=new Q.Doc({width:32,height:32}), cel=d.activeCel(true), ctx=cel.getContext('2d'); ctx.fillStyle='#f00';ctx.fillRect(0,0,16,32);ctx.fillStyle='#00f';ctx.fillRect(16,0,16,32);
 const before=[...ctx.getImageData(0,0,32,32).data], sel={x:14,y:8,w:6,h:8,runs:[{x:14,y:8,w:6},{x:14,y:9,w:6},{x:14,y:10,w:6},{x:14,y:11,w:6},{x:14,y:12,w:6},{x:14,y:13,w:6},{x:14,y:14,w:6},{x:14,y:15,w:6}]};
 const s=new Q.SmudgeStroke(d,12,1,sel,0.5);s.begin({x:8,y:12});s.add({x:22,y:12});s.end(); const after=[...ctx.getImageData(0,0,32,32).data];
 let unchanged=true, changed=false; for(let y=0;y<32;y++) for(let x=0;x<32;x++){const i=(y*32+x)*4, different=before.slice(i,i+4).join()!==after.slice(i,i+4).join(); if(x>=14&&x<20&&y>=8&&y<16) changed ||= different; else if(different) unchanged=false;} ok(changed && unchanged,'run-mask selection precisely clips smudge destination'); d.history.undo(); ok(same([...ctx.getImageData(0,0,32,32).data],before),'masked smudge undo restores all pixels');
}
{
 const d=new Q.Doc({width:64,height:64}), cel=d.activeCel(true), ctx=cel.getContext('2d'); ctx.fillStyle='rgba(255,0,0,0.37)';ctx.fillRect(0,0,32,64);ctx.fillStyle='rgba(0,0,255,0.65)';ctx.fillRect(32,0,32,64); const before=[...ctx.getImageData(0,0,64,64).data];
 const sel=Q.ellipseSelection({x:20,y:16},{x:48,y:48},64,64), s=new Q.SmudgeStroke(d,14,0.7,sel,0.4); s.begin({x:22,y:32});s.add({x:43,y:32});s.end(); const after=[...ctx.getImageData(0,0,64,64).data];
 ok(after.some((v,i)=>v!==before[i]),'smudge modifies semitransparent pixels inside an ellipse');d.history.undo();ok(same([...ctx.getImageData(0,0,64,64).data],before),'tiled undo restores semitransparent colours and alpha exactly');d.history.redo();ok(same([...ctx.getImageData(0,0,64,64).data],after),'tiled redo restores semitransparent smudge exactly');
}
console.log('5.9 fill and wand sampling');
{
 const d=setup(), ink=d.activeCel(true), ctx=ink.getContext('2d'); ctx.fillStyle='#000'; ctx.fillRect(3,3,10,1);ctx.fillRect(3,12,10,1);ctx.fillRect(3,3,1,10);ctx.fillRect(12,3,1,10); d.addLayer(); const target=d.layer(); d.history.clear();
 App.fillSource='visible'; App.fillScope='connected'; App.fillThreshold=0; App.fillAt(6,6,[255,0,0]); await new Promise(r=>setTimeout(r,75)); const cel=d.activeCel(false);
 ok(cel && same(pixel(cel,6,6),[255,0,0,255]) && pixel(cel,1,1)[3]===0 && pixel(cel,3,5)[3]===0,'visible-layer sampling fills the bounded interior onto the active layer only');
 ok(same(pixel(ink,3,5),[0,0,0,255]) && d.layer()===target && d.history.undoStack.length===1 && d.history.snap===null,'reference ink stays unchanged and fill uses local undo without a full snapshot');
 d.history.undo(); ok(pixel(cel,6,6)[3]===0,'visible reference fill undo restores destination'); d.history.redo(); ok(pixel(cel,6,6)[0]===255,'visible reference fill redo restores destination');
 d.history.undo(); d.history.clear(); App.view.selection={x:4,y:4,w:3,h:3}; App.fillAt(5,5,[0,255,0]); await new Promise(r=>setTimeout(r,75)); ok(pixel(cel,5,5)[1]===255 && pixel(cel,8,8)[3]===0,'reference fill respects destination selection bounds'); d.history.undo();
 App.view.selection=null; d.layers[0].visible=false; App.fillAt(6,6,[255,0,0]); await new Promise(r=>setTimeout(r,75)); ok(pixel(cel,1,1)[0]===255,'hidden layers do not bound visible sampling'); d.history.undo();d.layers[0].visible=true;
}
{
 const d=setup(), cel=d.activeCel(true), c=cel.getContext('2d'); c.fillStyle='#f00';c.fillRect(1,1,3,3);c.fillRect(10,1,3,3);c.fillStyle='#00f';c.fillRect(5,1,3,3); d.history.clear(); App.fillSource='active';App.fillScope='connected';App.fillThreshold=0;
 App.fillAt(2,2,[0,255,0]);await new Promise(r=>setTimeout(r,75));ok(pixel(cel,2,2)[1]===255 && pixel(cel,11,2)[0]===255,'default fill changes only a connected patch');d.history.undo();d.history.clear();
 App.fillScope='all';App.fillAt(2,2,[0,255,0]);await new Promise(r=>setTimeout(r,75));ok(pixel(cel,2,2)[1]===255 && pixel(cel,11,2)[1]===255 && pixel(cel,6,2)[2]===255,'all-matching fill recolours disconnected matching patches only');d.history.undo();ok(pixel(cel,2,2)[0]===255 && pixel(cel,11,2)[0]===255,'all-matching fill is one undoable change');
 App.view.selection={x:0,y:0,w:8,h:8};App.fillAt(2,2,[0,255,0]);await new Promise(r=>setTimeout(r,75));ok(pixel(cel,2,2)[1]===255 && pixel(cel,11,2)[0]===255,'all-matching fill is restricted by selection');d.history.undo();App.view.selection=null;
 App.fillAt(2,2,[255,0,0]);await new Promise(r=>setTimeout(r,75));ok(d.history.undoStack.length===0,'matching fill creates no history if no pixels change');
}
{
 const d=setup(), ref=d.activeCel(true), r=ref.getContext('2d');r.fillStyle='#000';r.fillRect(7,0,2,16);d.addLayer();const cel=d.activeCel(true), c=cel.getContext('2d');c.fillStyle='rgba(0,0,255,0.5)';c.fillRect(1,1,4,4); d.layer().alphaLocked=true;d.history.clear(); const originalAlpha=pixel(cel,2,2)[3];
 App.fillSource='visible';App.fillScope='all';App.fillThreshold=0;App.fillAt(2,2,[255,0,0]);await new Promise(r=>setTimeout(r,75));ok(pixel(cel,2,2)[0]===255 && pixel(cel,2,2)[3]===originalAlpha && pixel(cel,6,2)[3]===0,'reference all-matching fill preserves alpha lock');d.history.undo();
 App.fillAt(6,2,[255,0,0]);await new Promise(r=>setTimeout(r,75));ok(pixel(cel,6,2)[3]===0 && !d.history.canUndo(),'reference fill refuses transparent alpha-locked seed');
}
{
 const d=setup(), ref=d.activeCel(true), c=ref.getContext('2d');c.fillStyle='#000';c.fillRect(7,0,2,16);d.addLayer();d.history.clear();App.fillSource='visible';App.fillScope='connected';App.fillThreshold=0;
 App.wandAt(3,3);await new Promise(r=>setTimeout(r,75));let s=App.view.selection, m=Q.selectionMask(s);const selected=(x,y)=>x>=s.x && y>=s.y && x<s.x+s.w && y<s.y+s.h && !!m[(y-s.y)*s.w+x-s.x];ok(selected(3,3) && !selected(12,3) && !selected(7,3),'visible magic wand selects the connected visible region');
 App.fillScope='all';App.wandAt(3,3);await new Promise(r=>setTimeout(r,75));s=App.view.selection;m=Q.selectionMask(s);ok(selected(3,3) && selected(12,3) && !selected(7,3) && d.history.undoStack.length===0,'all-matching wand selects disconnected areas without editing artwork');
}
{
 const d=setup(), base=d.activeCel(true), bc=base.getContext('2d');bc.fillStyle='#f00';bc.fillRect(2,2,4,4);d.addLayer();const clip=d.activeCel(true), cc=clip.getContext('2d');cc.fillStyle='#00f';cc.fillRect(0,0,16,16);d.layer().clipped=true;d.addLayer();d.history.clear();App.fillSource='visible';App.fillScope='connected';App.fillThreshold=0;
 App.fillAt(3,3,[0,255,0]);await new Promise(r=>setTimeout(r,75));let target=d.activeCel(false);ok(target && pixel(target,3,3)[1]===255 && pixel(target,1,1)[3]===0,'visible reference honors clipping and excludes background');d.history.undo();
 App.fillAt(1,1,[0,255,0]);d.layers[0].visible=false;await new Promise(r=>setTimeout(r,75));ok(!d.history.canUndo() && pixel(target,1,1)[3]===0,'delayed fill cancels when reference visibility changes');d.layers[0].visible=true;
 App.wandAt(1,1);App.view.selection={x:1,y:1,w:1,h:1};await new Promise(r=>setTimeout(r,75));ok(App.view.selection.w===1,'delayed wand does not overwrite a changed selection');App.view.selection=null;
 App.fillAt(1,1,[0,255,0]);d.activeLayer=0;await new Promise(r=>setTimeout(r,75));ok(pixel(target,1,1)[3]===0 && !d.history.canUndo(),'delayed fill cancels when active layer changes');
}
{
 const data={width:2,height:4097,data:new Uint8ClampedArray(2*4097*4)};for(let y=0;y<4097;y++)data.data[(y*2)*4+3]=255;
 const r=Q.matchColorRegion(data,0,0,0,'all',null,null);ok(Q.selectionFromRegion(r,2,4097,0,0).error,'all-matching wand rejects selections exceeding 4096 runs');
 const d=new Q.Doc({width:4096,height:4096}); App.doc=d;App.view={selection:null,color:[255,0,0],dirty:false,locked:false};App.fillSource='visible';App.fillScope='connected';App.fillAt(1,1);ok(!App.view.locked && !d.activeCel(false) && !d.history.canUndo(),'oversized visible sampling is refused before allocating a cel');
}
{
 const d=setup(),cel=d.activeCel(true),c=cel.getContext('2d');c.fillStyle='#000';c.fillRect(0,0,16,16);d.history.clear();App.fillSource='active';App.fillScope='connected';App.fillThreshold=0;
 const originalGet=c.getImageData.bind(c);let reads=0;c.getImageData=function(...args){reads++;if(reads===2)throw Error('memory');return originalGet(...args);};App.fillAt(2,2,[255,0,0]);await new Promise(r=>setTimeout(r,75));c.getImageData=originalGet;
 ok(same(pixel(cel,2,2),[0,0,0,255]) && !d.history.canUndo() && !App.view.locked,'undo allocation failure leaves fill pixels and history unchanged');
 App.fillSource='active';App.fillScope='connected';App.fillThreshold=12;
}
console.log('6.0 canvas mesh transforms');
{
 const d=setup(),c=d.activeCel(true),cx=c.getContext('2d');cx.fillStyle='#f00';cx.fillRect(2,2,4,4);cx.fillStyle='#00f';cx.fillRect(10,10,2,2);d.history.clear();App.view.selection={x:2,y:2,w:4,h:4};
 ok(!App.beginCanvasTransform().error,'canvas transform starts on a rectangular selection');let t=App.view.meshTransform;t.points=t.points.map(p=>({x:p.x+4,y:p.y+2}));ok(!App.applyCanvasTransform().error && pixel(c,2,2)[3]===0 && pixel(c,6,4)[0]===255 && pixel(c,10,10)[2]===255,'mesh translation moves selected pixels without affecting unrelated artwork');
 ok(d.history.undoStack.length===1 && App.view.selection.x===6,'transform creates one history entry and updates selection bounds');d.history.undo();ok(pixel(c,2,2)[0]===255 && pixel(c,6,4)[3]===0,'mesh undo restores source and destination');d.history.redo();ok(pixel(c,6,4)[0]===255,'mesh redo restores transformed pixels');
}
{
 const d=setup(),c=d.activeCel(true),cx=c.getContext('2d');cx.fillStyle='#f00';cx.fillRect(2,2,6,6);App.view.selection={x:2,y:2,w:6,h:6};d.history.clear();App.beginCanvasTransform();let t=App.view.meshTransform;t.points[2].x+=3;t.points=Q.transformQuad(t.points);ok(!App.applyCanvasTransform().error && pixel(c,9,2)[0]===255 && pixel(c,9,7)[3]===0,'distortion maps corners into a tapered shape');d.history.undo();
 App.view.selection={x:2,y:2,w:6,h:6};App.beginCanvasTransform();t=App.view.meshTransform;t.points[4].x+=2;ok(!App.applyCanvasTransform().error && pixel(c,4,4)[0]===255 && d.history.undoStack.length===1,'nine-point warp renders and records undo');
}
{
 const d=setup(),c=d.activeCel(true);App.view.selection={x:2,y:2,w:6,h:6};d.history.clear();App.beginCanvasTransform();let t=App.view.meshTransform;ok(App.applyCanvasTransform().error==='Nothing changed','unchanged mesh makes no history');t.points[0]={...t.points[8]};ok(App.applyCanvasTransform().error.includes('cross') && !d.history.canUndo(),'folded mesh is rejected without edits');
 t.points=Q.transformGrid(t.src).map(p=>({x:p.x+1,y:p.y}));d.layer().locked=true;ok(App.applyCanvasTransform().error && !d.history.canUndo(),'locked target rejects a stale mesh');d.layer().locked=false; d.addLayer();ok(App.applyCanvasTransform().error,'changing the layer rejects stale mesh');
}
{
 const d=setup(),c=d.activeCel(true),ctx=c.getContext('2d');ctx.fillStyle='rgba(0,255,0,0.5)';ctx.fillRect(3,3,3,3);d.history.clear();App.view.selection={x:3,y:3,w:3,h:3};const alpha=pixel(c,4,4)[3];App.beginCanvasTransform();App.view.meshTransform.points=App.view.meshTransform.points.map(p=>({x:p.x+4,y:p.y}));ok(!App.applyCanvasTransform().error && pixel(c,8,4)[3]===alpha && pixel(c,4,4)[3]===0,'mesh preserves semitransparent pixels during translation');
 d.history.undo();App.view.selection={x:3,y:3,w:3,h:3};App.beginCanvasTransform();App.view.meshTransform.points=App.view.meshTransform.points.map(p=>({x:p.x+4,y:p.y}));const get=ctx.getImageData.bind(ctx);ctx.getImageData=()=>{throw Error('memory');};const r=App.applyCanvasTransform();ctx.getImageData=get;ok(r.error && pixel(c,4,4)[3]===alpha && !d.history.canUndo(),'readback failure leaves pixels and history unchanged');
}
{
 const d=setup();d.activeCel(true); App.view.selection=null; d.layer().alphaLocked=true;ok(App.beginCanvasTransform().error.includes('alpha'),'mesh rejects alpha-locked layers');
 const big=new Q.Doc({width:2048,height:2048});big.activeCel(true);App.doc=big;App.view={selection:null,locked:false};ok(App.beginCanvasTransform().error.includes('2 megapixels'),'mesh limits oversized sources before starting');
}
console.log('6.1 smooth resampling and preview');
{
 const image={width:2,height:1,data:new Uint8ClampedArray([255,0,0,255,0,0,255,255])}, p=Q.transformGrid({x:0,y:0,w:4,h:2}),r={x:0,y:0,w:4,h:2};
 const nearest=Q.rasterMesh(image,p,r,'nearest'),smooth=Q.rasterMesh(image,p,r,'smooth');ok(nearest[4]===255 && nearest[6]===0 && smooth[4]>180 && smooth[4]<200 && smooth[6]>50 && smooth[6]<70,'bilinear sampling blends neighboring colours where nearest stays sharp');
 image.data=new Uint8ClampedArray([255,0,0,255,0,0,255,0]);const a=Q.rasterMesh(image,p,r,'smooth');ok(a[4]===255 && a[6]===0 && a[7]>180 && a[7]<200,'smooth interpolation uses premultiplied alpha and avoids transparent colour fringes');
}
{
 const d=setup(),c=d.activeCel(true),ctx=c.getContext('2d');ctx.fillStyle='#f00';ctx.fillRect(1,1,1,2);ctx.fillStyle='#00f';ctx.fillRect(2,1,1,2);d.history.clear();App.view.selection={x:1,y:1,w:2,h:2};App.beginCanvasTransform();let t=App.view.meshTransform;t.points=Q.transformGrid({x:7,y:7,w:4,h:4});ok(!App.applyCanvasTransform().error,'smooth mesh applies through the real edit path');const smooth=pixel(c,8,7);ok(smooth[0]>180 && smooth[0]<200 && smooth[2]>50 && smooth[2]<70,'smooth option changes committed pixels');d.history.undo();ok(pixel(c,1,1)[0]===255 && pixel(c,8,7)[3]===0,'smooth transform undo restores original bytes');
 App.view.selection={x:1,y:1,w:2,h:2};App.beginCanvasTransform();t=App.view.meshTransform;t.sampling='nearest';t.points=Q.transformGrid({x:7,y:7,w:4,h:4});ok(!App.applyCanvasTransform().error && pixel(c,8,7)[0]===255 && pixel(c,8,7)[2]===0,'pixelated option commits nearest-neighbour pixels');
}
{
 const d=setup(),c=d.activeCel(true),ctx=c.getContext('2d');ctx.fillStyle='#f00';ctx.fillRect(2,2,4,4);d.history.clear();App.view={doc:d,selection:{x:2,y:2,w:4,h:4},locked:false,dirty:false,requestMeshPreview:Q.View.prototype.requestMeshPreview};App.beginCanvasTransform();const t=App.view.meshTransform;t.points=t.points.map(p=>({x:p.x+4,y:p.y}));App.view.requestMeshPreview();await new Promise(r=>setTimeout(r,200));
 ok(t.preview && pixel(t.preview,2,2)[3]===0 && pixel(t.preview,6,2)[0]===255 && pixel(c,2,2)[0]===255 && !d.history.canUndo(),'preview shows moved pixels without changing the source or history');
 const cv=Q.canvas(16,16);d.composite(cv.getContext('2d'),0,{previewIndex:0,previewCanvas:t.preview});ok(pixel(cv,2,2)[3]===0 && pixel(cv,6,2)[0]===255 && d.activeCel(false)===c,'compositing a temporary preview never replaces the real cel');
 t.points[0]={...t.points[8]};App.view.requestMeshPreview();await new Promise(r=>setTimeout(r,200));ok(!t.preview && pixel(c,2,2)[0]===255,'invalid folded mesh drops the preview and preserves artwork');
}
{
 const d=new Q.Doc({width:1000,height:200});App.doc=d;const cel=d.activeCel(true);cel.getContext('2d').fillRect(10,10,20,20);App.view={doc:d,selection:{x:10,y:10,w:20,h:20},locked:false,requestMeshPreview:Q.View.prototype.requestMeshPreview};App.beginCanvasTransform();const t=App.view.meshTransform;t.points=t.points.map(p=>({x:p.x+10,y:p.y}));App.view.requestMeshPreview();await new Promise(r=>setTimeout(r,200));ok(t.preview && t.preview.width===384 && t.preview.height===77,'preview raster is capped at 384 pixels on its longest side');
 t.points=t.points.map(p=>({x:p.x+10,y:p.y}));App.view.requestMeshPreview();App.view.meshTransform=null;await new Promise(r=>setTimeout(r,200));ok(d.activeCel(false)===cel && !d.history.canUndo(),'late preview work cannot modify artwork after cancellation');
}
{
 const d=setup(),base=d.activeCel(true),bc=base.getContext('2d');bc.fillStyle='#f00';bc.fillRect(0,0,8,16);d.addLayer();const clip=d.activeCel(true);d.layer().clipped=true;d.layer().opacity=0.5;const p=Q.canvas(8,8);p.getContext('2d').fillStyle='#00f';p.getContext('2d').fillRect(0,0,8,8);const cv=Q.canvas(16,16);d.composite(cv.getContext('2d'),0,{previewIndex:1,previewCanvas:p});const inside=pixel(cv,3,3),outside=pixel(cv,12,3);ok(inside[0]>0 && inside[2]>0 && outside[3]===0 && d.activeCel(false)===clip,'temporary preview honors clipped base and layer opacity');
}
console.log('6.2 masked canvas transforms');
for (const [name,sel] of [
 ['ellipse',Q.ellipseSelection({x:1,y:1},{x:7,y:7},16,16)],
 ['lasso',Q.lassoSelection([{x:1,y:1},{x:7,y:1},{x:1,y:7}],16,16)],
 ['wand/run mask',{x:1,y:1,w:6,h:6,runs:[{x:1,y:1,w:2},{x:5,y:1,w:2},{x:1,y:2,w:2},{x:5,y:2,w:2},{x:2,y:4,w:3},{x:2,y:5,w:3}]}]
]) {
 const d=setup(),cel=d.activeCel(true),ctx=cel.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(1,1,6,6);ctx.fillStyle='#0000ff';ctx.fillRect(9,9,6,6);App.view.selection=sel;d.history.clear();const mask=Q.selectionMask(sel),original=[...ctx.getImageData(0,0,16,16).data];
 ok(!App.beginCanvasTransform().error,name+' selection opens canvas transform');const t=App.view.meshTransform;t.sampling='nearest';t.points=t.points.map(p=>({x:p.x+8,y:p.y+8}));ok(!App.applyCanvasTransform().error,name+' transform applies');
 let good=true;const target=App.view.selection,tm=Q.selectionMask(target);
 for(let y=0;y<6;y++) for(let x=0;x<6;x++) {const chosen=!!mask[y*6+x],source=pixel(cel,x+1,y+1),dest=pixel(cel,x+9,y+9),tx=x+9-target.x,ty=y+9-target.y,selected=tx>=0 && ty>=0 && tx<target.w && ty<target.h && (!tm || !!tm[ty*target.w+tx]);if((chosen ? source[3]!==0 || dest[0]!==255 || !selected : source[0]!==255 || dest[2]!==255 || selected)) good=false;}
 ok(good,name+' transform moves only selected pixels and retains the matching selection footprint');d.history.undo();ok(ctx.getImageData(0,0,16,16).data.every((v,i)=>v===original[i]),name+' transform undo restores exact source and destination');d.history.redo();ok(d.history.undoStack.length===1,name+' transform redo remains one history step');
}
{
 const d=setup(),cel=d.activeCel(true),ctx=cel.getContext('2d');ctx.fillStyle='#f00';ctx.fillRect(3,3,6,6);App.view.selection={x:3,y:3,w:6,h:6};d.history.clear();App.beginCanvasTransform();const t=App.view.meshTransform;t.points[2].x+=3;t.points=Q.transformQuad(t.points);ok(!App.applyCanvasTransform().error && !!App.view.selection.runs,'distorted rectangle follows the actual non-rectangular footprint');
}
{
 const d=setup();d.activeCel(true).getContext('2d').fillRect(1,1,6,6);const sel=Q.ellipseSelection({x:1,y:1},{x:7,y:7},16,16);App.view.selection=sel;d.history.clear();App.beginCanvasTransform();let t=App.view.meshTransform;t.points=t.points.map(p=>({x:p.x+4,y:p.y}));sel.ellipse.rx=1;ok(App.applyCanvasTransform().error && !d.history.canUndo(),'in-place selection change invalidates the pending transform');
 App.view.selection=Q.ellipseSelection({x:1,y:1},{x:7,y:7},16,16);App.beginCanvasTransform();t=App.view.meshTransform;t.points=t.points.map(p=>({x:p.x+20,y:p.y}));ok(App.applyCanvasTransform().error.includes('empty') && !d.history.canUndo(),'moving the entire selected mask off-canvas is rejected atomically');
}
{
 const r={x:0,y:0,w:128,h:128},mask=new Uint8Array(r.w*r.h);for(let y=0;y<128;y++)for(let x=0;x<128;x++)mask[y*128+x]=(x+y)%2;const p=Q.transformGrid(r);ok(Q.meshSelection(r,mask,p,r).error.includes('4096'),'fragmented transformed selections are rejected before edits');
}
{
 const d=setup(),cel=d.activeCel(true),ctx=cel.getContext('2d');ctx.fillStyle='#f00';ctx.fillRect(1,1,6,6);App.view={doc:d,selection:Q.ellipseSelection({x:1,y:1},{x:7,y:7},16,16),locked:false,requestMeshPreview:Q.View.prototype.requestMeshPreview};App.beginCanvasTransform();const t=App.view.meshTransform;t.points=t.points.map(p=>({x:p.x+8,y:p.y+8}));App.view.requestMeshPreview();await new Promise(r=>setTimeout(r,200));ok(t.preview && pixel(t.preview,1,1)[0]===255 && pixel(t.preview,4,4)[3]===0 && pixel(t.preview,12,12)[0]===255 && pixel(t.preview,9,9)[3]===0,'preview respects ellipse mask and leaves unselected corner pixels');
}
{
 const d=new Q.Doc({width:128,height:256});App.doc=d;App.view={selection:{x:0,y:0,w:128,h:128,runs:[]},locked:false};const c=d.activeCel(true);c.getContext('2d').fillRect(0,0,128,256);for(let y=0;y<128;y+=2)for(let x=0;x<128;x+=2)App.view.selection.runs.push({x,y,w:1});d.history.clear();ok(App.view.selection.runs.length===4096 && !App.beginCanvasTransform().error,'complex but valid selection can start transform');const t=App.view.meshTransform;t.points=Q.transformGrid({x:0,y:0,w:128,h:256});const err=App.applyCanvasTransform();ok(err.error && err.error.includes('4096') && !d.history.canUndo() && pixel(c,0,0)[3]===255 && pixel(c,1,1)[3]===255,'excessive transformed runs reject the whole operation without changing artwork');
}
{
 const d=setup(),c=d.activeCel(true);App.view.selection=Q.ellipseSelection({x:1,y:1},{x:7,y:7},16,16);const old=Q.selectionMask;Q.selectionMask=()=>{throw Error('allocation');};const result=App.beginCanvasTransform();Q.selectionMask=old;ok(result.error && !d.history.canUndo() && !App.view.meshTransform && pixel(c,1,1)[3]===0,'mask allocation failure refuses to start without editing');
}
console.log('6.2 direct flip controls');
{
 const d=setup(),cel=d.activeCel(true),ctx=cel.getContext('2d');let im=ctx.createImageData(2,2);im.data.set([255,0,0,255,0,255,0,255,0,0,255,255,255,255,0,255]);ctx.putImageData(im,2,2);d.history.clear();App.view.selection={x:2,y:2,w:2,h:2};App.beginCanvasTransform();let t=App.view.meshTransform;t.sampling='nearest';t.flipX=true;ok(!App.applyCanvasTransform().error && same(pixel(cel,2,2),[0,255,0,255]) && same(pixel(cel,3,2),[255,0,0,255]),'horizontal flip changes pixels without moving handles');d.history.undo();ok(same(pixel(cel,2,2),[255,0,0,255]),'flip undo restores original');
 App.view.selection={x:2,y:2,w:2,h:2};App.beginCanvasTransform();t=App.view.meshTransform;t.flipX=true;t.flipY=true;ok(!App.applyCanvasTransform().error && same(pixel(cel,2,2),[255,255,0,255]) && same(pixel(cel,3,3),[255,0,0,255]),'horizontal and vertical flips combine');
}
{
 const d=setup(),cel=d.activeCel(true),ctx=cel.getContext('2d');ctx.fillStyle='#f00';ctx.fillRect(1,1,6,6);App.view.selection={x:1,y:1,w:6,h:6,runs:[{x:1,y:1,w:2},{x:1,y:2,w:2},{x:1,y:3,w:2},{x:1,y:4,w:2},{x:1,y:5,w:2},{x:1,y:6,w:6}]};d.history.clear();App.beginCanvasTransform();const t=App.view.meshTransform;t.flipX=true;t.sampling='nearest';ok(!App.applyCanvasTransform().error && pixel(cel,1,1)[3]===0 && pixel(cel,5,1)[0]===255 && pixel(cel,3,1)[0]===255,'masked flip cuts only selected source and composites onto untouched destination');const s=App.view.selection,m=Q.selectionMask(s);ok(!!m && !m[0] && !!m[5],'masked flip mirrors the hard selection footprint');
}
console.log('6.3 gradient mapping');
{
 const im={width:4,height:1,data:new Uint8ClampedArray([0,0,0,255,128,128,128,128,255,255,255,255,200,20,20,0])}, colors=[[0,0,255],[0,255,0],[255,0,0]];
 const r=Q.gradientMap(im,colors,1,null);ok(r && same([...im.data.slice(0,4)],[0,0,255,255]) && im.data[5]>250 && same([...im.data.slice(8,12)],[255,0,0,255]),'gradient maps shadows, midtones and highlights');ok(im.data[7]===128 && same([...im.data.slice(12,16)],[200,20,20,0]),'gradient preserves alpha and ignores transparent pixels');
 const half={width:1,height:1,data:new Uint8ClampedArray([0,0,0,255])};Q.gradientMap(half,colors,0.5,null);ok(same([...half.data],[0,0,128,255]),'gradient strength blends with original colour');const untouched={width:1,height:1,data:new Uint8ClampedArray([0,0,0,255])};ok(!Q.gradientMap(untouched,colors,0,null) && !Q.gradientMap(untouched,colors,1,new Uint8Array([0])),'zero strength and mask exclusions make no changes');
}
{
 const d=setup(),cel=d.activeCel(true),c=cel.getContext('2d');c.fillStyle='#000';c.fillRect(0,0,16,16);c.clearRect(4,4,4,4);c.fillStyle='rgba(255,255,255,0.5)';c.fillRect(4,4,4,4);d.history.clear();App.view.selection=Q.ellipseSelection({x:2,y:2},{x:10,y:10},16,16);d.layer().alphaLocked=true;const alpha=pixel(cel,5,5)[3],before=[...c.getImageData(0,0,16,16).data],target=App.gradientMapTarget(),colors=[[0,0,255],[0,255,0],[255,0,0]];
 ok(App.applyGradientMap(target,colors,1).started,'gradient starts against the captured target');await new Promise(r=>setTimeout(r,80));ok(pixel(cel,5,5)[0]>200 && pixel(cel,5,5)[3]===alpha && same(pixel(cel,2,2),[0,0,0,255]) && d.history.undoStack.length===1,'gradient respects elliptical selection and preserves alpha lock');d.history.undo();ok(c.getImageData(0,0,16,16).data.every((v,i)=>v===before[i]),'gradient undo restores exact pixels');d.history.redo();ok(pixel(cel,5,5)[0]>200,'gradient redo reapplies mapped pixels');
 App.view.selection=null;d.history.clear();let t=App.gradientMapTarget();d.layer().locked=true;ok(App.applyGradientMap(t,colors,1).error && !d.history.canUndo(),'gradient refuses locked layers');d.layer().locked=false;t=App.gradientMapTarget();d.addLayer();ok(App.applyGradientMap(t,colors,1).error,'gradient rejects a stale layer');
}
{
 const d=setup(),cel=d.activeCel(true),c=cel.getContext('2d');c.fillStyle='#000';c.fillRect(0,0,16,16);d.history.clear();App.view.selection={x:1,y:1,w:8,h:8};let t=App.gradientMapTarget();const colors=[[0,0,255],[0,255,0],[255,0,0]];ok(App.applyGradientMap(t,colors,1).started,'gradient operation can be scheduled');App.view.selection.x=2;await new Promise(r=>setTimeout(r,80));ok(same(pixel(cel,4,4),[0,0,0,255]) && !d.history.canUndo() && !App.view.locked,'stale gradient selection cancels atomically and unlocks view');
 App.view.selection=null;t=App.gradientMapTarget();ok(App.applyGradientMap(t,colors,0).started,'zero-strength gradient can be requested');await new Promise(r=>setTimeout(r,80));ok(!d.history.canUndo() && same(pixel(cel,4,4),[0,0,0,255]),'zero-strength gradient adds no history');
 const old=c.getImageData.bind(c);let reads=0;c.getImageData=function(...args){if(++reads===2)throw Error('memory');return old(...args);};t=App.gradientMapTarget();App.applyGradientMap(t,colors,1);await new Promise(r=>setTimeout(r,80));c.getImageData=old;ok(!d.history.canUndo() && same(pixel(cel,4,4),[0,0,0,255]) && !App.view.locked,'gradient undo-allocation failure leaves artwork untouched');
}
{
 const big=new Q.Doc({width:4096,height:2048});big.activeCel(true);App.doc=big;App.view={selection:null,locked:false};const target=App.gradientMapTarget(),result=App.applyGradientMap(target,[[0,0,0],[128,128,128],[255,255,255]],1);ok(result.error && result.error.includes('4 MP') && !big.history.canUndo() && !App.view.locked,'gradient refuses oversized area before editing or locking');
}
console.log('6.3 cooperative connected fill');
{
  const referenceFloodFill = function (image, sx, sy, rgb, threshold, preserveAlpha, mask) {
    const w=image.width, h=image.height, data=image.data;
    sx=Math.floor(sx); sy=Math.floor(sy);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return null;
    const start=(sy*w+sx)*4, original=[data[start],data[start+1],data[start+2],data[start+3]];
    if (preserveAlpha && original[3] === 0) return null;
    const tol=Q.clamp(Number(threshold) || 0,0,128);
    if (tol === 0 && original[3] === 255 && original[0] === rgb[0] && original[1] === rgb[1] && original[2] === rgb[2]) return null;
    const visited=new Uint8Array(w*h), stack=[sy*w+sx];
    let minX=w,minY=h,maxX=-1,maxY=-1;
    function matches(index) {
      if (visited[index] || (mask && !mask[index])) return false;
      const i=index*4, a=data[i+3];
      if ((preserveAlpha && a === 0) || Math.abs(a-original[3]) > tol) return false;
      if (a === 0 && original[3] === 0) return true;
      return Math.abs(data[i]-original[0])<=tol && Math.abs(data[i+1]-original[1])<=tol && Math.abs(data[i+2]-original[2])<=tol;
    }
    while (stack.length) {
      const seed=stack.pop(), y=Math.floor(seed/w), x=seed%w;
      if (!matches(seed)) continue;
      let left=x,right=x;
      while (left>0 && matches(y*w+left-1)) left--;
      while (right+1<w && matches(y*w+right+1)) right++;
      let up=false,down=false;
      for (let px=left;px<=right;px++) {
        const index=y*w+px, i=index*4; visited[index]=1;
        data[i]=rgb[0]; data[i+1]=rgb[1]; data[i+2]=rgb[2]; if (!preserveAlpha) data[i+3]=255;
        if (y>0) { const can=matches(index-w); if (can && !up) stack.push(index-w); up=can; }
        if (y+1<h) { const can=matches(index+w); if (can && !down) stack.push(index+w); down=can; }
      }
      minX=Math.min(minX,left); maxX=Math.max(maxX,right); minY=Math.min(minY,y); maxY=Math.max(maxY,y);
    }
    return maxX<0 ? null : {x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
  };
 let seed=12345;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed;};let identical=true;
 for(let trial=0;trial<16;trial++) {const w=39,h=23,data=new Uint8ClampedArray(w*h*4),mask=new Uint8Array(w*h);for(let i=0;i<w*h;i++){data[i*4]=rnd()%4*40;data[i*4+1]=rnd()%3*45;data[i*4+2]=rnd()%3*50;data[i*4+3]=rnd()%2?255:0;mask[i]=rnd()%5?1:0;}const a={width:w,height:h,data:new Uint8ClampedArray(data)},b={width:w,height:h,data:new Uint8ClampedArray(data)},legacy={width:w,height:h,data:new Uint8ClampedArray(data)},x=rnd()%w,y=rnd()%h,alpha=!!(trial%2),tol=trial%3*20,ma=trial%2?mask:null;const old=referenceFloodFill(legacy,x,y,[90,80,70],tol,alpha,ma),one=Q.floodFill(a,x,y,[90,80,70],tol,alpha,ma),two=await Q.floodFillAsync(b,x,y,[90,80,70],tol,alpha,ma,()=>true);if(JSON.stringify(old)!==JSON.stringify(two) || JSON.stringify(one)!==JSON.stringify(two) || !a.data.every((v,i)=>v===b.data[i] && v===legacy.data[i]))identical=false;}
 for(let trial=0;trial<6;trial++) {const w=100,h=100,source=new Uint8ClampedArray(w*h*4),mask=new Uint8Array(w*h).fill(1);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const n=y*w+x,i=n*4;source[i]=x<75?30:150;source[i+1]=50;source[i+2]=80;source[i+3]=(x>35 && x<45 && y>20 && y<80)?0:255;if(x>20 && x<30 && y>30 && y<65)mask[n]=0;}const a={width:w,height:h,data:new Uint8ClampedArray(source)},b={width:w,height:h,data:new Uint8ClampedArray(source)},m=trial%2?mask:null,alpha=trial%3===0,tol=trial%2?20:0,old=referenceFloodFill(a,10,10,[200,90,50],tol,alpha,m),fresh=await Q.floodFillAsync(b,10,10,[200,90,50],tol,alpha,m,()=>true);if(JSON.stringify(old)!==JSON.stringify(fresh)||!a.data.every((v,i)=>v===b.data[i]))identical=false;}
 ok(identical,'sliced fill matches the 6.2 algorithm across colours, masks and alpha lock');
 const image={width:256,height:1024,data:new Uint8ClampedArray(256*1024*4)};let heartbeat=false;setTimeout(()=>heartbeat=true,0);const rect=await Q.floodFillAsync(image,0,0,[255,0,0],0,false,null,()=>true);ok(heartbeat && rect.w===256 && rect.h===1024 && image.data.at(-1)===255,'large connected fill yields to the event loop and completes');
}
{
 const d=new Q.Doc({width:256,height:256});App.doc=d;App.view={selection:{x:0,y:0,w:256,h:256},color:[255,0,0],dirty:false,locked:false};const cel=d.activeCel(true);d.history.clear();App.fillSource='active';App.fillScope='connected';App.fillThreshold=0;const old=Q.createFloodFillJob;Q.createFloodFillJob=function(...args){const job=old(...args),step=job.step;let first=true;job.step=function(...s){const result=step(...s);if(first){first=false;App.view.selection.x=1;}return result;};return job;};App.fillAt(10,10);await new Promise(r=>setTimeout(r,180));Q.createFloodFillJob=old;ok(pixel(cel,10,10)[3]===0 && !d.history.canUndo() && !App.view.locked,'selection changed during sliced fill prevents commit and unlocks');
}
console.log(`all ${n} raster integration checks passed`);
