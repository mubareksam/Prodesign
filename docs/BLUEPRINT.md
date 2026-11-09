# Qalam — build blueprint

A complete specification for rebuilding this app from scratch in a fresh session /
repository. Everything below was validated in this repo: the engine, the build
pipeline and three test suites all pass against it.

Read this top to bottom before writing code. §15 is a ready-to-paste bootstrap
prompt, §14 lists the traps that cost the most time.

---

## 1. What you are building

**Qalam** — an offline painting + frame-animation app for Android, modelled on
Procreate. Acceptance criteria:

1. A **signed, installable `.apk`** that installs on a stock Android 8+ phone and
   runs with no network permission.
2. Procreate-like feature set: pressure brushes, layers with blend modes, colour
   picker, animation timeline with onion skin, PNG + GIF export, autosaving gallery.
3. Procreate's gesture vocabulary: two-finger tap undo, three-finger tap redo,
   pinch/rotate, long-press eyedropper, hold-to-snap QuickShape.
4. A written analysis of Procreate (`docs/procreate-analysis.md`) and an app guide
   (`docs/qalam.md`).
5. Buildable from source with **no Android SDK and no Gradle** — a static `aapt2`,
   apktool's smali assembler, and a v1+v2 signer.
6. Headless tests that drive the real UI (not mocks of it).

---

## 2. Architecture decision: a WebView app, packaged by hand

The app is **plain HTML/CSS/JS** loaded from `assets/app/index.html` into a
`WebView`, plus ~400 lines of hand-written smali for the activity and the JS↔Java
bridge. Consequences, all deliberate:

| Decision | Why |
|---|---|
| Canvas 2D, no native renderer | One code path for drawing, compositing, export; still hardware accelerated inside a WebView. |
| All state in JS | No serialisation boundary; the gallery, layers, frames and history are plain objects. |
| Two Java classes only (`MainActivity`, `Bridge`) | Keeps the smali small enough to hand-write. |
| `apktool b --use-aapt2` for resources + dex | Works without the Android SDK; smali is assembled by apktool's bundled smali 2.3.4. |
| `apk_sign_ts` (npm) for signing | Produces v1+v2 blocks with no `jarsigner`, no keystore tooling. |
| No external JS libraries | Offline build, 200 KB APK, nothing to audit. |

The app must degrade gracefully in a plain desktop browser (used by the jsdom
tests): the native bridge is optional, storage falls back to `localStorage`, and
`Q.saveBytes` falls back to a `Blob` download link.

---

## 3. Target repository layout

```
android/
  AndroidManifest.xml          package com.qalam.studio, minSdk 26, targetSdk 33
  apktool.yml                  apktool metadata (must exist or the build refuses)
  res/
    values/{strings,colors,styles}.xml
    mipmap-{m,h,xh,xxh,xxxh}dpi/{ic_launcher.png,ic_fore.png}
    mipmap-anydpi-v26/ic_launcher.xml      adaptive icon (bg colour + fg bitmap)
  assets/app/
    index.html                 107 lines: gallery + studio markup
    css/app.css                343 lines: dark touch UI
    js/core.js                 179: DOM/colour/canvas helpers, toasts, bridge
    js/doc.js                  417: Doc + History (layers, frames, cels)
    js/brushes.js              410: 11 presets, sprites, Q.Stroke
    js/gif.js                  295: quantiser, LZW, GifWriter
    js/view.js                 522: viewport, input, gestures, QuickShape
    js/storage.js              235: IndexedDB + localStorage fallback
    js/ui.js                   971: trays, colour wheel, timeline, dialogs
    js/app.js                  414: shell, saving, export, back button
  smali/com/qalam/studio/{MainActivity,Bridge,BackCb}.smali
  reference/{MainActivity,Bridge,BackCb}.java   javac-compilable mirrors
tools/
  fetch-toolchain.sh           JVM + apktool + aapt2 + android.jar + npm modules
  build.sh                     type-check → build → sign → verify
  check_reference.sh           javac the reference/*.java against android.jar
  verify_apk.py                independent APK verifier (zip/arsc/dex/v2 sig)
  make_icons.py                icon source → mipmaps + adaptive icon
  apksign/{sign.mjs,key.pem,cert.pem,package.json}
  tests/{engine_smoke.mjs,gif_roundtrip.mjs,gif_decode.py,ui_smoke.mjs,package.json}
dist/Qalam-1.0.apk
docs/{procreate-analysis.md,qalam.md}
```

