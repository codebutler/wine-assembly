# Independent acceptance: legacy DISABLE capability

Reviewed producer `d46f4c931a199fa587b388284804efc4608d20f8` against
authenticated main `e5f45399bc5564a84b6b1428e15ffa412db9e929`.
Accepted the coherent four-file change: descriptor byte 180 changes from
`0xE` to `0xF`, advertising the already accepted stage-zero DISABLE behavior.
Both stage/texture limits remain one. No other capability or implementation
changes; unsupported operations and fail-fast paths remain unchanged.

Independent executions reproduced baseline exit 1 specifically for
`missing supported operation 1`, candidate pass, six overclaim rejections
(operations 5, 6, 7, 10, 26, 32), and rejection of advertised DISABLE without
its RGBA termination. The fixture compiles and executes authentic production
forms in one-page Wasm instances. Its specific assertion/error predicates
attribute mutations to behavior. Independent injections of invalid compiler
input and a generic Error with the matching diagnostic both fail the suite
at the first rejecting control; neither can masquerade as a passing control.

Unchanged DISABLE regression passes eight bound/unbound alpha cases, real
software spans, both routes, three rejecting semantic reversions and re-enable
with retained texture binding. Nearby suite passes 144 argument combinations,
15 rejecting controls, nine supported pairs and six unsupported diagnostics.
Batching and points regressions pass. Compiler full-file Git blobs and SHA-256
were checked before compilation; fresh baseline/candidate manifest offsets,
ordered extraction recipes, byte lengths and hashes match the producer's exact
revision receipts. Packaging seals are reused from coordinator verification.

Recovery and raw evidence: `/tmp/legacy-texture-disable-capability-independent-integrate-oct24/`.
Run `python3 check.py` from that directory for the guarded baseline/candidate
and nearby checks; `python3 extra.py` runs the two independent oracle controls.
`compiler-checkpoint.json`, manifests, `runs.jsonl`, logs, and the resource ledger
bind exact inputs and results. All Node invocations use 256 MiB old space,
60-second wall/CPU bounds and MemAvailable >=805306368 bytes.

Qualification is small source excerpts/software fixture pixels and mocked GPU
lowering. No canonical compile, native/COM guest, browser, real GPU pixels or
gameplay qualification. No test box assigned; lifecycle remains coordinator-owned.
