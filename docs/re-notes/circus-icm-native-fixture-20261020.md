# ICM callback ownership: real-x86 fixture (2026-10-20)

## Independent integration review

Reviewed `f36a60d3684fd5ee994632c969981f9a3e163fe1` against main
`ee3a71e3398a98a360d02c25d02bfeb544f0e14f`. The integration preserves
the existing caps, RichEdit and WinHelp changes. Only the ICM wrapper,
its two dedicated fixtures, this report and its census entry change.
The production patch matches original `066436de9`; the initial native
fixture matches `1bae355fc`, followed by the three-line capacity trace fix.

Independent checks verified all 110 recovered artifact hashes and the
archive hash, matched 6,415 manifest blob IDs against the tested Git tree,
replayed all six native acceptance assertions against retained logs, and
regenerated guest code/DLL bytes identically. Five corrupted exit-marker
controls were rejected. The 15-case extracted-source suite passed; current
main before integration failed its acquisition-before-write assertion.
The retained original capacity failure has zero markers; the trace control
and final run have 63, with identical generated capacity code and DLL.

These checks corroborate the canonical build and native qualification at
**exact source `8f6dcc71c7d3685e764da945e6c379ecca30fa49` only**.
The module hash below agrees across original/final qualification receipts
and the final runtime receipt; module bytes were not retrieved or rehashed
by this reviewer. **The combined integration tree has not been built or
fullVM tested.** No Boat action or runtime execution occurred during review.
Original failure evidence remains unchanged. Replay and result:
`scratch/runs/20261020-icm-qualified-integration/{verify.js,verification.json}`.
The historical source-only sections below describe their earlier assignment,
not the present qualification status.

## Executed qualification on new authorized box

**Full build and all six native runs PASS**, 2026-10-20 12:03 UTC,
on `bx_6czhvg6m` (Linux x86-64, Node v24.18.1, V8
13.6.233.17-node.50). Runtime lease released at 12:04 UTC; box left running
for the coordinator's queued tests, eligible expiry 15:53 UTC.

Fetched main `7ddcd0572b132759c9122c80492e9f9c161a047a` plus original
source patch `066436de903151fb03194884f63ab72e0f9071dc` and fixture
`1bae355fcf5aa17eb275b0b19514d04efda2595a` produced initial exact source
`037c885c4022fdb1e058ebb8f0f470ab9cfad8f2`. Final tested source is
`8f6dcc71c7d3685e764da945e6c379ecca30fa49` on
`task/icm-fullvm-newbox-oct20`. No integration to main.

Canonical `bash tools/build.sh` passed all gates on both initial and final
source. The shipped full module is 1,874,862 bytes, SHA-256
`6642ceea29e035531819fafe795f949ad0d343460fa73af5d23ee3b2f2a968e2`
for both builds. No extracted module, altered exports, compiler transform,
or production workaround was used.

Ordinary, nested, sliced, timeout, capacity, then fresh-process ordinary
all passed through `test/run.js`. The first four exercise caller registers,
ESP/canary, callback results and 70 subsequent sibling calls. Capacity
observed exactly 63 DriverProc entry markers, `unreachable` at the next
acquisition, exit 1, and no returned marker. The next ordinary process
passed. The separate source-model suite also passed 15 cases; it is not
the basis for this runtime result. Coverage limits below still apply,
especially private ownership mismatch injection and in-instance recovery.

One demonstrated fixture defect was corrected: the default host `log`
sink discards `OutputDebugStringA`, so the original capacity assertion
reported **0 rather than 63 markers** despite the expected native trap.
The retained original run is baseline evidence. Running the same generated
PE/DLL and exact same module with existing
`--trace-api=OutputDebugStringA` produced 63 markers. The fixture now adds
that flag only for capacity. All six cases then passed without changing
the generated guest or production code. The fixture observes API arguments,
not delivery to a debugger log sink.

