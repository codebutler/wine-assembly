# Recovery

Candidate branch: `task/render-positiont-recovered-input-oct23`.
Exact parent: `bb9c496ed13095cc832fdf607f0937fb9c14b7de`.
No generated application binary is needed or claimed.

Restore the branch with a normal authorized checkout on a sufficiently sized
host. Run `node test/test-d3d9-shared-positiont-ir.js` for the self-contained
native fragment test. Run the commands in `checks.json`; the position-format
replay adapter explicitly substitutes the focused native test arena for the
canonical render harness. It does not build the application.

The full main tree list retained locally as `main-tree.txt` is an index
preservation aid, not a new source manifest or an artifact required by tests.
`admission.json` and `closure.json` record the measured source closure.
Every recovered source blob was checked against the exact base tree; narrow
raw-file recovery was authorized if a local object was absent. No broad fetch,
archive recovery or donor metadata change was used. The checked coordinator
stream input was verified and materialized byte-for-byte (`recovered-input.json`).

No runtime module, game assets or ignored binary are claimed to be backed up
by this commit. Native source-only acceptance and outstanding browser/game
gates are detailed in the durable re-note and result.json.
