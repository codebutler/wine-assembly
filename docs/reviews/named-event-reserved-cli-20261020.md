# Reserved CLI wait integration: blocked at actual Worker entry

**CLI NOT ACCEPTED. No production changes.** Exact base:
`0fab66e15696afcdfab95ee2c68deac2d00d48fe`; isolated local branch:
`task/named-event-reserved-cli-oct20`. The accepted provider
`32876c2596213d82e4ad074b37fe19bb18400b72` is preserved byte-for-byte.
This task stops at the explicitly permitted larger-prerequisite blocker.

## Concrete blocker

An ordinary CLI guest Worker calls the host import built by
`lib/guest-rpc.js:createWorkerImports`. That import enters `brokerCall` before
the `wh.wait_single` adapter in `test/run.js` executes. The shared RPC sends
only the two signed i32 arguments, handle and timeout. `createMainBroker`
reconstructs that array and invokes the CLI adapter. Neither the message nor
the invocation carries the guest's entry instant or an entry-owned reservation.
Capturing `waitClock({ callerEntry: true })` in the assigned `test/run.js` or
`lib/thread-manager.js` scope therefore starts the deadline after this transport.
It cannot account for the time the Worker already spent blocked in guest RPC.

The NEW `test/test-named-event-reserved-cli.js` uses an actual Node Worker,
production `createWorkerImports`, production `createMainBroker`, the extracted
unchanged production per-thread CLI adapter, and actual authority transport.
It delays serving the posted RPC by 180ms. An already-signaled auto event and
50ms timeout return success after at least 180ms. Instrumentation confirms the
adapter receives exactly `[handle, 50]`. This is not an independent wait model.
The entry measurement is immediately before the real host import; the entire
injected delay occurs inside that call, after its actual entry.

A clearly labeled near-miss control substitutes the accepted provider's
`waitClock({ callerEntry: true })` and `registerWait` at the broker-side
ThreadManager entry, without editing any production file. It also returns
success after the original 50ms budget. Thus simply replacing scheduler-sampled
acquisition at the assigned adapters does not meet the requested timing contract.
This control is not presented as safe continuation integration. Its one terminal
reservation is forgotten, its handle closed, and the real Worker terminated.
The process uses the existing production authority exit cleanup.

`--require-entry-budget` deliberately asserts the requested timeout instead and
exits 1 at that behavioral assertion. Default exit 0 means the blocker was
reproduced, not that finite waits passed acceptance. These tests do not exercise
a full interpreter frame or PE boot. Register exports are fixtures. The existing
finite suite separately exercises scheduler continuations and actual subprocess
and Worker transport; its passing result retains its historical conditional
scope, including the known lost-pulse defect.

## Required prerequisite and remaining gates

The next assignment needs explicit ownership of Worker host-entry/RPC plumbing
(at least `lib/guest-rpc.js`, plus setup and ABI consumers as required). Define
and capture a qualified timestamp at that actual host entry, before transport,
and carry it with invocation identity to the owning authority client. Alternatively
register from a correctly initialized Worker-side client and design how that
session's reservation is owned, polled and cleaned up across the broker. The
existing provider validates clock stamps within a client/authority contract;
do not invent a timestamp conversion or a second registration at the broker.
No provider defect is demonstrated here and no provider repair is requested.

Then implement and test one reservation per invocation/continuation; status
polls without reacquisition; manual-all and auto-one Set–Reset reservations;
late observation of predeadline assignments; cancel/status resolution and
terminal forgetting; owner/thread/process teardown and close/recreate; rejection
of unsupported infinite, multiwait and nested paths before acquisition; explicit
errors, ENOSPC and unknown-outcome handling without replay. Required rejecting
controls for lost pulses, duplicate registration, stale continuations and
lifetime, plus full continuation acceptance, remain **unexecuted for a new
integration**, because no such integration was fabricated.

Even after entry plumbing is repaired, a clock request does not register a wait.
The gap from guest host-entry to the authority registration turn is unreserved:
a Set–Reset entirely in that gap may be missed. The authority registration turn
is the reservation linearization point, not guest entry. Document this explicitly;
it is not Windows parity. The provider's same-boot/stable-time-namespace trusted
Linux Node 24.18.1/libuv 1.52.1 qualification remains unchanged. Eligibility is
bounded; transport return latency is not. No full VM/game/browser/native Windows
qualification is claimed.

## Evidence, isolation and recovery

Evidence root: `scratch/runs/20261020-named-event-reserved-cli-oct20/`.
`projection.json` was written before materialization: 6,600,473 bytes projected,
3,651,264,512 bytes free, 32MiB allocation and fixed 2,285,895,680-byte floor.
The fresh sparse repository uses 35 flattened alternate views; borrowed object
contents are read-only inputs, with no nested alternates in those views.
Shared and supplied HEAD/index/config remain unchanged. Historical reports and
evidence are not rewritten. No broad checkout or build occurred.

`tests.json` and separate logs record actual commands and expected exits;
`verification.json`, `source-seals.json`, patches, `receipt.json` and
`SHA256SUMS.json` preserve final identity and checks. The new test follows the
existing automatic UNIT filename classification; no tier manifest edit is
necessary. Preserve borrowed object stores as well as the local patches.
Replay from the isolated repo with `node test/test-named-event-reserved-cli.js`,
then its deliberately rejecting `--require-entry-budget` control. Do not mistake
the blocker regression for acceptance if scheduling is later redesigned.

Publication hold retained: **NO REMOTE BACKUP**. No main integration, push,
deployment, workers/refill, Boat/SSH/browser/fullbuild, denied-action/auth/trust
retry, laptop game or Claude changes. Only the new reproducer and this report
are committed. The coordinator owns any successor assignment; this worker stops.
