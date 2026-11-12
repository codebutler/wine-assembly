# CLI named-event authority integration

Exact base `f503b7997f87607e5575b6028342b557f775aae6`; isolated branch
`task/named-event-cli-integration-oct20`. Local tested change only;
**NO REMOTE BACKUP**. Publication hold was not retried.

## Implemented boundary

The CLI event import adapter explicitly enables authority-backed named events.
Unnamed events and managers used by browser/local callers retain their existing
implementation. The accepted `lib/named-event-authority.js` is byte-for-byte
unchanged. No mutex/semaphore transport or scheduler redesign is included.

Both existing CLI fork statements obtain `ThreadManager.namedEventEnvironment()`.
The first parent event operation or fork establishes one endpoint; subsequent
forks distribute that endpoint, even when children launch before any named event
exists. A process inheriting `WINE_NAMED_EVENT_ENDPOINT` is a client, never the
namespace owner. There is no signal snapshot in fork arguments or guest memory.

Each manager owns a synchronous client and maps local numeric handles to provider
references and their generation. Repeated Create/Open retains the existing local
handle and adds a provider reference. Close releases exactly one reference before
changing local accounting; the last close recycles the slot. Recreating a name
gets a new provider generation and local handle. Issued proxy handles remain
recognizable as stale after close, including a mistakenly unstripped private
CreateEvent result tag; they cannot fall through to legacy unknown-handle wait
success. Process exit shuts down its clients. Only the owner removes the private
socket directory; process teardown terminates its authority Worker. Child exit
cannot stop the parent namespace. Abrupt owner failure still loses the namespace,
as documented by the accepted provider.

Proxy slots have distinct type 4 and zero state/mode words. Create/Open/Set/Reset/
Close and zero-timeout acquisition call the authority synchronously. Auto-reset
check-and-consume occurs only at the authority, including ordinary guest Worker
broker calls. No main, nested or Worker route consumes a proxy's local word.

## Wait and error contracts

This implements acquisition, **not full named wait support**. Main and cooperative
nested zero-timeout single waits use the authority. Zero-timeout wait-any routes
its named members there too. Named wait-all and positive/infinite named waits
return `WAIT_FAILED` before consuming anything; no successful continuation or
scheduler sentinel is invented for those unsupported operations. Existing local
finite/infinite scheduling and nested local event pumping are unchanged.

The guest Worker local nested-wait adapter rejects an entire set containing a
type-4 proxy before acquiring any member. Ordinary Worker waits retain the broker
route to the owning manager. The existing broker's exception protocol propagates
authority failure to the guest Worker instead of returning zero/success.

| Condition | Adapter result |
| --- | --- |
| Missing named Open (`ENOENT`) | 0; existing WAT maps to error 2 |
| Create capacity failure (`ENOSPC`) or no local slot | 0; existing WAT maps to error 8 |
| Process-local cross-kind name conflict | Existing `0x80000000` sentinel; WAT maps to error 6 |
| Existing Create | Existing private bit-31 result tag; WAT strips it and reports 183 |
| Invalid/stale Set/Reset/Close proxy | 0 |
| Stale proxy wait or unsupported named wait | `0xffffffff` (`WAIT_FAILED`) |
| Validation, Open capacity, authentication, connection or transport failure | Exception; never a missing-name, unsignaled or successful result |

The existing guest ABI cannot represent every provider error as a distinct
GetLastError value. Unrepresentable failures deliberately stop the import; this
is not a claim of comprehensive Win32 error-code conformance. Transport timeout
or disconnect remains an unknown outcome. The retained client stays poisoned;
there is no replay, replacement authority or local fallback. A constructor
connection failure is also latched, preventing reconnect on the next operation.

## Tests and discrimination

Run `node test/test-named-event-cli-integration.js`. It executes the complete
actual CLI event import block, actual ThreadManager, and each actual CLI fork
statement, with real Node subprocesses. Launch arguments and memory/export
fixtures replace PE/VFS setup. It does not execute the complete CreateProcess
callbacks or the full CLI executable loader.

The new test covers endpoint propagation through both statements before event
creation; parent create / child open+set / parent acquisition; 24 two-child
auto-reset races with exactly one winner; manual broadcast/reset; existing-create
mode/state preservation; partial/final references; child cleanup and parent
ownership; generation/slot recreation; stale/private-tag rejection; unnamed
regressions; unsupported main/nested waits without consumption; cross-kind local
conflicts; validation errors; connection initialization failure; bridge timeout
and poisoned reuse. Actual guest Workers test both local nested rejection and
ordinary broker acquisition/exception propagation. The local Worker test even
plants a signaled proxy word and proves it is not consumed.

`--baseline` loads exact-base ThreadManager and CLI source directly from Git
objects. It rejects at child Open=0 and parent wait=258. The candidate yields a
valid child handle and parent wait=0. `--independent-control` gives the two real
children independent authorities and one logical signal each: its exactly-one
oracle rejects results `[0,0]`.

The **unchanged original gap test** was also replayed with byte-identical test
source against the candidate imports/manager: default acceptance passes, and
`--local` passes. Its original supplied checkout fails default acceptance.
The historical test's auxiliary child calls pass a tagged CreateEvent result
without stripping its tag; they are not reliable lifecycle evidence. The new
test uses valid guest handles and separately checks the private tag is rejected.
Neither the historical source nor supplied evidence was edited.

Three additional in-memory behavioral mutations reject with assertions:

* Remove authority acquisition dispatch: a second acquisition falsely succeeds.
* Omit provider Close: last-close name lookup unexpectedly still succeeds.
* Treat a Worker proxy as a local event: nested acquisition falsely succeeds.

Existing full ThreadManager, Worker scheduler (57/57), clock-park, zero-timeout,
browser-main self-suspend source check, name decoder, guest RPC nested wait and
import-throw suites pass. Accepted nested lifetime repair (21 groups) and nested
wait (14 groups) tests pass. The unchanged standalone authority suite passes.
The test command receipts distinguish expected rejecting controls from passes.

## Evidence, limits and recovery

Evidence is under `scratch/runs/20261020-named-event-cli-integration-oct20/`:
projection records, test commands/logs, read-only exact-source preload,
in-memory mutation recipe, byte-identical historical replay, input seals,
protected metadata verification, receipt, `change.patch`, `commit.patch` and
`SHA256SUMS.json`. The receipt identifies the exact tested commit. Apply the
patch to the exact base and run the commands recorded in the receipts. Missing
WAT source assertion inputs are read from exact Git blobs, not checked out or
built. Sparse materialization was measured first; read-only object-store views
flatten inherited alternates without modifying source stores. Initial allocation
projection was 6,091,697 bytes across 171 paths, with separately measured test
additions. The 16 MiB task allocation and fixed 2,285,895,680-byte free floor
were checked before write batches. Final allocation/free space is in receipt.

Unsupported: named positive/infinite scheduling, named wait-all, local nested
guest Worker named acquisition, remote mutex/semaphore cross-type arbitration,
native access rights/security, comprehensive guest GetLastError translation,
owner crash recovery and hostile-peer security. Named event versus mutex name
conflicts are enforced only within a process's known objects; the standalone
event authority does not register mutexes in another process. These limits are
not full wait or shared-kernel-object conformance claims. No full VM, PE, game,
browser/runtime, WSA event API or native Windows qualification is asserted.

No main integration, shared checkout edit (apart from append-only coordination),
workers, queue refill, remote publication, runtime access, Boat, full build,
SSH/auth retry or laptop game work occurred. Single bounded task stops after
local commit and evidence preservation.
