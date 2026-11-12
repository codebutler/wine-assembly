# Hock placement/startup notifications: integration accepted

Accepted production candidate: `776d37d55d2f749dcb29203e3bd26b8a5e9c05bd`.
Integration base: `1d8dbd7a44656178d01869f28869be624a59fa39`.
This integrates the exact ten-file production/test/census delta, including the
inherited c4718fb notification correction, dd6c585b return convention, and
final SIZE lifetime correction. No producer bytes were adapted.

SetWindowPlacement now snapshots its inputs and uses USER's positioning
transaction. Startup SIZE reads current client geometry; each activation
continuation retains and validates its own HWND and result. CACA003D retains
that ownership through the final SIZE callback. ShowWindow returns entry
visibility on destruction; placement and implicit creation return failure.
The loader and worker thunk scan agree on the new completion marker.

The full delta against main was inspected, including guest test assertions,
cleanup paths, client mirror publication and census changes. Exact blob/mode
comparison establishes that every integrated file outside documentation,
TODOS.md and ops/STATUS.md equals the tested candidate. The integration mapping
is in `hock-qualified-notify-integration-20261021-identity.json`; the complete
7,146-file runtime SHA256 manifest is in the retained runtime evidence archive.
All candidate blobs independently matched that manifest. The unchanged
package lock, compiler, build scripts, source closure, host and tests therefore
retain the tested identity. Documentation-only omissions/additions do not
require another canonical build. Historical census wording about unexecuted
runtime tests records the source-fix checkpoint; the qualification below
supersedes that wording, without claiming all callback ownership is resolved.

Independent source acceptance is `f6287affd5ac8b6ddea3dd730bfe09cfc2ea942d`;
runtime acceptance is `06868f3c3b03fdf9a59ff681747b95c51bde1d4f`.
Their reports and final acceptance evidence are retained alongside this report.
Earlier reviews 601ba885 and c5e09ae0 rejected real ShowWindow-return and final
SIZE destruction defects. Acceptance relies on the corrected candidate's actual
guest tests, not those superseded modules or the source-slice model.

The runtime archive's 81 seals and its 36 remote-file seals were independently
verified. Raw untruncated Boat receipts confirm canonical build
`cmd_xlznfbqqt5xm`, guest tests `cmd_r9wfzv9og2hs`, and original route
`cmd_ffeztokfduo4` exited zero. The build ran all required gates. Canonical WASM
SHA256 is `728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`;
compat is `25519647def1c2a25f505a81743d21dec55472ede8780f809edf09b6bb231018`.
Source manifest SHA256 is
`9918eef5f9b441693bf39f425ab988af7f5883971c451ddea53796bddae07a76`.
Runtime source and all 44 intake entries were checked before/after execution;
the final receipt retains identical module hashes and clean tracked status.

Twelve positive commands passed. The original five-stage actual-guest repro
returned zero after destruction at ACTIVATEAPP, ACTIVATE, SETFOCUS, MOVE and
SIZE, with dead targets and intact stack/nonvolatile/depth assertions. The
maintained suite covers sixteen final SIZE show/placement/implicit-creation
cases with nesting and destruction, natural ShowWindow visibility controls,
current-client geometry, placement snapshots, nested transactions, queued SIZE,
show-state changes, actual thunk loading/synchronization and related suites.
Both negative controls exited one at the intended result assertions. The
original repro and route driver were verified as path-only adaptations.

All eight sealed images were inspected. The original 39-file route ran
45.277496 seconds with 19 acknowledged events and nine guest mouse dispatches.
The full HUD is visible, the clock advances 120 to 86, and the player follows
left/center/right input. Sprites can overlap the clock. Score stays 0/20.
Hits, scoring, completion, audio quality/synchronization, FPS and Windows parity
remain unqualified. This is a bounded compatibility correction, not whole-game
completion or a universal HWND-generation/activation-lifetime guarantee.

Local validation rechecks source mapping, evidence seals, syntax and census
without a full VM/source build. Unrelated shared-worktree edits are excluded.
Historical multi-megabyte repair archives are omitted; final source and runtime
acceptance evidence is retained. Recovery and publication receipts live in
`scratch/runs/20261021-hock-qualified-notify-integrate`.

Assigned runtime bx_c6f3np32 is left RUNNING, idle/healthy, expiry
2026-10-21 08:14:54.696Z. The coordinator owns shutdown. No deployment,
runtime rebuild, worker launch, box lifecycle change or new game assignment
is part of this integration.
