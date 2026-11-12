# Qelem 1.3

Qelem is an independent, offline Android painting and frame-animation app developed by **Qmer** and inspired by Procreate. This retrospective release is based on the historical 1.3 snapshot (`06e6d4f7c479abf144710d7f0691ad83bc054a70`), published now rather than on its original development date.

## What's new in 1.3

- Per-frame holds from 1 to 12 ticks, reflected in playback and animation exports.
- Onion skins with one to four previous and next frames, adjustable opacity and colours.
- Basic destructive effects on the current layer and frame, including blur, grayscale, invert, sepia, brightness and other colour effects; Undo restores the previous pixels.
- Numbered PNG sequence export. GIF and capability-dependent silent MP4 export use frame holds and playback order.

This reconstructed version retains the Qelem branding, Qmer credit, 1.1 New canvas fix and loading icon. Unlike the original historical snapshot, it uses **three-finger tap to undo and four-finger tap to redo**, matching the rebranded 1.0–1.2 releases. Grid and isometric guides are visual only. The effects are basic destructive edits, not live previews, and this is not full Procreate parity.

Automated tests cover the historical changes. **The rebuilt APK, Android gestures, MP4 encoding and MediaStore exports have not been tested on a physical Android device.** MP4 depends on the Android WebView and device.

## Download

- [Qelem 1.3 APK](artifacts/releases/Qelem-1.3.apk) · Android 8.0 or later
- [Qelem 1.3 source archive](artifacts/releases/Qelem-1.3-source.zip)
- [Release notes](https://github.com/mubareksam/Qelem/releases/tag/v1.3)
- [Previous release: Qelem 1.2](https://github.com/mubareksam/Qelem/releases/tag/v1.2)

The APK has the same package and signing certificate as 1.0–1.2 and should install as an update. **Back up artwork before changing versions.** Installing 1.3 over a newer development build is normally blocked by Android; uninstalling can erase app data. Older builds may not preserve features from newer builds.

## Build and test

```sh
bash tools/fetch-toolchain.sh
(cd tools/apksign && npm ci)
(cd tools/tests && npm ci && npm test)
bash tools/build.sh
```

The output is `artifacts/Qelem-1.3.apk`. The Android app uses a WebView and is packaged without Gradle. It was imported from `mubareksam/guzo` commit `525d0de`; it was not rebuilt from scratch.

**Signing:** The included build uses the publicly available test key in `tools/apksign/key.pem`, which is unsuitable for trusted production distribution. A private production signing key will not be accepted as an update to this test-key build.

Qelem is independent and not affiliated with Procreate or Savage Interactive.
