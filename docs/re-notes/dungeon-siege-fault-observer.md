# Reserved-page observer source candidate (2026-10-19)

Historical source last updated, 2026-10-19. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

This candidate descends from main6cfc0d936 (Surface and debugger watch fix)
through merge166f84855. The held Dungeon `reservedPageFaults` registration
remains a candidate, not a qualified startup fix. No original bytes changed. The prior resolver-first capture found an intact SHFOLDER table; it did not
observe the later failing fault. Existing MSVC controls passed before this
new instrumentation, not after it.

## Hook and observation contract

`g2w_miss` adds a disabled-by-default per-instance observer inside mode5. `set_reserved_fault_observer(1)` arms at most256 reserved-page misses;
`set_reserved_fault_observer(0)` disables it. It does not select fault mode,
flush/change JIT policy, modify reservations, or change exception disposition. No guest address is hardcoded. Reservation membership releases its lock before
the synchronous host callback. Original eligibility/handler/translation/sentinel
paths remain; their successful early return emits its outcome first when armed.

The existing two-argument `unmapped_trace` import carries tagged observations;
`get_reserved_fault_observer(field)` exposes phase, ID, API depth, raising,
sync-active, sync epoch (fields0..5), and count (other fields). The host routes
tagged events to `ctx.reservedFaultObserver`; missing callbacks fail explicitly. Ordinary untagged fault census behavior remains. No import/Win32 API ID changes.

Phase1 precedes the eligibility check and handler. Phase2 means mapped after
the synchronous handler returned true; phase3 means it returned false (including
its own sync/thunk eligibility refusal); phase4 means true but still unmapped;
phase5 means API-depth skip; phase6 means raise skip (takes precedence if both). Pre-event gates and sync epoch disambiguate phase3; it must not be described as
proof that a guest filter ran. IDs/EIP are locals across nested handler calls.

`tools/reserved-fault-observer.js` reads registers, four64-byte contexts (fault,
stack, ESI, EDI), existing PTEs, at most16 FS frames with four candidate MSVC
scope levels each, and at most128 matching reservation records. Missing bytes
remain holes. It never calls `g2w`, guest execution, allocation or commit APIs. Shared PTE reads use Atomics; reservation observations are not a global atomic
snapshot and report count changes. PTEs are reloaded per byte; page summaries
hold the last observed PTE, not a single stable mapping for all captured bytes. Reservation replacement at the same count is undetected. Registers, bytes and
metadata need not represent one instant; outputs explicitly say `atomic:false`. Scope interpretation is explicitly candidate. Reads continue beyond holes and
retain address/offset-tagged mapped fragments; incomplete reads have `bytes:null`
and exact missing spans, never a fabricated full buffer. Direct mappings below
GUEST_BASE, including wasm offset zero, match the production fast path.

The paired collector checkpoints pre-state before handling (so a nonreturning
handler leaves evidence), retains at most64 pending ancestors and16 successful
summaries, and stops on the first nonmapped outcome. Success does not consume
the observation. Reaching event256 successfully instead saves an explicit
budget-exhausted outcome. Saving then throws `RESERVED_FAULT_CAPTURED`; the
caller must terminate this instance, never catch-and-resume it. This applies to
**every** observer, snapshot, checkpoint, save or protocol exception, not just
the distinguished capture error: SEH globals can remain unrestored after any
host throw. The collector poisons itself on every exception and rejects later
events. IDs must increase without reuse and outcomes must follow LIFO nesting. The future controller must unconditionally terminate the instance on any such
error; catching/logging and continuing is forbidden. Ordinary code
does not install or arm this hook. The collector is per instance; combining
multiple Workers would require separate identities and is not claimed here.

## Review and validation boundaries

Source tests: `node tools/check-reserved-fault-observer.js` exercises pairing,
successful retention, nested ancestors, all failure categories, exhaustion,
pending checkpoints, malformed protocol, byte-exact mapped reads, missing PTEs,
FS/scope cycles and reservation bounds, unchanged memory, and the extracted
production host import's ordinary/diagnostic/missing-callback routes. WAT fragment, boolean operand and callback census gates also pass. The census
updates only the held app registration and new synchronous read-only host
boundary hashes; it does not claim guest nonlocal lifetime support. The merged
debugger watch regression passes; its handler remains unchanged.

```
node tools/dungeon-siege-msvc-seh-fixture.js --root=COHERENT_ROOT --observe
node tools/dungeon-siege-msvc-seh-fixture.js --root=COHERENT_ROOT --observe --compat
```

