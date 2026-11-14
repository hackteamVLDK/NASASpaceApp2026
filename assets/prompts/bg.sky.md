# bg.sky — Martian sky and Jezero Crater rim

> Generated from assets/manifests/asset-manifest.json. Do not edit by hand.

- **Status:** received
- **Tier:** 1
- **Attach as reference images:** `style.anchor`, `assets/reference/surface-reference.png`
- **Save the result as:** `assets/incoming/bg.sky.png`
- **Final location (after processing):** `assets/art/bg/sky.png`
- **Used for:** The top zone of the world (Y 0 to 1050): what the player sees during the descent and at the surface.
- **Notes:** SCENARIO section 4: 'dusty orange Martian sky, distant Jezero Crater mountains'. The reference is a dusk sky; the scenario says dusty orange, so it is orange-pink fading to violet (daylight is needed for solar power). Used behind the lander during the descent (camera Y 400).

## Prompt

```text
Create a pixel-art game asset: Martian sky and Jezero Crater rim.

SURFACE REFERENCE: One attached image is the design reference of the team for the Mars surface (habitat with a central airlock dome and lit windows, dish, lattice radio tower with a red beacon, boxy yellow-white rover, red-brown mountains, violet-pink dusty sky). Copy its design language, shapes and palette for everything on the surface; do not copy it pixel for pixel, and follow the brief below where it differs.

STYLE: Use the attached reference image(s) as the exact style guide: same palette, pixel size, outline, lighting and level of detail. Make this asset in the same style.

WHAT IT SHOWS: A dusty Martian sky in the colours of the attached SURFACE REFERENCE image: warm orange-pink near the horizon, fading through dusty rose to violet at the top, with faint thin cloud streaks and a small pale sun. Two or three layers of distant jagged red-brown crater-rim mountains and mesas along the bottom edge, with a violet haze between the layers. The very bottom edge is flat, so the ground can be placed over it. No buildings.

VIEW: Side view, no perspective.
LAYOUT: One wide scene. Mountains only in the bottom 20%. The left and right edges must match so it can scroll sideways without a seam.
BACKGROUND: opaque.

STYLE RULES: Pixel art with crisp, un-blurred pixels. Flat orthographic side view (like an ant farm): no perspective, no vanishing point. A limited palette of about 24 colours shared by the whole game. One-pixel dark outline on characters and props, none on terrain. Light comes from the upper left. Warm Martian oranges, rusts and butterscotch for the world; cream and white for hulls; cyan (#00E5FF) and amber (#FFB000) for ASTRA and electronics; Martian Orange #FF6B35 only for highlights. Friendly and tidy for children aged 7-12: rounded corners, no gore, no frightening shapes.
AVOID: No text or letters inside the image (the game draws all text), no watermarks, no anti-aliased gradients, no photorealism, no 3D rendering, no perspective, no extra characters unless asked.

OUTPUT: 3:2 landscape image, 1536x1024. Logical size in the game: 384 x 210 px; the image is scaled down later, so keep every shape chunky. The picture will be cropped to a 384:210 band, so keep everything important in the middle band and let the top and bottom edges continue plainly.
```
