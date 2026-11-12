Scoped ACCEPT: dashboard cyclic CommonJS module retention repair

Candidate: 247539937fa52c86e3c86ca0f0dd46b9a78ed826.
Candidate tree: ad1f2a0f01d9dc5d8bcd9ea1998c60ce7e443f81.
Source plus independently tested fixture tree:
2075eafb5a6fb8e253d8b6e5c777c584451ce163.

The scoped production diff replaces direct Module._compile with a native
CommonJS load under a disposable parent. Source I/O finishes before temporarily
publishing the exact-path bounded-source extension hook and removing the old
registry cache entry. The finally block restores the previous extension and
cache identity on success and failure. Dependencies use the prior extension,
normal resolution and shared caching. Native loading supplies in-progress
partial/replaced exports, loaded state and circular-warning proxy behavior.
No production source or supplied test oracle changed in this review.

Required controls: unchanged independent 5, nested/replaced-export/error-cleanup
6, bounded/growth/UTF8/retention 13 and ordinary-reader 16: all 40 PASS.
The unchanged cyclic-relative-import oracle rejects input 14f72fff (0 pass,
1 fail) and passes the repair. Original d9012a86 baseline evidence is reused;
its four retained evidence identities were checked. The coordinator's verified
99-file candidate evidence seal is reused without repackaging.

New independent controls: 6 PASS. Four compare native require against the reader
for partial exports, replacement before/after re-entry, thrown evaluation,
loaded flags and post-load circular proxy state. One checks a preexisting custom
.js loader and external cache identity through success, syntax failure, missing
dependency, thrown evaluation and recovery. One traverses parent/children from
a fixed cached dependency across 96 refreshes: exactly the same first registry
module remains reachable, with zero direct registry children of the reader.
The unchanged new controls reject input (1 pass, 5 fails).

Supplied retention controls also report zero direct reader-owned registries and
zero retained export bytes for 32 revisions padded by 256 KiB. Dependency caching
intentionally retains the first registry parent. Acceptance does not imply zero
transitive retention, arbitrary changing-dependency bounds or live RSS causality.

Remaining gates: coordinator-owned integration and any separately authorized
live activation, deployment or postactivation memory observation. No main
integration, service restart, API load, heapdump, browser, Boat, VM, Wasm or
compiler execution occurred. No test box was assigned or touched; lifecycle and
shutdown remain coordinator-owned.

Reproduce in this checkout with installed Node (128 MiB old-space heap), standing
pngjs dependency at /tmp/wa-local-runtime-deps/node_modules, and the bounded
supervisor retained in the task's ops directory. Run the six supplied files
listed in supplied.json serially, the exact ordinary-reader pattern in
ordinary.json, and ops/reader-cycle-acceptance.test.js. Recreate the input control
only in the isolated checkout from git show 14f72fff:ops/readers.js as
ops/input-readers.js; set READER_UNDER_TEST=./input-readers.js, run the unchanged
controls, then remove that temporary file. Input failures are intentional.

Fresh admission passed before checkout, testing and publication: all task bytes,
shared WAL/SHM, positive DB growth, session/publication allowances and the 8 MiB
reserve remain within 64 MiB. Initial context output exceeded the 8 KiB excerpt
limit; the incident is explicitly retained rather than treated as compliant.
Root refs were compared by streamed digest with no listing capture and match
the launch receipt. Root/donor tracked files, indexes and refs remain read-only.
