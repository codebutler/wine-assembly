# Army Men same-surface BltFast conformance, 2026-10-20

The source-phase account below is historical. The subsequent full-VM
validation and two adjacent test-fixture corrections are recorded at the end.

Base: `origin/main` fetched and resolved to
`515897841fde86f9b2e0274387aff10cc9add405`. Isolated sparse worktree:
`/tmp/wa-army-bltfast-oct20`, branch `task/army-bltfast-conformance-oct20`.
No shared HEAD/index changes, workers, game rerun, browser, full build, binary
copies, deployment, Claude panes, laptop scheduler or Heroes II changes.

## Result

The baseline production no-color-key row loop passes all **192** cases using
the eight traced geometries (each separately and in a synthetic sequence,
at four pixel sizes and three pitches). It fails a separate **downward**
same-surface overlap control. Top-down row copies overwrite the next source
row before reading it. Per-row `$memcpy` uses overlap-safe `memory.copy`, so
horizontal overlap within a row is already protected.

The change copies bottom-up only when the backing pointers are equal and the
destination starts below the source within its vertical span. Upward,
horizontal, identity and vertically disjoint copies retain their row order.
The changed production row body passes **276** snapshot cases. This is a
demonstrated synthetic overlap bug, **not an explanation or fix claim for
Army Men's visible stripes**: every captured copy moves upward.

## Original evidence and boundaries

Read retained `scratch/runs/20261019-army-men-scroll-entry-remote-v1/`:
`review.json`, `child.json`, `controller.js`, `pins.json` and trace plan.
Controller SHA-256:
`7c70e72d68cb2d7c2b184c557178e00892bc2938c84fa6d85c3f38a0ddf6ffa7`.
Pinned historical module:
`7fd02a77ec01e5e18065d112b1da434886a0dba3fcadd7ff043d1e2ddca41f33`.
The historical controller records child43272/controller42566 and original
pre-push observations, not current execution or a BltFast return value.

Same source/destination `0x08221080`, flags `0x10`; source rectangles:
`(3,1,640,386)`, `(4,1,640,386)`, `(5,1,640,386)`, `(4,2,640,386)`,
`(3,2,640,386)`, `(2,2,640,386)`, `(1,3,640,386)`, `(0,3,639,386)`.
Destination `(0,0)` except final `(1,0)`. Pitch, pixel format, backing pointer
and returned HRESULT remain unknown. No pitch was inferred from an image.
The synthetic sequence omits intervening guest rendering and is not a replay.

The [Microsoft BltFast reference](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/nf-ddraw-idirectdrawsurface7-bltfast)
describes source-copy/color-key transfers and excludes clipping. These cases
are valid, in-bounds, no-color-key copies; they do not extend clipping,
color-key, compression, aliasing-between-distinct-objects or error semantics.

## Test architecture and proof

`test/test-directdraw-bltfast-overlap.js` uses only Node built-ins. It extracts
and interprets the actual folded WAT no-color-key row body, with explicit
supported operations and an execution budget. `$memcpy` maps to overlap-safe
`Uint8Array.copyWithin`; a source assertion checks the production primitive
still uses `memory.copy`. This avoids testing only a handwritten model of the
implementation, but is **not compiler or full-handler runtime validation**.

The oracle independently maps destination pixels from an immutable pre-call
snapshot, including each byte of multi-byte pixels. Two literal pixel matrices
check the oracle for horizontal and downward overlap. Entire buffer comparison
also checks row padding, untouched pixels and allocation guards.
Fixtures use synthetic 640x386 surfaces, bytes/pixel 1/2/3/4 and pitches
`640 * bytesPerPixel + {0,4,28}`. None is asserted to be Army Men's actual pitch
or format. Additional controls exercise left, right, down, down-left,
down-right, identity and vertically disjoint copies.

Baseline reproduction, using the new test against the old source:

