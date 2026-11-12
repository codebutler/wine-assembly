# Independent nested event lifetime acceptance — 2026-10-20

**ACCEPT scoped source behavior** of exact
`b01994ffac83f083c474c8a98a507a6dd417f0fa`, compared with rejected
`8213294c2ab39b1b925c45da3bf25355c17a4c55` and baseline
`c9e03eb6e40481f6bb570a89f96b856a9a1d5e83`.
No production edits or integration. **NO REMOTE BACKUP**: established
publication block respected without push, trust, authentication or route retry.

The production delta from rejected candidate is confined to the original-event
lifetime predicate and its two checks around sibling dispatch. From baseline,
the additional changes are bounded cooperative event pumping and atomic
auto-reset acquisition. The reports and tests accurately scope these changes.

## Source assessment

`_getSyncIdx` checks the issued handle map and current slot handle. The new
predicate additionally requires the shared issued-handle mirror to equal the
original unsigned handle and the slot type to remain Event. Final close clears
the mirror and type and deletes the map/current handle; allocation publishes a
different issued handle on reuse. Thus both closure and reuse reject before
`waitSingle` can apply its inherited unknown-handle success fallback. The loop
checks before dispatch and again before acquisition. Partial named-reference
close decrements the reference count without invalidating the identity.

Within serialized host execution, there is no sibling dispatch between the
post-dispatch check and acquisition. A signal followed by final close during
the slice returns WAIT_FAILED; final close followed by signal rejects SetEvent.
Partial close and signal in either order succeed. Acquisition completed before
a later close stays successful. A signaled replacement remains unconsumed.

Auto-reset success requires compareExchange(1, 0) to return 1, so another signal
consumer winning after the initial load prevents a second success. Manual-reset
success leaves the signal available. This does not make identity validation and
acquisition an atomic lifetime protocol: concurrent final close/reallocation
racing those reads or CAS is explicitly unsupported.

The event branch preserves existing scheduler eligibility and reentry guards:
an executing cooperative sibling cannot recursively pump; suspended/sleeping
threads do not become runnable, DLL attach gates remain in runSlice, and the
Worker backend retains its sentinel path. No-progress and the 64 Mi-step budget
fail rather than fabricate acquisition. Actual accounting may exceed the budget
by one slice. Finite waits retain their existing sentinel behavior. The source
tests exercise these constraints, including zero-block progress and attach work
that initially executes zero steps. They do not establish async continuation,
nonempty guest DllMain, native scheduling or cross-process event authority.

## Oracle and replay

The NEW corrected oracle is noncontradictory: both initial closure cases require
nonzero, their summary repeats that requirement, and added lifecycle cases
require exact WAIT_FAILED for final closure. Live partial/normal cases require
success. The old historical default requires the former bug and appropriately
fails repaired source; it was preserved unchanged, not used as acceptance.

All 19 supplied commands were independently replayed from the exact sparse
checkout with expected exits: corrected acceptance 21 groups, submitted 14
groups, original candidate rejection, removed-lifetime rejection, exact-baseline
observations, submitted baseline rejection, four submitted rejecting controls,
eight regression suites, and historical expected failure. Regressions include
full ThreadManager, clock park, Worker scheduler 57/57, browser self-suspend
source test, cold/warm lifecycle, sync names, zero-timeout and guest-RPC nested
waits. No actual browser or full build ran.

The submitted original-source control stops at the first closure failure.
The NEW independent JS therefore collects all results before its final
assertion. Its 14 cases cover auto/manual close, twice-recycled unsignaled and
signaled slots, signal-final-close, both partial-close/signal orders, and normal
signal. Real provider operations run through a deterministic runSlice action
adapter; this supplements the submitted actual scheduler/Wasm callback tests.

* Repair: all 14 pass, including exact WAIT_FAILED and replacement retention.
* Baseline: all 14 return WAIT_FAILED with zero dispatches, as expected; this is
  a baseline observation, not a claim it supports nested producer progress.
* Original: eight independently observed failures, covering final close, both
  reuse variants and signal-final-close for both reset modes, all false zero.
* Removing only the post-dispatch check: the same eight behavioral failures.

Reproduce from the review checkout:

```
node docs/reviews/nested-event-lifetime-acceptance-20261020.js repair
node docs/reviews/nested-event-lifetime-acceptance-20261020.js baseline
node docs/reviews/nested-event-lifetime-acceptance-20261020.js original
node docs/reviews/nested-event-lifetime-acceptance-20261020.js remove-postcheck
```

The last two intentionally exit 1 at the aggregate behavioral assertion after
printing every result. The original defect cannot be hidden by an earlier
closure assertion, nor can replacement signal consumption pass unnoticed.

## Provenance and limits

Evidence lives in `scratch/runs/20261020-nested-event-lifetime-acceptance-oct20/`:
`setup.json`, `tests.json`, `independent-tests.json`, individual logs/JSON,
`verification.json`, `receipt.json`, `SHA256SUMS.json`, and review patches.
All 156 supplied source seals matched exact candidate blobs; all 28 supplied
artifact seals verified before replay. WAT inputs are read from sealed baseline
objects and checked against candidate; only src/main.watx is materialized.
Sparse projection measured 1,996,401 bytes before checkout. Object alternates
are flattened and read-only. The run retains a 16 MiB allocation and fixed
2,285,895,680-byte minimum free-space gate, checked before writes.

Only this NEW report/test pair is committed on
`task/nested-event-lifetime-acceptance-oct20`. Shared/supplied HEAD, index,
config and evidence are verified unchanged; existing WIP and laptop work are
untouched. Local patches rely on the existing alternate object stores for
reconstruction; they are not a remote or standalone repository backup.

Acceptance covers serialized cooperative host source behavior only. Initially
invalid handles retain inherited success behavior. No native CloseHandle-during-
wait conformance, concurrent closure safety, full VM/PE/x86, browser, game or
transport qualification is claimed. No workers, refill, runtime/Boat/SSH access,
publication retry or integration was performed. Task complete; stop.
