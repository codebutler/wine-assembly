# Black & White 2 demo

## Input and extraction (2026-09-09)

`test/binaries/win98-games-a-d/Black and White 2-DX9-D3D.exe` is the
647,216,200-byte Black & White **2 demo** InstallShield 11 self-extractor.
It is not the original Black & White game.

The outer payload starts at file offset `0x1c200`. Each entry is four
NUL-terminated ASCII fields (basename, `Disk1\\...` path, version, decimal
byte length), immediately followed by exactly that many uncompressed bytes.
Walking nine entries ends exactly at EOF. Measured with `xxd` and a bounded
field walker against the input, not guessed from cabinet signatures:

| Entry | Data offset | Bytes |
|---|---:|---:|
| data1.cab | 115243 | 36286822 |
| data1.hdr | 36402105 | 58374 |
| data2.cab | 36460523 | 609467787 |
| engine32.cab | 645928357 | 543481 |
| layout.bin | 646471878 | 559 |
| setup.exe | 646472483 | 121064 |
| setup.ibt | 646593588 | 395955 |
| setup.ini | 646989581 | 480 |
| setup.inx | 646990102 | 226098 |

`unshield l data1.cab` lists 416 files when its matching header is beside it.
Extraction also needs **data2.cab**. Earlier `/private/tmp/black-white-seed2`
emulator overlay contains data1.cab/hdr but **omits data2.cab**; it is therefore
not a complete installation source. `7z` cannot open the outer EXE.

The game EXE is `MainApp/BW2Demo.exe`, 20,656,128 bytes. The largest asset is
`MainApp/Data/Everything.stuff`, 432,577,472 bytes. Other file groups provide
English speech/text, splash textures, credits and the readme. DirectX support
includes `Apr2005_d3dx9_25_x86.cab`. Inspect actual imports with:

```
node tools/pe-imports.js PATH/MainApp/BW2Demo.exe --all
```

## Installer investigation

The direct extracted setup needs all three runner arguments:

```
--exe=PATH/setup.exe
--exe-guest-path=c:\windows\temp\byep1.tmp\disk1\setup.exe
--cwd=c:\windows\temp\byep1.tmp\disk1
--args=-deleter
```

Use `--quiet-api --quiet-blocks`. Positional EXE arguments are ignored by the
runner; omitting the guest path searches for engine32.cab in the wrong place.
Dialog control sequence: wait 710, click 1; wait 1000, click 1000 and 1;
wait 718, click 1; wait 711, click 1 (Install).

Loading `isprobe.tlb` imports stdole2. Registering and mounting its raw MSFT
type-library data removes the measured `TYPE_E_CANTLOADLIBRARY 0x80029C4A`.
This does **not** establish installer success. The following failure jumps
through zero at iuser original VA `0x10001d7c`: an AddRef indirect call where
EDI points to ASCII GUID-path data, not an object. Runtime iuser base in these
runs is `0x01d2f000`, original base `0x10000000`.

`iuser+0x10003391` receives the pointer and forwards it via `0x100010cb` to
the AddRef helper `0x10001d6f`. Cause is still unproved: argument marshalling,
pointer lifetime and unsupported COM behavior remain possibilities. Earlier
claims that the Win98 OLEAUT library lacks these standard automation helpers
were speculative and must not be used as evidence for native overrides.

## Direct executable startup

The complete extraction is currently `/private/tmp/black-white-full.ntZDCF`.
`unshield -d extracted x data1.cab` succeeded for all 416 files. The DirectX
cabinet's `d3dx9_25.dll` was extracted beside `MainApp/BW2Demo.exe` with `7z e`.
Game launches use `--vfs-include='**/*'` and explicit `--dll-seed=` paths for
d3dx9_25.dll, binkw32.dll and dbghelp.dll; the ordinary DLL graph supplies CRT
dependencies. English supplemental groups have provisionally been copied
into MainApp's Data, Audio and Data/Art/Textures folders (verify filesystem
traces before treating these destinations as established).

The executable enters real startup code. CPU gaps observed, in sequence:

- `0x00b65de8`: **F3** 0F59, MULSS (not MULPS).
- `0x0040b656`: UCOMISS followed by LAHF and parity tests.
- `0x006013e0`: scalar division during startup object construction.

The runner's crash EIP can point **after an instruction prefix**. Always
disassemble from a known preceding instruction/function entry: disassembling
at reported EIP `0x00b65de9` falsely labels the opcode MULPS. ADDPS/MULPS were
already implemented in dc7bc157. Scalar arithmetic and UCOMISS are being added
with `test/test-sse-scalar.js`; no SSE feature bit is advertised yet.

The stale region-owner anchors were resolved by the shared integration lane.
Use paired current artifacts: `tools/build-compile-wat.js --out=...
--compat-out=...`, then `--no-build --wasm=...`; do not mistake an older
build/wine-assembly.wasm for current sources. No gameplay has been verified.

## Programmable renderer implementation

The direct game reaches a fatal pixel-shader 1.1 capability check after
creating its LIONHEAD window in the default profile. The experimental
`?d3d9-programmable` profile enables real shader/texture/buffer rendering after
a GPU pixel probe. No game patch or capability-only bypass is used.
See `apps/direct3d9.md` for the extension to the existing graphics design.

Real WAT shader objects/constants, guest texture mip storage/level surfaces,
vertex/index buffers, locking/binding/lifetime and programmable UP/buffer
draws now lower through the shared GPU backend. `test-d3d9-pipeline-web.js`
checks completed canonical BGRA frames, INDEX16 rebasing, INDEX32 above65535,
signed base-vertex offsets and locked/range rejection. These synthetic
rendering passes do not establish game menu or gameplay compatibility.

The genuine browser run with that profile gets past the shader check and
traps at `0x009343b4`: the following call at `0x009343c4` is
`[device-vtable+0xf4]`, **EndStateBlock** (slot61). Return address is
`0x009343ca`; device pointer `0x07f07030` in the measured run. The immediately
preceding sequence records render states via slot57 (`+0xe4`). Logs label
these COM thunks `<ord>`; disassemble the caller to identify the actual slot.
Selective render-state block recording/Capture/Apply is now implemented and
unit-tested; other recording categories fail explicitly until implemented.

Subsequent genuine browser runs advanced through these measured gaps:

- `0x0093459e`, slot69 `+0x114`: SetSamplerState during recording.
- `0x00934664`, slot65 `+0x104`: SetTexture during recording (initial null bindings).
- `0x0093468f`, slot44 `+0xb0`: SetTransform, texture matrices16..23.
- `0x00936a09`, slot22 `+0x58`: GetGammaRamp for implicit chain0.

Selective sampler, internally retained texture bindings and immutable matrix
copies now Capture/Apply without changing live state during recording. Tests
cover replacement/release, caller-memory reuse and independent matrix slots.
Gamma has copied per-device API data, with display capability still disabled.
The initial WORD ramp is0..255 per Microsoft's "Using gamma correction" note,
not0..65535; the game's following loop multiplies each WORD by255.
No menu or gameplay has yet been reached. Probe logs live under
`/private/tmp/black-white-*-probe.log`; the probe uses the genuine extracted
assets and only the opt-in real GPU capability profile.

Native D3DX then records vertex declarations at original`0x0051b0a1`
(`+0x15c`,slot87) and vertex float constants at`0x005121be`
(`+0x178`,slot94). Measured DLL base`0x02528000`, original`0x00400000`;
runtime failures`0x02643099`/`0x0263a1ac`. Declaration/shader references and
per-register float constant state blocks now have lifetime/overlap tests.

The next real failure was ReadFileEx at`0x00b532be`. It reads175104 bytes
from Everything.stuff offset102306304 into`0x4c550000`; OVERLAPPED at
`0x4fda0300`, callback`0x00b53100`. The callback uses hEvent as a private
context pointer, which must remain untouched. Positional VFS reads now preserve
the shared file cursor and queue completion on the calling WAT instance for
SleepEx/WaitForSingleObjectEx alertable delivery. Lazy residency currently parks
submission through existing IO_WAIT before queueing; this is not fully
asynchronous provider scheduling. Other APC/cancellation APIs remain unsupported.

First integration hung at`0x00938963` in the texture-loader polling loop.
Passive callback count stayed0 despite SleepEx(0,TRUE) and completed bytes.
Cause: inline CALL-reg dispatch overwrites redirected EIP unless steps=0;
handler_set_eip only protects the outer thunk-zone path. The APC continuation
now sets both, and test-read-file-ex includes an actual x86 CALL-reg regression
(the original direct-handler callback test did not exercise that path).

WIP checkpoint: the genuine browser run now advances beyond that callback to
native D3DX at runtime `0x025f6e12` (original `0x004cee12`), with `EDX=0x31545844`
(`DXT1`). This next texture-loading failure is not yet diagnosed. No menu or
gameplay has been verified.

Continuation: disassembly identifies that call as device slot6 GetDirect3D
(`call [eax+0x18]`), not a DXT decoder failure. Parent identity/AddRef and
device-owned lifetime now have compiled tests, along with the subsequent
GetDisplayMode/GetCreationParameters queries. Genuine browser execution passes
this point and reaches D3DX original `0x0051b59e`, runtime `0x0264359e`, whose
`call [ecx+0x10c]` is slot67 SetTextureStageState during state-block recording.
Eight stage rows and selective recording/restoration are being implemented;
fixed-function visual conformance remains unverified.

Stage recording now passes compiled tests and genuine D3DX execution. The next
CPU trap was `F3 0F 2A C0` at `0x00a6bb7f` (CVTSI2SS xmm0,eax). Both GPR and
memory-source forms now convert signed i32 with default nearest-even rounding
and preserve the upper96 XMM bits; 80-case scalar SSE suite passes. MXCSR
rounding/exception state is still not modeled by this SSE subset.

Next D3DX original `0x00429fc1`, runtime `0x02551fc1`, calls device slot38
GetRenderTarget (`+0x98`) then surface slot12 GetDesc (`+0x30`). The getter now
returns the existing render target through its stable Surface9 wrapper with a
caller reference; GetDesc reports the canonical surface dimensions/format.
Compiled identity/reference-count/output-boundary tests pass.

The genuine run passes those queries, then a native DLL at `0x037bca25`
requests ConvertDefaultLocale(LOCALE_USER_DEFAULT=0x400). API3355 now converts
the user/system aliases to the existing emulated en-US locale and preserves
other identifiers and LastError. Thread-locale regression verifies this is
independent of the caller's SetThreadLocale setting.

Further startup continuation (2026-09-09):

- D3DX original `0x0042c58d` requests GetFontLanguageInfo. The API now derives
  legacy kerning/codepage flags from the selected font's actual tables;
  stock bitmap fonts report no shaping flags. Public GDI regression passes.
- Game `0x00937040` requests CreateQuery(EVENT=8). A retained Query9 object now
  implements identity, lifetime, Issue(END) and GetData. Issue uses a real
  synchronous GPU completion barrier; no asynchronous polling performance is
  claimed. Unsupported query kinds return NOTAVAILABLE. Compiled API tests and
  the genuine browser GPU pipeline test verify the barrier and rendered pixels.
- An apparent normal exit was actually a null indirect call at `0x0051f024`:
  GetProcAddress(AddFontMemResourceEx) had returned zero. The game decrypts an
  embedded font into temporary memory, registers it, then frees that buffer.
  Memory font APIs now copy single-face glyf TrueType data into the existing
  face cache, select it privately without enumeration, and unregister by a
  validated handle. Removed faces remain in the existing bounded process cache
  for live realizations; cache eviction, TTC and CFF are not implemented.
  Tests overwrite the source and rasterize the retained copy.
- Next apparent exit was a missing suffix in LoadLibrary's lookup of
  `.\\PlugIns\\ScriptLibraryR`. The supplied DLL already exists in the asset
  manifest. WAT now appends `.dll` when the basename has no extension, and
  honors trailing-dot suppression. The real DLL loads at `0x03801000` and its
  script exports resolve; no script-engine substitute is used.
- Next CPU trap `0x005fdde2` is the prefixed instruction starting at
  `0x005fdde1`: `F3 0F 2D C1`, CVTSS2SI eax,xmm1. Register and four-byte memory
  forms now implement default nearest-even conversion with the x86 indefinite
  integer for invalid/overflow values. The scalar suite passes104 cases.
  Non-default MXCSR modes remain outside the current SSE subset.

Diagnostic logs: `/private/tmp/black-white-exit-trace.log`,
`black-white-memory-font.log`, `black-white-script-library.log` and
`black-white-cvtss2si.log`. All use the genuine extracted files and the explicit
programmable-GPU profile. Menu and gameplay are still **not verified**.

The local Microsoft `binaries/explorer98/dlls/ole32.dll` (4.71.2900) identifies
CoFileTimeToDosDateTime as ordinal23, VA`0x7ff8b556`. Disassembly validates an
8-byte source and two 2-byte output pointers, then calls KERNEL32's
FileTimeToDosDateTime via IAT`0x7ff213a8`. BW2 imports this **by name**; hint25
is not its ordinal. The new wrapper follows that delegation, with compiled
date-range/leap-day/output-boundary/invalid-pointer tests. Genuine startup now
passes `0x0091ee3c`, starts its worker threads and loads additional resources.

Next missing import is GetKeyNameTextW at`0x0064b860`. The bounded UTF-16 wrapper
shares the existing ANSI US scan-code names and has truncation/terminator/ESP
coverage. It inherits that mapper's incomplete extended-key/localization scope;
this is not a complete keyboard-layout implementation. Current diagnostic logs
are `/private/tmp/black-white-co-filetime.log` and `black-white-key-names.log`.

The key-name run passes that initialization and reaches D3DX runtime
`0x025fa277`, original`0x004d2277`. The call at original`0x004d2294` is
`call [esi+0x64]`: device slot25 **CreateCubeTexture**, not another 2D texture
getter. Measured size128, levels1, format21 (A8R8G8B8). Cube resources and cube
sampling are not implemented: the shader compiler currently declares only
sampler2D, and the shared GPU texture interface only uploads TEXTURE_2D.
Next work must cover six face/mip stores, CubeTexture9 identity and surface
aliases, plus cube sampling through the shared backend with pixel tests.
Do not alias a cube to one 2D face or advertise cube support before that works.

Cube continuation (2026-09-09): APIs3369..3390 now implement the 22-slot
CubeTexture9 interface (private-data/autogen operations still fail loudly).
Six independent face/mip stores share locks with retained Surface9 aliases.
The shared GPU backend supports cube upload/binding; shader TEX specialization
uses the bound resource type. Compiled storage/identity/lock/lifetime tests and
actual browser pixels pass for all six faces, lower LOD, return to 2D, and
mixed 2D/cube samplers in both orders. Default shader capabilities are unchanged.

The genuine run now passes cube creation and finishes Greek model preloading.
It then stops at EIP0, without ExitProcess: captured stack return0052679a
identifies game00526795 calling0091ec50, whose tail jump reads a null file
object at +4 then its vtable slot12. The preceding file-open operation requests
data/art/textures/logo.png, which exists in the extracted MainApp tree.
Its open/allocation failure is not yet diagnosed. The trace also contains many
DXT1 (31545844) and DXT5 (35545844) CreateTexture requests; those formats remain
unimplemented and are rejected, not silently accepted. A late ReadFileEx has a
null destination, suggesting allocation pressure, but that is not yet a proven
cause of the logo failure. Logs: /private/tmp/black-white-cube.log and
black-white-cube-stop.log. No menu or gameplay has been verified.

The focused file-loader trace resolves that failure: CreateFileA returns
700000bc and GetFileSize returns00060af6 for logo.png. CreateFileMappingA
returns fb000078, but MapViewOfFile returns0 at00925086. At exit the live map
count is410 and backing cursor1bffa000 is only24KiB below its1c000000 limit.
That is backing exhaustion, not a missing path or DLL export.

Mapping lifetime audit found UnmapViewOfFile deleting JS view metadata without
releasing its guest allocation; failed async provider fills leaked unpublished
allocations too. The matching guest_map_free export now releases those sparse
views (not HeapFree), and invalid/double unmaps fail. Non-top virtual releases
leave holes, so the commit allocator now searches live backing extents for a
non-overlapping gap only when the bump cursor cannot satisfy a request.
It preserves live addresses and the high-water cursor and zeroes reused bytes.
Tests cover1100 real map/release cycles, non-top gap reuse, retained live bytes,
consecutive non-overlap, writeback, async failure cleanup and cross-instance
reservations. The fixed512MiB total /320MiB backing layout is unchanged.

Diagnostic caveat: black-white-unmap.log and black-white-map-reuse.log still
used the preceding compiled browser artifact; they are not post-fix acceptance.
The canonical rebuilt pair is1072381/1072841 bytes; the follow-up run is
/private/tmp/black-white-map-reuse-built.log.

The rebuilt run **passes** the logo map:00925086 returns385a0000, then native
D3DX processes PNG data. At the next stop there are130 live mappings totaling
169906176 bytes (about162MiB); no memory-layout expansion was needed.
New stop00526cf0/return00526d1d is call [ecx+0xc0] at00526d17,
device slot48 GetViewport. Viewport now has real24-byte Get/Set state,
initial full-target dimensions, bounds/depth validation, and immutable GPU draw
snapshot lowering. The browser pipeline verifies default values, preserved
state after an invalid setter, cropped rendering, and untouched outside pixels.
Viewport state-block recording remains explicitly unsupported.

Viewport continuation reaches D3DX original0042aa4a (runtime02552a4a):
device slot79 SetNPatchMode(0) while recording the sprite state block.
The old recording guard trapped even on disabled mode; the old getter also
incorrectly returned its FLOAT in EAX. The linear-only backend now accepts
disabled mode (+0/-0), including recording, rejects every nonzero/NaN request
with NOTAVAILABLE, and returns GetNPatchMode through x87 ST(0). This does not
implement or advertise N-patch tessellation. State-block and FLOAT/ABI tests
pass. Diagnostic log: /private/tmp/black-white-npatch.log.

The next sprite-recording calls are SetIndices(NULL) at D3DX0042ac53 and
SetStreamSource(0,NULL,0,0) at0042ac63. Both now use real selective state-block
buffer capture rather than the previous recording guard: last write wins,
stream offset/stride are copied, retained buffer references transfer and
release correctly, and invalid writes preserve prior recorded state.
Compiled tests cover non-null replacement, Capture/Apply and release lifetime;
this is not a NULL-only bypass. Build1073008/1073468 passes canonical gates.

The subsequent black-window loop actually calls SetVertexShader(NULL) and
SetPixelShader(NULL), followed by DrawPrimitive and DrawIndexedPrimitiveUP.
Those were rejected before GPU submission. The new bounded fixed-function
compiler consumes real state snapshots through the shared GPU backend; no
failed guest shader is replaced. WAT-to-browser tests verify world translation,
textured diffuse modulation, POSITIONT coverage and alpha rejection. Build
1072939/1073399 passes the canonical gates; state-block regressions also pass.
The first run (/private/tmp/black-white-fixed.log) still has a black final frame,
with missing-texture and incomplete-mip-chain errors. Two follow-up corrections
implement documented null-COLORARG1-texture cascade termination and one-level
LOD clamping (non-mip filtering, not generated texture data). Pipeline tests pass.
Fresh follow-up log: /private/tmp/black-white-fixed2.log. Gameplay is unverified.

The error-free follow-up remains black. Observational draw snapshots identify
a raster bug: TL/TR/BL POSITIONT strips (white diffuse, valid viewport, z0,
cull3) write zero colored pixels. The backend selected GL_CCW as its front
face, discarding the clockwise sprites D3DCULL_CCW must keep. It now selects
GL_CW; browser regressions explicitly verify both culling modes on the same
screen-space triangle. Genuine follow-up: /private/tmp/black-white-culling.log;
indexed-sprite snapshots are being checked too. No menu acceptance yet.

Corrected-culling snapshots confirm480000 colored pixels in800x600 after
the loading strip, and later indexed sprites write pixels too. Completed
presentation canvases also contain480000 colored pixels while the whole-window
screenshot is black (/private/tmp/black-white-presentation.log). Renderer
exclusive composition skips windows with no _backCanvas; this GPU-only client
does not request a GDI canvas. D3D9 bridge initialization now asks the existing
renderer.getWindowCanvas owner to create that normal backing once. It does not
create another compositor or reuse the live GPU context as a window surface.
Pipeline regression verifies that acquisition; genuine follow-up is
/private/tmp/black-white-compositor.log.

That backing acquisition alone does not fix display. The remaining concrete
notification bug is D3D9 Present assigning renderer.needsRepaint, which no
renderer code reads. Present now calls renderer.scheduleRepaint, preserving
the normal deferred/Worker-safe publication path. Pipeline tests assert exactly
one compositor scheduling request per completed Present. Fresh window probe:
/private/tmp/black-white-repaint.log. The earlier backing-only explanation was
incomplete; neither a colored GPU buffer nor a Present count proves display.

The corrected repaint run visibly renders the genuine Lionhead Studios particle
intro. Screenshot personally inspected:
/private/var/folders/dz/1fqkk_jd4350qkm91pm9_q3c0000gp/T/black-white-browser-DqPoHR/frame-3.png.
This is the first verified visible game-rendered scene, not gameplay or a menu.
The probe now accepts explicit timed browser key/click inputs (BW2_INPUTS);
the next run sends Escape at50/70 seconds to attempt normal intro skipping.
Log /private/tmp/black-white-menu.log; no guest-state patching.

Escape/Space and a real browser click do not skip the intro in180-second probes;
the particle animation is still visibly advancing (npCxjk/final.png). Keyboard
events log hwnd0 whereas mouse events target10001, so skip-key delivery is not
yet proven. Do not classify an animating slow intro as an infinite loop merely
from elapsed wall time. DXT1/DXT5 are now real compressed sampled resources:
block-row allocation/pitches/locks and small mip tails stay compressed, while
the upload snapshot decodes RGB565 and alpha selectors. CPU/compiled tests and
WAT-to-GPU pixels pass. A concurrent authorized main merge preserved the dirty
work and changed the base layout; canonical build now1073704/1074165,
layoute5ea7699f58899e4,source306. Fresh420-second run:
/private/tmp/black-white-dxt.log. No menu/gameplay claim.

The intro loop is005260e0, per-frame simulation/render00526cf0. It increments
object+20 once per frame; object+0 becomes636 in the observed run. At00528141
the fade starts only after frame > target+350, then object+28 rises until >255;
00529421 sets object+24 = currentFrame+500, and0052943b returns completion only
after that frame. Escape is not tested by this loop; mouse and arrow keys alter
its particle interaction instead. This is a frame-count animation, so a few FPS
means many minutes. Read-only BW2_INTRO_TRACE captures the object from ESI at
00526d93, avoiding a hard-coded guest stack allocation.

However,420-second runs stop submitting frames at1000 (DXT run) or953
(counter run, introFrame918, target636, finishFrame-1, completion0). CPU still
executes00868xxx/008c6xxx animation evaluator code. That is not evidence that
the intro returned; the earlier beyond-intro inference from EIP alone was
premature. A600-second follow-up includes calling-stack observations:
/private/tmp/black-white-intro-stack.log. No runtime clock or game state patched.

The600-second stack run stops at introFrame655. Actual saved return addresses
0052618d and00526198 put execution in the100ms catch-up loop, not intro teardown.
GetSystemTimeAsFileTime was multiplying ticks by10000 and adding the epoch using
i32 arithmetic, then writing a constant high DWORD. Consequently its reported
time jumps backwards whenever the low DWORD wraps (~429.497 seconds); the game's
unsigned elapsed-time loop then attempts an enormous number of updates. The API
now uses an unsigned tick extension and i64 multiply/add/store, preserving the
existing simulated epoch and clock source. test-system-filetime covers the exact
first carry boundary, subsequent carries, signed tick bit, one clock sample,
output bounds and stdcall. It passes, as does the corrected real-device NULL
shader test. No guest clock scaling, animation counter or binary patch is used.

BW2_INTRO_TRACE also counts catch-up iterations00526185 vs render-loop0052619d
and samples the game's elapsed milliseconds0177cb18. This can distinguish normal
slow animation from a new enormous-delta catch-up. Keyboard hwnd0 is the renderer's
normal key-event route, not evidence of an input-routing fault; this intro does
not check Escape. A fresh long run is needed to establish progression after the
FILETIME fix; no menu/gameplay acceptance yet.

## Software-worker launch integration (2026-09-10)

The first current-source software CLI probes use all MainApp assets and the
three explicit DLL seeds above, `--d3d9-renderer=software --d3d9-programmable`,
`--batch-size=200000 --real-ticks --max-seconds=45`. Diagnostic artifacts are
`/private/tmp/bw-software-integration.DqstAK/wine.wasm` and its compat pair
(1098688/1099156 bytes, layout f73bfdc3f7f38137). They compile current sources;
the full canonical build still stops at unrelated stale toy-VM browser bundles.

Both ordinary and trace-yield probes stop after 288 batches with `STUCK` at
thunk07503488, return00a4da46. Disassembly confirms call00a4da40 is device
slot81 DrawPrimitive (`+0x144`), triangle strip5, start0, count2. The CLI stuck
detector lacks an exemption for outstanding render waits, although it exempts
controlled sessions; consequently the passing controlled worker smoke does not
prove ordinary launch behavior. A scheduler correction and uncontrolled test
are in progress. This observation does not prove a worker deadlock or gameplay.
Logs are `run.log` and `scheduler.log` in that diagnostic directory. A bounded
follow-up raises only the diagnostic `--stuck-after` threshold to1000000;
`extended-wait.log` will distinguish a false stop from actual renderer errors.

