# DX SDK Direct3D Retained Mode samples (globe, viewer, flip3dtl)

## October 31: bounded registered Flip3D startup sweep

Run `20261031T0347Z-flip3dtl-startup` executes registered `dx_flip3dtl`
with the cooperative CLI scheduler, no build, and a 20-second guard.
It exits normally after 30,368 batches (20.002 seconds). The personally
inspected final capture shows a colored Windows-textured cube and the
on-screen counter **Frame 04211 (HAL)**. No startup trap was observed;
this does not establish interactive acceptance or backend parity.

The local module is `7f9da4e9da5183e9f7f061d2356cd34626fe74bdbaf7da0345f6693dd81152be`,
with unknown compiled source identity. Input hashing initially failed on
object-valued manifest entries, so the retained hashes are post-execution
only; no before/after integrity claim is made. No browser, server, or Boat
was created.

## October 31: separate archive Globe baseline and viewport stretch repair

Run `20261031T0122Z-globe-original-scene` launches a separately named
**DX5 archive original Globe (296 vertices / 588 faces)** scene. Its executable,
mesh and texture are copied from the previously verified SDK archive into the
run's `original-scene/` directory. A runtime-only `dx5_archive_original_globe`
entry mounts those three files through the ordinary launcher. The registered
`dx_globe` entry and all 38 registered input files remain unchanged. This is
an explicit original-scene baseline, not acceptance of the registered mesh.
The authentic black band was not retested or changed.

Personally inspected initial/later solid captures show camera motion and globe
rotation on software and WebGL. Native maximize and Render → Wireframe clicks
also produce enlarged solid and wireframe scenes on both routes. The original
mesh is a closed triangular sphere: 296 vertices, 588 faces, 882 edges, Euler
characteristic 2, with every edge used twice. Its vertex radii range from
2.01965554 to 2.02463611. The captured triangle list contains all 1,764 TL
vertices and all 296 unique archive vertices in original face order, with no
nonfinite positions or inconsistent repeated vertices. A fitted homogeneous
projection reproduces screen positions within 0.000016 pixels. These checks
exclude missing faces and inconsistent vertex transforms at those checkpoints;
they do not alone establish correct projection scale.

The remaining oval silhouette revealed a demonstrated emulator defect. Before
the repair, effective horizontal/vertical focal lengths are approximately
292/254 pixels: ratio **1.1496064**, matching the initial viewport aspect.
The enlarged viewport's live descriptor requests a clip volume of
2 × 1.57396448 for 676 × 532 pixels, which requires equal pixel scaling.
Nevertheless, the active device's clip normalization is disabled. DX1 Execute
selects the passed viewport using a separate rectangle-only implementation,
dropping its stored clip transform. The original SDK `d3drm.doc` describes
uniform scaling as the default; the live descriptor establishes what this
particular original guest requested, independently of that default.

Execute now uses the existing `d3dim_viewport_apply_entry` helper, applying the
stored clip volume together with its rectangle. The focused public-API
regression fails before the fix at the original 292 × 254 size and passes
afterward. It checks both original window sizes, nonzero viewport offsets,
explicit unequal scales and resetting normalization. Existing sparse Execute
instruction/vertex/data tests, viewport clipping, the registered Globe's real
11-item Render menu and worker parity pass, as does the locked full build.

The rebuilt module is
`573e235db16e351668289f49e2f279ff48bcad56e7ca533167cb94cd6f4ec3fc`.
Original-scene software/WebGL retests show circular solid and wireframe
silhouettes. The post-fix projection fit yields focal lengths approximately
292/292 pixels, ratio **1.00000007**, retaining all 588 faces. Both live routes
now apply the descriptor's vertical normalization factor 1.27067673 at the
enlarged size. WebGL records no fallbacks or errors. Captures use Chrome 151,
ANGLE SwiftShader and disabled guest threads. Camera phases differ between
routes and before/after captures; this is a scale/geometry result, not aligned
pixel parity, native Windows visual certification or a performance measurement.

The run retains both modules, archive inputs/source/reference manual, served
asset/module hashes, source manifests, the repair patch, focused/build logs,
read-only geometry/viewport observations and recovery instructions. The first
browser pair and part of the retry pair disappeared unexpectedly; the cause
and sender are unknown. The fresh post-fix runs completed capture and normal
cleanup. `verification.json` checks 41 input pins (38 registered plus three
archive scene files), 1,176 served hashes, all eight module loads and source
identity. Fixed-window post-fix captures change 17,826 software and 37,693
WebGL scene pixels; all eight browsers are absent, 24 ports closed and eight
profiles removed. No Boat/test box was used. Further work is a frame-aligned
native reference for lighting, camera and rasterization details; no remaining
mesh corruption is demonstrated by this investigation.

## October 31: Globe texture-band diagnosis and original-mesh limit

