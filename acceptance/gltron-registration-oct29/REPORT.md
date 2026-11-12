# GLTron original registration: independent rejection

Candidate: `9b32086c679c690988ecd7824bdcc4401cd344f6`.

The original staging API and unchanged production `WineAssembly.loadFiles` successfully stage and mount all 92 files (4,968,893 bytes) into real `VirtualFS`, matching every accepted original inventory hash. Missing original payload rejects. Registry assets are required/eager. Static inspection of pinned `test/run.js` confirms registered exe selection at lines 1263–1265, exeGuestPath at 1272–1274, and workingDirectory at 6184–6190. No headless runner initializers or guest execute.

## First independent defect

`host.js:4266` returns fetched eager bytes, then at 4271 assigns `asset.data`; at 4289 it mounts those bytes directly. The required-entry declaration checks load mode and valid declared size, but does not compare eager payload length/hash with the declaration. Therefore a corrupt required GLTron asset is accepted despite the registry's exact SHA-256.

Reproducer: `accept.js` evaluates the complete pinned host without transforming its source and creates a host prototype with real VirtualFS. After the valid full-original control passes, the fetch adapter flips bit 0 of byte 0 in a newly allocated buffer for `art/classic/artpack.lua` (26 bytes). Retained media and staged files remain unchanged. The loader resolves successfully and mounts the corrupted bytes:

- Expected hash: `0c6659ff22677def541cd810cabbd5ae0e0f20ed83a42b7f4447b95cfe82acc6`.
- Corrupt/mounted hash: `dd6b6660624ad3f41821eed577397d82289a95db3b26cf1c81a8862f2a81ca8f`.
- Actual loader error: none. Independent assertion exits 1 with `DEFECT: production loadFiles accepted and mounted a same-size corrupt required GLTron asset despite pinned SHA-256`.

This is a deterministic fetch-buffer corruption test, with no concurrent filesystem mutation. Original media staging verification itself passed; this result does not claim a defect in its hash check. The loader does not provide end-to-end integrity for the pinned original inventory.

## Reproduction and scope

The task-owned `supervisor.py` enforces explicit owned cwd, Git identity checks, fresh disk/RAM admission and bounded subprocess lifecycle. Its `exec` mode runs:

```
/usr/bin/node --max-old-space-size=64 acceptance/gltron-registration-oct29/accept.js
```

Run only through the supervisor from the assigned task directory with the exact dispatch, object-store and original-source pins available. The initial destination `/tmp/gltron-registration-independent-accept-oct29/stage` must be absent; it was removed at closeout after evidence capture. Startup uses the same Node binary, flags, environment and child limits as acceptance. Valid original control is required before the corruption assertion.

Acceptance stops at this first concrete defect. New staging symlink/overlap/absent-parent, copy/cleanup-failure and actual CLI adversarial groups remain unexecuted. Prior unchanged static PE/import closure acceptance is reused by reference to dispatch `priorReview` and `canonicalReceipt`; no census or objdump replay. Production stage code was reviewed, without repair. This is bounded source/loader acceptance, not gameplay or general concurrent-filesystem safety. No build/browser/guest/Boat/FUSE/download/installer runs, no main publication, no donor changes. No test box assigned.

## Controls and incidents

Omitted/root/donor/outside subprocess cwd controls reject before spawn; owned pwd sentinel succeeds. Original and corrupt asset hashes are retained in `acceptance.json`. All production subprocesses ran in new process groups, were killed/reaped at closeout and stayed below prescribed RSS/capture/CPU/wall limits. Resource admissions passed; no limit was increased or allowance reset. Initial read-only policy/receipt output exceeded the terminal cap and was truncated; retained as a procedural exception. This does not affect the separately captured production acceptance output. Allocation remains retained for coordinator closeout and board delivery.