Load order of the scripts in `index.html` is strict: **core → doc → brushes → gif →
view → storage → ui → app**.

---

## 4. UI specification

Two full-screen views inside `#app`, toggled by a `.hidden` class.

### Gallery (`#gallery`)
`#galGrid` (cards: thumbnail, name, `WxH · N frames · N layers`), `#galEmpty`
(empty state), `#btnNew` (primary button).

Tapping a card opens the document; long-press / card menu offers rename + delete
(with a confirm dialog).

### Studio (`#studio`)
- `canvas#view` — the only canvas the user sees.
- Top bar: `#docTitle`, `#docMeta`, `#btnUndo`, `#btnRedo`, `#btnEyedrop`,
  `#btnMenu`.
- Bottom bar: `#btnGallery`, `#btnLayers`, `#btnBrush`, `#btnColor`, `#btnTimeline`.
- Slider strip: `#sizeSlider` / `#sizeVal`, `#opacitySlider` / `#opacityVal`.
- Tray: `#tray` > `#trayBody` (one tray open at a time; opening a tray closes the
  others; drawing closes it).
- `#timeline` — horizontal strip of frame thumbnails + add/duplicate/delete + play +
  fps chip + onion chip.
- `#modal` > `#modalBody` — every dialog and action sheet is built here.
- `#toast`, `#hint` (transient text), `#fatal` (error overlay).

Design language: background `#0e0e10`, panels `#17171c`, accent `#f0b46a`, text
`#ececf1`, 12–16 px radii, no chrome around the canvas. All controls ≥44 px.
`-webkit-touch-callout: none`, `overscroll-behavior: none`, `touch-action: none` on
the canvas.

### Dialogs (all in `ui.js`)
`newCanvasDialog` — name field + 6 presets (Square 2048², Portrait 1600×2133,
Landscape 2133×1600, HD 1920×1080, Animation 1280², Story 1080×1920) + Create.
`exportDialog` — GIF scale (50/100/150 %) + loop (forever/once/3×) + Export.
`layerSheet(i)` — rename, blend select, move up/down, duplicate, clear, merge down,
delete.
`confirm(title, body, onYes)`, `progress(title, label, frac)` / `endProgress`,
`helpSheet()` ("Gestures & help"), `aboutSheet()`.

Trays: **brushes** (cards with live brush previews), **layers** (rows: thumbnail,
name, `NN% · Blend`, eye toggle, drag-free ▲▼ in the sheet), **colour** (wheel +
value/sat square, hex input, 24 swatches, 12 recents), **menu** (2-column action
grid: Export PNG, Export animation, New canvas, Add frame, Onion skin, Flip canvas,
Rotate 90°, Zoom to fit, Reset view, Save now, Delete frame (only when >1 frame),
Gestures & help, About Qalam).

---

## 5. Data model (`doc.js`)

```js
Doc = {
  id, name, width, height, bg: '#ffffff',
  fps: 12,              // 6..30, step 2 in the UI
  onion: false,
  layers: [{ id, name, visible, opacity, blend }],   // blend = canvas composite op
  frames: [{ cels: [canvas|null per layer] }],       // lazily allocated
  activeFrame: 0, activeLayer: 0,
  history: History
}
```

Rules:

- **Frames are layers.** `frames[f].cels[l]` is created on first paint
  (`activeCel(true)`), so an empty 20-frame animation costs nothing.
- `activeCel(create)` returns the cel for `activeFrame`/`activeLayer`.
- `renderFrame(f)` composites bg + every visible cel bottom-up using
  `globalCompositeOperation = layer.blend` and `globalAlpha = layer.opacity`.
- `flatten(f)` returns a fresh canvas of the whole frame (used by export).
- `thumbnail(f, size)` renders the frame scaled into a JPEG-able canvas.
- `memoryMB()` = Σ cel pixels × 4 / 1e6, shown in `#docMeta`.
- Structural changes (add/remove/reorder layer or frame) go through
  `history.struct(fn)`, which snapshots the layer/frame lists before and after.
