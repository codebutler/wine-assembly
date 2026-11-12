# Independent acceptance: bounded original Deus Ex Training

Accepted candidate `45d125cba932e8a91f87fceedc7f42b4f2e7cd7e` for evidence-only integration. Tested engine/source revision is `c26252c4a95babe583ade1d1c6e2da0c050be45c`, with shipping module SHA-256 `f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7`. No build or runtime was repeated for this review.

The actual candidate parent is c26252c4, not the preceding blocked-report commit 3bd7e25c. Full ancestor/delta inspection found exactly 65 added files, all under `scratch/runs/20261022-deus-ex-native-support-training/`. The prior failure logs and mapping are retained there as `prior-*`; no blocked-report ledger edit, engine change, guest binary, or unrelated candidate ancestor delta is being integrated.

Remote main initially matched c26252c4, then advanced during task-branch publication to `a6c68f4565a35f783a95e3d7b5d0a1c7f1c46500`. The final integration reconciles that main revision without conflicts and preserves its entire tree outside the two evidence directories. Its concurrent production changes are outside this review's ownership. This historical evidence does **not** qualify the advanced engine/module; the tested revision and module remain explicitly c26252c4/f644bbb2.

## Independent visual and runtime judgment

All six original PNGs were opened directly in this review:

- `intro-3000.png`: Deus Ex logo/intro scene.
- `menu.png`: ordinary main menu with Training available.
- `menu-selection.png`: ordinary menu after Down-arrow selection; subsequent Enter leads to Training.
- `training-before.png`: UNATCO Training Facilities title, rendered entrance hall, health/compass/key-ring HUD and distant central door.
- `training-after-movement.png`: that door now fills the view, with Unlocked targeting label and Jaime Reyes transmission. This is a changed viewpoint and scene geometry, not just an animated overlay.
- `training-settled.png`: door viewpoint remains, transmission text advances to opening-door instructions.

The 35 recorded control requests use only normal keys, stepping, snapshots, PNG capture and quit. Raw input delivery records Up down at batch 3828 and release at 3978; the movement capture is at 3982. A further 400 batches reach 4382 without a Wasm trap or unimplemented-API failure. That interval advances the configured guest clock by 10 seconds; its control operation spans 12.656 wall seconds. The run reports 284.972 total wall seconds and exits 0 following the normal **control-driver quit request**. This is not evidence of exercising the game's Exit menu or all guest shutdown paths.

The log retains three thread-1 `EIP=0 (likely call/jmp to NULL)` diagnostics before menu input, and final thread 1 is exited. They did not prevent the observed route; this review does not characterize them as correct thread behavior or claim a warning-free log. Generic missing-native COMCTL32/SHELL32/OLE32 warnings also remain visible. No held thread-lifetime work was investigated.

## Integrity, support closure and limits

`verify.py` and `checks.json` record passing read-only checks: all 64 seals and all 65 candidate blobs; 192 source/support files against accepted Git objects; accepted source-tree equivalence; all 112 local game assets (233,696,463 bytes) and EXE/Core/Entry pins; archived shipping module bytes/hash; all 13 runtime archive files (including empty launcher log), with byte equality for every separately retained member. The historical pre/post receipts both verify 192 sources, 112 assets and the same module; the post receipt additionally verifies MSVCRT.

The complete recorded app registry equals accepted `lib/apps.js`, including its pre-existing SoftDrv/fullscreen INI transforms. There were no task-specific engine, loader, API, guest binary or injected guest-state changes. Normal accepted loader import relocation and registry transforms are part of the tested route, so “unchanged” does not imply an absence of ordinary loader activity.

Native MSVCRT is pinned to `887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1` (278,581 bytes). Its preserved VC6 provenance is byte-identical to the accepted source ledger. Its game-imported exports, including `_vsnwprintf`, are nonzero and non-forwarded; its imports are only known KERNEL32 APIs. All five saved native `objdump -p` outputs were independently regenerated read-only and matched exactly. The optional shell/OLE/SHLWAPI native route was audited but never staged; the selected graph contains only 14 game DLLs and MSVCRT. Existing accepted handlers/ordinal mapping cover the fully enumerated imports from the three warned libraries. Static API membership alone does not prove arbitrary paths; `FindWindowExW`, dynamic imports and optional native-route gaps remain unqualified.

`node ops/check-run-evidence.js .` passes with one run and empty errors/missing/invalid arrays. Full `git diff --check c26252c4 45d125cb` reports only five blank EOF lines in sealed objdump files and three trailing-space raw stack-dump lines in run.log. These are deliberately retained original evidence, not edited to manufacture a clean raw diff. Diff checks excluding those six raw artifacts pass; the independent review additions pass unfiltered checks.

Acceptance is limited to original menu → Training world/HUD, ordinary Up movement, short continued activity, and control-requested exit 0 on Node v24.18.1, cooperative `--no-threads`, SoftDrv, 640×480. Windows parity, browser execution, FPS, audio, long sessions, complete Training and full-game completion are not established.

## Resource and lifecycle handoff

Fresh prewrite admission: 8,127,905,792 available bytes, above the mandatory 2,982,150,144 floor. Sparse selection was measured before checkout: 69 files / 9,029,223 bytes plus 32 MiB reserve, within the 64 MiB total allocation. An isolated shared-object checkout avoids copying the repository object store; no game/package/archive duplication or extraction was performed. Root index/config/TODOS/STATUS are protected and unchanged.

Historical REPORT/RECOVERY statements that the box was running describe the worker's original handoff. They are superseded by the coordinator's completed snapshot-stop at 02:31:52 UTC, operation `stop_f140fbc0f89e7b21`, box `bx_2gnkcnac`; original expiry 03:44:34.864 UTC. This review did not access, resume, stop or delete the box. Lifecycle ownership remains with the coordinator. No workers/delegation/refill. Task ends after verified publication and board handoff.
