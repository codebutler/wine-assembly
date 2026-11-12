# Independent default IndexedDB read-abort acceptance

**ACCEPT** candidate `980edba27712974e34fd1037b83fcebb261e711f` for the bounded default-adapter read-abort repair, against baseline `e9ef28613b8d6148ff50962850760f2c37e87184`. This decision permits coordinator review for integration; this task performs no integration or production edit.

The production diff adds exactly one `getAll` readonly transaction `onabort` rejection handler. Removing that line restores the entire baseline `lib/vfs-persistence.js` byte for byte, including the accepted restore bounds. `bounds.json` binds both source hashes. Writes already had the corresponding abort handler.

The added independent fixture imports the actual public `createIndexedDbStorage` from the pinned source and supplies only the global IndexedDB event surface. It never supplies `options.adapter`, extracts the implementation, or clones `getAll`. The default open, readonly cursor, readwrite transaction and queue code execute. The independently written transaction surface schedules opening with `setImmediate`; promise observation uses finite event-loop turns without awaiting an indefinitely pending subject.

All **12 fresh cases PASS**:

- Partial, unexhausted two-row cursors remain pending before abort and reject without exposing a Storage value. A frozen non-Error `tx.error` object survives by identity; null and undefined errors produce the exact existing fallback message. Late cursor/end/complete/error notifications cannot reverse rejection. Initial rejection does not go through the write-error callback or reopen the database.
- Error/abort/complete, abort/error/complete, abort/complete/error and complete/error/abort preserve the first settlement. Complete-first retains the committed row. The late-event combinations are deliberately adversarial handler tests; impossible browser event sequences are not asserted to occur in real IndexedDB.
- Synchronous readonly transaction construction, object-store access and cursor construction failures reject with the original error, without leaking a value or inventing retries.
- Synchronous readwrite construction failure for put and delete reports the error and drains the write queue. The immediate in-memory value follows the existing optimistic storage semantics; a later successful write completes on the same open database. This is queue recovery evidence, not proof of successful persistence of a failed write.

Two targeted source mutations are rejected by the unchanged fixture:

| Mutation | Result | Decisive failures |
| --- | --- | --- |
| Read abort always rejects with a new fallback Error, losing `tx.error` identity | exit 1, **9 PASS / 3 FAIL** | frozen object identity and both abort-first orderings |
| Resolve read immediately after receiving a cursor row | exit 1, **5 PASS / 7 FAIL** | all three partial-abort cases and all four ordering cases |

The second mutation proves partial data cannot be accepted early merely because a later abort still rejects internally. Mutants live only in this review's evidence; production source is unchanged.

`reuse.json` rehashes all **17** donor manifest payloads and proves the exact eight-file source/test closure and installed Node executable identity. Therefore the retained repair **13 PASS**, baseline **9 PASS / 4 pending FAIL**, resolve-on-abort mutant **9 PASS / 4 fulfilled FAIL**, persistence suite PASS and restore suite PASS are reused without rerunning those groups. Node is v24.18.1, SHA-256 `f3432a45b03b2da0d270095fdd8813dc34cbea73f5fc8b18c7a384b7cf9b333a`. The source under fresh tests is SHA-256 `fc8caa5757face2be6ae9bef9a564d7dfb58fe905d0d7d5fe386ce530cd27351`. Exact fixture and evidence hashes are in `checkpoint.json` and `evidence-manifest.json`.

To reproduce from the isolated repository, run serially, with a 25-second wall timeout and 24 MiB file limit:

```sh
node --max-old-space-size=16 test/test-vfs-read-abort-independent-accept-oct26.js
node --max-old-space-size=16 test/test-vfs-read-abort-independent-accept-oct26.js docs/reviews/vfs-read-abort-independent-accept-oct26/wrong-identity.js
node --max-old-space-size=16 test/test-vfs-read-abort-independent-accept-oct26.js docs/reviews/vfs-read-abort-independent-accept-oct26/early-partial.js
```

Expected exits are respectively 0, 1, 1. The retained `run-tests.py` records the original session's continuation, including reuse of already completed exact-fixture runs; the commands above independently reproduce the tests. `work.py` preserves resource accounting and the no-fetch, sparse, flat read-only alternate recipe. Installed tools and donor object stores are measured standing inputs, not staged copies. Fresh admission passed the memory/disk floors and 64 MiB allocation including all current WAL bytes conservatively once, future growth once and 8 MiB reserve. No guest mounts exist, so canonical mount validation has no filename-bearing argv to validate. Trusted Git SSH configuration is retained unchanged. `launch.json` binds the actual session/PID and Sol6.1 medium 200000 total-context argv.

Incidents are retained rather than erased: the first discovery command accidentally expanded a broad mount glob and produced truncated output; subsequent source excerpts were bounded. Two name guesses missed before reading the exact source. The pinning helper's 128 KiB capture guard rejected a large source file, so hashing was corrected to stream 8192-byte chunks without capture. The first mutation summary was incorrectly predicted as 8/4; the actual exit 1 and 9/3 log were retained and only the expected metadata was corrected. No passed test group was rerun for these bookkeeping corrections.

No browser IndexedDB durability, cross-tab behavior, gameplay, native build or box result is claimed. No box was assigned (ID/state/expiry N/A); coordinator retains lifecycle ownership. Browser durability and current-main integration remain outside this acceptance. Root and donors remained read-only except append-only messageboard coordination. Initial root ref receipt is retained without capturing a ref listing; concurrent coordinator publication means it is not a claim that global refs stayed unchanged. Task ends after fixture/report publication and exact remote verification; no workers, refill or resume.
