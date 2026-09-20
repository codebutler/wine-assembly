# Review P5-3: Win16 positioning bridge and deferred gap

2026-09-19: the two Win16 positioning wrappers duplicated insert-after
conversion, but performed it **after** calling the Win32 handler. A mapped
sibling therefore reached the host first as 257, then as the correct 65538.
The extra top-level update was observable; it was not just dead duplication.

Both wrappers now use `$win16_position_insert_after` before entering the
shared handler. Ordinary HWNDs widen once, 0/1 retain their pseudo-handle
meaning, FFFF/FFFE become -1/-2, and NOZORDER bypasses translation of the
ignored argument. The shared post-call bridge still updates USER order and
forwards child order, but no longer repeats the host's top-level update.

`test/test-win16-windowpos-zorder.js` executes both real Pascal wrappers,
covering top-level and child windows, mapped handles, all four pseudo-handles,
an unmapped ignored argument, far return and stack cleanup. The original
implementation fails the first mapped-handle case with two host updates;
the fixed implementation passes. This test preserves the current immediate
Defer behavior only to exercise its conversion; it is not a batching oracle.

The Win32 deferred-transaction and WINDOWPOS changing/changed regressions
pass, as does the full canonical/compat build. Evidence:
`/private/tmp/wa-win16-zorder-before.log`, `wa-win16-zorder-after.log`,
`wa-win16-zorder-defer32.log`, `wa-win16-zorder-changing.log`,
`wa-win16-zorder-build.log`.

## Original gap: real Win16 transactions (addressed below)

At the original audit, Win16 Begin returned constant 1, Defer applied immediately, and End
returns success without committing anything. This differs from the shared
Win32 HDWP implementation, which owns storage and validates queued entries.
Comments claiming equivalent behavior have been corrected.

Microsoft describes retained updates in
[DeferWindowPos](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-deferwindowpos)
and commit-time window-position notifications in
[EndDeferWindowPos](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-enddeferwindowpos).
These current references establish the intended transaction contract, not a
new native Win98 measurement.

The remaining implementation needs a mapped live HDWP, shared queue and
validation, plus a stack-owned Win16 continuation that sends far-procedure
size notifications at End rather than Defer. Simply calling the Win32 End
handler would lose the current synchronous Win16 callback path. Required
tests: unchanged geometry/messages before End, independent batches, invalid
and retired handles, failure cleanup, and reentrant far callbacks that finish
before End returns. The remaining large wrapper duplication should be removed
as part of that change, not used to disguise the immediate-execution shortcut.

## 2026-09-20: shared commit preparation

Extracted `$hdwp_prepare_end(handle)` from the Win32 End handler. It validates
the entire batch, preserves existing abort/error behavior, and marks the
record busy. It returns the record or zero without changing EAX, ESP or EIP.
The Win32 handler still owns its return value, stack cleanup and apply loop.

The original transaction regression passes before and after extraction.
Added direct tests for frame neutrality, busy rejection without releasing
the outer record, retired-handle rejection and 32 release/reuse cycles.
The visibility regression fails its queued-paint assertion (`0 != 65538`),
identically with the original End validation restored in memory; no test
expectation was weakened. Logs: `/private/tmp/wa-hdwp-prepare-before.log`,
`wa-hdwp-prepare-after.log`, `wa-hdwp-prepare-visible.log`,
`wa-hdwp-prepare-visible-baseline.log`, `wa-hdwp-prepare-build.log`.
The full canonical/compat build and gates pass.

Implementation design (now realized below): Win16 Begin/Defer use the shared HDWP storage; End uses
this preparation helper and keeps `{record, next-index}` on its own guest
stack above the ordinary far-return continuation. Each entry is handed to
the existing Pascal SetWindowPos bridge with a dedicated continuation return
address. That bridge already delivers synchronous far WM_SIZE callbacks, so
the next entry can resume only after the previous callback returns. Retain
the busy record until the final entry, then release it and the Win16 handle.
This avoids a second queue, a second validator, and global callback state.
At this prerequisite commit the Win16 transaction implementation was still pending.

## 2026-09-20: Win16 transaction implementation

