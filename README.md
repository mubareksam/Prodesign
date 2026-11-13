# Qelem 1.4

Qelem is an independent, offline Android painting and frame-animation app developed by **Qmer** and inspired by Procreate. This retrospective release is based on historical commit `0973550d39e6237d46673f8b331a632a48fe7ea6`, published now rather than on its original development date.

## What's new in 1.4

- Optional frame group labels appear on the animation timeline, persist with the project, and are copied when a frame is duplicated. Labels are tags, not nested groups or batch operations.
- Four basic effects: horizontal motion blur, sharpen, bloom and glitch. Effects edit pixels destructively on the current layer and frame, and can be undone; they are not live previews.
- Retains 1.3's frame holds, onion controls, PNG sequences and other painting and animation features. See the [feature inventory](docs/FEATURES.md) for limitations.

This reconstructed version retains Qelem branding, Qmer credit, the 1.1 New canvas fix and loading icon. Unlike the original historical snapshot, it uses **three-finger tap to undo and four-finger tap to redo**, matching the rebranded 1.0–1.3 releases. This is not full Procreate parity.

Automated tests cover the historical changes. **The rebuilt APK, Android gestures, MP4 encoding and MediaStore exports have not been tested on a physical Android device.** MP4 depends on the Android WebView and device.

## Download

- [Qelem 1.4 APK](artifacts/releases/Qelem-1.4.apk) · Android 8.0 or later
- [Qelem 1.4 source archive](artifacts/releases/Qelem-1.4-source.zip)
- [Release notes](https://github.com/mubareksam/Qelem/releases/tag/v1.4)
- [Previous release: Qelem 1.3](https://github.com/mubareksam/Qelem/releases/tag/v1.3)

The APK has the same package and signing certificate as 1.0–1.3 and should install as an update. **Back up artwork before changing versions.** Installing 1.4 over a newer development build is normally blocked by Android; uninstalling can erase app data. Older builds may not preserve features from newer builds.

## Build and test

```sh
bash tools/fetch-toolchain.sh
(cd tools/apksign && npm ci)
(cd tools/tests && npm ci && npm test)
bash tools/build.sh
```

The output is `artifacts/Qelem-1.4.apk`. The Android app uses a WebView and is packaged without Gradle. It was imported from `mubareksam/guzo` commit `525d0de`; it was not rebuilt from scratch.

**Signing:** The included build uses the publicly available test key in `tools/apksign/key.pem`, which is unsuitable for trusted production distribution. A private production signing key will not be accepted as an update to this test-key build.

Qelem is independent and not affiliated with Procreate or Savage Interactive.
