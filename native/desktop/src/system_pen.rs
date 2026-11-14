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
    use windows::Win32::UI::Input::KeyboardAndMouse::{SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VIRTUAL_KEY, VK_CONTROL, VK_ESCAPE, VK_OEM_PLUS, VK_OEM_MINUS};
    let (key, ctrl) = match command {
        Command::Undo => (VIRTUAL_KEY(b'Z' as u16), true),
        Command::Redo => (VIRTUAL_KEY(b'Y' as u16), true),
        Command::Save => (VIRTUAL_KEY(b'S' as u16), true),
        Command::Escape => (VK_ESCAPE, false),
        Command::ZoomIn => (VK_OEM_PLUS, true),
        Command::ZoomOut => (VK_OEM_MINUS, true),
        _ => return Ok(()),
    };
    let input = |key, up| INPUT { r#type: INPUT_KEYBOARD, Anonymous: INPUT_0 { ki: KEYBDINPUT { wVk: key, dwFlags: if up { KEYEVENTF_KEYUP } else { Default::default() }, ..Default::default() } } };
    let mut events = Vec::new();
    if ctrl { events.push(input(VK_CONTROL, false)); }
    events.push(input(key, false)); events.push(input(key, true));
    if ctrl { events.push(input(VK_CONTROL, true)); }
    // SAFETY: fully initialized INPUT records, correct element size, valid for this call.
    let sent = unsafe { SendInput(&events, std::mem::size_of::<INPUT>() as i32) };
    if sent == events.len() as u32 { Ok(()) } else {
        // If Windows accepted only part of the batch, make a best effort to release keys.
        let releases = [input(key, true), input(VK_CONTROL, true)];
        unsafe { SendInput(&releases, std::mem::size_of::<INPUT>() as i32) };
        Err("Windows rejected a keyboard shortcut (check target permissions)".to_owned())
    }
}
