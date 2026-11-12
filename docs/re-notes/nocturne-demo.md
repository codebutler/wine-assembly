# Nocturne demo

Source: https://archive.org/details/NocturneDemo
NocturneDemo.zip84965751bytes SHA1b56df8ca1a91a21803482897748c46d6678a5866
verified before extraction. Evidence0927Z-nocturne-source retains metadata,
receipt and listings.7z yields InstallShield files; unshield extracts17files.
Remote bx_4xqkagnv /home/user/nocturne-demo-preflight/unpacked.
Absent current apps/corpus/TODOS on selection; not a public title variant.
Private compatibility fixture; no public deployment or redistribution claim.

Program_Executable_Files has nocturne.exe, tridx6.dll/trid3d.dll and9PODs.
System_Files/system contains nocturne.ini and RENDER.INI. Original defaults
640x480x32,useDirect3D=1,rendererDLLPath=tridx6.dll; preserve first.
Readme WINDY CITY MASSACRE Chapter6 Crescent Theater: F1 controls, arrows
walk/turn, D draw weapon (keyboard mode), Space use/fire, G jump.

0931Z initial launch mounts INIs under C:\WINDOWS\SYSTEM and reaches
Please copy Nocturne to your hard drive (inivar.cpp82), no crash.
0933Z focused file trace establishes FindFirstFileA .\system\nocturne.ini
returns INVALID_HANDLE. Installer System_Files component belongs beneath
game directory, not Windows system directory.0934Z copies its contents
into Program_Executable_Files preserving system/, retries original binary.
Build main0304+pending Z16/Winsock+FMUL462848051 PASS; all tests remote.
Local test/binaries/candidates/nocturne-demo/game/ absent; source remains remote.

0934Z corrected layout reaches reviewed Work in progress / Press any key
intro,10000 batches17.223s,no crash.0935Z Enter down3000/up3010 remains
on intro at10000batches17.376s; not proof of input failure (brief input may
precede input-ready state). Next late held key or ordinary browser input
after observing ready intro. Never count this screen as menu/gameplay.
All commands/module/executable hashes/screenshots retained in run directories.
No runtime source edits or executable patches.

## 2026-10-12 09:44Z — introduction consumes character input

Main remote0304 unchanged; fork bx_yesd9e5h retains original source/layout.
0940Z Enter held11000-11500 still intro at16000,26.645s.
0942Z keypress32 at11000 advances to reviewed custom Warning:128.0MB free
swap,at least200MB recommended. Use WM_CHAR/ordinary typed character for
this intro; do not infer a keyboard-emulation failure from WM_KEYDOWN alone.
0944Z adds keypress32 at18000 to dismiss warning normally,26000batch/60s
bounds. No global-memory API change or guest patch.

0944Z ordinary second Space dismisses the swap warning and enters calibration.
0945Z screenshots show steps2/3/4;0948Z grouped character events finish
calibration and reach reviewed animated START/OPTIONS/LOAD/QUIT menu.
Space at11000/18000, then27000/28000/29000/30000/31000; further Space
32000/33000 leaves main menu selected START. FirstTime configuration was
not hand-edited; every transition came from ordinary character input.
0951Z adds Enter keydown/character at34000/34001,release34500 to activate
START; bounded120s/50000batches. No gameplay claim until screenshot reviewed.

0951Z START via Enter key+character opens story selector.0954Z Down twice
then Enter selects Volume3 Windy City Massacre and opens chapter selector.
Final screenshot reviewed: Chapter1 selected, Chapter6 Crescent Theater is
the demo chapter identified by original README. Next Down five times and
Enter, then wait for actual world and verify arrows/draw/fire input. No gameplay
yet. WM_CHAR Space, not VKEnter alone, advances intro/calibration pages.

