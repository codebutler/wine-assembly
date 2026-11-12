# Silver original Windows demo

Status on 2026-10-13: original main menu and dock scene rendered;
player-controlled gameplay not verified.

## Original fixture and mounting

The Infogrames 1999 Windows demo is archived at
<https://archive.org/details/SilverDemo>. Publisher-era `install.ini`, demo
readme and licence identify the original demo. No installer or licence prompt
was executed or accepted in these investigations.

`SilverDemo.zip` is 129,637,371 bytes, SHA-256
`645db1f10f9fd77fcc22f3140648fc154e3d5680a9f88cd7fe8d834268e887ea`
(SHA-1 `a6af4d96fdc74b9649b1d96b513c416f8c65650b`). Native extraction yields
3,123 ZIP files plus 24 files from the original InstallShield cabinet. All
3,147 mounted C-drive files preserve the original file bytes. `silver.exe` is
1,694,720 bytes, SHA-256
`2301beb5100c6eb73eadcb700a2ce65e7b1221d2390207cbe3f07bc64df73ff8`.
Original `mss32.dll` and `smackw32.dll` are native DLL seeds.

The executable checks logical drives for `GetDriveTypeA == DRIVE_CDROM`, then
searches for `SILVER\LEVELS\VERDANTE\DAVHOUSE\DAVHOUSE.SCT` (68,940 bytes).
The existing harness's D drive has CD-ROM semantics. Keeping the extracted
tree at `C:/SILVER` and mounting the unchanged original ZIP with
`--zip=SilverDemo.zip --zip-root=D:/SILVER/` supplies the 3,123 read-only media
files. This passes the original CD search without game configuration changes,
invented registry keys, API overrides or a fabricated ISO.

## Requested flip-chain failure and fix

The original 8-bit startup path sets `DDSD_CAPS|DDSD_BACKBUFFERCOUNT` (`0x21`),
caps `0x4218`, and two backbuffers before `CreateSurface` at `0x41b8a3`.
`GetAttachedSurface` at `0x41b936` requests `0x4004` and succeeds; the next call
at `0x41b980` requests `0x4000` on that first backbuffer and fails with
`DDERR_NOTFOUND`. The actual error-dialog stack contains return `0x41b9af`.

The old implementation allocated only one backbuffer regardless of the
requested count. The generic fix allocates the complete chain with distinct
storage, marks only the first attached surface `BACKBUFFER`, rotates all
backing buffers on Flip, validates target overrides, reports the requested
count, and rolls back partial allocation failures. Linear ownership preserves
release behavior; a weak tail-to-front lookup avoids a reference cycle.
Existing explicit and mip attachments remain covered.

This follows the documented
[DDSCAPS roles](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/ns-ddraw-ddscaps)
and [Flip associations and target override](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/nf-ddraw-idirectdrawsurface7-flip).
The change was reviewed/integrated as `3cc6e1c64`; the original tested three-file
commit is `e14f5d97c3cd2854bc1401ce3f51f1ef5ddb47bb`.

Canonical build from base `68e5e094a138c89f8c47898f2d68a64ab7a8318f` plus the
tested source produced module SHA-256
`46c1e23aabca26de5e459f21463d3e1167f3a71d95e573ffedecefe7b31765f7`.
The DirectX source SHA-256 is
`0bd81ce191e29a690ae560fadcde314b0c777692fc5d023b32f1be12ada603be`.

Nine focused suites passed: complex-surface release, explicit attachment,
mip chain, surface caps, Surface3 descriptor, surface enumeration, attachment
enumeration, D3DIM worker parity and GPU asynchronous Flip. The expanded
complex test covers double/triple/four-buffer storage and color rotation,
target/caps failures, retained intermediate references, COM-slot exhaustion
and DIB allocation rollback. On unchanged base source, the same test's narrow
negative control fails at the second requested backbuffer with
`DDERR_NOTFOUND`.

## Reviewed original runtime and remaining route

With the exact original C/D fixture, the new module passes startup and renders
the Silver main menu (Start, Load, Options, Quit Game). The first absolute
mouse move/click at `(320,362)` and Enter did not establish gameplay. No
approval or licence prompt was answered.

