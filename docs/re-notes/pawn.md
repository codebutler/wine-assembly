# Pawn 3

A chess program. `--app=pawn`, exe `binaries/wep32-community/Pawn/Pawn.exe`.
Renders its board through Direct3D 9 and reads the mouse through DirectInput 7.

## Running it

```bash
node test/run.js --app=pawn --no-build --headless-gl --screen=1024x768 \
  --max-batches=9000 --max-seconds=90 --quiet-api --no-close --png=/tmp/pawn.png
```

`--headless-gl` is not optional: plain headless has no GPU window, so
`CreateDevice` fails with "D3D9 requires a GPU window" and the guest traps
shortly afterwards at `0x0041c100`.

The window is 350,100 and the board is its 352x352 client area, so a square is
44px and the centre of (file, rank) is screen `(350 + 44*file + 22, 123 +
44*rank + 22)`. **It moves on a drag, not on two clicks** — a press and release
at the same point selects nothing, which is why the first two attempts at
driving a move registered API calls and changed no pixels. A move needs
`mousemove` to the from-square, `mousedown`, one or two `mousemove` steps
toward the to-square, then `mouseup`.

Pawn outlines the engine's own last move in yellow on both squares. Those
pixels exist only after a legal move *and* a reply, so counting them is a
one-predicate check that the whole round trip works;
`test/test-pawn-directinput7-gameplay.js` uses exactly that.

## "This program requires DirectX 9 or later!"

This message is a lie, and it cost a session to work that out. It is not the
D3D9 check talking.

The D3D9 probe is three `GetAdapterModeCount` calls whose results are summed
(EAX=3, ESI=3, EDI=3, sum 9) and it **passes** — we have had D3D9 since the
`09ad`/`09ae` work, and `$handle_LoadLibraryA`'s fall-through returns
`$image_base` for any `.dll` not in `$STATIC_SYS_DLL_NAMES`, so Pawn's dynamic
`LoadLibrary("d3d9.dll")` succeeds and `GetProcAddress` resolves by name
through the API hash table. Static import tables show nothing here; the load is
dynamic.

What actually failed was DirectInput. `IID_IDirectInputDevice7A`
(`57D7C6BC-2356-11D3-8E9D-00C04F6844AE`) is the **only** device IID in the
binary, so there is no fallback path to take when `CreateDeviceEx` refuses it —
Pawn puts up its one catch-all message and quits. Fixed in 81f71c7c by giving
devices a real v7 face: the 27 v2 slots plus `EnumEffectsInFile` and
`WriteEffectToFile`, both returning `DIERR_UNSUPPORTED`, which is the truth for
a keyboard and a mouse.

Aliasing v2 under the v7 IID would have been wrong rather than merely
incomplete: slots 27/28 would land on whatever interface's thunks follow ours
in `$DX_VTBL_REGISTRY`.

## The board that was only ever in the surface

Pawn does not draw its board onto a window DC at all. It calls
`IDirect3DSurface9::GetDC` on the D3D9 **back buffer**, draws 64 `StretchBlt`s
plus the coordinate text into that, `ReleaseDC`s and `Present`s. So a
`--png` capture, which prefers a DX surface over the composited desktop, showed
a perfect chessboard for a long time while the window's client area was empty
grey. `--png-canvas` (or `--dump-backcanvas`) is the honest oracle here, and
`test/test-pawn-directinput7-gameplay.js` now uses it.

The reason the frame never arrived is that **the device window is a child**:

```
CreateWindowExA(class="STATIC", WS_CHILD|WS_VISIBLE, 0,0, 1024x768, parent=0x10002) = 0x10003
CreateDevice(hFocusWindow=0x10003, Windowed=TRUE)
```

so a screen-sized child sits inside a 352x353 client, and the presentation
target is that child. Two separate paths then dropped the frame — Pawn takes
the first one in the browser and under `--headless-gl`:

1. **GPU present (`lib/d3d9-host.js`, opcode `0x30002`).** It parks the
   presented canvas on the window record as `_dxFrameLayer`. `repaint()` and
   `composeCanonicalScreenToMemory()` composite a *child's* canvas and layer
   only when `_usesOwnWindowSurface(child)` holds, and that wants
   `_canonicalOwnSurface`, which only `attachWindowSurface` ever set. Nothing
   ever drew the layer. Fixed by marking a child device window as owning its
   surface at the present.
2. **CPU present (`$dx_present`, `src/09a8-handlers-directx.wat`).** Its
   windowed branch passes the client's **screen** origin as the blit **source**
   origin, which is right for a windowed DirectDraw primary (display-sized,
   Blt'd in screen coordinates through the clipper) and wrong for a D3D9 back
   buffer, which starts at the client's top-left. Pawn's board at (0,0) was
   sampled from (354,142) — black. `$d3d9_present_client_relative` (in
   `09ad`) now says which of the two a present is, and a child target always
   takes the blit path, since attaching a surface to a child is invisible.

## Status

Playable. Drags a pawn two ranks, the engine replies, and the board is now in
the window rather than only in the surface.
