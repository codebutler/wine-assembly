# Maelstrom exact select completion diagnostic — 2026-10-24

Implemented offline against accepted `0cd1121b01300ae157dd5af3580a4cf132865fdb`
(tree `aafaaf80324f955ff5aaa93d1c2dc84aa43964c3`). This is an **unaccepted diagnostic
implementation**, requiring independent semantic review and a later canonical
diagnostic build/native qualification. No compile, real WebAssembly instantiate,
native/guest execution, box operation, download, deployment or main integration.
The accepted lifecycle/event observers and runtime gate are unchanged. Claude idle.

## Exact source and placement

The six inputs in `test/fixtures/maelstrom-select-hook-pins.json` were compared
byte-for-byte with historical Git revision
`b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a` in the standing canonical tree. This
includes winsock SHA-256
`c281da4763624a29910386d2d6b05a66f98ca92b2a9194827d880c0234ba89ab`.
It does not prove that source was included in the retained runtime manifest.
The supplied runner, exports and scheduler pins were independently hashed before
checkout; no current-main dispatcher semantics are assumed.

Historical winsock lines 2745–2778 contain one entry, two park returns and one
normal EAX store. The tool inserts entry before ESP advances 24, park after each
`vsock_block(24)` and before its immediate return, and completion immediately after
the real `total` store to EAX. There is no subsequent guest instruction/callback
between that store and capture. Parks record reason 8 and restored ESP, with no
result. The handler has no explicit SOCKET_ERROR return: its filter counts ready
members; traps/import exceptions before the final store remain incomplete.
The source model checks positive counts, zero timeout, deadline expiry, both
parks and exceptions, without running the actual socket/memory implementation.

The necessary private dispatcher adapter captures original ESP using `local.tee`
inside its **existing** saved-return read (09b line 116), with thread/register
identity beside it. It passes these as private inner parameters. Immediately
before the existing generated dispatch (line 1735), only API 934 arms the entry
context, including the thunk computed from the actual thunk index. No second
guest-stack read or guessed address is added. Entry and end verify identities.

The exact historical thunk-zone branch (13-exports lines 316–324), decoded inline
CALL/JMP handlers (05-alu line 636; 06b lines 54, 182, 195, 236, 1219, 1239, 1255,
1286) reach `win32_dispatch`, then its unique inner call and generated table.
The AST test proves page 3 subtracts 768, index 166 branches to `$api_166`, and
that block exits to the actual `handle_select` call for API 934. This is not just
a comment comparison. The separate direct `test_call_select` export has no
dispatcher context; after diagnostic start it faults attribution and emits no
completion. It is not a supported production entry route.

## Opt-in behavior and bounded state

`transform(sources)` returns the identical object/string without reading source,
pins or other options when `enabled !== true`. Enabled transformation hashes all
six inputs, then requires exact unique adapter/entry/result anchors and exactly
two park anchors before returning anything. Changed, missing or duplicate source
rejects before output. The CLI only writes new fragments into a new directory:

```sh
node tools/maelstrom-select-completion-hook.cjs --enable-exact-hook HISTORICAL_ROOT NEW_FRAGMENT_DIR
node tools/maelstrom-select-completion-hook.cjs --disabled INPUT_FRAGMENT NEW_OUTPUT
```

The enabled output changes two source fragments, private inner parameters and
diagnostic exports. It is not a complete build tree. A later authorized task must
use the historical canonical build closure and record the resulting new module
identity/ABI. Never patch the retained binary or use these fragments with an
unverified closure. Disabled source/module/ABI remain exact originals.

Even a diagnostic build stays inactive until the host explicitly calls
`instance.exports.msc_start()` at a safe boundary. It only sets a private scalar;
it cannot reset counts. Seventeen getters expose private instance-local scalar
state; eighteen i32 globals total (including private `armed`) consume no guest
memory. There are no imports, clocks (including cached tick reads), socket pumps,
yield clears, output per retry, new guest-memory writes or fixed movable addresses
in the added diagnostic helpers. Original handler effects remain in place.

Each actually entered attempt gets a fresh token, capped at 4096 without wrapping.
State includes API 934, actual thunk, thread/register identity, saved return and
original ESP. A matching normal completion records EAX and ESP+24 exactly at the
hook, then freezes that first result against later calls. Park records contain no
attributed EAX. Faults/cap stop attribution without altering original handler flow.
An exception leaves an incomplete active entry; subsequent arming latches a fault.
No retry token or original parked-call lifecycle is preserved or inferred.

`snapshot(instance.exports)` reads only diagnostic getters. A caller must pair
those exports with that exact actual instance in `createOracle(instance)` and
`oracle.accept(instance, snapshot)`. The strict bounded oracle rejects wrong
owners, duplicate entries/results, counter gaps, missing entry counts, wrong
API/thunk/thread/register/return/ESP/token, cap/fault and parked stale EAX.
Terminal records carry their entry-owned identity; a separate JS entry callback
is unnecessary. Missed attempts cause rejection even if storage contains a
completion. No counters establish that two attempts belong to one original call.

## Validation and limits

Run under `ops/guard.py` with Node heap 256 MiB, CPU/wall 60 s, output 128 KiB,
file 24 MiB and process-group TERM/KILL/reap within 5 s:

```sh
node --check tools/maelstrom-select-completion-hook.cjs
node --check test/maelstrom-select-hook-model.cjs
node --check test/test-maelstrom-select-completion-hook.cjs
node test/test-maelstrom-select-completion-hook.cjs HISTORICAL_ROOT
git diff --cached --check
```

Eleven test groups pass. Ten independently applied output mutations reject
completion before EAX, completion on park, missing EAX store, late entry, absent
or duplicate completion, diagnostic clock call/yield write/guest write and stale
result storage. Erasing instrumentation recovers the full original handler and
both dispatcher ASTs. The small explicit JS source evaluator executes the emitted
helper/handler forms with mocked original callees, comparing original writes,
calls, return and thrown-value identities. This is source-model evidence, not
WebAssembly validation, compiler acceptance, actual socket/dispatcher execution,
native behavior, runtime overhead or gameplay proof. No WebAssembly API is used.
The unchanged observer suites were not rerun because no observer adapter changed.

Two fixture mistakes failed before correction: guessed inline handler names and
assuming global rather than page-local dispatch labels. Original failed captures
are retained. Initial receipt/source inspections overran the requested bounded
read target; those logs remain charged. The first background board watcher also
mistakenly used an 1800 s lifetime rather than the 60 s command limit; it was
explicitly terminated/reaped, with receipt retained. Later command guards do not
retroactively qualify these defects. The SQLite baseline follows initial read-only
instructions; pre-baseline positive database growth is unknown, while full current
WAL and session/launcher files are charged. Prior disk denial and historical errors
remain in their original receipts; no unchanged denied operation was retried.

Fresh measured admission passed before checkout. Sparse checkout uses explicit
paths and dependency-first flattened read-only alternates, without fetch/clone,
repack, full-tree checkout or object-store copies. Accounting includes all new
checkout/Git, temp/copies, session/launcher logs, full WAL, positive SQLite growth,
publication/future allowances and 8 MiB reserve within 64 MiB. Root tracked/index/
refs and donors are read-only; root board append-only. No mount argv or runtime
box is assigned; the unchanged trusted SSH configuration receipt is reused.
Coordinator reports `bx_qa9ex5bu` STOPPED; `bx_69aem736` untouched. Lifecycle and
shutdown remain coordinator-owned. Publication, exact tree/remote SHA, blob seals,
resource and cleanup receipts are in
`/tmp/maelstrom-select-recovered-completion-hook-oct24/ops/result.json`.
