# surface.garage — Surface Garage & Airlock - outdoor hangar, two states

> Generated from assets/manifests/asset-manifest.json. Do not edit by hand.

- **Status:** integrated
- **Tier:** 1
- **Attach as reference images:** `style.anchor`, `surface.airlock`, `assets/reference/surface-reference.png`, `assets/incoming/module.unfinished.png`, `assets/incoming/module.finished.png`
- **Save the result as:** `assets/incoming/surface.garage.png`
- **Final location (after processing):** `assets/art/surface/garage.png`
- **Used for:** The standalone surface Garage & Airlock, unfinished and finished, with space for separately animated drones and Rover.
- **Notes:** PROPOSAL exterior detailing approved by the user's request for outdoor art. SCENARIO reconciliation lists Garage airlock as a surface structure; placement, names, unlocks and gameplay stay unchanged. Built-in image_gen generated the raw two-state reference. Processing crops source rectangles (36,46,1376,491) and (36,565,1376,491), nearest-neighbour scales each to 120x54, thresholds alpha at 110 and quantises to 24 colours. The legacy fourth underground garage cells remain only for older rendering; new surface art has no baked Rover and needs no patchBakedRover correction. Raw reference has slightly different state silhouettes; processed bounds and ground levels are aligned. User approved runtime integration. Atlas loads the processed sheet; campaign-world draws its two states and preserves the transparent exterior outline. Checked in Edge at unbuilt, 50 percent construction and finished states with separate drones and Rover. Not marked final.

## Prompt

```text
Create a pixel-art game asset: Surface Garage & Airlock - outdoor hangar, two states.

SURFACE REFERENCE: One attached image is the design reference of the team for the Mars surface (habitat with a central airlock dome and lit windows, dish, lattice radio tower with a red beacon, boxy yellow-white rover, red-brown mountains, violet-pink dusty sky). Copy its design language, shapes and palette for everything on the surface; do not copy it pixel for pixel, and follow the brief below where it differs.

STYLE: Use the attached reference image(s) as the exact style guide: same palette, pixel size, outline, lighting and level of detail. Make this asset in the same style.

WHAT IT SHOWS: Two aligned states of one ABOVE-GROUND Mars Rover Garage & Airlock. Match the existing module.unfinished and module.finished pixel art and the rounded cream-grey surface habitat reference. A broad barrel-vault roof with curved slate-steel ribs, rust-orange joints, riveted cream insulation panels, a large empty central parking bay, a compact utility airlock on the right, and a low level threshold with amber parking markings. Top: exposed curved steel ribs, partial cream roof and side panels, no lights. Bottom: complete cream exterior cladding, warm amber lamp above the bay and a small cyan console on the right. Keep the same roof silhouette, supports and ground level in both states so construction can crossfade. The central bay stays empty for the separately animated Rover and drones. No painted vehicles, drones, people, terrain, sand piles, sky, scenery, text, letters, numbers or watermark. Crisp chunky pixels, dark outlines, upper-left light, cream, slate and amber palette.

VIEW: Flat orthographic side elevation; no perspective or visible receding floor.
LAYOUT: One column, two equal cells; unfinished above finished. Identical exterior bounds and aligned feet. Each building nearly fills a 120:54 cell; transparency follows its curved outline.
FRAMES: a strict grid of 1 columns x 2 rows of EQUAL cells that exactly fill the image, each cell with the proportions 120:54. Cell contents in order: unfinished rounded steel frame with partial roof panels | finished cream-clad rounded hangar with warm lamp and empty bay. Any unused trailing cells stay empty background.
BACKGROUND: transparent outside the building silhouette; opaque dark bay interior.

STYLE RULES: Pixel art with crisp, un-blurred pixels. Flat orthographic side view (like an ant farm): no perspective, no vanishing point. A limited palette of about 24 colours shared by the whole game. One-pixel dark outline on characters and props, none on terrain. Light comes from the upper left. Warm Martian oranges, rusts and butterscotch for the world; cream and white for hulls; cyan (#00E5FF) and amber (#FFB000) for ASTRA and electronics; Martian Orange #FF6B35 only for highlights. Friendly and tidy for children aged 7-12: rounded corners, no gore, no frightening shapes.
AVOID: No text or letters inside the image (the game draws all text), no watermarks, no anti-aliased gradients, no photorealism, no 3D rendering, no perspective, no extra characters unless asked.

OUTPUT: 1:1 image, 1024x1024. Logical size in the game: 120 x 108 px; the image is scaled down later, so keep every shape chunky.
```
