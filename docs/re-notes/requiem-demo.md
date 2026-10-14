# Requiem: Avenging Angel (demo)

Cyclone Studios / 3DO, 1999, Direct3D first-person shooter. Candidate
`requiem-demo`, app `requiem_demo`, local only.

## Source and layout

- archive.org `RequiemAvengingAngel`, `reqdemo.exe` (33,610,789 bytes, sha1
  c39e826665850f038fa8dec8961cb0a5b3eb9653), an InstallShield 5
  self-extractor. 7z opens it to `data1.hdr` plus `data1..data5.cab`, one file
  group, "Critical Files" (659 files).
- `unshield` 1.5 fails two files that span volumes, `Art\HW\ReqArt3D.art`
  (4.3 MB, the hardware art) and `maps\demopp3.jam`, and exits 1.
  `tools/is5-extract.js` joins the volumes and extracts all 659. The fetcher
  now falls back to is5-extract when unshield fails, not only when unshield is
  missing.
- The tree is copied to `installed/requiem` (guest `c:\requiem`).
  `Requiem.exe` is a launcher: it reads the "current hardware configuration"
  from the registry (written by `Config.exe`) and starts `ReqDemo_D3D.exe`,
  `ReqDemo_3Dfx.exe` or `ReqDemo_SW.exe`. The app runs `ReqDemo_D3D.exe`
  directly. No registry and no config needed.
- Miles (`mss32.dll`) and `Atl.dll` sit beside it.

## Route (headless, `--batch-size=100000`)

- About batch 200: the title screen (3DO legal text). It idles in a
  `PeekMessage`/`timeGetTime`/`IsLost` loop, about 40k API calls per batch;
  that is the wait, not a hang.
- Click 320,240: main menu (single Player 430,102; options; info; quit).
- single Player: Load Game / New Game (New Game about 300,345), with a
  difficulty drop-down (Purgatory).
- New Game: a scrolling text briefing. Once the text has scrolled off it
  shows a grid of "P" glyphs and waits. Click 320,240 to start the level.
  Don't press Enter: in this game Enter opens the console, which swallows the
  keys.
- About batch 2600: gameplay in the sewer (combat shotgun, 60 shells).
- Verified headless: Up walks forward (into the water, health falls), Left
  turns, Left Ctrl fires (shells 60 -> 57 per shot, 27 after a hold).

## Controls (Readme.txt default keymap)

Arrows forward/back and rotate, S/F sidestep, Space jump, C crouch, Left Ctrl
or left mouse fire, right mouse bound power, Tab talk/activate, W/Q cycle
weapons, 1-7 weapons, A angelic powers menu, F1 journal, F5/F6 quick
save/load, Enter console, Esc menu. The touch layout uses these keys; menus
take ordinary taps.

Browser 844x390: taps reach gameplay, the dpad walks forward (a tutorial hint
fires), Fire shoots (shells 60 -> 54).

## Not checked

Audio (Miles), the 3Dfx and software renderers, mouse look, angelic powers.
