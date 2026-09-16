# Unreal-family demo installers

Status: verified locally on 2026-09-13. These are proprietary demos and remain
`localOnly` candidate-corpus fixtures. No host Wine was used.

## Sources

| Candidate | Archive.org item | File | Size | SHA-1 |
| --- | --- | --- | ---: | --- |
| Unreal Special Edition | `unreal-special-edition.-7z` | `Unreal Special Edition.7z` | 128,609,961 | `f3f25896a51cbf37dcdb94833198b86f394d8853` |
| Unreal Tournament | `unreal-tournament-demo-version-348` | `UTDEMO348.EXE` | 55,647,232 | `faf2c18852a1a53c59db490e044e0d3e100e8fed` |
| Unreal Tournament 2003 | `UT2K3Demo` | `UT2003Demo2206.exe` | 148,976,640 | `372a8b712cb7f2b1539af72430923d290a67e701` |
| Unreal Tournament 2004 | `UnrealTournament2004Demo` | `Ut2004-NewDemo.exe` | 296,049,152 | `5e224a3de711da9085cddd9929499789690043c7` |
| Unreal Tournament 3 | `setuput3demo` | `setuput3demo.exe` | 777,027,962 | `86d4bad740d0c25438a65c48939ee6dcfc88bb02` |

The host archive reader only unwraps the outer 7-Zip/WinZip container. Candidate
preparation then executes the original setup program inside Wine Assembly,
exports the VFS it wrote, and boots the installed game. This distinction is
enforced by `tools/install-unreal-demo.js`.

## Installer and launch results

| Candidate | Authentic setup result | Installed payload | Installed-game result |
| --- | --- | ---: | --- |
| Unreal Special Edition | InstallShield bootstrap launched `_INS*.MP`; license and destination flow completed | 191 MB, `System/Unreal.exe` SHA-256 `5fbc5853a8669a802446ac12e102351053bc6a5ce9f554b03483eb634269f408` | Software launch loads `SoftDrv`, opens `WindowsViewport0`, initializes the game engine/player, and renders the playable intro |
| Unreal Tournament 348 | Unreal `System/Setup.exe` completed | 104 MB, `System/UnrealTournament.exe` | Reaches the renderer-selection wizard |
| UT2003 2206 | Unreal `System/Setup.exe` completed with the shipped `MSVCR70.dll` | 344 MB, `System/UT2003.exe` SHA-256 `97e027dc9765f048beacfa461bc93c71ba1831cd3e8dff0cd7d71c1b478f88a2` | The D3D8 wrapper renders textured first-person Antalus gameplay; an authentic dedicated server and direct-connect client exchange the native protocol over `vln/1` |
| UT2004 new demo | Unreal `System/Setup.exe` completed with the shipped `MSVCR71.dll` | 525 MB, `System/UT2004.exe` SHA-256 `2a95e2fa8c22ae94eb1c361fdb49ea8ec44c5e2a93faa00831308c01e951db8d` | Uses the same pre-renderer D3D8 probe; further post-probe launch diagnosis remains |

Seeding the bundled Visual C++ runtimes matters. Without `MSVCR70.dll`, the
UT2003 setup appears to require unimplemented CRT imports beginning with
`wcschr`; with its own runtime loaded, setup completes without any new emulator
API. The same rule applies to UT2004 and `MSVCR71.dll`.

## OpenGL and software-renderer attempts

UT2003 and UT2004 both ship `OpenGLDrv.dll`. Their installed and default INIs
were changed locally to `OpenGLDrv.OpenGLRenderDevice`, fullscreen was disabled,
and the browser launch used `-opengl -window` with a real WebGL context through
SwiftShader. This still does not bypass D3D8: both main executables import and
call `Direct3DCreate8` during startup hardware detection, before either render
driver is loaded.

`Direct3DCreate8` now returns a deliberately narrow, non-rendering
`IDirect3D8` capability object. It preserves the complete 16-slot factory ABI,
implements COM lifetime, one adapter, one display mode, identifier and caps
queries, and deliberately returns `D3DERR_NOTAVAILABLE` from format/device
creation checks. An authentic UT2003 run successfully called
`GetDeviceCaps`, `CheckDeviceFormat`, `GetAdapterIdentifier`, and `Release`, so
the old missing/null-factory branch is gone. It still throws later, before
`OpenGLDrv` loads; this does not establish that an `IDirect3DDevice8` is needed.

Unreal Special Edition does not ship `OpenGLDrv.dll`; it has `SoftDrv.dll`,
`GlideDrv.dll`, and `SglDrv.dll`. Its former startup exception was an encoded
resource-submenu mismatch in `DeleteMenu`. With resource-menu deletion and
compaction implemented, a five-minute authentic software-renderer run loaded
`SoftDrv.dll`, opened `WindowsViewport0`, logged `Game engine initialized`, and
sustained the render loop. Its gray viewport was a separate USER delivery bug:
the viewport is a secondary top-level window, but `ShowWindow` only queued an
initial `WM_SIZE` for children. Extending first-show sizing to non-main
top-level windows made WinDrv allocate its 514x386x32 DIB and produced 159
successful `BitBlt` frames in a 65-second authentic run. The captured intro is
rendered and prompts `PRESS ESC TO BEGIN`. A subsequent controlled run traversed
Game -> New Game -> Easy -> player setup, entered the first-person level with
HUD active, and produced distinct before/after movement frames, so interactive
gameplay is verified rather than inferred from the intro.

