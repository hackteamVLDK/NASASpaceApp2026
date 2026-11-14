# lander.parachute — Parachute and thruster flames

> Generated from assets/manifests/asset-manifest.json. Do not edit by hand.

- **Status:** awaiting-generation
- **Tier:** 1
- **Attach as reference images:** `style.anchor`
- **Save the result as:** `assets/incoming/lander.parachute.png`
- **Final location (after processing):** `assets/art/lander/parachute.png`
- **Used for:** The red-and-white parachute (deploys, detaches at 13.2 s and drifts left) and the animated flames of the 4 bottom thrusters (from 14.0 s).
- **Notes:** SCENARIO section 4: 'red-and-white parachute', 'animated flame sprites'. The game draws one flame per thruster.

## Prompt

```text
Create a pixel-art game asset: Parachute and thruster flames.

STYLE: Use the attached reference image(s) as the exact style guide: same palette, pixel size, outline, lighting and level of detail. Make this asset in the same style.

WHAT IT SHOWS: Cells 1 and 2: a round parachute with alternating red and white wedge panels, thin lines gathering at the bottom; in cell 2 the canopy is crumpled and tilted, lines trailing. Cells 3 and 4: a downward rocket flame, white-yellow core, orange middle, red tips; the two frames differ in length and flicker so they animate.

VIEW: Side view.
LAYOUT: Four equal cells side by side. In cells 1-2 the lines gather at the bottom centre; in cells 3-4 the flame starts at the top centre.
FRAMES: 4 columns x 1 rows. Each cell 80 x 96 logical pixels. Order: parachute open, full canopy with lines | parachute collapsing, drifting | thruster flame frame A | thruster flame frame B.
BACKGROUND: transparent, or solid #FF00FF if transparency is not available.

STYLE RULES: Pixel art with crisp, un-blurred pixels. Flat orthographic side view (like an ant farm): no perspective, no vanishing point. A limited palette of about 24 colours shared by the whole game. One-pixel dark outline on characters and props, none on terrain. Light comes from the upper left. Warm Martian oranges, rusts and butterscotch for the world; cream and white for hulls; cyan (#00E5FF) and amber (#FFB000) for ASTRA and electronics; Martian Orange #FF6B35 only for highlights. Friendly and tidy for children aged 7-12: rounded corners, no gore, no frightening shapes.
AVOID: No text or letters inside the image (the game draws all text), no watermarks, no anti-aliased gradients, no photorealism, no 3D rendering, no perspective, no extra characters unless asked.

OUTPUT: 3:1 or the widest the tool offers. Logical size in the game: 320 x 96 px (the image is generated larger and scaled down by a whole-number factor, so keep every shape chunky).
```
