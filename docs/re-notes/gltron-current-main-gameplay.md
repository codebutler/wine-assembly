# Original GLTron 0.70 on recovered main — 2026-10-30

## Current CLI replay — 2026-10-31

Evidence: `scratch/runs/20261031T0108Z-gltron-startup-trace/`.
The pinned `runtime.wasm` SHA-256 is
`f2911e1fcfc094d3c6d998bbdb071bdd800ede18cd0082a5eed53de15cf08bb9`.
It was copied from the concurrent Twist worker's successful build, while main
was `b1fd393cf`; its uncommitted D3DIM extent change is preserved as
`concurrent-build-source.patch`. The complete build-time source manifest was
not captured, so the main SHA alone does not identify this module's source.
All 92 original registered input hashes were rechecked unchanged.

With software GL, real ticks, cooperative scheduling and `--batch-size=200000`,
the original main menu rendered. Native Return down/up opened GAME and then
START GAME. `native-arena.png` shows the launch pause; native A down/up was
followed by the moving yellow cycle and trails in `native-left.png`.
`native-final.png` shows player-one collision and PLAYER 3 WINS. These images
were inspected. The 50-second run ended at its configured guard, tool exit 0,
without an unimplemented-call trap. Commands, exact input timings, logs and
module are retained; no guest-memory or asset changes were used.

A same-module 30-second software run with `--batch-size=20000` remained black,
whereas the 200000-block run rendered the menu. This is a bounded CLI budget
sensitivity finding, not a demonstrated guest deadlock or a performance result.
Both the successful and black runs ended with the SDL audio thread waiting at
`0xa3e5f0` on `0xe0005`; that final state alone does not establish the cause of
a black frame. The earlier generic crash-sweep `exit:1` result used a different
graphics route and must not be promoted to an original-game crash diagnosis.
This replay does not qualify browser behavior, audio, complete visual parity,
or every cooperative/real-thread configuration. All owned CLI processes ended;
no Boat, browser, public service or deployment was involved.

## Retained original replay — 2026-10-30

Evidence: `scratch/runs/20261030T2141Z-gltron-main-gameplay/` (ignored).
Use the existing `APPS.gltron` registration; no registration reintegration.

The previously retained extracted tree was missing its executables and DLLs.
The original installer remains at
`scratch/usage-watch/gltron-original-win32-recovery-oct28/payload/gltron-0.70-win32.exe`
(SHA-256 `8956abae4e4fe6ebc45b97d58c9254789e0a1457d11c58e4dbb90aead45a3eb3`).
Extract a fresh task-owned directory with installed `innoextract --extract`,
then use `node tools/stage-gltron-original.js SOURCE/app "$PWD/test/binaries/gltron-0.70"`
with an absent destination. Current owner instructions require the shared main
checkout. All 92 installed files (4,968,893 bytes) passed the original pinned
registry hashes; original `gltron.exe` SHA-256 is
`85fb5184262490f0b5967c2b12ee27c77da058364e594b0fc86be7b5814e40ec`.
Do not substitute adversarial recovery-test fixtures for original media.

## Reproduced causes and repairs

* `strtod` parsed the number but wrote the original pointer to `endptr`.
  Lua rejected the first number as malformed and reached unimplemented
  `longjmp` at EIP `00418c85`, return `00418c9f`, arguments `074ffcd4,1`.
  Return the consumed position, including incomplete-exponent rollback.
  Keep exponent scaling bounded. `longjmp` remains unimplemented.
* MSVCR70 exports `_iob` as FILE data. Binding it to a thunk let GLTron's
  stdout redirection overwrite adjacent import metadata. The `abs` import at
  IAT `004241b0` pointed at `07500720`, whose metadata became
  `70000001,0,2,0` (FILE fields), causing a misleading null/ordinal API-0 trap.
  Bind exactly MSVCR70's data symbol to the existing process FILE array.
  Preserve other vendors' handling and real PE export precedence.
* Integer `abs` was absent from the API table; append its real cdecl handler.
* Mounted original DLL assets were not automatically loaded as PE modules.
  Original zlib ordinal 16 trapped at `0040fbe0`. Seed the bundled zlib,
  libpng and SDL_sound through the existing registry DLL graph.