- **Pixel undo:** `history.beginPixels(cel)` copies the cel into `history.snap`
  (a reused full-size canvas). `endPixels(rect)` stores only the *before* pixels of
  the dirty rectangle. Max **36** entries; a stroke = exactly one entry.
  `undo()` restores `before` and keeps the current pixels for redo.

Blend modes (16, in this order): Normal `source-over`, Multiply, Screen, Overlay,
Darken, Lighten, Color dodge, Color burn, Hard light, Soft light, Difference,
Exclusion, Hue, Saturation, Color, Luminosity.

---

## 6. Brush engine (`brushes.js`)

### Model: resampled stamping
A pointer path is resampled at `spacing × size` and each sample stamps a sprite.
Per stamp:

- `width = size × (1 - pressureSize × (1 - pressure)) × (1 - velocitySize × clamp(speed))`
- `alpha = brush.opacity × (1 - pressureAlpha × (1 - pressure))`
- taper multiplies width near the start of the stroke (`taperIn` fraction of 64 px).
- `jitter` (position) and `scatter` (perpendicular offset) add hand-made noise.

`speed` is an EMA of `distance / dt` with α = 0.35; `pressure` is an EMA with
α = 0.55 (`pressure <= 0` → 1).

### Wet accumulation (this is what makes it look real)
If `opacity < 0.995` or `flow < 0.995`, the stroke is **wet**: stamps go into a
scratch canvas (`Q.strokeBuffer(w,h)`) at `flow` alpha, and on every flush the dirty
rectangle is rebuilt in the cel as:

```
cel = snapUnderStroke          // history.snap = the cel at stroke start
composite(wetBuffer, globalAlpha = strokeOpacity)
```

so a stroke never darkens where it overlaps itself. `flow` only affects how much
paint each stamp deposits.

Stamps are the sprite drawn as `fill` (solid disc with hardness falloff), `soft`
(radial gradient) or `grain` (disc + procedural paper noise on a second pass).

### The 11 presets

| id | name | engine | size | opacity | flow | spacing | pressureSize / Alpha | notes |
|---|---|---|---|---|---|---|---|---|
| studio | Studio pen | fill | 14 | 1 | 1 | 0.06 | 0.9 / 0.3 | streamline 0.25, taper 0.12 |
| inking | Inking pen | fill | 7 | 1 | 1 | 0.035 | 0.75 / 0.15 | hardest edge, streamline 0.45 |
| monoline | Monoline | fill | 9 | 1 | 1 | 0.04 | 0 / 0 | no dynamics, streamline 0.55 |
| technical | Technical pencil | grain | 5 | 1 | 0.55 | 0.09 | 0.5 / 0.85 | jitter .08, scatter .18 |
| pencil | 6B pencil | grain | 15 | 0.92 | 0.42 | 0.11 | 0.65 / 0.9 | grain .85 |
| marker | Marker | soft | 26 | 0.55 | 0.85 | 0.05 | 0.3 / 0.35 | flat, wide |
| airbrush | Airbrush | soft | 70 | 0.85 | 0.12 | 0.07 | 0.5 / 0.75 | hardness .05 |
| charcoal | Charcoal | grain | 40 | 0.95 | 0.35 | 0.08 | 0.55 / 0.85 | jitter .18, scatter .3 |
| water | Watercolour | soft | 55 | 0.4 | 0.3 | 0.05 | 0.45 / 0.55 | slow build-up |
| eraser | Hard eraser | fill | 30 | 1 | 1 | 0.05 | 0.6 / 0 | `eraser: true` |
| soft-eraser | Soft eraser | soft | 60 | 0.55 | 0.6 | 0.06 | 0.4 / 0.4 | `eraser: true` |

Stroke opacity handed to `Q.Stroke` is `view.opacity × brush.opacity`.

Erasers use `destination-out` in the cel; `fill`-engine erasers skip the wet buffer.

---

## 7. Viewport & input (`view.js`)

State: `scale`, `rot` (radians), `tx`, `ty`, `dpr = min(devicePixelRatio, 2.5)`.
`toDoc(sx,sy)` = inverse rotate/scale/translate; `toScreen` is its inverse.
`fit()` = `min(cssW/w, cssH/h) × 0.86`, centred, rotation 0.
`zoomAt(factor, sx, sy)` and `rotateBy(deg)` keep the point under the fingers fixed.

