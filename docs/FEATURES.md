# Qelem feature coverage

This is an independent Android app inspired by Procreate, not a full replacement.
The supplied feature inventory is a roadmap, not a list of completed work.

## Available now

- Add or subtract a rectangle, ellipse or lasso from an existing temporary
  selection; the result is a hard run mask with a bounding-box outline. Canvas
  size is capped at 4 megapixels and results at 4096 runs. Empty results are
  refused; select Deselect to clear. Magic wand still replaces. Non-rectangular
  transforms remain unavailable; combining can briefly block on large masks.
- One device-local saved palette stores up to 24 unique colours; swatches can be
  added, selected, removed or cleared with confirmation. It is not saved inside
  projects and does not support palette import/export or multiple palette sets.
- Gallery preview can duplicate the last saved project record including all
  layers, frames and saved metadata; the original is not overwritten. Unsaved
  edits, undo history and device preferences are not copied. Duplication may
  fail if storage is full; real Android storage behavior needs testing.

- Ellipse selection uses a native curved path, temporary across the open artwork;
  it clips painting, smudge, fill, effects and clipboard operations. It supports
  inversion subject to the existing 4 MP/4096-run limits. Non-rectangular flips
  and transforms remain unavailable. Selection edges are not feathered.
- Layer colour tags (six colours or none) appear in the Layers list, are stored,
  undoable and copied with layers; they do not alter artwork or exports.
- JPEG export flattens the current frame over the background at 50/75/90/100%
  quality. It is lossy, opaque and omits playback-only camera/layer motion; WebView
  encoding and Android saving require device support and physical-device testing.
- Colour harmony suggestions now include split complementary ±150°; suggestions
  select the brush colour but are not saved palettes.

- Multi-layer selection via right-swipe or accessible tap mode, Select all, and
  atomic batch show/hide, lock/unlock, duplicate, move to top/bottom and confirmed
  delete across all frames. Active layer remains the drawing target. Copies are
  independent and limited to 64 MiB of estimated new cel pixels; deletion refuses
  locked layers and deleting all layers. Restore solo first. Selection is session
  only; no multi-layer transforms or true groups. Reorder/copy can alter clipping.
- The display name is corrected to Qelem and yellow accents restored. Package,
  signing and existing storage identifiers remain unchanged; export folders keep
  their historical Qalam names.

- Canvas-first interface refresh: neutral studio toolbar with direct selection,
  list-style brush previews, yellow active states and redesigned gallery, panels,
  layers and timeline. Panels have a close button, use a phone bottom sheet or a
  floating panel at wider sizes, and follow the tool rail when swapped. Artwork
  can be renamed via Actions → File & help → Artwork details. This is inspired
  by Procreate, not an exact UI or feature clone; real Android testing is needed.

- The Layers Add menu offers blank and imported-image layers as well as solid
  colour and two-colour horizontal, vertical, diagonal, radial or custom-angle gradient raster
  layers. HSV sliders, presets and HEX controls update a scaled preview; gradients
  have a midpoint and swap control; solid and gradient endpoint opacity support
  transparency. These fill only the active frame and can be undone; no live
  editable stops or vector fill is provided.
- Basic circular pixel-drag smudge on the active cel, with size and opacity as
  strength and a device-local adjustable soft/hard edge; selection clips the
  destination and each moved stroke can be undone.
  It refuses hidden, locked, alpha-locked or empty cels; does not use brush texture,
  pressure, smoothing, symmetry, QuickShape or hold eyedropper. Not Procreate's
  smudge engine. Pinch cancels a finger smudge; real-device latency is untested.
- Colour swatch now sits between rectangular size and opacity sliders; the opposite
  rail contains smudge and other tools. Rails compact and scroll in short layouts.
- Brush library has 28 presets and generated sample strokes using the actual preset
  engine. Erasers are displayed as painted marks; texture/spray is stochastic.
  Search and category filters combine and remain for the app session.
- Categorized icon-based animation tools and expandable Actions groups reduce
  clutter. Effect thumbnails are generated offline from illustrative sample art,
  not a live preview. Real-device layout and touch testing remain necessary.

- Colour tray harmony suggestions offer analogous, complementary, triadic and split-complementary
  hue-based colours with clickable previews. Saturation/brightness have minimums;
  neutral colours use the last picker hue. Suggestions can be added manually to the device-local saved palette.
