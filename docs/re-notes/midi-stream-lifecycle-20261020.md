# MIDI stream lifecycle and public Stop — 2026-10-20

Implementation branch: `task/midi-stream-lifecycle-oct20`, based on fetched
`1262cbfcf8b5881543f2fb18c0f80b4bd9429306`.
Evidence: `scratch/runs/20261020-midi-stream-lifecycle/` in the shared checkout.
This is a source implementation with isolated executable regression coverage,
**not a fullVM, native audio, SDL initialization, or gameplay qualification**.
The original SDL import-failure diagnosis was not repeated.

## Behavior

`midiStreamStop` is appended as API 4593, stdcall with one argument. Both
generated dispatch and name/hash data are regenerated. Five explicit MIDI
host imports replace the module-global selected-stream state; their generated
Worker signature metadata is updated too. No memory regions change.

Each host MIDI handle owns its stream queue, tempo, division, due time,
paused time, immutable callback registration, and synthesizer. Header
preparation and pending submission ownership are independent of guest flags.
A second open cannot overwrite another stream. Ordinary MIDI output handles
are rejected by stream-only calls. NULL, unknown, closed, and wrong-owner
headers are rejected. The sixth Open argument and all stdcall cleanups remain
in the real WAT handlers.

Stop pauses the stream, discards its old scheduling cursor, returns all its
pending buffers with DONE set and INQUEUE cleared, and emits one owner-bound
MOM_DONE per submission. It sends note-offs for that handle's outstanding
note-ons, including short messages submitted directly on the stream handle.
Reset additionally turns sustain off and sends note-offs for every note on
every channel. Neither operation touches another live handle's synth.
Close retires the handle, resets/drains it, and queues MOM_CLOSE after its
buffer completions. Old function notifications retain the old registration
even if a new stream opens before delivery.

Pause and restart are idempotent; pause preserves the remaining event delay.
Stop/reset clear the old event timeline, so restarting cannot replay old
events. The existing `timeGetTime` service entry remains the scheduling hook,
with a bounded event budget and millisecond scheduling. This change does not
add an independent clock thread or a position-query API.

TinySynth instances are exclusive to live MIDI handles; MCI's synth path
remains separate. Its bundled implementation has no maintenance-timer disposal
API, so idle instances are reset and reused on close/reopen within the same
AudioContext. Retained synth graphs per context are bounded by peak simultaneous use,
not by cumulative open/close count. Real audio/resource behavior is still
pending runtime validation. The oscillator fallback also retains sustain
until controller release/reset and keeps sibling handles independent.

## Completion and supported scope

Supported callbacks:

* NULL: flags/lifecycle without notifications.
* Event: signal the captured event for buffer completion.
* Window: post MOM_OPEN, MOM_DONE and MOM_CLOSE through the captured owning
  VM's message queue. A full queue retains notifications for ordered retry.
* Function in a cooperative VM: queue immutable registration/message/header
  records, admit at a slice boundary, and build the real five-argument
  MidiOutProc frame. The browser uses its existing owner/suspension/wait-poll
  admission bookkeeping. Standalone cooperative hosts use the explicit pump.

The wave callback export keeps its four-argument signature and WOM_DONE
message. A shared WAT helper parameterizes only the message; it retains the
existing guarded multimedia continuation, invocation-owned saved-register
frame, and wait restoration. MIDI callbacks wait while another multimedia
callback is active. A retired VM's pending notification is discarded at the
owner boundary, never delivered to a replacement VM.

CALLBACK_THREAD and function/window callbacks from a Worker are explicitly
unsupported and throw at open, before allocating a handle. NULL/event modes
do not require the guest function transport. Worker callback delivery is not
claimed by the generated import-signature update.

Short, tempo, and NOP stream events are accepted. SysEx/long stream events,
position-callback events and SMPTE division explicitly fail rather than being
silently ignored. `midiOutLongMsg` now validates the real handle/header owner
and fails explicitly for the unsupported SysEx transport, instead of falsely
marking bytes consumed. The old regression that invented an unopened handle
and expected silent success was replaced with actual import ownership and
failfast checks. There are no accepted pending SysEx buffers to lose.

## Executed evidence

`node test/test-midi-stream-lifecycle.js --mutations` runs 22 behavioral
groups and kills 14 mutations. It compiles actual production MIDI handlers,
imports, generated dispatch page, hash lookup/data, callback admission and
register/wait save/restore into a small isolated Wasm module. Unrelated API
dispatch branches are trap sentinels; Stop itself is the production handler.
Guest address translation and the surrounding VM are a bounded identity-memory
harness. Callback return is simulated as `ret 20` followed by the production
restore helpers; this does not execute x86 guest callback instructions.

The suite executes the actual browser owner-admission and boundary methods
against that Wasm frame, including suspended/busy/retired VM states and
wait-poll restoration. Other coverage includes queued/playing/paused stop,
reset and close; normal completion; multiple streams; same-channel/same-pitch
overlap; note-on stop versus sustain reset; callback registration identity;
reentrant requeue/restart/close; pending ownership despite edited guest flags;
idle synth reuse; oscillator isolation; malformed/unsupported input; public
hash lookup and generated dispatch; and wave WOM_DONE ABI preservation.

Mutation controls remove queue clearing, header ownership, callbacks,
registration fields, browser VM identity, note stopping, sustain reset or
pause-clock adjustment, or force shared synth/single-open state. Every
mutation reaches and fails a behavioral assertion.

The baseline control uses the exact pre-change `lib/host-audio.js` from
`1262cbfc`, real `midi_out_open`/ShortMsg/Reset imports and a positive sibling
note control. It fails the sibling-preservation assertion as expected:

```sh
MIDI_BASELINE_HOST=1262cbfcf8b5881543f2fb18c0f80b4bd9429306 \
  node test/test-midi-stream-lifecycle.js
```

Existing browser wave owner/scheduler regressions and the revised SysEx
failfast regression also pass. API append-only and generator freshness,
import signature freshness, both stdcall gates (1812 inspected handlers and
2189 checked epilogue lines), syntax, WAT balance and diff checks are recorded
in the run bundle. No full build was run.

## Contract sources and remaining qualification

Microsoft's primary contracts:
[Stop](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-midistreamstop),
[Reset](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-midioutreset),
[Open](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-midistreamopen),
[Pause](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-midistreampause),
[Close](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-midistreamclose).
Wine's primary implementation also explicitly stops/drains before stream close:
[winmm.c](https://github.com/wine-mirror/wine/blob/master/dlls/winmm/winmm.c).

Next qualification is a separate coordinator-assigned task: reviewed integration,
canonical build, public x86 ABI/callback fixture, actual TinySynth/audio output,
and the original application. No runtime, Boat, browser, game launch, main merge,
deployment, other worker, or laptop session was used here. Unsupported callback
and event transports remain explicit limitations rather than gameplay claims.
