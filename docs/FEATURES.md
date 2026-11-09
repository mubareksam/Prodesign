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
- Per-layer lock prevents painting, fill, effects, selection edits, clearing, deleting
  and merging the layer, and persists with the artwork. It does not block visibility,
  reordering, undo/redo or frame deletion.
- Hold-to-snap QuickShape for lines and ellipses. Rectangles, arcs and shape editing
  are not implemented.
- Frame timeline, add/duplicate/delete, preview, 1–30 fps, loop, ping-pong and
  one-shot playback, per-frame holds, and 1–4 previous/next onion frames with
  adjustable opacity and colours. Frames can have optional group labels that are
  saved and shown on the timeline. These are tags, not nested frame/layer groups or
  batch operations.
- Undoable per-frame layer effects: soft box blur, horizontal motion blur, sharpen,
  bloom, glitch, grayscale, invert, sepia,
  brightness, saturation, contrast, hue shift, noise, chromatic shift, halftone
  dither and threshold. These are basic destructive pixel effects, not a full
  Procreate adjustment or live preview system.
- PNG, numbered PNG sequence and GIF export. PNG sequences contain one image per
  frame and do not include hold timing metadata. MP4 export records one loop in real time only when the Android
  WebView supports MP4 `MediaRecorder` and canvas capture; it is not available on all
  devices. MP4 and Android MediaStore exports still need physical-device testing.
- Layer visibility, opacity, blend modes, reorder, duplicate, merge and delete; colour
  wheel and swatches; canvas pan/zoom/rotate; touch undo/redo and eyedropper.

## Not yet implemented

Snapping/drawing assist for grids and perspective, image import, camera references, layer masks/groups/clipping/alpha lock, freehand/automatic selection,
feathered selection, interactive transforms and free rotation, cross-layer ColorDrop/reference fill, smudge, advanced filters and liquify, typography,
DPI settings, timelapse, gallery stacks, PSD/Procreate/PDF/TIFF compatibility, brush
import/export, and most advanced colour-management and accessibility features.
Apple Pencil-specific controls are not applicable on Android. See the original
[Procreate analysis](procreate-analysis.md) for background; its feature matrix
predates version 1.7.
