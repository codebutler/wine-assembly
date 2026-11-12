# Maelstrom: recovered breakpoint/counter regression, 2026-10-24

The retained native module passes the bounded regression. Its passive counter
can increment **972 times without executing the counted block**, because the
run loop increments counters before returning for an already pending blocking
yield. A counter at `0x7a3362` does not establish execution of the breakpoint
target `0x7a3366`, or 972 native select calls. No production defect is proven;
no production source or existing boundary adapter was changed.

This is a new executable native observation, not another game guest. The exact
cause of the original game's zero target records remains **UNKNOWN**. The old
receipt does not record the yield state at each counted visit, the indirect
callee, its return, native errno, or the original block's execution. The
reproduced mechanism is a possible explanation, not an attribution to that run.

## Exact inputs and historical semantics

Read-only source recovery used `git show REVISION:path` in the canonical donor's
object database. The three compressed WAT fixtures are exact source revision
`b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`, not current main. Full identities
and the current-base comparison are in adjacent `source-identities.json`.
Historical `13-exports.wat` is SHA-256
`739397dc54a77e93b367334fd4ca96c921180f57a7558913a3301f1de4520b86`;
current exports differ. Cache and ALU match their historical full-file hashes.
There is no `src/00-globals.wat` input.

Historical exports lines 180–234 compare exact current EIP with the breakpoint,
then with the configured counter slots. A matching breakpoint sets halt 5
before incrementing its counter; resume skips that breakpoint once. The
blocking-yield checks at lines 261–299 follow the counters. Decode/cache entry
is at lines 378–380, after those checks. Consequently a blocked visit can be
counted before any instruction from the named block executes. Thread instances
also share counter storage; the total is not an API-call or instruction census.
`dbg_recompute` sets `dbg_chain_guard`; cache and ALU transfer checks preserve
diagnostic block entries and independently compare the exact breakpoint EIP.

The old receipt (`prior-boundary.json`, explicitly identified as prior evidence)
really armed/read back `0x7a3366`, while its slot 1 tracked **`0x7a3362`**. First
return was batch 36163, EIP `0x00679753`, halt 3; last was 41999, EIP
`0x075040f8`, halt 4, count 972. It had zero target records and zero conditional
snapshot bytes. These remain unchanged historical facts.

The unchanged boundary transformer reproduces transformed runner SHA-256
`6d542cd2c11b24b76bcb1f845a695dce726f7038602f9e8c0b4f172ed5df1ad4`,
690739 bytes, from the exact original d8cd8c54 runner. The focused test checks
those full identities; it neither runs that runner nor compiles source.

## Original instruction boundary matters

The retained original SDL_net.dll matches its accepted 24576-byte SHA-256
`46ccbb7e5982e2c15421af7dd4fa29b26841d9731c31a86cf9554c90be53af95`.
The old loader log places it at `0x7a2000`. A new 96-byte static extraction,
with PE section mapping and hash in `sdl-net-window.json`, shows:

```text
0x7a3362  8b e8        mov ebp,eax
0x7a3364  ff d7        call edi
0x7a3366  83 38 04     cmp dword ptr [eax],4
```

Thus the actual target follows an indirect call. It must not be explained away
as merely an interior instruction in a straight-line original block. The
synthetic straight-line control below qualifies the general distinction only.
The static DLL disassembly does not reveal the actual runtime EDI or prove the
call returned. No full DLL or game input was newly staged.

## New retained-native observations

`tools/maelstrom-retained-breakpoint-probe.cjs` requires the exact retained
1879746-byte module SHA-256
`8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`,
source b41a7c5, ABI 291/layout `9a3bc9149d58209c`. It creates one fixed 512 MiB
shared memory per invocation and initializes slot 0 with the real `init_thread`.
It executes x86 bytes through the real module. There is no toy WAT, canonical
build, runner fallback, PE load, SDL guest, networking, box or deployment.

| Native control | Observed result |
| --- | --- |
| Warm straight-line loop, counter at head and breakpoint four bytes inside | Eight iterations execute both INCs; head count 8, interior count 0, halt 1, guard 1; no target callback |
| Explicit entry at that interior instruction | Halt 5 at exact EIP; count still 0; skip-once executes it and increments count; next re-entry halts again |
| Warm two-block cycle, then arm cached successor | Halt 5 at successor, predecessor count 1 and target count 0, cache stores unchanged |
| Breakpoint-only benchmark chaining, guard 0 | Exact cached successor still halts 5 |
| Original MOV/CALL prefix, pending blocking yield, 972 `run(1000)` calls | EIP `0x7a3362`, halt 4, head count 972, target count 0; EBP unchanged, cache stores unchanged, zero target callbacks |
| Clear that yield; synthetic callee is RET | MOV executes, CALL returns, halt 5 at `0x7a3366`, head count 973, target count 0 |

