# terrain.tiles — Martian soil and sand — tile set

> Generated from assets/manifests/asset-manifest.json. Do not edit by hand.

- **Status:** awaiting-generation
- **Tier:** 1
- **Attach as reference images:** `style.anchor`
- **Save the result as:** `assets/incoming/terrain.tiles.png`
- **Final location (after processing):** `assets/art/terrain/tiles.png`
- **Used for:** Everything around and between the rooms: ground surface, soil under the ground line, rock, and the loose sand the unfinished right wing stands in.
- **Notes:** SCENARIO section 4: 'dark steel frames in sand' (right wing) and 'red Martian soil layers' (the camera pan slices through them).

## Prompt

```text
Create a pixel-art game asset: Martian soil and sand — tile set.

STYLE: Use the attached reference image(s) as the exact style guide: same palette, pixel size, outline, lighting and level of detail. Make this asset in the same style.

WHAT IT SHOWS: Seamless ground tiles for a cross-section of Martian soil. Rust and orange-brown regolith with faint horizontal layers, getting darker and more violet with depth. Small stones and a few larger rocks. Ice pockets are pale blue-white crystals surrounded by soil. Row 5 is lighter, finer, drifted sand. Each tile must tile seamlessly with the others in its row, left-right.

VIEW: Side view cross-section.
LAYOUT: A strict grid of 4 columns x 5 rows of equal square tiles with no gaps and no borders between them.
FRAMES: 4 columns x 5 rows. Each cell 16 x 16 logical pixels. Order: row 1: surface top with pebbles x3, surface top with a small rock | row 2: loose reddish regolith fill x4 (subtle strata) | row 3: compacted darker soil x2, soil with embedded stones x2 | row 4: bedrock x2, pale blue-white ice pocket in soil x2 | row 5: loose pale sand for the unfinished wing x4.
BACKGROUND: opaque.

STYLE RULES: Pixel art with crisp, un-blurred pixels. Flat orthographic side view (like an ant farm): no perspective, no vanishing point. A limited palette of about 24 colours shared by the whole game. One-pixel dark outline on characters and props, none on terrain. Light comes from the upper left. Warm Martian oranges, rusts and butterscotch for the world; cream and white for hulls; cyan (#00E5FF) and amber (#FFB000) for ASTRA and electronics; Martian Orange #FF6B35 only for highlights. Friendly and tidy for children aged 7-12: rounded corners, no gore, no frightening shapes.
AVOID: No text or letters inside the image (the game draws all text), no watermarks, no anti-aliased gradients, no photorealism, no 3D rendering, no perspective, no extra characters unless asked.

OUTPUT: 1:1 (e.g. 1024x1024). Logical size in the game: 64 x 80 px (the image is generated larger and scaled down by a whole-number factor, so keep every shape chunky).
```