Run `20261031T0114Z-globe-texture` captures the registered Globe scene on
software and WebGL with retained current module
`f2911e1fcfc094d3c6d998bbdb071bdd800ede18cd0082a5eed53de15cf08bb9`,
including producer extent fix `0cbf8aa50`. No animation acceptance was repeated,
guest asset replaced, or renderer code changed. The earlier descriptions of a
known texture-band defect are observations, not an established causal diagnosis.

The prominent black cross/band and yellow radiation sign are present in
`tex1.ppm` itself. Personally inspected `tex1.png`, `live-texture.png`,
`software/asset-band.png` and `webgl-trace/original.png` show those features.
All 65,536 live native texels exactly match the source's RGB565 quantization;
all decoded RGBA texels match bit-replicated RGB565 expansion. This rules out
a texture load/row-pitch/conversion corruption in that captured texture.

Built-in DX tracing records TEXTUREHANDLE=15, WRAPU=1 and a resolved 256x256,
16-bit texture with pitch 512. Diagnostic draw observations capture 108 triangle
list primitives (324 TL vertices), finite U/V values, WRAPU only, repeat U/V
addressing, point min/mag filtering, no mip filtering and no color key.
The U range is approximately 0.0413213..0.9586542; V is
-0.0000610054..0.9999390. Fourteen triangles cross the U seam. The GPU submission
matches the existing per-triangle wrapping rule for every UV, including 17
shifted U values. Raw and submitted draws are at different animation times;
only their stable UVs are compared. `sampler-analysis.json`, `uv-analysis.json`
and the raw captures preserve the measurements. The existing
`node test/test-d3dim-texture-wrap.js` passes software WRAPU/WRAPV/WRAP0,
descriptor field 33 and GPU seam-fixup checks; this fixture is supporting
regression evidence, not original-scene acceptance.

Archive verification exposes a separate baseline problem. The retained
`idx5sdk.exe` installer (SHA-256
`6cde9ba718866e21e8b197b599fc9193a9044b8159af8baddbefec16ae531b51`)
contains an executable and `tex1.ppm` identical to the registered copies, but
its `SPHERE3.X` differs from the mounted mesh:

| Input | Registered copy | DX5 archive copy |
| --- | --- | --- |
| sphere3.x | 10,373 bytes, text, 56 vertices / 108 faces | 30,996 bytes, binary, 296 vertices / 588 faces |
| SHA-256 | `bb8bd85a4f13ef27777690295264f7f2475b3b4bb4e936e3b3394ee08c05360f` | `c1b01f8fe97280fdcad69dce085f9dd34318e0ad45e90585a7f786c4b6f5fb1e` |

The archive's original `globe.c` explicitly loads `sphere3.x` and `tex1.ppm`,
constructs a cylindrical wrap and applies it to the mesh. Both meshes and that
source are preserved in the run; the archive mesh was **not** mounted. Thus
these captures use the original executable and texture, but do not establish
the original DX5 mesh scene. Earlier references to an entirely original Globe
scene must be read with this qualification. The local mesh's provenance and
the cause of any distortion beyond the texture's intentional band remain
unresolved. No evidence justifies changing the sampler. Next work requires
an explicitly authorized original-mesh baseline and a frame-aligned native
reference before attributing any remaining seam to rendering.

`verification.json` pins 38 registered inputs and verifies all 546 served
responses across three browser launches. `current.wasm`, asset snapshots,
served-source snapshots, archive extracts, observation scripts and
`recovery.txt` preserve recovery. Chrome 151 uses ANGLE SwiftShader with guest
threads disabled; owning-host GPU is enabled on the traced WebGL route and
disabled on software. The first WebGL browser disappeared after its initial
capture (cause unobserved); a fresh traced run supplies the complete GPU
diagnosis. All three controllers/browsers are absent, nine HTTP/CDP/control
ports closed and profiles removed. No Boat/test box was used. This is an
unresolved rendering investigation, not a production repair, pixel-parity
claim, native correctness certification or performance result. No build was
required for this documentation-only change.

## October 31: original Twist threaded WebGL freeze repaired

Run `20261031T0104Z-twist-thread-freeze` first confirms the current-build
failure with an overlay-free scene rectangle (screen x=34..344, y=240..479).
The coordinator's three-route captures have 0 changed scene pixels in threaded
WebGL, 20,826 in nonthreaded WebGL and 22,457 in software. A fresh threaded
baseline also has 0 changed scene pixels while its FPS text changes. Both
baseline captures were personally inspected; accepted 900-vertex batches and
GPU draw/readback counters continue advancing.

The active ExecuteBuffer extent scope is stored in per-instance WASM globals.
The process render worker owns a different WASM instance: its GPU callback
cannot update the guest worker's active scope. Consequently GetExecuteData
reports empty scene extents and D3DRM copies only its FPS overlay. The earlier
GPU extent repair covered execution on the owning instance, leaving this
threaded transport path broken.

