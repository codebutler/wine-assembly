# Accepted process-alias integration — 2026-10-20

Integrated the complete 12-path delta of 53b4132878e86fc5afdf5f4fd6c64cd60925c9af, including parent 659a2c6d6974c447a21dd2905cd7a2c2c1e23382, onto remote main dee72253516f9565f1346dc4232b7576723ba0e2. Independent acceptance: 925fde24131223127b3f5a97812d9aac0fa45311. The full acceptance report and receipt were read. The full production diff was inspected during integration. No conflict or source adaptation was needed: all twelve paths match accepted candidate blobs exactly.

This preserves pending process identity, cancellation at asynchronous attachment boundaries, authoritative failure/exit status, independent E4/E6 handles, rights checks, full DWORD exit codes and single-wait error propagation. All unrelated main content, including the env_find empty-name guard, is inherited unchanged. No broad ShellEx/startup or lookup candidate was imported.

## Exact integration-source checks

The acceptance helper was adapted only at its source loader in scratch/replay-integration.js: default candidate reads use the actual integration working files, with unchanged dependencies read from this integration's HEAD. Explicit rejected-parent reads remain immutable negative controls. The submitted helper executes through that loader too. Legacy compiler and pipe helper blobs are byte-equal to current integration inputs; historical host comparisons remain controls. Each consumed source is hashed in tests.json; all twelve accepted paths additionally have SHA-256 and Git blob IDs in source-mapping.json. Commit publication verifies these identities against the committed tree.

- 14 boundary groups + 17 original groups passed.
- 17 additional independently authored cancellation/VFS boundary cases passed.
- All 16 rejecting controls retained: eight original mutations, three boundary mutations, three rejected-parent A1–A3 oracles, two extra acceptance mutations.
- Exact compiled wait slice: 482 bytes, SHA-256 e8c2f461864627bc8778ee57e1a7c4ce1b39aedffde2057cec31e96c555e700f.
- Exact compiled process API slice: 603 bytes, SHA-256 81cc57dc6bb58083461f9cfcbd46b997baf0eaa502c2b651585f28b20c26c66e.
- 18 lightweight checks passed: seven JS syntax checks, diff whitespace, logical-AND, silent-stub inventory, region literal census, host-import freshness (289 imports), generated region-map freshness (263 regions), three changed WAT fragment parentheses checks, existing ThreadManager zero-timeout contracts (8), and existing process-send broker ownership/deferral/nesting/retirement/subscription/PID-reuse regression.

The lightweight gates use integration HEAD with the twelve working-file overlays through a read-only virtual filesystem, avoiding broad sparse materialization. Full-VM test/test-child-process-object.js was syntax checked and its process fixture parity is covered by the accepted source suite; its full VM harness was not executed.

## Custody and limits

Evidence and JS recovery scripts: scratch/runs/20261020-process-alias-integration-ready-oct20/{setup.json,accepted.patch,replay-integration.js,gates.js,run-checks.js,tests.json,validation.json,source-mapping.json,receipt.json,remote.txt,SHA256SUMS.json}. Replay from the isolated repo with node ../run-checks.js. The previous failed attempt's evidence is untouched.

Fresh isolated repository; exact sparse patterns and all three supplied absolute read-only object alternates configured before checkout; main/candidate/acceptance trees resolved before materialization. Every write phase is gated against 2210398208 + 33554432 + 25165824 + remaining bytes, with an 8 MiB allocation cap. Shared HEAD/index/config are checked unchanged. Explicit-path commit and verified task push precede fresh remote reconciliation and nonforce main fast-forward.

This is source integration, not native/Worker/game qualification. Runtime403 remains binding. No full build, runtime, Boat, SSH runtime, browser, benchmark, deployment, Claude or held diagnostic ran. Real Worker RPC/IPC, full scheduler/APC behavior, heap reclamation and concurrent wait/merge ordering remain unqualified. Preexisting DXSETUP successful skip without completion remains unchanged. Laptop HeroesII/WarcraftIII and the isolated parallel startup worker are untouched. No workers or refill.
