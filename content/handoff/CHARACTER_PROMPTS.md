# Character art prompts (handoff)

For whoever owns `assets/` (currently Mykhailo). Source of truth: `SCENARIO.md` Section 2.5.
This file does not touch `assets/`. Please add these as manifest entries so `assets/prompts/` is
generated the usual way; `crew.portraits` (status `awaiting-lore`) can now be filled from here.

How they fit the existing pipeline:
- **Bodies are shared.** `crew.indoor` and `crew.eva` stay one generic astronaut whose flat cyan
  `#00FFFF` stripe is recoloured per person (red, yellow, green, blue, violet). The new
  `crew.heads` sheet gives each person their own head, drawn on top of that body.
- **Drones are shared.** `drone.builder` stays one robot; `drone.bumpers` adds a coloured bumper
  stripe overlay per drone.
- Attach `style.anchor` (and `crew.indoor` for heads and portraits) as reference.
- Save each result as `assets/incoming/<id>.png`.

## Shared prompt frame

```text
Create a pixel-art game asset: <TITLE>.

STYLE: Use the attached reference image(s) as the exact style guide: same palette, pixel size, outline, lighting and level of detail. Make this asset in the same style.

WHAT IT SHOWS: <WHAT IT SHOWS>

VIEW: <VIEW>
LAYOUT: <LAYOUT>
BACKGROUND: transparent, or solid #FF00FF if transparency is not available.

STYLE RULES: Pixel art with crisp, un-blurred pixels. Flat orthographic side view (like an ant farm): no perspective, no vanishing point. A limited palette of about 24 colours shared by the whole game. One-pixel dark outline on characters and props, none on terrain. Light comes from the upper left. Warm Martian oranges, rusts and butterscotch for the world; cream and white for hulls; cyan (#00E5FF) and amber (#FFB000) for ASTRA and electronics; Martian Orange #FF6B35 only for highlights. Friendly and tidy for children aged 7-12: rounded corners, no gore, no frightening shapes.
AVOID: No text or letters inside the image (the game draws all text), no watermarks, no anti-aliased gradients, no photorealism, no 3D rendering, no perspective, no extra characters unless asked, no likeness of any real person, no flags or logos.

OUTPUT: <OUTPUT>
```

Every character is friendly, adult (about 30–55), drawn with simple dot eyes and a warm
expression, with skin tones and hair drawn respectfully and without caricature.

## crew.portraits — character cards (6 portraits)

- **VIEW:** front view, head and shoulders, centred.
- **LAYOUT:** a strict grid of 3 columns x 2 rows of equal cells, one portrait per cell, same
  framing and size in every cell, each on a plain soft panel-coloured background.
- **OUTPUT:** 3:2 (e.g. 1536x1024). Each cell 64 x 64 logical px.

| Cell | Character | WHAT IT SHOWS |
|---|---|---|
| row 1, col 1 | Commander Amara Eze | Warm brown skin, short dark twists, calm confident smile, small gold stud earrings, cream jumpsuit with a red collar stripe. |
| row 1, col 2 | Chief Engineer Kenji Mori | Light skin, black hair in a short ponytail, round glasses pushed up on the forehead, a wrench in the chest pocket, cream jumpsuit with a yellow collar stripe. |
| row 1, col 3 | Astro-Botanist Sofía Ramírez | Tan skin, curly brown hair in a bun with a small green leaf clip, freckles, cheerful grin, cream jumpsuit with a green collar stripe. |
| row 2, col 1 | Rover Pilot & Geologist Leo Petrenko | Fair skin, short sandy hair, big friendly grin, a smudge of red dust on one cheek, cream jumpsuit with a blue collar stripe. |
| row 2, col 2 | Comms & Science Officer Noor Haddad | Olive skin, a neat violet headscarf, a slim headset with a small microphone, thoughtful smile, cream jumpsuit with a violet collar stripe. |
| row 2, col 3 | CAPCOM Rosa Varga (Mission Control) | Older woman with a grey-streaked dark bob, reading glasses on a cord, a mission headset, navy polo shirt; behind her, simple shapes of glowing blue control-room screens. |

## crew.heads — heads for the shared crew sprite

- **WHAT IT SHOWS:** the five crew heads above (not Rosa), each as a separate head-and-hair piece
  that sits on the shared `crew.indoor` body. For each person: side view facing right, and the
  same head inside a clear helmet bubble for `crew.eva`.
- **VIEW:** side view, facing right (the game mirrors it).
- **LAYOUT:** a strict grid of 5 columns x 2 rows: columns = Amara, Kenji, Sofía, Leo, Noor;
  row 1 = head without helmet, row 2 = the same head inside the helmet. Each cell 16 x 16
  logical px, the neck at the same point in every cell.
- **OUTPUT:** 5:2 (e.g. 2000x800). Logical size 80 x 32 px.

## drone.bumpers — drone personality overlays

- **WHAT IT SHOWS:** three thin bumper stripes that fit exactly on the front and back edge of the
  shared `drone.builder` body: cyan (Pip, Drone #01), amber (Bumble, Drone #02), green (Zip,
  Drone #03). Plus three small extra details, one per drone: Pip — its camera eye tilted
  curiously; Bumble — a tiny spirit-level tool clipped to its side; Zip — two short speed lines
  behind its tracks.
- **VIEW:** side view, matching `drone.builder`.
- **LAYOUT:** a strict grid of 3 columns x 2 rows: row 1 = bumper stripes only, row 2 = the
  extra detail only. Each cell 28 x 24 logical px, aligned to the `drone.builder` cell.
- **OUTPUT:** 7:4 (e.g. 1680x960). Logical size 84 x 48 px.
- **Note:** no numbers on the drones; the game draws their names and numbers as labels.

## ui.earth-message — Mission Control video frame (optional)

- **WHAT IT SHOWS:** Rosa Varga's portrait from `crew.portraits` inside a small rounded video
  window with a thin cyan frame and two tiny signal-bar icons, used when an Earth message plays.
- **VIEW:** front. **LAYOUT:** one image. **OUTPUT:** 4:3, logical 96 x 72 px.
