# Independent select completion hook review — 2026-10-24

Verdict: **FAIL; no main integration**. Reviewed unchanged candidate
`7fd4373a7ecb364b89b843e78c6015e03ef248e6`, exact tested tree
`80e0474aec844ecc5ca243cbc41b2da476325553`, based on
`0cd1121b01300ae157dd5af3580a4cf132865fdb`.

## Reproducible false completion

`createOracle().accept()` in `tools/maelstrom-select-completion-hook.cjs`
validates caller-supplied fields and then repeatedly rereads them for phase
classification, state copying and its return value (lines 147–174). It never
establishes a stable, owned snapshot. The independent `independent.cjs` repro
uses an unchanged transformer and evaluator to produce an ordinary parked
attempt, then supplies that snapshot through a changing proxy. The same owner
object is used throughout. There is no normal handler completion, result-store
hook execution or mutation of the model's diagnostic globals.

The actual stored state is phase=2, token=entries=parks=1, completions=0,
active=0, pre=post=4096, result=0. The proxy returns phase=2 for its first six
reads and phase=3 afterward, and result=0 for its first four reads and stale
EAX sentinel `0x53000001` afterward. Expected: park or rejection, never
completion. Actual: `{kind:"completion", attempt:1, result:1392508929}` with
an identity that still says parks=1, completions=0, pre=post=4096. This is a
concrete fabricated completion in the exported JS oracle, not proof of a false
completion in actual Wasm. The ordinary plain snapshot control returns park,
and a stable nonzero parked result is rejected.

A second independent case supplies a throwing getter. The original thrown
object escapes, but the oracle remains open and subsequently accepts a normal
completion. Expected fail-closed behavior is absent on this path. These cases
are missing from the supplied tests, which use stable plain snapshot objects.
Even a stable caller-fabricated terminal record is not authenticated by the
owner argument: ownership is a caller convention. Optional entry pairing checks
identity changes only when an entry snapshot was actually submitted. The source
hook's private state and the caller-provided JS record are different trust
boundaries. No speculative production repair was made.

## Source review and accepted limits

All four added code/fixture files and the complete producer report were read.
All six fixture inputs were independently checked by byte count, SHA-256,
historical Git blob and working-file Git blob against revision
`b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a` in the specified canonical root.
The producer's other 24 evidence additions remain unchanged and are not a new
runtime qualification.

The historical handler's only normal EAX store is immediately followed by
`msc_end(token,3)` in transformed source. Both park exits call `vsock_block(24)`,
then `msc_end(token,2)`, then return. The normal result is read from actual EAX;
the park path stores no attributed EAX. No subsequent guest instruction or
callback intervenes in this source sequence. The original stdcall adjustment
is 24 bytes. The dispatcher adapter captures pre-pop ESP inside the existing
saved-return read, plus thread/register base; it supplies the actual thunk
index and arms only API 934 immediately before generated dispatch. Both thunk
zone and decoded inline CALL/JMP paths reach this dispatcher. Page 3 subtracts
768, its API-166 branch exits to `handle_select`, and the direct test export is
a separate unsupported attribution route. The existing dispatcher and handler
AST-erasure checks recover the originals.

Added helpers use declared locals/parameters, consistent private call arities,
18 instance-local mutable i32 globals and 18 distinct function exports,
including the one-way start function. Independent source controls checked
helper references, call arities and export-name collisions against the six
pinned files. Guards compare pre/post ESP, current thread/register/thunk and
attempt token. Fresh attempt tokens and counters stop at 4096; pre-pop ESP
above `0xffffffe7` rejects before overflowing the completion adjustment.
Reentry or an outstanding incomplete attempt faults; the first normal result
is retained against later original calls. The added diagnostic bodies perform
no guest writes, imports, clock/pump calls, yield clears or scheduling. Original
return and exception behavior is not wrapped by added WAT. Disabled transforms
return the same opaque input, with unused getters inert. Accepted lifecycle and
event observer files are unchanged. These are source findings, not a compiled
WAT validity or execution claim.

The supplied evaluator does not execute dispatcher routes, generated dispatch,
real socket filters, memory translation, module export binding or a Wasm type
checker. Its `Model.arm()` fabricates dispatcher input, and original callees
are mocks. An additional independent repro shows `Model.run()` mistakes an
original imported exception `{modelReturn:true,value:123}` for its internal
return sentinel and returns 123 instead of propagating that object. This
blindspot affects the evaluator's exception evidence, not the actual WAT. No
manufactured model completion establishes real Wasm execution.

## Evidence and disposition

The candidate suite passes all 11 groups and its unchanged 10 mutations.
Independent controls pass eight ordinary cases and expose the two oracle
failures above. Five further rejecting source mutations pass: removed thread
comparison, removed thunk comparison, removed token comparison, removed cap,
and removed first-completion freeze guard. The evaluator exception repro fails
as expected. Original failures and exact command exits are retained.

Evidence scripts and captures are adjacent in
`maelstrom-select-hook-independent-closeout-20261024-evidence/`. Reproduce with:

```sh
node test/test-maelstrom-select-completion-hook.cjs /home/user/wine-assembly-shadow-man-span-static-canonical-oct23
node docs/re-notes/maelstrom-select-hook-independent-closeout-20261024-evidence/independent.cjs
node docs/re-notes/maelstrom-select-hook-independent-closeout-20261024-evidence/source-controls.cjs
node docs/re-notes/maelstrom-select-hook-independent-closeout-20261024-evidence/evaluator-blindspot.cjs
```

The scripts retain their exact review-owned absolute repo paths. Source tests,
syntax checks and diff checks are offline only. No compile, instantiate,
native/guest execution, box query, download, deployment or worker launch took
place. The exact runtime-hook gate remains **unresolved** until a canonical
diagnostic build and native qualification, even after any later offline repair.
No API result or gameplay claim follows from this review.

Fresh admission preceded checkout; flattened dependency-first read-only
alternates and explicit sparse paths avoided clone/fetch/repack/object-store
copies. Accounting charges checkout/Git/evidence, full session/launcher/WAL,
positive SQLite growth, future publication and 8 MiB reserve within 64 MiB.
Initial combined receipt output was truncated; retained session bytes remain
charged. The SQLite baseline follows initial read-only instructions; earlier
database growth is unknown, while full current WAL/session are included. Narrow
missing-path inspection errors are retained. Trusted SSH and empty mount argv
reuse the unchanged supplied configuration receipt; no runtime mounts exist.

Only this review task branch is published. Root tracked files/index/refs and all
donors remain read-only; root messageboard is append-only. Main is not merged
or pushed. Final SHA/tree, remote refs, important blob seals, resource and cleanup
receipts are recorded in
`/tmp/maelstrom-select-hook-independent-closeout-oct24/ops/result.json`.
No box is assigned; prior coordinator-reported `bx_qa9ex5bu` STOPPED is historical,
`bx_69aem736` untouched and unqueried, expiry unknown. Lifecycle/shutdown remain
coordinator-owned. Claude idle. Stop after publication.
