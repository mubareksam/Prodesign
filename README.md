# Prodesign · Qalam

Developed by **Qmer**. Qalam is an offline painting and frame-animation app for Android, inspired by Procreate. It includes pressure-sensitive brushes, brush-size presets, a matched-brush eraser, layer solo and blend modes, a colour picker, image import as a layer, a timeline with onion skin, a motion guide with baked path animation, two-pose transforms, editable camera and layer keyframes, a limited two-layer IK key generator, easing and baked particle animation, an audio track for preview and compatible MP4 export, playback ranges and batch frame tools, gesture shortcuts, guides, drag-to-fill and a fill tool, rectangular, freehand lasso and connected-colour magic-wand selection masking, layer and alpha locking, clipping masks, basic transforms and transparent PNG and sprite-sheet export, canvas reference, brush customization and layer effects, autosave, PNG/GIF export, and capability-dependent MP4 export.

## Download and install

- [Qalam 3.5 APK](artifacts/Qalam-3.5.apk) · Android 8.0 or later
- [Download bundle](artifacts/Qalam-3.5-package.zip) · APK, README and documentation

Copy the APK to your device and open it with a file manager. You may need to allow installation from that source. Version 3.5 is signed with the same key as earlier versions and should install as an update, keeping your artwork; Android asks for confirmation and does not let the app silently uninstall or replace itself. Back up important artwork before updating. The app requests `VIBRATE` only and has no internet permission. See the [user guide](docs/qalam.md) for controls and export instructions.

**Signing:** The included APK and default build use the publicly available key in `tools/apksign/key.pem`. It is suitable only for testing, not a trusted production release: anyone can use it to sign an APK claiming to be this app. Use a private, securely stored signing key for a release; changing keys means Android will not accept it as an update to the included APK.

## Build and test

The app uses HTML/CSS/JavaScript in an Android WebView and is packaged without Gradle or the Android SDK. The toolchain fetch script requires Python, pip, Node.js/npm, Git and network access; it downloads tools into `~/.cache/tc` by default.

```sh
bash tools/fetch-toolchain.sh
(cd tools/tests && npm test)
bash tools/build.sh
```

The build writes `artifacts/Qalam-3.5.apk`, checks the Java reference sources, assembles and signs the APK, then verifies it. Builds need not be byte-for-byte identical. `QALAM_TOOLCHAIN` overrides the toolchain directory. The automated tests use a headless DOM/canvas harness; they do not replace testing on a real device.

## Documentation

- [User guide and architecture](docs/qalam.md)
- [Procreate analysis and feature comparison](docs/procreate-analysis.md)
- [Feature coverage and remaining work](docs/FEATURES.md)
- [Implementation blueprint](docs/BLUEPRINT.md)

The Android app and its supporting files were imported from the public `arena/38db308d-guzo` branch of `mubareksam/guzo` at commit `525d0de`.

Qalam is independent and not affiliated with Procreate or Savage Interactive.
