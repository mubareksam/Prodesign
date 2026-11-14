//! A small explicit standalone Windows receiver; no GPU or Qelem canvas required.
#[cfg(windows)]
mod phone_tablet;
#[cfg(windows)]
mod system_pen;
#[cfg(windows)]
mod phone_pairing;
#[cfg(windows)]
mod phone_console_qr;
#[cfg(windows)]
#[path = "vendor/qrcodegen.rs"]
mod qrcodegen;

#[cfg(windows)]
fn main() {
    use std::io::{self, Write};
    use std::sync::atomic::Ordering;
    use phone_tablet::Command;
    fn ask(label: &str) -> String { print!("{label}"); let _ = io::stdout().flush(); let mut s = String::new(); let _ = io::stdin().read_line(&mut s); s.trim().to_owned() }
    println!("Qelem Tablet Server (experimental)\nOnly use trusted devices and private networks. Input is unencrypted.\n1: Wi-Fi / hotspot    2: USB (ADB)    3: Bluetooth SPP COM");
    let choice = ask("Connection [1/2/3]: ");
    let com = if choice == "3" { ask("Windows outgoing Bluetooth COM port (e.g. COM5): ") } else { String::new() };
    let ip = if choice == "1" {
        let guess = phone_pairing::default_ip();
        println!("Find the PC IPv4 with ipconfig if multiple adapters are present. Detected: {}", if guess.is_empty() { "none" } else { &guess });
        let typed = ask("Private PC IPv4 (Enter to use detected): ");
        if typed.is_empty() { guess } else { typed }
    } else { String::new() };
    if !matches!(choice.as_str(), "1" | "2" | "3") { eprintln!("Invalid connection."); let _ = ask("Press Enter to close."); return; }
    let mut pen = match system_pen::SystemPen::new() { Ok(p) => p, Err(e) => { eprintln!("Pen unavailable: {e}"); let _ = ask("Press Enter to close."); return; } };
    let (wake_tx, wake_rx) = std::sync::mpsc::sync_channel::<()>(1);
    let wake = move || { let _ = wake_tx.try_send(()); };
    let server = if choice == "3" { phone_tablet::Server::start_bluetooth(wake, &com) } else { phone_tablet::Server::start(wake, choice == "2") };
    let server = match server { Ok(s) => s, Err(e) => { eprintln!("Could not start: {e}"); let _ = ask("Press Enter to close."); return; } };
    println!("\nPairing code (manual fallback): {}", server.token);
    if choice == "1" { println!("Android and PC need the same trusted Wi-Fi or hotspot. PC IPv4: {ip}"); }
    if choice == "2" { println!("Run: adb reverse tcp:48652 tcp:48652"); }
    if choice == "3" { println!("Pair PC and phone; prepare the Bluetooth service on Android and configure the outgoing COM port."); }
    println!("Scan this QR in Qelem Tablet. Choose the Windows remote, then select your target app. Close this window to stop.");
    println!("If the QR is clipped, enlarge the terminal or zoom out. QR contains the secret; don't share it.");
    let payload = if choice == "3" { phone_pairing::bluetooth_payload(&server.token) } else { phone_pairing::payload(&ip, choice == "2", &server.token) };
    if !payload.as_deref().is_some_and(phone_console_qr::show) {
        println!("QR unavailable: use the manual pairing code and private PC IPv4 shown above.");
    }
    loop {
        let _ = wake_rx.recv_timeout(std::time::Duration::from_millis(250));
        for event in server.incoming.try_iter() {
            let result = match event {
                Command::Hover(x,y) => pen.hover(x,y),
                Command::Down(x,y,p,_) => pen.down(x,y,p),
                Command::Move(x,y,p) => pen.moved(x,y,p),
                Command::Up(x,y,p) => pen.up(x,y,p),
                Command::Cancel => { pen.cancel(); Ok(()) },
                key => system_pen::shortcut(key),
            };
            if let Err(e) = result { eprintln!("Input failed: {e}"); pen.cancel(); server.stop(); let _ = ask("Press Enter to close."); return; }
        }
        if server.ended.load(Ordering::Acquire) { pen.cancel(); println!("Disconnected or connection failed. Start server again for a new code."); let _ = ask("Press Enter to close."); return; }
    }
}
#[cfg(not(windows))]
fn main() { eprintln!("Qelem Tablet Server currently supports Windows only."); }
