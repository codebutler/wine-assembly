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

## 2026-09-20: message retrieval no longer consumes pending erase

Removed the GetMessage/PeekMessage branches that manufactured queued
WM_ERASEBKGND from NC_FLAGS bit 2, then cleared the request on retrieval.
An outstanding erase belongs to the paint lifecycle, not to the posted FIFO.
Explicitly posted WM_ERASEBKGND still travels through that FIFO unchanged.
The message-wait wake mask now includes only NC calculation/paint (5), not
erase (2) or persistent default-erase ownership (8), so retaining a declined
erase cannot itself create a permanent wake/retry loop.
The wake check also explicitly recognizes the legacy main-window
`paint_pending` global, before the paint selector mirrors it into per-window
flags. The regression caught that omission: such a paint previously depended
on its erase bit to wake, and must continue waking without that accidental
dependency. Both main-global and per-window paint wake cases are covered.

This distinction follows Microsoft's [WM_ERASEBKGND contract](https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-erasebkgnd)
(sent, and an unhandled erase leaves the window marked for erasing) and
[PeekMessage contract](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-peekmessagea)
(dispatch sent messages, retrieve posted messages). It is not a claim that
every other painting path now matches Win98.

The expanded `test/test-nc-flags-message-wake.js` fails before the fix because
PM_NOREMOVE retrieves an erase that was never posted. It passes after the fix:
both peek modes and GetMessage preserve the request; erase-only state stays
idle; explicitly posted erase wakes, survives PM_NOREMOVE, and is removed by
either API with its HWND/wParam/lParam intact and without validating erase.

The same isolated candidate trace command above now reports no erase clears
at Storm's PeekMessage caller 0x7a8b48; repeated 0x10004 BeginPaint results
retain fErase=1 and flags=2. Log:
`/private/tmp/wa-queued-erase-candidate-trace.log`. This is lifecycle evidence,
not browser validation of the saved BeginPaint candidate, which remains
**unintegrated**. Its next gate is the completed-artifact browser flow.

Verification logs in `/private/tmp/wa-queued-erase-*.log`: `before` fails the
new retrieval assertion, `after` passes retrieval and wake cases; `filter`,
`order`, `far`, and `hidden` pass; `wep1` passes all eight games. `build` and
`final-build` pass normal/compatibility builds. `diablo` passes the six-stage
browser flow before the additional main-global wake check.
`final-diablo` also passes all six stages on the completed final build,
including the main-global wake check; captures are in
`/private/tmp/wa-queued-erase-final-diablo/`.

Rodent2000 is **not green in this shared-tree run**: `vb` fails its board
color assertion (floor/tiles/tileInk/frame all zero). An isolated artifact
built from the same source tree but replacing both edited runtime fragments
with their `7471c624` contents fails identically (`vb-baseline`). The baseline
artifact is `/private/tmp/wa-queued-erase-baseline.wasm`; no production files
were reverted to produce it. This comparison does not identify the cause;
retain the failure rather than claiming that the earlier Rodent pass still
applies to today's shared worktree.
The final pinned shipping artifact repeats the same Rodent failure
(`vb-final`), consistent with that baseline comparison.

## 2026-09-20: Win32 BeginPaint callback integration after lifecycle fixes

Retested the archived candidate **after** hidden-scan preservation (`7471c624`)
and removal of the queued-erase consumer (`80f6174c`). Unlike the earlier
rejected attempts, the completed-build browser test now passes all six Diablo
stages through gameplay, including both menu selection markers. The runtime
change is now integrated, not merely an isolated passing experiment:

- Win32 BeginPaint sends pending WM_ERASEBKGND after installing its paint DC's
  update/system clip; the callback receives the same HDC returned to the caller.
- fErase reflects whether erasing was requested and whether the callback
  handled it, not whether the window happens to have a class brush.
- The in-flight request is consumed before callback entry, preventing a
  same-window nested BeginPaint from redispatching it recursively. A declined
  erase is rearmed on a still-live window; a newly requested erase during a
  successful callback is not cleared on return.
