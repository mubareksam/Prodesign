# Qalam — a Procreate-style painting & animation studio for Android

**Developed by Qmer.**

**Qalam** (from Arabic *qalam*, قلم — pen) is a self-contained Android drawing and
frame-animation app modelled on Procreate: full-screen canvas, pressure-sensitive
brushes, layers with blend modes, a colour wheel, a frame timeline with onion skin,
Procreate's gesture vocabulary, PNG/GIF export and device-dependent MP4 export — all offline, with no account and
no network permissions at all.

- Package: `com.qalam.studio` · version 2.2 (versionCode 13)
- minSdk 26 (Android 8.0) · targetSdk 33 · armeabi-v7a/arm64/x86/x86_64 independent
  (everything is HTML/JS running inside the app's own `WebView`, so the APK has no
  native code)
- APK: **`artifacts/Qalam-2.2.apk`** (~260 KB), signed with a v1+v2 scheme
- The written analysis of Procreate that this app was specified from:
  [`docs/procreate-analysis.md`](procreate-analysis.md)

---

## 1. Install

1. Copy `artifacts/Qalam-2.2.apk` to the phone (USB, Drive, chat to yourself — anything).
2. Open it with the phone's file manager. Android will ask to allow installs from
   that app the first time ("Install unknown apps").
3. Install and open **Qalam**. If an earlier Qalam version is already installed, Android should offer an update that preserves its data. Back up important artwork first. Android does not allow this app to silently uninstall itself; do not uninstall it unless you have backed up its local artwork.

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

You can also enter custom width and height from 64 to 4096 pixels each. Large
canvases, many frames and many layers require substantial device memory. DPI is
not configurable.

Everything is autosaved on the device (`IndexedDB`, with a `localStorage` fallback)
≈2.5 s after the last change, when the app goes to the background, and on
**Menu → Save now**. Reopening an artwork restores every layer and frame.

## 3. Tools and panels

Bottom bar: **Gallery · Layer · Brush · Colour · Timeline · Menu** (plus **Undo**,
**Redo** and the eyedropper on the top bar, and a size/opacity strip).

- **Brush tray** — 20 presets, with labelled ink, pencil, paint and eraser icons.
  Select a brush and open **Brush studio** to adjust spacing, flow, opacity, edge
  hardness, pressure response and stabilization. Settings are saved per preset on
  this device. This is a basic editor, not the full Procreate Brush Studio.
- **Colour tray** — HSB wheel with a value/saturation square, HEX entry, 24 swatches
  and the 12 most recent colours.
- **Layers tray** — add, duplicate, merge down, clear, delete, reorder (▲▼), rename,
  opacity and 16 blend modes (Normal, Multiply, Screen, Overlay, Darken, Lighten,
  Color dodge/burn, Hard/Soft light, Difference, Exclusion, Hue, Saturation, Color,
  Luminosity). Rows show a live thumbnail and an eye toggle. Open a layer's
  three-dot menu to lock or unlock it. Lock prevents painting, fill, effects,
  transforms, clearing, deleting or merging that layer; it does not prevent
  visibility, reordering, renaming, opacity changes, undo/redo or deleting a frame.
  Lock is saved per layer, across all its frames. **Alpha lock** in the same menu
  allows recolouring existing pixels with brushes, fill and effects while preserving
  their transparency. Turn it off to use erasers, clear, flip, transform or merge.
  Alpha lock does not prevent layer/frame deletion or undo/redo. It persists and
  is copied when duplicating a layer.
