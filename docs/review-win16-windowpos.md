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
