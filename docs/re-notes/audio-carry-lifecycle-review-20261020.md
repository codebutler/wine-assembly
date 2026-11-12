# Carry frame and MIDI lifecycle review

Accept the bounded repair `79d5954988260e3369b35e7a8a69d6948a4acbdc`
on `6bb02733e9520ff539ec7eefbb6e2ed081f1e29d`, with this test adaptation.
No production defect found in the inspected save/restore consumers.
Production source was read only. This is not integration or native qualification.

The executed save frame is ten DWORDs: EIP, EAX, ECX, EDX, flag_op,
flag_res, flag_a, flag_b, flag_sign_shift, saved_cf. The original nine
offsets remain 0 through 32; CF is appended at 36. Allocation and restore
both consume 40 bytes. A callback pushes a return address and five arguments,
so callback ESP is interrupted ESP minus 64. Modeled RET 20 advances ESP
24 bytes to the saved frame, and the actual restore helper returns it to
the interrupted value.

The lifecycle fixture now checks all ten saved words from actual MIDI
notification delivery through the host pump and production WAT entry.
It seeds lazy carry using the real INC/DEC flag helpers, alternates CF=0/1,
clobbers CF during the modeled callback, then checks the real get_cf result
after restoration. Carry is checked before the new layout expectations:
the exact pre-fix register source fails with
“MIDI callback must restore interrupted lazy carry”, actual 0 versus 1,
rather than failing on the expected stack size. Existing callback arguments,
ESP/EIP/EAX, nested admission, lifecycle, timing, owner and backpressure
assertions remain.

Independent replay of the repair test passes 29 compiled cases and rejects
all six mutations through behavioral assertions. This covers nested frames,
INC/DEC, both carry values, 8/16/32-bit flag widths, MIDI/wave admission,
wait restoration, stack guards and the extracted production CACA000A arm.
The updated lifecycle suite passes all 28 groups and rejects 21 controls.
Wave owner, wave scheduler and MIDI long-message rejection tests pass.
Both repair and lifecycle pre-fix controls fail on carry preservation.
Syntax and diff checks pass.

One inherited mutation harness defect was found: `wrong-handle` matched both
window and function notification enqueue statements and failed its unique-site
assertion without exercising behavior. Its selector now identifies the
function queue explicitly. The mutation runner additionally rejects setup-only
failures. All 21 controls now reach behavioral assertions; the prior timing
review's separate seven-control audit was accurate but did not establish
that property for this older control. No production change was needed.

All production call sites were inspected from immutable Git:

- `DispatchMessageA` MM_TIMER arm in `09a5-handlers-window.wat`: removes its
  incoming return/argument pair before saving, then pushes five arguments and
  the thunk relative to current ESP. No hard-coded saved-frame size.
- `fire_mm_timer` in `13-exports.wat`: saves, then pushes six DWORDs relative
  to ESP. Its size comment correctly changed to 40.
- `fire_audio_callback_bound` in the same file: saves, then pushes six words.
  MIDI and wave wrappers share it; wait state and busy guards are unchanged.
- `09b-dispatch.wat` CACA000A arm: clears active state, invokes the shared
  restore and wait helpers, then handles timer resume yield. It does not
  independently pop or index the saved frame.

The existing multimedia timer fixture likewise calls the helper or models
RET 20 with +24, not a fixed 36-byte restore. It requires a full VM and was
inspected but not run. The `01-header.wat` IRQ_SAVE_STACK 36-byte comment
describes a separate interrupt area, not these guest-stack frames; no ABI
consumer was found there. The exhaustive symbol search is retained in evidence.

Evidence: `scratch/runs/20261020-audio-carry-lifecycle-review/`.
`sources.json.gz` contains the pinned source/compiler closure and updated test;
`source-pins.json` records comparison of every original closure input against
the repair commit (baseline register input against its parent).
`verification.json` retains all passing outputs and 29 expected failures
(27 mutations plus two baselines). Reproduce with `node verify.js` in that
directory. No package installation or full checkout is needed.

Limits: identity guest translation and modeled callback RET; no full build,
remote runtime, native guest instructions, browser, audio output or gameplay.
The separate callback census/build blocker and locked nonlocal work were not
changed or bypassed. No main integration.
