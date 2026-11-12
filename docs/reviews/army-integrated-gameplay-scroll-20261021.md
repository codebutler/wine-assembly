# Army Men integrated-main gameplay, input and scroll qualification

**PASS, bounded original CLI gameplay/input and scroll capture.** On exact
integrated main `c740f914e27395829deb9dbc0f2a3fe5762a2bdf`, ordinary Numpad8
moves Sarge relative to terrain landmarks, and Space release produces a visible
muzzle flash and weapon-HUD response. The subsequent explicit scroll-mode
before/held/released captures show **no visible stripe bands in these bounded
frames**. This does not close the historical corruption cause or prove complete
surface correctness. No production code, main integration or deployment changed.

## Actual observed actions

Original installed `readme.txt` (preserved verbatim) documents Numpad8 forward,
Numpad6 turn right, Space/left-click hold to aim and release to fire, and Enter
to toggle scroll mode. The task used original BootCamp.AMM and the established
click320,180 at batch279, Enter down500/up501, baseline670, and Numpad6
674–706 route. The controller injects normal Win32 keyboard/mouse events, not
memory edits or mission shortcuts. Logs record delivery to focus hwnd0x10002.
Captures are 640×480. Headless guest time advances 200ms per batch; these are
scheduled guest times, not elapsed real time or gameplay FPS.

Two short sequential executions used the same installed assets/module and
normal default runner without the observer or API trace hooks. Both had a
90-second runner/controller bound and 4MiB output ceiling. Neither fired.

* `default`: 1,030 batches, 4,355,934 API calls, 16.147s runner duration,
  exit0, 148,310 log bytes. It retained the established camera window, then
  attempted Numpad8 after Enter740. Actual images show that Enter selected
  free-cursor mode: Numpad8 moved the cursor/view to the top edge, not Sarge.
  The original launch description's proposed “return Sarge controls” label was
  a mistaken expectation, preserved unchanged; it is **not** a movement verdict.
  Space release850 returned the view to Sarge. This mode observation justified
  the one corrected run below, without any setup/build/assets repetition.
* `player`: 960 batches, 4,159,754 API calls, 14.841s runner duration,
  exit0, 138,126 log bytes. It retained the same route through batch735, omitted
  that extra Enter, and then performed the documented movement and firing.
  Combined runner durations are 30.988s; counts/rates are not gameplay FPS.

Corrected `player` sequence and inspected evidence:

| Batch / guest milliseconds | Input or observation | Evidence under `integrated-gameplay-scroll-evidence/player/` |
| --- | --- | --- |
| 670 / 134000 | Unobscured terrain, Sarge, sign and HUD | `baseline.png` |
| 674–706 / 134800–141200 | Prior Numpad6 window, camera/turn response | `scroll-held.png`, `scroll-last-held.png`, `scroll-released.png` |
| 735 / 147000 | Sarge beside fence/rocks; movement baseline | `player-before.png` |
| 740–755 / 148000–151000 | Numpad8 (VK104) down/up | `player-move-held.png` at746, `player-move-released.png` at765 |
| 780–795 / 156000–159000 | Space (VK32) down/up, documented aim/fire | `player-aim.png` at785, `player-fire-release.png` at796 |
| 798, 800, 805, 825 | After-release progression | `player-fire-798.png`, `player-fire-800.png`, `player-fire-805.png`, `player-after.png` |
| 850/851 / 170000/170200 | Enter down/up, free cursor visible | `camera-before.png` at875 |
| 880–912 / 176000–182400 | Numpad6 down/up in scroll mode | `camera-held.png` at886, `camera-held-895.png` |
| 925, 950 / 185000,190000 | Released and settled view | `camera-released.png`, `camera-settled.png` |

The movement images distinguish player movement from camera-only motion:
Sarge remains near the following camera's centre while his position **relative
to the sign, rock cluster and fence changes**, moving into trees left of the
starting rocks. The firing capture796 has a distinct yellow flash projecting
left of Sarge and a red selected-weapon border; later images clear that flash
and return the border to green. This establishes visible firing response, not
a target hit, damage, kill, ammunition accounting or mission completion.

