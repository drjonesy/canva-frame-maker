# Changelog

All notable changes to Canva Frame Maker are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project has no releases yet, so entries are grouped by date.

## [Unreleased]

### 2026-09-06

#### Added

- **Rotation** (`utils/rotate.ts`, `RotatePanel.tsx`), two ways in:
  - **A rotate handle on the canvas**, floating 22px above the top edge of the
    selection box on a short stem. Drag it to turn the selection freely about
    the centre of that box; hold Shift to snap to 15°. The live angle is drawn
    beside the handle and the pivot shows as a ring while the drag lasts.
  - **A "Rotate" tab** beside Style and Move in the right column: ↺90°, ↻90°
    and 180° buttons, an angle field (with 15/30/45/90 presets) applied in
    either direction, and a **Pivot** toggle — **Selection**, so the shapes turn
    together as a block, or **Each object**, so they spin in place. The tab
    badge carries the current angle.
  - Shapes carry no rotation field — geometry is a bezier point list — so the
    turn is baked into the coordinates, as mirroring and resizing already do.
    Rotation is therefore always relative; there is no absolute angle to show.
  - A rectangle's `cornerRadiusPct` is dropped on any turn that is not a
    quarter circle. That field means "rebuild me as an axis-aligned rounded
    rect from my bounding box", which is only still true of a rectangle square
    to the axes; keeping it would have snapped a shape rotated 30° back upright
    the next time the radius slider or a resize handle moved. Because a drag
    always rotates the shapes the drag *started* with, sweeping back through a
    quarter turn brings the radius back.
  - Sub-paths turn with the outline, and handles turn with their anchors.
  - Locked shapes are skipped, the rule nudging already followed, and a
    selection holding nothing else gets no handle at all.
  - **Multi-shape selections now show their own box.** The dashed box on the
    canvas covers only the *active* shape, so with several picked there was
    nothing showing what a rotation would act on; a fainter dashed rect is now
    drawn around the whole selection whenever more than one shape is rotatable.
  - The resize box and its handles are hidden mid-rotation. An axis-aligned box
    swells and shrinks around a shape that is only turning, so the rotate chrome
    is drawn from the box and pivot frozen at the start of the drag instead of
    crawling around under a pointer that is merely sweeping an arc.

- **Mirror tool on the left rail** (`utils/mirror.ts`), shortcut `M`. Select a
  shape, pick a guide, and Mirror drops a reflected copy on the other side of
  it at the same distance — a shape 5px to the left of a vertical guide is
  copied 5px to its right. Works across horizontal and vertical guides alike;
  the axis comes from the guide, so there is nothing else to choose.
  - The whole selection is mirrored, not just one shape, and sub-paths are
    reflected with the outline — spreading them would have left a compound
    shape's holes on the near side of the guide while its outline crossed over.
  - Handles are reflected with their anchors and keep their roles: reflection
    maps each curve onto its mirror image without changing the order the points
    are visited, so the incoming handle is still the incoming one.
  - The copies become the selection while the guide stays selected, so a second
    shape can be mirrored across the same line without re-picking it. The
    originals do not move, and the whole thing is one undo step.
  - The target guide is the one picked most recently, falling back to the only
    guide on the canvas when there is exactly one — the same "no ambiguity to
    resolve" rule the Align to Guide controls follow, except that Mirror reads
    both axes from one guide rather than resolving each axis separately.
  - The button dims until a shape and a guide are both settled on, and its
    tooltip says what is still missing, or which guide it is about to reflect
    across. It is drawn with `aria-disabled` rather than `disabled`, since a
    genuinely disabled button swallows mouse events and the tooltip explaining
    why it is off would never open.
  - The icon — two right-angle triangles leaning away from each other across a
    gap — is drawn inline; Lucide has no icon of that shape. The left triangle
    is solid and the right one outlined, so it reads as an original and its
    copy rather than two equal shapes.

