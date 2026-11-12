# Exact canonical qualifier: independent semantic acceptance

ACCEPT candidate `19b32dad2ac09a6ae022f1f5f619a91e3f7dde4c` against source/main
`a3fe340b962da3f31df249881074afe41d6c69a2`. Integration retains the repaired code
unchanged; source, binaries, guard and all donors are read-only.

The literal contract authority is independently grounded in the byte-identical
committed contract and source receipt from original candidate `806117a11f1b347340b5cc44fb52b79d0ac200e5`.
The contract SHA256 is `4aca68bf97038d771390dd499703fac2e559146186d23f34e6e27425a5083a4b`;
qualifier SHA256 is `c4f2d1383bb7fa253b2134443548820a4b6cd40991c4581cdd10d5a8db97cf70`.
It checks the digest before JSON parsing or any supplied path. Every supplied
identity, length, binary path, helper, guard and source receipt is thereby fixed.
Future contract changes require a reviewed code change. This is an exact
candidate authority, with no caller-configurable trust anchor.

Independent provenance checks matched all 140 source Git blobs at the pinned
revision and the compiler Git blob/full SHA256, without executing the compiler.
The accepted historical source derivation is reused. Both retained binaries
pass their complete hashes, lengths, types (172), imports (291), function exports
(2224), memory import/export (shared 8192/32768), custom sections and noStart
checks. All 269 storage/span records independently serialize to fingerprint
`9a3bc9149d58209c`, including DIRECT_WINDOW. Omission/change/duplicate controls
reject. All four historical diagnostic exports remain genuinely absent.

The supplied 35 rejection controls and 12 substitutions pass. Independent cases
add ten contract/path/nonzero/omission attacks, each rejected after reading only
the contract, plus same-count import/export substitutions, memory export index,
shared flag, type ordering, custom-section name and raw binary hash/length
changes for each binary. An exact relocated contract passes. No parse-only
acceptance is claimed for arbitrary modules: exact authenticated binary hashes
precede native construction, so the static parser is not a general validator.

The original reviewer script is byte-identical. It accepts the original baseline
and rejects the repair with identical regenerated malicious bytes; the adapter
only substitutes the exact qualifier module location, preserving the original
file/hash assertion. The original reviewer's malicious contract is also applied
directly to both modules without adapting any bytes. No zero-hash special case
or source-count-only workaround exists.

No remaining authority/path/provenance hole was found within this sealed,
read-only-input scope. Concurrent hostile mutation of trusted filesystem or
the reviewed JavaScript process is outside that scope. Artifact paths are fixed
and required on recovery; only the exact contract itself may relocate.

The genuine prior tail/compat Module-return receipts are reused only for the
baseline qualifier. The entire select/parser/metadata/main/native callsite is
unchanged. This task makes zero native WebAssembly API calls; static tests run
with throwing substitutes for every native entry point. No repaired native
rerun, compiler execution, rebuild, instantiation, SEH execution,
Configuration-to-Play, gameplay, full build-gate or deployment claim is made.

Evidence includes test commands and results, source/compiler blob verification,
independent test source and recovery scripts. Restore this branch and retained
readonly donors; place the saved scripts in an owned sibling ops directory and
use run.py with fresh full admission (heap256MiB, CPU/wall60s, file24MiB,
stdout+stderr128KiB, reap5s, task64MiB including reserve8MiB). Do not restore or
commit binaries. Exact merged/final tree and verified remote refs are recorded
in external ops/final-tree-tests.json, publication.json and sealed result.json.

Remaining gates: source changes invalidate qualification; native repair rerun,
runtime SEH, Configuration-to-Play, gameplay and full build gates remain open.
Actual Boat SSH403 api_key_action_forbidden is preserved, without query/retry.
No assigned box (null/notassigned/null), protected bx_69aem736 untouched;
coordinator owns lifecycle. No workers/successors were launched.
