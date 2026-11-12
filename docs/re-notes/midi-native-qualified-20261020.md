# Native MIDI qualification, 2026-10-20

Exact production candidate: `14792a36a6cf1aa21f17f64615d5932d07e8d94f`, tree
`0e4d67f85a5a95ca088374f29e19156f0e091731`.
Canonical module SHA-256:
`11aee57cb158ffd734534b97aef9c36e3152aec660c8371d609a771e4eee9a5f`.
The six focused checks and canonical build from the preceding qualification
passed. This task verified all 6,915 source hashes before and after native
execution and reused that exact module; no production source was changed or rebuilt.
Main advanced through documentation commit 72fc79100 to 4d57bb66 (COM test and
note only). Neither changes the tested production source; this is an exact
candidate claim, not a build or qualification of current main.

The old native fixture was defective: HWND 0x123 was never created.
`post_message_q` routes through `shared_post_queue_enqueue_flags`, which
rechecks the live window's thread under the window lock and rejects this handle.
Moreover, the shared FIFO's 64-entry inline ring now has heap-backed overflow;
64 posts alone do not create backpressure.

`tools/qualify-midi-native.js` creates a hidden STATIC window using public
CreateWindowExA/GetProcAddress calls and checks IsWindow and
GetWindowThreadProcessId against GetCurrentThreadId (HWND 65537, thread 1).
It proves invalid HWND rejection, accepts 65 ordered posts, then exhausts the
actual guest allocator through guest_alloc without changing allocator internals.
All 64 inline posts succeed; the next overflow allocation fails and queue depth
stays 64. MIDI OPEN and DONE remain pending across a retry, without disturbing
the FIFO. Clearing the test queue allows both to arrive in order exactly once.
Held allocations are freed afterwards. Expected OOM diagnostics are evidence of
this deliberately induced condition, not an incidental host failure.

Positive result: 1,302 MIDI/time public calls and eight real x86 function
callbacks, including return/stack and INC carry+zero restoration. Two-handle
stop/reset note bookkeeping isolation, 1,200 one-tick events completing at
1,250 ms, paused completion at 3,400 ms, backpressure, successful closes and
closed/invalid-handle rejection all passed. The bad-ret control fails at
"callback returns through production continuation"; carry-corrupt fails at
"native INC carry and zero restored" (64 instead of 65). These mutate guest
callback bytes, not the module. No production defect was found.

Reproduce with the exact canonical module already present:

```sh
WA_MIDI_ROWS=/tmp/midi-positive-rows.json node tools/qualify-midi-native.js
WA_MIDI_ROWS=/tmp/midi-bad-ret-rows.json node tools/qualify-midi-native.js bad-ret
WA_MIDI_ROWS=/tmp/midi-carry-rows.json node tools/qualify-midi-native.js carry-corrupt
```

The first must exit 0 and the controls must exit 1 at the named assertions.
WA_TEST_ROOT optionally selects the exact source checkout. The fixture pins
the module hash and requires a host able to allocate 512 MiB shared memory.
Native execution used Node v24.18.1 on runtime bx_6czhvg6m; fixture SHA-256
`edffc18d1607dd2493488226c57d8937b7fccbceb6f99d1ffb4a042ccd6629f0`.
This is native full-module bookkeeping/ABI qualification, not acoustic output,
browser, game, concurrent-worker, or private-global/spill qualification.

Durable main-host evidence: scratch/runs/20261020-midi-queue-fixture-qualify,
with receipt, logs, call rows, fixture diff, source verification, recovery packs
and SHA-256 manifest. Predecessor receipt/patch remain in
scratch/runs/20261020-midi-combined-digest-qualify. Remote evidence is retained at
/home/user/midi-queue-fixture-qualify-evidence until the runtime expires.
