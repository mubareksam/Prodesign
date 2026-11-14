//! Small native Win32 receiver window; networking remains on a worker thread.
#![allow(unsafe_code)]
use std::{cell::RefCell, ffi::c_void, ptr, sync::atomic::Ordering};
use crate::{phone_pairing, phone_tablet::{Command, Server}, qrcodegen::{QrCode, QrCodeEcc}, system_pen};

type Hwnd = isize;
type Handle = isize;
#[repr(C)] struct Point { x: i32, y: i32 }
#[repr(C)] struct Rect { left: i32, top: i32, right: i32, bottom: i32 }
#[repr(C)] struct Paint { hdc: Handle, erase: i32, rect: Rect, restore: i32, update: i32, reserved: [u8; 32] }
#[repr(C)] struct Message { hwnd: Hwnd, msg: u32, wp: usize, lp: isize, time: u32, pt: Point, private: u32 }
#[repr(C)] struct WindowClass { style: u32, proc: Option<unsafe extern "system" fn(Hwnd,u32,usize,isize)->isize>, class_extra: i32, window_extra: i32, instance: Handle, icon: Handle, cursor: Handle, background: Handle, menu: *const u16, name: *const u16 }
#[link(name="user32")] unsafe extern "system" {
    fn RegisterClassW(class: *const WindowClass) -> u16;
    fn CreateWindowExW(ex: u32, class: *const u16, title: *const u16, style: u32, x: i32, y: i32, w: i32, h: i32, parent: Hwnd, menu: Handle, instance: Handle, param: *const c_void) -> Hwnd;
    fn DefWindowProcW(hwnd: Hwnd, msg: u32, wp: usize, lp: isize) -> isize;
    fn ShowWindow(hwnd: Hwnd, cmd: i32) -> i32;
    fn GetMessageW(msg: *mut Message, hwnd: Hwnd, first: u32, last: u32) -> i32;
    fn TranslateMessage(msg: *const Message) -> i32;
    fn DispatchMessageW(msg: *const Message) -> isize;
    fn PostQuitMessage(code: i32);
    fn SetTimer(hwnd: Hwnd, id: usize, ms: u32, callback: *const c_void) -> usize;
    fn BeginPaint(hwnd: Hwnd, paint: *mut Paint) -> Handle;
    fn EndPaint(hwnd: Hwnd, paint: *const Paint) -> i32;
    fn FillRect(hdc: Handle, rect: *const Rect, brush: Handle) -> i32;
    fn InvalidateRect(hwnd: Hwnd, rect: *const Rect, erase: i32) -> i32;
    fn LoadCursorW(instance: Handle, name: *const u16) -> Handle;
    fn GetWindowTextW(hwnd: Hwnd, text: *mut u16, max: i32) -> i32;
    fn MessageBoxW(hwnd: Hwnd, text: *const u16, title: *const u16, flags: u32) -> i32;
}
#[link(name="gdi32")] unsafe extern "system" {
    fn TextOutW(hdc: Handle, x: i32, y: i32, text: *const u16, count: i32) -> i32;
    fn GetStockObject(index: i32) -> Handle;
}
#[link(name="kernel32")] unsafe extern "system" { fn GetModuleHandleW(name: *const u16) -> Handle; }
const WM_DESTROY:u32=2; const WM_PAINT:u32=15; const WM_COMMAND:u32=273; const WM_TIMER:u32=275;
const WIFI:usize=101; const USB:usize=102; const BLUETOOTH:usize=103; const STOP:usize=104;
fn wide(s: &str)->Vec<u16> { s.encode_utf16().chain(Some(0)).collect() }

struct App { ip: Hwnd, mode: usize, server: Option<Server>, pen: Option<system_pen::SystemPen>, qr: Option<QrCode>, status: String, connected: bool }
thread_local! { static APP: RefCell<Option<App>> = const { RefCell::new(None) }; }

