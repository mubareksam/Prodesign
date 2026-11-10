# Qalam — a Procreate-style painting & animation studio for Android

**Developed by Qmer.**

**Qalam** (from Arabic *qalam*, قلم — pen) is a self-contained Android drawing and
frame-animation app modelled on Procreate: full-screen canvas, pressure-sensitive
brushes, layers with blend modes, a colour wheel, a frame timeline with onion skin,
Procreate's gesture vocabulary, PNG/GIF export and device-dependent MP4 export — all offline, with no account and
no network permissions at all.

- Package: `com.qalam.studio` · version 4.5 (versionCode 36)
- minSdk 26 (Android 8.0) · targetSdk 33 · armeabi-v7a/arm64/x86/x86_64 independent
  (everything is HTML/JS running inside the app's own `WebView`, so the APK has no
  native code)
- APK: **`artifacts/Qalam-4.5.apk`** (~305 KB), signed with a v1+v2 scheme
- The written analysis of Procreate that this app was specified from:
  [`docs/procreate-analysis.md`](procreate-analysis.md)

---

## 1. Install

1. Copy `artifacts/Qalam-4.5.apk` to the phone (USB, Drive, chat to yourself — anything).
2. Open it with the phone's file manager. Android will ask to allow installs from
   that app the first time ("Install unknown apps").
3. Install and open **Qalam**. If an earlier Qalam version is already installed, Android should offer an update that preserves its data. Back up important artwork first. Android does not allow this app to silently uninstall itself; do not uninstall it unless you have backed up its local artwork.

No permissions are requested except `VIBRATE` (haptic ticks). There is no internet
permission, so nothing can phone home.

> The included APK uses the publicly available test key in `tools/apksign/key.pem`
> (self-signed, v1+v2). Anyone can use that key, so do not use it for a trusted
> production release. Use a securely stored private key for releases; Android will
> not accept a differently signed APK as an update to this one. Android may also
> prompt you to allow installation from the source you use.

## 2. First run

The gallery opens. Tap the eye icon on a project card for a read-only preview
without opening the artwork, or tap the card itself to edit it. The preview is the
saved thumbnail (up to 320 pixels on its longest edge) of the frame active when the
project was last successfully saved. It includes the canvas background, but does not
show animated camera or layer motion; it is neither full-resolution nor animated.
If no usable thumbnail was saved, a placeholder appears. Close the preview or use
Android Back to return to the gallery. This is a button, not a pinch-to-preview gesture.

Tap **New canvas**, name the artwork and pick a preset:

| Preset | Pixels |
|---|---|
| Square | 2048 × 2048 |
| Portrait | 1600 × 2133 |
| Landscape | 2133 × 1600 |
| HD frame | 1920 × 1080 |
| Animation | 1280 × 1280 |
| Story | 1080 × 1920 |

You can also enter custom width and height from 64 to 4096 pixels each. Large
canvases, many frames and many layers require substantial device memory. DPI is
not configurable.

Everything is autosaved on the device (`IndexedDB`, with a `localStorage` fallback)
≈2.5 s after the last change, when the app goes to the background, and on
**Menu → Save now**. Reopening an artwork restores every layer and frame.

## 3. Tools and panels

Bottom bar: **Gallery · Layer · Brush · Colour · Timeline · Menu** (plus **Undo**,
**Redo** and the eyedropper on the top bar, and a size/opacity strip).

- **Brush tray** — 20 presets, with labelled ink, pencil, paint and eraser icons.
  Select a brush and open **Brush studio** to adjust spacing, flow, opacity, edge
  hardness, pressure response and stabilization. Settings are saved per preset on
  this device. The sliders icon in the brush tray opens **Brush size presets**:
  save, reuse or remove up to six sizes shared across all brushes on this device.
  The eraser icon on the right rail toggles the hard eraser and your previous
  painting brush. Hold it, then release, to make an eraser using a copy of the
  current painting brush's texture and dynamics; tap to return. The matched eraser
  keeps the current size and opacity, is temporary and does not change the original
  brush. Switch back to the painting brush to edit its settings. Erasing is blocked
  on alpha-locked layers. This is a basic editor, not the full Procreate Brush Studio.
- **Actions → Preferences → Pressure & smoothing** — device-wide settings for future
  strokes. The pressure curve changes reported stylus pressure: 100% is neutral,
  lower values make light pressure stronger and higher values make it lighter. Finger
  pressure is unchanged, and brushes with no pressure response are unaffected by the
  curve. Extra smoothing is added to each brush's stabilization (capped at 90%);
  zero leaves its own setting alone. Both settings apply to brushes and erasers,
  are stored on the device, and leave brush presets and existing pixels unchanged.
  High smoothing can add lag; supported pressure depends on the device/stylus.
