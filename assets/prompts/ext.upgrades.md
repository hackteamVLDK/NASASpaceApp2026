# ext.upgrades — Surface upgrades

> Generated from assets/manifests/asset-manifest.json. Do not edit by hand.

- **Status:** awaiting-generation
- **Tier:** 2
- **Attach as reference images:** `style.anchor`, `surface.airlock`
- **Save the result as:** `assets/incoming/ext.upgrades.png`
- **Final location (after processing):** `assets/art/surface/upgrades.png`
- **Used for:** What the player adds over the airlock dome: regolith berm, water-bag lining, extra solar array.
- **Notes:** Needs the Workshop to be finished.

## Prompt

```text
Create a pixel-art game asset: Surface upgrades.

STYLE: Use the attached reference image(s) as the exact style guide: same palette, pixel size, outline, lighting and level of detail. Make this asset in the same style.

WHAT IT SHOWS: Three variants of the airlock dome, each with one upgrade: a smooth bank of reddish regolith heaped against and over it; translucent blue water bags stacked on top and sides; a second row of shiny blue solar panels next to it.

VIEW: Side view.
LAYOUT: Three equal cells side by side, same baseline.
FRAMES: 3 columns x 1 rows. Each cell 72 x 24 logical pixels. Order: regolith berm heaped around the dome | water-bag lining (blue bags stacked on the dome) | extra solar array (a second row of clean panels).
BACKGROUND: transparent, or solid #FF00FF if transparency is not available.

STYLE RULES: Pixel art with crisp, un-blurred pixels. Flat orthographic side view (like an ant farm): no perspective, no vanishing point. A limited palette of about 24 colours shared by the whole game. One-pixel dark outline on characters and props, none on terrain. Light comes from the upper left. Warm Martian oranges, rusts and butterscotch for the world; cream and white for hulls; cyan (#00E5FF) and amber (#FFB000) for ASTRA and electronics; Martian Orange #FF6B35 only for highlights. Friendly and tidy for children aged 7-12: rounded corners, no gore, no frightening shapes.
AVOID: No text or letters inside the image (the game draws all text), no watermarks, no anti-aliased gradients, no photorealism, no 3D rendering, no perspective, no extra characters unless asked.

OUTPUT: 3:1 or the widest the tool offers. Logical size in the game: 216 x 24 px (the image is generated larger and scaled down by a whole-number factor, so keep every shape chunky).
```
