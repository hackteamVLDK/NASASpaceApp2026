# ARES-KIDS: The Jezero Signal

*NASA Space Apps Challenge 2026 — project description draft*

> **Status legend.** **Built** = exists in the repository today and is covered by tests or runs.
> **Planned** = designed in `SCENARIO.md` but not implemented yet. Nothing below is claimed as
> built unless it is in the code on 2026-11-14.

## Submission requirements we are writing to

Source: NASA Space Apps *Project Submission Guide*,
https://www.spaceappschallenge.org/resources/project-submission-guide/

What the guide says, as quoted by search results for that page:

- Every team must submit a **Project Demo**: either a **video of up to 30 seconds** or a
  **slide deck of up to 7 slides** (including the title slide).
- The demo is hosted externally (YouTube, Google Drive, GitHub, ...) behind a **public link**;
  files cannot be uploaded to the Space Apps site.
- **Video demos need English subtitles**; slide decks must be in English.
- Projects are judged on **Impact, Creativity, Validity, Relevance and Presentation**.
- The project can be edited and resubmitted until the deadline; the last saved version is judged.
- 2026 window (per the 2026 event page as quoted): opens Sat 14 Nov, 9:00, closes
  **Sun 15 Nov, 23:59 local time**.

**Check before submitting:** the official page could not be opened from our build machine (its
certificate chain ends at a root our system does not trust), so the limits above come from search
results quoting it. Open the page in a browser and confirm the video limit, the required fields,
and whether the form asks you to disclose AI tools.

## The problem

Children aged 7–12 hear that people will live on Mars, but the hard parts are invisible: the air is
mostly carbon dioxide, water must be recycled, the Sun's storms send radiation to the ground, and
dust can starve a base of power. Most space games either skip the science or present invented
numbers as facts.

## Our solution

**ARES-KIDS** is a single-screen, side-view base builder set in a real place, Jezero Crater. The
player's crew lands at a half-built underground station, wakes sleeping builder drones, and keeps
everyone healthy through cold nights, a dust storm and solar flares. Over 20 Sols they follow a
mysterious signal (fiction) to a canyon next to rocks like NASA's real "leopard spots" at Cheyava
Falls. Nobody can die and the run never ends in Game Over: low health means rest, not failure.

The onboard AI, **ASTRA 6.7**, explains each event in short, kid-sized lines tied to a real NASA
mission (MOXIE, InSight, Curiosity, Perseverance, the ISS).

## What kids learn

| Topic | How the game teaches it |
|---|---|
| Radiation and shielding | Rooms under more soil get less radiation; the surface gets the most; underground is reduced, never zero. Real radiation adds up over time, so astronauts limit time outside. |
| Space weather | Solar flares are forecast, then strike fast; the crew decides whether to shelter. |
| Life support | Oxygen made from CO₂ (like MOXIE), water recycled at 98% (like the ISS), plants for food and oxygen. |
| Power and dust | Dust storms block sunlight; panels must be cleaned; storms make days cooler and nights warmer. |
| How science works | Choices have delayed results; ASTRA explains why. Testing before trusting (Martian soil and perchlorates). |
| Real vs. game | Every number is labelled NASA data, scientific approximation, or game value; story inventions are tagged (fiction). |

## NASA data and science used

**Built (in `src/data/nasa/`, used by the simulation):**

- **21 NASA reference values**, each with its source: sol length (NASA GISS Mars24), gravity,
  sunlight, atmosphere and pressure (NASA Mars Fact Sheet), Curiosity RAD surface radiation
  (Hassler et al. 2014) and others.
- **119 real solar energetic particle (SEP) event records from 2024**, downloaded from **NASA CCMC
  DONKI** (https://ccmc.gsfc.nasa.gov/tools/DONKI/, API https://api.nasa.gov/DONKI/SEP) by a
  script in `tools/data/`. Storm *dates* in levels 2 and 3 replay these real events. Because the
  detecting spacecraft are near Earth, how strong each storm was **at Mars** is a game value, and
  the game says so.
- The 20 May 2024 event, which Curiosity really measured on the Martian surface, is used as a
  real-at-Mars storm.

**Science fact-check (built, `content/science/FACT_CHECK.md`):**
We checked **75 real-world science claims** in the game script against sources we actually
opened (NASA pages, peer-reviewed papers, major science organisations such as US EPA, US NRC and
NOAA). Each claim is labelled `nasa_measurement`, `approximation` or `gameplay`. 59 were correct;
16 needed a fix, and all 16 were fixed (for example: solar-storm particles can reach Mars in under
an hour, not "about 2 hours"; washing soil removes much but not all perchlorate; rest restores
energy but does not undo radiation). An independent second review of the fact-check is recorded
in `content/ai-collaboration/`.

## Technology

| Part | Status |
|---|---|
| Simulation engine (`src/sim/`): crew needs, oxygen/water/food/power with load shedding, radiation dose per room (depth, material, time, storms), space-weather schedule, construction by drones, objectives, save/load. Pure, deterministic JavaScript, no dependencies. | **Built** |
| Levels as data: L1 "Wake the Station", L2 "Storm Season" playable in the simulation; L3 draft | **Built** (L3 draft) |
| Opening sequence logic (`src/flow/`): text intro, landing cutscene timeline, ASTRA guide queue | **Built**, being updated to the latest scenario |
| Automated tests: 88 tests with `node --test` (85 pass; 3 opening-sequence tests still check the previous script and are being updated) | **Built** |
| Headless level runner (`tools/balance/`) that plays a level in about a second for balancing | **Built** |
| Art pipeline: one style guide and a prompt file for every sprite (`assets/prompts/`) | **Built** (prompts); final art **planned** |
| Browser game: canvas renderer, HUD, ASTRA panel, mini-games, sound | **Planned** |
| Expeditions map, co-op roles, 20-Sol story, Tier 2 upgrades (all specified in `SCENARIO.md`) | **Planned** |
| Note: the simulation currently models a 4-person crew from an earlier design; `SCENARIO.md` now specifies a solo Commander plus drones (co-op for 2–4 players). Alignment is in progress. | **Planned** |

Runs in any modern browser with no install (planned front end); the engine runs in Node 20+ today.

## Team

Team **hackteamVLDK**: Vlad, Mykhailo, Pavlo. *(Add full names, roles and countries as the
submission form asks.)*

## Links

- Repository: https://github.com/hackteamVLDK/NASASpaceApp2026
- Demo (30-second video): *add public link with English subtitles*
- Game script: `SCENARIO.md` · Science fact-check: `content/science/FACT_CHECK.md`
