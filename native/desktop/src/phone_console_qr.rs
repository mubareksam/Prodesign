//! Compact QR for a Windows terminal. White border and black modules, no temp files.
use crate::qrcodegen::{QrCode, QrCodeEcc};

fn cell(top: bool, bottom: bool) -> &'static str {
    match (top, bottom) {
        (true, true) => "\x1b[30;40m▀",
        (true, false) => "\x1b[30;47m▀",
        (false, true) => "\x1b[37;40m▀",
        (false, false) => "\x1b[37;47m▀",
    }
}

fn render(code: &QrCode) -> String {
    let width = code.size() + 8;
    let dark = |x: i32, y: i32| x >= 4 && y >= 4 && x < width - 4 && y < width - 4 && code.get_module(x - 4, y - 4);
    let mut out = String::new();
    for y in (0..width).step_by(2) {
        for x in 0..width {
            out.push_str(cell(dark(x, y), y + 1 < width && dark(x, y + 1)));
        }
        out.push_str("\x1b[0m\n");
    }
    out
}

/// Only emits escape sequences if stdout is a terminal with VT support.
#[cfg(windows)]
#[allow(unsafe_code)]
pub fn show(text: &str) -> bool {
    use windows::Win32::System::Console::{GetStdHandle, GetConsoleMode, SetConsoleMode, STD_OUTPUT_HANDLE, ENABLE_VIRTUAL_TERMINAL_PROCESSING, CONSOLE_MODE};
    let Ok(code) = QrCode::encode_text(text, QrCodeEcc::Medium) else { return false };
    // SAFETY: the process stdout handle is borrowed, and mode is a live out-parameter.
    let enabled = unsafe {
        if let Ok(handle) = GetStdHandle(STD_OUTPUT_HANDLE) {
            let mut mode = CONSOLE_MODE::default();
            GetConsoleMode(handle, &mut mode).is_ok() && SetConsoleMode(handle, mode | ENABLE_VIRTUAL_TERMINAL_PROCESSING).is_ok()
        } else { false }
    };
    if !enabled { return false; }
    print!("{}", render(&code));
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn phone_console_qr_has_quiet_border_and_reconstructs_every_module() {
        let code = QrCode::encode_text("QELEMPAIR1|BT|-|48652|0123456789abcdef0123456789abcdef", QrCodeEcc::Medium).unwrap();
        let output = render(&code);
        let width = code.size() + 8;
        let rows: Vec<_> = output.lines().collect();
        assert_eq!(rows.len(), ((width + 1) / 2) as usize);
        for (pair, row) in rows.iter().enumerate() {
            let mut text = *row;
            for x in 0..width {
                let y = 2 * pair as i32;
                let dark = |y| y >= 4 && y < width - 4 && x >= 4 && x < width - 4 && code.get_module(x - 4, y - 4);
                let expected = cell(dark(y), dark(y + 1));
                text = text.strip_prefix(expected).expect("terminal cell does not match QR module");
            }
            assert_eq!(text, "\x1b[0m");
        }
    }
}
