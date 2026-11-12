# Synchronous named-event authority prerequisite

Base: exact available `f695767607fa614cf27f2dc7c5c604f6073f6e0c`, containing
accepted nested lifetime repair `b01994ff`. Branch:
`task/named-event-authority-oct20`. **Local only; NO REMOTE BACKUP.**

This is a standalone Node provider, with no guest import, ThreadManager,
test/run.js, main, mutex, semaphore or continuation changes. No game, PE,
native-Windows, browser or guest Worker integration qualification is claimed.

## Transport and API

`lib/named-event-authority.js` exports `NamedEventAuthority` and
`NamedEventClient`. Construct one authority per namespace owner, distribute its
`endpoint` to subprocess clients, and await `authority.close()` at owner shutdown.
Each client has a dedicated Node worker owning a Unix-domain socket. The authority
also runs in a dedicated Node worker, independent of its owner's event loop.
A synchronous call posts a request and per-call SharedArrayBuffer to the bridge,
then blocks in Atomics.wait. The bridge performs socket I/O and writes/notifies
the response. SharedArrayBuffer is only shared inside each process; the socket
crosses process boundaries. There are no main-thread callback spins or replicated
event states. The server's single event loop serializes every state transition.

```js
const { NamedEventAuthority, NamedEventClient } = require('./lib/named-event-authority');
const authority = new NamedEventAuthority();
const client = new NamedEventClient(authority.endpoint);
const ref = client.create('example', false, false);
client.set(ref.handle);
console.assert(client.acquire(ref.handle));
console.assert(!client.acquire(ref.handle));
client.close(ref.handle);
client.shutdown();
await authority.close(); // in an async owner function
```

Create returns `{handle, generation, existed}`; open returns the same shape,
with existed true, or throws ENOENT. Handles are opaque session-owned references,
not guest numeric handles. Repeated create adds a reference and ignores new
mode/initial-state values for an existing name. Each successful create/open
requires one close. Last close destroys the name. Recreation assigns a new UUID
generation and new UUID handles; old handles never address the replacement.
Handles cannot be transferred to another session; that client must open the name.

Set coalesces into one signal. Acquire is zero-timeout only: false means a valid
unsignaled event; true consumes auto-reset state atomically at the server.
Manual-reset state remains signaled for every consumer until reset. Reset and
close are serialized with acquire; ordering is authority arrival order, with no
fairness guarantee. All operations throw on invalid references or transport
failure rather than reporting false acquisition success. Names are exact,
case-sensitive JS strings, 1..1024 UTF-8 bytes, without NUL; guest name decoding,
access rights and Win32 error translation remain integration responsibilities.

The default per-call transport deadline is 3000ms, configurable from 1..60000ms.
A transport deadline is distinct from the zero-timeout event acquisition.
ETIMEDOUT means **outcome unknown**, poisons the client and terminates its bridge;
there is no automatic reconnect, replay or fallback authority. A disconnected
authority yields ECONNECTION and poisons the client. Later calls yield ECLOSED.
Constructor failure tears down its bridge. Invalid inputs use EINVAL, invalid
references EBADHANDLE, missing names ENOENT, capacity exhaustion ENOSPC.

Explicit client shutdown releases all references before acknowledging. Normal
process exit, SIGKILL, or bridge termination closes the socket; EOF reclaims that
session's references, preserving other sessions. EOF processing is asynchronous:
until processed, the name may still exist. A stalled but live client retains its
references; there are deliberately no heartbeat leases that expire while JS is
blocked. Authority failure loses the namespace, rather than reconstructing it
from clients. Owner close forcibly disconnects clients and removes its private
temporary directory. Abrupt owner death may leave an inert temporary directory;
there is no persistent namespace recovery guarantee.

The private mode-0700 directory and random endpoint token restrict accidental
cross-namespace connections. This is a trusted same-user local transport, not a
hostile-peer service or cross-user security boundary. Requests are bounded at
16KiB; names, 4096 events, 4096 references per session and 128 simultaneous socket
connections are bounded. Linux/Unix Node with worker_threads is required; Windows
named-pipe support is not asserted. No dependencies or external services needed.

## Future guest Worker use of the same authority

A Node guest Worker can construct this client using the **same endpoint**, with
its own dedicated transport worker. Its synchronous acquire then reaches this
same authority, even while that guest Worker's JS is blocked. Alternatively a
host-owned transport worker could accept SAB requests from multiple guest Workers
with explicit per-client/session routing. In either design all named event
acquisitions must go through the authority; consuming mirrored local sync words
would recreate the rejected two-winner defect. Guest handles need a proxy map to
owned references and generation, with close/process cleanup and error mapping.
Existing nested pumping still determines when a local guest producer can run;
this module does not solve positive/infinite waits or guest scheduling. Browser
Workers cannot directly use Node sockets; a browser transport would need a
separately scoped adapter to the same authority protocol. None is implemented.

## Acceptance and recovery

Run from this repository (no build or broad source checkout required):

```
node test/test-named-event-authority.js --progress-only
node test/test-named-event-authority.js
node test/test-named-event-authority.js --independent-control
```

The progress command was run first and passed with real child_process.fork
clients; each child checks that its scheduled main-thread callback has not run
when its synchronous result arrives. Full acceptance includes 40 two-process
auto-reset races with exactly one winner, coalescing, shared reset, manual-reset
multiple consumers, unrelated-name isolation, partial/final close and recreation,
stale/cross-session handle rejection, orderly shutdown, SIGKILL cleanup with a
surviving reference, wrong-token rejection, authority loss, and an independently
running socket peer that deliberately withholds a response to test timeout.
The independent-control command must exit 1: actual forked clients attached to
independent authorities both acquire one mirrored logical signal. Its rejecting
oracle is the same exactly-one-winner assertion, not a transport exception.

Evidence is in `scratch/runs/20261020-named-event-authority-oct20/`: projection,
protected shared/supplied Git metadata hashes, command logs/results, receipt,
patches and SHA-256 seals. The sparse checkout contains only existing AGENTS.md
and CLAUDE.md plus these three new owned files. Git object alternates are flattened
read-only references; patches preserve this change independently of alternates
but do not back up the complete base history. The allocation is 16MiB and the
fixed available-space floor is 2285895680 bytes, rechecked before write batches.
No publication retry was made under the existing publication block.
