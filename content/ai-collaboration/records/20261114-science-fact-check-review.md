# Review science fact-check of SCENARIO.md

| Field | Value |
|---|---|
| Kind | review |
| Mode | read-only (sandbox: read-only) |
| Date | 2026-11-14 |
| Focus files | `content/science/FACT_CHECK.md`, `SCENARIO.md` |
| Tool | `node tools/codex/delegate.mjs run --no-record ...` (record written here because `docs/` is owned by Mykhailo) |
| Codex CLI | codex-cli 0.133.0, logged in with ChatGPT, no API key |
| Status | **Not run: Codex CLI could not start a session** |

## Task sent to Codex

Independent read-only review of `content/science/FACT_CHECK.md`:
1. coverage (science claims in SCENARIO.md that were missed),
2. verdicts (correct / needs fix / unverifiable) per row,
3. accuracy and age-appropriateness of suggested fixes F1–F9,
4. data labels (nasa_measurement / approximation / gameplay),
5. sources that look unlikely to support the claim.

## Result

Codex exited with status 1 after 7 s and returned no review. Running `codex exec` directly showed:

```text
ERROR codex_models_manager::manager: failed to refresh available models: ... unknown variant `max`,
  expected one of `none`, `minimal`, `low`, `medium`, `high`, `xhigh`
ERROR: {"type":"error","status":400,"error":{"type":"invalid_request_error",
  "message":"The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account.","code":"model_not_found"}}
```

Cause: the installed CLI (0.133.0) cannot parse the server's current model list, so it falls back to
a default model that a ChatGPT login cannot use. Explicit `-m` values (gpt-5.5-codex, gpt-5.4-codex,
gpt-5.4, gpt-5.3-codex, gpt-5.2-codex, gpt-5-codex) were rejected the same way. The current npm
release is 0.169.0.

## Main-agent follow-up

_Pending. Once the Codex CLI is updated, re-run the same task and replace this section with the
findings: which were confirmed, what was changed in FACT_CHECK.md, what was rejected and why._
