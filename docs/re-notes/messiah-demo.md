# Messiah demo

Archive source https://archive.org/details/messiahdemo, messiahdemo.exe
104,219,648 bytes SHA1 4b03de968e89c68ed2f34f856cc2190a63f9836b verified
2026-10-12 05:57Z. Evidence scratch/runs/20261012T0556Z-messiah-preflight.
7z extracts WinZip SFX20files (413 trailing bytes warning); unshield data1.cab
extracts300files, all in Program_Executable_Files. Copy that group contents to
game/ preserving pc/ layout. Prepared151,451,108bytes, per-file SHA256 receipt.
Remote /home/user/messiah-demo-preflight/game on bx_bhbvhvcc.

MessiahD3D.exe1,105,920bytes SHA256
1f622eca30b2554b61a41aa2ef33f07d42a1fd10493b754fbfc51ded5e4500a3.
MessiahGlide3x.exe1,052,672bytes SHA256
568b1df24ae601349dcc9a6de54ae51b974bb91b998451944fcea80ca351b1cd.
D3D imports DINPUT/DDRAW/WINMM/KERNEL32/USER32/GDI32/ADVAPI32/ole32.
Original safe-mode batch invokes MessiahD3D.exe -s -i -v -o +! -p; start with
ordinary unmodified D3D executable before changing launch switches.

Included readme: arrows move/turn, Ctrl jump/flap, Space combat/shoot, Backspace
depossess. No launch, gameplay, browser, touch, audio or FPS qualification yet.
No runtime/binary patch, no public deployment or approval accepted.


## First launch and initialization diagnosis (06:07Z–06:11Z)

0607Z plain launch stops at informational Error opening MCI Device; harness
reports idle modal and exits0, not a successful game.0608Z trace: mciSendCommandA
MCI_OPEN0x803 flags0x2000 at caller4015dd, type string7fd030=cdaudio.
0609Z documented -s (disable sound) still executes this open and fails; host
mci_open returns0 with no mounted disc. No absent demo file identified. MCI
empty-device behavior remains a separate compatibility issue; no fake media added.

0610Z ordinary click118,139 batch5 dismisses the error and advances to Messiah
window, then Unknown Error -2147483643 (0x80000005).0611Z API trace narrows this
to two IDirect3D7_EnumZBufferFormats calls. Guest callback40b590 rejects any
format with nonzero DWORD+16, then matches requested depth at+12. Caller40e0ea
returns0x80000005 if no format accepted after16-bit fallback. Our Z16 enumeration
writes0xFFFF at+16, but DDPIXELFORMAT+16 is dwStencilBitDepth; dwZBitMask is+20.
Microsoft struct reference: https://learn.microsoft.com/en-us/windows/win32/api/ddraw/ns-ddraw-ddpixelformat

Correction prepared in separate codex/zbuffer-format-mask branch off0304a8549.
Regression test for both D3D3/D3D7 callbacks fails old code65535!=0 as expected.
Game replay and final validation are recorded below when available. No source
change for the MCI warning, no public deployment.

Z16 fix committed/pushed3a4fcf883 on codex/zbuffer-format-mask off0304a8549.
Focused regression RED on original65535 stencil depth; GREEN on correction:
six enumeration front doors,36 nested pairs,120 allocation-balanced cycles/ABI.
Remote build gates PASS.0614Z replay after acknowledging MCI advances beyond the
Z-format error into rendering; first capture is largely white/logo fragments,
not gameplay. That replay hit default200 batches; longer0615Z run follows.
Corrected module SHA256 e246f5efe1dfc3e61515b94600f201e66000ef4ff89b42b8ae43b50cd22ded0d.
Runtime replay uses retained test source plus this correction, not clean main.

0615Z longer replay:4778 batches/60.013s,400840 API calls, exit0 at wall limit.
Reviewed final image remains white; no menu/gameplay qualification. Z-format
error no longer appears after ordinary dismissal of MCI warning. Next test the
documented -i (skip intro logos) and inspect render/assets if white persists;
keep MCI empty-CD behavior separate. No known missing extracted payload.


## Skip-intro control (2026-10-12 06:21Z)

Run 20261012T0621Z-messiah-skip-intro uses the documented -i switch, ordinary
MCI-warning acknowledgement, max25000 batches and60s wall bound. It completes
4457 batches/60.001s,374284 API calls, exit0; reviewed final.png remains white.
Module e246f5efe1dfc3e61515b94600f201e66000ef4ff89b42b8ae43b50cd22ded0d
includes the Z16 correction on the retained test tree, not clean main.
Skipping logos alone does not resolve the white frame. Next inspect rendering
and asset use, or compare browser output; no menu/gameplay qualification.
Fixture retained at /home/user/messiah-demo-preflight/game in bx_yafdtfn8.

## Texture failure narrowed (06:32Z–06:35Z)

0632Z-messiah-render-trace reaches1500 batches/18.566s,115440 APIs. White
primary slot23; surface census has7 live surfaces, no normal menu textures.
Repeated DrawPrimitive FVF244 from402c5e binds texture0. File tracing reads
pc\\Interfce\\Menu\\new\\MMainPlayGame1.TGA successfully (0x4b32c bytes); initial
missing cfg/inf are then created, and PC\\MESSIAH.SPT fallback succeeds. No
required missing payload established by this trace.

