# Retained CRT initializer and termination callback ownership

2026-10-18 retained ownership milestone, compiled and runtime validated.
No `_setjmp` or `longjmp` API is enabled by this change.

The exact source inventory before implementation was:

| Entry | Callback behavior | Continuation |
| --- | --- | --- |
| `_initterm(start,end)` | Forward non-null table walk; singleton cursor/end/return address lost on nesting | CACA0003 |
| `exit(code)` | Drain the instance's CRT registry in LIFO order, close streams, terminate | CACA002C |
| `_cexit()` | Drain the same registry, close streams, return to caller | CACA0038 |
| `atexit(fn)`, `_onexit(fn)` | Register only in the same CRT registry | None |
| `__dllonexit(fn,begin,end)` | Register only in a caller-owned DLL table | None |
| `_exit(code)` | Immediate termination without callback drain | None |

No `_initterm_e` or `_c_exit` handler was present. DLL-local registered functions
may subsequently be run by guest CRT code; registration does not itself transfer
execution to a callback. This is not a claim about other DLL loader callbacks.

The three callback producers now share a private retained frame stack with
sixteen thread partitions, each holding 64 frames of 64 bytes. Each operation
retains its return address, table cursor/end, mode, exit code, return ESP, parent
identity, expected child and root. The existing invocation stack limits live
callback children to 63. Table/registry scanning finds the first non-null slot
without consuming it, allowing child allocation to reject exhaustion before
changing a frame or popping a registry entry. Empty operations allocate neither
frame nor child. Each subsequent callback gets a fresh child identity.

Continuations validate process/thread/root, frame root, mode, ESP, parent and
expected child before consuming the return. Nested init and returning cleanup
preserve the outer operation. Registering more callbacks while draining retains
the existing LIFO semantics. Normal completion restores the parent; budget
yields retain the child. Traps/abandonment leave ownership live until explicit
host-quiescent lifetime reset. Retired frame bytes and cached depths are rejected
by root identity and lazily replaced on the next nonempty operation.

Termination inside an outer callback abandons that outer operation; this does
not emulate SEH unwinding. Identity allocation failure while advancing after a
completed callback also requires explicit reset. Matching a live continuation
and ESP is a lifetime check, not authentication against arbitrary guest branches.

The authored `test/test-crt-init-exit-ownership.js` exercises actual x86 imported
APIs and callback RETs: init → nested init and init → cexit → nested cexit → init,
registration while draining, deterministic callback order, no-op tables, all
three modes, distinct sibling identities, run-slice retention and final ESP.
Guest traps are followed by explicit process reset. Controlled real-handler
probes separately cover wrong ESP/mode/child, retired thread/process roots,
capacity and allocator exhaustion. Preinstantiated shared-memory instances test
interleaved initializer partitions, not simultaneous Worker races. Test-only
registry reset is explicit: the existing instance-global registry's process
reset/Worker sharing behavior is not fixed or validated by this slice.

Source checks: parser/paren checks, census and its mutation tests, generated
region mirror, JS syntax and diff checks. Dynamic tests pass in both modes.
The census adds the CRT helper/handler records and updates only the three CRT
dispatch cases plus the historical test exit wrapper; all labels stay pending.
The wrapper preserves its historical post-return-word stack convention.

Remaining blockers for real nonlocal jumps include the other window/dialog/
enumeration/COM/media/APC/timer and deferred-host callback producers; JS alias,
dynamic-entry and exception/restoration audits beyond the conservative census;
cross-family nesting with those producers; actual concurrent Worker lifetimes
and CRT registry ownership/reset; saved-context rejection for thread/process/
callback/SEH lifetimes; actual jump buffer/register/stack restoration and guest
x86 tests in both dispatch modes. Generic sync hooks still pop a current token
without a retained expected token for every producer. Census counts or current
depth are not proof of complete ownership. The API review lock remains closed.

Validation requires root's explicit sole-runtime grant and source review.
Restore only the compiler/test closure and run this fixture with and without
`--no-tail-calls`, then the existing CRT init/exit regressions under the standard
guard: admission above 2 GiB + 128 MiB, stop below 2 GiB + 64 MiB, 180 seconds,
8 MiB logs, recorded canonical hashes and detached process-group cleanup.
Preserve ignored modules and run evidence before any build.

## Validation receipt

2026-10-18, source `64c5182b5` (fixture `05231e6c4`, including populated exit
and cexit registry capacity/identity exhaustion failure-atomicity checks):
normal gated build, actual guest CRT fixture in both dispatch modes, qsort and
bsearch in both modes, token primitives, production PE/NE/init_thread lifecycle,
and existing CRT close/stream/returning-cleanup and startup-helper tests pass.
The callback tests check registry count and bytes remain unchanged on failed
entry, alongside all retained frame and invocation bytes. No game was run.

Candidate SHA-256 is
`859e7e86b5bd7a763b94eb5a0eb2ac23f70fda274db5a6610f403d862a33aebd`.
Canonical `db326070` stayed unchanged. All thirteen process groups exited;
no guard fired. Lowest recorded free disk was 2,804,133,888 bytes. Evidence is
`scratch/runs/20261018-crt-init-exit-validation/`, including per-command logs
and JSON, guard, artifact hashes, sparse expansion/recovery receipts and the
preserved prior canonical module. The initial exact sparse addition was 836
files, 15,047,822 source bytes / 16,769,024 allocated bytes; render-helper.js
added another 9,023 source bytes / 12,288 allocated bytes for CRT regressions.

Two failed setup/gate receipts are retained. The build ESP gate recognized the
removed cexit helper; its delegation rule now recognizes only exit, cexit and
initterm calling the retained helper, and the full build passed on retry. The
first CRT close test lacked sparse render-helper.js; restoring that tracked
dependency and using existing root NODE_PATH dependencies passed, without an
installation or production change. Compiled artifacts remain in this task's
ignored build directory; restore the recorded sparse closure to reproduce.
