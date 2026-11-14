# Qelem Tablet — experimental native preview

Android is a blank input pad, not a copy of the picture. Qelem's F8 panel offers either **Qelem canvas** (artwork commands are processed by Qelem), or **Windows tablet** (synthetic Windows pen delivered to the foreground app). Qelem remains open for its built-in server. The separate **Qelem-Tablet-Server.exe** is a native Windows app for other Windows apps without opening Qelem: click Wi-Fi, USB or Bluetooth to display a QR, scan it on Android, then select the **Windows** remote. The Windows receiver uses its own window rather than a terminal. Closing or minimizing hides it in the system tray; click its tray icon to reopen, and use **Exit** in the window to stop and quit. If Windows cannot create the tray icon the window stays accessible instead. Do not start both servers on the same TCP port.

On Android, once connected, choose **Qelem** for Qelem canvas mode, or **Windows** for the standalone server / Windows tablet mode. These are manually selected profiles, not automatic app detection. Qelem buttons include undo, redo, brush, eraser, smudge, pick, size and opacity. Windows offers undo/redo, save, escape and zoom; these send standard keyboard shortcuts to the foreground app and their meaning depends on that app. The Qelem-specific controls are not supported by the standalone Windows server. Close the F8 panel to draw.

## Position and draw

Select **Tablet** for absolute positioning: a location on the pad maps to a location on the PC. Select **Mouse** for a relative trackpad: each contact starts where the PC cursor already is and moving a finger moves from that point; tap or use the left/right buttons to click. The absolute pad shows faint temporary local stroke guides; these are not the PC screen, do not reflect undo or existing artwork, and can be cleared by tapping the note under the pad. In the default tablet **Move** mode, slide a finger over the pad to reposition the cursor without drawing; double-tap and keep the second touch down to draw. Turn on **Direct draw** to draw immediately instead. A supported active stylus draws on contact, supplies its reported pressure, and may send hover positions if Android exposes hover. Some passive styluses act as fingers and don't report pressure. **Stylus only** rejects finger touches; a second touch cancels the current stroke. If the app backgrounds or the connection stops, the stroke is cancelled. Keyboard shortcuts are not sent mid-stroke. The mapping covers the artwork in Qelem mode or the full virtual desktop in Windows mode; different aspect ratios can stretch it. No monitor selector or tilt yet.

## Connect

Install matching 0.6 or newer previews on both devices. Open/create an artwork in Qelem on Windows, press F8, choose a connection and target, and start pairing. Scan the QR with Android or enter the code manually. If the camera is denied or unavailable, use manual pairing. The scanner's previous crash was reported by a user; its launch and camera handling have been revised, but require verification on the affected phone.

### Wi-Fi or hotspot (no internet required)
Connect both devices to the same **trusted private** Wi-Fi or connect Windows to Android's hotspot. Choose Wi-Fi and confirm the PC's local IPv4 (`ipconfig`), especially if multiple network adapters exist; the standalone server prompts for it. Allow private-network access in Windows Firewall if asked. Internet is not required and the service is not an internet relay.

### USB (no internet required)
Install Android SDK Platform Tools on the PC, enable Android USB debugging, connect and authorize the PC. Run `adb devices` and then `adb reverse tcp:48652 tcp:48652`. Choose USB on the PC and phone. This is ADB forwarding, not plug-and-play AOA. Re-establish after reconnecting; remove with `adb reverse --remove tcp:48652`. Disable USB debugging when finished.

### Bluetooth Classic (experimental, no internet required)
Pair Android and Windows in their system Bluetooth settings first. Enable Bluetooth on both devices. Click Bluetooth in the Windows server or select it in Qelem's F8 panel and start pairing. Scan its QR in Qelem Tablet and select the paired Windows PC. The Windows app now advertises an RFCOMM service directly and the Android app connects to it, instead of requiring a manually configured outgoing COM port. The previous COM-port implementation could fail because of Windows driver and service configuration; without a device error log the exact cause on your devices is unknown. Some Windows Bluetooth drivers or policies may still not support the required RFCOMM service. The 0.6 preview reduces motion backlog, buffers reads, and tolerates a longer heartbeat gap; the underlying socket-closed error can still have other causes. Retry using a newly generated QR and verify both devices are paired and the selected PC is correct. This has not been verified with physical devices; use USB or trusted Wi-Fi if it fails.

## Security and limitations

Wi-Fi transport and the QR/code are **unencrypted bearer credentials**; anyone observing the screen or network may gain pointer and shortcut control. Use only trusted private networks, do not forward port 48652 to the internet, and stop the server after use. Bluetooth requires an authenticated, encrypted OS Bluetooth link and the Android user selects the paired PC, but this implementation has not had a security audit. ADB grants powerful debugging access; authorize only a trusted computer. The PC creates a new random code for each explicit session.

This uses Windows synthetic pen input, **not** a Wacom/Huion-compatible kernel HID or Wintab driver. Apps that reject injected input, elevated/protected windows, pressure behavior, cursor hover and Bluetooth stack interoperability need real-device testing. No tilt, native multi-monitor selection, automatic Wi-Fi Direct negotiation, AOA USB, configurable shortcuts, app auto-detection, or measured latency guarantees are provided. Back up artwork before using a preview. The Android controller is separate from the drawing app; do not uninstall a drawing app without backing up its private artwork. APKs are debug-signed and Windows executables unsigned. Android may reject an update over an older Qelem Tablet controller if their debug signing keys differ. If needed, uninstall only the old separate controller, not the Qelem drawing app; never uninstall a drawing app without backing up its artwork.

## Build

```powershell
cd native
cargo build --release --locked -p procraft-desktop
cargo test --release --locked -p procraft-desktop phone_
```

```sh
cd native/android
./gradlew :tablet:assembleDebug :tablet:testDebugUnitTest
```

QR encoding uses Project Nayuki's MIT library; scanner uses ZXing Android Embedded (Apache-2.0). See NOTICE and bundled licenses. Physical Windows/Android verification remains necessary.
