# MIDI timing corrections — 2026-10-20

Corrects both demonstrated findings from the independent final review of
`a33fc31f0e8b5ed46b48bfa435bf4629e36a1bf3`. Source-only qualification; no
runtime, full build, native guest, browser, audio-output or gameplay claim.

## Preserved review findings

The independent review requested changes before unrestricted timing/conformance
acceptance. P1: independently flooring each event delay made 96 one-tick events
at division 960 and tempo 500000 complete at the starting timestamp, losing
their cumulative 50 ms duration. P2: using queue occupancy to validate time
division admitted SET on a running-empty stream and rejected a stopped stream
with queued data. Both defects predated the lifecycle candidate.

The review also verified 22 behavioral groups and 14 mutation controls, while
identifying harness limits: identity guest translation, selected globals,
trapping unrelated dispatch branches, simulated synth/event/window transports,
and simulated guest callback `ret 20`. Window queue insertion is substituted;
native wake/progress and guest callback execution remain unqualified. The
full review is preserved as `independent-review.md` in this task's evidence.

## Contract and change

Primary Microsoft documentation:

- [MIDIEVENT](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/ns-mmeapi-midievent):
  deltas measure ticks between events; tempo events affect following events.
- [midiStreamProperty](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-midistreamproperty):
  time division can be set only while stopped.
- [midiStreamPause](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-midistreampause):
  pause retains the current stream position for restart.
- [midiStreamStop](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-midistreamstop)
  and [midiOutReset](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-midioutreset):
  pending buffers are returned; subsequent submissions form a new timeline.

Each stream now carries an integer remainder in tick-microsecond units. Add
`delta * tempo` to that remainder, advance the integer millisecond deadline by
the quotient over `division * 1000`, and retain the modulus. BigInt prevents
roundoff in the numerator. This preserves fractions across headers, tempo
changes and pauses; repeated service of a pending event does not charge twice.
Stop/Reset/Close clear the discarded timeline before completion notifications.
Sibling streams retain separate clocks. The millisecond service clock still
quantizes cumulative deadlines downward by less than one millisecond; this does
not provide sample-accurate audio scheduling or extend the existing signed
32-bit deadline-comparison horizon.

Time-division SET now rejects running or paused streams with
MMSYSERR_INVALPARAM (11), leaving the old division intact. Initial stopped,
explicitly stopped and reset streams can accept SET even with queued data.
GET remains available. Unsupported SMPTE and event transports still fail
explicitly; there are no new success stubs.

## Validation

Evidence: `scratch/runs/20261020-midi-timing-corrections/`.

- Self-contained production-source replay: **28 groups pass, 21 controls killed**.
  All original 22 groups and 14 controls remain included.
- Unchanged candidate replay independently passes its original **22/14**.
- Both new defect regressions fail against the unchanged candidate host with
  behavioral AssertionError: cumulative fractional timing and running-empty SET.
- New groups cover 96 events over 50 ms; tempo/header/sibling boundaries;
  repeated pause/restart and DWORD clock wrap; clearing fractions on Stop and
  Reset; running-empty, paused, exhausted-running and stopped-queued SET.
- Seven new mutations remove fractional carry, erase it on tempo/pause, retain
  discarded fractions, or regress running/paused/stopped-queued validation.
- Related actual production wave-owner, wave-scheduler and MIDI SysEx rejection
  tests pass; source syntax and `git diff --check` pass.
- Evidence contains 22 exact candidate input blobs with Git/SHA-256 pins,
  corrected host/test snapshots, replay driver, logs and hash manifest.

## Main reconciliation and boundaries

Verified remote main `682d0c824a0289e502276fb814c368e9e1970d57` and candidate
remote `a33fc31f0e8b5ed46b48bfa435bf4629e36a1bf3`. Their common base is
`1262cbfcf8b5881543f2fb18c0f80b4bd9429306`. Main has no host-audio changes
since that base and does not contain the lifecycle test. This branch descends
from the candidate and changes only the two assigned files and this note;
it does not import unrelated main changes or perform main integration.
The parallel MCI task's separately claimed functions are untouched.

Fresh exact-file noncone sparse worktree setup used no checkout followed by
explicit sparse patterns and fail-fast `read-tree`. Shared HEAD/index/config
hashes remained unchanged. No worker was launched; no native worker stage,
runtime, build, laptop, public deployment or unrelated files were changed.
The original review's full-VM/native/audio limitations remain. Any separately
reported canonical build blocker is outside this source-only correction.
