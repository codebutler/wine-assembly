# Maelstrom event observer: retained native synthetic qualification

PASS: one Node process, one actual native Wasm instantiation, reused across OFF
and ON scenarios. Native exit 0, natural termination, 10,437 output bytes, group
absent and child reaped. No production observer change, original-game execution,
build, acquisition, box operation, deployment, main integration or other worker.

Accepted base `ff594b75bc500a12200302e87dd963b277b5ac56`, tree
`5638a8460fda07a07d3ecbe5c284a7c61f25511e`. Exact immutable inputs:

| Input | SHA-256 |
|---|---|
| Actual retained 1,879,746-byte module | `8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686` |
| Unchanged event observer | `52909f8dc9e39c9c294602c952d9bbbf4e91c52d5c56ddbba45fb3cb30d9e226` |
| Scheduler | `f0a2f006b0eb992bcdb904f10128167b06bfe143ac05661b82f9586d9755bf40` |
| Runner | `4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809` |
| Exports source | `739397dc54a77e93b367334fd4ca96c921180f57a7558913a3301f1de4520b86` |
| Prior init/import recipe test | `938458b147c43f72a0792a6fd1bf625a4fb8c67e472b3079dda00e7c3deb9a5b` |

The module's supplied provenance is source `b41a7c5f`, ABI 291, layout
`9a3bc9149d58209c`. This task independently checks module bytes and export/import
contract; it does not rebuild or independently reproduce that source provenance.

## Executable and controls

`test/maelstrom-event-boundary-native.cjs` accepts, in order, the standing runner,
exports source, scheduler and module paths. `--preflight` checks identities,
binary exports/imported memory limits, direct spans, disjoint counter fixtures,
and six rejecting mutations without compiling/instantiating a module. Exact
argv is in `native-attempt.json`; `supervise.py` supplies the exclusive lock,
fresh measured admission, CPU 90s/wall 60s, fixed 512 MiB arena, 512 MiB heap,
131,072-byte output cap, 24 MiB per file, process-group TERM/KILL within 5s and
reaping. Native launch stops ahead of 19:00 UTC on 2026-10-24. It refuses an
existing attempt receipt. Do not rerun this assignment's native process.

Syntax and final changed-input preflight passed under 256 MiB heap and CPU/wall
60s. Six production-function mutations rejected: reason-only select attribution,
extra original run, dropped arguments, swallowed exception, ignored record cap,
and wrong head event. Each mutation replaces an asserted literal in the actual
production `createObserver` source. Fixture tests use immutable diagnostic exports
and check receiver, argument, result, exact exception identity and zero-record
cap behavior. These isolated fixtures are explicitly separate from native evidence.
The unchanged accepted observer's earlier exact focused and independent receipts
are retained as `accepted-exact-*.receipt.json`; this task reuses that focused
evidence and adds the native qualification rather than rerunning the old suite.

Both actual native lanes started with counts `[0,0]`: OFF addresses
`0x7a3c62,0x7a3c66`, ON `0x7a3362,0x7a3366`. Each lane executes six planned
calls. Native `set_count`, register setters and `set_yield_state` configure the
fixture; no counter/cache clears or observer-added runs occur. A final coercion
check on each real run function throws the same sentinel object before guest
execution. There are 14 run API calls in total, of which two stop at coercion;
only one native process and one instantiation. OFF/ON snapshots match normalized
EIP/EDI, EAX/EBP/ESP, counter values, yield reason/flag/halt, cache store/clear/
invalidation deltas, and hashes of the explicit stack and fdset/timeval spans.
This is bounded fixture memory/state equivalence, not a whole-arena byte diff.
Native run's void result is preserved for normal and pending-yield returns;
extra arguments/custom receiver are accepted by native Wasm. Fixture controls
establish forwarding semantics that Wasm itself does not expose for inspection.

## Observations and limits

