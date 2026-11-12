# Shadow Man immediate zero-transfer provenance, 2026-10-23

Historical source last updated, 2026-10-23. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

**Implemented and offline-tested; native execution remains unqualified.** This
candidate adds one opt-in immediate-transfer record to historical accepted source
`b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`. It distinguishes an instrumented
native `CACA0005` assignment, a 32-bit guest RET consuming zero, and unknown
provenance. It does not establish the writer in the original captured session. The original `61e1ea2d` capture remains **REJECTED** by its required event order. No game repair or acceptance-order change is included.

The diagnosis at `db440558dc58f67c5f026be55ff549a6eec2f8eb` is the input:
the original had an existing modal pump `0x1001c`, pending return `0x4015d4`
(guest byte `C3`), and abandoned earlier Config/OK callbacks. The synthetic
instead opened a modal inside its callback. Matching final state never proved
which transfer wrote zero. This patch supplies a future observation at that
boundary; it makes no new historical causal claim.

## Source and protocol

- `src/13-exports.wat`: bounded instance-local state, before-transfer snapshot,
  first-zero validation/invalidation, existing field accessor extension.
- `src/09b-dispatch.wat`: immediate `CACA0005` writer and deferred-unload
  invalidation.
- `src/05-alu.wat`: `th_ret`, `th_ret_imm`, and `th_pop_run_ret`, using the
  very word already read for the transfer, including fused fast/slow reads.
- `tools/shadow-man-null-capture.cjs` and `tools/shadow-man-null-preload.cjs`:
  opt-in selection and synchronous immutable serialization in the existing
  first-zero record.

The actual CLI `test/run.js` is byte-identical to the base, SHA-256
`4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`. Source identities (historical artifact: `shadow-man-zero-transfer-provenance-20261023/source-identities.json`)
bind original blobs/full hashes and patched bytes. No producer hashes were
refreshed. No named import/export, opcode table, region declaration, or linear
memory allocation changed. The diagnostic protocol explicitly expands:
`set_null_diag(2)` enables provenance; modes 0 and 1 keep it disabled. `null_diag_field(9)` is capability/version 1, and fields 10–28 expose the
record. This adds 96 bytes of mutable global values per instance, plus engine
implementation overhead and source/code size; it is not a linear-memory arena. Function/global index and module byte identity necessarily change. Source
census checks are not a new compiled ABI/producer qualification.

Immediately before EIP/ESP mutation, native code snapshots site/kind, actual
architectural pre-EIP/ESP, predicted post-EIP/ESP, actual thunk address and the
dispatcher's loaded metadata marker, consumed RET word/address where applicable,
i64 invocation token/root, depth/event count, modal pump/return/ended and shared
modal state, and both named continuation thunk values. RET records set thunk
address/marker to zero rather than borrowing stale `current_thunk_eip`. `preEip` is the emulator's actual architectural EIP, which can name the current
decoded block; it is **not** a promised exact x86 instruction VA. The native
site and threaded cursor identify the handler boundary without guessing from
`dbg_prev_eip`.

At the existing zero guard, saved token/root/depth/event count and predicted
ESP must still match. The first-zero callback independently requires actual
EIP zero and matching post-ESP, depth and count adjacency. Its token/root strings
are the live values already matched against saved native i64 values, without
lossy JS conversion. The adapter records `native-caca0005`, `guest-ret-zero`,
or `unknown`; a mismatched actual/named synchronous thunk is retained explicitly
as `syncReturnThunkMatches:false`, not interpreted as a legitimate return.

There is no additional observer event or pending JS writer history. The same
first-zero envelope is sealed, deep-frozen, retained/fsynced and stopped through
the existing synchronous OS-exit-86 path. Its native returning-observer trap is
unchanged. Missing required block still fails **after retaining first-zero**;
there is no resume to obtain outer modal events and no automatic ordinary-exit
acceptance from a known writer.

## Transfer coverage and conservative unknown cases

| Transfer | Treatment |
| --- | --- |
| `CACA0005` in `$run`'s explicit thunk-entry dispatch | Snapshot before assignment; require actual pre-EIP equals actual thunk. |
| Near 32-bit `RET`, `RET imm`, fused POP/RET | Snapshot the actual consumed word/address before EIP or final RET ESP changes. For fused POP/RET, pre-ESP is after the preceding POPs. |
| Inline CALL/JMP-to-thunk dispatch | Unknown: callers can overwrite EIP after dispatch. A transient explicit-entry flag and pre-EIP check prevent attribution from these routes. |
| Deferred DLL unload after dispatch | Invalidate unconditionally before deferred handling. |
| New/reentrant run, rearm, next nonzero loop iteration | Clear record kind. Invocation/count/ESP mismatch also clears it. |
| Other native assignments, modal `CACA0004` return, thunk auto-return, host-supplied EIP, indirect CALL/JMP-to-zero, Win16/far/extended returns | Uninstrumented, therefore unknown; no inherited predecessor is fabricated. |
| Chained or tier-generated transfers | Actual adapter's existing range-trace arming sets debug chain/tier guards; source shows RET tails return to the run desk. Tier writers themselves remain uninstrumented. No broader tier/native correctness claim is made. |

The record helper does not write guest memory, call the observer, schedule a
modal, or change emulated registers. Its only extra memory reads in enabled
mode are the existing context values. Off-mode handler comparisons preserve
modeled EIP/ESP; this is an offline claim, not a benchmark or native equivalence
proof. No every-instruction logging or general observer expansion was added.

## Offline acceptance and limits

Controls cover distinct writers and RET stack adjustments, inactive/default and
unknown behavior, token/root/depth/count/ESP staleness, rearm/run reset, wrong
instance/PID/action/sequence, synchronous pre-arm ordering, malformed exports,
unchanged required-block rejection, and returning-observer trap. A rejecting
mutation changes the actual RET writer-site argument in the evaluated source;
the expected emitted-site test detects it. The preload's new environment
validation is evaluated offline without loading runtime code.

**Remaining independent qualification:** review this exact new candidate and
its focused patch; under a separately authorized resource allocation, verify
compiler/ABI/census provenance, build the canonical complete include closure,
and execute the new native writer and RET paths against the same first-zero
capture binding (including unknown/inactive controls). Only after those gates,
a separately authorized original actual-CLI first-zero observation could decide
the historical writer fork. It must retain the full required-order rejection
when applicable. None of that execution is authorized or performed here. Retained module SHA-256 `8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`
is unchanged historical standing input, not compatible proof for this patch;
it was neither copied, compiled nor instantiated. Historical retained-module
acceptances remain historical.
