# GetFullPathName directory separator compatibility

Historical source last updated, 2026-10-19. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

The original Army directory-validation-v2 observation is sealed separately
in `scratch/runs/20261019-army-men-directory-validation-v2`, manifest
`e9dfb850f15bf3dfbeb28832022216587756ac48c6952c7800acb486c0f66a76`. It captures a GetFullPathNameA input ending Campaigns/, followed by the game's
FindFirstFileA pattern campaigns*.* without a separator, failed enumeration,
then a leading-NUL cached directory passed to native _chdir. The original
SetAt instruction trace had zero hits; exact dynamic store attribution remains
unavailable. No claim that the earlier AVI transition proves this campaign path.

## Contract and scope

[Microsoft GetFullPathNameA documentation](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfullpathnamea)
specifies successful length excluding NUL, required capacity including NUL,
and a zero file-part pointer for a directory result. It does not require the
path to exist. The shared host import serves A and W in TCHAR units.

[Wine's Windows path conformance tests](https://github.com/wine-mirror/wine/blob/master/dlls/kernel32/tests/path.c),
`test_ValidPathA` lines129–137, explicitly compare a trailing-backslash input's
full result including that separator and require NULL filePart. This supplies
the trailing-separator evidence not explicit in Microsoft's prose. No original
application binary or alternative assets are used in the new tests.

The fix changes API display semantics only: normalize slash spelling before
resolving an API path, preserve an explicit final separator, and represent a
drive root with its backslash. Canonical VFS lookup still uses the unchanged
_resolvePath/_normPath functions; existing case-folding policy is retained. On short buffers, return required TCHAR capacity before writing output or
filePart. On successful directory-form output, set filePart to zero; for a file
result retain the pointer into the output, scaled for ANSI/UTF-16. Empty inputs
retain their existing failure behavior. This is not a complete Windows path
normalization overhaul (case retention, device namespace and per-drive CWD
limitations remain outside the scoped change).

## Validation and pending runtime

`node test/test-full-path-name.js` passes pure-JavaScript production host imports
using16KiB ArrayBuffer memory, no WebAssembly instance: A/W explicit separators,
mixed separators, roots, parent traversal, relative/nonexistent paths, sufficient
and exact-short/zero capacity, output sentinels, optional and directory/file
file-part pointers, and composing Campaigns/ with *.* for enumeration. `node test/test-vfs.js`:46 passed,0 failed. Syntax check passes. The sealed old v4 VirtualFS negative control returns C:\work\campaigns without
its slash, demonstrating the regression that the new test detects. The first test draft compared a Uint8Array to Buffer with strict equality;
that test-only representation mismatch was corrected before all checks passed.

No build, native guest, browser or original Army retry has run on this candidate. Root must review/integrate the disjoint filesystem hunks and qualify an immutable
consumer before any claim that this fixes BootCamp gameplay. Original files and
historical bundles remain untouched.

## Paired original consumer ready (not run)

Immutable `/home/user/army-men-local-stage-v7-20261019` uses historical7c943
source/runner903d and module7fd, plus this scoped filesystem JS candidate
`afeabfd0e06f70b03ab1c8627abacaf76cb1dd66`. Maincdc48 filesystem base and v6
filesystem were byte-identical SHAca27bf7e, so the candidate is exactly these
reviewed hunks on the prior consumer. No src/ABI or WASM change is required;
this is explicitly a paired historical baseline, not currentmain's module. The candidate filesystem SHA is
`04f5fd5fa989f416826eb19fe38227bf26a9433d11c921f11bc5f95496dc5fbf`.

All1,600 staged entries rehashed,1,597 unchanged hardlinks. Added allocated
file bytes434,176 including manifest, excluding directory metadata. Priorv6
also rehashed unchanged. Manifest:
`b22f8986ce3428e776b34736cb4fe217b373f15511385e090986fc09c6b447a8`. Controller:
`e43ad070c53ac17dd9ca0ca9dc0d76890e03b42847d5ad5b8a5328408be170d1`. Unchanged trace plan:
`84bb379481ed5ebc5721dd83245ccbfc34e885a9bf6ba911a8eb985e73b4f2ed`.

### Paired v7v2 result: separator fix validated, game still blocked

Nevertheless snapshot202350 reports the game's Error dialog and the raw log
still says `ERROR: .AMM does not exist`. The framebuffer PNG remains the menu;
no gameplay is shown. This trace does not include campaign fopen or chdir
return, so successful campaign opening is not proven. Normal HTTP quit exited0
with no guard reason, minfree2,989,023,232, all1,600pins unchanged and freshly
absent groups. Prior licence acceptance remains true; Finish unobserved. Evidence16artifacts447,430bytes, manifest
`ad4488adcf92a901d5eca7b3aa0719d77b21a27a6d2a5f69ef4db99622d2a732`
in `scratch/runs/20261019-army-men-fullpath-observe-v2`. No retry.

Separate source-only reproduction points to a second defect: with cwdc:\work\
and an existing c:\work\campaigns directory, `_resolvePath('C:/work/campaigns/')`
returns c:\work\work\campaigns and directory lookup fails, whereas the equivalent
backslash absolute path resolves correctly. Drive-relative detection currently
runs before slash normalization. This does not retrospectively prove the
untraced chdir return; it supplies a generic canonical-resolution regression
for a separate source fix and subsequent observation.

### Separate canonical slash-classification fix (source only)

Root authorized `_resolvePath` ownership after the paired separator result. Normalize slash spelling before the existing drive-relative/root/UNC decision,
not after it in _normPath. This one-line behavior change keeps C:/dir absolute
and /dir rooted, while C:dir remains drive-relative. The new regression first
failed on the unmodified function with c:\work\work\campaigns, then passes
against the fix. It verifies generic mixed slashes, same/different drive-relative
paths, roots, UNC spelling equivalence, chdir to a real mounted directory,
relative file opening there, and failure for genuinely missing directories/files. The existing canonical UNC representation is retained, not claimed fully corrected.

Validation: new slash test PASS; A/W API tests PASS; existing VFS46/0 and adopt
PASS. Requested lazy suite:49PASS/2FAIL identically on candidate and pre-change
HEAD. Both failures construct a ThreadManager prototype without its threads
map, then hit `threads.values`; they are unrelated to path resolution. Baseline
was loaded from git HEAD into a test-only Node module cache without modifying
production files. Raw baseline/candidate logs are retained at
`scratch/runs/20261019-army-men-slash-source-tests`. An initial third lazy failure
was sparse checkout missing host.js; adding exact host.js and test/run.js removed
that environmental failure. No scheduler fixture was silently patched. This
existing suite includes its real Worker/compiled-adapter check, which passed;
no original game or normal build was executed. New test's missing-file assertion
uses VirtualFS's internal zero failure (not Win32's external INVALID_HANDLE_VALUE).