The initial capability facade has since grown into a deliberately bounded D3D8
translation layer over the D3D9 backend. It preserves the exact 97-slot device
and 19-slot texture ABIs, translates D3D8 presentation parameters, textures,
vertex/index buffers and fixed-function declarations, retains D3D8's
`BaseVertexIndex` from `SetIndices` for indexed draws, and adapts the implicit
swap-chain argument of `GetBackBuffer`. Unsupported methods remain explicit
failures rather than silent successes.

An authentic `-d3d -window -nosound` run now reaches textured first-person
gameplay on DM-Antalus. The no-sound flag isolates graphics from the separate
missing Vorbis `ov_open` import. `test/test-ut2003-vlan-candidate.js` runs the
game's own non-rendering dedicated-server mode beside a direct-connect client.
It verifies native UDP in both directions over `vln/1`, waits for D3D device
creation before taking a PNG, rejects the loading screen and spectator join
prompt, and rejects the flat-pale weapon signature that exposed the rendering
bug.

Getting the textured materials working had two layers. D3D8 sampler controls
are texture-stage states 13--21 and 25, but D3D9 moved them into sampler-state
slots 1--10. Forwarding
the D3D8 numbers directly to the D3D9 texture-stage bank returned
`D3DERR_INVALIDCALL`, leaving filter and address state at defaults. Translating
those states activates the mip-atlas shaders; the native headless desktop GLSL
1.10 compiler then rejected their ESSL-only
`GL_OES_standard_derivatives : require` directive even though `dFdx`/`dFdy`
are core there. The desktop port now removes only that directive. The corrected
capture has a textured dark-metal/green assault rifle and textured terrain
rather than the former nearly uniform white weapon inside the native GL frame.

The remaining pale-rifle CLI capture was a headless presentation bug, not a
D3D8 material bug. WebGL requests an opaque default framebuffer with
`alpha:false`, but the native desktop GL context still stores fragment alpha;
the readback path passed those low alpha bytes to the software compositor and
blended otherwise-correct rifle RGB toward white. Headless readback now honors
the requested WebGL contract by forcing alpha to 255. The focused regression
draws RGB with alpha zero and verifies opaque readback, while the frozen VLAN
replay verifies the textured rifle survives composition and that held movement
changes the first-person scene.

The final acceptance was repeated from a clean worktree at commit `fecc3e2f`.
The authentic dedicated server entered DM-Antalus, the client and server
exchanged native UDP through `vln/1`, the client created its D3D viewport, Fire
transitioned it from the join prompt to an owned pawn, and the captured frame
showed the HUD plus textured weapon and terrain. Both emulator processes exited
cleanly. The committed wall-clock test proves join and rendered gameplay;
deterministic held-key movement was additionally proved with a frozen
`tools/ctl.js` replay.

A fixed-wall-time profile of the map-load window (batches 6000--12000) retired
938 million handler operations. Raw x87 instructions were 26.85% of them, with
no single block over 2.23%, so the load is broad Unreal transform/material
work rather than one stuck loop. Enabling the existing experimental x87 fold
executed 27.3 million fused regions and advanced 25,179 batches in 140 seconds
versus 20,818 without it, about 21% farther on this run. The CLI candidate uses
`--x87-fusion`; browser runs can opt in with `?x87-fold`.

SSE is now a separate per-app CPU policy rather than a global claim. The
`ut2003_demo` client and server advertise a Pentium III with CPUID EDX bit 25;
the default personality and the not-yet-exercised UT2004 entry still hide SSE.
Following the authentic UT2003 path added the instructions it actually reached:
exact `SFENCE`, `MOVNTQ`, memory `MOVLPS`, all eight `CMPPS` predicates, and
`MOVMSKPS`. Unknown SSE encodings continue to trap.

That policy also selects three MSVC/D3DDrv 64-byte MMX copy loops, including a
79-byte three-register pipelined `MOVNTQ` body at original D3DDrv VA
`0x10001100`. Each is recognized by a complete address-independent byte hash
and lowered through H419 to `memory.copy` only for proved-disjoint, page-local
mappings; overlap and split mappings retain the original instruction ordering.
The regression compares ordinary decoding with each lowering for copied bytes,
GPRs, flags, final MMX registers, overlap, page splits, and a one-byte near miss.
A clean authentic run reaches D3DDrv with no SSE decoder trap, but the shared
machine was under heavy concurrent load during the final timing run, so that
run is evidence of compatibility, not a defensible wall-time speedup measure.

The CLI software D3D backend reaches the same engine loop without an
unimplemented API but rejects its GPU draw opcode; the native/browser WebGL
backend remains the authoritative graphics verification.

## UT3 API analysis

The fixed UT3 installer was executed directly in Wine Assembly. Its verified
first runtime blocker is:

- `UuidToStringA` at installer EIP `0x00422225` (batch 0).

Static PE import comparison against `src/api_table.json` found nine imported
names which are not implemented:

- `AdjustTokenPrivileges`
- `GetThreadContext`
- `LookupPrivilegeValueA`
- `RpcStringFreeA`
- `SetThreadContext`
- `UuidToStringA`
- `VerLanguageNameA`
- `VirtualProtectEx`
- `WriteProcessMemory`

Installer strings also name seven MSI APIs resolved dynamically, so they do not
appear in the static import table:

- `MsiCloseHandle`
- `MsiGetProductInfoA`
- `MsiGetSummaryInformationA`
- `MsiOpenDatabaseA`
- `MsiQueryProductStateA`
- `MsiSourceListEnumSourcesA`
- `MsiSummaryInfoGetPropertyA`

Only `MsiQueryProductStateW` currently exists in the API table. `UuidCreate` is
already implemented through `CoCreateGuid`. This is an analysis inventory only;
none of the UT3 gaps were implemented.
