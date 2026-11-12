# Sanity: Aiken's Artifact demo

Source: https://archive.org/details/sanitydemosetup
Archive metadata identifies Monolith Productions/Fox Interactive,2000.
Original sanitydemosetup.exe:64250880bytes,
SHA1 000cd1c36262a1a883fd6d6b67d6629e732d5b9d.
Absent current app registry/corpus/TODOS when selected as ThiefII refill.
Private compatibility fixture; no public redistribution or deployment.

## Source preflight 2026-10-12

Metadata/search receipts: scratch/runs/20261012T0748Z-next-source/.
Remote bx_vujsz54x destination /home/user/sanity-demo-preflight/.
Initial ia800507 mirror times out160s with22036462bytes,
SHA1 a01607ef7282a9b6ee02a8730e21f6ef29179570 (NOT complete).
No extraction/launch performed on that partial. Single resume from ia600507
with curl -C - and280s guard is in progress; require full hash before7z.
Missing game executable/prepared game/ path until extraction is verified.

Final receipt0759Z-sanity-final-resume:08:01:50Z full64250880 bytes matches
required SHA1; 7z extraction exit0. All source bytes now verified.
Game/ contains29 files including Game/LITHTECH/Sanity.exe1028096bytes,
SHA256 d93f5b187d9e7eba07fa5cbcda7ae07f7c28311c85a37beb347a81e905be5e64,
client.dll/server.dll/d3d.ren/Miles/Bink and original config. Additional Data/
directory exists beside Game/; inspect its contents and original readme/setup
layout before composing the VFS. Preserve original paths until established.
Custom source root survives forks; test/binaries does not.
No guest launch yet. Next restore/fork bx_vujsz54x, inspect readme and Data/,
prepare local game layout, bounded original launch, then registration/input.
Boat API transport failed while resume kept running; checked actual process
and receipts, never launched concurrent writers. All transfers named evidence
files only; no source assets copied onto disk-constrained coordinator.

## First launch and exact blocker 2026-10-12 08:15Z

Remote bx_kd2gte5j rebuilt main0304+Z16+existing pending Winsock; build PASS,
module SHA256 6b6d56337acd65b64de5c2192efed64df64562f3865e602ccbb809a44be18ab1.
Game tree mounted at C:\, Data/SANITY.REZ at C:\SANITY.REZ, cwd C:\LITHTECH.
0812Z-sanity-first reviewed launcher; 0813Z-sanity-launch reviewed detail chooser.
Ordinary clicks (305,47), then Medium (212,256), produce ShellExecute file
CLIENT.DLL with -windowtitle Sanity -rez ..\sanity.rez -rez ..\sounds.rez
-rez ..\talents.rez -rez ..\custom -rez ..\sanityl.rez ++globaldetail 1
++Lightmap 1 ++GroupOffset0 1. Parent then exits with EIP0; child not launched
by this CLI route. client.dll is an executable PE (characteristics0x10f,
entryRVA0x7af4f), so direct launch with the observed arguments is legitimate.
0814Z-sanity-client loads cshell/cres from REZ, d3d.ren, Miles and input, then
reports 'Could not create the Interface Manager object'. No gameplay.
0815Z-sanity-files bounds tracing to80batches: last CreateFileA FontData.fnt
returns INVALID_HANDLE immediately before that error. Original extracted tree
contains no loose font file. Labeled follow-up corrects an ambiguous combined
strings output: SETUP.INS has NO FontData string; SANITY.REZ contains it at
offset1494536 among embedded font-manager code. A failed optional file open
is not proof of the error cause. Next trace font initialization and its first
failing return (font metrics/surfaces/file fallback), without assuming a
missing installer-generated file.
Do not invent font bytes or patch around failure. Also missing system shell32/
comctl32 fixture warnings, but neither trapped before this observed failure.
All five run directories retain commands, module identity, logs and captures
under scratch/runs/20261012T08{12,13,14,15}Z-sanity-*; no result.json until a
corpus ID exists. No registration, browser gameplay, audio or FPS claim.

