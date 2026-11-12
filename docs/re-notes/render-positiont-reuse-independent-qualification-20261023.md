# Independent allocator-reuse review and POSITIONT COM qualification

**ACCEPT_FIXTURE; full retained-module COM qualification PASS.** Review was
completed and recorded before native execution. Four fresh sequential Node
processes produced baseline exit 0 and all three intended control exits 1.
No compilation, production/fixture repair, donor mutation or retries occurred.

## Independent review

Reviewed candidate `c9a59870ff46416653d0782ebfc296df1bb0ae59` against
`74377b3382e03a7ead1a3e33981321b768d6c3ca`. The exact [fixture diff](render-positiont-reuse-independent-qualification-20261023/reviewed-fixture.patch)
has SHA256 `c1a61f4c72eb1e2d3ed3674694ae75641ed97a6ba7449272088138b02334f3d6`.
Fixture blob `4ea43dde7` (full blob in source manifest), SHA256
`6fea929b37398641c4fdc329e42d4e46ee739ddd65f28e4ad5771b0592fff93d`,
remains mode 100755. All 23 predecessor seals were independently checked against
both retained files and committed bytes. The predecessor report, original,
focused and no-op raw logs/receipts, causal summary and closure-after were read.
Those three runs were not repeated.

The source ordering establishes why the correction is valid:

* `lib/d3d-shader-ir.js:75` copies native bytes with `.slice()` before returning
  `readFixedBundle`; `fixedPositionT` finally frees the bundle and descriptor.
  `src/09aj-d3d-fixed.wat:136` frees the four subordinate allocations and bundle;
  `src/09ag-d3d-shader-vm.wat:92` converts linear pointers with real `w2g`.
* `lib/d3d9-host.js:1468` puts that independently owned IR into the actual
  production payload before `_issue`. The fixture copies this payload for its
  hash oracle, then poisons real allocator returns before delegating `_issue`.
  Thus the hash alone observes a task copy, but the subsequent authentic draw
  independently consumes the production payload and checks complete BGRA/depth.
  It does not rely on the task copy to establish real-draw non-aliasing.
* `reuseProof` is installed immediately before the synchronous recovery draw.
  The DRAW wrapper saves it and clears it before invocation. There is one such
  draw before the null assertion; source control flow proves exactly one call.
  An exception becomes DrawPrimitiveUP failure and cannot reach baseline PASS.
* `src/10-helpers.wat:2868` uses aligned extents, exact/next-larger bins and
  first-fit free blocks, splitting from the tail. Free enqueues blocks without
  coalescing. `lib/d3d9-software-backend.js:495` coalesces during later prepare;
  `src/09ai-d3d-render-lifetime.wat:159` merges only free adjacent blocks.
  Original evidence shows frees 210→215→216, then 17 merges and backend reuse:
  historical bundle start `0x1010564` now has 12 B payload rather than 36 B.
  Requiring its old size there after backend work was an invalid fixture demand.
* Before prepare, descending target sizes prevent this search from carving a
  smaller pending target to satisfy a larger request. Equal-size targets are
  recorded in a set regardless of allocation order. Poison covers only successful
  fresh `guest_alloc(size)` payloads; these are held in `live` until queue proof
  completes, so allocator-valid live production owners cannot be overwritten.
  No arbitrary historical address is directly poisoned. This conclusion is for
  the pinned allocator and this fixture, not a general heap-layout guarantee.

The exact diff changes only callback placement and descending target ordering.
64 attempts per target, 1 MiB cumulative requests, real allocator/free, six exact
addresses, poison 0xa5, IR hashes, full pixels/depth, queue and final-release
oracles remain. Production, all 286 pins and all 290 closure file modes are
unchanged relative to the candidate. Original fixture acceptance `7aef3ff` and
`aea185`, guard/boundary, 52 gates, decoder, arithmetic and build evidence are
reused; none were replayed.

**No-op mismatch disposition:** the mutation skips the real five-block recovery
bundle free while still freeing the descriptor. Its trace stays at free count
210 for the bundle, leaving the largest target IR live. The real allocator
returns other blocks for 63 requests of 16420 B (1034460 B); the next request
would exceed the unchanged 1 MiB bound. Native exit 1 at that proof assertion
is causal rejection of missing free, not generic crash or external exhaustion.
The runner also exits 1 because it expected the narrower exact-address message.
That runner mismatch is retained and is **not a runner PASS**. It limits the
prior runner receipt but does not invalidate the bounded proof: skipping free
cannot satisfy the unchanged exact-address obligations within its byte budget.
No prior full qualification was accepted.

## Exact retained inputs and commands

