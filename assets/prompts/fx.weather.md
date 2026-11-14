# fx.weather — Weather and storm overlays

> Generated from assets/manifests/asset-manifest.json. Do not edit by hand.

- **Status:** awaiting-generation
- **Tier:** 2
- **Attach as reference images:** `style.anchor`
- **Save the result as:** `assets/incoming/fx.weather.png`
- **Final location (after processing):** `assets/art/fx/weather.png`
- **Used for:** Dust storm, dust devil and the solar storm sky.
- **Notes:** Used from level 2 on (the scenario so far has only the dust storm that put the drones to sleep).

## Prompt

```text
Create a pixel-art game asset: Weather and storm overlays.

STYLE: Use the attached reference image(s) as the exact style guide: same palette, pixel size, outline, lighting and level of detail. Make this asset in the same style.

WHAT IT SHOWS: Row 1: a translucent rusty-orange haze of blowing dust, and a thin swirling dust devil. Row 2: a green-violet shimmering glow across the sky, and thin pale streaks falling from the top, like rain of tiny particles. Chunky pixel style, no hard outlines, translucent.

VIEW: Side view.
LAYOUT: A strict grid of 4 columns x 2 rows of equal cells.
FRAMES: a strict grid of 2 columns x 4 rows of EQUAL cells that exactly fill the image, each cell with the proportions 64:48. Read the cells left to right, then top to bottom. Cell contents in order: dust storm haze layer x2 | dust devil swirl x2 | solar storm: sky aurora glow x2 | charged particles streaking down x2. Any unused trailing cells stay empty background.
BACKGROUND: transparent, or solid #FF00FF if transparency is not available.

STYLE RULES: Pixel art with crisp, un-blurred pixels. Flat orthographic side view (like an ant farm): no perspective, no vanishing point. A limited palette of about 24 colours shared by the whole game. One-pixel dark outline on characters and props, none on terrain. Light comes from the upper left. Warm Martian oranges, rusts and butterscotch for the world; cream and white for hulls; cyan (#00E5FF) and amber (#FFB000) for ASTRA and electronics; Martian Orange #FF6B35 only for highlights. Friendly and tidy for children aged 7-12: rounded corners, no gore, no frightening shapes.
AVOID: No text or letters inside the image (the game draws all text), no watermarks, no anti-aliased gradients, no photorealism, no 3D rendering, no perspective, no extra characters unless asked.

OUTPUT: 2:3 portrait image, 1024x1536. Logical size in the game: 256 x 96 px; the image is scaled down later, so keep every shape chunky.
```
