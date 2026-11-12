# Darkstone demo 1.0

## Software manual combat, October 30

Run `scratch/runs/20261030T2206Z-darkstone-software-combat/` establishes
original skeleton combat on the software backend. It reuses the retained
committed-main `10952264c` runtime compiled at 21:54:53.532 UTC, module
`4649ee5fcf5a10a0212e690d826940bf0ba6445bea678bcac3978c0464bd67c6`
(1,891,324 bytes), independently hashed from the actual HTTP response at
22:03:35.209 UTC. All 15 original installed files match before/after hashes.
Chrome 151.0.7922.108 uses isolated guest Workers and software D3DIM.
No production code, guest memory, exports, saves or input queues were changed.

The original keyboard configuration/readme map `F` to automatic/manual combat.
Native `F` in Town visibly displays **Combat Mode: Manual**; native `I`
shows **LIFE 35/35, MANA 25/25**. The established Town exit and ground clicks
`(.65,.35)`, `(.78,.60)` reach the skeleton clearing. Read-only state before
attack at 22:06:52.082 UTC is **LIFE 32/35, EXP 0**: the enemy has already
damaged CODEX while manual mode remains selected. Native left holds at
`(.64,.48)` for 4.5 seconds and `(.66,.48)` for 20 seconds leave the enemy
alive. After correcting the target to its torso, native left at
`(.625,.46)` from **22:07:42.698 UTC for 18 seconds** defeats it.
Personally inspected `third-settled.png` shows its absence; subsequent
`victory-inventory.png` and `survival-final.png` confirm survival with
**LIFE 17/35, MANA 25/25**, level 1 and an advanced experience bar.
The successful hold is not represented as one instantaneous hit.

`numeric-state.json` records **EXP 0 → 79** and health through the encounter.
The samples only read shared linear memory and locate the live CODEX record;
the original executable's inventory disassembly identifies name at entity
`+0x30` (`0x4b0756`), level at `+0xca` and experience at `+0xcc`
(`0x4b0aba`, feeding the experience bar). In this run the name is at linear
`0x6ec03c`, so experience is at `0x6ec0d8`. These are run-specific observed
addresses, not a production ABI. The visible inventory independently checks
health and the experience-bar increase; it does not print numeric experience.
Unused copies of the character record remain unchanged and are retained in
the raw samples. Enemy numeric HP was not decoded.

Owning main legacy endpoint 1 has advancing native software completed draws,
zero observed fallback software completions and no guest trap in captured
slices. Exact counters, native inputs, times, hashes and personally inspected
screenshots are retained in the run. A read-only inspection connection briefly
resized the page to 800×600; it was restored to 1280×900 before the attack.
The game canvas remains 640×480. Child renderer ownership, audio, FPS,
save/reload and broad rendering parity remain untested. No production blocker
reproduced and no repair was invented. Quit was acknowledged and PAGE CLOSED
logged, but the outer browser harness returned 143, cause unknown; local
process/port cleanup is recorded separately. No Boat or assigned box was used.

## Original skeleton combat, October 30

Run `scratch/runs/20261030T2158Z-darkstone-combat/` personally inspected
combat on committed main `10952264c12cb1d4e2f2a096f59e8b367a1fb82b`, after
alpha repair `328b6631a`. Canonical compilation of committed sources produced
module `4649ee5fcf5a10a0212e690d826940bf0ba6445bea678bcac3978c0464bd67c6`
(1,891,324 bytes); the Chrome HTTP response matches. The frozen archive excludes
other workers' uncommitted changes. All 15 installed original assets match
the served manifest and remain unchanged after the run. No guest memory,
exports, save files or synthetic input queues were modified.

