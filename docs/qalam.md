# Qalam — a Procreate-style painting & animation studio for Android

**Qalam** (from Arabic *qalam*, قلم — pen) is a self-contained Android drawing and
frame-animation app modelled on Procreate: full-screen canvas, pressure-sensitive
brushes, layers with blend modes, a colour wheel, a frame timeline with onion skin,
Procreate's gesture vocabulary, and PNG/GIF export — all offline, with no account and
no network permissions at all.

- Package: `com.qalam.studio` · version 1.1 (versionCode 2)
- minSdk 26 (Android 8.0) · targetSdk 33 · armeabi-v7a/arm64/x86/x86_64 independent
  (everything is HTML/JS running inside the app's own `WebView`, so the APK has no
  native code)
- APK: **`artifacts/Qalam-1.1.apk`** (~200 KB), signed with a v1+v2 scheme
- The written analysis of Procreate that this app was specified from:
  [`docs/procreate-analysis.md`](procreate-analysis.md)

---

## 1. Install

1. Copy `artifacts/Qalam-1.1.apk` to the phone (USB, Drive, chat to yourself — anything).
2. Open it with the phone's file manager. Android will ask to allow installs from
   that app the first time ("Install unknown apps").
3. Install and open **Qalam**. If version 1.0 is already installed, Android should offer an update that preserves its data. Back up important artwork first. Android does not allow this app to silently uninstall itself; do not uninstall it unless you have backed up its local artwork.

No permissions are requested except `VIBRATE` (haptic ticks). There is no internet
permission, so nothing can phone home.

> The included APK uses the publicly available test key in `tools/apksign/key.pem`
> (self-signed, v1+v2). Anyone can use that key, so do not use it for a trusted
> production release. Use a securely stored private key for releases; Android will
> not accept a differently signed APK as an update to this one. Android may also
> prompt you to allow installation from the source you use.

## 2. First run

The gallery opens. Tap **New canvas**, name the artwork and pick a preset:

| Preset | Pixels |
|---|---|
| Square | 2048 × 2048 |
| Portrait | 1600 × 2133 |
| Landscape | 2133 × 1600 |
| HD frame | 1920 × 1080 |
| Animation | 1280 × 1280 |
| Story | 1080 × 1920 |

Everything is autosaved on the device (`IndexedDB`, with a `localStorage` fallback)
≈2.5 s after the last change, when the app goes to the background, and on
**Menu → Save now**. Reopening an artwork restores every layer and frame.

## 3. Tools and panels

Bottom bar: **Gallery · Layer · Brush · Colour · Timeline · Menu** (plus **Undo**,
**Redo** and the eyedropper on the top bar, and a size/opacity strip).

- **Brush tray** — 11 presets: Studio pen, Inking pen, Monoline, Technical pencil,
  6B pencil, Marker, Airbrush, Charcoal, Watercolour, Hard eraser, Soft eraser.
  Each has its own size, opacity, flow, hardness, grain, pressure and streamline
  behaviour; the size and opacity sliders are global.
- **Colour tray** — HSB wheel with a value/saturation square, HEX entry, 24 swatches
  and the 12 most recent colours.
- **Layers tray** — add, duplicate, merge down, clear, delete, reorder (▲▼), rename,
  opacity and 16 blend modes (Normal, Multiply, Screen, Overlay, Darken, Lighten,
  Color dodge/burn, Hard/Soft light, Difference, Exclusion, Hue, Saturation, Color,
  Luminosity). Rows show a live thumbnail and an eye toggle.
- **Timeline** — frames as rows of the layer stack: add/duplicate/delete frames,
  scrub or tap to select, ▶ play/stop, fps chip (6 → 30), onion-skin toggle. Onion
  skin switches itself on the moment a canvas gets a second frame.
- **Menu** — Export PNG, Export animation (GIF), New canvas, Add/Delete frame,
  Onion skin, Flip canvas, Rotate 90°, Zoom to fit, Reset view, Save now,
  Gestures & help, About Qalam.

## 4. Gestures

