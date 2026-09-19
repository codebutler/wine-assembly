# PNG comparison consolidation — 2026-09-19

Follow-up to the Pass-5 addendum in `fable-review.md`: tests should reuse
`tools/png-diff.js`, but must retain their original comparison metric.

- Default `metric: 'max'` compares the largest absolute channel difference.
- Opt-in `metric: 'sum'` compares the sum of absolute channel differences.
- `includeAlpha: false` selects RGB; otherwise both metrics include alpha.
- A pixel changes only when its distance is strictly greater than tolerance.
- `maxDelta` remains the largest individual channel difference in either mode.
- `totalDelta` sums absolute error across all included channels/pixels in the
  region, independently of tolerance. It is not a count of changed pixels.
- `sizePolicy: 'overlap'` explicitly compares shared coordinates using each
  image's own row stride. Strict mismatch rejection remains the default.
  Overlap results still expose `sizeMismatch`; output and dimension fields
  retain image A's dimensions. Empty compared areas report 0 pixels/share.

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
| Find mouse-click | Summed RGB > 20 in the same button rectangle; mismatched dimensions rejected | 7/7; old/new helper agreement at 470 pixels |
| Bricks drag/sound | Exact RGB in board/icon regions; mismatched dimensions rejected | 21/21; horizontal and vertical drag 1838 pixels each, sound icon 107 and board 0; old/new horizontal count agrees |
| Win16 Minesweeper smiley | Exact RGB in the same grid rectangle; mismatched dimensions rejected | 3/3; play changes 194 pixels, reset differs from fresh by 0 |
| AoE menu | Exact RGB in existing clamped regions; size mismatch remains -1 | Gameplay/menu route 18/18; synthetic old/new region and mismatch checks agree |
| WordPad print preview | Summed RGB > 30 in the same page interior; missing/mismatched input remains 0 | Focused old/new helper checks agree; saved first/next images return 0 with both helpers. Full printing suite fails multiple print-completion/preview assertions; not a pass |
| NetHack map | Exact RGB in the map rectangle; original dimension assertion retained | Playable-tile gameplay test passes; 3827 changed pixels |
| Minesweeper smiley reset | Exact full-frame RGB; mismatch remains -1 | 7/7; loss changes 4440 pixels, reset matches initial exactly |
| Paint dock-toggle | Exact RGB in status-bar rectangle; mismatched dimensions now rejected | Fails preservation assertion at 1298 pixels; old/new helpers agree on identical saved frames, and original test reproduces the same failure in a fresh run |
| Pinball playable | Exact RGB in clipped flipper regions; original size-error object retained | 9/9 gameplay checks; left/right signal 904/927 pixels over 0/0 noise. Old/new results agree for flipper, full/clipped and outside-image regions |
| Pinball combo box | Total RGB error magnitude in each region; absent/mismatched input remains 0 | Unit tests pin channel/alpha/region/tolerance behavior. Nonzero synthetic old/new total is 69; saved workflow frames give identical zero totals. Original and migrated live suites both 12/18, with the same six dropdown/selection failures |
| Spider Show Available Move | Exact RGB over overlapping image extents, y=40..219; missing files remain 0 | 4/4; Deal changes 40748 pixels. Overlap unit tests cover unequal strides/heights, reversed inputs, empty extent, and strict default |

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

### Paint assertion follow-up

The two remaining Paint assertions were investigated, not simply relaxed:

- `dlg-cmd` routes through the WAT modal dialog first and logs
  `cmd=N modal hwnd=0x...`; the old assertion required `cmd=N hwnd=0x...`.
  The corrected assertion explicitly requires the native modal path and a
  nonzero HWND for both Cancel and No.
- PE resource RT_MENU 2 contains 17 File entries, including `S&end...`
  (command 37662) at position 9. Tracing the actual 16-tool workflow records
  guest `RemoveMenu(0x00010002, 9, 0x400)` (MF_BYPOSITION), returning to
  `0x011ceeda`, after a GetProfileIntA call. The resulting File menu contains
  16 entries. The corrected test requires both count 16 and the exact
  surviving command/separator sequence; it does not accept any arbitrary
  shortened menu. This is evidence for this guest/configuration, not a claim
  that every native Paint setup must lack Send.

Fresh serial verification after those corrections: dirty-document **11/11**,
16-tool workflow **22/22**. Runtime behavior and image thresholds are unchanged.

## Remaining work

This does not close the whole PNG-helper item. A broader name/body search
The named Node comparator inventory above is migrated, including Spider's
different-sized-image overlap policy. This is not a proof that every pixel
loop in the repository is redundant or removed: Icewind Dale combines frame
differences with app-specific color metrics, and browser-side comparisons
still need separate consideration.
Pinball combo-box `rectDiff` now uses `totalDelta`, preserving its **total RGB
error magnitude** contract rather than substituting changed-pixel count.
The full-frame/subregion consumers
listed above now use the shared comparator; their small local wrappers only
adapt result shapes or combine named regions.
Some compare masked regions or return different statistics; inspect each
contract before replacing it. Browser-evaluated pixel loops cannot directly
require the Node PNG helper. Keep app-specific color/content assertions
separate from image-difference plumbing.
