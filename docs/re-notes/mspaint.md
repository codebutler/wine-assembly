# Paint: dock-collapse geometry (2026-09-19)

Binary: `test/binaries/mspaint.exe`, using its registered CLI companion DLLs.
Repro: `node test/test-mspaint-dock-toggle.js`. Command 59416 toggles the
Color Box. Screenshots land in `scratch/mspaint-dock-toggle/`.

## Confirmed cause and fix

The Color Box dock (`AfxControlBar42`, HWND 0x10006 in this run) shrinks from
267x49 to 267x0 when hidden. Its window geometry was updated, but
`$defwndproc_do_nccalcsize` returned early for **zero** width or height.
Consequently its recorded client height remained 49 at the new y=393,
overlapping the still-visible status bar (HWND 0x10004, y=393, height=23).

Accepting zero extents in that calculation fixes the stale client rectangle.
Negative outer extents are still rejected. No app/class special case, forced
status repaint, paint-order bypass, or pixel-threshold change was added.
This follows the documented role of
[NCCALCSIZE](https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-nccalcsize_params):
derive the new client rectangle from the resized window rectangle. This is
not a claim of independently measured Win98 behavior for every degenerate
bordered-window case.

Evidence:

- Before: the dock-toggle test failed with 1,298 changed status pixels.
  Allowing 100 additional batches after each toggle did not resolve it.
- A focused regression first failed: resizing a borderless 267x49 window to
  267x0 still returned client dimensions 267x49. It now passes collapse on
  either/both axes and restoration.
- After rebuilding: the unchanged Paint dock-toggle test passes, with **0/0**
  changed status pixels for hidden/restored states.
- Full build, region/client regression, parent-child paint ordering, and
  WINDOWPOS mutation tests pass. Paint draw passes 9/9 and tools passes 22/22.
- Inspection of the hidden screenshot confirms the status text and borders
  are present, but also shows residual palette pixels near y=375 and missing
  scrollbar/layout repaint. Those remain open; this is not a whole-frame pass.

## Useful tracing / remaining investigation

`--trace-ctrl` plus
`--trace-api=SetWindowPos,InvalidateRect,BeginPaint,EndPaint,PeekMessageA`
and `BATCH:dump-windows:LABEL` distinguish geometry from repaint scheduling.
Before the fix, the native status drain repeatedly reported
`skip:ancestor-pending`; removing that guard was **not** necessary to restore
the status pixels. Do not infer from that trace alone that the guard is wrong.

Next: trace invalidation/non-client repaint of the canvas scrollbar and the
old palette footprint on dock collapse, then add assertions for those regions.

## Shared geometry cleanup: NOREDRAW (follow-up)

While tracing the repaint path, `$ctrl_geom_sync` proved to ignore
`SWP_NOREDRAW`: it immediately erased the old parent rectangle for a moved or
shrunk native control, then invalidated the parent and siblings. This is a
separate shared-path bug, not a confirmed cause of the custom Paint palette
artifacts. The cleanup now returns **after** committing geometry when the
flag is set. Both SetWindowPos and MoveWindow(FALSE) use this path.

[Microsoft's SetWindowPos contract](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowpos)
explicitly includes uncovered parent areas in the redraw suppression.
The regression in `test-movewindow-child-size.js` checks both APIs, a
shrink-only move, and an ordinary redraw-enabled move that must still queue
parent/sibling paints. With the current test and the HEAD version of the
control helper compiled in memory, it fails; the patched helper passes.
WINDOWPOS mutation and parent-first paint tests also pass. Full build and
Paint dock-toggle (0/0) / drawing (9/9) remain green. Palette remnants and
scrollbar repaint remain open.
