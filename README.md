# Qelem 1.1

Qelem is an independent, offline Android painting and frame-animation app, developed by **Qmer** and inspired by Procreate. This is a retrospective release of version 1.1.

## What's new in 1.1

- The New canvas dialog now appears over the gallery instead of inside a hidden screen.
- A prominent gallery action makes starting a canvas easier to find.
- A launch screen displays the app icon while the studio starts.

The fix is covered by automated UI tests; this rebuilt version has not been tested on a physical Android device. It retains brushes, layers, a colour picker, an animation timeline with onion skin, autosave and PNG/GIF export. Three-finger tap undoes; four-finger tap redoes.

## Download

- [Qelem 1.1 APK](artifacts/releases/Qelem-1.1.apk) · Android 8.0 or later
- [Qelem 1.1 source archive](artifacts/releases/Qelem-1.1-source.zip)
- [Release notes](https://github.com/mubareksam/Qelem/releases/tag/v1.1)
- [Previous release: Qelem 1.0](https://github.com/mubareksam/Qelem/releases/tag/v1.0)

The APK uses the same package identifier and signing certificate as Qelem 1.0 and should install as an update. Back up artwork before changing versions. Installing an older version over a newer one is normally blocked by Android, and uninstalling an app can erase its data.

## Build and test

The app uses HTML, CSS and JavaScript in an Android WebView, packaged without Gradle or the Android SDK. The toolchain script requires Python, pip, Node.js/npm, Git and network access, and installs tools under `~/.cache/tc` by default.

```sh
bash tools/fetch-toolchain.sh
(cd tools/apksign && npm ci)
(cd tools/tests && npm ci && npm test)
bash tools/build.sh
```

The build writes `artifacts/Qelem-1.1.apk`. Automated tests don't replace Android device testing. The historical app was imported from the public `arena/38db308d-guzo` branch of `mubareksam/guzo` at commit `525d0de`.

**Signing:** The included APK and default build use a publicly available test key in `tools/apksign/key.pem`. Anyone can use it; it is not appropriate for trusted production distribution. A private production key would not be accepted as an update to builds signed with this key.

Qelem is independent and not affiliated with Procreate or Savage Interactive.
