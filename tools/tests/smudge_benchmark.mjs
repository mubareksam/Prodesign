/* Optional local CPU/raster benchmark; not a measurement of Android latency. */
import { createCanvas } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
const js=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../android/assets/app/js');
globalThis.window=globalThis;
globalThis.addEventListener=()=>{};
globalThis.document={createElement:()=>createCanvas(1,1)};
Object.defineProperty(globalThis,'navigator',{value:{vibrate(){}},configurable:true});
for(const file of ['core.js','doc.js','brushes.js','selection.js']) new Function(readFileSync(path.join(js,file),'utf8'))();
Q.toast=()=>{};
const originalPath=Q.selectionPath; let paths=0; Q.selectionPath=function(...args){paths++; return originalPath(...args);};
const times=[];
for(let run=0;run<4;run++) {
 const d=new Q.Doc({width:2048,height:2048}), c=d.activeCel(true).getContext('2d'); c.fillStyle='#f00';c.fillRect(0,0,1024,2048);c.fillStyle='#00f';c.fillRect(1024,0,1024,2048);
 const runs=Array.from({length:512},(_,i)=>({x:650,y:700+i,w:800}));
 const s=new Q.SmudgeStroke(d,50,0.7,{x:650,y:700,w:800,h:512,runs},0.5); paths=0;
 const begin=performance.now();s.begin({x:800,y:900});for(let i=1;i<=600;i++)s.add({x:800+i*0.5,y:900});s.end();
 times.push({milliseconds:Math.round(performance.now()-begin),selectionPaths:paths,undoTiles:d.history.undoStack[0]?.tiles?.length || 0});
}
console.log('Desktop raster benchmark, 2048×2048 cel, 512-run selection, 600 input samples. Not Android latency.');
console.log(JSON.stringify(times,null,2));