- Win32 UpdateWindow sends WM_PAINT without its former early erase callback.
  The application can arrange its brush/background before calling BeginPaint.

These are the documented [BeginPaint](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-beginpaint)
and [WM_ERASEBKGND](https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-erasebkgnd)
contracts. They do not establish exact native-Win98 event parity for all paths.

The former red manual probe is now `test/test-beginpaint-erase-callback.js`.
It covers real x86 callbacks, no-erase damage, NULL/non-NULL brushes,
zero/one/other-nonzero callback results, repeated declined cycles, partial
rcPaint, UpdateWindow -> WM_PAINT -> BeginPaint -> erase nesting, recursive
same-window BeginPaint, callback reinvalidation, guest stack and synchronous
message depth. The old tools command forwards to the regression test.
`tools/probe-erase-lifecycle.js` now instruments current sources; `--candidate`
is retired with an explicit error. The patch under `docs/experiments/` remains
historical evidence of the previously rejected attempt, not a patch to apply
to current main.

Verification: `/private/tmp/wa-beginpaint-retry-{contract,nested,promoted,order,default,wake,winrar,wep1,far,build,diablo}.log`.
Both WASM builds, focused paint tests, WinRAR installer/installed GUI,
WEP1 8/8 and Win16 callback tests pass. The browser run began only after the
build process completed; screenshots are in
`/private/tmp/wa-beginpaint-retry-diablo/`. Rodent's baseline-red status from
the preceding section remains unresolved, not claimed green here.

Negative control: compiling the new regression with both runtime fragments
from `80f6174c` fails its no-erase/NULL-brush fErase assertion
(`/private/tmp/wa-beginpaint-retry-red.log`). The promoted test passes current
source. The updated current-source lifecycle probe completes the same 1100-
batch Diablo trace (`wa-beginpaint-retry-trace.log`) without applying an
experiment patch.

Remaining paint work: connect Win16 BeginPaint's far callback continuation
and remove its legacy class-brush policy; audit modal/default-dialog erase
consumers; move damage validation to the correct lifecycle point and test
callback reinvalidation through EndPaint. Empty-update rcPaint fallback and
the global last-registered redraw-class style are separate known shortcuts.

## 2026-09-20: Win16 BeginPaint far callbacks, legacy erase block removed

Win16 BeginPaint now prepares the same canonical paint DC/rectangle, then
sends a pending WM_ERASEBKGND through a far-callback continuation at FFB0.
The invocation owns a 72-byte guest-stack record (`hwnd`, destination pointer,
64-byte canonical PAINTSTRUCT) above its ordinary six-byte return record.
The narrowed HDC is saved with that return record, so nested callbacks cannot
replace the outer caller's result. No global bridge scratch or ABI mode flag
is introduced. The returned **DX:AX LONG**, including high-word-only nonzero
values, decides fErase. A declined erase is rearmed only if its window still
exists; clearing before callback entry leaves subsequent invalidations intact.

Win16 UpdateWindow now sends WM_PAINT without erasing ahead of it, matching
the Win32 change. BeginPaint owns the nested erase and passes its actual DC,
not `hwnd + 0x40000`. The old class-brush/ownership-bit fill and NULL-brush
fErase heuristic have been removed from the shared core, along with their
obsolete Diablo-specific rationale. Existing Win16 clip preparation is
unchanged; replacing that application-clip compatibility path requires its
own GetClipBox/visible-region checks.

The expanded real-x86 far regression checks:

- MoveWindow/UpdateWindow paint-before-BeginPaint-erase ordering; no erase
  when an application never calls BeginPaint.
- Actual returned narrow DC, partial PAINTSTRUCT, no-erase damage, NULL and
  non-NULL brushes, zero, low-word nonzero and high-word-only callback results.
- Same-window recursive BeginPaint does not resend the in-flight erase;
  different-window recursion gets distinct DCs and preserves both frames.
