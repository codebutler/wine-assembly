# Shadow Man diagnostic hooks: REQUEST CHANGES

Historical source last updated, 2026-10-23. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

The synchronous copy/stop mechanism and source placement are useful, but this
candidate is **not ready for an incident capture**. Required changes are a
deferred arming interface, binding the observed module to the claimed identity,
and reviewed build/census prerequisites. None was repaired in this review.

## Required changes and independent controls

1. **Arm immediately before the selected actual input send, not instantiate.**
   `shadow-man-null-preload.cjs` always calls `capture.arm` immediately after
   instantiation; until-zero arm immediately calls `set_null_diag(1)`. There is
   no public defer/arm callback, input action, batch/command/HWND selector or
   bounded multi-window policy. Existing `createCapture.arm` is one-shot, and
   callbacks before arm are failures. The actual runner's `dlg-cmd` branch
   resolves a dialog, calls `we.send_message(dlg,0x111,ev.cmdId,0)` at line 8461,
   and only then logs the input receipt. That receipt is too late. A timer,
   exported `run` wrapper or `--trace-at-start-batch` does not supply this
   synchronous pre-send boundary to the existing helper.

Independent native control executes the **entire actual
   `$wnd_send_message_inner` body**, a scripted stdcall/run dependency, actual
   CACA0005 branch and actual run-zero predicate. Default-off returns 57005 and
   restores caller EIP/ESP/GPRs. Enabled mode emits sender-pre then first-zero
   and traps before event2/restoration on this **legitimate successful return**. This is expected diagnostic behavior, not evidence of a NULL defect. Eager
   startup arming can therefore stop at the first ordinary synchronous callback. A separate actual modal-completion-prefix control produces 32 events in 16
   completions; completion 17 traps before any later target. Startup event-count
   exhaustion is a concrete possibility, not bounded away by this adapter.

2. **Bind the actual instantiated Module to the verified bytes.** The preload
   hashes `--wasm=...` independently, then forwards any Module it receives to
   the original instantiate. Our driver appends a valid custom section to the
   original 902-byte fixture before compile, while naming the unchanged file
   and SHA. Both normal and different-module cases exit 86 with a successful
   first-zero record claiming the named file's identity. This is a failing
   rejecting control. It does not allege that the pinned runner normally swaps
   modules: the real runner's compile(Module)/instantiate form is correct, but
   the adapter's claimed wrong-module rejection is absent. Minimal correction:
   bind verified compile input to its returned Module (for example a WeakMap
   established at the compile wrapper), then reject an unbound/different Module
   before instantiation. Preserve the named-file hash check and reject other
   instantiate forms, competing modules and contexts explicitly.

3. **Reconcile the exact callback census before any build.** Direct use of the
   pinned census scanner against its exact unchanged baseline finds changed
   hashes for `$run`, `$wnd_send_message_inner`, `$win32_dispatch_inner`, and
   unknown producer `export:null_diag_token`. Its mandatory check rejects these;
   the full census was not run against an incomplete closure. Review lifetime
   reasons and affected export reachability, then explicitly update the ledger
   in a separately authorized change. No automatic baseline regeneration or
   bypass is accepted. The new `.cjs` candidate test is also invisible to the
   pinned `.js`-only discovery regex: explicit execution here is real evidence,
   but does not register lasting suite coverage. Add a discoverable wrapper or
   deliberately extend discovery and timeout coverage before integration.

## Bounded arming contract for a future authorized capture

There is **no complete existing helper argv** satisfying this contract. No
runtime command is proposed. The precise missing interface is a synchronous,
one-shot callback between dialog resolution/validation and the selected
`we.send_message` call, with input identity and access to the actual instance. A minimal correction could add that runner callback/input action and expose
deferred helper arm. An adapter facade intercepting the actual exported
`send_message` call could also implement it, but is not present or qualified. Wasm exports are immutable properties; merely assigning a JS wrapper to the
original exports object is not such an implementation.

