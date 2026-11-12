# Daikatana (demo)

Ion Storm / Eidos, 2000, Quake II engine. Fixture:
`test/binaries/win98-games-a-d/Daikatana-demo-OpenGL-SW.exe`, a WinZip SFX
around an InstallShield 5 Disk1 (107 MB).

## Install (works, headless)

`unzip` the SFX; 16-bit IS5 `Setup.exe` with `--vfs-include='*'
--tick-ms-per-batch=5 --capture-launch=cap` -> `_ins5576._mp`; run it from the
capture (frozen `--control`): Next x4, "Confirm New Folder" Yes, Next, step to
"Setup Complete". `C:\Program Files\Eidos Interactive\Daikatana Demo` (456
files, 127 MB) is kept at `Daikatana demo-SW/installed`. Only `ref_gl.dll`
ships (no ref_soft), so the CLI needs `--gl-renderer=software`; the game,
physics, weapons and world DLLs load from `dlls\`.

Registry entry used for the runs (not committed, it is not playable yet):
exe `daikatana.exe`, dlls `[mss32.dll]`, workingDirectory/exeGuestPath under
the install dir, manifest generator entry with that vfsRoot.

## Where it stops

Boots to the main menu (Single Player -> Select Difficulty is already shown,
renders correctly in software GL). Choosing a difficulty, or starting with
`+map e1m1a`, shows the dark-red loading plaque forever. `+set logfile 2`
writes `data/dk_console.log`: sound and renderer init fine, server
initializes, the map loads ("Registration time"), then "Starting Music" is
the last line, also with `+set s_music 0`. The frame loop keeps running
(8 frames of 2D quads + wglSwapBuffers per 200 batches; polls `./kick.dat`),
nothing else is read from pak1.pak. Next: what follows S_StartMusic /
CL begin (spawn handshake over the in-process loopback?) -- break after the
"Starting Music" print and follow the client state.

Status 2026-10-06: parked (claude:d10ba697); TODOS NEW-GAME-DAIKATANA-DEMO-20261006.

## Un-parked: in-world (claude:202b4b39, 2026-10-06)

Two causes, neither in the music code the console log pointed at:

- **The DLL table was 32 slots.** Miles (`mss32.dll`) enumerates and
  `LoadLibrary`s ~30 providers from the install directory (`*.flt`, `*.m3d`,
  `mp3dec.asi`) at sound init, so the game's own `dlls\physics.dll` was the
  33rd and failed ("DLL table capacity 32 exhausted"). Fixed on main 4cf9420e
  (64 slots). Without it, `+map` falls back to the Select Difficulty menu.
- **The headless clock.** At the default 200 ms/batch, registration takes
  ~3495 guest seconds ("Registration time" in `dk_console.log`) and the level
  stays on its loading plaque. `--tick-ms-per-batch=5` reaches the level
  (registration ~107 guest s). The console log simply stops being flushed
  after "Starting Music"; it is not where the game stops.
- Route: `node test/run.js --app=daikatana_demo --gl-renderer=software
  --tick-ms-per-batch=5 --args='+map e1m1a' --max-batches=112000` is in the
  e1m1a swamp by ~95,000 batches; holding VK_UP walks forward and picks up a
  weapon (scratch/runs/20261006T1830Z-daikatana-demo-gameplay).
- `--save-vfs=DIR --save-vfs-suffix=.log` exports `data/dk_console.log`;
  `+set logfile 2` writes it.
- Main is busy in `physics.dll` and in an exe name-list walk (`0x45ed52`,
  a strcmp over a linked list) once in-world: ~20M API calls per 112k
  batches. FPS and the browser are separate.

## "Sys_GetGameAPI without Sys_UnloadingGame" (claude:w4, 2026-10-11)

User report from the dashboard: picking a difficulty showed this error box,
then the game exited. The message is daikatana.exe `0x4781f0`, the PHYSICS.DLL
loader. It keeps the module handle at `[0xa72814]` and the game API at
`[0x9dfc58]`. Unload (`0x470f60` -> `0x478090`) runs only while the API is
set. So the fatal is always the *second* attempt, after one that loaded the
DLL but raised a drop error before storing the API.

That first error was `Game Error: Unable to load dll: ./dlls\world.dll` (in
`dk_console.log`). physics.dll's `GetGameAPI` (`0x1000fa40`) scans
`./dlls\*.dll` and LoadLibrarys world, gce and weapons. world.dll imports
StackWalk/SymInitialize/... from `imagehlp.dll`, and the vendor-DLL rule from
058a8d830 refused it as missing. Fixed in a392fbf6c (Windows system DLLs are
exempt). The menu route now works: Select Difficulty is up by batch ~29000
(`--tick-ms-per-batch=5`), clicking Samurai at 295,350 is in e1m1a by ~99000,
and the browser in Threads mode is in-world too.
Evidence: `scratch/runs/20261011T1030Z-daikatana-getgameapi`.

## Explicit browser WebGL world and movement (2026-10-31)

Run `20261031T0256Z-daikatana-webgl` closes the previously unattested browser
GL-backend detail. The registered original `daikatana_demo` ran in Chrome
151.0.7922.108, cross-origin isolated, Threads enabled, at
`index.html?threads&debug&no-log&gl-renderer=webgl`. A read-only inspection of
the live render worker's endpoint map recorded `api: "gl", backend: "webgl"`
in `backend-endpoints.json`; the generic GPU selector alone was not used as
proof. Chrome used ANGLE SwiftShader, so this is not hardware-GPU evidence.

Native mouse selection of Samurai reached the original swamp world.
Personally inspected `current.png` shows the weapon and health-100 HUD;
`after-forward.png`, following a two-second native ArrowUp hold/release,
shows a changed camera position. This establishes browser world rendering
and movement, not combat, level completion, audio correctness or full parity.
The earlier `webgl-9.png` still showed loading; it is not a gameplay frame.

The actual served module was
`8333a35b1efa694462033e87f62ce4a3f5497941d1423540b39a590c9d31134a`.
Its compiled source identity is unknown; the observed checkout HEAD is not
substituted for it. `verification.json` checks all 458 original input entries
unchanged and all 106 retained host/module snapshots against their hashes.
The browser reported no page exceptions. Browser/controller PIDs were absent,
the server port closed and the owned profile removed after explicit cleanup;
no Boat was used. `driver.cjs`, `native-input.jsonl`, `started.json`,
`snapshots.json` and the content-addressed `served-snapshots/` preserve the
route and loaded bytes. Replay must serve those retained bytes together,
including their region map, while verifying the original manifest entries.

## Native Ion Blaster pickup and firing; route still blocked (2026-10-31)

Bounded continuation `20261031T0318Z-daikatana-combat` reused all 106 retained
host/module snapshots from the preceding browser run and the unchanged 458
original input entries. Both attempts kept a 1024x768 viewport, explicit
WebGL and the default guestWorker. Chrome 151.0.7922.108 used ANGLE SwiftShader;
the live endpoint again reported `api: gl, backend: webgl`. Module `8333a35b...`
above remains **compiled-source unknown**, independent of the recorded HEAD.

The first controller failed when it parsed a partially written command JSON;
its browser exited normally during cleanup. The retry uses atomic command
rename (`command.py`) and reached the original swamp. Inspected
`retry/forward-1.png` shows **"You acquired the Ion Blaster."** after native
ArrowUp held three seconds. Selecting native `2` equipped it with 40 rounds
(`retry/path-forward-2.png`). This is a verified original weapon pickup,
not a map transition or an enemy encounter.

Subsequent inspected turns and movement remained among the starting coffins,
green waterfalls and enclosing rock. Later backward/strafe attempts did not
recover an open route; short turns produced uneven amounts of rotation.
Native repeat did not resolve this. No production input/physics cause was
established. The final native Ctrl attack visibly fired against nearby rock:
`retry/attack-control-final.png` shows a bright impact, ammo 40 -> 39 and
health 100 -> 86; `retry/final-settled.png` retains 39/86. This is consistent
with close-range self-damage, **not verified enemy combat**. No enemy, kill,
exit, map change or level completion was observed.

`RECOVER.md`, both `driver.cjs` files, `commands.jsonl`, trusted native input
records, endpoint captures, verification and cleanup records preserve the
attempt. Next: recover a visually confirmed open route from the pickup,
using short movement/capture checkpoints; do not replay all later turns
blindly or claim an emulator fix from this navigation failure. No assets,
guest state or production source were patched. Both owned browsers,
controllers, profiles and local servers were closed; no test box/Boat was
allocated. See the run's `verification.json` for final checks and timing.

## Basin navigation continuation; viewport observer hazard (2026-10-31)

Run `20261031T0339Z-daikatana-route` reused the atomic command writer and
retry driver with the same 106 retained host/module snapshots and 458
unchanged original inputs. Chrome 151.0.7922.108 again used ANGLE SwiftShader,
explicit WebGL and the default guestWorker. The retained module remains
`8333a35b1efa694462033e87f62ce4a3f5497941d1423540b39a590c9d31134a`,
compiled-source unknown; neither observed checkout HEAD identifies its source.

Inspected `pickup-forward.png` confirms the Ion Blaster pickup, and
`left-away-waterfalls.png` shows 40 rounds and health 100. Backing away,
turning and strafing reached the tree, twin waterfalls and the green drainage
channel beside the raised coffin platform (`ridge-settled.png`). No tunnel
opening or traversable exit was visually confirmed. Turns varied in effect;
the evidence does not establish a production input or physics defect.
No attack was issued, and no enemy combat or map transition was confirmed.
The overhead yellow-searchlight object alone is not combat acceptance.

A diagnostic Puppeteer connection omitted `defaultViewport: null` and reset
the page to 800x600. Subsequent frames showed the app stopped; the cause of
that stop is unknown. This invalidates the attempt's later stable-viewport
evidence. Do not attach that `inspect.cjs` observer during recovery.
The fresh `retry/` used only the original controller and kept every recorded
viewport at 1024x768. It reached the swamp again but did not establish another
pickup or an open route; inspected `retry/final.png` still faces basin rock.

Execution was 03:39:08–03:56:02 UTC. Both attempts passed verification of all
original input hashes and retained snapshots; recorded native events were
trusted with all keys/buttons released. The retry controller session exited
143 after atomic quit without writing its final cleanup record; the signal
cause is unknown. Separate checks verified both controller/browser PIDs
absent, both server ports closed and both profiles removed. No Boat/test box
was allocated. `verification.json`, `RECOVER.md` and `result.json` preserve
the limits and recovery inputs. No production files or original assets were
changed, and no build or emulator repair is claimed. Next: locate and visually
confirm the far-side drainage tunnel from the pickup before further turning.
