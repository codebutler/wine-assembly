# Alien Shooter (Reflexive)

Local fixture: `test/binaries/candidates/reflexive-alien-shooter/game/AlienShooter.exe`.
The complete companion assets are required (`--vfs-include='**/*'`). Original
installer/provenance and SHA-256 are recorded in `reflexive.md` and the local
candidate manifest. No guest executable or asset patches were made.

## Stable-geometry recovery interrupted before world entry (2026-10-31)

Runs `20261031T0305Z-alien-stable` and `20261031T0312Z-alien-stable-retry`
reuse the retained `573e235d…` module with the matching 141-path frozen host.
Both launch and attached input helpers use `defaultViewport:null`; the page
stays 1024×768 and inspected game input bounds stay `684×544@(10,186)`.
No timed route replay is attempted. Original graphics OK, New Game, Campaign
and Continue reach Mission01 loading, but the first run never displays terrain.
Captures from 03:07:01Z through 03:10:37Z still show LOADING. Native Escape
and a one-second ArrowUp hold have inspected before/after captures with no
visible transition; final inspected host input mask is zero with no held keys.
Frames and ticks advance, and read-only EIP samples fall in the documented
sprite writer (`0x41730c`/`0x417322`); these observations do not prove a hang
or a causal emulator defect.

The first browser disappears during the next capture, before its 15-minute
controller timer. A fresh retry adds browser-process exit observation and
records **SIGKILL at 03:12:44.355Z**, immediately after the native graphics OK
click and before route movement. Its disconnect follows 25 ms later. The signal
sender is unknown. A subsequent cgroup read reports cumulative `oom_kill=4`,
but no pre-run counter or accessible kernel log exists to attribute either
termination to OOM. A post-termination screenshot is unavailable because the
page has closed. The earlier inspected loading/input pairs and retry setup
capture are retained. Inner-yard recovery, usable-door contact and enemies
remain unverified; the demonstrated immediate blocker is runtime interruption.

Original 432 input pins, the loaded module, frozen host and served snapshots
verify. This is retained-runtime evidence, not current-main acceptance. Both
controllers exit zero after explicit quit; both browsers, their six ports and
private profiles are absent, and the owned messageboard watcher is closed.
No source fix, guest edit, cheat, synthetic asset, Boat or test box was used
(box ID/state/expiry N/A). Next identify the browser SIGKILL sender, then retry
the same stable geometry with short inspected movement checkpoints. Recovery
commands, action logs, hashes and cleanup checks are in both run directories.

## Doorway approach blocked by courtyard replay drift (2026-10-31)

Run `20261031T0252Z-alien-door` does not reach building entry or a live enemy.
The prior courtyard capture was inspected, but the timed native replay diverges:
its firing capture places the soldier outside the fence facing grass rather
than reproducing the crate-destruction checkpoint. The replay tool returns 143
with unknown signal source before its final right-button release. A trusted
native CDP release clears the held button before further movement.

The separate Puppeteer mouse helper attaches with its default viewport, changing
page layout to 800×600 while the controller retains its 1024×768 viewport setting.
Observed input bounds are `460×336@(10,226)`; explicitly restoring the viewport
produces `684×544@(10,186)`. A run-local helper preserves the viewport and records
geometry around short 500–1,500 ms native right-button moves. Inspected captures
then show the soldier outside the front fence and the metal building door inside.
Door-directed moves remain on the outside: the fence is the immediate access
blocker. Door contact, opening, an interior transition and combat remain
unverified; HP is 110 and score 0. No causal emulator defect is established.
This timed replay must not be treated as a recovered inner-yard checkpoint.

All 432 original pins, 1,149 source pins against `2606d617…`, 141 retained frozen
host paths, 576 served responses and loaded module `573e235d…` verify. All 132
recorded input events are trusted, with 55 releases and no final held keys or
buttons. Final runtime state is running WebGL with no bridge error. Explicit
quit leaves the owned browser/controller absent, three ports closed and private
profile removed. Controller/replay tool statuses are 143 with unknown signal
source; normal controller exit is not claimed. No Boat/test box was assigned
(ID/state/expiry N/A). No source fix, guest patch, cheat or synthetic asset was
used. Evidence and replay recovery remain under the run directory. Next recover
the inner-yard scene using stable geometry and capture checkpoints before
attempting door contact.