- Temporary checkerboard transparency preview replaces the canvas background in
  the editor, without changing artwork, saved thumbnails or exports; resets when
  switching artwork. It does not toggle transparent export.
- Invert rectangle, ellipse, lasso or wand selections into a hard run mask. It is temporary,
  has a bounding-box outline, and supports selection-clipped painting/fills/effects;
  transforms remain rectangle-only. Empty inverse, >4-megapixel canvas or >4096
  runs are refused without changing the selection; lasso edges use a 50% threshold.
- Light/dark interface appearance is saved locally and leaves artwork and exports
  unchanged; the workspace outside the canvas and system bars remain dark. Real
  Android display contrast and layout have not been tested.
- A tool-rail fit button centres the canvas and resets zoom/rotation without editing
  the artwork; it is not a pinch-to-fit gesture. Rails may scroll on short screens.
- Each layer row has an undoable alpha-lock button with a pressed state; it targets
  that layer without changing selection or opacity. This is not a two-finger swipe.
- Recolour matching non-transparent RGB pixels in the current cel, including
  disconnected areas; tap the approximate preview to sample the original cel or
  enter source and replacement HEX colours. Per-channel tolerance is 0–128; alpha
  is preserved, selection masks apply and the edit is undoable. Hidden/locked
  layers are refused. This is not a live crosshair tool; estimated temporary
  allocations are limited to 64 MiB, excluding existing artwork/history.
- Gallery eye button opens the saved, read-only thumbnail without loading the
  project: last-saved active frame, background included, at up to 320 px. It is
  neither full-resolution nor animated and does not show camera or layer motion;
  missing thumbnails show a placeholder. This is not pinch-to-preview.
- Three-finger horizontal scrub or Actions → Create & edit → Clear current cel
  asks before clearing the active layer on the current frame, ignoring selection.
  Undo/redo restores/re-clears the cel; other frames and layer properties remain.
  Hidden, locked or alpha-locked layers are refused. Three-finger tap undo,
  four-finger redo and downward Quick Edit swipe remain; physical touch testing is
  still needed. The separate Layer → Clear command affects all frames.
- Separate device-local QuickShape and eyedropper hold timings (200–2000 ms) apply
  to new strokes. Detection polls at 120 ms; activation may be later. Undo/redo,
  pinch and the hold timings of UI buttons are unchanged.
- Distraction-free view hides editor controls, timeline and reference temporarily;
  a visible corner button and Android Back restore them. The tray closes, while
  the timeline/reference state remains. Drawing, undo/redo gestures, playback,
  canvas overlays and system bars are unchanged. Switching artwork resets the view.
  Physical-device layout and Android Back need testing.
- Colour picker pure hue button and square-corner double tap set saturation and
  brightness to 100%; hue for neutral colours is remembered within the picker session.
  Real-device touch behaviour has not been verified.
- Brush button and size/opacity rail can be moved to either side and positioned
  vertically in device preferences; the other tool rail swaps sides. Rails compact
  and scroll in short workspaces, and the brush tray has horizontal size/opacity
  controls. Layout and touch behaviour require physical-device testing.
- Device-wide pressure curve and extra smoothing apply to future strokes without
  changing individual presets. Pressure sensitivity depends on the brush and stylus;
  high smoothing can add lag.
- 28 preset brushes, brush size/opacity, pressure, per-preset basic Brush Studio
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
- A movable, zoomable reference window showing the current canvas or an imported
  PNG/JPEG/WebP/GIF. The external image is a temporary session-only bitmap (not saved
  or exported); it is cleared on close or artwork switch. Decoded images are limited
  to 16 MP and downscaled to 2048 pixels per side. Camera input is not implemented.
- Non-destructive clipping masks constrain a layer to the alpha of the nearest
  unclipped layer below. Consecutive clips share that base. The clipped layer uses
  Normal blend, and the base blend applies to the completed stack. Hidden or empty
  base cels hide the clipped stack; reordering can change or remove its base. The
  setting is saved, undoable, and included in preview and exports. Merge is blocked
  while any clip exists. Clipping needs an additional full-size rendering buffer.
- PNG, JPEG, WebP and first-frame GIF import through the Android document picker
  into a new layer on the current frame. Imports are centred, downscaled to fit,
  undoable and saved. Files are limited to 16 MiB, decoded images to 8192 pixels
  per side and 16,777,216 pixels. Real-device picker/decoder testing is still needed.