Rendering is demand-driven: a `dirty` flag, redrawn in `requestAnimationFrame`.
Per frame: fill `#0b0b0e`, then draw the paper (bg + a soft drop shadow), the onion
skins (`doc.onion`, previous frame at 0.22 alpha tinted, next at 0.14), the current
frame, the in-progress wet buffer if any, and the canvas border.

### Pointer handling
- Track pointers in a `Map` keyed by `pointerId`, each with `startX/startY/t`.
- `_pressure(e)`: `pointerType === 'pen'|'mouse'` → `e.pressure` (clamped 0.04…1,
  `<=0.001` → 0.35 for pen, 1 otherwise); touch → 1.
- **Palm rejection:** ignore a new pointer only while the *active stroke came from a
  pen* (`strokePointerType === 'pen'`); finger strokes may escalate to gestures.
- Second pointer while a finger stroke exists → cancel the stroke, start a gesture.
- `pointermove` consumes `getCoalescedEvents()` when available.

### Gestures
| Gesture | Implementation |
|---|---|
| two-finger drag | translate by the centroid delta |
| pinch / twist | scale by distance ratio (clamp 0.02…24), rotate by angle delta, anchored at the centroid |
| two-finger tap | on last pointer up: `!g.moved && g.maxPointers === 2` → undo |
| three-finger tap | same with `g.maxPointers >= 3` → redo |
| long-press (still) | 520 ms idle with `stroke.len <= size*0.8` → `_holdEyedrop()` (pick colour, cancel stroke) |
| hold at end of a long stroke | 380 ms idle with `stroke.len > size*0.8` → `_quickShape()` |

Timing: a hold timer polls every 120 ms; `_lastStampTime` is updated on every move,
so "idle" means no painting. A tap is `< 6 px` movement and `< 320 ms`.

**Critical:** `g.maxPointers` must be a running maximum — bump it on every pointer
down that joins the gesture and when re-anchoring after a finger lifts. Resetting it
turns a three-finger tap into an undo.

### QuickShape
On trigger: `w = dist(strokeStartDoc, lastPoint)`; abort if `w < 8`. Closed if
`w < max(bbox.w, bbox.h) * 0.55` → ellipse inscribed in the stroke's dirty bbox
(76 points), otherwise a straight line from start to end. Cancel the freehand stroke,
replay the idealised points through a **fresh** `Q.Stroke` (pressure 0.7→0.9) so the
result picks up the brush's dynamics, then `end()` once. One history entry, haptic +
`Q.hint('Quickshape · line|ellipse')`.

---

## 8. Animation (`app.js` + `ui.js` timeline)

- Timeline strip renders one button per frame with `doc.thumbnail`.
- Add frame (`addFrame(copyCurrent)`), duplicate, delete, select, scrub.
- Playback: `setTimeout` chain at `1000 / doc.fps`, wrapping at the end; stops on
  user input; ▶/■ toggle.
- Onion skin auto-enables when the second frame is created; toggle in the timeline
  and in the menu. Disabled automatically above 1200×1200 for performance.
- fps chip cycles 6 → 8 → … → 28 → 6.

---

## 9. GIF encoder (`gif.js`)

Pure JS, no dependencies. Three parts:

1. **Median-cut quantiser** — build a 5-bit-per-channel histogram, split the box
   with the largest channel range at its weighted median, until 256 boxes; palette =
   mean colour of each box; map pixels by nearest palette entry with a per-colour
   cache. Returns `{ palette, indices, size: 256, background }`.
2. **LZW** — standard GIF LZW with a 12-bit code ceiling and clear code. **Encoder
   rule:** grow the code size when `nextCode === (1 << codeSize) + 1` (not `== 1 <<
   codeSize`); this off-by-one is the classic bug that makes other decoders fail.
3. **GifWriter** — `GIF89a` header, logical screen descriptor, Netscape loop
   extension (`loop = 0` → forever), then per frame: graphic control extension
   (delay in centiseconds, `max(2, round(delayCs))`), image descriptor with a local
   256-entry colour table, LZW data in ≤255-byte sub-blocks, trailer `0x3B`.

API: `Q.encodeGif(canvases, { delayCs, loop, background, onProgress }) → { dataUrl, bytes }`.
Export size options are 50/100/150 %, delay = `round(100 / fps)` cs.

