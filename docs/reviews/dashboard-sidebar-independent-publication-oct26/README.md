# Independent sidebar acceptance and source publication

Accepted candidate `96be105a5b5b650ca99fd26024e9043aa0ddd7b9` onto remote main
`a18735d3b0e6dcb49a6cd1d65d054111d54340ff`. This review covers source only.
The private dashboard remains at its previously activated source; activation is
a separate assignment.

The sidebar calls the existing accepted `BlockerModel.countSummary(state)` from
the actual `render()` entry point. It displays exact distinct IDs and separately
labels anonymous rows. Empty snapshots clear the badge. The full summary is
assigned to the DOM `title` property. User IDs never enter that tooltip; hostile
summary text is also assigned literally, while the detail heading escapes it.
`ops/blocker-model.js` is unchanged. Numeric/boolean and non-string malformed IDs
are evaluated using the existing model's exact identity contract, without adding
frontend normalization or rejecting previously accepted input forms.

New independent acceptance: eight groups pass, including 128 deterministic
duplicate/status snapshots, 28 route/refresh transitions, hostile evidence and
tooltip text, anonymous/malformed IDs, exact case/whitespace identity, cycle
fallback, and differential detail HTML/classification/open/status-statistic
checks against the pinned baseline. The same fixture on the unchanged baseline
has seven assertion failures and zero loader errors; its baseline hash control
passes. `ops/dashboard-sidebar-independent.test.js` is a revision-pinned review
fixture: its baseline SHA assertion intentionally binds this acceptance to these
source bytes. It is not a general promise that unrelated future app revisions
have the same full-file hash.

Commands use installed Node 24, `--max-old-space-size=192`, CPU 90s, wall 120s,
file 24MiB, output 2MiB and excerpts at most 8192B. Actual Node startup shows
unlimited inherited DATA/AS; Git's 512MiB DATA limit applies only to Git children.
No guest, browser, build, acquisition, service, deployment, Telegram, box, worker
or lifecycle operation occurred. The coordinator retains lifecycle ownership.

The supplied candidate's five focused passing tests and exact-source negative
control, plus the prior unchanged 10/26/6 accepted groups, are reused. Merged
validation runs only the new independent groups on the actual merged sparse
tree. Candidate app/model/focused-fixture bytes are identical in that tree.
The full-tree diff from main contains only `ops/app.js`, the supplied focused
fixture and the new independent fixture before evidence is added. This preserves
the unrelated corpus publication, readers, model and all other main paths.

`receipts/merged-checkpoint.json` binds the tested tree and source/fixture hashes.
The evidence manifest hashes every retained payload except itself. The final
external receipt records the commit, published tree, evidence-only difference
from the tested tree, exact remote task/main refs, final resources and ownership
release. This avoids a self-referential commit/manifest hash.

Incidents retained in receipts: installed Python is named `python3`; incomplete
immutable donor closure required bounded loose-object recovery; a broad recovery
copy stopped at its internal 6MiB cap and subsequent recovery targeted only
missing objects; Node's `--test` subprocess did not forward custom `--app`, so
candidate acceptance used direct script invocation; and the original supervisor
raised on a negative-control excerpt over 8192B after retaining full output.
That return path now truncates excerpts and reuses the completed negative group.
No candidate defect, platform/access/resource denial or weakened guard occurred.
Original nested-alternate warnings are preserved separately. Donors, root dirty
data and shared Git stores were never edited.
