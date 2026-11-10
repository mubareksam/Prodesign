/* Qalam — project persistence (IndexedDB, with a localStorage fallback for
 * WebView builds where IndexedDB is restricted).
 */
(function () {
  'use strict';
  const Q = window.Q;
  const DB_NAME = 'qalam-studio';
  const DB_VER = 1;
  const STORE = 'projects';
  const LS_KEY = 'qalam-projects';
  const LS_META = 'qalam-meta';

  let dbPromise = null;
  let useLocal = false;
  let mode = 'idb';

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VER); } catch (e) { reject(e); return; }
      req.onupgradeneeded = function (ev) {
        const db = ev.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('indexedDB error')); };
      req.onblocked = function () { reject(new Error('indexedDB blocked')); };
    });
    return dbPromise;
  }

  function tx(mode2, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        const t = db.transaction(STORE, mode2);
        const store = t.objectStore(STORE);
        let result;
        try { result = fn(store); } catch (e) { reject(e); return; }
        t.oncomplete = function () { resolve(result && result.__req ? result.__req.result : result); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('aborted')); };
      });
    });
  }

  function lsAll() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) { return {}; }
  }
  function lsPut(rec) {
    const all = lsAll();
    all[rec.id] = rec;
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  }
  function lsDel(id) {
    const all = lsAll();
    delete all[id];
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  }

  const Store = {
    mode: function () { return mode; },

    init: function () {
      return openDb().then(function () {
        mode = 'idb';
        return mode;
      }).catch(function () {
        useLocal = true;
        mode = 'local';
        return mode;
      });
    },

    list: function () {
      if (useLocal) {
        const all = lsAll();
        return Promise.resolve(Object.keys(all).map(function (k) {
          const r = all[k];
          return { id: r.id, name: r.name, updated: r.updated, thumb: r.thumb, w: r.w, h: r.h, frames: r.frameCount };
        }).sort(function (a, b) { return b.updated - a.updated; }));
      }
      return tx('readonly', function (store) {
        const out = [];
        const req = store.openCursor();
        const holder = { __req: { result: out } };
        req.onsuccess = function (ev) {
          const cur = ev.target.result;
          if (cur) {
            const r = cur.value;
            out.push({ id: r.id, name: r.name, updated: r.updated, thumb: r.thumb, w: r.w, h: r.h, frames: r.frameCount });
            cur.continue();
          }
        };
        return holder;
      }).then(function (out) {
        return out.sort(function (a, b) { return b.updated - a.updated; });
      });
    },

    save: function (doc, thumbUrl) {
      const rec = serialize(doc, thumbUrl);
      if (useLocal) {
        try {
          lsPut(rec);
          return Promise.resolve(rec);
        } catch (e) {
          Q.toast('Storage full — export your work');
          return Promise.reject(e);
        }
      }
      return tx('readwrite', function (store) { store.put(rec); return rec; });
    },

    load: function (id) {
      const get = useLocal
        ? Promise.resolve(lsAll()[id])
        : tx('readonly', function (store) {
          const req = store.get(id);
          return { __req: req };
        });
      return get.then(function (rec) {
        if (!rec) return null;
        return deserialize(rec);
      });
    },

    // Duplicate the last saved record, including every cel and future metadata,
    // without decoding/re-rendering it. add() refuses an ID collision.
    duplicate: function(id) {
      function copy(r) { return {...r,id:Q.uid(),name:String(r.name || 'Untitled').slice(0,59)+' copy',updated:Date.now()}; }
      if(useLocal) {
        try { const all=lsAll(), original=all[id]; if(!original) return Promise.reject(new Error('Artwork not found')); const rec=copy(original); if(Object.prototype.hasOwnProperty.call(all,rec.id)) return Promise.reject(new Error('Artwork ID collision')); all[rec.id]=rec; localStorage.setItem(LS_KEY,JSON.stringify(all)); return Promise.resolve(rec.id); }
        catch(e) { return Promise.reject(e); }
      }
      return openDb().then(db=>new Promise((resolve,reject)=>{
        const t=db.transaction(STORE,'readwrite'), store=t.objectStore(STORE), get=store.get(id); let newId=null;
        get.onsuccess=function(){ if(!get.result) { t.abort(); return; } const rec=copy(get.result); newId=rec.id; store.add(rec); };
        t.oncomplete=()=>resolve(newId); t.onabort=()=>reject(t.error || new Error('Artwork not found or copy failed')); t.onerror=()=>{};
      }));
    },

    remove: function (id) {
      if (useLocal) { lsDel(id); return Promise.resolve(); }
      return tx('readwrite', function (store) { store.delete(id); return true; });
    },

    meta: function (key, value) {
      if (arguments.length === 1) {
        try { return JSON.parse(localStorage.getItem(LS_META) || '{}')[key]; } catch (e) { return undefined; }
      }
      try {
        const all = JSON.parse(localStorage.getItem(LS_META) || '{}');
        all[key] = value;
        localStorage.setItem(LS_META, JSON.stringify(all));
      } catch (e) { /* ignore */ }
      return value;
    }
  };

  function serialize(doc, thumbUrl) {
    const cels = [];
    for (let fi = 0; fi < doc.frames.length; fi++) {
      const f = doc.frames[fi];
      for (let li = 0; li < f.cels.length; li++) {
        const cel = f.cels[li];
        if (!cel) continue;
        cels.push([fi, li, cel.toDataURL('image/png')]);
      }
    }
    return {
      id: doc.id,
      name: doc.name,
      w: doc.width,
      h: doc.height,
      fps: doc.fps,
      bg: doc.bg,
      onion: doc.onion,
      onionAlpha: doc.onionAlpha,
      onionFrames: doc.onionFrames,
      onionPrevFrames: doc.onionPrevFrames, onionNextFrames: doc.onionNextFrames,
      onionIncludeSkipped: doc.onionIncludeSkipped, onionLayerOnly: doc.onionLayerOnly,
      onionOriginalColor: doc.onionOriginalColor, onionAbove: doc.onionAbove,
      onionPrevColor: doc.onionPrevColor,
      onionNextColor: doc.onionNextColor,
      frameDurations: doc.frames.map(function (f) { return f.duration || 1; }),
      frameGroups: doc.frames.map(function (f) { return f.group || ''; }),
      frameSkipped: doc.frames.map(function (f) { return !!f.skipped; }),
      playMode: doc.playMode,
      playRange: doc.playRange ? {...doc.playRange} : null,
      guide: doc.guide,
      motionGuide:doc.motionGuide, motionGuideVisible:doc.motionGuideVisible,
      audioTrack:doc.audioTrack, cameraEnabled:doc.cameraEnabled, cameraKeys:doc.cameraKeys.map(k=>({...k})),
      solo:doc.solo ? {target:doc.solo.target,visibility:doc.solo.visibility.map(v=>({...v}))} : null,
      frameCount: doc.frames.length,
      layers: doc.layers.map(function (l) {
        return { id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, blend: l.blend, tag:Q.layerTag(l.tag), assisted: !!l.assisted, locked: !!l.locked, alphaLocked: !!l.alphaLocked, clipped: !!l.clipped, motionEnabled:!!l.motionEnabled, motionKeys:(l.motionKeys || []).map(k=>({...k})) };
      }),
      activeFrame: doc.activeFrame,
      activeLayer: doc.activeLayer,
      cels: cels,
      updated: Date.now(),
      thumb: thumbUrl || null
    };
  }

  function loadImage(dataUrl) {
    return new Promise(function (resolve, reject) {
      let done = false;
      const img = new Image();
      const timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error('cel image timed out'));
      }, 4000);
      img.onload = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(img);
      };
      img.onerror = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(new Error('bad cel image'));
      };
      img.src = dataUrl;
    });
  }

  function deserialize(rec) {
    const doc = new Q.Doc({ id: rec.id, name: rec.name, width: rec.w, height: rec.h, fps: rec.fps, bg: rec.bg, onion: rec.onion, onionAlpha: rec.onionAlpha, onionFrames: rec.onionFrames, onionPrevFrames: rec.onionPrevFrames, onionNextFrames: rec.onionNextFrames, onionIncludeSkipped: rec.onionIncludeSkipped, onionLayerOnly: rec.onionLayerOnly, onionOriginalColor: rec.onionOriginalColor, onionAbove: rec.onionAbove, onionPrevColor: rec.onionPrevColor, onionNextColor: rec.onionNextColor, playMode: rec.playMode, playRange: rec.playRange, guide: rec.guide, motionGuide:rec.motionGuide, motionGuideVisible:rec.motionGuideVisible, cameraEnabled:rec.cameraEnabled, cameraKeys:rec.cameraKeys, audioTrack:rec.audioTrack });
    doc.layers = (rec.layers || []).map(function (l) {
      return { id: l.id || Q.uid(), name: l.name || 'Layer', visible: l.visible !== false, opacity: l.opacity == null ? 1 : l.opacity, blend: l.blend || 'source-over', tag:Q.layerTag(l.tag), assisted: !!l.assisted, locked: !!l.locked, alphaLocked: !!l.alphaLocked, clipped: !!l.clipped, motionEnabled:!!l.motionEnabled, motionKeys:Q.sanitizeLayerMotion(l,doc.width,doc.height) };
    });
    if (!doc.layers.length) doc.layers = [Q.makeLayer('Layer 1')];
    if (rec.solo && typeof rec.solo.target==='string' && Array.isArray(rec.solo.visibility)) {
      const ids=new Set(doc.layers.map(l=>l.id)), seen=new Set(), visibility=[];
      rec.solo.visibility.slice(0,Math.max(1024,doc.layers.length)).forEach(v=>{ if(v && typeof v.id==='string' && ids.has(v.id) && !seen.has(v.id) && typeof v.visible==='boolean') { visibility.push({id:v.id,visible:v.visible}); seen.add(v.id); } });
      if(visibility.length) doc.solo={target:rec.solo.target,visibility:visibility};
    }

    const frames = [];
    for (let i = 0; i < (rec.frameCount || 1); i++) {
      const cels = [];
      for (let j = 0; j < doc.layers.length; j++) cels.push(null);
      frames.push({ cels: cels, duration: Q.clamp(Math.round((rec.frameDurations || [])[i]) || 1, 1, 60), group: String((rec.frameGroups || [])[i] || '').slice(0,32), skipped: !!(rec.frameSkipped || [])[i] });
    }
    doc.frames = frames;
    doc.normalizePlayRange(); doc.normalizeCameraKeys();
    doc.activeFrame = Q.clamp(rec.activeFrame || 0, 0, frames.length - 1);
    doc.activeLayer = Q.clamp(rec.activeLayer || 0, 0, doc.layers.length - 1);
    doc.history = new Q.History(doc);

    const jobs = (rec.cels || []).map(function (entry) {
      return loadImage(entry[2]).then(function (img) {
        const fi = entry[0], li = entry[1];
        if (!doc.frames[fi]) return;
        const cv = Q.canvas(doc.width, doc.height);
        cv.getContext('2d').drawImage(img, 0, 0, doc.width, doc.height);
        doc.frames[fi].cels[li] = cv;
      }).catch(function () { /* skip a broken cel */ });
    });

    return Promise.all(jobs).then(function () { return doc; });
  }

  Q.Store = Store;
})();