---

## 10. Persistence (`storage.js`)

IndexedDB `qalam-studio` v1, object store `projects` (keyPath `id`). Fallback to
`localStorage` key `qalam-projects` (a JSON map) when `indexedDB` is missing or
throws — `Store.mode()` returns `'idb' | 'local'` and the studio footer shows it.

Serialised record:

```js
{ id, name, w, h, fps, bg, onion, frameCount, activeFrame, activeLayer,
  layers: [{id,name,visible,opacity,blend}],
  cels: [[frameIndex, layerIndex, pngDataUrl], ...],   // only non-null cels
  updated, thumb }
```

`loadImage(url)` must be guarded: WebViews may never fire `onload` for a huge data
URL — use a 4 s timeout plus a `done` flag, otherwise the studio never opens.

Autosave: `markDirty()` debounces 2500 ms → `saveNow(false)`; also on
`visibilitychange` hidden and on *Save now*. Thumbnails are 320 px JPEG q0.72.

---

## 11. Android shell

### Manifest
`package com.qalam.studio`, `versionCode 1`, `versionName 1.0`,
`minSdkVersion 26`, `targetSdkVersion 33`, permissions: **VIBRATE only**
(`uses-feature touchscreen required`). One activity
`MainActivity` (`launchMode=singleTask`, `exported=true`,
`configChanges=orientation|screenSize|keyboardHidden|screenLayout|smallestScreenSize|uiMode|navigation|density`,
`windowSoftInputMode=adjustResize`, hardware accelerated) with the launcher
intent-filter. Theme: no action bar, black background, fullscreen-ish.

### MainActivity
- Build a `WebView` in code (no XML layouts): JS enabled, DOM storage enabled,
  `setBackgroundColor(0xFF0E0E10)`, no zoom controls, `setLayerType` default,
  `WebViewClient` to keep navigation inside (`file:///android_asset/app/index.html`),
  `WebChromeClient` for console.
- `addJavascriptInterface(new Bridge(this), "QalamNative")`.
- On back pressed: `evaluateJavascript("(window.qalamBack?window.qalamBack():1)", cb)`
  and **finish only when the callback is the string `"1"`**.
- `setMediaPlaybackRequiresUserGesture(false)`, `setAllowFileAccess`, and a
  `WebSettings` `textZoom = 100` so system font scaling doesn't break the UI.

### Bridge (`@JavascriptInterface`)
| Method | Behaviour |
|---|---|
| `saveImage(base64, mime, name)` | API 29+: `MediaStore` insert with `relative_path = "Pictures/Qalam"`; else `getExternalFilesDir()`. Returns boolean. |
| `folder()` | absolute path of the app's external files dir |
| `sdk()` | `Build.VERSION.SDK_INT` |
| `vibrate(ms)` | `Vibrator` (VIBRATE permission) |
| `toast(msg)` | `Toast` on the UI thread |

JS side: `Q.native()` returns `window.QalamNative` or `null`, `Q.saveBytes()` uses
it and falls back to a Blob download.

### Icons
Adaptive icon: `mipmap-anydpi-v26/ic_launcher.xml` with `background=@color/qalam_bg`
and `foreground=@mipmap/ic_fore`. Generate all densities from one 1254² source with
a pure-Python script (no Pillow): decode PNG (zlib + unfilter), area-average down,
and key the foreground's alpha from luminance `((lum-0.13)/0.30)^0.85`.

---

## 12. Build pipeline

### Toolchain (`tools/fetch-toolchain.sh`)
No Android SDK, no Gradle, no `javac` in the JVM. Everything lands in
`~/.cache/tc` (override with `QALAM_TOOLCHAIN`):

| Artifact | Source |
|---|---|
| `jvm/` (OpenJDK 25 runtime, no javac) | `pip download jdk4py` → `jdk4py/java-runtime/` |
| `apktool_2.4.1.jar` | npm `apktool-jar@2.4.1` |
| `tools.jar` (javac 1.8.0_131) | npm `dataslope-tools-jar@1.0.0` — used only for the javac check |
| `android-33.jar` | sparse clone of `Sable/android-platforms` (`android-33/android.jar`) |
| `aapt2` (2.20, static x86_64) | sparse clone of `voidnullvalue/Icsee-android` → `toolchain/aapt2-bin/aapt2-x86_64` |
| npm modules | `tools/apksign` (`apk_sign_ts@1.0.1`), `tools/tests` (`jsdom@24`) |