## Font pixel mismatch isolated, 2026-10-12 08:28Z

Same module6b6d5633, remote bx_sbqrfe79 rebuilt successfully.
0821Z-sanity-font API trace shows optional FontData.fnt open failure followed
by hundreds of surface reads; 0823Z-sanity-surface shows slot527 populated
(first nonzero word0xf81f). Thus missing cache is not sufficient diagnosis.
Saved generated cshell.dll/cres.dll remotely in /home/user/sanity-vfs/windows/temp.
cshell original base10000000 maps to runtime00b50000. Font cache reader
10096990 returns false on absent file; glyph-boundary fallback10096b10 calls
10096d50 to read pixels. Exact dynamic evidence0827Z-sanity-glyph-va at
00be6c99 returns597 (full font width), with caller00be6e66 (scan exhaustion).
0828Z-sanity-pixel at00be6db7 captures object01a1b4fc: font14PIXELANTI,
width597 height14, expected background00ff00ff. Pixel at(3,0) returns00fe00fe
in output074ff554. At(7,0), pixel0. No guest memory patches were used.

client.dll GetPixel0040c920 decodes565 into a5-bit expansion lookup at0049836c.
0829Z/0830Z dumps confirm lookup[31]=254, not255. Constructor0040cc70 executes
FILD i64(index); FMUL f32[0048b7cc]=255; FMUL f32[0048b7e4]=0.032258063554763794;
_ftol00478a64. Numerical comparison with original constants: f64 gives
254.9999924004078 -> trunc254; staged f32 gives255. Current06-fpu.wat explicitly
ignores x87 precision-control. This is a strong precision lead, NOT yet a
validated emulator fix: establish guest CW during table creation and compare
matching native x87 before changing arithmetic (including optimized paths).
Do not patch the font bitmap/table or supply fabricated FontData.fnt.

Diagnostic limits:0824Z breakpoint did not fire;0825Z/0826Z module-relative
probes supplied RVAs where resolver expects original VA, so those negative
results prove nothing. Absolute return-site probes0827Z/0828Z worked.
0829Z inside optimized _ftol did not fire;0830Z return-site probe hit8 of32
iterations, so its overwritten stack is NOT a trustworthy CW observation.
Numerical JSON, relevant client disassembly and pixel receipts are named
artifacts in0828Z-sanity-pixel. All captures remain investigation-only until
a corpus registration exists. No new gameplay, audio or FPS claim.

## Native precision reference and causal diagnostic, 08:35Z

0833Z-sanity-precision adds a READ-ONLY get_fpu_cw export and extends existing
TRACE-AT formatting on the remote build only. CW at table-store return0040cc9d
is003f: PC=24-bit, RC=nearest. Matched native x86 inline-assembly executes
FILD qword31; FMUL f32(255); FMUL f32(1/31); switches RC totruncate for FISTP.
Native results: CW003f/007f=>255, CW027f/037f=>254. Source/native.txt retained.
Thus ignored PC causes a confirmed arithmetic mismatch, not missing game data.

0835Z-sanity-mul24 is a deliberately INCOMPLETE diagnostic: wrap FMUL in
fpu_arith with f32 demote/promote when PC=00. Default optimized run still
fails Interface Manager (optimized x87 memory multiply bypasses helper).
0836Z-sanity-mul24-scalar uses same variant plus --no-uop --no-x87-fusion:
lookup[31]=255 and reviewed final.png shows Sanity main menu. No gameplay.
Variant build logs, module hashes, commands and diagnostic-change.json retained.
The variant is NOT a production fix: f32 demotion wrongly narrows exponent
range, ignores directed rounding and misses optimized/register arithmetic.
No guest/table/asset patch, no source pushed except investigation notes.

