# Tux Racer original Win32 progression

The original **Frozen River Practice race now finishes in the real browser /
WebGL path**. Evidence is in
`scratch/runs/20261030T2145Z-tuxracer-browser/`. Personally inspected baseline
race/result frames show **02:06.45, Herring 16, Score 0** and native Enter
returns to the matching Frozen River best result. That invocation also exposed
a real rendering defect: the trees were opaque grey/black rectangles, sometimes
covering most of the view. WebGL1 reported an invalid mipmap operation.

The original tree texture is **256x255 RGBA**. `gluBuild2DMipmaps` previously
uploaded that image unchanged before calling WebGL's mipmap generator. GLU
requires an initial resize to the nearest power of two; the incomplete WebGL1
texture lost its transparent tree silhouette. The unsigned-byte frontend now
uses the existing GLU area-filter convention with periodic edges, rounds ties
up, respects the backend maximum size, and restores guest unpack alignment
after the tightly packed internal upload, including on failure. Existing
power-of-two uploads retain their path. See the
[GLU specification](https://registry.khronos.org/OpenGL/specs/gl/glu1.3.pdf).

The repaired invocation again uses ordinary browser input to select Practice
and Frozen River. Personally inspected frames show textured trees with clear
edges, Tux descending, changing HUD time/fish and a **Race Over result of
01:29.76, Herring 8, Score 623**. Native Up release changes the verified,
relocated SDL key array from 1 to 0. Native Enter returns to Frozen River's
selection with the matching best time, herring and score 000623. Early menu
input entered the event selector; ordinary Escape returned to the main menu
before the verified Practice selection. No guest-state or result write was used.

Both browser runs loaded the preserved module
`69bd55de38f5d19f9e05f73cb301b6897717c544a5ed3f9c49734aecf42f3924`
from runtime main `27d8413c67a7226765662115b4cb9463da17b322`. Requests record
the actual module and script hashes. The repaired race's loaded frontend is
`723adb01ddab78680c867d2e23ca19e584adbe1953126673959ba21651de96d8`,
also retrieved from Chrome's debugger as `after/loaded-gl-compat.js`.
Final source adds invalid-dimension rejection and GLU return-status forwarding;
its `d529d7e8d66dcb7f39fa53bc0fa907b03290ad562ce0e87aab7638e65e808866`
hash is independently checked by final-source WebGL1/2 alpha/readback tests.
The valid-image resizing body is identical. Focused fixed-function, unpack,
command-stream and multitexture suites pass, as do native material/display-list
tests and the locked full build. The new regression rejects the old frontend.
An additional `test-glu-scale-image.js` run stops at its stale API-table hash
assertion on both the unchanged control and repaired source; it does not reach
its scale tests. No API-table file was changed by this repair.

Environment: local Chrome 151.0.7922.108, headless Chromium WebGL1 through
ANGLE/SwiftShader, cooperative guest execution, isolated localhost server and
trusted browser keyboard events. All 158 original asset hashes match the
canonical inventory; the browser mounts 157 data files. Both owned browser and
controller processes exited and private ports 39103/35673 are closed. Temporary
profiles were removed. No Boat was created or assigned, and no public service
was deployed. These are displayed game results, without a competitive timing,
hardware-GPU, audio or FPS claim. Remaining work is optional timing/audio and
hardware/browser coverage, rather than a reproduced race-completion blocker.

The 2026-10-30 full-course run in
`scratch/runs/20261030T2133Z-tuxracer-finish/` finished **Frozen River** using
ordinary Enter, P, Enter and held Up input. Personally inspected gameplay
frames progress through HUD 00:26.35 / fish 2, 00:56.04 / fish 5,
01:26.44 / fish 10 and 01:56.83 / fish 16. The inspected **Race Over** screen
reports **Time 02:08.45, Herring 17, Score 0**. Matching later captures retain
that result. Up release is dispatched and the relocated, verified SDL key
array returns to zero. Native Enter then returns to the inspected Frozen River
selection, which displays the same best result, including score 000000.

The tested source is clean runtime main `27d8413c67a7226765662115b4cb9463da17b322`
(including the previously merged screensaver changes), module
`69bd55de38f5d19f9e05f73cb301b6897717c544a5ed3f9c49734aecf42f3924`, runner
`c82398cf64e381ef2a729696280e4eab858eb51b7deb956f2b150281691b5748`, Node
v24.18.1, WAT software GL, cooperative threads and `--real-ticks`. The locked
full build and native display-list/material suite pass. All 158 original
assets were verified by the existing staging recipe from the retained extracted
payload; the canonical 157-file mount preflight passed. The run retains the exact
module, source manifest, empty runtime-source patch, per-asset hashes, commands,
input dispatch, SDL samples and captures. No runtime repair was needed.

The successful invocation lasted 222.773 wall seconds, exited 0, and its process
group was reaped; private port 18173 closed. Its detached controller also exited.
An earlier invocation's controller ended with SIGTERM (cause unknown) after
63 seconds; the still-running game lost its stdin producer and did not respond
to an attempted pipe reconnection. That invocation was explicitly stopped and
is retained as a harness interruption, without a finish claim. The successful
second invocation added a private HTTP fallback and detached its controller.
No Boat, additional checkout, guest-state write, synthetic result, or public
deployment was used. Canonical ignored assets remain staged for recovery.
This proves a complete original Practice race and its displayed result; it does
not qualify competitive clock accuracy, browser/WebGL gameplay, audio or FPS.
The next useful gate is browser/WebGL completion and rendering/input parity.

The original 0.61a game is registered as `tuxracer_original_061a`. Preserve
its canonical local manifest. The
retained payload and static closure recipe are described in
`tuxracer-original-recovery-oct28.md`.

The 2026-10-30 SDL investigation retained at
`scratch/runs/20261030T200605Z-tuxracer-sdl-owner/` established that ordinary
Enter reaches MainMenu, and ordinary P reaches an unimplemented
`glTexCoord2d` (API 4414), guest EIP `0x00421c56`, return `0x00421c66`.
The inspected frames were MainMenu; that run did not establish Practice or
race gameplay. Sampler relocation repair `cbcfb806f` changes observation only.

The scalar API takes two doubles in four x86 argument words. Its implementation
reads the guest stack at ESP+4 through the checked `glTexCoord2dv` path and
consumes the return address plus 16 argument bytes only after success. Both
forms demote each double once at the existing float encoder boundary and use
opcode 28 (`glTexCoord2f`), preserving unit-zero `(s,t,0,1)`, other vertex
attributes, and display-list value capture/replay. No command opcode was added.
The dispatch generator also includes the scalar native API in dynamic WGL
lookup availability.

Focused validation is in `test/test-gl-texcoord2dv-dispatch.js`: scalar and
vector calls inside/outside Begin, non-affine page crossings, signed zero,
rounding, nonfinite coordinates, stack bytes and GPRs, list compilation and
replay, allocation/translation/wrap failures, and five deliberately broken
route/ABI/encoder variants. `test/test-gl-color4dv-dispatch.js` retains its
color/vertex checks and no longer expects the scalar texture API to trap.
Logs and the bounded original-game retest belong in
`scratch/runs/20261030T2016Z-tuxracer-gl2d/`.

The single bounded canonical original-game retest used the final shared-tree
Wasm and current runner, software GL and cooperative threads. Enter down/up
reached the inspected MainMenu; P keydown was acknowledged and dispatched.
The next trap is **`glColor3dv` (API 4222)**, guest EIP `0x00416427`, return
`0x00416436`, vector argument `0x086027e8`. The process exited after 4.99 s.
Both inspected captures (`poll.png`, `mainmenu.png`) are MainMenu, taken before
P; Practice/race remains unverified. Do not label the menu's Practice button
as a rendered Practice screen. The source/runner/module hashes, canonical
157-file mount validation, input acknowledgements, crash and 25 SHA-verified
remote artifacts are retained in the run above.

Task-owned finite-TTL Boat `bx_yb3nay5w` was snapshot-verified at
2026-10-30T20:23:46.181Z and verified STOPPED at 20:23:46.230Z, before its
original expiry 20:41:54.584Z. Closeout found no surviving task watchdog.
Its stopped snapshot retains `/home/user/tuxracer-render`,
including the original fixture and `capture-gl2d-oct30`. Fork a new finite-TTL
test box for the next API repair; the local run archive also preserves this
retest's captures and control scripts. No public deployment was performed.

The `glRectf` repair on 2026-10-30 is code commit `5cd674228` on main.
It appends opcode 142 without changing earlier command IDs, captures four
float words as one display-list command, and executes the rectangle through
native GL_QUADS vertices `(x1,y1),(x2,y1),(x2,y2),(x1,y2)` at z=0/w=1.
Existing vertex attributes and quad triangulation are reused. Direct calls,
compilation and replay inside Begin/End report GL_INVALID_OPERATION without
ending or changing the caller's primitive. WGL lookup exposes the real API.
Focused rectangle/ABI/list/packed-replay/mutation, color/texture, full-module
WGL, existing display-list/stream/encoder suites and locked build all passed.

The single original 157-file invocation in
`scratch/runs/20261030T2040Z-tuxracer-glrectf/` ran the exact module
`4e62aa1563afe438ab39011b90910d4d311c05d4809241e4e8f6f00b710412b2`
and runner `c82398cf64e381ef2a729696280e4eab858eb51b7deb956f2b150281691b5748`.
Ordinary Enter down/up, then P down/up reached the personally inspected
**Practice “Select a race” / Frozen River screen**. An additional native
Enter down/up in that same invocation reached **“Loading, Please Wait…”**;
both subsequent frames still showed loading. The controller quit normally
at 27.953 seconds (20:41:55.062–20:42:23.015 UTC), exit 0, no new API trap.
Practice selection is verified; race gameplay is not. The next useful step
is a longer bounded observation after race Enter, rather than claiming the
loading frames demonstrate gameplay. Initial read-only mount preflight
inherited the supervisor's small child limit and failed to start Node;
restoring the supervisor's normal child limits verified all 157 files and
the exact hashes after launch, without a second game invocation.

Task-owned fork `bx_msqscjw8`, from stopped parent `bx_na7bzcfg`, has a
verified completed snapshot at 20:43:09.436Z and was verified STOPPED at
20:43:33.964Z, before its original 21:08:03.788Z expiry. The explicit shutdown
delegation is fulfilled. Fork this retained snapshot with a finite TTL;
`/home/user/tuxracer-render` retains the original assets/current runtime and
`capture-glrectf-oct30` control/evidence. All 40 remote artifacts were copied
using Boat exec and SHA-verified locally; no SSH/scp or public deployment.


The longer loading investigation in
`scratch/runs/20261030T2050Z-tuxracer-loading/` used one new finite-TTL fork
`bx_xtwrnjbs` of the stopped `bx_msqscjw8` snapshot. Its initial invocation
verified the same module `4e62aa15...`, runner `c82398cf...` and all 157 original
files. Native Enter, P, Enter reproduced the personally inspected Frozen River
selection and loading at 1 and 5 seconds after race Enter. The controller
scheduled observations through 120 seconds, but the process trapped first:
**glMultMatrixd (API 4343)** at EIP `0x0042aff7`, return `0x0042b002`,
9.715 seconds after the acknowledged race Enter sequence (16.819 seconds
from launch). This is a concrete API blocker, rather than evidence of a
120-second loading stall.

The real double-matrix handler snapshots sixteen checked guest doubles in
column-major order, demotes once into a private float matrix and reuses
canonical `glMultMatrixf` opcode 109. No command IDs or region layout changed.
Matrix109 now captures its 64 pointed bytes inside the owned display-list node;
direct, compile and replay calls inside Begin/End report GL_INVALID_OPERATION
before changing the matrix. Generated dispatch and WGL availability name the
real handler. Focused full-module matrix/ABI/mode/postmultiply/stream/list tests,
non-affine double loads, nonfinite/rounding values, allocation/translation/wrap
failures and three deliberately broken handler variants passed. Existing
color/texture/rectangle, WGL, matrix-observer, list/stream/encoder suites and
`flock /tmp/wine-build.lock bash tools/build.sh` passed.

The sole repaired invocation used exact module
`6085eff52c9be987f67d83563602a0ea89e0c4bac9c36f9cf11171bd3adada4e`
and the unchanged runner. It again rendered the inspected Practice selection
and loading frames at 1 and 5 seconds, then trapped at
**glLockArraysEXT (API 4325)**, EIP `0x0041e46b`, return `0x0041e47b`,
`first=454`, `count=6787`, 12.706 seconds after the acknowledged race Enter
sequence (20.325 seconds from launch). Native disassembly shows the indirect
lock call through guest `0x00575ca0` at `0x0041e475`, followed by indexed
triangle drawing and an optional unlock through `0x00575ca4`.
Race gameplay and steering remain unverified. The next useful gate is real
compiled-vertex-array handling, or investigation of why the guest obtained the
unsupported extension pointer; do not replace the trap with a silent success.

Both complete remote evidence bundles were copied through Boat exec and
SHA-verified (39 initial artifacts, 37 repaired-run artifacts). Recovery is
`boat --json fork bx_xtwrnjbs --ttl 1800 --wait`, then supported Boat exec/file
operations in `/home/user/tuxracer-render`. The snapshot retains original
assets, repaired module and `capture-matrixd-oct30/supervisor.py`; use a fresh
capture directory for a new invocation. The exact original module remains in
the local predecessor archive. The new fork's snapshot was verified at
2026-10-30T20:53:48.775Z and STOPPED was verified at 20:53:50.160Z, before its
original 21:17:17.472Z expiry. Parent snapshot/state were reread unchanged;
other Boats were untouched. Explicit shutdown delegation is fulfilled and
recovery ownership returns to the coordinator.

The material Begin/End repair on 2026-10-30 permits `glMaterialfv`,
`glMaterialf` and `glMateriali` during an immediate primitive. Validation runs
before observers or list capture; invalid faces/pnames and out-of-range
shininess latch GL errors. Before each valid material update, pending vertices
are lit using the preceding material through the existing WAT lighting
evaluator. The primitive keeps its topology and current colour. Packed mode
bit `0x20000` carries these already-lit colours through software, render-worker
and JS replay without applying lighting again; JS restores lighting after
the draw, including on exceptions. Display lists own material vector bytes.
This reuses the existing lighting model and does not establish new back-face,
two-sided-lighting or colour-material conformance.

The interrupted worker's complete archive was recovered without restarting its
session or duplicating its transfer. All 140 remote files and the 8,107,379-byte
archive were SHA256-verified again. The self-contained closeout is
`scratch/runs/20261030T2127Z-tuxracer-closeout/`; the earlier
`20261030T2115Z-tuxracer-material` evidence remains unchanged. Its retained
source manifest and staged 286-file verification tie the observations to module
`9e37f0f17c3106a6a6665c7ea3d408c6d924c839b0d7a4fd7961b095c954928f`
and runner `c82398cf64e381ef2a729696280e4eab858eb51b7deb956f2b150281691b5748`.
All five repaired runtime source files still matched that manifest on takeover.
The original 157-file canonical mount preflight passed. The archived module
is preserved separately from subsequent shared-tree builds.

Two software-rendered invocations used native Enter, P, Enter. The first used
the batch clock and exited normally after 52.625 seconds. The second used
`--real-ticks --no-threads` (cooperative guest threads), ran 127.414 seconds,
and retained race frames through 120 seconds after race Enter, with no material
trap and exit 0. Left/Right/Up events were actually dispatched; the relocated,
verified SDL key array records each key changing 0→1→0 around its hold.
Personally inspected held-Left and held-Right frames show different turns and
terrain positions. The final inspected frame shows Tux descending, fish **8**,
speed **11 km/h**, and HUD time **01:46.79**. This establishes visible bounded
race progression and steering; the 120-second controller interval is not the
HUD elapsed time. Race completion, competitive timing, audio playback,
browser/WebGL gameplay and sustained performance remain unverified.

Focused material/list/ABI/colour/topology/software/JS-replay checks and the
encoder, matrix-observer, software-raster and shared-render-worker controls
passed again on takeover, together with the locked full build. Three prior
broken variants (late lighting, borrowed list vector, skipped validation) were
rejected. No further runtime blocker emerged in the retained run.

Only explicitly delegated Boat `bx_fsqw4bh6` was touched. Its named snapshot is
`tuxracer-material-oct30-retained`; final snapshot verification completed at
2026-10-30T21:28:02.337Z and STOPPED was verified at 21:28:02.375Z, before
the original expiry 21:42:44.456Z. Both runtime groups report reaped descendants.
Recovery uses the saved snapshot and `/home/user/tuxracer-render`, or the local
runtime bundle, exact module, original manifest recipe and capture scripts.
The next useful gameplay gate is a complete Frozen River run with timing and
finish-state verification. No parent box, public deployment or Telegram action
was used.

The compiled-array blocker is an advertisement bug in the dynamic system-API
fallback. WGL already returns NULL for `glLockArraysEXT` and
`glUnlockArraysEXT`, but SDL retries through `GetProcAddress` on the OpenGL
library. Its original Windows lookup at SDL VA `0x10026f40` calls WGL at
`0x10026f51`, tests EAX, then calls the imported `GetProcAddress` at
`0x10026f60` on failure. Our fallback previously returned fail-fast thunks for
both names merely because they occur in the global API table.

The dispatch generator now derives an unsupported GL/WGL predicate from the
same implementation sets as WGL availability. The synthetic system-library
`GetProcAddress` fallback returns NULL with ERROR_PROC_NOT_FOUND before reserving
a thunk for these APIs. Real loaded PE exports still resolve before that check;
implemented GL APIs and unrelated compatibility names retain their existing
lookup behavior. The compiled-array handlers remain fail-fast, and the extension
string does not advertise compiled vertex arrays. No GL command, ABI, matrix
repair or display-list behavior was changed.

`test/test-wgl-proc-availability.js` checks both resolution paths, supported
thunk identities, NULL/error/no-thunk rejection and guest stack/GPR preservation.
It rejects three compiled broken variants: omitted availability check, rejection
of every API, and missing stdcall cleanup on rejection. The existing sparse-name
and loaded-PE GetProcAddress regression, native display-list suite and locked
full build passed. Evidence belongs to
`scratch/runs/20261030T2057Z-tuxracer-lockarrays/`.

The original 157-file retest used module
`55de8b7c7e4557cd22244e8ff27f71685ea1d1e5d4916a67d0cc83ba1e0ab299`
and unchanged runner `c82398cf...`, software GL and cooperative threads.
Native Enter, P, Enter reached Frozen River and then personally inspected
**visible race gameplay** at 15, 30 and 60 seconds: Tux, terrain, trees, race
HUD and changing fish count/position. Both extension slots `0x575ca0/0x575ca4`
were NULL. The batch-clock invocation ran 74.330 seconds and trapped 67.002
seconds after race Enter, rather than reaching its scheduled 90/120s captures.
The HUD's large time jumps are not evidence of correct timing or frame rate.

The exact next blocker is `glMaterialfv` (API 3246, command 68), indirect call
through `0x437148` at `0x422cc9`, guest EIP `0x422c80`, return `0x422ccb`,
face `0x408`, pname `0x1602`, vector `0x074ffce4`. The trapped Wasm offset
`0xdd576` in `$gl_wat_encode_call` is the immediate-mode guard immediately
before `$gl_pointer_length`. Investigate material changes during Begin/End;
this is distinct from the repaired optional compiled-array lookup.

A second invocation attempted native Up/Left/Right and captured held/released
frames, but the arrow events were only queued, not dispatched before the same
material trap (26.250 seconds from launch). Those frames are unchanged, so
**steering remains unverified**. A third invocation used `--real-ticks` and
planned longer holds through actual input dispatch; it hit the same encoder
trap before that sequence. Do not equate controller acknowledgements with
game input consumption. Full logs, inputs, three invocations and source/hash
evidence are retained in the run directory above.

Sole task fork `bx_uuyqqtcg` was snapshot-verified at
2026-10-30T21:05:31.499Z and verified STOPPED at 21:05:31.539Z, before its
original 21:26:57.388Z expiry. Its stopped parent `bx_xtwrnjbs` was reread
unchanged. All three runtime process groups were reaped. Recovery is
`boat --json fork bx_uuyqqtcg --ttl 1800 --wait`, then supported Boat API exec
in `/home/user/tuxracer-render`; `LOCKARRAYS-RECOVERY.txt` and the three fresh
capture directories preserve the recipe and original assets. The two local
archives verify all 108 plus 37 remote files by SHA256. No public deployment
or SSH/scp was used; explicit sole-fork shutdown delegation is fulfilled and
recovery ownership returns to the coordinator.
