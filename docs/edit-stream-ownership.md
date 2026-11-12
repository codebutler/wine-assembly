# RichEdit stream callback ownership

`$edit_stream_call` acquires synchronous invocation ownership before writing
the guest stack, EIP, or execution controls. It retains the child token and root
as i64 locals and the synchronous depth as an i32 local. After the bounded
callback loop, all three must still match before `sync_depth_leave` or any
interrupted-context restoration. This includes the 64-round timeout path,
which still returns error 1 when ownership is valid. Null callbacks still
return 1 without entering.

This follows the reviewed ICM wrapper change `066436de903151fb03194884f63ab72e0f9071dc`;
it does not modify ICM. Core `invocation_current` validates the thread, epoch,
and published root. Core `sync_depth_enter` acquires a child before changing
depth/spill state; capacity failure precedes guest writes. The core leave
helper alone checks the current child, so this wrapper's retained identity is
necessary to reject a replaced child. Invalid ownership traps without popping
or restoring stale state; process reset owns recovery.

Run `node test/test-edit-stream-ownership.js`. The test parses the production
WAT and executes the wrapper AST with modeled run/ownership/memory boundaries.
It covers argument order, saved registers/control state, slices, fresh siblings,
nested success and nested timeout, capacity and entry failures before writes,
wrong child/root/depth (including differences above 32 bits), callback traps,
and ordinary timeout. Guard-removal and late-acquisition mutations must fail.
An optional source-path argument allows baseline rejection testing.

These are local JS source conformance tests, not a WAT build, fullVM test, or
Circus compatibility claim. Actual x86 callbacks, spill pinning, SEH, async
parking, and thread/epoch lifetime enforcement require separately authorized
runtime qualification. No CRT jump API is enabled.

## Independent paired review, 2026-10-20

Reviewed against fetched main `7ddcd0572b132759c9122c80492e9f9c161a047a`
and the actual `04-cache.wat` invocation/synchronous-depth helpers. Acquisition
validates and allocates the child before pinning spill state or increasing depth.
The wrapper captures identity after acquisition and checks it before leave;
`invocation_sync_leave` alone cannot detect replacement because it passes the
current identity to `invocation_leave`. Caller registers and execution controls
are restored only after successful validation and retirement. A run trap
propagates without retirement/restoration. The existing 64-slice abandonment
returns error 1 after valid retirement; this review does not qualify asynchronous
service or resumability of the abandoned guest callback.

No additional production defect was demonstrated in this bounded review.
The original test did not clobber most saved registers, leaving restoration
coverage weaker than its description. Added all-register/control clobbers on
ordinary return, return on slice 64, and timeout, plus removal mutations for
all 13 restores. The dedicated suite now passes 23 cases and 17 mutation
controls. Evidence and replay:
`scratch/runs/20261020-callback-pair-review/`. Acceptance remains source-only.