impl App {
    fn stop(&mut self) { self.pen = None; self.server = None; self.qr = None; self.connected = false; }
    fn start(&mut self, mode: usize) {
        self.stop(); self.mode = mode;
        let mut text = [0u16; 64];
        // SAFETY: edit control is owned by this window, and text has 64 writable UTF-16 units.
        let n = unsafe { GetWindowTextW(self.ip, text.as_mut_ptr(), text.len() as i32) }.max(0) as usize;
        let ip = String::from_utf16_lossy(&text[..n]);
        if mode == WIFI && phone_pairing::payload(&ip, false, "00000000000000000000000000000000").is_none() {
            self.status = "Enter this PC's private IPv4 address, then click Wi-Fi again.".into(); return;
        }
        let pen = match system_pen::SystemPen::new() { Ok(p) => p, Err(e) => { self.status = format!("Windows pen unavailable: {e}"); return; } };
        let server = if mode == BLUETOOTH { Server::start_bluetooth(|| {}) } else { Server::start(|| {}, mode == USB) };
        match server {
            Ok(server) => {
                let payload = if mode == BLUETOOTH { phone_pairing::bluetooth_payload(&server.token) } else { phone_pairing::payload(&ip, mode == USB, &server.token) };
                self.qr = payload.and_then(|text| QrCode::encode_text(&text, QrCodeEcc::Medium).ok());
                self.status = "Waiting: scan the QR in Qelem Tablet.".into();
                self.pen = Some(pen); self.server = Some(server);
            }
            Err(e) => self.status = format!("Could not start: {e}"),
        }
    }
    fn update(&mut self) -> bool {
        let Some(server) = &self.server else { return false };
        let connected = server.connected.load(Ordering::Acquire);
        let ended = server.ended.load(Ordering::Acquire);
        let commands: Vec<_> = server.incoming.try_iter().collect();
        let mut failure = None;
        if let Some(pen) = self.pen.as_mut() {
            for command in commands {
                let result = match command {
                    Command::Hover(x,y) => pen.hover(x,y),
                    Command::Relative(x,y) => system_pen::mouse_relative(x,y),
                    Command::LeftClick => system_pen::mouse_click(false),
                    Command::RightClick => system_pen::mouse_click(true),
                    Command::Down(x,y,p,_) => pen.down(x,y,p),
                    Command::Move(x,y,p) => pen.moved(x,y,p),
                    Command::Up(x,y,p) => pen.up(x,y,p),
                    Command::Cancel => { pen.cancel(); Ok(()) },
                    key => system_pen::shortcut(key),
                };
                if let Err(error) = result { failure = Some(error); break; }
            }
        }
        if ended || failure.is_some() {
            self.stop(); self.status = failure.map_or("Disconnected. Choose a connection for a new QR.".into(), |e| format!("Input failed: {e}")); return true;
        }
        if connected != self.connected {
            self.connected = connected;
            if connected { self.qr = None; self.status = "Connected. Switch to the target app to use the tablet.".into(); }
            return true;
        }
        false
    }
}
unsafe fn draw_text(hdc: Handle, x: i32, y: i32, text: &str) { let s = wide(text); unsafe { TextOutW(hdc, x, y, s.as_ptr(), (s.len()-1) as i32); } }
unsafe extern "system" fn wndproc(hwnd:Hwnd, msg:u32, wp:usize, lp:isize)->isize {
    match msg {
        WM_COMMAND => { let id=wp & 0xffff; APP.with(|a| { if let Some(app)=a.borrow_mut().as_mut() { if id == STOP { app.stop(); app.status="Stopped. Choose a connection.".into(); } else if [WIFI,USB,BLUETOOTH].contains(&id) { app.start(id); } } }); unsafe { InvalidateRect(hwnd,ptr::null(),1); } 0 }
        WM_TIMER => { let changed=APP.with(|a| a.borrow_mut().as_mut().is_some_and(App::update)); if changed { unsafe { InvalidateRect(hwnd,ptr::null(),1); } } 0 }
        WM_PAINT => { unsafe {
            let mut paint:Paint=std::mem::zeroed(); let dc=BeginPaint(hwnd,&mut paint);
            draw_text(dc,25,20,"Qelem Tablet Server"); draw_text(dc,25,46,"Choose how this PC connects, then scan the QR on your tablet.");
            draw_text(dc,25,140,"PC IPv4 (Wi-Fi):");
            APP.with(|a| if let Some(app)=a.borrow().as_ref() {
                draw_text(dc,25,182,&app.status);
                draw_text(dc,25,205,"QR is a secret. Use Wi-Fi only on a trusted private network.");
                if let Some(qr)=&app.qr {
                    let module=5; let side=(qr.size()+8)*module; let white=GetStockObject(0); let black=GetStockObject(4);
                    FillRect(dc,&Rect{left:25,top:230,right:25+side,bottom:230+side},white);
                    for y in 0..qr.size() { for x in 0..qr.size() { if qr.get_module(x,y) {
                        let left=25+(x+4)*module; let top=230+(y+4)*module;
                        FillRect(dc,&Rect{left,top,right:left+module,bottom:top+module},black);
                    } } }
                    if let Some(server)=&app.server { draw_text(dc,25,240+side,&format!("Manual code: {}",server.token)); }
                }
                draw_text(dc,25,535,"USB: run adb reverse tcp:48652 tcp:48652 first.");
                draw_text(dc,25,558,"Bluetooth: pair the PC and tablet in Windows and Android settings first.");
                draw_text(dc,25,581,"Choose the Windows remote after connecting. Close this window to stop.");
            }); EndPaint(hwnd,&paint); } 0 }
        WM_DESTROY => { APP.with(|a| { if let Some(app)=a.borrow_mut().as_mut() { app.stop(); } }); unsafe { PostQuitMessage(0); } 0 }
        _ => unsafe { DefWindowProcW(hwnd,msg,wp,lp) }
    }
}

