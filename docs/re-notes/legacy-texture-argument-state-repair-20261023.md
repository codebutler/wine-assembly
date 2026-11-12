# Legacy texture argument state repair

Implementation completed 2026-10-24 on review revision
`d84f4da79fce87e80e998d48e6fdb2a11c9961fe`, following source candidate
`547460d4dfb6966b72cc28c04efac22a809d784f` and original baseline
`5406777ecbcef9cf9b03b40d592d722bb0086de0`. Implementation commit:
`79e81ba5c425d6aa1f8506787d7a7c19909dccac`. This is the implementation
worker's evidence, **not independent acceptance or main integration**. The
earlier capability removal remains subject to coordinator review.

## Cause and repair

SetTextureStageState and the loader correctly retained zero-valued DIFFUSE.
The GPU descriptor omitted all four argument states, and JS substituted
TEXTURE/DIFFUSE for both RGB and alpha. The software triangle caller likewise
forwarded only operation numbers to a combiner assuming that fixed pair.

The descriptor now carries COLORARG1/2 and ALPHAARG1/2 at DWORDs 41–44.
Its 180 bytes at scratch +64 fit the existing 256-byte allocation (end +244).
JS independently lowers all four operands. The software caller packs operand
choices into the existing internal raster operation words: low byte D3DTOP,
bit 8 ARG1=diffuse, bit 9 ARG2=texture. Both real triangle/span routes preserve
these words; the actual combiner resolves RGB and alpha separately before
selection/multiplication. Existing raw-operation callers keep their prior
TEXTURE/DIFFUSE convention and require no signature change.

The actual device initializer calls a new texture-stage initializer. Stage zero
defaults to COLOROP=MODULATE, ALPHAOP=SELECTARG1, ARG1=TEXTURE and ARG2=CURRENT
for both channels; later color stages default to DISABLE. CURRENT at stage zero
is the incoming diffuse value. Explicit DIFFUSE=0 stays a real selector; zero
is never used to mean an unset argument. The one necessary change outside the
core/GPU files wires this initializer into `d3ddev_init_state` in the DirectX
handler file.

## Verification

`test/test-legacy-texture-operation-caps.js --negative-controls` passes:

- Original nine operation pairs, seven distinguishing unsupported-operation
  cases and five rejecting controls remain. The original baseline still fails
  the same capability assertion, after executing its behavior checks.
- All 16 DIFFUSE/TEXTURE assignments to the four argument fields, crossed with
  all nine SELECTARG1/SELECTARG2/MODULATE RGB/alpha pairs: 144 cases. Texture
  `a0c08040` and diffuse `8060a0e0` differ in every channel. An independent
  per-byte integer oracle checks the actual lowered GPU stage and actual WAT
  combiner, plus framebuffer pixels through both production triangle callers,
  the production triangle rasterizer, sampler and span writer.
- Actual initialized defaults, explicit stage-zero CURRENT, nine unbound GPU
  combinations and both unbound software routing decisions. Unbound software
  tests record dispatch to the untextured triangle import; they do not claim
  to render that separate rasterizer. Bound tests render real fixture pixels.
- 32 unsupported selector/modifier configurations decline GPU submission.
- Ten new rejecting mutations cover hardcoded GPU operands, RGB and alpha
  ARG1/2 swaps, crossed RGB/alpha operands, each of the four hardcoded WAT
  descriptor fields, dropped software argument words and crossed software
  operation words. Together with the original five: 15 rejecting controls.

The independent `argument-reproducer.js` is retained byte-for-byte, checked
against its sealed review Git blob. It passes this repair: stored and lowered
COLORARG1/ALPHAARG1 are both zero. It rejects the retained exact original
baseline with the original SELECTARG1 assertion. Baseline execution temporarily
uses the original baseline GPU source and baseline WAT, then verifies restoration
of the repaired JS; the producer fixture itself retains its baseline-rejection
oracle. The reproducer's textual `loweredSelectionRGBA` field is a hardcoded
historical diagnostic, not a recomputed pixel; its actual assertions concern
lowered selectors. The expanded test supplies independent pixel evidence.

