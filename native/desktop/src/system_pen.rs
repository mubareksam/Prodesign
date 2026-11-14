//! Windows 10 1809+ synthetic pen input. It is not a HID/Wintab driver.
//! Only the explicitly enabled, paired session can call this on the UI thread.
#![allow(unsafe_code)]
use windows::Win32::Foundation::POINT;
use windows::Win32::UI::Controls::{CreateSyntheticPointerDevice, DestroySyntheticPointerDevice, HSYNTHETICPOINTERDEVICE, POINTER_FEEDBACK_NONE, POINTER_TYPE_INFO, POINTER_TYPE_INFO_0};
use windows::Win32::UI::Input::Pointer::{InjectSyntheticPointerInput, POINTER_INFO, POINTER_PEN_INFO, POINTER_FLAGS, POINTER_FLAG_CANCELED, POINTER_FLAG_DOWN, POINTER_FLAG_INCONTACT, POINTER_FLAG_INRANGE, POINTER_FLAG_UPDATE, POINTER_FLAG_UP};
use windows::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, PT_PEN, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN};

pub struct SystemPen { device: HSYNTHETICPOINTERDEVICE, down: bool, last: (f32, f32) }
impl SystemPen {
    pub fn new() -> Result<Self, String> {
        // SAFETY: a single PT_PEN device is created and owned on this thread until Drop.
        let device = unsafe { CreateSyntheticPointerDevice(PT_PEN, 1, POINTER_FEEDBACK_NONE) }.map_err(|e| e.to_string())?;
        Ok(Self { device, down: false, last: (0.5, 0.5) })
    }
    fn inject(&self, x: f32, y: f32, pressure: f32, flags: POINTER_FLAGS) -> Result<(), String> {
        // SAFETY: these queries have no pointer arguments; they read the current virtual desktop.
        let (left, top, width, height) = unsafe { (GetSystemMetrics(SM_XVIRTUALSCREEN), GetSystemMetrics(SM_YVIRTUALSCREEN), GetSystemMetrics(SM_CXVIRTUALSCREEN), GetSystemMetrics(SM_CYVIRTUALSCREEN)) };
        if width < 1 || height < 1 { return Err("Windows reported an empty desktop".to_owned()); }
        let point = POINT { x: left.saturating_add((x.clamp(0.0, 1.0) * (width - 1) as f32).round() as i32), y: top.saturating_add((y.clamp(0.0, 1.0) * (height - 1) as f32).round() as i32) };
        let info = POINTER_TYPE_INFO { r#type: PT_PEN, Anonymous: POINTER_TYPE_INFO_0 { penInfo: POINTER_PEN_INFO {
            pointerInfo: POINTER_INFO { pointerType: PT_PEN, pointerId: 1, pointerFlags: flags, ptPixelLocation: point, historyCount: 1, ..Default::default() },
            penMask: 1, // PEN_MASK_PRESSURE, in the Windows SDK
            pressure: (pressure.clamp(0.0, 1.0) * 1024.0).round() as u32,
            ..Default::default()
        } } };
        // SAFETY: info has the documented PT_PEN union member and lives through the call.
        unsafe { InjectSyntheticPointerInput(self.device, &[info]) }.map_err(|e| e.to_string())
    }
    pub fn hover(&self, x: f32, y: f32) -> Result<(), String> {
        // Hover without contact is a cursor move, never a synthetic pen stroke.
        use windows::Win32::UI::WindowsAndMessaging::SetCursorPos;
        let (left, top, width, height) = unsafe { (GetSystemMetrics(SM_XVIRTUALSCREEN), GetSystemMetrics(SM_YVIRTUALSCREEN), GetSystemMetrics(SM_CXVIRTUALSCREEN), GetSystemMetrics(SM_CYVIRTUALSCREEN)) };
        if width < 1 || height < 1 { return Err("Windows reported an empty desktop".to_owned()); }
        unsafe { SetCursorPos(left + (x.clamp(0.0, 1.0) * (width - 1) as f32).round() as i32, top + (y.clamp(0.0, 1.0) * (height - 1) as f32).round() as i32) }.map_err(|e| e.to_string())
    }
    pub fn down(&mut self, x: f32, y: f32, p: f32) -> Result<(), String> {
        if self.down { return Ok(()); }
        self.inject(x, y, p, POINTER_FLAG_DOWN | POINTER_FLAG_INRANGE | POINTER_FLAG_INCONTACT)?;
        self.down = true; self.last = (x, y); Ok(())
    }
    pub fn moved(&mut self, x: f32, y: f32, p: f32) -> Result<(), String> {
        if !self.down { return Ok(()); }
        self.inject(x, y, p, POINTER_FLAG_UPDATE | POINTER_FLAG_INRANGE | POINTER_FLAG_INCONTACT)?;
        self.last = (x, y); Ok(())
    }
    pub fn up(&mut self, x: f32, y: f32, p: f32) -> Result<(), String> {
        if !self.down { return Ok(()); }
        self.inject(x, y, p, POINTER_FLAG_UP | POINTER_FLAG_INRANGE)?;
        self.down = false; self.last = (x, y); Ok(())
    }
    pub fn cancel(&mut self) {
        if self.down {
            let _ = self.inject(self.last.0, self.last.1, 0.0, POINTER_FLAG_UP | POINTER_FLAG_INRANGE | POINTER_FLAG_CANCELED);
            self.down = false;
        }
    }
}
impl Drop for SystemPen {
    fn drop(&mut self) {
        self.cancel();
        // SAFETY: the handle came from CreateSyntheticPointerDevice and is destroyed once here.
        unsafe { DestroySyntheticPointerDevice(self.device) };
    }
}