Evidence is self-contained under
`scratch/runs/20261020-icm-fullvm-newbox/`: `recovered/build.log`,
`recovered/qualification.json`, `recovered/icm-native/runtime-receipt.json`,
all per-case generated PE/DLL/overlay files and logs,
`recovered/original-fixture/`, `recovered/capacity-trace-control.log`,
and source manifests. The recovered archive SHA-256 is
`a75c9699f9b63c3da4ff08fc5d4681f564e1b198d7d7e4d07ba24a46871aaf22`;
all 110 entries in its hash manifest were checked after retrieval.
No full checkout, build, or module duplicate was created on the main host.

Staging used exact Git blobs and verified the source manifest remotely.
The first build lacked tracked `fonts/Terminal.fon`; the first attempted
runner startup lacked tracked `test/binaries/tlbs/stdole2.tlb`. Both
staging failures are retained; adding the same-revision dependencies
resolved them without source changes. No commercial game media was needed.
`boat push` requested SSH and was denied; authorized Boat file upload/download
APIs and working API execution handled transfers and execution instead.
No old box was contacted. No dependency installation was needed.

Recovery: restore the final tested Git revision, include tracked fonts and
`test/binaries/tlbs/stdole2.tlb`, run `bash tools/build.sh`, then use the
four environment variables in `recovered/qualification.json` with paths
adjusted to the recovery checkout. `qualify.js` records source validation,
module hash, environment and exact invocation. Run the command documented
below. Recompute and pin the recovered build's hash rather than assuming it.

## Original source-only fixture report (historical)

Target: `066436de903151fb03194884f63ab72e0f9071dc`, based on fetched
`origin/main` `d3c332ab8f186564db28226f6484a95be8ae1674`.
**Native suite UNEXECUTED.** This assignment permitted source-only syntax,
fixture generation and static inspection; sandbox.resume403 remains unresolved.
No build, guest execution, runtime probe or production source change occurred.

`test/test-icm-callback-ownership-native.js` follows
`test-icm-installable-driver.js`: generated PE32 EXE, SYSTEM.INI overlay,
loaded x86 DLL export `DriverProc`, production `test/run.js`. The DLL uses
the EXE's resolved IAT for nested calls; it has no DLL-base assumption.
There are no added exports, compiler transforms, invocation/run mocks or
direct calls to ICM implementation functions.

The actual ABI reviewed is `ICOpen(type, handler, mode)`, stdcall 12;
`ICSendMessage(hic, msg, p1, p2)`, stdcall 16; and
`DriverProc(id, hdrv, msg, p1, p2)`, stdcall 20. At DriverProc entry the
arguments occupy ESP+4 through ESP+20. DRV_OPEN's p2 points to ICOPEN,
whose type/handler are at +4/+8. The driver returns an instance ID that
later callbacks must receive. ICClose is stdcall 4.

## Runnable coverage and limits

| Scenario | Assertions designed into fixture (all unexecuted) |
| --- | --- |
| Ordinary | Driver ID, handle, message and parameters; LRESULT; six non-EAX registers, exact ESP and stack canary; caller continuation; close result |
| Nested | DriverProc calls ICSendMessage on the same HIC; inner result and all six register/ESP snapshots; original outer args still produce outer result |
| Sliced | 1,000,100 real decrement/conditional-branch loop iterations exceed the fixed 1,000,000-block inner run budget; completion marker and caller restoration |
| Timeout | Infinite guest loop reaches the existing 64-round bound, returns ICERR_UNSUPPORTED, restores caller and permits another call |
| Acquisition fault | Recursive real ICSendMessage reaches 63 DriverProc entry log markers; child 64 must trap with `unreachable`, without any returned marker |
| Isolation | A second call with new parameters/register seeds plus 70 more sibling calls on the same live HIC follows every successful/timeout scenario; fresh ordinary process after terminal fault |

