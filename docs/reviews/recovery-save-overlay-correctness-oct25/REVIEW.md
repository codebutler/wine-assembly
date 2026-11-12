# Memory overlay publication recovery

Base: `397cdb6ca37c1f247cdd6e2618f6e1f3529342c4`. Historical recovery: `80bc9a61509d1976ea55b2610b3b987611c48595`.

`memoryStore.writeBatch` published each record immediately. If a later record
failed validation, payload conversion, or input iteration, previously accepted
saves were overwritten or whiteouted even though the batch failed. The supplied
historical store builds a staged record map before its memory-backend commit.
Current Node and OPFS stores already stage their publications. This change
recovers the missing memory-backend behavior without importing range storage,
read leases, or any other historical subsystem.

The memory backend now validates and copies the complete batch into a temporary
array, then synchronously publishes it. Failed preparation rejects its Promise
and leaves metadata and bytes unchanged. Successful duplicate paths remain
last-write-wins; file/dir/whiteout behavior and defensive byte copies remain.
Staging uses space proportional to the input batch; existing payloads are not
copied. This is exception atomicity, not a power-loss durability guarantee.

The exact same new behavioral test ran against unchanged base source (6 pass,
4 fail), historical source (10 pass), and repaired source (10 pass). Four memory
failures demonstrate partial overwrite/addition, whiteout/dir replacement,
payload-conversion corruption, and interrupted iteration. Five existing Node
cases provide a passing backend control. Success tests cover retry, duplicate
paths, defensive copies, remove, and empty batches. The unchanged current
`test/test-vfs-overlay.js` adds 20 passing integration/regression cases. Its OPFS
checks use fake storage/Web Locks, regardless of historical test labels.
No browser, guest, compiler, native execution, actual OPFS or gameplay was tested.

Commands and full bounded outputs are the four JSON logs. Hashes and revisions
are in receipt.json. Local admission, own-object checkout recipe, strict SSH
publication receipt and final accounting remain in
`/tmp/recovery-save-overlay-correctness-oct25/ops`. Reproduce the fixed checks
with `node test/test-overlay-memory-publication.js` and
`node test/test-vfs-overlay.js` against the pinned JS dependencies recorded there.

No main merge, service restart, public deployment or box access. Box: none;
state/expiry: not assigned; lifecycle remains coordinator-owned.
