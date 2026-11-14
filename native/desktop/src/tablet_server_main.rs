//! A small explicit standalone Windows receiver; no GPU or Qelem canvas required.
#[cfg(windows)]
mod phone_tablet;
#[cfg(windows)]
mod system_pen;

#[cfg(windows)]
fn main() {
    use std::io::{self, Write};
    use std::sync::atomic::Ordering;
    use phone_tablet::Command;
    fn ask(label: &str) -> String { print!("{label}"); let _ = io::stdout().flush(); let mut s = String::new(); let _ = io::stdin().read_line(&mut s); s.trim().to_owned() }
    println!("Qelem Tablet Server (experimental)\nOnly use trusted devices and private networks. Input is unencrypted.\n1: Wi-Fi / hotspot    2: USB (ADB)    3: Bluetooth SPP COM");
    let choice = ask("Connection [1/2/3]: ");
    let com = if choice == "3" { ask("Windows outgoing Bluetooth COM port (e.g. COM5): ") } else { String::new() };
    if !matches!(choice.as_str(), "1" | "2" | "3") { eprintln!("Invalid connection."); let _ = ask("Press Enter to close."); return; }
    let mut pen = match system_pen::SystemPen::new() { Ok(p) => p, Err(e) => { eprintln!("Pen unavailable: {e}"); let _ = ask("Press Enter to close."); return; } };
    let (wake_tx, wake_rx) = std::sync::mpsc::sync_channel::<()>(1);
    let wake = move || { let _ = wake_tx.try_send(()); };
    let server = if choice == "3" { phone_tablet::Server::start_bluetooth(wake, &com) } else { phone_tablet::Server::start(wake, choice == "2") };
    let server = match server { Ok(s) => s, Err(e) => { eprintln!("Could not start: {e}"); let _ = ask("Press Enter to close."); return; } };
    println!("\nPairing code: {}", server.token);
    if choice == "1" { println!("Find the PC's private IPv4 with ipconfig. Enter it and the code manually on Android."); }
    if choice == "2" { println!("Run: adb reverse tcp:48652 tcp:48652\nChoose USB on Android, then enter the code."); }
    if choice == "3" { println!("On Android choose Bluetooth and enter this code. Keep the paired phone listening. See README for outgoing COM setup."); }
    println!("Choose the Windows remote on Android. Select the target app on this PC. Close this window to stop.\n");
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
