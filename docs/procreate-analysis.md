# What Procreate does — a working analysis

> Historical study: the Qalam feature matrix below predates version 1.5. See [FEATURES.md](FEATURES.md) for current coverage and limitations.

*Written as the spec for **Qalam** (this repo's Android painting/animation app): read
Procreate's behaviour, then decide what to copy, what to approximate and what to leave
out. Facts are drawn from Savage Interactive's own documentation and store listings,
plus published reviews and tutorials (Paperlike, SelectHub, Jerry's Artarama /
firstdesignprintweb, theprocreate.com, MyGhostArtist). Numbers such as "200 brushes"
are the vendor's own figures; layer limits and canvas maxima vary with device RAM, so
they are described rather than quoted.*

**Scope of the product analysed:** Procreate 5.x on iPad (Procreate 5X shipped 2020,
5.2 in 2021, 5.3 in 2023), Procreate Pocket 4.x on iPhone, and the sibling app
Procreate Dreams (2023) for animation. One-time purchase, no subscription, no account.

---

## 1. Positioning

| | Procreate |
|---|---|
| Platform | iPad only (Pocket: iPhone). No Android, no Windows, no web. |
| Price | One-time ~US$12.99 (Pocket ~US$4.99); Dreams ~US$19.99 |
| Accounts / cloud | None required — but iCloud Drive and Files are used for backup |
| Audience | Illustrators, comic/manga artists, concept artists, letterers, animators |
| Why people stay | Brush engine quality, stylus latency (120 Hz), gesture vocabulary, one-off price |

The important product lesson: Procreate is not "Photoshop on a tablet". It is a
**touch- and stylus-first** tool whose entire interaction model — full-screen canvas,
floating trays, two-finger undo, slide-to-adjust sliders — exists because there is no
keyboard and no room for panels. Any Procreate-like app has to copy that interaction
model, not Photoshop's.

---

## 2. Document & canvas model

- **New canvas**: pick a preset (screen sizes, print sizes at 300 dpi, 4K, square,
  animation-friendly) or type custom width/height in px, mm, cm or inches, plus dpi.
- **Canvas limits**: a "maximum canvas size" is computed from the device's RAM; the
  app tells you the largest canvas you can create and how many layers that canvas
  allows.
- **Colour profiles**: sRGB, Display P3 (wide gamut) and CMYK for print. Wide-gamut
  colours are only saved losslessly in PSD/Procreate format.
- **Background colour layer**: the bottom "Background color" layer can be a solid
  colour or transparent.
- **Reference companion**: a floating reference window shows another canvas or the
  same canvas at a different zoom, for colour picking while painting.
- **Timelapse**: every canvas records a timelapse automatically; you can export the
  full recording or a 30-second version, at 1080p or 4K.
- **Gallery**: grid of canvases with name, size, last-modified, stackable "stacks"
  (folders), search, sort, duplicate, and drag-and-drop a canvas into another app
  (or into another canvas).
- **File format**: `.procreate` is a native layered format; PSD round-trips for
  interop; the app can also import PSD, PNG, JPG, TIFF, GIF and HEIC.

---

## 3. The brush engine (Brush Studio)

Roughly **200 brushes** ship in themed sets — Sketching, Inking, Drawing, Painting,
Artistic, Calligraphy, Lettering, Airbrushing, Spray Paints, Charcoals, Pastels,
Water, Textures, Abstract, Elements, Materials, Vintage. Each is a preset over one
parametric engine, exposed in **Brush Studio** with these tabs:

| Tab | Controls (as named in the UI) |
|---|---|
| **Shape** | Shape source (imported image or procedural), shape count/spread, rotation, "Scatter", "Count", "Randomised", "Azimuth", "Flip X/Y" |
| **Grain** | Grain texture (paper), scale, movement (Rolling / Texturized / Stamped to stroke), "Zoom", "Depth", "Blend mode" for grain |
| **Rendering** | Blend mode of the brush, **Opacity**, **Flow**, **Wet Mix** (pull / push / charge / attack / dilution), "Orientation", "Uniform Blending" |
| **Dynamics** | Per-axis response curves for **Pressure**, **Tilt**, **Azimuth**, **Velocity**, **Speed** — each with a draggable curve and "Jitter" |
| **Apple Pencil** | Pressure/tilt/azimuth enable, "Size" / "Opacity" shortcuts for the Pencil's double-tap and squeeze |
| **Stroke Path** | **Spacing**, **Jitter**, **StreamLine Amount**, **StreamLine Pressure**, **Taper** start/end, "Tip" / "Shape" preview, **Stabiliser** |
| **Pencil** (per-brush) | Barrel-roll support, hover preview |
| **Material/Textured** | A second "material" layer of the brush (Texture / Wet / Material) used by painting brushes |
| **About this brush** | Name, author, reset/duplicate/delete, import/export `.brush` |

Engine behaviour worth copying:

- **Stamping with resampled spacing.** A stroke is a path resampled by spacing ×
  size; each sample stamps the shape. This is why pressure/speed can modulate size
  along a stroke without breaking.
- **Grain is anchored to the canvas**, not to the stamp: paper texture stays put
  while the brush moves over it ("Texturized" mode).
- **Flow vs. Opacity.** Flow controls paint deposited per stamp; Opacity caps the
  whole stroke. A low-opacity stroke must not darken where it overlaps itself —
  that requires accumulation in a scratch buffer and one composite at the end.
- **Wet mix / smudge-with-paint** for watercolour and oils, with charge, dilution
  and attack parameters.
- **StreamLine** (stabilisation): a first-order filter on the pointer position.
  Procreate recommends ~30–40 % for sketching; a per-brush value plus a global
  stabiliser both exist.
- **Taper** at stroke start/end driven by speed and pressure.
- **Dual brush**: two brushes composited (a second "material"), used for the
  textured painting brushes.

Related tools that share the engine: **Smudge** (samples and pushes existing paint),
**Erase** (any brush, with the same dynamics), **Fill / ColorDrop** (see §6).

---

## 4. Colour

- **Colour panel** with four layouts: **Disc** (HSB wheel + value/saturation square),
  **Classic** (hue/sat sliders + RGB/HEX fields), **Harmony** (complementary,
  split-complementary, analogous, triadic, tetradic — the wheels rotate the harmony
  and you pick within it), and **Palettes**.
- **Palettes**: built-in sets (e.g. "Default", "Skin tones", "Manga"), user palettes,
  palettes imported from `.swatches`/Adobe ASE, and palette sharing by file.
- **Recent colours** and the currently selected colour are always one tap away.
- **ColorDrop**: drag a colour from the swatch/palette and drop it on the canvas;
  a **threshold slider** appears and you adjust it live to control the flood fill's
  tolerance; dropping onto an existing filled area recolours it ("ColorDrop fill").
- **Eyedropper**: long-press anywhere on the canvas. In the colour panel, drag the
  eyedropper ring to sample.
- **Wide gamut**: Display P3 selection with an indicator when the colour is outside
  sRGB; CMYK mode for print workflows.

---

## 5. Layers

- Unlimited-ish layers (number depends on canvas size and RAM), each with a thumbnail,
  name, **opacity slider**, **blend mode**, and a visibility eye.
- **Blend modes**: about two dozen — Normal, Multiply, Screen, Overlay, Darken,
  Lighten, Color Dodge, Color Burn, Hard Light, Soft Light, Difference, Exclusion,
  Hue, Saturation, Color, Luminosity, plus linear/additive variants.
- **Groups**: nested layer stacks with their own blend mode, opacity and mask;
  collapsing/expanding; group-level *Pass Through* vs. isolated blending.
- **Alpha Lock**: paint only inside existing pixels (silhouette lock).
- **Clipping Mask**: the layer is masked by the alpha of the layer below.
- **Layer Mask**: a greyscale mask painted with any brush (painting black hides).
- **Selection → mask / cut / copy**: selections can become masks or new layers.
- **Layer actions**: duplicate, delete, merge down, merge all, flatten, clear,
  copy/paste, "Select layer content", reference layer (used by the fill tool),
  lock, and **drag to reorder**.
- **Transform**: free transform (move/scale/rotate) with snapping, plus **distort**
  and **warp** (mesh) modes; transform applies to a layer or a selection.
- **Reference layer**: one layer marked as the fill reference so line art can be
  filled on a layer below.
- **Layer count/limit indicator** and automatic "cannot add layer" messaging.

---

## 6. Painting tools beyond brushes

| Tool | Behaviour |
|---|---|
| **Smudge** | Samples colour under the finger and drags it; strength and brush shape reuse the brush engine |
| **Erase** | Any brush in erase mode, with pressure/tilt dynamics |
| **Fill / ColorDrop** | Flood fill with adjustable threshold; can fill a selection or a whole layer; samples the reference layer |
| **QuickShape** | Hold the pen still at the end of a stroke → the stroke snaps to a line, ellipse, rectangle or polygon; still editable by dragging |
| **Selections** | Freehand, rectangle, ellipse and **automatic** (colour-based) selection; add/subtract modes; invert, feather, save & load, "copy & paste" |
| **Text** | Text layers with system/imported fonts, size, tracking, leading, alignment, outline, opacity; text is rasterised on demand |
| **Guides** | Drawing guide (2D grid, isometric, 1/2/3-point perspective); **Symmetry** (vertical, horizontal, quadrant, radial with N segments); "Drawing Assist" makes strokes snap to the guide |
| **Clone / reference** | Reference window and layer for colour sampling |
| **Flip / rotate canvas** | Horizontal flip, rotate canvas freely with two fingers, reset |
| **3D painting** | Paint on a USDZ/OBJ model, export the textured model |

---

## 7. Gestures & shortcuts (the part that makes it feel native)

| Gesture | Action |
|---|---|
| Two-finger tap | **Undo** |
| Three-finger tap | **Redo** |
| Two-finger drag | Pan |
| Pinch / twist | Zoom / rotate canvas |
| Quick pinch (two-finger pinch then release without moving) | Fit canvas to screen |
| Four-finger tap | Toggle full-screen (hide UI) |
| Long-press canvas | Eyedropper |
| Hold at end of stroke | QuickShape |
| Drag a colour swatch onto canvas | ColorDrop |
| Slide a slider, then hold + slide with a second finger | Fine adjustment |
| Two-finger tap on a layer/slider | Reset to default |
| Tap a layer with two fingers | Clear layer? (varies) — layer-specific shortcuts |
| Apple Pencil double-tap / squeeze | Configurable (switch brush, eyedropper, undo…) |
| Keyboard shortcuts | Cmd+Z undo, Cmd+Shift+Z redo, bracket keys for brush size, space-drag to pan, etc. |

Also: a **Quick Menu** (four configurable shortcuts in a floating ring), and
"slide to adjust" on size/opacity sliders. Everything is reachable one-handed while
the other hand holds the stylus.

---

## 8. Animation Assist

Procreate treats frames as layers, which is the single most important design decision
to copy:

- **Animation Assist** turns the layer stack into a timeline: each layer becomes a
  frame; the panel shows frame thumbnails in a strip under the canvas.
- **Onion skins**: primary (immediately previous/next frame) and secondary (two
  frames away), with configurable colour and opacity.
- **Frame hold**: give a frame a duration in frames so it can be held on screen.
- **FPS**: 1–60 (default 12), set per canvas.
- **Playback modes**: loop, ping-pong, one-shot; background colour or transparent.
- **Export**: animated **MP4**, **HEVC**, **GIF**, or a PNG sequence; also the whole
  canvas as PSD with layers preserved.
- **Procreate Dreams** (separate app) extends this to a full timeline with keyframes,
  audio tracks and video import — out of scope for a painting app.

---

## 9. Export & sharing

- Formats: **`.procreate`** (native, layered), **PSD** (layered), **PDF**, **PNG**
  (with/without transparency), **JPEG**, **TIFF**, and animation **MP4 / HEVC / GIF**.
- Quality slider for JPEG, scale choices for all raster formats.
- Destinations: Files/iCloud Drive, Photos, AirDrop, any share-sheet app, drag & drop
  to another app, "share as layered PSD".
- Timelapse export as a video.
- Print: PDF export honours the canvas dpi.

---

## 10. Performance, stylus and platform

- **Valkyrie** render engine (Metal), 120 fps on ProMotion iPads; strokes drawn on a
  compositor layer and composited into the canvas at stroke end, so painting never
  blocks the display.
- **Apple Pencil**: pressure, tilt, azimuth, **hover** (Pencil 2 / Pro), barrel roll
  and squeeze (Pencil Pro), haptics; latency compensation and palm rejection.
- **Coalesced touch events** are consumed so fast strokes stay smooth.
- **Split View / Slide Over / Stage Manager**, external display, drag & drop between
  apps.
- **Accessibility**: VoiceOver, Switch Control, guided access.
- **Backup**: iCloud Drive and iTunes/Finder file sharing of `.procreate` files.

---

## 11. What that means for an Android app

Android equivalents of each platform capability:

| Procreate relies on | Android / WebView equivalent |
|---|---|
| Apple Pencil pressure/tilt/azimuth/hover | `MotionEvent` `AXIS_PRESSURE`, `AXIS_TILT`, `AXIS_ORIENTATION`, `AXIS_DISTANCE`, `getToolType()`; in a WebView these arrive as `PointerEvent.pressure` / `pointerType === 'pen'` |
| Palm rejection | `getToolType() == TOOL_TYPE_FINGER` while a pen stroke is active; ignore and (optionally) hand to the gesture layer |
| 120 Hz compositing | Canvas 2D on a `SurfaceView`/WebView; keep per-frame work to one `drawImage` of a cached document bitmap |
| Metal / Valkyrie | Canvas 2D + `OffscreenCanvas`; or a native `Bitmap`/`RenderNode` path |
| iCloud / Files / share sheet | Storage Access Framework, app-private storage + `MediaStore` for export, `Intent.ACTION_SEND` |
| Cmd-Z keyboard shortcuts | Hardware keyboard events, plus on-screen buttons and gestures |
| Two-/three-finger gestures | `PointerEvent` multi-pointer tracking |

---

## 12. Where **Qalam** lands against this spec

Legend: **✔ shipped** · **≈ approximated** (works, simpler than Procreate) ·
**✘ not in v1.0** (roadmap).

| Area | Procreate | Qalam 1.0 |
|---|---|---|
| Canvas presets + custom size | ✔ | ✔ 6 presets (square, portrait, landscape, HD, 1280² animation, story) |
| Colour profiles | sRGB / P3 / CMYK | ✘ sRGB only |
| Brush sets | ~200 in 17 sets | ≈ 11 hand-tuned brushes (pen, inking, monoline, 2 pencils, marker, airbrush, charcoal, watercolour, 2 erasers) |
| Brush Studio | full parametric editor | ≈ fixed per-brush parameters (hardness, grain, flow, spacing, pressure size/alpha, velocity, taper, jitter, scatter, streamline) — engine exposes them, UI does not edit them |
| Flow vs. Opacity (no self-darkening) | ✔ | ✔ scratch-buffer accumulation, one composite per flush |
| StreamLine / stabiliser | per brush + global | ✔ per-brush streamline |
| Taper, pressure size/alpha, velocity | ✔ | ✔ |
| Tilt / azimuth / barrel roll | ✔ | ✘ (pressure + speed only) |
| Smudge / wet mix | ✔ | ≈ watercolour/airbrush use soft accumulation; no smudge tool |
| Eraser | any brush | ✔ two dedicated erasers |
| Fill / ColorDrop | ✔ threshold UI | ✘ |
| Layers | groups, alpha lock, clipping, masks | ✔ add/duplicate/merge/clear/delete/reorder, rename, opacity, 16 blend modes; ✘ groups, alpha lock, clipping, masks |
| Layer count | RAM-bound | ✔ lazy cels, memory readout, no artificial cap |
| Selections | freehand/auto/rect/ellipse + actions | ✘ |
| Transform | free/distort/warp | ✘ (flip canvas + rotate view instead) |
| QuickShape | line/ellipse/rect/polygon | ✔ line + ellipse, with brush dynamics replayed through the shape |
| Drawing guides / symmetry | grid, isometric, perspective, symmetry | ✘ |
| Text tool | ✔ | ✘ |
| Colour UI | disc / classic / harmony / palettes | ≈ disc wheel + value/sat, 24 swatches + 12 recents, HEX entry |
| Eyedropper | long-press | ✔ long-press (and a dedicated tool button) |
| Undo / redo gestures | 2-finger tap / 3-finger tap | ✔ both |
| Pan / pinch / rotate | ✔ | ✔ two-pointer pan, pinch, twist |
| Fit canvas | quick pinch | ✔ menu item ("Zoom to fit") |
| Full-screen toggle | 4-finger tap | ✘ UI is already minimal |
| Quick Menu | ✔ | ✘ |
| Timelapse recording | ✔ | ✘ |
| Animation | frames-as-layers, onion, hold, fps 1–60, loop/ping-pong/once | ≈ frames on a timeline, onion skin (auto-on), fps 6–30, loop toggle, playback; ✘ frame hold, ping-pong, secondary onion colours |
| Export images | PNG/JPEG/TIFF/PDF/PSD | ≈ PNG into `Pictures/Qalam` via `MediaStore`; ✘ JPEG, PDF, PSD, TIFF |
| Export animation | MP4 / HEVC / GIF / PNG sequence | ≈ GIF (with own quantiser + LZW encoder, 50/100/150 % scale, loop count); ✘ MP4 |
| Gallery | stacks, search, sort, drag between canvases | ≈ grid with thumbnail, name, size, delete, rename; autosave |
| Storage | iCloud + Files | ✔ on-device (IndexedDB, localStorage fallback), autosave, survives app restarts |
| Stylus | pressure + tilt + azimuth + hover | ✔ pressure (and pointer-type palm rejection); ✘ tilt/hover |
| Latency handling | 120 fps compositor | ≈ `requestAnimationFrame` render loop, coalesced pointer events, stroke drawn into the cel with a dirty-rect undo snapshot |
| Offline | ✔ (iPad app) | ✔ no network at all |
| Account / telemetry | none | none |

### Design decisions taken from the analysis

1. **Frames are layers.** Animation reuses the layer stack (`Doc.frames[]` of cels per
   layer), so painting, onion skin and playback all run through the same code path.
2. **Gestures beat buttons.** Two-finger undo, three-finger redo, pinch/rotate, and
   long-press eyedropper are implemented exactly as Procreate defines them — they are
   muscle memory, not features.
3. **A stroke is one undo step.** Pixel snapshots of a dirty rectangle, not full
   layer copies, so a 2048² canvas can hold 36 undo steps cheaply.
4. **Flow ≠ opacity.** Translucent brushes accumulate into a scratch buffer and are
   composited once, otherwise watercolour and airbrush turn muddy.
5. **No modal "brush studio" in v1.0.** Eleven well-tuned presets cover sketching,
   inking, painting and erasing; the engine already has the parameters, so an editor
   is UI work, not engine work.
6. **Export must not need a server.** GIF is encoded on-device (median-cut
   quantiser + LZW); PNG is produced from a canvas and handed to Android's media
   store through a small JavaScript bridge.

### Deliberately out of scope for 1.0

Layers groups and masks, selections, text, symmetry/perspective guides, PSD/MP4
export, timelapse, 3D painting, cloud sync, and per-brush editing UI. Each is listed
with its implementation notes in `docs/qalam.md` §Roadmap.