The first GetFullPathName fix remains a separate coherent commit; this second
fix has no consumer runtime qualification yet and must not be labeled a BootCamp
success.

### Paired v8 ready; runtime grant still required

Immutable `/home/user/army-men-local-stage-v8-20261019` retains historical7c943
runner903d/WASM7fd and original433state/nativeDLLs, with candidate28a2e9035
filesystemSHA`ba7e94aec476e403c6db8802fd2da724a06eab45b16eee8eb7d0be223b3d287d`. Manifest`ce42e21b5c95fc55ccbc7c9820ac3c28de6f817f9e826f2d0486b19dc354c82c`;
controller`f1ccf470639ef3bf909f1b42295f0eccdec7760b2da9a10cebd05e55b1c2ed12`. All1,600pins checked,1,596 unchanged hardlinks,438,272 newly allocated file
bytes including manifest (directory metadata excluded). V7 preserved unchanged. Staged A/W and slash chdir/relative-open tests pass, source95/statics39/native5
preflights pass, and actual trace-parser/host-wrapper synthetic tests pass.

The plan adds selected CreateFileA/ReadFile plus fs_set_current_directory host
returns and existing --trace-fs to the previous directory observation. This
captures actual resolved file paths/handles/read results and directory success,
not merely numeric native-CRT pointers. Existing4MiB log cap stops excess output;
no cropped-log success claim. No debugger breakpoint, no automatic menu input. All60/75/90 deadlines,28MiB output,512MiB transient admission and hardfloor remain. Source-only receipt `scratch/runs/20261019-army-men-slash-consumer-preflight/ready.json`.

