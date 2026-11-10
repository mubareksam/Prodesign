/* Optional real-Chromium layout/interaction regression. Set CHROMIUM_PATH to a
 * locally installed executable; Android WebView/real-device testing is still needed.
 * Run from tools/tests: CHROMIUM_PATH=/path/to/chromium npm run test:browser */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const executablePath=process.env.CHROMIUM_PATH;
if(!executablePath) throw new Error('Set CHROMIUM_PATH to a local Chromium executable');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../android/assets/app');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'};
const server=createServer(async(req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
  const full=path.resolve(root,name);
  if(!full.startsWith(root+path.sep)) { res.writeHead(403).end(); return; }
  try { const data=await readFile(full); res.writeHead(200,{'content-type':mime[path.extname(full)] || 'application/octet-stream'}).end(data); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath,args:['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage']});
let checks=0;
function ok(condition,label) { assert.ok(condition,label); checks++; console.log('  ✓ '+label); }
try {
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  for(const [name,width,height] of [['narrow phone',320,640],['phone',390,844],['landscape',800,360],['tablet',1024,768]]) {
    await page.setViewportSize({width,height}); await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(()=>window.Q && Q.App && Q.App.ready); await page.evaluate(()=>Q.App.createDoc(128,128,'Browser layout')); await page.waitForTimeout(200);
    const top=await page.evaluate(()=>{ const bar=document.querySelector('.topbar').getBoundingClientRect(); return [...document.querySelectorAll('.topbar button')].map(b=>{ const r=b.getBoundingClientRect(); return {id:b.id,left:r.left,right:r.right,top:r.top,bottom:r.bottom,barLeft:bar.left,barRight:bar.right,barBottom:bar.bottom,width:r.width,height:r.height}; }); });
    ok(top.length===7 && top.every(r=>r.left>=r.barLeft && r.right<=r.barRight && r.bottom<=r.barBottom && r.width>=36 && r.height>=40),name+' toolbar buttons fit and retain touch targets');
    await page.locator('#btnSelection').click(); ok(await page.locator('#modalBody h2').textContent()==='Selection & transform',name+' selection shortcut opens'); await page.locator('#modalBody .btn.ghost').last().click();
    await page.locator('#btnBrush').click(); ok(await page.locator('#btnBrush').getAttribute('aria-expanded')==='true' && await page.locator('#trayBody .brush-card').count()===28,name+' brush library opens with thumbnails');
    await page.locator('#tray').evaluate(el=>el.scrollTop=el.scrollHeight); const sticky=await page.locator('#trayBody [aria-label="Close panel"]').boundingBox(), panel=await page.locator('#tray').boundingBox();
    ok(sticky && sticky.y>=panel.y && sticky.y+sticky.height<=panel.y+panel.height,name+' close button stays visible when panel scrolls'); await page.locator('#trayBody [aria-label="Close panel"]').click();
    await page.locator('#btnLayers').click(); const bounds=await page.evaluate(()=>{const row=document.querySelector('.layer-row').getBoundingClientRect(); return [...document.querySelectorAll('.layer-row .mini-btn')].map(b=>{const r=b.getBoundingClientRect();return r.left>=row.left && r.right<=row.right && r.width>=36 && r.height>=40;});}); ok(bounds.length===3 && bounds.every(Boolean),name+' layer controls fit in their row'); await page.locator('#trayBody [aria-label="Close panel"]').click();
    await page.locator('#btnColor').click(); const color=await page.evaluate(()=>{const wheel=document.querySelector('#wheel').getBoundingClientRect(), input=document.querySelector('.hexrow input').getBoundingClientRect(), tray=document.querySelector('#tray').getBoundingClientRect(); return {w:wheel.width,h:wheel.height,left:input.left,right:input.right,trayLeft:tray.left,trayRight:tray.right};}); ok(Math.abs(color.w-color.h)<1 && color.left>=color.trayLeft && color.right<=color.trayRight,name+' colour wheel remains round and HEX field fits'); await page.locator('#trayBody [aria-label="Close panel"]').click();
    await page.evaluate(()=>Q.UI.paintLayerDialog('gradient')); const gradientFit=await page.evaluate(()=>[...document.querySelectorAll('.paint-colour')].every(box=>{const b=box.getBoundingClientRect(),r=box.querySelector('input.select').getBoundingClientRect(); return r.left>=b.left && r.right<=b.right;})); ok(gradientFit,name+' gradient colour fields fit the dialog'); await page.locator('#modalBody .btn.ghost').filter({hasText:'Cancel'}).click();
    await page.locator('#btnTimeline').click(); await page.locator('#timeline .tl-add').scrollIntoViewIfNeeded(); ok(await page.locator('#timeline .tl-add').isVisible(),name+' animation frame add control remains reachable'); await page.locator('#btnTimeline').click();
    await page.evaluate(()=>Q.UI.setTheme('light',false)); await page.locator('#btnLayers').click(); const colors=await page.evaluate(()=>({surface:getComputedStyle(document.querySelector('#tray')).backgroundColor,text:getComputedStyle(document.querySelector('.layer-name')).color})); ok(colors.surface!=='rgba(0, 0, 0, 0)' && colors.text!=='rgb(255, 255, 255)',name+' light theme has readable layer text'); await page.locator('#trayBody [aria-label="Close panel"]').click();
    await page.evaluate(()=>{Q.UI.setTheme('dark',false);Q.UI.applyRailPreferences({side:'right',position:50},false);Q.UI.openTray('layers');});
    if(width>=700) { const a=await page.locator('#tray').boundingBox(); ok(a.x<width/2,name+' floating panel follows swapped tool rail'); }
    await page.evaluate(()=>Q.UI.closeTray());
  }
  await page.setViewportSize({width:320,height:640}); await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(()=>window.Q && Q.App && Q.App.ready);
  await page.evaluate(()=>{ Q.App.createDoc(128,128,'Touch selection'); Q.App.addLayer(); Q.App.addLayer(); Q.UI.openTray('layers'); });
  await page.locator('#splash').waitFor({state:'hidden'});
  const touch=await page.context().newCDPSession(page), row=page.locator('.layer-row').last(); await row.scrollIntoViewIfNeeded();
  const r=await row.boundingBox(), before=await page.evaluate(()=>({active:Q.App.doc.layer().id,opacity:Q.App.doc.layers[0].opacity}));
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+45,y:r.y+20}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+110,y:r.y+20}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  ok(await page.locator('.layer-row[aria-pressed="true"]').count()===2 && await page.evaluate(b=>Q.App.doc.layer().id===b.active && Q.App.doc.layers[0].opacity===b.opacity,before),'real touch swipe selects a second layer without changing opacity or active layer');
  await page.getByText('Actions · 2').click(); await page.getByText('Duplicate selected').click();
  ok(await page.evaluate(()=>Q.App.doc.layers.length===5),'touch-selected batch duplicate works');
  await page.locator('#btnUndo').click(); ok(await page.evaluate(()=>Q.App.doc.layers.length===3),'batch duplicate can be undone from toolbar');
  await page.evaluate(()=>Q.UI.openTray('layers')); await page.getByText('Select layers',{exact:true}).click(); await page.locator('.layer-row').nth(1).click();
  ok(await page.locator('.layer-row[aria-pressed="true"]').count()===3,'tap selection mode works on a narrow phone');
  const brand=await page.locator('#splash span').textContent(); ok(brand==='Qelem','loading and app name use corrected spelling');
  ok(errors.length===0,'no browser runtime errors'); console.log(`all ${checks} browser layout checks passed`);
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
