# technical review of Shadow Man synthetic native handler capture

Historical source last updated, 2026-10-23. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

**ACCEPT_SCOPED_SYNTHETIC_FULL_MODULE_HANDLER_CAPTURE** at
`2de825962dc45ac541ee9e0849bff2273eb5f4c8`. The retained records and implementation
support execution of the actual shipping sender, nested interpreter, constructed
x86 callback, DialogBoxIndirectParamA, guest DLGPROC/EndDialog, CACA0004 modal
completion and CACA0005 synchronous return, with the actual preload stopping
durably at first zero. This accepts a hidden, zero-control synthetic dialog in
a headless host through an extracted runner action. It does not qualify the
original game or the complete CLI.

The subject is the [qualification report and raw evidence at the reviewed commit](https://github.com/vgrichina/wine-assembly/blob/2de825962dc45ac541ee9e0849bff2273eb5f4c8/docs/re-notes/shadow-man-memory-recovered-handler-qualification-20261023.md). All subject evidence below is under its adjacent
`shadow-man-memory-recovered-handler-qualification-20261023/` directory. The read-only local donor is
`/home/user/wine-assembly-shadow-man-memory-recovered-handler-qualification-oct23`. Coordinator verification of its 72 retained/committed seals is reused, not
replayed. This review independently checks decisive raw envelopes and their
structure rather than treating `native-results.json` or `verify-native.py` as
an oracle. Neither subject verifier nor native fixture was executed here.

## Exact inputs and independent checks

review.py (historical artifact: `shadow-man-native-handler-independent-accept-20261023/review.py`)
is a new offline structural oracle; its passing
results (historical artifact: `shadow-man-native-handler-independent-accept-20261023/review-results.json`)
bind the subject commit, source pins, branch and PIDs. It independently derives
both guest instruction streams and relative calls from instruction lengths and
absolute targets, checks used export signatures against the accepted inventory,
and uses the accepted 269-record `9a3bc9149d58209c` layout. GUEST_BASE 0x12000 and
THUNK_BASE 0x07112000 give guest thunk base 0x07500000. API IDs are 2875 and 131;
four eight-byte descriptors identify CACA0005, CACA0004 and the two real APIs. The template is the disclosed hidden 40×30-unit DLGTEMPLATE with zero controls,
menu, class and title. Heap/thread initialization, translation, window table,
decoder, interpreter and dialog machinery are actual module exports/handlers.

The oracle initially assumed a void sender return and correctly stopped on the
accepted signature mismatch. It was corrected to the shipping `(i32,i32,i32,i32)
-> i32` signature; the original failed receipt is retained alongside the passing
`offline-review-correct-signature.receipt.json`. No subject evidence or oracle
condition was weakened. A resealed copy with modal ESP increased by four is
rejected, demonstrating structural checking beyond envelope hashes. The tamper
exists in memory only; accepted raw records remain untouched.

The decisive trace is `capture.capture.jsonl` (native PID 1989364, child exit86):

| Boundary | Independently checked raw facts |
| --- | --- |
| pre-arm | selected sequence1, batch50, command3, HWND0x550; prior count/depth0; exact initial registers |
| sender-pre | saved EIP0x404100, ESP0x0740f000; event1, sync depth1 |
| decoded-block | EIP0x4015d4, ESP0x0740efec; stack `[0x07500000,0x550,0x111,3,0]`; code matches constructed callback |
| modal-frame-consume | EIP0x07500008, ESP0x0740efd4; sentinel0xdcbaabcd at ESP−4; return0x4015f2 and five prior-pump zero words; outer sync thunk at ESP+24; HWND65537 ended, shared-ended already consumed; event2 |
| modal-frame-complete | ESP advances24 to0x0740efec; EIP0x4015f2, EAX0x77; previous empty pump/shared pump restored; event3 |
| first-zero | CACA0005 returns to EIP0, ESP0x0740f000, EAX0x77; event4; stop=true, continuation forbidden |
| terminal | `terminal:true, reason:first-zero, exit:86` |

Child token3/root2 and sync depth1 persist across all four boundary events. The real guest DLGPROC reads its HWND from `[esp+4]`, calls EndDialog(HWND,0x77),
returns1 with `ret 0x10`; the outer guest stores the modal result then returns
with `ret 0x10`. The capture stops inside nested run, before sender restoration;
absence of `sender-before-restore` is expected. The normal control independently
covers that later restoration. Ordinary CACA0005 first-zero remains
**ordinary-or-unknown; zero-writer unproven**. No null instruction or zero writer
is established by this trace.

## Authenticity, action binding and controls

Source inspection, preserved in
source-excerpts.json (historical artifact: `shadow-man-native-handler-independent-accept-20261023/source-excerpts.json`),
connects the sender's child allocation/frame construction and real `$run` to
the modal consume/complete events and CACA0005 setting EIP0. EndDialog sets the
actual dialog result/ended flags; the continuation restores the saved pump and
advances the API frame by24. The host does not supply those events or results. The fixture writes initial guest code, template, thunk descriptors and register
inputs; it does not script a sender, allocator, interpreter, callback executor
or native event emitter, and never replaces/proxies instance exports.

All three retained `*.runner-branch.txt` files equal a fresh extraction of the
whole pinned shipping `dlg-cmd` branch: convert its opening `} else if` to `if`
and append its closing brace. SHA256 is
`a231512463281994fd1ebe646dba0a62d325000c35d304344b8b70a89e1fd4c5`. A one-iteration fixture loop supplies `continue` semantics. The synthetic
renderer record supplies the initial HWND; the unchanged branch resolves it and
calls actual `we.send_message` through the supported selected-send hook. This exercises the resolved-dialog route, not every branch of that action.

The fixture deliberately sets process.argv to the pinned runner and explicit
module argument before requiring the real preload. That satisfies a disclosed
fixture contract; it is not evidence of launching that CLI. Actual command
receipts name `fixture.cjs`, and observations identify both fixture and runner. The preload enforces PID, runner realpath/hash, exact module bytes, one compile,
one bound Module/Instance and no start section; the selected adapter checks
instance identity, PID, runner, action, counted sequence, command and resolved
HWND. No alternative instance/export facade is passed to it. Constructor and
streaming restrictions remain active. Binding is within this fixture process,
not an adversarial attestation that argv proves an executable launch.

The actual retain function writes then calls real fsyncSync. The fixture's
fsync wrapper invokes the saved real fsync first, then records completion using
the separately saved real function. Adapter source orders retained pre-arm
receipt before diagnostic mutation and before invoking send. The seven completed
fsync observations are one pre-arm receipt, five envelopes and the terminal;
the first three completions precede the first dialog host event. Pre-arm count0
and sender-pre event1 further bind the ordering. A failed retain cannot arm or
send. The wrapper does not replace capture bytes or fake the fsync result.

The controls discriminate this limited claim:

- Normal PID1989221, exit0: no capture preload/hook; real guest writes modal
  result0x77, all nine initial registers are restored, diagnostics count0 and
  sync depth0. This establishes ordinary execution independently of observer
  termination, not general dialog/CLI behavior.
- Wrong-command PID1990236, wrapper exit0: command4 is rejected by the real
  adapter before arm/send; count0, unchanged registers and zero result marker
  are asserted by the executed fixture. Its actual capture file contains only
  `terminal:false, failure:missing terminal capture, exit:0`. This is an expected
  rejection, **not a successful negative capture**. Exit status alone cannot
  establish successful capture, including exit86.

## Host facade and saturated capture budget

The finite facade is adequate for this immediate-EndDialog hidden dialog. Actual successful imports are beep process/thread lifetime acknowledgements,
log notifications, dialog_loaded, get_window_rect, invalidate, log_api_exit,
service_load_library, set_window_class and destroy_window. The accepted void
notification signatures match their no-return implementations. The rectangle
import has a void signature and writes four i32 values `[0,0,100,80]` at its
bounded WASM output pointer, not at guest frame/register locations. The beep
acknowledgements check nonzero epoch/thread identities; their returned values
are dropped by shipping initialization (see
beep references (historical artifact: `shadow-man-native-handler-independent-accept-20261023/beep-source-references.json`)). Neither a beep request nor audio execution is serviced.

The sender's `i32.and` eagerly calls service_load_library even when yield reason
is not5. The facade asserts reason!=5 and returns0, which truthfully means no
load serviced. An actual pending DLL load fails; it cannot become a dummy
successful DLL import. Other undeclared contracts throw with signature/args. Unused clock/client-size/show-window helpers do not establish renderer/window
visibility correctness; show_window's constant acknowledgement would be
insufficient for a visible-dialog claim. It was not called in these runs.

All four earlier failures remain explicit in raw `normal-*-failure` records:
beep_process_begin, get_window_rect, invalidate and service_load_library;
each exited1 and was reaped. Their fixes supplied the above finite contracts
inside the fixture, without changing native exports or success predicates. The verifier's earlier negative-order failure reflected the later real exit
fsync; this review independently checks rejection followed by that fsync.

This review imported only the subject's unchanged Python supervisor, redirected
its paths to a new owned `boundary/` directory, and seeded an explicitly
synthetic counter receipt at524288. No actual task counter was reset. Zero-output receipt (historical artifact: `shadow-man-native-handler-independent-accept-20261023/boundary/zero-output.receipt.json`)
passes0 at524288. One-byte receipt (historical artifact: `shadow-man-native-handler-independent-accept-20261023/boundary/one-byte.receipt.json`)
rejects125 with `aggregate capture overflow`, aggregate524289 and retained0. Both children/groups were fully reaped. This is a fresh concrete boundary probe,
not a native fixture rerun or a claim that the negative produced capture data.

## Remaining original-game prerequisite

The next capture requires a separately authorized runtime with the complete
original Shadow Man fixture and actual runner dependency closure. Preserve this
exact diagnostic candidate/module rather than rebuilding from current main. Observe a fresh Configuration/OK/launcher route in the actual game process,
including returned prior-action receipts and the visible current state. Count
the actual dequeued actions and select the final Beenden command3 intent;
do not reuse synthetic sequence1/batch50/HWND0x550 or historical HWND/batch. Bind actual runner/PID, named module hash and single instance, resolve the live
dialog at that action, fsync pre-arm context before arm/send, require the
0x4015d4 block and terminal first-zero records, use exclusive output and an
external watchdog for synchronous spins. If that run lacks a required record,
retain the exact missing-record blocker; synthetic evidence cannot fill it.

Full CLI startup, original game, browser, UI correctness, settings persistence,
reopen, Play and gameplay remain unqualified. Configuration/OK returning does
not by itself establish any of those. A proven zero writer would require
additional origin evidence; ordinary continuation zero is insufficient.
