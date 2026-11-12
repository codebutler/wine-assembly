# Tiny-RHW diagnostic rebuild passed; later COM allocator reuse failed

**GUARDED_DIAGNOSTIC build exit 0; unchanged COM baseline exit 1.** The tiny-RHW
`finite-RHW1e-39-honest-fallback` complete BGRA/depth oracle now passes. The first
unexpected result is later, at fixture line 203:

```text
AssertionError [ERR_ASSERTION]: production allocator must actually reuse freed address 1010564
```

Execution stopped immediately. Full COM qualification is **not accepted**.
Allocator reuse was not established; queued-byte execution, later invalid-range
checks, final resource/device release and all three negative controls remain
**UNEXECUTED**. No allocator cause is inferred from this assertion. No source,
fixture, assertion, oracle or production repair, repeat build or baseline retry
was performed. The nine preceding shared/native pixel cases pass, followed by
the repaired tiny-RHW fallback and real allocator-failure recovery. The emitted
oversized-request OOM line belongs to the fixture's intentional allocator failure
control; execution continued to its recovery pixel oracle before the reuse failure.

The raw [baseline log](render-positiont-tiny-rhw-native-qualification-20261023/baseline.log)
retains every case and the assertion. Its tiny-RHW and recovery frame SHA256 is
`069cb5c92909e798f22ae3012ba1d319cfe7ab542151cfdcd77755e3b1e584b0`.

## Exact accepted inputs

Production repair `301b568d2c9359a5fe8c8336002412c2c5d9f5e3` and independent
review/single pin `345ea682b7ff6f70d942315051c01f935e1bbcd2` were consumed without
changes. Review acceptance was `ACCEPT_OFFLINE_SOURCE_ONLY`; this report adds
only the native fixture evidence actually executed here. Source
`src/09ah-d3d-software.wat` is blob
`538290c4241f9112ff5e16f5cd71735ab38edea9`, SHA256
`43ec7d8685cc4942dbdb30b8c9efacf28ec1add81fed4f55f008b7dbe9c4b0c3`.

The old retained manifest was explicitly substituted at exactly two paths: this
source and `test/support/positiont-com-source-pins.json`. Its only pin difference
is `40c91282b9ba9d10bc26e75b6383b6005362d23c` to the accepted source blob; the
other 285 pins are unchanged. All **286 actual pins**, all **290 closure files**
and their committed Git modes were verified before qualification. The executable
fixture was materialized **0755** from the committed tree; the review donor's
local 0644 mode discrepancy was not propagated or corrected in that donor.

The original fixture `7aef3ff22f0dbe4fbfe739196bf92ad7a9435fb6`, independent
acceptance `aea185d3dfc1b772cea00ca1a4aed14b9553dfed`, readiness
`54d701e9d7f5de8c9e8fc045864228e6d85db01f` and guarded qualification
`80b28a502f18f933c2bf5b45be04a26e79acbf9a` remain read-only. Accepted historical
52 gates, decoder, 27 controls, guard/boundary controls and arithmetic reviews
were reused rather than repeated. Coordinator-verified 19 review and 34 guarded
qualification seals were relied on; no claim of repeating those seal audits.
No speculative source lookup or fallback materialization is part of the runner.

The unchanged builder appends diagnostic extraWat only to `13-exports.wat` and
uses `tailCalls=true`; this is a diagnostic artifact. Embedded historical
candidate/acceptance labels are preserved. The new pin digest and actual source
manifest identify the tested source, rather than those historical labels.

| Identity | Value |
| --- | --- |
| sourcePinsSha256 | `d39a81a012129bd7c81f4f697d0a8317b3869a8195fc6fd32c1ff13fc3431262` |
| extraWat SHA256 | `4bd65ac87452abb4ec5f728f88b399439c9fa4fec91a53b3e6cb96468f58d068` |
| New module | 1,883,361 B; `5d057b5424b710fb28f1c617786ba71d7c8c116fb74e51eac611ec9a79868ef1` |
| New provenance | 1,002 B; `e64c83f925f52649f46e1a89bb952d7dde06d627f7a799f0956a535c1bca8cc3` |

Actual provenance is retained [adjacent](render-positiont-tiny-rhw-native-qualification-20261023/diagnostic.provenance.json).
The original donor module/provenance remain unchanged and do not qualify these
new inputs; their identities are retained in `original-artifacts-readonly.json`.

## Executed commands and bounds

Cwd: `/home/user/wine-assembly-render-positiont-tiny-rhw-native-qualification-oct23`.
The one-shot task-owned `run.py --plan` admitted the complete focused manifest;
`run.py --execute` consumed the single attempt and exited **2**, stopping on the
baseline's unexpected exit 1. It did not invoke the stale historical drivers.
The accepted unchanged capture wrapper supplies wall/capture/process-group bounds.

Build payload, **exit 0**, 2.618 seconds:

```sh
/usr/bin/prlimit --cpu=900 --fsize=25165824 -- \
  /home/user/.nvm/versions/node/v24.18.1/bin/node --max-old-space-size=2048 \
  --require /home/user/wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs \
  test/support/positiont-com-module.js --build-diagnostic \
  build/positiont-com-tiny-rhw.wasm build/positiont-com-tiny-rhw.provenance.json
```

Both outputs were absent before the build. Before the fixture, a Python-only
verification inside the runner checked all actual files/modes, all 286 pins,
module/provenance size/hash and every relevant provenance field, extraWat and
guard identity. It constructed no native module or arena. The unchanged builder
and fixture also run their own original source/provenance checks.

