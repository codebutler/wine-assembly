# Hock registered CLI timeout repair — 2026-10-21

**PASS: repaired actual registered CLI smoke; original-game startup image reviewed.**

Base: exact main `d4ba733fb0d1c9e6d67ff0db715a5c0535307e6f`.
Branch: `task/hock-registered-timeout-repair-oct21`. Independent review required;
no main merge, browser registration, selector change or deployment.

## Diagnosis and bounded repair

The original registered route was spending its deadline executing oversized
batches at the already-rendered character-selection screen. It was not stuck
inside one call or batch. A diagnostic using the captured consumer argv plus
built-in batch/scheduler tracing and a 20-second wall guard completed 136
batches / 20,760,776 API calls in 20.059 s. Batches 42–47 took approximately
110–121 ms in the main run plus 42–46 ms in cooperative worker slices. EIP
moved through the original main-loop addresses around `0x404340`; the original
EXE disassembly is preserved. The startup screenshot visibly says “Choose
Beavis or Butt-head to start.”

The accepted explicit-EXE scoring driver used the CLI's default **1,000-block**
batch size, `--real-ticks`, `--control-stdin`, explicit C-drive EXE/CWD,
a large batch ceiling and a 72-second wall limit. The registered planner
instead requested **3,000 × 100,000 blocks**, synthetic clock defaults,
`--no-close`, and a **120-second** spawnSync timeout. Exact original driver,
captured argv and source-change comparison are preserved. `test/run.js`, host
libraries and WAT inputs have not changed since the successful runtime baseline;
canonical module hashes are identical. No source/host execution regression was
found.

Controlled diagnostic comparisons reused the exact observed consumer module,
original 39-file fixture, default cooperative scheduler and JS raster renderer:

| Diagnostic (explicit EXE; not registered acceptance) | Result |
| --- | --- |
| Captured options + tracing + 20 s guard | exit 0, 136 batches / 20.059 s |
| Only batch quantum changed to 1,000; all 3,000 batches retained | exit 0, 3,000 batches / 32.124 s, 68,196 API calls |
| Only real clock added; original 100,000 quantum + 20 s guard | exit 0, 223 batches / 20.015 s; still too slow for 3,000 within 120 s |
| Prior driver's host options, 1,000 quantum, bounded 20 s, no input | exit 0; comparison only |

All four normal PNG captures are byte-identical, SHA256
`7e12c9eed8c8489830261791a42b7a4a3716b4ab834ea50a149c08aac1122ac2`.
The workload correction changes only Hock's `cli.batchSize` to 1,000. It keeps
3,000 batches, the 120-second deadline, complete VFS, clock, original game
bytes and all acceptance/error gates. The evidence supports bounded startup,
not a claim that any finite block budget proves gameplay.

Two consumer issues were also demonstrated and repaired:

* `spawnSync`'s default SIGTERM cannot run `test/run.js`'s JavaScript signal
  handler while the synchronous batch loop occupies the event loop. The prior
  actual route required an externally owned SIGKILL after about 171 seconds.
  The corpus runner now requests SIGKILL at its existing deadline. ETIMEDOUT
  remains BLOCKED; termination itself is not guest acceptance.
* After the workload fix, the actual child exited **0**, completed 3,000
  batches in **21.484 s**, and had no fatal marker. The corpus nevertheless
  exited **1** because `/CRASH/i` matched the DLL advisory phrase “crashes as”.
  Word boundaries now distinguish diagnostic tokens from that prose. This
  does not suppress the warning, supply the missing DLL, or ignore genuine
  CRASH/STUCK/RuntimeError/LinkError/unimplemented/missing-DLL/nonzero-exit/
  signal/timeout failures. Those remain covered by negative tests.

## Registered-route evidence

All actual consumer launches are:

```sh
NODE_OPTIONS=--require=<saved observer> \
  node test/test-cli-candidate-corpus.js --id=hock-a-loogie-1995 --strict
```

The observer preserves return values, records original generated argv/options,
module identity and VFS resolution, and saves the otherwise-discarded child
logs. `registered-final` does not change generated argv or host options.
`registered-capture` is separately labeled: it adds only the normal `--png`
output flag to the generated child command; both original and effective argv
are recorded. It is an observation replay, not a substitute explicit-EXE test.

Final unchanged-argv registered replay exits **0**: **1 READY, 0 blocked,
0 skipped, 0 harness failures**, 26.335 s including compilation. The child
completes all 3,000 batches / 68,196 API calls in **23.307 s**. The separate
normal-PNG observation replay also exits **0**, same counts, 27.042 s total /
23.574 s guest run. Its reviewed 640×480 PNG shows the original character
selection screen and matches the four diagnostic captures byte-for-byte.
Neither final replay reaches its 75-second outer hard bound.