The last step request began at batch 232 and requested 120 batches. It never
returned a control reply before manual shutdown, while final statistics show
352 batches. Logs contain repeated zero-byte reads at `silver2.smk` EOF
`0x2c4a8`, notably at batch 261. These observations do **not** establish a guest
deadlock: step completion is settled on the next harness loop, and stdin
commands serialize behind a pending step. The final PNG is byte-identical to
the reviewed batch-222 menu capture.

Source inspection also found that the first absolute `handleMouseMove` has no
previous DirectInput point, so it initializes that point without generating
relative motion. The reviewed custom pointer remained around the menu's
center; the Start click may therefore have missed the guest's cursor. A
prepared follow-up uses the ordinary renderer motion contract to deliver
`directDx:0,directDy:112`, captures the pointer before clicking, and limits
subsequent steps to at most 20 batches. This remains an unexecuted hypothesis.

The prepared driver uses independent loopback HTTP controls so a pending step
cannot block snapshot/capture/quit. A timeout is recorded with before/after
batch and credit values, then captured and stopped; it never silently counts
as a successful step. No production harness or guest state is patched.
`--trace-api` is omitted because even a filtered trace sets `_debugReadFile`
and caused the prior 345 MB repetitive log. Output remains drained with an
8 MiB retained-log limit and explicit omitted-byte counts.

Evidence is in `scratch/runs/20261013T2254Z-silver-flip-original/investigation.json`:
74 transferred artifacts were SHA-256 verified, including a compressed copy
of the full raw log verified after decompression. Prior CD and startup evidence
is in `scratch/runs/20261013T2237Z-silver-original-cd-startup` and
`scratch/runs/20261013T2232Z-silver-original-startup`. Supervisor 177329,
driver 177330, guest 177353 and their process groups were absent at
`2026-10-13T22:56:19.682Z`; the runtime slot was released. Follow-up execution
requires a new coordinated runtime grant.

## Relative-pointer replay, 23:11 UTC

The next granted run used the same source closure, module and original media.
The relative `(0,+112)` motion visibly moved the custom pointer onto Start.
After inspecting that capture, a normal left-button down/up advanced out of
the menu. This confirms the previous absolute-pointer route had not tested a
correctly positioned Start click.

Loading initially showed black frames and an occasional small Silver logo.
Repeated snapshots often landed in the original loop at `0x43f96c`, but later
EIPs varied and the scene progressed. A read-only capture at batch 482 showed
an 18,000-slot table with 8,253 used entries. The original instructions scan
eight-byte entries for a zero first word. This evidence does not support
calling that loop a deadlock. The small steps all replied through the
independent HTTP channel; no pending-step recovery was needed.

By batch 1082 the game rendered a dock with a sailing ship, soldiers and other
characters, plus a Grunt portrait. The original readme documents Escape as a
cutscene skip. Escape during this scene opened an in-game menu containing
Load, Options, Quit Game and Back. A second Escape, intended to return from
that menu, instead reached the original promotional end card. The exact game
branch responsible for that transition remains unverified. No character
movement or combat was demonstrated, and this result does not establish
whether the route was interactive gameplay or a scripted demo sequence.

The next ordinary route should inspect the original Start/demo and Escape
semantics, avoid that second Escape, and attempt a visible world interaction
under a new runtime grant. Do not modify the game or invent a save/config to
skip the sequence.

Evidence: `scratch/runs/20261013T2311Z-silver-relative-start/investigation.json`.
All 224 artifacts (13,379,717 bytes) were transferred and SHA-256 checked.
The full output log is 6,258 bytes with zero omissions. Representative
captures are `002-pointer.png`, `capture-47.png` (dock),
`005-cutscene-skip.png` (in-game menu), and `006-return-world.png` (end card;
the filename records the attempted action, not its outcome).
Harness quit returned zero; supervisor 193010, driver 193011, guest 193019
and all three process groups were absent at `2026-10-13T23:14:54.862Z`.

## World-controls replay, 23:35 UTC

The fresh run used the same pinned module/source and original fixture, with
no Escape during startup or the dock sequence. Relative Start positioning
again worked. The driver accepted 25 commands before harness quit (command
26); every actual step was at most 20 batches. Five ordinary left clicks at
the inspected dock pointer `(365,410)` were interleaved with waiting.
Captures show the dock crowd moving and portraits changing through Grunt,
Fuge and the Duke. The final capture is still the dock at batch 3672.
Neither those scripted movements nor portrait changes prove player control;
the evidence does not isolate clicks as the cause of dialogue progression.