## Browser Mission 01 destructible obstacles (2026-10-31)

Follow-up `20261031T0232Z-alien-entry` reproduces original crate destruction
and extends the inspected route to the inner yard beside the building, but
does **not** verify a live enemy or interior transition. `gap-crate-fire.png`
shows wooden fragments; `gap-cross-native.png` places the soldier beside the
barrels on the yard side, and `courtyard-entry.png` shows traversal away from
the fence beside a building with a closed door. Subsequent native right-button
and arrow approaches do not establish contact with, opening of, or passage
through that door. The final inspected view returns to the locked front gate;
HP remains 110 and score 0. The concrete remaining blocker is locating and
reliably approaching the usable building access from this yard. A prone body
outside the container fence is not qualified as a live enemy. No causal
emulator defect, enemy damage, kill or mission completion is established.

The first launch encountered the explicit region-layout mismatch because the
shared checkout's generated map had changed. After closing it, the replay
serves 141 exact host/resource snapshots copied from the preceding run, along
with the retained `573e235d…` module and unchanged originals. These snapshots
are isolated under this run's `frozen-host/`; no shared source was edited.
All 432 original input pins, the original EXE, 1,149 source pins against
`2606d61735906c02ed66024b5925757a07ea73e0`, 718 served responses and the loaded
module verify. Host hashes and each original response remain in the run.
This is a retained-runtime replay, not current-main build acceptance.

Read-only geometry captures show the input canvas initially at `(10,186)`
with `684×544` CSS pixels, later `(10,226)` with `460×336` CSS pixels over a
`657×480` backing canvas. The larger composited game image is not a safe
absolute-input coordinate reference. At the smaller geometry, native pointer
`(333,317)` reports guest mouse `(452,130)` and produces the positive crate
destruction. Native right holds include a 500 ms pointer-settling delay.
All 123 recorded input events are trusted, with paired releases and no final
held keys/buttons. The running WebGL bridge reports no error at final state;
presentation/input lag limits precise wall-time-to-position claims.

Both owned browsers, six ports and the private profile are independently
confirmed closed/absent after explicit quits. Initial controller exit is 0;
replay controller status is 143 after quit, signal source unknown. No Boat or
test box was assigned (ID/state/expiry N/A). Recovery, frozen host mapping,
original/module/host hashes and paired screenshots remain in the new run.
No guest patches, cheats, synthetic assets, source fixes or build were used.

Run `20261031T0215Z-alien-combat` reuses the original installation and the
retained browser driver/module from `20261031T0136Z-alien-shooter-browser`.
All 432 prior manifest/companion-file pins match; the separately verified EXE is
SHA-256 `aae2547ccec2e235344bc9cf6e5e9ef4c9923b13c9e8fbd1fe14c65b64252446`.
Loaded WASM is `573e235db16e351668289f49e2f279ff48bcad56e7ca533167cb94cd6f4ec3fc`;
all 1,149 retained source-manifest entries match Git commit
`2606d61735906c02ed66024b5925757a07ea73e0`. Actual concurrent browser host
responses are separately retained and hashed, without claiming whole-host
equality to that build. Chrome 151 uses the owning WebGL device through ANGLE
SwiftShader, with guest threads off.

Native setup, New Game, Campaign and Continue reach Mission 01. Arrow/WASD
movement explores the locked gate and fence perimeter to containers, barrels
and a red route arrow. `crate-target.png` shows a clear muzzle flash and impact;
`native-escape-control.png` then shows the orange crate breaking into wooden
debris. `barrel-final.png` and `destruction-settled.png` show the neighboring
barrels/crates gone and persistent debris. The final native right-button movement
in `bend-approach-final.png` places the soldier beside that debris on the yard
side of the front fence. These establish browser firing, destructible-object
interaction and local traversal beyond the previous movement/aim-only result.
No live enemy, enemy damage, kill, score gain or mission completion is verified;
health remains 110 and score 0.

