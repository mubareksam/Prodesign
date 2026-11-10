# ProDesign · Qalam

Developed by **Qmer**. An offline painting and frame-animation studio for Android, modelled on Procreate —
brushes, layers, a colour wheel, a frame timeline with onion skin, Procreate's gesture
vocabulary, and PNG/GIF export. No account, no ads, no network permission.

**Download:** [`Qalam-4.7.apk`](../artifacts/Qalam-4.7.apk) (~308 KB)

| | |
|---|---|
| Package | `com.qalam.studio` |
| Version | 4.7 (versionCode 38) |
| Requires | Android 8.0+ (minSdk 26), built for targetSdk 33 |
| Permissions | `VIBRATE` only — no internet, no storage, no location |
| Signing | APK Signature Scheme v1 + v2, self-signed with a public test key |
| SHA-256 | `6b61aa0acfeb62c17e68f9b71f3f3ae7553edde64ad168a025bbc47ea604c84a` |

## Install

1. Download `Qalam-4.7.apk` to the phone (or copy it over USB).
2. Open it from the file manager. Android will ask you to allow installs from that
   app the first time ("Install unknown apps") — allow it, then install.
3. Open **Qalam**.

Because the APK is self-signed, Android shows "installed from an unknown source"
once. That is expected for any app that doesn't come through the Play Store.

## What's inside

**Canvas** — 2048², portrait, landscape, 1920×1080, 1280² animation and 1080×1920
story presets and custom sizes from 64 to 4096 pixels per side; full-screen canvas with two-finger pan, pinch zoom and twist rotate.

**Selection & transform** — temporary rectangle or freehand lasso mask for brushes, erasers, fill
and effects; fill, clear, flips, 180° rotation, numeric move and scale, and copy to
new layer on the current frame. Pixel edits are undoable; selection outlines are not.
Transforms currently require a rectangle. Precise transform provides numeric dimensions and rotation with an approximate preview; there are no draggable handles, feathering or custom pivots.

**Brushes** — 20 presets, including: Studio pen, Inking pen, Monoline, Technical pencil,
6B pencil, Marker, Airbrush, Charcoal, Watercolour, Hard eraser, Soft eraser. Stylus
pressure drives width and opacity; speed drives taper; translucency accumulates so a
stroke never darkens where it crosses itself.

**Cut, copy & paste** — use Actions or swipe three fingers down. Copy from the
current cel; paste creates a new top layer on the current frame at the original
coordinates. The Qalam-only clipboard is temporary and does not share with Android.

**Creative helpers** — the Colour tray offers analogous, complementary and
triadic hue suggestions; Actions → Canvas & view can preview transparency over
checkerboard without changing exports; Selection & transform can invert a selection
within the 4-megapixel/4096-run limits. See the guide for details and limitations.

**Interface and shortcuts** — choose a light or dark interface in Actions →
Preferences → Interface appearance; the artwork is unchanged. Tap the framed-square
icon on the tool rail to fit and straighten the view. In Layers, tap the checkerboard
button on a row to toggle alpha lock; undo and redo work as usual.

**Recolour** — Actions → Create & edit → Recolour matching pixels replaces
matching non-transparent pixels in the current cel, preserving alpha and respecting
selections. Sample a source on the approximate preview or enter HEX colours; use
tolerance to include similar colours. Other layers and frames remain unchanged.

**Gallery preview** — tap the eye icon on a project card to inspect its saved
thumbnail without opening it. It shows the last-saved active frame at up to 320 px,
with background but without camera or animated layer motion; it is not a full-size
or animated preview. Tap Close or Android Back to return to the gallery.

**Clear current cel** — scrub three fingers right-left-right (or the reverse),
then confirm, or use Actions → Create & edit → Clear current cel. This clears the
whole active cel, ignores the selection and leaves other frames unchanged; undo
restores it. Hidden, locked and alpha-locked layers cannot be cleared this way.

**Hold timing** — Actions → Preferences → Hold gesture timing sets separate
QuickShape and eyedropper delays. Values apply to new strokes on this device;
other gesture and button-hold timings are unchanged.

**Distraction-free canvas** — Actions → Canvas & view → Hide interface hides the
editing controls. Tap the corner icon or Android Back to restore them; timeline and
reference state are retained until you leave or switch artwork.

**Pure hue** — in the colour tray, tap the droplet-plus button or double-tap the
upper-right of the square to select the current hue at full saturation and brightness.

**Preferences and reference** — move the brush sliders to either side and adjust their
vertical position; horizontal size and opacity sliders are also in the brush tray.
Global stylus pressure curve and extra smoothing
apply to future strokes without changing individual brush presets. The reference
panel can temporarily show a picked image; it is not saved or exported.

