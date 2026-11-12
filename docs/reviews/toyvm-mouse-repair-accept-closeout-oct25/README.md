# Independent ToyVM mouse repair acceptance: rejected

Source revision: `99288dd5ad8dfa6f5bcdcdb1ae363aaddac28c3f`.
Exact candidate tree: `295753ada6ddb2338557025886d5ab2bf49d9bc9`.
Main remains `d9012a86a91c13dbe70dbcc4dceff2d7895c18a4`.
This review adds tests and evidence only; candidate implementation, generated
bundles and the two earlier independent reproducers remain unchanged.

The repaired pointermove chords and font dependency closure work in the tested
source/DOM slice. However, `tools/toyvm/bundle-browser.js` scans raw source with
`REQUIRE_RE` and excludes only full-line `//` comments. Its new missing-import
error consequently treats block documentation, trailing comments and quoted
documentation strings as executable imports. Each of these semantically inert
prefixes on the actual `dos.js` source breaks the actual exported module walker:

```js
/* Documentation: require('./not-an-import') */
void 0; // Documentation: require('./not-an-import')
void "Documentation: require('./not-an-import')";
```

The three cases are injected separately through a read-only fs adapter. No
candidate file is modified and no nonexistent dependency is actually executed.
The error is `tools/toyvm/dos.js requires missing literal dependency
./not-an-import (resolved tools/toyvm/not-an-import.js)`. A comment or inert
string must not create a required dependency. This is a build regression,
not a missing module in the current committed 44/43-module bundles.

Reproduce from this branch with Node heap 128 MiB:

```sh
node --max-old-space-size=128 test/test-toyvm-bundle-lexical-independent-oct25.js
```

Expected acceptance result is exit 0; the unchanged candidate produces exit 1,
three failures and five passes. Passing controls retain the actual font closure,
whitespace/comment-separated import module sets, required missing-import errors,
full-line documentation handling and established computed optional behavior.
The same reproducer against the original builder from `46e1ef40` passes all
three documentation cases, but fails its missing-required-import assertion
(the known omission fixed by this repair). Thus the three new failures are
specific to the repaired hard-error behavior. This review does not propose
restoring silent omission or silently patch the candidate.

Validation on unchanged candidate sources:

| Check | Result |
| --- | --- |
| Earlier independent pointer/fallback chord cases | 16/16 pass |
| Earlier independent font registry cases | 4/4 pass |
| New independent mouse lifecycle/state cases | 36 pass |
| New lexical acceptance cases | 5 pass, 3 fail: reject |
| Supplied mouse `--bundle --controls` | pass; delivery/release removals rejected |
| Chord repair suite | pass; chord removal rejected |
| Required dependency suite | pass; omission mutation rejected |
| Held-key and live `--input-only` suites | pass |
| Corpus static assessment | 23/23 pass; absent payload freshness skipped |
| Both bundle freshness and full tracked closure | pass: 44 main, 43 JIT |
| Generated corpus site vs actual committed caller | byte-exact |
| JavaScript syntax | 18 files pass |

The new mouse fixture uses real exported bindInput/LiveRun and
Machine.prototype.int33 without Machine construction. It checks first sample,
CSS scale/offset, outside clamp and signed accumulated motion, all three button
bit positions and clearing edge queries, release and resumed gestures after
blur/hidden/pagehide/cancel/lost capture, detach, stop, and retry ownership.
Its exit case invokes release methods on an exited fixture; it does not execute
the run loop. Existing source/supplied cases cover text/graphics dimensions and
unsupported pointerlock/wheel/touch/pen behavior. Caller inspection confirms
corpus start failure calls stopLive (detach then stop), ops attaches only after
successful start, and keyboard/touch/audio startup changes are outside the
repair diff. Asynchronous caller failure was inspected, not browser-executed.

Evidence reuse: all 43 repair supporting seals, five original dispatch pins,
12 original source seals (nine unchanged, three superseded by repair), six repair
source seals and three unchanged dos/reproducer pins verified. The original
rejection report remains at
`docs/reviews/toyvm-mouse-independent-integrate-oct25/README.md`.
Existing baseline-fail and removal controls remain applicable and are reused.
External consolidated receipts are in
`/tmp/toyvm-mouse-repair-accept-closeout-oct25/ops/result.json`; original accepted
evidence remains read-only in the donor directories.

No main integration, public deployment, service restart, browser, guest, compiler,
Wasm Module/Memory/Instance or gameplay occurred. No box is assigned; lifecycle
remains with the coordinator and protected boxes were untouched. The actual
platform SSH403 denial was not retried. No workers or successors were launched.

Fresh resource gates include own checkout/Git/evidence/publication, current
session/launcher, all shared WAL/SHM, positive DB growth and futures plus an
8 MiB reserve within 64 MiB. Exact sparse files exclude corpus payloads.
Initial metadata capture/excerpt and routine fixture/receipt-shape corrections
are retained in incidents.json. Original checkout overrun 113,292,552 bytes
remains noncompliant; this review does not relabel it. Coordinator owns any repair.
