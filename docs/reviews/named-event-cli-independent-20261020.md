# Independent CLI named-event acceptance — 2026-10-20

**ACCEPT scoped behavior** of exact candidate
`250765e0835dcb4655d06189d05d69c2437d8b3b`, relative to
`f503b7997f87607e5575b6028342b557f775aae6`. No reproducible introduced defect
was found in the supported zero-timeout acquisition boundary. Positive/infinite
named waits and named wait-all intentionally fail; implementing them is outside
this acceptance contract. No production correction or integration was made.

Review branch: `task/named-event-cli-independent-oct20`. Only this report and
`named-event-cli-independent-20261020.js` are added. **NO REMOTE BACKUP**;
publication is held and was not retried. The local commit is recorded in the
external receipt and append-only messageboard.

## Evidence replay

Evidence directory:
`scratch/runs/20261020-named-event-cli-independent-oct20/`.

Verified all 178 submitted source seals against exact candidate Git blobs, and
all 35 supplied artifact seals. Rechecked materialized candidate inputs and
supplied inputs against those seals after testing. Sealed all 128 WAT/WATX
inputs; missing source assertion reads use the exact candidate's Git objects
through `read-only-inputs.cjs`. No WAT build or generated binary is involved.

All 21 commands in the supplied `final-tests.json` reproduced their expected
exit codes, recorded in `replay.json` and individual logs. These include the
full ThreadManager suite, Worker scheduler 57/57, nested lifetime repair 21
groups, original nested wait 14 groups, standalone authority suite, clock-park,
zero-timeout, name decoding, guest RPC nested/import-throw and browser source
checks. Candidate CLI tests passed twice, including 24 two-child auto-reset
races each time and actual Worker nested rejection/broker acquisition/error
propagation.

The six supplied rejecting runs failed at their intended assertions:
exact-base child Open=0 / parent wait=258; independent child authorities giving
two winners; unchanged historical baseline child Open=0; removed acquisition
dispatch; omitted provider Close; and mirrored Worker proxy consumption.
The unchanged historical gap test passed against candidate source and its
local mode passed. Its historical tagged-handle auxiliary calls remain weak
lifecycle evidence; independent valid-handle probes below supply that evidence.

## Independent adversarial probes

Run from the review checkout:

```sh
node docs/reviews/named-event-cli-independent-20261020.js
node docs/reviews/named-event-cli-independent-20261020.js --lost-response
node docs/reviews/named-event-cli-independent-20261020.js --control
node docs/reviews/named-event-cli-independent-20261020.js --control-stale
```

The first two exit 0. The controls must exit 1 at behavioral assertions, not
loading errors. `independent-tests.json` records commands and exits. The normal
run has eight passing groups, plus one fault-injection group:

* Main and nested CLI imports reject mixed named/local/stale-named unsupported
  waits across five orderings, both wait modes and positive/infinite timeouts.
  Separate acquisitions prove both local and remote tokens remained available.
  Zero-timeout stale-named sets also fail before consumption. Valid wait-any
  preserves ordering and does not consume later members.
* Stale **local** events retain the exact base's unknown-handle success
  convention. A stale-local-before-named wait returns that legacy first index
  and leaves the named token untouched. This is preservation evidence, not a
  claim of general invalid-handle conformance.
* A real Node Worker exercises 18 stale/named/local mixed waits, including a
  deliberately signaled proxy mirror. All fail without consuming any mirror.
  A stale/local-only set returns null for broker delegation, with local state
  untouched. Supplied actual `createWorkerImports` and broker tests additionally
  verify the wrapper and ordinary authority route, including poisoned errors.
* Forty close/recreate cycles distinguish provider generation and local handle,
  preserve a partial Open reference after CloseHandle, reclaim the final
  CloseEvent, and refuse stale mutation/acquisition after slot reuse.
* Local mutex and semaphore conflicts reject in both creation orders and Open,
  while unnamed and existing local semantics remain covered by regressions.
* Filling all 4,096 local slots prevents remote allocation altogether. An
  independent client cannot open the failed name. Freeing one slot recovers;
  final close removes the newly created remote event.
