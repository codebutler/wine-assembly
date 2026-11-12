# Maelstrom select lifecycle independent review — 2026-10-24

FAIL: do not integrate candidate `0e1b2df6e3adff9ad43424966a389c2ea6af227e`
(tree `c53f436c05b8ff1b846b239dc51a838b5eab81a7`). The unchanged candidate
accesses unused option getters while disabled. No producer code was repaired;
main integration was withheld under the assigned stop-on-defect rule.

## Confirmed defect

`tools/maelstrom-select-lifecycle-observer.cjs:8` destructures all observer
configuration before checking whether observation is enabled. An unused
`maxInvocations` getter therefore runs even with `enabled:false`.
The `transform` parameter at line 141 destructures `lifecycle` and constructs
the rest object before its disabled early return. This invokes unused lifecycle
and pin getters. Each can have side effects or throw, so disabled transform fails
to return the source unchanged and disabled observer creation can fail.
This violates the explicit requirement that disabled paths avoid unused arguments.

Minimal example on the exact candidate:

```js
const o = require('./tools/maelstrom-select-lifecycle-observer.cjs');
o.transform('source', {
  enabled: false,
  get exportsSource() { throw new Error('unused'); }
}); // throws instead of returning 'source'
```

The adjacent evidence directory contains `disabled-repro.cjs` and captured output
for three independent cases: unused transform pin, unused transform lifecycle,
and unused observer limit. All propagate the exact throwing-getter sentinel.
Run with:

```sh
node docs/re-notes/maelstrom-select-lifecycle-independent-20261024-evidence/disabled-repro.cjs \
  "$PWD/tools/maelstrom-select-lifecycle-observer.cjs"
```

Expected candidate outcome: three FAIL records and exit 1. No WebAssembly APIs,
instance, memory, runtime, module, or guest are needed to demonstrate this defect.

## Validation and limits

Both supplied suites passed on the exact candidate using the pinned standing
runner, `13-exports.wat`, and scheduler. All seven lifecycle and six accepted
observer mutants rejected. Implementation/test syntax and candidate/base diff
whitespace passed. The accepted observer remains SHA-256
`52909f8dc9e39c9c294602c952d9bbbf4e91c52d5c56ddbba45fb3cb30d9e226`.

The existing disabled oracle checks an ordinary option object and `wrapInstance`
identity/read counts; it does not poison unused option getters. The transform
identity test supplies no unused getters. The fake instantiate setup exercises
enabled composition and source-shaped boundaries; it supplies no assurance about
this disabled failure or actual runtime acceptance.

Inspection found the intended fixed call identity includes thunk, metadata, ESP,
return address and all six saved words. Retry pairs require a matching cleared
pre-state and matching reason-8 post-state, excluding halt-4 guards. Unmatched
transitions close identity tracking. Candidate summaries keep return candidates
unknown, witnessed returns zero, completion unobserved and API result unavailable;
stale EAX is not promoted. Cached tick comparisons explicitly do not sample
`host_get_ticks` or establish deadline progress/freeze. Existing tests cover caps,
bounds, original return/exception identity, one original run, and forbidden clears.
These observations do not override the confirmed disabled-path failure or certify
every other acceptance property. Review stopped on that defect.

Coordinator identity receipts for 30 candidate blobs and 47 parent seals were
reused. Checkout candidate/tree and supplied pins were checked independently.
The parent original-game capture proves arrival only; absence of later records
and final 972/972 counters do not establish execution, return, or stall.
No accepted native qualification was repeated.

## Publication and resource scope

Only this compact review and independent evidence are added on
`task/maelstrom-select-lifecycle-independent-integrate-oct24`; main is not updated.
No integration lock was needed because integration was rejected.
Operational final remote SHA, committed-artifact checks, resources and cleanup
are in `/tmp/maelstrom-select-lifecycle-independent-integrate-oct24/ops/result.json`.

Fresh admission passed within 64 MiB, including all new checkout/Git/evidence,
full launcher/session/WAL, positive SQLite growth, future publication and an 8 MiB
reserve. The fresh SQLite baseline precedes checkout but follows initial
instruction/receipt reads; earlier growth was not measured. Standing tool/donor
inodes were read in place. Explicit sparse checkout used dependency-first
flattened readonly object alternates; no fetch, clone, repack or object-store copy.
Cheap commands used Node heap 256 MiB, CPU/wall 60 s, output 131072 bytes,
file cap 24 MiB and group TERM/KILL/reap within 5 s.

One bounded messageboard watcher reached its 60-second wall cap and was terminated
and reaped with guard exit 99; this tooling event and all producer historical
errors/charges remain retained. The first local commit failed because fresh Git
had no author identity; local configuration was then set to the existing project
identity. The failure receipt remains in ops and committed evidence.
No denial was retried. No runtime, compilation,
native execution, real instantiation, guest, box, download, deployment or worker
was launched. Claude stayed idle. No box was assigned; coordinator reports
`bx_qa9ex5bu` stopped; `bx_69aem736` was untouched. State/expiry were not queried.
Root tracked files, index, refs and donors were readonly; root messageboard was
used append-only.