- **Arrow-key nudging, with a "Move" block in the right column**
  (`NudgePanel.tsx`, `utils/nudge.ts`). The arrow keys move the selection by a
  step you set in a number field (0.1–1000, default 1, with 1/5/10/50 presets);
  holding Shift moves 10× as far. The block also carries a direction pad, so the
  same move is available without the keyboard.
  - What moves follows what is selected: the anchor points when any are picked
    under Sub-Select, otherwise the selected shapes. A guide moves only when it
    was the last thing picked — the rule Delete already followed — and only
    along its own axis, so Left/Right does nothing to a horizontal guide.
  - Locked shapes stay put. They cannot be dragged on the canvas, so the
    keyboard must not be a way around the lock.
  - A run of presses collapses into one undo step: history is recorded only
    when the previous nudge was more than 700ms ago, so walking a shape across
    the canvas costs one entry rather than one per key repeat.
  - The arrow keys are `preventDefault`ed, which stops the workspace scrolling
    under them, and — like every other shortcut — do nothing while an input,
    textarea or contenteditable has focus, so the step field itself still works.
- `translateShape` is now exported from `utils/alignment.ts`; the nudge helpers
  reuse it instead of repeating the point/handle offset maths.

- **A tabbed block at the top of the right column** (`TabbedSection.tsx`)
  holding **Align | Merge | Guides**. The tab strip is the block's header: the
  chevron beside it collapses the body, and picking a tab while collapsed opens
  it again. Only the active tab is mounted, so the two it hides cost nothing in
  scroll height. Each tab keeps the note that used to sit in its section header
  ("Select 2+", "New Object", the guide count) above its body.
- `AlignTab.tsx` and `MergeTab.tsx` — the align grid and the boolean operations,
  split out of `PropertiesPanel.tsx` so each can be a tab body. `GuidesPanel`
  now renders its body alone; `PropertiesPanel` is just the Appearance block.

- **Rulers along the top and left edges** (`Rulers.tsx`), marked in canvas
  coordinates and following pan and zoom. Tick spacing is picked from the zoom
  level — the smallest "nice" step whose on-screen spacing clears 64px — so the
  labels stay readable and never collide at any zoom. A rose marker on each
  ruler tracks the pointer. Toggle with `R`.
- **Guides.** Drag out of a ruler to place one: the top ruler gives a
  horizontal guide, the left ruler a vertical one. Drag a guide back onto its
  own ruler (or off the workspace) to remove it. Guides are drawn inside the
  artboard's SVG so they share its transform exactly, and are only clickable
  under the Select tool, where they cannot steal a pen click or an anchor grab.
  Toggle visibility with `G`.
- **Snapping to guides while dragging a shape.** Either edge or the centre of
  the moved bounding box latches onto the nearest guide within 6 screen pixels
  — the threshold is in screen space, so the pull feels the same at every zoom
  — and the guide it caught turns rose while held. Off switchable in the panel.
- **A "Rulers & Guides" block in the right column** (`GuidesPanel.tsx`) holding
  the three toggles, the guide list (each position editable as a number, each
  deletable) and the align controls.
- **Centre guides in one click.** "Vert", "Horz" and "Both" drop guides down
  the middle of the canvas; pressing again selects the guide that is already
  there rather than stacking a second one on the same pixel.
- **Align the selection to a guide** — left / centre / right against a vertical
  guide, top / middle / bottom against a horizontal one — plus "Centre
  Selection on Guides", which puts the selection's centre on the guide cross.
  Each shape moves on its own, the rule `alignShapes` already followed. The
  target guide is the selected one, falling back to the only guide on that axis
  when there is exactly one, so the common case needs no click at all.
- **Delete now knows what you picked last.** With both a shape and a guide
  selected it acts on whichever was chosen most recently, so a stale guide
  selection cannot swallow a Delete meant for the shape, or the reverse.

Guides are chrome: they never reach the export, and they are deliberately kept
out of the shape history, so undoing a move does not resurrect a guide you
meant to clear.

#### Changed