- One saved audio track (MP3/M4A/WAV/OGG/WebM, max 2 MiB) can be previewed with
  forward loop or one-shot animation, muted, replaced and removed with undo.
  Audio time is anchored at the first included timeline frame and follows holds,
  skips and playback range. Ping-pong is silent; synchronization is approximate.
  Optional MP4 audio export uses the one unmuted track and a forward range, capped
  at 120 seconds. It requires H.264/AAC MediaRecorder, canvas capture, Web Audio
  capture and an audio decoder. It checks MP4 track metadata before saving but cannot
  confirm audibility or sync; exports need to be checked by the user. PNG and GIF are
  silent. There is no waveform, trimming, offsets or multiple-track mixing. Actual
  device format support, picker, playback and audio export need physical-device testing.
- Per-layer editable/undoable transform tracks support up to 60 frame-position keys
  with X/Y offset, uniform scale, clockwise rotation around canvas center and easing.
  They affect playback and GIF/MP4, then the global camera is applied; drawing,
  onion skins, PNG and sprite-sheet exports use raw pixels. Each frame's own cel is
  transformed; blank cels remain blank. Clipping masks, opacity and blend modes are
  respected. Layer duplication copies keys independently; locked layers protect keys.
  Merge down is blocked until both layers' keys are cleared. Tracks are frame-position
  based and out-of-range keys are removed when shortening a timeline; undo restores
  them. Two-bone IK can generate keys for two rigid layers from numeric rest joints and moving tip targets; it does not deform artwork or save a rig. There is no graphical keyframe editor, custom pivot, deformable IK rig or 3D rigging.
- A seeded burst or staggered ballistic particle generator creates a new topmost
  raster layer in an existing frame range. It offers 1–200 circles or squares, life,
  position, direction/spread, speed, gravity, colour, fade and seed. Existing layers
  remain untouched; the operation is undoable. Frame numbers rather than holds drive
  age, including skipped frames; off-canvas pixels are cropped. The operation allocates
  at most 64 MiB of new cel pixels, with further memory used by existing artwork and
  history. Parameters are not saved as editable effects, and there are no collisions,
  sprites or live simulation. This is not a full particle engine.
- A global non-destructive camera track supports up to 60 saved/undoable editable
  frame-position keys with center, zoom, rotation and outgoing easing. It applies to
  playback and GIF/MP4 export but not the drawing view, PNGs or sprite sheets. The
  dialog preview uses saved settings, not unsaved fields. Interpolation is by frame
  index, not time/holds; keys stay at positions when artwork is inserted or reordered,
  and keys outside a shortened timeline are removed (undo restores them). The camera
  is a single global camera, without rigging or graphical keyframe controls.
- One saved freehand motion guide can generate translated raster cels along its
  path in forward or reverse direction, with linear, ease-in, ease-out and in-out
  easing. A chosen source cel is copied into an existing range on the current layer,
  replacing destination cels after confirmation; one undo restores them. Sampling is
  by path distance and frame index, ignoring frame holds and skips. Moving off-canvas
  crops pixels; subpixel movement may soften them. The guide itself is editor-only;
  generated cels are saved and exported. Allocation is capped at 64 MiB per operation,
  but history and existing cels consume more memory. This is destructive baking,
  not a live transform track or editable keyframes; path baking itself does not rotate or scale.
- Two-pose transform generation interpolates X/Y offset, uniform scale and clockwise
  rotation about a user-entered pivot with linear or eased timing. It uses the whole
  source cel even when selected, replaces a chosen range after confirmation, and is
  undoable in one step. It generates saved/exported raster cels, not editable keyframe
  tracks. Frame holds/skips do not change interpolation, out-of-canvas pixels are
  cropped and resampling can soften artwork. New allocation is capped at 64 MiB per
  operation; history and existing cels consume additional memory.
- Temporary rectangular, ellipse, freehand lasso and connected-colour magic-wand selections clip brushes, erasers, flood
  fill and effects. All support fill/clear and copy to a new layer. Rectangle-only
  flips, 180° rotation and numeric move/scale are undoable; ellipse, lasso and wand transforms are
  refused. Effects calculate within the bounding rectangle then mask output, so
  blur can sample outside an ellipse, lasso or wand mask. Selections are not saved or feathered and the
  outline is not restored by pixel undo. A separate precise transform accepts numeric
  dimensions, centre offsets and free rotation with an approximate active-cel preview,
  smooth/nearest sampling and a 64 MiB temporary allocation limit. Its rotated selection
  becomes an axis-aligned bounding box. No draggable handles or custom pivots.