- Destruction during erase does not rearm the retired HWND; both nested
  return frames unwind correctly. Caller guards and shared-scratch checks
  remain covered.

The previous runtime fails the new ordering assertion
(`/private/tmp/wa-win16-beginpaint-red.log`); current source passes the full
matrix and nested cases (`contract` and `nested` logs with the same prefix).
The Win32 callback regression also passes (`win32`). WEP1 8/8, Hearts startup,
normal/compatibility builds pass (`wep1`, `hearts`, `final-build`). The current-
source lifecycle probe now records a separate `far-result` after the callback,
rather than mistaking the core's pre-callback fErase for the final Win16
result; a Tetris trace confirms the event (`trace`).
The completed final build also passes Diablo's full six-stage browser flow
(`/private/tmp/wa-win16-beginpaint-diablo.log`, captures in the matching
directory without `.log`). Rodent's previously recorded baseline failure
remains open; this turn does not claim to resolve it.

This does not finish painting fidelity: ShowWindow's separate initial-erase
continuation still needs a declined-result ownership audit, as do native
modal/default-dialog consumers. Damage validation/reinvalidation through
EndPaint, empty-update rcPaint and per-class redraw lookup remain open.

## 2026-09-20: ShowWindow erase results and Win16 InvalidateRect

The Win16 show continuation used to clear the erase request before dispatch
and discard the result. It now marks the outstanding callback in its own
stack-resident pending word, consumes the full DX:AX result on far return,
and rearms a declined erase only on a still-live window. Native synchronous
dispatch uses the same result helper. A successful callback cannot clear a
new erase request made inside it. No new global callback state or extra frame
is introduced. This follows the documented
[WM_ERASEBKGND result contract](https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-erasebkgnd).

The regression first failed because ShowWindow lost the declined request
(`/private/tmp/wa-show-erase-before.log`). After that fix, the new callback-
reinvalidation case exposed a second, independent shortcut: shared
InvalidateRect explicitly discarded bErase on Win16 (`code16 != 0`) to avoid
the old queued-erase behavior. With queued erase removed and both BeginPaint
ABIs now dispatching callbacks, the workaround is obsolete. Both ABIs now
record nonzero bErase; FALSE does not remove an existing request.

`test-win16-windowpos-defproc.js` covers zero/low/high-word-only callback
results, repeated ShowWindow, the next UpdateWindow/BeginPaint after declined
erase, new invalidation from a handled callback, nested shows with opposite
results and destruction during erase. The final matrix passes
(`wa-show-erase-final-contract.log`); `wa-show-erase-nested.log` records the
intermediate reinvalidation failure rather than a final regression.

Scope limits: ShowWindow still uses its existing compatibility erase DC and
its existing show/activation scheduling. Its fixed nonzero return value is
also a separate gap: the documented
[ShowWindow return](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-showwindow)
reports prior visibility. Do not add a test pinning that constant as correct.
Damage validation and modal/default-dialog erase consumers remain open.

Verification: both builds pass (`/private/tmp/wa-show-erase-final-build.log`),
as do the far callback matrix, Win32 BeginPaint and message-wake tests.
The Win32 reinvalidation fixture now passes BOOL value 2, not just 1: the old
`(code16 == 0) & bErase` expression also incorrectly discarded even nonzero
BOOLs on Win32. The new direct condition handles every nonzero value
(`wa-show-erase-bool.log`).
Compiling that fixture with only the old InvalidateRect fragment restored
fails the retained-erase assertion, actual 0 versus expected 2
(`wa-show-erase-bool-before.log`).

Broader completed-build gameplay sweep: **21 pass, 3 fail**. WEP1 8/8 passes;
WEP3 Klotski, TetraVex, LifeGenesis, SkiFree and WordZap pass; WEP4 Blackjack,
Chess, Chip's Challenge, JezzBall, Maxwell and Tic Tac Drop pass; VB Rodent and
Rattler pass. In particular Klotski, named in the removed workaround, passes
its gameplay and background checks. Logs:
`wa-show-erase-{wep1,wep3,wep3-rest,wep4,wep4-rest,vb}.log`.

