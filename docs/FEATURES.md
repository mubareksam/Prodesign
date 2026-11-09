# Qalam feature coverage

This is an independent Android app inspired by Procreate, not a full replacement.
The supplied feature inventory is a roadmap, not a list of completed work.

## Available now

- 20 preset brushes, brush size/opacity, pressure, per-preset basic Brush Studio
  sliders for spacing, flow, opacity, hardness, pressure and stabilization. Brush
  shapes/grains cannot be edited or imported; dual brushes and wet mixing are absent.
- 2D grid and isometric visual guides; vertical, horizontal, quadrant and eight-fold
  radial symmetry. Turn on **Layer assist** in Drawing guides to mirror painting on
  the selected layer. Grid and isometric guides are visual, not snapping guides.
- Hold-to-snap QuickShape for lines and ellipses. Rectangles, arcs and shape editing
  are not implemented.
- Frame timeline, add/duplicate/delete, preview, 1–30 fps, loop, ping-pong and
  one-shot playback, per-frame holds, and 1–4 previous/next onion frames with
  adjustable opacity and colours. Frame grouping is absent.
- Undoable per-frame layer effects: soft box blur, grayscale, invert, sepia,
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

Perspective and 1/2/3-point guides, snapping/drawing assist for grids, reference
windows or image import, layer masks/groups/clipping/alpha lock, selections and
transforms, ColorDrop/fill, smudge, advanced filters and liquify, typography, custom canvas
sizes/DPI, timelapse, gallery stacks, PSD/Procreate/PDF/TIFF compatibility, brush
import/export, and most advanced colour-management and accessibility features.
Apple Pencil-specific controls are not applicable on Android. See the original
[Procreate analysis](procreate-analysis.md) for background; its feature matrix
predates version 1.3.