Chrome 151, isolated guest Workers, WebGL, 1280×900 page and 640×480 native
canvas followed the established CODEX warrior creation and Town exit. In
Ardyl, ordinary ground clicks `(.65,.35)` then `(.78,.60)` reach the clearing
with a skeleton beside CODEX. `clearing.png` shows its raised sword;
`combat-before-live.png` already shows automatic melee engagement. A native
left-button hold at `(.64,.48)` for 4,500 ms starts at
21:58:12.086 UTC, logged as trusted DOM input at page `(611,510)`.
`attack-held-after.png` shows white death particles and the skeleton gone;
`attack-settled.png` and `combat-completed.png` confirm its persistent absence.
Native `I` opens the inventory: `inventory-health.png` explicitly reads
**LIFE 32/35**, **MANA 25/25**, with a nonzero experience bar. Initial Town
health looks full, but no initial numeric health or enemy HP was collected.
Automatic combat preceded the explicit attack, so this does not isolate the
click as the sole cause of damage or death. It establishes original combat
during ordinary native input, beyond locomotion. No combat blocker reproduced
and no runtime repair was necessary.

Owning legacy endpoint 1 has advancing WebGL submissions, finishing at
103,283 draws / 1,287,543 consumed calls, zero observed errors/fallbacks and
zero native/fallback software completions; `declinedClears=1` remains explicit.
Software combat, child render ownership, audio, FPS and save/reload were not
tested. Refused perf-telemetry connections remain in the console log. Quit
was acknowledged and PAGE CLOSED logged; the outer browser and server
returned 143, cause unknown. Postflight verifies debugger port 35309 and
private server port 18175 closed, with no own runtime remaining. No Boat was
created or touched. Exact inputs, times, frame hashes, source/module/assets,
recovery recipe and limitations are retained in the run. A useful next step
is manual-mode combat with an initial numeric health baseline, followed by
software-backend combat; this run makes no manual-only attribution claim.

## Package and installation

The local package comes from the Windows 98 A-D archive recorded in
`sources.md`. Its original `Setup.exe` is an InstallShield bootstrap, not the
game executable. `tools/install-darkstone-demo.js` runs that bootstrap inside
Wine-Assembly, captures the `_INS5576._MP` child it emits, and then drives the
guest installer through Welcome, destination selection, program-folder
selection, file copy, and Setup Complete.

The installer must see the package recursively: `dvoices1.mtf` is under the
source `data/` directory. Mounting only top-level files correctly produces
InstallShield move-data error `-113`; the installer tool uses `**/*` and checks
the complete payload instead. The host copies files only after the guest
installer has written them.

Pinned SHA-256 values:

- original `Setup.exe`: `a6d2f8b9173fd43f03aabff0b8cc3fadbd0b15224bcbe5f562a32158a297b502`
- emitted `_INS5576._MP`: `c9d2bee521bc3d8037b164c9468b145646fc556a6969acf83f5556e4b295fc79`
- installed `darkstonedemo.exe`: `b43db5e1b835eb1e93688a1f3f1d9c814517be6fc8110c7fb6e024d467ee721b`
- installed `ddata.mtf`: `0e9f56d01af4738e09dcdd9a7de21ff9e683468259465553e1edb0ebe3a66850`
- installed `dmusic.mtf`: `eec342ef67fb2440cd705eafaf4411eccd67d3aa888db7097aa0f551d39d99e0`
- installed `dvoices1.mtf`: `bd01d2b6dda05b792c22371ab5cba1e36fb316fe0d81401a49fe9169beecee9e`

The resulting `installed/` tree contains 14 files and 33,471,003 bytes before
manifest generation. The app and generated manifest now use only that tree.
Run the authentic installer with:

```bash
node tools/install-darkstone-demo.js
```

## Distribution status

The installed readme calls the package `DARKSTONE Demo 1.0`, describes its
reduced music and voice assets, and lists Windows 95 or 98 as supported. It
does not contain an explicit grant to redistribute the package. The original
installer and its generated playable tree therefore remain local and
gitignored. `sources.md` links the preserved original distribution so it can be
obtained independently; Wine-Assembly does not publish these game files.

## Gameplay route

