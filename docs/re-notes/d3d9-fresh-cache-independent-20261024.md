# Independent D3D9 clear acceptance and integration

Accepted candidate `6bac6611339ef571014e557f168ef4ecb8db1f57` against remote
main `f6571101e38985b3fa34d328f2ccadd9735a7573`. The full stack retains producer
`ffe822a9d50ad79439330609915eb84475acd2bc`, independent review
`c1bfc2c696e8b88749a3b8ab04f935b5e52d7cb1`, first repair
`77180c76b312efe465ad91e60286d40330d77d0d`, and fresh-target rejection
`912cd44a9e0b4ffedf106ecc80031351773f5302`. Their object identities and ancestry
were independently checked, as were all 52 repair artifact seals.

The complete production diff has nine files: the descriptor module, host,
software and GPU consumers, shared GPU wrapper, and four browser/worker loading
sites. No production WAT changes occur. Descriptor construction snapshots and
freezes nested inputs, clips rectangles once and distinguishes absent from
default attachments. Consumer validation survives structured cloning and keeps
legacy positional calls bounded. Host initialization, ColorFill and Clear publish
the descriptor; synchronous and worker consumers retain its channel mask and
attachment identity. Software maps RGBA masks to packed native pixel masks,
quantizes attachment depth, and uses separate stencil stores. GPU clears use
top-left to bottom-left scissor conversion and the actual wrapper's clear values.
The changed import sites load the descriptor before its consumers.

Both fresh attachment paths now initialize through `WebGLBackend.clear` with
explicit depth 1/stencil 0. D16 initialization includes depth only; D24S8 includes
both depth and stencil. Named initialization leaves color out of its mask;
implicit storage retains its color initialization. Existing depth stores retain
their fresh flag lifecycle and are not reinitialized. Initialization updates the
same cache later used to suppress redundant requested values. The subsequent
Device clear restores its requested scissor, write masks and values. No remaining
direct clearDepth/clearStencil writes bypass that cache in this wrapper. Review
found no additional specific gap requiring a new oracle.

## Independent results

Raw commands, exits, fresh memory measurements and logs are in
`evidence/d3d9-fresh-cache-independent-20261024/`. Each command uses
`timeout 60s node --max-old-space-size=256`, CPU limit 60 seconds and fresh
MemAvailable at least 805306368 bytes. The runner source is retained alongside logs.

* Exact independent fresh-target probe SHA256
  `4b550a8b7966228cddb3957c789803835c1df05bc128c45c5fac14a3b7e86408`:
  candidate PASS; exact rejection GPU backend FAIL at its original requested
  depth/stencil assertion. Existing-target and cold-cache controls PASS.
* Fresh cache suite SHA256
  `825ff9e55f47395a5d00ecffee602aa2e8b06bb0745bfc2105095d6b272e12e6`:
  PASS; named `--revert` FAIL at requested depth; `--implicit-only --revert`
  FAIL at implicit stencil cache agreement. All assertions remain intact.
* Original independent normalized-depth probe: candidate PASS, exact main FAIL
  for its original normalized-depth reason. Its first 2072 bytes, including
  observation and probe assertion, match the original reviewer exactly (SHA256
  `12c84f2b97688fdee0c805d746e78d52c6e1d90397e0041d33210c4b04b5e522`).
  The existing outer orchestration correctly expects candidate pass/base fail.
* Focused cache cases PASS: first/repeated/interleaved/default/absent/named,
  color/stencil, all 16 masks and no-op. Exact producer-adapter mutation FAIL.
* Producer seven semantic controls PASS, along with GPU wrapper, browser
  dependencies, neutral queue, shared worker, synchronous software present,
  D3D9 shared worker and present cadence regressions.

The fresh cache suite uses actual Device binding, depth allocation, target
initialization, wrapper and cache methods. The smaller independent probe replaces
allocation primitives but retains actual binder/initializer/wrapper/cache. GL and
texture primitives are mocks. Focused cache tests intentionally isolate the
adapter and are complemented by those actual-binding tests.

Compiler acceptance independently binds all five compiler paths/full hashes/Git
blobs to candidate objects, checks candidate source bytes, extraction order and
line ranges, and verifies the 5257-byte source SHA256
`4cae063bfb82249f7f09f85fe41a8b65ded473a787bb359492ef88ce605a61a4`.
The installed compiler runs in place; its five-function, one-page excerpt is
755 module bytes. This establishes software excerpt behavior and mocked GL
boundary correctness. Full module compilation, real GPU pixels/drivers, browser,
guest, rasterized draws and gameplay remain unproven.

## Integration, resources and recovery

Integration is serialized using `scratch/usage-watch/shared-integration.lock`.
The private task branch composes the complete reviewed stack and this report;
remote main is reread under the lock and final-tree checks run before a non-force
push. Publication receipts record actual local and independently queried remote
SHAs for main and the task branch. Root tracked files/index/refs and all donors
remain read-only. Only the board is appended via echo followed immediately by tail.

Private checkout: `/tmp/d3d9-fresh-cache-independent-integrate-oct24/repo`;
branch `task/d3d9-fresh-cache-independent-integrate-oct24`. Explicit non-cone
paths use read-only alternates; only this checkout's alternate list is flattened.
Measured input manifest is 3602980 bytes; original peak projection 56388608 bytes
is retained within 67108864, including Git/checkout, generated/temp/evidence,
complete external session/events/logs, positive SQLite growth, future outputs
and 8388608 reserve. Per-file cap 25165824; host free after projection must stay
above 2982150144. Admission and final accounting retain prior charges, including
an early oversized combined read. No history is reset or hidden by links/copies.

Recovery: fetch the verified task branch with the established dedicated strict
SSH configuration. No generated binary is required; runner scripts and compiler
checkpoint document reproduction. No guest mount argv exists and no box was
assigned (ID/state/expiry N/A). No worker launches, panes or deployment occurred.
Lifecycle remains coordinator-owned. The board watcher is stopped on release.
