# Shadow Man: genuine DSETUP and truthful VERSION qualification

Source integration reviewed 2026-10-22 against remote main
`89f1e9d2c67aa94d56d2319115589d07204d42e0`. This qualifies source and a
native primitive, not an installed configuration, game, browser or Windows parity.

## Accepted source

Exact source chain (each commit is the next commit's parent):

1. `7a21579f9adb208164312961c249a0aa9080a8b7`: app-local DSETUP PE loading;
   no invented DirectX registry/file versions; ANSI VERSION handlers use named
   file resources, as the wide handlers already did.
2. `c2f50288da9e5a85995184c60bb2b94bdce35dd9`: two producer census seals,
   renewed after complete deltas from their recorded seals were reviewed.
   All 407 boundaries and ownership classifications remain; both remain pending.
   [Complete seal review](../../scratch/runs/20261022-shadow-man-dsetup-census-fullmodule/REVIEW.md).
3. `0ee5103fbe521b9c5ea577716d67b155f14f9e11`: truthful retained-region
   owner. All 269 region records are identical except this owner; no placement,
   size, alignment or generated region-map change.
4. `c9681105dd96ab31a8a709eeb61242ad5ad60cae`: two fixture GUEST_BASE
   literals use the generated symbolic base. Extracted production functions and
   observed fixture behavior are unchanged; six rejecting controls pass.
5. `84f2a0165798f30d7a131dccdcc054a224fbf57b`: static-DX test connects
   ctx.exports and optionally reads WA_TEST_WASM. Assertions are preserved.

The integration imports exactly these 15 changed source/test/census files into
main's tree, with focused documentation and evidence. It does not merge the
large ancestral evidence trees. All 3,426 qualified closure inputs match the
last source tree by Git blob ID and mode. Production and build tools match the
canonical-built c9681105 tree; 84f2a016 changes only its JS test consumer.

DSETUP has no bundled URL or native API substitute. Supplied original bytes
follow ordinary graph/scoped loading, relocation, import binding and DllMain.
The original PE is not patched outside ordinary production loader operations.
The VERSION A handlers retain existing named-file parser/copy/error behavior and
stdcall cleanup. The W handlers and resource helpers are byte-identical to base.
The obsolete 92-byte DX_VERSION_INFO allocation stays reserved without its
fabricated initializer. This avoids moving unrelated allocations.

DDRAW/DSOUND/DPLAYX/D3DRM/D3D8 file-presence placeholders retain staticModule
and have no RT_VERSION. Only explicitly synthetic marked retained placeholders
refresh. Unmarked installed files and real resources are preserved, even when
their numerical versions equal the old defaults. Fresh/reset registry does not
seed DirectX Version/InstalledVersion; imported values remain verbatim. Old
snapshots cannot distinguish historical synthetic defaults from installer values.
OPENGL32 placeholder metadata is unchanged and is outside this qualification.

Truthful absence can change prerequisites across games. Historical AoE2,
NFS II, Crimsonland and Total Annihilation checks may warn or fail without real
metadata. They have not been retested. No version minimum or capability claim
is substituted to hide that compatibility risk.

## Evidence and limits

Each evidence commit below is on its corresponding
`task/shadow-man-<task>-oct22` branch. Its report/verifier directory is
`scratch/runs/20261022-shadow-man-<task>/`. Local immutable donors are
`/home/user/wine-assembly-shadow-man-<task>-oct22`.

| Task | Exact evidence commit | Accepted result |
| --- | --- | --- |
| dsetup-independent-accept | `4d7c40955935ec466b9e30b44c520b60048335a6` | Five independent focused checks; original repair's 23 checks/four rejecting controls retained |
| dsetup-census-fullmodule | `8a645bbdc386b426bb7aaf00ecf666b64446f757` | Complete producer-seal deltas; 407 boundaries; rejecting producer/structural/nonlocal controls |
| dsetup-region-fullmodule | `e7adc994f4d56a1e8e6fc72267d6ac9cfc9b5d8c` | Exact 269-record layout preservation except owner; bad-owner/layout controls |
| dsetup-fixture-fullmodule | `444c44404d4e9ab51e6d4d20898fd4c95db661a0` | Six fixture rejects; all 51 cheap shipping checks; one canonical build, 22.0846 seconds |
| static-dx-harness-qualification | `59367d20599e8935b5464a692350418f95bf9e19` | Missing-context 6 PASS/6 FAIL becomes corrected 12 PASS; absent-file control rejects; four exact canonical-file instances |
| pinned-dependency-qualification | `a90e0dac5bea1594825c6a135c3f39fc1a40dd0a` | Remaining nine commands pass; 23 exact codec files/PNG roundtrip; eight observed canonical instances |
| genuine-dsetup-native-abi | `73d0d49f8d692028a90bac362647fdc24dcc4b14` | One retained canonical instance; genuine DLL and five optional-output/cross-page ABI cases |

Canonical primary: 1,879,387 bytes, SHA256
`ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553`.
Compat: 1,881,960 bytes, SHA256
`65f6242b586877f000fabdf5f7f516d62f1c2d7894658dff4ef075f90f7d8f65`.
VERSION/NE default test receipts passed separately compiled full-source test
modules; they must not be described as exact canonical-file executions.

The pinned dependency phase disclosed one redundant no-ILT full-source compile
outside its allowed extra-export condition. It was not another canonical
artifact build. Its unchanged PID observer did not independently enumerate all
Worker instances. Eight observed canonical instances are not an exhaustive
Worker census. These limits remain in the accepted reports.

Original DSETUP: 135,680 bytes, SHA256
`5112c736fa664cfd658c465fad781fe7ffd2753470cbcf7019b5a6ab08c4800f`.
Genuine DllMain returned EAX=1 and the mapping was LIVE. GetProcAddress ordinal
11 returned 0x5048b0 from handle 0x503000 (RVA 0x18b0); all 71 primitive bytes
matched the original. All four optional-pointer combinations and one safely
mapped unaligned cross-page DWORD case returned EAX=1, ESP +12 from genuine
entry (return plus two arguments), supplied DWORDs zero, surrounding guards
intact. The 99 names across six DLLs were bound names, not 99 executed APIs.

Each call actually observed hostRegOpen for HKLM Software\Microsoft\Directx
return handle zero/not found. No RegQuery/value read occurred. Win32 error 2 is
inferred from the unchanged handler, not separately observed at the x86 return.
The pristine registry before/after matched. Installed registry remains UNKNOWN.
Safe mapped cross-page writes do not qualify invalid-pointer behavior. Existing
zero-capacity VERSION success/limited last-error behavior is inherited, not a
new Windows conformance claim.

Previously accepted 1,959 installed payload hashes do not qualify installed
configuration, prerequisites, gameplay, browser behavior or persistence. Those
remain unqualified. No original files were substituted and no expectations or
gates were weakened to obtain acceptance.

## Recovery and lifecycle

[Integration recovery and verification](../../scratch/runs/20261022-shadow-man-dsetup-qualified-integrate/RECOVERY.md)
preserves the focused manifest, exact acceptance associations, current-main
reconciliation and publication procedure. Original inputs and Wasm artifacts
are ignored binaries, not backed up by Git. Use the existing sealed recipes and
coordinator-owned snapshots; no runtime recovery is authorized by this note.

At integration both test boxes were already STOPPED. bx_f3gs8qm2 snapshot-stop
completed 2026-10-22T22:46:32.825Z, stop_38d961094a7b2634, error null; the
retained source/modules/evidence root is
`/home/user/shadow-man-dsetup-canonical-qualification-oct22` in its snapshot.
bx_m4xrrj5a installed snapshot remains stopped (completed
2026-10-22T20:31:48.291Z, stop_58ff8c00e35a74e8). Coordinator owns lifecycle.
This integration neither queried nor changed runtime state.
