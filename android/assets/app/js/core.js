/* Qalam — small helpers shared by every module. */
(function () {
  'use strict';
  const Q = (window.Q = window.Q || {});

  Q.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  Q.lerp = function (a, b, t) { return a + (b - a) * t; };
  Q.dist = function (x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); };
  Q.sanitizeGestureDelays = function (value) {
    function delay(n, fallback) { return Number.isFinite(n) ? Math.round(Q.clamp(n,200,2000)/20)*20 : fallback; }
    return {shape:delay(value && value.shape,380),eyedrop:delay(value && value.eyedrop,520)};
  };
  Q.sanitizeRailPreferences = function (value) {
    return {side:value && value.side==='right' ? 'right' : 'left',position:value && Number.isFinite(value.position) ? Math.round(Q.clamp(value.position,0,100)) : 50};
  };
  // Pure layout math: rails scroll when the available viewport is too short.
  Q.computeRailLayout = function (height,top,bottom,position) {
    height=Number.isFinite(height) ? Math.max(0,height) : 0; top=Number.isFinite(top) ? Q.clamp(top,0,height) : 0; bottom=Number.isFinite(bottom) ? Q.clamp(bottom,top,height) : height;
    position=Number.isFinite(position) ? Q.clamp(position,0,100) : 50;
    const available=bottom-top, sliderHeight=Math.max(80,Math.min(156,Math.floor((available-122)/2)));
    const brushHeight=Math.min(available,122+sliderHeight*2), toolsHeight=Math.min(available,326);
    return {available:available,sliderHeight:sliderHeight,brushTop:top+Math.round((available-brushHeight)*position/100),toolsTop:top+Math.round((available-toolsHeight)/2),brushHeight:brushHeight,toolsHeight:toolsHeight};
  };
  Q.sanitizeSmudgeHardness = function (value) { return typeof value==='number' && Number.isFinite(value) ? Q.clamp(value,0,1) : 1; };
  Q.uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };
  Q.now = function () { return (window.performance && performance.now) ? performance.now() : Date.now(); };
  Q.raf = function (fn) { return window.requestAnimationFrame(fn); };

  Q.el = function (sel, root) { return (root || document).querySelector(sel); };
  Q.els = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  Q.crel = function (tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  Q.canvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  };

  Q.ctx2d = function (canvas) {
    return canvas.getContext('2d', { alpha: true, desynchronized: true });
  };

  Q.copyCanvas = function (src, dst) {
    dst = dst || Q.canvas(src.width, src.height);
    if (dst.width !== src.width || dst.height !== src.height) { dst.width = src.width; dst.height = src.height; }
    const c = dst.getContext('2d');
    c.clearRect(0, 0, dst.width, dst.height);
    c.drawImage(src, 0, 0);
    return dst;
  };

  Q.debounce = function (fn, ms) {
    let t = 0;
    return function () {
      const args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  };

  /* ── colour ─────────────────────────────────────────────── */

  Q.hsvToRgb = function (h, s, v) {
    h = ((h % 360) + 360) % 360 / 60;
    const c = v * s;
    const x = c * (1 - Math.abs((h % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 1) { r = c; g = x; }
    else if (h < 2) { r = x; g = c; }
    else if (h < 3) { g = c; b = x; }
    else if (h < 4) { g = x; b = c; }
    else if (h < 5) { r = x; b = c; }
    else { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  };

  Q.rgbToHsv = function (r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return [h, max ? d / max : 0, max];
  };

  Q.hexToRgb = function (hex) {
    hex = String(hex || '').replace('#', '').trim();
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    if (hex.length !== 6 || /[^0-9a-f]/i.test(hex)) return null;
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  };

  // Hue relationships retain saturation and value, with a useful minimum for
  // neutrals; achromatic hue comes from the colour picker's remembered hue.
  Q.colorHarmonies = function (h,s,v) {
    h=Number.isFinite(h) ? ((h%360)+360)%360 : 210;
    s=Q.clamp(Number.isFinite(s) ? s : 0,0.5,1); v=Q.clamp(Number.isFinite(v) ? v : 0,0.65,1);
    return [['Analogous −30°',-30],['Analogous +30°',30],['Complementary',180],['Triadic −120°',-120],['Triadic +120°',120],['Split complementary −150°',-150],['Split complementary +150°',150]].map(function(entry){ return {name:entry[0],rgb:Q.hsvToRgb((h+entry[1]+360)%360,s,v)}; });
  };

  Q.rgbToHex = function (rgb) {
    return '#' + rgb.map(function (v) {
      const s = Q.clamp(Math.round(v), 0, 255).toString(16);
      return s.length === 1 ? '0' + s : s;
    }).join('');
  };

  // Versioned sets are migrated only on the first multi-palette operation.
  // The old key remains untouched as a downgrade/legacy snapshot.
  const PALETTE_KEY='qelem-palettes-v1', LEGACY_PALETTE='qelem-palette';
  function validColors(colors) { if(!Array.isArray(colors) || colors.length>24) return false; for(const c of colors) if(typeof c!=='string' || !/^#[0-9a-f]{6}$/.test(c)) return false; return new Set(colors).size===colors.length; }
  function legacyPalette() {
    const raw=localStorage.getItem(LEGACY_PALETTE); let saved;
    try { saved=JSON.parse(raw || '[]'); } catch(e) { return []; }
    if(!Array.isArray(saved)) return []; const out=[];
    for(const value of saved.slice(0,256)) { if(typeof value!=='string' || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) continue; const c=Q.rgbToHex(Q.hexToRgb(value)); if(!out.includes(c)) out.push(c); if(out.length===24) break; } return out;
  }
  function paletteState() {
    try {
      const raw=localStorage.getItem(PALETTE_KEY);
      if(raw===null) return {legacy:true,active:'default',palettes:[{id:'default',name:'My palette',colors:legacyPalette()}]};
      if(raw.length>65536) throw Error('invalid'); const data=JSON.parse(raw);
      if(!data || data.version!==1 || !Array.isArray(data.palettes) || data.palettes.length<1 || data.palettes.length>8 || typeof data.active!=='string') throw Error('invalid');
      const ids=new Set(), palettes=[];
      for(const p of data.palettes) {
        if(!p || typeof p.id!=='string' || !(p.id==='default' || /^palette-[a-z0-9]{1,40}$/.test(p.id)) || ids.has(p.id) || typeof p.name!=='string' || !p.name.trim() || p.name.length>40 || !validColors(p.colors)) throw Error('invalid');
        ids.add(p.id); palettes.push({id:p.id,name:p.name,colors:p.colors.slice()});
      }
      if(!ids.has(data.active)) throw Error('invalid'); return {legacy:false,active:data.active,palettes:palettes};
    } catch(e) {
      // Do not overwrite unreadable/newer data. Preserve and show the old palette
      // as a read-only fallback, even if storage itself is unavailable.
      let colors=[]; try { colors=legacyPalette(); } catch(ignore) {}
      return {error:'Palette storage is unavailable or invalid. Existing data was not changed.',legacy:true,active:'default',palettes:[{id:'default',name:'My palette (read only)',colors:colors}]};
    }
  }
  function savePaletteState(state) { try { localStorage.setItem(PALETTE_KEY,JSON.stringify({version:1,active:state.active,palettes:state.palettes})); return true; } catch(e) { return false; } }
  Q.paletteSets = function () { return paletteState(); };
  Q.readSavedPalette = function () { const s=paletteState(); return s.palettes.find(p=>p.id===s.active).colors.slice(); };
  Q.writeSavedPalette = function (colors,expectedId) {
    if(!validColors(colors)) return false; const state=paletteState(); if(state.error || (expectedId && state.active!==expectedId)) return false;
    if(state.legacy) { try { localStorage.setItem(LEGACY_PALETTE,JSON.stringify(colors)); return true; } catch(e) { return false; } }
    state.palettes.find(p=>p.id===state.active).colors=colors.slice(); return savePaletteState(state);
  };
  Q.managePalette = function (op,id,name) {
    const s=paletteState(); if(s.error) return {error:s.error};
    const selected=s.palettes.find(p=>p.id===id);
    if(!selected || s.active!==id) return {error:'Palette changed; reopen the dialog.'};
    if(op==='select') return {error:'Use the palette selector.'};
    if(op==='create' || op==='duplicate' || op==='rename') {
      name=typeof name==='string' ? name.trim() : ''; if(!name || name.length>40) return {error:'Enter a name of up to 40 characters.'};
      if(op==='rename') selected.name=name;
      else {
        if(s.palettes.length>=8) return {error:'Palette limit reached (8).'};
        const newId='palette-'+Q.uid(); if(!/^palette-[a-z0-9]{1,40}$/.test(newId) || s.palettes.some(p=>p.id===newId)) return {error:'Could not create a unique palette ID.'};
        s.palettes.push({id:newId,name:name,colors:op==='duplicate' ? selected.colors.slice() : []}); s.active=newId;
      }
    } else if(op==='delete') {
      if(s.palettes.length===1) return {error:'Keep at least one palette.'};
      s.palettes=s.palettes.filter(p=>p.id!==id); s.active=s.palettes[0].id;
    } else return {error:'Unknown palette operation.'};
    return savePaletteState(s) ? {active:s.active} : {error:'Could not save palette on this device.'};
  };
  Q.selectPalette = function (id) {
    const s=paletteState(); if(s.error) return {error:s.error};
    if(!s.palettes.some(p=>p.id===id)) return {error:'Palette not found.'};
    if(s.active===id) return {active:id}; s.active=id;
    return savePaletteState(s) ? {active:id} : {error:'Could not save palette on this device.'};
  };
  Q.parsePaletteHex = function (text) {
    if(typeof text!=='string' || text.length>2048) return {error:'Enter at most 2048 characters.'};
    const parts=text.trim() ? text.trim().split(/[\s,;]+/) : []; if(!parts.length || parts.length>96) return {error:'Enter 1–96 HEX colour codes.'};
    const out=[]; for(const p of parts) { if(!/^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(p)) return {error:'Invalid HEX colour: '+p.slice(0,30)}; const hex=Q.rgbToHex(Q.hexToRgb(p)); if(!out.includes(hex)) out.push(hex); }
    return {colors:out};
  };

  // Extract approximate frequent colours from a small downscaled copy of one cel.
  // Alpha-weighting excludes transparent pixels and gives faint pixels less weight.
  Q.extractCelColors = function (cel, limit) {
    if(!cel || !cel.width || !cel.height || !Number.isFinite(limit) || limit<=0) return [];
    const scale=Math.min(1,128/Math.max(cel.width,cel.height));
    const sample=Q.canvas(Math.max(1,Math.round(cel.width*scale)),Math.max(1,Math.round(cel.height*scale)));
    const ctx=sample.getContext('2d'); ctx.drawImage(cel,0,0,sample.width,sample.height);
    const data=ctx.getImageData(0,0,sample.width,sample.height).data, bins=new Map();
    for(let i=0;i<data.length;i+=4) {
      const a=data[i+3]; if(a<16) continue;
      const key=(data[i]>>4)*256+(data[i+1]>>4)*16+(data[i+2]>>4); let bin=bins.get(key);
      if(!bin) { bin={key:key,weight:0,r:0,g:0,b:0}; bins.set(key,bin); }
      bin.weight+=a; bin.r+=data[i]*a; bin.g+=data[i+1]*a; bin.b+=data[i+2]*a;
    }
    return [...bins.values()].sort((a,b)=>b.weight-a.weight || a.key-b.key).slice(0,Math.min(24,Math.floor(limit))).map(b=>Q.rgbToHex([b.r/b.weight,b.g/b.weight,b.b/b.weight]));
  };
  Q.sortPalette = function (colors, mode) {
    if(mode!=='hue' && mode!=='brightness') return colors.slice();
    return colors.map((hex,i)=>{ const rgb=Q.hexToRgb(hex), hsv=Q.rgbToHsv(rgb[0],rgb[1],rgb[2]); return {hex:hex,i:i,h:hsv[0],s:hsv[1],v:hsv[2]}; }).sort((a,b)=>mode==='brightness' ? a.v-b.v || a.h-b.h || a.i-b.i : (a.s<0.05)-(b.s<0.05) || a.h-b.h || a.v-b.v || a.i-b.i).map(x=>x.hex);
  };

  Q.rgba = function (rgb, a) {
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (a == null ? 1 : a) + ')';
  };

  /* ── tiny UI helpers ────────────────────────────────────── */

  let toastTimer = 0;
  Q.toast = function (msg, ms) {
    const t = Q.el('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 1900);
  };

  let hintTimer = 0;
  Q.hint = function (msg, ms) {
    const t = Q.el('#hint');
    if (!t) return;
    if (!msg) { t.classList.remove('show'); return; }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 2400);
  };

  Q.haptic = function (ms) {
    if (navigator.vibrate) { try { navigator.vibrate(ms || 8); } catch (e) { /* ignore */ } }
  };

  Q.fatal = function (err) {
    console.error(err);
    let box = document.getElementById('fatal');
    if (!box) {
      box = Q.crel('div');
      box.id = 'fatal';
      document.body.appendChild(box);
    }
    const text = (err && (err.stack || err.message)) || String(err);
    box.textContent = 'Qelem hit an error\n\n' + text;
  };

  window.addEventListener('error', function (e) {
    if (e && e.error) Q.fatal(e.error);
  });
  window.addEventListener('unhandledrejection', function (e) {
    if (e && e.reason) Q.fatal(e.reason);
  });

  /* ── native bridge (absent when running in a plain browser) ── */

  Q.native = function () { return window.QalamNative || null; };

  Q.saveBytes = function (dataUrl, mime, name) {
    const b64 = String(dataUrl).split(',')[1] || '';
    const nat = Q.native();
    if (nat && nat.saveImage) {
      try { return nat.saveImage(b64, mime, name); } catch (e) { console.warn('native save failed', e); }
    }
    // browser fallback so the same code can be tested on a desktop
    try {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      return true;
    } catch (e) {
      return false;
    }
  };

  Q.stamp = function (d) {
    const x = new Date(d || Date.now());
    const p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return x.getFullYear() + p(x.getMonth() + 1) + p(x.getDate()) + '-' + p(x.getHours()) + p(x.getMinutes()) + p(x.getSeconds());
  };
})();
