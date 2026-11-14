# Review characters, ASTRA voice guide and readability pass

| Field | Value |
|---|---|
| Kind | review |
| Mode | read-only (sandbox: read-only) |
| Scope | `git diff content/scenario-open-items..content/readability` |
| Focus files | `SCENARIO.md`, `content/handoff/CHARACTER_PROMPTS.md`, `AGENTS.md`, `content/science/FACT_CHECK.md` |
| Tool | `node tools/codex/delegate.mjs run --no-record ...` (record kept in content/ because docs/ is owned by Mykhailo) |
| Codex CLI | codex-cli 0.169.0, ChatGPT login, no API key |

## Attempt 1 — 2026-11-14 13:32 UTC: not run

Codex returned "You've hit your usage limit ... try again at 2:34 PM". No other login or API key was
tried (AGENTS.md).

## Attempt 2 — 2026-11-14 ~13:35 UTC: exit 0 in 96 s

Working-tree changes during the run: none.

### Task sent to Codex

Independent read-only review of three changes to a Mars base-builder game for children aged 7-12.
Do not edit any file. The changes are the commits between branches:
  git diff content/scenario-open-items..content/readability
(you are on content/readability). They add:
1. SCENARIO.md Section 2.5 "Characters" (crew names, looks, bios, Mission Control, drone personalities)
   and content/handoff/CHARACTER_PROMPTS.md (art prompts in the style of assets/prompts/STYLE_GUIDE.md).
2. SCENARIO.md "ASTRA 6.7 voice guide" (Section 1) and a pointer in AGENTS.md.
3. A readability pass for ages 7-8 over player-facing lines in SCENARIO.md, plus two new rows in
   content/science/FACT_CHECK.md.

Check:
- Characters: kid-friendly, diverse without stereotypes or caricature, no real people, consistent with
  roles/colours elsewhere in SCENARIO.md and with src/data/crew.js; art prompts consistent with the style guide.
- Voice guide: rules are clear; each "good" example obeys the rules and is scientifically accurate.
- Readability: any rewrite that changed the meaning or a number, broke a science claim (compare with
  FACT_CHECK.md), or is still hard for a 7-8 year old; any sentence still over ~20 words (ASTRA) or ~15 (UI);
  any new line that breaks the voice guide.
- Anything inconsistent between the three changes.

Output: a numbered list of findings (location, severity high/medium/low, what is wrong, suggested fix),
then a short list of things you checked and agree with. Be concise.

### Codex response

## Summary

The characters are friendly, varied, and consistent with the established roles and colours; I found no clear caricatures or real-person likenesses. The readability pass largely preserves the science, but several lines and examples still conflict with the new writing rules.

## Findings

1. **Severity: minor (low). Location: SCENARIO.md:1496, SCENARIO.md:1501, SCENARIO.md:1531.** Revised logbook sentences still exceed the under-15-word UI limit: the thyroid explanation has 18 words, the radio-wave explanation 20, and the tea-leaf introduction 19. Split each into shorter sentences; also shorten the 20-word carbon-dioxide sentence at SCENARIO.md:265 to meet ASTRA’s under-20 rule.

2. **Severity: minor (low). Location: SCENARIO.md:114.** The first “good” example gives two tasks: enter the Bedroom, then fix the valves. This contradicts the explicit one-task-at-a-time rule and models the behaviour writers should avoid. Give the shelter instruction first, then trigger a separate repair line after sheltering.

3. **Severity: minor (low). Location: SCENARIO.md:461.** Rosa must start messages with “Ares-Kids, this is Mission Control,” but `astra.finale.earth` at SCENARIO.md:284 starts differently. Update that message or make the prescribed greeting a first-contact convention.

4. **Severity: minor (low). Location: content/handoff/CHARACTER_PROMPTS.md:56.** The new EVA head overlay specifies a clear helmet bubble, while `assets/prompts/crew.eva.md` specifies an existing dark gold-tinted visor. Simply overlaying these assets leaves helmet ownership and appearance inconsistent. Choose one helmet treatment, specify whether the overlay replaces the original helmet, and attach `crew.eva` as a reference.

## Verification

- Read AGENTS.md, the available team status files, SCENARIO.md, FACT_CHECK.md, CHARACTER_PROMPTS.md, crew data, the style guide, and relevant sprite prompts.
- Reviewed `git diff content/scenario-open-items..content/readability` and counted sentences in changed text.
- Confirmed the existing crew names, colours, and ID mapping agree; Noor’s addition is explicitly documented.
- Agree with the radiation wording changing to “well shielded,” the retained “clue, not proof” qualification, and the plain-language explanations.
- No files or Git state changed. Tests were not run; rendered art, child comprehension, and external scientific sources were not independently checked. `git_status_Pavlo` was absent.

## Recommendations

Resolve the four inconsistencies before handing the prompts and writing guide to implementers. A short reading session with children aged 7–8 would help assess terms such as “gland,” “shielding,” and “LEDs.”

## Main-agent follow-up

| # | Assessment | Action |
|---|---|---|
| 1 | **Partly confirmed.** Logbook cards follow the 8.1 rule (sentences under 20 words), not the 15-word UI limit, so the thyroid (18) and tea-leaf (19) sentences are fine. The radio card (20) and the `astra.act3.ls_t2` carbon-dioxide sentence (20) were at the limit. | Shortened both to 19 or fewer. |
| 2 | **Confirmed.** The good example #1 (and the real line `astra.res.oxygen_zero`) gave two tasks at once. | Both now: "Once we're safe, I'll show you how to fix the scrubber." |
| 3 | **Confirmed.** `astra.finale.earth` does not start with the prescribed greeting. | Rule changed: the first message starts "Ares-Kids, this is Mission Control"; later ones start "Ares-Kids,". No line changed. |
| 4 | **Confirmed.** A clear-bubble head overlay conflicts with `crew.eva`'s gold-tinted visor. | Dropped the helmet row: EVA keeps the visor; crew are told apart outside by recoloured stripe, helmet band and backpack. |
| — | Recommendation: test the wording with children aged 7–8. | Not possible for the agent; noted for the team. |

Tests: `node --test tests/*.test.mjs` 85/88, the same as main (3 old flow-test failures).
