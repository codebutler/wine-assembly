# GLTron accepted cleanup publication — 2026-10-29

Integrates the exact 16-file, 103951-byte accepted GLTron recovery closure onto
main 3898e008861bad6c274506664b2804dbdc7d236a. No historical task tree is merged.
Candidate: ac78ee2a1b2fa6ee38b1862d49635851ea5a72dd.
Independent acceptance: 39b17bd8c7a1128220b1f2eea150d077382cf6f9.
Production SHA-256: aa7d8c7668a6ea466f2099bb1966d8f725ed660c47fcf961826e35f9c19be53d.

Reuses coordinator-reviewed 16 API and 16 CLI checks and the integrated four-case
receipt: API/CLI cleanup-total and replace2, each with a prior output pair.
The four integrated checks passed against the unchanged production and fixtures;
publication does not rerun them. CLI acceptance uses actual production main with
fixture-only archive verification and objdump substitutions.

Scope is single-writer ordinary-exception cleanup and rollback. No crash or
concurrent-reader atomicity, original-media or gameplay/runtime guarantee.
All unrelated main paths remain unchanged. The corrected sparse staging command
uses explicit --sparse; no checkout, reset, materialization or runtime was needed.

Canonical publication evidence: /tmp/gltron-tested-sparse-publication-oct29/receipt.json.
Inherited integrated evidence:
/home/user/wine-assembly/scratch/usage-watch/gltron-recovered-cleanup-integration-oct29/retained-evidence/receipt.json
(SHA-256 d9765aa20b6e2a0a719ac5273d26038736997b46d51b58a9716db2c380e1ed55).