Accepted Execute triangle and wireframe batches now publish conservative TL
coverage on the producer before Execute returns. Bounds include the existing
GPU two-pixel rounding margin and are clipped to the target and viewport;
uncertain homogeneous coordinates retain conservative clip coverage. Declined
batches keep their synchronous raster path. Status collection stays with the
active Execute owner, independently of asynchronous replay/readback.

The public Execute/GetExecuteData regression fails before the fix with an
empty rectangle and passes afterward. It covers accepted transport without
local rasterization, moving/reset bounds, solid/wireframe batches, target and
viewport clipping, fully clipped geometry and scope retirement. Existing
sparse Execute/status/owner cases, GPU batching, point lowering, depthless-Z
and second-instance worker parity pass. The locked `tools/build.sh` passes.

The original registered `dx_twist` was retested with module SHA-256
`f2911e1fcfc094d3c6d998bbdb071bdd800ede18cd0082a5eed53de15cf08bb9`.
Personally inspected initial/later captures show visible deformation and
rotation on threaded WebGL, nonthreaded WebGL and threaded software, with
21,826, 13,175 and 17,558 changed scene pixels respectively. Threaded WebGL
retains the process render worker, backend `webgl`, guest threads and lazy sync;
its recorded GPU stats report no fallbacks or errors. Built-in DX tracing is
retained for all three retests. No app override, guest-memory edit, synthetic
frame or threading bypass was used in browser execution.

`verification.json` pins all 38 registered inputs per execution, verifies all
served file hashes (202 baseline, 202/179/192 retest responses), loaded module
identity, unchanged build-source hashes and browser/profile cleanup. The run
also retains the patch, build/focused-test logs and recovery recipe. Chrome 151
uses ANGLE SwiftShader. These captures establish animation, not aligned pixel
parity, native-Windows scene correctness or performance. No Boat/test box was
used; all four owned browsers and their HTTP/CDP/control ports were closed.

## October 31: current-build original Viewer interaction on both routes

Run `20261031T0058Z-sdk-viewer-current-input` uses the original recovered
SDK meshes through the normal registry and the canonical module built from
source tree `1baffb405`, SHA-256
`d10f581fe8b925ed8add6df7b4aad65e10363d23e4d091adccfc0c4ffcbaa9e5`.
`build-identity.json` pins the tracked source hashes; only unrelated
`ops/terminals.json` was dirty at capture setup. This closes the earlier
retained-module limitation for this scoped interaction.

On both software and WebGL, native browser clicks select the Microsoft logo,
open Edit → Change Color, choose red, and confirm. Personally inspected
`color-dialog.png` and `red-applied.png` in each route show the dialog and
red logo; the other camera shape stays gray. No guest-memory write, synthetic
command delivery, fixture replacement or app-specific runtime patch was used.
All 17 captured browser input events per route are trusted and end with the
mouse button released.

Each route verifies 38 registered executable/asset pins, all 182 served
response hashes, and its loaded module against the retained canonical bytes.
Owning-host GPU state is true only on WebGL; guest threads are disabled.
Chrome 151 uses ANGLE SwiftShader. Both browsers are absent, all six HTTP/CDP/
control ports are closed and both private profiles removed. No Boat was used.
This proves original scene selection and material-color change on the two
routes, not native-Windows visual correctness, aligned pixel equivalence,
hardware performance or full 27-app completion. Existing locked build and
focused selection test pass in the preceding recovery run.

## October 31: original Viewer Mesh assets recovered

The three local names `camera.x`, `mslogo.x`, and `sphere2.x` were renamed
ProgressiveMesh copies, not the Viewer sample's original inputs. The archived
Microsoft DirectX 5 SDK installer supplies the missing plain Mesh files. Its
`viewer.exe` exactly matches our existing executable (SHA-256
`82ba1cddd85804c29f20e25b8ecea241a40037f03f54fc347976bde0593d7510`).

