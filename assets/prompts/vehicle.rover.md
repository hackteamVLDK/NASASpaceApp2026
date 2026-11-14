# vehicle.rover — Rover

> Generated from assets/manifests/asset-manifest.json. Do not edit by hand.

- **Status:** received
- **Tier:** 2
- **Attach as reference images:** `style.anchor`, `assets/reference/surface-reference.png`
- **Save the result as:** `assets/incoming/vehicle.rover.png`
- **Final location (after processing):** `assets/art/vehicles/rover.png`
- **Used for:** Parked in the Rover Garage; drives out when someone goes exploring.
- **Notes:** The Explore job needs the Rover Garage to be finished. Design follows the team's surface reference (yellow-white boxy rover).

## Prompt

```text
Create a pixel-art game asset: Rover.

SURFACE REFERENCE: One attached image is the design reference of the team for the Mars surface (habitat with a central airlock dome and lit windows, dish, lattice radio tower with a red beacon, boxy yellow-white rover, red-brown mountains, violet-pink dusty sky). Copy its design language, shapes and palette for everything on the surface; do not copy it pixel for pixel, and follow the brief below where it differs.

STYLE: Use the attached reference image(s) as the exact style guide: same palette, pixel size, outline, lighting and level of detail. Make this asset in the same style.

WHAT IT SHOWS: A small boxy four-wheeled Mars rover designed like the one at the right of the attached SURFACE REFERENCE image: a rounded cream-white and yellow body with a dark window strip, a roof rack with a light bar, chunky dark wheels with grey hubs, a mast camera, a little dust on the wheels. Facing right.

VIEW: Side view, facing right.
LAYOUT: Three equal cells side by side, wheels on the same baseline.
FRAMES: a strict grid of 1 columns x 3 rows of EQUAL cells that exactly fill the image, each cell with the proportions 60:30. Read the cells left to right, then top to bottom. Cell contents in order: parked | driving A | driving B (wheels turned). Any unused trailing cells stay empty background.
BACKGROUND: transparent, or solid #FF00FF if transparency is not available.

STYLE RULES: Pixel art with crisp, un-blurred pixels. Flat orthographic side view (like an ant farm): no perspective, no vanishing point. A limited palette of about 24 colours shared by the whole game. One-pixel dark outline on characters and props, none on terrain. Light comes from the upper left. Warm Martian oranges, rusts and butterscotch for the world; cream and white for hulls; cyan (#00E5FF) and amber (#FFB000) for ASTRA and electronics; Martian Orange #FF6B35 only for highlights. Friendly and tidy for children aged 7-12: rounded corners, no gore, no frightening shapes.
AVOID: No text or letters inside the image (the game draws all text), no watermarks, no anti-aliased gradients, no photorealism, no 3D rendering, no perspective, no extra characters unless asked.

OUTPUT: 2:3 portrait image, 1024x1536. Logical size in the game: 180 x 30 px; the image is scaled down later, so keep every shape chunky.
```
