# Homeworld demo

Relic's 1999 3D space RTS, the downloadable demo ("Homeworld Downloadable
Version", menu shows `Version DLD_05.1`). Registered as `homeworld_demo`.

## Payload and licence

`test/candidate-corpus/manifest.json`, id `homeworld-demo`: archive.org
`HomeworldDemo/HWDemo.exe` (65.7 MB, SHA-1 `27fd4faf...`), a **Wise**
installer (`WiseMain` in its strings; 7z cannot open it). The tree comes from
running that installer in the emulator, `tools/install-homeworld-demo.js`
(fetcher step `installHomeworldDemo`): Welcome, licence, destination
(`C:\Sierra\Homeworld Downloadable`), program group, start -- Next is at
(366,382) on every page at `--batch-size=10000` from about batch 2050, and the
copy is done by about batch 3500. It installs 16 entries, 75 MB:
`homeworld.exe`, `homeworlddl.big`, `dl_music.wxd`, `dl_demo.vce`, the
renderers `rgl.dll` / `rglsw.dll` / `rgld3d.dll` / `3dfx\`, `binkw32.dll`,
`movies\`.

Licence: Sierra's demo EULA (`eula.txt`) -- one copy for personal use, no
copying or reproduction, **no reverse engineering or disassembly**. Kept
`localOnly`; investigate with API traces only.

## Launch: the "insert CD" box is a working-directory problem

`Invalid or missing Homeworld CD. Please insert valid CD.` means the game did
not find `DL_Music.wxd`. It looks in the working directory first
(`FindFirstFileA("DL_Music.wxd")`), then on `D:\`. With `--vfs-tree` the tree
is mounted at `C:\`, so the CLI needs `--exe-guest-path=C:\homeworld.exe
--cwd=C:\`; a cwd of `C:\Sierra\Homeworld Downloadable` reproduces the box.

## Route to gameplay (CLI, `--batch-size=100000`)

| Batch | Action | Screen |
|---|---|---|
| ~1400 | | main menu (Training / Single Player / ...) |
| 1000 | click (320,221) Single Player | fleet picker (Kushan / Taiidan) |
| 1300 | click (554,448) START! | "Training alert" |
| 1600 | click (322,267) START! | mission load screen, progress bar |
| ~4000 | | bar full |
| 4600 | | in-engine intro: the Mothership in its shipyard |
| 4710 | Esc | intro skipped |
| 5600 | | Kharak, the fleet, HUD "MOTHERSHIP" |
| 5700 | click (320,240) | "1 x MOTHERSHIP" selected |

Evidence: `scratch/runs/20261011T1810Z-homeworld-demo-w6` (game6-s4600, game7-*).

## Renderer

The registry has no renderer choice yet, and the game starts on its software
renderer `rglsw.dll` (loaded through `rgl.dll`), 640x480.