The original HTML readme, `instdata/gamedata/common/readme/index.htm`, lines
193–216, describes running down stairs toward Granddad, crossing the bridge
left, entering David's house, opening the chest, collecting sword/shield,
equipping the sword and returning for training. This identifies a useful
interactive checkpoint, but does not document how this demo's dock sequence
transitions there. The original `dockside.sct` contains `@verdante` and
`@davhouse`; strings alone do not establish script control flow.

The separate original `instdata/gamedata/instsupp/readme.txt`, Gameplay /
Skipping Cutscenes, documents Escape. A bounded, distinct next input probe
is one Escape at the dock, immediately inspect the result, and, if the
previously observed in-game menu appears, use relative pointer motion and a
normal left click on the visible **Back** item. Do not send a second Escape.
This is an untested route, not a promise that Back will skip the sequence.
If a house/Granddad or other identifiable player scene appears, first capture
without input, then click two distinct clear-ground destinations and verify
hero displacement against fixed scenery before following the documented
house/training objective. If the dock remains, record the unresolved
transition; do not treat more animated frames as gameplay or invent a save.

Evidence: `scratch/runs/20261013T2335Z-silver-world-controls/investigation.json`.
All 114 remote artifacts (13,365,642 bytes) were transferred and SHA-256
verified, including commands, replies, launch manifests and the full 8,203-byte
log (zero omissions). Reviewed captures include `advance-5.png`,
`click-15.png` and `advance-25.png`. Postrun hashing verified all 3,147 original
C-drive files, the original ZIP, 130 source-closure files and the unchanged
`46c1e23a…` module. Harness quit returned zero at 23:45:04; supervisor 212438,
driver 212439, guest 212464 and all three process groups were absent at
`2026-10-13T23:45:09.545Z`. This follow-up only packaged evidence and inspected
source; another runtime requires a new coordinated grant.

## One Escape and reviewed Back, 2026-10-14 00:00 UTC

Run `20261014T0000Z-silver-escape-back` retained the same source/module and original fixture. At the dock, one ordinary Escape initially left the same image; 100 further batches exposed Load/Options/Quit Game/Back. Relative pointer motion placed the cursor on Back at (320,450); its reviewed left click returned to the dock. Another 200 batches still showed the dock. No second Escape or guest-state change was used, and no player control was established. All 3,147 post-run original hashes matched; the driver quit normally and all three PIDs/process groups were absent at 00:04:35.516. All 67 transferred artifacts (6,803,478 bytes) were individually hash-checked; evidence is `scratch/runs/20261014T0000Z-silver-escape-back/investigation.json`.

A source-only follow-up checked original installer metadata: the Silver Demo shortcut invokes Silver.exe without extra arguments, so a missing documented command-line switch is not supported by that file. Original `sound/fugeapt1.wav` and `fugeapt2.wav` are format17 stereo44.1kHz with fact-chunk durations19.608s and58.788s; the B variants are15.734s and42.478s. These durations do not establish which clip currently gates the script. Before another replay, correlate actual loaded speech, mixer completion and script progress using existing bounded tracing; do not infer a broken audio API merely from a long animated sequence.

## Automated original-media recovery, 2026-10-14

Run `node tools/fetch-candidate-corpus.js --id=silver-demo`. Fresh acquisition verified the previously recorded ZIP SHA1/SHA256, preserves source/SilverDemo.zip unchanged, extracts its3123 files under game/SILVER, then extracts the24 original data1.cab files into the same directory. Both sets have no overlapping filenames and no content changes. Canonical silver.exe matches the prior recorded SHA256. Complete3147-file hashes are in test/candidate-corpus/silver-demo-files.json; `node test/test-silver-demo-recovery.js` verifies pristine output. Source media and cabinet outputs were independently extracted and byte-compared.

This adds a recovery candidate only. Original launch still requires C:/SILVER and unchanged source/SilverDemo.zip mounted at D:/SILVER/ with CD semantics, as documented above. Generic candidate CLI does not yet encode that dual mount; do not use its default single-directory execution as a compatibility verdict. No browser/desktop registration, installer/licence prompt, new player-control validation, audio/FPS claim or public deployment.

## Offline browser-evidence recovery, 2026-10-14

