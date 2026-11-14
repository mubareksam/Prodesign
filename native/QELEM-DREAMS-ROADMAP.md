# Qelem animation workspace: research and implementation

Qelem keeps its own dark/amber interface, Kotlin/Compose UI, Rust drawing engine, artwork
format and existing drawing tools. The animation workspace is an optional layout within an
existing artwork, not a destructive conversion or a copy of another app's visual assets.

## Design research

The official Procreate Dreams handbook describes a gallery (Theater), a Stage/canvas, a
Timeline with a playhead/ruler and content tracks, and a drawing-oriented Flipbook view.
It also describes separate Compose, Perform, and Keyframe modes, and a resizeable
stage/timeline split. These are workflow references, not features Qelem already has:

- [Interface overview](https://help.procreate.com/dreams/handbook/interface-and-gestures/interface)
- [Timeline and modes](https://help.procreate.com/dreams/handbook/interface-and-gestures/timeline)
- [Stage and canvas](https://help.procreate.com/dreams/handbook/interface-and-gestures/stage)
- [Timeline gestures](https://help.procreate.com/dreams/handbook/1.0/interface-and-gestures/timeline)

## Implemented so far

- Actions → Canvas → Animation Assist enables the existing frame/group animation; ▥ opens
  Qelem's expanded timeline and Compact returns to the original drawing-oriented layout.
- One actual drawing track, a synchronized time ruler, highlighted playhead, zoom and track
  height, previews and held-frame markers. Scroll the track horizontally; tap or drag the
  ruler to preview frames, then release to select. Cancelled scrubs restore the prior frame.
- Existing add, duplicate/split, exposure length, frame options, onion skin and playback
  controls work on the existing artwork. Undo and redo use the same artwork history.
- **Select** on the expanded timeline selects visible frame IDs (tap any held slot to
  toggle its whole frame, or use All/Clear). In selection mode, − Hold / + Hold change
  the selected frame durations together as one undoable operation; each duration clamps
  independently to 1–61 total slots. The selection is temporary and never selects layers
  in the Layers panel; Done returns to normal editing. The ruler is disabled while selecting.
- The timeline toolbar's ← Frame / Frame → move the selected visible frame one position,
  carrying its holds, mask or complete group; this is an undoable change to the existing
  document, and the selected held position follows the frame's stable ID. Pinned background
  and foreground frames cannot be moved or crossed. To prevent changing clipping bases, the
  action refuses documents with top-level clipping; hidden layers remain intact. This moves
  existing drawing frames, not independent movie clips or tracks.
- Qelem's gallery remains its gallery; existing layer and frame persistence and animated
  export paths are not replaced. The expanded timeline uses lazy composition and Rust slot
  expansion avoids a repeated frame search, but device speed has not been benchmarked.

## Remaining work

This is **not** yet Dreams' multitrack/movie format: no independent audio or video clips,
content tracks, non-destructive motion keyframes, Perform mode, or animation importer.
Adding those requires a versioned document schema, backwards-compatible save/reopen and
undo, synchronized rendering/playback/export, migration tests, and device verification.
Those controls should not be presented as working before the underlying model exists.

The Android preview is separately packaged and debug signed. It has no importer for old
Qelem artwork. Back up projects, keep the original app installed, and verify on a device;
there is no guarantee a differently signed preview can update a previous preview.

### Timeline interface refinement

The expanded drawing timeline now keeps undo, redo, timecode, transport, frame selection and add-frame controls visible in a compact header. Less frequent frame, playback, onion-skin and timeline sizing actions live in the scrollable **Tools** menu. Selection mode keeps its batch controls together; the compact Animation Assist view and underlying artwork remain unchanged. Buttons have descriptive accessibility labels and the tool menu is height-limited to leave room for the track on shorter screens. This is an incremental Qelem interface, not a complete Dreams workspace; check layout and touch targets on real devices.

### Windows and Android continuation

Windows Animation Assist now offers **Timeline** in its compact bar on windows at least 520 × 300 points. It opens a larger single drawing-track view with first/previous/play/next/last navigation, timecode, hold adjustment, safe frame reordering, settings and add-frame controls. Tap the current frame for its existing options; **Canvas** returns to compact mode. Small windows and Page Assist retain the compact view. Frame holds and moves use the same native undoable operations as Android; pinned frames and top-level clipping still block unsafe moves. The held offset follows the frame ID on reorder and undo. Android's expanded timeline Tools menu now includes jump-to-first and jump-to-last slot, including held slots. Neither interface creates independent tracks or changes the document format. The two UIs and native input still need testing on physical Windows and Android devices, including small screens and settings popovers.