- **"Appearance" renamed to "Style", and Style and Move are now a second tabbed
  block** below the Align/Merge/Guides one, using the same `TabbedSection`. They
  were two separate collapsible blocks stacked in the column. The Move tab keeps
  its `N px` step readout as the tab badge.
  - `PropertiesPanel` and `NudgePanel` are now plain tab bodies — neither wraps
    itself in a `CollapsibleSection` any more (`LayersPanel` still does).
  - With no selection the Style tab shows "Select a shape to change its fill,
    stroke and opacity." rather than rendering nothing; as a collapsible block
    it could disappear entirely, but a tab that opens onto blank space reads as
    broken.
- **The Move block's direction pad is gone.** The four arrow buttons have been
  removed, leaving the step-size field, its presets and the note; the arrow keys
  themselves are unchanged. `NudgePanel` no longer takes `onNudge` — `App` keeps
  `handleNudge` for the key handler.
- **"Align to Guide" moved from the Guides tab to the Align tab**, so both kinds
  of alignment sit together. The Align tab now carries two labelled blocks —
  **Align Objects** (the six-button grid, still needing 2+ shapes) and **Align
  to Guide** (the guide grid, its X/Y readout and "Centre Selection on Guides")
  — so it is clear which row aligns shapes to each other and which aligns them
  to a guide. `resolveActiveGuide` moved to `AlignTab.tsx` with the controls;
  `GuidesPanel` lost its `hasSelection`, `onAlignToGuide` and `onCenterOnGuides`
  props and is now toggles, centre guides and the guide list only.
- **The Align tab's "Select 2+" badge is gone.** It sat above the whole tab but
  only ever described the object-align row; with that row now labelled, the
  badge would have wrongly implied the guide controls need two shapes as well.
- **Layers moved to the bottom of the right column**, below Guides and the
  properties blocks, so the panels that act on the current selection sit
  nearest the top.
- **Shorter panel titles in the right column**: "Rulers & Guides" → "Guides",
  "Align Objects" → "Align", "Combine Shapes" → "Merge" — now the three tab
  labels.
- **The drawing SVG is stretched to cover the visible area, not just the
  artboard.** An SVG root only hit-tests inside its own box, so a guide running
  off the artboard would paint — overflow is visible — but refuse to be
  grabbed. The viewBox is offset by the same amount as the box, so every
  coordinate inside still means exactly what it did before.
- **Drags now end on the window rather than on the canvas.** Releasing the
  button off the edge of the workspace used to leave the shape — and would have
  left a guide — stuck to the cursor.

#### Fixed

- **Canvas drags are now undoable.** Moving, resizing, rotating or editing
  points and handles on the canvas changed the shapes without ever pushing a
  history entry, so Ctrl+Z skipped straight past them to the last panel action.
  Each drag now records one entry, on its first movement rather than on mouse
  down — clicking a shape without moving it leaves no empty step behind.
- **The Align Objects row appeared to show the same three icons twice.** The
  horizontal buttons (left/center/right) used Lucide's *text*-align icons, while
  the vertical buttons (top/middle/bottom) used `AlignStartVertical` /
  `AlignCenterVertical` / `AlignEndVertical` — which depict alignment along the
  *horizontal* axis, so both trios read as left/center/right. Left/center/right
  now use the vertical-bar object-align icons and top/middle/bottom the
  horizontal-bar `…Horizontal` set. All six buttons keep their behaviour.

### 2026-09-05

#### Added

- **Vertical tool rail down the left edge** (`ToolRail.tsx`). Select, Sub-Select,
  Pen and Preset Shapes moved out of the centre of the top header into an
  icon-only rail; the shape presets open as a flyout so the rail stays one icon
  wide. Every button keeps its tooltip and gained an `aria-label`, since the
  visible text labels are gone.
- **Zoom by scroll wheel**, anchored so the canvas point under the pointer stays
  put. There was previously no wheel handler at all — the header buttons were
  the only way to zoom. The listener is registered natively with
  `{ passive: false }` because React routes wheel events through a passive
  listener, where `preventDefault()` is ignored and the page scrolls instead.
