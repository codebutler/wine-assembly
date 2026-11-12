# Shadow Man corrected capture technical review

Historical source last updated, 2026-10-23. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

**REQUEST CHANGES** for capture usability. Exact corrected input
`aac3cf5db81fc2946f9bfc2f09a11a9c7be021ec` resolves the eager-arm,
compile/Module-binding and scoped census/discovery defects in review
`43a1d1d7b8c0418cdc1d61f646e2ea5150a318c4`, but its recipe still requires
fresh-run values before they can be supplied through the current interface. It is not ready for a separately authorized full-module/guest capture. No production repair is included in this acceptance branch.

## Demonstrated blocking gap

The preload parses `SHADOW_NULL_SELECTION` before compilation and passes that
object at instantiation to `createSelectedSend`. That function copies the four
integer keys into a private frozen object. There is no setter, selection
registration control command, deferred selection provider, or supported way to
read environment changes back into this object. Instantiation occurs before
the runner installs its interactive control channel.

The actual runner increments `diagnosticActionSequence` as each scheduled input
is dequeued; it uses the current execution batch, then resolves modal HWND or
renderer/slot HWND and dialog parents. It invokes the selected-send hook before
the synchronous `we.send_message`. Its ordinary input receipt is appended only
after the send returns. The corrected ordering is good, but it exposes the
fresh resolved values only to a hook already committed to pre-start constants.

Our executable combines the **exact runner queue/dequeue prefix and exact
`dlg-cmd` branch**, the actual preload and compile/Module binding, and the
**entire actual sender body** with the previous review's scripted dependencies. Small imported window resolvers supply the synthetic route; this is not an
invented replacement action driver that calls the hook with a known context. The actual branch constructs that context and calls the native sender itself.

`fresh-selection.cjs` compiles the retained `selection-path.wat` fixture and
spawns each control with an actual 5-second external process timeout. Results
and exact child argv/environment/stderr are in `fresh-selection-results.json`;
per-control `.trace` and `.jsonl` files are retained.

| Control through actual branch | Actual exit | Evidence |
| --- | ---: | --- |
| Pre-known synthetic modal / renderer-parent / slot | 86 each | Pre-arm receipt, sender-pre, ordinary first-zero, terminal first-zero; no returned final-send log |
| Fresh modal / renderer-parent / slot HWND | 1 each | `wrong or late selected action/HWND`; no arm or event record; source count remains zero |
| Actual execution batch 20 for action scheduled at 19 | 1 | Same rejection before send |
| Set environment selection to fresh HWND after OK, before final dequeue | 1 | Trace records exact correct late values; private frozen selector remains unchanged |

For concrete reproduction, all cases start with synthetic
`{actionSequence:3,batch:19,cmdId:3,hwnd:8194}`. Configuration1024 and OK1
return at batches17/18 with diagnostics still OFF. Fresh controls resolve
HWND12291 for the selected action instead. The env-update control supplies
`{actionSequence:3,batch:19,cmdId:3,hwnd:12291}` before dequeue, yet still rejects. These numbers are fixture controls, never suggested guest constants.

The desired fresh-selection assertion also **actually exits1** (check9):

```sh
node -e "const r=require(process.argv[1]);for(const c of r.results)require('node:assert/strict').equal(c.exit,86,'fresh selected send must acquire and accept current HWND/batch via actual runner interface: '+c.mode);" /home/user/wine-assembly-shadow-man-null-arming-independent-accept-oct23/docs/re-notes/shadow-man-null-arming-independent-accept-20261023/fresh-selection-results.json
```

The ordinary harness exits0 because it confirms the rejection; the desired
acceptance oracle exits1 because current source does not satisfy it. The three
normal controls succeed on the identical Module and extracted source path.

Fixed schedules can determine an action sequence and intended batch in advance. An overdue queued action still runs at the actual current batch. The fresh HWND
is the decisive missing input, and interactive late batch selection has the
same immutable-selector problem. Existing freeze/snapshot/eval controls can
inspect a live run; that does not reconfigure this private selector. Changing
the global hook or adding a custom arbitrary-JS adapter would be new capture
code requiring review, not an executable recipe supplied by this candidate. No guest run was used to infer future values.

The retained two earlier receipts establish only returned sends, not successful
OK, a particular launcher screen, persistence or incident ownership. Separate
observable route evidence remains required. The report's instruction to choose
fresh values after verified OK currently conflicts with its immutable pre-start
environment interface. Restarting would create another run; there is no
supported pause/rearm selection update in this helper.

## Corrected conditions accepted within offline scope

```sh
GIT_NO_LAZY_FETCH=1 python3 docs/re-notes/shadow-man-null-arming-independent-accept-20261023/run-checks.py
```

* Both actual modal and renderer/parent/slot branches call the hook after fresh
  resolution and before the send. The no-hook path sends directly; absent
  dialog sends nothing. Deliberately moving arm after send fails the ordering
  assertion. One-shot context/action/PID/runner/command/HWND/batch checks reject
  before selected execution; duplicate/late arm also rejects.