These check real MSVC search/commit/file-read pre-hole to post-bytes, matched
IDs, declined-search result, explicit API/raise skips with no filter invocation,
and disabled-hook behavior. Added cases return ContinueExecution without commit
(phase4), and execute a real guest MOV from a second reserved page inside the
MSVC filter (phases1,1,6,2, distinct nested IDs, outer real file read completes). These cases are authored/syntax-checked, NOT run. Mocks do not prove WAT order.

No native/build/game execution is authorized by this checkpoint. Main ancestry
changed and WAT changed: existing7fd/a72 are invalid candidate pins. Required
next steps are independent source review, a normal coherent build and bounded
native controls in both dispatch modes, then review of narrow CLI/controller
installation and source/module pin updates. Old controls/preflight intentionally
refuse this mixed candidate. There is no ready original-game command yet. Keep90/105/120-second original bounds,250ms hardfloor,32MiB aggregate output,
4MiB raw log,3MiB response and512MiB admission reserve. A capture must preserve
pre-checkpoints and terminal output and kill the instance after diagnostic stop;
it is not a gameplay retry or a mode workaround.

## Terminal CLI and coherent validation preparation

The narrow runner option `--reserved-fault-observer=ABSOLUTE_DIRECTORY` requires
explicit `--no-threads`, existing mode5 and no spawned processes. It observes
only the main instance; cooperative secondary instances are not instrumented. It changes no fault mode or optimizer policy. Its adapter exits directly on
**every** observer exception, before any guest-aware runner crash handler. Capture exits0; snapshot/protocol/checkpoint/save/terminal-write failure exits1. There is no catch-and-resume path. The outer controller kills residual groups. Pending snapshots use bounded temporary writes and rename, retaining the last
complete pre-state if replacement fails. Successful post events update pending
status, avoiding a stale claim that an already handled fault remains pending.

Only seven clean results with absent groups and unchanged pins produce
qualification.json, including exact new primary/compat module hashes. The new
optional qualification argument to original preflight verifies the whole source
tree, both module hashes and all seven clean results. It cannot skip old5441
verification without replacing it with the exact qualified source reference.

The original retry controller's `--capture-fault QUALIFICATION_FILE` route
requires that receipt, removes control HTTP/stdin, and installs the observer. Its outer guards preserve90/105/120 bounds; soft deadline terminates this
noninteractive diagnostic at105 seconds. Success additionally requires the
terminal and first-nonmapped capture artifacts. Event-budget exhaustion is
retained but fails the diagnostic success check. No EULA/menu inputs are sent.

Source tests execute the actual CLI adapter with snapshot/checkpoint/save/
terminal-write failures and verify process termination plus retained pre-state. Whole-controller mocks cover seven jobs, admission refusal without a child,
source mismatch, disk/deadline/log/evidence/build-growth kills and no retries. Plan tests reject omitted pins, relaxed limits, changed source, failed or missing
jobs, wrong root and module mismatch. Runner wiring/restrictions, the prior CRC
protocol and debugger watch regression pass. Native fixture remains syntax-only. No build, native or original run was performed during this preparation.

## Remote source staging, no runtime (2026-10-19)

Root authorized source/dependency staging in temporary box bx_rqnkhrnr. Normal
HTTPS Git clone/checkout pins exact4734 at `wa-dungeon-thread-oct19`. The documented `boat push` command failed once with403 `api_key_action_forbidden`
("This API key cannot perform ssh"); no SSH/scp or encoded transfer retry was
attempted. Root then authorized the separately documented Files API:
`POST /sandboxes/{id}/files/upload-url`, followed by raw signed-URL PUT, using
only the existing Boat config token. That route succeeded200. Credentials and
signed URLs were neither printed nor saved. The459,859-byte archive contains
only the pinned two fixtures,27 pngjs files and plan/path metadata; SHA256
`c18c8bb6366db771bd074f9d6b18a7edb8cc6033c8f06b9a8fcc2d0abec89595`.

Prepared command, **not executed**:

## First remote qualification: terminal build-closure failure

No retry occurred. Independent postflight `cmd_iuuhctgsxtxm` verifies controller
20497 and child20511 absent, group absent, lease absent, Git clean at4734. The approved Files API recovered all seven evidence files plus their manifest
to local `scratch/runs/20261019-dungeon-siege-observer-controls-1` and retained
the117,798-byte tar archive SHA256
`bc61eafa31221ba87f943d018d1bbdae0fb1864d442c5041645e5d23022c74aa`. All manifest hashes verify. Runtime is released; the temporary box remains
root-owned and local held modules remain unchanged.

