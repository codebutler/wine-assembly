# Select hook oracle/evaluator repair — 2026-10-24

Offline implementation repair of rejected candidate
`7fd4373a7ecb364b89b843e78c6015e03ef248e6` (tree
`80e0474aec844ecc5ca243cbc41b2da476325553`), based on independent review
`8fa9b5455ca028181d75f91132c77d7066868600`. Main remains
`0cd1121b01300ae157dd5af3580a4cf132865fdb`; no integration is authorized.

The oracle previously validated and reread hostile caller records. It now
recognizes only records privately registered by `snapshot()`. Validation and
classification use a frozen, privately retained state, captured once from the
diagnostic functions. The mutable inspection record cannot supply replacement
values: changed/deleted fields or accessors reject without invoking getters.
Proxies, revoked proxies, fabricated records, spread/JSON copies and inherited
records reject without field reads. Every rejected accept closes that oracle.

## Trusted input boundary and supported API

The host must supply its **actual trusted diagnostic export object** to
`snapshot(exports)` at a synchronous safe boundary. This function is not an
authentication service for arbitrary caller-supplied functions. Synthetic model
exports remain synthetic; no private JS brand establishes Wasm/runtime evidence.
Own data-property functions are required. Accessor/proxy exports are rejected;
function identities are pinned. Capture errors poison the source and invalidate
prior records, preserving the original thrown value by identity. Reentrant
capture and acceptance during capture fail closed. Diagnostic functions must be
synchronous and free of callbacks/state mutation during the capture.

Recommended use (no runtime execution was performed in this task):

```js
const oracle = createOracle(instance, instance.exports);
const observation = snapshot(instance.exports);
const result = oracle.accept(instance, observation);
```

The first argument is only a routing identity. The optional second argument
pins the trusted export source before any observation. For compatibility,
`createOracle(owner)` binds the first authentic capture's source; it cannot
authenticate the association between that source and an arbitrary owner label.
Use the explicit source argument when that association matters. A source is
leased to its first accepting oracle; creating another oracle cannot reset it.
Captures are single-use; a newer capture invalidates older ones even when their
values match. Capture immediately before acceptance, with no intervening guest
execution. Unpaired legitimate terminal capture remains supported. Counter gaps,
duplicates, invalid cap/phase/counters and mismatched sources still reject.
Completion identities are independent mutable copies, never internal state.

The evaluator now uses a per-invocation private identity and private value slot
for internal return control flow. Its catch compares identity only and never
reads an imported exception. Original exceptions including null, primitives,
hostile/revoked proxies, throwing getters and `{modelReturn:true,value:123}`
propagate unchanged. Nested calls retain independent return identities.

## Validation and immutable rejection evidence

The unchanged original `independent.cjs` and `evaluator-blindspot.cjs` each exit
1 against their fixed original candidate path. The proxy reproduction fabricates
a completion from an actual modeled park, and the exception reproduction returns
123 instead of throwing. Both original failures are retained. Original hashes:

- independent: `d1df14e939930b69dcc9be85044899c35850feac2445748f088bafb5e3595735`
- evaluator: `80ae181ca91029309875de76dde45fb2502779f9440deda025bd266b812ec614`

The same unchanged scripts exit 0 through `path-binding.cjs`, which substitutes
only the literal original absolute module-root path with this repair checkout.
It changes no test logic or assertions. Ordinary positive/park controls pass.
The proxy now rejects with **zero phase/result reads**; later acceptance after
the throwing-record attempt rejects. The original review report/scripts/failed
receipts remain unchanged in the parent tree and donor. The coordinator's
earlier whole-result truncation remains historical evidence, without any new
qualification claim.

Final checks: supplied **11 groups + 10 output mutations**, unchanged independent
**10 controls**, review **5 source mutations** plus helper/reference/arity checks,
and new **16 targeted groups + 3 oracle mutations + 1 evaluator mutation** pass.
New controls cover source pinning, forgery/copy/mutation, accessors/reentry,
export failures, cross-instance use, duplicate/stale observations, all 4096
supported parked attempts, cap/gaps, terminal capture and returned-identity
mutation. Original/transformed model traces, memory, original globals and
exception identities agree for five imported calls and eleven exception values.
The rejecting evaluator mutation reproduces the swallowed exception.

`unchanged-source.cjs` independently compares every transformed fragment against
the original candidate: **all bytes identical**. Source instrumentation, EAX
placement, parks, clocks/pumps/yield behavior are unchanged. All six historical
pins were checked by bytes, SHA-256 and historical/working-file Git blob against
`b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a` at the supplied canonical root.
Syntax and diff checks pass. Exact staged/tested tree, commands/exits, source
hashes, commit, actual remote SHA and blob seals are in task `ops/result.json`
and `ops/publication.json`; final testing precedes a commit of that same tree.
Focused scripts and captures are adjacent in
`maelstrom-select-hook-oracle-repair-20261024-evidence/`.

## Qualifications and lifecycle

**Canonical diagnostic build/native qualification PENDING; runtime gate
UNRESOLVED.** No compile, real Wasm instantiation, native/guest/box operation,
download, deployment, main merge or worker launch occurred. No API result,
gameplay or actual runtime-completion claim follows from these source models.

Fresh admission passed before sparse checkout and publication, charging full
session/launcher/WAL, positive SQLite growth, checkout/Git, temporary files,
copies/evidence, future publication/transitive objects and an 8 MiB reserve
inside 64 MiB. Dependency-first flattened read-only alternates reuse the donor;
no clone/fetch/repack/object-store copy. Trusted SSH configuration is unchanged;
there are no mount arguments or intended runtime mount files. Initial SQLite
growth before baseline is unknown; full WAL and session are charged. Initial
receipt output and one combined source read exceeded the requested narrow
read size; retained session bytes remain charged, without retroactive
qualification. Historical admission failures remain unchanged.

CPU/wall 60 seconds, Node heap 256 MiB, capture 2 MiB, output 131072 bytes,
file 24 MiB and TERM/KILL/reap 5 seconds remain enforced. Task temp files stay
under ops; cleanup records guarded process groups, watcher reaping, empty temp
and clean checkout. Root tracked/index/refs and donors are read-only; only the
root messageboard is appended. No assigned box, no queried state or expiry;
shutdown/lifecycle ownership stays with the coordinator. Claude idle. Publish
only `task/maelstrom-select-hook-oracle-repair-oct24`, then stop for independent
review by the coordinator.
