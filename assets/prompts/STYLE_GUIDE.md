# Style guide

> Generated from assets/manifests/asset-manifest.json. Do not edit by hand.

One style for the whole game. The binding source for what is in the world is
[SCENARIO.md](../../SCENARIO.md).

## How the style is fixed

1. Generate `style.anchor` (Style anchor — Ares-1 in one picture) in several variants and pick **one** as a team.
2. Save the chosen image as `assets/art/style/anchor.png`.
3. Generate everything else with it attached as the reference, using the prompt in this folder.

## Rules

Pixel art with crisp, un-blurred pixels. Flat orthographic side view (like an ant farm): no perspective, no vanishing point. A limited palette of about 24 colours shared by the whole game. One-pixel dark outline on characters and props, none on terrain. Light comes from the upper left. Warm Martian oranges, rusts and butterscotch for the world; cream and white for hulls; cyan (#00E5FF) and amber (#FFB000) for ASTRA and electronics; Martian Orange #FF6B35 only for highlights. Friendly and tidy for children aged 7-12: rounded corners, no gore, no frightening shapes.

## Never

No text or letters inside the image (the game draws all text), no watermarks, no anti-aliased gradients, no photorealism, no 3D rendering, no perspective, no extra characters unless asked.

## Sizes

- World: 1920 x 3200 units, 5 units per art pixel, so 384 x 640 px.
- Screen window: 384 x 216 px, scaled by a whole number.
- Module cell 120 x 54 px, shaft 24 x 54 px, crew frame 40 x 44 px, drone frame 28 x 24 px, tile 16 x 16 px, icon 16 x 16 px.
- Image tools do not give exact pixel art. Generate large, then scale down by a whole number and re-quantise the palette (see ASSET_PIPELINE.md).

## Colour

- Flat cyan `#00FFFF` on a crew sprite marks the part that is recoloured per person. Use it nowhere else.
- Solid magenta `#FF00FF` is the background when the tool cannot make a transparent image; it is removed afterwards.
- Martian Orange `#FF6B35` is the highlight colour of the intro (SCENARIO section 3). Intro background is `#05070A`.
