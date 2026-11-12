# Executable compiler-cache repair, 2026-10-23

Tested source repair for subsequent fresh independent review. Candidate parent
`fd5e3fc9329711d3190bbd5c7046976c21d0b9a1`; independent rejection
`3405dbc5766f24ce11b11aea417bfa4a6b999f24`; private branch
`task/d3d-render-executable-cache-focused-repair-oct23`. Main remains
`7f7358c160ae7185fc38f9a15447a6d20c00f97e`. This report does not independently
accept or integrate this repair. No renderer, WAT, or D3D fixture changes;
`09dc88de` remains unmerged.

## Changed executable behavior

Each default cache miss or explicit preparation captures the complete existing
input inventory once. A private CommonJS graph evaluates **those captured
buffers** for compile-src, the canonical closure adapter and the loader. A
restricted filesystem view also serves those same buffers to the real loader's
vm stages and the closure's source reads. The actual canonical adapters still
own include handling, all three VFS aliases, byte decoding, compile options and
the extraWat transform. This is isolation of trusted project code, not a security
sandbox for hostile JavaScript. Unexpected dependencies or unsealed reads fail
closed. No full compiler code was evaluated by this task.

The shared Node require cache is neither purged nor used for this compiler
graph. Other callers may keep their original compile-src, closure and loader
exports; tests show those references remain identical and usable. An invocation
with changed throw-only executable inputs raises their actual sentinel errors;
valid changed executable inputs emit matching new byte markers. Before/after
identity comparison remains a publication check, rather than the proof that
cached executable code matches newly hashed disk files.

Retained render helper and artifact exports privately evaluate a changed current
implementation and delegate to it. Thus valid helper/artifact changes also take
effect through old exports. The helper passes its evaluated source buffer into
identity/preparation/consumption, which checks it against the captured receipt
input. Private replacement Modules have no parent; repeated edits do not append
an implementation history to Node's shared module children arrays. The default
Wasm cache retains only the current module and uses the full current identity.
There is no new subprocess architecture or process-wide immutable-tree rule.
Files may change between calls; changes detected during a call prevent publish.

Separate prepare/consume and default/prebuilt interfaces are retained.
Consumption reads/hashes compiler files but never imports/evaluates the compiler
or falls back to compilation. Exact extraWat UTF-16 code units and tailCalls,
module hashes, 8 MiB module and 128 KiB manifest descriptor bounds are retained.
Preparation exits before host imports, memory, native instantiation and test
assertions. Its successful exit now prints **PREPARATION ONLY** explicitly.
A prebuilt WebAssembly.Module still bypasses compilation and rejects extraWat.

## Executed controls

From the private checkout, all following commands were executed under
`/tmp/d3d-render-cache-focused-oct23/run.py` with `timeout 60`, CPU 60 seconds,
Node heap 256 MiB, MemAvailable >= 805306368, continuous disk accounting,
24 MiB file maximum and streaming aggregate capture before buffering:

```sh
env TMPDIR=/tmp/d3d-render-cache-focused-oct23 \
 node --max-old-space-size=256 test/test-render-artifact-protocol.js

env TMPDIR=/tmp/d3d-render-cache-focused-oct23 \
 node --max-old-space-size=256 \
 docs/re-notes/d3d-render-executable-cache-repair-20261023/independent-corrected.js

git diff --check
```

**34 producer controls + 10 executable-code control groups PASS**, followed by
**both adapted independent reproductions and their compatibility/bounds controls
PASS**. The producer's obsolete loaded-loader rejection is replaced by a stronger
successful preparation with a held, untouched Node cache entry. The new helper
`test/render-executable-cache-controls.js` is invoked by the existing unit test.
The accepted unit classification needs no test-tier change.

The executable controls use the **actual compile-src, closure and watx.js loader**
with four explicit tiny compiler vm stages, tiny source fixtures and host/native
instantiation doubles. Markers prove changed evaluated code, rather than merely
successful identity comparisons: stage change 1 -> 2, actual loader wrapper -> 5,
source -> 15, non-tail -> 25, compile-src -> 12, closure -> 17 and artifact -> 28.
Changed helper code exposes its own fresh result flag through the retained boot
export. Repeated helper/artifact replacements keep shared child counts fixed.
Throw-only adapters, closure, loader, vm stage and orchestration reject before
host instantiation; unsealed reads reject. Supplied host buffers are tiny.
No native WebAssembly compilation, instantiation or 512 MiB allocation occurs.

Producer controls retain matching/mismatching exact target extraWat, tailCalls,
source/compiler/helper invalidation, missing/malformed/unknown metadata, module
hash/size, manifest bounds before allocation, zero consume compiler imports,
no fallback, unchanged default cache reuse and prebuilt compatibility. Both real
D3D target entrypoints are exercised in **preparation-only** mode with doubles;
their rendering/assertions are not executed.

The independent replay is adapted from the rejected report's adjacent
`independent.js`: both stale-code success oracles now require their specific
changed-code errors. Running those corrected controls on the original candidate
fails separately with "Missing expected exception" for the adapter and "Missing
expected rejection" for the loader. Those expected negative exits are retained.
The report's original eight-input seals and remote refs were verified by the
coordinator before assignment; this task does not claim a second independent
review. Full-file adapter/loader hashes and Git blob identities are in
[source-seals.json](d3d-render-executable-cache-repair-20261023/source-seals.json).
No extracted full-compiler excerpt was used or evaluated.

## Resource and setup evidence

