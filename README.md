<p align="center"><img src="native/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png" alt="Qelem logo" width="128"></p>

<h1 align="center">Qelem</h1>

Qelem is an independent Android painting and frame-animation app. This repository contains the existing Qelem app and an experimental native edition built on ProCraft's Kotlin/Compose interface and Rust/wgpu engine.

## Download Qelem

- [Qelem 7.23 development APK](artifacts/Qelem-7.23-dev.apk) — existing WebView-based Qelem, **not the native edition**.
- [Qelem 7.23 source archive](artifacts/Qelem-7.23-dev-source.zip).
- [Earlier Qelem 1.4 release](artifacts/releases/Qelem-1.4.apk) and [release notes](https://github.com/mubareksam/Qelem/releases/tag/v1.4).

**The native edition does not yet have a built APK.** Its source, feature status and build instructions are in [native/README.md](native/README.md). Do not download an upstream ProCraft APK expecting it to contain Qelem's changes.

## Artwork safety

Back up projects from the existing app and verify the backups. Do not uninstall Qelem: uninstalling can erase private artwork. The native preview uses a separate package and has no Qelem project importer, so it cannot automatically access or migrate your existing gallery. Installing an older APK over a newer one is normally blocked by Android.

The existing development APK uses a publicly available test signing key and has not been tested on a physical Android device. It is not production-signed.

## Credits

The native work is based on [ProCraft](https://github.com/artcraft-android/procraft); its licenses, notices and asset attributions are retained under `native/`. Qelem is not affiliated with ProCraft or Procreate.