The actual oversized-workload negative control (`registered-negative`) restores
only Hock's batchSize=100000 while retaining the termination fix. It exits **1**
with **ETIMEDOUT/SIGKILL**, zero ready / one blocked / zero skipped / zero
harness failures, 122.922 s including compilation. Its outer 135 s hard bound
is not needed. The manifest is restored in `finally`; no orphan is left.
This control was run before the word-boundary correction; ETIMEDOUT classification
precedes the unchanged marker check, and final regression tests confirm it
remains BLOCKED with the corrected classifier.

The first read-only canvas observer captured an unpresented frame. That image
is preserved as failed capture evidence and is not a startup qualification.
The later normal PNG path presents through the CLI's existing capture logic.
No guest memory, game bytes, registry seeds, DLL substitutions, silent stubs,
inputs or artificial clock changes were introduced by the repair.

## Tests and exact identity

* New Hock budget assertions fail on exact-main manifest (exit 1) and pass on
  repaired metadata (exit 0), including three additional negative controls.
* The runner termination regression fails on the original default signal,
  then passes by actually terminating a child that installs a SIGTERM handler
  and enters a CPU loop. Its ETIMEDOUT result is fed through `runCandidate`
  and must remain BLOCKED.
* The expanded classifier regression fails on the previous substring matcher
  (exit 1); the repaired test passes, including all fatal controls listed above.
* Existing Silver launch-planner regression: exit 0, eight checks. No other
  candidate launch arguments change.
* Final `bash tools/build.sh`: exit 0 with **all normal gates**. An earlier
  negative fixture's 600000 timeout literal tripped the timeout gate; replaced
  it with 120001 to test an increase without exceeding the test-runner cap.
  The failed build log is retained. No gate was bypassed.
* The optional full intake test could not run because this remote intake lacks
  its historical `SHA256SUMS`/survey files. That exit-1 log is retained; no full
  package regression pass is claimed. Accepted packaging is unchanged. Direct
  final seal checks verify all 44 retained intake entries, all 39 staged game
  files and 38 companion names/VFS paths/sizes/hashes, plus both actual routes'
  original VFS resolution. Nothing was reacquired.

Canonical WASM remains 1,878,508 bytes, SHA256
`728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`;
compat remains `25519647def1c2a25f505a81743d21dec55472ede8780f809edf09b6bb231018`.
The actual consumer compiles its own 1,878,471-byte module,
`a5972cbaf915aa1d155b301da5fae1c80298b2be381034945c7e58cc81e02f72`,
whose only difference from canonical is the appended 37-byte layout custom
section, as independently established by the preserved prior identity evidence.
No supplied module replaces that actual registered compilation.

All 7,253 original tracked source seals are checked after runtime: exactly the
four intended test/consumer/manifest paths differ, and their SHA256s match this
branch. Original EXE SHA256 remains
`974f1b5ff82cfdb87f05b9840ae03cd2ed6ceebe2c8ed547253dadaf1a871ef4`.
Prior runtime evidence seals are unchanged. The final source patch and exact
changed-source hashes are in the evidence archive.

## Scope, recovery and handoff

This qualifies bounded registered CLI startup only. It does not extend the
accepted explicit-EXE scoring to registered-route gameplay/input, and does not
claim browser launch, completion, persistence, audible/correct sound, FPS or
Windows parity. The missing-comctl32 warning is still visible; unused ordinal
paths remain unqualified. The final screenshot must be read within these limits.

Evidence: adjacent `hock-registered-timeout-repair-20261021-evidence.tgz`;
verify its `SHA256SUMS.json` and nested `remote-evidence/SHA256SUMS.json`.
Run/recovery/publication:
`scratch/runs/20261021-hock-registered-timeout-repair/`.
Remote staging reused in place:
`/home/user/hock-registered-runtime/repo` (exact base plus tested four-file patch).
New raw evidence/scripts: `/home/user/hock-registered-timeout-repair`.
Prior `/home/user/hock-registered-runtime/evidence` remains intact.

Same assigned box **bx_egnm3u4y is left RUNNING**, expiry
**2026-10-21 10:44:02.530 UTC** (coordinator-provided). Coordinator owns shutdown.
No box create/resume/stop/delete, worker launch, public deployment or other-box
access occurred. Local sparse checkout/evidence stays under 64 MiB and above
2,285,895,680 bytes free plus 600 MB transient reserve. Root WIP, laptop
HeroesII/WarcraftIII and the Claude fleet are untouched. Task stops after
publication; independent review and integration belong to the coordinator.