* Native Enter opens GAME, and Enter on START GAME reproduced `glTexCoord2i`
  at `00407a8c`. Convert signed integers to canonical f32 coordinates; retain
  display-list capture and stdcall cleanup.
* The next START GAME attempt reached `glVertex3d`. Read all three doubles
  from the guest stack, demote at the canonical vertex boundary, and retain
  list capture and 28-byte stack cleanup.
* The following arena draw reached `glColor3d`; reuse the checked double RGB
  path with implicit alpha 1 and 28-byte scalar cleanup. The first inspected
  gameplay frame then showed the yellow light cycle, blue grid and minimap.
  A later draw trapped at `glVertex2d`; adapt its two stack doubles to the
  canonical 2D vertex opcode with implicit z=0 and 20-byte cleanup.

Production-handler tests cover numeric end pointers and cdecl behavior,
MSVCR70 static data binding and stdout redirection without thunk corruption,
texture-coordinate dispatch/list replay, and double vertex stack reads across
non-affine mappings. The older CRT numeric regression now expects the consumed
end pointer. Original setbuf/ungetc regression coverage is retained.

## Inspected checkpoints

The original menu and GAME submenu were personally inspected in
`seed-startup.png`, `game-menu.png`, and `menu.png`. Software GL rendering
shows the original logo, light cycles and GAME/VIDEO/AUDIO/QUIT entries.
Native Return keydown/up through the renderer opens GAME and selects START
GAME. Early captures and failures retain their own pinned module hashes in
the run directory; they are not evidence for later builds. Final execution
status and exact module identity are recorded in `investigation.json`.
Player one turns with A and S in the original `scripts/config.lua`; the arrow
keys belong to player three. Do not mistake arrow input for player-one steering.

Final pinned run began 2026-10-30 21:57:21 UTC from base main
`28298b354a8db2aaeef5d7d0c087e1d01ef364b1` plus the retained
`worktree-play.patch`. Module SHA-256:
`1dbddeafbeff685596095d18a4fd9240820b00b0fa293d21ac03393f9f652fb1`.
The final locked full build passed (`build-final2.log`). Launch with
`node test/run.js --app=gltron --no-build --gl-renderer=software --real-ticks`
and the retained module via `--wasm=PATH/runtime-play.wasm`; the full bounded
command is in `investigation.json`.

Personally inspected final menu/submenu, yellow cycle and arena in
`play-menu.png`, `play-submenu.png`, and `play-left.png`. Native Return and
A/S keydown/up are logged against focused HWND `10001`. `play-right.png`
shows PLAYER 1 CRASHED, debris and bent minimap trails; `play-left2.png`
shows the round winner. Native Escape returns the actual main menu in
`play-escape.png`. Later A/S captures (`round2-left.png`, `round2-right.png`)
show changed arena orientation and trails, but old crash/winner overlays
persist; do not identify the later camera as a surviving player-one view.
The final run reached its configured 180-second guard at batch 2529 without
a guest trap (180.039 seconds, tool process exit 143). Its control port and
runtime process were verified gone. Duplicate extraction and installer copy
were removed after rechecking all 92 staged hashes and the retained installer.

Focused numeric, FILE/import, GL dispatch/list/mutation, WGL availability and
original registration checks passed. White/black trail and shadow artifacts
remain visible in software rendering; investigating their blend/texture path
is the next useful rendering task. This run establishes original gameplay and
native input, without a complete visual-parity or performance claim.

No Boat boxes were created, assigned, resumed, stopped or deleted. Only this
worker's local CLI processes were used; no browser/audio/parity claim.

## Trail and arena rendering repair — 2026-10-30

Before evidence: `scratch/runs/20261030T2210Z-gltron-render-before/`.
After evidence: `scratch/runs/20261030T2210Z-gltron-render-after/`.
Both retain their exact Wasm binaries; the after directory's `investigation.json`
records hashes, timestamps, commands, checks, input batches and inspected images.
The original installed assets were retained and all 92 hashes rechecked unchanged.

Three production renderer defects were reproduced and repaired:

* Unit-zero `GL_DECAL` incorrectly selected texture RGBA. The original
  `gltron_traildecal.png` has white RGB even in transparent texels, so this
  replaced the cycle's trail color with white. Blend texture RGB by texture
  alpha and retain primary alpha, using shared `BLENDTEXTUREALPHA` support.
