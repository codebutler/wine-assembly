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

## Still open: real Win16 transactions

Win16 Begin currently returns constant 1, Defer applies immediately, and End
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
