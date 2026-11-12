# Retained qsort comparator ownership

2026-10-18 source milestone, based on integrated main c8399aa73. This
instruments qsort only; it does not enable `_setjmp` or `longjmp`.

Each nonempty qsort keeps a private 64-byte frame in the calling thread's
partition of QSORT_CONTEXTS. The frame retains the root, parent invocation,
expected comparator child, expected cdecl return ESP, and algorithm state.
Nested qsort calls use separate frames. Each comparator receives a new child
identity; budget yields preserve that identity until the real CACA002D
continuation validates and removes it. Empty qsort calls create no identity.
The existing invocation stack capacity (63 children) remains the tighter bound.

Continuation validation checks live process/thread/root, retained frame root,
expected ESP, and expected child before popping ownership or modifying guest
arguments/data. Normal completion restores the parent. Comparator traps or
abandoned runs deliberately retain their frame and child: recovery requires
the existing explicit, host-quiescent process/thread lifetime reset. This is
not SEH unwinding. Reset invalidates old frames without clearing their bytes
or immediately zeroing the instance's cached qsort depth; the next nonempty
qsort lazily starts a fresh frame stack under the new root.

This is an emulator lifetime check, not authentication of arbitrary guest
control flow: a guest can deliberately branch to the active continuation
with the matching stack. The retained token prevents completing a different
live invocation or a retired root, not every forged guest RET.

`test/test-qsort-invocation-ownership.js` is authored for the real full-source
WAT compiler and x86 imported-qsort/comparator-RET/CACA002D path. It covers
nested sorts, no-op sort inside a comparator, distinct sequential identities,
budget yields, final array/ESP/root restoration, wrong ESP and stale expected
child rejection with unchanged state, thread/process reset at nonzero frame
depth, and guest comparator trap retention followed by explicit reset.
It additionally exercises interleaved main/worker instances sharing memory,
production init_thread and separate qsort frame partitions, with guest worker
comparator execution. Controlled real-handler probes fill 63 retained frames
and exhaust the identity allocator, asserting failed entry changes no state.
These are not simultaneous OS Worker races. The same fixture accepts
`--no-tail-calls` for the alternative compiler dispatch mode.
The fixture now preinstantiates the sibling before loading guest code, then
attaches the thread while the comparator is active. This avoids active data
segments overwriting live shared state; late module instantiation is not
covered. Both modes passed again during the bsearch validation milestone.
It now passes compiled execution in both dispatch modes. Controlled direct-continuation probes supplement the
guest path and are not claimed as guest execution themselves.

The census delta is limited to eight reviewed definitions: invocation_ensure,
invocation_sync_enter, handle_qsort, qsort_frame_at, qsort_frame, qsort_probe,
qsort_continue and qsort_finish. The scanner also inventories bare qsort
owner/depth mutations. Every ownership label stays pending. The census is a
conservative source review baseline, not a proof of exhaustive producer coverage.
Deferred bsearch/initterm/atexit, window/media/APC callbacks, JS restoration,
thread concurrency and SEH remain outstanding, as does actual x86 testing of
both eventual nonlocal-jump dispatch modes. The nonlocal API review lock stays.

## Validation and recovery recipe

Future validation requires root's explicit sole-runtime release. Reuse the prior validation
guard recipe in `scratch/runs/20261018-callback-token-validation/guard.js`,
copied to a fresh run folder: admission above 2 GiB + 128 MiB, stop below
2 GiB + 64 MiB, 180 seconds, 8 MiB logs, detached process groups and recorded
canonical before/after hashes. Preserve existing ignored artifacts and logs.

First restore only the missing test compiler closure (compile-src.js,
test-dll-lifecycle-real-pe.js and tools/watx-closure.js, plus any verified
transitive dependency), then run the authored fixture in both modes under
the guard. Commands on Node 24 are `node
test/test-qsort-invocation-ownership.js` and the same command with
`--no-tail-calls`. Both commands passed under the explicit runtime grant.
Normal gated build and prior token/lifecycle/NE/arena regressions follow
only if separately admitted and granted; the built region map differs from
the old ignored candidate, so old compiled artifacts cannot validate this
source. Verify exact sparse expansion bytes before restoring build closure.

Validation completed on 2026-10-18, based on 1ba5b7a02 plus the fixture-only
cache reset: normal gated build, both qsort modes, token primitives, production
PE/NE/init_thread lifecycle, NE context, NE module transaction, arena spill,
CRT stdio, rewind and fdopen all passed. Candidate SHA-256 is
`718297bd8867e1a0a05f7c152d05492b3365995dd20106dfc165a0cabf3fa895`
(1,868,634 bytes); canonical `c3ae99a8` stayed unchanged. Evidence lives at
`scratch/runs/20261018-qsort-ownership-validation/`: per-command JSON/log,
guard, artifact hashes, exact closure preflight and sparse recovery receipt.
All process groups exited, no guard fired; successful runs stayed above
2,490,363,904 free bytes. No game or browser was run.

Failed setup receipts remain: Node 24 rejected the obsolete experimental
return-call flag; the first real fixture run reused decoded code after replacing
the synthetic image at identical addresses. The fixture now explicitly calls
the real clear_cache helper after load_pe (loader ownership reset is tested
separately; this does not claim full in-place process execution reinitialization).
The stdio run first lacked pngjs; using existing dependencies with
`NODE_PATH=/tmp/wa-recovery-20261014/node_modules` passed without installation.
No production behavior was changed in response to these fixture/setup failures.