### Broader build-input audit before restaging

Source-only review of normal `tools/build.sh`, its shell manifest gate and
the gate readers found one further tracked input omitted from plan-v4:
`fonts/Terminal.fon` (5,168 bytes), named in the toy-VM browser bundler's ASSETS. It is now explicitly pinned. The review covered41 literal node/bash entry
scripts (including `if ! node` entries in the manifest shell), baseline/spec
readers under fully pinned tools/src/lib/data, test JS scanners, the two committed
bundles, index cache graph, CLAUDE size gate and timeout runner input. Generated
combined.wat and modules remain outputs, not missing source dependencies.

### Corrected remote qualification: build passes, native nested case fails

Authorized controls-2 used source `81ccbaef6fcf627dbaca1caadeb012820f876c42`
and plan-v5 SHA256 `9cd2998f0a36ea01e4ec2959652f9b82903d066f5732888756fec99c4ab61565`. Boat `cmd_vthq00pgkhkr`, controller25409, ran on bx_rqnkhrnr. Normal build
passed all gates in42837ms; primary SHA256
`063536828f2b32f1f7ac26f17b3a8befde920717a7bb1b7546d472a8fae6a229`,
compat `de41767f824fc0f314f1e9981620df12d6b94e9517dafc924438bfbdaad40bea`. The first native observer-msvc-tail control failed in5263ms at fixture line135:
the outer nested-case translation returned NULL_SENTINEL240. Earlier assertions
for commit/file bytes, search, API/raising skips and accepted-but-unmapped passed. The remaining five controls did not run; no qualification receipt exists.

Both results have null guard reason, unchanged pins and absent groups; minimum
free space48743739392. Independent postflight `cmd_o4re9ikdn7v5` confirms
controller25409, children25423/26027 and their groups absent, lease absent,
clean Git. All10 evidence files were recovered and hash-verified under local
`scratch/runs/20261019-dungeon-siege-observer-controls-2`. Evidence archive
SHA256 `9dc7512418ebb9a344764450bb17ae333be0253b24f5a898c3ce0a6bc15aa473`
(119226 bytes); both exact modules were separately recovered/hash-verified
(compressed archive1379479 bytes). Prior evidence and held recovery modules
remain unchanged. No original game or automatic retry followed.

### Corrected fixture: six native controls pass on preserved modules

Source `1a251aafcdd57e27be9971d58808cb112fdb1552` changes generated filter
writes to existing guest_write8 (production gs8/code invalidation). All original
outer-mapping, real bytes and nested phase/address assertions remain intact. The bounded controller can explicitly reuse a prior successful normal build:
it verifies prior process cleanup, both module hashes, and identical selected
source except the fixture/controller/controller-mock files. Reuse/source-change/
hash-change mocks passed, alongside the existing guard tests. No WAT changed.

Authorized controls-3, Boat `cmd_dg5diql6oc5p` PID29187, ran02:55:38–02:55:57UTC
using plan-v6 SHA256 `f01bab180d7d98d44d7602d455dcc83a23511c7374370f1aa672be5bd56d3e40`. Focused observer-msvc-tail passed3125ms; observer-msvc-compat2994ms;
reserved-sync tail/compat2992/2960ms; reserved-page-cross tail/compat2973/2995ms. All six exit0, null signal/reason/changed, absent groups; minimum free48732631040. The actual nested guest MOV now faults at00564b64 on08830000 in both logs,
with the exact nested pairing and subsequent outer commit/file bytes assertions
passing. This supports the diagnosed fixture code-cache hazard; no production
SEH change or weakened test was used to obtain the pass.

### Original fault diagnostic staging (source-only, no launch)

`dungeon-siege-fault-controller.js` is a separate fault-only entrypoint. It
derives `wa-dungeon-thread-oct19` from the passed qualification and refuses
the held recovery root. Existing qualified source files are unchanged. It uses
the same90/105/120-second bounds,250ms disk/output checks,32MiB output and4MiB
raw log cap, no VFS export, no threads/process spawning or input controls. An explicit grant token and exclusive shared runtime lease are mandatory;
live/foreign leases cannot be removed. Its source tests cover missing grant,
wrong root, preflight refusal before spawn and lease ownership/liveness.

