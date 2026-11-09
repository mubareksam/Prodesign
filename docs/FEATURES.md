# Qalam feature coverage

This is an independent Android app inspired by Procreate, not a full replacement.
The supplied feature inventory is a roadmap, not a list of completed work.

## Available now

- 20 preset brushes, brush size/opacity, pressure, per-preset basic Brush Studio
  sliders for spacing, flow, opacity, hardness, pressure and stabilization. Brush
  shapes/grains cannot be edited or imported; dual brushes and wet mixing are absent.
- 2D grid, isometric and 1/2/3-point perspective visual guides (adjustable horizon
  and spread); vertical, horizontal, quadrant and eight-fold
  radial symmetry. Turn on **Layer assist** in Drawing guides to mirror painting on
  the selected layer. Grid, isometric and perspective guides are visual, not
  snapping guides; vanishing points are preset by the horizon and spread controls.
- Custom canvas dimensions from 64 to 4096 pixels in each direction; DPI settings
  are not implemented. A fill tool fills connected pixels on the selected layer,
  with adjustable tolerance and undo; it does not sample other layers.
- A movable, zoomable reference window showing the current canvas. Importing an
  external reference image or using a camera is not implemented.
- Temporary rectangular selection clips brushes, erasers, active-cel flood fill and
  effects. Fill, clear, flips, 180° rotation, numeric move and uniform scale are
  undoable for the current layer/frame; selected pixels can be copied to a new layer
  in the current frame. No live transform preview. Pixel undo does not restore the
  selection outline. Selections are not saved and cannot be feathered or freehand.
- Alpha lock lets brush painting, fill and effects recolour existing layer pixels
  without changing their alpha. It is saved per layer and copied on duplication.
  Erasing, clear, flip, move/scale and merge require unlocking alpha first; it does
  not prevent deletion, frame deletion or undo/redo.
- A saved, undoable canvas background colour applies across frames. Transparent PNG
  and transparent PNG-sequence exports omit it; ordinary PNG, GIF and MP4 include it.
- Per-layer lock prevents painting, fill, effects, selection edits, clearing, deleting
  and merging the layer, and persists with the artwork. It does not block visibility,
  reordering, undo/redo or frame deletion.
- Hold-to-snap QuickShape for lines and ellipses. Rectangles, arcs and shape editing
  are not implemented.
- Frame timeline and scrubber, 1–30 fps, loop, ping-pong and one-shot playback,
  holds of 1–60 ticks and independent 0–4 previous/next onions. Onion settings cover
  tint/original colours, active/all visible layers, above/below artwork and whether
  skipped frames appear. Undoable, saved frame skips and playback ranges apply to
  preview, GIF and MP4. Batch label, hold, reverse, duplicate, skip or include a
  range in one undo step. Labels are tags, not nested groups; range boundaries are
  positions, so reordering changes which drawings fall inside them.
- Estimated timeline cycle duration and tick counts respect frame holds, skips, range and
  ping-pong. Confirmed batch frame deletion is undoable and leaves at least one
  frame. Copy one non-empty current-layer cel to a range of frames with confirmation
  and undo; allocation is capped at 64 MiB per operation and locked/alpha-locked
  layers are protected. Other layers and frame metadata are unchanged.
- Undoable per-frame layer effects: soft box blur, horizontal motion blur, sharpen,
  bloom, glitch, pixelate, posterize, solarize, grayscale, invert, sepia,
  brightness, saturation, contrast, hue shift, noise, chromatic shift, halftone
  dither and threshold. These are destructive pixel effects, not a full Procreate
  adjustment or live preview system.
- Opaque or transparent PNG, numbered PNG sequence, PNG sprite sheet and GIF export.
  Sprite sheets and PNG sequences export all source frames once, including skipped frames, without hold timing
  or ping-pong repeats; sprite sheets are limited to 8192 px per side and 16,777,216
  pixels. PNG sequences contain one image per
  frame and do not include hold timing metadata. MP4 export records one loop in real time only when the Android
  WebView supports MP4 `MediaRecorder` and canvas capture; it is not available on all
  devices. MP4 and Android MediaStore exports still need physical-device testing.
- Layer visibility, opacity, blend modes, reorder, duplicate, merge and delete; colour
  wheel and swatches; canvas pan/zoom/rotate; touch undo/redo and eyedropper.

## Not yet implemented

Snapping/drawing assist for grids and perspective, image import, camera references, layer masks/groups/clipping, freehand/automatic selection,
feathered selection, interactive transforms and free rotation, cross-layer ColorDrop/reference fill, smudge, advanced filters and liquify, typography,
DPI settings, timelapse, gallery stacks, PSD/Procreate/PDF/TIFF compatibility, brush
import/export, and most advanced colour-management and accessibility features.
Apple Pencil-specific controls are not applicable on Android. See the original
[Procreate analysis](procreate-analysis.md) for background; its feature matrix
predates version 2.1.
