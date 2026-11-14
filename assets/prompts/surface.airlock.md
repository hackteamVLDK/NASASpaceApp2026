# surface.airlock — Surface habitat with the Airlock dome

> Generated from assets/manifests/asset-manifest.json. Do not edit by hand.

- **Status:** received
- **Tier:** 1
- **Attach as reference images:** `style.anchor`, `assets/reference/surface-reference.png`
- **Save the result as:** `assets/incoming/surface.airlock.png`
- **Final location (after processing):** `assets/art/surface/airlock.png`
- **Used for:** The only door from the surface to the base, next to which the lander touches down: a long low surface habitat with the AIRLOCK dome in its middle. The astronaut leaves through it at 20.0 s.
- **Notes:** SCENARIO section 4: 'Airlock dome'. Drawn as the central dome of a small surface habitat, as in the team's reference. The simulation's airlock room is 180 x 120 units (36 x 24 px); the habitat is wider (about 60 px) and its centre sits on x 960. Fallback label in code: AIRLOCK.

## Prompt

```text
Create a pixel-art game asset: Surface habitat with the Airlock dome.

SURFACE REFERENCE: One attached image is the design reference of the team for the Mars surface (habitat with a central airlock dome and lit windows, dish, lattice radio tower with a red beacon, boxy yellow-white rover, red-brown mountains, violet-pink dusty sky). Copy its design language, shapes and palette for everything on the surface; do not copy it pixel for pixel, and follow the brief below where it differs.

STYLE: Use the attached reference image(s) as the exact style guide: same palette, pixel size, outline, lighting and level of detail. Make this asset in the same style.

WHAT IT SHOWS: A long, low surface habitat designed exactly like the one in the attached SURFACE REFERENCE image: cream-and-grey modules with rounded roofs, a larger central AIRLOCK DOME with a round hatch door, a smaller dome on each side, rows of small lit orange-yellow windows, a ramp, little vents and pipes, a thin layer of rust-coloured dust on the roofs and at the foot. Frame 1: the hatch closed. Frame 2: the same habitat with the central hatch open and warm light spilling out.

VIEW: Side view.
LAYOUT: Two equal cells side by side, the habitat centred, its bottom on the same baseline in both.
FRAMES: a strict grid of 1 columns x 2 rows of EQUAL cells that exactly fill the image, each cell with the proportions 60:24. Read the cells left to right, then top to bottom. Cell contents in order: closed | open (airlock hatch open in the central dome, warm light spilling out). Any unused trailing cells stay empty background.
BACKGROUND: transparent, or solid #FF00FF if transparency is not available.

STYLE RULES: Pixel art with crisp, un-blurred pixels. Flat orthographic side view (like an ant farm): no perspective, no vanishing point. A limited palette of about 24 colours shared by the whole game. One-pixel dark outline on characters and props, none on terrain. Light comes from the upper left. Warm Martian oranges, rusts and butterscotch for the world; cream and white for hulls; cyan (#00E5FF) and amber (#FFB000) for ASTRA and electronics; Martian Orange #FF6B35 only for highlights. Friendly and tidy for children aged 7-12: rounded corners, no gore, no frightening shapes.
AVOID: No text or letters inside the image (the game draws all text), no watermarks, no anti-aliased gradients, no photorealism, no 3D rendering, no perspective, no extra characters unless asked.

OUTPUT: 3:2 landscape image, 1536x1024. Logical size in the game: 120 x 24 px; the image is scaled down later, so keep every shape chunky.
```