The callbacks deliberately clobber nonvolatile registers too, testing ICM's
full saved-context contract, not asserting that a Windows driver may disregard
its ABI. EAX is checked as the public API result. EIP/handler resumption is
observed through subsequent guest instructions, API calls and completion.
EFLAGS is not promised by these APIs and is not asserted.

No stale-child/root/depth injection, token identity observation, epoch reset
race, spill-cache exhaustion, arbitrary guest exception/SEH, current-thunk
parking assertion or in-instance recovery after a terminal trap is covered.
The capacity test observes the acquisition trap, not the private ownership
frame or proof that the failed acquisition wrote no guest bytes. The runner
exits immediately on traps, before its normal final memory dump; consequently
this case uses real OutputDebugStringA markers and the crash log, and fresh
process isolation is explicitly weaker than reset of the trapped instance.
Budget crossing follows the inspected production run/branch accounting; the
fixture does not instrument internal slice counts.
The 70 siblings exceed ownership capacity and check the sum of all results,
so a child leaked on each successful return cannot evade this observable test.

These are behavioral regressions, not demonstrated baseline-failing tests
of the three new ownership comparisons. Normal completion is expected to
work before the hardening patch too. The prior 15 source-model cases remain
separate evidence for controlled identity mismatch tests, not native proof.

## Independent ordering review

Reviewed `icm_drv_call` against `src/04-cache.wat`:

1. Pre-entry reads only capture the interrupted context. `sync_depth_enter`
   first calls `invocation_sync_enter`: ensure/validate lifetime, capacity
   check, allocate identity, then publish the child. Only afterward does it
   pin spill state and increment sync depth. Moving it before guest frame
   writes protects the acquisition-failure boundary.
2. The retained child/root/depth are read after entry and kept in WASM locals,
   so nested callbacks cannot overwrite them. `invocation_current` itself
   validates thread/root/process epoch before returning the stack token.
3. After ordinary completion or the bounded timeout, all three comparisons
   precede `sync_depth_leave` and restoration. This matters because
   `invocation_sync_leave` alone passes the *current* token to
   `invocation_leave`, which does not prove it is this ICM call's child.
4. Leave pops ownership first, then decrements depth/unpins spill state and
   may force the spill desk. The patch preserves that production ordering.
   It then captures callback EAX and restores the interrupted registers,
   steps, yields, EIP/handler flag and current thunk.
5. A trap bypasses this epilogue; the patch does not promise finally-style
   cleanup. Timeout with matching ownership still retires the incomplete
   callback and returns unsupported, preserving the existing policy.

No demonstrated defect within this hunk was found. Native qualification of
its rejection guarantees remains incomplete; no production fix is justified
by this source-only review.

## Recovery and approved future execution

Evidence: `scratch/runs/20261020-circus-icm-native-fixture/`.
It contains the fixture source snapshot, generated tiny PEs, disassembly,
static validation script/log, inspected source snapshots and hashes.

Source-only regeneration:

```sh
node --check test/test-icm-callback-ownership-native.js
node test/test-icm-callback-ownership-native.js --generate-only=/tmp/icm-generated
```

Only after a new explicit runtime/build grant: check out this task commit in
a complete authorized checkout, perform its normal `bash tools/build.sh`,
retain the exact source/build receipt and module SHA-256, then run:

```sh
WINE_ASSEMBLY_WASM=/absolute/path/build/wine-assembly.wasm \
WA_ICM_WASM_SHA256=<sha256-from-normalbuild> \
WA_ICM_SOURCE_REV=<exact-40-character-source-commit> \
WA_ICM_ARTIFACTS=/absolute/path/evidence/icm-native \
node test/test-icm-callback-ownership-native.js
```

The suite refuses an unpinned module and never builds. It retains every
generated fixture, command, stdout/stderr log and a runtime receipt, including
failures. The revision is operator-supplied provenance, not independently
attested by the module. No module hash is available from this assignment.
The new filename receives the existing default unit-tier classification;
explicit module prerequisites intentionally fail closed if it is invoked
without qualification inputs. No test-tier policy was changed.