| Gesture | Action |
|---|---|
| Draw / drag with one finger or stylus | Paint |
| Two fingers drag | Pan the canvas |
| Two fingers pinch / twist | Zoom / rotate |
| **Two-finger tap** | Undo |
| **Three-finger tap** | Redo |
| **Long-press on the canvas** | Eyedropper — picks the colour under the pen, no paint left behind |
| Hold still at the end of a fast stroke | **QuickShape** — snaps to a straight line, or to an ellipse if the stroke curls back |
| Pen down + finger down | Finger is ignored while a stylus stroke is running (palm rejection) |
| Android back button | Closes a dialog/tray, then returns to the gallery; one more press exits |

## 5. Export

- **Export PNG** — flattens the current frame and hands the bytes to the native
  bridge, which writes `Qalam-<timestamp>.png` into `Pictures/Qalam` through `MediaStore`
  (Android 10+; on 8.0–9.0 the file lands in the app's external folder, whose path
  `Bridge.folder()` reports).
- **Export animation** — encodes a GIF on the device (median-cut quantiser + LZW,
  no native dependency) with a size choice (50/100/150 %) and loop count (forever /
  once / 3×), saved the same way as `Qalam-<timestamp>.gif`.

Both paths need no storage permission: `MediaStore` inserts as the app, so the
gallery app sees the file immediately.

## 6. How it is built (no Gradle, no Android SDK)

The app is a `WebView` shell plus plain HTML/CSS/JS. The APK is assembled from
resources with `aapt2`, from hand-written smali with apktool's smali assembler, and
signed with `apk_sign_ts`:

```
android/
  AndroidManifest.xml        com.qalam.studio, minSdk 26, targetSdk 33, singleTask
  apktool.yml
  res/                       strings, colours, styles, launcher icons (adaptive)
  assets/app/
    index.html               gallery + studio markup
    css/app.css              dark touch UI
    js/core.js               DOM/colour/canvas helpers, toasts, native bridge
    js/doc.js                Doc (layers, frames, cels, thumbnails) + History
    js/brushes.js            11 presets, procedural sprites, Q.Stroke engine
    js/gif.js                quantiser, LZW, GifWriter
    js/view.js               viewport, input, gestures, QuickShape, eyedropper
    js/storage.js            IndexedDB store with localStorage fallback
    js/ui.js                 trays, colour wheel, layers, timeline, dialogs
    js/app.js                App shell: documents, saving, export, back button
  smali/com/qalam/studio/    MainActivity, Bridge (JS <-> Java), BackCb
  reference/*.java           the same Java, kept javac-compilable as a check
tools/
  fetch-toolchain.sh         downloads JVM/apktool/aapt2/android.jar + npm modules
  build.sh                   type-check -> apktool build -> sign -> verify
  check_reference.sh         javac check of reference/*.java against android.jar
  verify_apk.py              re-parses the APK: zip, arsc, dex, v2 signature
  make_icons.py              icon source -> all mipmap densities + adaptive icon
  apksign/sign.mjs           v1+v2 signer
  tests/engine_smoke.mjs     37 engine checks (history, brushes, doc, GIF, …)
  tests/gif_roundtrip.mjs    encodes a GIF and decodes it with an independent decoder
  tests/ui_smoke.mjs         jsdom boot + full UI drive (gallery -> export)
artifacts/Qalam-1.1.apk           the signed, installable artefact
docs/procreate-analysis.md   the Procreate study this app was built from
docs/qalam.md                this file
```

Design notes worth knowing before changing code:

- **A stroke is a stamping engine.** The pointer path is resampled by spacing × size;
  each sample stamps a procedural sprite whose size and alpha follow pressure,
  speed and taper. Translucent brushes accumulate into a scratch buffer that is
  composited onto the cel once per flush, so a stroke never darkens where it
  overlaps itself.
  `Q.Stroke` receives `view.opacity × brush.opacity`; internal accumulation uses
  `brush.flow` only.
- **Undo is pixel-based.** `History.beginPixels` snapshots the active cel, a stroke
  records one dirty rectangle, and `endPixels` stores the *before* pixels of only that
  rectangle (36 steps). Structural changes (add/remove/reorder layers and frames) use
  a second history entry type.