### Roomy remote original staging

On bx_rqnkhrnr,47 files totaling209562798 bytes were streamed directly from
existing local files to `/home/user/dungeon-original-stage-1` through the
authorized Files API. No large local archive was created. Files comprise37
originals (206866962 bytes), original manifest, historical acceptance receipt,
actual input/screens/terms and four native DLL fixtures. The upload helper and
per-file completion receipt remain in local prepared-1/upload-original.py and
remote-original-upload.jsonl; manifest SHA256
`9b2172c0ecc0e5a75953aa921663f6749a4101310b0f318f2b4fae8c5f23d7e0`. The helper obtains each signed PUT using the existing configured token in
memory, streams the ordinary source file with Content-Length, and stops on any
HTTP error. It neither stores credentials nor retries rejected access routes.

After separate review/grant, run the above command through
`boat exec --detach --cwd wa-dungeon-thread-oct19 bx_rqnkhrnr -- env ...`. The same local admission remains unchanged; remote capacity does not weaken
the floor. Box lifecycle belongs to the coordinator, extended to03:30:32UTC. For rollover, restore the exact source via Git, module/qualification evidence
via Files API, and these47 original/provenance files; repeat full preflight
before any guest launch. Historical acceptance is not persistent registry state
and no new acceptance or gameplay is claimed by staging.

### First original fault attempt: missing unconditional boot assets

Authorized cmd_wkxhixnjsfbw (controller35696/child35730) exited1 at03:03:26UTC
before guest observation: test/run.js2842 could not open stdole2.tlb. No
observer capture/EULA/input occurred. Raw log820 bytes, no guard, unchanged
pins, no survivors, minimum free48316076032. Independent cmd_p6pqbm2c4izj
confirms both PIDs/group absent, lease absent, Git clean. All10 artifacts were
recovered/hash-verified in fault-context-1, archive291726 bytes SHA256
`eb14a77c3fabda023a68cc6d0997d4be70bcbf5887c7b2437856277c8a85a9d4`. No automatic retry followed. The earlier preflight omitted unconditional
runner data and was insufficient for this fresh root.

Shared `runner-boot-assets.js` now derives and verifies27 required tracked
assets against the exact qualified Git source: SYSTEM_DATA_FILES currently
contains test/binaries/tlbs/stdole2.tlb; fonts/substitutions.json; five bitmap
fonts (System/MSSansSerif/Fixedsys/Courier/Terminal);20 distinct subset files
derived by the production fontMounts(...,{subset:true}). It also verifies the
runner and both producer modules match that source before deriving paths. Negative checks require refusal for missing typelib/bitmap/subset and changed
substitution/producer source. This is reusable by other original CLI lanes.

Dungeon's separate asset audit additionally verifies the existing registered
.wine-assembly-browser.json SHA256 c3bc130395222c451a9341d48f6dd00cc2660961c3c7ef69299c97c4604d8eef. Its37 entries comprise36 original files plus original metadata; the original
EXE is loaded directly. Every entry size/hash is checked against original
provenance, with unique/full coverage. Total28 extra pinned paths696408 bytes. The fault controller runs this audit before lease/spawn and includes these
assets in physical postflight pins. No original source bytes or registry
state are synthesized. Native closure remains the previously verified four
fixtures plus actual app Bink/Mss seed graph and executable-directory files. No new runtime is authorized merely by this correction.

Remote closure restoration completed source-only on b2693558a.26 missing
tracked assets reused `wa-lockfile-rebased-oct19` files after qualified
Git-blob equality checks; existing Terminal was retained. They are regular
hardlinks, so source Git is clean (initial symlink type changes were corrected
without changing bytes). Only the existing app manifest3910 bytes required
another Files API upload. cmd_fk1t8v1txgev rechecked all28 asset hashes and
reported ready=true/clean Git; prior combined preflight free48313856000. Final remote ready-v3.json was recovered locally, SHA256
`9430e73da2f9e3bb666bfd7be0aa5519a27f2a71c5c04df35fc049ea13970fdf`. Controller now SHA256 `04c4fbed0ec00b30ff4d13f9a982cea4ed9d2b25436a78965597b18287ed8bb3`. The next unique candidate is fault-context-2 using unchanged qualified modules,
observer receipt and guard limits; no runtime has been started after this
closure correction. Shared helper/source checks were sent to the MadBomber
lane for use against its own qualified source rather than copying Dungeon pins.
