# Independent host census reconciliation

ACCEPT the two already-integrated producer changes on exact main
`80f8278a90ed17767ede71f15b5ceff432da5ac4`. This correction changes only the
two census hashes/review reasons, focused tests and this report/evidence.
No production code or scanner changes. All 401 entries retain their kinds
and `ownership: pending`; nonlocal API/handler locks remain closed.

## Complete source review

Both prior SHA-256 seals match the actual file bytes at
`2ae81e4025f76cd0f699034e27af38e553318755`. Reviewed the entire Git diff from
that revision to exact main, not merely the most recent commit. The preserved
`entire-producer-delta.patch` contains exactly:

- `lib/apps.js`: `b000885e252d926919eee8bedc544bba601dc897` adds the local
  Hock selector tuple and EXE/empty files/required generated manifest data.
  No executable callback, new closure, context restoration, run policy or
  ownership transition is introduced. The lexical `load_pe` match keeps this
  data file conservatively inventoried; no exemption is appropriate.
- `lib/browser-shell.js`: `52c165ee0c6018f6691ac6497496c20225f8b05f` adds
  `launchOpts = launchOpts ?? {}` before every public launch branch. Only null
  and undefined receive a fresh object; supplied objects, frozen objects,
  showCmd zero, callback references and retained asset maps are preserved.

Reviewed createLaunchContext/cancelLaunch, public launch guard/finally,
pending and cancelled-restart queues, launchAppInner failure/stop hooks,
beforeRun, launchExe/launchVfsExe and host.js process_spawn ownership.
The normal queue keeps the original options reference and waits for parent
exit when requested. A tracked child still uses bypassSingleApp. A live boot
rejects reentrant launches; cancelled boot replacement waits for cleanup.
Restart dispatch already spreads options to add directIntent: outer object
identity changes there, but callback and retained-map identities survive.
Normalization introduces no await, dispatch or cleanup and changes none of
these existing lifetime rules.

beforeRun is still awaited after DLL setup and before registration/running.
The stop hook still calls onExit in finally; failure still notifies onExit(null).
The tracked-child onExit closure in host.js is idempotent, preserves an already
authoritative exit status, and belongs to the published process object;
beforeRun rejects retired objects before/after awaited attachment calls.
The shell does not promise exactly-once invocation for arbitrary caller hooks.
No guest invocation tokens or restoration proof are added by this correction.
No production defect was found in the reviewed delta.

| File | Previous seal | Reviewed exact-main seal |
| --- | --- | --- |
| lib/apps.js | ae48052ee3b6b827d99b2a61ca74ad934d382d6737a686297fa9cebb58a2a22f | 09aa50e962aae8c8de0495d1820ce2737e0a091092e795688fcba5da62144669 |
| lib/browser-shell.js | 705eed3d465244d383b89d9aacfec98fa7bfbed6282d64040aca6daa2accaa67 | bcc096641ebe4cd587aed5abbf160ef73dfee5bdaae96ad4a7581cec60e6d318 |

## Validation and rejecting controls

The baseline gate reproduced exactly two changed host-file SHA diagnostics.
After correction the unchanged full source scanner accepts all 401 entries.
The metadata comparison checks that only sha256/reason in these two rows
changed and their hashes match real file bytes; all production sources and
the gate implementation remain byte-identical to exact main.

- `node test/test-callback-ownership-census.js`: existing fixture, two lifetime
  and nine startup mutations pass; six new real-source controls reject loss
  of required Hock files, overwritten options, truthy showCmd, discarded
  restart options, omitted onExit and omitted beforeRun. Each must produce
  the exact host-file hash diagnostic while retaining the source inventory.
- `node test/test-browser-launch-options.js`: 13 existing PE-boundary cases
  and five invalid show commands; added actual scheduling/public-entry source
  slice verifies object identity, parent-exit queue, live-boot reentrancy,
  cancelled replacement callback/map identity and exception cleanup. Inner
  PE loading is stubbed in this slice; this is host transport conformance.
- Four independent in-memory behavioral mutants exit 1: remove normalization,
  replace showCmd with a truthy default, discard queued options, discard restart
  options. Production checkout bytes are never mutated by these controls.
- `node tools/callback-census-reconcile.test.js`: existing two WAT producers
  and 14 rejecting controls pass. Unknown/stale/duplicate inventory, false
  ownership claims, whole-body sealing and nonlocal locks remain enforced.

Raw logs, commands/exits, entire producer delta and mutation driver are in
`army-host-census-reconcile-20261021-evidence/` adjacent to this report.
Run from a complete checkout at the resulting revision; the negative driver
takes the control names listed in results.json. SHA256SUMS.json seals evidence.

## Limits and handoff

Read the prior exact-main canonical failure at
`scratch/runs/20261021-army-current-main-runtime/report.md` and
`evidence/build.log`, and the accepted toolbar independent source review.
No repeated archive/gameplay acceptance, full build, module creation, browser
or guest runtime was performed. The coordinator must run canonical build and
Army Men qualification on the resulting exact revision. No current module hash,
Boot Camp/input/scrolling, stripe, audio or FPS acceptance is claimed.

Run/branch: `scratch/runs/20261021-army-host-census-reconcile` and
`task/army-host-census-reconcile-oct21`. New isolated sparse shared-object
checkout; preflight verified selected objects and projected 36,832,101 bytes
before materialization. Local allocated task size is about 40 MB, below 64 MiB;
free space exceeds floor 2,285,895,680 plus 600 MiB. Root WIP, shared config,
laptop HeroesII/WarcraftIII, fleet and deployment were not changed.

Fresh main reconciliation and normal task/main push receipts are retained in
local publication.json and the append-only root messageboard. Recover source
and evidence by fetching the published task commit; the local alternate object
chain is not itself a backup. No ignored module or game assets are needed to
replay these source-only checks.

`bx_e8a7pw8v` is left untouched, coordinator-reported RUNNING/idle, expiry
`2026-10-21T12:21:46.313Z`. No new observation, access or lifecycle action;
coordinator owns shutdown and the same-box repair/retest handoff. No workers
or refill. Stop after verified integration and result publication.
