# Independent nested event acceptance — 2026-10-20

**REJECT** production candidate `8213294c2ab39b1b925c45da3bf25355c17a4c55`
against exact base `c9e03eb6e40481f6bb570a89f96b856a9a1d5e83`.
One introduced false-success defect is sufficient to block acceptance. No
production fix or main integration was made. Review branch:
`task/nested-event-independent-oct20`. **NO REMOTE BACKUP**; existing publication
block was respected without retry, auth/trust changes, or alternate routing.

## Blocking reproduction

At `lib/thread-manager.js:1605–1607`, the new event pump dispatches arbitrary
eligible siblings and then accepts the result of `waitSingle(handle, 0)` without
revalidating the event's lifetime. `closeEvent` removes the exact issued handle
from the provider map. The subsequent poll reaches the historical unknown-handle
fallback at line 1574 and returns zero. The new pump interprets that zero as
successful acquisition.

Minimal sequence through unchanged production CLI imports and actual runSlice:

1. Create an unsignaled auto-reset event.
2. Register a runnable cooperative sibling whose run closes that event, never
   calls SetEvent, and optionally allocates a new unsignaled event in its slot.
3. From a live tiny Wasm callback, call the CLI `wait_single(event, -1)` import
   with synchronous-message depth one.
4. Candidate returns **WAIT_OBJECT_0 (0)** after dispatch. With slot reuse, the
   new handle differs from the original and its zero-timeout wait is still
   WAIT_TIMEOUT (258). No event was signaled.

Both closure variants independently reproduce. Exact base returns WAIT_FAILED
(4294967295) without running this sibling. Calls that **begin** with an already
closed handle return zero on both versions: that invalid-handle limitation is
inherited, but converting a valid unsignaled wait into success due to a newly
executed closing sibling is introduced. This finding is a false acquisition,
not a claim of a particular native Windows outcome for CloseHandle during wait.

Run from the isolated review checkout:

```
node docs/reviews/nested-event-independent-20261020.js
node docs/reviews/nested-event-independent-20261020.js --baseline
node docs/reviews/nested-event-independent-20261020.js --accept
```

The first two commands assert and print exact candidate/base observations. The
third intentionally exits 1 with the independent acceptance oracle:
`a valid unsignaled event closed during pumping must not become WAIT_OBJECT_0`.
No production methods are replaced to produce the defect; runSlice is wrapped
only to record its returned statistics. Baseline selection loads the exact base
manager blob in memory. The complete CLI import block is extracted unmodified.

## Other review evidence

Read the entire two-hunk production diff, event allocation/closure/provider,
cooperative scheduler eligibility and accounting, DLL attach continuation,
CLI and host nested-wait callers, and Worker import boundary. Independently
verified all **154 submitted input hashes against candidate Git blobs**, checked
materialized inputs against those hashes, and verified **26 supplied artifact
seals**. This reused the relevant sealed closure rather than another source
census. All eight submitted regression suites were rerun successfully, including
Worker scheduler **57 passed, 0 failed**. The submitted 14 groups pass; exact base
and all four submitted behavioral mutations fail their intended assertions.

Eight independent candidate observation groups and three base groups cover:

- Closure, closure plus slot reuse, and inherited already-invalid success.
- Three active siblings: nonproducer, nonproducer, producer all get normal
  scheduler turns; reentrant waits from a dispatched sibling fail without losing
  the owning handle. Scheduler ownership returns to zero without hidden traps.
- Three runnable nonproducers exhaust the actual budget after 224 slices,
  67,200,000 charged steps and 448 runs each; no false success. runSlice charges
  50,000 per successful dispatch, so two passes over three threads charge
  300,000 per slice, not the nominal batchSize 100,000. This is conservative
  accounting, with one-slice overshoot of the outer 64 Mi-step bound.
- Cold empty-DLL attach completes and the producer runs despite zero measured
  `blocks`; charged `steps` is 100,000. The loop uses steps, not measured blocks.
- A real zero-step scheduler path: marking the cold sibling as a render-send
  target creates `_dllAttachOperation` before the scheduler skips execution.
  The nested wait returns failure after one zero-step slice. Removing that
  exclusion allows the next wait to finish attach and signal. This is lifecycle
  preparation, not executed guest progress; no busy loop or false success was
  observed. The probe does not qualify nonempty guest DllMain callbacks.
- Finite wait retains 0xffff and suspended producer stays unexecuted until
  resume. Submitted controls additionally exercise manual reset, competing CAS
  consumption, foreign DLL owner, sleeping producer, and Worker exclusion.

The signed `stats.steps | 0` conversions are brittle for artificial out-of-range
statistics, but are not a demonstrated production overflow: the unchanged
CreateThread allocator has 15 worker slots, and these fixed pump arguments yield
at most two 50,000-step passes over eligible slots (1,500,000). The outer bound
is far below signed overflow. No fabricated runSlice return value is presented
as an actual reachable production failure.

The CAS change correctly prevents a single auto-reset wait from reporting success
when a competing consumer takes its observed signal. The submitted deterministic
interleaving and its non-atomic rejecting control were rerun. This is not a new
concurrent stress qualification or certification of multiple-object waits.

Finite nested sentinel/deadline behavior, async continuation needs, unavailable
producers, and initially invalid handle success remain inherited limitations.
No second newly introduced defect is asserted from those limitations. The
closure finding remains blocking even though the happy-path and regressions pass.

## Scope and recovery

Tiny actual Wasm callback/sibling modules execute production JS import/provider/
scheduler code; memory, registration, register getters, sync depth, and empty DLL
tables are fixtures. No native Windows, full VM, PE/x86, browser, game, runtime,
cross-process event authority, full build, Boat or SSH qualification is claimed.
No workers were spawned. Laptop Heroes II/Warcraft III and review holds remain
untouched.

Evidence directory: `scratch/runs/20261020-nested-event-independent-oct20/`.
`tests.json` records commands, exits and log hashes; `input-verification.json`
records seal results; `setup.json` records exact sparse projection and flattened
read-only alternates. The existing source reader is copied into this run and
reads missing WAT blobs from the exact base without writing supplied evidence.
Only src/main.watx is materialized, not the src fragment closure. `receipt.json`,
`SHA256SUMS.json`, `change.patch` and `commit.patch` preserve the final audit and
local recovery evidence. The two new review files are the only committed delta.
All artifact-producing stages check the fixed 2,285,895,680-byte disk floor and
16 MiB total run cap with reserve; shared and supplied HEAD/index/config and
supplied evidence are checked unchanged. Stop after this verdict; further work
requires a coordinator assignment.