- **Frames are layers.** `Doc.frames[i].cels[layerIndex]` is lazily allocated, so a
  10-frame canvas costs nothing until you draw on it. Onion skin renders the
  neighbouring frames with alpha under the current one.
- **Rendering is demand-driven.** `View` keeps `dirty` and redraws inside
  `requestAnimationFrame` only when something changed.
- **Palm rejection is scoped.** Extra pointers are ignored only while the *active*
  stroke came from a pen; finger strokes can always escalate into a gesture.

### Build it yourself

```bash
bash tools/fetch-toolchain.sh     # once per machine: JVM, apktool, aapt2, jars, npm
bash tools/build.sh               # -> artifacts/Qalam-1.1.apk (signed + verified)
bash tools/check_reference.sh     # optional: javac-check the Java mirrors
```

`fetch-toolchain.sh` puts everything in `~/.cache/tc` (override with
`QALAM_TOOLCHAIN`). Two sandbox quirks are baked into `build.sh`:

- the package mirror blocks the Android SDK, so resources are compiled with a static
  `aapt2` and dex is assembled by apktool — there is no Gradle anywhere;
- JDK 25's `posix_spawn` helper is blocked by seccomp, so the JVM runs with
  `-Djdk.lang.Process.launchMechanism=FORK`.

### Tests

```bash
cd tools/tests && npm install
npm test        # engine_smoke (37 checks) + gif_roundtrip + ui_smoke
```

`ui_smoke.mjs` boots the real app in jsdom with a stubbed 2D context and drives the
actual DOM: new canvas → brush tray → stroke → undo/redo → layers → colour →
timeline → playback → save → reopen from the gallery → gestures (pinch, two-finger
undo, three-finger redo, long-press eyedropper, QuickShape) → Android back button →
PNG export into the native bridge. It is the regression net for anything that
touches `ui.js`, `view.js`, `app.js` or `storage.js`.

`verify_apk.py` re-reads the finished APK independently: zip entries, `resources.arsc`
alignment, `classes.dex` magic/version/size, the v2 signature block and the RSA
signature against the certificate — `VERIFIED — installable APK` means the file will
install, not merely that a build command exited 0.

## 7. Known limits & roadmap

In rough priority order, with the notes needed to implement each:

1. **Fill / ColorDrop** — flood fill on the active cel with a threshold, sampled from
   a "reference" layer (Procreate's model). Needs an iterative scanline fill over
   `ImageData` and a threshold slider in the colour tray.
2. **Selections** — rect/ellipse/freehand masks; `Doc` would keep a `selection`
   canvas and `Q.Stroke` would clip through it (`ctx.save` + `clip`).
3. **Smudge tool** — a `Stroke` variant that samples the cel under the stamp instead
   of using the sprite, offset by the movement vector.
4. **Brush Studio UI** — the engine already carries hardness, grain, flow, spacing,
   pressure size/alpha, velocity, taper, jitter, scatter and streamline per brush;
   this is a matter of exposing sliders and a "save as preset" row.
5. **Alpha lock, clipping masks, layer groups** — alpha lock clips strokes to the
   cel's existing alpha; clipping reads the layer below into a mask; groups need the
   compositing loop in `Doc.renderFrame` to recurse.
6. **MP4 export** — `MediaCodec` + `MediaMuxer` in `Bridge`, fed by the same frame
   canvases that produce the GIF.
7. **PSD export** — a layered PSD writer (uncompressed RAW or RLE rows) so the file
   opens in Photoshop/Procreate.
8. **Symmetry / perspective guides** — mirror the stroke points in `View._startStroke`
   and draw the guide as an overlay.
9. **Text layers**, **tilt/azimuth brush dynamics** (`AXIS_TILT`/`AXIS_ORIENTATION`
   exposed through a `MotionEvent` bridge), **timelapse capture**, **JPEG/PDF export**.
10. **Quick Menu** (four floating shortcuts) and a full-screen toggle for parity with
    Procreate's four-finger tap.
