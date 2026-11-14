//! Native Windows tablet receiver. It does not launch Qelem or require a canvas/GPU.
#![cfg_attr(windows, windows_subsystem = "windows")]
#[cfg(windows)] mod phone_tablet;
#[cfg(windows)] mod phone_pairing;
#[cfg(windows)] mod phone_bluetooth;
#[cfg(windows)] mod system_pen;
#[cfg(windows)] #[path = "vendor/qrcodegen.rs"] mod qrcodegen;
#[cfg(windows)] mod tablet_server_window;

#[cfg(windows)]
fn main() { tablet_server_window::run(); }
#[cfg(not(windows))]
fn main() { eprintln!("Qelem Tablet Server currently supports Windows only."); }