Use a dedicated already-selected target process, actual pinned runner, complete
retained fixture, finite external watchdog and absent exclusive output file. While startup and Configuration/OK run, diagnostics and target trace stay OFF. After observable successful OK and selection of the new launcher, validate the
resolved dialog and exact input action, then arm synchronously **before** final
Beenden's send. Historical input identity is command 3 / HWND `0x1001c`, batch
2578996 in run `20261023-shadow-man-settings-observer-repair-runtime`; these are
historical evidence, not reusable fresh-run constants or a reliable delayed
wall-clock selector. Require a fresh resolved HWND and stage receipt in the
future run. Record action sequence/batch/command/resolved HWND and pre-arm state
in the output before executing the send. Reject unexpected/repeated arm.

For **historical pre-block capture**, use the original module, 1,879,387 bytes,
SHA256 `ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553`. Enable only existing trace range 0x004015d4..0x004015d4 after that boundary,
clear competing breakpoint and synchronously stop on the first matching decoded
block. No new module is needed. Early appearances before arm must neither
capture nor consume quota. This records a continuation context and loaded code,
not necessarily the faulting instruction. If the address is never reached, the
watchdog reports failure; it must not invent a successful zero capture.

For **revised diagnostic first-zero capture**, require a separately built and
distinctly hashed module and its four diagnostic exports. Start both source and
host counters at arm; reserve one of 32 records for terminal first-zero (the
decoded-block record counts against the host quota). Source event 33 and host
quota exhaustion remain terminal failures. Use a window confined to the selected
send, with a separately specified finite watchdog and event budget; do not keep
it enabled through arbitrary startup, input waits or earlier sends. A legitimate
CACA0005 inside this window may still be the first zero. Classify it as observed
normal synchronous completion if proven, never as the incident's zero writer. This mode observes the first run-loop zero, not "first erroneous zero". If the
assignment instead requires skipping legitimate zeros, it needs explicit
continuation/thunk identity and scope filtering, which this schema/helper does
not provide. A block-required policy must reject first-zero-before-block rather
than silently declare the incident captured.

## Source ordering and semantics accepted within scope

`src/09c3a-dialog-runtime.wat:195` emits sender-pre after saving all caller
registers/yields and allocating invocation/depth, before pushing the 20-byte
callback frame. Saved EIP/ESP equal the caller pair; other saved GPRs are
observable in that pre-event's current registers, not additional exported saved
locals. Token/root/depth belong to the current allocated child, not a proven
modal-frame owner. Event2 at line 256 is after the nested run loop but before
identity checks, depth leave, completion calculation or restoration. The actual
64-round abandonment control emits events1/2, with current ESP=callerESP-20 and
current EIP=wndproc at event2, while saved fields retain the caller pair. It
then restores the caller. That proves the placement in this focused execution,
not reproduction of Shadow Man's callback.

`src/09b-dispatch.wat:1037` emits modal-frame-consume after sentinel adjustment,
EndDialog state handling, teardown, owner/focus notification and possible
reentry, immediately before current ESP+4..20 is consumed. Its savedEip is the
locally captured retiring return address; savedEsp is the current consumed
frame, not the original CACA0004 entry. It cannot capture pre-teardown pump
state or prove that frame was the original API frame. Our actual completion
prefix test mutates private pump/return in the teardown dependency: event3
correctly sees that changed state while savedEip remains the retiring return. At line 1055, event4 sees previous pump fields already restored, EAX=result,
EIP=retiring return and ESP=consumedFrame+24, before ended/result/quit reset. Both savedEsp values identify the same consumed frame. This ordering is useful
and accurately labelled in the candidate report.

`src/13-exports.wat:105` reports zero at the start of the run-loop iteration
before last_run_halt update/return and before the enclosing sender can restore. Its saved fields are zero/not applicable. Source first-zero traps even with a
returning observer. CACA0005 intentionally writes EIP=0; this hook adds no writer
provenance, instruction address, operand source word, last-thunk discriminator
or modal ownership proof. The historical zero writer remains **UNKNOWN**.

