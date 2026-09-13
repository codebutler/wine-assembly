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
| UT2003 2206 | Unreal `System/Setup.exe` completed with the shipped `MSVCR70.dll` | 344 MB, `System/UT2003.exe` SHA-256 `97e027dc9765f048beacfa461bc93c71ba1831cd3e8dff0cd7d71c1b478f88a2` | Its pre-renderer D3D8 calls now complete through the capability facade; a later C++ exception still occurs before `OpenGLDrv` loads |
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

An explicit UT2003 `-d3d -window` run still stops during capability probing:
it calls `Direct3DCreate8`, `GetDeviceCaps`, and `CheckDeviceFormat` for DXT3;
the facade deliberately returns `D3DERR_NOTAVAILABLE`, the game releases the
factory, and `CreateDevice` is never called. Direct3D gameplay therefore needs
a real `IDirect3DDevice8` translation layer, not merely a renderer flag.

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