Run `scratch/runs/20261014-silver-history-recovery` recovers retained Boat
command outputs without restarting the old sandbox or executing the game.
`boat --json info bx_yqnspudj` reports `stopped`, with a verified snapshot at
02:54:21.026Z. `boat --json exec bx_yqnspudj -- ls -ld
/home/user/scratch/runs` returns HTTP409 `machine_not_running`. This is a
stopped-machine observation, not proof that the disk artifacts were deleted.
No SSH, resume, replacement job, browser, build or guest execution was used.

`boat history bx_yqnspudj COMMAND_ID` remains readable. Its response is JSON
with a `data` string; decode that string before interpreting base64. Fifteen
retained archive-chunk outputs reconstruct the complete 02:22 archive:
5,622,000 bytes, SHA256
`7fc9ad29807389c214c8af0efd60648012fa1f91b3c643aef210d6215e8cba23`.
The stored packaging output `cmd_r2ytupol81dk` independently records that
hash. All 96 extracted files match the original artifact manifest. The
archive and extracted files are inside the recovery run (about 14 MiB total).
The committed `docs/silver-history-recovery-20261014.json` retains chunk
command IDs/offsets and the checks needed to repeat this recovery. Read only
those stored commands; do not execute the historical command strings.

The 02:22 archive contains both runs, drivers, input commands, logs, module
responses, and pre/postflight manifests. Its actual module response is
1,796,313 bytes, SHA256
`02f7ed397f92fb8e4ed81798b0e2ba3405b27115b9887ce5a52ee4c82c2936d6`;
recorded source HEAD is `56dc827cc64241cf763fff0d821c6a3fbd195a25`.
Do not replace this with today's HEAD: preflight includes the actual source
closure hashes. Browser is Chrome/151.0.7922.108, headless, 1000x800,
`--enable-unsafe-swiftshader`; the reviewed UI shows Software GPU and Threads
enabled. The route creates a temporary `silver_probe` app, mounts all original
files at C:/silver and the unchanged ZIP at D:/SILVER, and uses native
Mss32.dll/Smackw32.dll. It is not a registered `lib/apps.js` Silver route.

The newly reviewed `run-two/pointer-two.png` shows the menu with the pointer
on Start. The 02:22 driver lacks `relative:true` and holds the button only
80ms, so it is not the later corrected input replay. Historical command
`cmd_bpoch8nvo8sg` records adding `relative:true` and replacing that hold with
500ms, a passive snapshot, then another 500ms. Packaging commands preserve
the later ordinary-input sequence and summaries, not the complete later runs.

Stored output `cmd_m2cwqpgklgjx` recovers a JPEG derived from the 02:31
`run-three/final.png`. Newly reviewed: the original outdoor house/stairs/
bridge scene is visible. This is a lossy derivative, not the original PNG,
and a single image does not prove player control. Its local filename is
`cmd_m2cwqpgklgjx.jpg`. The 02:31 complete archive remains unavailable locally
(recorded SHA256 `405e36702214669c7d580a91aecbd28da362b96cdac8b78257e108e949b4d050`).
The final 02:36 archive remains unavailable locally (8,911,631 bytes, SHA256
`93fc85c1f5b6fc5de897fc96499c337b239bc8c090a2b7bbf387a8233ac240ec`).
Nine requested image histories return empty `data`, `done:true`, with
`offset == size` despite nonzero original output sizes; exact responses are
retained in `history-receipts.json`. Do not describe these missing images as
visually reviewed. Historical summaries report native completion status2 and
ring segments0/1; those later raw timing files were not recovered here.

The retained original ZIP was freshly rehashed against the pin above.
`/tmp/silver-source` matches 3,123 inventory files, with zero mismatches;
all 24 cabinet payload files, including silver.exe and native DLLs, are absent
from that particular tree. Do not launch it as a complete fixture. The
existing corpus extraction recipe can restore the cabinet files from the
retained media when disk/runtime coordination permits; no download is needed.

### Next bounded ordinary-input comparison (not executed)

First restore/verify all 3,147 fixture hashes and both original mounts. Use
the recovered browser driver as a route reference, explicitly correcting
`relative:true` and the one-second Start hold as recorded above. Pin the
actually served module/source, browser, GPU backend and worker settings;
do not assert that a new build matches the 02:22 module. Obtain the sole
runtime slot before launching. Bound each fresh browser session to 300s
with retained logs and normal owned-process cleanup.

