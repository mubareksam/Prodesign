//! Opt-in local-network drawing pad, not an operating-system tablet driver.
//! The protocol is intentionally small and bounded. It is NOT encrypted; use a trusted LAN only.
use std::io::{self, Read, Write};
use std::net::{Shutdown, TcpListener, TcpStream};
use std::sync::{Arc, atomic::{AtomicBool, Ordering}, mpsc::{self, Receiver, SyncSender, TrySendError}};
use std::time::Duration;

pub const PORT: u16 = 48652;
const MAX_LINE: usize = 128;
const QUEUE: usize = 1024;

#[derive(Debug, PartialEq, Clone, Copy)]
pub enum Command {
    Hover(f32, f32), Down(f32, f32, f32, bool), Move(f32, f32, f32), Up(f32, f32, f32), Cancel,
    Undo, Redo, Save, Escape, ZoomIn, ZoomOut, Paint, Erase, Smudge, Pick, Size(f32), Opacity(f32), Ping,
}

fn unit(s: Option<&str>) -> Option<f32> {
    let v = s?.parse::<f32>().ok()?;
    (v.is_finite() && (0.0..=1.0).contains(&v)).then_some(v)
}

pub fn parse(line: &str) -> Option<Command> {
    let mut p = line.split_ascii_whitespace();
    let out = match p.next()? {
        "H" => Command::Hover(unit(p.next())?, unit(p.next())?),
        "D" => Command::Down(unit(p.next())?, unit(p.next())?, unit(p.next())?, match p.next()? { "S" => true, "F" => false, _ => return None }),
        "M" => Command::Move(unit(p.next())?, unit(p.next())?, unit(p.next())?),
        "U" => Command::Up(unit(p.next())?, unit(p.next())?, unit(p.next())?),
        "C" => Command::Cancel,
        "SAVE" => Command::Save,
        "ESCAPE" => Command::Escape,
        "ZOOMIN" => Command::ZoomIn,
        "ZOOMOUT" => Command::ZoomOut,
        "PAINT" => Command::Paint,
        "ERASE" => Command::Erase,
        "SMUDGE" => Command::Smudge,
        "PICK" => Command::Pick,
        "UNDO" => Command::Undo,
        "REDO" => Command::Redo,
        "SIZE" => Command::Size(unit(p.next())?),
        "OPACITY" => Command::Opacity(unit(p.next())?),
        "PING" => Command::Ping,
        _ => return None,
    };
    if p.next().is_some() { None } else { Some(out) }
}

/// A bounded line, with a timeout so Stop closes even an idle client. No unbounded allocation.
fn line(stream: &mut impl Read, stop: &AtomicBool) -> io::Result<Option<String>> {
    line_with_idle_limit(stream, stop, 15)
}

fn line_with_idle_limit(stream: &mut impl Read, stop: &AtomicBool, idle_limit: u32) -> io::Result<Option<String>> {
    let mut bytes = Vec::with_capacity(MAX_LINE);
    let mut b = [0];
    let mut idle = 0;
    loop {
        if stop.load(Ordering::Relaxed) { return Ok(None); }
        match stream.read(&mut b) {
            Ok(0) => return Ok(None),
            Ok(_) => {
                idle = 0;
                if b[0] == b'\n' {
                    return String::from_utf8(bytes).map(Some).map_err(|_| io::ErrorKind::InvalidData.into());
                }
                if b[0] < 32 || b[0] > 126 || bytes.len() >= MAX_LINE { return Err(io::ErrorKind::InvalidData.into()); }
                bytes.push(b[0]);
            }
            Err(e) if matches!(e.kind(), io::ErrorKind::WouldBlock | io::ErrorKind::TimedOut) => {
                idle += 1;
                if idle >= idle_limit { return Ok(None); }
            }
            Err(e) => return Err(e),
        }
    }
}

pub struct Server {
    pub token: String,
    pub incoming: Receiver<Command>,
    stop: Arc<AtomicBool>,
    pub connected: Arc<AtomicBool>,
    pub ended: Arc<AtomicBool>,
}

