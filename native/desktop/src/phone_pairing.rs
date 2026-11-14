//! Pairing payload and opt-in QR drawing. A QR is a bearer secret, not encrypted transport.
use std::net::{Ipv4Addr, UdpSocket};
use crate::qrcodegen::{QrCode, QrCodeEcc};

pub fn default_ip() -> String {
    UdpSocket::bind("0.0.0.0:0").ok().and_then(|socket| {
        // UDP connect selects a route but sends no packet.
        socket.connect("1.1.1.1:80").ok()?;
        match socket.local_addr().ok()?.ip() {
            std::net::IpAddr::V4(v) if v.is_private() || v.is_link_local() => Some(v.to_string()),
            _ => None,
        }
    }).unwrap_or_default()
}

pub fn payload(ip: &str, usb: bool, token: &str) -> Option<String> {
    if token.len() != 32 || !token.bytes().all(|b| b.is_ascii_hexdigit()) { return None; }
    let host = if usb { Ipv4Addr::LOCALHOST } else { ip.trim().parse::<Ipv4Addr>().ok()? };
    if !usb && !(host.is_private() || host.is_link_local()) { return None; }
    Some(format!("QELEMPAIR1|{}|{}|48652|{}", if usb { "USB" } else { "WIFI" }, host, token))
}

pub fn qr(ui: &mut egui::Ui, text: &str) {
    let Ok(code) = QrCode::encode_text(text, QrCodeEcc::Medium) else { ui.label("QR data is too long"); return };
    let n = code.size();
    let module = 4.0;
    let side = (n + 8) as f32 * module;
    let (rect, _) = ui.allocate_exact_size(egui::vec2(side, side), egui::Sense::hover());
    let painter = ui.painter();
    painter.rect_filled(rect, 0.0, egui::Color32::WHITE);
    for y in 0..n { for x in 0..n {
        if code.get_module(x, y) {
            let p = rect.min + egui::vec2((x + 4) as f32 * module, (y + 4) as f32 * module);
            painter.rect_filled(egui::Rect::from_min_size(p, egui::vec2(module, module)), 0.0, egui::Color32::BLACK);
        }
    }}
}

#[cfg(test)]
mod tests {
    use super::*;
    const TOKEN: &str = "0123456789abcdef0123456789abcdef";
    #[test] fn only_private_ip_or_explicit_usb() {
        assert_eq!(payload("192.168.1.2", false, TOKEN).as_deref(), Some("QELEMPAIR1|WIFI|192.168.1.2|48652|0123456789abcdef0123456789abcdef"));
        assert!(payload("8.8.8.8", false, TOKEN).is_none());
        assert!(payload("127.0.0.1", false, TOKEN).is_none());
        assert_eq!(payload("", true, TOKEN).as_deref(), Some("QELEMPAIR1|USB|127.0.0.1|48652|0123456789abcdef0123456789abcdef"));
        assert!(payload("10.0.0.1", false, "x").is_none());
    }
}
