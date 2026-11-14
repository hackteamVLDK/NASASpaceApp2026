# lander.craft — Mars lander

> Generated from assets/manifests/asset-manifest.json. Do not edit by hand.

- **Status:** awaiting-generation
- **Tier:** 1
- **Attach as reference images:** `style.anchor`
- **Save the result as:** `assets/incoming/lander.craft.png`
- **Final location (after processing):** `assets/art/lander/craft.png`
- **Used for:** Descends in the cutscene (10.0-16.0 s) and stays next to the airlock dome.
- **Notes:** SCENARIO section 4: 'Mars Lander', '4 bottom thrusters'. Size is a PROPOSAL (about 5 m wide). Fallback label in code: LANDER.

## Prompt

```text
Create a pixel-art game asset: Mars lander.

STYLE: Use the attached reference image(s) as the exact style guide: same palette, pixel size, outline, lighting and level of detail. Make this asset in the same style.

WHAT IT SHOWS: A stocky white-and-grey crewed Mars lander like a rounded cone with a flat bottom, four rocket thrusters on its underside, four folding legs, a small round window, a side hatch and a thin orange stripe. Slightly scorched at the bottom. Frame 1: legs folded against the body. Frame 2: legs extended and planted, hatch ajar.

VIEW: Side view.
LAYOUT: Two equal cells side by side, the lander centred; in frame 2 the feet touch the bottom of the cell.
FRAMES: 2 columns x 1 rows. Each cell 96 x 88 logical pixels. Order: in flight: body with 4 bottom thrusters, no legs deployed | landed: legs on the ground, hatch on the side.
BACKGROUND: transparent, or solid #FF00FF if transparency is not available.

STYLE RULES: Pixel art with crisp, un-blurred pixels. Flat orthographic side view (like an ant farm): no perspective, no vanishing point. A limited palette of about 24 colours shared by the whole game. One-pixel dark outline on characters and props, none on terrain. Light comes from the upper left. Warm Martian oranges, rusts and butterscotch for the world; cream and white for hulls; cyan (#00E5FF) and amber (#FFB000) for ASTRA and electronics; Martian Orange #FF6B35 only for highlights. Friendly and tidy for children aged 7-12: rounded corners, no gore, no frightening shapes.
AVOID: No text or letters inside the image (the game draws all text), no watermarks, no anti-aliased gradients, no photorealism, no 3D rendering, no perspective, no extra characters unless asked.

OUTPUT: 2:1 (e.g. 2048x1024). Logical size in the game: 192 x 88 px (the image is generated larger and scaled down by a whole-number factor, so keep every shape chunky).
```