Run a no-world-input control after the reviewed Start click. Capture the
house scene against fixed scenery and observe whether movement/dialogue
continues automatically. In a separate matched session, reach the same
observable scene/readiness checkpoint, capture before input, then use normal
relative pointer motion and a one-second left hold on one clear destination;
release and capture at fixed intervals. Repeat at a distinct visible
destination only if the first comparison is interpretable. Record host
down/up and actual guest input consumption if existing diagnostics expose
it. Stop at the deadline or unresolved dialogue/readiness; a changed portrait,
continued script, host event, or animated scene is not movement acceptance.
The original readmes describe house/chest/sword/training objectives but do
not document the ground-click/selection contract. Do not assume that two
clicks failing proves an input defect, or alter guest state to force control.

Acceptance remains unfulfilled: establish repeatable input-caused hero
displacement relative to fixed scenery, distinguished from the no-input
control, and review the actual before/after images with source/input/backend
identity. No new gameplay, audio, FPS, or engine-fix claim results from this
offline recovery.

## Complete local fixture restored, 2026-10-14

Follow-up `scratch/runs/20261014-silver-cabinet-restore` restored exactly the
24 missing cabinet files (39,027,302 bytes) directly into `/tmp/silver-source`
using the existing `tools/is5-extract.js` and original `data1.cab`. It did not
re-extract the ZIP, download media, execute the installer, or launch a guest.
Before extraction, all 3,123 existing files matched the pinned inventory; the
cabinet catalog matched the 24 absent paths and sizes exactly. Extraction
was refused for any existing destination, mismatch, or projected free space
below 2 GiB plus 8 MiB metadata margin. After extraction all 3,147 original
SHA256 values match `test/candidate-corpus/silver-demo-files.json`, including
the previously pinned silver.exe. The original 3,123 files remain unchanged.

The source-preparation script, preflight, extraction log and validation are
retained in that run. `docs/silver-cabinet-restore-20261014.json` preserves
the command, extractor/inventory/media hashes, resulting disk space, and
exact mounts. The earlier missing-cabinet finding above describes the
pre-restoration state and is now resolved for this tree only.

For the next separately coordinated browser run, serve `/tmp/silver-source`
as the complete C:/silver tree and launch C:/silver/silver.exe with original
Mss32.dll and Smackw32.dll. Serve the existing unchanged
`scratch/runs/20261014-silver-recovery/SilverDemo.zip` as `/SilverDemo.zip`,
then use `HttpRangeProvider.open('/SilverDemo.zip')` and
`ZipMount.mountZip(wine._helpCtx.vfs, provider, {zipPath:'SilverDemo.zip',
root:'D:/SILVER/'})` in the recovered route's `beforeRun` hook. Preserve
D-drive CD-ROM semantics. This is fixture readiness only: no new browser,
build, game, input comparison, or player-control result has been produced.

## Bounded idle/input attempt, 2026-10-15

Evidence: `scratch/runs/20261015-silver-idle-input`. Both authorized300s
sessions used source9449e6c0d, identical fingerprint
`dc29bc7dc19724ea78671352de90649b6e6dbc1adaf9339c5850de733d16d50a`,
Chrome151.0.7922.108 headless1000x800, Software backend and isolated guest
main Worker. Both actual browser module responses matched70c6d329d51eee5db553715f53ffc47f3e6e2491b54ae5327f1b8b012427d655.
Pre/postflight941source and3147original fixture hashes passed. No guest file,
clock, save or runtime state was patched.

Idle131122 ran00:15:17.793–00:20:28.992Z; input134433 ran00:21:11.543–00:26:14.916Z.
Both controllers closed at their300s deadlines and supervisors exited0 with
no survivors, postflightPassed:true and errors:[]. The deadline includes
launch, original media mounting, image review and cinematic progression;
supervisor completion includes cleanup. Each run executed only the same
reviewed relative(0,+112) Start positioning and one-second normal left hold.
Held snapshots record hostMouseButtons:1 and later release0. This proves
host delivery, not actual guest input consumption by itself. Actual menu
departure and natural dock progression were visually reviewed.