The driver records trusted down/up pairs. A small retained helper adds ordinary
Puppeteer right-button holds, matching the original readme's movement control.
Read-only DOM inspection finds the input canvas at `(10,226)`, size `460×336`,
while the composited game image is larger; several early absolute aim attempts
therefore do not establish accurate targeting. Later muzzle/impact/destruction
captures are the positive evidence. Presentation slows late in the run, but
the runtime continues, reports no bridge error, and the final host input state
has no held buttons or physical keys. No causal emulator defect is established.
No guest patch, cheat, synthetic asset, source edit or new build was used.

Explicit quit records browser/server closure; independent checks find the owned
browser absent, all three ports closed and its private profile removed. The
controller tool reports status 143 after quit, with unknown signal source;
normal controller exit is not claimed. No Boat/test box was assigned (ID, state
and expiry N/A). Recovery, original pins, trusted controls, paired inspected
captures and verification remain in the run directory. Next: replay the native
destruction route, continue from the yard toward the complex and inspect the
first enemy encounter.

## Pinned browser Mission 01 movement (2026-10-31)

Run `20261031T0136Z-alien-shooter-browser` launches the original registered
`alien_shooter` with 432 verified input files. Chrome 151 with ANGLE SwiftShader
uses the owning D3D **WebGL** bridge/device, with guest threads off. It loads
module SHA-256 `573e235db16e351668289f49e2f279ff48bcad56e7ca533167cb94cd6f4ec3fc`
retained from build `2606d6173`; the 1,149-entry build source manifest and exact
browser response snapshots are separate. This does not certify that every
concurrent host source equals that build.

Inspected captures show the original setup, title/Main Menu, Select Player,
LOADING and Mission 01's outdoor grass/path scene. Native Enter, New Game and
held Campaign input traverse the menus. The intervening black captures later
advance to loading and the level; they do not establish a hang. A one-second
native ArrowRight hold visibly moves the soldier right. Native mouse aiming
changes the weapon direction, and held left-button input is recorded; enemy
damage, combat, a muzzle flash and mission completion are not established.
The inspected level frames retain HP 110.

All input pins and served-response snapshots pass SHA verification. The final
state has no recorded runtime error and still uses the WebGL device. Explicit
quit closes the controller with exit zero; browser PID absence, all three closed
ports and removed private profile are independently checked. No Boat was used.
The run retains trusted input, inspected captures, build/backend identity,
recovery instructions and artifact hashes. No executable, asset or emulator
source changed. Audio, physical GPU performance and full playability remain open.

## Pinned native startup capture (2026-10-31)

Run `20261031T0119Z-alien-shooter-native-start` uses module SHA-256
`f2911e1fcfc094d3c6d998bbdb071bdd800ede18cd0082a5eed53de15cf08bb9`
with 432 hashed local input files. The module is exact; a complete matching
concurrent source snapshot is unverified. This is a new native software-renderer
startup observation, not a replay of the historical browser gameplay below.

The original renderer setup accepts the native click at `(333,214)` and creates
the 640×480 AlienShooter window. A 45-second run and a 55-second live-control run
without continuous presentation produced inspected black captures despite
continued batches and software D3D requests. A separate bounded run with
`--live-present` displayed the original LOADING screen and then the SIGMA TEAM
splash; all three finite runs exited with code zero. This capture-mode
contrast does not establish a guest rendering regression or its cause.
Native Enter down/up reached the focused game window; no menu/gameplay response
is qualified. Keep `--tick-ms-per-batch=5 --batch-size=200000` and record both
wall time and guest batch progress when extending the original startup test.
Exact commands, snapshots, captures, input hashes and cleanup checks are retained
in the run directory; no guest assets or emulator source were changed.

