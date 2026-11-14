# Review science fact-check of SCENARIO.md

| Field | Value |
|---|---|
| Kind | review |
| Mode | read-only (sandbox: read-only) |
| Focus files | `content/science/FACT_CHECK.md`, `SCENARIO.md` |
| Tool | `node tools/codex/delegate.mjs run --no-record ...` (record written here because `docs/` is owned by Mykhailo) |
| Authentication | ChatGPT login, no API key |

## Attempt 1 — 2026-11-14 ~12:40 UTC, codex-cli 0.133.0: not run

Codex exited with status 1 after 7 s. `codex exec` showed:

```text
ERROR codex_models_manager::manager: failed to refresh available models: ... unknown variant `max`,
  expected one of `none`, `minimal`, `low`, `medium`, `high`, `xhigh`
ERROR: ... "The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account." (model_not_found)
```

The CLI was too old to read the server's model list. Fixed by `npm install -g @openai/codex@latest`
(now codex-cli 0.169.0; `codex login status`: Logged in using ChatGPT).

## Attempt 2 — 2026-11-14 12:46 UTC, codex-cli 0.169.0: exit 0 in 102 s

Working-tree changes during the run: none.

### Task sent to Codex

Independent read-only review of content/science/FACT_CHECK.md, a science fact-check of SCENARIO.md
(a Mars base-builder game for children aged 7-12). Do not edit any file.

Check, using SCENARIO.md and your own scientific knowledge:
1. Coverage: list any real-world science claims in SCENARIO.md (ASTRA lines, mini-game ASTRA explanations,
   dilemma/event follow-ups, radio logs) that FACT_CHECK.md missed. Ignore lines tagged (fiction) and pure
   gameplay numbers.
2. Verdicts: for each row, say if you disagree with the verdict (correct / needs fix / unverifiable), and why.
   Be specific about numbers, dates, names and wording that a child would take literally.
3. Suggested fixes (F1-F9): are they accurate, age-appropriate, and no longer wrong?
4. Data labels (nasa_measurement / approximation / gameplay): flag any that look mislabelled.
5. Sources: flag any source URL that looks unlikely to support the claim as stated (you may not have web
   access; say so if you cannot check).

Output: a numbered list of findings, each with: row / line ID, severity (high/medium/low), what is wrong,
what to change. Then a short list of rows you explicitly agree with if they looked risky. Be concise.

### Codex response

## Summary

The fact-check covers most prominent NASA facts, but its “every claim” coverage is incomplete. Several verdicts confuse insufficient citation support with scientific error, and F1 introduces a new overstatement. No files or Git state were changed.

## Findings

1. **Severity: high — Location: SCENARIO.md:195, 260; FACT_CHECK.md:4–6.** Missing: ASTRA says rest and fresh food restore health lost to radiation. Excluding gameplay HP numbers does not exclude this biological explanation; children could infer that sleep erases radiation damage. Add a **needs fix** row and clarify: “Rest restores energy, but it cannot undo all radiation damage.”

