# Executable POSITIONT COM/allocator qualification fixture, 2026-10-23

Implemented `test/test-d3d9-positiont-com-qualification.js`, an explicit
prebuilt-only integration fixture for complete accepted candidate
`5427a9e2e7d20984249cadcf67f1cb33cc9d85c0`. Independent source/software acceptance
is `6ac29d0c4bd8def2f5cf06d4cac1795a08f1e754`; its 29 seals are coordinator-verified
input evidence, not new COM acceptance. Remote main independently reconciled
read-only to `bb9c496ed13095cc832fdf607f0937fb9c14b7de` before implementation.

**Full COM/native allocator execution: NOT EXECUTED.** No canonical source
compilation, 512 MiB instantiation, browser, GPU, game or Boat operation occurred.
The deliverable is runnable code with offline-qualified entry/negative controls,
not acceptance of its unexecuted integration assertions. No production renderer
source changed. The only existing files changed are test/render-helper.js
(optional prebuilt Module, lazy compiler import) and tools/test-tiers.js
(explicit e2e entry). Existing multi-stream and depth-release conventions are
reused; existing numerical/fragment fixtures are not duplicated or requalified.

## Integration behavior to execute later

The fixture enters 25 actual guest-facing COM handlers through diagnostic WAT
exports, including arguments beyond parameter five on the guest stdcall stack,
and connects `gpu_gl_call` to the production Bridge/software consumer. Buffer and
declaration Release use the shared Shader9 handler the canonical dispatch table
uses for those COM methods. This is handler-level COM qualification, not an x86
caller/RET/thunk-dispatch test. It initializes the production heap explicitly at
guest base0x01000000 without loading a PE. No fixture allocator/free implementation
is substituted. Native heap counters, allocation extents and address conversion
are diagnostic observations only.

Baseline input IDs and required assertions:

- `DP-start2-offset16-stride48`: nonzero StartVertex and binding byte offset;
  exact three packed stride records; poisoned records outside that range.
- `DIP-101-base1-min2-start2`, `DIP-102-base1-min2-start2`,
  `DIP-101-base-1-min3-start1`: INDEX16 normalization, INDEX32 gathering, signed
  BaseVertex, min-index and StartIndex. Exact copied vertex bytes equal the DP
  control; the INDEX16 payload must contain [0,1,2].
- `DP-multistream2and5-start2-distinct-strides`: no bound stream0, position
  FLOAT4 at offset4 in stream2/stride24; color FLOAT4 and UV FLOAT2 in
  stream5/stride32; exact packed stride56 and offsets[4,28,44].
- `DPUP-copied-POSITIONT`: authentic user-pointer COM copy path.
- `depth-z.5-clear.4-reject`, `depth-z.5-clear1-pass`,
  `depth-far-green-preserves-red`: complete black/nonblack frame and depth/order
  oracles. Every positive red frame has exactly ten red pixels in an 8x8 BGRA
  target: x+y<4, all other RGB black, alpha255 everywhere. This independent
  analytic oracle rejects even one changed pixel, rather than comparing two
  implementations that might both draw black.
- `finite-RHW1e-39-honest-fallback`: full red frame, absent shared IR, no shared
  compiler call, one actual software fallback. Admitted controls require native
  IR with fixed origin4 and bypass fallback; route disablement cannot pass on
  matching fallback pixels alone.
- `real-allocator-failure-recovery`: one descriptor allocation request is
  redirected to **the real allocator's oversized-request rejection** (0xfffffff1),
  with no fabricated return value, no packet and no shared compilation. The
  cleared framebuffer remains black; restoring the ordinary request must draw
  red. This tests failure propagation/recovery, **not heap exhaustion** or native
  internal allocation failure at every site. Neither is claimed.
- Actual released descriptor and five bundle/IR/VM extents must be reissued by
  the production allocator at their original addresses, then poisoned with0xa5.
  Copied native IR must remain byte-identical. Search stops after64 allocations
  per target or1MiB total requests; inability to observe reuse is a hard failure,
  not permission to overwrite freed storage directly or substitute no-op frees.
