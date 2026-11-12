# Fresh census integration onto main, 2026-10-27

Base: `be0eb25fc33f3b057847d6c4e2c4fe5a6a9a426c`.
Accepted production candidate: `13f1c27963df0037bba47acf035faec77f53898b`.
Independent acceptance revision: `234860ed740806e792dc1e063a1be55ff2273dad`.

Only `tools/build.sh`, `tools/check-region-decls.js`, `tools/region-census.js`
and `tools/region-layout.js` receive production changes. Their accepted blobs
and the 29 enumerated tests, fixtures and reports are copied exactly from the
independent acceptance revision. No candidate ancestry is merged. Main's
compiler, DirectInput, sources, generated mirrors and ratchet baselines remain
unchanged. Build ordering remains census `--gate`, region-map `--check`, then
`--build-gates` running js-copies, embedded-wat, dup-payloads, hand-rolled.

The compiler context differs from the donor in `tools/watx.js` and
`tools/watx-src/compiler.js`. The unchanged portable helper stages the actual
main compiler files for both original and candidate processes; no compiler
feature or dependency was imported. Full-file identities and the complete
production JavaScript scan closure are in the integration receipt's archive.

Merged-tree validation:

- First behavioral gate: unchanged `production-first.cjs`, including the
  invalid align-3 declaration appended after reading host.js. Separate original
  CLI processes and the production combined CLI both reject at embedded-wat.
- Unchanged freshness differential driver: 24 cases, 90 CLI invocations,
  covering declaration and law-provider discovery, manifest changes, JS/WAT
  changes, same-size/restored timestamps and failure ordering.
- CLI contract: 147 production CLI invocations pass, including legacy modes,
  guard ordering, unsupported combinations, recording and API isolation.
- Disabled layout, declaration and manifest freshness each cause the unchanged
  corresponding differential oracle to reject. Causal diagnostics are retained.
- Real main-tree census `--gate`, generated mirror freshness, combined four
  gates and declaration validation pass. All 2,223 main JavaScript test paths
  (20,281,228 bytes) are present for recursive production scans. The embedded
  scan checks 1,033 fragments. Main baselines are unchanged.
- Tier discovery passes for 2,159 tests; the new test is discovered by the
  existing unit convention. Timeout validation and whitespace checks pass.

Reuse the independently accepted evidence by exact identity:

- `scratch/usage-watch/airstrike-census-freshness-independent-accept-oct27/receipt.json`
  SHA-256 `2cbab6969c25a6787538ed9867dfe3d464f84cb2789e907cfa21547faa1495ea`.
- Its durable archive SHA-256
  `758d01f3fb51eb4e4fe50b58a593d7a5df34dbfe45711c57ab57bc452c014408`.
- Parent repair receipt SHA-256
  `914261c02793047daccddc2ea34dd8f8290d78e36b7ef5cf7a59eecedbc22332`.

The canonical new delta, command receipts, compiler/source/test pins, controls,
resource admissions, incidents and exact publication identities are retained in
`scratch/usage-watch/airstrike-accepted-fresh-census-main-integration-oct27/receipt.json`
and its evidence archive. That receipt is authoritative for publication state.

This qualifies source and CLI behavior only. No full build, canonical module
compile, guest, browser, native or Boat execution occurred. Historical CPU
rejections 126.1068 > 90 and 105.48018 remain binding; retained modules remain
UNQUALIFIED and whole-invocation CPU completeness UNKNOWN. Tiny fixture counts
(reads 10 to 5, parses 2 to 1, compiles 3 to 1) establish no full-build savings.