### V8 original BootCamp scene reached

Actual log10877 changes to the canonical Campaigns directory; host return1. BootCamp.cpn opens as70000028, then yields0x5ce(1486)bytes and EOF. BootCamp.AMM
opens as7000002d, with subsequent actual map reads. The selected read trace
reports copied bytes, not a separately logged final ReadFile error; downstream
original scene progression corroborates successful campaign/map processing. Normal quit exited0, no guards, minfree2,274,381,824, all1,600pins unchanged,
groups freshly absent. Historical7c943/7fd plus scoped JS fixes remains the
accurate runtime identity; this was not a currentmain WASM run. Prior actual
licence acceptance true, installer Finish unobserved.

Evidence `scratch/runs/20261019-army-men-slash-observe-v1`:17artifacts,
4,343,609bytes before manifest, rawlog3,103,579bytes uncropped; manifest
`6e5aa56b55f605568df29532c576f98efbe562270172f87ba91a9ef192349b9d`. No retry. Next ordinary movement observation should remove broad filesystem
and ReadFile tracing to avoid audio streaming log volume.

### Next movement proof, source-only plan

The installed original readme.txt, July1998, explicitly documents Numpad8 for
forward movement, Numpad2 backward and Numpad4/6 turning. Space/left-click fires,
Enter toggles map-scroll mode, and Escape opens options; those are not movement
substitutes. After normal observed menu/BootCamp entry, retain before/after
frames around a bounded Numpad8 keydown/keyup (VK104), using ordinary control
commands, then inspect Sarge/terrain/minimap change. Stop on failure; no memory
writes, timed game workaround or undocumented sign-dismiss input. If the welcome
sign prevents a defensible movement comparison, report that limitation instead
of claiming success. No next consumer or runtime has been launched yet.

### V9 movement consumer ready, no runtime grant yet

Immutable `/home/user/army-men-local-stage-v9-20261019` retains V8 runtime,
originals and historical module unchanged. Only controller/plan/identity differ:
1597 hardlinks, 282624 added allocated bytes excluding directory metadata. Manifest `738fd64e33e4f5bdb6a7d461a74941ebab59ae152d5fdf4b03bbe9a20f507525`;
controller `8da0bab81381fbca3a2c3a0f901969e5781e19a6823fec6d8bcf73a7688561af`;
plan `1f8d1f977815d71a98e5366f1b6112899f7b54cd5a80c3897d387a72ac52f78f`. Source and native dependency preflight passed without guest execution; receipts
in `scratch/runs/20261019-army-men-movement-preflight`. Pure JS mocked movement
ordering/release tests pass, including failed down acknowledgement and wait. Only `--trace-input` remains; broad file/audio/API traces are removed. All
60/75/90s, 4MiB log, 28MiB output, 512MiB transient and disk guards remain.

V9 movement-v1 was granted, but the exact controller refused initial fresh
disk admission at line28, exit1, before creating its evidence directory or
spawning any child. No movement/menu input occurred and no retry was made. The guard remains free>2847932416. The assertion does not record its exact
failed sample; `scratch/runs/20261019-army-men-movement-v1/admission-failure.json`
records a separate subsequent statfs observation, not the failed instant. This is an admission refusal, not an original-game compatibility result.

### V9 movement-v2: control response, rendering qualification remains partial

Normal quit0, no guards, minfree2260598784, all1600input pins unchanged,
survivors[] and both PIDs freshly absent. Rawlog499913bytes (reduced trace);
20artifacts2483001bytes before manifest, retained at
`scratch/runs/20261019-army-men-movement-v2`, manifest
`735697be9e720943ab28f923158b2a494e460c9c6cec28f94bb573f159321113`. V1 refusal remains separate. Historical runtime and Finish-unobserved limits
remain unchanged. No additional input or retry was sent.

Next source-only plan: another separately granted ordinary scene observation
can use documented Numpad4/6 turning and Numpad8 forward to leave sign proximity,
with explicit releases and a frame after each bounded input. Readme and the
observed obstacle sign agree on those controls. Do not use arbitrary dismiss
keys. Determine whether stripes persist with the sign absent; if it remains
obscured or corrupted, preserve that result rather than declaring gameplay.