```sh
git show 515897841fde86f9b2e0274387aff10cc9add405:src/09a8-handlers-directx.wat > /tmp/army-bltfast-baseline.wat
node test/test-directdraw-bltfast-overlap.js /tmp/army-bltfast-baseline.wat
```

Expected baseline result: 192 traced-geometry cases pass, then exit1 at
`down/1/0`, byte1312, actual165 versus expected254. This corresponds to the
second destination row reading an already overwritten source row.

Current source:

```sh
node test/test-directdraw-bltfast-overlap.js
node tools/check-wat-fragments.js src/09a8-handlers-directx.wat
node tools/check-parens.js src/09a8-handlers-directx.wat --no-diff
node tools/check-wat-logical-and.js
node --check test/test-directdraw-blt-clipping.js
git diff --check
```

All pass. The label checker reports existing large-depth-change warnings,
with balanced parentheses and labels in scope.

`test/test-directdraw-blt-clipping.js` already uses `bootRenderHarness`, which
compiles the full module. Its fixture now supports padded pitch and adds five
actual BltFast same-surface cases with flags0x10, full pixel/padding snapshots
and HRESULT assertions. **Only syntax checked here**: running it and normal
build gates is pending a separately admitted full VM validation lane. No
gameplay or performance claim follows from the source-level tests.

Small evidence and check receipts:
`scratch/runs/20261020-army-bltfast-conformance/receipt.json`,
`baseline.log`, `conformance.log`, `fragments.log`, `labels.log`,
`logical.log`, `syntax-conformance.log`, `syntax-runtime.log`, `diff.log`.
The receipt records input/source hashes; Git retains tests and this recovery
recipe, not ignored run evidence. Free disk at the receipt was 2,318,901,248
bytes, above the 2GiB floor.

## Next diagnostic, requiring a new assignment

The authored full-handler regression has now passed in the admitted environment
recorded below.
For Army Men itself, a future bounded diagnostic should observe the same
actual call at handler entry and return: surface identity, resolved backing,
width/height/bpp/pitch, source RECT/destination/flags, returned HRESULT, and
small pre/post pixel samples that distinguish a packed row from a pitched row.
Compare bytes against a pre-call snapshot before attributing corruption to
BltFast. Include the first sample before the copy to detect pre-existing
corruption. The existing pre-push trace alone cannot establish that the copy
executed successfully or that incorrect bytes originated in this handler.
No such runtime was performed or authorized in this assignment.

## Runtime context verification limitation

Before source edits, read `~/.codex/AGENTS.md`, project `CLAUDE.md`, app notes
and latest messageboard. Runtime session ID:
`01a158cb-20d2-7981-b2fd-fd8339d624f3`. Read-only `logs_2.sqlite` queries found
no per-thread compaction/200000 records; a bounded recent-global query only
showed coordinator48000 `BodyAfterPrefix` rows. Thus **200000 total could not
be verified from available runtime evidence**. This limitation was appended
to the shared messageboard before edits. No config-only verification claim
or repeated probing followed.

## Full-VM validation, 2026-10-20 10:34–10:38 UTC

The coordinator assigned `bx_b7sxrkh9` exclusively for this synthetic
validation. No game, benchmark, held diagnostic or local full build ran.
Source was `9951a1d83d98b80418cb72e053242cbb5b09e659`, streamed with
`git archive --format=tar.gz` through the documented Boat Files upload API.
All 6,864 regular source files were SHA-256 verified before and after the
initial tests. Archive SHA-256:
`4ff05820a2b8c884b1c33e50bffa4f691f6317f16e0e2133f5ab5bc4700ed638`.
Fresh `origin/main` remained `515897841fde86f9b2e0274387aff10cc9add405`;
no merge was performed.

Remote root: `/home/user/army-validation/source`. Node `v24.18.1`, npm
`11.16.0`. Setup and normal build both exited zero:

```sh
timeout -k 10s 300s npm ci --ignore-scripts --omit=optional
timeout -k 10s 480s bash tools/build.sh
```

