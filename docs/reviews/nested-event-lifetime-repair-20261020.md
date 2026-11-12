# Nested event lifetime correction — 2026-10-20

Corrects the false WAIT_OBJECT_0 introduced by candidate
`8213294c2ab39b1b925c45da3bf25355c17a4c55`. Task branch
`task/nested-event-lifetime-repair-oct20` starts at exact independent review
`64a4132887e1180663fe44c1d8dc35eed18ee023`; its production baseline is
`c9e03eb6e40481f6bb570a89f96b856a9a1d5e83`. No main integration.
**NO REMOTE BACKUP**: established credentials/host-key publication block was
not retried or bypassed. Local patches and receipts accompany the commit.

## Narrow correction

The event-only nested pump validates the original issued handle, its slot,
the shared issued-handle mirror and event type before sibling dispatch and
again before acquisition. A final close invalidates that identity, including
when the slot now holds a new signaled event. The pump returns WAIT_FAILED
instead of entering the inherited unknown-handle success fallback. A partial
named-reference close leaves the original identity live and waitable.

Acquisition still uses the existing real auto-reset compareExchange; manual
reset remains available to later waiters. Scheduler eligibility, ownership,
DLL attach, budgets, sleeping deadlines, finite sentinel and Worker backend
paths are unchanged. No error suppression, synthetic signal, transport change
or callback continuation redesign was added.

This defines only serialized cooperative host behavior: final closure before
the post-slice acquisition yields WAIT_FAILED, even if the original event was
signaled earlier in that slice. Closing before signaling makes SetEvent fail.
An acquisition completed before a later close remains successful. A new slot
generation's signal is not acquired by the original waiter. Partial close plus
signal succeeds while a reference remains. There is no dispatch/reentry between
the post-slice validation and synchronous acquisition on this host.

This is **not native CloseHandle-during-wait conformance**. Concurrent final
closure/reallocation racing between validation and CAS is unsupported; these
separate identity/type/state reads are not an atomic lifetime protocol. Worker
signal consumers remain covered by the existing CAS test, not a concurrent
close stress test. Initially invalid-handle success remains inherited and is
explicitly observed, not endorsed or globally redesigned.

## Corrected acceptance and evidence

The new JS file derives from the supplied independent reproducer. The original
files and supplied run evidence are unchanged. The historical unconditional
`actual === 0` closure assertion was changed to `actual !== 0` in the NEW test,
as authorized. Its other independent cases remain, with additional reference,
generation and ordering cases. New case names avoid the historical `close-`
summary filter so that filter continues to address the original two cases.

From this isolated checkout:

```
node docs/reviews/nested-event-lifetime-repair-20261020.js --accept
node docs/reviews/nested-event-lifetime-repair-20261020.js --original
node docs/reviews/nested-event-lifetime-repair-20261020.js --remove-lifetime
node --require ../read-only-inputs.cjs docs/reviews/nested-event-wait-20261020.js
node --require ../read-only-inputs.cjs docs/reviews/nested-event-wait-20261020.js --baseline
```

The corrected acceptance passes **21 groups**. Original candidate and new
mutation removing both actual lifetime guards reject at the closure assertion
with actual zero. Exact-base independent observation passes its three groups.
The submitted production test passes **14 groups** on repair and rejects exact
baseline. Its four behavioral mutations (synthetic success, running suspended
threads, reentry, non-atomic consumption) still reject their assertions.

The preserved historical default command appropriately fails on repaired code
because it asserts the historical defect's zero result. It is not acceptance;
its contradictory `--accept` contract was not rewritten or represented as fixed.

All eight existing suites pass: full corrected ThreadManager, clock park,
Worker scheduler (**57/57**), browser self-suspend source test, cold/warm lifecycle,
sync names, zero-timeout waits, and guest-RPC nested waits. The last is a local
compiled dependency-slice test, not a cross-process transport qualification.
No full build or browser was run.

Evidence: `scratch/runs/20261020-nested-event-lifetime-repair-oct20/` contains
`tests.json` with all 19 exact commands/exits/log hashes, `source-seals.json`,
`input-verification.json`, `setup.json`, `receipt.json`, `SHA256SUMS.json`,
`change.patch` and `commit.patch`. All 156 supplied review input seals were
verified against exact review blobs; the WAT inputs also match exact base and
are reused read-only by the source reader. The explicit sparse projection was
measured at 1,979,663 bytes before checkout; only `src/main.watx` is materialized.
Alternates are flattened, supplied stores are read-only, and writes remain
under the 16 MiB run allocation and fixed 2,285,895,680-byte free-space guard.

Shared/supplied HEAD, index, config and historical evidence are sealed and
checked unchanged. Only the manager and this new test/report pair are committed.
No workers, refill, main changes, runtime/Boat/SSH/auth work or publication retry.
Laptop Heroes II/Warcraft III and existing WIP remain untouched. Tiny actual Wasm
callback/sibling modules execute production JS imports/provider/scheduler with
explicit memory/register/lifecycle fixtures. No native, full VM, PE/x86, browser,
game, nonempty guest DllMain or concurrent-close qualification is claimed.