Do **not** call the whole sweep green: Fuji Golf cannot find its player-name
edit control, Go Figure has zero white bordered-field pixels, and TriPeaks
has zero white face-row pixels. All three fail the same assertions in an
isolated WASM with **both edited runtime files restored to f6facca7** and all
other current source/host files retained:
`/private/tmp/wa-show-erase-baseline.wasm`, with
`wa-show-erase-{fuji,gofigure,tripeaks}-baseline.log`. No worktree source was
reverted for this comparison. These results rule out this turn's delta as
the sole cause, not an earlier paint change. Investigate these broader-suite
failures next; they were not exercised by the prior WEP1-only checks.

## 2026-09-20: validate damage at BeginPaint, not EndPaint

TriPeaks exposed the remaining validation shortcut: its WM_PAINT calls
UpdateWindow on itself between BeginPaint and EndPaint. Outstanding old
damage caused recursive painting until the guest stack was corrupted and
the app displayed an OOM message. The trace and reproduction are recorded
in [the TriPeaks note](re-notes/wep16-tripeaks.md).

Shared BeginPaint now snapshots PAINTSTRUCT and the paint DC clip, then clears
the consumed update and paint-pending state before any erase callback.
EndPaint releases the DC but no longer validates rcPaint. Consequently new
invalidations from callbacks or painting survive, including exact overlaps
with the old rectangle. This implements the documented
[BeginPaint validation timing](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getupdaterect).

The previous runtime fails the new immediate-validation assertion
(`/private/tmp/wa-begin-validation-before.log`). Current Win32 and real far
callback tests pass, including self-UpdateWindow during painting and
same-rectangle reinvalidation (`after`, `far-nested` logs with that prefix).
Parent/child paint order passes (`order`). Both builds pass (`build`), and
the completed build passes TriPeaks full tableau (`tripeaks`), WEP1 8/8
(`wep1`), VB Rodent/Rattler (`vb`) and Diablo's six-stage browser/gameplay
flow (`diablo`). The TriPeaks screenshot was also visually inspected.

Go Figure still fails with black puzzle fields (`gofigure`); Fuji Golf's
earlier missing-control failure is not resolved or claimed retested here.
Open paint fidelity work includes empty-update rcPaint, per-class redraw
flags, native modal/default-dialog erase consumers, and ShowWindow's prior-
visibility return and compatibility erase DC. No performance claim is made
from these functional runs on a loaded shared machine.

## 2026-09-20: child exposure must not bypass guest erasing

The remaining Go Figure black fields were isolated to
`win16_rearm_visible_child_erases`: it filled each exposed far-wndproc child
with its class brush and consumed the erase request without dispatching the
guest callback. Removing that shortcut restores the game's white bordered
fields, score and timer. Exposure now retains the request for BeginPaint's
real far erase callback; a class brush no longer overrides guest handling.

The isolated candidate passes Go Figure, Rodent/Rattler and WEP1 8/8.
The corrected Go Figure screenshot was visually inspected, and the current-
source far regression passes with a new class-brush exposure assertion.
Trace, artifact and capture paths are recorded in
[the Go Figure note](re-notes/wep16-gofigure.md). Fuji Golf remains open;
this does not establish native-equivalent parent-exposure message timing.

## 2026-09-20: Fuji Golf failure refined, geometry still open

The reported missing player-name control was a harness startup error: the
game was still asking to copy its DAT file to the Windows directory. After
accepting that prompt, the old physical click also missed the Start New
Round button because the clubhouse scene is too short. The gate now accepts
the prompt and clicks the real control ID, preserving its independent strict
geometry checks. Name entry and the first-tee transition work; the test
remains red for scene bounds 360x291 (height must exceed 310), not a missing
dialog. No runtime change or relaxed visual threshold. Evidence and next
investigation are in [the Fuji Golf note](re-notes/wep16-fujigolf.md).

