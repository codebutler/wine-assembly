# Independent acceptance of native synthetic event-observer qualification

PASS, offline review of candidate `f79ac8af5876ceb7356a07b16d47003719cac29c`,
tree `65cfcd8817b0a9e9a2080ed298ffc8cf61422b6c`, based on
`ff594b75bc500a12200302e87dd963b277b5ac56`. The producer executable and observer
are unchanged. Acceptance reuses the producer's single native process and actual
retained-module instantiation; this review performs no native execution,
compilation, instantiation, game execution, download, deployment or box operation.

## Independent findings

The 15,663-byte executable SHA-256 is
`2159e84c0960679855b330adf813f94351cb59f4a5cc09fc9ef27e91b7ce303c`.
The execution-code identity, exact native argv, natural exit-zero terminal,
raw output, parsed result and six raw records bind the reported native result.
Pinned module, observer, runner, exports and scheduler identities pass unchanged
preflight against the standing local inputs. Packaging reuses the coordinator's
verification of all 20 sealed payloads; independent acceptance targets semantics.
This is receipt-based acceptance, not an independent reproduction of execution.

OFF and ON use disjoint counter addresses and both record `[0,0]` before calls.
Only EIP within the lane code span and EDI's callee address become relative to
the lane base; all other fields remain absolute. Independently constructed
expected states match all six rows in both lanes. Absolute native ON records
also match the normalized rows and cache baseline/deltas. Independently packed
stack/fdset/timeval bytes produce the retained scoped hashes. The scope excludes
the rest of the arena and CALL's temporary stack slot below ESP. Cache equality
is equality of measured store/clear/invalidation deltas, not cache contents.
Starting registers, yield, breakpoint and counts are explicitly configured;
pending returns precede execution, and the final pending interior call consumes
the prior breakpoint skip state before the next lane. Matching measured
transitions support equivalent fixture states without claiming every global reset.

Pending reason 8 produces halt 4 without dispatch. In the normal call, EBP changes
to EAX, ESP returns to its initial value and EIP reaches head+4 with halt 5,
consistent with the written MOV/CALL and native RET fixture. Entry counters
increase before dispatch and remain explicitly unsuitable as execution proof.
Invocation 3/batch 50002 observes native thunk words `[4096,934]`; unrelated id
935 does not create a select record. Head/interior occur at invocations 4/5,
outside the old fixed batch window. All six records total 4,124 bytes.

The select stack, fdsets, timeval and thunk words were deliberately written
synthetic metadata, read by actual native getters. The select API never runs.
The pinned scheduler's `checkMainYield` calls `noteMainSleep`; its reason-8 path
returns false without clearing yield. Only this controlled-owner path is covered;
scheduler internal `runSlice` and cooperative-send dispatch remain unqualified.
Source inspection confirms the native coercion fixture invokes both raw and
wrapped Wasm functions with a `valueOf` that throws the same sentinel. Native
PASS supports that assertion. Mock throwing/argument/receiver controls are
separately identified and are not represented as native coercion evidence.

## Cheap checks and rejecting controls

Unchanged candidate syntax and exact standing-argument `--preflight` pass under
256 MiB Node heap, CPU/wall 60 seconds and 131,072-byte output limit. Preflight
also passes with WebAssembly compile/instantiate/Memory/Module/Instance replaced
by throwing sentinels, demonstrating it stays offline. Its six mutations bind
the production function source and reject reason-only attribution, an extra run,
dropped arguments, swallowed exception, ignored record cap and wrong head event.

The adjacent independent `review-controls.py` accepts the retained receipts and
rejects seven corruptions: false OFF/ON equality, a shared wrong normalized field,
wrong native module identity, mock-only native instantiation claim, missing native
event, changed executable and failed native terminal. These are receipt integrity
and semantic checks; they do not manufacture new native execution evidence.
Exact integrated-tree cheap checks and publication identity are retained in
operational `exact-tree.json` and `publication.json` under the owned ops directory.

## Resources, history and limits

Prepared sparse checkout reused; no clone, fetch, donor modification, new pack
or broad materialization. Read-only alternate stores are standing dependencies.
Initial complete projection was 53,121,528 / 67,108,864 bytes including full
external launcher/session logs, conservative SQLite WAL charges, future growth,
publication copies, narrow captures and 8 MiB reserve. Resource receipts recheck
host disk floor 2,982,150,144 and MemAvailable 805,306,368 before commands.
Owned ops retain manifests, bounded commands, terminal/reaping receipts and
final projection. Report/evidence are committed; Git does not preserve external
logs or ignored module bytes. Recovery uses the pinned standing inputs and
producer receipts, never another scarce native attempt.

Historical oversized donor-fetch failure remains at
`/tmp/maelstrom-event-native-independent-integrate-oct24/ops/result.json`:
25,165,824 truncated bytes and 81,868,568 projected peak exceeded its allocation.
It was not a semantic rejection. Coordinator reused an already prepared sparse
checkout and corrected alternate ordering without mutating donors. Earlier
broad reads, unwrapped initial checks, late SQLite baseline and author identity
correction remain explicit in producer/history receipts. This review's initial
instruction/inventory reads had timeout but not full process/output supervision;
SQLite baseline was late, so all extant WAL is conservatively charged. These
deficiencies are not retroactively declared compliant.

The first publication staging check rejected trailing whitespace in this review's
copied `identity.log`. That redundant publication copy was removed; the raw ops
log and exact first failure remain. A compact identity receipt replaces it.
This corrects review packaging only, without weakening any semantic oracle or
changing the producer executable or evidence.
The copied diagnostic itself quoted that whitespace, causing a second staging
rejection. Both exact diagnostics are retained as JSON strings, preserving their
bytes without introducing whitespace errors into a textual diff.

Coverage is invocation boundaries only; visits wholly within one call remain
unobserved. Deadline is unavailable, API completion unobserved, API result
unattributed. Runtime overhead, whole-arena equivalence, source-to-module rebuild
provenance and original-game causality/gameplay are unmeasured. No new production
fix was needed. No box is assigned: historical `bx_qp99542b` was reported stopped,
`bx_69aem736` is untouched, current state/expiry unqueried. Coordinator owns
lifecycle. Root tracked checkout/index/refs and all donors remain read-only;
only the append-only messageboard is updated. No workers spawned or refilled.