- A second real CommandQueue holds a COM-produced packet behind a completion
  gate, copies it, and executes it on the same actual native software backend.
  Caller vertices/IR are then overwritten before completion; full red pixels
  must survive caller mutation and real heap reuse. This covers the transport's
  copying contract with authentic data. It does not claim the async Bridge's
  worker transport or parked guest continuation was executed.
- Out-of-range StartVertex and indices outside declared min/num must reject
  without publishing a packet or painting. Unbind and final actual COM Release
  must destroy the backend, reduce its accounted bytes to0, advance real free
  counters and remove the Bridge device. Bridge.close alone is insufficient.

The queue owns copied payload bytes. Native byte copying occurs before the
producer's real bundle free. Per-case logs carry input ID, route/compiler/fallback
counters and framebuffer SHA256. A final success record includes module/input
IDs, observed reused addresses, requested reuse bytes and allocator counters.

Three separately executable meaningful negative controls must exit1 *after*
their `ARMED negative control ...` marker and at the target behavior:
`disable-shared-route` must fail the first native descriptor selection oracle;
`alias-queued-bytes` bypasses the queue's defensive copy and must fail queued
byte/native execution after mutation; `corrupt-queued-ir` poisons queued pixel IR
and must fail native execution/pixels. A guard, setup failure, timeout or failure
before the marker is not successful negative evidence. Each uses a fresh process.

## Mandatory prebuilt provenance and exact future commands

The fixture never imports the source compiler. Missing flags or provenance fail
before importing render-helper/host/canvas or creating memory. It requires an
explicit diagnostic module/provenance pair, hashes the actual module, rejects
unknown fields' required values, validates required native/function exports and
canonical host.memory presence, and verifies every pinned local source/compiler
blob before booting. `test/support/positiont-com-source-pins.json` contains exact
candidate blob identities; current main cannot silently replace candidate source.
This is a reproducible build receipt/integrity check, not a signed attestation.

The required diagnostic closure is **exact src/main.watx and its includes**,
canonical production/standardWat/no-runtime-builtins options via compile-src and
watx-closure, tailCalls=true, with **only** the exported `extraWat` string appended
to 13-exports.wat. No native compiler, rasterizer, allocator, handler or canonical
production source is rewritten. Extra WAT SHA256:
`4bd65ac87452abb4ec5f728f88b399439c9fa4fec91a53b3e6cb96468f58d068`.
Pinned source/compiler map SHA256:
`f108ba0cae9dccea9d1628a7581e032e4743cfa54b2da4a21420857e7b7e3cfc`.
The exact required export list is `requiredExports` in
test/support/positiont-com-module.js and in evidence check-07.log; it includes
all29 q_* diagnostic exports, heap_init, production allocator/map/free functions,
native shared fixed compiler/free, VM, software raster and state-binding exports.
The full list is checked before instantiation; no missing-export fallback is
allowed for the qualification entry. Plain shipped canonical modules lack q_*
and must reject. Diagnostic artifact SHA is recorded separately from any shipped
canonical module SHA; **no diagnostic module has been built in this task**.

Future operator needs a complete checkout preserving the accepted candidate
source plus these fixture/support changes, existing package dependencies
(including pngjs for render-helper), compatible installed Node with Wasm
SIMD/tail-call support, and separately authorized compilation/512MiB runtime
resources. The current task's64MiB disk admission does not admit a future full
build or its outputs. Do not copy a compiler or acquire dependencies under this
task allocation. In the separately admitted checkout, create an empty output
directory and execute exactly:

