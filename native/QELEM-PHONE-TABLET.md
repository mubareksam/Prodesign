# Qelem Windows + phone tablet — experimental preview

Qelem's desktop build is a native Windows x64 app using the same Rust/wgpu engine. The Android **Qelem Tablet** companion is a separate controller: its screen is a blank touch pad with undo, redo, brush size and opacity. It sends input to an open Qelem artwork on the PC; the picture appears on the PC, not on the phone. This is **not** a system-wide Wacom driver and does not control other Windows apps.

## Pairing over local Wi-Fi

1. Connect the PC and phone to the same **trusted private network**. Client isolation on guest Wi-Fi can prevent them connecting.
2. Run the Windows preview and open or create an artwork. Press **F8**, then **Start pairing**. This opens TCP port **48652** only while explicitly enabled. Allow Qelem on your private Windows firewall network if prompted. Find the PC's local IPv4 with `ipconfig` (usually `192.168.x.x` or `10.x.x.x`).
3. Open Qelem Tablet on Android 9+, enter that IPv4 and the **32-character code** shown on the PC, then Connect. The PC shows when a phone connects. Close the PC pairing panel (or press F8) before drawing.
4. Draw on the phone's blank area while looking at the PC. The whole pad maps to the whole artwork; the pad and canvas aspect ratios may differ. On a pressure-capable stylus Android reports, pressure is sent; fingers use constant pressure. No tilt, hover, palm rejection or pen-button mapping yet. A second finger cancels the current stroke. Sliders send absolute size/opacity only when moved and do not sync back from the PC.
5. Disconnect on the phone or use F8 → Stop on the PC. Backgrounding the phone disconnects. Reconnect by starting a new pairing and entering its fresh code. Disconnect during a stroke cancels that unfinished stroke. Drawing is paused while desktop dialogs/panels block the canvas, during export, or when opening an artwork. Switching artwork stops pairing.

## Safety and limitations

- The connection has a random 128-bit one-session pairing code, bounded input and one client, but **it is not encrypted**. Someone monitoring your local network can see the code and input; use only a network you trust, never expose/forward the port to the internet. Stop pairing when finished. IP address is entered manually; no discovery, QR code, USB, Bluetooth, or remote video.
- The Windows and Android controller builds, if provided, are development previews; they are **not yet tested together on real devices**. Network latency, Android pressure reporting, DPI, orientation and stability vary. Back up artwork before testing. The PC keeps its own gallery in a separate `QelemNative` directory; there is no automatic Qelem Android project migration.
- Remote input paints through the app's canvas engine and is not a Windows pen driver. There is no phone canvas preview, synchronization of PC slider values, or support for 3D, complex gestures, or simultaneous local and phone strokes. UI may block remote drawing. Strokes may be cancelled on interruption; no promise of lossless network delivery.

## Building

On Windows with Rust 1.99 and the native build prerequisites:

```powershell
cd native
cargo build --release --locked -p procraft-desktop
cargo test --release --locked -p procraft-desktop phone_tablet::tests
```

The binary is `native/target/release/procraft.exe`; its visible product name is Qelem. The phone app uses the existing Android Gradle project:

```sh
cd native/android
./gradlew :tablet:assembleDebug
```

Its debug APK is `tablet/build/outputs/apk/debug/tablet-debug.apk`. Debug signing is not suitable for production. GitHub Actions compiles both builds, but automated compilation is not a physical device test.