* Filling the provider client's 4,096-reference quota makes Create return zero
  and Open throw ENOSPC without changing local or remote reference accounting.
  A different failed name is absent, close/reopen recovers capacity, and final
  reference release removes the name. This tests ordinary capacity failure;
  arbitrary JavaScript heap-OOM recovery is not claimed.
* A fresh independent CLI owner exits normally, removes its socket directory,
  and leaves the review's separate namespace usable.
* Fault injection runs the actual authority server in a Worker and suppresses
  only Set's response after committing Set. Another manager acquires that
  signal exactly once. The initiating manager times out, retains its poisoned
  client, and rejects Set/Reset/Close/Wait/Create without reconnect. Failed Close
  leaves local accounting intact. This explicitly proves unknown outcome,
  rather than inferring non-commit from a timeout.

The two new controls alter source only in memory: removing the entire multiple
wait guard returns 0 instead of WAIT_FAILED; removing only its stale-proxy
check also returns 0 on a mixed stale set. Both are rejected by independent
assertions. Candidate production files remain byte-identical.

## Source assessment and qualification

Proxy creation reserves a free local slot before requesting a provider reference.
Type 4 has no consumable local signal. Repeated references share the local
handle while retaining separate provider handles; close acknowledges the remote
release before changing local bookkeeping. Final close clears the local slot,
and the issued-handle set rejects previously issued proxy handles. Reuse tests
cover serialized host operations; handle-number wraparound and concurrent
CloseHandle-during-wait conformance are not established.

Both actual `fork(__filename, args, ...)` statements obtain the same namespace
environment, including when both children precede the first event. The supplied
test executes each statement and the complete actual event import block against
real subprocesses. PE loading, VFS setup, launch arguments and memory/exports
are fixtures: this qualifies **fork-statement/import-block integration**, not
complete CreateProcess callbacks, guest x86 execution or PE startup.

Only the process that creates the authority owns removal of its private socket
directory. Inherited-endpoint processes are clients; child shutdown releases
client references without removing the parent's namespace. Owner exit cleanup
and child survival distinctions are exercised separately. Owner crash still
loses the namespace; asynchronous EOF reclamation is not crash recovery.

Single waits dispatch proxies directly to the authority only at timeout zero.
Multiple waits prevalidate issued stale/tagged proxies and unsupported named
modes before calling any acquisition. Cooperative wrappers preserve those
failures. Worker-local nested paths reject type 4 before resolving/consuming
members; ordinary Workers route through the broker. No proxy signal is acquired
from the local mirror. Authority transport failures propagate; existing-client
poisoning and initialization-failure latching prevent reconnect or replay.

Cross-kind conflicts are process-local only. Cross-process mutex/semaphore
registration, comprehensive GetLastError/access/security conformance, positive
or infinite named wait scheduling, named wait-all, local nested Worker named
acquisition and hostile-peer behavior remain excluded. These are documented
boundaries, not requests for additional feature implementation.

## Isolation and recovery

An explicit 178-path, 6,527,821-byte sparse projection was recorded before
checkout. The isolated repository starts at the exact candidate and uses
flattened read-only object views, without editing supplied object-store metadata.
Shared and supplied HEAD/index/config hashes are recorded and rechecked.
Historical artifacts are rehashed after testing. No main/source/shared checkout,
laptop Heroes II/Warcraft III or unrelated WIP changes were made. The board is
the sole append-only coordination exception.

The 16 MiB allocation cap and fixed 2,285,895,680-byte available floor were
checked before write batches and at completion; final values are in receipt.
`change.patch`, `commit.patch`, source/WAT seals, logs, verification, receipt and
`SHA256SUMS.json` preserve recovery evidence. Restore the exact candidate object,
apply the local review patch and replay the recorded commands; the supplied
historical/mutation command dependencies remain explicit absolute paths.

No workers were spawned, queue refilled, remote runtime/Boat/browser/SSH/auth
access attempted, publication retried, full build executed, or full VM/native/
game qualification claimed. This bounded review ends with scoped acceptance.
