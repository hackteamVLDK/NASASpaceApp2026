# surface.solar-panels — Solar panels — dusty and clean

> Generated from assets/manifests/asset-manifest.json. Do not edit by hand.

- **Status:** received
- **Tier:** 1
- **Attach as reference images:** `style.anchor`, `assets/reference/surface-reference.png`
- **Save the result as:** `assets/incoming/surface.solar-panels.png`
- **Final location (after processing):** `assets/art/surface/solar-panels.png`
- **Used for:** The panels' dust level is a gauge in the simulation (solarClean). Three frames show it.
- **Notes:** SCENARIO section 4: 'dust-covered solar panels'. The game cross-fades between frames according to solarClean. Same colour world as the surface reference (red-brown ground, cream-grey hardware).

## Prompt

```text
Create a pixel-art game asset: Solar panels — dusty and clean.

SURFACE REFERENCE: One attached image is the design reference of the team for the Mars surface (habitat with a central airlock dome and lit windows, dish, lattice radio tower with a red beacon, boxy yellow-white rover, red-brown mountains, violet-pink dusty sky). Copy its design language, shapes and palette for everything on the surface; do not copy it pixel for pixel, and follow the brief below where it differs.

STYLE: Use the attached reference image(s) as the exact style guide: same palette, pixel size, outline, lighting and level of detail. Make this asset in the same style.

WHAT IT SHOWS: A row of four tilted solar panels on short grey stands, wired together with a cable. Frame 1: covered in thick rust-coloured dust, the blue barely visible. Frame 2: dust wiped away in diagonal streaks. Frame 3: clean, dark blue cells with a bright highlight.

VIEW: Side view, panels tilted towards the sun on the left.
LAYOUT: Three equal cells side by side, same stands in each, same baseline.
FRAMES: a strict grid of 1 columns x 3 rows of EQUAL cells that exactly fill the image, each cell with the proportions 84:24. Read the cells left to right, then top to bottom. Cell contents in order: thick dust (almost hidden) | half cleaned (streaks) | clean and shiny blue. Any unused trailing cells stay empty background.
BACKGROUND: transparent, or solid #FF00FF if transparency is not available.

STYLE RULES: Pixel art with crisp, un-blurred pixels. Flat orthographic side view (like an ant farm): no perspective, no vanishing point. A limited palette of about 24 colours shared by the whole game. One-pixel dark outline on characters and props, none on terrain. Light comes from the upper left. Warm Martian oranges, rusts and butterscotch for the world; cream and white for hulls; cyan (#00E5FF) and amber (#FFB000) for ASTRA and electronics; Martian Orange #FF6B35 only for highlights. Friendly and tidy for children aged 7-12: rounded corners, no gore, no frightening shapes.
AVOID: No text or letters inside the image (the game draws all text), no watermarks, no anti-aliased gradients, no photorealism, no 3D rendering, no perspective, no extra characters unless asked.

OUTPUT: 1:1 image, 1024x1024. Logical size in the game: 252 x 24 px; the image is scaled down later, so keep every shape chunky.
```
