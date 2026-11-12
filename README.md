# Qelem 1.2

Qelem is an independent, offline Android painting and frame-animation app developed by **Qmer** and inspired by Procreate. This is a retrospective release based on the historical 1.2 development snapshot (`167ab2dc207b03fde53d524dd13902a928539b43`), published now rather than on its original development date.

## What's new in 1.2

- Basic Brush Studio controls for spacing, flow, opacity, edge hardness, pressure and stabilization, with device-local settings for each preset.
- Grid and isometric visual guides, plus vertical, horizontal, quadrant and radial symmetry with selected-layer drawing assist.
- Improved stroke batching and support for coalesced input samples; animation settings for FPS, onion opacity and preview mode.
- Optional silent MP4 recording of one animation loop when the Android WebView supports the required MP4 encoder and canvas capture.

This rebranded retrospective build retains the 1.1 New canvas fix, loading icon, Qmer credit and three-finger undo/four-finger redo. Unlike the original 1.2 snapshot, it uses those gestures rather than two-finger undo/three-finger redo; package and storage names are unchanged. Grid and isometric guides are visual only, not snapping guides. MP4 support depends on the device. This is not full Procreate parity.

Automated tests cover the historical features and basic gestures. **The rebuilt APK, Android gestures, MP4 encoding and MediaStore exports have not been tested on a physical Android device.**

## Download

- [Qelem 1.2 APK](artifacts/releases/Qelem-1.2.apk) · Android 8.0 or later
- [Qelem 1.2 source archive](artifacts/releases/Qelem-1.2-source.zip)
- [Release notes](https://github.com/mubareksam/Qelem/releases/tag/v1.2)
- [Previous release: Qelem 1.1](https://github.com/mubareksam/Qelem/releases/tag/v1.1)

The APK has the same package identifier and signing certificate as 1.0 and 1.1 and should install as an update. **Back up artwork before changing versions.** Installing 1.2 over a newer development build is normally blocked by Android; uninstalling can erase app data. Older builds may not preserve features added by newer builds.

## Build and test

```sh
bash tools/fetch-toolchain.sh
(cd tools/apksign && npm ci)
(cd tools/tests && npm ci && npm test)
bash tools/build.sh
```

The output is `artifacts/Qelem-1.2.apk`. The Android app uses a WebView and is packaged without Gradle. It was imported from `mubareksam/guzo` commit `525d0de`; it was not rebuilt from scratch.

**Signing:** The included build uses the publicly available test key in `tools/apksign/key.pem`, which is unsuitable for trusted production distribution. A private production signing key will not be accepted as an update to this test-key build.

Qelem is independent and not affiliated with Procreate or Savage Interactive.
