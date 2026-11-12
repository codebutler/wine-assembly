# Authenticate the canonical qualifier contract before following input paths

The original qualifier accepted a contract that supplied both a source receipt
and the expected hash of that receipt. Independent rejection
`6c4b06b8754989d6f91769cb3f1b8dd6b98ac32c` demonstrated that a fabricated receipt
passed all static checks for both retained binaries. The repaired `load()` first
checks the exact contract bytes against SHA256
`4aca68bf97038d771390dd499703fac2e559146186d23f34e6e27425a5083a4b`, fixed in the
reviewed qualifier. No supplied field, environment override or alternate receipt
can change this authority. This is deliberately an exact-candidate qualifier;
a future contract requires an independently reviewed code change.

The authority comes from the exact committed `evidence/contract.json` and source
receipt blobs in remotely verified candidate
`806117a11f1b347340b5cc44fb52b79d0ac200e5`, cross-checked in `evidence/review.json`.
It authenticates all input paths, lengths and hashes, including the complete
ABI/layout inventory, static type inventory, guard, historical helper and
source receipt. The receipt semantics are also checked against the authenticated
closure: source revision `a3fe340b962da3f31df249881074afe41d6c69a2`, all 140 source
identities, verified-file count, expanded-source hash, compiler path and actual
compiler bytes, ABI counts, historical source evidence, absence of the four
diagnostic exports, and complete layout inventory. The retained closure is
`e9c212ccd85445de89271af25660b331b548f8cb2d40ffa5271b312c6c0e699d`; compiler is
`d04ed1d5ca74fc1b6f10357576a38e726d58f0ad908ccf34a29de35052aa1a33`.
This reuses the sealed source derivation; no compiler was executed.

Both exact binaries pass all static checks: 291 imports, 2224 function exports,
172 types, no start section, shared-memory signature and layout
`9a3bc9149d58209c` with 269 storage/span entries. The parser, signatures, metadata
checks, native callsite and guard are byte-for-byte unchanged after `select()`.
All 35 existing rejection controls pass. Twelve new substitution controls reject
coordinated receipt/hash, plausible nonzero identities, revision, counts/layout,
closure/compiler, allowed binary, input omission and supplied authority changes.
These tests observe rejection after reading only the supplied contract file.
An exact contract copied to another filename still passes.

The unchanged reviewer `reproduce.cjs` SHA256 is
`dccbc1f1667332d85805146fb499bff94a744c6e95437368eedfa9dbcfa9f91c`.
`evidence/reproducer/originals/` preserves the original reviewer files byte-for-byte.
The unchanged script was copied to an owned output directory, where it succeeded
against the baseline and wrote its malicious files. `reproducer-repair.cjs` then
re-executes that same script using the same malicious bytes, with a clearly
labeled module-location-only require adapter. The original file/hash assertion
still reads the original qualifier; the adapter returns the repair for that
one require. The repair rejects at the authority check. Both qualifiers were
also checked directly against the exact original reviewer malicious contract:
baseline static acceptance and repaired rejection, without modifying donor files.

Recovery: restore the task branch and retain the exact donor paths named by the
contract. Binaries are readonly standing inputs, never copied or committed:
tail `bf707aa41e2883e1407c71810a15fd5f1816961938c1103c8d1d5bd40cb701d9`
(1880317 bytes), compat
`ff495de2b12c308013fa489b9fb291ca836171929655ca20df03440946c54dbc`
(1882890 bytes), under `/tmp/seh-corrected-memory-canonical-build-oct25/ops/`.
The prior exact genuine Module-return receipts are retained unchanged in the
baseline evidence and identified in `review.json`. They are evidence for the
baseline constructor call, not a claim that the repaired qualifier was natively
rerun. No new WebAssembly API calls, rebuild, instrumentation or guest execution
occurred. Existing tests use static facades and a fake guard constructor only.

Run the existing `test-qualifier.cjs CONTRACT OUTPUT`, new
`test-trust-anchor.cjs CONTRACT OUTPUT_DIRECTORY`, and retained reproducer stages
with Node `--max-old-space-size=256`, using the reviewed supervisor implementation
in place via the retained `run.py`. `CONTRACT` is the original exact
`/tmp/seh-current-canonical-qualifier-oct25/ops/contract.json`.
Fresh admission is mandatory: RAM at least 1GiB; total new allocation at most
64MiB including 8MiB reserve, full shared WAL/SHM, positive DB growth, launcher
and session bytes; disk floor 2982150144 bytes after the whole allocation, with
627523584 extra volatility margin before checkout. Every executable stage uses
CPU/wall60s, regular-file24MiB kernel limit, aggregate stdout/stderr128KiB and
TERM/KILL/reap5s. Installed tools and donors execute in place. The root refs are
hashed with the coordinator's bounded streaming helper (8192-byte chunks,
zero listing capture); root index/status/refs and donor seals compare unchanged.
Two early local setup syntax/schema mistakes were corrected before checkout;
their logs remain retained. No admission or access denial was retried.

No integration to main. No runtime SEH, Instance, Configuration-to-Play, gameplay
or full build-gates claim. Boat SSH403 `api_key_action_forbidden` remains, with no
query or retry. Box ID/state/expiry: null/notassigned/null; protected
`bx_69aem736` untouched. The coordinator owns lifecycle. No worker or successor
was launched. Independent review is the next decision.
