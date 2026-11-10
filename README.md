# Qelem 1.0

Qelem is an independent, offline Android painting and frame-animation app, developed by **Qmer** and inspired by Procreate. This is a retrospective release of its first version.

## Download

- [Qelem 1.0 APK](artifacts/releases/Qelem-1.0.apk) · Android 8.0 or later
- [Matching historical source archive](artifacts/releases/Qelem-1.0-source.zip)
- [Release notes](https://github.com/mubareksam/Qelem/releases/tag/v1.0)

**Known issue:** New canvas has failed on a phone in this original version. It is not recommended for everyday artwork. Back up artwork before changing versions; Android normally won't install this older version over a newer version. Removing an app to downgrade can erase its data. Physical-device performance and compatibility have not been verified.

This build has brushes, layers, a colour picker, an animation timeline with onion skin, autosave and PNG/GIF export. Three-finger tap undoes; four-finger tap redoes. It uses the original 1.0 feature set with Qelem display branding, Qmer's About credit, Qelem export names and the updated gesture mapping. Its Android package and storage identifiers remain unchanged.

## Build and test

The app uses HTML, CSS and JavaScript in an Android WebView, packaged without Gradle or the Android SDK. The toolchain script requires Python, pip, Node.js/npm, Git and network access, and installs tools under `~/.cache/tc` by default.

```sh
bash tools/fetch-toolchain.sh
(cd tools/apksign && npm ci)
(cd tools/tests && npm ci && npm test)
bash tools/build.sh
```

The build writes `artifacts/Qelem-1.0.apk`. Automated tests don't replace Android device testing. The historical app was imported from the public `arena/38db308d-guzo` branch of `mubareksam/guzo` at commit `525d0de`.

**Signing:** The included APK and default build use a publicly available test key in `tools/apksign/key.pem`. Anyone can use it; it is not appropriate for trusted production distribution. A private production key would not be accepted as an update to builds signed with this key.

Qelem is independent and not affiliated with Procreate or Savage Interactive.
