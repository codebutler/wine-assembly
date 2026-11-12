# Original Army Men paired capture: startup blocker

Historical source last updated, 2026-10-20. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

Task NEW-GAME-ARMY-MEN-DEMO, 2026-10-20 12:09 UTC. One actual
original-demo execution on authorized `bx_6czhvg6m` failed before Boot Camp.
**Acceptance not met:** no screenshot, selected BltFast call, HRESULT, or
pre/post pixel sample. Terrain stripe attribution remains unresolved. No renderer/source patch, retry, installer/license interaction, download,
worker launch, main integration, or local build occurred.

## Verified inputs

Verified the retained original installed game against the previous scroll
run's `pins.json`: 166 game files (40,952,601 bytes), plus MFC42/MSVCRT and
original registry. Original EXE SHA-256:
`dea8303de872789553f3190ad64e80bf3c0528a5d9d3cb18ad85e0c40664078c`. Transferred these existing files as an in-memory archive, without duplicating
local binaries. Reverified all 168 files and registry remotely. Destination:
`/home/user/army-actual-vfs`; DLLs were placed in `windows/system`.

## Actual failure and causal conclusion

The run used the unchanged observer preload, traced BltFast, cooperative
threads, 200,000-block batches, a 750-batch/90-second bound, and the prior
ordinary click/Numpad6 input schedule. It exited 1 at batch 0, before any
scheduled input. Full command is retained in `recovered/launch.json`.

1. Renderer initialization reported `Cannot find module 'pngjs'`, disabling
   screen captures and pointer input. `pngjs` is a declared package dependency.
2. Initial DLL graph resolution could not find `comctl32.dll`, `ole32.dll`,
   `mfc42.dll`, or `msvcrt.dll`. At this source's `test/run.js:5529`, initial
   PE discovery searches the EXE's `dlls` directory, EXE directory, adjacent
   Shared_DLLs directories, and `/home/user/icm-fullvm/test/binaries/dlls`. It does **not** search the mounted VFS's `windows/system` directory. The later runtime DLL lookup is a different path that does consult VFS.
3. The original guest trapped on `MFC42.DLL#1168`, IAT `0x66d8c0`,
   EIP `0x46fa54`, return address `0x4703be`.
4. `paired.json` reports `accepted:false`, zero records, and
   `Authenticated dispatch has unknown API metadata: <ord>`. Owner binding succeeded, but the unknown ordinal invalidated observation.

Thus the immediate cause is incomplete host dependency provisioning and the
chosen initial DLL search placement, not demonstrated game/renderer damage
or an absent MFC implementation. Merely mounting an intact installed VFS is
insufficient for this CLI startup route. The preflight verified bytes but
failed to validate renderer dependencies and initial PE resolution before
execution; that is a limitation of this attempt.

Per the assigned missing-asset stop condition, no provisioning fix or second
run was attempted. A coordinator follow-up must provision the declared
renderer dependency closure and verified original support DLL graph in an
initial-loader search directory (or an explicit reviewed DLL list), then
repeat the bounded original Boot Camp capture. Do not patch an ordinal stub
or interpret this failed capture as evidence for or against upward-copy
stripe hypotheses.

## Evidence and release

Self-contained evidence:
`scratch/runs/20261020-army-actual-scroll-newbox/`. Includes JS staging/verification/controller recipes, asset hashes, successful
source preflight, initial failed preflight (wrong manifest pathname), exact
Boat receipts, recovered launch/output/exit/observer results, archive and
hash inventory. The first preflight's incorrect
`/home/user/icm-fullvm/source-manifest.json` was corrected to the documented
`/home/user/icm-staging/source-manifest.json`; there was no access denial.

Remote evidence remains `/home/user/army-actual-evidence` and
`/home/user/army-actual-evidence.tar.gz`. Original ICM evidence is untouched. Runtime lease released on the messageboard at 12:09:32 UTC; box left running
for the coordinator's queued tasks, TTL 15:53 UTC. Local free disk remained
above 2 GiB. Only this report is committed; ignored execution evidence is
retained separately. No gameplay success or stripe fix is claimed.
