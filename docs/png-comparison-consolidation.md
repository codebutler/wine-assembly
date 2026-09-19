# PNG comparison consolidation — 2026-09-19

Follow-up to the Pass-5 addendum in `fable-review.md`: tests should reuse
`tools/png-diff.js`, but must retain their original comparison metric.

- Default `metric: 'max'` compares the largest absolute channel difference.
- Opt-in `metric: 'sum'` compares the sum of absolute channel differences.
- `includeAlpha: false` selects RGB; otherwise both metrics include alpha.
- A pixel changes only when its distance is strictly greater than tolerance.
- `maxDelta` remains the largest individual channel difference in either mode.

The sum metric is necessary: RGB differences of 10, 10, 11 exceed the
installer's threshold of 30 in sum mode, but not in max mode. Unit tests pin
that distinction, equality at 30 and 40, alpha inclusion/exclusion, region
selection, invalid metric rejection, and existing max-mode behavior.

## Migrated consumers and verification

| Consumers | Preserved contract | Evidence |
| --- | --- | --- |
| Calculator arithmetic / button press (`93d69f4a`) | Exact RGB in the same rectangles | 5/5 and 8/8 checks; 8 arithmetic pixels, 115 held pixels, 0 release drift |
| Spider drag / Deal menu (`150a7ff1`) | Exact RGB; missing/different-sized image returns failure sentinel | 9/9 and 5/5 checks; 11942 and 33783 changed pixels |
| Local candidate playability | RGB sum > 40; absent/mismatched images return -1 | Five apps run; all pixel assertions pass. Original HEAD test rerun also fails CWordZap's separate title assertion, with matching pixel counts for all five apps |
| Winamp installers | RGB sum > 30 in the same rectangles; mismatched dimensions now throw | Live clipping and pressed-button assertions pass. Original canvas comparator and shared PNG comparator agree on the generated captures: 0 clipping pixels and 95 pressed pixels |
| Minesweeper click | Exact RGB over whole frame plus clicked/old-origin cell rectangles | 8/8; exact old/new helper result: 215 total, 150 clicked, 0 wrong-origin pixels |
| FreeCell move | Exact RGB with original result/error shape | 7/7; old/new helpers both report 9600 pixels |
| Notepad menu | Exact RGB with original result/error shape | 12/12; 33339 open, 3584 hover, 30 close pixels; old/new helpers agree for open |
| Solitaire Deal | Exact RGB with original result/error shape | 11/12; both old/new helpers report 0 changed pixels on the captured frames, so the Deal assertion fails rather than being weakened |
| Pinball flipper | Exact RGB over whole frame and bottom 30%, original mismatch error | Existing test skips its static early snapshots; old/new helpers both report 0 total and bottom pixels. This is not gameplay validation |
| Paint drawing / file round-trip | Exact RGB in existing rectangles; mismatched dimensions now throw instead of indexing both images with one stride | Serial runs pass 9/9 and 15/15; drawing 93 pixels, file workflow 31 cleared / 0 restored difference / 21 added pixels |
| Paint dirty-document / 16-tool workflow | Same RGB regions and thresholds; mismatched dimensions rejected | Serial runs 10/11 and 20/21. Every pixel assertion passes; modal-command and File-menu-count assertions fail |

The local-candidate suite is not fully green: CWordZap's `title initialized`
assertion fails with both original and migrated tests. The Winamp suite is
also not fully green: silent installs fail before image comparisons. A direct
Winamp 2.91 `run.js --args=/S --max-batches=8000 --batch-size=5000 --dump-vfs
--quiet-api` reproduction traps at batch 536 in unimplemented
`DllUnregisterServer`. The wizard's unchanged hidden-details-button assertion
also reports 266 ink pixels. Do not label either entire suite a pass based on
the comparison-specific checks; investigate these runtime failures separately.
The completed Winamp run additionally fails the folder hidden-checkbox and
button-overdraw checks, installing-page geometry/native-control/progress-fill
checks, and interactive-install completion/VFS checks. These assertions do
not use the replaced comparator; this pass did not diagnose their causes or
rerun the entire original Winamp suite. No thresholds were relaxed.
The original Solitaire test also reproduces the same 11/12 outcome with zero
Deal changes on a fresh run. Its initial layout content varies between runs;
the helper-equivalence check above uses identical saved frames for both helpers.

The first concurrent run of all four Paint tests failed before generating
required screenshots. Serial runs then completed; the cause of that initial
failure was not established. The original dirty-document test was rerun
serially too: the same modal-command assertion fails, with identical 0/31
pixel counts and 10/11 checks. The 16-tool test's failing assertion checks
the logged File-menu item count, not image comparison; its original whole
test was not rerun. Old/new Paint helper functions were separately checked
for exact agreement on synthetic RGB/alpha changes over full, inset and
image-edge-clipped rectangles. New dimension-mismatch rejection was checked
for all four wrappers.

## Remaining work

This does not close the whole PNG-helper item. A broader name/body search
still finds comparison loops in Find mouse-click, Win16 Minesweeper,
Bricks, and other specialized probes. The five full-frame/subregion consumers
listed above now use the shared comparator; their small local wrappers only
adapt result shapes or combine named regions.
Some compare masked regions or return different statistics; inspect each
contract before replacing it. Browser-evaluated pixel loops cannot directly
require the Node PNG helper. Keep app-specific color/content assertions
separate from image-difference plumbing.