The raised-threshold follow-up does continue submitting real draws. It reports
`D3D9 software: only bounded triangle lists are implemented`, followed by
`D3D9 software: blending is not implemented`. These are explicit renderer
implementation gaps, not a silent successful rendering path. Strip/fan
normalization is now the next adapter task; native blending remains required.
This progression supports the false-stop diagnosis, but no visible gameplay
has been verified.

Strip/fan and native blending integration follow-up:
`/private/tmp/bw-blend-integration.FJ1QzJ/wine.wasm` (1100883 bytes) and its
1101351-byte compat pair compile the new native blend stage and defaults.
`run.log` no longer reports the strip/blend rejections, but the personally
inspected 800x600 `frame.png` is solid white. That run reaches its100000-batch
limit; its CLI summary prints the configured60-second budget as elapsed time,
so the summary must not be used as a performance measurement.

`timed.log` instead uses100000000 max batches and a45-second wall guard, plus
the diagnostic raised stuck threshold. Its more precise backend error is
`fixed-function features are not implemented: alphaTest` (14 occurrences),
not lighting/fog/specular. It starts five guest worker threads. `timed.png` is
byte-identical to the inspected white frame. Alpha testing is the next native
pipeline task; this is not menu/gameplay acceptance. Software triangle, blend
and worker unit results alone did not predict this real-game blocker.

Alpha-test integration follow-up: current-source diagnostic pair
`/private/tmp/bw-alpha-integration.jT7BVd/wine.wasm` and `.compat.wasm` are
1101235/1101703 bytes. The45-second wall-guard run ends at309117 batches with
no renderer error lines. Both programmed and NULL-shader draws now receive
native alpha-test state; a low8 reference and comparison are copied before
execution and applied before color/blend/depth writes. The personally inspected
800x600 `frame.png` is predominantly white with one faint yellow spot near the
lower center, rather than the preceding completely white frame. This proves
changed rendered output, not recognizable intro completion, menu or gameplay.
The same five guest workers are present. Logs remain in that directory.

Ordinary CLI wait follow-up: `normal-wait.log` in the alpha-integration directory
uses the same assets/build and no `--stuck-after` override. After the live render
request exemption, it reaches the20-second wall guard at312228 batches without
STUCK. Stats now reports measured execution20.009s rather than a configured
deadline. `test-cli-elapsed-time.js` independently checks the timing correction.
No image was captured in this run; it establishes continued execution, not
visual progress or gameplay. A separate production-worker strip benchmark found
most default draw wall time spent waiting between256-quad timer callbacks;
bounded scheduling improvements are in progress before the next game capture.

Bounded worker batching follow-up: `/private/tmp/bw-slice-integration.4NVoSq/`
contains current diagnostic1101707/1102175-byte Wasm artifacts, `run.log` and
`frame.png`. The ordinary run uses unchanged256-quad native steps grouped into
4ms/64-step worker callbacks, no stuck override and a45-second wall guard. It
ends at22872 batches in measured45.007s and now reports repeated unsupported
single-level2D texture and primitive topology errors. This is additional failing
draw coverage, not evidence that batches/s measures game speed. The inspected
640x480 capture is still white with a faint yellow spot; no gameplay. Capture
the failing texture and primitive descriptors next before selecting mip/cube or
point/line implementation work. The matching synthetic worker benchmark has
identical output before/after batching, but does not establish real-game parity.

Parameter diagnostic follow-up: the old topology error was misleading. The
actual rejected draw is triangle LIST4 with2950 primitives, exceeding the
adapter's256-primitive limit; it is not a new primitive topology. The rejected
texture is stage0,1024x1024,11 mip levels,0 cube faces. `parameters60.log` records
these values after enriching the existing errors; the preceding30-second run
ended before reaching this phase. Next work is ordered large-draw batching and
real mip-chain sampling, not a point/line or cube workaround. The software
adapter regression now distinguishes capacity failures from topology failures
and checks texture diagnostic fields while preserving allocation ownership.

Large-draw plus mip integration run: `/private/tmp/bw-mip-integration.nWAYwR/`
contains diagnostic1104018/1104486-byte Wasm pair and `run.log`/`frame.png`.
The ordinary60-second launch ends at24379 batches in measured60.019s, with no
renderer errors or STUCK report. The inspected800x600 frame remains white with
a faint yellow spot. Load average was9.16 at launch, so this is not a performance
comparison. No completed-draw/intro-counter capture was collected here; absence
of the previous errors alone does not prove equivalent game progression.
The exact1024x1024 eleven-level shape independently passes software implicit-LOD
pixel tests, and2950-triangle real x86 COM/worker tests pass. Next capture must
record completed draws and intro state alongside images. No gameplay acceptance.

Controlled software probe50895 provides stronger evidence. Artifacts are
`/var/folders/dz/1fqkk_jd4350qkm91pm9_q3c0000gp/T/bw-software-probe-65NV0y/`.
By60s of its observed attachment window it records168 completed draws and80
completed presents, zero submission failures, and one outstanding draw. At55s
the draw categories change from two loading strips per frame to textured lists
of2/2950/8 triangles using1024x1024 eleven-level textures. The inspected final
640x480 image visibly shows LIONHEAD STUDIOS with falling particles and reflection.
This establishes the software intro, not menu/gameplay or backend parity.

`tools/black-white-software-probe.js` uses the existing CLI control channel,
Bridge submission promises and EIP tracing without modifying guest state. Its
first run falsely reported traceHits0 because its address regex accepted at most
one leading zero; actual logs contain three00526d93 hits with ESI074d6bdc. The
parser is corrected; that observed stack address must not be hard-coded into
later probes. Frozen mode was rejected with real ticks, so the tool attaches to
an ordinarily running real-time guest and explicitly measures only that window.

Longer probe23014 (artifacts `bw-software-probe-pnliVq` under the same temp root)
exposes a lifetime failure after initial success. At75s introFrame1/target636 is
observed; by85s/frame5 native raster creation begins failing. Successful DRAW
completions stop at181 while Present and intro counters continue. At120s the
intro is frame62, but346 submissions have failed, including explicit native
allocation failures. This is not healthy progress toward gameplay.

Focused reproduction: `node test/test-d3d9-large-draw.js --stress-mips` repeats
2950 triangles with the1024x1024 eleven-level chain. Run8381 fails at iteration24;
adapter-owned bytes return to512 after each prior draw and all tracked native
contexts are freed, yet sparse heap reservations advance by roughly12MB per
iteration. Current heap allocation uses first-fit splitting and heap_free only
prepends blocks, without coalescing. Fragmentation is the next hypothesis to test
with native free-list inspection/coalescing; accounting returning to baseline is
not proof that the allocator can reuse the storage.

Follow-up: the primary leak was missing sparse inverse translation in `w2g`.
Native WASM-pointer frees therefore supplied an unrelated guest address and were
silently rejected by heap validation. Fixed and verified by actual sparse reuse
in `test-d3d-render-lifetime.js` (51141/20572). Stress93161 now completes32frames
with stable memory after warm-up. Disabling the idle coalescer (41282) passes32
frames but accumulates fragmented free blocks (494->6661), so both inverse
translation and coalescing are retained. These are allocator/render regressions,
not yet evidence that a fresh real-game run progresses through the intro.

Fresh post-fix probe62767 completed180s using diagnostic build
`/private/tmp/bw-native-reuse.5Xjp7I/wine.wasm`. Artifacts:
`/var/folders/dz/1fqkk_jd4350qkm91pm9_q3c0000gp/T/bw-software-probe-frxgg9`.
At the final sample: introframe43,414 completedDRAW,123 completedPRESENT,
zero submission failures, queue627/627 completed. The inspected final image
shows Lionhead logo, particles and reflection. Successful rendering continues
beyond the old frame5 allocation failure; no menu/gameplay yet. Initial load
average82.53 makes this unsuitable for performance comparisons. No guest intro
counter or clock patch was used.

Long-run probe20567 completed its1800-second observation window successfully.
Frozen native artifact: `/private/tmp/bw-long-native.IxWKnd/wine.wasm`;
artifacts: `/var/folders/dz/1fqkk_jd4350qkm91pm9_q3c0000gp/T/bw-software-probe-WjjGiJ`.
The final sample records introframe560/target636,3514 completed DRAW commands,
563 completed PRESENT commands and zero render failures. One draw remained
pending at sampling, before normal shutdown. This demonstrates sustained intro
rendering, not menu/gameplay. The helper now permits an explicit observation
window up to14400 seconds so later runs can reach beyond the full intro without
patching guest counters or clocks. New source requires a fresh matching native
artifact; this run does not validate subsequent shader/stencil/Reset changes.

The ongoing7200-second probe93079 uses the frozen
`/private/tmp/bw-stencil-native.LHj3DN/wine.wasm` artifact and
`bw-software-probe-pOr4aX` capture directory. At2665seconds it reaches
introframe692,4302 completedDRAW and771 completedPRESENT withzero failures.
Live control ping confirms the same process is running. Frame2163.png was
personally inspected: Lionhead particles/logo/reflection, not gameplay. Passing
the recorded target636 does not imply completion: the existing disassembly
above places fade onset after986, then requires the fade threshold and another
500frames. Do not restart or patch the healthy run merely for crossing636.

Later in the same live run, at3839seconds/frame1049, the fade/completion field
is53.54997 rather than zero, and the draw categories include10-triangle lists
instead of only8-triangle reflection draws. All9682 submitted commands have
completed withzero failures at that sample. A subsequent control ping confirms
the same process live atframe1052/fade56.09997. Frame3844.png was personally
inspected: the logo changes orientation and fades, but this remains the intro.
This confirms real progression beyond the documented fade threshold; no guest
animation state or clock has been patched.

Probe93079 is now terminal0 after its7200-second guard and graceful controlled
quit; do not treat it as live or send further input. Intro counter reached1787
against finishFrame1786. The final sample records45985 completedDRAW commands,
53558 completed queue commands andzero failures (one draw pending at sampling).
The final `bw-software-probe-pOr4aX/frame.png` was personally inspected: a
cloud-covered island backdrop with a central panel, empty-looking text fields,
up/down controls and bright polygon artifacts. This is visibly beyond the
Lionhead intro, but neither readable menu text nor interactive gameplay is
verified. New draw categories include1280x960,1024x1024 and256x256 textures.
The run still used frozen `bw-stencil-native.LHj3DN/wine.wasm` and startup-loaded
JS, predating the later POSITIONT precision/coverage correction, PSIZE and
multi-stage work. A fresh matched artifact is required before attributing the
panel corruption to current source. No guest counters or clocks were patched.

Follow-up probe33057 uses `/private/tmp/bw-cascade-native.Ca0YQN/wine.wasm`
with startup-loaded JS including the POSITIONT correction. At4553seconds its
intro reaches1787/finish1786 with16323 commands complete and no render failures.
At4660seconds new post-intro draw categories are active. Live controlled capture
`/private/tmp/bw-postintro-scene.png` was personally inspected: cloud-covered
island, central panel with unreadable text and bright polygons remain. Thus the
POSITIONT correction alone did not resolve this panel corruption. This frozen
artifact still predates later cascade operations, transforms and fog work;
the image is not evidence against all current source. Preserve the live run
for inspection; no guest counters or clocks were patched, gameplay unverified.

The same live run now has a bounded neutral-command capture, armed through its
existing eval control with `tools/d3d-command-capture.js`. Artifact:
`/var/folders/dz/1fqkk_jd4350qkm91pm9_q3c0000gp/T/d3d-command-capture-XfJrDb/frame.v8`.
One Present-to-Present interval contains17 DRAW commands plus PRESENT,
77,634,825 serialized command bytes. Capture restored the original submission
hook after completion. It preserves typed arrays/nonfinite values and copied
shared-memory inputs; completion means capture boundaries, not GPU fences.
It does not snapshot the initial color/depth buffers or earlier resource
commands, so replay equivalence must verify those dependencies explicitly.
Draws0–8 include POSITIONT textured strips; later XYZ triangle lists include
empty texture arrays despite stage0 MODULATE/TEXTURE state. This is observed
binding data, not yet proof of which draws are glyphs or why textures are absent.
The capture enables inspecting/replaying the actual panel submissions without
restarting the healthy guest or waiting through another intro.

Current WebGL2 replay32433 of that capture completed17 draws without GL errors.
Tool: `node tools/d3d-replay-web.js CAPTURE/frame.v8 OUTPUT.png`.
Output `/private/tmp/bw-replay-webgl.png` was personally inspected at its native
800x600 size: the same unreadable central panel and bright polygons occur.
This reproduces the defects with another executor using the captured inputs;
it points away from an exclusively software-rasterizer defect, not toward any
particular frontend cause yet. Replay starts with transparent color and no
prior depth history; it is not a pixel-identical whole-session comparison.
The host texture loop omits a stage only when its canonical bound pointer is
zero; invalid nonzero resources throw rather than silently disappearing. The
captured untextured XYZ lists use repeated quarter-atlas UV rectangles and
varying 3D positions, consistent with sprites/particles rather than proven
text glyphs. Determine their binding provenance separately from missing text.

Current software replay47696 completes the same17 draws. Comparing with WebGL
initially found479666 alpha differences but only1 RGB pixel beyond tolerance2.
Source inspection found WebGL ignored `state.colorWriteMask`; applying
COLORWRITEENABLE per draw fixes that independent compatibility bug. All16 masks
plus invalid-mask/no-pixel-change pass on WebGL1/2 in regression76707.
Replayed WebGL32402 versus `/private/tmp/bw-replay-software.png` now differs
beyond tolerance2 in just1/480000 RGBA pixels (max33, coordinate310,325).
Both still show the unreadable panel and bright particle polygons. This makes
the captured shared draw data/frontend path the next investigation, not a
software-only rasterization explanation. Exact pixel parity is not claimed.

Post-checkpoint investigation on the same live33057 process: the captured
1024x1024 UI atlas (draws2/8) was decoded and personally inspected. Its baked
promotional text is readable, and the panel rectangles are intentionally blank;
the thin divider lines in the menu are present in the source atlas, not damaged
glyphs. No separate glyph-texture draw appears in this captured17-draw interval.
Artifacts `/private/tmp/bw-texture-2.png` and `bw-texture-8.png` are diagnostic
extractions from the immutable capture, not native-Windows references.

Microsoft native `d3dx9_25.dll` disassembly identifies the font constructor at
original0042d202, vtable00401580, and DrawTextA/W entries0042f263/0042f29c.
Both call internal0042d8f7 (runtime025558f7). Existing live EIP tracing confirms
that internal routine executes repeatedly with font object4ed795cc; its common
exit0042ef76 is reached with EDI0 (success). The current process has two loaded
TrueType faces of34044 and134188 bytes. These observations do not prove glyph
generation or successful rendering.

Native global original006298d4/runtime027518d4 reads1, selecting the Uniscribe
branch in DrawText; original006298ac/runtime027518ac reads0. Therefore the
fallback GetCharacterPlacementA/W calls at0042e14e/0042e156 are not the first
path to investigate. Follow the native shaping results and glyph-cache/texture
submission boundary next. No Wine implementation source was used; the DLL
addresses come from the supplied Microsoft binary. Temporary EIP ranges were
restored to the original intro probe range00526d93–00526d97 afterward, without
changing guest animation state or restarting the healthy process.

The next inspection found valid shaped glyph IDs/positive advances, but the
first six cached glyph records reached through font+0x550 all start with
FFFFFFFF followed by zero geometry. Native D3DX0042d32c marks that sentinel
at0042d468 when its measured glyph advance is zero. On the Win9x branch it
uses MoveToEx, ExtTextOutA(options12hex, NULL rectangle, one WORD glyph index),
then MoveToEx to retrieve the updated current position. Our text compositor
rejected the NULL opaque rectangle and did not implement direct glyph indices.
This explains the observed empty-cache path; fresh corrected game rendering
is still required, and cached failures in the old live process are not patched.

Native Win98 oracle `gdi-exttextout-glyph` now covers32 A/W, character/glyph,
NULL/supplied rectangle and options0/2/4/6 combinations. With Arial height-16,
GCP maps A to glyph36; every case returns1, advances CP to(11,0), and draws28
nonblack pixels. Thus Win98 accepts NULL rectangles with OPAQUE/CLIPPED and
renders ANSI WORD glyph indices. This differs from the current Microsoft
[ExtTextOutA documentation](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-exttextouta)
describing ANSI glyph-index calls as a no-op; do not substitute that behavior
for the measured Win98 contract.

Reproduce with `node tools/v86-reference/capture.js --online --manifest
tools/v86-reference/glyph-apps.json --app gdi-exttextout-glyph --serial-output
/private/tmp/win98-exttextout-glyph.serial` (one command). Capture54317 exited0
at2026-09-11T00:46:45.542Z using the pinned v86 Win98 image. Probe EXE SHA256:
`d6cdcb6a24f744b80d743484f1133412932fe38ac443f43a07c744527a8c6c6c`.
Generated metadata is `screenshots/v86-reference/generated/gdi-exttextout-glyph.json`;
serial transcript has32 CASE lines and EXTTEXTOUT_GLYPH_DONE. Source probe and
isolated manifest are tracked candidates; no Windows binary is added.
Null-rectangle normalization and direct TrueType glyph-index rendering are
implemented using the existing native cache and shared text compositor.
The glyph regression covers A/W WORD inputs (including indices above255),
current-position advances, PDY, clipping, path recording and invalid indices.
Bitmap-font indexed output remains explicitly unsupported.

The standalone native D3DX integration probe now verifies the complete font
path, not just GDI: `node tools/d3dx-font-probe.js --dll=/path/to/d3dx9_25.dll
--wasm=/path/to/wine-assembly.wasm` (one command). It executes the supplied
Microsoft DLL's CreateFontA/DrawTextA, uploads its glyph texture, and checks the
software worker's canonical320x160 frame. Baseline75148 exited the guest
successfully but failed acceptance with zero white pixels and51200 blue pixels.
Corrected run12873 passed with863 white pixels and50337 blue pixels; its PNG
was personally inspected and shows readable white “Black & White 2” text.
The actual browser guest/WebGL2 probe31600 also passes with863 white pixels,
50337 blue pixels and GL error0; its PNG was personally inspected and shows
the same readable text. Reproduce using `node tools/d3dx-font-web-probe.js
--exe=/path/to/probe.exe --dll=/path/to/d3dx9_25.dll --wasm=/path/to/current.wasm`
(one command; the software probe builds the fixture EXE). The harness observes
the real backend's target at Present, before normal guest teardown. Initial
browser attempt2860 selected Notepad due to the global launch wrapper ignoring
arguments; corrected harness selects its explicit registry entry instead.
Full canonical/compat build15499 and repeated software font85829 pass after
concurrent main merges. These are focused native-DLL integration results, not
proof of fresh full-game menu/gameplay. No guest cache was patched.

Fresh current-artifact game run98750 was started after checkpointad3ba44b, using
`/private/tmp/bw-glyph-current.pohQXb/wine.wasm` (1141556 bytes). It is independent
of the preserved old33057 process whose native glyph cache already contains
failures. At587 seconds the new run reaches intro frame105, with785 completed
draws and zero reported renderer failures; menu/gameplay acceptance is pending.
Artifacts: `bw-software-probe-DLH67d` under the host temporary directory. This is
a progression observation, not a throughput benchmark (launch loadavg39).

Local Candidates now includes `black_white_2_demo` (Black & White 2 Demo).
The prepared MainApp tree is copied to the ignored local corpus directory
`test/binaries/win98-games-a-d/Black and White 2-DX9-D3D/installed/`;
`node tools/gen-win98-games-a-d-manifests.js` inventories its363 companions.
The entry seeds the same three native DLLs as the CLI probe and opts into the
experimental programmable profile for this app only; renderer selection stays
user-controlled (`?d3d9-renderer=software` for software, WebGL by default).
CLI: `node test/run.js --app=black_white_2_demo --d3d9-renderer=software`.
This registers the extracted game, not an installer-success or gameplay claim.

Progression update: current-font run98750 remains live, reaching intro frame1513
at5947 seconds with finishFrame1786 and zero reported renderer failures.
`frame-5941.png` was visually inspected: complete Lionhead logo/reflection, not
yet the menu. Older pre-font-fix run33057 is now authoritatively terminal with
exit0; its recorded final intro frame1787 and cached missing-glyph state are
historical evidence only. No restart or guest-state patch was used.

Current-font run98750 has now passed intro frame1786 and reached the profile
creation menu. Personally inspected `frame-7320.png` shows readable “Select
Profile”, “New Profile Name”, “Close”, and the main menu labels over the island
background. At7331 seconds the renderer reports20665 completed draws and zero
failures. This proves the glyph fix reaches the real game's menu, not just the
standalone font probe. Profile selection and changing gameplay remain unverified;
the frozen executable artifact predates lighting/cache/scissor checkpoints.

The same run98750 is now terminal (CLI exit1), not waiting for more input.
Holding Return was accepted at batch591383; at batch591475 the real profile-name
encoding loop called unimplemented `PathGetCharTypeW(0x50)` and trapped.
The call site is00857c90 (`push eax; call ebx`), return00857c93, then `test al,1`:
valid long-filename characters are copied directly; others take the formatting
branch at00857c9e. The preceding sample reports93956 completed draws and zero
renderer failures. Thus keyboard input reaches profile processing; this is not
evidence of gameplay or of a renderer failure. Earlier mouse motion550,400
mapped to native687,500 (640x480 presentation of800x600 window), drained its
queue, and did not visibly dismiss the profile dialog. No guest state was patched.

`PathGetCharTypeA/W` is now implemented from Microsoft's API contract and the
supplied native `test/binaries/explorer98/dlls/shlwapi.dll`, version5.00.2614.3500,
SHA256 `731b1ffdcb821a87e8ef1aa92fc956a0c385eaa6b8f4ad20c89db8b923f1aeae`.
Exports485/486 are70bdde1d/70bf16c2. Native disassembly classifies controls0–31,
quote, less/greater-than and pipe as0; space/comma/semicolon as1; star/question
as4; slash/colon/backslash as8; all remaining BYTE/WORD inputs as3. These are
character flags, not whole-filename validity; do not impose separate DOS name
rules on plus, equals, brackets, DEL or high Unicode values. A truncates toBYTE,
W toWORD, with no codepage conversion. `test/test-path-get-char-type.js` passes
both entry points over the entire65536-value domain, upper-bit truncation and
stdcall cleanup. This is a disassembly-derived fixture, not a native execution
oracle. A fresh game run with this implementation remains required. No Wine
implementation source was used.

Fresh frozen run24571 now verifies that progression: snapshot
`/private/tmp/bw-path-char.ly0IRU/wine.wasm` contains the PathGetCharType fix,
and `/private/tmp/bw-path-current-screen.png` shows the profile-creation dialog.
Normal Return down at batch224427 and up at224621 closes it without trapping;
`/private/tmp/bw-path-after-profile.png` shows the island main menu headed
“Player”. Renderer completions continue with zero reported failures. This is
successful profile creation, not gameplay. This frozen snapshot predates the
later backbuffer-lock/ownership and programmed-VS pixel-center checkpoints.

A synthetic click at155,445 was accepted at225653, but a later capture
`/private/tmp/bw-path-new-game.png` still shows the same main menu. A held mouse
down at those coordinates was delivered at226972 to distinguish short-click
polling from menu behavior; mouse-up was delivered at228211. A later settled
capture at229794 (`/private/tmp/bw-path-settled-new-game.png`) still shows the
main menu, so neither click variant proves New Game activation. No key or mouse
button is left held by these controls. The
live probe remains24571 with artifacts under `bw-software-probe-8o44XX` in the
system temporary directory. No guest state or instruction stream was patched.

Buffered-mouse investigation on the same frozen run24571: a temporary,
return-value-preserving wrapper around `renderer.getMouseButtons` counted8
polls with left held and8 after release (down237923/up238468). The wrapper was
restored. Its caller EIP009b0920 belongs to the game's GetDeviceData call at
009b0930 (`call [eax+28h]`, slot10), with20-byte DIDEVICEOBJECTDATA records;
this is not a GetDeviceState caller. The game's switch accepts offsets0/4/8
for axes and12/13/14 for buttons. `SetDataFormat` remains an implementation gap,
but these observed offsets do not establish a custom-layout mismatch.

After explicit movement155,445 ->156,445 ->155,445 and down243257, the native
trace proves real left-down dispatch:009b0a59 tests bit0x80;009b0a5e records
that bit set;009b0a67 passes the zero suppress/error byte at01d7a748;009b0a80
pushes event1 and009b0a84 calls009afe60, returning to009b0a89. The receiver
is01d733e8. A read-only snapshot also reports error byte0 and mode017792d4=1.
Mouse-up244432 is acknowledged and the later009b0a94 ->009afe60 path delivers
event4. Thus the native event dispatcher receives both edges; the next question
is relative-cursor/hit-test or downstream event handling, not whether a held
button ever reaches the guest. This does not yet prove New Game activation.
Native event1 target009aff41 copies the receiver's current coordinate words
at+c4/+c8 to+114/+118; event4 target009aff6f copies them to+12c/+130. These
provide a read-only seam to compare the game's click position with the host's
absolute pointer, without changing guest memory. Transient state is at+110,
with another dispatch state byte at+15c.

Diagnostic caution: `set_trace_eip_range` requires `(flag,lo,hi)`, three args.
A mistaken two-argument call enabled broad streaming trace and slowed batches.
The correct restoration `(1,0x526d93,0x526d97)` was queued after mouse-up; do not
infer completion of that control from its submission. Preserve the healthy
process while its current batch drains; no restart was used for this diagnosis.

