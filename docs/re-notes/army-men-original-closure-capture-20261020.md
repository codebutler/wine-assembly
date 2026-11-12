# Army Men original closure and actual Boot Camp capture

Historical source last updated, 2026-10-20. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

One execution on `bx_6czhvg6m`, 2026-10-20 12:24:43–12:25:03 UTC. Original asset closure is restored and actual Boot Camp images were captured.
**Paired-scroll acceptance remains blocked:** the existing observer reads five
arguments from API metadata, but its Army adapter requires six. No pixel pairs
were accepted. No second launch or source/renderer/EXE patch was made.

## Complete inventory reconciliation

```text
commdlg.dll d3d8.dll d3drm.dll ddraw.dll dplayx.dll dsound.dll
gdi.exe keyboard.drv krnl386.exe mmsystem.dll opengl32.dll
shell.dll sound.drv user.exe
```

The other 251 missing historical files were staged with their relative paths
intact. This includes original CPU DLLs, source-media/installer remnants,
installed state and historical supporting files. All 419 non-placeholder
files passed hashes before and after execution. No missing original path
remains in this inventory. The initial in-memory transfer archive contains
all 265 absent historical entries; extraction explicitly selects only the
251 non-placeholder paths. No synthetic file was introduced into the VFS. The unchanged runtime's built-in module behavior remains in use.

`cpuinf32.dll` SHA-256 is
`5e7f97ecbb834822a9913124f181c1e82ffbda6a7c13f2deb1f963c09383f31e`;
`cpuinfo.dll` is
`9049c886ec2496e67dcf1c0b10e42a0a44f1ff29f203e7b60e54375c9802602c`. The actual `findVfsDllBytes` helper resolved both system-path bytes and PE
inspection verified their nonzero `wincpuid` and `cpunormspeed` exports. The original five-PE startup dependency graph resolved without missing
dependencies. Renderer construction and PNG encoding passed.

## Actual outcome and new causal blocker

Reused the unchanged paired BltFast observer and prior ordinary input schedule:
Boot Camp click at batch279, Numpad6 down674/up706, screenshots at
200/450/670/713 and exit; 200,000-block batches, 750-batch/90-second bounds,
cooperative `--no-threads` mode. Exact arguments are in `recovered/launch.json`.

Visual review:

- `menu.png`: real Game Start menu with Boot Camp option.
- `bootcamp.png` and `turn-before.png`: identical “Welcome to Bootcamp!”
  overlay above terrain and HUD.
- `turn-after.png` and `final.png`: identical unobscured terrain, soldier,
  instructions sign, fence, rocks, trees and HUD. These are not black/menu
  frames. They establish Boot Camp reached, not general playability.

The adapter retained eight calls at the original return address `0x407506`,
all with raw exit EAX0, but rejected each with `incomplete arguments`. The underlying observer retained 24 records and dropped 663 due to its
existing per-API cap. Its owner is pinned, pending depth0, no observer errors. This is a deterministic metadata mismatch:

- Pinned `src/api_table.json` ID1008 (`IDirectDrawSurface_BltFast`) has nargs5.
- `jig-owning-api-observer.js` reads exactly `meta.nargs` stack arguments and
  expects `4*(nargs+1)` stack cleanup: 24 bytes.
- The Army adapter explicitly requires six arguments before reading surfaces.
- Actual records have five arguments, stack delta28, same entry/exit EIP,
  yieldReason0 and EAX0. The pinned WAT handler also explicitly cleans28.

Thus raw returns and partial arguments exist, but surface dimensions,
pitch/backing metadata and pre/post samples are absent. The observer marks
the records incomplete, so EAX0 is not presented as a validated paired
success. Saved-source analysis identifies the capture blocker; it does not
establish pixel-copy correctness or terrain-stripe causality. No fix or
relaunch was attempted under this bounded assignment.

A second capture limitation is retained: broad BltFast tracing hit the
controller's 8 MiB storage cap. The child emitted138,722,163 bytes, of which
8,361,103 were saved; controller reason is `log cap`, code0/signalnull. SIGTERM did not prevent the later scheduled images and normal exit. Later
input acknowledgements/final runner log are unavailable. Do not treat exit0
as full acceptance. A future authorized capture needs bounded trace output
as well as correct six-argument observer metadata.
