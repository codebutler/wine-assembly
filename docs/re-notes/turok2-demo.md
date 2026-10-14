# Turok 2 demo: source and launch layout

Source: https://archive.org/details/turok2demo, `turok2demo.exe`,
23,873,852 bytes, SHA-1 `d985ae568ad2f5dfc50f7592681ba10201278020`.
Downloaded and hash-verified on boat bx_9xcsfw7s on 2026-10-11.

The outer executable is a ZIP self-extractor. Extract it with 7z, then use
current-main `tools/is-cab.js <extracted-directory> --extract=<game-directory>`
on its InstallShield 5 cabinet/header pair. This extracted 21 files without
errors. The game `Turok2Demo.exe` SHA-256 is
`478e2cf70395a54422bbb4dafd5229905e2777b37b32677b2cd6884b9f500a2c`.
The README describes the demo and retail options, but no redistribution grant
was established. No installer approval was answered or public deployment made.

The raw cabinet extractor places the resources beside the executable. A launch
then displays `Can't find level set file "data/Turok2Demo.lss"`.
Copying the unchanged `.lss`, `.lsm`, `.spc`, `.bpc`, `.bmf`, `.dat`, `.dft`,
`.mnu`, `.11k` and `.11c` resources into `data/` clears that message and reaches
the main menu. This is a measured provisional layout, not a reconstruction of
every installer action. Preserve the original extracted tree.

Evidence: `scratch/runs/20261011T1423Z-new-game-refill/turok2demo/`.
After restoring missing `stdole2.tlb`, the retained IW diagnostic runtime and
a fresh full build of main `3cf8095385f2ecb4ceb7a8043ee0e452bd1eafa4` both
reach the menu. Their menu PNGs are byte-identical. Main WASM SHA-256 is
`8bbd5421028fafccf89a3fd29cd02a67d7fe116e11def181ca5f1bcc93736555`.

Ordinary mouse input at `(320,216)` selects Single Player and displays
`Building Texture File...`. The 400-batch capture is loading, not gameplay.
Use `--stuck-after=0` for an input replay: the default stuck detector exits an
idle menu before later scheduled input. The tested schedule is mousemove at
batch 30, mousedown at 35 and mouseup at 40, with 100,000-block batches.
No gameplay, FPS or audio qualification yet. Native comctl32.dll/ole32.dll
absence is logged; neither has been established as causal.

The extended current-main run clears texture preparation and selects the
Glide3 renderer (`T2-Glide3 v1.0`), then traps on `_grEnable@4` with argument 2.
`src/09a8h-glide.wat` intentionally fails unsupported Glide3 enables; do not
turn this into a silent-success stub. This is the first demonstrated loading
blocker, not missing level data. The next actionable checks are the game's
ordinary Video settings for its bundled Direct3D renderer, and the precise
semantics of the requested Glide3 feature if that route is retained.
`loading.log` and `loading-receipt.json` preserve the failure; no final PNG was
written after the trap. No approval input was sent.

## Ordinary Video settings route (2026-10-11)

On current main, click Options at `(320,328)`, then Video at `(320,254)`.
The Options screen renders correctly, but Video opens a blank white dialog;
no renderer selector is visible. Restoring the original shared comctl32.dll
(SHA-256 `28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4`)
does not change that visible result. Do not report Direct3D selected or guess
coordinates for invisible controls. The next step is the Video dialog's
initialization/painting, or genuine Glide3 enable support.

Reviewed images and receipts are in
`scratch/runs/20261011T1436Z-new-game-continuation/`:
`turok2-options.png`, `turok2-video.png`, and
`turok2-video-common-controls.png`. Runs are CLI-only, not browser validation.
The fork omitted the build, stdole2.tlb and some Node dependencies; the final
image runs follow a full build, restored TLB, and a clean dependency install.
Earlier no-image attempts are retained as harness failures, not game evidence.

## Video dialog paint order and Direct3D continuation

Run `20261011T1455Z-turok-dialog` isolates the blank dialog: template 131
creates the ordinary controls, then SS_BITMAP control 1082 (HWND 0x10030,
301x232). Its z rank is correctly below the other controls, but creation-slot
paint order draws it last over them. A diagnostic repaint of the foreground
controls restores them without changing any guest code or resources.

