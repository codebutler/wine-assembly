# POSITIONT reuse failure: fixture checkpoint observes storage after reuse

The failure is a **demonstrated fixture defect**, not evidence of an allocator
defect. The production frees work. The fixture waits until the recovery draw's
backend execution has coalesced and reallocated the compiler's freed storage,
then requests the original sizes at the original addresses. Those sizes no
longer describe the blocks at those addresses.

The fixture-only candidate moves the identical real allocator/poison/hash proof
to the copied DRAW packet handoff before backend execution. It searches larger
targets first so its own allocations cannot split a pending smaller target.
The existing 64-attempt/target and 1 MiB limits, exact-address assertion, real
allocator, copied-IR oracle, production code, pins, module and modes are retained.
The [exact diff](render-positiont-allocator-reuse-cause-20261023/fixture.patch)
changes only `test/test-d3d9-positiont-com-qualification.js` (100755).

Focused corrected proof **passes**: six real allocations, all six exact addresses,
34,164 requested bytes, poison `0xa5`, unchanged copied vertex/pixel IR hashes,
and subsequent authentic recovery draw complete BGRA/depth oracle. An ARMED
no-op-free mutation **rejects**, but reaches the unchanged 1 MiB guard rather
than the narrower assertion string expected by the task runner. That runner's
postcondition exits 1. Execution stopped; no retry or fourth process occurred.
This is a fixture candidate for fresh independent review, **not full native
qualification acceptance**.

## Source-level cause and ownership

Read-only exact input: `74377b3382e03a7ead1a3e33981321b768d6c3ca`, branch
`task/render-positiont-tiny-rhw-native-qualification-oct23`, donor
`/home/user/wine-assembly-render-positiont-tiny-rhw-native-qualification-oct23`.
Its report, baseline log, complete manifest, provenance and accepted reused
closure/guard/gate/arithmetic evidence were read; no old runner was executed.

* `src/10-helpers.wat:2868` implements real `heap_alloc`: four-byte header,
  `max(16, align8(request+4))` extent, exact/next-larger bins through 256 bytes,
  then first fit on the free list. Splits take the **tail**, preserving the
  remainder at the original block start. Whole-block consumption allows less
  than 16 bytes of unused remainder. Successful recycled allocations zero
  their requested aligned payload. Free (`:3117`, `:3214`) validates the
  header/arena, links to a bin/list, increments frees and updates live charge;
  it does not itself coalesce.
* `src/09ai-d3d-render-lifetime.wat:159` flushes bins, sorts free blocks by
  address, merges adjacent free blocks, then sorts by size. No live blocks
  are moved. `lib/d3d9-software-backend.js:495` calls it in `prepare()`, after
  `idle()` releases previous active draw ownership.
* `lib/d3d-shader-ir.js:75` copies IR with `.slice()`; `readFixedBundle`
  reads bundle offsets 4/8 as vertex/pixel IR. Its `fixedPositionT` finally
  (`:161`) frees the bundle and descriptor before passing the packet onward.
* `src/09aj-d3d-fixed.wat:136` frees offsets 4,8,12,16 then the bundle.
  `src/09ag-d3d-shader-vm.wat:92` converts each linear pointer through `w2g`
  before `heap_free`. The trace uses actual `q_w2g` and actual header extent
  `q_heap_payload`; these are original allocation starts, not inferred interior
  pointers. It records bundle wrapper entry/exit, actual guest free calls,
  allocator results, coalesce results, and a passive block-header walk.

The original traced recovery increments frees **210 → 215** for the five
bundle blocks, then **215 → 216** for descriptor `0x100f41c`. Backend preparation
frees previous state, coalesces **17** adjacent blocks, allocates draw state,
renders and frees transient allocations. Only then does the original fixture
select its six historical targets and start searching.