Further isolation: the maximized WM_SIZE has the correct 632x434 dimensions,
but Win16 ShowWindow has not updated `active_hwnd`. Fuji's NE5:229a compares
GetActiveWindow (zero) with its clubhouse HWND and skips layout. A diagnostic
artifact setting active state before the size callback passes the unchanged
full gate and restores the full-height scene visually. **Not integrated:**
a bare global assignment omits activation notifications/focus/reentrancy.
Implement a proper Win16-safe activation transition next; details and probe
paths are in the app note. No bitmap or system-metric correction is indicated
by this evidence.

## 2026-09-20: Win16 activation transaction and EnableWindow repaint loop

The activation implementation adds an invocation-owned far continuation,
`WIN16_CONT_ACTIVATE` (FFB4), with `{target, previous, phase, old-focus}` on
the guest stack. Activating top-level ShowWindow modes 1/2/3/5/9 publish
`active_hwnd` before sending old/new WM_ACTIVATE, then complete focus
notifications before the show-size callback. Modes 4/7/8 and child shows do
not activate. Each phase advances before callback entry; a nested activation
supersedes the outer target, and target destruction ends the transaction.
Win16 activation packs the other HWND into LOWORD(lParam) and minimized
state into HIWORD(lParam), unlike Win32's wParam packing. Old queued
WM_ACTIVATE/WM_SETFOCUS duplicates are removed.

The expanded far matrix checks exact notification order, narrowed handles,
nonactivating modes/children, nested activation/focus preservation, actual
GetActiveWindow from SIZE_MAXIMIZED, minimized packing and destruction.
The final matrix passes (`/private/tmp/wa-win16-activation-final-contract.log`).

The initial completed build passes Fuji Golf, WEP1 8/8, WEP4 7/7 and VB
Rodent/Rattler, but **regresses Klotski**: closing Welcome enters repeated
WM_PAINT / WM_ENABLE / WM_CAPTURECHANGED cycles. This is not a modal hang.
Trace `wa-activation-klotski-messages.log` shows its painter calling
EnableWindow(FALSE), drawing, then EnableWindow(TRUE) before EndPaint.
The shared EnableWindow handler unconditionally invalidated the window on
both state changes, perpetually recreating the paint damage. Correct active
state exposes this branch; suppressing activation would conceal the problem.

The EnableWindow change removes that API-level repaint shortcut. Disabled
appearance is now requested by native control WM_ENABLE processing, including
a guest subclass that chains to the native procedure. Other windows own their
repaint decisions. `test-enable-window.js` retains prior-state/owner tests and
adds no-invented-damage and native-button repaint assertions; it passes
(`wa-enable-repaint-contract.log`). These are independent API ownership
corrections, not Klotski-specific conditions.

Remaining scope: application-activation/restored-size scheduling, activation
selection on hide/minimize, ShowWindow prior-visibility return, and other
Win16 activation entry points are not claimed complete by this transaction.

Completed combined-build verification (`wa-win16-activation-enable-*` in
`/private/tmp/`): normal/compatibility builds pass (`build`), WEP1 8/8
(`wep1`), WEP4 7/7 (`wep4`), VB Rodent/Rattler (`vb`), and six WEP3 games
including Klotski and Fuji (`wep3`). Diablo's six-stage browser/gameplay flow
also passes (`diablo`), launched after build completion. The first browser
attempt could not bind its local server under sandbox restrictions; the
approved rerun completed successfully.

WordZap remains red at its splash-width check (600), identically on the
earlier pre-activation isolated artifact
`wa-gofigure-no-class-erase.wasm` (`wa-activation-wordzap-baseline.log`).
The current splash screenshot `wa-activation-wordzap.png` was inspected and
is entirely black: this assertion does not establish a font-width bug.
Do not call the full 24-game sweep green (23 pass, 1 red), or weaken the
visual gate. Investigate WordZap's capture/startup separately.

