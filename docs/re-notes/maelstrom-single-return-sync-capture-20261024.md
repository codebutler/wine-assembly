# Maelstrom: single CheckSockets return capture remains unresolved

Historical source last updated, 2026-10-24. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

Exactly one original guest ran on `bx_rfd49qx6`, using the corrected single
trace PC `0040e12a`. The actual owned argv passed
`tools/maelstrom-startup-divergence.py --check-argv` after checkout and again
immediately before guest launch: startup `BATCH_SIZE=1000`. The unchanged
42,000-batch ceiling stopped observation while the guest was parked inside
select. **No CheckSockets return record was captured. Its EAX, current-frame
missing slots, packet metadata and selected branch remain unknown.** Neither
timeout nor positive readiness nor SDL_net's internal errno retry is selected
from missing records. No second guest or observation extension occurred.

## Observed stopping boundary

| Observation | Value |
| --- | --- |
| Historical startup-path counter `406378` | 1 |
| Sync entry counter `40e000` | 1 |
| RunFrame counter `4019a0` | 1 |
| PollEvent return counter `40287d` | 3 |
| Select return counter `7a3362` | 972 |
| Select thunk counter `075040f8` | 22,370 |
| Requested `40e12a` trace records | 0 of at most 16 |
| Final EIP / ESP / EAX | `075040f8` / `074ffb18` / `53000001` |
| Last observer batch / yield | 41999 / 8 |

The unchanged passive observer retained four parked-select samples at batches
36165, 36175, 36185 and 41999. The parked stack begins with the authentic
select CALL return `007a3362`, followed by `53000001`, a read-set pointer, two
zero pointers and a timeval pointer. Its timeval is `(1,0)`; its read set has
count one and socket `53000000`. These are pending-call observations, not
completed select results. Final EAX is not a CheckSockets return value.

The positive startup counter reestablishes startup reachability after the prior
five-PC startup-budget failure. It does not establish packet acceptance. The
972 return hits do not establish 972 Sync iterations. As documented in the
accepted [Sync diagnosis](maelstrom-sync-loop-cause-20261024.md),
CheckSockets can retry select on errno 4; that errno is not captured here. The precise unresolved predicate remains the return from CheckSockets and the
current-frame barrier state at that return. The actual finite observation ends
at the parked select thunk; no production repair or permanent-hang claim follows.

## Exact configuration and evidence

The only trace address is `40e12a`, the true return after the original CALL at
`40e125`, before `ADD ESP,8; TEST EAX,EAX; JNE 40e19f`. The intended zero successor
is `40e131`. None is claimed observed by a missing trace. The six historical
count PCs remain counters, not added trace/break/watch PCs. The trace is armed
from batch 36163, limited to 16 records and memory
`esp:384,0x41f9d8:128,0x420658:12` (at most 8,384 raw snapshot bytes; actual zero). The 42,000 batches, 200ms clock and complete P/arrow/space/PNG input schedule
remain unchanged. No forced network/readiness/input change occurred.

Ordinary UID1000, Node24.22.1 and pinned pngjs7 passed the retained preamble,
font, codec/pixel identity and rejecting PNG controls. The passive observer
fixture, resistant-descendant TERM/KILL/reap control and 131,072-byte output
guard control passed. Full stdout/stderr was retained without truncation. All three PNGs are retained and visually inspected: the menu is visible at
30000; the later images are black/starfield frames. They do not establish
gameplay. The analysis (historical artifact: `maelstrom-single-return-sync-capture-20261024/analysis.json`)
keeps unknown return/packet fields explicitly null. The evidence seal list binds
the complete raw output, terminal, command, PNGs and compact gate receipts.
