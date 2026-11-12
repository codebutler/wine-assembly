# Original Penguin Command quiet execution, 2026-10-24

Historical source last updated, 2026-10-24. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

**Original main menu verified; ordinary gameplay remains unverified.** The one
authorized execution rendered the Penguin Command title and Normal Game / Arcade
Game menu. The runner reached the unchanged 200,000-batch ceiling in **7.739 s**
and exited before interactive menu selection arrived. This is an execution-budget
blocker, not an observed guest trap, import failure, missing asset or WINMM fault. No second execution was attempted.

Worker `01a16bb7-f360-7983-9acd-68ff4d0ea847` owns this report and adjacent
`penguin-command-quiet-original-gameplay-20261024/` evidence on
`task/penguin-command-quiet-original-gameplay-oct24`, based on main
`f42083c61a18d56fd739d3cd702c4d67d36784b7`. There are no production changes. Root tracked files/index/refs and standing donors were left untouched.

The prior immutable payload at `penguin-retained-codec-oct24` on
`bx_9nngcsvf` was reused in place. The only launch-flag correction was the
matching runner's supported `--quiet-blocks`; `--quiet-api`, the 524,288-byte
output guard, all guest limits and the full historical module were retained. The supervisor and all new outputs use `penguin-quiet-gameplay-oct24`. `run/command.json` is the actual complete argv, identity, start time, PID and
resource limits; `launch.json` binds API command `cmd_cye6lsvhjkz1`.

## Observed result and stopping condition

The original EXE initialized all seven DLL providers successfully and created
the titled SDL window. At 2 seconds the supervisor submitted snapshot and PNG
commands. Both succeeded at batch 30,376. `run/startup.png` was visually
inspected: the original title artwork, Hiscores, Normal Game and Arcade Game
are visible. The 640×480 host capture clips the right edge of the 648×488
window at (20,20); this is not a full-client-area rendering claim.

The terminal log records 461,565 API calls, 200,000 batches, 538,296 retired MMX
instructions and a final PNG, with no observed trap or unimplemented API. `run/exit.png` was also inspected. `run/input-events.json` contains only the two
actual startup controls. A later click at (420,360) targeting Normal Game and
game-start PNG request were appended to the new inbox after the runner had
already exited. They are retained in `input.ndjson` as **unsent attempts**. The attempted collection of game-start.png failed because that file was never
produced. No delivered click, aiming, A/S/D press/release, projectile, enemy,
score, wave or gameplay response is claimed.

`run/terminal.json` records natural exit 0 after 8.097439 supervisor seconds,
TERM=false, KILL=false, no reaped extra children and remainingGroup=false. Natural exit is not gameplay acceptance. The first actual execution limit
ended this run; the assignment prohibited another attempt. A future assignment
could deliver ordinary menu input promptly within the existing batch allowance;
this report does not authorize or perform that follow-up.

## Exact retained inputs

Ignored recovery inputs remain at the original retained closure path:
`/home/user/wine-assembly-penguin-command-retained-closure-oct23/docs/re-notes/penguin-command-retained-closure-20261023/original/penguin-command-1.6.11`;
standing CRT is `/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll` and
codec is `/home/user/wine-assembly/scratch/usage-watch/shadow-man-codec-recovery-oct22/node_modules/pngjs`. The previous published recovery report is commit
`c6001984808981b314e264f534d615250f1aab55`, at
`docs/re-notes/penguin-command-retained-codec-gameplay-20261024.md`. Its full recovery scripts and exact hashes remain unchanged and readable. Do not replay either supervisor over retained output directories.
