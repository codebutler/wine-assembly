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

## Remaining work

This does not close the whole PNG-helper item. A broader name/body search
still finds comparison loops in MSPaint tests, Find mouse-click, Minesweeper,
FreeCell, Pinball, Solitaire, Notepad, Bricks, and other specialized probes.
Some compare masked regions or return different statistics; inspect each
contract before replacing it. Browser-evaluated pixel loops cannot directly
require the Node PNG helper. Keep app-specific color/content assertions
separate from image-difference plumbing.