### V10 remote original: sign clears, terrain rendering failure persists

Granted command `cmd_fnsqfnms0l2a`, controller18694/guest19384 on bx_rqnkhrnr. Reviewed menu then normal BootCamp320,180 at2268; reviewed welcome scene before
Numpad6 turn. Key102 down2996/up3021, frame3025: welcome overlay disappears,
Sarge and HUD are visible, but severe diagonal striping spans the terrain. Root independently reviewed the frame. Stopped at this meaningful failure;
forward was NOT sent. This establishes a visible control response and persistent
rendering defect outside the sign, not clean gameplay qualification.

Normal quit0, no guards, rawlog449547bytes, minfree49145659392, all1600pins
unchanged, survivors[], fresh ps bothPIDs absent (`cmd_fzuwo5rhi0ag`). Evidence
recovered with documented download-url+GET API, archive1483489bytes SHA256
`b0439c2539e7eb2ce9f0cf42d7b5c36f2b7ece72150f8971975295d7318eea2c`,
verified before extraction locally to
`scratch/runs/20261019-army-men-sign-exit-remote-v1`. Historical runtime and
Finish-unobserved qualifications retained. Runtime released; no retry. Next source-only work must identify the actual rendering/API path from existing
logs/source before testing any overlap-scroll/pitch hypothesis; screenshot
appearance alone does not justify a renderer patch.

### Rendering attribution and bounded next trace, source only

The original PE imports DDRAW.dll!DirectDrawCreate and GDI32!StretchBlt. V10's input-only log contains no surface/Blt/pitch records, so it cannot
identify which operation produced the corruption. Inspect the historical
V10 source, not the newer main Surface implementation: DirectDraw Blt starts
at src/09a8-handlers-directx.wat4999, BltFast5764, Lock6575. BltFast's unkeyed
path copies rows in increasing order with `$memcpy`; the helper uses WASM
memory.copy (overlap-safe within one row). Cross-row overlap remains a
hypothesis requiring actual same-surface source/destination rectangles. The
keyed helper preserves a forward scalar loop for overlapping rows. StretchBlt
uses GDI surface descriptors and its separate blit path (09a4 line3003). None of these source observations yet connects the original turn to a defect.

Historical runner --trace-dx supplies decoded rectangles/surface metadata,
but it also enables host Lock/Unlock/Present tracing from startup. The
trace-api pause control does NOT gate this category; only a static batch
window gates it. Turning that broad flag on would not honor a live reviewed
turn boundary. The next first discriminator therefore uses only selected
--trace-api-paused entries for Blt/BltFast/Lock/Unlock/Flip, StretchBlt/BitBlt,
and unresolved <ord>. COM dispatch normally resolves ordinal IDs to names
before filtering. The helper enables API tracing, sends documented250ms
Numpad6, releases, pauses tracing, then captures after-frame/snapshot. It
attempts pause even after enable/input/release failure and ordinary quit on
failure. No extra movement, host trace, surface export or guest patch.

API memory specs capture receiver/source wrapper bytes and RECTs at entry. Important limits: Lock's entry DDSURFACEDESC is not its returned pitch; the
historical table has nargs5/no typed-out descriptors for these COM methods,
so BltFast's sixth flags argument is not promised by the ordinary formatter. This first trace discriminates actual API path and same-surface rectangle
relationship; it must not claim full DX metadata or correct pitch. A native
body bypassing logged entry points remains unobserved. Raw startup leakage
and all raw output are preserved, not silently filtered. Same4MiB log/28MiB
output and60/75/90 guards stop any unexpected volume; expected call count is
unknown before measurement, and trace overhead may alter progress rate.