Read-only module donor:
`/home/user/wine-assembly-render-positiont-tiny-rhw-native-qualification-oct23/build/positiont-com-tiny-rhw.wasm`,
1883361 B, SHA256
`5d057b5424b710fb28f1c617786ba71d7c8c116fb74e51eac611ec9a79868ef1`.
Adjacent `positiont-com-tiny-rhw.provenance.json`, 1002 B, SHA256
`e64c83f925f52649f46e1a89bb952d7dde06d627f7a799f0956a535c1bca8cc3`.
Pins digest `d39a81a012129bd7c81f4f697d0a8317b3869a8195fc6fd32c1ff13fc3431262`;
extraWat digest `4bd65ac87452abb4ec5f728f88b399439c9fa4fec91a53b3e6cb96468f58d068`.
Tiny-RHW source remains reviewed production `301b568d`, review `345ea682`,
single source blob `538290c4241f9112ff5e16f5cd71735ab38edea9`.
The 290-file manifest preserves pinned source identity, physical bytes and modes.

The module loader requires explicit module/provenance, validates both and all
source pins. Its separate buildDiagnostic is unreachable here. render-helper
selects prebuiltModule before its lazy compiler branch and creates exactly one
shared 8192-page Memory and one Instance; no Workers. The accepted guard
`/home/user/wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs`
SHA256 `47ce2e2b835be33eab6b2b24f027ecaab8ceb61c559890e51548c78199beb197`
synchronously checks intrinsic BufferSource lengths ≤8388608 before native
Module construction. It is loaded by --require, unmodified.

Each full argv is recorded in its JSON receipt. Installed Node
`/home/user/.nvm/versions/node/v24.18.1/bin/node --max-old-space-size=512
--require GUARD test/test-d3d9-positiont-com-qualification.js --qualify
--allow-512m --module=ABSOLUTE_RETAINED_MODULE --provenance=ABSOLUTE_RETAINED_PROVENANCE`
runs first without a control, then with `--negative-control=disable-shared-route`,
`--negative-control=alias-queued-bytes`, `--negative-control=corrupt-queued-ir`.
`NODE_PATH=/home/user/wine-dashboard-deps-20261014/node_modules` uses the
independently measured pinned pngjs in place. Compiler/cache/debug overrides
are cleared. No instrumentation changes the qualification fixture.

| Process | Native exit | Intended evidence |
| --- | --- | --- |
| baseline | 0 | PASS full COM/native allocator fixture |
| disable-shared-route | 1 | ARMED; actual shared native IR selection assertion |
| alias-queued-bytes | 1 | ARMED; queue bytes survive caller mutation and real heap reuse: complete BGRA/depth oracle |
| corrupt-queued-ir | 1 | ARMED; same queued complete BGRA/depth oracle |

Baseline reaches tiny-RHW fallback complete pixels/depth, real descriptor
allocation rejection/recovery, all six reused addresses and 34164 requested
bytes, poison/hash, queue mutation survival, both invalid ranges, real resource
and device final Release, destroyed backend, zero backend bytes and advancing
production frees. Final counters are 351 allocations/281 frees; they are not
a claim that every allocation in the complete harness is freed. Controls reject
at intended assertions rather than crashes. Raw logs and assertions are retained.

## Admission and handback

The consolidated measured admission was **46918232/67108864 B**, including
27367589 B materialized closure, private Git/index/new objects, directories,
scripts/evidence/temp/captures, external launcher events/stderr, separate Codex
session JSONL, 6 MiB future growth and **8 MiB reserve inside the cap**. Host
after projected growth was 5777352539 B, above 2982150144 B. Standing donor,
module, executable, pngjs and direct object-store sizes/hashes are separately
recorded. No links conceal copies; no fetch or archived recovery.

Fresh MemAvailable before the four commands was 3050934272, 3036528640,
2946469888 and 3019022336 B, each above 1610612736. Each command had CPU/wall
150 s, 512 MiB old space (not an RSS limit), regular-file limit 24 MiB,
aggregate capture limit 512 KiB, fail-closed 125, TERM+5 s KILL and Linux
subreaper/full reap. Total native capture **9555 B**; peak child RSS
**97320960 B**. All four receipts show no guard failure, groupReaped true and
no adopted descendants. The heavy arena is released. Publication verification
and final accounting are retained externally in the task publication receipt.

Only this report and adjacent evidence are new relative to the candidate tree.
No shared integration/main/merge/deploy, compiler/build, fixture/production
repair, donor mutation, Boat/browser/GPU/guest, worker/refill or other-process
intervention. Shadow Man `01a16770` Python-only repair, RichEdit, Claude B&W2 and
laptop ownership are preserved. Box ID/state/expiry N/A; lifecycle coordinator.
No performance, WebGL or game-acceptance claim.

Git does not back up the ignored module. Recovery requires the exact retained
read-only artifact reference above, hashes/provenance and source manifest in
this evidence directory. A future authorized reproduction must materialize
those bytes/modes in a fresh isolated root, take fresh admission and use explicit
retained module arguments; **no rebuild is authorized by this recipe**. This
task's four native processes are consumed. Stop; coordinator assigns any next task.
