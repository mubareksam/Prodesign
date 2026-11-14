<p align="center"><img src="native/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png" alt="Qelem logo" width="128"></p>

<h1 align="center">Qelem</h1>

Qelem is an independent Android painting and frame-animation app. This repository contains the existing Qelem app and an experimental native edition built on ProCraft's Kotlin/Compose interface and Rust/wgpu engine.

## Download Qelem

- **[Qelem 1.5 native preview](docs/QELEM-1.5-PREVIEW.md)** — Android arm64 and Windows x64 development previews. Not a replacement for earlier Qelem; the native Android app cannot import the old gallery.
- [Qelem native preview APK — arm64](artifacts/Qelem-native-preview-arm64.apk) — experimental native edition, Android 9 or later; [build and signature details](artifacts/Qelem-native-preview-arm64.txt).
- [Qelem 7.23 development APK](artifacts/Qelem-7.23-dev.apk) — existing WebView-based Qelem, **not the native edition**.
- [Qelem 7.23 source archive](artifacts/Qelem-7.23-dev-source.zip).
- [Earlier Qelem 1.4 release](artifacts/releases/Qelem-1.4.apk) and [release notes](https://github.com/mubareksam/Qelem/releases/tag/v1.4).

The native APK is a debug-signed preview, built on GitHub but **not tested on a physical device**. Its source, feature status and build instructions are in [native/README.md](native/README.md). Do not download an upstream ProCraft APK expecting it to contain Qelem's changes.

## Windows + Android tablet connectivity preview

- [Download Qelem for Windows x64](artifacts/Qelem-Windows-timeline-preview-x64.zip) (portable, unsigned preview).
- [Download Qelem Tablet for Android 9+](artifacts/Qelem-Tablet-remote-0.6-preview.apk) (separate debug-signed controller).
- [Setup, security and limitations](native/QELEM-PHONE-TABLET.md) · [controller build and signature details](artifacts/Qelem-Windows-and-Tablet-remote-0.6-preview.txt).

The ZIP includes Qelem and a standalone Windows tablet server with a native window and QR pairing. Connect via private Wi-Fi, offline hotspot, USB with ADB reverse, or experimental Bluetooth Classic directly between paired devices. Use the Qelem or Windows remote and choose absolute tablet mode or relative mouse mode. Windows synthetic pen is not a HID/Wintab driver and may not work in every application. QR scanning was revised after a crash report, but scanning and Bluetooth still need device verification. Wi-Fi and QR secrets are unencrypted. Builds and automated tests passed, but **not tested together on real devices**. The [previous connectivity preview](artifacts/Qelem-Windows-and-Tablet-connectivity-preview.txt) remains available separately.

## Artwork safety

Back up projects from the existing app and verify the backups. Do not uninstall Qelem: uninstalling can erase private artwork. The native preview uses a separate package and has no Qelem project importer, so it cannot automatically access or migrate your existing gallery. Installing an older APK over a newer one is normally blocked by Android.

The existing development APK uses a publicly available test signing key and has not been tested on a physical Android device. It is not production-signed.

## Credits

The native work is based on [ProCraft](https://github.com/artcraft-android/procraft); its licenses, notices and asset attributions are retained under `native/`. Qelem is not affiliated with ProCraft or Procreate.