- **Copy and paste selected shapes** with Ctrl/Cmd+C and Ctrl/Cmd+V. Pasting
  offsets each copy by 25px and steps further on every repeat, selects what it
  pasted, and is undoable. The buffer lives in the app rather than the system
  clipboard, which could only carry a serialised form no other app could use.
  The browser's own copy/paste is only suppressed when there was actually a
  selection to act on.
- **Tool shortcut keys**: `Q` Select, `W` Sub-Select, `E` Pen. (Select was
  originally `V`, briefly `S`.)
- **Anchor points are drawn on the trace preview**, sized relative to the image
  so they stay small at any scale.
- **The "What Counts as the Picture" control now explains itself.** It reports
  what it is acting on for the loaded image — opacity when there is an alpha
  channel, light and dark when there is not — and warns when the image is a
  crisp-edged cutout and the slider can therefore barely move the outline. On
  the test blade only 1.6% of pixels are part-transparent, which is why sweeping
  the slider from 1 to 254 shifts the outline by about one pixel.
- **Tooltips on the tool rail**, showing each tool's name, its shortcut as a key
  cap, and a short description. Drawn rather than left to the browser's `title`
  attribute, which is slow to appear, cannot be styled, and gives the shortcut
  no visual separation from the name. They also open on keyboard focus, and each
  button carries `aria-keyshortcuts`.
- **Zoom keyboard shortcuts**: Ctrl/Cmd + `=` to zoom in, `-` to zoom out, and
  `0` to fit.
- **Background eraser in the image trace dialog.** "Remove Background" turns the
  preview into a click-to-erase surface: a scanline flood fill clears the
  contiguous region matching the clicked colour within an adjustable tolerance,
  and repeated clicks remove more areas. The alpha edge is feathered so tracing
  does not key off a hard staircase. Reset restores the original. Runs entirely
  locally with no new dependencies. The outline is re-traced from the erased
  image, so an opaque background can now be separated from the subject — which
  the alpha/luminance threshold alone could not do.
- **Drag-and-drop import of SVG-wrapped bitmaps.** Design tools (Affinity,
  Illustrator) export placed images as a `<image>` inside an `<svg>`. These have
  no vector geometry, so the app used to dead-end on "No vector shapes found in
  SVG." Such files now fall through to the image tracer: `svgToRasterSource()`
  pulls the embedded data-URI pixels directly, or rasterizes the document if
  there is no single embedded image.
- **`<use>` and `<defs>` support in SVG import.** References are resolved (with
  recursion guards) and definition-only elements are no longer imported as
  visible shapes.
- **Arc (`A`) command support in SVG import**, plus `viewBox` origin offsets and
  spec-correct `rx`/`ry` mirroring on `<rect>`.
- **Interior holes from tracing** are kept as `subPaths`, and the `fillHoles`
  trace option — previously declared but never read — now works.

#### Changed

- **Raster tracing now uses vtracer** (`vectortracer`, MIT, wrapping the
  `visioncortex` core in WebAssembly) instead of the hand-rolled Moore-neighbour
  tracer. Straight edges stay straight, corners stay crisp, and tracing runs in
  under a millisecond.
- **SVG path parsing now uses `svgpath`** instead of a hand-rolled regex parser.
- **Traced outlines are cleaned up automatically.** vtracer fits a spline
  through the entire contour, so straight edges came back as chains of
  barely-curved segments. Segments flat to within 0.8px are converted to real
  lines and the redundant mid-line anchors are dropped. On the test blade this
  cut 59 anchors to 21 without moving the outline.
- **Anchor points are typed honestly on import.** Every curved anchor used to be
  marked `rounded`, which in this editor means "keep the handles collinear" — so
  genuine corners were rounded off as soon as they were edited. Anchors are now
  classified by comparing their tangents: `straight`, `rounded` (smooth), or
  `break` (corner).