Begin/Defer now use the shared HDWP allocation and queue, with mapped Win16
handles and signed 16-bit coordinates/counts. Defer no longer calls
SetWindowPos or enters a size callback. End uses the shared complete-set
validator, marks the batch busy, and owns an eight-byte `{record, next-index}`
frame above its ordinary six-byte far-return continuation.

The new FF9C continuation marshals each queued record into the existing
Pascal SetWindowPos bridge. A far WM_SIZE callback returns through that
bridge, then the batch continuation advances. The final step releases the
record and handle mapping and restores the original End return address.
Nested commits have independent guest-stack frames, with no global scratch
or duplicate transaction storage. Busy recursive commits fail without freeing
the outer batch. Failed queueing/validation releases the corresponding mapping
when the shared record has been retired.

Verification:

- The old Win16 implementation fails the new test at independent batch
  identity (both Begin calls returned 1).
- `test-win16-defer-window-pos.js` passes delayed geometry, signed coordinates,
  growth, independent empty/live batches, negative count, invalid window,
  mixed-parent abort, End-time reparent validation, consumed handles and 32
  reuse cycles.
- A real x86 Win16 wndproc increments a counter and RETF 10; the callback
  finishes before End returns. A second real wndproc attempts a recursive
  End on its busy outer batch (fails), commits an independent inner batch
  with its own far callback (succeeds), then resumes the outer batch's next
  entry. Result, original CS:IP, ESP and observed move order all pass.
- The z-order regression now creates a real batch and asserts no host order
  update until End, retaining top-level/child/sentinel/NOZORDER coverage.
- Wrong-kind handles (a live HWND passed as HDWP) fail without retiring the
  unrelated window mapping. Only a formerly live batch retired by the shared
  operation has its mapping removed on failure.
- Win32 HDWP lifecycle and Win16 rectangle-bridge regressions pass. Real
  Rodent and Rattler gameplay tests both pass. Full canonical/compat build
  and all gates pass.

Logs: `/private/tmp/wa-defer16-before.log`, `wa-defer16-final.log`,
`wa-defer16-zorder-final.log`, `wa-defer16-win32.log`, `wa-defer16-rect.log`,
`wa-defer16-vb.log`, `wa-defer16-final-build.log`.

This fixes Win16 queue/commit timing and preserves its synchronous WM_SIZE
path; it is not a claim of complete native notification equivalence. The
underlying Win16 SetWindowPos bridge's coverage of WINDOWPOSCHANGING/CHANGED
and WM_MOVE remains a separate gap. The previously reproduced queued-paint
test failure was separate and was not hidden by this change; its resolution
is recorded below.

## 2026-09-20: queued-paint regression resolved

The visibility test expected the shown EDIT to remain queued after End.
However, SetWindowPos synchronously calls the native painter, and the shared
native dispatch now consumes the completed update. A zero pending handle
therefore did not demonstrate a missing paint.

The test now records the existing `ctrl_paint_trace` import and requires one
successful native-paint dispatch at End, no remaining child update region,
and no pending child paint. It also requires no native paint during Defer,
on hiding, or with SWP_NOREDRAW, while retaining the exposed-parent damage
check. These checks pass. An in-memory mutation replacing the native paint
dispatch with a no-op fails the new exactly-once paint assertion. No runtime
code or queue behavior was changed to satisfy the test.

Logs: `/private/tmp/wa-defer-paint.log`, `wa-defer-paint-negative.log`,
`wa-defer-paint-order.log`. This verifies dispatch/update bookkeeping, not a
new pixel-level or native Win98 timing comparison.

## 2026-09-20: Win16 default WINDOWPOSCHANGED processing