/// Fixed, non-arbitrary keyboard shortcuts for the foreground application.
pub fn shortcut(command: crate::phone_tablet::Command) -> Result<(), String> {
    use crate::phone_tablet::Command;
    use windows::Win32::UI::Input::KeyboardAndMouse::{SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VIRTUAL_KEY, VK_CONTROL, VK_SHIFT, VK_ESCAPE, VK_OEM_PLUS, VK_OEM_MINUS};
    let (key, ctrl, shift) = match command {
        Command::Undo => (VIRTUAL_KEY(b'Z' as u16), true, false),
        Command::Redo => (VIRTUAL_KEY(b'Y' as u16), true, false),
        Command::QelemRedo => (VIRTUAL_KEY(b'Z' as u16), true, true),
        Command::Paint => (VIRTUAL_KEY(b'B' as u16), false, false),
        Command::Erase => (VIRTUAL_KEY(b'E' as u16), false, false),
        Command::Pick => (VIRTUAL_KEY(b'M' as u16), false, false),
        Command::Save => (VIRTUAL_KEY(b'S' as u16), true, false),
        Command::Escape => (VK_ESCAPE, false, false),
        Command::ZoomIn => (VK_OEM_PLUS, true, false),
        Command::ZoomOut => (VK_OEM_MINUS, true, false),
        _ => return Ok(()),
    };
    let input = |key, up| INPUT { r#type: INPUT_KEYBOARD, Anonymous: INPUT_0 { ki: KEYBDINPUT { wVk: key, dwFlags: if up { KEYEVENTF_KEYUP } else { Default::default() }, ..Default::default() } } };
    let mut events = Vec::new();
    if ctrl { events.push(input(VK_CONTROL, false)); }
    if shift { events.push(input(VK_SHIFT, false)); }
    events.push(input(key, false)); events.push(input(key, true));
    if shift { events.push(input(VK_SHIFT, true)); }
    if ctrl { events.push(input(VK_CONTROL, true)); }
    // SAFETY: fully initialized INPUT records, correct element size, valid for this call.
    let sent = unsafe { SendInput(&events, std::mem::size_of::<INPUT>() as i32) };
    if sent == events.len() as u32 { Ok(()) } else {
        // If Windows accepted only part of the batch, make a best effort to release keys.
        let releases = [input(key, true), input(VK_SHIFT, true), input(VK_CONTROL, true)];
        unsafe { SendInput(&releases, std::mem::size_of::<INPUT>() as i32) };
        Err("Windows rejected a keyboard shortcut (check target permissions)".to_owned())
    }
}

/// Relative trackpad deltas, measured as fractions of the virtual desktop; no jump on contact.
pub fn mouse_relative(dx: f32, dy: f32) -> Result<(), String> {
    use windows::Win32::UI::WindowsAndMessaging::{GetCursorPos, SetCursorPos};
    let mut p = POINT::default();
    // SAFETY: p is a valid out-parameter; metric queries have no pointer arguments.
    unsafe { GetCursorPos(&mut p) }.map_err(|e| e.to_string())?;
    let (left, top, width, height) = unsafe { (GetSystemMetrics(SM_XVIRTUALSCREEN), GetSystemMetrics(SM_YVIRTUALSCREEN), GetSystemMetrics(SM_CXVIRTUALSCREEN), GetSystemMetrics(SM_CYVIRTUALSCREEN)) };
    if width < 1 || height < 1 { return Err("Windows reported an empty desktop".to_owned()); }
    let x = p.x.saturating_add((dx * width as f32).round() as i32).clamp(left, left.saturating_add(width - 1));
    let y = p.y.saturating_add((dy * height as f32).round() as i32).clamp(top, top.saturating_add(height - 1));
    unsafe { SetCursorPos(x, y) }.map_err(|e| e.to_string())
}

pub fn mouse_click(right: bool) -> Result<(), String> {
    use windows::Win32::UI::Input::KeyboardAndMouse::{SendInput, INPUT, INPUT_0, INPUT_MOUSE, MOUSEINPUT, MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP, MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP};
    let (down, up) = if right { (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP) } else { (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP) };
    let input = |flags| INPUT { r#type: INPUT_MOUSE, Anonymous: INPUT_0 { mi: MOUSEINPUT { dwFlags: flags, ..Default::default() } } };
    let events = [input(down), input(up)];
    let size = std::mem::size_of::<INPUT>() as i32;
    // SAFETY: records are initialized and valid for the duration of SendInput.
    if unsafe { SendInput(&events, size) } == events.len() as u32 { Ok(()) } else {
        unsafe { SendInput(&[input(up)], size) };
        Err("Windows rejected a mouse click (check target permissions)".to_owned())
    }
}