`test/test-darkstone-gameplay.js` launches the registered app through one
headless CLI process with cooperative scheduling, frozen stdio control, and the
CLI's own `--max-seconds` guard. It skips the logo, selects New Game and One
Player, creates a warrior named `CODEX`, and moves the new champion into the
first party slot. The slot assertion is scoped to the portrait region so a
card merely following the cursor cannot pass.

Demo 1.0 enters Town directly after party confirmation; unlike the retail
manual's route, it does not display a difficulty menu. The test waits through
the forest loading animation. Its live-town check requires the blue mana HUD
that is absent from the loader, then holds the right-arrow key and requires a
substantial pixel change from camera rotation. This is a functional acceptance
test, not a performance benchmark. Screenshots default to the system temporary
directory.

Run explicitly with:

```bash
node test/test-darkstone-gameplay.js
```

### Retained gameplay recovery, October 7

Before assigning a new-game run, a read-only audit recovered all ten existing
captures from `/tmp/wine-assembly-darkstone-gameplay/`, with file mtimes on
October 6 from 06:31:23 to 06:31:46 UTC. They are copied and SHA-256 indexed in
`scratch/runs/20261007-darkstone-retained-gameplay-audit/`. The reviewer
`codex:darkstone-refill-worker` personally inspected `08-town-before-input.png`
and `09-town-after-input.png`: both show Town, the champion and full HUD;
the road, trees and gate rotate substantially between them, consistent with
the ordinary Right camera-input route documented above. This is historical
controlled gameplay, so Darkstone is excluded from a never-qualified new-game
refill. No game was rerun during recovery.

The original invocation, execution start/end, source/module hashes and exact
renderer were not recovered. The result records these as unknown, retains
file mtimes separately and timestamps the recovery itself. It does not
qualify the current module or establish gameplay FPS. The later October 6
browser results only reached the main menu and do not replace this evidence.

## `--stuck-after` kills the asset load, and it looks like an emulator bug

### Fresh browser menu checkpoint, October 15

Run `20261015-darkstone-software-menu` captured and reviewed the ordinary main
menu on an explicitly older admitted source snapshot: controller commit
`eb5a9559fbb4209823cd0473e5dc5bb6c4d7b3bb`, production-equivalent to the
verified IW `6c22121e` build, canonical module
`04ede400070b3acbdcc2ad5f3c033bcf051e3d2da9a4d28a449324d23ab0ba17`.
This does not test the later GetParent/main changes.

The owning page's actual `wine._wasmModule` object hashes to that module
(1,803,941 bytes), independently matching the served HTTP and disk bytes.
All 15 installed fixture paths matched locally and over HTTP before launch
and remained unchanged afterward. Chrome 151.0.7922.108 ran headless with
SwiftShader enabled, isolated guest Workers and the software backend request.

At 16:35:22.622 and 16:35:25.031 UTC the completed main-Worker slice sequence
advanced 4691 → 4804 and replay commands advanced 774343 → 821142, with zero
reported fallbacks and zero GL triangles. These are replay/presentation
counters, **not software raster-draw consumption evidence**. Backend remains
unknown. A child Worker also exists, and the collector does not attest its
render ownership. The console retains missing `ole32.dll`/`comctl32.dll`
built-in fallback messages; no crash was reported.

The reviewed screenshot shows New Game, Load a Game, Configuration, Credits
and Exit Game. Console resize is **640×480**: do not blindly reuse the older
800×600 route coordinates. Before another click, capture the live canvas
dimensions and map the visible menu target. No menu click, party creation,
Town arrival, control, combat, audio or FPS was tested in this checkpoint.

The outer controller `247615` finished normally at 16:35:25.152 UTC.
Independent postflight at 16:35:49.700 verified no active runtime processes,
unchanged source/dependency/browser/fixture inventories and preserved
937/a948/04ede/0dbf/e26a modules. Earlier staging-only attempts stopped before
the browser on an absent sparse-checkout app document and an inaccessible
unrelated Chrome extensions directory. No permissions were changed; the
successful preflight records sparse omissions and pins regular Chrome files.

