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
    Hover(f32, f32), Relative(f32, f32), LeftClick, RightClick, Down(f32, f32, f32, bool), Move(f32, f32, f32), Up(f32, f32, f32), Cancel,
    Undo, Redo, QelemRedo, Save, Escape, ZoomIn, ZoomOut, Paint, Erase, Smudge, Pick, Size(f32), Opacity(f32), Ping,
}

fn unit(s: Option<&str>) -> Option<f32> {
    let v = s?.parse::<f32>().ok()?;
    (v.is_finite() && (0.0..=1.0).contains(&v)).then_some(v)
}

fn signed(s: Option<&str>) -> Option<f32> {
    let v = s?.parse::<f32>().ok()?;
    (v.is_finite() && (-1.0..=1.0).contains(&v)).then_some(v)
}

pub fn parse(line: &str) -> Option<Command> {
    let mut p = line.split_ascii_whitespace();
    let out = match p.next()? {
        "R" => Command::Relative(signed(p.next())?, signed(p.next())?),
        "LEFT" => Command::LeftClick,
        "RIGHT" => Command::RightClick,
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
        "QELEM_REDO" => Command::QelemRedo,
        "SIZE" => Command::Size(unit(p.next())?),
        "OPACITY" => Command::Opacity(unit(p.next())?),
        "PING" => Command::Ping,
        _ => return None,
    };
    if p.next().is_some() { None } else { Some(out) }
}

