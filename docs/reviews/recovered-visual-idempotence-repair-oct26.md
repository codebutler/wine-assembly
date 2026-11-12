# Recovered visual bundle integrity — 2026-10-26

Base: `44e344fdb26daab9a07210656597902ba27cb5f7`. Synthetic fixtures only; the importer was never invoked on repository captures. Historical manifest unchanged.

`already imported` now requires regular retained image/provenance/result files, the reviewed image SHA-256, and exact metadata agreement with the reviewed mapping (JSON key order is immaterial). Missing, partial, malformed, tampered or mismatched bundles fail without overwrite. Exclusive directory creation also refuses a destination created after the existence check.

Historical command/outcome/verification stay unknown/unreviewed. Build commit stays null; an associated historical reported Wasm hash keeps its original limitation. Valid retained bundles do not need the original capture or associated result file; recovery does not establish current module identity or gameplay.

Regression evidence:

- Baseline importer SHA-256 `4fa3b192370c939e9d5d6768e8aed24c17fce84c48a6a60b6fd37e936ca16b32`: **33 reproduced false successes** with corrupted or mismatched retained files/mapping.
- Repaired suite: **52 checks passed**. Every rejection snapshots all fixture bytes and modification/change times before and after. Valid reruns preserve all bundle bytes, original modification/change times, historical date and importedAt, with/without reported build evidence and with/without original sources. JSON ordering/default association, partial directories, symlinks, schema and capture-association failures are covered.
- Run repaired suite: `node --max-old-space-size=256 test/recovered-visual-idempotence.test.js`.
- Reproduce baseline: save the base revision importer as an absolute `.cjs` path, then run `node --max-old-space-size=256 test/recovered-visual-idempotence.test.js --baseline /absolute/baseline.cjs`.

Tested source SHA-256: `c934e1ad0f59ae70976b643b5fae9eef6381d05cf1df856630eb245c3e279d57`.
Tested fixture SHA-256: `64feb6a0af08d9e1e22953fc880e470e6ca80f2dc15b15e4486eaeccccba9cda`.
Unchanged manifest SHA-256: `ee286db6b108cac15b85dcbe36d100bd5605807270306302b23a798df8f63b26`.

Detailed local logs, guarded commands, resource admissions and checkpoint: `/tmp/recovered-visual-idempotence-repair-oct26/ops/`. Both groups finished below 60s CPU/wall, 256 MiB Node heap and 128 KiB output per group; the 64 MiB disk admission includes existing task/session/launcher history, shared WAL/SHM, positive DB growth, 16 MiB projected future growth (Git/publication/fixtures/evidence) and 8 MiB reserve. Installed tools/read-only donor objects are standing inputs, used in place. No runtime/build/acquisition or current compatibility claim.

Bootstrap inspection had an excerpt-control qualification (some raw displayed reads exceeded the 8 KiB excerpt target); original history retained. No execution denial, test failure or weakened guard. No assigned test box; lifecycle remains with coordinator. No main integration.
