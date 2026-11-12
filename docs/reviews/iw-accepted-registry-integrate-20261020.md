# Accepted window lookup and registry integration — 2026-10-20

Integrates the complete reviewed feature delta from a54049d11955307d06309e146e85c1aca3196657 through ecf1850383c4c155aae0650de3ef5ab8b8661326, including aacd0b19 and ac72debe, onto freshly verified remote main 978018d85f28b76f04e9b67b7f1009904391b632. Independent acceptance: fffb14ee9ce82906927e394f3b84539b7758e5d5. The 18-path delta (11 production/regression paths and seven recovery reports/helpers) applies without conflicts; none overlap the 16 paths changed on main since the baseline. All imported paths match candidate blobs exactly. No additional production semantics were introduced.

Desktop FindWindow now reconciles live native rows with published windows using owner memory, registration encoding and allocation generation. Removal invalidates publication identity, preventing stale metadata across HWND reuse. The accepted three appended regions total 2376 bytes; existing placements remain intact. Current main process/env changes remain intact, including host.js, process aliases and env_find.

## Validation

The actual integrated source tree 64bb5145a64896faa94c41df29f6a10e40c8459c passed accepted replay: 89 prior checks/five controls, 67 independent checks, 29 focused entries/three controls and seven additional independent groups. All six corrected oracles pass; the exact ac72debe baseline reproduces six failures. 75 integrated and 39 baseline compiled slice modules; all 348 source seals match the selected trees. Counts include grouped assertions and fixture gates, not full-VM runs.

Unchanged CLI entrypoints pass: strict region declarations/owners, generated region map, all 127 fragments, logical AND, 290 import signatures, silent stubs, full host-window relation regression, manifest, memory map, all five region census modes (literal, JS, embedded WAT, duplicate payload, hand-rolled offset), all shake allocation modes, RPC region and WAT/JS constants. Gate source inputs are separately sealed against the integrated tree. Syntax and diff checks pass. No full build was run.

Reproduce acceptance with:

    node docs/reviews/iw-accepted-registry-integrate-20261020.js REPO TREE acceptance OUTPUT.json

Use the same runner with REPO TREE gate ENTRY [ARGS] for unchanged CLI gates. The runner loads the accepted review from its immutable Git object and redirects its candidate to TREE; baseline and controls remain unchanged. Sparse missing files and directory entries resolve from that exact tree, with gate filesystem writes forbidden. Preserve the accepted review and predecessor Git objects for replay.

Evidence: scratch/runs/20261020-iw-accepted-registry-integrate-oct20/{setup,tests,input-mapping,gate-input-mapping,gates,validation,receipt,SHA256SUMS}.json, change.patch, CLI logs, capacity.jsonl and remote.txt. Git preserves the reports/helpers; ignored logs remain local.

## Limits and preservation

Source and compiled-slice acceptance only. Full VM, browser, Worker RPC, CLI IPC, cross-realm unpublished registration, arbitrary concurrency/reentrant destruction, general Unicode fidelity, launcher/game qualification remain unproven. A matching generated region map is required with any future VM build. No runtime403 retry, Boat runtime, heavy/full build, browser, public deployment, Claude panes, laptop HeroesII/WarcraftIII, worker or refill operation.

Fresh exact non-cone sparse patterns were installed before materialization. The supplied alternate lacks current main; a second read-only alternate uses the preserved process integration object store, verified before checkout. Neither alternate is rewritten. Shared HEAD/index/config hashes are unchanged; all work is confined to this isolated checkout and evidence plus append-only messageboard entries. Other workers' startupshow/endpoint WIP and laptop/unrelated files remain untouched. Every write uses available >= 2277507072 bytes, conservatively retaining the entire 8 MiB cap; actual allocation is recorded separately. Publication is a task-branch push followed by authorized non-force fast-forward main and exact remote verification.