- **Right side is now one scrolling column of collapsible blocks.** Layers and
  the properties panel were two separate fixed-width columns; they are now a
  single 320px `<aside>` that scrolls, holding Layers, Align Objects, Combine
  Shapes and Appearance as blocks that each collapse from their header
  (`CollapsibleSection.tsx`). A collapsed body is unmounted rather than hidden,
  so a long layer list stops contributing to the column's scroll height, and the
  layer list itself is capped so it scrolls inside its own block instead of
  pushing the other sections away.
- **The canvas artboard is gone.** The white page rectangle, its 1px border and
  its drop shadow have been removed; shapes now sit directly on the grey
  workspace with its dot grid. The artboard container remains only as the
  coordinate frame that pan and zoom act on.
- **Export is cropped to the artwork.** With no artboard there is no canvas box
  to export against, so the SVG and PDF exports now measure the bounding box of
  the visible shapes, translate the path to the origin and size the document to
  match. Hidden layers are excluded from both the geometry and the bounds.
- **Rectangle corners keep their radius when the shape is resized.** Scaling a
  rectangle used to stretch its corner arcs along with the box, so a fully
  rounded square pulled out into an oval. The rectangle is now rebuilt at the
  new size with the same radius, giving a longer rounded rectangle. Every other
  shape still scales freely — a stretched circle is still an ellipse.
- **Rectangle gained a Corner Radius slider**, defaulting to 0 and measured as
  a percentage rather than in pixels. 100% is half the shorter side — the point
  at which adjacent corners meet — so "fully rounded" sits at the same place on
  every rectangle instead of at a maximum that moved with the shape's size.
  Moving the slider rebuilds the rectangle from its current bounding box, so the
  radius survives moves and resizes instead of snapping back to where the shape
  started.
- **New shapes default to a stroke width of 0.** Presets, pen shapes, traced
  outlines and boolean results all start unstroked; the Stroke Width control
  already allowed 0 so it needed no change.
- **Boolean operation icons replaced with the pathfinder set** — Lucide's
  `SquaresUnite`, `SquaresSubtract`, `SquaresIntersect` and `SquaresExclude` for
  Group, Subtract, Intersect and Xor, and `SquareSplitHorizontal` for Divide.
  Colours and sizing are unchanged.
- **Hold Shift while dragging a resize handle to scale proportionally.** One
  scale factor drives both axes; the edge opposite the handle stays pinned, and
  an edge handle (which has no opposite corner on the other axis) grows that
  axis about the centre. The maths lives in `utils/resize.ts` so it can be
  exercised on its own.
- **Canvas anchor points shrank to match the trace preview.** They were large
  enough to overlap each other on a dense outline. The visible dot is now less
  than half its old radius, with a transparent circle behind it holding the
  click target at its previous size, so the smaller dot is no harder to grab.
- **"Edge / Alpha Threshold" renamed to "What Counts as the Picture"**, moved
  below Curve Smoothing, and reworded in plain language: "Slide right to keep
  only the solid parts. Slide left to also keep the faint, see-through edges."
- **Curve Smoothing now defaults to 1** (was 4), so a traced outline starts
  close to the source instead of pre-softened.
- **The trace preview draws compound paths correctly**, using the full shape
  path with `fill-rule="evenodd"` rather than the outer contour alone, so holes
  show as holes.
- **Select and Sub-Select now use the standard arrow pair.** Select is a solid
  arrow and Sub-Select the same arrow left hollow, the convention every vector
  editor uses. Sub-Select previously borrowed a sliders icon.
- **"Fit to Screen" actually fits.** It used to set zoom to a hardcoded 0.65
  regardless of canvas or viewport size; it now measures the viewport and scales
  the artboard to fit with margin.
