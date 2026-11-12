# Recovery

Task branch: task/file-bundle-bounded-read-repair-oct26
Commit: 45b0448b97a325afafa5afc6c9aebf79a9946c03
Accepted donor base: 9148ceb18768955f647130c2e936228429892477 (not current main).
Only lib/file-bundle.js and test/file-bundle-bounded-read.test.cjs changed.

Fetch the published task branch into a separate sparse checkout containing those two paths. Existing local repository uses READONLY /tmp/render-elision-independent-integrate-oct26/ops/flat and small copied donor-local loose objects in ops/flat. No donor changes, full checkout, history fetch, deploy or runtime access occurred.

Run: timeout 30s node --max-old-space-size=192 --test test/file-bundle-bounded-read.test.cjs
Baseline: set FILE_BUNDLE_TEST_SOURCE to the absolute ops/baseline-file-bundle.js path and run the same command. Unchanged pinned baseline fails; repaired source passes eight tests. Smallest limit is injected by replacing only the exact MAX_BYTES declaration, preserving production code. Ordinary real-file test uses original 64 MiB constant. Largest data fixture is 131079 bytes.

ops/checkpoint.json binds source/tests and both outputs. ops/incidents.json retains setup failures, including the temporary excessive materialization from dereferenced donor links; it was removed before tests. Initial donor footprint number counted link metadata and was incomplete. Final Git alternate directly reads the existing flat donor, with no copied packed inputs.

Coordinator must reconcile against current main separately. No runtime/gameplay claim, no box assigned; lifecycle remains coordinator owned.
