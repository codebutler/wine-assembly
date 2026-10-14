# Hellbender Trial (Terminal Reality / Microsoft, 1996)

App `hellbender_trial` (candidate `hellbender-trial`, localOnly), trial
version 1.02. Registered 0b50d6ea1. `HELLBNDX.EXE` is an MFC app that statically
imports `SMACKW32.DLL` and COMCTL32 and also references DDRAW, `DISPDIB.DLL`
and WinG.

**The licence forbids reverse engineering or disassembly**, so everything
here comes from API traces and runtime behaviour. Keep it that way.

## Licence

README.DOC section A: "Reproduction and/or redistribution of this trial
version is permitted for non-commercial, personal, and testing purposes
only." (Plus the no-reverse-engineering clause.)

## Install layout

archive.org `Hellbender_1020`, `heltrial.zip` (SHA-1 `175117d9…`), holding
`heltrial.exe`, an IExpress package that `7z x` opens. `HELLINST.INF` copies
`HELLBNDX.EXE`, `.HLP`, `SMACKW32.DLL` and `README.DOC` to the install dir and
the PODs, `HELLBNDX.INI`/`.INF` and the three DirectPlay DLLs to
**`<install dir>\System`**. The game reads `.\system\hellbndx.ini` and opens
`system\startupx.pod` / `system\gamex.pod`; in a flat tree it shows
"Insert Hellbender CD into the installation CD-ROM drive." The manifest's
`copyFile` steps rebuild that layout.

`HELLBNDX.INI` ships `useDirect3D=0`, so the registered route is the software
renderer. `[Control]` keys are scan codes (up 72, down 80, left 75, right 77,
fire 57 = space, weapon 33).

## Route (headless, `--batch-size=50000`)

1. Quick Configuration dialog by b100. Click **New Game** (368,302) at b200.
2. A ship-schematic loading screen; its bar is full by about b600, then it
   waits.
3. A key or click (space at 700, click at 800, Enter at 900) starts the first
   mission: a cockpit view down a canyon, with radar and HUD. Holding Left
   (b1100-1250) banks the craft.

Evidence: `scratch/runs/20261011T0715Z-hellbender_trial-gameplay-claude1863`.

## Quick Configuration (2026-10-11, w5)

Evidence: `scratch/runs/20261011T0830Z-hellbender_trial-quickconfig-w5`.

- **Background artwork: fixed.**
  - The dialog is an MFC CDialog. AfxWndProc subclasses it and hands
    WM_PAINT back to DefDlgProc with `CallWindowProcA`.
  - The game draws its 560x420 art in its own WM_ERASEBKGND: one
    `BitBlt` of 554x393 `SRCCOPY`.
  - Our native DefDlgProc WM_PAINT filled COLOR_BTNFACE itself, without
    sending WM_ERASEBKGND to the window's current wndproc, so the top half
    stayed grey.
  - It now sends the erase through the subclass, falling back to the fill
    when the subclass returns 0. Test: `test-dialog-subclass-erase.js`.
- **Magenta button corners: not an emulator bug, as far as runtime evidence
  goes.**
  - Each button is `BitBlt` `SRCCOPY` of 132x40 from a 132x160 8-bit DIB
    section into the WM_DRAWITEM DC.
  - The corner pixels are index 0xCC (204). `--trace-api-mem` shows every
    colour table the game passes to `SetDIBColorTable` keeps entry 204 =
    RGB(255,0,255), as does the `CreatePalette` LOGPALETTE.
  - The game calls no SetWindowRgn, mask blit, TransparentBlt or
    region/clip API on the dialog.
  - It looks the same with `desktopColorDepth: 8`. There the game does take
    its palette-device branch: `ResizePalette(256)` plus `SetPaletteEntries`
    from the system palette, instead of `ResizePalette(0)` on our 32-bpp
    desktop.
  - That 8-bit desktop also drew a worse title bar, so it is not
    registered.
  - The `GetSysColor` calls are MFC's startup colour cache, not a key
    replacement.

## Open
- **Idle repaint flood.** The dialog `InvalidateRect`s hwnd 0x10016 and loops
  on PeekMessage: about 37M API calls over 1500 idle batches.
- Not looked at: the Direct3D renderer (`useDirect3D=1`), DISPDIB / WinG
  use, sound, the browser.
