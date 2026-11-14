# surface.airlock — Airlock dome

> Generated from assets/manifests/asset-manifest.json. Do not edit by hand.

- **Status:** awaiting-generation
- **Tier:** 1
- **Attach as reference images:** `style.anchor`
- **Save the result as:** `assets/incoming/surface.airlock.png`
- **Final location (after processing):** `assets/art/surface/airlock.png`
- **Used for:** The only door from the surface to the base, next to which the lander touches down. The astronaut leaves it at 20.0 s.
- **Notes:** Size follows the surface room rectangle (180 x 120 units = 36 x 24 px). Fallback label in code: AIRLOCK.

## Prompt

```text
Create a pixel-art game asset: Airlock dome.

STYLE: Use the attached reference image(s) as the exact style guide: same palette, pixel size, outline, lighting and level of detail. Make this asset in the same style.

WHAT IT SHOWS: A short white-and-grey cylindrical airlock dome with a rounded top, a round hatch, a small yellow warning stripe and a little status light. A thin layer of rust-coloured dust on the top and the foot. Frame 2 shows the same dome with the hatch open and warm light spilling out.

VIEW: Side view.
LAYOUT: Two equal cells side by side, the dome centred, its bottom on the same baseline in both.
FRAMES: 2 columns x 1 rows. Each cell 36 x 24 logical pixels. Order: closed | open (hatch swung up, warm light inside).
BACKGROUND: transparent, or solid #FF00FF if transparency is not available.

STYLE RULES: Pixel art with crisp, un-blurred pixels. Flat orthographic side view (like an ant farm): no perspective, no vanishing point. A limited palette of about 24 colours shared by the whole game. One-pixel dark outline on characters and props, none on terrain. Light comes from the upper left. Warm Martian oranges, rusts and butterscotch for the world; cream and white for hulls; cyan (#00E5FF) and amber (#FFB000) for ASTRA and electronics; Martian Orange #FF6B35 only for highlights. Friendly and tidy for children aged 7-12: rounded corners, no gore, no frightening shapes.
AVOID: No text or letters inside the image (the game draws all text), no watermarks, no anti-aliased gradients, no photorealism, no 3D rendering, no perspective, no extra characters unless asked.

OUTPUT: 2:1 (e.g. 2048x1024). Logical size in the game: 72 x 24 px (the image is generated larger and scaled down by a whole-number factor, so keep every shape chunky).
```