The coordinator supplied the exact nine-file sparse checkout; no clone, checkout
or sparse expansion was performed. Its 1,153,670 prepared bytes count as new task
bytes. Initial measured admission was 54,141,836 / 67,108,864 bytes including
actual private files, full shared SQLite WAL/SHM, external launcher/events,
this full session log, 16 MiB future growth, 8 MiB reserve and 1 MiB publication.
Installed Node and read-only donors are standing inputs; no installed executable
was copied. Source fixture copies, temporary/generated data, Git and evidence
are charged within the private 8 MiB cap. No links hide materialized bytes.
Later guards additionally reserve the entire unused private cap, independently
of the 16 MiB future-log allowance (about 62.2 MB projected before publication).
Host-after must remain >= 2,982,150,144 bytes. Exact measurements/commands are in
adjacent admissions and execution receipts. All actual resource bounds passed.

History is preserved: the preceding worker's missing sparse patterns caused
427,419,841 bytes and a real guard failure; it stopped and removed its checkout.
The supplied selection also records its earlier empty-index zero-file correction.
Neither history is reclassified as a successful repair or compiler blocker.
This task's first producer test completed all 34 checks, then its outer monitor
hit a transient stat-after-unlink race. The operation stopped, the failure receipt
was retained, and measurement was corrected to tolerate vanished temporary
files; a changed-wrapper rerun passed. The actual canonical closure then exposed
missing shebang stripping in the private evaluator; that substantive defect was
fixed and the real-adapter controls passed. An optional original-candidate loader
control first found that donor's loader unmaterialized; it was corrected using
the already provided, unchanged actual loader explicitly, without donor mutation.
Expected negative controls are distinct from these harness/setup failures.

The streaming guard reserves 256 KiB for direct bounded inspection/receipt
output, plus its actual checks log inside the 524288-byte aggregate ceiling.
Child test processes inherit CPU/file limits, use Node heap 256 MiB and wall
10 seconds, recheck memory, and inherit streamed stdio. Their temporary trees
stay inside TMPDIR under the same monitored private allocation. The complete
outer command remains bounded to 60 seconds. Raw validation text is retained
byte-exact in JSON to avoid interpreting captured diff whitespace as doc edits.

## Remaining gates and recovery commands — not executed

This task proves only the bounded source/protocol repair. It does not establish
full native admission. Independently measured cold closure 23,342,723 bytes
previously projected **81,512,518 > 67,108,864** before fonts/packages; pngjs is
missing in that cold closure. Exact full source/compiler/fonts/host dependency
availability, pngjs and canonical build gates remain unresolved. The source
snapshot now retains compiler/source buffers while compiling, so a future native
admission must measure this implementation's actual live heap; prior compiler
measurements are not its qualification.

After separate authorization, prepare an exact admitted checkout containing
this repair and the intended fixture revision. Do not copy the full source or
recover packages under this task's allocation. Set REPO and ARTIFACTS to absolute,
separately admitted paths. Wrap **each** command below in the future task's
continuous disk/file/capture guard, stop after its first failure, and preserve
module/manifest hashes. Compiler commands require MemAvailable >= 2684354560,
heap 2048 MiB and CPU/wall <= 900 seconds. Successful exit is preparation only:

```sh
(cd "$REPO" && ulimit -t 900 && env -u WINE_RENDER_ARTIFACT \
 WINE_RENDER_ARTIFACT_PREPARE="$ARTIFACTS/compaction.wasm" \
 timeout --signal=KILL 900s node --max-old-space-size=2048 test/test-d3d-software-compaction.js)
(cd "$REPO" && ulimit -t 900 && env -u WINE_RENDER_ARTIFACT \
 WINE_RENDER_ARTIFACT_PREPARE="$ARTIFACTS/arena-reuse.wasm" \
 timeout --signal=KILL 900s node --max-old-space-size=2048 test/test-d3d-software-ctx-arena-reuse.js)
```

Native commands require fresh MemAvailable >= 1610612736, heap 512 MiB,
CPU/wall <= 150 seconds, and explicit aggregate memory/arena admission:

```sh
(cd "$REPO" && ulimit -t 150 && env -u WINE_RENDER_ARTIFACT_PREPARE \
 WINE_RENDER_ARTIFACT="$ARTIFACTS/compaction.wasm" \
 timeout --signal=KILL 150s node --max-old-space-size=512 test/test-d3d-software-compaction.js)
(cd "$REPO" && ulimit -t 150 && env -u WINE_RENDER_ARTIFACT_PREPARE \
 WINE_RENDER_ARTIFACT="$ARTIFACTS/arena-reuse.wasm" \
 timeout --signal=KILL 150s node --max-old-space-size=512 test/test-d3d-software-ctx-arena-reuse.js)
```

These recipes do not replace fresh mandatory admission and memory checks.
No new readiness task, workers, packages, guest/runtime, boxes or main integration
were performed. Box ID/state/expiry: N/A; no box assigned. Prior boxes remain
stopped, with lifecycle owned by the coordinator. Shadow Man's 128 MiB approval
hold and original Airstrike/Penguin runtime SSH403 remain unchanged.

Publication uses strict trusted-host SSH, the specified identity and the private
task branch only. The first commit stopped because the prepared repository had
no author identity; Codex identity was then set locally in this private repository,
with no global/root configuration change. Commit/actual remote SHA and final admission are retained in
`/tmp/d3d-render-cache-focused-oct23/publication.json` and the append-only root
messageboard. Stop after this bounded task; fresh independent review is next.