- **Export now emits a single object with no background.** The SVG export was
  producing a decorative placeholder scene (sky gradient, sun, clouds, grass)
  behind the frame, and one `<path>` per shape. It now writes one compound path
  with `fill-rule="evenodd"`, no background rect and no stroke, so Canva imports
  the outline as a single frame. The PDF export's border was likewise dropped.
  `generateCanvaPlaceholderSvg()` is still present if the placeholder turns out
  to be needed for Canva to recognise the frame.
- Build target raised to `es2022` (the WASM glue uses top-level await). Browser
  baseline is now Chrome 89+, Firefox 89+, Safari 15+.

#### Fixed

- **Duplicating a compound shape no longer leaves its holes behind.** The layer
  duplicate spread `subPaths` by reference, so a shape with holes kept them at
  the original position while its outline moved. Duplicate and paste now share
  one clone helper that rebuilds sub-paths with fresh ids and the same offset.
- **Selecting a shape no longer fakes a stroke on it.** The renderer forced
  `Math.max(strokeWidth, 2)` while selected, so a shape with no stroke still
  drew a 2px one — and since a new shape is selected immediately, a 0 default
  would have looked broken. Selection is now its own outline path at a constant
  on-screen width, leaving the shape's stroke exactly as the data says.
- **Resize handles now show a cursor matching the direction they resize.** All
  eight used `cursor-nwse-resize`; corners now use `nwse`/`nesw` as appropriate
  and edge handles use `ns`/`ew`. The cursor also holds its shape for the whole
  drag rather than reverting once the pointer leaves the handle.
- **Modifier chords no longer switch tools.** Bare-letter shortcuts were matched
  without checking modifiers, so Cmd/Ctrl+A and Cmd/Ctrl+P (and, once Select
  moved to `S`, Cmd/Ctrl+S) changed the active tool as a side effect of the
  browser shortcut. Any chord carrying Cmd, Ctrl or Alt is now left alone.
- **Shortcuts no longer fire while typing in a textarea or contenteditable.**
  Only `<input>` was excluded before.
- **Choosing Select by keyboard now clears the point sub-selection**, which
  clicking the Select tool already did. Both routes share one handler.
- **Cursor flicker when hovering anchor points and control handles.** The dots
  use `hover:scale-125`, and Tailwind v4 emits the standalone `scale` property.
  On SVG elements `transform-box` defaults to `view-box`, so the dot scaled
  about the viewBox origin and leapt away from the pointer — ending the hover,
  snapping back, and flickering. Dots now scale about their own centre via
  `transform-box: fill-box`.
- **Contour tracing failed on any shape touching the top edge of the image.**
  The Moore-neighbour walk seeded its backtrack direction inside the shape, so
  it closed after three pixels and produced a two-point contour. (Superseded by
  the move to vtracer, but fixed first.)
- `transform` attributes were ignored entirely by SVG import, so any shape an
  editor nested inside a `<g transform="…">` imported at the wrong position,
  rotation and scale.
- `width="100%"` on an `<svg>` was parsed as 100 pixels.

#### Removed

- **The "Rounded Rectangle" preset**, folded into Rectangle now that the corner
  radius is adjustable.
- **The nested "Shape Appearance" heading** inside the Appearance block, which
  repeated the section header directly above it.
- **Canvas Dimensions panel.** With no artboard and an export cropped to the
  artwork, the width/height fields and the crop-vs-scale toggle no longer
  affected anything a user could see.
- **"Reduce Points" button.** It warped shapes as it removed anchors. The
  automatic straightening pass above addresses the same problem without
  distorting the outline.
- The hand-rolled raster tracer, Douglas-Peucker simplifier and Moore-neighbour
  contour walk (superseded by vtracer; still in git history).

#### Dependencies

- Added `vectortracer` 0.1.2 (pinned, MIT), `svgpath` ^2.6.0 (MIT), and
  `vite-plugin-wasm` ^3.6.0 (dev, MIT).
- Security review of the WASM binary: its wasm-bindgen import surface is limited
  to console logging, `ImageData` accessors and typed-array helpers — no
  network, storage, DOM or filesystem access.