/// Bounded, chunked reads reduce the per-byte cost on RFCOMM while retaining strict limits.
struct Lines<R> { source: R, buf: [u8; 512], pos: usize, len: usize }
impl<R: Read> Lines<R> {
    fn new(source: R) -> Self { Self { source, buf: [0; 512], pos: 0, len: 0 } }
    fn line(&mut self, stop: &AtomicBool) -> io::Result<Option<String>> {
        let mut bytes = Vec::with_capacity(MAX_LINE);
        let mut idle = 0;
        loop {
            if stop.load(Ordering::Relaxed) { return Ok(None); }
            if self.pos == self.len {
                match self.source.read(&mut self.buf) {
                    Ok(0) => return Ok(None),
                    Ok(n) => { self.pos = 0; self.len = n; idle = 0; }
                    Err(e) if matches!(e.kind(), io::ErrorKind::WouldBlock | io::ErrorKind::TimedOut) => {
                        idle += 1; if idle >= 30 { return Ok(None); } continue;
                    }
                    Err(e) => return Err(e),
                }
            }
            let b = self.buf[self.pos]; self.pos += 1;
            if b == b'\n' { return String::from_utf8(bytes).map(Some).map_err(|_| io::ErrorKind::InvalidData.into()); }
            if b < 32 || b > 126 || bytes.len() >= MAX_LINE { return Err(io::ErrorKind::InvalidData.into()); }
            bytes.push(b);
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
    /// Windows advertises an authenticated RFCOMM service; Android connects to its paired PC.
    #[cfg(windows)]
    pub fn start_bluetooth(wake: impl Fn() + Send + 'static) -> Result<Self, String> {
        let listener = crate::phone_bluetooth::Listener::new()?;
        let mut secret = [0u8; 16];
        getrandom::fill(&mut secret).map_err(|e| e.to_string())?;
        let token: String = secret.iter().map(|v| format!("{v:02x}")).collect();
        let (tx, rx) = mpsc::sync_channel(QUEUE);
        let stop = Arc::new(AtomicBool::new(false));
        let connected = Arc::new(AtomicBool::new(false));
        let ended = Arc::new(AtomicBool::new(false));
        let (s,c,e,key) = (stop.clone(), connected.clone(), ended.clone(), token.clone());
        std::thread::Builder::new().name("qelem-bluetooth".into()).spawn(move || {
            while !s.load(Ordering::Acquire) {
                match listener.accept() {
                    Ok(Some(stream)) => { if serve_client(stream, &key, &s, &c, &tx, &wake) { break; } }
                    Ok(None) => std::thread::sleep(Duration::from_millis(50)),
                    Err(error) => { log::warn!("Bluetooth accept: {error}"); break; }
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
        let stream = match listener.accept() {
            Ok((s, _)) => s,
            Err(e) if e.kind() == io::ErrorKind::WouldBlock => { std::thread::sleep(Duration::from_millis(50)); continue; }
            Err(_) => break,
        };
        if serve_client(stream, token, stop, connected, tx, wake) { break; }
    }
}

/// Returns true after an authenticated session. Bad codes do not consume the session.
fn serve_client(mut stream: TcpStream, token: &str, stop: &AtomicBool, connected: &AtomicBool, tx: &SyncSender<Command>, wake: &impl Fn()) -> bool {
    if stream.set_nonblocking(false).is_err() { return false; }
    let _ = stream.set_read_timeout(Some(Duration::from_secs(1)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));
    // Bluetooth does not support TCP_NODELAY; ignore that protocol-specific error.
    let _ = stream.set_nodelay(true);
    let expected = format!("QELEM1 {token}");
    let mut lines = Lines::new(stream);
    if !matches!(lines.line(stop), Ok(Some(ref value)) if value == &expected) {
        let _ = lines.source.shutdown(Shutdown::Both);
        std::thread::sleep(Duration::from_millis(250));
        return false;
    }
    if lines.source.write_all(b"OK\n").is_err() { return false; }
    connected.store(true, Ordering::Release); wake();
    while !stop.load(Ordering::Acquire) {
        let Ok(Some(raw)) = lines.line(stop) else { break };
        let Some(command) = parse(&raw) else { break };
        if command == Command::Ping { continue; }
        // Brief backpressure instead of disconnecting on a transient UI backlog. Never discard
        // stroke boundaries; the sender's bounded motion queue absorbs/coalesces overload.
        let deadline = std::time::Instant::now() + Duration::from_secs(5);
        loop {
            match tx.try_send(command) {
                Ok(()) => { wake(); break; }
                Err(TrySendError::Disconnected(_)) => return true,
                Err(TrySendError::Full(_)) if !stop.load(Ordering::Acquire) && std::time::Instant::now() < deadline => {
                    wake(); std::thread::sleep(Duration::from_millis(2));
                }
                Err(TrySendError::Full(_)) => { let _ = lines.source.shutdown(Shutdown::Both); return true; }
            }
        }
    }
    let _ = lines.source.shutdown(Shutdown::Both);
    true
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
    #[test] fn chunked_lines_keep_boundaries_and_reject_long_input() {
        let stop = AtomicBool::new(false);
        let mut input = Lines::new(std::io::Cursor::new(b"D 0 0 1 S\nM 1 1 1\nU 1 1 0\n"));
        assert_eq!(input.line(&stop).unwrap().as_deref(), Some("D 0 0 1 S"));
        assert_eq!(input.line(&stop).unwrap().as_deref(), Some("M 1 1 1"));
        assert_eq!(input.line(&stop).unwrap().as_deref(), Some("U 1 1 0"));
        let mut bad = Lines::new(std::io::Cursor::new(vec![b'a'; MAX_LINE + 1]));
        assert_eq!(bad.line(&stop).unwrap_err().kind(), io::ErrorKind::InvalidData);
    }
    #[test] fn bounded_valid_protocol() {
        assert_eq!(parse("D 0.1 1 0.4 S"), Some(Command::Down(0.1, 1.0, 0.4, true)));
        assert_eq!(parse("R -0.2 0.7"), Some(Command::Relative(-0.2, 0.7)));
        assert_eq!(parse("LEFT"), Some(Command::LeftClick));
        assert_eq!(parse("R -1.1 0"), None);
        assert_eq!(parse("H 0.2 0.7"), Some(Command::Hover(0.2, 0.7)));
        assert_eq!(parse("M 0 1 1"), Some(Command::Move(0.0, 1.0, 1.0)));
        for v in ["D NaN 0 1 S", "M 0 2 1", "U -1 0 1", "UNDO extra", "SIZE inf", "D 0 0 0 X", "QUIT"] { assert_eq!(parse(v), None); }
    }
}