```sh
timeout --signal=TERM 900s node test/support/positiont-com-module.js --build-diagnostic /ABS/OUT/positiont-com-diagnostic.wasm /ABS/OUT/positiont-com-diagnostic.json
timeout --signal=TERM 120s node test/test-d3d9-positiont-com-qualification.js --qualify --module=/ABS/OUT/positiont-com-diagnostic.wasm --provenance=/ABS/OUT/positiont-com-diagnostic.json --allow-512m
timeout --signal=TERM 120s node test/test-d3d9-positiont-com-qualification.js --qualify --module=/ABS/OUT/positiont-com-diagnostic.wasm --provenance=/ABS/OUT/positiont-com-diagnostic.json --allow-512m --negative-control=disable-shared-route
timeout --signal=TERM 120s node test/test-d3d9-positiont-com-qualification.js --qualify --module=/ABS/OUT/positiont-com-diagnostic.wasm --provenance=/ABS/OUT/positiont-com-diagnostic.json --allow-512m --negative-control=alias-queued-bytes
timeout --signal=TERM 120s node test/test-d3d9-positiont-com-qualification.js --qualify --module=/ABS/OUT/positiont-com-diagnostic.wasm --provenance=/ABS/OUT/positiont-com-diagnostic.json --allow-512m --negative-control=corrupt-queued-ir
```

Expected exits: build0, baseline0, then1/1/1 at their armed target failures.
Stop on first build/baseline failure, wrong hashes/source/export/memory,
allocation/reuse bound, timeout, or unarmed control failure. Do not retry an
unchanged admission denial or compile automatically. Preserve logs/module and
source/provenance hashes; report to coordinator. Full COM success still would
not qualify WebGL1/2 driver pixels, game behavior or general fixed compiler paths.

## Executed offline evidence and resource accounting

Evidence directory: scratch/runs/20261023-render-positiont-com-qualification-fixture.
checks.json records exact argv, exits, cwd, expected rejection exits and logs.
Five JS syntax checks exit0. The offline guard exits0 across11 control groups:
default/incomplete CLI and accidental build flags, thirteen provenance fields,
changed module bytes, missing module/source/export, changed candidate source,
full-frame black/pixel/depth rejection, missing/wrong native route, actual queue
copying and intentional alias rejection. The helper prebuilt branch uses a real
empty8B module SHA256
`93a44bbb96c751218e4c00d479e4c14358122a389acca16205b1e4d0dc5f9476`,
64KiB shared memory, and host/canvas stand-ins. Those stand-ins establish only
the boot branch's no-compiler behavior; **they do not qualify COM/heap**.
No native fragment compiler was invoked. Extra WAT was parsed only (29 forms).
Exact source/compiler blobs were verified. Full candidate Git filename metadata
plus the two new tests passes tier validation:2087 tests,1655unit/426e2e/6smoke.
This metadata-only tier check does not execute the other tests in a focused tree.
Bare fixture and bare builder each exit1 EXPECTED without loading compiler/host.

Initial measured manifest **before checkout**:19,772,922B source/Git material,
16MiB growth and8MiB reserve, projected44,938,746B<64MiB; host projected free
6,504,163,846B>2,982,150,144B floor. A second focused measured admission adds
16,973,198B exact pinned blobs from existing read-only root Git objects that
were absent/different in donor working files; projected53,719,777B including
8MiB growth and8MiB reserve remains within cap. No broad fetch/archive, links,
installs or donor metadata writes. Installed Node/Python/Git/SSH execute in place;
their standing identities/sizes/SHA256 are recorded separately in admission.json.
Task copies, Git, source, evidence, temporary files and launcher/watch logs are
counted by the final resource receipt; no copied executable is excluded.

An initial guard metadata check searched only09ad for Buffer Lock/Unlock and
failed; it now checks09ad and09ae. An initial broad git diff hit absent thin-repo
blobs and segfaulted; focused base blobs were read from the existing root object
donor for narrow diff checks. No source/compiler/runtime failure was concealed
as a fixture pass. Publication uses an isolated Git index/branch and explicit
owned paths; all inherited candidate tree entries must be preserved.

No box assigned/contacted. bx_fn7pn7yg remains **coordinator-reported snapshot
STOPPED**, historical expiry03:46:00.580Z, unprobed here. Coordinator owns lifecycle.
Parallel ShadowMan/POSITIONT/RichEdit, Claude B&W2, and laptop HeroesII/Warcraft
ownership remains untouched. No workers, main merge, deployment, runtime or
replacement assignment. Stop after tested commit/push/remote verification.