Microsoft's *Windows 3.1 Programmer's Reference*, volume 3, printed pages
210–211 and 424, documents a FAR pointer to seven Win16 WINDOWPOS fields and
assigns WM_MOVE/WM_SIZE generation to DefWindowProc. The original Microsoft
manual is available from this [archive mirror](https://bitsavers.trailing-edge.com/pdf/microsoft/windows_3.1/Windows_3.1_Programmers_Reference_Volume_3_Messages_Structures_and_Macros_1992.pdf).
Read via local PDF/text copies `/private/tmp/wa-win31-messages.{pdf,txt}`;
no Wine source used.

The Win16 default procedure previously forwarded the unconverted segmented
pointer to the Win32 handler, which expects 28 bytes rather than 14. It now
reads the Win16 flags at offset 12 and uses a stack-owned `{hwnd,flags,stage}`
continuation to deliver far Pascal geometry callbacks. Its return record
preserves the caller and zero DX:AX. Nested calls have independent flags and
stages; the stage advances before each callback. The window is revalidated
before the next delivery. Native procedures retain their synchronous path.

Both widths share the existing `client_rect_wh_packed` helper for committed
client size, eliminating the Win32 sender's open-coded copy. Origins use the
existing parent-relative/top-level coordinate helper, not WINDOWPOS outer
geometry. The MOVE-then-SIZE order preserves the shared implementation;
the cited manual does not independently establish that exact order.

`test-win16-windowpos-defproc.js` executes actual x86 RETF callbacks and an
actual nested CALL FAR to USER.107. Before the fix, its first case receives
no messages instead of move/size. Coverage includes all four NOMOVE/NOSIZE
combinations, signed top-level client coordinates, child coordinates relative
to the parent's client, poisoned request geometry, adjacent input guards,
nested calls with different flags, original far return and complete stack
cleanup. Logs: `/private/tmp/wa-defpos16-{before,final}.log`.

The shared Win32 mutation test, Win16 deferred/nested transaction regression,
Rodent/Rattler gameplay, and full normal/compatibility builds also pass:
`/private/tmp/wa-defpos16-{win32,defer,vb,build}.log`.

This fixes default processing as a prerequisite, not the entire positioning
pipeline. Win16 SetWindowPos/MoveWindow still need to send mutable CHANGING
and final CHANGED, and replace their direct WM_SIZE shortcut with this default
processing. Minimized/maximized size classifications and native Win98 event
comparison remain separate fidelity checks.

## 2026-09-20: SetWindowPos far transaction connected

Win16 SetWindowPos now sends CHANGING before committing and CHANGED afterward
to a far application procedure. Its previous unconditional WM_SIZE shortcut
is removed. A procedure consuming CHANGED gets no derived geometry messages;
one chaining to USER.107 gets them through the default continuation above.
EndDeferWindowPos inherits this sequence at commit time.

Each invocation keeps a 60-byte frame over its ordinary far-return record:
an immutable target/original-flags/stage header, the 14-byte far WINDOWPOS,
and a 28-byte canonical commit result. FFA4 resumes after each guest callback.
Mutation is read after CHANGING, with signed coordinates, mapped insertion
handles and protected NOACTIVATE/NOOWNERZORDER flags. The same far structure
receives the committed geometry and normalized NOMOVE/NOSIZE flags. A changed
`hwnd` field cannot redirect the operation; destruction of the actual target
during CHANGING causes failure without a host geometry/Z-order update.

The Win32 ABI wrapper now calls `set_window_pos_core`, which also accepts an
external result buffer for the Win16 transaction. This retains one geometry,
visibility, non-client calculation and retained-DC implementation. A zero
buffer retains Win32 notification dispatch. Both notification mechanisms call
`windowpos_finish_paint` only after CHANGED returns, rather than painting in
advance of an asynchronous far callback. Native Win16 control procedures keep
the existing bridge.

The expanded actual-x86 regression covers mutable negative coordinates/size/
Z-order, protected flags, immutable target identity, identical far-pointer
lifetime across both notifications, consumed versus default-processed CHANGED,
NOSENDCHANGING, no-op suppression, nested SetWindowPos calls with distinct
stack-owned structures, and an actual USER.DestroyWindow call from CHANGING.
Original EIP, ESP and BOOL return are checked. Restoring the old Win16 source
in memory makes the new assertion fail with `[WM_SIZE]` rather than
`[WM_WINDOWPOSCHANGING, WM_WINDOWPOSCHANGED]`.

The deferred test now chains CHANGED to DefWindowProc and counts only WM_SIZE;
it still proves callback completion before End, nested independent commits,
busy outer-batch rejection and outer continuation recovery. Counting every
message as a size callback would mask the notification fix.

Passing: far notification/default regression, native Win16 Z-order, Win32
changing/mutation, deferred visibility, parent/child paint ordering, Win16
deferred/nested transactions, Rodent/Rattler gameplay and both build modes.
Logs: `/private/tmp/wa-setpos16-before.log`, `wa-setpos16-final.log`,
`wa-setpos16-native.log`, `wa-setpos16-win32.log`, `wa-setpos16-visible.log`,
`wa-setpos16-paint-order.log`, `wa-setpos16-defer-final.log`,
`wa-setpos16-vb-final.log`, `wa-setpos16-build-final.log`.

Still open: MoveWindow's separate Win16 direct-size path, default CHANGING
min/max validation, minimized/maximized WM_SIZE classifications, and native
Win98 event-order comparison. This transaction change does not establish those.

## 2026-09-20: MoveWindow joins the far transaction

Win16 MoveWindow now enters the same stack-owned CHANGING/CHANGED continuation
as SetWindowPos, with six Pascal arguments and MoveWindow's initial
NOACTIVATE/NOZORDER and bRepaint-derived NOREDRAW flags. It no longer sends a
direct WM_SIZE when an app consumes CHANGED. The private frame's formerly
reserved word records the operation, so nested SetWindowPos and MoveWindow
calls cannot select each other's commit/finish path.

Its existing geometry/retained-DC logic is now `move_window_core`, shared by
both ABI front doors. `move_window_finish` retains non-client invalidation,
dialog erase, startup pending-size refresh, resize invalidation and the call
to UpdateWindow after CHANGED returns. It uses the commit's normalized NOSIZE
flag to distinguish a resize and reads the current client size for pending
startup notification, including geometry changed by a nested callback.

The shared core also rejects missing targets before host mutation, and the
Win16 native bridge now preserves failure instead of overwriting it with 1.
Callback-enabled Z-order was another silent discrepancy: MoveWindow reported
the mutated insertion target but never sent it to the host. The top-level
commit now forwards it when the callback clears NOZORDER; the existing Win16
child-order bridge remains shared with SetWindowPos.

Tests cover consuming versus default-processing CHANGED, mutable geometry and
Z-order, TRUE/FALSE repaint flags, no update region under NOREDRAW, mixed nested
MoveWindow/SetWindowPos calls, destruction during CHANGING, invalid targets,
and exact Pascal frame cleanup. The Win32 regression checks callback-enabled
Z-order and invalid targets too. Restoring the old Win16 source fails because
host geometry is already committed when the test expects to enter CHANGING.

The [Microsoft MoveWindow contract](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-movewindow)
also requires immediate repaint through UpdateWindow when bRepaint is TRUE.
**That Win16 far-paint behavior remains incomplete:** `update_window_now`
still defers far-procedure painting. The test checks flags but deliberately
does not require deferred paint as the expected native behavior. This is the
next fidelity gap, not a completed repaint claim.

Evidence: `/private/tmp/wa-movepos16-before.log`, `wa-movepos16-final.log`,
`wa-movepos32-final.log`, `wa-movepos16-defer.log`, `wa-movepos16-paint.log`,
`wa-movepos16-vb.log`, `wa-movepos16-build.log`. Notifications, Win32 mutation,
Win16 deferred callbacks, parent/child paint ordering, Rodent/Rattler gameplay
and normal/compatibility builds pass. Default CHANGING min/max behavior,
minimized/maximized size classifications and native Win98 event comparison
remain open alongside far synchronous paint.

## 2026-09-20: synchronous Win16 UpdateWindow and initial erase

Win16 UpdateWindow no longer invalidates the entire window and returns before
painting. It shares damage/native-control preparation with Win32, then uses
an eight-byte invocation-owned `{hwnd, stage}` guest-stack frame (FFA8) for
far erase/paint callbacks. MoveWindow(TRUE) enters the same path after its
position notifications. Clean windows send nothing; partial damage remains
partial; BeginPaint/EndPaint own validation, not the sender. Each callback
stage advances before entry and revalidates the target on return.

This follows the direct, non-queued paint contract in Microsoft's
[UpdateWindow documentation](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-updatewindow).
It is not a claim of complete Win98 painting equivalence: pending erase is
still sent before WM_PAINT, following the existing Win32 implementation,
rather than entered from within BeginPaint. Erase-return/fErase handling and
an exact native event trace remain follow-ups. Microsoft's
[WM_ERASEBKGND documentation](https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-erasebkgnd)
specifies that the callback result controls whether further erasing is needed;
this change does not implement that missing result handling.

The real-game check caught a second shortcut: ShowWindow posted its initial
WM_ERASEBKGND. Tetris's newly synchronous UpdateWindow tiled its client, then
the posted erase wiped those tiles with the gray class brush. The old build
passed the existing screenshot assertion; the first candidate failed it.
No assertion was weakened. ShowWindow now completes the initial erase before
returning through a twelve-byte `{hwnd, client-size, pending-bits}` frame
(FFAC), also retaining its synchronous maximize callback. A nested
UpdateWindow can consume the erase; the outer ShowWindow then skips it.
Queued activation/restored-size behavior and child exposure handling remain
separate limitations, not implicitly fixed by this change.

Coverage and outcomes:

- Actual far BeginPaint/EndPaint, original partial rectangle, clean/hidden
  updates, nested UpdateWindow, MoveWindow(TRUE) completion, destruction in
  erase, narrowed HDC and exact far-return/stack restoration pass.
- ShowWindow completes initial erase without posting one, does not repeat it
  on an already-visible window, and tolerates UpdateWindow inside maximize.
- Restoring the old UpdateWindow body fails the clean-damage test. Restoring
  the old ShowWindow body fails the synchronous initial-erase assertion.
- WEP1 gameplay passes **8/8**, including Tetris's original About-background
  and hard-drop checks. Rodent/Rattler and Hearts startup pass. Shared Win32
  parent/child painting and Win16 deferred/nested transactions pass.
- Solitaire's opening deal and all seven columns render. Its drag assertion
  fails on both candidate and pre-change baseline (unchanged column pixel
  count); that separate failure is recorded, not suppressed or called a pass.

Evidence: `/private/tmp/wa-update16-clean-negative.log`,
`wa-update16-show-negative.log`, `wa-update16-show-final.log`,
`wa-update16-tetris-baseline.log`, `wa-update16-wep1.log` (first-candidate
failure), `wa-update16-show-wep1.log`, `wa-update16-show-vb.log`,
`wa-update16-final-hearts.log`, `wa-update16-final-win32.log`,
`wa-update16-final-defer.log`, `wa-update16-show-solitaire.log`,
`wa-update16-show-solitaire-baseline.log`, `wa-update16-final-build.log`.

## 2026-09-20: BeginPaint bridge ownership prerequisite

Extracted `begin_paint_core(hwnd, paintstruct, win16_bridge) -> HDC`. The
Win32 handler now owns only its ABI result/stack cleanup; Win16 calls the
same stack-neutral core directly instead of constructing a synthetic Win32
frame. The Win16 canonical PAINTSTRUCT occupies 64 bytes on that invocation's
guest stack, replacing global `GUEST_STACK` scratch. The temporary global
`win16_beginpaint_call32` is removed; bridge-specific policy is an explicit
argument. Existing Win16 child-fill and clip behavior is preserved even
though calling the core no longer temporarily changes `code16` to zero.

This is preparation for BeginPaint-owned erase callbacks, **not** a fix for
their timing/result semantics. The current brush-derived fErase shortcut,
last-registered class-style lookup and empty-region fallback are still
present. In particular, the Diablo warning attached to the fErase shortcut
must be investigated with real paint sequencing, not removed blindly or
treated as the Windows contract.

The focused test now checks that the core preserves EAX/EDX/ESP, and that
the real Pascal bridge preserves global scratch, adjacent output guards,
partial rectangle, narrowed HDC and far return/argument cleanup. The
existing actual nested paint callbacks also pass. An in-memory mutation
restoring global scratch fails the new scratch-preservation assertion.
WEP1 passes 8/8, Rodent/Rattler pass, shared Win32 parent/child painting passes,
and the normal/compatibility builds pass.

Evidence: `/private/tmp/wa-begin-core-far-final.log`,
`wa-begin-core-scratch-negative.log`, `wa-begin-core-win32.log`,
`wa-begin-core-wep1.log`, `wa-begin-core-vb.log`, `wa-begin-core-build.log`.

## 2026-09-20: default erasing borrows the supplied DC

The next erase-path audit found that DefWindowProc ignored WM_ERASEBKGND's
wParam HDC, allocated a different window DC, and returned success with no
class brush. That made a future BeginPaint callback unable to honor its
update-region clip or distinguish an unhandled erase. Microsoft's
[WM_ERASEBKGND contract](https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-erasebkgnd)
defines the supplied DC and requires a nonzero result only when erasing is
handled; a NULL class brush leaves the application responsible.

`erase_background_dc(hwnd, hdc, brush)` now performs the shared fill using
the borrowed DC's existing clip/mapping and returns the rasterizer's result.
It neither allocates a substitute nor releases the supplied handle. Missing
DC or NULL class brush returns zero. DefWindowProcA uses it; the encoding-
neutral W branch delegates to A instead of maintaining another erase policy.
The Win16 bridge already widens the DC and therefore shares the fix too.
Internal exposure callers retain their owned-DC wrapper, including its
intentional no-op success for a NULL brush (used by the list-view, which
paints its background itself); that is separate from the public default
procedure's NULL-class-brush result.

`test-default-erase-dc.js` checks all 768 pixels of a caller-supplied memory
DC with a restricted clip, through A/W and the real Pascal Win16 bridge.
It checks NULL brush/missing DC results, unchanged pixels on failure, caller
DC reuse and ABI stack cleanup. The original code fails at the first pixel
inside the clip: it painted a different surface and left the supplied DC
white. The fixed version passes. Existing far positioning/painting and
Win32 parent/child tests pass; WEP1 passes 8/8 and Rodent/Rattler pass.
Normal and compatibility builds pass.

Logs: `/private/tmp/wa-erase-dc-before.log`, `wa-erase-dc-all-abi.log`,
`wa-erase-dc-far.log`, `wa-erase-dc-win32.log`, `wa-erase-dc-wep1.log`,
`wa-erase-dc-vb.log`, `wa-erase-dc-final-build.log`.
BeginPaint callback timing and propagation of the result to fErase remain
open; this corrects the default callee, not the entire paint transaction.

## 2026-09-20: BeginPaint callback candidate rejected by browser regression

Saved the **not integrated** Win32 candidate at
[`experiments/beginpaint-erase-candidate.patch`](experiments/beginpaint-erase-candidate.patch).
It sends WM_ERASEBKGND from BeginPaint after installing the paint DC clip,
sets fErase from the actual callback result, retains a declined erase, and
removes UpdateWindow's premature erase. Win16 still uses its legacy branch;
this candidate is neither a complete implementation nor safe to enable.

The executable contract probe is:

```sh
node tools/probe-beginpaint-erase.js
```

**Expected current-main result: FAIL.** This deliberately unintegrated probe
is not registered as a passing regression test. It exercises eight combinations
of erase requested/not requested, NULL/non-NULL class brush and zero/nonzero
callback result, then repeats with a non-erasing invalidation. It also runs an
actual nested x86 WM_PAINT -> BeginPaint -> WM_ERASEBKGND sequence and checks
the supplied paint DC, fErase, partial rectangle, callback depth and stack.
Promote it into the regression suite when the complete runtime fix is ready.
The saved candidate passes this probe. Current main first fails by reporting
fErase=TRUE for a NULL brush even without an erase request.

The candidate passes parent/child painting, Win16 far callbacks, WEP1 8/8,
and both builds, **but fails the real Diablo browser menu assertion**: red
selection markers are absent and the client is near-black. Restoring the
erase bit when the callback returns zero passes the repeated-cycle probe,
but still fails the same browser assertion. Neither implementation is a
verified fix. The first browser run passed while compilation was still in
progress; that run is excluded as candidate evidence because it could have
loaded the previous artifact. Both failures were runs started after their
respective candidate builds completed. No screenshot assertion was weakened.

Runtime source was restored to the preceding verified implementation; only
this report, the candidate patch and the explicit failing probe are retained.
The restored normal/compatibility build passes, and a fresh browser run passes
all six Diablo stages through gameplay (`wa-begin-erase-diablo-restored.log`,
captures in `/private/tmp/wa-begin-erase-diablo-restored`). This is an observed
restoration, not an assumption that reverting the candidate fixed the game.
The saved patch passes `git apply --check`; use an isolated test copy if
reapplying it, since its browser regression is known.
Evidence:

- `/private/tmp/wa-begin-erase-before.log`: original contract failure.
- `wa-begin-erase-nested.log`, `wa-begin-erase-persist.log`: candidate probe passes.
- `wa-begin-erase-diablo-verified.log` and `wa-begin-erase-diablo-persist.log`:
  both fail the main-menu marker assertion.
- `/private/tmp/wa-begin-erase-diablo-verified/03-main-menu.png`: inspected
  near-black menu; the corresponding `-persist` directory retains the repeat.
- `wa-begin-erase-order.log`, `wa-begin-erase-children.log`,
  `wa-begin-erase-far.log`, `wa-begin-erase-wep1.log`: narrower passing checks.

Next investigation must observe the **whole erase lifecycle**. Concrete
competing consumers still present: GetMessage/PeekMessage clear NC_FLAGS bit 2
when synthesizing an erase; the native modal pump clears it and fills directly;
the dialog default procedure also has its own erase/paint shortcut. These are
code findings and plausible causes, **not a traced explanation of Diablo's
failure yet**. Trace pending flags and callback results around Storm's class-
brush changes and repeated menu paints before replacing the old brush-derived
fErase behavior. Then connect the Win16 far BeginPaint continuation and remove
its legacy branch, with the browser regression required alongside the probe.

## 2026-09-20: traced erase-state losses and hidden-scan correction

`tools/probe-erase-lifecycle.js` builds an instrumented WASM in a temporary
directory, without editing sources or the shipping artifact. It traces NC
erase sets/clears, hidden-window scans, BeginPaint entry and returned fErase,
with HWND, flags and guest EIP/caller. `--candidate` applies the saved rejected
patch in memory. Patch anchors use the compiler's byte-to-source conversion
(UTF-8 comment punctuation is normalized); ambiguous or stale anchors fail.
This is a cooperative-mode diagnostic, not a performance benchmark.

```sh
node tools/probe-erase-lifecycle.js --candidate --app=diablo_shareware \
  --batch-size=200000 --tick-ms-per-batch=20 --max-batches=1100 \
  --max-seconds=90 --no-close --repaint-every=100
```

Two actual state losses are now observed, not just suspected:

1. Creation sets bit 2 on hidden children 0x10003/0x10004. `nc_flags_scan`
   directly clears it while those windows are effectively hidden. Before
   this fix, 0x10004's first BeginPaint arrives with flags=0. This clear did
   not call `nc_flags_clear`, which is why tracing only that helper missed it.
2. With the callback candidate, BeginPaint on 0x10002/0x10003 returns fErase=1
   and retains bit 2 after the erase is declined. The bit is then cleared
   while Storm polls messages at runtime 0x7a8b48, return 0x7a8b58.
   The logged Storm base is 0x7a1000; disassembly at original 0x15007b48
   identifies the call at 0x15007b52 to IAT 0x15036688. The import table
   identifies that slot as PeekMessageA (USER32 IAT 0x36634, index 21).

The production fix in this step is **only loss 1**: hidden scans retain the
erase bit, skip delivery, and continue to subsequent windows. Existing
non-client calculation/paint handling is otherwise unchanged. Destruction
still clears the slot. A new regression fails on the original code and
checks hidden parents, visible children under hidden parents, repeated and
combined-mask scans, fairness to a later visible window, exposure and cleanup.

The repeated instrumented candidate run now sees 0x10004's first BeginPaint
with flags=2, proving that exposure preserves the original request. The
later PeekMessage consumption still occurs and subsequent calls again see
flags=0. Thus the hidden fix does **not** establish that the saved candidate
is ready to integrate. Next: correct the queued/synchronous erase distinction
without duplicating state, then rerun the contract and browser oracles.

Evidence: `/private/tmp/wa-erase-lifecycle-main.log`,
`wa-erase-lifecycle-candidate.log`, `wa-erase-lifecycle-hidden-title.log`
(pre-fix hidden clears), `wa-erase-lifecycle-preserved.log` (post-fix),
`wa-hidden-erase-before.log`, `wa-hidden-erase-after.log`.

Verification of the production hidden-scan fix: normal/compatibility builds,
Diablo's six-stage browser flow through gameplay, WEP1 8/8, Rodent/Rattler
and shared parent/child paint ordering pass. Logs:
`/private/tmp/wa-hidden-erase-{build,diablo,wep1,vb,order}.log`;
browser captures: `/private/tmp/wa-hidden-erase-diablo/`.
