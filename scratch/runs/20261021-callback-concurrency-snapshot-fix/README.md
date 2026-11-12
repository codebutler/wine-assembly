# Bounded snapshot correction

Parent candidate: `f8f9785c99cf121cca22ca7c1560903a5e403005`.
Fresh remote main: `bc53c1d1cbd1da82f44835cda31e193a52a63aa8`, already an
ancestor of the candidate; no merge or shared-WIP import was needed.
Rejection reviewed: `4b0dbb5d25e9ac6710bd9ba822cac1000261ac0a`, including its
README, reproducer and test results. Those original artifacts are unchanged.
Reuse its accepted production extraction, owner assignment and barrier findings;
this correction does not broadly re-review them.

All three whole-memory before snapshots now use a byte copy through `preserved`.
The alias overload remains only as an explicitly broken regression control.
Each control runs the production scenario to the selected phase, changes the
serial with XOR 1 after completion acknowledgements, and executes the same
deepStrictEqual comparison as the positive case. The failure must identify that
phase and comparison operator. Fixture restoration happens in finally after the
comparison, allowing the alias control to complete its remaining scenario.

The positive case and all three broken-alias controls complete 2,035 unique
roots/children each. The corrected versions reject corruption at overflow/
mismatched leave, stale owner and all-exhausted. All four workers terminate on
each injected assertion failure (threadId -1); measured times are 1.95, 2.43,
3.76 ms, each below 15 seconds. The outer test has a 90-second timeout. This is
evidence for these failure paths, not an exhaustive hang/error campaign.
The shared header may legitimately change during mixed successful/rejected
allocation: those operations retain per-owner copied state comparisons. No
whole-memory check was added around mixed contention or replacement rounds.

`tests.json` records exact commands, timings and exit statuses; `check-2.log`
contains production, two existing allocator controls, three corruption rejects,
three alias false accepts and cleanup results. Existing token regression passes.
Environment: Linux x64, Node v24.18.1, V8 13.6.233.17-node.50. An initial
development run rejected corruption as intended but its outer validator wrongly
expected the entire AssertionError message to equal the custom label; Node adds
a byte diff. The validator now checks the assertion type/operator and phase
prefix. The recorded final run passes; no production logic changed after it.

Recovery: materialize the exact candidate plus this correction using the file
closure in `admission.json`, then replay `tests.json` commands from that root.
No package install or canonical build is needed. Objects were verified and the
878,825-byte sparse projection measured before checkout. Prewrite free-space
checks require more than 2,982,150,144 bytes (2,285,895,680 + 600 MiB); task
allocation including newly written Git objects remains below 64 MiB.

The original report's preservation claims are explicitly superseded. This is
source-only allocator test qualification, not independent acceptance. No
production allocator/API/SEH changes, jump enablement, Windows or gameplay
claims, runtime/build/download/repackaging/deploy actions, or main merge.
No box assigned; all boxes stopped per coordinator. No lifecycle action taken;
coordinator ownership unchanged. No agents or other workers launched.
