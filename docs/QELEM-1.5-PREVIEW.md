# Qelem 1.5 — native preview

This is a **pre-release preview**, not a stable replacement or update for Qelem 1.4 or the older WebView-based app. The Windows x64 and Android arm64 applications use the native ProCraft-derived drawing engine and interface. They do not include every feature of the earlier Qelem app or a full Dreams-style animation editor.

## Downloads

- [Android native drawing preview, arm64](../artifacts/releases/Qelem-1.5-preview-Android-arm64.apk) — Android 9+, debug-signed, isolated package `com.qalam.studio.nativepreview.debug`, version name `1.5-preview`.
- [Windows x64 native preview](../artifacts/Qelem-Windows-timeline-preview-x64.zip) — unsigned portable drawing app and experimental standalone tablet server.
- [Qelem Tablet Android controller](../artifacts/Qelem-Tablet-remote-0.6-preview.apk) — separate debug-signed controller for the Windows companion, not the drawing app.
- [Windows/Android pairing instructions and security limitations](../native/QELEM-PHONE-TABLET.md).

## Highlights

- Windows and Android retain the native painting canvas and have an optional single-track frame animation timeline, playback, onion skins, held frames, frame stepping, and undoable hold/reorder operations. Android has expanded timeline selection, batch holds, a ruler and scrubbing. Windows offers a larger Timeline layout from the compact Animation Assist bar.
- Android's preview range, reverse and speed are preview-only; they do not alter saved playback or exports. Storyboard and sprite-sheet PNG sharing has documented limits.
- The Windows companion and separate Android controller support experimental connections over private Wi-Fi/hotspot, USB with ADB reverse and Bluetooth Classic; see the pairing instructions before use.

## Safety and limitations

**Back up existing artwork and keep the original app installed.** The native Android preview is a separate package with no importer for the old Qelem gallery. No lossless conversion or upgrade is provided. Different debug signing keys may prevent updating an earlier native preview; do not uninstall a drawing app to work around this, because its private artwork can be lost. The Windows binaries are unsigned.

The native timeline is based on top-level frame layers/groups, not independent movie, audio or video tracks. Keyframe and Perform modes are not implemented. The Android and Windows builds and targeted automated tests passed, but actual devices, input, layout, save/reopen, exports and cross-device Bluetooth/QR connectivity still need verification. GPU-dependent persistence tests may skip without a GPU. Network pairing is unencrypted on Wi-Fi; use trusted private networks only. See [animation roadmap](../native/QELEM-DREAMS-ROADMAP.md), [fusion notes](../native/QELEM-FUSION.md), and [tablet setup](../native/QELEM-PHONE-TABLET.md) for details and limitations.

The Windows drawing/server binaries are from source commit `0ab12e3c329bd86f4fef417d86429b4cf4f4e526` and [build 43636281216](https://github.com/mubareksam/Qelem/actions/runs/43636281216). The controller is the previously built 0.6 preview (see its [verification record](../artifacts/Qelem-Windows-and-Tablet-remote-0.6-preview.txt)). The Android APK is from source commit `a6f79bb3164dd54b487523996a399ae55a6acd30`; [build and verification details](../artifacts/releases/Qelem-1.5-preview-Android-arm64.txt). These are development builds, not production-signed releases.