### `tools/build.sh`
1. `javac -source 8 -target 8 -bootclasspath android-33.jar android/reference/*.java`
   — the Java mirrors must type-check even though the shipped code is smali.
2. `java <JAVA_OPTS> -jar apktool_2.4.1.jar b android -o build/qalam-unsigned.apk --use-aapt2`
3. `cd tools/apksign && node sign.mjs build/qalam-unsigned.apk dist/Qalam-1.0.apk`
   (v1 + v2 in one pass; key + cert PEM committed for reproducible builds)
4. `aapt2 dump badging` + `python3 tools/verify_apk.py` — the verifier re-parses the
   zip, checks `resources.arsc` alignment, `classes.dex` magic/version, the v2
   signature block, and verifies the RSA-SHA512 signature against the certificate.
   It must print `VERIFIED — installable APK`.

`JAVA_OPTS` defaults to **`-Djdk.lang.Process.launchMechanism=FORK`** — see §14.

Expected artefact: ~205 KB, 27 zip entries, `application-label:'Qalam'`,
`application-icon-160:'res/mipmap-anydpi-v26/ic_launcher.xml'`.

---

## 13. Tests (all headless, no browser)

1. **`engine_smoke.mjs`** (37 checks) — loads `core/doc/brushes/gif` with a tiny
   canvas shim; asserts brush presets, stroke geometry, dirty rects, history
   push/undo/redo limits, layer + frame ops, thumbnails, flatten, GIF header bytes.
2. **`gif_roundtrip.mjs`** — encodes a 4-frame GIF with the in-app encoder, decodes
   it with an independent pure-Python decoder (`gif_decode.py`) and compares every
   pixel.
3. **`ui_smoke.mjs`** — boots the real `index.html` in **jsdom** and drives the DOM:
   gallery → new canvas → brush tray → size slider → stroke → undo/redo → layer add
   + action sheet → colour wheel/swatch/hex → timeline frame add, onion auto-on,
   playback, frame select → save → reopen from gallery (layers + frames survive) →
   pinch → two-finger undo → three-finger redo → long-press eyedropper →
   QuickShape → hardware back → PNG export into the native bridge.

jsdom harness recipe (the parts that matter):

```js
const dom = new JSDOM(readFileSync('android/assets/app/index.html'), {
  url: 'https://qalam.local/', runScripts: 'outside-only', pretendToBeVisual: true,
  resources: 'usable'
});
const win = dom.window;
// 1. every canvas: stub 2D ctx (drawImage/fill/putImageData/getImageData/…)
//    getImageData -> zeros, toDataURL -> 1px PNG
// 2. Element.prototype.getBoundingClientRect -> a real box (see pitfalls)
// 3. win.Image stub whose `src` setter calls onload on the next tick
// 4. delete win.indexedDB  (exercise the localStorage path)
// 5. eval each js file in page order inside the window
```

`npm test` in `tools/tests` chains all three.

---

## 14. Pitfalls that actually bit

1. **`apktool` needs a JVM child process.** On JDK 25 under a seccomp sandbox,
   `Runtime.exec` fails with `posix_spawn … Permission denied` and apktool reports
   only `could not exec: [/tmp/brut_util_Jar_….tmp, compile, …]`. Fix: run the JVM
   with `-Djdk.lang.Process.launchMechanism=FORK`.
2. **`apktool.yml` must exist** at the project root or the build refuses to start.
3. **Signing:** `apk_sign_ts` computes two-level content digests; when writing your
   own verifier, compare the *chunk* digests, not the file digest.
4. **GIF LZW:** grow the code size at `nextCode === (1 << codeSize) + 1`; verify
   frames with an independent decoder, never `convert -coalesce` on disposal-2 GIFs.
5. **jsdom never decodes images.** `img.onload` never fires → wrap `loadImage` in a
   4 s timeout with a `done` guard (also a real-device safety net) *and* stub
   `Image` in the tests.
