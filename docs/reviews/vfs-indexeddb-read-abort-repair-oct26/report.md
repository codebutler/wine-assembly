# IndexedDB default restore transaction abort repair

Pinned base: `e9ef28613b8d6148ff50962850760f2c37e87184`.

The actual default IndexedDB adapter read transaction omitted `onabort`. An explicit
abort without an error event left `createIndexedDbStorage()` pending forever.
The added handler rejects with the transaction error, or the existing write-path
fallback `indexedDB transaction aborted`. No retry/reopen policy is introduced.
Accepted restore predecode bounds and all other production behavior remain unchanged.

The focused fixture invokes the exported `createIndexedDbStorage()` with global
`indexedDB` replaced by an event-controlled fake database; it does not pass an
adapter. Promise state is observed across four fixed `setImmediate` turns, never
awaiting a potentially hung promise. Cursor exhaustion must remain pending until
transaction completion. Coverage includes empty/nonempty success, error identity
and fallback, explicit abort with/without error and with/without partial cursor
results, first error followed by abort, and put/delete abort reporting and queue
continuation. Initial restore failures reject the caller; they do not use write
queue `onError`. Aborts never return partial storage or reopen the database.

Same fixture: baseline 9 PASS / 4 FAIL (pending), repair 13 PASS / 0 FAIL.
A meaningful mutant resolves partial results on abort: 9 PASS / 4 FAIL (fulfilled).
Both existing scoped persistence suites pass. All Node invocations are serial,
`timeout 25s node --max-old-space-size=16`, under 24 MiB file limit.

Replay from repository root:

```
node --max-old-space-size=16 test/test-vfs-indexeddb-read-abort.js
VFS_PERSISTENCE_SOURCE="$PWD/docs/reviews/vfs-indexeddb-read-abort-repair-oct26/baseline-vfs-persistence.js" node --max-old-space-size=16 test/test-vfs-indexeddb-read-abort.js
VFS_PERSISTENCE_SOURCE="$PWD/docs/reviews/vfs-indexeddb-read-abort-repair-oct26/mutant-vfs-persistence.js" node --max-old-space-size=16 test/test-vfs-indexeddb-read-abort.js
node --max-old-space-size=16 test/test-vfs-persistence.js
node --max-old-space-size=16 test/test-vfs-persistence-restore.js
```

The two source payloads are recovery/evidence copies, not production modules.
Initial scoped attempts exposed omitted sparse dependencies (mem-utils, its region
map, browser-shell); original failure logs are retained. Pinned dependencies were
materialized inside the existing checkout allowance; no production dependency was
changed and no test oracle was weakened.

Main publication is excluded. Coordinator review and reconciliation with the main
owner and accepted VFS branch remain integration gates. No browser durability or
gameplay acceptance is claimed. No runtime/guest/box assigned: box ID/state/expiry
N/A; coordinator retains lifecycle ownership. Root/donor repositories stayed
read-only except append-only root messageboard. No workers were launched.

Exact payload hashes and acceptance checkpoints are retained beside this report.
Final commit, remote verification and resource accounting are in task ops/result.json.
