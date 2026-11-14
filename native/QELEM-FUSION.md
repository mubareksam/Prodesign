# Qelem native fusion — work in progress

This is a **source-only, incomplete development base**, not an APK and not a replacement for Qelem 7.23. Based on ProCraft commit `c330afd009eae7c739af1a4d61293b1e4b4d3dca`; the original upstream README, MIT/Apache licenses, NOTICE and asset attributions are retained. This folder is a fork, not a claim of ownership of ProCraft. No change to the existing Qelem 7.23 source or APK is required.

## What's in this first step

- ProCraft's native Android Kotlin/Compose interface and Rust/wgpu engine are the base. Upstream already provides animation assist (layer/group-based frames, onion skins, frame holds, and loop, ping-pong and one-shot preview); it is not Qelem's full animation system.
- The Android label, gallery and settings are named Qelem; the Qelem launcher bitmap and gallery/about mark are retained. The default interface accent uses a darker amber `#BB5800` derived from Qelem's `#F0B46A`, so existing white text on the selected background has a contrast ratio above 4.5:1. A plugin can still set another accent. Artistic colours, paint, and colour-picker samples are not globally recoloured.
- First animation port: the native Animation Assist settings have **Reverse preview only**. It reverses the preview sequence including held slots, while leaving the displayed timeline in its original order. It is temporary, stops when changed or when the artwork closes, and does **not** change saved playback, gallery preview or exported files. This is a partial port, not Qelem's persisted/exportable reverse playback mode.
- The Android application ID is deliberately `com.qalam.studio.nativepreview` (debug adds `.debug`), separate from existing `com.qalam.studio` and from upstream ProCraft. This avoids an accidental in-place replacement. It also means the existing Qelem gallery will **not** appear automatically. No data migration has been implemented.

## Important work remaining

1. **Do not install this as an update or uninstall existing Qelem to make room.** Back up every project using Qelem 7.23's editable project backup, verify copies, and leave the original app and data intact. A safe migration/importer, with explicit reporting of unsupported data and tests for each layer/cel/frame, is required before a shared gallery or upgrade can be considered. Qelem stores multiple layer cels per frame; ProCraft uses top-level layers or groups as frames. They do not share a document format, so a conversion must be designed and tested rather than assumed lossless.
2. Port Qelem's animation timeline, ranges, skipped frames, frame labels, motion/camera keys, audio, animation effects, and exports where they are not already equivalent; decide how they map to ProCraft's frame/group model. Reverse **export** is not implemented here.
3. Audit and port Qelem's other unique brushes, selections, shape and pattern tools, transparency edits, palettes and project backup. None of those are claimed to be ported by this base. Both apps have overlapping features with differing behaviour; check rather than assume parity.
4. Review all native accent placements and contrast, including plugin overrides, light theme, transform and text tools, and phones/tablets. The upstream interface is principally tablet-oriented; no phone adaptation is claimed.
5. Build the complete Android project with the required Gradle, SDK/NDK, Rust and cargo-ndk toolchain (see upstream README), and test on actual Android devices: stylus/touch, GPU speed and stability, save/reopen, lifecycle, imports, exports, memory, and accessibility. Reconcile package, app signing, version codes and storage migration before any genuine update is attempted. A different signing certificate cannot update an installed app.

## Verification performed for this source step

The standalone Kotlin preview-order test exercises reversal, repeated holds and timeline-slot mapping. Static checks confirm the isolated app ID, Qelem label/logo, retained upstream notices and original Qelem source archive; they do **not** compile Android or exercise rendering. Native Android/Gradle dependencies are not available in this workspace, so no native APK has been built or device tested here. Do not treat the source as a finished application.

Example test (Kotlin/JVM compiler 2.3.21 and JDK required):

```sh
kotlinc android/app/src/main/java/io/github/artcraftandroid/procraft/canvas/QelemPreviewOrder.kt \
  qelem-tests/PreviewOrderTest.kt -include-runtime -d /tmp/qelem-preview-test.jar
java -jar /tmp/qelem-preview-test.jar
python3 qelem-tests/check_fusion.py
```