- **Actions → Create & edit → Recolour matching pixels** — replace matching
  non-transparent RGB pixels throughout the active cel, including disconnected
  areas. Tap the small preview to sample a source pixel from the original cel,
  or enter a 3- or 6-digit HEX colour; the replacement defaults to the brush
  colour. The 0–128 tolerance is applied independently to each RGB channel;
  alpha is not used for matching and remains unchanged, including with alpha lock.
  Transparent pixels are skipped. An active rectangle, lasso or wand selection
  limits the result. Other layers and frames are untouched; one undo restores
  the change. The preview is downsampled and approximate, not a live canvas or
  transformed/composited output. This is not Procreate's interactive crosshair
  recolour tool. Estimated temporary allocations are capped at 64 MiB; existing
  canvas and undo history use additional memory. Hidden or locked layers are
  refused; no matching changes produce no undo step.
- **Clear current cel** — use Actions → Create & edit → Clear current cel, or
  put three fingers down together on the canvas and scrub right-left-right (or
  left-right-left) within two seconds, keeping all three in contact and moving
  roughly horizontally. The shortcut asks for confirmation. It clears the entire
  active layer on the current frame, ignoring any selection; other frames, layer
  settings and the selection are unchanged. Undo restores the cel; redo clears it
  again. Hidden, locked and alpha-locked layers are refused. An unallocated cel
  is already empty. The other Layer menu's Clear command clears that layer across
  all frames. Three-finger tap remains undo, four-finger tap redo, and the
  three-finger downward swipe still opens Quick Edit. Touch recognition needs
  physical-device testing; use the menu action if the gesture is difficult.
- **Actions → Preferences → Hold gesture timing** — independently set how long
  to hold a stroke still for QuickShape and how long to hold a nearly stationary
  press for the eyedropper, from 200–2000 ms. Defaults are 380 ms and 520 ms;
  Reset restores both. The settings apply to new finger or stylus strokes, are
  stored on this device and do not change artwork. Detection is polled every
  120 ms, so actual activation can be later, especially on a busy device. Short
  delays can cause accidental activation. Undo, redo, pinch, colour/eraser/layer
  button holds and other gesture timings are not changed.
- **Actions → Preferences → Brush slider layout** — choose whether the brush
  button and size/opacity sliders sit on the left or right, and set their vertical
  position. Colour, fill, eraser and layer buttons move to the opposite edge so
  the rails do not overlap. Changes apply immediately and are saved on the device;
  Reset returns to left and centred. On shorter screens or with the timeline open,
  rails shrink and may scroll vertically; positioning has less effect when there is
  little spare space. The brush tray also provides horizontal size and opacity
  sliders as an alternative. Screen layout and touch scrolling need physical-device
  testing, especially in landscape with the timeline open.
- **Actions → Canvas & view → Hide interface** — temporarily hides the top bar,
  side rails, timeline, reference panel and tray, leaving the canvas and one
  corner button. Tap the **Show interface** corner icon or press Android Back to
  restore them. An open timeline or reference returns as it was; the Actions
  tray closes. The view resets when leaving or switching artwork. Playback and
  canvas overlays such as guides or selections are not disabled, and system bars
  are not hidden. Drawing and three-finger undo/four-finger redo still work;
  three-finger swipe can open Quick Edit above the canvas. The focus view itself
  is not saved in the artwork and does not change pixels or zoom.
- **Colour tray** — HSB wheel with a value/saturation square, HEX entry, 24 swatches
  and the 12 most recent colours. Tap the droplet-plus icon or double-tap the
  upper-right corner of the square to select the current hue at 100% saturation and
  brightness. A single tap still picks normally. For black, white or grey (which have
  no hue), the picker uses the last hue used in the picker this session, or blue on first launch;
  choose a hue on the ring first if needed. The remembered hue itself is not saved
  across app restarts. The resulting colour uses the normal previous-colour swap. Hold the top colour
  swatch still, then release,
  to swap the current and previous colours. Moving it instead still starts colour
  drop fill; tapping it opens the colour tray. The previous colour is stored locally.
- **Layers tray** — add, duplicate, merge down, clear, delete, reorder (▲▼), rename,
  opacity and 16 blend modes (Normal, Multiply, Screen, Overlay, Darken, Lighten,
  Color dodge/burn, Hard/Soft light, Difference, Exclusion, Hue, Saturation, Color,
  Luminosity). Rows show a live thumbnail and an eye toggle. Open a layer's
  three-dot menu to lock or unlock it. Hold a layer's eye, then release, to solo it;
  hold the same eye again or use **Restore layer visibility** to restore the previous
  visibility pattern. The layer options also offer solo. Solo and restore are undoable
  and saved, including their visibility snapshot. If the soloed layer is clipped,
  its base remains visible so the clipping works. Changing layer visibility during
  solo is overwritten when the snapshot is restored; newly added layers are left as
  they are. Solo affects playback, exports and gallery previews while active.
  Use the three-dot menu to lock or unlock a layer. Lock prevents painting, fill, effects,
  transforms, clearing, deleting or merging that layer; it does not prevent
  visibility, reordering, renaming, opacity changes, undo/redo or deleting a frame.
  Lock is saved per layer, across all its frames. **Alpha lock** in the same menu
  allows recolouring existing pixels with brushes, fill and effects while preserving
  their transparency. Turn it off to use erasers, clear, flip, transform or merge.
  Alpha lock does not prevent layer/frame deletion or undo/redo. It persists and
  is copied when duplicating a layer.
