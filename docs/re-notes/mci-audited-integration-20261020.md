# Bounded MCI numeric integration, 2026-10-20

Integrates the six numeric corrections in
`2d061376beb0d701878d5377ddd530233ec79ca1`, whose parent is
`682d0c824a0289e502276fb814c368e9e1970d57`, with one audited census digest.
The four candidate files are unchanged.

The independent lifetime audit accepted only unchanged lifetime semantics
across the two host literal substitutions: `_mciCommand`'s invalid-device
early return changes `0x106` to `0x101`; `_mciStringCommand`'s missing-disc
early return changes `0x115` to `0x114`. Both remain immediate nonzero
returns. All other host bytes remain identical, including the later
string-command invalid-device literal. Neither changed path creates or
delivers a callback.

Only `lib/host-audio.js:host-file` changes in the census:

```
098b50a41a5c42c7da77f1452881f62c1476a1822f6e8edaea5c3a57afa78af8
6f54dc628fae27a8badfa705aecbbf1bcc59ce90a536fbb9991095f581f08812
```

Its other fields, including `ownership: "pending"`, remain unchanged.
The independent audit reviewed waveOut, waveIn, MCI, and other host callback
guards and cleanup. Five behavioral probe groups passed on parent and
candidate. Four mutations (busy completion discard, stale submission,
wrong cooperative owner, stale CD generation) failed behavioral assertions
even after refreshing their digests made the inventory pass. A refreshed
digest alone is therefore not semantic acceptance.

Independent execution evidence:
`scratch/usage-watch/mci-lifetime-readonly-audit-oct20/{final.txt,events.jsonl}`.
Integration replay and checks:
`scratch/runs/20261020-mci-audited-integration/`.
The replay reuses the immutable source archive in
`scratch/runs/20261020-mci-constants-integration-retry/sources.json.br`
(SHA-256 `864c8a57ab1a5f9be3cba27a052633cfc9e9fb4a9f0731744fea735fdd25e035`).

This does not certify complete callback ownership, missing-disc policy,
MCI error-text conformance, Messiah's warning/overlay cause, native execution,
audio output, or gameplay. No MIDI/carry changes are combined. No full build,
browser run, guest runtime, or deployment is part of this integration.