| Target guest payload | Original owner / payload capacity | At original search checkpoint |
| --- | --- | --- |
| `0x1010564` | bundle / 36 B | backend already allocated 4 B at this exact start, capacity 12 B; subsequently freed, extent 16 B |
| `0x1032464` | vertex IR / 16,420 B | interior of coalesced block, header 16925376, extent 74184 |
| `0x100b0ec` | pixel IR / 16,420 B | same start, shrunken free block extent 11776 |
| `0x1010f04` | vertex VM / 532 B | interior of block, header 16846488, extent 936 |
| `0x101081c` | pixel VM / 468 B | interior of block, header 16844760, extent 536 |
| `0x100f41c` | descriptor / requested 288 B (capacity 292) | interior of block, header 16839280, extent 1064 |

At the first target, request 36 needs extent 40. It cannot return the existing
16-byte block at `0x1010564`; the 64 recorded requests return other starts.
The exact original assertion is:

```text
AssertionError [ERR_ASSERTION]: production allocator must actually reuse freed address 1010564
```

`1010564` is **hexadecimal**, generated with `toString(16)` (decimal 16844132).
The search limit is not a bound on the allocator's ability to return a historical
start after coalescing/splitting. Increasing it is unjustified and could consume
or corrupt a different owner. The candidate instead proves reuse while the six
target extents are still the just-freed compiler allocations, before subsequent
backend allocations intervene. Largest-first preserves remaining target extents;
both IR extents are equal, so the first two allocations may return in opposite
order and the existing set records both.

## Three sequential native processes, no builds

All consume the **same retained** module and provenance by explicit absolute
paths; the driver has no default compiler entry. Module:
1,883,361 B, SHA256
`5d057b5424b710fb28f1c617786ba71d7c8c116fb74e51eac611ec9a79868ef1`.
Provenance: 1,002 B, SHA256
`e64c83f925f52649f46e1a89bb952d7dde06d627f7a799f0956a535c1bca8cc3`.
All 286 pins retain digest
`d39a81a012129bd7c81f4f697d0a8317b3869a8195fc6fd32c1ff13fc3431262`;
tiny-RHW source remains blob `538290c4241f9112ff5e16f5cd71735ab38edea9`.

The accepted unchanged preloaded guard is
`/home/user/wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs`,
SHA256 `47ce2e2b835be33eab6b2b24f027ecaab8ceb61c559890e51548c78199beb197`.
It enforces <=8 MiB input before native construction. Accepted boundary/guard,
52 gates, decoder and arithmetic checks were reused, not replayed.

