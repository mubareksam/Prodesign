# Qelem tablet mode — experimental

The Qelem Windows app is still the painting app. Its F8 connectivity panel can receive the independent **Qelem Tablet** Android app in two modes:

- **Qelem canvas:** the phone controls the artwork open in Qelem, including undo/redo and size/opacity.
- **Windows tablet (experimental):** the phone sends a Windows synthetic pen to the desktop, so compatible Windows Ink applications can receive drawing input. Keep Qelem open (you may minimize it) and select the target application. This is not a kernel HID driver, Wintab driver or guaranteed compatibility with all applications; protected/elevated windows and some apps may reject synthetic input. Undo/redo and size/opacity buttons only control Qelem canvas mode.

The controller APK is debug-signed. Android may reject it as an update if an older Qelem Tablet preview used a different debug key; uninstall only the old **Qelem Tablet controller** if necessary, not your separate Qelem drawing app. Never uninstall a drawing app without backing up its private artwork first.

## Connect

Open/create an artwork in Qelem on Windows, press F8, choose the connection and target, and select **Start pairing**. The Android app can scan the pairing QR or enter the 32-character code manually. Close the F8 panel before drawing. Stop pairing when finished. If a connection breaks, the current stroke is cancelled and a new pairing code is needed. The blank pad maps to the entire artwork (Qelem mode) or Windows virtual desktop (Windows mode), which can distort if aspect ratios differ. There is not yet a monitor picker, hover, tilt, eraser mapping, or robust palm rejection; stylus-only mode rejects a finger start, while a second finger cancels the stroke. Android reports stylus pressure only where the hardware supports it.

### Wi-Fi or a phone hotspot — no internet required

Connect both devices to the same **trusted private** Wi-Fi network, or connect the PC to the Android phone's hotspot. The router/hotspot does not need internet. Select Wi-Fi on the PC and confirm its local IPv4 address (find it with Windows `ipconfig`), then scan the QR in the Android app. Windows firewall may ask to allow private-network connections.

### USB cable via Android Debug Bridge — no internet required

This is **ADB port forwarding**, not InkBridge's USB accessory mode. Install Google's Android SDK Platform Tools on the PC beforehand. On Android, enable Developer Options and USB debugging; connect the cable and authorize this PC. On the PC run:

```text
adb devices
adb reverse tcp:48652 tcp:48652
```

Select **USB (ADB)** on the F8 pairing panel before starting, then scan the QR; the phone connects to its loopback address through that reverse tunnel. Some phone vendors disable USB debugging; enterprise policies and USB drivers can interfere. The tunnel stops when disconnected and must be re-established after reboot/replugging. To remove it: `adb reverse --remove tcp:48652`. Do not use USB debugging with an untrusted computer.

### Not yet implemented

Bluetooth, direct USB accessory (AOA without ADB), automatic Wi-Fi Direct negotiation, native multi-monitor selection and system-wide HID/Wintab driver support are **not implemented**. Do not interpret a hotspot connection as automatic Wi-Fi Direct. InkBridge is a Linux application with a Linux `uinput` driver and cannot be installed as the Windows driver. The user interface and workflow are inspired by its public screenshots; Qelem uses independently implemented code and Qelem branding.

## Security and data

The connection and QR payload are **unencrypted**. USB mode listens only on PC loopback; Wi-Fi mode listens on the PC network interfaces. The QR contains the pairing secret; anyone observing your screen or trusted network could gain control. Never use a public/guest network, never forward port 48652 to the internet, and close pairing when not in use. The random code expires after one connection. ADB is an additional powerful debugging capability: enable it only with a trusted PC and turn it off afterwards. No artwork is transferred to the phone. Back up artwork before trying preview software; this build does not migrate the old Android gallery.

## Build & verification

```powershell
cd native
cargo build --release --locked -p procraft-desktop
cargo test --release --locked -p procraft-desktop phone_
```

```sh
cd native/android
./gradlew :tablet:assembleDebug :tablet:testDebugUnitTest
```

This work needs physical Windows/Android testing, including QR camera permissions, ADB, firewall, pressure, Windows Ink compatibility and interruption behavior. The QR encoder is Project Nayuki's MIT-licensed library; ZXing Android Embedded is Apache-2.0. Windows and Android builds are development previews, not production-signed releases.