impl Server {
    pub fn start(wake: impl Fn() + Send + 'static, usb_only: bool) -> Result<Self, String> {
        let mut secret = [0u8; 16];
        getrandom::fill(&mut secret).map_err(|e| format!("Unable to create a pairing code: {e}"))?;
        let token: String = secret.iter().map(|v| format!("{v:02x}")).collect();
        // ADB reverse reaches localhost on the PC; USB mode must not listen on Wi-Fi.
        let host = if usb_only { "127.0.0.1" } else { "0.0.0.0" };
        let listener = TcpListener::bind((host, PORT)).map_err(|e| format!("Can't open port {PORT}: {e}"))?;
        listener.set_nonblocking(true).map_err(|e| e.to_string())?;
        let (tx, rx) = mpsc::sync_channel(QUEUE);
        let stop = Arc::new(AtomicBool::new(false));
        let connected = Arc::new(AtomicBool::new(false));
        let ended = Arc::new(AtomicBool::new(false));
        let (s, c, e, key) = (stop.clone(), connected.clone(), ended.clone(), token.clone());
        std::thread::Builder::new().name("qelem-phone-tablet".into()).spawn(move || {
            serve(listener, &key, &s, &c, &tx, &wake);
            c.store(false, Ordering::Release);
            e.store(true, Ordering::Release);
            wake();
        }).map_err(|e| e.to_string())?;
        Ok(Self { token, incoming: rx, stop, connected, ended })
    }
    /// Bluetooth Classic SPP through a manually configured outgoing Windows COM port.
    #[cfg(windows)]
    pub fn start_bluetooth(wake: impl Fn() + Send + 'static, port: &str) -> Result<Self, String> {
        let upper = port.trim().to_ascii_uppercase();
        let number = upper.strip_prefix("COM").and_then(|s| s.parse::<u16>().ok()).filter(|n| *n > 0)
            .ok_or("Enter a Windows COM port, for example COM5")?;
        let mut secret = [0u8; 16];
        getrandom::fill(&mut secret).map_err(|e| e.to_string())?;
        let token: String = secret.iter().map(|v| format!("{v:02x}")).collect();
        let (tx, rx) = mpsc::sync_channel(QUEUE);
        let stop = Arc::new(AtomicBool::new(false));
        let connected = Arc::new(AtomicBool::new(false));
        let ended = Arc::new(AtomicBool::new(false));
        let (s,c,e,key) = (stop.clone(), connected.clone(), ended.clone(), token.clone());
        std::thread::Builder::new().name("qelem-bluetooth".into()).spawn(move || {
            // Windows may attempt opening the port before the phone has started listening.
            for _ in 0..60 {
                if s.load(Ordering::Acquire) { break; }
                match bluetooth_session(number, &key, &s, &c, &tx, &wake) {
                    Ok(()) => break,
                    Err(error) if error.kind() == io::ErrorKind::InvalidData || c.load(Ordering::Acquire) => { log::warn!("Bluetooth: {error}"); break; }
                    Err(error) => { log::warn!("Bluetooth: {error}"); std::thread::sleep(Duration::from_secs(2)); }
                }
            }
            c.store(false, Ordering::Release); e.store(true, Ordering::Release); wake();
        }).map_err(|e| e.to_string())?;
        Ok(Self { token, incoming: rx, stop, connected, ended })
    }
    pub fn stop(&self) { self.stop.store(true, Ordering::Release); }
}
impl Drop for Server { fn drop(&mut self) { self.stop(); } }

fn serve(listener: TcpListener, token: &str, stop: &AtomicBool, connected: &AtomicBool, tx: &SyncSender<Command>, wake: &impl Fn()) {
    while !stop.load(Ordering::Acquire) {
        let mut stream = match listener.accept() {
            Ok((s, _)) => s,
            Err(e) if e.kind() == io::ErrorKind::WouldBlock => { std::thread::sleep(Duration::from_millis(50)); continue; }
            Err(_) => break,
        };
        // On Windows an accepted socket can inherit the listener's nonblocking mode. Restore
        // blocking mode before setting timeouts; otherwise a momentary WouldBlock ends the session.
        if stream.set_nonblocking(false).is_err() { continue; }
        let _ = stream.set_read_timeout(Some(Duration::from_secs(1)));
        let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));
        let _ = stream.set_nodelay(true);
        let expected = format!("QELEM1 {token}");
        if !matches!(line(&mut stream, stop), Ok(Some(ref value)) if value == &expected) {
            let _ = stream.shutdown(Shutdown::Both);
            // Slow repeated guesses and keep the accept loop from being a busy loop.
            std::thread::sleep(Duration::from_millis(250));
            continue;
        }
        if stream.write_all(b"OK\n").is_err() { continue; }
        connected.store(true, Ordering::Release);
        wake();
        while !stop.load(Ordering::Acquire) {
            let Ok(Some(raw)) = line(&mut stream, stop) else { break };
            let Some(command) = parse(&raw) else { break };
            if command == Command::Ping { continue; }
            match tx.try_send(command) {
                Ok(()) => wake(),
                // Losing a down/up would corrupt stroke state: disconnect and cancel instead.
                Err(TrySendError::Full(_) | TrySendError::Disconnected(_)) => break,
            }
        }
        let _ = stream.shutdown(Shutdown::Both);
        break; // A new connection requires a new code and explicit opt-in.
    }
}