* Actual sender Configuration/OK plus40 actual modal-completion prefixes remain
  OFF and consume zero source/host event records. Selected arm resets counters. Source event33 traps; a returning observer cannot resume a first-zero event. The host reserves one of32 records for terminal zero (the block record counts;
  pre-arm receipt does not). Quota starvation, returned selected send,
  exception, retention failure and required-block-before-zero fail terminally.
* Compile copies actual bytes, compares them before native compilation, rejects
  start sections, then binds the returned immutable Module privately. A changed
  valid custom section, substituted bytes, unbound Module, byte-form instantiate,
  constructors, streaming and repeated compile/instance contexts reject. Start
  sections reject before execution. The normal Module control captures. The
  old6d145e9 helper still falsely succeeds at86 for eager startup and changed
  Module; both updated-contract assertions actually exit1. These tests use
  dedicated fixture drivers, not full-runner/guest identity qualification.
* All records copy registers/stack/code synchronously, retain sealed immutable
  values and fsync before process exit86. Missing exports also exit86 but carry
  `capture-failed`; exit86 alone never means success. Wrong selector rejects
  with exit1 and a missing-terminal failure, rather than inventing capture.

The ordinary CACA0005 continuation intentionally writes EIP=0. The actual sender
fixture reaches first-zero before its restoration and labels it
`ordinary-or-unknown; zero-writer unproven`. We accept that classification. Neither zero nor the decoded block proves the historical incident or a zero
writer. A required-block policy must reject zero-before-block.

The actual full sender body covers OFF caller restoration and64-round
abandonment: sender-pre follows saved registers/child allocation, event2 precedes
identity/depth checks and restoration. Saved EIP/ESP are caller values; current
token identifies the child, not proven modal ownership. The exact modal
sentinel/completion prefix verifies event3 after teardown/reentry and sentinel
adjustment but before consumed-frame reads; event4 after previous pump and
EAX/EIP/ESP restoration, before ended/result/quit reset. Saved ESP names the
consumed frame, not the original API entry. Scripted teardown mutates private
pump fields to distinguish those positions. This does not execute the whole
dispatcher, interpreter, guest or canonical module.

## Census, discovery and unchanged source

The discoverable `.js` wrapper is unit tier, with75-second registration and
three actual20-second child suite guards. Scoped timeout validation passes;
full test manifest remains pending. The exact pinned fragment checker passes
all three WAT files, which remain byte-identical to6d145e9. Source-only export
declarations total1054 without duplicates; this is not an actual Module export
inventory. Inputs, hashes and exact four changes are in `source-checks.json`.

## Native fixture and qualification limits

All fragment memories have fixed initial=maximum128pages, **8MiB**, no full
guest heap. Compiler executes in place from the review donor with recorded
identity; it is the focused test compiler, not qualification of missing full
candidate vendored provenance. Modules:

The new fixture adds only resolver imports/exports and a sender alias to the
retained3394-byte source. Resolver, translator, invocation and callback/run
dependencies are scripted. The native sender and CACA0005/zero predicate are
actual source. VM extraction executes the actual runner branch/dequeue prefix,
not runner bootstrap or a full guest route. Each new child has a5s external
watchdog and VM calls1s; suite commands have75s external guards. Wasm arena
limits do not bound total Node/compiler RSS. No full handler/module/runtime,
canonical export compatibility or performance qualification is claimed.

## Build and guest prerequisites remain separate

The exact existing pinned recipe was read and identity-checked, not executed:
`/home/user/wine-assembly-shadow-man-null-hook-independent-review-oct23/docs/re-notes/shadow-man-null-hook-independent-review-20261023/pinned-build.sh`. Review43a1d1d and repairaac3cf5 list its exact gate order. After the selection
gap is repaired/reviewed, a separately admitted build still needs complete
`src/main.watx` include closure, full compiler provenance, mirrors/baselines,
full callback/transitive census, test manifest/timeout registration, all
fragment/region/memory/API/dispatch/layout/import/provenance gates, and
include-ordered paren/label checks. No cheap gate is waived by scoped30 PASS.

Only then separately authorize vendored-WATX full compilation, data overlaps,
distinct revised size/SHA and actual Module imports/exports/start absence. Common required exports: nine GPR/EIP getters, `guest_read8`, `set_bp`,
`set_trace_eip_range`. Revised mode also requires `set_null_diag`,
`null_diag_field`, `null_diag_token`, `null_diag_root`. Qualify real sender/modal
paths and pinned runner/import topology against that module. No canonical
module was obtained or inspected here. Historical pre-block identity remains
1,879,387bytes/SHA`ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553`,
separate from every revised diagnostic fixture/module.

Guest authorization must separately supply the complete retained game fixture
(partial479-file VFS is invalid), target process/PID and runner identities,
fresh observable OK/launcher evidence, usable one-send selection, explicit
required/optional block policy, exclusive output and finite external watchdog
that can kill a synchronous Wasm spin. Historical batch/HWND constants cannot
fill this gap. No guest command, runtime/media recovery or lifecycle operation
was attempted. Persistence/reopen/Play/gameplay remain untested.
