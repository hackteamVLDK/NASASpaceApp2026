# ui.icons — HUD icons

> Generated from assets/manifests/asset-manifest.json. Do not edit by hand.

- **Status:** awaiting-generation
- **Tier:** 2
- **Attach as reference images:** `style.anchor`
- **Save the result as:** `assets/incoming/ui.icons.png`
- **Final location (after processing):** `assets/art/ui/icons.png`
- **Used for:** Gauges, jobs and statuses in the HUD.
- **Notes:** Includes icons for the jobs in src/sim/constants.js.

## Prompt

```text
Create a pixel-art game asset: HUD icons.

STYLE: Use the attached reference image(s) as the exact style guide: same palette, pixel size, outline, lighting and level of detail. Make this asset in the same style.

WHAT IT SHOWS: A set of 32 simple, bold, readable 16x16 pixel icons, white-and-cream with one accent colour each, thick shapes, instantly clear to a seven-year-old.

VIEW: Flat front view.
LAYOUT: A strict grid of 8 columns x 4 rows of equal cells.
FRAMES: 8 columns x 4 rows. Each cell 16 x 16 logical pixels. Order: row 1: oxygen, water, food, power, battery, solar panel, dust, thermometer | row 2: jobs: build, life support, clean panels, explore, research, farm, rest, shelter | row 3: statuses: sleeping, eating, exercise, warning, alert, radiation, storm, grounded | row 4: drone awake, drone asleep, wrench, lock (unfinished), check, star, star empty, speaker.
BACKGROUND: transparent, or solid #FF00FF if transparency is not available.

STYLE RULES: Pixel art with crisp, un-blurred pixels. Flat orthographic side view (like an ant farm): no perspective, no vanishing point. A limited palette of about 24 colours shared by the whole game. One-pixel dark outline on characters and props, none on terrain. Light comes from the upper left. Warm Martian oranges, rusts and butterscotch for the world; cream and white for hulls; cyan (#00E5FF) and amber (#FFB000) for ASTRA and electronics; Martian Orange #FF6B35 only for highlights. Friendly and tidy for children aged 7-12: rounded corners, no gore, no frightening shapes.
AVOID: No text or letters inside the image (the game draws all text), no watermarks, no anti-aliased gradients, no photorealism, no 3D rendering, no perspective, no extra characters unless asked.

OUTPUT: 2:1 (e.g. 2048x1024). Logical size in the game: 128 x 64 px (the image is generated larger and scaled down by a whole-number factor, so keep every shape chunky).
```