* The game enables `GL_LIGHT_MODEL_TWO_SIDE`. Reverse normals for back-facing
  lit triangles before clipping and flat shading, respecting `glFrontFace`
  and lighting attribute push/pop. Both sides currently share material values.
* The software path clipped near/far planes but saturated distant projected
  coordinates before rasterization. Large arena polygons were bent while their
  texture attributes retained the original values, causing diagonal grid
  distortion beside trails/shadows. Clip against all six homogeneous planes
  before projection, interpolating all attributes and keeping bounded scratch
  buffers separate from the default viewport.

Personally inspected before `start.png` and `traced-start.png`: white trail
faces and a large wedge of distorted floor grid. Personally inspected final
`clean-left.png`, `clean-right.png`, `clean-trail.png` and `clean-escape.png`:
colored yellow/red trails, continuous arena grid, actual collision debris and
native Escape returning to the original menu. In `clean-left.png` player four
has crashed; player one is still driving. `clean-trail.png` includes player
one's subsequent crash. Later restarted captures in `final-moving.png` retain
old crash/winner overlays; they are not used to claim surviving player-one play.
Native Return/A/S/Escape keydown/up and PNG batches are in `clean-runtime.log`.

The final locked full build passed. Pinned production Wasm SHA-256:
`7e8d3194fd189a8e0089b41ee5972b08b67fd5650d6dfbe2a2fbb9d3c323a327`
(1,892,586 bytes). Focused software raster, software lines, lighting display-list,
attribute-stack, shared D3D texture-stage and original registration tests passed.
Three scratch-only rejecting controls fail their intended assertions when DECAL,
side clipping or two-sided lighting is reverted independently. No shared source
was mutated to run those controls.

Opaque black shadows are intentional with the untouched original
`scripts/config.lua` setting `use_stencil = 0`: original `drawTrailShadow` uses
black color and disables blending in that branch. Do not erase these shadows
or alter assets to hide them. This was checked against the retained 0.70 source
archive from `https://deb.debian.org/debian/pool/main/g/gltron/gltron_0.70final.orig.tar.gz`;
the archive and hash are in the after evidence directory. Remaining limits:
distant grid aliasing, integer screen-coordinate rounding, unimplemented GL
polygon offset, separate back-face materials, and unit-one DECAL semantics.
This is not complete visual parity, stencil-shadow, browser or audio validation.
All own local gameplay processes and control ports were closed. No Boat was
used; assigned box ID/state/expiry and lifecycle handoff are not applicable.

## Original browser WebGL round — 2026-10-30

Evidence: `scratch/runs/20261030T2230Z-gltron-browser/investigation.json`.
Local Chrome 151.0.7922.108 loaded the retained repaired production Wasm
`7e8d3194fd189a8e0089b41ee5972b08b67fd5650d6dfbe2a2fbb9d3c323a327`
(1,892,586 bytes), confirmed from the browser response body. All 92 original
assets were rehashed and their actual served bytes matched the retained pins.
The browser selector omits GLTron despite its existing registry entry. The
test added an option for that entry, then used the normal launcher. An initial
unsuccessful selection launched Notepad; its window remained behind GLTron.
This is a local registered-app test, not a public launchability claim.

Personally inspected the original GAME submenu, paused arena, yellow cycle,
continuous blue floor grid, trails and minimap in `game-submenu.png`,
`round-start.png`, `turn-left.png` and `turn-right.png`. Chrome keyboard input
produced ten paired trusted keydown/up events: Return to navigate/start/unpause
and restart, A/S to turn, and Escape to return to the menu. No guest-memory
gameplay writes or synthetic DOM gameplay events were used.
`full-outcome.png` shows PLAYER 1 CRASHED and PLAYER 4 WINS. Return starts a
new moving arena with rebuilt minimap trails; `restart-left.png` and
`restart-right.png` show the yellow cycle, bent trails and changed orientation.
Old crash/winner text persists on these restarted frames, matching the known
CLI limitation; these overlays cannot identify a fresh player-one death.
`restarted-outcome.png` shows the later winner view and `escape-menu.png`
confirms native Escape returns to the original menu. Collision debris was
not captured at its transient peak in this run.

