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
