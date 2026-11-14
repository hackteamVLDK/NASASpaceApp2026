# drone.builder — Builder drone (Drone #01, #02, #03) — sprite sheet

> Generated from assets/manifests/asset-manifest.json. Do not edit by hand.

- **Status:** received
- **Tier:** 1
- **Attach as reference images:** `style.anchor`
- **Save the result as:** `assets/incoming/drone.builder.png`
- **Final location (after processing):** `assets/art/drone/builder.png`
- **Used for:** The sleeping drone the player must wake (red LED blinking at 1 Hz), the woken drone, and the drone helping to build.
- **Notes:** SCENARIO section 4: 'Drone #01 with a blinking red LED'; the LED blinks at 1 Hz from 22.0 s. Awake drones help build by daylight only (they are solar powered) - hence the night frames. Fallback label in code: DRONE_01. Drone shape is a PROPOSAL.

## Prompt

```text
Create a pixel-art game asset: Builder drone (Drone #01, #02, #03) — sprite sheet.

STYLE: Use the attached reference image(s) as the exact style guide: same palette, pixel size, outline, lighting and level of detail. Make this asset in the same style.

WHAT IT SHOWS: A small friendly builder robot: a rounded squat orange-and-white body about 22 pixels wide, a solar panel on its back, four short jointed arms with tool tips, two small caterpillar tracks, one round camera 'eye' and a single status LED on top. Dormant: slumped, the eye dark, the LED red. Awake: upright, the eye glowing cyan, the LED green. Same robot, same proportions in every cell.

VIEW: Side view.
LAYOUT: A sprite sheet: a strict grid of 6 columns x 4 rows of equal cells. One pose per cell, centred, tracks on the same baseline 1 pixel above the bottom of the cell.
FRAMES: a strict grid of 4 columns x 6 rows of EQUAL cells that exactly fill the image, each cell with the proportions 28:24. Read the cells left to right, then top to bottom. Cell contents in order: dormant, LED on | dormant, LED off | dormant covered in dust, LED on | dormant covered in dust, LED off | waking: LED turns green | waking: lights flicker on | awake idle, hovering x2 | rolling right x4 | building: welding arm down x3 + sparks x1 | carrying a girder x2 | working at night, powered down for the dark x2 | dug out of the sand, shaking dust off x4. Any unused trailing cells stay empty background.
BACKGROUND: transparent, or solid #FF00FF if transparency is not available.

STYLE RULES: Pixel art with crisp, un-blurred pixels. Flat orthographic side view (like an ant farm): no perspective, no vanishing point. A limited palette of about 24 colours shared by the whole game. One-pixel dark outline on characters and props, none on terrain. Light comes from the upper left. Warm Martian oranges, rusts and butterscotch for the world; cream and white for hulls; cyan (#00E5FF) and amber (#FFB000) for ASTRA and electronics; Martian Orange #FF6B35 only for highlights. Friendly and tidy for children aged 7-12: rounded corners, no gore, no frightening shapes.
AVOID: No text or letters inside the image (the game draws all text), no watermarks, no anti-aliased gradients, no photorealism, no 3D rendering, no perspective, no extra characters unless asked.

OUTPUT: 2:3 portrait image, 1024x1536. Logical size in the game: 168 x 96 px; the image is scaled down later, so keep every shape chunky.
```
