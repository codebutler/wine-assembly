# Nox original Windows demo

## Fixture and provenance

The February 2000 original multiplayer demo is preserved at
<https://archive.org/download/NoxDemo/noxdemo.exe>. Archive metadata identifies
Westwood Studios / Electronic Arts. The publisher-hosted [GameStar April 2000
CD index](https://download.gamestar.de/public/32500/32580/04_2000_cd.pdf), page 1,
independently lists `Demos\Nox\Noxdemo.exe` as Nox Multiplayer. This corroborates
the historical filename, not the identity of the Archive copy.

Downloaded on `bx_yqnspudj`, 2026-10-13, without copying the archive to the
space-constrained coordination checkout:

| Artifact | Identity |
| --- | --- |
| `noxdemo.exe` | 46,083,584 bytes |
| MD5 | `1b96a80a11370a449c6515648578c80f` |
| SHA1 | `78c5187fd27d1264e4cce1b053e1c02bfc0b38ca` |
| SHA256 | `ba01f1b43ff1d95f4cd2ab63abe4572e9b26ab22f1b7bd8b99d852fba6607eec` |
| Extracted `nox.exe` | 1,593,344 bytes; SHA256 `496123ad275e5d626f31a845033c7ddb7d86fbbf3c2532d2e1f639f8bc77a781` |
| Extracted `mss32.dll` | 331,776 bytes; SHA256 `d7028f4f8d458b359b8cb8e6bbdf00d2ecc145643e88e9e641be98fae0bada23` |

Remote root: `/home/user/nox-demo-preflight-20261013`. `acquisition.json` records
the final redirect and verified hashes. Native `7z` archive extraction of the
WinZip self-extractor, then `distribution/Install/Game1.CAB`, yields `game/`:
125 original files, 50,450,550 bytes. Every path and size agrees with shipped
`distribution/Setup/FILESIZE.INI`; `game-manifest.json` pins every SHA256.
No native installer was executed and no license dialog was accepted.

Keep the fixture private/local-only. The shipped `Setup/LICENSE.TXT` is
restrictive; historical demo availability does not establish public
redistribution permission. Preserve the entire original distribution.

## Executable and dependency closure

`nox.exe` statically imports `mss32.dll` plus KERNEL32, USER32, GDI32, ADVAPI32,
SHELL32, ole32, WINMM, DDRAW, DINPUT, WSOCK32 and IMM32. The original Miles DLL
imports KERNEL32, USER32 and WINMM. `MP3DEC.ASI` imports KERNEL32 and mss32;
retain it, `mss16.dll` and `mssb16.tsk`. Preserve the original window resources,
`nox.csf`, configuration, audio/video bags and indexes, and maps:
`Bunker`, `Estate`, `FortNox`, `So_Woods`.

The separate original `distribution/Wolapi/` contains WOLAPI.DLL, PATCHW32.DLL
and registration utilities. They were not needed to reach the tested local
Network host route. Peer networking and Westwood Online are untested.

The pinned CLI checkout warned that real shell32.dll/ole32.dll files were not
on disk, but this route did not encounter an ordinal crash. The demo attempts
to open `music\title.wav`, which is absent from its own complete manifest; no
replacement was supplied. Audio quality is unassessed.

## Ordinary route and input

Both runs used original `game/nox.exe`, original `mss32.dll` via `--dll-seed`,
and `--vfs-include=**/*`, with no fabricated registry state or game patches.
Pinned source: `5e012cb3c575373a54a004862b3fb89cdf34766e` in remote
`/home/user/wa-focus-source-work`; module SHA256
`9b3ef6f173daaa8be90733a4b8449733d74ca861062d0383a709f4be02ce1c77`.
Its source tree `77c9daabd16e1c096467385b3cf8efc5672b6780` matches the tested
dialog-focus candidate `33efb438`. No new build or runtime fix was needed.

The inspected route is:

1. Westwood logo, then Nox title and Click to Continue.
2. Multiplay → Network → Host Game.
3. Place the host flag on the world map.
4. Select the available Conjurer; accept the character and default Jack name.
5. Dismiss the Chat Area information dialog. This area is not the arena.
6. The Game panel selects Bunker by default; click GO.
7. Inspect Jack, carpet, green body and blue crystals in the rendered arena.

Menu control needs relative mouse deltas and held presses across guest
execution. An absolute move alone did not reposition the game's pointer.
Do not assume its internal cursor remains at the host's absolute point when
entering flag placement: the game recenters that cursor. The saved control
sequence records the inspected correction.

Shipped `default.cfg` binds right mouse to MoveForward, left mouse to Action,
and Space/middle mouse to Jump. Only right-button movement was qualified here.

## Evidence and qualification

Initial investigation:
`scratch/runs/20261013T2149Z-nox-original-startup/investigation.json`.
It reaches Bunker and shows movement, but its movement commands are the
standard CLI `di-mousedown:2` / `di-mouseup:2` adapter. That run alone does not
establish the ordinary renderer right-button path.

Followthrough:
`scratch/runs/20261013T2203Z-nox-renderer-control/investigation.json`.
All 125 fixture hashes were checked again before launching. After inspecting
the Bunker screenshot, supported control eval called the ordinary handlers:

```js
renderer.handleMouseDown(437, 380, 2);
// Execute 20 guest batches, capture while held.
renderer.handleMouseUp(437, 380, 2);
// Execute 5 batches, capture; execute another 20 idle batches, capture.
```

The caller does not assign host button state, call a device-memory writer, or
modify guest game state. The normal renderer handles those input duties.
Logs show WM_RBUTTONDOWN `0x204` and WM_RBUTTONUP `0x205` delivered to NOX
`0x10001`; focus and main window stay `0x10001`, the mapping is 640×480 at
1:1, and the observed host button mask is `0 → 2 → 0`.

Root reviewed `001-arena-before.png`, `003-right-held.png` and
`005-idle-after-release.png`: Jack moves relative to the carpet and green
body, and camera scrolling exposes the adjacent room. The matching idle
control changes 192 pixels; the held comparison changes 123,557 pixels
(120,142 inside the world viewport). Images and input/state records support
the conclusion; pixel differences alone are not the gameplay criterion.

Release is proven as an input event and cleared button state, **not immediate
motion cessation**. The released and later idle screenshots still differ in
camera/world placement; this run does not distinguish animation, camera
settling or movement inertia. Do not describe the release interval as a
stationary control or infer continuous right-button state from those pixels.

The followthrough exited 0 at `2026-10-13T22:03:55.259Z`; driver 140433,
guest 140457 and process group 140457 were independently absent at
`22:04:06.130Z`. Eighteen remote artifacts were copied and hash-verified.

This qualifies a narrow original-game CLI launch and player-controlled
movement through the ordinary renderer. Registration, registered browser
launch, DOM input/pointer capture, other controls, combat, audio, FPS,
physical devices, real network peers and completion remain separate.
Evidence remains `investigation.json` until a matching candidate is registered.

## Registered CLI verification (2026-10-13 22:10 UTC)

Exact candidate `3540d8304237d6db016d0c4179088306072b8fc3` uses
`--app=nox_demo` with no EXE or DLL override. Native SFX extraction followed
by the registered Game1.CAB preparation reproduced all 125 original game
files with matching SHA-256 hashes and generated the browser file manifest.
The tested source closure matches module
`9b3ef6f173daaa8be90733a4b8449733d74ca861062d0383a709f4be02ce1c77`.

Run `20261013T2210Z-nox-registered` repeats Network/Host/Bunker and normal
renderer right-button hold20/release5/idle20. Root reviewed arena-before and
right-held captures: Jack moves relative to the carpet/body and camera reveals
the corridor. Button mask0/2/0 and WM down/up delivery were observed.
The same post-release settling/inertia limitation above remains. Guest exit0
at22:11:34.223Z; driver146061, guest146111 and guest group were absent at
22:11:54.066Z. This validates registered CLI launch and narrow movement, not
browser/DOM controls, audio, FPS, peer networking or a complete game.