In explicit scroll mode the cursor changes to a white pointer. Held Numpad6
moves it to the right edge and transfers the view to the rifle-training area;
landmarks and minimap viewport change. The camera reaches its bounded view
before the last held sample; held/released/settled captures are stable there.
This is not a measurement of continuous scroll speed or proof that release
alone stopped scrolling. Reviewed terrain, trees, road, fence, signs and HUD
show no horizontal corruption bands. No repeatable corruption appeared, so
there is no identified first corrupt frame/call to isolate in this task.

## Observer and correctness limits

The tested gameplay path has no observer preload and no `--trace-api` option.
The default baseline670 and released-camera713 PNGs are **byte-identical** to
the prior repaired observer-enabled capture at the corresponding checkpoints
(`observer-comparison.json`). Those prior runtime source bytes are identical
apart from integrated documentation/metadata; source reconciliation is sealed.
No additional observer execution was needed to establish the current default
result. Prior eight-call/72-span BltFast matches remain sampled evidence only,
not full-surface correctness. Initial corruption and historic stripe causality
remain unresolved. Full-game completion, audio, FPS, browser behavior and
native parity are **unknown/unqualified**.

## Exact identities and preservation

Remote source originally was `30a2c3fb1b5c2bfa8a6b001d7394d5cf50df295d`
plus the two accepted observer/test files. The old receipt rehashed all7,299
tracked files and required exactly those two accepted deltas. A bounded Git
bundle supplied the already-integrated commits; the remote tracked checkout
was reconciled to **clean c740f914**, preserving ignored npm dependencies,
DLL support, prior evidence and `/home/user/army-current-main/vfs`.
All **7,303** integrated tracked blob/SHA256 identities match the local Git
tree and are unchanged before/after both runs. All **419 original files** and
resolved real support DLLs were rehashed before/after. EXE SHA256 is
`dea8303de872789553f3190ad64e80bf3c0528a5d9d3cb18ad85e0c40664078c`.

Canonical module SHA256:
`728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`,
1,878,508 bytes. **Reused; no fresh build.** Its prior successful all-gates
build log/exit and full30a2 source manifest are recovered. Comparing that
manifest with the integrated runtime proves all WAT/runtime/build inputs
unchanged: the only changed existing files are the observer, its test and one
investigation note; four new files are documentation/evidence. A separate
284-file critical-source check passes. Actual module bytes are recovered.
No asset repackaging, broad trace, old test-suite replay or production fix.

`verify.py` checks all53 remote artifact seals, clean before/after source
identities, unchanged module/build relationship, original-count attestations,
exit/bounds, every injected key schedule entry and expected screenshot, and
prior-observer PNG identity. Screenshots were visually inspected, not accepted
from exit status. `RECOVERY.md` documents source/module/assets and archive
recovery. Asset originals remain in the existing local recovery store and
remote VFS; this task retains their manifest/recipe rather than duplicating
419 binary files. No Army corpus candidate exists, so this is an investigation
receipt, not a result attached to another game's dashboard candidate.

Local ownership: `scratch/runs/20261021-army-integrated-gameplay-scroll` and
`task/army-integrated-gameplay-scroll-oct21`. Only this Army block in isolated
TODOS is updated; the root's newer uncommitted TODO and all other WIP remain
untouched. Checkout was projected before materialization. Task storage stays
below64MiB and free space above2,285,895,680+600MiB (final resource receipt).
Coherent report/evidence/status is pushed on the task branch, with exact remote
ref verification in publication.json/messageboard. No main merge.

**Handoff:** box `bx_e8a7pw8v` left RUNNING, API `idle`, health `ok`, expiry
`2026-10-21T12:21:46.313Z`. Evidence recovered before12:05UTC; no surviving
owned guest/controller. Coordinator owns shutdown. No stop/resume/new box,
SSH, workers, replacement task, laptop HeroesII/WarcraftIII or fleet action.
Remaining dependency is a separately assigned original reproduction of the
historic stripe fault with first bad frame/call if it recurs; broader browser,
full-game/audio/FPS/parity qualification is still separate. Current-main CLI
startup and bounded player-input qualification have no runtime-access blocker.