- Layer solo saves and restores per-layer visibility in one undoable operation; it persists across save/reopen. Clipped solo keeps its base visible. Manual visibility edits made during solo are replaced on restoration; newly added layers are left unchanged. Solo affects exports and thumbnails while active.
- Hold the colour swatch to swap the previous colour; drag still performs colour drop. The eraser button toggles an eraser or, on hold, creates a temporary copy of the current paint brush's texture and dynamics. Brush tray offers up to six device-local size presets shared across brushes.
- Cut/copy/paste uses an internal session-only clipboard, supports rectangle, ellipse, lasso
  and wand masks, and pastes as a new top layer on the current frame. Three-finger
  swipe down opens the menu; three-finger tap still undoes. Cut/paste are undoable,
  clipboard contents are not; cross-app clipboard and persistent clipboard are absent.
  Copy is capped at 32 MiB, cut at 64 MiB temporary allocations, and new paste cels
  at 64 MiB; existing artwork and history consume more memory.
- Alpha lock lets brush painting, fill and effects recolour existing layer pixels
  without changing their alpha. It is saved per layer and copied on duplication.
  Erasing, clear, flip, move/scale and merge require unlocking alpha first; it does
  not prevent deletion, frame deletion or undo/redo.
- A saved, undoable canvas background colour applies across frames. Transparent PNG
  and transparent PNG-sequence exports omit it; ordinary PNG, GIF and MP4 include it.
- Per-layer lock prevents painting, fill, effects, selection edits, clearing, deleting
  and merging the layer, and persists with the artwork. It does not block visibility,
  reordering, undo/redo or frame deletion.
- Hold-to-snap QuickShape for lines, circles and ellipses; a second finger moves the temporary shape until the drawing pointer is released. Rectangles, arcs and resizing/rotation handles
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
- The top colour swatch supports drag-and-drop flood fill on the active cel. Magic wand uses fill tolerance and a connected pixel mask, limited to 4096 horizontal runs; the dashed indicator shows only its bounds. It does not sample merged layers.
- Effects have a small approximate, downsampled current-cel preview that updates with the strength slider; applying edits pixels, not a persistent live effect.
- Undoable per-frame layer effects: Gaussian-like blur (three box passes), horizontal motion blur, sharpen,
  bloom, glitch, pixelate, posterize, solarize, grayscale, invert, sepia,
  brightness, saturation, contrast, hue shift, noise, chromatic shift, halftone
  dither and threshold. These are destructive pixel effects, not a full Procreate
  adjustment or live preview system.
- Opaque JPEG, opaque or transparent PNG, numbered PNG sequence, PNG sprite sheet and GIF export.
  Sprite sheets and PNG sequences export all source frames once, including skipped frames, without hold timing
  or ping-pong repeats; sprite sheets are limited to 8192 px per side and 16,777,216
  pixels. PNG sequences contain one image per
  frame and do not include hold timing metadata. MP4 export records one loop in real time only when the Android
  WebView supports MP4 `MediaRecorder` and canvas capture; it is not available on all
  devices. MP4 and Android MediaStore exports still need physical-device testing.
- Layer visibility, opacity, blend modes, reorder, duplicate, merge and delete; colour
  wheel and swatches; canvas pan/zoom/rotate; touch undo/redo and eyedropper.

## Not yet implemented

Snapping/drawing assist for grids and perspective, camera references, layer masks/groups, advanced automatic selection,
feathered selection, interactive transform handles and custom pivots, cross-layer ColorDrop/reference fill, advanced brush-based smudge, advanced filters and liquify, typography,
DPI settings, timelapse, gallery stacks, PSD/Procreate/PDF/TIFF compatibility, brush
import/export, and most advanced colour-management and accessibility features.
Apple Pencil-specific controls are not applicable on Android. See the original
[Procreate analysis](procreate-analysis.md) for background; its feature matrix
predates version 2.5.

Deformable IK rigs, morphing, live particle systems and multiple-track audio mixing are not implemented. A limited two-bone IK generator creates editable rigid transform keys on two layers, with no skinning or saved rig. Per-layer tracks support only position, uniform scale and rotation. Basic baked particle animation is available. One global editable camera track is available. Path-based translation and two-pose transforms are available as limited baked cel-generation tools. Onion skins are available as ghost frames. The canvas is finite raster, not infinite or resolution-independent.