The fix orders immediate child exposure, the native queued repaint drain, and
modal sibling paint selection back-to-front. Changing immediate exposure alone
is insufficient: the queued pass covers the dialog again. The extended
`test-static-bitmap-control.js` asserts pixels for immediate, queued native and
modal painting, explicit z-order changes, and hidden siblings. Original source
fails; the exposure-only intermediate fails the queued case. The final patch
passes that test, parent/child order, nested-child painting, child clip policies
(49,152 points), and the full build on bx_drmnxa44. The module is based on
main `3cf809538`; patched WASM SHA-256 is
`f7b5a629258a4c7fadc39e1278aa18e95ba69eda4f527631f6782d4079aafac5`.

Reviewed `video-fixed.png` shows the restored settings. Ordinary clicks open
the selector at `(435,170)` and select **Wine Assembly DirectDraw (Direct3D)**
at `(300,207)` (`driver-list.png`, `d3d-selected.png`). Clicking Video's OK
at `(211,350)` opens **Direct3D Properties**, not gameplay. Its video-card
field says `Unknown card -- Select from list below`, with 640x480/16-bit
defaults (`d3d-launch.png`). A click at `(444,120)` does not visibly open that
second selector; the trace targets groupbox 0x10033. Cause unconfirmed.

Ordinary Return in Direct3D Properties advances guest execution and then
traps at batch 217 with EIP `0x0052bec0` in the EXE's string/data area,
ESP `0x074ff2c5`; the preceding batch is in video_d3d at runtime `0x0130b439`
(original `0x1000f439`). This is a new continuation failure, not the old Glide
grEnable trap. `d3d-enter.log` and its receipt preserve it; the crash writes
no final `d3d-enter.png`. Diagnose the callback/return path and card selection
before claiming a D3D launch. No gameplay, browser, FPS or audio qualification.
All commands and before/after evidence remain in the run directory; no licence
approval was answered and no public deployment was performed.

The 15:47Z replay on bx_3uhkes9x, including the SS2 depth-capability fix,
still reaches exactly the data-EIP/unaligned-ESP crash. A bounded API trace
(`scratch/runs/20261011T1547Z-turok-properties/`) records video_d3d file
seek/read/write activity and CloseHandle immediately before it. This replay
loaded video_d3d at a different base: original `0x1000f439` is now runtime
`0x0117f439`. Preserve original module addresses when comparing runs.
The fresh fork lacks native comctl32.dll, unlike the prior controlled run;
both exhibit the same final crash, but this is not a new DLL equivalence test.
Next locate the first transfer into the EXE string area after configuration
save; no specific API or stack-cleanup fault is established yet.

## Modal stack imbalance isolated (2026-10-11 16:05Z)

The single-address traces in run1547Z narrow that fault. Entry into
Video_D3D original `0x10002690` (runtime `0x01172690`) has ESP `0x074ff2e8`
and return address `0x004a9a0e`. Before the five-argument indirect dialog call,
at original `0x10002711`, ESP is `0x074feeb4`, matching its 0x42c local frame
and two saved registers. After that call, original `0x10002728` receives
EAX=1 but ESP is `0x074fee94`: **32 bytes below the pre-call value**.

The subsequent save function epilogue at original `0x100027bd` eventually
returns to `0x0052be74` (a string), captured directly in `data-entry.log`.
This establishes that the imbalance is already present after the modal call,
before the final configuration save. It does not establish which nested pump,
callback or cleanup operation introduced it. Next inspect this nested
DialogBoxIndirectParamA frame and its return, with a focused regression;
do not patch the guest return address or compensate with an arbitrary ESP bump.

### Pump-frame trace (16:14Z)

Run1547Z now also contains pump-frame.log/json. Tracing runtime modal thunk
0x07500878 changes batch scheduling; do not compare its batch numbers directly
with the uninstrumented route. At batch212 ESP is 0x074fee9c and the saved
modal return/pump words are intact. At batch213, after guest original EXE
0x00497e73, ESP is 0x074fee8c (16 bytes lower) and four callback argument
words precede the saved frame. Static disassembly at 0x00497e73 shows pop
edi/esi/ebx, add esp,0x174, then plain ret at 0x00497e7e, not ret16.
Next identify why that guest callback reaches the modal continuation and who
owns argument cleanup; do not normalize all DLGPROC returns or bump ESP.
owner-callback-full.log/json is a separate diagnostic control: tracing
0x004bf420 records only earlier callbacks, not a new hit at modal completion.
Thus the older prev_eip field alone does not prove a teardown callback ran
immediately before the faulty return. No emulator fix is claimed here.

