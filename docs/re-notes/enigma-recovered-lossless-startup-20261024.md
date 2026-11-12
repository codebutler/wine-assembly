# Enigma recovered-capacity lossless startup, 2026-10-24

Historical source last updated, 2026-10-24. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

Exactly **one authentic-unpacked diagnostic startup** rejected its first requested PNG at batch **30000** with `AssertionError [ERR_ASSERTION]: capture byte limit`. The stack identifies the accepted `tools/lossless-capture-png.cjs:55:10`, its final rejection after strategies **3 then 0**, level9. Both candidates therefore exceeded the unchanged **131072-byte** single-frame bound; their exact lengths were not recorded. The durable capture receipt says `artifactAccepted:false`. No PNG or rejected pixels were retained. **Scene, menu, Lua dynamic-loader entry and gameplay remain unknown.** This is a concrete capture blocker, not packed-original acceptance. No second guest ran and no compression semantics or bounds were changed.

The remote supervisor and enclosing shell returned **1**. Its `&&` dependent file is absent. Cleanup issued TERM, required no KILL, waited/reaped the child (returncode -15), and verified `remainingGroup:false`; subsequent inventory found no owned guest Node process. Raw output is **48479 bytes**, below the unchanged131072 output guard. There is no `[input] png FAILED` continuation or later literal-plus regex exception. The conservative local API wrapper also raised on CLI exit1 despite its allow-exit argument; its original traceback and complete unchanged response are retained. Copying that response to the normal receipt filename was bookkeeping only, not a repeated execution.

## Actual observations

The log retains exactly **16 API records**. First: GetProcAddress(IsProcessorFeaturePresent), followed by LoadLibraryA(DDRAW.DLL), LoadLibraryA(shfolder.dll), and GetProcAddress(SHGetFolderPathA). Later retained records include TrackMouseEvent, jpeg.dll functions and libpng12-0.dll. Eight native providers loaded. FindFirst/FindNext records include compat.lua, startup.lua, zero-byte enigma_conf.lua, models files, ant.lua, level/index paths and graphics files including enigma_logo3.png. These establish filename/metadata observations, not an exact Lua entry/cache branch or rendered scene. Ordinary `[FS]` read logs are absent. Final four-counter totals were not reached. The full API list and raw output are adjacent.

The historical rejected frame was never retained. The accepted synthetic1103667→4156 fixture was not original-frame-fit proof; this actual startup now establishes rejection under the accepted two-strategy encoder, without preserving its pixels or encoded candidate sizes. No pixel inspection or menu claim is possible.

## Configuration, gates and identity

| Input | SHA256 |
| --- | --- |
| accepted lossless encoder, packaged sibling | 537acd267b07490bca0694116b0fbc20a81d553487dac2606be27ec20811f03e |
| accepted terminal adapter | 458677a467a9bb2abc67244fb7319423166e4c7185339e02fc579b2145702851 |
| unchanged original capture | 6d64a146f2daf8b598dbf13e3c13f890dbc783d8f5286aacba6d343758d22079 |
| original complete supervisor | 73be15954cedc19340779ff6bda2397cb94927ca702d2baebdccd5e763cf7b73 |
| unchanged canonical runner | 4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809 |
| historical WASM | 8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686 |
| full staging manifest | 4ccbdd4e9bab80a88bf9565f813681c5369e4b16ef5dcd34291b87c361a793fe |

FindFirst adapter c7d43b204bae560d421d11d326b336737b5f0d14b0cb271971b57b63d0aa16ed uses accepted filesystem542ecac68e15882d9f5455e89c2c92198d3e3042b53b599b29706a6668fcb3b1. QuietFS remains cc9bb22fb39058b581883f836724f7a62eaf8dfbe2d2e42f3cd765f3abd8741e. Module sourceb41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a, ABI291/layout9a3bc9149d58209c, is unchanged; no build occurred.

Fixed640x480, firstPNG30000, max10000000 batches, runner55seconds,512MiB arena/Nodeheap512, CPU90/wall60, original16 API records and four counter PCs are unchanged. Single131072/cumulative393216/max3 and dimension bounds are unchanged. No optional dependency download, fabricated API, clock/input/batch change or public deployment occurred.
