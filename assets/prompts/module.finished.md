# module.finished — Right wing, finished — four frames

> Generated from assets/manifests/asset-manifest.json. Do not edit by hand.

- **Status:** awaiting-generation
- **Tier:** 1
- **Attach as reference images:** `style.anchor`, `module.unfinished`, `vehicle.rover`
- **Save the result as:** `assets/incoming/module.finished.png`
- **Final location (after processing):** `assets/art/modules/finished.png`
- **Used for:** The same four modules after the crew and the drones have built them.
- **Notes:** Attach module.unfinished as a second reference so the frames line up. Switching on what each module is for: docs/GAME_DESIGN.md.

## Prompt

```text
Create a pixel-art game asset: Right wing, finished — four frames.

STYLE: Use the attached reference image(s) as the exact style guide: same palette, pixel size, outline, lighting and level of detail. Make this asset in the same style.

WHAT IT SHOWS: The same four rooms, same girders and layout as the unfinished frames, now with cream walls, warm lights and equipment. Workshop: a workbench with tools, a 3D printer, shelves of parts. Research & Comms Lab: a microscope bench, sample boxes, a wall of screens and a radio console with a dish dial. Battery & Heating: rows of battery cabinets with small amber lights and a glowing orange heater unit. Rover Garage: a wide bay with a six-wheeled rover parked on a ramp and a tool rack.

VIEW: Side view cutaway of one room each.
LAYOUT: A strict grid of 2 columns x 2 rows of equal cells, identical positions to module.unfinished so one can fade into the other.
FRAMES: 2 columns x 2 rows. Each cell 120 x 54 logical pixels. Order: Workshop | Research & Comms Lab | Battery & Heating | Rover Garage (with the rover inside).
BACKGROUND: opaque.

STYLE RULES: Pixel art with crisp, un-blurred pixels. Flat orthographic side view (like an ant farm): no perspective, no vanishing point. A limited palette of about 24 colours shared by the whole game. One-pixel dark outline on characters and props, none on terrain. Light comes from the upper left. Warm Martian oranges, rusts and butterscotch for the world; cream and white for hulls; cyan (#00E5FF) and amber (#FFB000) for ASTRA and electronics; Martian Orange #FF6B35 only for highlights. Friendly and tidy for children aged 7-12: rounded corners, no gore, no frightening shapes.
AVOID: No text or letters inside the image (the game draws all text), no watermarks, no anti-aliased gradients, no photorealism, no 3D rendering, no perspective, no extra characters unless asked.

OUTPUT: 2:1 (e.g. 2048x1024). Logical size in the game: 240 x 108 px (the image is generated larger and scaled down by a whole-number factor, so keep every shape chunky).
```