Run `20261031T0126Z-alien-shooter-menu-gameplay` extends that same pinned
module and original input set with continuous software presentation. Inspected
captures show the original title, Main Menu, Select Player and Mission 01
equipment screens. Native Enter at batch 6098 skips the title; moving then
clicking New Game `(98,296)` at batch 6230 and Campaign `(320,334)` at batch
6570 advances through those menus. Continue `(535,445)` was delivered at batch
7598, but the last inspected frame at batch 7649 still shows equipment during
its transition. Mission rendering, movement and combat remain unqualified on
this module. The launcher tool ended with status 143 before recording a runtime
exit code or final PNG; the runtime PID was subsequently absent and its control
port closed. The signal source is unknown, so this is not a normal-exit claim.

Run `20261031T0128Z-alien-shooter-mission-native` reaches original Mission 01
on the same exact module and unchanged inputs. The finite 240-second native
software run uses `--live-present`, five guest milliseconds per batch and
200,000 blocks per batch. Scheduled early clicks overlapped menu transitions;
screen-guided native retries reach Select Player, Campaign and equipment.
Continue at batch 8285 then loads the original outdoor level, inspected at
batch 10065 with health 110. Right-arrow down/up at batches 10197–10380 moves
the player; pointer motion to `(500,250)` followed by native left-button
down/up at 10555–10779 turns the player and produces an inspected muzzle flash.
This verifies this route's level rendering, movement, aiming and firing;
enemy damage, kills, mission completion, audio, browser behavior and performance
remain unqualified. No guest executable, assets or emulator source changed.
The runtime logged its finite 240.010-second completion and wrote a final PNG,
but the launcher tool ended with status 143 before recording a runtime exit
code; the signal source is unknown. Its PID was absent and control port closed.
After the later Escape probe, the final frame retains terrain and HUD icons
but lacks the earlier player and HUD numbers; pause or normal exit is not
qualified by that frame. All 432 original input hashes still match.

## DirectSound8 startup (2026-09-29)