Next implement tested generic x87 PC24 arithmetic with exponent-safe rounding,
correct rounding controls and interpreter/fused/uop parity; scope optimized
paths carefully and validate the exact31*255*(1/31f) native reproducer.
Then ordinary-input gameplay/browser validation, local-only registration.
Remote bx_npc237ek retains diagnostic code; original baseline06-fpu.wat in
/home/user/sanity-mul24/original-fpu.wat. Restore that and remove read-only
export/TRACE-AT addition before treating later module as baseline.

## 2026-10-12 08:50Z — scoped FMUL fix pushed

Commit 462848051 (codex/x87-mul-pc24, off main0304) applies CW PC24
precision reduction to scalar/register/pop and optimized x87 FMUL paths.
It retains f64 exponent range, handles signed zero/NaN/infinity/subnormals
and the four rounding controls during precision reduction. This remains
f64-backed x87-lite: extended exponent range, rare double-rounding, other
arithmetic PC handling and exact directed multiplication remain limitations.

Remote build, 72 dedicated precision checks, mixed-PC differential fuzz
(400 sequences/7178 instructions), 31 pipeline cases and comparison tests
PASS. Evidence: scratch/runs/20261012T0846Z-sanity-mul-fix/.
Runtime module 5e8f1716da42ea23e7d26c4389153a31f0ece9c02afc7bb9f78cc4b897bf069a
also contains pending Z16/Winsock prerequisites; do not call it clean main.
Read-only CW export and diagnostic trace edits were removed.

Default optimizations now reach reviewed main menu (0847Z-sanity-default-fixed).
Ordinary Enter at batch600 opens Headquarters/Temple selector
(0849Z-sanity-single-player). Both final.png files reviewed; neither is
player-controlled gameplay. Headquarters loading is the next bounded check.
No fixture/table patches, public deployment or main merge.

0851Z-sanity-headquarters: ordinary second Enter at batch700 opens reviewed
difficulty menu (Brain Dead / Mentally Stable / Get Me a Straight Jacket).
No load failure established: this is an additional menu step. Next Enter
at batch800 selects default Mentally Stable. Commands/receipts/screenshots
are self-contained under each scratch/runs/ directory.

0853Z-sanity-difficulty: third ordinary Enter at batch800 loads Headquarters.
Reviewed final.png shows Cain standing on the blue headquarters floor and
a tutorial Info panel explaining mouse walking/running; no crash, bounded
120s run ended normally at3807 batches. This is a rendered in-level tutorial,
NOT yet verified player movement. Next dismiss text using an ordinary click
in bottom panel, then right-button movement with before/after screenshots;
register the original client route and validate Chrome separately.
All named evidence collected. Remote bx_k293q9e3 retains candidate code and
original source; no diagnostic observer exports. FMUL fix462848051 pushed
for ops integration. Removed its clean pushed local worktree to recover70MB;
local disk still below2GB, so all heavy work stays remote.

## 2026-10-12 09:07Z — movement timing correction

Main remote ref remains0304. Fork bx_ahkvwes2 from bx_k293q9e3.
0900Z-sanity-movement failed before guest launch because fork omitted
/home/user/main-0304-z16/test/binaries/tlbs/stdole2.tlb; restored existing
15088-byte fixture from coordinator. Build PASS, receipts preserved.
0903Z-sanity-movement retains module5e8f1716...69a and completes4438 batches
in150s. Reviewed before2800/dismissed3000 show Processing lightmaps;
after3500 is opening camera, final is tutorial with Cain. Therefore the
2900 click/3110-3400 right-button interval was premature, not evidence
of broken movement. Retry0907Z moves before/click/dismissed to4500/4600/4800,
right-button4910-5300, after5400; max5600 batches/240s. No source changes.

0907Z-sanity-post-load-movement completed with reviewed ordinary-input
gameplay: before4500 shows tutorial; click320,440 at4600 dismisses it;
dismissed4800 shows HUD and Cain near center of octagonal floor; pointer
450,280 + right button4910-5300 moves him toward floor edge in after5400.
Final5600 preserves displaced position. No guest code/state mutation.
Actual run09:06:13.931Z-09:09:49.430Z, guest log5600 batches/212.085s.
Receipt records status0 but also spawnSync ETIMEDOUT; retain that wrapper
anomaly, not a guest crash (normal final stats/PNG exist). Module remains
5e8f1716da42ea23e7d26c4389153a31f0ece9c02afc7bb9f78cc4b897bf069a.

