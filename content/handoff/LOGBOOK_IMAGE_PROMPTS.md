# Science Logbook image prompts (handoff)

For whoever owns `assets/` (currently Mykhailo). Source of truth: `SCENARIO.md` Section 8.1.
This file is a handoff only: it does not touch `assets/`. Please add these as entries in
`assets/manifests/asset-manifest.json` (status `awaiting-generation`) so `assets/prompts/` is
generated the usual way.

- **26 images:** 20 core cards (one image each) + 6 shared category images for the 38 bonus cards.
- **Attach as reference:** `style.anchor`, as for every other asset.
- **Save the result as:** `assets/incoming/<id>.png` (e.g. `assets/incoming/logbook.moxie.png`).
- **Logical size in the game:** 96 x 64 px card picture. Generate at 3:2 (e.g. 1536 x 1024) and
  scale down by a whole number, like the other assets.
- **Science accuracy:** each picture shows the real spacecraft or object named on its card.
  Keep the recognisable shapes described below; simplify everything else.

## Shared prompt frame

Every prompt below is inserted at `WHAT IT SHOWS` in this frame:

```text
Create a pixel-art game asset: Science Logbook card picture — <TITLE>.

STYLE: Use the attached reference image(s) as the exact style guide: same palette, pixel size, outline, lighting and level of detail. Make this asset in the same style.

WHAT IT SHOWS: <WHAT IT SHOWS>

VIEW: Flat, orthographic, no perspective; one clear subject in the centre, readable at small size.
LAYOUT: One single picture filling a 3:2 frame, with a simple background.
BACKGROUND: As described; no transparency needed.

STYLE RULES: Pixel art with crisp, un-blurred pixels. Flat orthographic side view (like an ant farm): no perspective, no vanishing point. A limited palette of about 24 colours shared by the whole game. One-pixel dark outline on characters and props, none on terrain. Light comes from the upper left. Warm Martian oranges, rusts and butterscotch for the world; cream and white for hulls; cyan (#00E5FF) and amber (#FFB000) for ASTRA and electronics; Martian Orange #FF6B35 only for highlights. Friendly and tidy for children aged 7-12: rounded corners, no gore, no frightening shapes.
AVOID: No text, letters, numbers or chemical formulas inside the image (the game draws all text), no watermarks, no anti-aliased gradients, no photorealism, no 3D rendering, no perspective, no extra characters unless asked, no logos or flags.

OUTPUT: 3:2 (e.g. 1536x1024). Logical size in the game: 96 x 64 px (keep every shape chunky).
```

## Core cards (20)