The unchanged observer's `createObserver` and `wrapInstance` wrap the actual
immutable native exports. Six raw bounded records total 4,124 bytes, below
16 records/8,192 bytes. The actual unrelated API-id 935 thunk produces no select
event. Invocation 3/batch 50002 observes reason 8 and native `thunk_word` values
`[4096,934]`; invocation 4/batch 50003 observes the head; invocation 5/batch 50004
observes the interior return boundary. These shifted invocations are outside the
old historical batch window. Pending reason returns have halt 4 and are labelled
before dispatch. Normal CALL/RET execution reaches the interior with halt 5.

The synthetic thunk records are written at the source-backed unpatched metadata
address `THUNK_BASE + index*8` (here linear `0x071160f8`). The real native thunk
getters validate them. Guest stack `0x07402000` contains return/nfds/read/write/
except/timeout; fdset `0x00430000` has three entries, captured as count 3 and two
prefix entries with truncation; timeval `0x00430200` is `[0,5000]`. The null
write/except sets remain NULL. These are diagnostic fixtures, not recovered
original-game stack/select state, and the select API is not dispatched.

All getters used by the observer are present in this retained module; none is
mocked for native qualification. Select deadline remains explicitly unavailable.
Actual pinned scheduler `checkMainYield` and `noteMainSleep` methods run against
the wrapped native instance with a controlled owner and clock. For reason 8 they
return false and preserve yield. The entire scheduler source is evaluated with
empty dependency globals; this restricted path does not access those dependencies.
No scheduler-internal `runSlice`/cooperative-send dispatch is qualified.

Coverage is all invocation boundaries while the observer is active. Wholly
intra-invocation head visits remain unobserved. API completion is unobserved and
return unattributed; counters are not execution proof; overhead is unmeasured.
This result establishes no original-game root cause, deadline, network outcome
or gameplay acceptance. No production defect appeared, so no production fix or
unchanged-observer failure reproducer was needed.

## Admission, recovery and deficiencies

Fresh admission under `/tmp/wine-ops-heavy-runtime.lock` measured 52,021,328
projected task bytes, including all new sparse checkout/Git data, complete external
launcher events and session log, conservative SQLite charge, publication/future
growth, output, and an 8 MiB reserve, within 67,108,864. Available memory was
3,656,724,480 >= 2,684,354,560; disk after projected growth was
3,357,681,584 >= 2,982,150,144. Standing executables, shared libraries, retained
inputs and read-only Git alternate are separately inventoried, not copied.

Preserved workflow deficiencies: the first search was too broad and generated
oversized output before narrowing subsequent reads; initial syntax/preflight
commands lacked the explicit CPU/wall wrapper. Changed-input final preflight
uses the proper limits. SQLite baseline was recorded after setup; admission
conservatively charges every extant SQLite WAL, rather than pretending the late
baseline proves earlier growth. Source excerpt recovery initially read the whole
source file to retain its first 24 lines; no compliance claim erases that read.
Earlier task histories/receipts remain unchanged in their existing locations.

Important evidence is committed in the adjacent directory, sealed by `seal.json`.
It includes raw native output and records, terminal, cleanup, preflight, all
commands/identities, measured admission/standing manifests, source excerpt and
the supervisor recovery recipe. Original operational copies remain under
`/tmp/maelstrom-event-observer-native-qualification-oct24/ops`. For review restore
this task branch, verify the seal, and use the pinned standing paths; no ignored
Wasm copy is required or implied. Native execution is already consumed.

No assigned box exists. `bx_69aem736` was not stopped or otherwise mutated;
historical `bx_qp99542b` was untouched. Coordinator retains host lifecycle ownership.
No authoritative new box-state query was performed by this task.

Publication payload `51161eeeeb061d741e4f2455b3a08ba999cb03b7` was pushed and
verified through the exact trusted SSH configuration. Initial commit creation
failed because the fresh checkout lacked author identity; copying the donor's
local `Codex <codex@users.noreply.github.com>` settings into this owned checkout
resolved it. The first failure and changed-configuration success remain in the
publication receipts. Final accounting/publication receipts are a separate
follow-up commit; they neither modify the test nor repeat native execution.