Recovery is reproducible from
[the archived SDK installer](https://archive.org/download/idx5sdk/idx5sdk.exe):
verify its 33,018,416-byte size and SHA-1
`b14370372307360a9e8de2ebd8fcd13173fd3b4a`, extract nested `DX5SDK.EXE` with
7-Zip, then extract `/cdrom/media/CAMERA.X`, `MSLOGO.X`, and `SPHERE2.X` from
that archive. Install those three files under lowercase names in
`test/binaries/dx-sdk/bin/` (the `binaries` path is a symlink). Their SHA-256s are:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| camera.x | 2820 | `1c56daf9d94fa31c3a721d69d07d223c44ebe1972914af497da40dd251295383` |
| mslogo.x | 146596 | `bbe967bbe686d5b3bc25979b70abf2d8ce6aea4b821f4ced9ca59d7902a6727d` |
| sphere2.x | 21092 | `804a4b79b7de03ed529bc7af7e9a904278956d6c052c9b81cc617ce703d633be` |

Run `20261031T0049Z-sdk-viewer-original-assets` preserves archive metadata,
source and extraction hashes, the original Viewer source naming these inputs,
and a personally inspected original-scene browser capture. The gray Microsoft
mesh and camera shape now render; the prior camera-load dialog is absent.
The initial override retained stale synthetic fixture byte sizes and failed;
removing those sizes produced the original scene. Direct registration then
exposed stale generated lengths from the old ProgressiveMesh aliases. Updating
all three entries in `lib/app-file-sizes.generated.js` restored loading without
an override. The registered scene renders on both software and WebGL routes
(owning host GPU false/true respectively), using retained module SHA-256
`d83e413fbc38ca5aa5447a7be62d10010783fd5490c98ec07c076553897950e5`;
its full compiled-source identity is unknown. These captures do not certify
the newly built module. The locked current build passes separately.
`test/test-d3dim-viewer-selection.js` now explicitly imports the small synthetic
fixture before execution, as `test/test-all-exes.js` already does, and its
selection/Change Color assertion passes.
Software shows a readable Microsoft logo; the WebGL capture catches it nearly
edge-on. Animation phase was not aligned, so no pixel-equivalence claim follows.
This proves original asset loading and visible output, not full scene
correctness, interaction, or complete 27-app acceptance.

## October 31: original Boids flock is phase-dependent, not absent

Run `20261031T0135Z-boids-original-flock` reuses the prior browser driver
with the built module after `2606d6173`, SHA-256
`573e235db16e351668289f49e2f279ff48bcad56e7ca533167cb94cd6f4ec3fc`.
Three personally inspected moving captures on each software/WebGL route
progress from isolated colored birds to a clustered colored flock over the
cyan terrain. Software also shows a textured obstacle. A separate WebGL
startup capture reproduces cyan outlines without visible birds, followed by
a later capture with a bird and textured obstacle. Threads are disabled;
the owning host has `d3dimGpu` only on WebGL, with zero reported fallbacks
or errors. No guest state, executable, or asset was modified.

The original executable matches the recovered DX5 archive byte-for-byte
(`b9327e6f…`). Its `samples/boids/boids.cpp` defines 13 birds, seeds
`srand(time(NULL))`, scatters their initial X/Z positions across approximately
±100 units, and starts the camera at `(0,30,100)` looking at `(0,0,50)`.
Each render advances the simulation, looks toward the flock centroid, and
orbits the camera with a time-seeded phase. Launch time and simulation phase
therefore change how much of the flock a short capture sees.

Read-only observations of three complete WebGL frames each contain 67 draws:
50 terrain line strips, all 13 birds (30 indexed vertices / 10 triangles each),
and four obstacles. In the startup frame **all 13 bird bounds are outside
the 640×480 viewport**; two later frames have all 13 intersecting it. An
independent float32 projection of the original 16-vertex bird model through
the observed world/view/projection matrices and viewport normalization
matches every submitted bird position, depth, and reciprocal W exactly in
all three frames. In the startup and final traced frames, world translations
also match all 13 live original bird locations. See `geometry-analysis.json`,
the raw geometry captures, original source/disassembly, and `recovery.txt`
in the run directory.

This demonstrates an off-camera flock in an actual outline-only startup
phase, and visible convergence on both current routes. The October 30 runs
did not retain comparable geometry, so their exact cause remains unproven.
The Globe repair changes DX1 Execute; Boids uses Device2 indexed primitives,
so these observations do not attribute the flock's return to that repair.
No emulator defect was isolated and no code repair or new build was needed.
Native frame-aligned correctness, lighting/raster parity, and performance
remain unqualified. All 38 registered inputs and served-response hashes
were checked; all three owned browsers/servers were closed, nine ports
verified closed, and their private profiles removed. No Boat was used.

## October 30: paired Boids motion, incomplete scene acceptance

Runs `20261030T2335Z-dx-boids-webgl` and
`20261030T2335Z-dx-boids-software` retain the original `boids.exe` and each
contain two personally inspected browser frames. Cyan polygon outlines change
position on both routes. The images do **not** establish a correctly rendered
flock; this is narrower than the earlier colored-triangle observation.
Both Chrome 151/ANGLE SwiftShader runs loaded canonical module `d83e413f…`
(source `de2e338c4`) with guest threads disabled. Owning-host GPU state was
verified enabled for WebGL and disabled for software. Each run verifies all
38 local SDK-directory input hashes and all served response hashes; the input
manifest includes the renamed ProgressiveMesh aliases described below.
`investigation.json` records exact module identity, backend and frame paths.
Both browsers were stopped, all six ports closed and private profiles removed.
No Boat was used. Full scene correctness, pixel parity, FPS and historical
corpus membership remain unqualified.

## October 30: Globe motion verified on both repaired-build routes

Runs `20261030T2330Z-dx-globe-webgl` and
`20261030T2330Z-dx-globe-software` each contain two personally inspected
captures of the original SDK Globe executable. The shaded, textured sphere
changes orientation on both routes. This closes the earlier unverified WebGL
motion finding after GPU Execute extent repair `de2e338c4`; it does not resolve
the historical texture-band correctness question or establish pixel parity.

Both Chrome 151/ANGLE SwiftShader runs loaded retained canonical module
`d83e413fbc38ca5aa5447a7be62d10010783fd5490c98ec07c076553897950e5`.
WebGL had the owning host's `d3dimGpu` and GPU selection enabled; software
had neither. Guest threads were disabled in both. Each run verified 38 local
SDK-directory input hashes and all 182 served-response hashes. Its `investigation.json` records
frames, build/backend evidence and cleanup: browser absent, three ports closed,
private profile removed, no Boat. The different orientations and sphere sizes
are not a same-frame comparison; FPS, full scene correctness and completion of
the historical 27-app corpus remain unqualified.

## October 30: original Tunnel WebGL motion verified after extents fix

Run `20261030T2325Z-dx-tunnel-gpu-extents` retested original `dx_tunnel`
with the canonical module retained from the passing build for GPU Execute
extent repair `de2e338c4`. Two personally inspected browser captures show
changed tunnel orientation and texture position. A bounded trace of 284
copy/present events contains 94 distinct scene-region hashes on both primary
surface and render target, excluding the text overlay.

Chrome 151/ANGLE SwiftShader loaded module
`d83e413fbc38ca5aa5447a7be62d10010783fd5490c98ec07c076553897950e5`.
All served-response hashes match their local inputs. The run's `result.json`
records module identity, captures and verified cleanup: browser exited, three
ports closed, private profile removed, no Boat. This closes the earlier
unverified WebGL motion finding for Tunnel; pixel parity, full scene correctness,
performance and completion of the 27-app corpus remain unqualified.

## October 30: Twist WebGL animation repaired

The original `dx_twist` browser run `20261030T2320Z-dx-twist-gpu-extents`
now visibly deforms and rotates its textured sphere. Three captured frames
were personally inspected. The bounded copy trace contains 101 distinct
scene-region hashes on both the primary surface and render target; changing
copy rectangles cover the sphere. Before the fix, run
`20261030T2316Z-dx-twist-copy-trace` copied only the FPS text rectangle after
the initial frame, leaving the primary scene unchanged despite target updates.

The GPU executor omitted ExecuteBuffer status extents that D3DRM consumes to
choose its windowed copy rectangle. Accepted draws now report conservative,
clipped coverage while Execute still owns that status, independently of later
batch submission or readback. Wrong-target, inactive and empty reports are
ignored. Triangles, lines, points, clipping and deferred submission have focused
coverage, including the actual compiled WASM export.

The locked canonical build and five focused D3DIM tests pass. The original
Chrome 151/ANGLE SwiftShader run loaded retained module
`d83e413fbc38ca5aa5447a7be62d10010783fd5490c98ec07c076553897950e5`;
served-response integrity and browser/port/profile cleanup are recorded in
its `result.json`. No Boat was used. This establishes visible animation for
this sample; pixel parity, complete scene correctness, performance and the
historical 27-app corpus goal remain unqualified. Earlier stationary-frame
findings below describe the previous build.

## October 30: Twist motion boundary narrowed; no repair yet

Two original WebGL diagnostic runs, `20261030T2305Z-dx-twist-motion-probe`
and `20261030T2307Z-dx-twist-frame-boundary`, used the same verified canonical
module `7e8d3194…` from source `8cfa97b0d`. Runtime-only wrappers sampled
120 distinct submitted vertex hashes and 120 distinct full readback/DIB hashes.
That establishes progressing geometry submission and readback, not visible
animation: whole-frame hashes can change with the guest FPS overlay.

Four later samples excluded the overlay and measured the same scene-region
hash, `3605449039`, while draw count advanced from 14,092 to 14,125. Three
closely spaced screenshots were personally inspected and show the same sphere
orientation. This narrows the unresolved animation gap without identifying its
cause or establishing scene correctness. No production source was changed.
Each run retains its diagnostic logs and `investigation.json`; both browsers
exited, all six ports closed, private profiles were removed, and no Boat was used.

## October 30: paired original Twist renders; motion differs

Runs `20261030T2304Z-dx-twist-browser` and
`20261030T2304Z-dx-twist-software` contain inspected original `dx_twist`
initial/final frames. Both render a dark textured object with a yellow/black
radiation symbol. Software shape and orientation change; WebGL frames appear
stationary. WebGL animation is unverified, and the cause remains undiagnosed.
This is a concrete follow-up gap rather than a scene-correctness pass.

Both loaded module `7e8d3194…` from the passing canonical build of
`8cfa97b0d`, with unchanged source hashes recorded in the copied build
manifest. Chrome 151/ANGLE SwiftShader observed guest threads enabled;
WebGL used `D3DIMGpu`, while software selected DX2–7 WAT without it.
Each run verified 39 input hashes and 38 served SDK responses. Its
`investigation.json` references captures, route/build evidence and cleanup.
Both own browsers exited, six ports closed and private profiles were removed;
no Boat was used. FPS overlays are not benchmarks. Pixel parity, complete scene
correctness and the historical 27-app goal remain unqualified.


## October 30: Tunnel renders from a verified canonical build

Runs `20261030T2317Z-dx-tunnel-browser` and
`20261030T2317Z-dx-tunnel-software` contain inspected initial/final captures
of original `dx_tunnel`: gray textured tunnel walls with yellow/black edges.
Software frames show changed orientation; WebGL animation is not established.
Chrome 151/ANGLE SwiftShader used `D3DIMGpu` on WebGL and the DX2–7 WAT
software rasterizer without `D3DIMGpu` on software. Guest threads were enabled.

The locked canonical build passed on source `8cfa97b0d`; all 1,148 tracked
build-source file hashes stayed unchanged across compilation, with no tracked
source patch. It produced module `7e8d3194…`, matching each loaded module.
This newly verified build reproduces the earlier retained module hash; it does
not retroactively establish the earlier runs' complete host/source identity.
Each run verified 39 inputs and 38 served SDK responses. Build logs, source
manifest, captures, route observations and cleanup are in its `investigation.json`.
Both browsers exited, six ports closed, and private profiles were removed.
No Boat was used. The guest FPS overlay is not a benchmark; these captures do
not establish pixel parity, full scene correctness, or completion of the 27-app corpus.


## October 30: paired original Flip3DTL browser animation

Runs `20261030T2311Z-dx-flip3dtl-browser` and
`20261030T2311Z-dx-flip3dtl-software` each contain inspected initial/final
captures of original `dx_flip3dtl`: a Windows 95 textured cube changes
orientation on both routes. The window identifies itself as Flip3D DISPLAY
HAL. The guest FPS overlay is not an independently measured benchmark.

Chrome 151/ANGLE SwiftShader used WebGL with `D3DIMGpu` in the first run;
the second selected the DX2–7 WAT software rasterizer and had no `D3DIMGpu`.
Guest threads were observed enabled in both. Both loaded retained module
`7e8d3194…`, compiled source revision unknown, and verified all 39 input
hashes and 38 served SDK response hashes. Each run's `investigation.json`
records evidence and cleanup: browser gone, three ports closed, private
profile removed, no Boat. These observations establish animated textured
output on both routes, not pixel parity, full scene correctness, performance,
or completion of the historical 27-app corpus.


## October 30: Viewer input provenance corrected

The earlier run `20261030T2308Z-dx-viewer-browser` did **not** mount original
Viewer meshes. It replaced the registered test fixtures with local SDK-directory
files, but those names are fabricated aliases: `camera.x == pm_cam.x`,
`mslogo.x == pm_mslog.x`, and `sphere2.x == pm_sph2.x`, byte for byte.
Run `20261030T2334Z-viewer-input-diagnosis/investigation.json` records all
three SHA-256 comparisons; `test/fixtures/d3drm/README.md` already documents
their origin and the loader's Mesh-versus-ProgressiveMesh type filter.

The inspected **Failed to load camera.x — D3DRMERR_NOTFOUND** dialog therefore
does not establish a parser defect. The existing browser-manifest regression
passes and deliberately mounts plain-Mesh fixtures. Original-scene acceptance
remains open pending the actual plain-Mesh Viewer assets; fixture scenes do
not close that gap. The earlier run still establishes the rejection, its loaded
module and cleanup, but its “original SDK meshes” provenance claim is withdrawn.
No production code or guest asset was changed for this diagnosis.

## October 30: paired original Globe browser renders

Runs `20261030T2302Z-dx-globe-browser` and
`20261030T2305Z-dx-globe-software` add inspected initial/final captures of
original `dx_globe`. Both show the titled Direct3DRM sample with a dark shaded
sphere and yellow/black textured band. Software captures show a change in
orientation; WebGL animation is not established. Their different apparent
sizes and orientations are not a pixel-parity comparison or correctness verdict.

Chrome 151 used ANGLE SwiftShader with guest threads observed enabled.
The WebGL UI/console and `D3DIMGpu` identify that route; the software UI/console
identify the DX2–7 WAT rasterizer, with no `D3DIMGpu`. The queried host
`backend` property was unavailable, and OpenGL `gl_sw_enabled()` does not
identify the D3DIM route. Both loaded retained module `7e8d3194…` (full hash
in each `loaded-module.json`), compiled source revision unknown. Each run
verified 39 input hashes and 38 fetched SDK responses. Browser processes and
servers are gone and temporary profiles removed. Evidence and limits are in
each run's `investigation.json`; no FPS, full scene correctness, current-main
build, or complete historical 27-app claim follows from these captures.

## October 30: original Boids browser animation

`scratch/runs/20261030T2255Z-dx-boids-browser/investigation.json` records a
fresh original `dx_boids` run. Both inspected frames show colored flock
triangles and cyan boundary lines, with positions changing between captures.
This registered sample uses immediate mode, separate from the retained-mode
samples discussed below.

Chrome 151 ran with ANGLE SwiftShader, WebGL selected, and guest threads
observed enabled. The host reported backend `webgl` and a `D3DIMGpu` object.
The loaded module was `7e8d3194fd189a8e0089b41ee5972b08b67fd5650d6dfbe2a2fbb9d3c323a327`;
its compiled source revision is unknown. All 39 input hashes and served SDK
asset hashes were verified. Repeated readback-shadow performance warnings
remain in the console log. This establishes animated output, not complete
scene correctness, pixel parity, FPS, or historical corpus membership.
The browser and servers were closed and its temporary profile removed.

The paired `20261030T2258Z-dx-boids-software` run uses the same retained
module and SDK inputs. Its initial/final captures were also inspected: colored
flock triangles and cyan boundaries move on the software path. The host reports
`software`, no `D3DIMGpu`, and the UI identifies the DX2–7 WAT software rasterizer.
All 39 input and 38 served SDK response hashes pass. The OpenGL
`gl_sw_enabled()` value of zero does not describe the D3DIM backend.
The captures are from different animation times, so this establishes output
on both routes without pixel parity or FPS claims. This browser and its servers
were also closed, and its profile removed.

`--app=dx_globe`, `--app=dx_viewer`, `--app=dx_flip3dtl`. The binaries are the
DirectX 5 SDK samples in `binaries/dx-sdk/bin/`, and their assets (`sphere3.x`,
`mslogo.x`, the `.ppm` textures) sit beside the exe and are mounted by the
registry entry — `node tools/gfx-app-census.js --apps=dx_globe --list` names
the families each one reaches.

They matter out of proportion to their size: they are the smallest programs in
the corpus that drive the D3DRM path end to end, so they fail faster and more
legibly than the games that share it. `tools/gfx-app-census.js` counts 10 apps
reaching d3drm and 9 reaching d3dim, including the seven `scr_*` screensavers,
which all name an identical family set and move together.

## "Failed to load sphere3.x" was never about the file (fixed 2026-09-22)

The symptom was a message box reading `Failed to load sphere3.x.
D3DRMERR_BADFILE`, which names an asset and a file-format error and is about
neither. Everything that looks guilty is innocent, in this order:

- The file is mounted. `--trace-fs` shows
  `CreateFile("sphere3.x", ...) → 0x70000001`: the open succeeds.
- The `.x` parser never runs. The failure is upstream of it, in
  `DirectXFileCreate`.
- `--trace-api` puts it exactly: `HeapAlloc(hHeap=0, dwFlags=8, dwBytes=8)`
  returns `0x00000000`. A **null heap handle**, which real Windows also fails.

The null handle is the tell. d3dxof keeps its heap in a global that its own
`DllMain` fills in, and that `DllMain` never got that far:

```
[LoadLibrary] d3dxof.dll loaded at 0x816000, dllMain=0x821040
WARNING: DllMain did not return cleanly, EIP=0x81ac0e yield=0 halt=3
```

`0x81ac0e` is the return address of the `SetEvent` in d3dxof's one-time init,
so the initializer was abandoned mid-frame — after it had taken its critical
section, before it had stored its heap. d3drm.dll aborted the same way at
`0x519720`.

**The cause was in the host, not the guest.** `lib/dll-loader.js`'s
`callDllMain` ran the initializer and, on any halt that was not a cooperative
`Sleep`, restored the caller's EIP and ESP and returned — which is precisely
what the comment above that loop says must never happen. Halt 1 (block budget
spent) and halt 3 (the host asked for control) are scheduling signals, not
completion. Fixed by resuming the initializer for both, bounded at 64 resumes.

After the fix all three DllMains report `DllMain returned, EAX=0x1`, the
message box is gone, and dx_globe runs 346804 API calls in 20000 batches
against 911 before, drawing a lit, textured sphere.

**The general lesson, which is why this is written down:** a half-initialized
DLL fails arbitrarily far from `DllMain` and never mentions it. The error it
produces is whatever the first unwritten global happens to break — here, a
file-format error for a file that had already opened. `halt=` in that warning
is the fact that separates "wanted one more slice" from "genuinely stuck", and
it is printed for that reason.

## Where they stand now

Measured 2026-09-22 at 8000 batches, one capture each, on the fix above:

| app | API calls | distinct colours | reading |
|---|---|---|---|
| `dx_globe` | 346804 @20000 | 320 | **draws** — lit textured sphere, some texture corruption in one band |
| `dx_flip3dtl` | 31726 | 77 | draws something; April's note recorded 628 colours, so check a longer budget before calling it a regression |
| `dx_viewer` | 181247 | 5 | runs the loop, near-blank |
| `scr_geometry` | 25506 | 1 | runs the loop, blank |

So the loader fix cleared the entry blocker for the whole cluster without
finishing any of them except globe. The remaining work is scene output, not
initialization — and note that a colour count is a weak instrument: it cannot
tell a black background that is correct from one that is a failure, which is
what made "black output" a single diagnosis for four different bugs in the
older notes.

`mcm` (Motocross Madness) now reaches a modal instead: *"has detected a change
in your game, video hardware or driver installation. We must now test your
video memory..."*. That is a dialog to answer, not a render bug — see
`tools/startup-modal-sweep.js`.

## Globe blank after masked Execute branches (2026-09-22)

The masked BRANCHFORWARD implementation exposed a missing PROCESSVERTICES
side effect, independently of the loader issue above. Globe sets driver status
to 0x01fff000, transforms 56 vertices, then conditionally exits the buffer if
any common standard clip-plane bit (mask 0x0003f000) remains. Vertex processing
never updated those bits, so every triangle was skipped. Trace and guest record
dumps established the sequence; a temporary control restoring only the old
assumed-zero branch comparison recovered rendering and passed the Render-menu
test (222 / 2982 / 31713 point / wire / solid lit pixels).

The main-tree fix accumulates standard homogeneous clip union/intersection
status during transformation, keeping the masked branch comparison. See
[Execute review](../d3dim-execute-data-sparse-review.md) for scope and remaining
status/extent limitations. Viewer Open/menu browser coverage passed in both
scheduling modes before this fix, but does not prove its scene is rendered.

After the fix, the full build and Globe Render-menu test pass with the same
222 / 2982 / 31713 pixel counts as the control. Viewer also passes its CLI
mesh-selection / Change Color test. These are scoped regression results, not
certification of texture quality or the whole D3DRM/screensaver cluster.

## Original SDK source now located (2026-09-22)

The Microsoft DX5 SDK archive also contains the actual samples and English Word
reference manuals. Provenance and document hashes are recorded in the
[Execute review](../d3dim-execute-data-sparse-review.md). Temporary extracted
sources are at `/private/tmp/wa-dx5-docs.59DpEl/sdk-source/cdrom/sdk/samples/`;
they are not committed. In particular, `uvis/uvis.cpp` provides a direct example
of using ExecuteData extents to drive retained-mode ForceUpdate, despite its
PROCESSVERTICES record omitting UPDATEEXTENTS. This is a useful small source
reference for replacing our viewport-sized extent approximation. The geometry
and update rectangle paths both need testing; getting nonblank pixels alone
does not verify this interaction.

## Execute extents replace viewport substitution (2026-09-22)

SETSTATUS now installs its actual rectangle; flagged PROCESSVERTICES and
clipped raster coverage expand it across executions. See the
[Execute review](../d3dim-execute-data-sparse-review.md#execute-extent-accumulation-2026-09-22)
for regression coverage and explicit native-rounding/rejection limitations.

After rebuilding, Globe's Render-menu test passes twice (all 11 items), with
point/wire/solid counts 224 / 3642 / 13535. Those are changed, not pixel-identical
to the old viewport approximation. A 150-batch capture still shows the sphere
with the previously observed texture-band defect. Viewer passes mesh selection
and Change Color on CLI, and Open/Renderer-menu browser coverage in cooperative
and threaded modes. None of these assertions is a native rendering oracle.

An isolated old-code control reproduces 222 / 2982 / 31713. SDK `globe.c` moves
the camera on each callback, so fixed block-budget screenshots need not show
the same scene after extent-driven work changes. That is an explanation to
test with frame-aligned captures, not an established pixel-equivalence result.

Uvis is present as original SDK source, but neither local SDK binary directory
contains `uvis.exe`; its ForceUpdate route remains to be built or sourced and
tested. Do not treat source inspection as an end-to-end Uvis pass.

## Frame-aligned extent comparison (2026-09-22)

Globe's camera callback is `0x4016ec`; its static animation time is the float
at `0x40b104` (xref to the 0.08 constant identifies it). Comparing the old
viewport substitution against the new extent implementation at completed
callback counts 10, 50 and 100 yields **zero differing pixels** in all 640x480
primary captures, with identical animation times. Thus the earlier fixed-budget
image difference is absent at these aligned scene checkpoints. See the
[Execute review](../d3dim-execute-data-sparse-review.md#frame-aligned-globe-ab-2026-09-22)
for artifact hashes, control procedure and limitations. The texture defect is
present in both arms; this comparison does not fix or validate it.
