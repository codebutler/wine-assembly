# Shared audio callback saved carry repair

Base: `6bb02733e9520ff539ec7eefbb6e2ed081f1e29d` (MIDI timing candidate).
Prior finding: `eb18374f5dc5504b82159ac4aea6f414835e1920`,
`scratch/runs/20261020-midi-callback-census/report.md` and `audit.js`.

`save_caller_regs` now reserves 40 bytes and saves `saved_cf` at offset 36;
`restore_caller_regs` reads that word before releasing the 40-byte frame.
Offsets 0–32 retain EIP, EAX, ECX, EDX, flag_op, flag_res, flag_a, flag_b,
and flag_sign_shift in their previous order. No global scratch slot is added.
This fixes an interrupted INC/DEC reading the callback's carry after return.
Each nested frame retains its own carry. The timer producer's size comment
is updated; its executable code is unchanged.

## Frame consumers and hardcoded sizes

The immutable source audit found exactly three production save calls:

* `src/13-exports.wat:$fire_mm_timer` pushes five arguments and the return
  thunk after saving. All pushes are relative to current ESP.
* `src/13-exports.wat:$fire_audio_callback_bound` does the same, shared by
  the bound MIDI and wave wrappers.
* `src/09a5-handlers-window.wat:$handle_DispatchMessageA` consumes its API
  arguments before saving and pushing the five TimeProc arguments and thunk.

The sole restore call is the CACA000A arm of `src/09b-dispatch.wat`.
It executes after stdcall RET 20 has consumed six words. No caller indexes
the saved frame or independently releases 36 bytes. Therefore none requires
an executable consumer edit. `IRQ_SAVE_STACK`'s 36-byte comment describes
a separate interrupt area, not this guest-stack frame. Generated dispatch
offset-36 argument accesses and other structures are unrelated.

Test consumers: `test/test-mm-timer-callback.js` calls the helper and models
RET 20 by adding 24; it does not fix the save-frame size. The existing MIDI
lifecycle test extracts both helpers but **line 226 asserts `before - 60`**
(36-byte frame plus six words). This must become `before - 64` and its
description must say 40 bytes in a separately authorized test update.
The first audit search found the production sites but missed this test's
`before - 60` spelling; the expanded audit and existing-test run caught it.
The lifecycle test is explicitly excluded from this task's edit ownership.
Its oracle was not modified, even in the replay. This branch is consequently
not ready for integration with an all-green existing suite.

## Compiled evidence

`node test/test-audio-saved-carry.js --mutations` passes 29 cases and detects
six independently compiled mutations: lost save, lost restore, wrong save
size, wrong restore size, wrong restore slot, and overwriting sign shift.
The same initial witness compiled with the exact baseline register source
fails: carry is 0 where 1 is required. No diagnostic evaluator is used.

The test compiles actual save/restore and lazy flag functions, actual MIDI/
wave bound producers, wait restoration, and the exact CACA000A dispatch arm
using the vendored compiler. It checks INC and DEC with carry 0 and 1,
7/15/31 sign shifts, all five computed arithmetic flags, three nested
frames, EIP/ESP/EAX/ECX/EDX, untouched callee-saved registers, stack guards,
callback argument words, busy admission without state/memory changes,
and wait/yield restoration after modeled RET 20. A nested synchronous
save/restore is also exercised inside the admitted audio callback.

Existing unchanged tests:

* Wave owner admission: PASS.
* Wave scheduler: PASS.
* MIDI lifecycle: six timing groups pass, then FAIL at the stale frame-size
  assertion (`8136 !== 8140`). The remaining groups were not reached.
* Full-VM multimedia timer regression was inspected but not run: it uses
  the render harness/full emulator, outside this task's permitted execution.

Evidence is self-contained in
`scratch/runs/20261020-audio-saved-carry-fix/`: compressed baseline/candidate
sources and compiler, replay runner, baseline failure, mutation results,
existing-test logs, frame audit, preflight receipts, hashes, and recovery
instructions. The replay uses an in-memory file/module adapter, preserving
the source bytes and existing assertions. No broad checkout is needed.
The initial new harness compile rejected an inline memory export; the final
harness uses the compiler's supported top-level export syntax.

## Limits and remaining dependencies

This is a minimal compiled source composition using identity guest memory
translation and modeled stdcall return. It does not execute x86 instructions,
the complete dispatcher, real timer scheduling, a browser, native Windows,
or the full emulator. The timer/DispatchMessage producers were audited,
not executed by this minimal module. Native MIDI qualification, audio output
and gameplay remain pending.

Only the saved_cf defect is repaired. Other machine-state policy, traps,
aborts, process termination, token ownership, stale-owner retirement and
nonlocal jumps are not newly qualified. No broad lifetime rewrite was
required or attempted. The callback census and its accepted pins were not
updated; its pending ownership semantics and nonlocal API lock remain.
The changed register dependency and timer comment need explicit review in
any future census reconciliation. The known mandatory census failure still
blocks canonical MIDI qualification; this task did not run a full build or
bypass that gate. MCI work and host-audio.js are untouched.