V11 staged source-only beside V10, both locally and on bx_rqnkhrnr at
`/home/user/army-men-local-stage-v11-20261019`. Manifest
`16b731e683d2033c597de880fa8afeb38425705003a61a37d6133bd30713d8ac`;
controller `ae395ad1cc656e36a39d149b5e9f137d3f75bee87f60a2e700c82e20a595d2ea`;
helper `c9c644e2da1721bfaeea2035db245208e20e848cc8daa62981016392c8e9fa21`. All1600hashes match,1597hardlinks and282624allocated new bytes excluding
directory metadata; V10 pins verified before/after. Only three source files
were uploaded via independent Files API (archive4898bytes,
SHA16277a2a2e3cca36d440b17b6b3ef9ef2f39e7ff149025d35e89f6687b581d61). Remote staging cmd_nfdbaitmy4ix and verification cmd_prqdp5mxwxbc passed;
free48769445888, output parent present, unique output absent and port8143
not listening at02:48:24UTC. Recheck port/admission at allocation; Dungeon
owns next runtime slot. No guest/native preflight/runtime was launched.

### V11 terminal startup log-cap, no turn observation

Granted remote cmd_kx6fdilkaxly/controller26947/guest27636 passed1600pins,
free48743530496 and port8143 clear. It hit the unchanged4MiB log cap after
4.8seconds, before first screenshot request or any menu/turn/helper input. SIGKILL/log-cap, received4205278bytes; retained raw4194296bytes, with the
over-cap tail intentionally not retained by the existing guard. No trace-api
toggle markers. Startup trace contains5324Blt,688Lock,687Unlock,3Flip entries;
these do not establish the turn's rendering path. Pins unchanged, survivors[],
minfree48739008512. Fresh ps/controller+child and port8143 clear confirmed in
cmd_xmtr20m9gc87. No retry. First later screenshot request correctly failed
ECONNREFUSED and download404; no image existed.

All13artifacts4488519bytes recovered through documented Files API to
`scratch/runs/20261019-army-men-render-trace-remote-v1`, sealed manifest
`1d98026eb9f5d7e96e6e10d1e67426060c559de359c134065529c5d04098773a`. Archive152544bytes SHA4deef68d28a65b90af85b1882d59ff70a3817eb4207495f6a55b4a6195aa8e00. Exact tracing defect found in both historical/current runner: initial
apiLogOff predicate ends `!TRACE_API_MEM.length`, so memory specs defeat
TRACE_API_PAUSED and leave the WAT logger on. COM dispatch itself correctly
checks api_log_on and resolves ordinal names. The prior parser/toggle mocks
did not exercise this initial predicate interaction; new regression must. No renderer change or original-game result follows from this failed trace.

Scoped runner correction changes only the memory-spec term of the initial
predicate to `(!TRACE_API_MEM.length || (TRACE_API && TRACE_API_PAUSED))`. Memory dumps paired with a paused API trace no longer force dispatch logging
on. Memory-only tracing without TRACE_API retains its existing behavior even
if the unused paused flag is present; trace-api control still rejects that
unsupported combination. Counts/critical/input-dispatch/ESP/audit/breakpoint
consumers continue to force logging independently. The correction does not
promise pause suppression when such independent consumers are enabled.

`tools/test-army-men-trace-memory-pause.js` extracts the production predicate,
COM marker resolver and entry memory logger, and actual trace-api toggle. Synthetic dispatch emits the real COM marker/placeholder only when the
set_api_log stand-in is enabled. It verifies startup silence, actual resolved
COM memory bytes after on, silence after off, memory-only behavior and each
independent consumer. Historical V11 fails the initial-silence assertion;
candidate passes. Syntax/diff checks pass. This is pure JS source conformance,
not a native COM execution test; original retry remains separately gated.

### V12 original turn reached; trace volume still exceeds cap

cmd_jaldjha5xa6h/controller30161/guest30850 reached reviewed menu/BootCamp,
click1039. Input receipt confirms traceON1651, key102down1653/up1661,
traceOFF1664, afterPNG1667. Severe diagonal corruption remains. It then
terminated SIGKILL/log-cap while draining buffered output, before attempted
normal quit (which returned ECONNREFUSED). Received4235060bytes, retained
raw4167893bytes; minfree48561946624,1600pins unchanged,survivors[]. Fresh
cmd_tixem3k0fmpk confirms bothPIDs and8143 absent. No retry.