- **Layers → Add (+)** opens choices for a blank layer, image import, a solid
  colour or a horizontal, vertical, diagonal or radial two-colour gradient. Colour
  layers fill the canvas on the current frame only, and are ordinary raster layers,
  not editable vector fills. Creation is saved and undoable. Enter 3- or 6-digit
  hexadecimal colours; transparent or multi-stop gradients are not supported.
- **Animation categories** use icon buttons: Frames, Settings, and Guides & audio.
  Tap a category to show its tools; play, duplicate frame and FPS remain in the header.
  Actions are expandable categories. Buttons expose accessible names and tooltips.
- **Effects** shows offline representative sample thumbnails and a small preview of the current cel. Moving the strength slider refreshes the preview without changing the artwork. The preview is downsampled and approximate (particularly blur radius), not a live full-canvas composite. Apply changes the active layer's pixels; Undo reverses it.
- **Layer options → Clipping mask** — clips a layer non-destructively to the alpha
  of the nearest unclipped layer beneath it. Consecutive clipped layers share that
  base; they use Normal blend, while the base blend applies to the whole stack.
  A clipped layer's previously chosen blend is retained but inactive until released.
  The base's opacity affects the whole stack; clipped opacity affects that layer's
  colour. Hidden or empty base cels hide the stack for that frame. The bottom layer
  cannot be clipped; reordering or deleting layers may change the base or leave an
  orphan invisible until moved or released. Release clipping to reveal the original
  pixels. Settings persist and support undo/redo. For safety, merging layers is
  blocked while *any* clipping is enabled. Masking applies to preview, onions and
  exports; rendering a stack uses an extra canvas-sized buffer and may be slow or
  memory-heavy on large artworks.
- **Layers → Add (+) → Import image** (or **Actions → Create & edit → Import image as layer**) —
  choose a PNG, JPEG, WebP or GIF through Android's document picker. The image is
  centred and reduced to fit when needed, never enlarged. GIF imports its first
  displayed image, not an animation. It becomes a new layer on the current frame;
  its other frames are blank. The import is undoable and saves with the artwork.
  Files are limited to 16 MiB and decoded images to 8192 pixels per side and
  16,777,216 pixels. Large files can still exceed a device's memory while decoding.
  If the artwork, current layer or frame changes while loading, import is cancelled.
  This uses a user-selected document grant rather than storage permission; the
  Android picker and decode behaviour have not been tested on a physical device.
- **Timeline** — add blank or duplicate frames, use thumbnails, previous/next or the
  scrub slider to select a frame, play/stop and toggle onion skin. **Settings** offers
  1–30 fps, loop, ping-pong or one-shot, opacity, separate 0–4 previous and 0–4 next
  onions and their colours. Choose tinted or original colours, all visible layers or
  the active layer, above or below artwork, and whether to show skipped frames.
  Ghosts are hidden during playback. A saved, undoable playback range limits preview,
  GIF and MP4. It uses positions, not identities: reordering changes its contents;
  deletion clamps it to the timeline. Outside-range frames remain editable.
  In **Frame options**, set a 1–60 tick hold, optional group label, skip/include,
  duplicate, move or delete. Skipped frames remain editable but are omitted from
  playback, GIF and MP4; a range with no included frames cannot play or export.
  **Batch frames** labels, holds, reverses, duplicates, skips or includes a range
  in one undo step. **Delete range** removes a range after confirmation and must leave
  at least one frame; undo restores its cels and settings. The 60-frame limit still
  applies; labels are tags, not groups. The timeline reports included frames, ticks
  and estimated seconds per playback cycle, factoring in holds, skips, range and ping-pong.
  Actual playback or export duration can differ due to timing and encoding.
  **Copy cel** replaces the current layer's cels in a selected frame range with
  independent copies of a non-empty source cel, after confirmation. It includes
  skipped frames but leaves other layers, timing and source untouched. Undo restores
  previous cels. Unlock the layer and alpha first. One operation allocates at most
  64 MiB of copied pixel data; choose a smaller range if needed. Actual peak memory
  can be higher, especially with undo history and large canvases.
- **Timeline → Audio** — import one MP3, M4A, WAV, OGG or WebM audio file (maximum
  2 MiB) with the Android document picker. The track is saved with the project and
  can be replaced, muted or removed with undo. Its time zero aligns to the first
  included frame in the whole timeline. The preview follows frame holds, skipped
  frames, the selected starting frame and playback ranges; loop mode restarts the
  track at the range start. Audio stops when its file ends and pauses when animation
  stops. It is muted during ping-pong (reverse audio is not supported). Playback is
  approximate and may drift or be delayed by the device; format and playback support
  depend on WebView. This is a single track: no trimming, waveform, offsets or
  multiple tracks. PNG and GIF exports are silent. Optional MP4 export can include
  this track on a compatible device; see the export instructions below. Local storage
  fallback may run out of space sooner when audio is saved; export and back up work
  regularly. The picker, playback and audio export need physical-device testing.
