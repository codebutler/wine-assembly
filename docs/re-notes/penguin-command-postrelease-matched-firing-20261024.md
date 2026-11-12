# Original Penguin Command matched firing test, 2026-10-24

Historical source last updated, 2026-10-24. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

**Blocked: A was consumed and dispatched, but this matched pair does not
establish visible firing causality. Exactly two guest runs were performed;
no third attempt, rebuild, dependency recovery, or fabricated state.**

The control first passed the required full cannon/ammunition, non-menu
baseline at batch 39999. Its image SHA256 is
`95112041c84196db00873e676117ac51d58562a21cabe06f5498d1f4b0504972`,
also the accepted prior ordinary-play batch-40000 image. The treatment's
39999 image is byte-identical. All three cannons, ammunition groups, six
cities, right border and full bottom edge are visible within the 840x660
desktop capture. Crosshair is at (260,220). This is an authentic ordinary
game reached through its menu, not a fixture or replacement asset.

## Matched commands and actual delivery

The adjacent evidence directory retains both executed argv, input recipes,
full production dispatch logs, command and terminal receipts, images,
remote image hashes, comparison code and resource/source receipts. Recipes
use their original absolute paths and must not overwrite existing run outputs.

Both commands used the standing READONLY runner/runtime/game under
`penguin-integrated-clock-firing-oct24` on bx_fkg5uw8h. Only new recipes
and evidence used `penguin-postrelease-matched-firing-oct24`. The only input difference was balanced A-down40000 / A-up40200. Both used
normal mouse move33000, menu down34000/up34500 and aim34800; no gameplay
mouse button was added. Identical captures:39999,40020,40100,40201,40500,41000. No final PNG was requested; all twelve remote images remain retained and charged.

| Event | Actual production observation |
| --- | --- |
| Menu down, both runs | Dispatch34004; guestMs6800800; lastGuestTick6800803 |
| Menu release, both | Dispatch37629; guestMs7525800; lastGuestTick7525801 |
| Aim, both | Dispatch37629; guestMs7525800; lastGuestTick7525803 |
| A-down, treatment | Dequeue6 and DispatchMessageA40032; WM_KEYDOWN0x100, wParam0x41, hwnd0x10001; guestMs8006400; lastGuestTick8006402 at dequeue,8006404 at dispatch |
| A-up, treatment | Dequeue7 and DispatchMessageA40282; WM_KEYUP0x101, wParam0x41, hwnd0x10001; guestMs8056400; lastGuestTick8056402 at dequeue,8056404 at dispatch |

The actual consumption times differ from queue schedules. In particular,
40020 precedes A-down consumption, and40201 precedes A-up consumption. The trace explicitly leaves renderer enqueue IDs and schedule-to-dispatch
correlation unavailable. The production calls and matching key fields are
retained; scheduled events alone were not used as delivery proof.

## Pixel evidence and conclusion

All comparisons decode the existing PNGs with the standing validated pngjs;
no image is altered. `pixel-comparison.json` records every matched pair:

| Batch | Different pixels | Different pixels at y>=550 | Interpretation |
| --- | ---: | ---: | --- |
|39999|0|0|Matched full ordinary-play baseline|
|40020|0|0|Before actual A-down dispatch|
|40100|0|0|First captured frame after A-down; no treatment-only visible response|
|40201|0|0|Still identical; A-up not yet consumed|
|40500|1|0|Only pixel(82,536); no ammunition-area change|
|41000|1010|4|Sparse later differences across bbox(29,48)-(578,599); insufficient to identify a projectile, blast or ammo decrement|

The baseline,40100,40500 and41000 collected frames were personally viewed
at their full captured extent. At40100 the images show descending enemy paths and city destruction in both
runs. Those common effects cannot establish firing. The single40500 pixel
changes from RGBA[45,40,7,255] to[55,9,9,255]. Such a difference is not a
projectile trajectory, blast or ammunition decrement. By40500 the left
ammunition group has disappeared in both runs alongside ordinary enemy
impacts; that common depletion is not attributed to A. Later small differences
are not sufficient to distinguish a firing response from changes in ordinary
animation/timing. Score and wave transitions are not used as causal evidence.

The precise remaining blocker is **no distinguishable treatment-only immediate
projectile/blast/ammunition response in the sampled temporal envelope despite
proven A dispatch**. This does not prove the authentic A binding is broken. The original README's A/S/D binding evidence is reused. No alternative input,
new capture window or further guest run was attempted after this ambiguity.