Recovery bundle in the shared checkout:
`scratch/runs/20261015-darkstone-software-menu/evidence.tar.gz`, 1,532,791 bytes,
SHA-256 `984d1aa01ce7720bf8ee3f54e39618e0c52c97f039df9f11c86e584ea697d3f4`.
The screenshot is `darkstone-menu-evidence-3/capture/menu.png` inside it,
478,739 bytes, SHA-256
`7bc3eb8915e4f09dbf609f717e41fa075b51eb262c50700e7fc7355d12fbf8b5`.
The archive contains the exact executed outer controller, invocation,
pre/post inventories, fixture hashes, console and slice logs. Extract into the
same run directory to recover the relative paths. Darkstone has no candidate
entry in the current candidate-corpus manifest, so this remains investigation
evidence rather than assigning another application's dashboard candidate ID.
See `docs/darkstone-backend-checkpoint-20261015.md` for the staged recipe.

Driving this app by hand with a plain `test/run.js` command line ends at
**batch 1183** with no error line, no crash dump and no unimplemented API —
the process simply stops. That is not the guest. It is `run.js`'s own
`--stuck-after`, which defaults to **10** (`test/run.js:773`): after ten
batches that retire no new EIP the harness decides the run is wedged and ends
it.

The loop it trips on is legitimate. `0x004e7b2b` is the demo's asset-load
loop reading `ddata.mtf`, and a load that reads 33 MB out of one archive
spends a long time in one tight block by design. Nothing is wrong, so there
is no diagnostic to find; the run just disappears.

The fix is one flag:

```
--stuck-after=1000000
```

With it the demo runs straight through the logo, New Game, One Player,
warrior creation and the forest loading animation into **Town**, with the
full HUD — portrait, health and mana orbs, potion belt and minimap — on a
champion standing on the forest road. Verified on the remote bench box under
`--d3d9-renderer=software --d3d9-programmable`.

Reach for this reading whenever a bounded run of *any* asset-heavy app ends
early and silently: the absence of an error is the tell, because every real
failure path in the emulator prints something.

## The host's per-object GetTickCount loop and the clock-spin detector (2026-10-10)

After "Create a session", the host's main thread stamps every object with
GetTickCount and makes no other API call in between, with only 5-8 blocks
between reads (w4). The clock-spin detector took that for a busy-wait and
parked once per object, leaving the host on the white Session menu for minutes.
a7e5f4f75 makes a read count only when the callee-saved registers match the
previous read in that context, so a per-object loop no longer qualifies.
Host-only A/B, same build (run `20261010T1720Z-clock-spin-regs-check-boat`):
`--spin-regs-check=15` gives 0 parks and Town as HOST; `=0` gives 1213 parks
and the frozen Session menu. The two-seat test no longer needs
`--no-spin-park` for this.

## Multiplayer over the virtual LAN (2026-10-10, w4)

`test/test-darkstone-vlan-gameplay.js` (heavy, boat) plays two seats to the
Town together. Menu route (800x600 coordinates): New Game (400,260) ->
Multiplayer (400,374) -> create a champion as in single player -> OK
(425,570) -> Available Services: TCP/IP (400,374) -> Session: Create a
session (400,324) / Join a session (400,424). Join asks "Enter IP address, or
Name of Host": click the field (400,372), type with keydown + di-keydown +
**keypress** per character ('.' is VK 190; the champion-name field works
without keypress, this one does not), OK (400,420), then **double-click** the
session in the list (400,330); a single click only highlights it.