Startup originally stopped at `DSOUND.DLL#11`, IAT `0x47a01c`, caller
`0x41cb65`. This is **DirectSoundCreate8**, not a capture function; see Wine's
[export specification](https://github.com/wine-mirror/wine/blob/master/dlls/dsound/dsound.spec)
and Microsoft's [factory contract](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee416762(v=vs.85)).

Commit `17a29c31` adds the named factory and ordinal, an IDirectSound8 vtable
with the inherited eleven methods and VerifyCertification, full IID matching,
initialized speaker state, default playback GUID aliases, aggregation/device
errors, and an explicit uncertified software-device result. The initial APIs
3756–3757 became 3886–3887 when the concurrent Glide branch was merged.
The vtable registry also requires capacity 0x124 bytes and a regenerated region
map. `test-directsound-ordinals.js` covers the factory, errors, ordinal, vtable
slots, versioned QI/refcounts, certification state, and stdcall cleanup.

## Native GPU probe and later corruption

Pinned isolated artifact from this investigation: `build/alien.wasm` (initial
DS8), then `build/alien-final.wasm` (final factory validation and registry size).

```sh
node test/run.js \
  --exe=test/binaries/candidates/reflexive-alien-shooter/game/AlienShooter.exe \
  '--vfs-include=**/*' --no-build --wasm=build/alien-final.wasm \
  --headless-gl --no-close --quiet-api --input=50:dlg-click:1,500:keypress:13 \
  --max-batches=30000 --batch-size=200000 --max-seconds=150 \
  --png=/private/tmp/alien-long.png
```

The initial DS8 GPU probe renders the SIGMA TEAM splash. A longer run reaches
a guest NULL call near batch 2597. `--no-uop` reproduces it. This is a later
graphics/locking failure, not evidence against the ordinal fix.

`--watch=0x43ff20 --watch-log` identifies actual executable-memory overwrite:
the RLE sprite writer at `0x417384` stores ARGB pixels into code. Watch stops
at `0x417392`, previous EIP `0x417322`, destination EAX `0x43ff23`, row base
EDI `0x43fac7`. The original first dword `0x5314ec83` becomes `0x53ffa5ae`,
then `0x08ffa5ae`. Static `0x43ff20` is a shared object tick method reached
through vtable `0x47a90c`, slot 2, from caller `0x4056b6`.

The destination comes from a cached locked surface pointer:

* At `0x416805`, the guest calls surface vtable slot 9 (LockRect), with output
  at `[ebp-0x3c]`, NULL rectangle, and flags zero.
* It continues even if the HRESULT is negative. `0x416832` caches output
  pBits `[ebp-0x38]` into the game singleton's `+0x23c`; pitch/4 is cached at
  `+0x248`. The singleton is pointed to by `0x4b2d54`.
* The blitter derives its row destination from this cached pointer and pitch.
* Native runs print `Color update failed` from `gpu-backend.js` during color
  uploads before the corrupting draw. Failed backbuffer unlocks retain lock
  ownership for a retry, so a subsequent LockRect can legitimately fail.

Logs: `/private/tmp/alien-{long,no-uop,watch,lock}.log`.
The watch log includes original code/heap dumps at batch 2580 and the exact
writer at batches 2607–2608. Native GPU startup also warns about two GL
contexts; this can include the capability probe and is not by itself proof
of the color-upload error's cause.

## Software backend diagnostic

Replace `--headless-gl` with `--d3d9-renderer=software`. The first 528 observed
LockRects return success, pitch 2560, pBits `0x501a2000`; use
`--trace-at=0x416808 --trace-at-mem=ebp-0x3c:8` to inspect the actual return.
An EAX `0x8876086c` printed while parked **inside** the API thunk is only the
handler's initial value while an asynchronous operation is pending, and must
not be reported as the call's returned HRESULT.

A 6000-batch software run remained active without the native NULL fault but
captured a black canvas.

## Root cause and corrected rendering

The renderer split one guest device into two host devices. D3D8 CreateDevice
creates the primary D3D9 object and changes its vtable to Device8. The internal
`d3d9_backbuffer_owner` requested a Device9 interface wrapper for that same
object, which allocated an auxiliary COM pointer. GPU descriptor IDs use the
device pointer: Present therefore addressed the primary renderer while
LockRect/UnlockRect addressed a second renderer.

The software backend exposed two independent targets: CPU pixels went to one,
while the other kept presenting black. Native headless GL created two contexts
and encountered `GL_INVALID_VALUE` (1281) directly from `texSubImage2D` despite
matching 640×480 logical sizes. The failed unlock/next lock then caused the
guest's unchecked blit into code.

The fix returns the device's primary COM wrapper from the internal owner
lookup. No interface query is needed there. The regression in
`test-d3d9-color-surfaces.js` changes the primary vtable to Device8, verifies a
lock reads existing render contents, writes a pixel, unlocks/presents, checks
the pixel, and asserts that the host device count never changes.

With that fix, both native GPU and software runs reach the main menu with real
rendering and no corruption. Parent-observed native menu screenshot:
`/private/tmp/reflexive-probe/alien-native-observe.png`; software menu:
`/private/tmp/reflexive-probe/alien-menu.png`. Native final surface capture is
`/private/tmp/alien-native-fixed.png`. The live control PNG is preferable to
the runner's final surface chooser during loading (the latter can capture the
old SIGMA splash while the composited screen shows LOADING).

The route is graphics setup OK, LOADING, SIGMA TEAM, Alien Shooter title,
then menu; Enter skips the title. Mouse movement before clicking New Game
reaches Select Player.

## Mission 01 acceptance

A fresh software run with `--tick-ms-per-batch=5` reached Mission 01 and
verified character/camera movement and mouse aiming. The default 200ms
clock produced extremely slow presentation/input progress while executing
Vorbis LSP-to-curve decoding at `0x46b554`; changing it mid-run did not
immediately recover responsiveness. Start the interactive CLI run at 5ms.

```sh
node test/run.js --app=alien_shooter --no-close --quiet-api \
  --d3d9-renderer=software --tick-ms-per-batch=5 --batch-size=200000 \
  --input=50:dlg-click:1 --control=58118 --max-seconds=600
```

After each screen finishes loading, move before pressing/releasing the normal
left mouse button: New Game `(98,296)`, Campaign `(320,334)`, then Continue
`(535,445)` in the Mission 01 equipment screen. Held right arrow moves the
character; mouse movement changes the aim. Firing was exercised but no clear
projectile was captured, so combat is not certified by this acceptance.

