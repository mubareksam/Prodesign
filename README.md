# Prodesign · Qelem

Developed by **Qmer**. Qelem is an offline painting and frame-animation app for Android, inspired by Procreate, with a canvas-first studio, streamlined toolbar and adaptive panels. It includes canvas transform handles for uniform and freeform scaling, rotation, distortion and basic mesh warp, visible-layer and all-matching fill and Magic Wand sampling, named device-local palettes and HEX colour lists, improved smudge with optional stylus pressure, batch blank-frame insertion, cel-range clearing, frame navigation, brush favorites, palette extraction and organization, device-local custom brush copies, expanded brush dynamics and live previews, add/subtract selection operations, device-local saved palettes, gallery artwork duplication, ellipse selections, layer colour tags, JPEG export and split-complementary colour suggestions, right-swipe and tap-based multi-layer selection with batch actions, yellow-accented light/dark themes, 28 searchable brush presets with stroke thumbnails, a basic smudge tool with adjustable edge, visual solid and gradient layer controls with transparency and custom angle, pressure-sensitive brushes with global pressure, smoothing and hold-timing controls, external reference images, brush-size presets, adjustable brush-slider layout, light/dark appearance, quick-fit and layer alpha-lock controls, a distraction-free canvas view, read-only gallery previews, a matched-brush eraser, layer solo and blend modes, a colour picker with pure-hue and harmony shortcuts, a transparency preview, invert selection, image import as a layer, a timeline with onion skin, a motion guide with baked path animation, two-pose transforms, editable camera and layer keyframes, a limited two-layer IK key generator, easing and baked particle animation, an audio track for preview and compatible MP4 export, playback ranges and batch frame tools, gesture shortcuts, guides, drag-to-fill, a fill tool and matching-colour recolour, rectangular, elliptical, freehand lasso and connected-colour magic-wand selection masking, numeric resize and rotation, session-only cut/copy/paste, confirmed current-cel clearing, layer and alpha locking, clipping masks, basic transforms and transparent PNG and sprite-sheet export, canvas reference, brush customization and layer effects, autosave, PNG/JPEG/GIF export, and capability-dependent MP4 export.

## Download and install

- [Qelem 6.0 APK](artifacts/Qelem-6.0.apk) · Android 8.0 or later
- [Download bundle](artifacts/Qelem-6.0-package.zip) · APK, README and documentation

Qelem is the corrected spelling of Qalam, not a separate app: the package, signing key and storage identifiers remain unchanged. Export filenames now start with `Qelem-`, while Android 10+ exports remain in `Pictures/Qalam` or `Movies/Qalam`.

Copy the APK to your device and open it with a file manager. You may need to allow installation from that source. Version 6.0 is signed with the same key as earlier versions and should install as an update, keeping your artwork; Android asks for confirmation and does not let the app silently uninstall or replace itself. Back up important artwork before updating. The app requests `VIBRATE` only and has no internet permission. See the [user guide](docs/qalam.md) for controls and export instructions.

**Signing:** The included APK and default build use the publicly available key in `tools/apksign/key.pem`. It is suitable only for testing, not a trusted production release: anyone can use it to sign an APK claiming to be this app. Use a private, securely stored signing key for a release; changing keys means Android will not accept it as an update to the included APK.

## Build and test

The app uses HTML/CSS/JavaScript in an Android WebView and is packaged without Gradle or the Android SDK. The toolchain fetch script requires Python, pip, Node.js/npm, Git and network access; it downloads tools into `~/.cache/tc` by default.

```sh
bash tools/fetch-toolchain.sh
(cd tools/tests && npm test)
bash tools/build.sh
```

The build writes `artifacts/Qelem-6.0.apk`, checks the Java reference sources, assembles and signs the APK, then verifies it. Builds need not be byte-for-byte identical. `QALAM_TOOLCHAIN` overrides the toolchain directory. The automated tests use a headless DOM/canvas harness. For optional real-browser layout checks, install a local Chromium and run `(cd tools/tests && CHROMIUM_PATH=/path/to/chromium npm run test:browser)`. An optional desktop raster benchmark is `(cd tools/tests && npm run bench:smudge)`; it does not measure Android performance. Neither replaces testing on a real Android device.

## Documentation

- [User guide and architecture](docs/qalam.md)
- [Procreate analysis and feature comparison](docs/procreate-analysis.md)
- [Feature coverage and remaining work](docs/FEATURES.md)
- [Implementation blueprint](docs/BLUEPRINT.md)

The Android app and its supporting files were imported from the public `arena/38db308d-guzo` branch of `mubareksam/guzo` at commit `525d0de`.

Qelem is independent and not affiliated with Procreate or Savage Interactive.