The correct trace restoration is now acknowledged, followed by a confirmation
with host mask0/queue0. The native coordinate snapshot found all current/down/up
coordinates at(0,0), while the host pointer was(193,556). Sensitivity is1.0,
insets+100/+104 are0, and remapping+108 is1. A normal mousemove to(0,0) at
batch281124 moved the game's coordinates to(-1,-1); a later move to(156,446)
at285501 moved them to(194,556), verified before pressing. Down287458 and
up288497 at(156,446) recorded both guest edges at(194,556). The settled capture
at290202, `/private/tmp/bw-native-new-game-settled.png`, shows the four-panel
controls/tutorial screen with Continue. New Game activation is therefore
verified; changing in-world gameplay remains outstanding. No guest memory or
instruction stream was patched, and the frozen process was preserved.

Buffered-input sequencing matters here: motion is accumulated into+cc/+d0
during the FIFO loop and applied to current+c4/+c8 after that loop. A button
record encountered in the same poll snapshots the old current position. Move,
allow an actual input update, then press; absolute host pointer fields alone
are not sufficient evidence of the game's hit-test coordinates.

Continue was then targeted with mousemove(321,451) at292616; a separate native
read verified(400,562), followed by down293970/up294751. Run24571 is now
authoritatively terminal, exit1: batch294774 traps at00925197 decoding0f d0.
This is not yet evidence of a missing SSE instruction: the supplied EXE has
`mov eax,3` at00925195, so00925197 is inside its immediate and its runtime bytes
differ from disk. The enclosing00925120 reader copies from a virtual-method
buffer using `rep movsd` at00925178 / `rep movsb` at0092517f. Crash registers
include EBP=EDI=00a58780, ESI=00a5877f, EBX=33078b10; saved caller chain includes
009208a6,00920dca,009a81da. Investigate the copy arguments/corruption origin
before adding an opcode implementation. Last sampled renderer failures remain0.
All synthetic buttons were released before the trap. Gameplay remains unverified.

The saved stack identifies the immediate failure:00925120 is thiscall
`Read(dest,count,outRead)` with ret12. Return009208a6 at074fd034 places
dest=0 at074fd038, count=00a58780 at074fd03c, and outRead=074fd050 at074fd040.
Caller009a81d5 forwards an unchecked NULL from aligned allocator00adbcbf,
requested size00a58780/alignment64/offset0;00adbc2f requests00a587c3 bytes from
underlying00ad566e and propagates NULL. Copying count bytes into address zero
explains final EDI00a58780 and overwritten executable bytes. The reason for the
allocation failure still requires live allocator evidence; do not assume a leak
or enlarge memory solely from this stack. Effective source-1 is an inference
from final ESI/count, not a verified mapping snapshot.

`test/test-bw-rep-copy.js` executes the exact00925165..00925186 copy/cursor
sequence with valid heap buffers. All16 cold/cached size cases pass on both the
frozen failing-game WASM and current build, plus fresh source77739. It checks
EBP/EDX preservation, ECX0, DF0, final pointers, bytes, guards and cursor update.
No REP defect was reproduced and no instruction implementation was changed.
Both copies of BW2Demo.exe (probe MainApp and local candidate) have SHA256
65130510233cfc9e53758bab8480a3cfeeb6b1043de9774ab6e066191b2bb433.

Fresh reproduction21705 uses frozen current-build snapshot
`/private/tmp/bw-allocation-repro.J76xSx/wine.wasm`; artifacts are
`bw-software-probe-WjsJYY` in the system temporary directory. It is a new run
after confirmed exit of24571, not a replacement of a healthy process. Initial
samples report no renderer failures; menu/gameplay progression remains pending.

Read-only main-instance heap snapshots at batches27089 and43976 are identical:
9316 free blocks,7550264 total free bytes,3182896 largest block, no cycle or bad
header; low cursor/end71990848/71991296, sparse920016632/920059904, virtual
top1214742528. This bounds an intro interval, not the later failed allocation.
An isolated120-draw renderer audit likewise found stable live/cache bytes and
reuse, but renderer-private free blocks remain unavailable to the guest owner
until graceful handoff. Eager multi-batch scratch and owner high-water retention
remain pressure hypotheses. Ordinary Escape down22658/up23081 did not skip the
intro; the live run has no held key. Current source now reclaims replaced-arena
tails and rejects oversized low-heap reservations correctly;21705 predates that
change and must not be described as post-fix acceptance.

### Allocation-return diagnostic prepared on live run21705

Use breakpoint009a81c9, the aligned allocator's return block, rather than
009a81d5 inside that block. The native debugger checks dispatch boundaries;
the later unchecked-argument push is not itself a reliable breakpoint target.
At c9, EAX is the allocation result, EDI the requested byte count, ESI the
owning object and EBP the input stream. This allows inspection before the
subsequent copy corrupts instructions when EAX is zero.

The live CLI now has a one-shot, return-preserving run wrapper installed by
the ordinary eval channel. It shadows the instance's inherited exports getter
with a configurable property, invokes the original run exactly once, and on
the matching debug return copies registers, stack words and allocator cursors
into ctx.bwAllocCapture. It then clears the breakpoint and restores the original
property descriptor even if observation fails. ctx.bwAllocRestore cancels the
hook before a hit. Installation rejected a preexisting breakpoint; a tiny
independent Wasm test verified that shadowing/restoration is supported.
No guest instructions, registers or allocation state are patched.

The first oversized terminal input did not execute: canonical terminal input
overflowed, producing bell characters. Ctrl-U cleared the pending line;
allocation_capture_check2 confirmed breakpoint0 and no hook. Three short
hook_part commands then assembled the observer text, and hook_install returned
true. Keep future relayed commands short. At the last preceding sample the
intro had reached frame1098, completion95.2, and zero renderer failures. The
allocation has not yet been observed; this is diagnostic readiness, not proof
of either allocation failure or success on this preserved pre-fix build.

Run21705 subsequently completed the intro (frame1787, finishFrame1786) and
reached profile creation. Short Return694309/up694325 left the dialog visible;
held Return696323/up697061 closed it, with Player at the main menu in
/private/tmp/bw-profile-settled.png (batch697412). Normal movement698105 to0,0
then698149 to156,446 settled at native195,557. Down698787/up699231 reaches the
tutorial Continue screen in /private/tmp/bw-newgame-current.png (batch700341).
Move701673 to321,451 settled at native401,563; Continue down703542/up704168
reproduced the copy trap at batch704171, EIP00925197. All inputs were released.
The probe is terminal exit1, not a live wait. This was the pre-tail/pre-compaction
frozen build, not current-source acceptance.

The observer worked but matched an earlier call to the same allocation site:
batch704170, EAX844933376 (nonzero), EDI231184, ESI856098960, EBP856040276.
At that point the free list had9972 blocks totaling5389088 bytes, largest22368,
with no detected cycle/bad header/truncation. Low cursor/end71990848/71991296;
sparse cursor/end845164640/845676544; virtual top856096768. The full registers,
24 stack words and32 stream words are durable in run.log at BW-ALLOC-CAPTURE.
The setter logged synchronously before returning to guest execution, so this
evidence survives the subsequent crash. It proves fragmentation at this earlier
successful call, not the allocator's full state at the later10.3MiB failure.

The one-shot observer cleared itself after that successful call. Next use must
retain the breakpoint until EDI equals00a58780 (or explicitly capture every
matching return), rather than stop at the first use of the shared call site.
The terminal stack again contains destination0/count00a58780 at the copy call.
No new CPU opcode defect is demonstrated, and the exact allocation-pressure
cause remains open. Do not restart the old session handle21705; it has exited.

### Targeted post-compaction reproduction10715

`tools/black-white-software-probe.js --allocation-probe` now installs a reusable
observer that remains armed through earlier allocations and captures only
EDI00a58780 at009a81c9. Capture is logged synchronously and the exports property
and breakpoint are restored afterwards, including observation/logging failures.
The focused observer test verifies filtering, exactly one guest invocation per
call, unchanged return values/errors, cancellation, serialization and cleanup.

New run10715 is live on the frozen full-build41098 artifact:
/private/tmp/bw-compacted-repro.kyBDAg/wine.wasm,1158838 bytes,
SHA2567dee27a0cace008de26aa1cc5d4a1ec4d88ba7228ce589190182b5e30f655183.
This includes heap-tail reclamation, context compaction and the private VS2
foundation, but predates the later DirectInput lifecycle commit and matrix work.
Artifacts: /var/folders/dz/1fqkk_jd4350qkm91pm9_q3c0000gp/T/bw-software-probe-LJrjIm.
Launch uses --seconds=14400 --capture-every=60 --control-stdin --allocation-probe
and the frozen --wasm path. Observer installation returned armedtrue with
address10125769/request10848128. Startup samples through28.95s have no renderer
failures; neither gameplay nor the target allocation has yet been reached.

Run10715 subsequently completed the intro at frame1787 with no renderer
failures. Profile Return down218078/up219575 accepted the default Player name;
`/private/tmp/bw-compacted-profile-accepted.png` shows the main menu. Direct
movement to156,446 initially left native coordinates at0,0. Moving to0,0 first
established(-1,-1); then move224741 to156,446 settled at(194,556), verified before
pressing. New Game down226752/up228520 reaches the tutorial screen, verified by
`/private/tmp/bw-compacted-tutorial.png` at batch230088. All keys/buttons were
released after these inputs. The original frozen process remains in use, not a
latest-source or full-game acceptance run; the targeted allocation capture is
still pending before Continue.

Continue move232043 to321,451 settled at native(400,562), then down233778 and
up235764. All synthetic input was released before the failure. Run10715 is now
authoritatively terminal exit1: batch235768 traps at00925197, the same corrupted
copy site as the pre-fix run. Do not restart this terminated handle.

Unlike the earlier observer, the targeted capture caught the exact failing
allocation at batch235767: skipped1 earlier allocation, EIP009a81c9,
EDI10848128 (00a58780), EAX0. Heap ptr/end72007784/72011776; sparse ptr/end
852481608/853082112; free-list head877342288; virtual allocation top828637184.
The bounded walk found10248 free blocks, total5678096 bytes, largest44592,
with no bad header or truncation. Full registers/stack/stream are durable at
`[BW-ALLOC-CAPTURE]` in the run's existing run.log, line3048. The capture proves
NULL allocation precedes the unchecked copy, even with heap-tail reclamation
and shader-context compaction. It does not yet identify why obtaining another
large sparse arena failed: virtual allocation records/backing-space census
were not captured. No missing CPU opcode or new shader failure is demonstrated.

Allocator review: even perfect coalescing of the captured main-instance free
blocks cannot satisfy this request. A new sparse arena requires10878976 bytes
(166*64KiB), including aligned allocation/header overhead. The next failure
branches to distinguish are the shared guest reservation limit,2048 mapping
slots, contiguous physical backing/PTE publication, and1024 heap arena slots.
The recorded virtual_alloc_top is instance-local, not the authoritative shared
reservation cursor. Existing MEM_DECOMMIT/release/failed-reservation lifecycle
gaps were found during review, but none is established as this run's cause.

The observer now captures matching-layout VIRTUAL_MAP_STATE, all bounded map
records and heap arena records, active/free backing bytes and largest gap.
Optional section failures preserve return registers and other diagnostics.
Counts are capped by descriptors and2048 maps/1024 arenas; unpublished arena
records and best-effort consistency are explicit. The caller loads the same
RegionMap mirror after the CLI's WASM-layout check and adds --dump-virtual-maps
as a terminal backup. Focused tests and syntax/region-copy/diff gates pass.

New probe89033 is live on the identical frozen7dee27a0... wasm, whose layout
stamp was rechecked as9c6027bce1d500a1; this changes diagnostics, not the guest or
emulator under comparison. Same14400-second guard,60-second capture interval,
control stdin and allocation observer. Artifacts:
/var/folders/dz/1fqkk_jd4350qkm91pm9_q3c0000gp/T/bw-software-probe-w9Dofc.
Installation reported armedtrue, address10125769/request10848128. No input has
been sent. This is the instrumented follow-up to a terminal run, not a restart
caused by an observation timeout, and no allocator fix is claimed yet.

### Full backing census reproduction89033 (terminal, 2026-09-11)

The same frozen run completed intro1787 and accepted Player with Return
down212752/up213871. New Game at host156,446 (native195,557, checked before
pressing) down215469/up215908 reached the tutorial. Continue at321,451
(native401,563) down218934/up221373 triggered loading. All inputs were released.
The process then exited1: capture221408 immediately precedes crash221409 at the
same unchecked copy. Do not poll/restart handle89033 as though it were live.

Durable evidence is `[BW-ALLOC-CAPTURE]` at line2758 of
`/var/folders/dz/1fqkk_jd4350qkm91pm9_q3c0000gp/T/bw-software-probe-w9Dofc/run.log`.
EIP009a81c9, EDI10848128, EAX0, skipped1; main free-list census exactly matches
10715:10248 blocks,5678096 bytes, largest44592, no invalid/truncated records.
The new sections identify the previously missing backing constraint:

- 170 maps of2048;65 heap arenas of1024, no overflow or unpublished arena.
- Shared reservation top828637184, matching the local cursor in this capture.
- Backing base134217728, size331350016; cursor465559552 is exactly the pool end.
- Active backing234962944 bytes; free96387072 bytes, but largest gap10678272.
- Required new arena10878976 exceeds that gap by200704 bytes.
- No overlap; both bounded sections report stateChanged=false (best-effort
 consistency, not a globally locked snapshot).

This establishes insufficient contiguous backing space for the new arena
despite substantial total free space; map/arena slot exhaustion is not supported
by this capture. It does not prove relocation is safe: native renderer contexts
and host views can retain physical WASM addresses. Next allocator work must
preserve those leases or avoid their fragmentation at allocation time, with a
bounded reproduction before another hour-long game run. No shader/CPU-opcode fix
or gameplay success is demonstrated by this result.

### Preventive best-fit backing reuse (2026-09-11)

`virtual_map_commit_locked` now prefers the smallest fitting released extent
below the backing high-water mark before consuming untouched backing space.
The contiguous guest/physical extension fast path remains first. The bounded
unsorted-table scan allocates no scratch storage under the map lock and never
moves a live mapping, preserving renderer-held physical pointers. Zeroing,
protection, PTE publication and mapping-count publication order are unchanged.

Cross-instance fixture78684 first failed because bump-first consumed untouched
space instead of an available exact-size hole;18477 passes after the change.
The fixture leaves16 units, allocates4/guard1/2/guard1, releases the4 and2 holes,
then requests2 followed by7. Best-fit uses the2 hole and preserves the8-unit tail
for7. It checks released PTE invalidation, recycled-byte zeroing, unchanged live
physical addresses/guard data in the second instance, and failed-placement
count/cursor atomicity. Heap-tail11, partition6 and free-block validation71342
also pass; structural gates96114 pass. This prevents avoidable fragmentation;
it does not recover arbitrary already-fragmented maps or prove B&W gameplay.

Full build24371 passes1173262 canonical/1173730 compat bytes, layout
9c6027bce1d500a1 and233 nonoverlapping segments. The fresh comparison artifact is
`/private/tmp/bw-bestfit-repro.03hYhl/wine.wasm`, SHA256
`9fe637d0df8117dc9c85633f8fe7623c5ceac0397db5f1055a92cd7a95285b16`.
Unlike89033, this includes the intervening typed-constant and resumable-setup
checkpoint20d77477 as well as best-fit backing allocation; a gameplay difference
alone cannot isolate allocator effects from every intervening change. The
focused allocation fixture above is the controlled evidence for placement.

### Best-fit probe terminal and current controlled run (2026-09-11)

Frozen best-fit run78421 exited0 at its100000000-batch guard after12988.208s,
not a guest crash. Its final inspected frame12964.png shows SelectProfile /
NewProfileName over the menu. Intro reached1787 (finish1786); renderer failures
remained0 and lastError null. No input was sent, so this is not gameplay or
post-Continue allocator acceptance. Artifacts remain in
`/var/folders/dz/1fqkk_jd4350qkm91pm9_q3c0000gp/T/bw-software-probe-0mxUdH`.

The probe now accepts an explicit positive-safe-integer `--max-batches`, default
1000000000, while retaining its bounded wall-clock and shutdown guards. This
prevents the old batch ceiling ending a four-hour run early. Invalid0, negative,
fractional, NaN and unsafe-integer values were checked before guest launch.

New controlled run73697 uses full-build34288 frozen as
`/private/tmp/bw-current-controlled.1sR1mR/wine.wasm`, SHA256
`18df41dd31bfcee90facf716f961036ace4f919fa40f2a7385c1fadab224725d`.
It includes subsequent constant/vector/CALL implementation, not a pure allocator
A/B. Arguments: seconds14400, max-batches1000000000, capture-every60,
control-stdin, allocation-probe and the frozen wasm path. Observer installation
returned armedtrue/address10125769/request10848128. Artifacts are
`/var/folders/dz/1fqkk_jd4350qkm91pm9_q3c0000gp/T/bw-software-probe-1Fi3BW`.
Initial55s sample reaches intro19 with zero renderer failures and no input held.
The parent owns the terminal handle; subagent handles are not interchangeable.

### Split backing for a fragmented commit (2026-09-11, Claude)

The measured blocker was never a shader or a missing opcode: at Continue the
guest asks for a 10878976-byte heap arena (`$heap_sparse_alloc`, 166*64KiB
rounded), `virtual_map_commit_locked` could not find that many *contiguous*
bytes in the backing pool — largest gap 10678272, short by 200704 — and
returned NULL, which the guest copied into without checking. Total free
backing at that moment was 96387072 bytes. Best-fit reuse (earlier this day)
keeps the pool from fragmenting further; it cannot conjure a contiguous run
out of a pool that is already fragmented.

One guest commit does not actually need one backing extent. Guest addresses
translate per page through the page table, and every host-side bulk copy
already asks `g2wSpan` how far the current run reaches — precisely because
adjacent guest maps have unrelated backings. So `virtual_map_commit_locked`
now falls back, at the point where it used to return 0, to halving the
request and placing each half on its own extent (`$virtual_map_commit_split`).
Halving bottoms out at one 64KiB granule, so recursion is bounded by
log2(size/64KiB).

Two consequences had to be handled rather than assumed:

- `MEM_RELEASE` names only the base. Records after the first carry bit 31 in
  their AllocationProtect word (`$virtual_map_mark_continuations`), and
  `$virtual_map_release_locked` walks that chain, so a released split
  allocation gives back every chunk instead of leaking all but the first on
  each level reload. Bits 0..10 keep the PAGE_* value and the flag never
  reaches a PTE: publication is per chunk with the caller's unmodified
  protect, and the marking pass runs afterwards.
- A half that cannot be placed rolls its siblings back
  (`$virtual_map_release_range_locked`): a VirtualAlloc that returns NULL must
  leave no backing committed. The per-instance downward reservation cursor is
  put back on the allocation's own base, or the next VirtualAlloc(NULL) would
  carve out of a range this one already owns.

`test/test-virtual-map-split-commit.js` pins the contract on a pool left with
two four-unit holes and no wilderness: an eight-unit commit succeeds, lands
one chunk on each hole, moves no live mapping, translates and zeroes on every
page including across the seam, fails clean when the total does not fit, and
releases completely. Negative control: with the fallback disarmed in the same
build, that commit returns 0. Also PASS: virtual-map-cross-instance (its
"failed placement must not change map count or backing cursor" assertion still
holds — the rollback restores both), virtual-page-protection,
virtual-query-user-boundary, heap-partition, pointer-probes,
global-alloc-reuse, shell-malloc, bw-allocation-observer. Full build gates
pass; artifact `/private/tmp/bw-split-fix/wine.wasm`, 1191381 bytes, SHA256
`a1552d40b78739e5fa11bcba9a0ecace798d7bd8e3f81ad1605eeff8ba0c94b0`, layout
hash d417ce1f6829dade.

`test/test-bw-arena-commit-replay.js` then answers the same question against
the real fragmentation instead of a synthetic imitation, in 14 seconds. The
allocation observer's capture at batch 221408 holds all 170 sparse map
records as they stood when the guest asked for its arena and got NULL;
`test/fixtures/bw-alloc-capture-221408.json` is that table, and the fixture
seeds it into a fresh instance and asks for the same 10878976 bytes. It
re-derives the largest gap and the total free space from the seeded records
rather than trusting the recorded numbers, so it cannot quietly become
trivial, and it refuses to run if the backing pool's pinned base or size has
moved since the capture. The arena places across two extents, every one of
its 2656 pages translates to distinct zeroed storage, the seams read back
what was written to them, and release gives every chunk back. Disarming the
fallback in the same build returns 0, exactly as the game saw.

Reaching this state by playing costs hours of software rendering and ends in
a process that cannot be restarted, which is one fragile data point for the
cost of a session; the durable capture is worth more than the replay of its
history. That is why there is no gameplay-driving tool here.

Not established by any of the above: that the level loads. The allocation is
the next thing the guest would have crashed on, not a demonstration of
gameplay, and the status document's own open items — fixed-function
world-space clipping unimplemented and rejected by the software path, WebGL
clip planes rejected before GPU access — are still open.

### Ending the intro on demand (2026-09-11, Claude)

The opening sequence is in-engine, not a movie file — there is nothing to
remove from the install — and software-rasterizing its 1787 frames at the
measured ~0.5 frames/second put the main menu about an hour away. That hour
was the reason every question about what happens *after* the menu cost a
session to ask.

It can be ended instead. `0x00529433` is the intro tick's own exit test:

```
00529421  cmp dword [esi+0x24], 0x0      ; finishFrame, -1 while running
00529425  jge  0x529433
00529427  mov edx, [esi+0x20]            ; frame
0052942a  add edx, 0x1f4
00529430  mov [esi+0x24], edx            ; finishFrame = frame + 500
00529433  mov eax, [esi+0x24]
00529436  cmp eax, -1
00529439  jz   0x52944a
0052943b  cmp [esi+0x20], eax
0052943e  jle  0x52944a
00529440  mov al, 1                      ; finished
```

The arming above it is the engine's own: once the completion float at
`[esi+0x28]` passes its threshold it sets `finishFrame` to `frame + 500`, the
fade. So writing `finishFrame` below the current frame is not a synthetic
state — it is exactly the state the sequence ends in, reached without
rendering the frames in between. Nothing else is written.

`tools/black-white-software-probe.js --skip-intro` does it as soon as the
existing `0x00526d93` EIP trace names the object (`ESI`; `+0x20` frame,
`+0x24` finishFrame, `+0x28` completion). Measured: the frame counter froze
at 3 instead of climbing, and the capture thirty seconds later is the **main
menu** — the Select Profile / New Profile Name dialog over the land globe,
with the bottom button bar. Ninety-five seconds, against an hour.

Ruled out by measurement first, so nobody repeats it: Escape, Space, Return
and a click all leave the intro counter advancing unchanged.

A second, guest-legitimate route exists on paper and is *not* proven. The
demo parses `.\Scripts\MPDebug.txt` at `0x005fce85`, handing the parser at
`0x009b5000` the token table at `0x0170b280` and the dispatcher at
`0x00619f40`. That table is 28 entries of `{const char *name, char
signature[10]}`, where the signature spells each argument (`N` number, `A`
string); the token id is the table index and the dispatcher's jump table at
`0x0061a44c` is indexed by `id - 2`. The syntax is the one `Scripts/map.txt`
already uses, `TOKEN("string",123)`. Useful entries:

| id | token | args |
|---|---|---|
| 6 | `LOAD_FEATURE_SCRIPT` | A — splits the path and special-cases a leading `Land` |
| 7 | `SET_LAND_NUMBER` | N — stored at `[g+0x4e10d8]` |
| 8 | `PAUSE_GAME` | — |
| 17 | `LOAD_LANDSCAPE` | A |
| 18 | `LOAD_GAME_SCRIPT` | A |
| 25 | `SET_STARTUP` | A — `"AllowSkip"`, `"ForceIntro"`, `"Default"` |

`SET_STARTUP` clears bit 23 and sets bit 22 of `[g+0x10]` for `AllowSkip`,
the reverse for `ForceIntro`, and clears both for `Default`. But a
`--trace-fs` run with the file in place shows the demo never opens
`MPDebug.txt` in its first eighty seconds, so the route is unproven and the
readers of those two bits have not been found either; the poke above is what
actually works today.

### The frontend does not see window-message mouse input (2026-09-11, Claude)

With the menu up — the Select Profile dialog with a New Profile Name modal
over it — a full `mousemove` / `mousedown` / gap / `mouseup` on the
highlighted OK button at 640x480 coordinates 248,272 left the modal exactly
where it was, twice, and Return did nothing either. The button's yellow
diamond is an idle pulse, not a hover state: it is already lit in a capture
taken before any pointer event, and its phase changes on its own between
captures. So there was never evidence the cursor was tracked on that path,
and the game's own cursor sits pinned in the top-left corner of every frame.

The PE imports `DINPUT8.dll!DirectInput8Create`, and a run traced with
`--trace-api=DirectInput8Create,GetCursorPos,SetCursorPos,ShowCursor,ClipCursor`
shows it called once from `0x009afd9f` during startup, alongside four
`ClipCursor` calls, a `ShowCursor` and a `GetCursorPos` — all before the menu.
This is a DirectInput8 frontend with a software cursor, so the harness
primitives it needs are the DI ones, not the window-message ones:

