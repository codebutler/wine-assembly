# POSITIONT tiny-RHW causal repair, 2026-10-23

**Finding: production scalar perspective correction overflows; the fixture input
and opaque-red oracle are justified. Candidate repair is tested offline only.**

The retained baseline from `80b28a502f18f933c2bf5b45be04a26e79acbf9a`
failed at `test/test-d3d9-positiont-com-qualification.js:180`, via `check:137`
and `frameOracle:28`. `baseline.log` retains the actual assertion diff: expected
red/opaque bytes become zero in covered pixels. Nine prior COM/software-pixel
cases passed. The assertion compares complete 256-byte BGRA frames; preceding
draws exercise depth, but this first failing BGRA assertion does not itself dump
the depth buffer. No baseline replay occurred in this task.

## Causal data flow

Exact inputs are fixture `7aef3ff22f0dbe4fbfe739196bf92ad7a9435fb6`, accepted
offline `aea185d3dfc1b772cea00ca1a4aed14b9553dfed`, and the supplied retained
source manifest. `source-excerpts.txt` records numbered original source lines
and verified blob/SHA identities; `candidate-delta.json` records the exact delta.

1. Fixture lines 119–125 store FLOAT4 position, red diffuse `[1,0,0,1]`,
   UV `[.25,.25]` with `DataView.setFloat32`. Lines 179–180 submit triangle
   `(0,0),(4,0),(0,4)`, z=.5, RHW=1e-39 after clearing an 8x8 target black,
   opaque, depth=1. The white 1x1 texture and MODULATE apply to RGB and alpha;
   depth LESS accepts .5. No geometric or texture-state reason changes red.
2. The actual Float32 RHW is **1.0000002153053333e-39, bits `0x000ae398`**.
   It is positive and finite. Its Float32 reciprocal is **Infinity**.
   `lib/d3d-shader-ir.js:135–137` rejects it before descriptor allocation:
   shared admission requires positive power-of-two RHW in `[2^-16,2^16]`.
   The earlier shared admission protection therefore cannot fix this fallback.
3. `lib/d3d9-software-backend.js:328` emits transformed flags17, including
   screen-space output16. `src/09aj-d3d-fixed.wat:513–516` copies POSITIONT
   unchanged. The backend sets the pretransformed raster flag at lines899–900.
   `src/09ah-d3d-software.wat:584–600` uses RHW directly as `iw`, copies XYZ,
   and stores each varying multiplied by `iw`. This admits the finite tiny RHW
   without ever reconstructing infinite clip-space W.
4. Original raster lines1264–1292 interpolate `iw`, compute `riw=1/iw`, and
   multiply interpolated varyingOverW by `riw`. Here nonzero diffuse becomes
   Infinity, zero diffuse becomes NaN, and UV becomes Infinity. Direct division
   `varyingOverW/iw` remains finite (zero, one, and .25 for this fixture).
5. `src/09ag-d3d-shader-vm.wat:1252–1255` explicitly returns zero samples for
   nonfinite UV. MODULATE then combines zero with infinite/NaN diffuse;
   `src/09ah-d3d-software.wat:829–831` maps NaN channels to zero. This explains
   the observed zero color/alpha bytes. This is a source/arithmetic causal
   finding consistent with the retained failure, not a newly observed native
   frame or an assertion of native repair success.

## Minimal candidate and rejecting evidence

Only production path changed: `src/09ah-d3d-software.wat`. New helper at
lines823–826 retains reciprocal multiplication when the reciprocal is finite,
and uses direct division otherwise. Three existing correction sites (fog,
28 main varyings, four secondary-color components) call it. No geometry,
admission, fixture, expected frame, depth, sampler, or fallback policy changed.
No 286-pin refresh: the original pin file is untouched. The candidate intentionally
requires independent source-delta review before a provenance-qualified rebuild.

Run from this isolated repository:

```sh
python3 docs/re-notes/render-positiont-tiny-rhw-cause-repair-20261023/run-focused.py
```

The JS probe parses the source, checks balanced expressions and all three helper
call sites, and interprets the actual helper's small scalar expression using
`Math.fround` after each arithmetic operation. It imports only Node builtins.
`arithmetic.json/log`: exit0, ten covered pixel centers, 30 finite tiny-RHW
quotients, exact zero/one diffuse and .25 UV; finite-reciprocal cases including
unequal weights remain bit-identical to the original multiplication.
`reject-multiply-mutation.json/log`: exit1 at `finite tiny-RHW quotient` after
restoring the old multiplication expression. This is a rejecting arithmetic
control, separate from the three unexecuted COM controls. Both process groups
were reaped; captures remain below the shared 512KiB limit.

## Admission, preservation, and remaining qualification

`focused-admission.json` records tool paths/hashes, manifest/input identities,
installed tools and read-only donors separately, and task source/Git/index/temp/
evidence, EXTERNAL launcher, separate Codex JSONL/growth, and 8MiB reserve.
Initial projection 29,402,768/67,108,864 bytes; host free after projected growth
5,953,718,640 >= 2,982,150,144. Node runs in place, old-space256MiB (not an RSS
limit), CPU/wall60s, file24MiB, bounded aggregate capture with TERM/KILL and reap.
Each probe records fresh MemAvailable >=805,306,368. No dependency installs.

The original retained module remains 1,883,322 bytes,
SHA256 `93f41b0fdce5494a235c789bd92f5dcf6cddb7ee16d721d0654a9f9958e7f0bb`;
provenance remains 1,002 bytes,
SHA256 `190a3d56230da32fcba586230ec08e6a6d96c552cc475eece9750a8e84373383`.
Neither artifact was modified. Their recovery/build recipe remains the guarded
qualification donor report; Git does not back up the ignored module bytes.

Native validation, canonical/diagnostic compilation, corrected COM pixels/depth,
allocator reuse, queue lifetime, final release and all three original COM controls
remain **UNQUALIFIED/UNEXECUTED for this candidate**. The helper introduces calls
in the hot loop; native inlining/performance is also unmeasured. A fresh independent
task must review the one-path delta, explicitly update that source pin, admit a
new guarded diagnostic build and run the complete unchanged fixture plus its three
controls. The original retained module cannot contain this repair and must not be
used to claim it passes. No native execution was indispensable for this finding.

No workers, builds, WebAssembly constructors, arenas, COM execution, guest,
Boat/browser/GPU, shared integration, main mutation, merge, deployment, cleanup,
or intervention in other processes. Shadow Man, RichEdit, Claude B&W2 and laptop
claims preserved. No box assigned/contacted: ID/state/expiry N/A; lifecycle and
any future shutdown remain coordinator-owned. Stop after publication; coordinator
assigns independent acceptance and any native retest.
