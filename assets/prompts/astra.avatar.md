# astra.avatar — ASTRA 6.7 — animated avatar

> Generated from assets/manifests/asset-manifest.json. Do not edit by hand.

- **Status:** received
- **Tier:** 1
- **Attach as reference images:** `style.anchor`
- **Save the result as:** `assets/incoming/astra.avatar.png`
- **Final location (after processing):** `assets/art/astra/avatar.png`
- **Used for:** The guide's portrait in the ASTRA panel (left side of the screen). Animates while she speaks; the mood prop changes her colours and expression.
- **Notes:** SCENARIO section 2: 'animated holographic/digital avatar portrait (cyan/amber waveforms or friendly geometric AI core that animates while speaking)'. Mood values (calm, cheerful, curious, alert) are a PROPOSAL; 'proud' is spare.

## Prompt

```text
Create a pixel-art game asset: ASTRA 6.7 — animated avatar.

STYLE: Use the attached reference image(s) as the exact style guide: same palette, pixel size, outline, lighting and level of detail. Make this asset in the same style.

WHAT IT SHOWS: A friendly station AI shown as a glowing geometric core: a round cyan-and-amber ring with a bright centre, two thin waveform lines either side that move when she speaks, and a few small orbiting dots. No face, no human features, no scary red eye. Calm: cyan. Cheerful: warm amber with a little sparkle. Curious: the ring tilted. Alert: amber-orange with a flashing ring. Clean, soft and trustworthy.

VIEW: Front view, centred, on a plain dark panel-coloured background.
LAYOUT: A strict grid of 4 columns x 2 rows of equal cells. The core centred in each cell.
FRAMES: a strict grid of 3 columns x 3 rows of EQUAL cells that exactly fill the image, each cell with the proportions 64:64. Read the cells left to right, then top to bottom. Cell contents in order: idle x2, speaking x2 | cheerful (amber-cyan, bright) | curious (head tilt, ring lifted) | alert (amber-orange, ring flashing) | proud (soft glow). Any unused trailing cells stay empty background.
BACKGROUND: transparent, or solid #FF00FF if transparency is not available.

STYLE RULES: Pixel art with crisp, un-blurred pixels. Flat orthographic side view (like an ant farm): no perspective, no vanishing point. A limited palette of about 24 colours shared by the whole game. One-pixel dark outline on characters and props, none on terrain. Light comes from the upper left. Warm Martian oranges, rusts and butterscotch for the world; cream and white for hulls; cyan (#00E5FF) and amber (#FFB000) for ASTRA and electronics; Martian Orange #FF6B35 only for highlights. Friendly and tidy for children aged 7-12: rounded corners, no gore, no frightening shapes.
AVOID: No text or letters inside the image (the game draws all text), no watermarks, no anti-aliased gradients, no photorealism, no 3D rendering, no perspective, no extra characters unless asked.

OUTPUT: 1:1 image, 1024x1024. Logical size in the game: 256 x 128 px; the image is scaled down later, so keep every shape chunky.
```
