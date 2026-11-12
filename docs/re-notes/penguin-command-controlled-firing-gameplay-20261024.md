# Penguin Command matched ordinary-firing experiment, 2026-10-24

Historical source last updated, 2026-10-24. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

**Immediate firing/projectile causality remains unresolved.** One original
Normal Game control and one matched A-key variation reached visible gameplay. A down/up reached the focused SDL window. Their first differing reviewed
capture shows different green lines with Score 0 in both, but no isolated
friendly projectile, blast or ammunition change. This experiment rejects a
claim of proved immediate firing under this schedule; it does not show that
firing is broken. No third run was made.

Evidence and executed recipes are adjacent in
`penguin-command-controlled-firing-gameplay-20261024/`. Worker session `01a16be7-16d7-7430-8d0e-2bb4c0be527d` owns this bounded task on
`task/penguin-command-controlled-firing-gameplay-oct24`. The explicit sparse
checkout starts at accepted main `3f75d7afdfc93819d4874b2cf126ca83e66d5bd2`,
confirmed against actual remote main using strict SSH. No main merge occurs. Root tracked files/index/refs and all input donors were read-only.

## Matched actions and actual delivery

The authentic bundled README (`original-controls.txt`) specifies mouse aim and
A or left mouse for the left cannon. Both runs use identical original assets,
runner/module, CLI settings, normal-game entry, aim, batch-clock and screenshot
schedule. The only additional ordinary events in `firing/command.json` are A
down at batch 34,800 and A up at 34,900. No config, media, guest state or memory
was patched. All events were queued in argv before each launch.

| Batch | Both runs, except the stated variation |
| --- | --- |
| 32,000 | Original menu capture |
| 33,000 / 34,000 / 34,500 | Move (420,360), left down, left up to select Normal Game |
| 34,510 | Capture, still menu |
| 34,600 | Same fixed aim (260,220) |
| 34,790 | Capture before scheduled A down, still menu |
| 34,800 / 34,900 | Variation only: A down/up, balanced |
| 34,810 / 34,850 / 34,910 | Adjacent captures, still menu |
| 35,000 / 35,200 / 35,500 / 36,000 | Captures, unchanged menu |
| 37,000 | Identical paired frame, before logged release/aim/key delivery |
| 40,000 | Both Score 0, red aiming cross at (260,220); green-line geometry differs |
| 45,000 / exit | Wave Scoring; control Score 160, variation Score 80 |

The guest did not consume ordinary events immediately at their scheduled
batches. Both full logs place WM_LBUTTONUP and WM_MOUSEMOVE after the 37,000
capture. The variation then records WM_KEYDOWN `0x100` / VK `0x41` and
WM_KEYUP `0x101`, each routed to keyboard focus `0x10001`, before the 40,000
capture. Exact delivery batch/time inside that interval is **unknown**;
6,960,000/6,980,000 ms are scheduled key clock values, not delivery timestamps. The 37,000 and 40,000 captures log guest times 7,400,000 and 8,000,000 ms. This delayed consumption invalidates the intended adjacent firing window.

`matched-analysis.json` decodes and compares all 28 original PNGs. Eleven
paired captures (including the menu and every capture through 37,000) have
zero differing pixels. At 40,000 there are 2,378 different pixels; at 45,000
and exit there are 10,153. Visual inspection of the control 35,200, both
40,000 and both 45,000 frames found no isolated friendly shot/blast. A
change after an input is insufficient to distinguish firing from input-induced
guest progress/timing differences at these batch boundaries. Scores are
observed during wave scoring and cannot establish a particular shot or kill.

The original window starts at desktop (20,20), with the client below the title
bar. The 640x480 host canvas clips the right and bottom of the game; cannon
and ammunition areas are below the reviewed viewport. The captures preserve
the visible upper play area and crosshair but cannot show a complete launch
path or ammunition counter. This is the concrete limit on the causal result. A separately assigned experiment would need captures bracketing actual input
consumption during play and adequate client-area coverage. There is no
current-main qualification, audio, FPS, complete-game or sustained-play claim.

## Identity, gates and bounded execution

All local source hashes passed before the one staging transfer. Destination
rehash passed for every file before execution. `stage.py` preserves the accepted
serialized streaming method (431 requests, command bytes <=35,975, segment data
<=18,000 bytes); no archive or local media duplicate was created. The fresh
UID1000 PNG encode/decode, rasterCanvas/renderer, font readability and module
layout gate passed. The exact 291-import/512MiB historical ABI acceptance is
reused by module hash; no additional native ABI instantiation was performed. `runner-preflight-initial.json` retains an insufficient literal flag search;
the corrected receipt records actual parser spellings and default tick 200. Accepted quiet flags and output guard were checked before guest execution.

Control: API command `cmd_3dtbnvbrgyzk`, runner 2.593s / 30,619 API calls,
supervisor 2.913s. Variation: `cmd_ngudujslgeqx`, runner 3.039s / 30,328 API
calls, supervisor 3.370s. Both host exits were 0 at the batch cap; **neither is
claimed as a guest exit**. Both initialized seven real DLLs without an observed
trap/unimplemented API; TERM=false, KILL=false, remainingGroup=false.
