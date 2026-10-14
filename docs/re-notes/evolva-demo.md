# Evolva (demo)

Computer Artworks / Interplay, 2000, Direct3D 7 squad action (four
"Genohunters", third person). Candidate `evolva-demo`, app `evolva_demo`,
local only.

## Source and layout

- archive.org `Evolva_1020`, `evolvademo.zip` (31,649,248 bytes, sha1
  40e5cbc407348c8357d97d3e872f1af43fe93276). archive.org sometimes answers
  with a 170-byte nginx 500 page; the fetcher's sha1 check catches it.
- The zip holds `evolvademo.exe`, an InstallShield 5 self-extractor. 7z opens
  it to `Disk1\data1.cab`. The candidate extracts five file groups with
  `unshield` (or `tools/is5-extract.js`) and merges them into
  `installed/evolva` (guest `c:\evolva`):
  - Resources (Animations, DMLevels, Informs, Level, Music, Sounds, Textures)
  - Program Executable Files (`Evolva.exe`)
  - Program DLLS (`4xm_sdk.dll`, the FMV codec, declared in `dlls`)
  - Language DLL (English) (`EvolvaLang.dll`)
  - Registering DLLs (`ImageLoader.dll`)
- `ImageLoader.dll` is the "Media Loader" COM server. When `CoCreateInstance`
  fails, Evolva calls `LoadLibrary("C:\evolva\ImageLoader.dll")` and
  `DllRegisterServer`, then activates it again through the registry. Without
  the file it stops on "A file required by Evolva ... (ImageLoader.dll)".
- The installer writes
  `HKLM\Software\Computer Artworks\Evolva Demo\1.0` (InstallDir, ResourceDir,
  SaveDir, DNADir, ScreenShotDir). The game reads one search path per asset
  class (TextureDir, SoundDir, MusicDir, LevelDir, AnimationDir, InformDir,
  DMLevelDir, SceneDir, BackdropDir, FMVDir). `startupRegistry` seeds all of
  them. The game then calls `SearchPathA("C:\evolva;c:\evolva\Textures", ...)`.

## Emulator bugs it found (all fixed)

1. `CoCreateInstance(CLSID_DirectInput)` was unknown, and
   `IDirectInput::Initialize` popped 20 bytes for its 3 arguments. That
   corrupted the caller's EBX/ESI/EDI, so the next CreateDevice got a NULL out
   pointer. Fixed in c9b5904a4.
2. D3D7 `EnumDevices` left `D3DDEVICEDESC7.deviceGUID` zero, so the game threw
   "D3DMgr: Could not set up preferred device". Fixed in f44edf4e7.
3. `SearchPathA` treated a semicolon-separated `lpPath` as one directory. No
   texture, font, sound or movie was found, and every frame was white.
4. Vertices without a specular colour got specular 0. That covers D3D-lit
   D3DVERTEX, and LVERTEX/TLVERTEX FVFs without `D3DFVF_SPECULAR`. The
   specular alpha is the vertex fog factor, so with FOGENABLE on (Evolva sets
   no fog mode) the whole 3D world drew as the fog colour, 0xff788c78. They
   now get 0xFF000000 (black, no fog).

## Route (headless, `--batch-size=100000`)

The game cursor is DirectInput relative motion. Absolute clicks don't move it;
use `relmousemove`. The cursor starts at the screen centre.

- About batch 200: the main menu (New Game 137,143; Options 480,377).
- `300:relmousemove:-183:-97:10`, then click: team select (four animated
  Genohunters). Confirm checkmark at about 560,435
  (`1200:relmousemove:423:292:12`, click at 1250).
- About batch 1600: Mission Briefing "Land 4" (rotating planet). Click the
  same checkmark again (batch 2400).
- The level loads for about 13,000 batches (white screen). By batch 16,500:
  gameplay, a Genohunter in the jungle with four squad views and radar.
- Options > Configure Controls has the authoritative chart: W/S
  (Cursor Up/Down) forwards/backwards, A/D (Cursor Left/Right) strafe, Left
  Ctrl Walk, Left mouse Fire, Left Shift Beam Up, Right mouse Jump, 1-0 and
  NumPad 1-0 weapons, mouse wheel next/previous weapon.

## Not checked

Movement and fire in the mission (only reaching it), the browser and touch
layout in a running mission (the load is long), audio, the 4XM FMVs (the
Intro FMV option is off), multiplayer.