0954Z --save-vfs-suffix=.ini exports guest settings under remote
/home/user/nocturne-story/saved/system/nocturne.ini (copy saved-nocturne.ini
retained with evidence). Inspect/use original guest-written state to avoid
replaying calibration; no hand-written bypass. All runs use same module
5e8f1716...69a (main0304+pending Z16/Winsock+FMUL), not clean main.
CLI run0954Z ends normally50000batches104.217s; no FPS inference.
Old workers unchanged/completed; no new receipts. DR2 queued semantic
command/selection comparison remains, no new conclusion from these tests.

## 2026-10-12 10:05Z — Chapter6 world loads

1001Z on bx_vhk6nrm7 selects Chapter6 via five Down keys42000..46000,
then Enter47000/47001. selected.png reviewed correct Crescent Theater.
Final55692batches/180.013s shows dark 320x320 rendered scene and character;
no crash. This is world entry, NOT yet player-control verification.
Next baseline checkpoint after scene load, ordinary Up movement/turn and
D draw/Space fire; use original F11 gamma key if visibility needs it.
All evidence collected before switching remote source back to pre-FMUL
DR2 control; reapply462848051 for any exact Nocturne module replay.

## 2026-10-12 10:19Z — Ordinary walking verified

1015Z-nocturne-movement on bx_vhk6nrm7 rebuilds exact5e8f1716...69a.
Same startup/chapter route. Before56000 and moved62500 reviewed: held
Up58000->62000 moves character from left toward doorway. CLI ordinary
walking is verified; final screenshot alone is not used as proof. F11
keydown56500/57000 produces no clear brightening; scene remains very dark.
Stops normally at63083batches/270.014s, status0; right-turn keydown63000
just begins. Planned draw65000/fire66000/action69000 never execute.
action.png is absent because its batch was never reached, not lost evidence.
No weapon, audio or FPS claim. Build/command/environment/exit/log and
selected/before/bright/moved/final collected. Initial restore transfer hit
argument-size limit and scp API denied; chunked exec transfer succeeded,
module hash verified before sole CLI run. No gameplay repeat for transfer.
Next register local-only nocturne_demo route and validate ordinary browser
walking, original brightness/calibration UX and weapon use. Source assets
remain remote, local test/binaries/candidates/nocturne-demo/game absent.

## 2026-10-12 10:35Z — Registered browser walking and firing

Local-only registration6ec2393d9 pushed: app nocturne_demo, candidate
nocturne-demo, original17files under game/ with System_Files/system kept
as game/system. Arrow touch pad plus Fire/use, Draw, Jump, Confirm, Menu.
Prepare and JS syntax/entry checks PASS; touch buttons not yet exercised.

1033Z-nocturne-browser-held on bx_n7d6u8rt, Chrome155.0.8059.39/WebGL/worker,
COI true, exact module5e8f1716...69a. Ordinary Space clears startup and
calibration.300ms key presses select Volume3/Chapter6; reviewed chapter,
before, moved, action. Up4s displaces character; D then Space2s shows
weapon HUD and muzzle flash. Browser walking/firing verified, no FPS/audio
claim. Scene remains dark; brightness calibration and touch next.

1027Z first browser never launches guest: fork omitted build/wine-assembly.wasm
and fallback compiler request HTTP404. Build restored and module hash checked;
not a Nocturne runtime regression.1029Z built launch reaches menu but near-zero
Enter press misses state polling, stays on Start; held300ms resolves. Original
touch code already has minimum key hold for polled games, so no speculative
input-engine patch added. All evidence collected. Result published only for
1033Z reviewed gameplay; main integration remains ops-owned.

## 2026-10-12 10:50Z — Actual touch gameplay verified

1046Z-nocturne-touch-prepared, bx_qbqexdmu, Chrome155,844x390 mobile touch
emulation, exact5e8f1716 module. CDP actual touch only for startup/menu/play:
Continue sends char32 (held Fire only emits key state); Confirm stays held
for the touch duration. Pad300ms steps select Chapter6; Up4s visibly walks;
Draw weapon and Fire/use2s shows muzzle flash. Reviewed chapter/before/moved/
action and all controls visible. Fix7e3ca695a on codex/dr2-registration.
Physical devices/Safari, jump and menu return not qualified by this run.

