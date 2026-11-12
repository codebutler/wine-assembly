# Maelstrom retained probe technical review, 2026-10-24

Historical source last updated, 2026-10-24. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

## Independent source and provenance review

`identities.json` records verification of the coordinator's four pinned input
hashes against immutable Git blobs and donor files. All 25 candidate evidence
seals matched their actual immutable Git blobs. Historical source was recovered
with read-only `git show b41a7c5…:src/PATH` and checked against the supplied
lengths/hashes. The historical runner was independently recovered at
`d8cd8c54…:test/run.js`, not equated with current exports. The actual original
24576-byte SDL_net.dll matched its pinned SHA-256, and its 96-byte window matched
the candidate extraction. The standing 1879746-byte native module matched SHA-256
`8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`.

The candidate's limits are sound on source review: the original prefix is
MOV EBP,EAX; CALL EDI; the breakpoint follows that CALL. Its generic interior
instruction example does not explain the original game. A passive head count
does not establish target execution or 972 native API calls. The historical
zero-target cause, EDI target/return and errno remain UNKNOWN. The retained
candidate native log is prior evidence, not this worker's fresh acceptance.

The executable probe contains direct live assertions for wrong target evidence,
blocking yield, counter totals, breakpoint skip-once/reentry, cached successor
entry and benchmark chaining. Its cheap test alone does not run native code;
this review does not promote that test or prior logs into live native acceptance.

## Exact candidate-tree checks

On the byte-unchanged candidate tree, the single supervisor ran:

The focused suite passed, including wrong halt/EIP/readback and removing each
target-evidence guard. The existing unchanged boundary suite passed its seven
rejecting mutations, watchpoint/anchor/export checks and finite no-hit control. Their underlying exact Node argv and terminal/cleanup records are retained. No merged tree exists to test.

## Independent live contradiction control and worker fixture error

`independent-native.cjs` checks the exact candidate source hash, inserts one
uniquely anchored control in memory, and invokes the real candidate probe once
against the retained module. No candidate file was edited. This single invocation
uses the same fixed 512 MiB arena and real native exports as the candidate.

The added control places a pending blocking yield at the exact breakpoint. Its
assertions require: halt5 before counting; resume returns halt4 and count1 without
decode or EBP change; next entry halts5 again; wrong requested target cannot
invoke the read callback. These assertions preceded the eventual failure. Because the probe prints its rows only after full success, there is no retained
row log for these controls. Their completion is an execution-order deduction
from the later assertion location, not independent per-row output evidence.