A stricter baseline restores all three edited runtime fragments to their
pre-change HEAD versions while keeping the rest of the current source/host:
`/private/tmp/wa-activation-before-three.wasm`. WordZap fails identically at
width 600 (`wa-activation-wordzap-three-baseline.log`). This rules out this
turn's runtime delta as the sole cause, not every earlier paint change.

## 2026-09-20: WordZap publication lock removed

The WordZap failure above is now resolved without changing its pixel or
gameplay expectations. The guest draws its splash and polls GetCurrentTime
before EndPaint; canonical pixels were correct, but the renderer withheld all
publication while a paint DC was live. BeginPaint is not implicit double
buffering. Publication now waits only for an executing Worker slice, not for
EndPaint, and the modal-dialog exception to the former lock is removed.

All seven WEP3 games, WinRAR candidate menu/property-sheet checks, property-sheet
page lifetimes, native-child DirectDraw overlays and the renderer boundary
regression pass. Chromium shows the splash in cooperative and Worker modes;
the WinRAR Worker browser file-drop gate passes. No new full 24-game sweep is
claimed. Browser-resized WordZap copyright clipping remains a separate issue.
See [the WordZap investigation](re-notes/wep16-wordzap.md) for traces, official
contract links, reproduction and verification scope.

## 2026-09-20: Win16 ShowWindow returns prior visibility

The Win16 adapter captured WS_VISIBLE on entry but discarded that value when
creating its far-return continuation, hardcoding TRUE. The documented return
is the window's previous visibility, not success:
[Microsoft ShowWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-showwindow).
The adapter now normalizes the captured bit and stores it in the existing
invocation-owned continuation. Callback results, nested ShowWindow calls and
destruction cannot replace the outer return. No new frame or global is needed.

The far regression snapshots entry visibility and checks the returned AX for
each show case, including maximize, minimized/nonactivating modes, child
windows, destruction and activation reentrancy. Explicit hide/repeated-hide/
re-show cases cover both boolean results. The nested erase callback captures
its own ShowWindow return, testing inner TRUE with outer FALSE independently.
The negative control fails on the previous runtime (`wa-show-result-before.log`)
at the first hidden-to-visible transition, returning 1 instead of 0.

Activation selection on hide/minimize, application/restored-size notification
timing, other activation entry points and the ShowWindow compatibility erase
DC remain separate open items; this return-value fix does not resolve them.

The full far regression passes (`/private/tmp/wa-show-result-after.log`), as do
normal and compatibility builds (`wa-show-result-build.log`, layout hash
`494e011486f18808`). The nested-return fixture calls ShowWindow only from its
erase callback: calling it unconditionally also repeats it from activation
notifications, overwriting the captured first return with a later TRUE.

Completed-artifact gameplay also passes: WEP1 8/8, WEP3 7/7, and VB Rodent/
Rattler 2/2 (`wa-show-result-wep1.log`, `wa-show-result-wep3.log`,
`wa-show-result-vb.log`). These runs used `WINE_ASSEMBLY_WASM=build/wine-assembly.wasm`
after the build completed, not a stale pre-fix artifact.

## 2026-09-20: shared activation must respect callback reentrancy

The hide/minimize audit found a prerequisite discrepancy: Win16's activation
continuation stops after a callback chooses another active window, but the
shared Win32 `$active_window_transition` did not. It could send WA_ACTIVE to
the superseded target after the old window's callback had activated a third
window, or send stale WM_SETFOCUS after a nested focus transition. Furthermore,
SetActiveWindow unconditionally called the browser activation import on unwind,
undoing the nested browser selection even when guest active state was correct.