| ID | Card title | WHAT IT SHOWS |
|---|---|---|
| logbook.gravity | Mars Gravity | A small astronaut in a white suit jumping on dusty orange ground. Two dotted arcs show the jump: a low blue arc and a much higher orange arc, about two and a half times as high. Butterscotch sky. |
| logbook.no_shield | No Global Shield | Mars as a round red planet on black space. A stream of tiny yellow particle dots flows past from the left. A few small, separate cyan magnetic loops sit on the lower half of the planet's surface, like little umbrellas; there is no big bubble around the planet. |
| logbook.soil_blanket | Soil Blanket | Side-view cutaway: a small cream-white habitat module buried under thick layers of red-brown soil. Tiny yellow particle dots rain down from the sky and stop inside the soil layers, with only one or two reaching the module. |
| logbook.sunlight | Weaker Sunshine | The Sun on the left, Earth in the middle-left with wide bright sunbeams, Mars further right with thinner, dimmer sunbeams. Black space background. Planets small and round. |
| logbook.sol | One Sol | A Martian horizon of orange hills under a butterscotch sky. A dotted arc shows the Sun's path across the sky from left to right, with a small Sun drawn at three points (rising, high, setting). |
| logbook.cold_nights | Freezing Nights | NASA's Perseverance rover (six wheels, tall mast with a camera head, boxy white body) standing still at night on dark rocky ground. Dark navy sky with stars. A thin layer of pale frost on the rocks; small cyan cold-sparkle pixels in the air. |
| logbook.waste_heat | Waste Heat | Side-view cutaway of Perseverance's body: a finned cylinder (the power generator) at the back of the rover glowing warm orange, with orange pipes running from it through the body to a small electronics box. Dark night background. |
| logbook.global_storms | Planet-Wide Storms | Mars seen from space, half of the globe hidden under a thick, swirling butterscotch-orange dust haze that spreads around the planet. Black space background. |
| logbook.printed_wrench | Printed in Space | Inside the International Space Station: a small boxy 3D printer with a glowing print bed, and a freshly printed light-grey ratchet wrench floating just above it. Module wall with handrails and cables in the background. |
| logbook.sticky_dust | Sticky Dust | A close-up of a blue solar panel covered in reddish dust grains. A few grains have tiny cyan-blue sparks around them to show static charge. A small cleaning brush at the side. |
| logbook.perchlorates | Perchlorates | NASA's Phoenix lander (flat round deck, two round solar panels on either side, a robotic arm with a scoop) digging into pale reddish soil on flat polar ground with polygon cracks. A few white salt crystals sparkle in the scoop. |
| logbook.purple_garden | Purple Gardens | Rows of small green lettuce plants in trays under a strip of LED lights. The LEDs are red and blue, so the whole scene glows pink-purple. Plant leaves stay green. |
| logbook.sharp_rocks | Sharp Rocks | Close-up side view of one of Curiosity's aluminium rover wheels with zig-zag treads, rolling over pointy grey-brown rocks. Two small holes are visible in the thin metal skin between the treads. |
| logbook.space_salad | Space Salad | Inside the International Space Station: a small plant chamber glowing pink-purple, with red-leaf romaine lettuce growing in little pillows. A pair of astronaut hands holds up one red lettuce leaf. |
| logbook.surface_dose | A Day of Radiation | NASA's Curiosity rover (six wheels, tall mast, boxy body) on the Martian surface under a butterscotch sky. Thin diagonal streaks of tiny yellow particles fall from the sky onto the ground around it. A small radiation-badge icon (a simple rounded rectangle with a dot) in one corner. |
| logbook.slow_messages | Slow Messages | Mars on the left and Earth on the right on black space, small and far apart. A wavy dotted line of radio waves travels from a small dish on Mars towards Earth, with a few wave pulses still on the way. |
| logbook.marsquakes | Marsquakes | NASA's InSight lander (flat deck, two big round solar panels) on flat orange ground, with a small dome-shaped seismometer on the ground next to it. Gentle wavy lines ripple through the ground layers below. |
| logbook.moxie | Air From Mars | Side-view cutaway of NASA's Perseverance rover with a small box inside its body (MOXIE), drawn glowing amber. Thin streams of orange dots (Mars air) flow in on one side and small round cyan bubbles (oxygen) come out of the other side. |
| logbook.ingenuity | First Mars Helicopter | NASA's Ingenuity helicopter hovering just above orange sand: a small box body, two long stacked rotors, a small solar panel on top, and four thin springy legs. Its shadow on the ground below. |
| logbook.leopard_spots | Leopard Spots | Close-up of a reddish rock with a pale band through it. In the band, small light patches each ringed with a thin dark outline, like leopard spots. Simple, no microbes or creatures. |

## Category images for bonus cards (6)

| ID | Used by bonus cards | WHAT IT SHOWS |
|---|---|---|
| logbook.cat.sun | hydrogen_shield, dose_adds_up, fast_particles, cliff_shelter, flare_forecast, thirty_xrays | The Sun on black space with a bright flare loop rising from a darker active spot on its surface, and a stream of small yellow particles heading to the right. |
| logbook.cat.surface | storm_temps, wet_soil, brine, insight_dust, dust_hitchhikers, thin_air, wind_ripples, hidden_ice, ancient_lake, blue_sunset | A wide Martian landscape: orange hills, layered crater wall, rippled sand, scattered rocks, butterscotch sky. No spacecraft. |
| logbook.cat.iss | sleep_missions, water_98, too_much_co2, radiation_badge, no_showers, tea_leaves, strong_in_space | Inside the International Space Station: a long tube-shaped module with handrails, cables, storage bags and a small round window showing blue Earth. No people. |
| logbook.cat.rover | methane, rock_pages, sealed_samples, dust_devils, rover_marathon, last_storm, weather_station | A generic six-wheeled NASA-style Mars rover with a tall camera mast driving across orange ground, small tracks behind it. |
| logbook.cat.plants | green_air, stacked_farm, plants_soak, soil_wash, space_flowers | Green leafy plants and one small orange zinnia flower growing in trays under pink-purple LED light. |
| logbook.cat.earth | chapea, long_stay, mars_gravity_body | Planet Earth on black space, with a small red Mars far away in the corner and a faint dotted path between them. |

Check `SCENARIO.md` 8.1 for the authoritative tier of each card. Until a core image exists, the
game may show the matching category image as a placeholder.