Baseline payload, **exit 1**, 0.111 seconds:

```sh
/usr/bin/prlimit --cpu=150 --fsize=25165824 -- \
  /home/user/.nvm/versions/node/v24.18.1/bin/node --max-old-space-size=512 \
  --require /home/user/wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs \
  test/test-d3d9-positiont-com-qualification.js --qualify --allow-512m \
  --module=build/positiont-com-tiny-rhw.wasm \
  --provenance=build/positiont-com-tiny-rhw.provenance.json
```

It used one shared 512 MiB/8192-page arena and one Instance in a fresh process,
with no worker children. Same-argv controls
`--negative-control=disable-shared-route`, `--negative-control=alias-queued-bytes`
and `--negative-control=corrupt-queued-ir` were planned but **not executed**;
no ARMED or intended-failure acceptance is claimed.

The preloaded guard `9f442e41bb81853659d8664e1aa903e560d4061e`, 2,462 B, SHA256
`47ce2e2b835be33eab6b2b24f027ecaab8ceb61c559890e51548c78199beb197`, was verified
against committed bytes before execution. Independent acceptance `80b28a50` and
24 boundary controls `004eb539fd58168ce935f829e3fb5cd26f350df6` were reused. It
enforces at most 8,388,608 actual input bytes before native Module construction.
This is narrow audited synchronous instrumentation, not a security sandbox.
No ineffective Node wasm-max-module-size flag was used.

CPU/wall: build 900s, qualifier 150s. Old-space: 2048/512 MiB, **not RSS limits**.
Per-file writes <=24 MiB; aggregate stdout/stderr <=512 KiB per command, with
fail-closed exit 125, process-group TERM then KILL after five seconds, Linux
subreaper and full reap. Build captured 0 B; baseline captured 2,349 B. No bound
was hit. Both command receipts show `groupReaped=true`, no adopted descendants.
Measured child peak RSS was **350,810,112 B**; getrusage is a cumulative maximum,
so the repeated baseline receipt value is not an isolated baseline RSS estimate.

`NODE_PATH=/home/user/wine-dashboard-deps-20261014/node_modules` uses installed
pinned pngjs7; installed Node v24.18.1 runs in place. Compiler/cache/coverage/debug
and WINE region/shake/compiler/name override environment variables were cleared.
Compiler VM stages, complete include closure, qualifier data/tools and inactive
optional GPU/Worker/font/authority paths reuse the unchanged accepted closure
review. No dependencies were installed or linked into the private root.

## Admission, handback and publication

A bounded shell dependency watcher waited about eight seconds for Shadow Man
session `01a1675a-ac89-70b3-a94e-956cb1679181` result.json + final.txt. The final
handoff explicitly states all child groups were reaped; owner/launcher PIDs
1821273/1821253 were absent and no owned heavy Node process remained. Its build
success was not a prerequisite. This task began no compile, native Module,
Memory or Instance before that handback and its own fresh admission.

The consolidated measured admission projected **55,561,592 / 67,108,864 B**;
the final fresh pre-staging projection was **55,581,342 B**. It includes private
Git/index/new objects, all source copies (retained through the last consumer),
staging/temp/generated module/provenance/evidence, five full capture budgets,
external launcher events/stderr/watch capture, separate Codex session JSONL and
future growth, plus the **8 MiB reserve**. Standing read-only donors/object stores
and installed executable/dependency footprints are separately measured and
identified. No links hide materialized bytes. Host free after projected growth
was **5,878,348,101 B**, above **2,982,150,144 B**.

Fresh MemAvailable immediately before compile was **3,342,057,472 B**
(minimum 2,684,354,560); before baseline **3,222,482,944 B** (minimum
1,610,612,736). Actual post-baseline accounting plus future growth/reserve was
44,008,497 B. Publication accounting is recorded separately. External launcher
and platform guards were retained. No incompatible or unknown requirement was
bypassed; unknown emitted module size was handled by the accepted pre-native guard.

The isolated branch is `task/render-positiont-tiny-rhw-native-qualification-oct23`.
Only this report and adjacent task-owned evidence/recipes are added; all inherited
entries, production source, pins, fixture and modes remain unchanged in the commit.
Strict SSH publication with BatchMode, pinned known-hosts/key and
GIT_NO_LAZY_FETCH verifies the actual remote task SHA and main
`bb9c496ed13095cc832fdf607f0937fb9c14b7de`; details are in external publication.json
and the append-only repository messageboard.

Ignored build artifacts remain in this allocation. **Git is not binary backup**;
the [recovery recipe](render-positiont-tiny-rhw-native-qualification-20261023/recovery.md)
retains the exact command, manifest, source and tool identities for a separately
authorized future recovery. The attempt is consumed and must not be rerun.

All native command groups are reaped and the heavy phase is released. The first
blocker belongs to coordinator follow-up: actual allocator-address reuse at fixture
203. No repair or reduced assertion is proposed here. Performance/inlining,
WebGL/browser/game/guest/persistence/Play remain unknown. No worker spawn/refill,
Boat/browser/GPU/guest access, shared integration, merge/main/deploy, donor
mutation, cleanup or other-process intervention occurred. RichEdit, Shadow Man,
Claude B&W2 and laptop claims are preserved. No box assigned/contacted:
ID/state/expiry **N/A**; lifecycle remains coordinator-owned. Stop this bounded task.