The shared transition now checks ownership after the deactivation, activation
and kill-focus callbacks. SetActiveWindow requests browser activation only if
its target is still active. The outer invocation retains its original previous
HWND return and stack cleanup. This is consistent with the synchronous
same-queue callbacks documented by Microsoft in
[WM_ACTIVATE](https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-activate)
and the previous-window return in
[SetActiveWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setactivewindow);
exact nested Win98 notification traces have not been independently captured.

The expanded `test/test-active-window.js` uses actual guest x86 and a public
SetActiveWindow thunk. It activates a third window from each of the old
window's WA_INACTIVE, the target's WA_ACTIVE, WM_KILLFOCUS and WM_SETFOCUS.
It checks final active/focus state, absence of stale notifications, the outer
return and stack, and host activation targets. Its recorder now has 64 entries
and traps before overflow; the old 16-entry storage could overwrite fixture
code during the expanded sequence. An isolated prior-runtime test fails on
stale activation after WA_INACTIVE (`wa-active-reentrant-before.log`); the
corrected transition passes all four cases (`wa-active-reentrant-after.log`).
Popup-history and owned-form ShowWindow activation tests also pass.

This does not finish the activation audit: ShowWindow, SetForegroundWindow,
SwitchToThisWindow and OpenIcon still need their post-callback host activation
reviewed. Hide/minimize successor selection has no shared WAT implementation
yet. Exact native default-procedure focus ownership and same-target nested
activation generations are not established by this regression.

The final bounds-checked recorder passes (`wa-active-reentrant-final.log`).
Normal and compatibility builds pass (`wa-active-reentrant-build.log`, layout
hash `494e011486f18808`), with no data-segment overlaps. All named logs are in
`/private/tmp/`.
The completed artifact also passes the WinRAR Worker browser file-drop test
(`wa-active-reentrant-winrar-web.log`). This is a browser integration check,
not an exhaustive native activation-order comparison.

## 2026-09-20: foreground/restore wrappers share guarded publication

The follow-up closes the post-callback host-overwrite paths identified above.
`$activate_window_with_host` resolves the target's top-level and runs the
same-thread transition, but does not activate the browser target if a callback
has selected another window. SetForegroundWindow, SwitchToThisWindow, OpenIcon
and the ShowWindow activation helper share it. It preserves the original HWND
passed to the host (including child handles), and foreign-thread targets still
delegate to the host without stealing the calling queue's active state.
SetActiveWindow keeps its previous-HWND return path. OpenIcon still returns
success for a completed restore even if callbacks selected another window.

BringWindowToTop already activates the host before its guest callbacks, so it
does not have this particular post-callback overwrite and was not changed.
This is not a claim that every aspect of BringWindowToTop is native-correct.

The real guest callback matrix now has twenty cases: SetActiveWindow,
SetForegroundWindow, SwitchToThisWindow, OpenIcon, and the ShowWindow activation
helper, each reentered from four activation/focus notification boundaries.
The prior runtime fails the SetForegroundWindow/WA_INACTIVE case by sending
the superseded host activation after the nested one
(`/private/tmp/wa-activation-wrappers-before.log`). The corrected matrix passes;
stack cleanup, nested active/focus state, absence of stale notifications and
host targets are checked. The ShowWindow case tests its activation helper,
not the entire ShowWindow message sequence. Separate owned-form ShowWindow and
OpenIcon/CloseWindow integration tests pass, including the existing restore
and query-veto behavior. Normal and compatibility builds pass.

Remaining: hide/minimize successor selection, startup notification timing,
ShowWindow erase-DC ownership, exact native focus/default-procedure ordering,
and same-target nested activation generations. This change does not model
cross-process foreground restrictions or supply native Win98 trace evidence.

Final verification logs in `/private/tmp/`: `wa-activation-wrappers-contract.log`
also covers preserved child HWND and foreign-thread host delegation;
`wa-activation-wrappers-openicon.log`, `wa-activation-wrappers-owned.log`, and
`wa-activation-wrappers-build.log` pass. The completed artifact passes WinRAR's
real Worker browser file-drop gate (`wa-activation-wrappers-browser.log`).
