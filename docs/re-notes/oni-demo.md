# Oni demo preflight

Source https://mods.oni2.net/node/335; linked
https://mods.oni2.net/system/files/Oni%20Demo.zip fetched on boat bx_3uhkes9x.
94,583,006 bytes; SHA256
9913e0f866e25bcd11571dec645be420e717092763a8f34ebe4d4ec3c47ec7e5.
7z extraction:42files,169519142 bytes, no errors.

This is explicitly a community repack, not the original installer. Its README
says it combines the original demo levels1/4 and alternate demo level2, and
ships modern OniX plus the original demo application under
Older Oni apps/Windows 98-ME/Oni.exe. For Win98 testing use that executable
and matching binkw32.dll, with GameDataFolderX copied as GameDataFolder,
per the supplied rename instruction. Preserve the source tree. The original
run_wind.bat uses Oni -noswitch. No public redistribution grant established.

Remote source: /home/user/oni-demo-preflight/extracted/. No fixture copied
to the persistent box. Next verify original PE/imports, stage the documented
legacy layout, and run bounded CLI after Turok releases runtime.
No launch, gameplay, screenshot, FPS, audio or mobile qualification yet.

## First bounded startup (16:27Z)

Original Oni.exe SHA256
d1579b3a205bdb7771ac32ebf3af61f927d352fe2e3e35128207e84a2937a12d.
Default and supplied -noswitch route both enumerate the four level DATs,
initialize sound/input/graphics/game systems, then ExitProcess(0) while
loading level0. The later eip-zero diagnostic is after that explicit exit;
do not report it as the startup cause. Exported guest startup.txt/debugger.txt
identify error1 at BFW_TM_Game.c:2529, propagated through Oni_Level.c:405
and Oni.c:936. No explanatory error text is supplied. Next map the failing
template/level load return and its file/mapping inputs; no cause proven.
Evidence: scratch/runs/20261011T1627Z-oni-startup (commands and guest logs).
The build is own branch6823f45d3/base3cf809538, not latest main GL changes.

## Filename-case lead (16:35Z)

The exact error at0x42211f is "This level is not valid" (string52b01c).
It tests level-valid byte564ad8[level]. The parser421030 splits at underscore
and period, then compares the suffix byte-for-byte with "Final" at52acc8
(4210c1..4210f7); mismatch clears the flag at421146. Actual ZIP entries are
level0_Final.dat etc., whereas traced FindFirst/CreateFile names are lowercase.
lib/filesystem.js findFirstFile enumerates normalized map keys, losing original
case. Next controlled enumeration-case probe, then general case-preservation
across mounts/create/move/copy/persistence if confirmed. No guest patch.

Controlled confirmation: run20261011T1637Z-oni-case-probe wraps only
FindFirst/Next returned names with actual names read from the extracted tree.
No EXE/data bytes change. The30000-batch replay no longer reports invalid
level; it loads resources and reaches the reviewed Bungie intro. Remaining
guest logs contain missing particle-class warnings, not the earlier error.
This is a diagnostic wrapper, not a production fix. Next preserve original
case as VFS metadata while retaining normalized lookup keys, including eager,
lazy/provider mounts, create/copy/move and serialization. Test general mixed-
case enumeration and rerun Oni without the wrapper on a fresh remote build.

## General filename fix (16:48Z)

File entries now retain their basename spelling independently of normalized
lookup keys. CLI and browser manifest mounts preserve it for eager/lazy/provider
files; create, truncate, copy, move (including case-only rename), child merge,
localStorage and overlay hydration retain the metadata. Old entries without
metadata still enumerate their normalized basename. Directory case and other
mount paths that already discard spelling are outside this change.

Fresh remote build on bx_kmxkny92 passed, as did all 15 test-vfs*.js files.
The new mixed-case regression fails against the old filesystem implementation.
Unmodified Oni/data, without the diagnostic wrapper, now reaches the reviewed
Bungie intro at 30000 batches: run20261011T1648Z-oni-case-fixed. This verifies
the startup fix, not gameplay, FPS, audio or browser/mobile compatibility.

Longer replay with Escape at 35000/65000 batches reaches a GL-initialization
error under the default CLI backend, which intentionally has no GL context.
Do not classify that modal as an emulator regression. With
`--gl-renderer=software`, the bounded run continues to 144166 batches/30s,
but the final GDI canvas capture is gray. Next inspect the GL/DirectDraw
surface or a real browser route; no menu/gameplay qualification yet.

Run20261011T1702Z-oni-surfaces removes png-canvas and dumps the DX surfaces.
The selected GL target26 and backbuffer27 are both gray640x480, so this is
not merely the GDI capture selecting the wrong surface. Census:27536triangles,
zero eye-plane drops/culls,191presents,13texture uploads,zero unsupported
textures and a clear WAT mirror trust latch. Textured asset surfaces exist.
Guest startup logs reach "launch the out-of-game UI". Next compare real
WebGL and inspect GL state/draw ordering if gray persists. This software run
uses base3cf809538 plus root fixes, not main's later projective-vertex change;
do not attribute the result to current-main WebGL without testing it.

## Browser WebGL comparison (17:22Z)

Run20261011T1719Z-oni-webgl: unchanged legacy EXE/data, tested root build plus
case fix, Chromium155 with default Threads/WebGL. Escape after20s, capture
after45s reaches a fully rendered New Game/Load Game/Options/Quit menu.
Thus the gray UI observed above is specific to the tested software GL path,
not a universal startup failure. Uses a temporary browser/server APPS entry,
recorded in browser-entry.json and browser.js; not a committed registration.
The initial server-unknown-app attempt was a harness setup failure, corrected
by registering the entry server-side and copying assets within the served root.

Ordinary browser click at465,489 opens "Press Start to begin a new game"
with Start/Cancel. This is the game's own New Game confirmation, not gameplay.
Next Start at260,493 and inspect the resulting level/loading state.

Clicking Start at260,493 after1200ms advances into loading, then traps on
**UNIMPLEMENTED API: glTexCoord4f**, captured in browser-start.log. Guest
EIP406863 is the continuation, not the cause (instruction there is
`mov esi,[ebp]`). The API table already has IDs4430/4431 for glTexCoord4f/fv,
but no handler was found on current main. Next implement real four-component
texture coordinates through the appropriate GL state/encoder/backend path,
with projective-coordinate tests; retain fail-fast behavior until implemented.
No level screenshot/player control qualification. Audio also remains unverified
(browser logs report suspended AudioContext).