Next register candidate sanity-demo/app sanity_demo, preserving Game contents
under game/, Data/SANITY.REZ at game/SANITY.REZ, client.dll at
game/LITHTECH/client.dll, cwd C:\LITHTECH and original -rez args. Browser
manifest fileRoot game supplies C:\ paths; exeGuestPath should preserve
C:\LITHTECH\client.dll. Verify registered CLI/browser, then touch/audio/FPS.
No public deployment; source/extracted payload lives only on remote snapshot
bx_ahkvwes2. Local test/candidate-corpus/sanity-demo/game/ not prepared.
Dark Reign2 next remains semantic command/selection ownership or matched
CLI observation interval; no repeated queue/pause/difficulty controls.

## 2026-10-12 09:23Z — registered browser gameplay

Registration c0fd4c80a pushed on codex/dr2-registration: candidate sanity-demo,
app sanity_demo, local-only original client route; touch Move/Action/Confirm
controls supplied but not validated. Depends on FMUL462848051.
Prepared29 companion files at remote test/binaries/candidates/sanity-demo/
with Game layout and root SANITY.REZ.0915Z build PASS, prepare-fixed PASS.
Initial local-demo-installers destination mistake corrected before browser.
Fork bx_g2kr5b2c omitted Chrome;0916Z browser did not start. Restored
Puppeteer Chrome155.0.8059.39, new0918Z evidence folder preserves successful
registered /emulator/?debug&app=sanity_demo test.

Reviewed main menu, level selector, difficulty, opening sequence and tutorial.
Click235,535 dismisses text panel; before-move shows Cain near platform
center. Right mouse at330,420 held3500ms moves him toward edge in moved.png.
Chrome155/WebGL/worker mode,800x600, module5e8f1716...69a. No guest writes.
result.json published after named artifacts; evidence check has zero errors,
missing or invalid records for this run. Audio/FPS/touch/real-device unverified.
No public deployment; main0304 unchanged, ops owns integration.
Local test/binaries/candidates/sanity-demo/game/ remains absent intentionally
on disk-constrained coordinator; full verified prepared fixture preserved
on remote bx_g2kr5b2c snapshot.

## Integration reconciliation, 2026-10-13

Recovered from `origin/codex/wsasocket-capability` at `15b37458e` during the
release merge audit. The local-only registration and its required runtime fixes
are now on main. Earlier statements that integration is pending describe the
historical run, not the current branch. This recovery adds no fresh gameplay,
audio, performance, Safari, or physical-device qualification; retain the
recorded run IDs, module hashes, limitations, and failed attempts above.


## Reproducible acquisition, 2026-10-14

The formerly manual recipe is now automated. Archive.org metadata independently lists sanitydemosetup.exe,64250880 bytes,SHA-1 000cd1c36262a1a883fd6d6b67d6629e732d5b9d. A fresh fetch from https://archive.org/download/sanitydemosetup/sanitydemosetup.exe passed that hash, extracted with 7-Zip23.01, copied archive/Game/ to game/, and copied archive/Data/SANITY.REZ to game/SANITY.REZ. No configuration bytes were synthesized.

Recovery: `node tools/fetch-candidate-corpus.js --id=sanity-demo`. Verify pristine output with `node test/test-sanity-recovery.js`. The checked-in test/candidate-corpus/sanity-demo-files.json pins all30 original output files by path,size and SHA-256; each was compared byte-for-byte with its source extraction. Mutable configuration may change after playing, so run the verifier on fresh recovery. Existing private-fixture licence limits remain; no binary or runtime screenshot committed. This is successful clean acquisition, not new gameplay/audio/FPS validation or a guarantee of upstream availability.