DirectPlay: `CoCreateInstance` of an `IDirectPlayLobby2` (only for
`GetConnectionSettings`, i.e. "not lobbied") and of `IDirectPlay3`, used as
`IDirectPlay4` when available (flag `[0x52aa64]`). The game's wrapper object
lives at `0x8a9f00`: `+0x6704` is-host, `+0x6708` "session lost, stop
sending", `+0x670c` own DPID, `+0x6710/+0x6714` the player event and a quit
event, `+0x6718` the receive thread, `+0x6720` joined/in-world, `+0x6724`
CreatePlayer succeeded, `+0x673c/+0x6744` received message count/bytes.
Thread `0x40bb70` waits on the two events and runs the receive loop
`0x40c010` (`Receive(DPRECEIVE_ALL)`; sender 0 -> system handler `0x40cee0`,
else app handler `0x40d390`, a jump table on the first byte, types
0x65-0x7f at `0x40d878`). Every send goes through `0x40cb60` (size per type
from the table at `0x40ce68`), which calls `GetMessageQueue(SEND)` and then
`SendEx` with **GUARANTEED|ASYNC|NOSENDCOMPLETEMSG (0x601)**; it treats only
`DPERR_CONNECTIONLOST` (0x88770168, logs "SESSIONLOST", sets `+0x6708`) and
`DPERR_BUSY` (retry x5) specially. Before 47aafe16e our SendEx refused ASYNC
and nothing ever left either seat.

