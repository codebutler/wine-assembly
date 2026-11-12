# Shared environment empty-name guard integration — 2026-10-20

Only four added lines in src/10-helpers.wat are integrated onto main a54049d11955307d06309e146e85c1aca3196657. The guard follows env_ensure and rejects an empty ANSI byte or UTF-16 code unit before scanning entries. Named hidden drive variables remain valid. No candidate ancestry or other production changes are imported.

Provenance: independent acceptance 31bd5e6996f9ef729dc465fdffb4a9a49d040007 accepted repair ea6f896e8099fc8072009fbf0014b52fa06bbedd over e295f11287fde0ce2efa0d0da9491933481fc81f. Its report and receipt were read. Those full-candidate replay results are historical provenance, not current-main launch qualification. The four added lines match the accepted patch exactly.

Run from the repository root:

    node docs/reviews/env-empty-guard-integration-20261020.js [OUTPUT_DIRECTORY]

This standalone regression compiles actual source functions using the repository WATX compiler; absent sparse files come from HEAD objects. It does not load the candidate/review helpers. All unchanged inputs map exactly to the main base; removing the guard recovers the exact main helper hash. The module SHA-256 is ad89e4d1ddd265b4f03a9edfbb92ca7688699a4ba0bf2570e15847ee7f630ad0.

50 checks and 21 rejecting controls pass. Coverage includes A/W empty lookup/get/deletion, hidden =C: entries before and after ordinary entries, case-insensitive named hidden lookup and replacement/empty-value/deletion, ordinary and missing variables, CRT getenv and stack cleanup, existing main env_expand_a literal %%/named/unknown/unmatched tokens, sizing/short buffers/aliasing, and lazy initialization retained on empty lookup. Parent controls independently reject lookup/get/deletion/CRT/expansion behavior; an overbroad guard rejects named hidden lookup. JS syntax and git diff --check pass. The test is a manually invoked focused regression under docs/reviews, not added to the full-build test tiers.

Evidence: scratch/runs/20261020-env-empty-guard-integrate-oct20/{setup.json,tests.json,validation.json,receipt.json,change.patch}. The receipt maps tested inputs to the published commit and records remote branch/main verification. Exact sparse patterns preceded materialization; object alternates are read-only. Task allocation stays below 8 MiB; every write phase uses the conservative full-budget floor 2277507072 bytes (at least 2210398208 + 33554432 + 25165824 + remaining).

Limits: source-slice compilation uses identity guest-memory translation, heap, and region-placement adapters. No full build/dispatch, runtime, child launch, browser, benchmark or game qualification occurred. The runtime403 restriction and protected laptop HeroesII/WarcraftIII work remain unchanged. This task neither integrates broad ShellEx/nShow/flags changes nor closes the whole SHELLEXECUTEEX task. General invalid-name setter validation remains outside this guard.