Separate keyboard F11 held2s produces no obvious brightening. Readme confirms
F11/F12 gamma controls, but one adjustment is not proof of a gamma defect.
Next repeated discrete F11 inputs plus existing gamma API tracing; no shader
or API patch without that evidence. WinePerf snapshot all zeros because the
probe did not enable collection (default disabled); not zero game FPS. Next
call WinePerf.start({draw:false}) before sampling; distinguish presentations
from logical frames. Audio remains untested.

Fork preflight must ALWAYS copy preserved original fixture to registered game/,
prepare candidate manifest, rebuild/check wasm hash, install Chrome.1042Z
HTTP409 was missing test/binaries/candidates/nocturne-demo on fork; initial
prepare failed same missing directory, copy from original extraction fixed
it (prepare-fixed.log). Earlier build absence similarly excluded generated
files. These are test setup failures, not guest compatibility regressions.
All successful run artifacts collected; evidence containment check clean.

## 2026-10-12 11:33Z — Brightness works; presentation sample recorded

1126Z-nocturne-gamma-perf, bx_vf7q3q2j, exact5e8f1716, Chrome155 worker/
WebGL,844x390 mobile emulation, ordinary touch startup/walk/fire. Read-only
gamma_ramp_gen/wa observed before/after10 discrete F11 and10 F12 keys
(300ms down,200ms gap). All three generation/address0; selective gamma
API tracing logs no matches. This does NOT imply brightness is broken.
Reviewed bright10/dark10 and fixed static wall crop x200..579,y60..159:
mean luminance1.745717->3.345841->1.745717. Original F11/F12 brightness
therefore works without shared display-ramp updates; no gamma patch needed.
Do not repeat the earlier inconclusive single-key brightness test.

WinePerf.start({draw:false}) before2s warmup, then touch fire2s/walk2s plus
6s observation. Presents30->180 over10.511285s =14.270377 presentations/s.
Collector reports logicalFps:null: do not label the60Hz host animation loop
or presentation rate as logical game FPS. Instrumented sample, no A/B or
physical-device performance claim. Full snapshots/per-frame summary retained.
No audio quality, real-device/Safari, jump or menu-return qualification yet.
All artifacts collected; published reviewed evidence passes containment checks.
Full fork preflight succeeded first try: original fixture copy, --prepare,
rebuild/hash, Chrome install. Main0304 unchanged, integration ops-owned.

## Integration reconciliation, 2026-10-13

Recovered from `origin/codex/wsasocket-capability` at `15b37458e` during the
release merge audit. The local-only registration and its required runtime fixes
are now on main. Earlier statements that integration is pending describe the
historical run, not the current branch. This recovery adds no fresh gameplay,
audio, performance, Safari, or physical-device qualification; retain the
recorded run IDs, module hashes, limitations, and failed attempts above.


## Automated recovery, 2026-10-14

Fresh acquisition from https://archive.org/download/NocturneDemo/NocturneDemo.zip verified84965751 bytes and SHA-1 b56df8ca1a91a21803482897748c46d6678a5866. Extract ZIP with7-Zip23.01, then data1.cab groups Program Executable Files and System Files. On this host unshield is absent: the existing tools/is5-extract.js fallback extracted both successfully. Copy those component roots into game/, preserving system/nocturne.ini and system/RENDER.INI exactly, without gameplay configuration changes.

Run `node tools/fetch-candidate-corpus.js --id=nocturne-demo`, then `node test/test-nocturne-recovery.js` on the freshly recovered tree. All17 original output files are pinned in test/candidate-corpus/nocturne-demo-files.json by path,size and SHA-256 and were compared byte-for-byte to the extracted components. The verifier is for pristine payloads: game-written configuration may subsequently differ. Private-fixture restrictions remain. No runtime/gameplay/deployment validation was performed in this recovery check. Source archive retained separately from Git; archive mirrors are not an availability guarantee.