Command cwd is the private root
`/home/user/wine-assembly-render-positiont-allocator-reuse-cause-oct23`:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 docs/re-notes/render-positiont-allocator-reuse-cause-20261023/run.py original
PYTHONDONTWRITEBYTECODE=1 python3 docs/re-notes/render-positiont-allocator-reuse-cause-20261023/run.py focused
PYTHONDONTWRITEBYTECODE=1 python3 docs/re-notes/render-positiont-allocator-reuse-cause-20261023/run.py noop
```

Each runner command records its full payload argv in the corresponding JSON:
`prlimit --cpu=150 --fsize=25165824 --` installed Node v24.18.1
`--max-old-space-size=512 --require GUARD instrument.cjs MODE --qualify
--allow-512m --module=DONOR/build/positiont-com-tiny-rhw.wasm
--provenance=DONOR/build/positiont-com-tiny-rhw.provenance.json`.
`NODE_PATH=/home/user/wine-dashboard-deps-20261014/node_modules` uses unchanged
pinned installed pngjs. Compiler/cache/debug overrides are cleared.

The task-owned JS instrumentation observes/delegates real production calls;
it does not change wasm or renderer, queue, oracle, provenance or pins. Original
mode uses the original fixture bytes. Focused mode exits after corrected reuse
and the recovery pixel/depth oracle, before the later queue/release work. No-op
mode skips only the recovery bundle free, logging ARMED, while retaining its
trace, descriptor free and all actual allocator calls. It is a rejecting
mutation, not an allocator replacement or a successful proof.

| Process | Native exit / runner exit | Elapsed | Capture | Peak child RSS | Fresh MemAvailable |
| --- | --- | --- | --- | --- | --- |
| original | 1 / 0 (expected assertion) | 0.102 s | 25,776 B | 97,001,472 B | 3,406,278,656 B |
| focused | 0 / 0 | 0.109 s | 21,345 B | 97,677,312 B | 2,749,030,400 B |
| ARMED no-op-free | 1 / 1 (postcondition mismatch) | 0.107 s | 24,914 B | 97,648,640 B | 3,220,062,208 B |

The corrected proof returns all six starts in six allocations; requested sum
34164 B. Native IR hashes survive poisoning, then the native draw's full BGRA
and depth recovery oracle passes. Raw logs and [causal summary](render-positiont-allocator-reuse-cause-20261023/causal-summary.json)
retain exact events, target maps, commands and assertions.

The no-op control's free counter remains 210 instead of advancing to 215.
No target IR is freed. It makes 63 real 16420-byte requests (1034460 B), without
returning the target; the next request would make 1050880 B, so the unchanged
1 MiB assertion rejects first:

```text
ARMED no-op-free: recovery bundle not freed
AssertionError [ERR_ASSERTION]: DrawPrimitiveUP: AssertionError [ERR_ASSERTION]: real reuse search exceeded 1 MiB; stop for diagnosis
```

The runner expected the exact-address assertion and therefore exited 1 during
its postcondition check. This mismatch is retained, not rewritten as a runner
pass. No external resource bound was hit, and no rerun or search-limit change
was made. This establishes causal rejection of the no-op-free mutation; fresh
independent review must assess that evidence and the fixture before any full
qualification rerun. Queue/final-release and the three original qualification
controls remain **UNEXECUTED** here. No native full acceptance is claimed.

## Admission, integrity and handback

The single consolidated [admission](render-positiont-allocator-reuse-cause-20261023/admission.json)
projected **47,319,461 / 67,108,864 B**, host after projected growth
**5,833,922,885 B** (floor 2,982,150,144). It includes private Git/index/objects,
290 copied closure files (27,367,099 B), directories, evidence/scripts,
512 KiB aggregate captures, external launcher events/stderr, the separate
Codex session JSONL, 6 MiB future growth and 8 MiB reserve. Installed tools,
pngjs, donor/object stores and retained ignored artifacts are separately
measured read-only standing inputs in `standing.json`; no links hide copies.
The original attempt and both focused attempts freshly verified all unchanged
closure bytes/modes, retained artifacts and memory/disk floors before native.
`closure-after.json` verifies fixture-only difference and all 286 pins/modes
unchanged. Source inspection preceded execution.

Private Git initially exceeded nested alternate-store lookup depth while
reading its index. Explicitly listing the already measured standing stores
deepest-first fixed private lookup; no donor/object-store mutation, duplicate
copy, network fetch, repeated admission or native attempt occurred. The setup
correction is retained rather than concealed.

Each native process has exactly one 512 MiB shared 8192-page arena, no Workers,
old-space 512 MiB (not an RSS bound), CPU/wall 150 s, file limit 24 MiB and
aggregate task capture 72035 B <512 KiB. Fail-closed capture overflow exit 125,
TERM then KILL at five seconds and Linux subreaper/full reap were retained.
Every receipt records `groupReaped=true`, no adopted descendants and no external
bound hit. The peak measured child RSS was 97,677,312 B. All groups are reaped;
the sole heavy arena phase is **released**. No module or provenance regeneration.

Publication seals bind report, fixture and task evidence; final accounting and
strict SSH actual-remote receipt live in the external task `publication.json`.
The branch is `task/render-positiont-allocator-reuse-cause-oct23`, based exactly
on the input revision. All inherited tree entries except this fixture must
remain identical. Git does not back up the ignored retained module: future
authorized reproduction must reuse the named retained bytes and identities,
materialize the complete manifest/modes in a fresh isolated task, and take a
new admission. These three attempts are consumed; do not rerun this driver.

No workers spawned/launched/refilled, shared integration/main/merge/deploy,
compiler/build, donor mutation, Boat/browser/GPU/guest or test-box contact.
Shadow Man independent offline inspector review `01a1676a`, RichEdit, Claude
B&W2 and laptop claims preserved. Box ID/state/expiry **N/A**; lifecycle remains
coordinator-owned. Stop this bounded task; coordinator assigns any follow-up.
