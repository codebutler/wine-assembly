# Little Fighter 2 v1.9

Local-only app ids `little_fighter_2` and `little_fighter_2_installer`.
The pinned original installer is
`test/binaries/candidates/little-fighter-2-installer/lf2_v19.exe`; a prepared
browser payload lives below that directory at `installed/` and remains
gitignored.

## Provenance and license boundary

- Package: Little Fighter 2 v1.9, dated 27 September 2002.
- Installer SHA-256:
  `1e4e93510fc47ac636c918cdde97c645e02bcac611ec9d3181f4ecaf9733b819`.
- Installed `lf2.exe` SHA-256:
  `41ee2d29f41eb8e6975d14b42922fe40481d40c6b11eb7a2c6b239fbc578f251`.
- The [official introduction](https://www.lf2.net/en/intro.html) calls LF2 a
  freeware Windows game, and the [official FAQ](https://www.lf2.net/faq_en.html)
  says its authors intended people to play it free of charge.
- The installed readme says copyright 1999-2002 Marti Wong and Starsky Wong,
  **All rights reserved**. Neither that readme nor the official pages inspected
  grant redistribution rights. Freeware is a price classification, not an
  open-source or redistribution license.

Therefore the package is allowed as a local compatibility fixture under the
project's freeware/shareware/demo policy, but neither installer nor installed
assets are public deployment inputs. Revisit this only with an explicit grant
from the rights holders.

The installed readme explicitly requires Windows 95/98, DirectX 6, at least
800x600, and 16-bit colour, making this exact build a valid Win98 target.

## Native installer path

The unchanged installer completes in `test/run.js`. Its rendered wizard path
is:

1. `Install Program - Welcome`: click `(490,469)`.
2. `Install Program - Directory`: accept the default directory at `(490,469)`.
3. `Install Program - Confirmation`: click `(490,469)`.
4. Wait for `Install Program - End`, whose body reports that v1.9 was
   successfully installed.

At `--batch-size=10000` the end page appears around batch 5068. Use
`wait-title-dump-stop` there: leaving the completed installer alive used to
make the harness wait until its outer timeout even though installation had
already succeeded. `test/test-little-fighter-2-candidate.js` now stops on the
end page, exports the VFS, validates the executable/readme/background, and
checks the exact installed executable hash.

Set `PREPARE_LF2_DEBUG_WEB=1` while running that test to copy the installed
game into the ignored `installed/` directory and write its
`.wine-assembly-browser.json` file. The preparation step then applies the same
reduced `data/data.txt` compatibility profile described below; all referenced
executables, sprites, sounds, objects, and backgrounds remain byte-for-byte
installer output.

## DirectDraw failure and fix

LF2 creates a 794x548 backbuffer and blits it to a 640x480 primary surface at
destination `(23,43)`. The equal-size `IDirectDrawSurface::Blt` path previously
treated this as an unchecked memcpy. It wrote beyond the destination DIB and
corrupted adjacent WASM memory.

Commit `0af6a0cf` clips source and destination rectangles as a paired operation
against both surface bounds. `test/test-directdraw-blt-clipping.js` covers
negative origins and an oversized positive destination. With that fix LF2's
title, menus, sprites, HUD, and arena compose normally.

The stock object index loads 134 live sprite surfaces and exhausts the current
63 MiB DirectDraw DIB arena. The gameplay regression and selectable local app
use every file produced by the original installer but replace `data/data.txt`
with an index containing three stock fighters, their projectile dependencies,
common weapon objects, and the stock Hong Kong background. This separates
gameplay compatibility from the independent DirectDraw-capacity limit. It is a
playable compatibility profile, not a claim that the complete stock roster
fits yet.

## Deterministic gameplay route

Run the candidate gate with the CLI build already present:

```bash
node test/test-little-fighter-2-candidate.js
```

The game phase uses `--control-stdin --frozen --max-seconds=600`. It issues
short stepped bursts and sleeps briefly between them, so the process blocks on
stdin with zero emulator work between bursts instead of monopolizing a core.
The verified route is:

1. Move to `(400,313)` before clicking the title. LF2 samples hover state, so a
   bare click without the preceding mouse move is ignored.
2. Select VS mode with P3 Enter.
3. Join/select P3 with Enter and P2 with `S`.
4. Choose one CPU player, select its random fighter/team, move the overlay
   highlight up twice to **Fight**, and confirm.
5. Hold P3 Right and Attack in the arena.

The two final 800x600 captures must each exceed 1,000 colours and 400,000
nonblack pixels, and movement/attack must change at least 50,000 pixels. They
are written to `build/little-fighter-2-candidate/gameplay-a.png` and
`gameplay-b.png`; the installer completion frame is retained beside them.

## Isolated movement and a qualified frame counter (2026-10-10)

`test/test-little-fighter-2-candidate.js`'s frozen route, replayed as
`--input` at the same batches (800x600, 100,000-block batches, default tick),
has the VS fight running by batch 1130. Holding only Right for player 3
(batches 1131-1161, no attack) runs fighter 3 from x~310 past the CPU fighter
to x~710 with the arena scrolling, so movement is shown without combat
confounding it. Evidence: `scratch/runs/20261010T0530Z-lf2-control-frames`.

**Frame counter.** Over batches 1131-1431 `--present-distinct` counted 988
presents on slot 1, exactly the 988 `IDirectDrawSurface_Blt` calls to the
primary (`0x08011008`) from one site (return `0x4394bd`). LF2 composes each
frame on a back buffer (`0x08011018`) with tens of thousands of sprite/tile
Blts (`0x439bc3`, `0x439d5b`, `0x439e83`, `0x439d27`, and one per frame from
`0x40133d`) and presents it with that one Blt; no Lock/Unlock, Flip or palette
calls. 974 of 988 presents change the picture, ~3.3 frames per 100,000-block
batch (~30k guest blocks per frame).

## Esc, the black bands, and fullscreen (2026-10-11, user report 17)

**Esc quits, as on Windows.** The readme's function-key list ends `ESC: Quit`.
The wndproc's WM_KEYDOWN path compares wParam with `0x1b` at `0x4389c9`, in
every game state, and posts WM_CLOSE to its own window (`0x4389dd`). The window
is then destroyed and `0x43888d` calls PostQuitMessage, and the process exits
with code 0. F4 restarts a fight; there is no "back to menu" key.

**The black bands are drawn by the game.** The stage is drawn by its `bg.dat`
layers. LF2 .dat files are encoded: skip 123 bytes, then subtract the key
`odBearBecauseHeIsVeryGoodSiuHungIsAGo`. In the stock background
`bg/sys/hkc/bg.dat` (HK_Coliseum, the Hollywood Plaza skyline), the first layer
starts at y=128, right under the 4x2 player HUD. The last ground strip is
`y: 472 height: 42` and ends at y=514. Nothing covers rows 514-549 of the
794x550 view, so they stay black, and so does the strip between the HUD
panels and the skyline.

**Fullscreen is Alt+Enter, and ours is broken.** The game is windowed by
default (DDSCL_NORMAL, an 800x575 bordered window). WM_SYSKEYUP with VK_RETURN
(`0x438a10`) is the toggle, enabled by the initialised global `[0x446858]=1`.
It flips `[0x44e200]`, destroys the window, and creates an 800x600 WS_POPUP.
It then calls `SetCooperativeLevel(..., DDSCL_EXCLUSIVE|DDSCL_FULLSCREEN)` and
`SetDisplayMode(794, 550, 8)`, with the width and height from the globals at
`0x446850/54`. The emulator accepts that mode, and the menu renders as
striped garbage (`scratch/runs/20261011T0905Z-lf2-esc-fullscreen-w6/after-altenter.png`).
The game draws for a 16-bit screen into what is now an 8-bit mode. A 794x550
mode does not exist on real hardware, so a Win98 driver would most likely
refuse it.

**Alt+Enter cannot work, on Windows either (2026-10-11, claude:1863).** The
teardown `0x401a40` releases the primary `[0x44a210]`, the back buffer
`[0x44a854]` and the DirectDraw object `[0x449e48]`, and nothing else. The ~20
sprite surfaces made at startup (CreateSurface, ret `0x439a00`) belong to that
released object, and the game keeps blitting from them. DirectDraw frees a
released object's surfaces, and a mode change loses every surface anyway. LF2
never restores them, and no CreateSurface follows the toggle. Both
outcomes are now measured on the CLI (`scratch/runs/20261011T1120Z-little_fighter_2-altenter-claude1863`):

- **Mode accepted (before the fix):** the menu bitmaps are stripes, and a
  second Alt+Enter returns to the bordered window with the menu still gone
  (only the logo strokes and the GDI credits remain).
- **Mode refused:** `SetDisplayMode` now returns DDERR_INVALIDMODE for a width
  that is not a multiple of 8, as a VGA-family driver does. `0x401000` returns
  the HRESULT and `0x438f60` prints "DDStartup failed." and returns 0. That
  happens before `0x401090` creates the primary and back buffer. The toggle's
  `jge` at `0x438a60` takes 0 as success, so "Reinitialization failed." is
  never printed. It shows the popup, and the next present calls through NULL
  (`[eip-zero]`, prev EIP `0x401310`). That is LF2's own crash on a refusing
  driver.

The readme's key list does not mention Alt+Enter. Use the page's own
fullscreen (the "Use browser fullscreen" button on the bar above the game),
which scales the windowed game.
