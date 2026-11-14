# Qelem native fusion — work in progress

This is an **incomplete development preview**, not a replacement for Qelem 7.23. An arm64 debug APK is available [here](../artifacts/Qelem-native-preview-arm64.apk); it has not been tested on a device. Based on ProCraft commit `c330afd009eae7c739af1a4d61293b1e4b4d3dca`; the upstream MIT/Apache licenses, NOTICE and asset attributions are retained. This folder is a fork, not a claim of ownership of ProCraft. No change to the existing Qelem 7.23 source or APK is required.

## Native work in progress

- ProCraft's native Android Kotlin/Compose interface and Rust/wgpu engine are the base. Upstream already provides animation assist (layer/group-based frames, onion skins, frame holds, and loop, ping-pong and one-shot preview); it is not Qelem's full animation system.
- The Android label, gallery and settings are named Qelem; the Qelem launcher bitmap and gallery/about mark are retained. The default interface accent uses a darker amber `#BB5800` derived from Qelem's `#F0B46A`, so existing white text on the selected background has a contrast ratio above 4.5:1. A plugin can still set another accent. Artistic colours, paint, and colour-picker samples are not globally recoloured.
- First animation port: the native Animation Assist settings have **Reverse preview only**. It reverses the preview sequence including held slots, while leaving the displayed timeline in its original order. It is temporary, stops when changed or when the artwork closes, and does **not** change saved playback, gallery preview or exported files. This is a partial port, not Qelem's persisted/exportable reverse playback mode.
- **Preview range and speed:** frame options set a temporary start/end by frame-layer ID; Settings clears the range and chooses 50%, 100% or 200% preview speed. Held slots remain intact. The settings show an estimated cycle length using the native playback mode and chosen speed. The range, speed and reverse switch are preview-only: they do not affect exports, gallery playback, saved timing or the project FPS, and reset when leaving the artwork. A removed or reordered-invalid endpoint resets the range. The settings popover scrolls to keep the extra controls reachable, but needs Android layout testing.
- **Storyboard and sprite sheets:** Actions → Share → Share Layers offers labelled storyboard PNG or transparent sprite-sheet PNG. Each visible top-level frame/group renders once, in native frame order; hidden frames, hold repetition, pinned overlays and motion are excluded. Storyboard labels include hold counts and includes the artwork background over a white sheet. Sprite tiles are fitted/centred squares, not full-resolution images. Choose 1–6 columns and 128/256/384 pixel tiles. Up to 60 frames, 4096 px per side, 8 MP output and a 4 MP source canvas. The existing share sheet offers Save to device. Export is read-only; no partial file is shared if cancelled or a frame cannot be read. Frame IDs and holds are checked during rendering, but image edits between rendered frames are not snapshotted; avoid editing while exporting. It can still need substantial GPU and device memory; Android behavior remains untested.
- **Palette chart PNG:** the palette card's menu can share a white chart with the selected palette's nonempty colors and HEX labels, in slot order. This is a flat image, not a palette file or a new layer. The palette is snapshotted; empty palettes are refused.
- The Android application ID is deliberately `com.qalam.studio.nativepreview` (debug adds `.debug`), separate from existing `com.qalam.studio` and from upstream ProCraft. This avoids an accidental in-place replacement. It also means the existing Qelem gallery will **not** appear automatically. No data migration has been implemented.

## Important work remaining

1. **Do not install this as an update or uninstall existing Qelem to make room.** Back up every project using Qelem 7.23's editable project backup, verify copies, and leave the original app and data intact. A safe migration/importer, with explicit reporting of unsupported data and tests for each layer/cel/frame, is required before a shared gallery or upgrade can be considered. Qelem stores multiple layer cels per frame; ProCraft uses top-level layers or groups as frames. They do not share a document format, so a conversion must be designed and tested rather than assumed lossless.
2. Port Qelem's animation timeline, ranges, skipped frames, frame labels, motion/camera keys, audio, animation effects, and exports where they are not already equivalent; decide how they map to ProCraft's frame/group model. Reverse **export** is not implemented here.
3. Audit and port Qelem's other unique brushes, selections, shape and pattern tools, transparency edits, palettes and project backup. None of those are claimed to be ported by this base. Both apps have overlapping features with differing behaviour; check rather than assume parity.
4. Review all native accent placements and contrast, including plugin overrides, light theme, transform and text tools, and phones/tablets. The upstream interface is principally tablet-oriented; no phone adaptation is claimed.
5. Test the arm64 debug build on actual Android devices: stylus/touch, GPU speed and stability, save/reopen, lifecycle, imports, exports, memory, and accessibility. Reconcile package, app signing, version codes and storage migration before any genuine update is attempted. A different signing certificate cannot update an installed app.

