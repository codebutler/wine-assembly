# Original Shadow Man Beenden boundary: first precise capture blocker

Historical source last updated, 2026-10-23. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

**BLOCKED_FIRST_ZERO_BEFORE_REQUIRED_BLOCK.** Exactly one original-game CLI
session ran on `bx_jxut8krh`, PID/PGID **28583**, for **0.980741 seconds**. The unchanged accepted adapter durably stopped with
`capture-failed: first-zero before required block`, OS exit86. This is an
evaluated original trace, **not an accepted capture**. No second session,
synthetic replacement, native-fixture replay, build, source repair, direct game
launch, Play action or worker was attempted.

Raw capture (historical artifact: `shadow-man-original-null-capture-20261023/original-evidence/null-capture.jsonl`),
offline evaluation (historical artifact: `shadow-man-original-null-capture-20261023/evaluation.json`),
session result (historical artifact: `shadow-man-original-null-capture-20261023/original-evidence/session-result.json`)
and complete actual output (historical artifact: `shadow-man-original-null-capture-20261023/session-summary.json`)
are retained. The evaluator verifies envelope hashes, actual process/module,
action receipts, state and every required capture condition without executing
the guest or changing its acceptance criteria.

| Required original capture condition | Actual observation |
| --- | --- |
| Genuine reviewed CLI / exact module / one instance | PASS, actual argv and canonical compile/instantiate receipts, PID28583 |
| Fixed512MiB arena | PASS, one shared Memory initial=maximum8192 pages; no extra arena/Worker/child |
| Fresh launcher → Configuration → OK → fresh launcher | PASS, actual snapshots, control records and three PNG receipts |
| Counted prior ordinary actions | Configuration sequence1/batch5585/HWND0x10001; OK sequence2/batch14859/HWND0x10006; both returned |
| Final ordinary Beenden command3 | Sequence3/batch24720, freshly resolved HWND0x1001c; no historical batch/HWND selector |
| Durable pre-arm context before arm/send | Present, prior eventCount0/syncDepth0; pinned retain calls real fsync synchronously before diagnostic mutation |
| Actual decoded block0x4015d4 | **MISSING** |
| Modal consume / completion | **BOTH MISSING** |
| First-zero record | Present, EIP0, stop=true, continuation forbidden |
| Successful first-zero terminal | **FAIL**: terminal explicitly rejects first-zero before required block |
| Reap / OS versus guest exit | All owned groups reaped, remaining[]; OS86, guest exit unproven |

The first two diagnostic records are `sender-pre`, then `first-zero`, with
event counts1→2, token13/root2 and syncDepth1. At pre-arm the original modal
pump/shared pump are HWND0x1001c and returnAddress0x4015d4. The first-zero
record has ended/sharedEnded1, while the pump and return address persist. These retained values do not supply a missing decoded-block or modal event. Classification remains **ordinary-or-unknown; zero-writer unproven**. No source-cause inference or speculative fix follows this first blocker.

The genuine runner path is
`/home/user/shadow-man-original-null-capture-oct23/immutable/runtime/test/run.js`. A Python launcher sets the target PID then `execvpe`s Node; it never assigns
`process.argv`. The actual Node entry record and pinned preload bind PID,
runner realpath/hash, module bytes and one compile/instance. Compiler fallback
is rejected by the actual Module loader guard, not only by environment flags. PNG capture used the actual ctl `pipe` action:png route; snapshots/eval/png
operate between batches and enqueue no scheduled input. Therefore the only
three dequeued actions are the three ordinary dialog commands. The final
live intent and current state were fsynced before dispatch. Pre-arm receipt
fsync behavior reuses the accepted exact source; no extra runtime fsync wrapper
or synthetic oracle was installed.

Initial Spielen is observed disabled and the fresh launcher control is enabled
after OK. This does not establish persistence or gameplay. Configuration and
OK each retain an ABANDONED synchronous callback warning; they are not claimed
as normal callback completions. Expected COMCTL32/OLE32 fallback warnings were
not treated as fatal. No optional DLL/cfg/registry/capability injection occurred. No generated config was injected or exported as a new input.

## Exact accepted identities

Accepted source candidate remains `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`,
read from the candidate Git objects and the read-only fresh-selection donor. Static acceptance `cf5612a1482cbfead91450b679a58b18958f53dc`, native subject
`2de825962dc45ac541ee9e0849bff2273eb5f4c8` and independent scoped acceptance
`41801c5fc195861b0049b64a9a1169a3fc3840d2` were reused without replay. Main `32c0b9bcf4cbaeee3102a5944ca905ca9298169a` and Claude's heap changes were
read-only context and were not used to rebuild this diagnostic.

| Input | Bytes / SHA256 |
| --- | --- |
| test/run.js | 685960 / `4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809` |
| tools/shadow-man-null-preload.cjs | 5299 / `78dcac659f82f4c93325d126d072d006e0c6995bac53f9a182431a956eb8e42b` |
| tools/shadow-man-null-capture.cjs | 8196 / `3440377e102575906809bb36a1ba10c291a00f87ae63f05dac5ae24394529cea` |
| Canonical retained module | 1879746 / `8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686` |
| Original registry | 17088 / `d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3` |
| Original D3DConfigUtility | 573440 / `850c69cfa4a0d610072a67763d54179bc4cdc58875560ce5ede33bfa44d19fe0` |
| Original mss32 seed | 328704 / `09e2dec3d1e996571fb2c95e5de393410d486f1728c86473b550282edd83588c` |
| Original DSETUP | 135680 / `5112c736fa664cfd658c465fad781fe7ffd2753470cbcf7019b5a6ab08c4800f` |

Module standing donor:
`/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build/wine-assembly.wasm`. No old ccd5b0 module or compatibility module was loaded. The historical module
identity appearing inside pinned metadata is a reference, not the actual input.

## Recovery and lifecycle handoff

Three actual PNGs remain in `mutable/output/` with hashes in
handback artifacts (historical artifact: `shadow-man-original-null-capture-20261023/handback-artifacts.json`):
launcher-before296310B, Configuration133536B, launcher-after-OK296309B. PNG receipts and state/input records were retained locally; images were not
visually inspected or copied locally. One attempted Boat SCP retrieval was
denied403 `api_key_action_forbidden: This API key cannot perform ssh.` It was
not retried, nor was another SSH route used. Existing authorized API command
reads retained the bounded raw trace/state evidence. PNG bytes were kept remote
instead of encoding them into stdout and exceeding the aggregate capture cap.