Join protocol: the guest, inside its `EnumPlayers` callback, resets the event
at `[0x647ee0]`, sends type 0x6c (8 bytes) and waits `WaitForSingleObject(10 s)`
up to three times at `0x416e4b` (timing out tears the session down via
`0x40bf10`). The host's 0x6c handler `0x40d980` either pings 0x7f every second
(host not yet in the world, `+0x6720` clear) or, normally, announces a block
transfer with 0x6d (16 B: block count, size; guest handler `0x411850`) and
sends the world in 0x6f blocks (536 B, guest handler `0x411940`, "receiving
%d/%d..."), each acked by the guest with 0x6e (12 B). After the last block the
guest sends 0x7e and `0x40e1a0` sets `+0x6720` and signals `[0x647ee0]`. The
demo's town took 5 blocks. Headless this is slow but correct: run.js pumps a
seat that is not blocked on the wire only every 64 batches, one block round
trip per pump, so the test waits 800 batches after joining.

## 2026-10-15 fresh paired backend evidence

October 17 retained-image review: the later software ground-click run exited
0 and shows the first WebGL destination at a closely matching gate/tree/feet
pose. WebGL has a substantially larger lower-left black triangle; software
still has a smaller wedge and foreground obstruction. Backend disagreement
is established, but neither correctness nor the responsible draw/state is.
See the retained same-pose comparison in
[`darkstone-backend-checkpoint-20261015.md`](../darkstone-backend-checkpoint-20261015.md)
for PNG hashes, consumption counters, cleanup receipts and the proposed
single-frame draw-input diagnostic. No renderer change or new run accompanied
this review.

The original installed demo reached Town through ordinary character creation on both software and WebGL using a fresh normal build at source `fadaff08a` (module SHA256 `9b57583c1ca8887f7195a268c94312ca6352eb646f4071c740c5a75aff1eb69e`). Actual before/idle/held-ArrowRight PNGs establish camera control in both arms. Owning main endpoint 1 has advancing completed native software draw calls in software and advancing actual WebGL submissions in WebGL. Observed WebGL error/fallback counters are zero, but `declinedClears=1` remains explicit. Child renderer ownership, locomotion/combat/audio/FPS and original-27 membership are not qualified. See `docs/darkstone-backend-checkpoint-20261015.md` for exact landmark counters, independent cleanup and the full recovered archive SHA256 `25252b50372c11589f30439d0a13ab39b09576b5844c1855721c26a429c2aa8f`. Earlier c7e/04ede screenshot-only evidence remains backend-unknown.

2026-10-15 locomotion follow-up: the no-rebuild WebGL capture on paired module 9b57583c showed two ordinary left-click road targets changing character position relative to Town gate/tree landmarks, with a following camera and stable intervening idle. No camera key was used. Main endpoint draws advanced with zero observed errors/fallback sites/direct or fallback software completions; declinedClears remained 1. The session later hit its input-queue deadline (exit 1), so the additional final-idle screenshot is absent; both independent cleanup/preservation checks passed. Full qualified result and archive SHA56acbc258d810f764e91edcc0644e45816d4ebd668f53b8f7174e1c6f2476087 are in `docs/darkstone-backend-checkpoint-20261015.md`. This is movement evidence, not an overall successful terminal run, FPS/audio/combat qualification, or original-27 membership.

## Fresh registered Chrome Town/camera run, October 30

Run `scratch/runs/20261030T2058Z-darkstone-browser/` uses the retained installed
EXE `b43db5e1…` and the complete registered `darkstone_demo` manifest, without
an installer or any change to the missing-Setup test guard. Pinned browser
source is main `ba96fc3ad84edee6c899762c596e8b1bf2bb2195`; all tracked pinned
sources match that commit (25 unrelated untracked tools are separately listed).
An in-memory private localhost server holds source/module/assets fixed during
both arms. HTTP response bodies identify module
`6085eff52c9be987f67d83563602a0ea89e0c4bac9c36f9cf11171bd3adada4e`
(1,883,551 bytes); WebGL's built-in compile identity independently matches it.
No WAT fallback occurred. The exact runtime archive, source inventory and all
15 fixture HTTP/local hashes are retained. Chrome 151.0.7922.108 runs headless,
1280×900, isolated guest Workers, native game canvas 640×480.

Personally inspected menu, creation, party, Town-before, idle and held-Right
captures on software and WebGL show the original CODEX warrior, Town label,
blue mana HUD and rotating gate/tree/road landmarks. The five-second idle
control changes only 160 software / 110 WebGL world pixels above channel delta
20; camera input changes 446,306 / 419,279 of 515,372 world pixels. This is
camera response, not locomotion or combat. The initial foreground palisade
obscures much of the view; no general rendering-correctness claim follows.

At Town before/idle/after, owning legacy endpoint 1 reports software completed
native draws 726155→831005→859360 (slice seq 31868→37906→40499), zero fallbacks.
WebGL actual submissions (`draws`) advance 30638→41656→45232 and consumed
calls (`drawCalls`) 395419→488046→517185 (seq 25448→33252→35657), zero errors,
zero fallbacks, zero direct/fallback software completions. `declinedClears=1`
remains explicit. Actual WebGL renderer reports ANGLE Intel/Mesa UHD620,
despite the probe requesting SwiftShader flags; this does not qualify physical
hardware. Child render ownership is not attested by the collector.

Use inspected geometry, not old 800×600 coordinates: normalized visible-canvas
New Game (.5,.455), One Player (.5,.54), Create (.18,.68), name (.55,.82),
Create/OK (.53,.95), party slot (.66,.375). One Player needed a second ordinary
click in each arm, after the first screenshot still showed the mode menu.
Exact input commands and landmark timestamps are retained. Both explicit quit
commands were acknowledged and logged PAGE CLOSED; both outer processes
returned 143 during teardown, cause unknown. Do not describe that as a clean
terminal exit. Postflight verifies no owned Chrome or private server remains.
No Boat was created or touched, no public deployment, no Telegram. The bounded
Town/camera/backend route passes; audio, FPS, save/reload, child ownership,
combat, locomotion and full-game correctness remain untested. Recovery recipe
and portable investigation `result.json` are in the run directory.

## Native locomotion and Town exit, October 30

Run `scratch/runs/20261030T2110Z-darkstone-locomotion/` replays the archived
`ba96fc3ad…` runtime directly from `pinned-runtime.tar.gz` in a private
localhost server's memory. All 1,292 served files match the preceding run;
both Chrome HTTP module hashes are `6085eff5…`, with the original installed
EXE `b43db5e1…` and all 15 fixture paths unchanged. This is a retained-build
run, not a test of later main. No installer, guard, runtime source, guest
memory or game export was modified. Chrome 151, isolated Workers, 640×480
game canvas and 1280×900 page reproduce the CODEX warrior/party/Town route.

The installed readme's section IV assigns movement to the left mouse button;
left/right arrows rotate the camera. No camera arrows were used here. After
personally reviewing Town before/idle, an ordinary unmodified left click on
the visible road at normalized `(.45,.36)` in WebGL produced a turning/running
pose, the **Land of Ardyl** loader, then the Land of Ardyl world/HUD. The
software arm's nearby road click `(.43,.44)` independently crossed the same
exit. Thus these road points are near the Town boundary, not suitable for a
small within-Town displacement control. Do not mistake the loader for a
settled world or reuse these points as camera-only evidence.

Ardyl initially has substantial terrain occlusion in both arms. In software,
ground click `(.65,.35)` moved out from behind that terrain into a clearing:
the subsequent captures show CODEX running, then standing beside a birch.
A second reviewed bare-ground click `(.78,.60)` shows him running across the
clearing, with the following camera translating fixed tree landmarks. In
`software/ardyl-move-idle.png`, the birch base is about 90 page pixels right of
the character's feet; in `software/clearing-settled.png` it is about 160 pixels
left. The birch remains at the latter location in `clearing-idle.png` while a
skeleton approaches CODEX. These are approximate image-space observations,
not decoded guest world coordinates. Actual movement and scene transition
are established; combat correctness, audio, FPS and save/reload are not.

Input evidence retains trusted DOM left-button presses, measured canvas
geometry, renderer routing and the host's actual consumed `WM_LBUTTONDOWN`
(`0x201`, wParam 1) / `WM_LBUTTONUP` (`0x202`, wParam 0) for guest hwnd
`0x10001`. The observational `onInputTrace` callback changes no routing.
Owning main legacy endpoint 1 advances throughout: software native completed
draws at Town before/idle are 460775/507742, after the exit 594423/639937,
and across the final clearing early/settled/idle 842430/879323/912682.
Software fallbacks remain zero. WebGL actual submissions at Town before/idle
are 22930/23778 and at Ardyl arrival/idle 41919/43014; consumed draw calls
advance 287249/294337 → 457109/467261, with zero observed errors/fallbacks
and zero direct/fallback software completions. `declinedClears=1` remains
explicit. Child rendering is unsampled; no general rendering-parity claim.

Software acknowledged quit, logged PAGE CLOSED and exited **0**. WebGL's
outer probe exited **143** before acknowledging the queued quit (cause
unknown); its exact remaining private Chrome PID was identified by the
unique profile and terminated. Postflight verifies both owned profiles have
no running Chrome, the private server is stopped and port 18164 is closed.
No Boat was created or touched, so no box lifecycle handoff applies. Evidence,
commands, exact hashes, input logs, renderer samples and an archive-backed
recovery recipe are retained in the run. No runtime defect blocked control
and no code repair was needed. Next useful work is terrain/foreground
occlusion diagnosis using captured draw inputs, rather than changing input
or repeating camera qualification.

### 2026-10-30 owning foreground alpha diagnosis and repair

Evidence: `scratch/runs/20261030T2124Z-darkstone-occlusion/`. Retained
baseline is still module `6085eff5…`, source `ba96fc3a…`, original installed
15-file fixture. `baseline-equivalence.json` verifies all 1292 frozen served
paths against the retained browser archive. This is deliberately distinct
from the repaired main runtime below.

The apparent terrain wedge is foreground geometry, but its **opacity has a
renderer defect**. In `ardyl-default-draws.json`, the submitted tree atlases
`d3dim17913`/`d3dim17920` cover native pixel `(320,300)`. Road depth is
`0.027448246`; foreground draws 3311/3348/3350 have depths about
`0.009261`/`0.008689`. All have positive RHW, enabled LEQUAL depth testing,
no depth write, SRCALPHA/INVSRCALPHA blending, and diffuse alpha **64**.
The tree atlas and the game’s F10 overhead view identify legitimate canopy;
removing it analytically reveals road. Neither depth ordering nor the atlas
alone justifies its former full opacity. The GPU descriptor selects opaque
texture alpha (255), discarding the vertex fade. A bounded owning software
trace independently records the original surface as RGB565 (format1,
16bpp, type2) with legacy render state21 modes2/4. Full raw input bytes,
texture copies, screen-point analysis and inspected frames are retained.
The earlier `ardyl-draws.json` filename actually refers to a Town building;
use `ardyl-default-draws.json` for the Ardyl causal sample.

Legacy D3DTBLEND_MODULATE selects diffuse alpha for a texture without alpha;
MODULATEALPHA multiplies texture and diffuse alpha. This agrees with
[Wine’s legacy device implementation](https://github.com/wine-mirror/wine/blob/master/dlls/ddraw/device.c)
(`fixup_texture_alpha_op` and `TEXTUREMAPBLEND` translation). Merely decoding
RGB565 to RGBA does not give the original texture an alpha channel.
Main repair `328b6631a42bbb50267478f391a4e6b7f3ebcd11` tracks the active
legacy blend mode separately from raw TSS queries, resolves original format
at draw time, and shares lowering between native software and GPU descriptor
paths. An explicit stage-zero combiner setting overrides legacy mode;
other-stage/filter changes preserve it. Other legacy blend modes and unknown
format behavior retain their existing fallback.

Focused native combiner/descriptor controls pass for RGB565/XRGB1555/XRGB8888,
alpha-bearing formats, MODULATEALPHA, raw Device3/7 queries and explicit
TSS overrides. Disabling the lowering rejects the observed no-alpha case
(`2 !== 3`). Existing software/GPU wrapping checks and the required locked
full build pass. Evidence logs retain exact commands and outcomes.

The repaired original-game retest uses committed-main source `328b6631a…`,
compiled at **21:43:26Z** to module
`4649ee5fcf5a10a0212e690d826940bf0ba6445bea678bcac3978c0464bd67c6`
(1,891,324 bytes). The dedicated compile reads committed source, excluding
another worker’s concurrent CRT WIP. `repaired/pinned-runtime.tar.gz` and
its source/dependency manifest freeze the runtime; actual HTTP module hashes
match in both Chrome151 arms. No input or asset repair was applied.

Personally inspected `repaired/town-live.png` shows the original palisade
fading and exposes CODEX/road, where baseline `town-idle.png` was opaque.
`repaired/ardyl-live.png` and `ardyl-fixed-draw-capture.png` similarly reveal
CODEX through the original canopy. The owning GPU capture includes **58**
alpha64 submissions using alphaOp4, replacing opaque alpha selection.
A separate bounded observational replay tap in the repaired software owner
records **100** alpha64 commands with original RGB565/16bpp and
RS21=4/active legacy=4 (`repaired-software/alpha-original-format.json`).
This tap skips non-TL records and records its exclusions; it changes no render
result and is not a complete frame trace. The standard repaired format trace
stopped on an unsupported legacy call with zero rows; that limitation is
retained, rather than represented as successful raw capture.

Both arms repeat native original movement from Town into Ardyl, then a
reviewed bare-ground click `(.65,.35)` moves CODEX across the clearing.
Inspected before/running/final frames show translating tree landmarks and
standing beside the birch (WebGL **21:48:32Z**, software **21:50:47Z**).
`move-idle.png` in WebGL still depicts running; use `move-final.png` for
standing. The loader screenshot is not counted as the settled world.
Software `town-idle.png`, `ardyl-before-move.png` and `move-final.png`
independently show the repaired fade and displacement. This is the requested
post-repair gameplay check; prior movement remains established.

Main endpoint1 renderer counters advance with zero observed fallbacks;
WebGL samples have zero errors and zero direct/fallback software completions,
while software native completed draws advance. Child rendering is unsampled.
No native Windows reference, all-scene rendering parity, audio, performance,
combat or save/reload qualification is implied. WebGL acknowledged quit and
PAGE CLOSED+281.7s, but the outer harness returned143 (cause unknown).
Exact counters, times, limitations, cleanup and software exit are recorded in
the run’s result/README. No Boat or parent lifecycle was touched.