- `relmousemove:DX:DY` → `renderer.handleRelativeMouseMove`, whose own comment
  says it exists because "software-cursor games keep their own position";
- `di-mousedown` / `di-mouseup` for the buttons;
- `renderer.setMousePosition` only feeds `GetCursorPos`, via
  `$host_get_mouse_position` in `$handle_GetCursorPos`.

One trap worth writing down, because it costs a whole run to find: over
`--control-stdin` these are input *entries*, so they must be sent as
`{action:"input", cmd:"di-mousedown"}`. A bare `{action:"di-mousedown"}` is
rejected with `need {cmd:"action:args"}` — `test/run.js` derives the entry
from `cmd.cmd` and only a plain-string control command falls back to the
action name.

### Driving the frontend through DirectInput (2026-09-11, Claude)

Confirmed by measurement: the DI path works and the window-message path does
not. Three captures from one run, `--skip-intro` plus relative moves:

- `01-menu` — the game's own cursor is drawn in the top-left corner, where it
  has sat since the first frame.
- `02-cursor-centre` — after `relmousemove:-2000:-2000` (slam to the origin,
  since the deltas are relative and the absolute position is the game's own)
  then `relmousemove:320:240`, the cursor is drawn at roughly 332,238. The
  frontend tracks the DirectInput deltas.
- `03-name-ok` — a `di-mousedown` / 2.5s / `di-mouseup` pair on the New
  Profile Name OK button at 248,272 dismissed *both* stacked dialogs and left
  the main menu up, titled `Player`, with the bottom bar live: Continue, New
  Game, Load Game, Change Profile, Options, Quit.

So the recipe for any B&W2 frontend click is: `relmousemove:-2000:-2000` to
re-origin, `relmousemove:X:Y` to the target, a gap, `di-mousedown`, a gap,
`di-mouseup`. The gaps matter for the same reason they matter everywhere else
in this repo — the game samples the button state per frame, and at software
rendering speed a frame is seconds of wall clock, so a press and release
inside one sample is invisible.

Bottom-bar button centres at 640x480, measured off `03-name-ok`: Continue 60,
New Game 155, Load Game 265, Change Profile 380, Options 480, Quit 590 — all
at y=443.

Two further results from the same run. Clicking New Game at 155,443 reaches
the mouse-controls tutorial — four panels with the good and evil advisors,
alpha-blended sprites and a Continue button at about 320,460 — so the
frontend renders and routes correctly past the profile screens. And the
split-backing fallback from 41022d0d does **not** fire anywhere up to that
point: a census of `VIRTUAL_MAP_TABLE` taken twice at the menu reports 162
records, zero of them continuation-marked. Whatever forces a split is later
than the frontend, so that path still needs a land to be proven in the real
game rather than only in `test/test-virtual-map-split-commit.js`.

### Clicking New Game crashes on rsqrtps (2026-09-11, Claude)

Fixed in 7881bf7e, recorded here because the shape of the failure is worth
recognising. Clicking Continue on the mouse-controls tutorial puts the engine
into its vertex work for the first time, and it dies immediately:

```
*** CRASH at batch 561082: unreachable      ($th_bad_opcode)
  EIP=0x00962cb6
  00962cb6  0f 52 c8     rsqrtps xmm1, xmm0
```

The enclosing function is `0x00962bb0`, a normalizer over an array of 16-byte
vectors: `movaps` the pair, `addps`/`subps` to get sum and difference, two
horizontal `shufps`+`addss` reductions for the squared lengths, `comiss` to
pick which of the two to keep, then `rsqrtps` plus two Newton-Raphson steps
(`mulps`/`mulps`/`subps` against constants at `0x1d6edb0` and `0x1d6edd0`).
Every form in that loop except `rsqrtps` was already decoded, which is why
nothing else in the game had tripped over it.

Adding the single opcode would only have moved the crash a few instructions,
so 7881bf7e added the rest of the SSE1 packed group at once — `0F 51/52/53`,
`0F 54/55/56`, `0F 5D/5F` and the three `F3`-prefixed scalar twins.

### Clicks need a long settle, not a long press (2026-09-11, Claude)

A DirectInput button event carries no position: the game clicks wherever *its*
cursor has got to. At software-rendering speed one frame is seconds of wall
clock, so a `relmousemove` followed three seconds later by a `di-mousedown`
presses at the position the game held *before* the move, and every click in a
run misses with no diagnostic at all — the dialog simply stays up. The run that
worked left about twenty-eight seconds between settling the cursor and pressing
it, by accident. Budget ~25s after the move and ~10s between down and up, and
photograph before each click while a sequence is still being calibrated.

### Land load nulls a texture pointer: DXT3 and A8L8 were missing (2026-09-11, Claude)

Clicking Continue on the tutorial loads a land (`Land3.ter`, 969 1024x1024
textures, real shaders) and then EIP goes to 0 on a white screen. The chain,
read back from the hit counters and the disassembly:

    [obj+0x1d0] ends at 2 (failed)
      -> 0x00938fc0 returns NULL
      -> caller 0x00a5553b does `mov edx,[edi]; call [edx+0x34]`
         (IDirect3DTexture9::GetLevelCount) on NULL
      -> $g2w absorbs the null read into NULL_SENTINEL, EIP := 0

`D3DXGetImageInfoFromFileInMemory` is **not** the failure point — it succeeds
all 262 times, and the asset named `data\landscape\dummy.bmp` is a cache key
for a CPU-filled splat texture, not a file anybody opens. A `--count` probe on
the loader's two arms measured the real split:

    0x00938c13 = 262   loads attempted
    0x00938cf6 = 100   failed
    0x00938f22 = 162   succeeded

and a format histogram over the 278 `IDirect3DDevice9_CreateTexture` calls in
the same run named the cause outright:

    133  0x31545844  DXT1
     97  0x33545844  DXT3      <- not implemented
     29  0x00000015  A8R8G8B8
     16  0x35545844  DXT5
      2  0x00000033  A8L8 (51) <- not implemented
      1  0x00000016  X8R8G8B8

`IDirect3D9::CheckDeviceFormat` answers S_OK to everything, so the game is
entitled to ask for both and only finds out at `CreateTexture`.

Both are implemented now. DXT3 is a 16-byte block: sixteen explicit 4-bit
alphas in bytes 0..7, low nibble first, replicated to 8 bits (`0xf` -> `0xff`,
not `0xf0`), and DXT5's colour half at byte 8 — always four interpolated
colours, never DXT1's `c0 <= c1` punch-through mode. A8L8 is two bytes per
texel, luminance low and alpha high, which is the first uncompressed format
here that is not four bytes wide: `$d3d9_texture_pitch` and the lock subrect's
x offset both had the 4 written in.

Files: `lib/d3d9-texture.js`, `lib/d3d9-host.js`,
`src/09ae-d3d9-resources.wat`, `test/test-d3d9-textures.js`.

### Land load now runs out of backing, not out of formats (2026-09-11, Claude)

With DXT3 and A8L8 in place the loader's failure arm stops firing entirely:

    0x00938cf6 = 0     (was 100)
    0x00938f22 = 270   (was 162)

The null-deref at `0x00a5553b` and the EIP-0 white screen are gone, the mouse
tutorial renders fully textured, and the land load runs on for another two
minutes before dying differently:

    [C++ throw] .?AVbad_alloc@std@@ at EIP 0x00ada813
    === UNHANDLED EXCEPTION: CXX_EXCEPTION 0xe06d7363 ===
    [Exit] code=-529697949

`tools/virtual-map-census.js` on that run's exit dump says this is capacity,
not fragmentation:

    records 299   pool 0x8000000..0x1bbf7000 (316.0 MB)
    live 315.3 MB (99.8%)   free in holes 0.7 MB   largest hole 0.1 MB
    split commits: 0

and the allocation capture taken earlier in the same load breaks the 248 MB
committed at that point into 167 MB of `$heap_alloc` arenas (161 MB of it
handed out, 97%) against 81 MB of direct `VirtualAlloc` commits, with only
7.9 MB on the heap free list. There is nothing to reclaim. Two things ruled
out along the way: the guest never asks for `MEM_DECOMMIT` (all ten
`push 0x4000` sites in `.text` are 16 KB `malloc` calls, not `VirtualFree`
flags), and `MEM_RESERVE` already costs no backing.

So B&W2's land simply needs more committed memory than `$VIRTUAL_BACKING_BASE`
has. The map is full: 180 allocated regions end at ~`0x07BC6000`, the pool runs
`0x08000000..0x1BC00000`, and `$GUEST_PAGE_TABLE`, `$DIB_BACKING_BASE` and
`$THREAD_RPC` fill the rest up to the 512 MB ceiling exactly.

## What the game asks about memory, and what we used to answer

Before raising the ceiling it is worth checking whether B&W2 sizes its load
from what we tell it. It does, through two calls, and both of our answers were
wrong in the direction that makes it over-commit:

    [API #140848] SetProcessWorkingSetSize(0xffffffff, 0x08000000, 0x1ce00000) [ret=0x00612cc3]
    [API #685967] IDirect3DDevice9_GetAvailableTextureMem(0x07f36030) [ret=0x00934a20]

The working-set pair is 128 MB / 462 MB, and 462 MB is exactly the 512 MB we
reported from `GlobalMemoryStatusEx` minus the 50 MB the game subtracts — so
the number came straight back out of our answer. It then asks D3D9 how much
texture memory there is, once, from `0x00934a20`, and stores the result at
`[ebp+0x460]`; that handler was a silent stub returning 0.

Neither answer was about the right pool. A guest commit can only ever come out
of `$VIRTUAL_BACKING_BASE` — everything else in the linear memory is
emulator-private — so the honest physical total is the pool's 316 MB and the
honest available figure is what its bump cursor has left. `$virtual_backing_available`
in `src/10-helpers.wat` computes that; `GlobalMemoryStatusEx` now reports it,
and `GetAvailableTextureMem` returns it rounded down to a whole megabyte the
way a real driver does.

## The land's texture slot array, and the formats it falls back through

After the extension backing window removed the memory wall, the land load died
one instruction past a texture getter:

    [eip-zero] guest called through NULL at batch 1772135
      dbg_prev_eip=0x00a21f27

`0x00938fc0` is that getter. It reads a state word at `[ecx+0x1d0]` (0 and 3
are ready, 1 means "a load is in flight", and `0x00938930` spins in
`SleepEx(0, TRUE)` until it leaves 1) and returns the D3D resource pointer at
`[ecx]`. Read it as "the getter returned NULL" and you chase the loader; the
`--count` arms say no load ever failed. It is the wrong reading. With `ecx`
NULL, `$g2w` absorbs *both* reads into `NULL_SENTINEL`, so a NULL `this` is
indistinguishable from a successful call returning NULL, and `--fault-null`
is the only thing that separates them:

    [fault] unmapped guest access 0x0 from eip=0x938fe5   ; mov eax,[esi], esi = 0
    [fault] unmapped guest access 0x0 from eip=0xa21f27   ; mov ecx,[eax]
    [fault] unmapped guest access 0x48 from eip=0xa21f27  ; call [ecx+0x48]

So the empty thing is the *caller's* slot array. `0x00a21ee0` blits a subrect of
`[esi+edi*4+0x1d0]`, and `0x00a20fe0` is what fills those two slots — sized from
`[esi+0x1d8]`/`[esi+0x1dc]`, which `0x00a23420` zeroes along with the slots:

    lea edi,[esi+0x1d0]; mov ebx,2          ; two slots
      call 0x933910(w,h,1,0,0x51,4)         ; D3DFMT_L16
      cmp [edi],0 / jnz done
      call 0x933910(w,h,1,0,0x32,4)         ; D3DFMT_L8
      test eax,eax / jnz done
      call 0x933910(w,h,1,0,0x14,0)         ; D3DFMT_R8G8B8
      mov [edi],eax                         ; stores NULL and carries on

Nothing bails out when all three fail. A format histogram over the whole land
load — `--trace-api=IDirect3DDevice9_CreateTexture`, argument 6 — names what it
actually asks for, and it is not only that chain:

| format | calls |
|---|---|
| DXT1 `0x31545844` | 136 |
| DXT3 `0x33545844` | 106 |
| DXT5 `0x35545844` | 16 |
| A8R8G8B8 (21) | 32 |
| **L8 (50)** | **4** |
| A8L8 (51) | 3 |
| **R8G8B8 (20)** | **2** |
| **R5G6B5 (23)** | **1** |
| X8R8G8B8 (22) | 1 |

L16 never appears: the game's own capability probe at `0x009371d0` skips it and
starts at L8. The three bolded rows are the ones we refused, so those slots
stayed NULL — and `IDirect3D9_CheckDeviceFormat` was a blanket `S_OK`, which is
what let the game believe all three were available in the first place. Every
CreateTexture call in the run returns through d3dx9_25 (`ret=0x025fa2e5`), never
from the exe directly, so a breakpoint on the exe side sees none of this.

## A -2000,-2000 mouse delta hangs the land-selection screen

**The land picker is not broken; the way we were driving it was.** With no
input at all it submits about thirteen draws a second for as long as you care
to watch (measured: 3409 → 4309 submissions over 65 seconds, EIP moving between
the IDirect3DDevice9 thunk and game code). Send it one
`relmousemove:-2000:-2000` — the "slam to the origin" that every earlier screen
in this file takes without complaint — and it stops presenting about ten
seconds later and never recovers.

The recipe that reaches the land picker uses that slam because a DirectInput
delta carries no position and there is no other way to know where the cursor
started. A 2D menu clamps it at the screen edge, which is why the three screens
before this one take clicks fine. This one is a 3D scene and feeds the raw
delta somewhere a huge value ruins.

### What the hang looks like, for recognizing it again

Three measurements, all from the drive that sent the slam:

- **D3D submissions flatline.** The allocation probe's series climbs 520
  (t=218s) → 3054 (323s) → 6346 (534s) → 6964 (604s) and then sits at **6973**
  for the remaining 800 seconds of the run. The land screen first appears at
  t≈619s, so presenting stops about twenty seconds after it is finished.
- **Every later input is ignored.** That drive tried five more: a click on the
  coloured thumbnail at (135,375), a click on the vignette at (320,180), Enter,
  a double click, and Space. All five captures are byte-identical, md5
  `817f4239cd047d69ab0fdcc8f8192926` — the game was already gone.
- **Nothing is allocated either.** The virtual-map census is frozen across all
  of them at `{count:351, extBytes:37654528, continuations:0}`.

The 5-second sampler shows the run stalling in two distinct places:

| window | what the sampler sees |
|---|---|
| t=655s → t=1042s | **one 387-second gap** — a single batch that did not return. The last sample before it is `eip=0x00adeda9`, CRT/heap territory. |
| t=1042s → end | 118 samples, five seconds apart, **every one** at `0x9e5272` or `0x9e5276`, exactly alternating. |

So the emulator is healthy in the second window — batches return on schedule —
and the guest is simply inside one loop.

### 0x009e5140 is a spatial-grid region query

`thiscall(&minPt, &maxPt, &outArray)`, `ret 0xc`. The `this` object is a
uniform grid over the map:

| offset | meaning |
|---|---|
| `+0x00`..`+0x0c` | world bounds `x0, y0, x1, y1` |
| `+0x10` | row stride, in cells |
| `+0x14` / `+0x18` | cell width / cell height — the `idiv` divisors at `0x9e5184`/`0x9e5193` |
| `+0x20` | base of the cell array, 12 bytes per cell (`+0x00` count, `+0x04` items) |

The body is three nested loops:

```
0x9e5250   for each cell row y0c..y1c            ; ebp walks 0xc per row
0x9e5260     for each cell in the row            ; esi = the output array
               for each object in the cell       ; ebx
0x9e5272         linear scan outArray for a dup  ; cmp [ecx],edi / jz 0x9e52e9
0x9e5281         not found -> append             ; grow via operator new[] 0xad425d,
                                                 ;   copy, operator delete 0xad671a
```

The output array is the usual `{capacity@+0, count@+4, data@+8}`. The dup scan
is linear in `count`, so the whole query costs
`cells × objectsPerCell × |out|` — quadratic in the size of the result set. A
query rectangle covering the whole map never finishes.

Callers: `0x9e46c0` and `0x9e4740`, both of which normalize their rect through
`0x9eeee0` (a min/max sort of `{x0,y0,x1,y1}`), expand it by one in each
direction, and write the result count back to `this+0xc8`. Those are reached
from `0x9d4cf2` and `0x9d4ff5`.

**One trap to be aware of before blaming the game.** If `operator new[]` ever
hands back NULL, `outArray.data` becomes unmapped, `$g2w`'s NULL_SENTINEL makes
every dup-scan read return 0, the item being inserted is never equal to 0, so
*every* object appends and `count` grows without bound — turning a finite
quadratic pass into a genuinely infinite one. `outArray.data` is therefore the
first thing to read when sampling this loop, not the last.

### Reaching the land picker headlessly

Roughly twenty minutes of wall clock on an unloaded box, all of it through
`tools/black-white-software-probe.js --control-stdin --skip-intro`:

| t (approx) | action |
|---|---|
| +180s | main menu |
| | click (248,272) — new profile |
| +50s | click (155,443) |
| +80s | click (320,460) — *Continue* on the mouse-controls tutorial |
| +60s | the land-selection screen |

The clicks are **DirectInput and relative**: `src/09a8-handlers-directx.wat`
keeps a delta pair and an event ring, which is what a DI8 game polls, so each
one is `relmousemove:-2000:-2000` (slam to the origin), 10s, `relmousemove:X:Y`,
25s, `di-mousedown`, 10s, `di-mouseup`. The long gaps are load-bearing: a DI
button event carries no position, so the game clicks wherever its own cursor has
got to, and at software-rendering speed one frame is seconds of wall clock. A
press three seconds after a move lands where the cursor was *before* the move.

Pin the build with `--wasm=` plus a saved `WINE_REGION_MAP` mirror. This is a
shared worktree and a drive that rebuilds picks up whatever half-finished edit
is on disk at spawn time.

### Drive this game by watching the screen, not by sleeping

Every recipe in this file that reads "+180s menu, click, +50s, click" was
measured on an idle box, and it is only valid on one. Drive 12 ran at load
average ~8 and each of its three menu clicks landed on a splash screen: at
t=180s the game was still showing the Black & White 2 title card, at t=300s
the Lionhead logo, at t=380s the ATI logo. The clicks themselves were fine.
The tags on the captures were fiction, and a capture tagged `03-profile-made`
showing a company logo reads as "the click did nothing" unless you open it.

Two shapes make that mistake cheap to spot and cheap to avoid:

- A splash-chain frame is *small*. The title card and the profile screen come
  out around 220-400 KB of PNG; the Lionhead logo is 36 KB and the ATI logo is
  11 KB, because they are a handful of flat colours. `ls -la` on the shot
  directory sorts splash from content before any image is opened. (Same signal
  as `tools/app-contact-sheet.js --pick=largest`, for the same reason.)
- Wait for the screen instead. Keep one reference frame per screen from a run
  that did reach it, capture every 15 s, and advance when
  `diffPng(capture, reference, {tolerance:24}).share` drops under 0.12. Two
  frames of one screen from different runs differ by ~1% here (the game
  animates — see the vignette note above), and any *other* screen differs by
  tens of percent, so the gap between "this screen" and "not this screen" is
  two orders of magnitude wide and needs no tuning. Log every reference's share
  on each poll: a run that never arrives then says which screen it is stuck on
  rather than just timing out.

The reference frames currently used are the `n12-0{1,2,3,4}-*` captures
(menu / profile-made / tutorial / land-select).

### CORRECTION: it is not the size of the delta — any mouse poll hangs the land picker

The section above blames a single `-2000,-2000` lump. That was measured, but
the conclusion drawn from it was too narrow. Drive 13 reached the land picker
(reference-matched, `land=0.0%`) and moved the cursor in **50-pixel steps
three seconds apart** — ordinary hand motion at this frame rate — and the
screen stopped presenting exactly the same way: EIP pinned at `0x9e5276`, the
software backend's submission counters flat at 1886, and every capture taken
afterwards **0.00%** different from the one before. Drive 8's lump and drive
13's sweep produce one symptom, so the delta size is not the variable.

What the variable is, from a live probe inside the loop:

| when | the grid cell record |
|---|---|
| before any input (`eip=0x878800`) | `{n: 0, items: 0}` |
| hung (`eip=0x7503488`, in the D3D thunk under the query) | `{n: 993082159, items: 993213234}` |

and the output array is not NULL at all — `{cap: 262144, count: 231616}`
climbing to `241304` five seconds later. So the earlier NULL_SENTINEL theory
for the grow path is wrong too: the array is real and the loop is genuinely
appending hundreds of thousands of entries, because the cell it is walking
claims ~993 million objects. `0x3B31E5EF` is not a count anybody wrote; it is
whatever bytes that address happens to hold.

So the bug is upstream of the loop: the spatial grid's cell pointer (or the
grid header it is derived from) is garbage by the time the first mouse poll
runs a pick against it. `0x009e5140` is the victim, not the culprit, and it
is reached on *every* mouse poll over this screen — which is why the screen
survives indefinitely with no input at all (drive 9) and dies on the first
motion of any size.

### The land picker's infinite loop is an unreported out-of-memory

Tracing the faulting block itself (`--trace-at=0x9e50e6` with `esi:12`, 307
hits) closes the chain. The cell is a 12-byte vector `{capacity, count, items}`
and the append is an ordinary `push_back`:

    0x9e50d7  mov edx,[esi]          ; count      (esi = cell+4)
    0x9e50d9  cmp edx,[esi-0x4]      ; == capacity?
    0x9e50df  jnz 0x9e50e6
    0x9e50e1  call 0x9e8200          ; grow
    0x9e50e6  mov eax,[esi]          ; count
    0x9e50e8  mov ecx,[esi+0x4]      ; items
    0x9e50eb  mov [ecx+eax*4],ebp    ; items[count] = object   <-- faults

and grow is a textbook doubling vector that **never checks its allocation**:

    0x9e8200  (cap ? cap*2 : 1) * 4 bytes
    0x9e821b  call 0xad425d          ; operator new[]
    0x9e8220  mov edi,eax            ; no test, no jz
    0x9e8230  ...copy old elements...
    0x9e8244  call 0xad671a          ; operator delete[] (old)
    0x9e824c  mov [esi+0x8],edi      ; items = whatever new[] returned

Of the 334 faulting stores in one run, **190 are to address 0x0 or 0x4** —
`items` is NULL — and every traced entry arrives with `prev_eip=0x009e8249`,
i.e. straight out of that grow. So `operator new[]` is returning NULL.

On real Windows this is a crash at `mov [ecx+eax*4],ebp`. Here `$g2w` maps the
null store onto `NULL_SENTINEL`: the write disappears, `count` is still
incremented, and the next dup-scan reads the same sentinel back as 0, matches
nothing, and appends again — forever. **The infinite loop is not the bug; it is
how an unchecked `operator new[]` failure presents when a null dereference is
survivable.** That also explains why no input at all is safe (drive 9): nothing
calls the pick, so nothing calls grow.

This is the same wall as the bad_alloc in "Land load now runs out of backing"
above, just reached from a path that does not check the result. The remaining
question is what the allocator has left at that moment, not what the loop does.

### CORRECTION: `operator new[]` never returns NULL, and the allocator is not the problem

Commit `8ed6886b` concluded that the land picker's infinite loop was an
unreported out-of-memory — that `0x9e8200`'s `call 0xad425d` returned NULL and
the grow routine stored it without checking. That is wrong on both halves:

- `0xad425d` → `jmp 0xad41b9` is MSVCRT `operator new`, which loops on `malloc`,
  calls `_callnewh` on failure, and **throws** when that returns 0. It has no
  path that returns NULL to its caller.
- Our allocator has capacity at the land picker — live probes of 64 B through
  1 MB all succeed — and it structurally cannot hand back the wild `items`
  values we see. `$heap_sparse_alloc` takes every chunk from
  `$virtual_reserve_down`, which refuses anything below `$VIRTUAL_ALLOC_MIN`
  (`0x10000000`) and commits each chunk before returning it. The observed
  `items` cluster `0xb7a77000..0xb7ac6000` is outside the VirtualAlloc arena
  entirely, so no allocation produced it.

A drive with `--trace-at=0x9e8220` (the call-return landing inside grow) across
a full walk to the picker plus the hanging nudge recorded **zero** hits, which
settles it: grow is not even on the faulting path. The cell records the loop
reads are garbage — the `n`/`items` words decode as ASCII fragments — so the
grid's cell-table pointer `[edi+0x20]` is pointing at unrelated data, and the
question is what left it that way, not what the allocator returned.

### The land load blits from a NULL `bmBits`, and that is ours

The 1054 faults at `0x9b7370` during the land load are the concrete defect
underneath. The block is a row blit, and the destination is checked:

```
009b72cd  push 0 ; call [0xc12054]      ; CreateCompatibleDC(NULL)
009b72dd  push edi ; push eax ; call [0xc12050]   ; SelectObject(hdc, hbmp)
009b72ed  lea eax,[esp+0x18] ; push eax ; push 0x18 ; push edi
          call [0xc1205c]               ; GetObjectA(hbmp, 24, &BITMAP)
009b7303  movzx eax,word [esp+0x2a]     ; bmBitsPixel
009b7326  call 0x8b1180                 ; allocate the destination
009b7331  jz   0x9b73a3                 ; ...and it IS checked
009b7370  mov edi,eax                   ; dest = the checked allocation
009b7379  mov esi,edx                   ; src  = derived from bmBits
009b737b  rep movsd
```

So the faulting reads are the **source**: `bmBits`, straight out of
`GetObjectA`. The bitmap comes from the call at `0x9b7279` —
`LoadImageA(NULL, path, IMAGE_BITMAP, 0, 0, 0x2010)`, i.e.
`LR_LOADFROMFILE | LR_CREATEDIBSECTION`.

`$load_image_bitmap_file` built a DDB for every caller, and a DDB's pixels are
device-private: `$gdi_bitmap_write_object` deliberately reports `bmBits = 0` for
one. That is right for a DDB and wrong here — the app asked for a section
precisely so it could read the bits. The fix threads the flag through
`$load_image_bitmap_file` and takes `$gdi_bitmap_create_owned` with the
DIB-section object flag, so the pixels land in `$dib_alloc` storage that has a
guest address. `test/test-loadimage-dibsection.js` covers both directions in
about two seconds: the section reports a non-NULL `bmBits` that addresses the
file's pixels, and plain `LR_LOADFROMFILE` still reports `bmBits = 0`.

### The NULL blit was a fake success handle, and it is gone

`0x009b71f0` is a media finder: it copies a path into a stack buffer and calls
`LoadImageA(NULL, name, IMAGE_BITMAP, 0, 0, LR_LOADFROMFILE|LR_CREATEDIBSECTION)`
through `[0xc1244c]`, then retries twice with `..\%s` and `%c:\%s` before
giving up with `mov eax,3`. `--trace-api=LoadImageA` catches all three:

```
[API #724053] LoadImageA(0x0, 0x074ff65c, 0x0, 0x0, 0x0, 0x00002010) [ret=0x009b7246]
[API #724054] LoadImageA(0x0, 0x074ff65c, 0x0, 0x0, 0x0, 0x00002010) [ret=0x009b727b]
[API #724055] LoadImageA(0x0, 0x074ff65c, 0x0, 0x0, 0x0, 0x00002010) [ret=0x009b72a6]
```

and `--trace-fs` names the files: `Data\Font0-0.bmp` and
`data\load_indicator.bmp`. Neither exists anywhere in the demo, so all three
candidate paths fail on real Windows too and the game's error return is the
correct outcome.

It never got there. `$handle_LoadImageA` answered a failed `LR_LOADFROMFILE`
load with a synthetic 32x32 compatible bitmap, which passed the caller's
`test edi,edi` at `0x9b7248` and sent it down the success path — where
`GetObjectA` reported `bmBits = 0` for that device-dependent stand-in and
`rep movsd` read from address 0. The stand-in is reasonable for a resource id
the walker cannot find; for a *file*, failure is the answer, and the caller is
branching on it.

Two changes, both in `$handle_LoadImageA`/`$load_image_bitmap_file`:
`LR_CREATEDIBSECTION` now builds a real DIB section whose bits have a guest
address, and a file that will not load returns NULL. Measured on a full walk to
the land picker, total `[fault]` lines went **1089 to 1**.

### CORRECTION: the picker is alive, and only a real click wedges it

Every earlier reading of "any mouse motion hangs the land picker" rested on the
screen being byte-identical after a nudge. That test is worthless here: nothing
on this screen hover-highlights, so an identical frame is the expected result
whether the guest is running or not.

Sampling EIP instead settles it. At the picker, before any click:

```
eip samples at the picker: b53580 b53543 a011c6 a01250 a51ac8 (distinct 5)
```

Five distinct addresses over 20 seconds — the guest is stepping and rendering.
A 5-pixel `relmousemove` leaves it that way. It is a **click** that wedges it,
and then EIP pins to `0x9e5272`/`0x9e5276` for eighteen minutes of polling with
the screen at 0.0%.

What the screen actually shows is worth recording: not a menu, but a rendered
3D scene — a burning village, correct geometry and lighting — with a filmstrip
of nine land thumbnails beneath it, the second one unlocked in colour at about
(133, 378). D3D9 is drawing real content here.

With the LoadImage fixes in, that wedge now happens with **zero** `[fault]`
lines, so it is a genuine infinite loop in the grid query at `0x9e521f`, not
something `NULL_SENTINEL` is hiding. The walk to the picker also dropped from
~3600s to 962s.

### CORRECTION: it is not an infinite loop. It is a billion-iteration scan
### over a vector whose header sits on top of an ASCII string

The section above calls the pick wedge "a genuine infinite loop in the grid
query". That is wrong, and the disassembly of the pinned addresses says so
directly. `0x9e5272`/`0x9e5276` are the two halves of a plain linear
duplicate scan:

```
0x9e5260  mov edx,[esi+4]      ; n
0x9e5265  test edx,edx
0x9e5267  jle 0x9e5281
0x9e5269  mov ecx,[ebp+4]
0x9e526c  mov edi,[ecx+ebx*4]  ; needle
0x9e526f  mov ecx,[esi+8]      ; items
0x9e5272  cmp [ecx],edi        ; <-- pinned
0x9e5274  jz  0x9e52e9         ; duplicate found, skip the append
0x9e5276  add eax,1            ; <-- pinned
0x9e5279  add ecx,4
0x9e527c  cmp eax,[esi+4]
0x9e527f  jl  0x9e5272
```

`esi` is a `std::vector`-shaped object: `[esi]` capacity, `[esi+4]` size,
`[esi+8]` items. The grow path below it (`0x9e5287`..`0x9e52a1`) doubles the
capacity and calls `operator new[]` at `0xad425d`, which is the ordinary
push_back-with-dup-check shape.

The loop has an exit; it is simply `[esi+4]` iterations away from it. A live
probe read the header as `{n: 993082159, items: 993213234}`, so the scan is
~1e9 iterations — at this interpreter's throughput, days. Nothing is stuck
and nothing needs a deadlock explanation; the loop is doing exactly what it
was told, with a count that is not a count.

What the two values are is the actual finding. Decoded as little-endian
bytes:

```
n     = 0x3B313B2F  ->  2F 3B 31 3B  =  "/;1;"
items = 0x3B333B32  ->  32 3B 33 3B  =  "2;3;"
```

Contiguously `"/;1;2;3;"` — a semicolon-delimited numeric list. The vector
header is not arithmetically corrupt, it is **overlapping a string buffer**.
No such literal exists in the image (`find_string.js` finds neither
`";1;2;3;"` nor `"0;1;2;3"`), so the text is built at runtime.

This retires the earlier "operator new[] returned NULL" theory for good, and
it reframes the question. It is no longer "why does the query loop forever"
but "why does the object at `esi` — the grid reached as `[object+0x74]` from
`0x9e46c0`'s `lea ecx,[esi+0x74]` — hold text". Either something wrote a
generated list over the object, or the object pointer used at the pick points
into a text buffer.

Caveat on provenance: the `{n, items}` pair is a single probe reading, and
everything above is built on it plus static disassembly. It should be
re-read live at the picker before any fix is designed against it.

### CORRECTION: the ASCII reading of the vector header is not the best one.
### The same bytes are two adjacent, increasing IEEE floats.

The entry above reads `n = 0x3B313B2F` and `items = 0x3B333B32` as little-endian
ASCII `"/;1;"` + `"2;3;"` = `"/;1;2;3;"` and concludes the vector header overlaps
a runtime-generated string buffer. That reading is possible but it is **not
supported**, and a competing reading of the identical bytes fits better:

| dword | u32 | **f32** | ascii |
|---|---|---|---|
| `0x3B313B2F` | 993082159 | **2.704333e-3** | `/;1;` |
| `0x3B333B32` | 993213234 | **2.734852e-3** | `2;3;` |

Two consecutive slots holding `0.0027043` and `0.0027349` — same magnitude,
monotonically increasing, delta `3.05e-5`. That is the shape of an ordinary
**float array** (a curve, a weight table, a heightfield row), and it needs no
coincidence to explain: any pair of small positive floats in `[2.4e-3, 3.0e-3)`
shares the exponent byte `0x3B`, and the `;` at both odd positions is that
shared exponent, not a separator. The digits `1`/`2`/`3` in the ASCII view are
just the mantissa creeping upward. **The "string" is an artifact of reading a
float array as text.**

What was checked, and came back negative for the string reading:

- No `"%d;"`, `";%d"`, `"%s;"`, `"0;1;2"` or `"1;2;3"` format/literal string
  exists anywhere in `BW2Demo.exe` (`tools/find_string.js --all`), so nothing in
  the image builds a semicolon-separated list of that form.
- No file under `installed/` contains `;1;2;3;` or `/;1;` (recursive `grep -rl`),
  so it is not loaded data either.
- The byte run `2f 3b 31 3b 32 3b 33 3b` does not occur in
  `Construction_deltas3.raw`, `Construction_heights.raw` or
  `BnWPoolingSetup.bin`, the three raw float blobs the demo ships.

So: **do not build a fix on the "header overlaps a string buffer" story.** What
is established is only the mechanical part, which both readings share and which
is what actually wedges the game — `[esi+4]` is read as a count and holds
993,082,159, so the duplicate scan at `0x9e5272`..`0x9e527f` runs about a
billion iterations with a working exit it will not reach in any plausible time.
The open question is unchanged and still needs the live re-read: **what is the
object at `[object+0x74]` reached from `0x9e46c0`, and why is a float array (or
whatever it really is) reaching this code as a `std::vector` header** — an
uninitialised pointer, a freed-and-reused allocation, or a wrong field offset.

Both the `{n, items}` pair and everything above it remain a single probe reading
plus static disassembly. Re-read it live at the picker before designing anything.

### What `0x9e5140` actually is: a spatial-grid rect query with a 12-byte cell

Fully decoded now, and it retires *both* earlier stories. It is
`thiscall Grid::Query(ecx=grid, arg1=rectMin*, arg2=rectMax*, arg3=out*)`
(`ret 0xc` at `0x9e532f` confirms three stack args).

Grid object (`ebx`):

| off | meaning |
|---|---|
| `+0x00`,`+0x04` | origin x, y |
| `+0x08`,`+0x0c` | max x, y (bounds-reject at `0x9e516b`/`0x9e5174`) |
| `+0x10` | row length (cells per row) |
| `+0x14`,`+0x18` | cell width, cell height (the `idiv` divisors) |
| `+0x20` | cell array base |

Cell addressing, `0x9e5214`..`0x9e5236`:

```
eax = [grid+0x10] * row          ; row length * row index
eax = eax * 3                    ; lea eax,[eax+eax*2]
eax = [grid+0x20] + eax*4        ; base + rowIndex*rowLen*12
ebp = eax + col*12 + 4           ; lea ebp,[eax+edx*4+4]
```

so **a cell is 12 bytes** and `ebp` deliberately points at *cell+4*, which is
why the body reads `[ebp+0]` as the cell's count and `[ebp+4]` as its items.

The output has the same three-dword shape, and this is the part that matters:

```
0x9e4701  lea edx,[esi+0xc4]   ; arg3  <-- LEA, not a load
0x9e4712  lea ecx,[esi+0x74]   ; the grid
0x9e4715  mov [esi+0xc8],edi   ; edi=0: zero the output count
0x9e471b  call 0x9e5140
0x9e4720  mov edx,[esi+0xc8]   ; read it back as the result count
```

The second call site (`0x9e479e`) is the same pattern one object over:
grid `esi+0x9c`, out `esi+0xd0`, count `esi+0xd4`, zeroed at `0x9e4798`.

**Therefore `[esi+4]` inside the loop is `[parent+0xC8]` — the output count —
and `[esi+8]` is `[parent+0xCC]`, the output items pointer.** It was never a
`std::vector` header, so it is neither a string (retracted above) nor a float
array: it is an output counter that the caller sets to 0 on the line before the
call. The inner scan at `0x9e5272` is an ordinary "is this candidate already in
the results" dedupe over the results collected so far, which is correct and
cheap when the count is sane.

Checked, so the compiler's stack reuse is not the culprit: `0x9e5245` writes the
*column count* into arg3's incoming slot `[esp+0x30]`, but `esi` is loaded from
that slot once at `0x9e520b`, the row-loop back edge at `0x9e5320` targets
`0x9e5210` (*after* that load) and the column-loop back edge at `0x9e530b`
targets `0x9e5250`. `esi` is never reloaded. The game's code is sound.

**So the open question is now precise:** `[parent+0xC8]` is zeroed immediately
before the call and reads 993,082,159 inside it. The candidates are (a) the
zeroing store did not land, (b) the parent `this` is not the object we think,
or (c) something wrote over it in between. Note the grid at `parent+0x74`
evidently *is* valid in the same call — the bounds compares passed, neither
`idiv` divided by zero, and the cell reached had a positive count — which
argues against a wholly wild `this`.

The live probe to run at the picker is therefore **not** `esi` alone but the
parent record around it: `esi-0xC4` for the object, `esi+0` / `+4` / `+8` for
the output triple, and whether `[esi+8]` is a mappable pointer.

### The land is chosen by a startup directive, not only by the picker

`BW2Demo.exe` reads two script files by name — `.\Scripts\Map.txt` and
`.\Scripts\MPDebug.txt` — and `Map.txt` as shipped is just two lines:

```
SET_LAND_NUMBER(3)
LOAD_FEATURE_SCRIPT(".\data\landscape\BW2\Land3.bwe")
```

`MPDebug.txt` as shipped holds `SET_STARTUP("AllowSkip")`. `SET_STARTUP`
accepts exactly four values, which sit together in `.rdata` at `0xc7edc4`:

| VA | string |
|---|---|
| `0xc7edc4` | `Default` |
| `0xc7edcc` | `ForceIntro` |
| `0xc7edd8` | `AllowSkip` |
| `0xc7ede4` | `Land` |

The `AllowSkip` arm (`0x61a24e`) is a pure flag flip: it takes the global at
`[0x19504a8]`, clears bit `0x800000` and sets bit `0x400000` in `+0x10`.

The `Land` arm is the interesting one. At `0x61a037` the code compares a
*prefix* of the argument against `"Land"`, and on a match passes the rest
through `0xad6678` (atoi-shaped) into `0x60e890`, which compares the result
against the land-number global at `[0x16a8e28]` and, when it differs, resets a
block of engine state (`0x198c6b0`, `0x198b4a8`, `0x198b488`) before switching.
So `SET_STARTUP("Land3")` names a land directly — the same thing the picker is
trying to produce, reached without the picker.

Two practical consequences:

1. **Our extracted game directory is missing `Scripts/MPDebug.txt`**, which the
   shipped `installed/` tree has. That is an extraction fidelity gap, not a
   guest bug, and it means the demo has been running without any startup
   directive at all.
2. It gives a way to exercise the engine past the picker while the picker's own
   defect is still open. Reaching gameplay this way would show the engine and
   renderer work; it would **not** fix or excuse the grid-query wedge, which
   stays a separate open bug.

## The picker wedge is an unbounded scan over a NULL array

`--fault-null=1` on the picker run produced the mechanism. **Read the faults out
of `<artifacts>/run.log`, not the driver's stdout** — `tools/black-white-software-probe.js`
spawns `run.js` with piped stdio and writes the child's output to that file, so
any driver filtering stdout by line prefix discards every fault line silently.
That mistake cost a session: a run with 617,784 faults in it was reported here
as "zero faults".

`run.log` from the session-36 picker run holds **617,784 faults across 15
distinct EIPs**, and two of them carry the whole story:

| EIP | n | address range | step |
|---|---|---|---|
| `0x9e5269` | 617,414 | `0x0` … `0x25af0c` | `+4`, 617,411 times |
| `0x9e50e6` | 334 | `0x0`, then `0xb7abdea0`–`0xb7ac59a0` | `0x1800` (60×), `±4` |

The reported EIP is `(global.get $eip)` from `src/03-registers.wat:249`, which in
threaded code is the **block entry**, not the faulting instruction — so each row
names a block, and the access has to be attributed by reading that block.

`0x9e5269` is the inner loop of the query at `0x9e5140`. In sync from the entry,
`ebp = cellBase + row*[grid+0x10]*12 + col*12 + 4`, the same `+4` convention the
insert uses, so `[ebp]` is the cell's count and `[ebp+4]` its items pointer; the
loop body is `mov ecx,[ebp+4]` / `mov edi,[ecx+ebx*4]`. An address walk of
`0x0, 0x4, 0x8, …` is therefore unambiguous: **`items` is NULL and `ebx` is
counting up**, with the loop bound `[ebp]` at 617k and still climbing when the
32MB log was cut. That loop *is* the wedge — the host census either side of it
shows `get_ticks` frozen at 339620 and `log_i32` frozen at 97531 while `log`
climbs by exactly 100000 per census report, i.e. a guest spinning in one loop
that calls nothing else.

Where the NULL comes from is the insert at `0x9e5060` and its grow path:

```
0x9e50d7  mov edx,[esi]        ; count      (cell = {capacity, count, items})
0x9e50d9  cmp edx,[esi-0x4]    ; == capacity?
0x9e50df  jnz 0x9e50e6
0x9e50e1  call 0x9e8200        ; GROW
0x9e50e6  mov eax,[esi]        ; count
0x9e50e8  mov ecx,[esi+0x4]    ; items
0x9e50eb  mov [ecx+eax*4],ebp  ; items[count] = value
0x9e50ee  add dword [esi],0x1  ; count++
```

and `0x9e8200` is:

```
0x9e8204  mov eax,[esi]        ; capacity
0x9e8213  lea eax,[ebx*4]      ; new byte count (ebx = capacity ? 2*capacity : 1)
0x9e821b  call 0xad425d        ; -> 0xad41b9, MSVCRT malloc
0x9e824c  mov [esi+0x8],edi    ; items = malloc result, UNCHECKED
0x9e8250  mov [esi],ebx        ; capacity = new capacity, unconditionally
```

**There is no NULL check.** A failed `malloc` stores 0 into `items`, doubles the
recorded capacity anyway, and returns; the caller then writes through the NULL
and increments the count. Every later insert sees `count != capacity`, skips the
grow, and increments again — so the count grows without bound while the array
stays NULL. The eventual query walks that count from address 0. That is a guest
bug in the sense that the game has no check, but it only fires because the
allocation failed, which is ours to explain.

`malloc` here is the MSVCRT retry loop at `0xad41b9`: `_heap_alloc` at
`0xad566e`, and on a zero result the new-handler at `0xadc1fe` then a retry.
Note this binary calls `_set_sbh_threshold(0)` at startup (it is in `run.log`),
so the small-block heap is disabled and every one of these goes to the main
heap.

The grid object itself, from the two routines' field use:

| Offset | Meaning |
|---|---|
| `+0x08`, `+0x0c` | bounds, compared with `jge` before any indexing |
| `+0x10` | cells per row (the `0x1800` = 512×12 fault stride says 512 here) |
| `+0x14`, `+0x18` | cell size X / Y — **`idiv` divisors**, so the indexing is integer, not float |
| `+0x20` | cell array base |
| `+0x24` | running max cell occupancy |

Two things that rules out. The indexing is integer division of world coordinates,
so no float→int conversion is involved and the
`no-plain-trunc-on-guest-floats` class of bug cannot be the cause. And the
`0x1800` stride at the insert site is exactly `512 * 12`, i.e. the row arithmetic
is coherent — what is wrong is the base `[grid+0x20]` itself, which reads `0`
on some calls and `0xb7ab_xxxx` on others. Both are unmapped.

What is *not* yet established: which allocation produced those bases, and
whether our heap returned NULL, returned an unmapped non-NULL pointer, or the
base was never written at all. `0xb7ac1020` is not an address any of our
regions hands out, which is the next thread to pull.

One correction to the record: the wedge is **not** triggered by the hover, as
an earlier board entry claimed. This log shows the picker surviving two complete
click cycles (mousedown 223972 / mouseup 232249, then 285656 / 292236) and the
spin beginning only after the second — and the first fault of the run lands
after cursor motion has already started, not on the first hover.

### The allocation never failed — measured, not assumed

The obvious reading of the unchecked grow is "our heap returned NULL". It did
not. `[heap] OOM` reporting now exists for exactly this question (five refusal
paths in `$heap_alloc`, logged unconditionally), and a full 600-second run —
647,150 batches, `--memory-mb=1024`, `--fault-null` armed — produced **zero OOM
lines and zero faults**. Our heap refused this game nothing.

The measured ceilings, for anyone sizing a memory-hungry guest: 8MB allocations
run out at **312MB** on the default 512MB host memory and **816MB** with
`--memory-mb=1024`, the difference being the extension backing window above
`$THREAD_RPC`'s end. Note that `$VIRTUAL_BACKING_EXT` appears only in a comment
in `01-header.wat` — the window is real and implemented as
`$virtual_backing_ext_take` in `10-helpers.wat`, but it is not a declared
region, so grepping the name finds nothing.

So the NULL `items` is not a failed allocation, which changes what the fault
pattern means. If `malloc` always succeeded, then an `items` that reads as zero
was not *stored* as zero — it was **read from the wrong place**. A `cellBase`
pointing into unrelated but mapped memory produces exactly the observed pair: a
large garbage value where the count belongs and a zero where the items pointer
belongs. The `0x0`/`0x4` and `0xb7ab_xxxx` faults are then the cases where that
same wrong base lands somewhere unmapped rather than somewhere mapped.

That run also reached only the Lionhead logo in 600 seconds (the particle
animation renders correctly), against session 35's menu at 471s — this box sits
at load 16-45 with several agents on it, so wall-clock progress is not
comparable between runs and batch numbers cannot be reused across
configurations for input scheduling.

### The grid is an embedded member at parent+0x74

At the query call site the receiver is formed as `lea ecx,[esi+0x74]`
(`0x9e4712`), so the grid is **inline in its parent**, not a pointer to a
separately allocated object. Its cell array is therefore `[parent+0x94]`, and
the output triple the caller zeroes and reads back is `parent+0xC4/0xC8/0xCC`,
consistent with the earlier decode of the two call sites.

This matters for the remaining question: an embedded grid is constructed with
its parent, so "the cell array pointer is wrong" is not a missing allocation of
the grid itself but either an `Init(w, h, cellSize)` that never ran or one that
ran with garbage inputs.

Two dead ends recorded so they are not retried. `tools/find_fn.js` puts the
insert's entry at `0x9e505c` and `0x9e50d6`; both are wrong (`xrefs` finds no
callers of `0x9e505c`), which is the documented caution about that tool. And
`find_field.js` on offsets `0x14`/`0x94` returns 2637 and 237 hits
respectively, nearly all misaligned `adc` decodes of data — the field offsets
here are too common for a static field search to be worth anything.

## The profile gate, and the input recipe that reaches the land picker

Every session before this one stopped at a screen that looked like a hang and
was not one. Two separate gates, both now known:

**The intro is an attract loop.** Title screen → Lionhead logo → repeat,
forever. Neither a click nor a keypress dismisses it, so a run that waits for it
to end never starts. `tools/black-white-software-probe.js --skip-intro` is
mandatory: it writes the intro object's finish-frame field directly, armed once
the EIP trace range `0x00526d93-0x00526d97` fires and names the object in ESI.
Runs `rt150k.png` (title) and `rt190k.png` (logo) are the proof of the loop —
two captures 40,000 batches apart showing the two halves of the cycle.

**The game will not start without a profile.** Past the intro it puts up a
profile dialog, and the main menu is behind it. The dialog is dismissed through
DirectInput, not the renderer's mouse path:

```
355000:relmousemove:-2000:-2000   # home the DirectInput cursor
365000:relmousemove:250:277       # the OK button
385000:di-mousedown:1
395000:di-mouseup:1
430000:keydown:13                 # Enter activates "New Game"
```

That sequence reaches the **land picker** — 3D preview plus the eight land
thumbnails — reproducibly. Batch numbers are for the probe's defaults
(`--batch-size=200000 --real-ticks`); `--real-ticks` is not optional, and a run
without it burns its whole budget inside the intro.

## The 4GB host OOM at the picker was `--fault-null`, not a leak

One full-chain run reached the picker and then died with

```
[22942:...] 1099020 ms: Mark-Compact 4095.6 (4097.3) -> 4094.8 (4100.6) MB ...
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

This was read as an emulator-side unbounded allocation. It is not. The fatal
stack names `node::inspector::InspectorConsoleCall` at frame 17 with
`Builtins_NewRestArgumentsElements` above it: **the 4GB was being allocated
inside `console.log`.** Node's `process.stdout` is asynchronous when it is a
pipe, so a `console.log` the reader cannot keep up with queues in the writer's
heap instead of blocking — and a guest scanning a NULL array outruns any reader.
The Mark-Compact above reclaimed 0.2MB of 4094.8MB, so all of it was live queue,
and the last line of that run's `run.log` is a truncated mid-write
`[fault] unmapped guest access 0x0 fr`.

D3D was ruled out from the same run rather than argued about: `samples.ndjson`
shows draws flat at 3296 with `pending=0` for the last 80 seconds of sampling
while the heap kept climbing, and `submitted == consumed == completed`, so the
command queue drains.

Fixed in `bf260ef4`: `--fault-null` prints at most 64 lines per EIP and counts
the rest, with a `[fault] census` at exit naming every EIP, its true count and
the address range it walked. The cap is per EIP, so a rare fault beside a
spinning one still prints in full. Unit-tested in
`test/test-fault-null-census.js` (0.1s).

**The general warning**, which applies to every diagnostic that prints per guest
event: under `tools/black-white-software-probe.js` the child's stdout is a pipe,
and an unbounded printer there does not merely produce a large log — it kills
the run, and kills it far enough from the guest bug that the log is useless.

## Two more NULL-object faults, distinct from the grid

The same run recorded 12,675 faults at EIPs that are **not** the grid query.
`0x9e17d0` (enclosing block entry `0x9e17b0`) dereferences a NULL `edx` six
times per iteration over roughly 2100 iterations:

```
009e17d0  mov eax, [edx+0x8]
009e17d3  mov ebx, [edx]
009e17d5  mov edi, [eax]
009e17d7  mov esi, [eax+0x4]
009e17da  mov ecx, [ebx+0x8]
009e17dd  mov edx, [ecx]
```

and `0x9d4a69` null-checks a register only *after* dereferencing three others:

```
009d4a70  mov ecx, [esi]
009d4a72  mov edx, [ecx+0x4]
009d4a75  mov ecx, [edx+0x10]
009d4a78  test ecx, ecx
009d4a7a  jz short 0x9d4a87
```

These are a different NULL-object bug from the picker grid and have not been
traced to their source yet.

### Scope correction on the picker wedge

The picker does **not** deterministically wedge. One run reached it with zero
faults and zero `[heap] OOM` lines. The earlier claim that the hover triggers
the wedge was already retracted — the log shows the picker surviving two
complete click cycles first — and the ruling-out of allocation failure holds
only up to the profile screen, since the zero-OOM runs never reached a land and
the probe's own source records that *the land* commits the whole 316MB pool.

## The real wedge: a linked-list walk from a NULL head (run 39)

With the `--fault-null` cap in place the full chain ran to completion instead of
aborting, and the exit census is unambiguous:

```
[fault] census: 4533196660 unmapped access(es) from 4 eip(s)
[fault]   eip=0x9e17d0 x4533196638 addresses 0x0-0x8
[fault]   eip=0x9d4a87 x14          addresses 0x0-0x8
[fault]   eip=0x9d4a69 x6           addresses 0x0-0x10
[fault]   eip=0x9d4abd x2           addresses 0x0-0x0
```

**4.53 billion faults from one EIP.** The 12,675 reported by the run that died
of the host OOM was simply how many had been flushed before it aborted, and the
617,784 from the earlier session was the same artefact at a different EIP. Six
faults per iteration over the addresses `{0x0, 0x4, 0x8}` puts the loop at
about 755 million iterations.

`0x9e17d0` is not a separate bug from `0x9e17b0` — it is the loop body inside
it. The back edge is at the bottom of the same function:

```
009e1820  test ecx, ecx
009e1822  mov edx, ebx          ; edx = node->next, read at 0x9e17d3
009e1824  setge al
009e1827  cmp [esp+0x20], edx   ; reached the end sentinel?
009e182b  jz short 0x9e1831
009e182d  test al, al
009e182f  jnz short 0x9e17d0    ; loop
```

So the function walks a linked list — `ebx = [edx]` at `0x9e17d3` is
`node->next`, `edx = ebx` at `0x9e1822` advances it — comparing two `{x, y}`
pairs reached through `[edx+0x8]` and `[edx]` with a 64-bit cross product
(`imul` at `0x9e17e7` and `0x9e17fa`, `setge` for the orientation). It is a
geometric ordering predicate over an edge or point list, and it stops when the
cursor reaches the sentinel held in `[esp+0x20]`.

**With a NULL head it cannot stop.** `ebx = [NULL]` reads 0 through our NULL
sentinel, so `edx` stays 0, never equals the sentinel, and the loop runs
forever. On real hardware that first `mov ebx,[edx]` is an access violation and
the game would crash or unwind; our `$g2w` miss returning zero converts a crash
into a hang. That is worth remembering generally: **a NULL-sentinel read turns
somebody else's segfault into our infinite loop**, and the symptom moves from a
crash dump to a batch that never returns.

### It is not our allocator

The same run reported **zero** `[heap] OOM` lines, so the earlier hypothesis
that a refused `malloc` leaves a NULL behind does not apply here. The list is
empty for a reason further upstream.

### One object, two vtable slots

Both faulting entries are slots of the same vtable at `.rdata:0xd0bc30`:

| slot | target | faulting EIPs |
|---|---|---|
| 7 | `0x9d4a30` | `0x9d4a69`, `0x9d4a87`, `0x9d4abd` |
| 8 | `0x9d47b0` | tail-jumps to `0x9e17b0` → `0x9e17d0` |

Slot 8 is a three-instruction thunk that dereferences twice before the tail
call, so the argument the walker receives is `**arg1`:

```
009d47b0  mov eax, [esp+0x4]
009d47b4  mov edx, [eax]
009d47b6  mov eax, [edx]
009d47b8  mov [esp+0x4], eax
009d47bc  mov ecx, [ecx+0xc]
009d47bf  jmp 0x9e17b0
```

The vtable is written by the constructor at `0x9d475e` (`mov dword [eax],
0xd0bc30`, then `mov [eax+8], edx` and a `rep movsd` of 0xc dwords). A sibling
vtable at `0xd0bc1c` is written at `0x9d3742` from a `push 0x30` allocation.
Neither has been confirmed to run yet — that is the next measurement.

## Where the NULL comes into the picker (run 40, `--fault-null=stop`)

Trapping on the first fault instead of the billionth costs one short run and
names the instruction and registers outright. It fired at batch 435392, just
after the Enter that opens the land picker:

```
*** CRASH at batch 435392: unreachable
  EIP=0x009d4a69 EAX=0x36120184 ECX=0x00000000 EDX=0x009e8249 EBX=0x2eccfc98
  ESP=0x074fcf7c EBP=0x36120188 ESI=0x00000000 EDI=0x00000000
  009d4a70  mov ecx, [esi]      <-- faults, ESI = 0
```

`ESI` is set at the entry of vtable slot 7:

```
009d4a38  mov ebx, [esp+0x1c]   ; arg1
009d4a3c  mov eax, [ebx]
009d4a45  mov edi, [eax]        ; edi = **arg1
009d4a62  mov esi, edi
```

so **`ESI = **arg1`**, the same double dereference slot 8's thunk performs. Only
the innermost load is zero: `EBX` (=`arg1`) is `0x2eccfc98` and the `mov
edi,[eax]` did not fault, so `[arg1]` is a valid object and it is that object's
**first field — the list head — that is NULL**.

The caller is a virtual dispatch, and the stack return address names it:

```
009c1b40  mov ecx, [ebx+0x8]     ; items of a {capacity, count, items} container
009c1b43  mov edi, [ecx+ebp*4]   ; edi = items[ebp]
009c1b5a  mov ecx, [esi+0x28]    ; receiver
009c1b5d  mov edx, [ecx]         ; vptr
009c1b62  call [edx+0x1c]        ; slot 7 = 0x9d4a30
```

So the picker loops over `items[ebp]` of a container and asks each element for
its geometry. `[ebx+0x8]` is the same `items` field the grow routine at
`0x9e8200` writes.

### The next suspect, and why the existing diagnostic cannot see it

`0x9e8200` stores `malloc`'s result into `items` **unchecked** at `0x9e824c` and
raises the recorded capacity anyway at `0x9e8250`, so a failed allocation leaves
`items` NULL behind a capacity that says otherwise. The zero `[heap] OOM` lines
do **not** rule that out here: `0x9e821b` calls `0xad425d` → `0xad41b9`, the
demo's own statically linked MSVCRT `malloc`, which suballocates memory it
already owns. `$host_heap_oom_trace` only covers our `$heap_alloc` and is blind
to a guest CRT running out inside its own arena.

`EDX` holding `0x009e8249` at the fault — an address inside that very routine —
is consistent with it having run recently on this stack, though a stale register
is weak evidence on its own.

`0x9e8220` is the call-return landing of that `malloc`, so `EAX` there is every
result the grow path receives. That is one `--trace-at` address (two or more
force `BATCH_SIZE=1` and the run never arrives), and it is the measurement that
decides whether the NULL is an allocation failure our diagnostics cannot see or
something the game never built.

### `--fault-null=stop` is a lottery on this app (run 41, negative)

Run 41 asked the grow-path question with `=stop` still set and never reached the
picker: it trapped at **batch 34226**, during startup, on a probe of address
`0x403` from `eip=0x9e8200`, with the trace-at at `0x9e8220` never firing once.

`=stop` traps on the first fault *anywhere*, and run 39's full census — four
EIPs, none of them `0x9e8200` — shows that startup probe does not even occur on
every run. These runs are not deterministic; `--real-ticks` paces them against
wall clock on a box whose load moves. **Run 40's clean landing on the picker
fault was luck, not method.**

Since the cap landed there is no reason to use `=stop` here at all: plain
`--fault-null` can no longer OOM the host, so the run goes all the way into the
wedge and the exit census gives the totals. Use `=stop` only when the first
fault is known to be the one you want.

## The grow path's malloc never fails (run 42) — hypothesis retired

Run 42 answered the question directly. `--trace-at=0x9e8220` captured every
result the grow routine's `malloc` returned:

```
--- grow-path mallocs: total, then how many returned NULL ---
330
0
```

**330 allocations, none of them NULL.** So the unchecked store at `0x9e824c`
never stores a NULL on this path, and the story that a failed `malloc` leaves
`items` NULL behind a lying capacity — carried since `55d3f714` — is **retired
for the picker**. It remains a real latent bug in the binary; it is simply not
what happens here. Together with the zero `[heap] OOM` lines, allocation failure
is now ruled out at both levels: ours and the guest CRT's.

Hit counts from the same run:

```
0x009e8200 = 1325     (grow routine)
0x009d4a30 = 10       (vtable slot 7)
0x009e17b0 = 303      (the walker)
0x009c1a90 = 1        (the picker loop that calls slot 7)
```

The picker loop runs **once**, and the walker is entered 303 times — 302 of
which return. The 303rd is the one that never does, and it alone accounts for
2,430,389,141 of the run's 2,430,395,741 faults.

### A second faulting site, with attribution caveats

`eip=0x9e8200` faulted 6578 times over `0x0-0xffffffff`, and the printed
samples repeat a short cycle:

```
0x403, 0x3ff, 0x4, 0x0, 0x4, 0x0, 0x4, 0x403, 0x3ff, 0x4, 0x0, ...
```

`0x3ff`/`0x403` are four apart, and `0x0`/`0x4` alternate — two-field reads from
a NULL base, and from a base of about `0x400`. Run 41's trap in the same routine
had `EBP=0x3ff` and `EDI=0x400`: **a small integer near 1024 is being used as a
pointer**, which reads like a count or size fetched from the wrong field.

Treat the 6578 with caution. The block entered at `0x9e8200` contains exactly
one memory read (`mov eax,[esi]` at `0x9e8204`), yet `--count` puts entries at
1325 — fewer than the faults attributed to it. The documented caveat applies:
the reported EIP is the block entry the threaded code last set, not the faulting
instruction, so some of these faults belong to later blocks in the same routine
(the copy loop at `0x9e8230` reads `[ecx+eax*4]` from the *old* items array).
The count/fault mismatch is unexplained and should not be reasoned from until
it is.

### Where the next session should start

The container is the thing to look at, and `0x9c1a90` running exactly once makes
it cheap to catch: `--trace-at=0x9c1a90` prints `EBX`/`ESI` at that single
entry, which gives the concrete container address, and a following
`--input=N:dump-mem:` of `[ebx]`, `[ebx+4]`, `[ebx+8]` says whether `items` is
NULL or whether `items` is valid and its *elements* are. Run 40's registers say
the latter — `arg1 = items[ebp] = 0x2eccfc98` was a valid pointer whose first
field was zero — so the likeliest remaining shape is a container of live objects
that were never initialized, not a container that was never allocated.

## The picker loop, and what the code actually is (runs 43-44)

### The loop

```
009c1ad6  xor ebp, ebp
009c1ad8  cmp [ebx+0xc], ebp        ; count
009c1adb  jle 0x9c1b31
009c1b40  mov ecx, [ebx+0x8]        ; items
009c1b43  mov edi, [ecx+ebp*4]      ; element = items[ebp]
009c1b62  call [edx+0x1c]           ; slot 7
009c1b87  add ebp, 0x1
009c1b8a  cmp ebp, [ebx+0xc]
009c1b8d  jl 0x9c1b40
```

A plain `ebp++` walk of `items[0 .. [ebx+0xc])`. Run 42 counted **10** entries
into slot 7, so elements 0-9 are processed and the **eleventh** is the one that
never returns. Run 43 caught the loop returning with `EBP` = 1, 5, 9 at batches
434575-434577 (`--trace-at` re-arms per batch, so it samples rather than logs
every iteration) and then stops: container `EBX=0x36120780`, receiver
`ESI=0x36120640`, elements at `0x2eccfca8`, `0x2eccfd48`, `0x2eccfda8`. Those
addresses recur across runs — run 40's stack held the same `0x36120xxx` values —
so they can be dumped directly.

### It is Qhull, inside RenderWare Physics

The binary carries

```
@@(#)$Id: //BW2/Libs/THIRDPARTY/Renderware/RWPhysics37.040623/Src/QHull/RwpQHullWrapper.c#3 $
qhull precision error: initial simplex is not convex. Distance=%.2g
qhull precision error: f%d is flipped (interior point is outside)
qhull internal error (qh_infiniteloop): potential infinite loop detected
```

So this whole family is **Qhull**, the convex-hull/Delaunay library, used for
physics hulls. That fits every structural reading so far: `0x9e17b0`'s 64-bit
cross products with a `setge` are an orientation predicate, and it walks a
linked list of facets or vertices to a sentinel. The `{capacity, count, items}`
container grown by doubling at `0x9e8200` has the shape of Qhull's `setT`.
(The specific function identities are inference from shape, not confirmed
against a reference build — the wrapper path and the error strings are the hard
evidence that it is Qhull at all.)

**Why this matters for us specifically: Qhull is precision-sensitive.** Its
whole error vocabulary is about coplanar, concave, flipped and non-convex
results from floating-point comparisons near zero. We emulate x87, so a
difference in precision or rounding is exactly the kind of thing that sends it
down a degenerate path the same input would not take on real hardware — and a
Qhull that bails leaves the sets it was building empty, which is the NULL head
the walker then cannot escape. That the library ships its own
`qh_infiniteloop` detector says the authors knew this failure mode.

No `qhull ... error` text appears in any run's log, but that is weak evidence:
Qhull writes diagnostics to its `qh ferr` stream and the RenderWare wrapper need
not point that anywhere.

**Next measurement:** `--trace-fpu` across the picker. Zero `[fpu]` lines would
say the complaint is not an x87 status read and send the search back to the
object graph; exceptions raised around the wedge would make precision the prime
suspect and give a concrete emulator-side lead.

## The empty list belongs to specific elements, not to the end of the array

Run 46 put one `--trace-at` on `0x9d4a69`, the block entry inside vtable slot 7
where `ESI` already holds `[[element]]` — the list head the walker spins on —
and `EBX` still holds the element itself:

| loop index | element | `[[element]]` |
|---|---|---|
| 1 | `0x2eccfca8` | **0** |
| 5 | `0x2eccfd48` | `0x2eb30300` |
| 9 | `0x2eccfda8` | `0x2eb30f6c` |

Run 40's trap named element `0x2eccfc98` — index 0, sixteen bytes before index
1 — so the first two elements are both empty and elements 5 and 9 are not.

**This retires the off-by-one reading.** The question recorded earlier was
whether the loop bound is larger than the array holds, so that the walk runs off
into uninitialized slots. It does not: the empty elements are at the *front*,
interleaved with populated ones, and the loop bound is never reached because the
wedge happens first. Some elements carry a list and some carry nothing.

`--trace-at` samples once per batch, so those three rows are three different
batches of the same loop; they are not the only elements visited.

**The run is deterministic once it is on this path.** Runs 42 and 46 returned
byte-identical hit counts — `0x9e8200 = 1325`, `0x9c1a90 = 1`, `0x9d4a30 = 10`,
`0x9e17b0 = 303` — and the same element addresses appear in runs 40, 43 and 46.
Only *reaching* the path is unreliable, which is a separate problem (below). So
these addresses can be dumped directly rather than hunted for again.

## Slot 7 dereferences the empty list too — it just survives it

`0x9d4a30` is a do-while: it loads `edi = [[arg1]]`, sets `esi = edi`, and runs
the body before `cmp edi, esi / jnz` can stop it. With an empty list both are
zero, so the loop body reads `[0]`, `[0+8]` and `[0+0x10]` once and then exits
because `edi == esi`. That is exactly the census's small change:

```
[fault]   eip=0x9d4a87 x14 addresses 0x0-0x8
[fault]   eip=0x9d4a69 x6  addresses 0x0-0x10
[fault]   eip=0x9d4abd x2  addresses 0x0-0x0
```

So the empty list is *not* a state this code tolerates by design — on real
hardware those reads are an access violation, not a cheap early exit. Slot 7
merely gets out after one pass, while slot 8's walker (`0x9e17b0`) has no
matching escape and spins. Both read the same field of the same object. The
divergence between a crash and a hang is ours: `$g2w`'s NULL sentinel turns the
faulting read into a zero, and a zero is a valid cursor.

That is worth stating plainly, because it means **the wedge is a symptom with a
one-line description: elements 0 and 1 should have a list and do not.** Nothing
about the walker, the container, the grow path or Qhull's precision needs to be
true for that to be the whole bug.

## Two measurement traps this cost a run each

**`dump-mem` at a pinned batch number cannot tell "not built yet" from
"empty".** Run 45 dumped the picker's container at batches 434570-434580 and got
four pages of zeros. The capture at the profile gate showed why: that run was
still sitting on the "New Profile Name" dialog, 434570 meant nothing in it, and
the container had never been allocated. Zeros from `dump-mem` are an honest
report of an unmapped address — `--dump-vmap` says so in as many words — so
they read exactly like a cleared structure. Every run that pins an input to a
batch number now photographs the gate at batch 400000 first; if the dialog is
still up there, nothing later in that run means anything.

**The click that dismisses the profile dialog is not reliable.** The identical
recipe reached the picker in runs 39, 42, 43 and 46 and stalled at the dialog in
run 45. These runs use `--real-ticks`, so batch numbers drift with host load,
and the box is regularly at load 11. Budget for a re-run rather than reading a
diverged run's output as data.

## The picker's elements decode, and the empty thing is one array slot

Dumping each element at the `0x9d4a69` trace hit (run 47) gives a flat 16-byte
record:

```
0x2eccfc98  08 00 c3 2e | 00 00 00 00 | 02 00 00 00 | 00 00 00 00   id 0   kind 2
0x2eccfca8  30 00 c3 2e | 01 00 00 00 | 02 00 00 00 | 00 00 00 00   id 1   kind 2
0x2eccfcb8  00 00 00 00 | 02 00 00 00 | 04 00 00 00 | 00 00 00 00   id 2   kind 4
0x2eccfd48  c0 01 c3 2e | 0b 00 00 00 | 02 00 00 00 | 00 00 00 00   id 11  kind 2
0x2eccfd58  00 00 00 00 | 0c 00 00 00 | 04 00 00 00 | 00 00 00 00   id 12  kind 4
```

So an element is `{record*, id, kind, 0}`. The pointers are not scattered
allocations: they are an array of **40-byte records at `0x2ec30008 + 0x28*id`**,
and id 11 lands on `0x2ec301c0` exactly. Kind 4 elements carry no record at all
(the pointer is NULL and nothing dereferences it — vtable slot 7 and slot 8 are
only reached for kind 2), which is why a NULL pointer there is not the bug.

That narrows the failure by one more level. The array exists. Record 0 and
record 1 exist and are addressable. Record 11 holds a real list head
(`0x2eb30300`, and id 9's is `0x2eb30f6c`). **Only the contents of records 0 and
1 are missing** — their head word is zero while their neighbours' are not.

Vtable slot 13 (`0x9d47a0`) reads `[[element]+0x24]`, the last dword of the same
40-byte record, so the record is a small fixed struct, not a class with a vptr.
Slot 10 (`0x9d47f0`) is `getVertex(obj, i)`: it walks `[record]` forward `i`
times and returns `[node+8]`. Slot 7 collects consecutive pairs of `[node+8]`
points into 20-byte `{x1,y1,x2,y2,_}` records, so the list is an **edge ring**
and `[record]` is its first node.

**The question is now narrow enough to answer with a watchpoint rather than a
disassembly:** was `0x2ec30008` ever written? Never written means whatever
builds these rings skipped the first two. Written and later cleared means a
lifetime bug, and `--watch-log` times it.

## The record array is a 7000-entry pool, and six of the first thirteen are blank

Dumping 512 bytes at `0x2ec30000` during the picker (run 48) decodes the whole
structure. `0x2ec30000` is the heap block header (`0x000445d8` bytes),
`0x2ec30004` is the entry count (`0x1b58` = 7000), and the records start at
`0x2ec30008` with a `0x28` stride — which is exactly the
`element->record = 0x2ec30008 + 0x28*id` arithmetic the elements show, so the
records are **indexed by element id, not allocated per element**.

`0x9d7690` builds these blocks: it calls `malloc(count*40 + 4)`, stores the
count at `+0`, takes the array at `+4`, appends the block to a vector of blocks,
and then links every record's first field to the next record `0x28` along,
terminating the last one with zero (`0x9d7708`). So the first field doubles as a
free-list `next` while a record is unused and as the edge-ring head once it is
in use, and **a zero there is also what the tail of the free list looks like**.

A filled record is `{listHead, 0, element*}`: record 11 at `0x2ec301c0` holds
head `0x2eb30300` and back-pointer `0x2eccfd48`, which is element id 11's own
address. Across ids 0..12:

| | ids |
|---|---|
| filled | 3, 4, 7, 9, 10, 11, 12 |
| empty | 0, 1, 2, 5, 6, 8 |

**Record 0 was never written as a record at all.** Its `+8` — the slot that
holds the element back-pointer in every filled record — is `0x44bb8000`, the
float `1500.0`, repeated across `+8`..`+0x1c`. That is not a cleared record;
it is a record that something else's data is sitting in.

So the earlier reading of run 48's watchpoint sequence
(`0 → 0x2ec30030 → 0x2eb30058 → … → 0x2eb30710 → 0`) as "built then cleared" is
wrong, and is retracted: `0x2ec30030` is `record0 + 0x28`, which is precisely
what `0x9d7690`'s initializer writes, and the later values are all in a second
pool block (`0x2eb3xxxx`). That is free-list churn passing through record 0's
`next` field, not an edge ring being pushed. The final zero is record 0 becoming
the free-list tail again.

**Elements 0 and 1 are the anomaly, and it is a straightforward one:** they are
kind 2, so slot 7 and slot 8 both dereference their record, and their record was
never filled. Kind 4 elements (ids 2 and 12) carry a NULL record pointer instead
and are never dereferenced at all, so the blank records at those ids are
expected.

**A caution on the watchpoint's EIP.** `--watch` reports the block the guest was
in when the change was observed, and that is only the writing block when the hit
ends the batch. Run 49 filtered to the write of zero and reported
`EIP=0x9e1804 ... EAX=0 ECX=0 EDX=0 EBX=0 EBP=0 ESI=0 EDI=0` — every register
zero, inside the walker, which is the wedge's own steady state. The walker's
only store is `mov [esp+0x14], eax` to a stack local, so it cannot have been the
writer. Read a watch EIP as "where execution was", and corroborate it against
what the named instruction actually writes before believing it.

## The walker has no entry guard, so an empty list cannot be the wedge

The reading above — "elements 0 and 1 are kind 2, their record was never
filled, slot 7 survives the empty list and slot 8 spins on it" — names the
right elements and the wrong mechanism, and the second half is retracted.
Disassembling the walker's prologue is enough to see why:

```
009e17b0  sub esp, 0xc
009e17b3  mov eax, [esp+0x14]      ; arg2
009e17b7  mov ecx, [eax+0x4]
009e17ba  mov eax, [eax]
009e17bc  mov edx, [esp+0x10]      ; arg1 -> edx, the cursor
009e17c0  push ebx / push ebp / push esi
009e17c3  mov [esp+0x20], ecx
009e17c7  mov [esp+0xc], eax
009e17cb  push edi
009e17cc  lea esp, [esp+0x0]       ; padding, falls straight through
009e17d0  mov eax, [edx+0x8]       ; <-- loop body, no test of edx first
...
009e1822  mov edx, ebx             ; ebx = [edx], the next link
009e1827  cmp [esp+0x20], edx
009e182f  jnz short 0x9e17d0
```

There is no `test edx,edx` anywhere between the entry and the loop body: the
prologue loads, pushes and falls through. So this is a do-while over a
**circular** list, and the terminator it compares against is the head it was
handed. Which settles the empty case: with head `0`, the first body pass reads
through the NULL sentinel, `ebx = [0] = 0`, `edx = 0`, and `cmp head, edx`
compares `0` with `0` — equal, so `jnz` is not taken and the walker *returns*.
An empty list exits immediately here, exactly as it does in slot 7.

**A spin therefore requires a non-zero head whose chain reaches zero** — a list
that is truncated rather than empty, whose last node's `next` was never pointed
back at the head. The run's own fault census agrees: `eip=0x9e17d0` faults at
addresses `0x0`-`0x8`, which is `[edx+8]`, `[edx]`, `[eax]`, `[eax+4]`, `[ebx+8]`
and `[ecx]` with `edx = 0`, i.e. the cursor is NULL *inside* the walk while the
head that terminates it is not.

That also explains why a NULL cursor is fatal here and harmless on real
hardware in the other direction: on a real CPU `mov eax,[edx+8]` with `edx = 0`
is an access violation and the game would crash, so the truncated list is a bug
the game never sees on Windows. Under `$g2w`'s NULL sentinel the read returns
`0`, the link stays `0`, and the exit test never matches the non-zero head —
[the sentinel converts an access violation into an infinite loop](#).

## --fault-null reports the block entry, not the faulting instruction

Three of the five EIPs in run 51's fault census look impossible until you know
this, and then they decode exactly. `0x9d4a69` is `mov eax, [esp+0x30]`, a
stack access that can never be unmapped — but it is the *entry* of the block
that continues into slot 7's loop head, and the addresses the census reports
for it are `0x0`, `0x4` and `0x10`:

```
009d4a70  mov ecx, [esi]           ; esi = 0   -> 0x0
009d4a72  mov edx, [ecx+0x4]       ; ecx = 0   -> 0x4
009d4a75  mov ecx, [edx+0x10]      ; edx = 0   -> 0x10
```

Three dereferences, three reported addresses, in order. Likewise `0x9e17d0`'s
`0x0`-`0x8` is the walker body with a NULL cursor. So read a `[fault]` EIP the
way you now read a `--watch` EIP: it names the block, and the instruction is
somewhere inside it. Counting the memory accesses in that block against the
fault count is worth doing — where the two disagree, the block is not the one
the linear disassembly suggests.

## The element↔record pairing is computed, and the build pass disagrees with it

Run 51 captured the whole element array and the whole head of the record pool
in the same `--trace-at` hit, so for the first time the two can be read against
each other instead of one at a time. Elements are 16 bytes at `0x2eccfc98`,
`{record*, id, kind, 0}`, with `id` simply ascending; pool records are `0x28`
apart from `0x2ec30008`.

The pairing is **arithmetic, not allocation**: every kind-2 element's `record*`
is exactly `0x2ec30008 + id*0x28`, checked on all seven of them. So "record
index == element id" is a fact here, not an inference, and a blank record is
not an unallocated one — the pool is preallocated at startup (7000 entries,
from the init at `0x9d79f0`), and the record for element *i* exists whether or
not anything ever filled it.

Reading the two arrays against each other splits the records almost perfectly
*against* the element kind:

| records | `+8` back-pointer | element kind | element's `record*` |
|---|---|---|---|
| 2, 3, 6, 7, 12 | set (built) | 4 | NULL — never read |
| 0, 1, 4, 14 | zero (never built) | 2 | points straight at the record |
| 9, 10, 11 | set (built) | 2 | points at it — consistent |

Two earlier readings die here:

- **"Kind 4 elements carry a NULL record pointer and are never dereferenced, so
  the blank records at those ids are expected"** is retracted. It has it
  backwards: the records that *were* built are mostly the ones belonging to
  kind-4 elements, which nothing will ever read, while the records that kind-2
  elements point at are mostly the blank ones.
- The filled/empty id list from the previous session (`filled 3,4,7,9,10,11,12`)
  was read off record heads alone and is right about the heads, but it was
  matched to the wrong elements. Record 4's head is set while its back-pointer
  is zero; record 2's back-pointer is set while its head is zero. Head and
  back-pointer are written by different things and must be read separately.

So the wedge is not one element being special. **The build pass and the read
pass disagree about which elements matter**, and the walker dies on a record
the build pass skipped. Whether record 1 was never written or was written and
then lost is the next thing to measure — and note that neither `--watch`'s EIP
nor `--fault-null`'s can answer *who*, so the question to ask of a run is when
a write lands, not where it came from.

## How far it actually gets, and what the wedge is not

Worth stating plainly, because "wedged in a geometry walker" undersells it: the
software-renderer probe now gets **past the main menu and into the
land-selection screen**. Run 51's gate capture at batch 400000 is the profile
menu with the world map drawn and "New Game" highlighted, and its final frame
is the land-selection screen — a rendered Greek village on fire with a
filmstrip of eight island thumbnails along the bottom. The renderer is not the
problem here.

That reframed the wedge as possibly a *hover* path: every run so far had parked
the cursor at (250,277), in the middle of the rendered scene, and the picker
(`0x9c1a90`) is the kind of query a mouse-over drives. If so, clicking a
filmstrip thumbnail instead would never run it, and would reach gameplay with
no source change — which matters, because a rebuild is not available while
other agents hold `src/` dirty and `--no-build` is mandatory.

**That is wrong, and run 53 settled it.** With Enter pressed 25000 batches
earlier and the cursor parked on the filmstrip rather than the scene, the hit
counts came back byte-identical to runs 42, 46, 47 and 51:

| probe | hits |
|---|---|
| `0x9e8200` vector grow | 1325 |
| `0x9c1a90` picker | 1 |
| `0x9d4a30` slot 7 | 10 |
| `0x9e17b0` walker | 303 |

The run never advanced far enough to write the capture scheduled 20000 batches
after the Enter, so the wedge happens on *entering* land selection, before any
click can be delivered. The picker runs exactly once, the walker 303 times, and
the guest stops — the same way, in the same place, whatever the cursor is doing.

So the sequence is fixed: entering land selection runs the build, the build
leaves a list the walker cannot terminate on, and no input schedule routes
around it. Reaching gameplay needs the underlying defect fixed, not avoided.

**One caution for whoever picks this up.** `--trace-at`'s register dump is
taken at the breakpoint, so it is contemporaneous with the hexdump beside it
(`test/run.js` takes both in the same block) — but the registers are whatever
the *paused* instruction sees, not what an earlier instruction loaded. At
`0x9d4a69` I read `EAX` as `element->record` from `mov eax,[ebx]` eight
instructions back and built a translation-divergence theory on it; `xor eax,eax`
clears it at `0x9d4a4a` and `call 0x9d6600` returns into it, so `EAX` there is
the resize's return value and the theory was about nothing. The register that
does survive is `EDI`, loaded once at `0x9d4a45` — and it confirms the dump
exactly: element 11's `EDI` is `0x2eb30300`, which is the head the hexdump
shows at `0x2ec301c0 = 0x2ec30008 + 11*0x28`, and element 1's is `0`, matching
its record. Check which instruction last wrote a register before reading
meaning into it.

## The walker returns 303 times; a spiral search calls it, and only the last call hangs

Tracing the walker's own entry (`0x9e17b0` is a function entry and so a legal
`--trace-at` point, and at entry the stack still holds the arguments) changed
the shape of this problem. The walker is not stuck inside one call for the
whole run. It is called, it returns, and it is called again:

```
#14 EAX=0x2eb30990 EDX=0x2ec30620 ESI=0x0177c660 EDI=0x00000001  [esp+4]=0x2eb30990
#15 EAX=0x2eb30990 EDX=0x2ec30620 ESI=0x0177c680 EDI=0x00000001  [esp+4]=0x2eb30990
#16 EAX=0x2eb30990 EDX=0x2ec30620 ESI=0x0177c660 EDI=0x00000002  [esp+4]=0x2eb30990
#17 EAX=0x2eb30990 EDX=0x2ec30620 ESI=0x0177c680 EDI=0x00000002  [esp+4]=0x2eb30990
```

Same list every time; `ESI` cycles a small table (`0x177c658`, `660`, `670`,
`680`, `690`) and `EDI` climbs in pairs. That is the spiral at `0x9c4f87`
(`mov esi, 0x177c658`) sweeping outward, calling slot 8 as a predicate — the
call site is `call [eax+0x20]` followed by `test al,al` — and getting false
back each time. Two heads dominate: `0x2eb30990` (38 of the traced calls) and
`0x2eb30ff8` (25).

So `0x9e17b0 = 303` is 303 completed predicate evaluations, not one long hang,
and **only the final call fails to return**. `--trace-at` re-arms once per
batch, so the last traced entry is the batch the guest never left, and it names
the offender exactly:

| | |
|---|---|
| head (arg1, after slot 8's thunk substitutes `[[arg1]]`) | `0x2eb30ff8` |
| record (`EDX`) | `0x2ec30ad0` |
| spiral counter `EDI` | `0xc` |

`0x2ec30ad0` is `(0x2ec30ad0 - 0x2ec30008) / 0x28` = **record 69**. That
retires blank records 0 and 1 as the story: the element array runs far past the
sixteen entries decoded above, and the wedge is nowhere near them. It also
explains the harmless part of the fault census — the walker is a do-while, so a
genuinely empty list executes the body once, faults on `[0]`/`[0+4]`/`[0+8]`,
then exits because `head == edx == 0`. Those single faults are the empty
records; the 937 billion are one call that cannot leave.

Why that one cannot leave follows from the loop shape already established: the
exit test is `cmp head, edx` after `edx = [edx]`, `head` is non-zero here, and
the census puts the faults at `edx = 0`. A zero cursor never equals a non-zero
head, so **the chain from `0x2eb30ff8` contains a node whose next pointer is 0**
— the ring does not close and the walk runs off the end.

Node layout, read off a healthy chain (element 11's, at `0x2eb30300`) at a
20-byte stride, which decodes cleanly and agrees with slot 10's
`mov eax,[eax]` / `mov eax,[eax+8]` idiom:

```
+0x00  next        +0x04  prev       +0x08  point*
+0x0c  ?           +0x10  owner record*   <- matches the record the head came from
```

## The ring is open, and that is only fatal when the answer is "inside"

The previous section predicted a node with `next == 0` in the chain from
`0x2eb30ff8`. Dumping the node pool (`--dump=0x2eb30000:32768`, which covers
every link address seen) and walking it by pointer confirms it, and the chain is
short:

```
0x2eb310c0 -> 0x2eb305a8 -> 0x2eb30ff8 -> 0x2eb307d8 -> NULL
point:      0x2ec747a8    0x2ec7479c    0x2ec74790    0x2ec74784
```

Four consecutive point objects 12 bytes apart — a quadrilateral whose last edge
is missing. The head the thunk hands the walker is the *third* of the four, so
the walk reaches the open end after two hops.

**Read only `+0x00` (next) and `+0x08` (point) as known.** The earlier guess of
`+0x04 prev` / `+0x10 owner` does not survive a pool-wide audit: forward chains
routinely walk far past the node count of the record at `+0x10` (39 hops for 7
nodes), and 548 nodes have `next->prev != self`. Those two offsets are
retracted. The walker itself only ever dereferences `+0` and `+8`, so those are
the only fields with ground truth behind them.

### Why an open ring is usually harmless

Disassembling the whole loop shows the walker is a **convex point-in-polygon
test**, not a plain list walk. Per edge it takes vertex `A = [[edx+8]]` and
`B = [[edx]+8]`, forms two cross products, and `setge al`. The bottom is:

```
009e1820  test ecx, ecx
009e1822  mov edx, ebx            ; edx = next
009e1824  setge al
009e1827  cmp [esp+0x20], edx     ; <- the HEAD, see the slot note below
009e182b  jz short 0x9e1831       ; wrapped: done
009e182d  test al, al
009e182f  jnz short 0x9e17d0      ; still inside: keep going
```

So there are **two** exits: the ring closed, or the point fell outside an edge.
A point that is outside leaves on the first failing edge and never reaches the
open end — which is exactly why 303 calls returned and only the 304th did not.
An open ring is a latent defect that fires only when the query answers "inside".

`[esp+0x20]` really is the head, and the arithmetic is worth writing down
because two different slots alias to `0x20` at different depths. After
`sub esp,0xc`, arg1 sits at `[esp+0x10]` and arg2 at `[esp+0x14]`. At
push-depth 3, `mov [esp+0x20],ecx` writes the **arg2** slot (stashing the
point's y). One more `push edi` later, at push-depth 4, `cmp [esp+0x20],edx`
reads one slot lower — the **arg1** slot, the original head. The same
arithmetic independently checks out on `[esp+0x24]` (= y) and `[esp+0x10]`
(= x) inside the body.

The caller's arg2 is `lea esi,[esp+0x18]`, a stack `{x,y}` pair, not a list
record — so there is no "end sentinel" reading available. The terminator is the
head and nothing else.

### Why this has to be our bug

With `edx == 0` every load returns the NULL sentinel's zero, so `ecx` ends at 0,
`setge` makes `al = 1`, and `cmp head, 0` is never equal. **Both** loop
conditions are permanently true. On real hardware the same open ring takes an
access violation at `[0+8]` instead, so the shipped game cannot be walking an
open ring here — a write that closes it is going missing on our side. The node
pool itself is mapped (we just dumped 32KB of it), so the store is not vanishing
into the sentinel at the node.

The walker has exactly one entry point — `xrefs` and `find-refs` both report a
single reference, the slot-8 thunk `0x9d47b0` — so `head = [[element]]` =
`record->head`, and `[record+0]` has one known writer (`0x9c1b04`,
`mov [edi],eax`) and one known eraser (`0x9c0c50`, `mov dword [ecx],0`).

### Retracted along the way

`0x9e8200` (the vector grow) faults 6578 times against 1325 entries, and
`1325 x 5` derefs `= 6625` is tempting — but the printed addresses refute
"every grow has an unmapped `this`". They are small structured integers
(`0x0, 0x4, 0x3ff, 0x403, 0x1b57, 0x1b5b, 0x1f3f, 0x1f43`) repeating in a
7-per-cycle pattern, not garbage pointers. Note `0x3ff`, `0x1b57`, `0x1f3f` are
`1024-1`, `7000-1`, `8000-1`, and 7000/8000 are two of the pool capacities from
`0x9d79f0` — capacity *values* being used as addresses. Only the first 64 faults
per EIP are printed, so this sample may be startup traffic unrelated to the
wedge. Unresolved, and deliberately not on the critical path.

## The nodes are half-edges, and the layout retraction above is itself retracted

`0x9de000` and `0x9de030` are the node constructors. Both take a node from the
30000-entry pool at `0x177c940` and zero all five fields; `0x9de030` then sets
`+8` to its argument:

```
009de030  mov ecx, 0x177c940
009de035  call 0x9de0a0          ; pool alloc
009de044  mov [eax], ecx         ; +0x00 = 0
009de046  mov [eax+0x4], ecx     ; +0x04 = 0
009de049  mov [eax+0x8], edx     ; +0x08 = the point argument
009de04c  mov [eax+0xc], ecx     ; +0x0c = 0
009de04f  mov [eax+0x10], ecx    ; +0x10 = 0
```

The pool's element size is confirmed by its constructor `0x9d77d0`:
`lea eax,[ebx+ebx*4]` then `lea ecx,[4+eax*4]` = `20*count + 4`, and the array
base is `malloc+4` (the header dword holds the count). Every node address seen
is `≡ 8 (mod 20)` from `0x2eb30000`, consistently.

`0x9e1670` is the builder — a half-edge mesh split. It allocates four nodes
(four `call 0x9de030` in a row) and wires them into a doubly-linked circular
list, then walks the ring to stamp the face pointer:

```
009e16f1  mov [ebp+0x0], edi      ; next
009e16f4  mov [edi], ebx          ; next
009e16f6  mov [ebp+0x4], edx      ; prev
009e1700  mov [ecx], eax
009e1702  mov [eax], esi
009e170b  mov [eax+0x4], edi      ; prev
...
009e1730  mov [eax+0x10], ebp     ; face
009e1733  mov eax, [eax]
009e1735  cmp eax, esi
009e1737  jnz short 0x9e1730
```

So the layout is `+0x00 next, +0x04 prev, +0x08 point*, +0x10 face*` after all.
**The retraction in the previous section was wrong and is withdrawn.** The
pool-wide audit that motivated it compared a ring's length against the nodes
carrying that face *within a 32KB dump of a 600KB pool*; rings whose other nodes
fall outside the window read as absent, which is what produced "39 hops for 7
nodes" and 548 apparent `next->prev != self`. A windowing artifact, not a layout
error.

### What that says about the open node

Note `0x9e1730`'s loop has the same shape as the walker and terminates *only* by
closing the ring — and it is what writes `+0x10`. The dead node `0x2eb307d8`
carries `+0x10 = 0x2ec30ad0`, the wedging face. So it was a member of a closed
ring when that stamp was written, and its `next` went to zero **afterwards**.

That rules out "the builder never finished" and points at a node being released
— or re-constructed — while still reachable from `0x2eb30ff8`. Its surviving
state fits a fresh constructor exactly: `+8` holds a point, `+0` and `+0xc` are
zero. The free path to examine is `0x9de220`, called twice at the tail of the
builder (`0x9e173d`, `0x9e1746`).

## The ring was built correctly, then broken one batch later

Watching the dead link itself (`--watch=0x2eb307d8 --watch-log`) gives its whole
life history, and it overturns the "never linked" reading:

| batch | old | new | note |
|---|---|---|---|
| 435416 | `0x00000000` | `0x2eb307ec` | pool ctor threading the free list — `ESI=0x177c940`, `EBX=0x7530`, `+20` stride |
| 435420 | `0x2eb307ec` | `0x2eb30fa8` | |
| 435421 | `0x2eb30fa8` | `0x2eb310c0` | **ring closed** — `0x2eb310c0` is the first node of run 57's walk |
| 435422 | `0x2eb310c0` | `0x00000000` | **broken** |

At batch 435421 the ring is complete and consistent with the walk:
`0x2eb307d8 -> 0x2eb310c0 -> 0x2eb305a8 -> 0x2eb30ff8 -> 0x2eb307d8`. One batch
later the closing link is zero. So this is not a build that stopped short — the
quadrilateral was correct and something unlinked it.

Two suspects die here. `0x9c0c50`, the reset that zeroes `[ecx]`, has a hit
count of **0** for the whole run. And re-construction is out: `0x9de000`/
`0x9de030` zero `+0x04` as well, but the dead node still carries
`+0x04 = 0x2eb30fe4` at exit. Something wrote **only** the next field.

### The watchpoint's EIP does not name the writer

Worth knowing before trusting any `--watch` output: `checkWatchpoint(batch)` is
called once per **batch** (`test/run.js:8890`), so the `EIP:`/`prev_eip:` it
prints is wherever the guest happened to sit at the batch boundary — not the
storing instruction. The comment at `test/run.js:4945` ("The writer's registers
name the source of a bad store") describes an intent the per-batch call site
does not deliver.

That is exactly how run 58 came to report `EIP=0x009e1811` with every register
zero for the fatal write. `0x9e1811` is inside the walker's null spin, and the
walker's only store targets its own stack frame — it cannot be the writer. The
reading is an artifact of sampling at a batch boundary.

The harness can be made to answer properly without touching WASM:
`--input=B:set-batch-size:1` (run.js:1736, 7822) makes a batch exactly one
block, so the check runs per block and `prev_eip` names the block that just
stored. The distortion has to be checked rather than assumed — the headless
clock is `batch * TICK_MS_PER_BATCH`, so guest time races ahead at one block per
batch — and the determinism fingerprint is the guard: every run from 42 onward
reports `0x9c1a90 = 1` and `0x9e17b0 = 303`.

### Correction: the watchpoint EIP *is* meaningful, and that makes it evidence

The previous section called the watchpoint's EIP a batch-boundary artifact. That
is wrong and is withdrawn. `--watch` is not JS sampling: `src/13-exports.wat`
lines 96-102 compare the watched location at **every block dispatch** and
`br $halt` the instant it differs, ending the batch right there. JS's once-per-
batch `checkWatchpoint` is precise enough precisely because the batch was cut
short. So `prev_eip` names the block that just ran and `EIP` the block about to
run.

Which turns the reading into a problem rather than an excuse. For the fatal
write the harness reports:

```
435422  0x2eb310c0 -> 0x00000000   EIP: 0x009e1811  prev_eip: 0x009e1804
```

`0x9e1804` is `cmp [esp+0x14],eax` / `jbe 0x9e1811` — a two-instruction block
inside the walker with **no store in it**, and the walker's only store in the
whole function (`mov [esp+0x14],eax` at `0x9e17e9`) targets its own stack frame
at `ESP=0x074fcee8`. The block that immediately preceded the change cannot have
written the node.

An unmapped-region explanation is available but does not survive the fault
census: if `0x2eb307d8` had stopped translating, the walker's own read of
`[edx]` would fault at `0x2eb307d8`, and the census for `eip=0x9e17d0` spans
only `0x0-0x8`. The address is mapped and the zero is a real value in memory.

So the change was not made by the block that preceded it. The open
possibilities are a write from another thread's slice, a host-side write, or a
remap — and the next probe should photograph the whole node immediately after
the change rather than reason further from the link alone.

## B&W2 is multithreaded, which resolves the no-store prev_eip

The contradiction above dissolves once the thread picture is read off the run
log: **B&W2 spawns five guest threads**, all still active at exit.

```
[ThreadManager] CreateThread handle=0xe1000..0xe1004 start=0x899ab0
[ThreadManager] Spawned thread 1..5 EIP=0x899ab0
Threads (final state):
  T1 h=0xe1000 state=active eip=0x881760 waitH=0xe0004 csPark/steal=0/0
  T2 h=0xe1001 state=active eip=0x881760 waitH=0xe0005 csPark/steal=0/0
  T3 h=0xe1002 state=active eip=0x89d1dc waitH=0x0   csPark/steal=2680/0
  T4 h=0xe1003 state=active eip=0x881760 waitH=0xe000c csPark/steal=0/0
  T5 h=0xe1004 state=active eip=0x881760 waitH=0xe0013 csPark/steal=0/0
```

So the walking thread is not the only writer in the machine. A store from
another thread's instance does not halt main's instance at the store; main
notices at its *next* block — which is the walker. That is exactly the shape of
`prev_eip = 0x9e1804`, a block with no store in it.

This is consistent with the structures being lock-protected by design: the node
pool allocator `0x9de0a0` opens with `call [0xc12178]` on section `0x1d90330`,
and `0x9c1400` takes one too. Rings that are mutated under a critical section
are rings more than one thread touches.

The log also carries a critical-section fault:

```
critical sections: 1 parked Enter(s) ABANDONED — the guest was dispatched
  elsewhere (last at 0x075005c8) with the call's frame still on the stack
critical sections: main parked 1x, stole 0, barged 0, released 0 it did not own
```

**Do not read that as the root cause yet.** The main thread is wedged inside the
walker and may well be holding that section, in which case T3's 2680 parks and
the abandoned `Enter` are a *consequence* of the wedge rather than its cause.
Establishing direction needs the abandonment placed before or after batch
435422, which the exit-time summary does not say.

`thread-manager.js:2527-2541` already surfaces a worker-side hit as
`[ThreadManager] T<n> WATCH ...` with that thread's own registers, and
`set_watchpoint` is in `INHERITED_WASM_GLOBALS` (`lib/worker-imports.js`), so
thread instances inherit the address when they spawn. Run 58 printed no such
line — but the threads spawn during startup, so arm-before-spawn ordering has to
be confirmed before that silence counts as evidence.

## `next == 0` is the signature of a FREED node, not a corrupted link

The node release `0x9de060` settles what a zero next pointer means here:

```
009de060  push esi
009de061  mov esi, ecx
009de063  test esi, esi / jz done
009de067  push 0x1d90330
009de06c  call [0xc12178]          ; EnterCriticalSection
009de072  mov eax, [0x177c94c]     ; free-list head
009de077  mov [esi], eax           ; node->next = free-list head
009de079  sub dword [0x177c950], 1 ; pool count--
009de085  mov [0x177c94c], esi     ; free head = node
009de08b  call [0xc1217c]          ; LeaveCriticalSection
```

Freeing a node **writes its `next`** to the old free-list head, which is `0`
when the free list is empty. So `next == 0` is not a broken link — it is what a
freed node looks like. And `0x9de1f0` is a whole-ring teardown built on it:

```
009de200  mov esi, [ecx]        ; save cur->next
009de202  call 0x9de060         ; release cur
009de207  cmp esi, edi
009de209  mov ecx, esi
009de20b  jnz short 0x9de200
009de20f  mov dword [ebx], 0x0  ; clear the head pointer
```

This reframes the whole wedge. The walker may not be walking a broken polygon at
all — it may be walking the **free list**, having been handed a head that was
already returned to the pool. A free list terminates at 0, which is exactly the
"ring that never closes". The very first write the watchpoint saw supports this:
`0 -> 0x2eb307ec` from the pool constructor at `0x9d7830`, a `+20` step, is
free-list threading.

It also explains, without special pleading, why `prev_eip` never named a storing
block in runs 58 and 60: the free happened well before the halt, so no block
adjacent to the change stored anything.

### Corrections this supersedes

- The cross-thread reading is **withdrawn**. Run 60 armed the watch before the
  threads spawn (`set_watchpoint` is in `INHERITED_WASM_GLOBALS`) and produced
  **no** `[ThreadManager] T<n> WATCH` line, and `--trace-sched` shows T1/T2/T4/T5
  parked on wait handles for the entire run with T3 pinned at `0x89d1dc`
  "unchanged for 50000 batches". No guest thread was mutating geometry.
- Attribution via `prev_eip` is **not reliable here** and the earlier claim that
  it names the storing block is withdrawn as applied to this case. None of the
  four recorded `prev_eip` blocks contains a store to the node — including
  hit #2, whose `EIP=0x9de220` store targets `ECX=0x2ec30468`, a face record,
  not the node.

### The test

Decidable offline from one dump: if the chain is the free list, then
`0x2eb310c0`, `0x2eb305a8`, `0x2eb30ff8` and `0x2eb307d8` are reachable by
following `+0` from the free-list head at `[0x177c94c]`. If they are not, the
free-list reading is wrong and the ring really was corrupted in place. The pool
object at `0x177c940` carries the free head at `+0xc` and the live count at
`+0x10`, so a 64-byte dump reads both directly.

Note the free path takes critical section `0x1d90330` — the same section behind
the "parked Enter ABANDONED" line — so if the free-list reading holds, that
abandonment becomes worth timing properly rather than dismissing.

## Refuted: the chain is not the free list

Dumping the pool object settles it. `0x177c940` reads:

```
+0x00 0x00000001   +0x04 0x00000001   +0x08 items 0x489d9f90
+0x0c FREE HEAD 0x2eb33168    +0x10 count 0x1c0 (448)    +0x14 max 0x7530 (30000)
```

(The `+0xc` free head and `+0x10` count match what `0x9de060` and `0x9de0a0`
address as `[0x177c94c]` and `[0x177c950]`, so the field reading is confirmed by
two independent uses.)

Walking that free list — run 61's head spliced into run 57's pool image, sound
because the path is deterministic and both runs report `0x9e17b0 = 303` /
`0x9c1a90 = 1`, but a cross-run splice and labelled as one — gives a clean
14-node list terminating at 0, and **none of `0x2eb310c0`, `0x2eb305a8`,
`0x2eb30ff8`, `0x2eb307d8` is on it**.

So the previous section's hypothesis is **withdrawn**. Supporting counts from
the same run: `0x9de1f0` (whole-ring teardown) ran **0** times, and `0x9de060`
(single-node release) ran 290 times. A node freed and left freed would be on
that list; ours is not.

### What that leaves

The dead node is "live" by the pool's own bookkeeping, and only its `+0x00`
is wrong. Its neighbours are intact and sensible — `+0x08 = 0x2ec74784` is a
point 12 bytes from the previous node's, `+0x10 = 0x2ec30ad0` is the wedging
face — which argues against a blind aliasing write (a stray `memcpy` would
rarely land one dword and stop). A single dword set to exactly zero, in exactly
the `next` slot, still looks like deliberate unlink code.

Every cheap suspect is now eliminated by a hit count or by the dump:

| suspect | verdict |
|---|---|
| `0x9c0c50` reset (`mov [ecx],0`) | 0 calls |
| `0x9de1f0` ring teardown | 0 calls |
| node free `0x9de060` | 290 calls, but node is not on the free list |
| re-construction `0x9de000`/`0x9de030` | would zero `+0x04`; it holds `0x2eb30fe4` |
| another guest thread | run 60: no per-thread watch hit, all others parked |
| the walker's own adjacent block | `0x9e1804` is `cmp`/`jbe`, no store |

One re-allocation path is *not* yet excluded and fits the evidence: freed while
the free list was empty (`next = 0`), then popped again (`head = node->next = 0`,
so the list empties cleanly and the node is live again), re-constructed, and
partially re-linked — while the stale ring node `0x2eb30ff8` still points at it.
That is a use-after-free of the ring, and it predicts `0x9de0a0`'s pop path runs
between the two events. Testing it needs the *sequence* of frees and allocations
around batch 435422, not another exit-time snapshot.

## One boot, many questions: the wedge is now interactive

Every finding above cost a fresh 800-second run, because the wedge lands around
guest batch 435420 and nothing survives the process. That is the wrong shape for
an investigation that asks one small memory question at a time.

It is also unnecessary. `tools/black-white-software-probe.js` already passes
`--control-stdin` down to `test/run.js`, and run.js's control loop has an `eval`
action (`test/run.js:5393`) whose body runs inside the host process with
`instance`, `exports`, `renderer`, `memory`, `g2w`, `tickState` and `ctx` in
scope. The guest wedges *inside a loop*, not inside a single WASM call — the
walker's block retires normally and the batch returns on budget — so control
commands keep being serviced while it spins.

So: boot to the wedge **once**, keep the process parked there, and read any
guest address in milliseconds for the rest of the session.

```
scratchpad/bw-live.sh   # the long-lived probe, stdin from a held-open fifo
scratchpad/ask.sh '<js expression>'   # one question, one [ctl] reply line
```

`ask.sh` blocks on `tail -f | grep -m1` rather than polling. The plumbing was
verified end to end against notepad (a few seconds to boot) before spending the
B&W2 boot on it: two independent questions came back against one live guest, the
second one reading `0x905a4d` — the `MZ` header — straight out of `memory` at
`g2w(0x400000)`.

What this does **not** do is answer questions about history. A write that
happened at batch 435422 is gone by the time the process parks, so the watch and
trace channels still have to be armed up front; the live session carries them
(`--watch=0x2eb307d8 --watch-log`, `--trace-at=0x9de060`) so it is a superset of
a one-shot run rather than a replacement for one.

## Refuted: the node was never freed, and the pool is not involved at all

Run 62 armed the two channels that between them cover the whole pool: a
`--trace-at=0x9de060` on the node release (`ECX` is the node being released, so
every free is named) and a `--watch=0x177c94c --watch-log` on the free-list head
itself (so every push and every pop is one timestamped event).

The answer is flat:

```
--- were any of the four ring nodes freed? ---
  0x2eb310c0: 0 free(s)
  0x2eb305a8: 0 free(s)
  0x2eb30ff8: 0 free(s)
  0x2eb307d8: 0 free(s)
```

290 frees, 145 of them logged with batch numbers, and not one of them is a node
of the wedging ring. The "freed while the free list was empty, then popped
again" story required `0x2eb307d8` to pass through `0x9de060`, and it never
does. Every pool suspect is now eliminated:

| suspect | verdict |
|---|---|
| `0x9c0c50` reset (`mov [ecx],0`) | 0 calls |
| `0x9de1f0` ring teardown | 0 calls |
| node free `0x9de060` | 290 calls, **none of them this node** |
| re-construction `0x9de000`/`0x9de030` | would zero `+0x04`; it holds `0x2eb30fe4` |
| another guest thread | run 60: no per-thread watch hit; all others parked |
| the walker's own adjacent block | `0x9e1804` is `cmp`/`jbe`, no store |
| blind aliasing write | neighbours `+0x04`/`+0x08`/`+0x10` all intact |

So the zero at `0x2eb307d8+0` did not come from the pool, from the ring's own
teardown, or from another thread. The list of things the *guest* could have done
is empty, which moves the weight decisively onto the remaining possibility: the
store that landed there is ours — a store whose effective address the emulator
computed wrongly. That also explains the finding we could not place, that none
of the four recorded `prev_eip` blocks contains a store to this node: if the
address is wrong, the block *does* have a store, and a disassembly of it points
somewhere else entirely.

### The wedge is at batch 435909, ~490 batches after the break

One of the 145 free-list changes is not like the others. Every push in the log
reports `EIP: 0x009de091 prev_eip: 0x009de072` — inside the release function.
The last one, at batch 435909, reports:

```
*** WATCHPOINT hit at batch 435909: [0x0177c94c] changed
  Old: 0x2eb33154  New: 0x2eb33168  EIP: 0x009e1820  prev_eip: 0x009e1817
```

`0x9e1820` (`test ecx,ecx`) and `0x9e1817` (`cmp eax,[esp+0x14]`) are both
inside the walker. The WASM watch notices a change at the *next* block
dispatch, so this is the ordinary free of `0x2eb33168` — the value matches
run 61's surviving free head exactly — observed from the first walker block that
ran after it. Which is to say: the guest went into the walker right there and
never came out.

That gives the whole sequence a clock:

| batch | event |
|---|---|
| 435416-435421 | the ring is built and closed |
| 435422 | `0x2eb307d8->next` is zeroed by something that is not the pool |
| 435423-435908 | ~490 batches of ordinary pool traffic, 303 walker calls returning |
| 435909 | the 304th call — a point that tests "inside" — never returns |

## The approach path: the profile dialog is the real blocker, and it takes no input

The wedge is not what keeps this game off the land. Run 62's captures show the
land-selection menu fully up and correctly drawn when the walker wedges, so the
menu is reached and rendered; the walker spins on something the scene behind it
queries. What actually stops a run from getting there is one screen earlier.

**Capture size identifies the screen** without opening it, which makes a sweep
cheap to read: ~220KB loading, ~340KB the "New Profile Name" dialog, ~415KB the
land menu.

### The dialog's auto-advance is flaky, and no flag separates the cases

The probe contains **no input automation at all**, so runs that reach the land
menu do it unattended. Twelve runs, same build, same box:

| outcome | runs | what they had in common |
|---|---|---|
| reached the land menu (~403s) | 6 | nothing that the stalled ones lacked |
| stalled on the dialog for the whole budget | 6 | nothing that the reached ones lacked |

Three mechanisms were proposed for the split and all three were measured and
refuted:

- **"The debug flags pace the clock."** Refuted: a run carrying run 62's exact
  flags stalls, and run 62's own script reruns green.
- **"The headless clock races ahead."** Refuted: `--tick-ms-per-batch=20` puts
  guest time at ~120 guest-seconds per wall second against the baseline's ~116 —
  equal pacing, same stall.
- **"`--input` changes the pacing."** Refuted, and backwards: a stalled run
  retires tiny blocks in a message pump, so its batch counter races, and
  batch-scheduled events therefore fire minutes early. The stall makes the
  schedule fire early, not the other way round.

A high batches/s reading is a **symptom** of a run sitting in a pump, never a
cause. `--control-stdin` is not a variable at all — the probe passes it on every
run.

### No input path reaches the dialog

The dialog is drawn by the game, not by Win98 controls, and
`_activeInputProfile` is null, so no DirectInput device has been acquired. All
of the following were delivered and none moved it, including sixty attempts
spread across ten batch points from 150000 to 600000 covering both the inner
dialog's OK at ~(250,275) and the outer one's at ~(250,338):

| path | result |
|---|---|
| `renderer.handleMouseDown/Up` (the `click` input action) | no effect |
| `WM_LBUTTONDOWN`/`WM_LBUTTONUP` posted to the main hwnd | queued, no effect |
| `VK_RETURN` pushed onto `renderer.inputQueue` | no effect |
| `di-mousedown`/`di-mouseup` (feeds `GetAsyncKeyState`) | no effect |
| `mousemove` first, so `GetCursorPos` agrees, then each of the above | no effect |
| `relmousemove` (DI relative delta) to position, then `di-mousedown`/`di-mouseup` | no effect |

The census has now answered which APIs the game polls, and it rules out the
first explanation that fit:

- **`DirectInput8Create` is called** — the game does use DI8. The earlier "no
  DirectInput device acquired" was inferred from `renderer._activeInputProfile`
  being null, which evidently does not track DI8.
- **`GetCursorPos` is called exactly once** in a whole 900s run, so every
  attempt that positioned the cursor with `mousemove` was writing a coordinate
  the game never reads.
- **`GetAsyncKeyState(VK_LBUTTON)` is polled from the input block at
  `0x526e8d` / `0x5293db`** — but only **8 times in 900 seconds**, in four
  pairs. That is the finding that matters: a press injected as a 2000-batch
  pulse has almost no chance of overlapping a poll, so "the button was ignored"
  and "the button was never sampled" are not distinguishable by these runs.

So the `relmousemove` + `di-mousedown/up` row above is a **weak** refutation,
not a strong one. The next run holds the button down for 20000 batches and
holds `VK_RETURN` through the DI keyboard path for the same span, and traces
the DI lifecycle (`IDirectInput_CreateDevice`, `SetDataFormat`, `Acquire`,
`GetDeviceState`, `GetDeviceData`) so that "the game never acquired a mouse
device" stops being an inference.

`$handle_IDirectInputDevice_GetDeviceState` (src/09a8-handlers-directx.wat:8102)
is fully wired for a mouse — `lX`/`lY` from `$di_mouse_delta_take_x/y`, which
`relmousemove` feeds, and `rgbButtons[0]` from `$host_get_mouse_buttons`, which
`di-mousedown` feeds — so if the game does acquire a device, the harness can
drive it.

### What the wedge actually blocks

Run 62 captured frames either side of the transition, and they correct a
standing assumption in these notes. At 404s it is on the profile dialog; at
800s, wedged, it is on the **land-selection menu** — the burning-village scene
with the row of land thumbnails along the bottom, rendered correctly. So the
walker is not what stops the menu from appearing. The menu is up and drawn, and
the wedge is in whatever the scene behind it queries.

## The front end is not blocked, it is rasterizing: 82% of the run is in DrawPrimitive

The eight `GetAsyncKeyState(VK_LBUTTON)` polls in 900 seconds are a symptom,
not the disease. The probe's own `samples.ndjson` records the guest EIP every
five seconds, and over a 900s run it reads:

| EIP | samples (of 180) |
|---|---|
| `0x7503488` | 148 |
| `0x7503490` | 11 |
| everything else | 21 |

`0x7503488` is in the thunk zone (`THUNK_BASE`, guest `0x07500000`), and a
thunk is 8 bytes of `[name_rva, api_id]` (src/09b-dispatch.wat:126). Read out
of a live instance over `--control-stdin`:

```
7503488 idx=1681 name_rva=0xcaca0010 api_id=2774
7503490 idx=1682 name_rva=0xcaca0010 api_id=2775
```

`api_table.json[2774]` is **`IDirect3DDevice9_DrawPrimitive`**, 2775 is
`DrawIndexedPrimitive`. So **the front end spends ~82% of its wall clock inside
one D3D9 draw call in the software backend**, and the run is not parked at all:
texture uploads keep climbing (`submitted 5:` goes 7 → 29 → 125 → 174 across
the same window) while the EIP sits in `DrawPrimitive`.

That explains every input result recorded above without needing a wrong input
path. The menu samples the mouse once per rendered frame, and it renders about
four frames in fifteen minutes, so a scripted press has to survive minutes of
wall clock to be seen at all — and a press pulsed over 2000 batches does not.
It also explains the 6/6 split on passing the profile dialog unattended: that
is a race against a clock nothing in the flag set controls.

**CORRECTION (same session, measured right after).** The share above is a
sampling artifact and the "82% of wall clock" reading of it is wrong.
`$handle_IDirect3DDevice9_DrawPrimitive` (src/09ad-handlers-d3d9.wat:1513)
calls `$d3d_render_park`, which sets `yield_reason 16` and leaves EIP on the
thunk so the call can be re-entered. Control commands are serviced *between*
batches, and a parked guest is exactly what ends a batch — so the sampled EIP
is at that thunk almost by construction. It says the guest parks there, not
that the wall clock is spent there.

What the wall clock is actually spent on, from `node --cpu-prof` over the
probe's own command line (120s, two profiles: main thread and the D3D render
worker):

| thread | idle | top self time |
|---|---|---|
| main | 12.9% | `$next` 2.4s+1.5s+1.3s, `$branch_end`, `$decode_block`, `$fpu_exec_mem` — the guest interpreter — plus `d3d9-texture.js decode` at 5.2% |
| render worker | **65%** | `$d3d_shader_vm_component` 9.8%, `$d3d_software_step` 8.8%, `$d3d_shader_vm_run`, `$d3d_shader_vm_texel`, `$d3d_shader_vm_sample_face_lod` |

The rasterizer worker is **idle two thirds of the time**; the main thread is
not. So the front end is **interpreter-bound**, not rasterizer-bound.

And the frame rate is not "four frames in fifteen minutes" either. Counted
directly off a 150s traced run:

| call | count in ~150s |
|---|---|
| `BeginScene` | 80 |
| `Present` | 162 lines |
| `DrawPrimitive` | 312 |
| `DrawIndexedPrimitive` | 0 |

**≈0.53 frames per second, about four `DrawPrimitive` calls per frame.** That
is slow but it is not a freeze, and it is fast enough to be clicked: a button
held for five wall seconds spans two or three frames of mouse sampling.

## The input path was right; the schedule unit was wrong

Tracing the DirectInput lifecycle settles the input question. The game:

```
IDirectInput_CreateDevice(0x07f4e018, 0x00d063a8, ...)   ret=0x009afdc3
IDirectInputDevice_SetDataFormat(0x07f4e020, 0x00d11b14) ret=0x009afdd7
IDirectInputDevice_SetCooperativeLevel(..., 0x00000006)  ret=0x009afdef
IDirectInputDevice_Acquire(0x07f4e020)                   ret=0x009afe3f
IDirectInputDevice_GetDeviceData(..., cb=0x14, ...)      ret=0x009b0933   (repeatedly)
```

The two `.rdata` pointers name the device exactly:

- `0x00d063a8` = `60 2b 1d 6f a0 d5 cf 11 bf c7 44 45 53 54 00 00` — the first
  dword is `0x6F1D2B60`, which is **`GUID_SysMouse`** (`…61` would be the
  keyboard).
- `0x00d11b14` = `dwSize=24, dwObjSize=16, dwFlags=2 (DIDF_RELAXIS),
  dwDataSize=16, dwNumObjs=7` — a **relative-axis** `DIMOUSESTATE`.

So the device is an acquired relative mouse read in **buffered** mode through
`GetDeviceData`, which is exactly the FIFO `relmousemove` and
`di-mousedown`/`di-mouseup` feed (`renderer._queueDirectInputMouseButton`,
test/run.js:7797). The harness has had the right path all along.

What was wrong is the **schedule unit**. `--input` fires on batch numbers, and
a guest that spins in a pump retires tiny batches — so in the hold run every
event booked for batches 250000–600000 fired between 04:07 and 04:08, within
the first minute of a 900-second run, hundreds of seconds before the profile
dialog is even on screen. All eight captures came back at ~340KB for that
reason alone. This is the same unit trap CLAUDE.md warns about for
`--batch-size`, arriving through `--input`.

At 0.53 fps the game samples the mouse about once every two seconds, so input
has to be driven on the **wall clock** and held for seconds, not scheduled on
batches and pulsed. `$S/bw-wallclick.sh` does that over `--control-stdin`:
photograph every 30s, and when the capture size says the dialog is up, park the
cursor with a large negative relative delta, walk it to the button, hold the
button 5s, release.

## The whole front end is navigable (2026-09-13)

Driving the acquired relative mouse on the wall clock walks the entire menu
chain for the first time. One boot, `--control-stdin`, a click = park with
`handleRelativeMouseMove(-3000,-3000)`, walk to the target, hold the button 5s,
release (`$S/bw-wallclick.sh` + `$S/clickat.sh`):

| t (wall s) | capture | screen |
|---|---|---|
| 30 | 2075 B | black |
| 60–90 | 220 KB | loading |
| 150 | 340 KB | **"New Profile Name"** over "Select Profile", name prefilled `Player`, OK/Cancel |
| 150 + click (250,275) | 339 KB | same dialog, cursor sprite now drawn on OK |
| 150 + second click | **397 KB** | **main menu** — title `Player`, bar reads Credits / New Game / Load Game / Change Profile / Options / Quit |
| + click (165,443) | 395 KB | **mouse-tutorial screen** (four panels, Continue button) |
| + click (320,461) | 394 KB | **land-selection menu** — burning village scene, eight land thumbnails |
| + click (75,380) / (140,378) | 415889 B | land menu, then the guest enters a long non-rendering load |

Two things this settles:

- **The capture-size discriminator gains two entries**: ~395–397 KB is the main
  menu / tutorial, and the old "415889 = land menu" still holds.
- **The cursor is unmistakably ours.** In the 340 KB capture the game's own
  cursor glow sits exactly on OK, where the relative walk put it, and in the
  next capture it has changed to the pressed sprite. The DirectInput mouse is
  wired end to end.

### After the land click: not a wedge, a long scan

The land click stops the repaint (captures stay byte-identical at 415889) and
pins EIP at `0x9e5272`. That is *not* the `0x9e17b0` wedge. Disassembled it is
an ordinary linear search:

```
9e5272  cmp [ecx], edi
9e5274  jz  0x9e52e9        ; hit
9e5276  add eax, 1
9e5279  add ecx, 4
9e527c  cmp eax, [esi+4]    ; count
9e527f  jl  0x9e5272
```

Read out of the live instance: `esi=0x35c51fb4`, count `[esi+4]=0xb351`
(45905), data `[esi+8]=0x2db5d884`, and `ecx` is exactly `data + eax*4`. `eax`
was 37756 on one sample and 47603 four seconds later — past the 45905 of the
first pass, so the *outer* loop is turning too. Nothing is unmapped and nothing
is stuck: this is an O(n·m) scan over a 45905-entry table, running at
interpreter speed, which is what land loading costs here.

So the sequence that reaches gameplay is now known and reproducible; what is
left between the land menu and the land is throughput, the same thing the
`--cpu-prof` split above points at.

### Why the land-load scan is not folded, and what folding it would take

The scan at `0x9e5272` is exactly the shape a superop wants, and
`tools/find-loops.js` does see it:

```
va 0x9e5272  n=6  .text  family=other
  skeleton: cmp m,r; jz r; add r,i; add r,i; cmp r,m; jl r
```

But `tools/match-loops.js` declines it, and the runtime matcher could not have
taken it either:

- **`SCAN_RUN` exists only in the static tool.** `src/07b-loop-match.wat` has
  no `SCAN` family at all — the runtime families are `COPY_RUN`, `FILL_RUN` and
  `LUT_RUN`.
- **The cycle spans two basic blocks.** The `jz 0x9e52e9` early exit terminates
  a block, so the loop is `[cmp/jz]` + `[add/add/cmp/jl]`. `$loop_match_block`
  only ever runs on a block that branches to *itself*, so this is invisible to
  it by construction — the same blind spot §19's notes describe, and the reason
  `multi-branch` is 1600 of BW2Demo.exe's 11724 declines (second only to
  `call`'s 5670).

Address-ordered runs (`$decode_run`, src/07-decoder.wat:5792) do lay the two
blocks out contiguously, so the fall-through is cheap — but they do not merge
the blocks, and a fold needs one block to rewrite.

So folding this is Design B work (a multi-block cycle), not a new Design A
predicate, and it should not be started on the strength of one app's load
screen. The measurement that would justify it is a `--handler-hist` /
`--hot-block-dump` census taken *during* the land load, which no run has yet
because the load is only reachable through the click chain above.

### CORRECTION (2026-09-13): the land load never finishes -- the scan reads a NULL vector

The section above is wrong where it calls `0x9e5272` "an O(n*m) scan at
interpreter speed". It is an unbounded loop over corrupt data, and no amount of
folding would make it terminate. The full shape, from the disassembly at
`0x9e521f`:

```
009e5250  33 db          xor ebx, ebx            ; inner index = 0
009e5252  39 5d 00       cmp [ebp+0x0], ebx      ; ebp = src vector: count@+0, data@+4
009e5260  8b 56 04       mov edx, [esi+0x4]      ; esi = dst vector: cap@+0, count@+4, data@+8
009e5269  8b 4d 04       mov ecx, [ebp+0x4]      ; ecx = src->data
009e526c  8b 3c 99       mov edi, [ecx+ebx*4]    ; edi = src->data[i]
009e526f  8b 4e 08       mov ecx, [esi+0x8]
009e5272  39 39          cmp [ecx], edi          ; linear_find(dst, edi)
009e5274  74 73          jz  0x9e52e9            ; already present -> next i
009e5276  83 c0 01       add eax, 1
009e5279  83 c1 04       add ecx, 4
009e527c  3b 46 04       cmp eax, [esi+0x4]
009e527f  7c f1          jl  0x9e5272
...                                              ; not found: grow (malloc at 0xad425d,
009e52e2  89 14 81       mov [ecx+eax*4], edx    ; capacity doubling) and push_back
009e52e5  83 46 04 01    add dword [esi+0x4], 1
009e52ec  3b 5d 00       cmp ebx, [ebp+0x0]      ; i < src->count
009e52fd  83 c5 0c       add ebp, 0xc            ; next src vector (12-byte records)
```

So it is `dst = union(dst, src[k])` for a list of source vectors, with
membership tested by linear search. Fine in principle. The problem is the
source record it is on. Sampled live from the running probe at two points 45 s
apart:

```
FRAME eip=9e5276 ebp=2e0f03e8 srcN=770376714 srcData=0 ebx=1268378 s30=3 dstN=92888 dstCap=131072
FRAME eip=9e5272 ebp=2e0f03e8 srcN=770376714 srcData=0 ebx=1276274 s30=3 dstN=96437 dstCap=131072
```

`srcData = 0`. The source vector's data pointer is **NULL** and its count is
`770376714` (`0x2DE9C64A`) -- a value in the same `0x2d`-`0x2f` range as every
live heap pointer in this process, so a pointer is sitting in the count slot.
A well-formed empty vector would read count 0; this record was never
initialized, or was written with the wrong layout.

The consequences follow mechanically. `mov ecx,[ebp+4]` makes `ecx` zero, so
`mov edi,[ecx+ebx*4]` reads guest address `ebx*4` -- around `0x4D9C88` at the
sampled index, which is *inside the mapped image*, so nothing faults and no
diagnostic fires. Each dword of the EXE's own bytes is then deduplicated into
`dst`, which grows without bound: 45905 entries when first sampled, 96437 an
hour later, capacity already doubled to 131072. The loop exits when
`ebx` reaches `770376714`, i.e. after ~770 million iterations whose inner scan
is itself hundreds of thousands of elements by then. At the measured
~8000 outer iterations per 40 s that is over 40 days, and the inner scan is
still lengthening.

**So: the land load does not complete, and it is not a throughput problem.**
The `--handler-hist` census named at the end of the previous section would have
measured a loop that should never have run. The open question is why the record
at `0x2e0f03e8` is garbage -- who fills that array of 12-byte vector records,
and what it read (or failed to read) beforehand. `s30=3` says three records
remain in the outer walk, so the earlier ones were processed without wedging;
this is one bad element, not a wholesale corruption.

This also re-frames the two long-standing NULL-deref counts in the fault census
(`eip=0x9e17d0` x937,819,405 at addresses `0x0`-`0x8`, and `0x9e8200`): the same
family of symptom -- structures that should have been filled reading back NULL.