Normal tail-call module: 1,874,813 bytes, SHA-256
`76ff73ed52bce2cbc60bf7234eced7aa9963b4dd2ff2a309299cc6225c28e638`.
Compatibility module: 1,877,386 bytes, SHA-256
`d70adaf6c634931a93766ffb6ef8159107897d473990a78012daf01a86422a71`.
All normal build gates passed, including compiled data-segment overlap checks.

Each test ran serially using:

```sh
timeout -k 10s 180s node \
  --require /home/user/army-validation/observe-compile.js test/TEST.js
```

The retained external observer wraps `compileSrcWasm`, saves and hashes its
returned bytes, and returns those same bytes unchanged. The tests compile the
full source closure with their own test exports, so their module hashes differ
from the normal build. No handler or host behavior was replaced.

| Test | Result |
| --- | --- |
| `test-directdraw-blt-clipping.js` | PASS clipping and five real-handler same-surface/padded-pitch cases, including down and down-right |
| `test-directdraw-ckey-blit.js` | PASS 3,640 cases, 8/16/24/32bpp |
| `test-directdraw-blt-status.js` | PASS surface/query validation |
| `test-directdraw-dxt-blt.js` | Initially FAIL at Lock, then PASS after fixture correction |
| `test-directdraw-palette-format.js` | Initially FAIL at GetSurfaceDesc, then PASS after fixture correction |

Both initial failures were `E_INVALIDARG` (`0x80070057`). Substituting only the
pre-patch DirectDraw fragment from `515897841` reproduced both exact failures;
the fixed fragment was then restored and hash-verified. The DXT test filled
the output descriptor with `0xcc`, including `dwSize`; the palette test left
`dwSize` zero. Existing `$dx_surface_desc_valid` requires the legacy descriptor
size, 108. Each correction initializes that one field before calling the real
handler. Both corrected tests passed with their original assertions intact,
using the same compiled module hashes as their initial failing runs.
Production source was unchanged. Final source verification found exactly
these two test-file differences from the archived commit.

Evidence recovered and SHA-256 verified on the host:
`scratch/runs/20261020-army-bltfast-fullvm-validation-2/`.
`recovered/` contains the full build/install/test logs, original failures,
baseline controls, corrected results, source postflights, exact test commands
and `artifact-manifest.json` with all normal/harness module hashes.
`source-manifest.json`, upload receipts, exec receipts, `stage.py`,
`observe-compile.js`, `run-tests.py`, `baseline-check.py`, and
`corrected-tests.py` retain the source and reproduction procedure.
The recovered evidence archive is 6,958 bytes, SHA-256
`5914e5b1fe698145b31d5a5c06405bda800a42ff9944dc1f39cbb223d98970ed`.
Module binaries remain remote; they were not duplicated onto the disk-limited
host. Rebuild from the pinned commit and use the retained observer to reproduce
the listed hashes.

This validates the synthetic downward self-overlap fix. The 192 captured
upward-geometry source cases already passed the baseline; Army Men's terrain
stripes remain unexplained, and no gameplay improvement is claimed.

## Integration review, 2026-10-20

Fresh `origin/main` was still `515897841fde86f9b2e0274387aff10cc9add405`,
the laptop Warcraft III commit and ancestor of both reviewed commits.
An isolated sparse checkout fast-forwarded through `9951a1d83` to
`3b4330ef5`; production source is identical to the tested source.
Independent review verified all 47 local evidence hashes, all 6,864 source
manifest entries against Git blobs, baseline handler identity, both corrected
fixture hashes, original/baseline failure logs and successful test/build logs.
The observer returns the compiled bytes unchanged; initial and corrected
DXT/palette harness hashes match. Binary hashes are retained remote observations,
not a claim of locally recovered module binaries.

The canonical shared Army task text matched main before the scoped ledger
update. Unrelated shared ledger edits, HEAD/index and laptop work were left
untouched. Only static evidence/ancestry/diff review ran during integration;
no new build, runtime, browser or deployment. Exact task/main push receipts
are recorded on the append-only shared messageboard.
