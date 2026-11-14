# surface.mound — Regolith mound with buried drones

> Generated from assets/manifests/asset-manifest.json. Do not edit by hand.

- **Status:** awaiting-generation
- **Tier:** 1
- **Attach as reference images:** `style.anchor`, `drone.builder`, `assets/reference/surface-reference.png`
- **Save the result as:** `assets/incoming/surface.mound.png`
- **Final location (after processing):** `assets/art/surface/mound.png`
- **Used for:** The mound and the two dormant drones buried on the surface (Drones #02 and #03).
- **Notes:** SCENARIO section 4: 'regolith mound, 2 buried dormant drones'. Attach drone.builder as a second reference so the drones look the same.

## Prompt

```text
Create a pixel-art game asset: Regolith mound with buried drones.

SURFACE REFERENCE: One attached image is the design reference of the team for the Mars surface (habitat with a central airlock dome and lit windows, dish, lattice radio tower with a red beacon, boxy yellow-white rover, red-brown mountains, violet-pink dusty sky). Copy its design language, shapes and palette for everything on the surface; do not copy it pixel for pixel, and follow the brief below where it differs.

STYLE: Use the attached reference image(s) as the exact style guide: same palette, pixel size, outline, lighting and level of detail. Make this asset in the same style.

WHAT IT SHOWS: A low heap of loose rust-coloured regolith. Frame 1: two small round robots are half-buried, you see a dusty solar panel and an arm of each sticking out, their lights are dark. Frame 2: the same two drones sitting on the heap, brushed clean, small lights glowing.

VIEW: Side view.
LAYOUT: Two equal cells side by side, the same heap shape in both.
FRAMES: a strict grid of 1 columns x 2 rows of EQUAL cells that exactly fill the image, each cell with the proportions 72:24. Read the cells left to right, then top to bottom. Cell contents in order: mound with two buried drones, only their tops showing | same mound, drones dug free and sitting on top, panels pointing up. Any unused trailing cells stay empty background.
BACKGROUND: transparent, or solid #FF00FF if transparency is not available.

STYLE RULES: Pixel art with crisp, un-blurred pixels. Flat orthographic side view (like an ant farm): no perspective, no vanishing point. A limited palette of about 24 colours shared by the whole game. One-pixel dark outline on characters and props, none on terrain. Light comes from the upper left. Warm Martian oranges, rusts and butterscotch for the world; cream and white for hulls; cyan (#00E5FF) and amber (#FFB000) for ASTRA and electronics; Martian Orange #FF6B35 only for highlights. Friendly and tidy for children aged 7-12: rounded corners, no gore, no frightening shapes.
AVOID: No text or letters inside the image (the game draws all text), no watermarks, no anti-aliased gradients, no photorealism, no 3D rendering, no perspective, no extra characters unless asked.

OUTPUT: 3:2 landscape image, 1536x1024. Logical size in the game: 144 x 24 px; the image is scaled down later, so keep every shape chunky.
```
