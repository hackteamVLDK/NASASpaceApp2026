# crew.eva — Astronaut, EVA suit — sprite sheet

> Generated from assets/manifests/asset-manifest.json. Do not edit by hand.

- **Status:** awaiting-generation
- **Tier:** 1
- **Attach as reference images:** `style.anchor`, `crew.indoor`
- **Save the result as:** `assets/incoming/crew.eva.png`
- **Final location (after processing):** `assets/art/crew/eva.png`
- **Used for:** The crew outside and in the airlock: walking, cleaning panels, digging ice, carrying, climbing; also the astronaut leaving the lander.
- **Notes:** Attach crew.indoor as a second reference so the proportions match.

## Prompt

```text
Create a pixel-art game asset: Astronaut, EVA suit — sprite sheet.

STYLE: Use the attached reference image(s) as the exact style guide: same palette, pixel size, outline, lighting and level of detail. Make this asset in the same style.

WHAT IT SHOWS: The same astronaut wearing a bulky white Mars surface suit: round helmet with a dark gold-tinted visor, life-support backpack, thick gloves and boots. A stripe on the upper arm, a band on the helmet rim and the backpack panel are flat pure cyan #00FFFF (replaced in the game with each crew member's colour). About 36 pixels tall inside a 40x44 cell. Slightly dusty boots.

VIEW: Side view, character facing right.
LAYOUT: A sprite sheet: a strict grid of 6 columns x 3 rows of equal cells. One pose per cell, centred, feet on the same baseline 2 pixels above the bottom of the cell.
FRAMES: a strict grid of 4 columns x 5 rows of EQUAL cells that exactly fill the image, each cell with the proportions 40:44. Read the cells left to right, then top to bottom. Cell contents in order: idle x2, walk x4 | walk x2, working with a hand tool at chest height x4 | digging with a shovel x2, carrying a box x2, climbing a ladder x2. Any unused trailing cells stay empty background.
BACKGROUND: transparent, or solid #FF00FF if transparency is not available.

STYLE RULES: Pixel art with crisp, un-blurred pixels. Flat orthographic side view (like an ant farm): no perspective, no vanishing point. A limited palette of about 24 colours shared by the whole game. One-pixel dark outline on characters and props, none on terrain. Light comes from the upper left. Warm Martian oranges, rusts and butterscotch for the world; cream and white for hulls; cyan (#00E5FF) and amber (#FFB000) for ASTRA and electronics; Martian Orange #FF6B35 only for highlights. Friendly and tidy for children aged 7-12: rounded corners, no gore, no frightening shapes.
AVOID: No text or letters inside the image (the game draws all text), no watermarks, no anti-aliased gradients, no photorealism, no 3D rendering, no perspective, no extra characters unless asked.

OUTPUT: 2:3 portrait image, 1024x1536. Logical size in the game: 240 x 132 px; the image is scaled down later, so keep every shape chunky.
```