- **Timeline** — add blank or duplicate frames, use thumbnails, previous/next or the
  scrub slider to select a frame, play/stop and toggle onion skin. **Settings** offers
  1–30 fps, loop, ping-pong or one-shot, opacity, separate 0–4 previous and 0–4 next
  onions and their colours. Choose tinted or original colours, all visible layers or
  the active layer, above or below artwork, and whether to show skipped frames.
  Ghosts are hidden during playback. A saved, undoable playback range limits preview,
  GIF and MP4. It uses positions, not identities: reordering changes its contents;
  deletion clamps it to the timeline. Outside-range frames remain editable.
  In **Frame options**, set a 1–60 tick hold, optional group label, skip/include,
  duplicate, move or delete. Skipped frames remain editable but are omitted from
  playback, GIF and MP4; a range with no included frames cannot play or export.
  **Batch frames** labels, holds, reverses, duplicates, skips or includes a range
  in one undo step. **Delete range** removes a range after confirmation and must leave
  at least one frame; undo restores its cels and settings. The 60-frame limit still
  applies; labels are tags, not groups. The timeline reports included frames, ticks
  and estimated seconds per playback cycle, factoring in holds, skips, range and ping-pong.
  Actual playback or export duration can differ due to timing and encoding.
  **Copy cel** replaces the current layer's cels in a selected frame range with
  independent copies of a non-empty source cel, after confirmation. It includes
  skipped frames but leaves other layers, timing and source untouched. Undo restores
  previous cels. Unlock the layer and alpha first. One operation allocates at most
  64 MiB of copied pixel data; choose a smaller range if needed. Actual peak memory
  can be higher, especially with undo history and large canvases.
- **Fill tool** — tap the bucket on the right rail, then tap an area. It fills the
  connected pixels on the current layer with the selected colour at full opacity;
  undo reverses the fill. **Menu → Fill settings** adjusts colour tolerance. It
  does not sample outlines on other layers and may take time on large canvases.
- **Menu → Canvas background** — choose the current brush colour or enter a 3- or
  6-digit hex colour. The background applies to every frame, is saved and can be
  undone. It appears in normal exports but not transparent PNGs.
- **Menu → Canvas reference** — a movable, zoomable overview of the current frame.
  It refreshes after changes. It does not import external images.
- **Actions → Create & edit → Selection & transform** — choose **Draw rectangle**
  and drag, or **Draw lasso** and trace a freehand outline. The lasso closes from
  its last point to its first. Both selections clip brushes, erasers, fill and
  effects and support selection fill/clear and **Copy to layer**. Copy creates a
  new layer only in the current frame. Select all and Deselect are available.
  Effects are calculated within the selection's bounding rectangle and masked on
  output; blur can sample pixels inside that rectangle but outside a lasso.
  Rectangular selections also support flips, 180° rotation and **Move / scale**.
  These transforms do not yet support lasso and are refused instead of changing its
  bounding rectangle. Move/scale uses numeric offsets and 25–400% scale anchored
  at top left, without live preview; off-canvas content is cropped. With no
  selection, transforms use the current cel. Undo restores pixels, not the selection
  outline. Selections are temporary, unsaved and cleared when switching artworks;
  they apply across layer/frame switches. Lasso paths are limited to 2048 sampled
  points, are not feathered, and large edits can take time and memory.
- **Menu → Drawing guides** — show an adjustable 2D, isometric or one-, two- or
  three-point perspective overlay, or a symmetry overlay. Perspective horizon and
  point spread can be adjusted; perspective and grids are visual only, not snapping
  or perspective-correct drawing assistance. Choose vertical, horizontal, quadrant or eight-fold radial
  symmetry and switch **Layer assist** on to mirror strokes on the selected layer.
  The grid is visual only; it does not snap strokes. Guides are not exported.
- **Menu → Effects** — soft box blur, horizontal motion blur, sharpen, bloom,
  glitch, pixelate, posterize, solarize, grayscale, invert, sepia, brightness,
  saturation, contrast, hue shift, noise, chromatic shift, halftone dither and
  threshold. Effects permanently modify the selected layer of the current frame;
  use Undo to revert. Large canvases can take time and memory.
- **Menu** — PNG, PNG frame sequence, GIF and capability-dependent MP4 export,
  drawing guides, canvas controls, save and help.

## 4. Gestures

| Gesture | Action |
|---|---|
| Draw / drag with one finger or stylus | Paint |
| Two fingers drag | Pan the canvas |
| Two fingers pinch / twist | Zoom / rotate |
| **Three-finger tap** | Undo |
| **Four-finger tap** | Redo |
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

- **Export PNG frames** — saves one numbered PNG per animation frame. Frame-hold
  timing is not encoded in the filenames; set timing in your video editor. This
  exports every source frame once, including skipped frames and those outside the playback range.
- **Transparent PNG** / **Transparent PNG frames** — omit the canvas background
  and preserve layer transparency in the current frame or a numbered sequence.
  Blend-mode results can differ without a solid background. GIF and MP4 exports
  still include the background; transparent GIF/video is not offered.
