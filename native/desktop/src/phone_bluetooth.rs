//! Windows Bluetooth Classic RFCOMM listener with SDP registration.
//! Android connects as the client; no manually created COM port is needed.
#![allow(unsafe_code)]
use std::io;
use std::net::TcpStream;
use std::os::windows::io::FromRawSocket;
use windows::core::{GUID, PWSTR};
use windows::Win32::Devices::Bluetooth::{SOCKADDR_BTH, SO_BTH_AUTHENTICATE, SO_BTH_ENCRYPT};
use windows::Win32::Networking::WinSock::*;

const AF_BTH: i32 = 32;
const RFCOMM: i32 = 3;
const NS_BTH: u32 = 16;
const FIONBIO: i32 = 0x8004667eu32 as i32;
const SERVICE: GUID = GUID::from_u128(0x6db5d3d1_d2a8_4d56_b8c0_87ecb7ea843e);

fn error(action: &str) -> String {
    // SAFETY: WSAGetLastError reads the current thread's Winsock error code.
    format!("{action}: Windows Bluetooth error {}", unsafe { WSAGetLastError().0 })
}

pub struct Listener { socket: SOCKET, addr: SOCKADDR_BTH, registered: bool }
impl Listener {
    pub fn new() -> Result<Self, String> {
        // SAFETY: all pointers refer to initialized, stack-local Windows SDK structures.
        unsafe {
            let mut data = WSADATA::default();
            let rc = WSAStartup(0x0202, &mut data);
            if rc != 0 { return Err(format!("Bluetooth initialization failed: {rc}")); }
            let socket = match socket(AF_BTH, SOCK_STREAM, RFCOMM) {
                Ok(s) => s,
                Err(_) => { let e = error("Bluetooth socket"); let _ = WSACleanup(); return Err(e); }
            };
            let mut out = Self { socket, addr: SOCKADDR_BTH { addressFamily: AF_BTH as u16, btAddr: 0, serviceClassId: GUID::zeroed(), port: u32::MAX }, registered: false };
            let yes = 1u32.to_ne_bytes();
            if setsockopt(socket, RFCOMM, SO_BTH_AUTHENTICATE as i32, Some(&yes)) != 0 || setsockopt(socket, RFCOMM, SO_BTH_ENCRYPT as i32, Some(&yes)) != 0 {
                return Err(error("Bluetooth authentication/encryption"));
            }
            let len = std::mem::size_of::<SOCKADDR_BTH>() as i32;
            if bind(socket, (&out.addr as *const SOCKADDR_BTH).cast(), len) != 0 { return Err(error("Bluetooth bind (enable your PC Bluetooth adapter)")); }
            let mut actual_len = len;
            if getsockname(socket, (&mut out.addr as *mut SOCKADDR_BTH).cast(), &mut actual_len) != 0 { return Err(error("Bluetooth address")); }
            if listen(socket, 1) != 0 { return Err(error("Bluetooth listen")); }
            out.register(true)?;
            out.registered = true;
            let mut nonblocking = 1;
            if ioctlsocket(socket, FIONBIO, &mut nonblocking) != 0 { return Err(error("Bluetooth nonblocking mode")); }
            Ok(out)
        }
    }
    unsafe fn register(&mut self, add: bool) -> Result<(), String> {
        let mut name: Vec<u16> = "Qelem Tablet\0".encode_utf16().collect();
        let mut guid = SERVICE;
        let mut cs = CSADDR_INFO {
            LocalAddr: SOCKET_ADDRESS { lpSockaddr: (&mut self.addr as *mut SOCKADDR_BTH).cast(), iSockaddrLength: std::mem::size_of::<SOCKADDR_BTH>() as i32 },
            iSocketType: SOCK_STREAM.0, iProtocol: RFCOMM, ..Default::default()
        };
        let query = WSAQUERYSETW { dwSize: std::mem::size_of::<WSAQUERYSETW>() as u32, lpszServiceInstanceName: PWSTR(name.as_mut_ptr()), lpServiceClassId: &mut guid, dwNameSpace: NS_BTH, dwNumberOfCsAddrs: 1, lpcsaBuffer: &mut cs, ..Default::default() };
        // SAFETY: query and its pointed-to buffers are valid until WSASetServiceW returns.
        if unsafe { WSASetServiceW(&query, if add { RNRSERVICE_REGISTER } else { RNRSERVICE_DELETE }, 0) } != 0 { return Err(error("Bluetooth service registration")); }
        Ok(())
    }
    pub fn accept(&self) -> Result<Option<TcpStream>, String> {
        // SAFETY: socket is a valid owned RFCOMM listener; accepted socket ownership is transferred.
        unsafe {
            match accept(self.socket, None, None) {
                Ok(socket) => Ok(Some(TcpStream::from_raw_socket(socket.0 as _))),
                Err(_) if WSAGetLastError() == WSAEWOULDBLOCK => Ok(None),
                Err(_) => Err(error("Bluetooth accept")),
            }
        }
    }
}
impl Drop for Listener {
    fn drop(&mut self) {
        // SAFETY: registration and socket belong to this listener and are released once.
        unsafe { if self.registered { let _ = self.register(false); } let _ = closesocket(self.socket); let _ = WSACleanup(); }
    }
}
