# minigame.drone-repair — DroneRepairMiniGame — modal art

> Generated from assets/manifests/asset-manifest.json. Do not edit by hand.

- **Status:** received
- **Tier:** 1
- **Attach as reference images:** `style.anchor`, `drone.builder`
- **Save the result as:** `assets/incoming/minigame.drone-repair.png`
- **Final location (after processing):** `assets/art/minigame/drone-repair.png`
- **Used for:** The modal that opens when the player clicks Drone #01: wipe Martian dust off the solar panel, then reconnect 2 coloured wires.
- **Notes:** SCENARIO section 5: 'wipe Martian dust off solar panel + reconnect 2 colored wires'. Wire colours (orange, cyan) are a PROPOSAL (src/flow/drone-repair.js). The dust layer on cell 1 is drawn separately by the game so it can be wiped away: ask for the clean panel as the base image if the tool allows.

## Prompt

```text
Create a pixel-art game asset: DroneRepairMiniGame — modal art.

STYLE: Use the attached reference image(s) as the exact style guide: same palette, pixel size, outline, lighting and level of detail. Make this asset in the same style.

WHAT IT SHOWS: Close-up cartoon views of a builder drone. Cells 1-2: the drone's solar panel, first caked in rust-red dust, then shiny blue. Cells 3-4: a small open hatch showing two sockets and two thick loose wires, one orange, one cyan, whose ends match the sockets' colours; in cell 4 both are plugged in and a green light glows.

VIEW: Front view, close-up.
LAYOUT: A strict grid of 2 columns x 2 rows of equal cells.
FRAMES: a strict grid of 2 columns x 2 rows of EQUAL cells that exactly fill the image, each cell with the proportions 160:90. Cell contents in order: panel under thick dust | panel clean and shiny | open drone access hatch with two loose wires (orange and cyan) and two sockets | the same hatch with both wires plugged in and the sockets glowing green. Any unused trailing cells stay empty background.
BACKGROUND: opaque.

STYLE RULES: Pixel art with crisp, un-blurred pixels. Flat orthographic side view (like an ant farm): no perspective, no vanishing point. A limited palette of about 24 colours shared by the whole game. One-pixel dark outline on characters and props, none on terrain. Light comes from the upper left. Warm Martian oranges, rusts and butterscotch for the world; cream and white for hulls; cyan (#00E5FF) and amber (#FFB000) for ASTRA and electronics; Martian Orange #FF6B35 only for highlights. Friendly and tidy for children aged 7-12: rounded corners, no gore, no frightening shapes.
AVOID: No text or letters inside the image (the game draws all text), no watermarks, no anti-aliased gradients, no photorealism, no 3D rendering, no perspective, no extra characters unless asked.

OUTPUT: 3:2 landscape image, 1536x1024. Logical size in the game: 320 x 180 px; the image is scaled down later, so keep every shape chunky.
```