Runtime proof identifies an actual `WebGLBackend`, WebGL 1 context, GPU frame
layer and increasing write sequence (1593 to 1859); `gl_sw_enabled()`, software
triangle and line counters are all zero. The context reports ANGLE/Intel Mesa;
Chrome was launched with SwiftShader flags, so the reported renderer string
does not independently establish physical GPU use. Cooperative guest execution
was selected, with the game's SDL audio helper thread observed. Audio fidelity,
browser visual parity, stencil shadows and performance remain unqualified.
No new blocking guest trap or rendering failure required a source repair.

Focused evidence checks passed: loaded module hash, all 92 served asset hashes,
trusted paired keys, WebGL backend/counters, advancing frames and saved captures.
Only this documentation changed. The browser, local HTTP/control servers and
own board watcher were closed; the temporary profile was removed. Disk remained
above 2 GB free. No Boat boxes were used or assigned (ID/state/expiry: N/A).
Next useful work is the stale restart overlay or a fresh collision-debris capture.

## Restart console history resolved — 2026-10-30

Evidence: `scratch/runs/20261030T2232Z-gltron-overlay/investigation.json`.
The red upper-left crash/winner lines are intentional persistent console
history in the original game. They are not the current round's status banner.
No emulator code, original assets, or guest configuration changed.

The retained original 0.70 source and installed Win32 binary agree:
`processEvent` (`004035ac`) sends crash and winner strings through
`displayMessage(TO_CONSOLE, ...)` (`004106b9`), which formats and appends them
through `consoleAddLine` (`0041052d`). Its buffer is at guest `0042b240`,
position at `0042b238`, and scroll offset at `0042b23c`.
`drawGame` clears the color/depth buffers and, with original `show_console`,
calls `drawConsole` (`00406fbb`); `consoleDisplay` (`004105ee`) selects the
latest five stored lines at this 800×600 setting. There is no expiry timer.
`consoleInit` clears history at application initialization, not round restart.
Original source excerpts and executable disassembly are retained in the run.

`keyboardPause`'s default key path at `0040ae87` calls `initData` (`00403229`)
when pauseflag is 2 (finished). It resets pauseflag to 1 (running), resets
player trails/speeds and sets winner to -1, without touching the console.
The separate large pause/winner banner comes from `displayPause` / `drawPause`.
Original-code execution counters recorded restart once, console display 25
times, three crash branches, one stop branch and four console appends at the
first observed restart. Diagnostics only read gameplay memory; counter writes
were emulator debug controls. Counters were then disabled for fresh captures.

Personally inspected browser frames `fresh-finished.png`,
`fresh-restart-right.png`, `restart-frame007.png`, `restart-finished.png` and
`final-menu.png`: player two wins, native Return restarts, native A/S bends
fresh yellow trails while old console lines persist, player one collides with
a trail and explodes into visible debris, player three wins, and Escape
returns to the original menu. Paired state samples establish winner -1,
four positive speeds of 8.5 and zero trail offsets on reset, unchanged console
history, then player-one speed -1 and a new appended crash, followed by winner
index 2 and a new `winner: 3`. Frame sequence advances from 290 to 308.
Individual state samples and presented frames can straddle a guest frame;
the immediate restart capture still contains the preceding pause presentation.
The later moving/impact/outcome captures establish the rendered progression.

Exact loaded Wasm remains `7e8d3194fd189a8e0089b41ee5972b08b67fd5650d6dfbe2a2fbb9d3c323a327`,
with provenance retained in the preceding repair/browser investigations.
Chrome 151.0.7922.108 used actual WebGLBackend/WebGL 1, software counters zero;
all 92 original files and served bytes matched their prior pinned hashes.
Sixteen paired trusted Return/A/S/Escape inputs passed, as did focused state,
console-history, module/backend/asset checks and original registration tests.
An initial evidence reader failed because TextDecoder rejects shared views;
copying the read bytes repaired that scratch-only reader. No guest trap occurred.
No production build was needed for this documentation-only conclusion.
Browser, HTTP/control/CDP ports and temporary profile were cleaned up; disk
remained above 2 GB. No assigned Boat boxes (ID/state/expiry: N/A).
The earlier stale-overlay limitation is resolved within this scope; remaining
rendering parity limits above are unchanged. Next useful gameplay work is
longer native survival/steering, rather than clearing original console history.
