# Guest NE lifecycle candidate

This candidate implements the KERNEL32 legacy lifecycle triplet, separately
from QT. It is source-tested only until a runtime receipt is appended here.
The unchanged original game must not be run while QT remains absent.

The ordinal ABI is 35 `LoadLibrary16(str)`, 36 `FreeLibrary16(long)` and
37 `GetProcAddress16(long,str)`, using stdcall DWORD slots. Wine's
[kernel32.spec](https://raw.githubusercontent.com/wine-mirror/wine/master/dlls/kernel32/kernel32.spec)
and [ne_module.c](https://raw.githubusercontent.com/wine-mirror/wine/master/dlls/krnl386.exe16/ne_module.c)
establish those signatures and the void FreeLibrary16 contract. The latter
preserves EAX in this implementation; callers must not interpret it as BOOL.

Microsoft [KB Q142814](https://jeffpar.github.io/kbarchive/kb/142/Q142814/)
documents the Win16 result domain below 32, including 2 for missing image,
11 for invalid executable, and 21 for requiring 32-bit extensions. Missing
import and LibEntry AX-zero failures remain diagnostic exceptions after
rollback: their exact Win32-visible legacy status has not been established.
They never settle the PE caller as if an initialization had completed.
Unsupported layouts, async NE waits, traps and budget exhaustion also remain
diagnostic. Other existing parser errors are not broadly recategorized.

Yield 18 carries the lock owner in the low half of its token and an
instance-local monotonic serial in the high half, plus saved EIP/ESP.
The handler rejects wrapped or unmapped stdcall frames before any load.
Settlement checks identity and frame, consumes exactly 8 or 12 bytes including
the return address, and rejects duplicates. Source names are copied with a
bounded bytewise guest translator before any NE scope; transitive VFS images
are privately copied and inspected before staging. A ready native module is
retained before source lookup, so duplicate loads need no surviving VFS file.
Canonical basename identity, refs, executable pins and unload ownership live
in the existing process-owned native transaction table, not a new JS cache.

Aliases use the existing selector-disjoint Win16 handle map, above 31.
GPA/free also accept a live module's DGROUP selector. Like ordinary Win16
handles, aliases can be reused after final unload; they are not generation
handles. Request serials protect host continuations from stale settlement.
Failed WEP keeps its module/dependencies and exact owning exports facade;
the diagnostic offers explicit same-request recovery, never automatic retry.

Lock order is PE callback gate, NE synchronous execution scope, then short
DLL mutex acquisitions. No NE scope awaits or borrows another thread.
Main and cooperative nested DllMain use the common service. Cooperative
service calls bind the live ThreadManager facade for each export. Worker
requests fail explicitly; Worker lifecycle execution and asynchronous NE
continuations remain unsupported. No QT entry or workaround is provided.

Source checks: `test-ne-sources.js`, `test-ne-guest-service.js`,
`test-ne-guest-caller.js`, existing image/driver tests, generators, fragment
balance, logical operands, API/ESP gates and browser script versions.
`test-ne-guest-lifecycle-candidate.js` requires `WA_TEST_WASM` and exercises
actual PE IAT/EAT calls, refs, GPA, WEP, a mapped DLL's nested DllMain and
failure rollback. It also prepares direct/sparse stack variants, a live
cooperative secondary-instance facade, duplicate loads after VFS removal,
invalid/stale aliases, explicit failed-WEP recovery using synthetic-only
repair, and cancelled/stale/changed-frame completion checks. Its execution
passed with direct and sparse stacks on 2026-10-18 using the canonical
build (module SHA-256 `ce2cb0af121e6f904f4af2b6d77f171350df3663498dd790de82d277eb31a164`).
The expanded candidate also passes through the production asynchronous PE
LoadLibrary service into nested synchronous NE requests, and through actual
`ThreadManager.runSlice` (thread-attach DllMain and thread body). Named/ordinal
GPA results execute through the owned NE invocation ABI; this is not QT.
Live dependencies are inspected under temporary native references, so removing
their VFS files neither breaks later parent loads nor bypasses export checks.
The candidate verifies retained refs and cleanup for both present/missing live
exports. Logs are retained under
`scratch/runs/20261018-outlaws-guest-lifecycle/` in the host workspace.