## Verification performed for this source step

Standalone Kotlin/JVM tests exercise preview range, speed, timing and held-slot mapping. The real sheet and palette writer functions are tested with a JVM fake Android graphics API: generated PNG pixels, alpha, labels, limits, cancellation and incomplete-file cleanup. Static checks confirm the isolated app ID, Qelem label/logo, retained upstream notices and original Qelem source archive. These tests do **not** compile the Android app or exercise the actual native renderer, Android graphics/share system or device. An arm64 debug APK was built on GitHub Actions with SDK 36 and Compose BOM 2026.03.00 ([build](https://github.com/mubareksam/Qelem/actions/runs/43586658906)); its v2 signature and package metadata were verified. It has not been installed or device tested. Do not treat the preview as a finished application.

Example test (Kotlin/JVM compiler 2.3.21 and JDK required):

```sh
kotlinc android/app/src/main/java/io/github/artcraftandroid/procraft/canvas/QelemPreviewOrder.kt \
  qelem-tests/PreviewOrderTest.kt -include-runtime -d /tmp/qelem-preview-test.jar
java -jar /tmp/qelem-preview-test.jar
kotlinc qelem-tests/fake-android/Graphics.kt \
  android/app/src/main/java/io/github/artcraftandroid/procraft/canvas/QelemSheetPlan.kt \
  android/app/src/main/java/io/github/artcraftandroid/procraft/canvas/QelemSheetWriter.kt \
  qelem-tests/SheetWriterTest.kt -include-runtime -d /tmp/qelem-sheet-test.jar
java -Djava.awt.headless=true -jar /tmp/qelem-sheet-test.jar
kotlinc qelem-tests/fake-android/Graphics.kt \
  android/app/src/main/java/io/github/artcraftandroid/procraft/canvas/QelemPaletteChart.kt \
  qelem-tests/PaletteChartTest.kt -include-runtime -d /tmp/qelem-palette-test.jar
java -Djava.awt.headless=true -jar /tmp/qelem-palette-test.jar
python3 qelem-tests/check_fusion.py
```

### Animation timeline navigation
In Animation Assist, the timeline bar includes previous/next slot controls. These navigate held slots without altering frame timing, exports, or artwork and stop playback before editing. This is an incremental improvement to the existing drawing and animation workspace, not a complete Dreams-style movie, track, audio, video, or keyframe editor.

### Expanded drawing timeline (Dreams-inspired foundation)
With Animation Assist enabled in an artwork, tap the **▥** button on the compact bar to open the expanded timeline; **Compact** returns to the original layout. The same canvas, brushes, layers, frame groups, undo history and file format remain in use. The expanded strip scrolls through the actual animation slots, identifies held frames, shows thumbnails, frame timecode at the document FPS, playhead, playback, frame stepping, add/duplicate (splits a held frame), undoable hold-length controls, frame options, onion-skin/playback settings and two zoom levels. Tap a slot to select it; tap the current slot or Frame for its options. The toolbar scrolls horizontally on narrow screens. Preview range, speed and reverse remain preview-only.

This is **one existing drawing track**, not a full movie or multitrack editor: there are no new audio/video tracks, keyframes, perform mode or Dreams document importer. No project migration is performed. The Rust core now expands frame holds directly without searching every frame per slot; the Kotlin timeline lazily composes visible slots rather than drawing the whole strip. These are structural improvements, not measured device-speed guarantees. Save/reopen, playback, gestures and performance still need testing on real devices.

### Timeline ruler and scrubbing
The expanded timeline now has a scroll-aligned ruler: tap to select a visible slot or drag to
preview and release on a slot; cancel restores the previous selection. Undo/redo, timeline zoom
and a small/large track-height control are available in its scrolling toolbar. Track height
changes the overlay rather than cropping or resizing the artwork. See
[animation workspace research and roadmap](QELEM-DREAMS-ROADMAP.md) for source references and
limitations. Device gesture and screen-size testing is still needed.
