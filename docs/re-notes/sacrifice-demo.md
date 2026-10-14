# Sacrifice demo — original source preflight (2026-10-13)

Task: NEW-GAME-SACRIFICE-20261013. Source-only; no runtime, gameplay, screenshot, audio or FPS claim.

## Original source and exclusion

Downloaded [the archived Shiny/Interplay 2000 demo](https://archive.org/details/Sacrifice_201404)
from `https://archive.org/download/Sacrifice_201404/Sacrifice.exe`.
The 95,195,047-byte download has SHA-256
`79b8dfa18dd8663abb74dc669d9c6505d4f302603eb2bde3a8d4f11a529a13b2`.
Its MD5 `c0d9d1ef97ecff71dffb7098bb14d0b3` and size match
[ModDB's original sacdemo.exe listing](https://www.moddb.com/games/sacrifice/downloads/sacrifice-demo).
No retail payload, wrapper patch or modified guest was used.

At preparation time Sacrifice was absent from the live public
`https://wine-assembly.berrry.app/lib/apps.js` (SHA-256
`1fbeefb255b5d4d8d28d0554bbcb06000f28cd125b1c78e1912cd7a081c41611`),
main's app registry, candidate manifest, tasks and prior investigation notes.
Preparation tree: `bx_yqnspudj:/home/user/sacrifice-source-work`, base
`d31cf3b784c18dc2647b21a72c7777a800e96f9f`.

## Payload and launch prerequisites

`7z x` extracts the outer MSZip CAB at file offset 168534; `unshield x`
extracts the original InstallShield data1.cab/data2.cab payload.
The game component `Program_Executable_Files` contains 115 files,
101,431,554 bytes, including the original executable, seven DLLs, cache,
demo data and maps. No installer or game was executed.

Remote source: `/home/user/sacrifice-fixture/sacdemo.exe`.
Original installer: `/home/user/sacrifice-fixture/installer/Disk1/Setup.exe`.
Game root: `/home/user/sacrifice-fixture/payload/Program_Executable_Files`.

`Sacrifice.exe` is an 831,488-byte PE32 i386 Windows GUI program, linker 6.0,
image base 0x400000, entry RVA 0xb20cc, timestamp 2000-11-20 19:26:36 UTC.
SHA-256: `79c4754998031e2d0ee0de008c8958507d475b4debe77aa4c746bfac522f8fc8`.
Imports include share.dll, game3d.dll, DINPUT, MSVCRT and normal Win32 APIs.
Original 3d_d3d.dll imports DDRAW; game3d.dll uses SMACKW32; sound.dll uses
Mss32 and SMACKW32. The original share.dll names registry key
`Software\\Shiny Entertainment\\Sacrifice Demo`; values required for startup
are not yet established. Do not invent registry values.

Readme minimums are Windows 95/98/2000, 64 MB RAM, DirectX 7.0a and an
8 MB Direct3D adapter. Original tutorial maps tu01/tu02/tu03 exist.
Readme controls are W/S or up/down to move, A/D or left/right to turn.
Ordinary Tutorial UI is the intended first controlled gameplay route.

## Bounded next step

After the coordinator grants the runtime resource, pin the current reviewed
canonical wasm and dependencies in this isolated tree, verify their hashes,
then attempt an original startup for at most 90 seconds (external guard 120s).
The extracted-original route mounts Sacrifice.exe plus every original companion
file with `--vfs-include=**/*`; it must not replace DLLs, patch the executable,
fabricate installation state or auto-answer a license dialog. Capture and review
the first startup screen before selecting Tutorial or adding control inputs.
If extraction omitted required installer state, investigate the original installer
instead of guessing it. Any encountered acceptance prompt remains unanswered.

The bundled Readme contains a general product license and restrictive
redistribution language. No license was accepted and no public distribution
is authorized by this investigation.

Evidence on the remote tree:
`scratch/runs/20261013T2055Z-sacrifice-source/` contains
archive metadata, original public-app snapshot, extraction logs, PE headers,
all 115 file hashes, import inventory and preparation.json. No result.json is
published because the title has no corpus registration or actual runtime run yet.

## Original startup result (2026-10-13 21:07 UTC)

The original demo reaches a reviewed 640x480 main menu with Single Player,
Multiplayer, Load Game, Options and Quit. No acceptance prompt appeared.
This is startup evidence, **not gameplay qualification**.

The first bare route failed before startup because mounted companion files do
not seed app-local PE DLL loading. This was harness setup, not an established
game incompatibility. The corrected route declares each of the seven original
DLLs with repeatable `--dll-seed=ABSOLUTE_PATH`, mounts `--vfs-include=**/*`
and supplies the existing system MSVCRT dependency from the original WA demo
fixture (SHA-256 `df9f2aab7f7119f214c5d743d961fde4bf324f19011fbbb7e9cf666856fba0ba`).
No game file or registry entry was modified.

Tested source 1ab99c63 on d31cf3b78, canonical wasm
`ba6f25ea2d467b3fba00110d83575d48ac1aeb8794a474052190998067723259`,
Node v24.18.1, cooperative headless threads, default clock.
Corrected process 99702 / 99712 / 99713 ended with exit 0 at
2026-10-13T21:08:56.539Z after its 90-second guard; all were verified absent.
The earlier 98786 / 98805 setup attempt also terminated.

Evidence:
`scratch/runs/20261013T2106Z-sacrifice-original-startup/` (setup failure),
`scratch/runs/20261013T2106Z-sacrifice-original-startup-dll-seeds/`
(corrected route, screenshot, command/identity/terminal receipts and all source
file hashes). Both were retrieved to the coordinator with SHA-256 verification.
Reviewed screenshot SHA-256:
`89b12934b574e8416a821f11987812eaf15480d1a995b455e01a88d7bd61f98c`.

Next granted run should capture the current menu, click Single Player near
(320,252), review the resulting screen, then enter Tutorial through ordinary
input. The source-only command-queue driver
`scratch/sacrifice-next-control.js` in the isolated remote tree bounds that run
to 270 seconds internally / 300 externally. It is prepared but has not run.
Stop if a license prompt appears. Capture world before and after W/up movement;
menu navigation alone does not establish control.

## Tutorial selector and next causal test (2026-10-13 21:21 UTC)

Ordinary Single Player input opens the Tutorial 1/2/3 selector. A separate
ordinary mousemove visibly places the game's cursor at Tutorial 1.
Click at (240,211), a held down/up pair, and Enter leave the selector visible;
the later snapshot still reports main/focus 0x10001 with a visible 640x480
Sacrifice window. No world, acceptance prompt, error or crash appeared.
Do not infer an input or file-loading root cause from this observation.

The first continuation driver's ordinary-command whitelist omitted mousemove;
its initial Tutorial click left the game's drawn pointer at the old position.
This harness limitation was corrected in a fresh run with no guest or emulator
patch. The corrected driver sent mousemove at batch17250, click21793,
mousedown28316, mouseup30365, and Enter35733. The pointer correction alone did
not make the Tutorial start.

Both routes exited0 after ordinary control-channel quit.
107794/107804 ended21:21:24.938;110658/110668 ended21:23:30.966;
all four were verified absent21:23:40.621 before releasing the runtime.
Evidence retrieved to the coordinator:
`scratch/runs/20261013T2119Z-sacrifice-tutorial/` (13 artifacts) and
`scratch/runs/20261013T2121Z-sacrifice-tutorial-pointer/` (16 artifacts),
including reviewed menu/selector captures, exact control events, commands,
source/module identity and terminal receipts. All 29 artifact hashes verified.
These remain startup evidence; gameplay and ordinary world control are unqualified.

Static analysis now provides a narrow next diagnostic. All addresses below are
the original fixed-base Sacrifice.exe's guest VAs:

- RegisterClassA setup at0x40b296 assigns wndproc0x40af60. WM_LBUTTONDOWN
  reaches0x40b18e, tests byte[0x4cdf28]&4, and calls0x406260(this0x4cdf30,mask1).
  The corresponding up path0x40b1c6 calls0x4062a0(mask1) under the same gate.
- The original menu dispatcher recognizes fourCC tu01..tu03 at0x40e8ee
  through0x40e900 and enters0x40e93f. It calls0x4997f0 with the string Tutorial.
- That lookup clears global pointer0x4ce288 and calls0x494ab0, which selects
  the Tutorial name through0x494d50. At0x40e980 the caller skips map selection
  if the pointer is NULL; otherwise it calls0x4950c0 and then0x4978f0.
- Tutorial enumeration at0x495c10 supplies the original maps/tutorial path to
  0x494c20; its FindFirstFileA call is0x494c59 and FindNextFileA is0x494c98.

The source-only plan and disassembly are in
`scratch/runs/20261013T2124Z-sacrifice-selector-source/`.
Its syntax-checked diagnostic-driver.js prepares a160-second ordinary route
with trace-input, named file API tracing, and passive counters at0x40b18e,
0x406260,0x40e93f,0x4997f0,0x494c20,0x4950c0,0x4978f0.
Bracket the reviewed Tutorial click with hit-counts and read-only dumps of
0x4cdf28/0x4ce288. This distinguishes arrival at the original Tutorial handler
from subsequent mapset discovery. Existing sampled EIP logs cannot establish
that either branch was reached or missed. No diagnostic run, state write,
registry fabrication, or emulator repair is authorized by these static findings;
the next run requires the coordinator's runtime grant.

## Selector delivery diagnostic (2026-10-13 21:40 UTC)

The bounded original run
`scratch/runs/20261013T2140Z-sacrifice-selector-diagnostic/`
reproduces the main menu, Single Player selector and pointer hover, then sends
an ordinary held mouse press at(240,211). Trace-input targets hwnd0x10001
for both down and up, matching the visible/focused main window.
The selector still does not advance.

At before-batch16440 versus after-batch24659:

| Original address | Before | After |
| --- | ---: | ---: |
| 0x40b18e, WM_LBUTTONDOWN branch | 1 | 2 |
| 0x406260, gated window-message mouse consumer | 0 | 0 |
| 0x40e93f, probed tu01..tu03 dispatcher | 0 | 0 |
| 0x4997f0, mapset selection | 0 | 0 |
| 0x494c20, map enumeration | 0 | 0 |
| 0x4950c0, map selection | 0 | 0 |
| 0x4978f0, subsequent transition | 0 | 0 |

The held down/up arrived at batches22634/24658. Read-only dumps before and
after show byte[0x4cdf28]=0x0b, so bit0x4 is clear and the original wndproc
intentionally skips0x406260. Global0x4ce288 remainsNULL; the probed Tutorial
lookup never runs, so this is not evidence that lookup itself failed.
The file trace includes original demo/music discovery but no maps/tutorial
enumeration. The next source question is the DirectInput button consumer
and actual selector callback, ahead of the probed Tutorial dispatch.
Do not infer that the fallback-mode flag is wrong or that every alternate menu
path has been ruled out; no repair is justified yet.

The source/module/115 original fixture identities were checked before launch.
The supervisor uses its own detached child process group, TERM at185seconds,
KILL after another2seconds and a bounded5-second membership audit. Seven
pure mock tests cover normal exit, descendants, malformed commands,
spawn failure, escalation and failed cleanup. Actual counter stdin protocol
was verified in test/run.js: `{"cmd":"hit-counts:before"}` takes no batch prefix.
The guest scope remains160seconds; no new emulator build was made.

This run quit ordinarily with exit0 at21:41:39.806. Supervisor125582 and
child/group125593 were absent by21:41:46.167; the terminal receipt records
cleanupComplete=true and no surviving group members. No escalation was needed.
Four reviewed menu/selector screenshots, source snapshots, exact command and
input traces, counter/dump comparisons, hashes and terminal evidence are
preserved. This remains unqualified gameplay, with no audio/FPS claim,
guest-state writes, acceptance or deployment.

## DirectInput consumer and selector geometry audit (2026-10-13 21:49 UTC)

Source-only evidence: `scratch/runs/20261013T2144Z-sacrifice-directinput-source/`; no new runtime or emulator change. Original EXE hash remains as above. Original `demo/menus.wad` SHA-256 is `fd5dc249373f7fe607b6db6a833ebdc9db36d8a547dc0c48242333713cdc889b`.

Tutorial 1 is a type-1 button resource at file offset `0xb15`, ID `0x74753031`, local position (8,8), width 144, flags `0x2000`. Factory `0x4a27f0` dispatches type 1 through `0x4a280a` to constructor `0x4a37f0`. The constructor copies the position/width and forces height 16 (24 only with flag `0x80000`). Its vtable `0x4b5364` has hit-test slot +0x10 = `0x4a2c50`, which tests the whole rectangle at object +0x204 through `0x4b0db0`. There is no circle-only test on this path: the round endpoints around x176/304 decorate the 144-wide bar. This supports clicking the label at (240,211); the actual live object rectangle/parent transform has not yet been dumped.

The actual mouse update is `0x406320`: it calls device virtual poll with mode 1 at `0x40637a`. Mouse device routine `0x405820` uses buffered GetDeviceData in mode 1: `0x405914 -> 0x405310 -> COM +0x28`, requesting one 16-byte record. Offset 12 is consumed at `0x405958`; `0x405a40` converts high-bit button states/edges. The state and edges reach `0x406467 -> 0x4066f0 -> 0x406690 -> 0x4ae7e0`. UI hit lookup is called at `0x4ae880` through `0x4aed60`, which invokes child virtual +0x10. Button handler `0x4a38f0` receives UI press 0x11/release 0x12; release branch `0x4a3968` invokes activation slot +0x5c = `0x4a39a0`. Thus the earlier zero WM fallback count is expected for the observed mode, and does not diagnose a missing button path.

Next explicitly granted run: same original assets and canonical module, 160-second guest/185-second outer deadline with bounded TERM/KILL cleanup, no build. `scratch/sacrifice-consumer-supervisor-20261013.js` counts `0x405914,0x405958,0x405a40,0x406467,0x4ae880,0x4a38f0,0x4a3968,0x40e93f`, preserving ordinary held click and input tracing, removing broad filesystem tracing. Read-only mouse object `0x4cdf30:160` covers device pointer +0x24, cursor +0x44/+0x48 and edges/state +0x74/+0x78/+0x7c; UI manager `0x4e6050:144` covers current/capture/hover references. No flag/map/register writes. Distinguish buffered event delivery, button decoding, hit lookup, and activation before proposing an emulator fix. The provisional guess that frequent EIP `0x4b07f0` was polling was rejected by disassembly: it is graphics/FPU math. Seven pure supervisor lifecycle/validation tests pass; no game launch occurred during this audit.

## Consumer runtime result (2026-10-13 21:53–21:54 UTC)

Run `20261013T2153Z-sacrifice-consumer` used source `edd68ea0713d59eeb634f2a1439df0f57037deba`, reviewed driver SHA `da7a7b007024323dcc053e41b5708da272a179ba5153bad44d1c1f5c763aec16`, unchanged canonical wasm/115-file original fixture/CRT identities. Four screenshots reviewed; Single Player selector remained unchanged, no gameplay. Ordinary move (240,211) batch15429, down17287, up19149. Before/held/after valid left-byte consumer `0x405958` counts 2/3/4; edge converter `0x405a40` 512/1019/1320. Original mouse object +0x78 changes 0 -> 0x201 -> 0, confirming button state reached the guest. Button handler `0x4a38f0` stays165, release `0x4a3968` stays1, Tutorial branch stays0. Crucially original mouse object cursor +0x44/+0x48 stays (320,240) in all four dumps. Hover/after screenshots lack the moved hand seen in the earlier run; do not silently substitute that earlier observation.

**Probe planning correction:** `--count` is per-block (`src/01-header.wat` comment explicitly requires x86 block-entry boundaries). The planned `0x405914,0x406467,0x4ae880` are interior call instructions, so their zero counts are non-diagnostic. Preserve this harness mistake; use function/branch entries next. The positive branch/function counters plus original memory establish button delivery without relying on those zeros. No generic emulator bug is established. Next source-only question is absolute harness pointer positioning versus original relative DirectInput cursor integration, including normal `relmousemove` delivery and SetCursorPos/clamping.

Guest PID/PGID134465 exited0 at21:54:25.009, child/group absent21:54:25.011, supervisor134455 absent in ps21:54:25.068. Final release receipt21:55:06.048 confirms both PIDs and both groups absent. Eighteen artifacts hash-verified locally; evidence archive SHA `5e4a3162a2883625e948670045c707a23c3b0746d4ab8ce79c67b46734121a8f`. No further runtime grant.

### Normal relative-input continuation prepared (source only)

Pinned `lib/renderer-input.js:2718` derives absolute-move DirectInput deltas only when `_directInputMousePoints.get(inputMemory)` already exists. The first ordinary `mousemove` establishes that reference with dx=dy=0. The earlier `click` calls down/up, which set the host pointer but do not establish this motion reference. This explains the latest run's measured fixed original cursor without an emulator defect. `test/run.js:10046` supports ordinary `relmousemove:DX:DY`; `handleRelativeMouseMove` at renderer line982 passes explicit physical deltas into the same normal move/FIFO route, independent of missing previous position and cursor clipping. Guest SetCursorPos adjusts the virtual cursor without manufacturing DI motion (renderer input contract). Original game `0x4059b6/0x4059c8` multiplies axis records by default sensitivity32; `0x405a90` divides by32 and retains remainder. `0x4063c0` integrates the result into original +0x44/+0x48 and clamps to rendering dimensions. Thus the minimal next granted route is normal `relmousemove:-80:-29` from measured (320,240), inspect screenshot and original cursor, then held down/up at (240,211). This predicted coordinate must be verified, not asserted as observed.

Prepared scratch driver `sacrifice-relative-supervisor-20261013.js` retains original 160/185-second bounds and cleanup, adds bounded ordinary relative movement, and replaces three invalid interior counters with function entries: `0x405820,0x405958,0x405a40,0x4066f0,0x4ae7e0,0x4aed60,0x4a38f0,0x4a3968,0x40e93f`. No guest-state writes, build, or runtime in this preparation.

## Relative route reaches Tutorial loading; original decoder exits (2026-10-13 22:04 UTC)

Run `20261013T2204Z-sacrifice-relative` used reviewed supervisor `73e6b83f12f4748277cfe3bdc34b11cefcedcf76c6911a4518a33a6c3f64cffc`, source `d99a32b1`, unchanged module/fixture/CRT. Normal `relmousemove:-80:-29` moves original cursor (320,240) -> (240,211), verified by dump and reviewed “Play first tutorial” tooltip. Held ordinary down/up advances button release count1->2 and Tutorial branch0->1. Reviewed loading screen reads “Tutorial 1 / The Basics”; progress advances from about one-third to about two-thirds. No world or player movement reached; no gameplay qualification.

Guest141269/PGID141269 ended at22:05:35.301 with host exit0; group/child absent35.302, supervisor141186 and child absent ps22:06:02.122; final receipt22:06:34.563 confirms both PIDs/groups absent. Nineteen runtime artifacts verified; archive `scratch/sacrifice-relative-runtime-evidence.tgz` SHA `aac6473b4a1f86faec042cf3a656ee583dfda26d51e203c00752194b26c5a59e`. The fifth requested screenshot arrived after termination and did not exist; final.png is the reviewed loading checkpoint.

**Attribution correction:** initial interpretation of harness `[eip-zero] guest called through NULL` was wrong. The log first says `[Exit] code=0`. CRT load0xef9000/original0x78000000 maps previous block0xf01cad to0x78008cad. At0x78008cb8 it calls IAT0x78043284, import ExitProcess. The stack return0x9afa8c maps game3d load0x982000/original0x16000000 to0x1602da8c, immediately after explicit exit(0) branch0x1602da80 -> thunk0x16045c30 -> MSVCRT exit IAT0x160470ac. This is an intentional original loading-failure exit, not evidence of a null indirect call. This run used the older pinned harness, which emits the EIP-zero diagnostic without checking the already-stopped ExitProcess state. Main already contains the generic diagnostic correction in ef504c0f3; do not reopen that completed fix or confuse it with this original game loading exit.

Source evidence `20261013T2207Z-sacrifice-loader-exit-source`: original game3d function0x1602d9d0 reads byte[source+0x10]. It dispatches depth24 to0x1602da54, depth8 to0x1602da13, every other value to exit(0). Original strings “ChrConTGA24”, “ChrConTGA8”, “ChrConTGA512”, “ChrIncTga” identify the image decoder. Caller0x1602da90 obtains the source buffer via callback[0x1610a068] before calling the decoder. Actual source-buffer depth and asset identity were not captured; do not infer missing/corrupt files or change the guest. Next source question is this callback binding and asset provenance. No specific failing emulator API identified, so no speculative API conformance test is warranted yet.

## Exact resource observation (2026-10-13 22:13–22:14 UTC)

Run `20261013T2214Z-sacrifice-resource` (actual start22:13:06) used source1d34f58b, reviewed driverdf87f13a and unchanged canonical module/115-file original fixture/CRT. Ordinary relative movement and held click again reach Tutorial loading. Passive trace batch79597 at runtime0x9afa80/original0x1602da80 captures requested identifier `tkhsDMXS.001` at0x9dc150 and EBP=0x10. Since decoder already added16, original source buffer was NULL. EAX depth0 and the dumped VA0 bytes do not describe an actual TGA header. This corrects the provisional unsupported-image interpretation: original resource lookup returned NULL; no malformed asset or emulator API defect is established.

Four screenshots were reviewed, ending at the same loading checkpoint, final.png SHA `af5ed04034660a4ce9c4b88e170fe91bf30c6a6d05282a9a743b7b274917d6ef`. No world or movement reached. Guest147488 exited0 at22:14:14.263; group empty14.264. Receipt22:14:22.978 confirms supervisor147478, guest147488 and both groups absent. Runtime released before source audit. Host exit0 is not gameplay success. Historical post-Exit NULL diagnostic remains already fixed on main ef504c0f3.

Read-only original WAD audit inflates all36 compressed indexes successfully. Records are28bytes; named model `tkhsDMXS` appears in saxs_wiz.wad record189 (packed84858/decoded135570). No type `XTXS` bytes (little-endian SXTX) appear in these decoded indexes. This does not prove every possible resource route is absent. Original `cache/tkhsDMXS.000` is189096bytes, SHA `f98d914458cec87a6d3dc6d34b0388fd42818c4408fd7c165018e876a007150a`, firstDWORD7. No original file was changed.

Source: game3d0x160307b7 tests model flag0x200 before invoking callback[0x1610a06c], bound through IAT0x160470c8 to share CacheSignedFileExists. A true result branches0x16030c54 to cached reads; false or skipped check reaches .001 fallback. Original share0x140010b0 constructs cache path, opens, reads4bytes, compares against global0x1401aec0; mismatch calls remove then returnsfalse. Next bounded read-only observation must distinguish flag gating, cache path/open/read, and signature comparison. Do not force model flags, cache signature, resources, or guest state. Generic emulator conformance work awaits an identified API boundary.

Evidence archive `scratch/sacrifice-resource-runtime-evidence.tgz` SHA `0c4191c0279de19da15919217674c1e6f93f2f23c87d1acb0ec03d8c3c59a5ae` contains16 hashed artifacts plus manifest: runtime trace/input, four PNGs, identities/terminal/release, original WAD/cache audit, and cache disassembly. This evidence covers the completed resource lookup run only; later cache diagnostics are separate runs.

## Cache rejection observed (2026-10-13 22:35 UTC)

Run `20261013T2236Z-sacrifice-cache-single` used driver `ba8f9e1877014ce241d6bda7d5ba8653ca9ed82db82e23052a0c82703ae42789`, source79a9e271 and unchanged canonical module/original fixture. Four reviewed images again end at Tutorial loading. Ordinary API/filesystem trace identifies successful CreateFile C:\\cache\\tkhsDMXS.000 and4096-byte ReadFile atoffset0. Original DeleteFileA cache\\tkhsDMXS.000 follows before decoderexit0. Counts: flag-set branch0x9b27bc=1; CacheSignedFileExists0xcbf0b0=1; postread/signature comparison0xcbf107=1; rejection0xcbf11e=1; success0xcbf114=0; cachedload0x9b2c54=0; fallback0x9b27d4=1. Thus the cache check ran, opened/read the target, and rejected it; missing filename or skipped model flag is not the cause on this run. No gameplay qualification.

Passive TRACE-AT emitted no sample although its address counted once. No live expected signature or compared DWORD was captured, and the64-sample budget was not exhausted by earlier models. Retain this measurement limitation. Two preceding harness setup failures are preserved:2234 multi-address probes force batch-size1 and were stopped before Tutorial;2235 exceeded max16 count slots and exited in argument parsing. Neither is a game crash. Corrected run used11 counts/single probe,160-second bound, no build.

Guest162747 exited0 at22:36:39.233. Receipt22:37:12.217 confirms supervisor162737, guest162747 and both groups absent. Earlier161978/161993 absent22:34:16.729;162243/162253 absent22:35:08.052. Post-run all115 original fixture hashes match, including cache signature7. Original deletion affected private VFS only. Remote archive `scratch/sacrifice-cache-runtime-evidence.tgz` SHA `9804f1d2f179d2ce9ebea6953622c813eb7490b832fcd4bca8dce60e2d187332`; per-run artifacts hashed, investigation.json written last.

Source-only continuation: share0x14001000 CacheSetSign writes its argument to0x1401aec0; do not assume a static initializer survives. game3d call0x16026868 through IAT0x160470c4 supplies dynamic global0x1605a170, or that value+16 depending renderer virtual+0x8c result. Preceding0x160267d0 uses renderer virtual+0x184 and configured exponent0x16054998 to choose0x1605a170. Actual live values and renderer method semantics are not yet established. Original fread reads4 single-byte elements into a local DWORD before comparison. Next source work must identify the renderer methods and expected signature derivation without changing cache or settings. No emulator API fault established; no runtime grant.

## Guarded exit probe emitted no sample (2026-10-13 22:57 UTC)

Once-only granted run `20261013T2257Z-sacrifice-signature-exit` used driverc8133da6, sourcea14a289b, unchanged canonical module/CRT/115-file fixture. The single previously successful original decoderexit0x1602da80 probe requested name, original expected signature0xcd8ec0, and exponent0x9dc170. Both game3d982000/original16000000 and sharecbe000/original14000000 mappings were guarded before every input. Ordinary relative Tutorial input again reached loading and originalexit0, but no TRACE-AT line was emitted. Expected signature/exponent remain unknown. No repeat was launched. Source inspection shows --quiet-blocks only suppresses ordinary progress logging, not TRACE-AT; do not claim it caused this absence. The earlier successful exit sample does not make this run successful measurement.

Four screenshots reviewed, finalPNG SHAaf5ed04034660a4ce9c4b88e170fe91bf30c6a6d05282a9a743b7b274917d6ef matches previous loadingcheckpoint. Guest178945 exited0 at22:57:55.712; supervisor178935,guest178945 andbothgroups absent22:58:20.920. Postcheck all115originalfixture hashes unchanged. Twelve artifacts hashed; archive scratch/sacrifice-signature-exit-evidence.tgz SHA79c973c849ea9c425ce996dbb0592bae3c268a34d5547a2566bd0b454d1bbea1 transferred afterlocalfloor2.70GBcheck. Investigation written afterartifactmanifest. No gameplay/emulatorfault/acceptance/deployment claim. Next source question is passive-probe delivery; root may review standard exit-time dump of persistent globals as an alternative, with no further runtime authorized here.

## Persistent signature and renderer restriction (2026-10-13 23:22 UTC)

Run `20261013T2321Z-sacrifice-persistent-exitdump` used sourced8e702c5,
driver3556b7ab, unchanged moduleba6f25ea and original115-file fixture.
The ordinary relative-pointer Tutorial route again exits0 before the world.
Four screenshots are reviewed: main menu, selector, Tutorial1 hover, and
Tutorial1 loading at about two-thirds. Guest200257 ended23:22:00.968,
supervisor200247 recorded cleanupComplete23:22:00.970. All original115
post-run hashes match. Twenty-two artifacts were transferred and SHA-verified;
archive SHA837b657aa10a05fc7cd1f4e8c296fa6d2b71bd456634c88403af4b5a5b6c8133.
Investigation metadata was published last. Gameplay remains unqualified.

Standard exit dumps now establish persistent identifier `tkhsDMXS.001`,
texture exponent7 at0x9dc170 and expected cache signature23 at0xcd8ec0.
Original `cache/tkhsDMXS.000` still starts with7. Prior cache tracing already
established successful open/read followed by rejection and private-VFS deletion.
These independent observations identify a signature mismatch, not missing files.

The pinned `--dump-vmap` diagnostic only searches sparse allocation records;
its NOT MAPPED message is misleading for low direct-window addresses.
`lib/mem-utils.js:g2w` first translates guest-imagebase+GUEST_BASE, returning
direct addresses below0x08000000 before sparse lookup. Here0x9dc150 maps
to0x5ee150 and0xcd8ec0 to0x8eaec0. The nonzero hexdumps are valid direct
memory; sparse-list absence does not invalidate them.

Original `3d_d3d.dll` has a derived renderer: exported Create3dngn0x180011f0
calls constructor0x18001210, which replaces base vtable0x18014550 with
0x18014154 at0x1800121b. Derived +0x8c is ValidateCaps0x18003990;
+0x184 is0x180039f0, returning min(object+0x4190,object+0x4194).
The earlier base-class returnarg&3/max256 analysis was insufficient.

Renderer initialization0x18002c53 copies236bytes from its selected device
descriptor at[object+0x1924]+0x100. At0x18002c6b it reads descriptor+0x5c,
the D3DDEVICEDESC7 triangle dwTextureCaps; bit0x20 sets object+0x600 bit31.
ValidateCaps(1) at0x180039d8 tests that bit and returns bit1 when set.
game3d0x16026855 then adds16 to exponent7 before CacheSetSign, yielding23.
The method also has a table-based path; clearing one input restriction has
not yet been demonstrated to make its complete return valuezero.

Microsoft's [D3DPRIMCAPS documentation](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/d3dcaps/ns-d3dcaps-_d3dprimcaps)
defines SQUAREONLY as requiring square textures. The official
[DirectX header](https://github.com/microsoft/win32metadata/blob/main/generation/WinSDK/RecompiledIdlHeaders/um/d3dcaps.h)
assigns0x20. Shared `$fill_primcaps` reports0xffff, including this restriction,
to legacy/D3D7 GetCaps and EnumDevices. The software texture sampler instead
uses independent width/height for U/V and pitch for row addressing; the GPU
descriptor likewise retains independent dimensions. This is a concrete generic
capability-reporting inconsistency, not justification for editing original cache.

Prepared isolated source patch on1bb8c302a clears only SQUAREONLY to0xffdf.
Existing indexed-texture conformance is extended with ordinary 2x4 surface
creation, Texture2 GetHandle/bind, four row samples, a yellow fourth-row indexed
draw, and public GetCaps assertions for legacy1/2/3 and7 line/triangle caps.
Existing EnumDevices lifetime coverage checks that same restriction in all
callback descriptors, including D3D7, the actual game dependency.
Canonical build and both extended conformance tests pass (see validation below).
The original replay below subsequently verifies cache acceptance and world entry.

The blanket mask contains other unsupported, restrictive or unverified claims.
This proposal does not certify or replace the whole mask: its audit records
perspective/alpha/keyed/projected support paths; unnecessary POW2 and conditional
NPOT policy; unverified repeat precision, palette alpha, cube maps and filtered
color-key behavior; obsolete BORDER and undefined DX7 bits0x200/0xe000.
Those require separate capability-specific evidence before changes.

Next, only under a new runtime grant, run the untouched original demo once with
the new module, normal Tutorial input and persistent dumps. Check signature,
cache acceptance and whether loading reaches a world independently. Even a
corrected signature does not establish that later fallback/loading paths work.

### Capability conformance validation (2026-10-13 23:33–23:35 UTC)

On isolated base1bb8c302a, canonical build passes with module
0918dec0eba2b3f0a6a0f0c1423fe273a9c95f530acb3108d01699f481ffb7ab.
The extended indexed-texture test passes: original2x4 allocation, allfour
row samples, fourth-row indexed drawing and GetCaps1/2/3/7 restrictions.
EnumDevices lifetime passes96balancedcycles and32real x86 nested cases,
including line/triangle restriction assertions for1/2/3/7 callbacks.

The first enumeration attempt stopped before assertions because this isolated
checkout lacked test/binaries/notepad.exe. The unchanged existing fixture from
DLLwork was copied (SHA e7b01ab85a35ba6f577067d13efa522dc3d605de7712340e4acaf7065f866340);
its loader initializes thunks, not Notepad application code. Only enumeration
and the negative were resumed; the passing build and indexed test were not repeated.

Restoring only0x20 in the shared mask makes the same indexed test print its
rectangular-allocation/sample/draw success marker, then fail the intended
GetCaps assertion32!=0. Thus the negative proves the old advertised restriction
is inconsistent with already-working rectangular rendering; it is not a fixture
or graphics-setup failure. The corrected source was restored and allfour
original proposed file hashes matched at completion.

Evidence:20261013T2333Z-sacrifice-caps-validation and
20261013T2335Z-sacrifice-caps-validation. Finished23:35:11.130; allnine owned
PIDs and allpositive/negative process-group checks reportESRCH23:35:36.368.
Runtime released to the coordinator. No original Sacrifice replay occurred;
cache acceptance, later loading and gameplay remain unverified for this module.

## Original cache acceptance and tutorial world (2026-10-13 23:45–23:48 UTC)

Run `20261013T2345Z-sacrifice-square-caps-original` uses exact tested
source dd3bf9aad and module0918dec0, with current test/run SHAde8d48cd
(the !hostExitRequested diagnostic guard is present). Driver4e850662 verifies
source/module/CRT/manifest identities and both observed module mappings before
every ordinary command. No new build or original-file/config/cache edit occurred.

Normal Single Player, relative pointer(-80,-29), reviewed Tutorial1 hover and
held click now progress beyond the old loading failure. Live and exit dumps
both show exponent7 and expected cache signature7, matching the original cache.
Named file tracing reads tkhsDMXS.000 to offset189096, exactly its original
length, with no target DeleteFile. Final counts: cache-check5, comparison5,
success5, rejection0, cached-loader5, fallback0. These are aggregate counters;
the named complete file-read trace independently identifies the target cache.
The previously missing tkhsDMXS.001 fallback is no longer taken in this run.

Seven images were reviewed. 05-after-cache.png shows the 3D landscape and
wizard during a letterboxed introduction. 06-after-w.png and final.png show
the actual tutorial world, wizard, HUD and minimap; final is800x600.
02-selector.png was queued immediately after the Single Player click and still
shows the main menu; its filename must not be mistaken for successful selector
evidence. 03-hover.png independently shows the selector and Tutorial1 tooltip.

Player movement remains unqualified. Ordinary W down/up arrived at
batches148319/156707, but the introduction transitioned into a Familiar
movement-instruction prompt, and Continue was never dismissed. Differences
between these pictures cannot isolate input from the introduction or animation.
The next authorized ordinary route is Continue dismissal, a stationary baseline,
W held3seconds, then an after-release stationary comparison using world
landmarks/minimap position. This is ordinary tutorial UI, not an acceptance prompt.

The standard160-second harness guard stopped the run at batch158891 with
host exit0; this is not the former original decoder failure exit. Terminal
23:48:14.890 confirms child cleanup, and217952/217960 plus both negative
process groups were independentlyESRCH at23:48:29.965. All115 original
post-run file hashes match. Twenty-one artifacts were SHA-verified locally,
then investigation metadata published last; archiveSHA
b1320868884cc3190a9df3d18acd3761b152338028799a52aaa1e1fb06eae639.
Cache compatibility and rendered tutorial world are verified; player control,
audio, frame rate and broader gameplay are not yet qualified. No deployment.

### Original tutorial forward movement, 2026-10-13 23:55 UTC

Run `20261013T2355Z-sacrifice-continue-controls` used unchanged tested source `dd3bf9aadfc441fd0ed8013e22ec2440eb256b4a`, module `0918dec0eba2b3f0a6a0f0c1423fe273a9c95f530acb3108d01699f481ffb7ab`, and all 115 original fixture files. Signature and exponent remained 7; the five cache checks accepted with zero rejection/fallback hits. All 115 post-run hashes matched. The standard 240-second harness limit ended the run normally; supervisor, guest and movement helper plus negative process groups were independently absent at 23:59:38.260 UTC.

Two ordinary Continue clicks advanced the W/S and A/D instructions. At the 800x600 world surface, injected relative mouse deltas scale by 1.25 from the 640x480 capture coordinates: the first attempted Continue hover overshot, and was corrected and visually reviewed before clicking. `06e-prompt.png` shows a brief overlay-free frame, but a third ESC/options instruction appeared before the movement baseline. It remained throughout the comparison; tutorial completion is not claimed.

The guarded helper captured `07-control-before.png`, waited two seconds for `08-stationary-before.png`, held W from 23:59:06.300 to 23:59:09.304 UTC, then captured `09-after-w.png` and `10-stationary-after.png` three seconds apart. Before images share fixed tree/hill/minimap positions despite wizard animation; after images show substantial persistent landscape and minimap displacement, then remain at the new positions after release. This verifies forward player movement independently of the intro transition, with the later tutorial overlay present. Turning, combat, tutorial completion, audio and frame-rate quality remain unqualified. `04-world.png` is a transient bright false-color frame, not stable rendering evidence.

Evidence includes every screenshot, ordinary command queue, helper timestamps, full logs, source/module/fixture pins, cleanup and post-hashes. `findings.json` records per-image review; `artifact-hashes.json` hashes the artifacts, with `investigation.json` published last.