- **Export sprite sheet** — saves all source frames once in a left-to-right,
  top-to-bottom PNG grid, at 25%, 50% or 100% scale and a chosen column count.
  Choose a transparent or canvas-colour tile background; unused cells are transparent.
  Playback range, skips, ping-pong repetitions and frame holds are not included as pixels
  or timing metadata. The output is limited to 8192 pixels per side and 16,777,216
  total pixels; lower the scale or adjust columns if it is too large.
- **Export MP4** — records one animation loop in real time, up to 1280 pixels on
  the longest side, using the device WebView's MP4 encoder. On Android 10+ it writes
  to `Movies/Qalam`; Android 8–9 uses the app's external folder. Some WebViews do not
  support MP4 recording; the app reports this rather than producing a mislabeled file.
  This has not been tested on a physical device.

No storage permission is needed: `MediaStore` inserts as the app on Android 10+.

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
    js/brushes.js            20 presets, procedural sprites, Q.Stroke engine
    js/gif.js                quantiser, LZW, GifWriter
    js/effects.js            undoable pixel effect algorithms
    js/fill.js               scanline flood fill
    js/selection.js          rectangle/lasso geometry and pixel flips
    js/spritesheet.js        bounded PNG sprite-sheet layout and rendering
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
  tests/engine_smoke.mjs     130 engine checks (history, brushes, doc, GIF, …)
  tests/pixel_integration.mjs real raster and animation export checks
  tests/gif_roundtrip.mjs    encodes a GIF and decodes it with an independent decoder
  tests/ui_smoke.mjs         jsdom boot + full UI drive (gallery -> export)
artifacts/Qalam-2.2.apk           the signed, installable artefact
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
  neighbouring frames with adjustable colour, opacity, scope and stacking order.
- **Rendering is demand-driven.** `View` keeps `dirty` and redraws inside
  `requestAnimationFrame` only when something changed.
- **Palm rejection is scoped.** Extra pointers are ignored only while the *active*
  stroke came from a pen; finger strokes can always escalate into a gesture.

### Build it yourself

```bash
bash tools/fetch-toolchain.sh     # once per machine: JVM, apktool, aapt2, jars, npm
bash tools/build.sh               # -> artifacts/Qalam-2.2.apk (signed + verified)
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
npm test        # engine_smoke (130 checks) + pixel_integration + gif_roundtrip + ui_smoke
```

`pixel_integration.mjs` uses a native desktop canvas implementation to verify
actual RGBA pixels, selection clipping, sprite sheets, GIF timing and undo/redo. It is not an Android device test.
`ui_smoke.mjs` boots the real app in jsdom with a stubbed 2D context and drives the
actual DOM: new canvas → brush tray → stroke → undo/redo → layers → colour →
timeline → playback → save → reopen from the gallery → gestures (pinch, three-finger
undo, four-finger redo, long-press eyedropper, QuickShape) → Android back button →
PNG export into the native bridge. It is the regression net for anything that
touches `ui.js`, `view.js`, `app.js` or `storage.js`.

`verify_apk.py` re-reads the finished APK independently: zip entries, `resources.arsc`
alignment, `classes.dex` magic/version/size, the v2 signature block and the RSA
signature against the certificate — `VERIFIED — installable APK` means the file will
install, not merely that a build command exited 0.

## 7. Known limits & roadmap

This is not a full Procreate replacement. Canvas sizes are finite (up to 4096 px per side), and artwork is raster: magnification up to 64× reveals pixels rather than creating infinite detail. Image import, clipping masks, layer groups, audio tracks, motion paths, keyframes/easing, IK, camera animation, morphing and particles are not implemented. Onion skins provide ghost frames. Brush Studio edits existing presets only;
custom tips/grains, dual brushes and import/export are not implemented. Guide
snapping, adjustable vanishing-point placement, rectangle/arc QuickShape, imported
image references, automatic selection, feathered masks, interactive
transform previews and free rotation, layer masks/groups, text, cross-layer reference fill,
smudge, timelapse, PSD and many other requested features remain unimplemented. Frame labels are not full nested frame groups; PNG sequences and sprite sheets
contain one image per frame without hold metadata. MP4 availability depends on the
WebView and has not been verified on a physical Android phone. See
[feature coverage](FEATURES.md) for details.