The new flag defaults to zero; hook globals do not change when off; no new
host import, allocated memory region, modal logic or restore policy is added. Static neutrality is supported by the real sender off-control. This does not
qualify full-module semantics, timing/performance, other users of host.log_eip,
all handler routes or production runtime. Explicitly arming always authorizes
diagnostic stopping, including otherwise ordinary zeros.

## Copy, read, retention and process contract

The imported observer runs synchronously, including nested WAT calls. It copies
nine current register values, ESP-32..ESP+95 and 64 loaded guest code bytes at
0x004015d4. Strings and deep-frozen records do not retain mutable views. Each
event reads fields synchronously from the same instance; no asynchronous guest
resume intervenes in this single-thread contract. Decimal i64 token/root strings
preserve current bit identity (signed Wasm BigInt representation), not ownership
attribution. Stack-span wrap is rejected. Production `guest_read8` calls `$gl8`:
these exports use the guest translator rather than guessed region bases. No
proof of mapping/executable provenance or VFS/executable identity follows merely
from getting byte values; retained full fixture/module identity remains required.

The original native fixture and preload process test pass. Independent cases
verify named-file wrong SHA rejects with exit1; exclusive output preserves its
original bytes and rejects with exit1; `--spawned-child` rejects with exit1;
missing exports terminate with exit86 and a **capture-failed** terminal record. Thus exit86 alone never means success. A valid success requires all records and
seals, expected terminal reason/order, no capture-failed reason, the scoped
input/module IDs and no continuation. Preload performs synchronous write/fsync
and exits the OS process before its continuation marker; failure of retention
is already covered by the original helper test. No independent syscall-level
power-loss/short-write/directory-durability qualification is claimed.

The preload replaces log_eip only after the pinned runner constructs imports,
so that construction cannot overwrite it. It calls the previous observer only
for unrelated addresses. Worker-thread context and explicit child flag are
rejected; process ancestry is not inferred, and arbitrary independently launched
children lacking that flag cannot be detected. Select the target process
explicitly and do not propagate preload through an installer tree. A second
instance is forbidden. No guest worker/import-start callbacks or instantiated
start-function compatibility was exercised. The adapter uses neither
instantiateStreaming nor an exported-run interception to claim nested coverage. Exit86 abandons the process; it is not a pause. The runner's event-loop wall
guard cannot interrupt a synchronous Wasm spin: a finite **external process
watchdog** is still required. No watchdog/runtime was launched here.

## Verification and limits

```
node test/test-shadow-man-null-capture.cjs
node test/test-shadow-man-null-independent-review.cjs
GIT_NO_LAZY_FETCH=1 python3 docs/re-notes/shadow-man-null-hook-independent-review-20261023/check-source.py
node docs/re-notes/shadow-man-null-hook-independent-review-20261023/check-census.cjs
```

The independent test succeeds by confirming the negative findings, not by
declaring the candidate accepted. Its child argv/exits/stderr/output are retained
in `independent-tests.json`. Each child has a 5s process timeout. Exact original
902-byte native replay evidence is separately prefixed `original-replay-*`;
the donor's evidence is untouched. The new native fragment is 3,394 bytes,
SHA256 `5b874002a970b97d246408739811bd1802a8c31a6dc2357973579ce67c55f8ab`,
fixed **128 pages / 8MiB** memory initial and maximum. Fixture source and binary
are retained. Registers/guest translation, invocation helpers, control/window
services and run/teardown dependencies are scripted seams. The sender body is
unaltered source; modal execution covers the exact sentinel/ended-completion
prefix, not the rest of the pump or entire dispatcher. Two-field EditState is
a fixture declaration for the unentered control path. This is substantially
more handler-placement coverage than the 902B hook fixture, but **neither is
full-handler/interpreter/game/canonical-module qualification**.

The official exact-pinned fragment checker passes the three source files.
1054 export names in `13-exports.wat` have no duplicate declaration; this is
source-only and not a whole-module inventory. Expected local canonical module
paths in root and mechanism donor are absent. No recovery, remote module fetch,
wide artifact search or actual canonical export inspection occurred. The
initial attempt to identify gate scripts against root working files found a
different build script and stopped; exact candidate Git objects already present
in root were read instead. No lazy fetch or identity substitution.
