# Battlezone (demo)

Activision, 1998, Direct3D (its own `plugin\dx5draw.dll` renderer) tank
action/RTS hybrid. Candidate `battlezone-demo`, app `battlezone_demo`, local only.

## Source and layout

- archive.org `Bzone`, `Bzone.rar` (47,633,321 bytes, sha1
  6a4c384207d3f1030135fb9f84251f477ba761ba). It's a CD-style tree:
  `Setup.exe`/`Splash\`, an InstallShield 5 `Install\` folder, and
  `Install\data\`, which already is the game: `bl_rel.exe`, `bzone.zfs`
  (14 MB archive) plus `bzone.zix` index, `addon\` missions, `bitmap\`
  menu art, `anims\` AVIs, `plugin\dx5draw.dll`, `Input.map`, and its own
  MSVCRT/MSVCP50/STRLKUP/ANET2 DLLs.
- The candidate extracts the RAR to `rar/` and mounts `rar/Bzone/Install` as
  `c:\`, so the game is `c:\data\bl_rel.exe` with `c:\data` as the working
  directory. No installer run needed.
- RAR entries carry the read-only attribute. The fetcher's unar fallback now
  extracts into a fresh staging dir and merges it over the destination: a
  codec-less 7z (Ubuntu's DFSG build, every boat) leaves the entries it can't
  decode as empty read-only files that `unar -f` can't overwrite.
- `bl_rel.exe` imports `Strlkup.dll` and `anet2.dll`. Both are declared in
  the app's `dlls`; undeclared, `StrLookupFind` hits `crash_unimplemented` at
  mission launch.

## Route (headless, `--batch-size=100000`)

- Batch ~80: the "BzoneAd2" ad screen, a GDI `SetDIBitsToDevice` of
  `bitmap\bzonead2.bmp`, repainted every idle pass. It captures black
  headless. A click at 320,240 (batch 280) moves on.
- Main menu (`main.BMP`): Single Player 172,108; Stars and Stripes 120,160;
  mission briefing (Luna, Luna Outpost 3); LAUNCH 550,15. Gameplay is up by
  about batch 1700 (moon base, pilot on foot beside a light tank).
- The browser route is the same, with taps.

## Emulator bug it found: heap fragmentation under 1 MB

Every ad repaint pass allocates 4 KB (file buffer), 1072 bytes (BITMAPINFO,
never freed) and 921,608 bytes (pixels), then frees the 4 KB and the pixels.
Large blocks only got their own arena from 1 MB up, so the 900 KB block went
back on the ordinary free list. The next pass carved the leaked BITMAPINFO
from it, which left it too short for the next 900 KB request. Every pass took
fresh space; about 335 passes in, the heap returned NULL and the main menu
background drew grey. `$HEAP_LARGE` is now the Windows heap's
VirtualMemoryThreshold, 0x7F000 (508 KB). `test-heap-large-block-arena.js`
replays the pattern 1200 times.

## Controls (data\Input.map)

Q forward, S back, W turbo, A/D strafe, keypad 4/6 steer (`RightArrow` in the
map is the keypad key; `GreyRightArrow` etc. move the track camera), F/C
pitch, E jump, left mouse or keypad 0 (`Insert`, distinct from `GreyInsert`)
fires, right mouse or keypad Enter cycles weapons, Space is the reticle
command, Alt the target command, 1-9 the command menus, Esc the main menu.
Verified headless: keypad 4 turns, Q drives, the grey Left arrow does not
steer. The touch layout maps the stick to Q/S/keypad 4/6.

## Browser

The default lazy file policy streamed `addon\misn*.trn`, but those files are
INI text read by `GetPrivateProfileInt` at mission launch, which can't park:
VfsPendingError. `trn` is now in `lib/app-files.js` EAGER_EXTENSIONS.

## Not checked

Ad screen visibility (black headless), audio, the AVIs, multiplayer, the
vehicle and RTS command flow beyond driving, WebKit.