Initial API pause works in this original execution: no API entries before
ON. However9638unrelated [FS]audio-read lines already used~1.89MB beforehand. Retained trace then contains1969BltFast/1599Lock/1599Unlock/123Flip calls,
but ends BEFORE the keydown marker. Separate control acknowledgements and
afterPNG exist; their corresponding trace tail was not retained. There is no
same-wrapper BltFast in this retained prefix; that fact CANNOT rule out a
later turn-related same-surface copy. No StretchBlt or Blt in the prefix. Common full scene copy is8221080->8221078, RECT0,0,640,386, callerret4064c8;
Lockret420382/Unlockret4203c5 operates on8221078. Lock helper420360 stores
returned lpSurface at5cc5ec and pitch at5cca28; entry dumps cannot prove them.

Static original caller406460 invokes407440 to update the scrolling background. At4074f1..407503 it pushes the SAME global4744d8 surface for source/destination,
RECTonstack, destinationECX/EDX, and flags0x10, then calls vtable+1c(BltFast). This is a concrete candidate call site, not proof it ran in the retained turn
trace. A bounded existing trace-at407503 capturing stack/RECT/registers with
small hit limit would distinguish overlap directions without broad API flood. No renderer patch is justified before actual arguments and semantics review.

Evidence recovered via Files API archive1118995bytes,
SHA575f093fb4def00dd9cf00bc8a9133b30948966fb6f07767aa0ae44fa9685c22,
at `scratch/runs/20261019-army-men-render-trace-remote-v2`. All prior partial
gameplay, original acceptance and Finish-unobserved qualifications persist.

V13 prepares only `--trace-at=0x407503 --trace-at-limit=8`, memory
`esp:24,*esp:8,*esp+12:8,*esp+16:16,0x5d91c4:32`, plus input tracing. At this
pre-call boundary stack DWORDs are receiver,x,y,source,RECTpointer,flags;
the two wrappers and pointed RECT are captured using the actual resolver. No API/hostDX tracing or forward input. The first eight hits may occur before
turn; correlate batch with input receipt, and treat exhausted/no hits as
unavailable for the turn rather than infer execution. Test executes actual
pointer parser and ordinary250ms turn protocol with synthetic data; PASS.

V13 granted cmd_vh4ax9tj3ztx/controller34284/guest35000 passed immediate1600pins,
free48321064960 and port check. Reviewed menu/BootCamp, click409, ordinary
key102down789/up801, after804 still severe diagonal striping. ZERO407503
trace hits, not eight exhausted hits. Actual copy arguments remain unavailable;
no execution/nonexecution or overlap conclusion is justified by the missing
capture. Normal quit0, no guards, raw143670bytes, minfree48318521344,
all1600pins unchanged,survivors[]. Fresh cmd_vbijnlxl5t2n confirms controller,
child and8143 absent. No retry or renderer patch. Archive1454098bytes SHA075eed73454f01d15d9274c103723e17adc7f64c202f50e9794fd105139ae6e0
recovered/verified via Files API to
`scratch/runs/20261019-army-men-scroll-boundary-remote-v1`; all prior originals
and evidence retained. Next source investigation must explain whether this
instruction boundary is observable with the existing debugger before another
game allocation; repeated no-hit runs would not resolve the renderer cause.

Source observability diagnosis: historical13-exports.set_bp only stores the
address and recomputes debugger chain/tier guards. `$run` compares EIP at
block dispatch; no bp_addr check splits decoder instruction streams, and
set_bp does not invalidate/split cached blocks. Block-executor guards cover
interior *block entries*, not arbitrary instructions inside one block.
407503 is inside the branch-target block4074f1 (jne4074e2 targets4074f1),
so this explains why the selected instruction is not a reliable trace point. Original PE preferredbase400000/entry46fee0 and pinned disassembly agree;
this is not evidence of a rebased DLL address mistake.

Synthetic PE/x86 only:
compare a breakpoint inside straight-line instructions with a real branch
entry, then test resume/rearm and cached branch-entry hit. Syntax passed;
native execution NOT yet granted/run. Nearest proposed original boundary is
4074f1: ECX/EDX already contain destination coordinates, ESP points to source
RECT, global4744d8 supplies both receiver/source, following pushes supply
flags0x10. Do not run that original observation until the synthetic control
demonstrates the chosen boundary method. No forced split/core patch proposed.
