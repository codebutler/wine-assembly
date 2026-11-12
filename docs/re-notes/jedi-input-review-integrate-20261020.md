# Jedi renderer input: independent acceptance and integration

Accepted `53ab864327c8d00fb5783dbee6354e68650d325b` against current main
`71a60db4004e5df74cfa232f7a59edc109ffc660`. The production delta is exactly
the candidate's seven added lines in `lib/renderer-input.js`. Distinct
top-level trees follow their painted z-order; the existing smaller embedded
dialog preference applies within one tree. WS_CHILD ancestry must not treat
popup ownership as parentage. No other candidate source ancestry is included:
the reviewed paths are applied to current main, then committed for a normal
fast-forward push. The previously accepted report from
`01a46a6d54e65ea5b056b42c54ab83b9087d209b` is included byte-for-byte.

## Independent tests

The exact current-main renderer equals the candidate's pre-fix renderer.
Replayed ordinary DOWN/UP through the actual renderer and compiled production
`wnd_top_level`, `dialog_route_mouse_screen`, `dialog_route_mouse` and
`ctrl_style_disabled`. The 1,119-byte routing module SHA-256 is
`f24f3533441957d52c465350428aa0654d47e8d1e35525d1a4809c4c802c1ddc`.
All five original cases pass. Seven additional cases pass: a child with a
higher local z value cannot escape its tree; a raised owner tree wins over
a lower popup; nested child ancestry; same-tree sibling area preference;
active modal precedence; outside-modal rejection; and disabled-top-dialog
rejection without activating the surface underneath.

Baseline, owner-as-parent and reversed-z mutations each fail at the first
actual DOWN target assertion, choosing `0x1000f` instead of `0x1006b`.
Existing modal-release and button-queue tests also pass. No WM_COMMAND is
injected. Reproduce from the integrated checkout:

```sh
node test/test-jedi-components-input.js
node test/test-jedi-components-input.js --baseline
node test/test-jedi-components-input.js --mutate-owner-as-parent
node test/test-jedi-components-input.js --mutate-reverse-z
node test/test-renderer-dialog-modal-input.js
node test/test-renderer-dialog-button-queue.js
```

The three flagged commands are expected to exit 1 at the target assertion.
The initial added raised-owner fixture selected the right window but lacked
the child enumeration needed to route through a non-dialog parent. The
bounded fixture now makes that frame a dialog, keeping delivery rooted at
the selected dialog. The initial failure log is retained. This does not
claim to test generic non-dialog-parent recursion.

Window metadata, client geometry, activation side effects and final wndproc
delivery remain adapters. These tests establish input selection and compiled
control delivery, not native button activation, guest continuation, installer
advancement, installation, browser behavior or gameplay. No full module was
built and no runtime was accessed.

## Config reconciliation and preservation

Read-only reconciliation fully explains the earlier report integration block.
Current shared config SHA-256 is
`6d4dfc966d3443b7e89d89e03027dd4817c18ead81a9f0fa16ae152e018d4c07`,
identical to the input worker's preserved baseline and the report review's
final hash. Inserting exactly this stanza into those current bytes reproduces
the review's initial hash
`346aa122d5f0c9d8aaf50ae761116a98786a4ee0c12782acae7602ab737a91c5`:

```ini
[branch "task/jedi-components-input-fix-oct20"]
	remote = origin
	merge = refs/heads/main
```

There is no unexplained remaining byte difference. Config was not written
or restored by this review; no credentials are copied into evidence.
Automatic upstream configuration is disabled per Git command.

Evidence and recovery scripts are retained under
`scratch/runs/20261020-jedi-input-review-integrate-oct20/`.
`review.js` reruns the bounded checks; `tested-identities.json` pins their
inputs, `config-reconciliation.json` records the exact hash reconstruction,
and `receipt.json` records publication and shared-state checks. Prior input
and accepted-report evidence seals are independently verified without editing
their bundles. Exact sparse patterns were installed before materialization.
The task cap is 8 MiB, with floor 2,210,398,208 bytes plus 32 MiB reserve and
24 MiB concurrent reservations. Shared HEAD/index/config and unrelated WIP
are preserved; laptop Heroes II/Warcraft III and all review holds are untouched.