6. **jsdom's canvas box is 300×150.** `getBoundingClientRect` on a `<canvas>`
   returns the default size, so "the middle of the screen" maps to document
   coordinates *outside* the paper: strokes vanish, QuickShape commits nothing
   (its dirty rect is off-canvas, so `endPixels` correctly stores no history).
   In the harness set `canvas.width/height` to something phone-like and call
   `view.resize()` before driving pointers.
7. **Gesture tap counting** needs the running `maxPointers` (see §7). A third finger
   arriving without bumping it silently turns redo into undo.
8. **Finger strokes must not be palm-rejected.** Gate rejection on
   `strokePointerType === 'pen'`, or finger-only users can never pinch.
9. **`UI.buildLayers(root)` must default to a live container** (`#trayBody`) and
   clear `innerHTML` first; `syncDoc` can run while a tray is being rebuilt.
10. **Translucency must be buffered**, otherwise every stroke doubles its own alpha
    where it crosses itself.
11. **`toDataURL` on a 2048² cel is slow** (~50–150 ms). Save lazily (debounced), and
    keep a per-cel dirty flag rather than re-encoding every cel on every save.
12. **Android back button**: JS must return `"1"`/`"0"` as a string through
    `evaluateJavascript`; the callback runs off the UI thread, so compare strings and
    call `finish()` on the UI thread.

---

## 15. Bootstrap prompt for the new session

> Build a Procreate-style painting and animation app for Android called **Qalam** in
> this repository, and deliver a signed, installable APK.
>
> - Package `com.qalam.studio`, minSdk 26, targetSdk 33, VIBRATE permission only
>   (no internet), one `WebView` activity; the app itself is plain HTML/CSS/JS in
>   `assets/app/` (core → doc → brushes → gif → view → storage → ui → app).
> - No Gradle and no Android SDK: build with a static `aapt2` + apktool 2.4.1
>   (`--use-aapt2`) + `apk_sign_ts` v1/v2 signing; hand-write the smali for the
>   activity and the JS bridge, and keep `android/reference/*.java` mirrors that
>   `javac` against `android.jar`.
> - Feature set: 6 canvas presets; 11 pressure brushes with a wet buffer so
>   translucent strokes never self-darken; 16 blend modes + per-layer opacity;
>   colour wheel with swatches and hex; frames-as-layers timeline with onion skin,
>   playback and 6–30 fps; PNG and GIF export (own median-cut + LZW encoder) via
>   `MediaStore` into `Pictures/Qalam`; IndexedDB autosave with a localStorage
>   fallback and a gallery.
> - Gestures: two-finger pan/pinch/rotate, two-finger tap undo, three-finger tap
>   redo, long-press eyedropper (520 ms, no drag), hold-at-end QuickShape (380 ms),
>   pen-first palm rejection, Android back button handled in JS.
> - Tests: `engine_smoke` (37 checks), `gif_roundtrip` (independent decoder),
>   `ui_smoke` (jsdom driving the real DOM end to end). All must pass before the
>   APK is built.
> - Docs: `docs/procreate-analysis.md` (what Procreate does, mapped to Android, with
>   a shipped/approximated/missing matrix) and `docs/qalam.md` (install, gestures,
>   architecture, roadmap).
> - Deliverables: `dist/Qalam-1.0.apk` verified by `tools/verify_apk.py`
>   (`VERIFIED — installable APK`), plus a README and a downloadable zip of
>   README + APK + docs.
>
> Read `BLUEPRINT.md` §5–§14 for the exact data model, engine maths, gesture
> thresholds, build steps and pitfalls before writing code.

---

## 16. Acceptance checklist

- [ ] `node tools/tests/engine_smoke.mjs` → `all 37 engine checks passed`
- [ ] `node tools/tests/gif_roundtrip.mjs` → `GIF encoder verified`
- [ ] `node tools/tests/ui_smoke.mjs` → `all UI checks passed`
- [ ] `bash tools/build.sh` → `VERIFIED — installable APK`, ~205 KB, 27 entries
- [ ] `aapt2 dump badging` shows `package com.qalam.studio`, `versionName 1.0`,
      `minSdkVersion 26`, `targetSdkVersion 33`, `application-label:'Qalam'`
- [ ] APK installs on a phone, draws with a stylus, undoes with two fingers,
      reopens a saved artwork with layers and frames intact, exports a PNG and a GIF
- [ ] `docs/procreate-analysis.md` and `docs/qalam.md` exist and match the shipped
      feature set
