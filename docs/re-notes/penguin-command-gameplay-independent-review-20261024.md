# Penguin Command independent gameplay review, 2026-10-24

**Accepted: bounded original Normal Game progression on the retained historical
module.** Producer `d177cdd2a58fef05ae84bbf9c6cd1e845fb404fc`, published on
`task/penguin-command-scheduled-input-gameplay-oct24`, supplies 54 unchanged
report/evidence files. This independent review adds only this note; no guest,
browser, build or native module was executed again. The producer's strict-SSH
remote branch SHA matched the reviewed commit.

## What the evidence establishes

I independently inspected `menu.png`, `after-selection.png`,
`aim-fire-left.png`, `aim-fire-centre.png`, `aim-fire-right.png` and
`final-scheduled.png` in the adjacent
`penguin-command-scheduled-input-gameplay-20261024/run/` directory:

- Batch 32,000 shows the original menu. The scheduled mouse move/down/up at
  33,000/34,000/34,500 selects Normal Game.
- Batch 45,000 visibly shows **Score: 160 / Wave Scoring** and city graphics.
- Batch 60,000 shows **Score: 240 / Starting Wave #2 / Defend Cities!**, with
  the red aiming cross at desktop (260,220).
- Batch 85,000 shows Hiscores. Batch 120,000 shows the menu with the cross
  at (550,250); the final reviewed menu has the cross at (330,160).

All 22 scheduled events appear at their requested batches in the actual
8,039-byte output: 15 ordinary mouse/key actions and seven PNG captures.
The exact `run/command.json` input argument matches `scheduled-inputs.json`.
Mouse messages target hwnd `0x10001`; all six A/S/D down/up messages report
keyboard focus on that window. The original release README documents mouse
aiming and left/middle/right cannons on mouse buttons or A/S/D. Its SHA-256 is
`df522480c6c682c937ad16c404832625d2246feed60b73d3785c1b664ba5db8b`.
The empty live-control `input-events.json` does not contradict the scheduled
delivery recorded by argv and output.

**Unknown:** individual cannon/projectile causality, a player-caused kill or
score increment, sustained real-time play, full-game completion, audio,
full-client coverage, current-main compatibility, and guest exit. The score
change crosses wave scoring; it does not isolate the A press. No frame
isolates the S press, and D and the last click follow the Hiscores frame.
The green line is not firing proof. `--nosound` disables sound. The 640x480
canvas clips the client of the original window at (20,20). Guest-clock
6,400,000 ms at the menu and 12,000,000 ms at Wave #2 are accelerated batch
time, not elapsed gameplay duration.

## Identity, recovery and controls checked

All 50 final seals and eight image identities passed independent hashing.
The 54 producer files match their original Git blobs byte for byte, including
raw output, recipes and CRLF game options. All 287 recovery manifest inputs
were independently read and rehashed: **15,719,953 bytes**, unique destination
paths, maximum file 1,879,746 bytes. This includes the seven original DLLs,
83 graphics and codec/font/host dependencies. Recovery uses the original
absolute immutable donors and exact historical Git revision, not a new build;
those standing inputs remain necessary. The producer report retains the
fresh-path recovery order and exact recipes. This is investigation evidence;
there is no Penguin dashboard candidate card.

The qualified source is `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`, module
SHA-256 `8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`,
runner `4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`,
original EXE `14d6e430c26c44c94ef5c176eca2f66edd82dd66fd155d29a5596e3d6e170fc1`.
Successful destination rehash, production codec/font/renderer probe and
separate 291-import ABI instantiation all precede the sole guest launch.
The module uses the complete `9a3bc9149d58209c` layout contract. All seven
actual DLL initializers returned success. ABI probe placeholders were not
the gameplay host. Transfer receipts show 431 requests, maximum 35,976 bytes,
with 18,000-byte data segments.

The corrected admission-before-guest explicitly retains **5,327,752 bytes**
of previous history: **65,087,897 / 67,108,864 bytes**. Final projection is
62,374,522 bytes with those charges retained. Both include the 8 MiB reserve
and meet the host free-space floor. The supervisor's disk assertion still
uses an earlier 56,814,417-byte projection; the separate corrected admission
precedes launch and passes using the larger complete allocation. Raw recipes
are preserved rather than retroactively corrected.

The actual runner reaches the **200,000-batch limit in 7.136 seconds**;
the supervisor exits naturally with host status 0 in 7.330 seconds, no TERM,
KILL or remaining group. The final remote process census is empty. This
establishes bounded host cleanup, not the game's own exit path. The observed
coordinator watchdog PID/source/deadline is retained; its shutdown had not
executed at producer handback. The later coordinator receipt
`scratch/usage-watch/bx_ts27jq5e-early-closeout-oct24.json` records the box
**stopped at 02:57:37 UTC**, snapshot verified at 02:57:37.284 UTC. Original
expiry was 03:18:12.037 UTC. This reviewer made no box operation; lifecycle
ownership remains with the coordinator.

Producer-wide whitespace checking reports the raw CRLF game options and one
space-only line in `supervise.py`; these exact evidence bytes are retained.
Authored report/review prose passes its scoped whitespace check. Independent
receipts, manifest verification and strict-SSH publication/resource records
are retained under `/tmp/penguin-gameplay-independent-integrate-oct24/`.
Integration reconciles actual remote main and checks the final 55-file scope
under `scratch/usage-watch/shared-integration.lock`; root tracked files,
index, refs and all donor repositories remain read-only.