## Cdecl callback compatibility fix (16:22Z)

EXE497580 passes callback4975b0 directly to its modal API (call through
5080d0); this callback returns with plain ret, leaving its four arguments.
The modal pump assumed ret16 and accumulated callback arguments.
[Microsoft's calling-convention account](https://devblogs.microsoft.com/oldnewthing/20040115-00/?p=41043)
documents USER's sentinel-based compatibility for cdecl window procedures.

Each modal guest callback now places a sentinel below its arguments. At
return, the pump consumes either the stdcall sentinel or the four cdecl
arguments plus sentinel; idle reentry has no marker. The initial WM_INITDIALOG
frame uses the same convention. The frame stays on the guest stack, so nested
modal calls and different threads do not share a cleanup pointer.

Full remote build passed. test-callwindowproc-dialog-modal now uses a cdecl
nested DLGPROC alongside its existing stdcall callers and second-thread
checks: old source fails to resume the outer subclass; changed source passes
with exact final ESP. Custom dialog dispatch and button-command queue tests
also pass. Run20261011T1622Z-turok-cdecl retains all logs and module hash.
Ordinary Video->Direct3D->Properties->Return now returns to the Options
screen without the previous data-EIP crash (500 batches). Reviewed final
canvas is a menu, not gameplay. Native comctl32/ole32 remain absent on this
fork, as in the matched failing control. No browser/FPS/audio claim.

The same build, Go Back at(320,430) then Single Player at(320,216), reaches
a rendered first-person scene with weapon,100health and150ammo in45s.
callback-play.png is reviewed gameplay rendering; player movement is not
yet qualified by that capture. Separate movement replay follows.

## Input control comparison

The early W replay happened during loading and is excluded. A later replay
captured batch5200, held VK87 at5210–5700, and captured5800/5900. Repeating
exactly that route without W gives SHA256-identical before/after/final PNGs
(movement-control-hashes.json and walk-control.json in run1622Z). The scene
transition and health/weapon changes therefore do not prove player input.
Next inspect actual configured keys and possible scripted/demo playback.
Registration/playability remain unqualified; the modal crash fix is separate.

## Actual input route (16:35Z)

keyboard.dft has6-byte TKKBRD magic and4-byte version, then dword action
indices. Scan17(W)=40,72/200(Up)=10,80/208(Down)=11. Up-arrow through
di-keydown VK38 interrupts the automatic level sequence and opens a Start
Game/Enter Cheat/Cheats/Options menu. Held Up selects Enter Cheat; a short
press then a later click at(320,80) instead reaches Options. The route is
not yet solved, and neither capture qualifies player-controlled gameplay.

Correction to board shorthand: ordinary handleKeyDown ALSO updates
_asyncKeys/pokeKeyDownState; the earlier W trial was not WM-only. The changed
key binding, timing and menu state must be isolated. Run1634Z retains reviewed
menu captures and exact input schedules. Next use the visible menu state to
select Start Game via ordinary keyboard, then gameplay input controls.
## Keyboard menu route (16:54Z)

Run20261011T1652Z-turok-keyboard: existing Direct3D/Properties route, then
Up5210..5220 interrupts attract and leaves Exit highlighted. Down5300..5301
wraps to Start Game; Enter5350..5351 opens its New Game/Load submenu (reviewed).
The previous test's6000/6200 inputs never ran: its40s guard stopped at5509.
The corrected earlier-input run stopped at5532; this is a menu route, not
gameplay. Next Enter on New Game, then validate movement in the actual level.

Enter5420..5421 selects New Game. The50s bounded replay stops at5666 with a
black transition canvas; planned movement5710 never runs. Retain this as a
menu/transition result only. Next longer bounded continuation with input after
the level is visible, then no-input control; do not reuse attract captures as
proof of gameplay. All commands/logs are in the same run folder.

## Actual New Game movement (17:04Z)

The same route with a100s wall guard reaches the actual New Game level.
At6500 the player stands above water with weapon/100health visible. Up held
from6510 through the6614 endpoint moves underwater. A separate no-input
control with identical route and exact6614-batch endpoint remains above water
at the starting position. Both reviewed; run20261011T1701Z-turok-long contains
commands, logs and before/input/control screenshots. This establishes CLI
player movement, unlike the earlier attract captures. The key release6700
was not reached; no claim of release behavior. Next register the extraction/
data-directory layout and verify the browser route; FPS/audio/mobile unknown.

## Reproducible candidate registration

Candidate `turok2-demo`, app `turok2_demo`. Existing `is5Extract` reads the
downloaded data1.cab and reproduces the original executable SHA256 above.
Its33 entries include12 empty ancillary files omitted by the earlier is-cab
extraction; no files are patched. Explicit copyFile steps populate the11
required data resources. Fresh fetch/hash/extraction succeeds on bx_kmxkny92;
`--app=turok2_demo` then reproduces the reviewed New Game level at6614 batches.
Evidence run20261011T1711Z-turok-registration. The ordinary Video settings
must still select Direct3D; default Glide3 remains unsupported. App catalog
test passes. The broader dropdown-manifest test is blocked by the unrelated
missing `test/binaries/win98-games-a-d/Black and White 2-DX9-D3D/installed/.wine-assembly-browser.json`
on the remote test tree. Browser gameplay, FPS, audio and mobile remain open.

Registered real emulator-handler browser launch also reaches the reviewed
main menu with default Threads/lazy loading (Chromium155.0.8059.39,
same run1711Z).43 manifest files mounted; native ole32/comctl32 are absent
and use built-ins as in the CLI run. No browser input beyond launch yet.
Next ordinary browser Options/Video/Direct3D route, then New Game/movement.

Run20261011T1717Z-turok-browser clicks the Video route using the CLI-derived
coordinates plus the observed browser viewport offset. Both video_3dfx.dll
and video_d3d.dll load in the worker. Settings returns to Options, but Single
Player reports "Unable to open graphics driver". The chosen combo value was
not captured; do not assume successful D3D selection from DLL loading alone.
Next capture the native Video dialog/selection at each stage before diagnosing
a browser-specific renderer initialization defect. No browser gameplay claim.

## Blank browser selector (17:35Z)

Run20261011T1735Z-turok-video captures the native Video dialog before input,
after opening the driver selector, and after End/Enter. The selector remains
visibly blank throughout; Single Player again reports the driver error. This
does not establish that Direct3D was selected. Both renderer DLLs loading is
insufficient evidence of successful driver enumeration.

Static disassembly identifies the next read-only comparison: WM_INITDIALOG
reads count at guest0xaf6e24 and calls CB_ADDSTRING (0x143) at0x497928 for
records beginning0xaf5bf0, stride0xe8. CB_SETCURSEL uses0xaf5bd4. Enumeration
at0x4a94d0 loads each video DLL, resolves its entry point, calls it at0x4a9597,
and adds the returned record count at0x4a95ba. Compare record bytes and count
between browser and the working CLI before changing combo behavior.

The replacement boat bx_s4kn6qcr retained raw fixtures but dropped build,
browser dependencies and the registered fixture directory. Rehydrated npm
dependencies, full build and candidate PREP succeeded remotely; browser is
now Chromium152, distinct from the original155 evidence. No runtime fix is
claimed by this investigation update.

Run20261011T1744Z-turok-driver-table narrows this further: after opening Video,
count is2 and both complete names are present in guest records (Glide and
Wine Assembly DirectDraw (Direct3D)), while selection is-1 and the combo is
visibly blank. Enumeration is therefore not the immediate failure in this
run. Next inspect GetDlgItem(0x48a), CB_ADDSTRING delivery, combo userdata and
its inner listbox lifetime across the worker/modal boundary. Do not change
the driver DLL or force the guest selection as a substitute for that fix.
Same WASM SHA256c065eb4dbbf71f7672bdbc9a6c07a907aa9420a044eea79c4baacc6da2b5dcbc;
Chromium152, Threads, missing test/binaries/tlbs/stdole2.tlb (recorded
environment difference). Capture and raw records are retained in the run.

## Worker dialog combo hit testing fixed

Run20261011T1751Z-turok-combo-state confirms combo HWND0x10023/id0x48a
has listbox0x10024 with both items. The browser sends the arrow click to
groupbox0x10022: wnd_child_from_point_deep explicitly skipped dialog combos,
assuming the synchronous dialog router would handle them. Worker mode queues
that deep target instead, so the surrounding group box consumed the click.

The deep hit test now includes dialog combos and skips group-box frames.
The expanded deep-zorder regression fails on the old source (group returned
instead of combo), passes with the fix, and checks the closed field extent.
Full remote build, WordPad combo, renderer dialog-caption and mouse-drag-mask
tests pass. No guest EXE, settings or driver records are patched.

Run20261011T1755Z-turok-hit-fixed reviews ordinary browser clicks opening the
dropdown and selecting Wine Assembly DirectDraw (Direct3D). The guest title
also changes to T2-Direct3D6. The later scripted route remains in Video after
the properties step: no browser gameplay or driver-error-cleared claim.
Next explicitly capture the Properties Return/Video OK sequence before
entering Single Player. Module SHA256:
0d8387d822799c57e7876f3773b569cf89b23a5534824930d8f3b5a781cd2565.

## Properties dialog differs with Threads

Runs20261011T1802Z-turok-properties and1804Z-turok-properties-coop repeat
the same Options/Video/Direct3D/OK clicks, then wait five seconds without
sending Enter. Same patched module, Chromium152 and lazy loading; the second
run adds `?no-threads`. With Threads, renderer HWND0x10032 is visible but its
title is empty and no properties contents appear. Without Threads, that HWND
is a complete Direct3D Properties dialog with Video Card, Resolution, quality
options and OK/Cancel. Both screenshots and window metadata are retained.

Thus the remaining settings failure is worker-specific, not an unverified
key-binding or Direct3D selection problem. Next inspect DialogBoxParam's
hInstance/template lookup and DLL initialization/resource context in the
worker; source routes DLL templates through push_rsrc_ctx before dlg_load.
No root cause or additional fix is claimed yet. Do not disable Threads as
the production fix or count the cooperative settings screen as gameplay.

## Worker dynamic DLL filename fix

Filtered API trace run20261011T1808Z-turok-resource-trace (actual start18:10Z)
finds the failure before dialog parsing: GetModuleHandleA returns0, then
FindResourceA(NULL,102,RT_DIALOG) fails and DialogBoxIndirectParamA receives
a null template. The DLL's0x10002690 routine round-trips its module filename
through GetModuleHandle before finding the template.

The worker loadLibrary path omitted loadDll's modulePath argument for the
requested DLL and dependencies, unlike the cooperative loader. Forward their
resolved filenames so loadDll records the module paths. The extended worker
message-boundary regression fails old source and passes the fix. The existing
COM filename assertions also pass.

With that JS-only fix and the same module, Threads/browser replay now passes
FindResourceA(0x01370000,102,RT_DIALOG), then supplies nonzero template
0x014830f0. Reviewed run20261011T1813Z-turok-resource-fixed shows the complete
Direct3D Properties dialog with Threads still enabled. No guest file/settings
patch or cooperative fallback. Next ordinary Properties OK, then Single
Player/New Game and player movement; no browser gameplay qualification yet.

## Threads browser player control verified

Run20261011T1828Z-turok-level-wait, actual start18:28:27Z, uses the
same0d8387d8 module plus worker filename fix923139b5b, Chromium152,
Threads on and lazy loading. Ordinary clicks accept Properties and enter
Single Player. Wait85s, hold Up160ms to interrupt attract, Down160ms selects
Start Game, then Enter160ms twice selects New Game. Wait150s for the
opening cinematic; the player starts above water with weapon and health100.
Holding Up1800ms then releasing visibly moves into the water. Both gameplay
captures reviewed. This is browser player control, not the attract demo.

Earlier runs1817Z/1825Z are retained as menu/cinematic evidence only;
45s after New Game was insufficient. FPS, audio and mobile controls remain
unverified. Missing test/binaries/tlbs/stdole2.tlb did not block this route.
Main integration is still pending; no public deployment or release approval.