**Shortcuts** — hold a layer eye to solo/restore; hold the colour swatch to swap
with the previous colour; hold the eraser to match the current brush. Up to six
brush sizes can be saved in the brush tray. Solo changes saved visibility and also
affects exports until restored; a clipped layer keeps its base visible.

**Layers** — add, duplicate, reorder, merge down, clear, delete, rename; per-layer
opacity and 16 blend modes (Normal, Multiply, Screen, Overlay, Darken, Lighten, Color
dodge/burn, Hard/Soft light, Difference, Exclusion, Hue, Saturation, Color, Luminosity);
live thumbnails, visibility toggles, per-layer edit locking, alpha lock and non-destructive clipping masks. Clipped layers use Normal blend and share the nearest unclipped base. Merge is blocked until clipping is disabled and both layers’ animation keys are removed. Import PNG, JPEG, WebP or first-frame GIF as a new layer in the current frame (file and decoded-size limits apply). The Android picker still needs device testing.

**Colour** — HSB wheel with value/saturation square, HEX entry, 24 swatches and the
12 most recent colours.

**Animation** — frames live on the layer stack; add/duplicate/delete frames, scrub the
timeline, play at 1–30 fps with frame holds, and configurable onion skins.

**Gestures**

| Gesture | Action |
|---|---|
| One finger / stylus | Paint |
| Two fingers drag | Pan |
| Two fingers pinch / twist | Zoom / rotate |
| Three-finger tap | Undo |
| Four-finger tap | Redo |
| Long-press the canvas | Eyedropper |
| Hold still at the end of a stroke | QuickShape (line, circle or ellipse; move with a second finger before release) |
| Pen down, then a finger | Finger is ignored — palm rejection |

**Animation workflow** — choose a playback range for preview, GIF and MP4; batch
label, hold, reverse, duplicate, skip or include a frame range with undo. Onion skins
have independent directional counts, colour, layer and stacking options. Skipped frames
are omitted from playback and GIF/MP4, but retained in PNG sequences and sprite sheets.
Labels are not nested groups. Per-layer editable keyframes animate offset, scale and rotation non-destructively during playback and GIF/MP4 export. Each key transforms that frame’s existing cel; blank cels stay blank. Editing and PNG/sprite-sheet exports stay in original coordinates. An editable, non-destructive camera track animates center, zoom and rotation for playback and GIF/MP4; PNGs and sprite sheets remain raw. Camera keys belong to frame positions and can be saved and undone. A saved motion guide can generate translated raster cels along its path with easing; the guide overlay itself does not appear in exports. Two-pose transform generation also interpolates movement, scale and rotation around a chosen pivot with easing. Both tools replace cels on the current layer within a chosen range after confirmation and can be undone; neither is a live keyframe track. A seeded particle generator creates a new undoable top layer over a frame range; it bakes simple ballistic dots, not a live particle rig. A single imported audio track (2 MiB) supports forward preview and optional AAC-in-MP4 export on compatible WebViews. Audio export is capped at 120 seconds, does not support ping-pong and has not been tested on a physical device; verify saved playback. PNG/GIF remain silent. Cycle timing is displayed on the timeline. Copy a cel
across frames or delete a frame range with confirmation and undo; cel copying is
limited to 64 MiB of new pixel data per operation.
PNG sprite sheets include every frame once, without timing metadata.

**Saving & export** — everything autosaves on the device (≈2.5 s after a change, and
when the app goes to the background). Background colour is configurable; PNG and PNG
sequence exports can omit it and preserve transparency. GIF animation export (50/100/150 %
scale, loop count) are written to `Pictures/Qalam`; MP4 export is available only on WebViews that support it. Undo history holds 36 steps.

## Documentation

- [`docs/qalam.md`](qalam.md) — the full guide: install, panel tour, gestures,
  export, architecture, known limits and roadmap.
- [`docs/procreate-analysis.md`](procreate-analysis.md) — the Procreate study the
  app was built from: canvas model, Brush Studio, layers, colour, selections, guides,
  gestures, Animation Assist, export, stylus handling — mapped to Android, with a
  shipped / approximated / not-yet matrix for this app.

## About this repository

This repository contains the app source, build tools, built APK and documentation. `docs/qalam.md` §6
describes the project layout (a WebView app in plain HTML/CSS/JS packaged without
Gradle or the Android SDK, built with `aapt2` + `apktool` + a v1/v2 signer) for anyone
who wants to reproduce or extend it.

Qalam is an independent app inspired by Procreate's interaction model. Procreate is a
trademark of Savage Interactive; there is no affiliation.
