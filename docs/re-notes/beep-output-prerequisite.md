# Beep output lifetime prerequisite

The single original Mad Bomber diagnostic on canonical `a4ed9f8fa` reached
original msvcr70.dll (base 0x00761000), whose packed import lookup at
0x007b85a9 requested `Beep` in GetProcAddress API 247. It returned zero and
DLL_PROCESS_ATTACH returned FALSE. Evidence remains in
`/home/user/wine-assembly/scratch/runs/20261018-madbomber-rewind-retry/`.
No subsequent game run was performed for this work.

API catalog ID 9 already names Beep, stdcall with two arguments. Its actual
handler in `09a0b-handlers-base-late.wat` calls `crash_unimplemented`.
This is missing behavior, not a misspelled or missing catalog entry.
MessageBeep's existing fire-and-forget oscillator swallows output failures and
cannot stand in for a successful synchronous Beep.

[Microsoft's contract](https://learn.microsoft.com/en-us/windows/win32/api/utilapiset/nf-utilapiset-beep)
requires a synchronous alertable wait and a BOOL/error result. Existing
SleepEx APC completion returns WAIT_IO_COMPLETION early; directly reusing its
epilogue would lose Beep's result and finish before the tone. This checkpoint
therefore leaves Beep's handler and dynamic availability unchanged. It adds
actual bounded host output ownership as the first prerequisite, with no guest
success path until an alertable continuation can preserve completion across
APCs.

## Output contract

Three returning host imports use the existing generic synchronous broker:

- `beep_start(frequency, duration)` returns a positive monotonically increasing
  process token, or negative Win32 error. Accepted frequencies are 37..32767 Hz,
  duration 1..60000 ms; unsupported longer duration returns -50. Zero duration
  or invalid frequency returns -87. This finite-duration limit is explicit
  prerequisite scope, not the full Windows DWORD duration contract.
- `beep_status(token, release)` returns 0 pending, 1 complete or negative error.
  Release consumes only a terminal record; it cannot orphan a pending tone.
- `beep_cancel(token)` aborts a pending tone with -995. Repeated terminal
  observation is stable until released. Unknown/released tokens return -6.

Successful start creates and connects a sine oscillator through its gain and
the existing wave/master output buses, then schedules its stop on the real
AudioContext clock. The context must already be running; unavailable,
suspended or insufficient-sample-rate output returns -50, including ordinary
headless CLI. Graph/start/stop scheduling failures return -31 and disconnect
partial nodes. Recorder presence never changes output availability, return
values or scheduling. No passive recording is presented as successful sound.

The ended event and clock polling both finish the owned record. An early ended
event or a context suspended/closed before observed completion is an abort,
not success. Completion disconnects both tone nodes. Process audio teardown
aborts pending records; terminal records remain until waiters release them.
At most 64 unreleased tokens exist, with -8 on capacity/identifier exhaustion.
IDs never wrap or reuse, so delayed callbacks cannot complete a newer tone.
SharedAudio owns the map; brokered Worker calls operate on the main output.
No guest callback is invoked by these imports or onended; the existing callback
ownership census hash for host-audio was refreshed after this localized review,
without changing its pending classification or nonlocal gate.

## Authored tests and remaining work

`test-beep-output.js` exercises the real audio-host implementation against a
controlled Web Audio boundary: frequency/duration scheduling, graph connection,
clock/event completion, early end, cancellation, stale tokens, bounds/capacity,
shared ownership, teardown, partial graph failure and recorder independence.
`test-beep-output-broker.js` authors real compiled WAT import calls through a
sibling instance and the synchronous broker, with shared token observations.
Both tests passed during root integration on 18 October; the normal gated build
also passed. Syntax, import-signature generation, WAT balance, logical-operand,
silent-stub and ownership-census source checks passed.
The controlled graph is not evidence of audible browser playback or actual
OS Worker scheduling.

Next required work before enabling Beep: owned reentrant guest continuation,
alertable APC dispatch/resumption without early BOOL return, cancellation on
unwind/thread/process exit, preservation of errors and stack ABI, tests of
APCs queued before and during the wait and nested Beep, and dynamic thunk
execution. No new guest-visible Beep success, sound hardware validation,
game retry is claimed by this checkpoint.

## Integration validation

Independent review found no prerequisite blocker. Root normal build produced
`9176e8197f14f73aff9e7ef850e367ccedd51214d29887f0892df07d6340f0cc`;
the real compiled sibling-instance broker test and controlled audio-host test
passed. This proves import transport and tone lifecycle with a controlled audio
boundary, not OS Worker races, audible playback, or complete Beep semantics.
Evidence: `scratch/runs/20261018-beep-prerequisite-integration/` in the integration
worktree. Two disk-guard stops are retained; prior module stayed unchanged and
process groups were subsequently confirmed absent. After narrowing only clean,
remote-verified finished worktrees, build and broker runs completed without guards
and minimum free space was 2,811,142,144 bytes. Prior module remains preserved.

## Internal alertable continuation checkpoint

The next source slice adds `$beep_begin`, `$beep_continue`, `$beep_finish` and
an explicit owning-thread `beep_cleanup`, plus private thunk marker CACA0040.
Qsort/bsearch retain their existing markers; no new public API/catalog entry
or Beep handler success is enabled. Each active call allocates a 32-byte record
containing its predecessor, original ESP/return address, output token, saved
last-error and a unique invocation token. Nested waits are stacked rather than
sharing global scalar callback state. Resume validates both invocation ownership
and the retained caller frame before observing output or changing guest state.

Queued APCs drain to the private continuation, with the original stdcall frame
still intact. Thus the existing APC machinery's WAIT_IO_COMPLETION/EAX never
becomes the caller's Beep result. The continuation rechecks output after APCs
return; if pending it parks for one millisecond with the existing alertable
sleep hook armed. The scheduler's early APC wake resumes the same continuation.
Only the real output status completes the call; repeated slices with a frozen
audio clock remain pending. Completion restores saved last-error on success,
sets the actual error on failure, leaves the invocation and releases the record.
Synchronous nested host-message contexts reject before starting output because
they cannot service parked slices. Explicit owning-thread cleanup cancels and
consumes every token and unwinds these records in LIFO order.

`test-beep-continuation.js` is authored, not run. It includes actual x86 APC
callbacks queued before and during a wait, callback EAX clobbering, frozen-clock
resumption, BOOL/ESP/error preservation, cancellation, unavailable/suspended
output, invalid frequency and explicit cleanup. For a nested *guest* Beep call
inside the APC, the test compiles one exact, asserted test-only replacement of
the still-disabled public handler with a call to the internal helper. This
exercises guest CALL/RET and nested ownership without claiming the production
export is enabled. Actual dynamic lookup of the production API remains an
explicit future requirement.

The source census adds exactly four pending-classified continuation producers
and refreshes the dispatcher fingerprint for the single CACA0040 case. No
baseline gate was opened. JS syntax, fragment balance, boolean operands,
handler ESP, silent-stub, source census and whitespace checks pass. No build or
runtime validation was performed during this slice.

Remaining blockers before public Beep: forced thread termination must cancel
host output even when its Worker instance is no longer callable; retired and
abandoned callback frames must release ownership/heap records safely; process
teardown must cover all instances. The explicit cleanup export is not yet
wired to those paths. Nonlocal-unwind support is still disabled repository-wide.
Tests must also establish production dynamic resolution, genuine scheduler
alertable wake behavior, Worker teardown, and audible browser output. The
bounded output prerequisites do not yet constitute an enabled Beep API.

## Retirement and generation integration (source-only)

The latest slice supersedes the heap-frame limitation above. Continuations use
`BEEP_CONTEXTS`: sixteen disjoint partitions of 64 records, 32 bytes each.
The existing invocation root identifies a partition lifetime; a new root resets
its private depth/head and private continuation thunk. Forced retirement needs
no foreign-instance heap free or invocation-stack manipulation. The existing
Worker termination barrier still controls slot reuse.

Host lifetime setup now receives the callback allocator's monotonic 64-bit
process epoch and thread root as explicit low/high DWORD pairs. Process begin
retires all prior tokens before accepting a newer epoch. Thread begin accepts
only the current process epoch and a newer thread root (or the same active
root); it cannot reopen a retired root. Start carries thread ID and root, so a
delayed broker start from a retired or replaced lifetime returns -995. Token
IDs remain monotonic across process resets in the same host state. Status and
cancel on released old tokens return -6 and cannot affect newer tokens; delayed
ended callbacks retain only the detached old tone object.

Normal ExitThread and ThreadManager's first exit transition cancel output using
the old root before its slot can be reused. The latter calls a main-instance
export that only reads the shared root and retires host audio; it never executes
the dead Worker's continuation. Duplicate exit notifications skip retirement.
The host exit callback, stopAudio, and GuestThreadHost.stop fence all new output
and release tokens before asynchronous Worker shutdown awaits completion. A
new process epoch is required to reopen output after shutdown.

Authored lifecycle coverage extends the compiled continuation fixture with
actual nested guest APC waits, production ThreadManager forced retirement,
new init_thread root/slot reuse, stale start/retire requests, and process reset.
`test-beep-retirement.js` covers exact 64-bit identities, late ended events,
stale process/thread begin, and the production backend stop ordering while its
Worker retirement promise is pending. This controlled promise is not an OS
Worker scheduling test. The tests remain unrun in this source-only slice. The continuation fixture also
uses the actual ThreadManager alert hook to clear a pending sleep deadline and
an actual guest SetLastError call inside its APC before checking final restoration.

Public Beep still remains disabled pending independent review and the normal
build plus runtime suite. Required remaining validation includes the alertable
continuation itself, scheduler wake timing, actual OS Worker retirement, and
production dynamic resolution once enabled after review. Duration above 60000
ms returns ERROR_NOT_SUPPORTED, invalid frequency/zero duration returns
ERROR_INVALID_PARAMETER, and absent/suspended/insufficient-rate output fails
explicitly. No unavailable-output or recorder-only success is introduced.

### Additional authored validation (not executed)

The compiled broker fixture now routes all seven lifecycle/output imports
through the synchronous broker. An actual Node Worker instantiates the compiled
module and issues a start that main deliberately holds until the owner is
retired and replaced. The stale request must fail without touching the new
tone. Production GuestThreadHost/WorkerLink stop then fences output before
awaiting native Worker termination. Audio remains a controlled WebAudio graph;
this does not establish hardware playback or broad scheduling stress coverage.

The continuation fixture additionally calls production LoadLibraryA and
GetProcAddress for synthetic KERNEL32.DLL/Beep, then executes that thunk in a
nested guest APC using the existing test-only handler substitution. Production
handler remains unimplemented. The ordinal/catalog thunk is also exercised;
neither fixture is an original PE static-import installation test.

Resolution audit qualification: API9 exists even while its handler is a crash
stub. Generic name lookup does not filter crash stubs. GetProcAddress on an
actual loaded DLL resolves that image's export table and may return NULL
without catalog fallback. The original MadBomber missing lookup therefore
still needs module/export provenance; implementing the handler alone has not
been demonstrated to repair that original lookup. No game retry was performed.

### Guarded validation, 2026-10-19

Normal build, pure output/retirement, compiled continuation, compiled broker
with actual Node Worker retirement, production PE/NE/init_thread lifecycle,
private invocation tokens and retired-stack lease regressions pass. Evidence:
`/tmp/wa-crt-descriptor-oct18/scratch/runs/20261019-beep-validation/`.
The continuation fixture currently compiles tail-call dispatch only. Controlled
WebAudio establishes scheduling/cancellation boundaries, not audible hardware
playback. Original game and public handler remain untouched.

Preserved failures identified two sparse build inputs (test runner and bundled
font/bundles), a nonexistent test yield-reset export, and callback code rewritten
without cache invalidation. The fixture now exports its reset and invalidates
each rewritten callback; nested APC depth remains strictly two. The token
microfixture now imports the real audio lifecycle host rather than omitting the
two new dependencies. No production code changed during this validation.

The proposed positive dynamic fixture exposed a real, separate manifest gap:
`src/kernel32-exports.json` omits Beep; `tools/gen-kernel32-image.js` derives the
explicit image export surface from that manifest. GetProcAddress first recognizes
the KERNEL32 image and resolves its export directory at RVA16384; API catalog9
does not override this route. The test now verifies NULL/ERROR_PROC_NOT_FOUND
and the manifest absence while the public implementation remains disabled.
This is evidence of the generated-image gap, not yet proof of the original
MadBomber hModule provenance. Positive dynamic and actual PE static-import tests
remain required for a separate reviewed handler/export enable change.

The subsequently added `--no-tail-calls` fixture option passes the compiler mode
to both the render harness and nested test module. Its first guarded attempt
was killed before test output when available disk transiently dropped from
2,777,149,440 to 2,180,575,232 bytes. The process group is absent and canonical
module unchanged; available disk recovered to 2,773,151,744 immediately after
termination. No 600MB retained artifact was found in this worktree. Non-tail
validation remains incomplete; the failed receipt is retained separately from
the passing tail-call receipt. No unchanged retry was attempted.

After root recovered 661,921,792 bytes from finished, clean, remotely backed
tracked worktrees, one explicitly authorized non-tail retry passed all the
same assertions. Readmission was 3,433,078,784 bytes; runtime minimum was
3,433,037,824 bytes, with no guard event, absent process group and unchanged
canonical module. The original non-tail disk-stop receipt remains retained as
`test-beep-continuation-nontail-diskstop.json`; the passing non-tail receipt is
`test-beep-continuation.json`. Both dispatch modes are now validated. The cause
of the first transient disk drop was not established; no memory size, assertions
or guard threshold changed for the retry.

### Source-only public handler/export enable candidate

The candidate now delegates `$handle_Beep` to the validated alertable entry
helper. KERNEL32 gains exactly one named export, Beep, using new emulator ABI
ordinal586; no previous ordinal changes. The generator updates only its marked
image-export section. The ESP checker recognizes only this named front door's
delegation to `$beep_begin`, whose continuation owns the 12-byte stdcall cleanup.
No API catalog additions or global name-resolution fallback were introduced.

The continuation fixture now invokes the unchanged production handler, with
no handler substitution, and executes the real dynamic KERNEL32 image JMP
inside a nested guest APC. A new `test-beep-production.js` fixture loads an
actual deterministic PE containing a Beep import, checks the patched IAT and
the independently resolved KERNEL32 EAT pointer, then executes both guest
routes. It asserts pending alertable completion, BOOL/ESP/last-error behavior,
invalid frequency/zero duration, unsupported long duration and suspended
output. Both fixtures accept `--no-tail-calls`. Audio remains controlled; the
new source candidate and positive routes have not been built or run yet.

The original MadBomber hModule attribution and any game retry remain separate
from this candidate. The earlier observed generated-export absence is fixed
explicitly here, without claiming that the original failing call has been
reproduced or repaired.

### Public-route validation completed

Synced main66af4d0db (sync-window ownership) without source conflicts. Normal
gated build and production PE static-import/dynamic-EAT fixture pass in both
tail-call and non-tail modes. The updated production-handler continuation
passes in both modes, including the actual dynamic export inside nested APCs.
Pure output/retirement and compiled seven-import broker with actual OS Worker
retirement also pass. No unrelated CRT family was rerun. Evidence is retained
at `/tmp/wa-crt-descriptor-oct18/scratch/runs/20261019-beep-public-validation/`.

One initial build stopped on the host-audio whole-file census hash after a
review-requested comment correction. Its failure receipt remains intact; only
that comment-only source pin was refreshed. No behavioral fix was needed in
this validation. All process groups are absent, no disk/deadline/log guard
fired, and canonical module2abd71d3 remained unchanged. Controlled WebAudio
still does not establish audible hardware playback.

Original log provenance is now established independently: retained rewind
retry `output.log` lines777-778 records API159 LoadLibraryA("KERNEL32.DLL")
returning00db7e54; line1745 records API247 GetProcAddress on that same handle
for Beep, followed by NULL. This identifies the named DLL; it does not trace
the exact internal resolver branch or demonstrate original-game success after
the fix. No original game retry occurred during this validation.
