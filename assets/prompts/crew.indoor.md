# crew.indoor — Astronaut, indoor jumpsuit — sprite sheet

> Generated from assets/manifests/asset-manifest.json. Do not edit by hand.

- **Status:** awaiting-generation
- **Tier:** 1
- **Attach as reference images:** `style.anchor`
- **Save the result as:** `assets/incoming/crew.indoor.png`
- **Final location (after processing):** `assets/art/crew/indoor.png`
- **Used for:** The crew inside the base: every indoor activity of the simulation (idle, walk, work, eat, sleep, exercise, climb), plus the helmet-off moment of the cutscene.
- **Notes:** Simulation activities: sleep, walk, work, meal, exercise, free, shelter, recover. 'free', 'shelter' and 'recover' reuse idle and sitting. SCENARIO section 4: at 20.0 s the astronaut exits the airlock and removes the helmet. How many people arrive and who they are is an open question (docs/LEVELS.md, point 7), so for now one design recoloured per person.

## Prompt

```text
Create a pixel-art game asset: Astronaut, indoor jumpsuit — sprite sheet.

STYLE: Use the attached reference image(s) as the exact style guide: same palette, pixel size, outline, lighting and level of detail. Make this asset in the same style.

WHAT IT SHOWS: One friendly astronaut in a simple short-sleeved cream jumpsuit and soft boots, no helmet, short hair, neutral skin tone, about 35 pixels tall inside a 40x44 cell. The collar, shoulder stripe and belt are flat pure cyan #00FFFF (this colour is replaced in the game with each crew member's colour, so it must be flat and used nowhere else). Big readable head, simple dot eyes. Same character, same proportions and same size in every cell. The two helmet-off frames show the same jumpsuit with a white helmet being lifted off, then held under the arm.

VIEW: Side view, character facing right. The game mirrors it for facing left.
LAYOUT: A sprite sheet: a strict grid of 6 columns x 4 rows of equal cells. One pose per cell, centred horizontally, feet on the same baseline 2 pixels above the bottom of the cell (the sleeping pose lies on that baseline). Nothing crosses a cell border.
FRAMES: 6 columns x 4 rows. Each cell 40 x 44 logical pixels. Order: row 1: idle x2, walk x4 | row 2: walk x2 (completing the 6-frame cycle), work standing at a console x4 | row 3: sitting and eating x2, sleeping lying down x2, exercising on a bike x2 | row 4: climbing a ladder seen from the side x4, taking the helmet off x2.
BACKGROUND: transparent, or solid #FF00FF if transparency is not available.

STYLE RULES: Pixel art with crisp, un-blurred pixels. Flat orthographic side view (like an ant farm): no perspective, no vanishing point. A limited palette of about 24 colours shared by the whole game. One-pixel dark outline on characters and props, none on terrain. Light comes from the upper left. Warm Martian oranges, rusts and butterscotch for the world; cream and white for hulls; cyan (#00E5FF) and amber (#FFB000) for ASTRA and electronics; Martian Orange #FF6B35 only for highlights. Friendly and tidy for children aged 7-12: rounded corners, no gore, no frightening shapes.
AVOID: No text or letters inside the image (the game draws all text), no watermarks, no anti-aliased gradients, no photorealism, no 3D rendering, no perspective, no extra characters unless asked.

OUTPUT: 1:1 (e.g. 1024x1024). Logical size in the game: 240 x 176 px (the image is generated larger and scaled down by a whole-number factor, so keep every shape chunky).
```
