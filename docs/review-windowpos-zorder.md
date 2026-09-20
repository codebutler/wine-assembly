# Mutable WINDOWPOS Z-order follow-through

2026-09-20: fixed `SetWindowPos` forwarding the original `hWndInsertAfter`
argument to the host after accepting a replacement from the guest's
`WM_WINDOWPOSCHANGING` callback. The final `WM_WINDOWPOSCHANGED` structure
already carried the replacement, so the notification and host disagreed.
The host now receives the same effective `insert_after` value.

Microsoft's [WM_WINDOWPOSCHANGING documentation](https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-windowposchanging)
permits changes to the requested Z-order and relevant flags during the
callback. This is a documented-contract regression, not a fresh native
Windows 98 capture or a claim that all positioning behavior is complete.

`node test/test-windowpos-changing.js` executes a real x86 window procedure
and records both notifications and host Z-order calls. It checks:

- Clearing `SWP_NOZORDER` and replacing TOP with BOTTOM reaches the host;
  the final notification reports that same insertion target.
- Setting `SWP_NOZORDER` suppresses the host change.
- `SWP_NOSENDCHANGING` preserves the original insertion target.
- Existing geometry mutation, protected NOACTIVATE, MoveWindow, deferred
  notifications, and DefWindowProc geometry-message checks remain intact.

Before the runtime fix the new test failed with host `after: 0` instead of
`after: 1` (`/private/tmp/wa-windowpos-zorder-before.log`).
The additional callback has its own code allocation to avoid conflating
this behavior with decoded-code invalidation.

Validation after the fix: WINDOWPOS mutation, Win16 insert-after conversion,
and Win32 deferred-position lifecycle tests all pass; `bash tools/build.sh`
passes all gates and builds both normal and compatibility artifacts. Logs:
`/private/tmp/wa-windowpos-zorder-{after,win16,defer,build}.log`.

Remaining scope: full Win16 WINDOWPOS/WM_MOVE notification fidelity, native
Win98 comparison, and broader child/owner/topmost Z-order semantics are not
established by this focused host-boundary test.