// A Windows Bluetooth outgoing COM port wraps RFCOMM SPP. This requires the phone's
// SPP service to be listening and a Windows outgoing COM port configured for the paired phone.
#[cfg(windows)]
#[allow(unsafe_code)]
fn bluetooth_session(port: u16, token: &str, stop: &AtomicBool, connected: &AtomicBool, tx: &SyncSender<Command>, wake: &impl Fn()) -> io::Result<()> {
    use std::os::windows::io::AsRawHandle;
    use std::os::windows::fs::OpenOptionsExt;
    use windows::Win32::Foundation::HANDLE;
    use windows::Win32::Devices::Communication::{SetCommTimeouts, COMMTIMEOUTS};
    let path = format!(r"\\.\COM{port}");
    // Windows communications resources must be opened exclusively (share mode zero).
    let file = std::fs::OpenOptions::new().read(true).write(true).share_mode(0).open(path)?;
    let timeouts = COMMTIMEOUTS { ReadIntervalTimeout: u32::MAX, ReadTotalTimeoutMultiplier: u32::MAX,
        ReadTotalTimeoutConstant: 1000, WriteTotalTimeoutMultiplier: 0, WriteTotalTimeoutConstant: 2000 };
    // SAFETY: handle belongs to the open COM file and the timeout structure lives for the call.
    unsafe { SetCommTimeouts(HANDLE(file.as_raw_handle()), &timeouts) }.map_err(io::Error::other)?;
    struct Serial(std::fs::File);
    impl Read for Serial {
        fn read(&mut self, b: &mut [u8]) -> io::Result<usize> {
            match self.0.read(b) { Ok(0) => Err(io::ErrorKind::TimedOut.into()), other => other }
        }
    }
    let mut serial = Serial(file);
    let expected = format!("QELEM1 {token}");
    // The COM connection may establish before the user has finished typing the code.
    if !matches!(line_with_idle_limit(&mut serial, stop, 120), Ok(Some(ref value)) if value == &expected) { return Err(io::Error::new(io::ErrorKind::InvalidData, "Bluetooth authentication failed or timed out")); }
    serial.0.write_all(b"OK\n")?;
    connected.store(true, Ordering::Release); wake();
    while !stop.load(Ordering::Acquire) {
        let Some(raw) = line(&mut serial, stop)? else { break };
        let Some(command) = parse(&raw) else { break };
        if command == Command::Ping { continue; }
        match tx.try_send(command) { Ok(()) => wake(), Err(_) => break }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn loopback_requires_token_and_delivers_ordered_samples() {
        use std::sync::atomic::AtomicBool;
        use std::io::{BufRead, BufReader, Write};
        let listener = TcpListener::bind(("127.0.0.1", 0)).expect("bind");
        listener.set_nonblocking(true).expect("nonblocking");
        let addr = listener.local_addr().expect("address");
        let stop = Arc::new(AtomicBool::new(false));
        let connected = Arc::new(AtomicBool::new(false));
        let (tx, rx) = mpsc::sync_channel(8);
        let (s, c) = (stop.clone(), connected.clone());
        let handle = std::thread::spawn(move || serve(listener, "0123456789abcdef0123456789abcdef", &s, &c, &tx, &|| {}));
        let mut bad = TcpStream::connect(addr).expect("connect bad");
        bad.write_all(b"QELEM1 wrong\n").expect("send");
        let mut reply = [0u8; 1];
        bad.set_read_timeout(Some(Duration::from_secs(3))).expect("timeout");
        assert_eq!(bad.read(&mut reply).expect("rejected"), 0);
        let mut good = TcpStream::connect(addr).expect("connect good");
        good.set_read_timeout(Some(Duration::from_secs(3))).expect("timeout");
        good.write_all(b"QELEM1 0123456789abcdef0123456789abcdef\n").expect("send");
        let mut response = String::new();
        BufReader::new(good.try_clone().expect("clone")).read_line(&mut response).expect("reply");
        assert_eq!(response, "OK\n");
        good.write_all(b"H 0.2 0.7\nD 0 0 0.5 S\nM 0.5 0.5 0.8\nU 1 1 0\nPAINT\nERASE\n").expect("points");
        assert_eq!(rx.recv_timeout(Duration::from_secs(3)).expect("hover"), Command::Hover(0.2, 0.7));
        assert_eq!(rx.recv_timeout(Duration::from_secs(3)).expect("down"), Command::Down(0.0, 0.0, 0.5, true));
        assert_eq!(rx.recv_timeout(Duration::from_secs(3)).expect("move"), Command::Move(0.5, 0.5, 0.8));
        assert_eq!(rx.recv_timeout(Duration::from_secs(3)).expect("up"), Command::Up(1.0, 1.0, 0.0));
        assert_eq!(rx.recv_timeout(Duration::from_secs(3)).expect("paint"), Command::Paint);
        assert_eq!(rx.recv_timeout(Duration::from_secs(3)).expect("erase"), Command::Erase);
        drop(good);
        handle.join().expect("thread");
    }
    #[test] fn bounded_valid_protocol() {
        assert_eq!(parse("D 0.1 1 0.4 S"), Some(Command::Down(0.1, 1.0, 0.4, true)));
        assert_eq!(parse("H 0.2 0.7"), Some(Command::Hover(0.2, 0.7)));
        assert_eq!(parse("M 0 1 1"), Some(Command::Move(0.0, 1.0, 1.0)));
        for v in ["D NaN 0 1 S", "M 0 2 1", "U -1 0 1", "UNDO extra", "SIZE inf", "D 0 0 0 X", "QUIT"] { assert_eq!(parse(v), None); }
    }
}