- **Timeline → Guides & audio → Layer keyframes** (also in each layer's options)
  — select a layer and frame, then add or update a key for X/Y offset, uniform
  scale (10–400%), clockwise rotation (−1440° to 1440°), and easing to the next
  key. Rotation/scale pivot around the canvas center; offsets are in canvas pixels.
  Select another frame to add another key; the list can jump to keys and the timeline
  marks keys on the selected layer. Values interpolate by frame number using the
  earlier key's easing. Before/after the track, the nearest key holds; holds/skips
  do not change interpolation positions. Keys affect the cel **already present on
  each frame**: a blank cel remains blank. Duplicate frames or use Copy cel to fill
  a range if you want the same drawing to move through it.

  Playback, GIF, silent MP4 and audio MP4 apply enabled tracks, then the global camera.
  Transformations affect rendering, not the source cels. The editor, onion skins,
  PNGs, PNG sequences and sprite sheets remain in raw canvas coordinates. The dialog
  preview shows saved tracks and camera, not unsaved field edits. Clipping masks and
  blend modes are respected; transformed pixels outside the original canvas are
  cropped, and raster resampling can soften artwork. Motion is clipped before the
  global camera is applied. Each layer supports up to 60 saved/undoable keys; duplicate
  copies its track independently. Lock a layer to prevent changing its keys (alpha
  lock does not block non-destructive motion). **Merge down is blocked if either
  layer has keys**, even if disabled; clear keys first to avoid silently losing them.
  Keys belong to frame positions, not identities: insertion and reordering change
  which drawing sits under a key; shortening the timeline removes out-of-range keys,
  and undo restores them. There is no graphical transform editor, custom pivot, 3D
  rigging or a deformable IK rig. Existing baked motion and particle tools are separate operations.
- **Timeline → Guides & audio → Two-bone IK** — create editable layer-motion keys for two separate rigid layers. Draw the upper and lower bones in their original rest pose on each frame you want to animate; blank cels remain blank. Select the two unlocked layers and a range of at least two existing frames. Enter the root, joint and tip positions in original, untransformed canvas pixels, then the start and end tip targets, bend side and easing. The skeleton preview shows the solved end pose, not the actual artwork, and reports how many target positions are clamped to the bones' reach. The confirmation displays that preview and warns before replacing both layers' existing keys within the range; keys outside it are kept. Both tracks are enabled, one key per frame is created, and a single undo restores both tracks. Key and motion limits still apply. Values are interpolated by frame index, not hold length; skipped frames still get keys. Playback and animated exports use these keys like other layer motion, whereas raw editing and PNG exports remain untransformed.

  This is a two-layer key generator, not a saved rig: it cannot deform, skin or bend artwork, has no draggable bone handles, and does not copy cels or follow a live target after generation. Whole layers rotate rigidly, and raster resampling/clipping applies. Keys can be edited afterward in Layer keyframes.
- **Timeline → Guides & audio → Generate particles** — generate simple animated
  dots on a new topmost raster layer over an inclusive range of existing frames.
  Choose burst (all born on the first frame) or staggered emission over the range,
  circle/square shape, colour, opacity, fade, count (1–200), lifetime (1–60 frames),
  emitter position, direction, spread, speed, gravity and integer seed. Direction
  is 0° right, 90° down and −90° up; positive gravity pulls down. Speeds are pixels
  per frame and gravity is pixels per frame squared. The seed reproduces the same
  result for the same settings. Particle speeds vary from 65–100% of the chosen
  speed and radii from 70–100% of the chosen radius. Frame age uses frame numbers,
  not holds or playback time; skipped frames are generated too. Pixels outside the
  canvas are cropped, and the current selection is ignored. Existing layers and
  clipping-mask bases are untouched; undo removes the new layer in one step. The
  generated cels are saved and appear in normal exports and camera playback.
  Generation is capped at 64 MiB of new cel pixels, while history, existing artwork
  and canvas overhead require additional memory. This is a simple baked effect:
  settings are not retained for live editing, and there are no collisions, forces
  beyond gravity, sprites, paths or an automatic seamless loop.
- **Timeline → Guides & audio → Camera keyframes** — select a timeline frame,
  open the camera button and add or update its key: center X/Y in canvas pixels,
  zoom (25–400%), rotation (−1440° to 1440°), and easing to the next key. Add
  keys at other frames by selecting them in the timeline; the key list can jump to
  existing keys, and the frame strip marks them. Positive camera rotation is
  clockwise, so the artwork appears to turn counterclockwise. Values interpolate
  by frame number using the earlier key's easing; before the first key and after
  the last, its pose holds. Rotation uses the entered angles directly, so full
  turns are possible. Frame holds freeze the current pose and skipped frames are
  not displayed in playback; neither changes the interpolation positions.
  The camera can be disabled without deleting keys. Add, edit, delete, clear and
  enable/disable are saved and undoable. The dialog preview shows **saved** settings,
  not unsaved field edits. Playback, GIF, silent MP4 and audio MP4 render through
  the camera; blank areas use the canvas background. While drawing, the canvas,
  onion skins and tools use original coordinates. PNG, PNG sequence and sprite
  sheet exports also use original uncropped frames. Camera keys belong to frame
  **positions**, not frame identities: insertions and reordering change which
  drawing is under a key; deletion drops keys that fall beyond the new timeline,
  and undo restores them. Maximum 60 keys. This is one global camera track, not
  an IK rig or a vector camera system. Separate per-layer keyframes are also available. Zoom/rotation
  resample raster pixels; large canvas/clipping projects need device testing.
- **Timeline → Guides & audio category → Motion guide** — draw or replace one
  freehand path (up to 512 points), show/hide it, or clear it. The guide is saved,
  undoable and editor-only. To animate, choose **Generate motion along guide**:
  select a source frame on the active layer, an existing inclusive frame range,
  forward/reverse direction and linear, ease-in, ease-out or ease-in-out timing.
  The source drawing begins at its original position and moves by the path's change
  in position; draw the guide in the desired direction, independently of where the
  drawing sits. Path positions are sampled by distance. Destination cels on the
  current layer, including the source if in the range and skipped frames, are
  **replaced after confirmation**; all other layers and frame settings remain as
  they were. Undo restores the previous cels in one step. Locked or alpha-locked
  layers are rejected. The operation allocates at most 64 MiB in new cel pixels;
  undo, existing cels and canvas overhead use additional memory. Use a smaller
  range or canvas if necessary. Generated frames are normal saved raster cels and
  appear in exports, but the guide overlay does not. Movement outside the canvas is
  cropped and fractional movement may soften pixels. Spacing uses frame numbers,
  not holds, skipped-frame playback or real time. This is baked translation only,
  not editable keyframes, rotation, scale, snapping, rigging or IK.
- **Timeline → Guides & audio category → Generate transform frames** — set a
  source frame and at least two existing destination frames. Set numeric Start and
  End poses: X/Y offset from the original cel, uniform scale (10–400%), and
  clockwise rotation (−1440° to 1440°). Set a pivot in canvas pixels (default is
  the canvas centre), plus linear, ease-in, ease-out or ease-in-out interpolation.
  Rotation interpolates the entered angles directly, allowing full turns. Each
  generated frame is rendered from the original source, not from the prior frame.
  The **entire source cel** is used even if a selection is active. After confirmation,
  current-layer cels in the range are replaced, including skipped frames and the
  source if it lies inside the range. The operation is one undo step; other layers
  and timing are unchanged. It needs an unlocked layer and alpha, and new cel
  allocation is capped at 64 MiB (existing cels, history and canvas overhead require
  more memory). Frame-number spacing ignores holds and playback skips. Off-canvas
  pixels are cropped, and resampling may soften pixels. The resulting raster cels
  are saved and exported, but pose settings are not stored: this is **not** a live
  editable keyframe track, a graphical preview, IK or a rigging system.
- **Fill tool** — tap the bucket on the right rail, then tap an area. It fills the
  connected pixels on the current layer with the selected colour at full opacity;
  undo reverses the fill. **Menu → Fill settings** adjusts colour tolerance. It
  does not sample outlines on other layers and may take time on large canvases.
  Alternatively, drag the top colour swatch onto the canvas and release inside an
  enclosed area to fill it. Tap the swatch normally to open the colour picker. Both
  methods use the active cel and tolerance, honour locks and selection, and make
  an undoable pixel edit. Gaps in outlines can cause colour to escape; line art on
  other layers is not treated as a boundary.
- **Menu → Canvas background** — choose the current brush colour or enter a 3- or
  6-digit hex colour. The background applies to every frame, is saved and can be
  undone. It appears in normal exports but not transparent PNGs.
- **Actions → Canvas & view → Canvas reference** — a movable, zoomable window that
  can display the current frame or a user-selected PNG, JPEG, WebP or GIF image.
  Tap the image-upload icon to choose a reference; tap the canvas icon to return
  to the live canvas overview. The image is session-only, cleared when you close
  the panel or switch artworks, and never added to layers, saved in the project,
  or included in exports. Animated images show one decoded frame. File size is
  limited to 16 MiB; decoded dimensions are limited to 8192 per side and 16 MP,
  then the reference is downscaled to at most 2048 per side for display. The picker
  and memory use still need testing on a physical Android device. Camera input and
  persistent reference images are not supported.
- **Actions → Create & edit → Selection & transform** — choose **Draw rectangle**
  and drag, **Draw lasso** and trace a freehand outline, or choose **Magic wand**
  and tap a connected colour on the active cel. Magic wand uses the Fill settings
  tolerance, replaces the previous selection, and selects transparent areas too.
  Its dashed outline shows the selection bounds only; edits use the exact pixel
  mask, including holes. Complex selections exceeding 4096 horizontal runs are
  refused rather than partially selected. The lasso closes from its last point to
  its first. All three selections clip brushes, erasers, fill and
  effects and support selection fill/clear and **Copy to layer**. Copy creates a
  new layer only in the current frame. Select all and Deselect are available.
  Effects are calculated within the selection's bounding rectangle and masked on
  output; blur can sample pixels inside that rectangle but outside a lasso or wand mask.
  Rectangular selections also support flips, 180° rotation and **Move / scale**.
  These transforms do not support lasso or wand masks and are refused instead of changing their
  bounding rectangle. Move/scale uses numeric offsets and 25–400% scale anchored
  at top left, without live preview; off-canvas content is cropped. With no
  selection, transforms use the current cel. Undo restores pixels, not the selection
  outline. **Precise transform** adds independent whole-pixel width and height,
  centre-relative whole-pixel move offsets, and a numeric clockwise angle from
  −360° to 360°. Dimensions describe the unrotated frame; the rotated bounding box
  may be larger. Choose smooth or nearest-neighbour resampling. The dialog shows an
  approximate preview of the active cel only and warns about canvas cropping. It
  does not show the composite, and it has no draggable nodes or custom pivot. The
  transform cuts the source and composites it over the destination; pixel edits are
  saved and undoable in one step. A rotated rectangular selection becomes its
  clipped, axis-aligned bounding box, so that box can include unselected corners;
  Undo restores pixels but not the selection. It refuses lasso/wand, locked or
  alpha-locked layers, and limits estimated temporary allocation to 64 MiB (the
  existing document and undo history need additional memory). Very large canvases
  may exceed this limit. Raster resampling and clipping can lose detail.
  Selections are temporary, unsaved and cleared when switching artworks;
  they apply across layer/frame switches. Lasso paths are limited to 2048 sampled
  points, are not feathered, and large edits can take time and memory.
- **Actions → Create & edit → Cut, copy & paste** (also in Selection & transform,
  or by swiping three fingers downward together) — cut or copy the selection on the
  current layer and frame. With no selection, cut/copy uses the whole current cel.
  Rectangles, lasso and Magic Wand masks are supported. Copy can read a hidden or
  locked layer; cut requires a visible, unlocked layer with alpha lock off. Paste
  ignores the current selection and creates a new topmost layer on the current frame,
  at the copied pixel coordinates. Other frames stay blank on that layer. Pasting
  into a smaller canvas crops outside pixels; a fully off-canvas paste is refused.
  Paste into another artwork in the same session is supported. Cut and paste are
  separately undoable; the clipboard itself is not part of undo history. The Qalam
  clipboard is temporary memory only, not Android's system clipboard: it is not saved
  with the project and is cleared when the app closes, or with Clear clipboard.
  Copy is limited to 32 MiB of clipboard pixels; cut is limited to 64 MiB estimated
  temporary allocations; a new pasted cel is limited to 64 MiB. Existing artwork and
  undo history consume additional memory. Large selections may need to be copied in
  smaller pieces. Three-finger tap remains undo and four-finger tap remains redo;
  gesture behaviour needs testing on a physical device.
- **Menu → Drawing guides** — show an adjustable 2D, isometric or one-, two- or
  three-point perspective overlay, or a symmetry overlay. Perspective horizon and
  point spread can be adjusted; perspective and grids are visual only, not snapping
  or perspective-correct drawing assistance. Choose vertical, horizontal, quadrant or eight-fold radial
  symmetry and switch **Layer assist** on to mirror strokes on the selected layer.
  The grid is visual only; it does not snap strokes. Guides are not exported.
- **Menu → Effects** — Gaussian-like blur (three box passes, not an exact Gaussian kernel), horizontal motion blur, sharpen, bloom,
  glitch, pixelate, posterize, solarize, grayscale, invert, sepia, brightness,
  saturation, contrast, hue shift, noise, chromatic shift, halftone dither and
  threshold. Effects permanently modify the selected layer of the current frame;
  use Undo to revert. Large canvases can take time and memory.
- **Menu** — PNG, PNG frame sequence, GIF and capability-dependent MP4 export,
  drawing guides, canvas controls, save and help.

## 4. Gestures

| Gesture | Action |
|---|---|
| Draw / drag with one finger or stylus | Paint |
| Two fingers drag | Pan the canvas |
| Two fingers pinch / twist | Zoom / rotate |
| **Three-finger tap** | Undo |
| **Three-finger swipe down** | Open Cut, copy & paste |
| **Four-finger tap** | Redo |
| Hold layer eye, then release | Solo that layer or restore prior visibility |
| Hold colour swatch, then release | Swap current and previous colour |
| Hold eraser, then release | Match eraser to the current painting brush |
| **Long-press on the canvas** | Eyedropper — picks the colour under the pen, no paint left behind |
| Hold still at the end of a stroke | **QuickShape** — snaps to a line, circle or ellipse; while still holding, drag a second finger to move the preview. Lift the original finger or stylus to commit. The preview is a simple outline; the committed shape uses the selected brush. |
| Pen down + finger down | Finger is ignored during a stylus stroke, except after QuickShape snaps for moving its preview |
| Android back button | Closes a dialog/tray, then returns to the gallery; one more press exits |

## 5. Export

- **Export PNG** — flattens the current frame and hands the bytes to the native
  bridge, which writes `Qalam-<timestamp>.png` into `Pictures/Qalam` through `MediaStore`
  (Android 10+; on 8.0–9.0 the file lands in the app's external folder, whose path
  `Bridge.folder()` reports).
- **Export animation** — encodes a GIF on the device (median-cut quantiser + LZW,
  no native dependency) with a size choice (50/100/150 %) and loop count (forever /
  once / 3×), saved the same way as `Qalam-<timestamp>.gif`.

- **Export PNG frames** — saves one numbered PNG per animation frame. Frame-hold
  timing is not encoded in the filenames; set timing in your video editor. This
  exports every source frame once, including skipped frames and those outside the playback range.
- **Transparent PNG** / **Transparent PNG frames** — omit the canvas background
  and preserve layer transparency in the current frame or a numbered sequence.
  Blend-mode results can differ without a solid background. GIF and MP4 exports
  still include the background; transparent GIF/video is not offered.
- **Export sprite sheet** — saves all source frames once in a left-to-right,
  top-to-bottom PNG grid, at 25%, 50% or 100% scale and a chosen column count.
  Choose a transparent or canvas-colour tile background; unused cells are transparent.
  Playback range, skips, ping-pong repetitions and frame holds are not included as pixels
  or timing metadata. The output is limited to 8192 pixels per side and 16,777,216
  total pixels; lower the scale or adjust columns if it is too large.
- **Actions → Export → Export MP4** — choose a silent MP4 or an MP4 with audio.
  Both record one playback-range cycle in real time, including frame holds and
  excluding skipped frames, up to 1280 pixels on the longest side. The audio option
  requires an imported, unmuted track, forward playback (loop or one-shot, not
  ping-pong), an audio decoder, Web Audio capture and a WebView that advertises
  H.264/AAC-in-MP4 recording. It is limited to **120 seconds**. Audio begins at the
  selected range's absolute timeline offset and ends when the track ends; sync is
  approximate and may drift. If the track ends before the range, choose another
  range or silent export. Keep the app open; Cancel, Android Back, backgrounding or
  switching projects cancels the audio export. Decoding long compressed audio and
  recording/encoding can require substantial memory. The app checks that the resulting
  MP4 metadata contains video and audio tracks before saving, but cannot prove the
  audio is audible or correctly synchronized: play back the saved file to verify it.
  The device may still report support yet fail to record, decode or save. On Android
  10+ files go to `Movies/Qalam`; Android 8–9 uses the app's external folder. The
  silent MP4 option retains ping-pong support and is separately device-dependent.
  Neither path has been tested on a physical Android device.

No storage permission is needed: `MediaStore` inserts as the app on Android 10+.

## 6. How it is built (no Gradle, no Android SDK)

The app is a `WebView` shell plus plain HTML/CSS/JS. The APK is assembled from
resources with `aapt2`, from hand-written smali with apktool's smali assembler, and
signed with `apk_sign_ts`:

```
android/
  AndroidManifest.xml        com.qalam.studio, minSdk 26, targetSdk 33, singleTask
  apktool.yml
  res/                       strings, colours, styles, launcher icons (adaptive)
  assets/app/
    index.html               gallery + studio markup
    css/app.css              dark touch UI
    js/core.js               DOM/colour/canvas helpers, toasts, native bridge
    js/doc.js                Doc (layers, frames, cels, thumbnails) + History
    js/brushes.js            20 presets, procedural sprites, Q.Stroke engine
    js/gif.js                quantiser, LZW, GifWriter
    js/effects.js            undoable pixel effect algorithms
    js/fill.js               scanline flood fill
    js/selection.js          rectangle/lasso geometry and pixel flips
    js/spritesheet.js        bounded PNG sprite-sheet layout and rendering
    js/view.js               viewport, input, gestures, QuickShape, eyedropper
    js/storage.js            IndexedDB store with localStorage fallback
    js/ui.js                 trays, colour wheel, layers, timeline, dialogs
    js/app.js                App shell: documents, saving, export, back button
  smali/com/qalam/studio/    MainActivity, PickerChrome, Bridge (JS <-> Java), BackCb
  reference/*.java           the same Java, kept javac-compilable as a check
tools/
  fetch-toolchain.sh         downloads JVM/apktool/aapt2/android.jar + npm modules
  build.sh                   type-check -> apktool build -> sign -> verify
  check_reference.sh         javac check of reference/*.java against android.jar
  verify_apk.py              re-parses the APK: zip, arsc, dex, v2 signature
  make_icons.py              icon source -> all mipmap densities + adaptive icon
  apksign/sign.mjs           v1+v2 signer
  tests/engine_smoke.mjs     156 engine checks (history, brushes, doc, GIF, …)
  tests/pixel_integration.mjs real raster and animation export checks
  tests/gif_roundtrip.mjs    encodes a GIF and decodes it with an independent decoder
  tests/ui_smoke.mjs         jsdom boot + full UI drive (gallery -> export)
artifacts/Qalam-4.5.apk           the signed, installable artefact
docs/procreate-analysis.md   the Procreate study this app was built from
docs/qalam.md                this file
```

Design notes worth knowing before changing code:

- **A stroke is a stamping engine.** The pointer path is resampled by spacing × size;
  each sample stamps a procedural sprite whose size and alpha follow pressure,
  speed and taper. Translucent brushes accumulate into a scratch buffer that is
  composited onto the cel once per flush, so a stroke never darkens where it
  overlaps itself.
  `Q.Stroke` receives `view.opacity × brush.opacity`; internal accumulation uses
  `brush.flow` only.
- **Undo is pixel-based.** `History.beginPixels` snapshots the active cel, a stroke
  records one dirty rectangle, and `endPixels` stores the *before* pixels of only that
  rectangle (36 steps). Structural changes (add/remove/reorder layers and frames) use
  a second history entry type.
- **Frames are layers.** `Doc.frames[i].cels[layerIndex]` is lazily allocated, so a
  10-frame canvas costs nothing until you draw on it. Onion skin renders the
  neighbouring frames with adjustable colour, opacity, scope and stacking order.
- **Rendering is demand-driven.** `View` keeps `dirty` and redraws inside
  `requestAnimationFrame` only when something changed.
- **Palm rejection is scoped.** Extra pointers are ignored only while the *active*
  stroke came from a pen; finger strokes can always escalate into a gesture.

### Build it yourself

```bash
bash tools/fetch-toolchain.sh     # once per machine: JVM, apktool, aapt2, jars, npm
bash tools/build.sh               # -> artifacts/Qalam-4.5.apk (signed + verified)
bash tools/check_reference.sh     # optional: javac-check the Java mirrors
```

`fetch-toolchain.sh` puts everything in `~/.cache/tc` (override with
`QALAM_TOOLCHAIN`). Two sandbox quirks are baked into `build.sh`:

- the package mirror blocks the Android SDK, so resources are compiled with a static
  `aapt2` and dex is assembled by apktool — there is no Gradle anywhere;
- JDK 25's `posix_spawn` helper is blocked by seccomp, so the JVM runs with
  `-Djdk.lang.Process.launchMechanism=FORK`.

### Tests

```bash
cd tools/tests && npm install
npm test        # engine_smoke (156 checks) + pixel_integration + gif_roundtrip + ui_smoke
```

`pixel_integration.mjs` uses a native desktop canvas implementation to verify
actual RGBA pixels, selection clipping, sprite sheets, GIF timing and undo/redo. It is not an Android device test.
`ui_smoke.mjs` boots the real app in jsdom with a stubbed 2D context and drives the
actual DOM: new canvas → brush tray → stroke → undo/redo → layers → colour →
timeline → playback → save → reopen from the gallery → gestures (pinch, three-finger
undo, four-finger redo, long-press eyedropper, QuickShape) → Android back button →
PNG export into the native bridge. It is the regression net for anything that
touches `ui.js`, `view.js`, `app.js` or `storage.js`.

`verify_apk.py` re-reads the finished APK independently: zip entries, `resources.arsc`
alignment, `classes.dex` magic/version/size, the v2 signature block and the RSA
signature against the certificate — `VERIFIED — installable APK` means the file will
install, not merely that a build command exited 0.

## 7. Known limits & roadmap

This is not a full Procreate replacement. Canvas sizes are finite (up to 4096 px per side), and artwork is raster: magnification up to 64× reveals pixels rather than creating infinite detail. Layer groups, multi-track audio mixing, deformable rigging, morphing and live particle systems are not implemented. A limited two-layer IK key generator is available. Editable per-layer transform tracks are limited to position, uniform scale and rotation. A basic baked particle generator is available. A global editable camera track is available for animation playback and GIF/MP4 export. Audio-in-MP4 export is conditional on device support and requires physical-device testing. Path and two-pose transform animation generate raster cels rather than live keyframes. Onion skins provide ghost frames. Brush Studio edits existing presets only;
custom tips/grains, dual brushes and import/export are not implemented. Guide
snapping, adjustable vanishing-point placement, rectangle/arc QuickShape, persistent
image references, automatic selection beyond Magic Wand, feathered masks, interactive
transform handles, layer masks/groups, text, cross-layer reference fill,
smudge, timelapse, PSD and many other requested features remain unimplemented. Frame labels are not full nested frame groups; PNG sequences and sprite sheets
contain one image per frame without hold metadata. MP4 availability depends on the
WebView and has not been verified on a physical Android phone. See
[feature coverage](FEATURES.md) for details.