The last two rows use the original seven prefix bytes at the original addresses,
with an explicitly synthetic returning callee and valid data/stack. They do not
model the game's errno provider. The probe's counter slots 0/1 are its own
fixture slots, distinct from historical slot 1. `native.log` retains all rows.
Its synthetic target callback reads one register, not guest memory. No original
game target or 16-byte game snapshot is claimed.

The first two fixture attempts stopped in initialization at unexpected
`beep_process_begin` and `beep_thread_begin` imports. Their failure receipts are
retained. Historical cache source drops those lifecycle returns. The completed
fixture explicitly records those two inert lifecycle announcements; every
other host import throws if called, and none was called. This qualification
does not extend to sound/API behavior. A passing interior-only run preceded
the final expanded probe; no game guest was attempted.

## Reproduction and validation

From this repository, the cheap regression is:

```sh
node --max-old-space-size=256 test/test-maelstrom-retained-breakpoint-probe.js
node --max-old-space-size=256 test/test-maelstrom-breakpoint-boundary-audit.js
```

Both pass. The new test verifies historical source ordering, exact runner
transformation, original CALL bytes, retained native evidence, wrong-module
rejection and wrong-halt/EIP/readback controls. Removing each of the three
target-evidence guards fails its oracle. The independent existing boundary
suite is byte unchanged and passes its seven rejecting mutations, watchpoint
conflicts, anchor/export controls and bounded no-hit case. Its successful mock
snapshots are explicitly offline controls, not real guest observations.

For a new native observation use the adjacent `supervise.py` recovery recipe:
place it at `TASK/ops/supervise.py`, with this checkout at `TASK/repo`, and run:

```sh
python3 TASK/ops/supervise.py native
```

The recipe names the standing module at
`/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build/wine-assembly.wasm`.
Its exact Node argv is also in `native-terminal.json`. No source build is an
allowed fallback. Reproduction requires a fresh task allocation/resource ledger;
the script's conservative disk gate retains this task's 52428800-byte projection
and the other 67108864-byte reservation. It enforces native MemAvailable
2684354560, heap 512 MiB, CPU 90s, wall 60s, output 131072 bytes and process-group
TERM/KILL plus wait/reap. Cheap checks require MemAvailable 805306368, heap 256
MiB and CPU/wall 60s. Per-file limit is 24 MiB, separate from pipe-output cap.
No mounts exist for this local microprogram; the guest mount checkpoint does
not apply. Git uses the supplied dedicated identity and strict known-hosts file.

The final native invocation passed in 0.052s on Node v24.18.1, with output 4017
bytes; supervisor MemAvailable was 4086095872 bytes. It exited naturally, with
no TERM/KILL and no remaining process group. Original guest Node v24.22.1 is a
different environment; original-game reachability remains unqualified here.

Two cheap harness errors were corrected without changing acceptance semantics:
the source oracle initially searched for `decode_block` rather than the actual
run-loop `decode_run`, and the initial supervisor mistakenly applied its
131072-byte stdout cap to ordinary temporary files. The independent suite's
690KB runner copy hit EFBIG. That operation stopped; its retained failure is
followed by a corrected 24 MiB per-file limit and unchanged bounded stdout
guard. The unchanged suite then passed. Failed receipts remain adjacent.

The owner ledger covers checkout/Git, inputs/temporary files, full external
session/launcher/history, positive SQLite growth/future allowance, evidence,
publication growth and 8 MiB reserve within 64 MiB. Initial admission passed at
free 3576483840, after both reservations 3456946176, above floor 2982150144.
Final accounting and evidence hashes accompany the report. Standing donors,
module and installed Node/objdump are read-only inputs, separately identified.

No production patch is warranted by these observations. What remains unknown
is whether the original counter visits executed, what EDI called, and whether
that callee returned to the requested target. There is no assigned box; box
lifecycle stays with the coordinator. Stop after tested candidate publication.
