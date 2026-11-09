# ProDesign · Qalam

An offline painting and frame-animation studio for Android, modelled on Procreate —
brushes, layers, a colour wheel, a frame timeline with onion skin, Procreate's gesture
vocabulary, and PNG/GIF export. No account, no ads, no network permission.

**Download:** [`Qalam-1.3.apk`](../artifacts/Qalam-1.3.apk) (~245 KB)

| | |
|---|---|
| Package | `com.qalam.studio` |
| Version | 1.3 (versionCode 4) |
| Requires | Android 8.0+ (minSdk 26), built for targetSdk 33 |
| Permissions | `VIBRATE` only — no internet, no storage, no location |
| Signing | APK Signature Scheme v1 + v2, self-signed with a public test key |
| SHA-256 | `b5f529b03f32b5c4fe078f0126ad300367cc19c4a0cd63b93f3994297381c035` |

## Install

1. Download `Qalam-1.3.apk` to the phone (or copy it over USB).
2. Open it from the file manager. Android will ask you to allow installs from that
   app the first time ("Install unknown apps") — allow it, then install.
3. Open **Qalam**.

Because the APK is self-signed, Android shows "installed from an unknown source"
once. That is expected for any app that doesn't come through the Play Store.

## What's inside

**Canvas** — 2048², portrait, landscape, 1920×1080, 1280² animation and 1080×1920
story presets; full-screen canvas with two-finger pan, pinch zoom and twist rotate.

**Brushes** — 20 presets, including: Studio pen, Inking pen, Monoline, Technical pencil,
6B pencil, Marker, Airbrush, Charcoal, Watercolour, Hard eraser, Soft eraser. Stylus
pressure drives width and opacity; speed drives taper; translucency accumulates so a
stroke never darkens where it crosses itself.

**Layers** — add, duplicate, reorder, merge down, clear, delete, rename; per-layer
opacity and 16 blend modes (Normal, Multiply, Screen, Overlay, Darken, Lighten, Color
dodge/burn, Hard/Soft light, Difference, Exclusion, Hue, Saturation, Color, Luminosity);
live thumbnails and visibility toggles.

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
| Two-finger tap | Undo |
| Three-finger tap | Redo |
| Long-press the canvas | Eyedropper |
| Hold still at the end of a stroke | QuickShape (snap to line or ellipse) |
| Pen down, then a finger | Finger is ignored — palm rejection |

**Saving & export** — everything autosaves on the device (≈2.5 s after a change, and
when the app goes to the background). PNG export and GIF animation export (50/100/150 %
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