Idle naturally reached the house by00:19:55.351Z. The world marker was
processed00:20:07.162Z; idle0/2/5/10-second captures were retained, but no20s
capture fits the deadline. They show David beside Granddad while the portrait
disappears, without world input. Control readiness remains unproven. A brief
read-only attachment to the same browser during startup used
defaultViewport:null, preserved1000x800, saved passive-observation.json and
disconnected; it showed the apparent DLL-loading pause had progressed.

The second run reached the house by00:25:28.062Z; house-ready-check at
00:25:54.468Z shows the portrait gone. Its camera/character placement has a
small offset from the idle image, so do not claim exact scene alignment.
Crucially, controller shutdown was00:26:12.877Z. The attempted mark-world
request8 and relative ground request9 were written only at00:26:21.118Z and
00:26:21.590Z, after shutdown. They are retained with timestamps in
input/late-unexecuted-requests.json; executed commands.json ends at7. Neither
world request executed, no ground hold was sent, and no movement response
was tested. A missing after-command-9 capture is therefore expected. This is
an incomplete comparison due to the observation/input window, not evidence
of rejected game input or a game bug.

The runtime slot was released after terminal cleanup confirmation; no restart
or extension was attempted. The two complete artifact inventories comprise
61idle files/8771557bytes and48input files/5942831bytes, independently
byte/SHA256-verified on transfer. Representative reviewed images are
idle/pointer-settled.png, idle/idle-10s.png, input/house-ready-check.png and
input/final.png. No gameplay qualification results from this attempt.

Next execution needs a separately coordinated budget with enough time after
natural house arrival for image review, a settled pointer capture, a normal
hold and matched observations. Base that budget on the measured startup/
cinematic times above; preserve an explicit hard wall-clock limit. Do not
silently convert the two late request files into completed input evidence,
force readiness or call the stationary pictures proof that control works.

## 2026-10-15: paired ordinary movement verified

The revised 600-second pair establishes narrowly scoped player-controlled
movement in the original demo. Evidence is self-contained under
`scratch/runs/20261015-silver-600-comparison/{idle-600,input-600}`.
Remote controller source was `77e0380e3fdca6a44f2b31088760285b91192ddb`,
with the unchanged original C:/silver fixture and original ZIP D:/SILVER
mount. Both loaded WASM SHA256
`70c6d329d51eee5db553715f53ffc47f3e6e2491b54ae5327f1b8b012427d655`.
The identical source/module/fixture fingerprint was
`c4a60b4f0954f01a9eb9f56ec206d34a736b6fc78001c4cbcfcccbe67133cbf7`.
Chrome151.0.7922.108 used Software rendering, isolated guest main Worker,
and the unchanged1000x800 viewport. All941 source and3147 original fixture
files passed pre/post integrity; no guest state or clocks were modified.

Idle148910 started00:39:27.392Z and exited cleanly00:45:03.351Z. After normal
Start and natural cinematic progression, reviewed portrait-free house
captures idle-0s through idle-20s show David stationary beside Granddad;
Granddad's animation alone does not establish control. Input152857 started
00:45:14.550Z and exited early00:54:12.009Z, within its600s deadline.
Its portrait-free forecourt matched the idle scene with a small camera
offset, so comparison uses the doorway, bridge and character relationships
rather than claiming pixel-identical scene alignment.

Input commands.json records every command0..14 executed. Command10 held
the ordinary left button1000ms at guest(410,330), after relative(+90,-32)
and inspection of ground-pointer-settled.png. David moved right toward
Granddad, visible in ground-1-20s.png. Command13 held1000ms at(260,355),
after relative(-150,+25) and inspection of bridge-pointer-settled.png.
ground-2-20s.png shows David on the left stone bridge, reversing the first
displacement while the fixed house scenery remains unchanged. Both holds
have held-button receipts and complete0/2/5/10/20-second observations.
This directional response to two ordinary destinations, against the
stationary20-second idle baseline, establishes player movement for this
route. It does not establish combat, saving, completion, audio quality,
performance or broad playability. The controller's conservative automatic
playerControlVerified:false field remains unchanged; visual review supplies
the scoped movement assessment in the run result.

Both supervisors returned code0, postflightPassed:true and survivors:[];
both errors.json files are empty. Runtime was released immediately after
cleanup. The earlier300s failed-to-execute comparison remains preserved
unchanged. Work pauses after this evidence checkpoint at the user's request.