GPU batching and points regressions also pass. Exact commands, preflight,
compiler absolute paths/Git blobs/full SHA-256, excerpt byte ranges/line ranges,
ordering and assembled identities are retained in the adjacent evidence. The
preflight runs before compilation and reuses verified unchanged compiler blobs.
Each Wasm fixture uses one 64 KiB memory; Node heap is exactly 256 MiB, wall/CPU
60 seconds and admission requires MemAvailable >=805306368. Allocation/device
lookup imports are fixture doubles, unrelated paths trap if unexpectedly used.

## Remaining semantics and qualification

This implements stage-zero DIFFUSE/TEXTURE operand selection for the three
specified operations, with CURRENT's stage-zero diffuse equivalence for defaults
and explicit CURRENT. It does not establish later-stage CURRENT or multitexture
semantics. TFACTOR, SPECULAR, TEMP, CONSTANT, other selectors, COMPLEMENT (0x10)
and ALPHAREPLICATE (0x20) remain unsupported. The GPU declines them; software
retains its old operand fallback for these unsupported values. Neither path
claims correct modifier behavior. Unsupported operations still take the legacy
MODULATE fallback, including the independently identified COLOROP=DISABLE
defect. No capability mask was weakened or changed by this repair. Passing
these tests does not certify the remaining mask as universally truthful.

Source/small authentic excerpt qualification only: no full COM, 512 MiB native
guest, default/full build, browser/WebGL pixels, native suite or gameplay was
run or claimed. No packages/downloads/workers/boxes were used. Box ID/state/
expiry N/A; coordinator owns lifecycle and all prior boxes remain stopped.
Shadow Man's 128 MiB/runtime403 and the separate fixture's historical-accounting
holds are unchanged. The root tracked tree/index/refs and held D3D fixture
directory were not used for changes or integration.

## Accounting and recovery

This continues the original 64 MiB independent-review allocation and original
SQLite baseline. Both existing private directories, all named task output and
prompt/launch files, predecessor/current session identities, positive cumulative
SQLite/WAL/SHM growth and old highwaters remain counted. The initial 553886-byte
charge was retained, including the earlier bootstrap and disclosed inspection
exceptions; this report does not claim pristine prior compliance. Historical
`guard.py`, `targeted-guard.py` and blocker receipts remain unchanged. The new
`implementation-guard.py` preserves CAP=786432 and extends accounting roots and
sessions, with before/after hash receipts. See the final resource receipt for
measured/projected bytes and cumulative capture, including measured outer output.

Routine fixture corrections (authentic helper dependencies, global types, color
write mask and ARGB texture format) were completed in this task. Required
instruction reads used the authorized measured cap. Several focused code/board
inspections exceeded an internal command slice; their charged bounded output
and cleanup receipts remain, and subsequent reads were narrowed. These were
internal slicing corrections, not cumulative allocation/memory/capture denials.
No cumulative guard was reset or weakened. An isolated 32-byte capture rejection
left its sentinel absent and verified owned-process-group cleanup. All retained
execution receipts include TERM/5-second/KILL cleanup verification.

Recovery uses `/tmp/legacy-texture-operation-caps-oct23/repo` and
`/tmp/legacy-texture-caps-independent-accept-oct23`. The latter retains the original
baseline WAT/reproducer, continuation guards/contracts, compiler/excerpt
preflights, baseline driver, guard control, manifests and execution.jsonl.
Run `python3 .../g.py cheap node --max-old-space-size=256
test/test-legacy-texture-operation-caps.js --negative-controls` from the private
checkout, setting LEGACY_CAPS_RECEIPT as needed; first refresh the manifest-only
receipt and run `implementation-preflight.py`. Independent reproduction uses
REPRO_RECEIPT and the unchanged argument-reproducer.js. The baseline driver
`implementation-baseline.py` serializes the temporary original JS substitution
and restores the candidate in `finally`. Do not run accounting writers concurrently.
Raw ignored artifacts are retained locally; Git evidence and these recipes are
the remote recovery record. Only the task branch is published; no main merge.