Evidence in `/private/tmp/reflexive-probe/`: `alien-lowclock-campaign2.png`,
`alien-lowclock-gameplay.png`, `alien-lowclock-move-fire.png`, and
`alien-lowclock-fresh.log`. This was CLI software acceptance; browser gameplay
has not been verified for Alien Shooter.

## Validation limits

The DirectSound ordinal/interface regression passes on the merged source.
The added D3D8 identity/pixel assertions pass in the synchronous software
branch of `test-d3d9-color-surfaces.js`. Its later worker branch fails an
existing rectangular UpdateSurface-to-backbuffer pixel assertion before
reaching the new case. The same failure reproduces on pristine `79483e6a`
and the combined main source; it is not a passing full-suite result.
Logs: `/private/tmp/alien-owner-baseline.log`,
`/private/tmp/reflexive-probe/merged-color-surfaces.log`.

The merge-time combined source compiled and passed the remaining build gates
when the previously documented baseline union-gate failure was excluded.
A later standard build of the moving shared worktree stopped at new duplicate
Glide `grFinish`/`grFlush` handlers (`final-main-build.log` in the same scratch
directory). The canonical artifacts were refreshed with the compiler directly;
this is not an entirely green standard-build result.

## Original Mission 01 on browser WebGL, 8 October 2026

Run `scratch/runs/20261008T0114Z-alien-shooter-webgl` reaches the original
registered Mission 01 through graphics OK, New Game, Campaign, Continue.
The real browser clock is used; no CLI tick recipe, guest writes, game patch,
or blind Enter is involved. Each menu click follows a reviewed highlighted
target and trusted desktop mouse motion. The native graphics dialog's OK click
has a separate trusted DOM receipt at client `(342,374)`, with pointer lock off.
The later DOM receipts also report unlocked motion; relative desktop commands
remain usable without assuming that absolute Puppeteer coordinates reach a
locked game cursor.

`mission-settled.png` to `right-released.png` shows the soldier crossing the
grass under held ArrowRight; `down-released.png` retains a later ordinary
ArrowDown comparison. `aim-right.png` and `aim-left-final.png` show opposite
weapon orientations after trusted horizontal mouse motion. The early W capture
overlaps the intro camera movement and is not the strongest movement evidence.
The HUD remains at HP 110. This qualifies movement and aiming in Mission 01;
combat, mission completion, audio and FPS were not measured.

This is an explicitly accepted reference runtime, not a new current-main build:
source `f62ab3c9f1223ab47cf623470f6343d508257878`, WASM SHA-256
`4dc5ac2c477c71c64a42530562e4cf51e145bd966232e15330acfc01753d54de`.
The original EXE SHA matches `aae2547c…`; the unchanged accepted registry selects
its original manifest. All 963 package pins and 446 Git source pins pass.
Independent old companion-file hashes were unavailable: current original fixture
hashes and registered manifest sizes are sealed, rather than claimed to be an
independent installer re-extraction. Both host and owning render Worker report
the neutral D3D8/D3D9 WebGL backend. All 156 full and 333 range HTTP reads match
their pinned bytes. Four strict unlisted requests are retained honestly:
`api/auth/user`, `test/binaries/tlbs/stdole2.tlb`, its `.part000` path, and
`icons/apps/alien_shooter.png`. No renderer fault is observed.

Ordinary harness quit at 01:21:53.394Z closes Chrome with exit 0, closes the
server and drains all streams. Independent checks find both owning PIDs absent,
no Chrome, exact baseline sockets and unchanged pins. All 65 actual capture
files were downloaded and hash-checked before removing the scoped remote prefix.
The root-owned sandbox and Puppeteer tools were retained for its lifecycle owner.

The actual native title is `AlienShooter`, which exposed a spaced-name matcher
in the scoped harness. The observed run used separately recorded trusted native
input; the final adapter recognizes both title spellings and refuses GPU windows
as native setup. Its regression passes, but that small adapter correction was
made after the run. The archives preserve the exact executed adapter at
`3282325e6`; do not substitute the final branch hash for the runtime's source.