0634Z-messiah-texture-init captures full API sequence: device08140060 created
API349, released2266; new device081400c8 created2288. Subsequent texture code
still passes old08140060 to GetDirect3D at40c3a5, so it never reaches format
enumeration/CreateSurface.0636Z-messiah-parent-result single-address trace
confirms EAX0 before reset, EAX80004005 afterward at batches192,196–204.
Caller40c3a5 branches out on negative result. This is a concrete failure, but
not yet proof of an emulator lifetime bug: old interface use needs analysis.

Reconciliation: retained remote D3D core differs from origin/main0304a8549.
Main already includes dd75c48d3 GetDDInterface creator/reference fix; remote
snapshot still uses the old global-return implementation. Next replay exact
main plus Z16 correction before proposing another runtime change.

Clean-main reconciliation replay0638Z: downloaded the GitHub archive pinned
to0304a8549df15567b458d3a3c318609aa515e2ca into a separate remote directory,
applied only3a4fcf883 Z16 patch, restored stdole2.tlb; all build gates PASS.
Module3c3a4efe77335ac8af1719f435d222fc142b330f23ae234171ad42512588fb4d.
60.005s/2696batches/364967APIs, exit0; reviewed image remains white. Same
40c3a5 trace: first GetDirect3D returns0, after reset returns80004005 at
batches192–204 on old device08221060. Main's existing fixes do not resolve
this blocker. No new runtime fix inferred from stale-device use. Next inspect
the reset trigger and cached-device assignment/reference lifetime, and check
whether documented display configuration avoids that path without guest patches.
Evidence includes build log, exact patch, command, module hash and final image.
Main test source retained at /home/user/main-0304-z16 in bx_yafdtfn8 snapshot.

## Documented menu workaround succeeds (2026-10-12 06:45Z)

Original readme documents +! as the Windows2000 menu workaround, also used
by the supplied SafeMode batch. Run0645Z-messiah-menu-workaround changes
only args from -i to -i +! on main0304a8549 plus Z16 correction. Build PASS;
GetDirect3D at40c3a5 now returns0 throughout texture setup, and reviewed
final.png shows the complete Messiah main menu.2177 batches/60.026s.
This is an original supported launch option, not a guest code/state patch.
The initial MCI informational warning still requires ordinary OK.

0647Z short click at Play Game leaves main menu.0649Z Enter down600/up620
advances to START GAME with NEW GAME selected; reviewed screenshot. Gameplay
is not yet qualified. Next held Enter selects New Game, then ordinary movement.

Local-only registration messiah-demo / messiah_demo adds -i +!, original
300-file fixture instructions, and readme-derived touch controls.0652Z remote
--prepare PASS; EXE SHA256 matches the original. Global corpus --dry-run
stops at the pre-existing baldurs-gate-interactive-demo source/hash assertion
before selected Messiah execution; not a passing whole-corpus test. Browser
registration and actual touch gameplay remain to verify.

0655Z second held Enter reaches SELECT DIFFICULTY, default Prophet.
0657Z actual registered --app=messiah_demo route, third held Enter at1600,
reaches rendered3D level/HUD.0659Z same registered route: before7000, Up down
7020/up7220, walk7250, Right down7300/up7350, turn7400. Reviewed captures
show movement toward the red door and a changed view, establishing ordinary
CLI player input. Overlay FAILURE TO READ FROM AUDIO CD persists; do not
claim audio works. Browser/touch/FPS remain separate validation.
Registration f776e34ab plus formatting-only366593e6f pushed on
codex/dr2-registration; apply both (final diff47lines). It depends on the
Z16 fix3a4fcf883. Prepare299 data files plus original EXE, hash verified.

0700Z registered Chrome155/WebGL/guest worker route: ordinary Enter closes
MCI message and advances menu, held Enter selects New Game/Prophet. Reviewed
before/walk/turn captures show actual keyboard-controlled movement.
0705Z fresh browser at1000x800 with touch enabled, then844x390 viewport:
reviewed phone-before/after and touch-input.json show actual CDP direction-pad
up gesture3500ms moves character toward door. Touch controls visible.
Core compatibility ready for review. No FPS/sound/physical-device/Safari or
complete action-button qualification. Initial MCI audio-CD warning remains,
and CLI displays FAILURE TO READ FROM AUDIO CD; separate follow-up needed.
No desktop/public distribution or deployment.

## Integration reconciliation, 2026-10-13

Recovered from `origin/codex/wsasocket-capability` at `15b37458e` during the
release merge audit. The local-only registration and its required runtime fixes
are now on main. Earlier statements that integration is pending describe the
historical run, not the current branch. This recovery adds no fresh gameplay,
audio, performance, Safari, or physical-device qualification; retain the
recorded run IDs, module hashes, limitations, and failed attempts above.


## Automated recovery, 2026-10-14

The original installer at https://archive.org/download/messiahdemo/messiahdemo.exe was freshly downloaded and verified against SHA1 4b03de968e89c68ed2f34f856cc2190a63f9836b (Archive metadata size104219648). The recipe extracts the SFX, then archive/data1.cab group Program Executable Files using existing unshield/is5 fallback, and copies the untouched group to game/. On this host unshield is absent; the existing JS fallback succeeded.

Run `node tools/fetch-candidate-corpus.js --id=messiah-demo`, then `node test/test-messiah-recovery.js` on the pristine tree. All300 original files are pinned by path,size,SHA256 in test/candidate-corpus/messiah-demo-files.json and compare byte-for-byte with the extracted component. The D3D executable matches its prior recorded hash. Existing launch switches and private-fixture restrictions are unchanged; no new runtime/gameplay/audio/FPS validation or public deployment. No synthesized configuration or executable modifications. Recovery remains dependent on upstream availability.
