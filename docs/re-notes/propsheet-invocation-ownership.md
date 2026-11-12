# Property-page callback invocation ownership

2026-10-18. Source prerequisite for the Circus Linux CRTDLL jump pair; no
jump API is enabled. `propsheet_page_callback` is an explicit example in the
setjmp audit because it restores an interrupted guest context after nested
execution. Its PSPCB_CREATE and PSPCB_RELEASE callers share this runner.

The runner now allocates its child before writing the guest frame and retains
the expected child, root and synchronous depth in invocation-local WAT locals.
Before popping or restoring any caller register it checks those values. A
completed three-argument stdcall must also restore the exact entry ESP. Missing
callbacks still return one without allocating a child. The existing bounded
incomplete-call behavior remains zero with ordinary caller restoration when
the original owner remains current; that behavior is not nonlocal-jump proof.

`test/test-propsheet-invocation-ownership.js` authors real x86 callbacks using
an imported GetTickCount and RET 12. It exercises nested and sibling callbacks,
with guest instructions capturing all three stdcall arguments in separate
records and asserting NULL hwnd, CREATE/RELEASE message and guest page pointer;
multiple run slices, missing flag/function, malformed RET, bounded timeout,
guest trap, host exception, leaked child, equal-depth sibling substitution,
changed synchronous depth and process retirement. Capacity and ID exhaustion
assert unchanged registers, stack bytes and private ownership state. The test
exposes the actual internal runner, reduces only its run budget, and supports
both normal and `--no-tail-calls` compilation. It does not exercise the entire
property-sheet UI or actual OS Worker scheduling.

Source validation: changed fragment parser, census (396 records, one reviewed
record changed), census mutation tests, JS syntax and diff whitespace checks
passed. **The new guest test has not run and no build was performed.** Run both
dispatch variants under the root's exclusive runtime grant, followed by normal
build and existing property-sheet, synchronous-window, token and lifecycle
regressions before integration. Sparse dependencies must be restored by exact
closure with the usual 2 GiB floor; no binaries are part of this commit.

Traps retain the child until explicit host-quiescent reset. Concurrent process
or slot replacement is not made safe. Other synchronous runners, retained
CACA families, cross-thread send, JS COM, timer/wave/APC paths, SEH, saved-buffer
validation and the dispatcher nonlocal restore exception remain separate
prerequisites. The inventory continues to mark all ownership pending.

## Granted compiled validation

The source-only status above was superseded by root-granted validation on
`6f8e31979c0a31381f7018db37311e4b5b96ae70`, incorporating reviewed main
`ea57e62de`. Both dispatch variants of the actual-x86 fixture passed, including
the explicit guest-captured CREATE/RELEASE argument values and nested records.
The normal gated build, existing property-sheet page-handles, wide and
main-hwnd regressions, synchronous-window ownership, private token and
production PE/NE/thread-lifecycle tests all passed. No game was run.

The candidate is 1,870,624 bytes, SHA-256
`da72a16f9551cb2cd8bc2f0ee636eb966ec9c7cde9a56931201bb6d1fb11a2c7`.
The root canonical artifact remained SHA-256
`203163dda45d61b905a53bfbe2ad0128d006092b087a73d48a776bafd330ead0`.
All nine process groups exited; no disk, deadline or log guard fired. Minimum
sampled free space was 3,250,712,576 bytes. Guards admitted above 2 GiB + 128 MiB,
stopped below 2 GiB + 64 MiB, and capped each command at 180 seconds and 8 MiB.

Evidence remains in the isolated worktree under
`scratch/runs/20261018-propsheet-ownership-validation/`: per-command receipts
and logs, artifact hashes, prior canonical/combined copies, source pins,
preflight and guard. The granted preflight's actual free space was
3,316,080,640 bytes (the initial board claim quoted an earlier reading).
Restore its exact `build-closure-paths.txt` with sparse-checkout before
reproduction; restore the verified 94,208-byte `test/binaries/calc.exe` from
the fixture source recorded in `granted-preflight.json`. Use the existing
`/tmp/wa-local-runtime-deps/node_modules` through NODE_PATH, without installs.
Run the nine commands recorded in the JSON receipts under `guard.js` and a
fresh disk admission. Git does not preserve these ignored artifacts; keep the
evidence directory and fixture separately. The task checkout is narrowed after
validation, preserving its ignored build and evidence. Remaining ownership
and jump prerequisites above are unchanged.