pub fn run() {
    // SAFETY: Win32 structures and UTF-16 buffers remain valid for each API call; all UI state
    // is confined to this thread and released when the window is destroyed.
    unsafe {
        let instance=GetModuleHandleW(ptr::null()); let class=wide("QelemTabletServerWindow");
        let wc=WindowClass { style:0, proc:Some(wndproc), class_extra:0, window_extra:0, instance, icon:0, cursor:LoadCursorW(0,32512usize as *const u16), background:6, menu:ptr::null(), name:class.as_ptr() };
        if RegisterClassW(&wc)==0 { MessageBoxW(0,wide("Could not register the server window.").as_ptr(),wide("Qelem Tablet Server").as_ptr(),0); return; }
        let hwnd=CreateWindowExW(0,class.as_ptr(),wide("Qelem Tablet Server").as_ptr(),0x00ca0000,0x80000000u32 as i32,0x80000000u32 as i32,640,660,0,0,instance,ptr::null());
        if hwnd==0 { return; }
        let button=wide("BUTTON");
        for (id,title,x,w) in [(WIFI,"Wi-Fi / hotspot",25,145),(USB,"USB (ADB)",180,125),(BLUETOOTH,"Bluetooth",315,125),(STOP,"Stop",450,100)] {
            CreateWindowExW(0,button.as_ptr(),wide(title).as_ptr(),0x50010000,x,80,w,38,hwnd,id as isize,instance,ptr::null());
        }
        let guess=phone_pairing::default_ip(); let edit=CreateWindowExW(0x200,wide("EDIT").as_ptr(),wide(&guess).as_ptr(),0x50810080,145,135,210,26,hwnd,200,instance,ptr::null());
        APP.with(|a| *a.borrow_mut()=Some(App { ip:edit, mode:0, server:None, pen:None, qr:None, status:"Choose Wi-Fi, USB or Bluetooth to start pairing.".into(), connected:false }));
        SetTimer(hwnd,1,20,ptr::null()); ShowWindow(hwnd,1);
        let mut msg:Message=std::mem::zeroed(); while GetMessageW(&mut msg,0,0,0)>0 { TranslateMessage(&msg); DispatchMessageW(&msg); }
    }
}