2. **Severity: medium — Location: FACT_CHECK.md:25, 85 — F1.** “Some always stays behind” generalizes one experiment into an unavoidable outcome. The study found incomplete removal under its particular low-flow washing conditions. Use: “Rinsing can remove perchlorates, but it may leave some behind. Scientists must test whether treated soil and crops are safe.” The food bonus also needs an explicit fictional safety test. [Study](https://www.mdpi.com/2571-8789/5/3/37)

3. **Severity: medium — Location: FACT_CHECK.md:26–27, 87–89 — F2/F3.** One storm’s tens-of-minutes arrival does not establish that two hours is scientifically impossible. Change the verdict to **unsupported event-specific prediction**, rather than incorrect universal transit time. F2’s “fastest particles can…” is accurate; F3 still invents an arrival estimate. Prefer: “Fast particles can reach Mars quickly. Get ready to shelter.” [NASA’s May 2024 account](https://www.jpl.nasa.gov/news/nasa-watches-mars-light-up-during-epic-solar-storm/)

4. **Severity: medium — Location: FACT_CHECK.md:29, 59 — F5.** Disagree with **needs fix** solely because one NASA page says “important source.” Scientific literature supports predominantly biological origins for Earth’s atmospheric methane, including past biology. Retain with qualification: “Most methane in Earth’s air comes from living things, now or long ago,” and cite an appropriate source. F5’s weaker replacement is also acceptable. [Atreya, 2010](https://websites.umich.edu/~atreya/Articles/Faraday_2010-08-26.pdf)

5. **Severity: low — Location: FACT_CHECK.md:30, 93 — F6.** “Astronaut” is a valid generic term for a space traveller; being a Russian cosmonaut does not make the original scientifically wrong. Treat “space station crew” as an optional precision improvement. The Universe Today citation also falls outside the document’s stated NASA/peer-reviewed/major-organisation source policy.

6. **Severity: medium — Location: FACT_CHECK.md:41, 61; SCENARIO.md:209, 220.** The table omits “almost all the radiation stays outside” and extends habitat shielding evidence to a rover without specifying thickness or coverage. The cited model supports substantial, composition-dependent reductions—not an unspecified rover-brick arrangement. Add these qualifications and prefer “greatly reduces radiation.” [Shielding study](https://doi.org/10.1029/2019JE006246)

7. **Severity: medium — Location: FACT_CHECK.md:64; SCENARIO.md:222.** Disagree with unqualified **correct** for salt preventing freezing “even in the Martian cold.” Salt lowers freezing temperature; sufficiently cold brines still freeze, and liquid stability depends on pressure and composition. Use: “Salt helps water stay liquid at lower temperatures.” Keep the canyon reservoir explicitly fictional.

8. **Severity: medium — Location: SCENARIO.md:895; FACT_CHECK.md:56.** Missing: ASTRA attributes the three-Sol communication wait to planetary motion. That interval is a gameplay schedule, not a natural Earth–Mars communication cycle. Add a row and say: “Our next scheduled contact is in three Sols.”

9. **Severity: medium — Location: SCENARIO.md:937–938.** Missing: flat-stowed panels “don’t get buried,” and manual cleaning “works every time.” Neither is a general engineering guarantee. Change to “Our panels are protected in their stowed position” if the fictional mechanism supports it, and “Cleaning cleared our panels this time.”

10. **Severity: medium — Location: SCENARIO.md:861; FACT_CHECK.md:4.** Missing: the storm necessarily makes heaters work extra hard. Dust storms cool days but can **warm nights**, so greater heating demand needs a specific explanation rather than a blanket weather claim. Keep the multiplier labelled gameplay and explain the fictional base’s circumstances. [NASA temperature observations](https://www.nasa.gov/missions/how-a-tiny-curiosity-motor-identified-a-massive-martian-dust-storm/)

11. **Severity: low — Location: FACT_CHECK.md:79; SCENARIO.md:655, 960.** “Every nutrient” is too literal: plants also obtain carbon from atmospheric CO₂. Use “the mineral nutrients their roots need.” The Veggie source supports root nutrient delivery, but not the broader wording.

12. **Severity: low — Location: FACT_CHECK.md:4–6; SCENARIO.md:172, 189, 210, 289, 595, 753.** Additional omitted claims: mission rest, plant oxygen production, radio travelling at light speed, vertical farming increasing growing area, spacesuit dust contaminating cabin air, and weather-probe measurements. These are broadly sound; add concise **correct** rows rather than claiming exhaustive coverage without them.

13. **Severity: low — Location: FACT_CHECK.md:65, 91, 93.** Labels need separation: the invented log and F8’s proposed drone capability are **gameplay/fiction**; the historical tea-leaf incident is a reported fact, not a scientific approximation. Use `nasa_measurement` only after obtaining a NASA supporting citation; do not force a non-NASA historical account into that category.

## Verification

Read AGENTS.md, available team status files, the complete fact-check, and the scenario’s relevant script, mini-games, expeditions, events, and data conventions. Opened selected NASA pages and both cited scientific papers; the perchlorate DOI initially failed, but its publisher page opened. I did not validate every URL, inspect implementation, or run tests; `git_status_Pavlo` was absent.

Risky rows explicitly agreed with:

- **F4 and F9:** fictional ice discovery and invented log readings should be clearly marked.
- **F7:** proposed replacement accurately avoids attributing recovery solely to watering.
- **F8:** specifying fictional drone radiation tolerance improves the explanation.
- **MOXIE 122 g, CHAPEA 378 days, Ingenuity 72 flights:** acceptable facts.
- **2015 lettuce citation:** despite its spacewalk title, the page explicitly records the lettuce tasting. [NASA account](https://www.nasa.gov/blogs/spacestation/2015/08/10/cosmonauts-complete-russian-spacewalk/)

## Recommendations

Revise the verdicts and coverage first, then recalculate the “52 correct / 9 need a fix” totals. Prioritize radiation recovery wording and F1’s unsupported “always” before approving scenario edits.

## Main-agent follow-up

Each finding was checked against `SCENARIO.md` and the sources. They were proposed to the team
before any `SCENARIO.md` change; the decisions are at the end of this record.

| # | Assessment | Proposed action |
|---|---|---|
| 1 | **Confirmed.** `astra.tut.hp_intro` ("Radiation and hard work lower it. Sleep and fresh food bring it back.") can teach that rest undoes radiation damage. Real radiation harm is a long-term risk, not something sleep repairs. | Reword so HP is energy/fitness and say plainly that rest does not undo radiation. |
| 2 | **Partly confirmed.** "Some always stays behind" generalizes one study's conditions. The team chose that wording for F1. | Optional softer wording: "rinsing can leave some behind". |
| 3 | **Rejected for the final text.** The F2/F3 lines now say "can reach... in less than an hour", which matches NASA's May 2024 account and is not a fixed prediction. Agreed on the nuance: the old "about 2 hours" was an unsupported prediction rather than an impossible one. | None. |
| 4 | **Rejected.** The team accepted F5, and Codex calls the weaker wording acceptable. The Atreya 2010 source was not opened by the main agent. | None. |
| 5 | **Partly confirmed.** "Astronaut" is not wrong; F6 is a precision improvement. The source concern is valid: the tea-leaf detail comes only from space news citing Roscosmos. A NASA blog post was added for the Russian crew sealing the leak. | Done in FACT_CHECK.md. |
| 6 | **Confirmed.** `astra.act3.roof_built` says "almost all the radiation stays outside"; the cited model shows 0.8–2.5 m of regolith keeps the yearly dose under a limit, not that it blocks almost everything. | Reword to "blocks most of the radiation"; rover shield to "cuts the radiation a lot". |
| 7 | **Confirmed (low).** Salt lowers the freezing point; very cold brine still freezes. | "Salt helps water stay liquid even when it's very cold." |
| 8 | **Confirmed.** Dilemma 4 A says Mars and Earth "keep moving, so we wait for the next good window"; the 3-Sol window is a game schedule. | "Our next scheduled call to Earth is in 3 Sols." |
| 9 | **Confirmed (low).** Event 2: stowed panels "don't get buried" and hands-on cleaning "works every time" are guarantees. | Soften both. |
| 10 | **Confirmed.** Dust storms cool days but warm nights on Mars; "heaters will have to work extra hard" is not a general fact. The Battery & Heating ×4 storm power use stays a gameplay rule. | Reword Dilemma 1 alert: less sunlight means less power for the heaters. |
| 11 | **Confirmed (low).** Plants also take carbon from the air. | "the minerals their roots need" in 4.6. |
| 12 | **Confirmed (coverage).** Six broadly correct claims were not listed. | Add rows with sources in a follow-up; meanwhile FACT_CHECK.md should not claim to be exhaustive. |
| 13 | **Partly confirmed.** The tea-leaf row stays `approximation` (it is not a NASA measurement). F8's drone tolerance is fiction, but the real part of that line (the 2024 star camera) is a NASA fact. | Label note added via the decisions section. |

### Team decisions (2026-11-14)

Accepted and applied to `SCENARIO.md`: C1 (team wording: rest restores energy; real radiation adds up
over time, so astronauts limit time outside), C6, C7, C8 ("our next radio slot is in 3 Sols"), C9,
C10 (same ×4 storm power draw, now attributed to dust-filter fans; added that dust storms make Mars
days cooler and nights warmer), C11, C12 (six rows added to FACT_CHECK.md, each with an opened source).
Not applied: C2, C3, C4, C5, C13 (reasons in the table above).
Tests: none run; this change touches documentation only (SCENARIO.md, content/).
