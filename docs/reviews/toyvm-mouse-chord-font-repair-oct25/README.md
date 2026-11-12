# ToyVM mouse chord and browser bundle repair

Repair base: `8b8ac8614180870951af07b79122b5e7d1b38c46` (independent
rejection of candidate `46e1ef402af1099e6d3f4bdfb0aec45e926ca1ac`). Dedicated
branch: `task/toyvm-mouse-chord-font-repair-oct25`. Main is not integrated.

Pointer Events deliver an additional mouse-button press as pointermove. The
binding now accepts the changed button during an existing owned mouse gesture,
including outside-canvas events. A different pointer, ordinary held hover,
late motion after blur, and motion after a run replacement cannot acquire
buttons. Partial releases and INT33 counters retain their existing semantics.
dos.js, keyboard/touch handling and the actual launcher callers are unchanged.

The bundle walk now fails on a missing required relative literal dependency,
reporting the importer, literal and resolved path. Full-line documentation
examples are excluded. Bare packages and computed optional CLI requires retain
their previous discovery behavior; no optional Node package is newly required.
Both bundles were rebuilt from the complete tracked literal closure: 44 main
modules and 43 JIT modules, including tools/fnt-read.js, tools/ne-dump.js,
tools/disasm.js and tools/simd-ops.js. The latter two were additional omissions
in the donor sparse checkout, found by the required-dependency check.

The independent tests are unchanged, byte-verified against the review commit:

| Check | Pinned candidate | Repair |
| --- | --- | --- |
| test-toyvm-mouse-independent-oct25.js | FAIL: 10 pass, 6 fail | PASS: 16 pass |
| test-toyvm-bundle-font-independent-oct25.js | FAIL: 2 baseline pass, 2 candidate fail | PASS: all 4 |
| Both bundle freshness checks | STALE | current |

The original builder was also evaluated against the full tracked closure with
the pinned candidate live.js bytes: both committed candidate bundles remain
stale. No candidate source or independent oracle was changed for that control.
The original 37 verified review seals and earlier delivery/release evidence are
reused from docs/reviews/toyvm-mouse-independent-integrate-oct25 and
docs/reviews/toyvm-browser-mouse-input-oct25; their conclusions are preserved.

New focused regressions exercise the exported binding and real LiveRun with
Machine.prototype.int33 on small fixture objects. They check owned outside
chords, duplicate press counts, mixed release/press, pointer identity, retry,
blur and fresh resumed gestures. Removing chord delivery is rejected. The
bundle regression masks each font dependency without changing files, requires
meaningful diagnostics, preserves bare/computed optional dependency behavior,
and rejects restoring silent omission. Documentation examples are covered.

Supplied mouse --bundle --controls, held-key tests, live --input-only, all 23
corpus static checks, both bundle freshness checks, 17 JS syntax checks and
exact generated corpus site wiring pass. Corpus payload freshness is skipped
because payloads are absent. No full corpus directory was checked out.

These are source/DOM/INT33 and module-registry checks. No Machine construction,
Wasm allocation/compilation/instantiation, real browser, game, native run,
runtime/service action, deployment, restart or denied Boat SSH retry occurred.
No box is assigned; lifecycle remains coordinator-owned. No workers were spawned.
Unrelated accepted qualifier, rendering, save-sync, dashboard, crash and graphics
work is preserved by the narrowly scoped diff against the review base.

External recovery and publication receipts are in
`/tmp/toyvm-mouse-chord-font-repair-oct25/ops`, including result.json,
evidence-manifest.json, closure.json, admission-final.json and RECOVERY.md.
Owned writable objects use only the supplied flat read-only object inputs.
Fresh admission includes checkout/Git/publication, evidence, session, shared
WAL/SHM, positive DB growth, futures and an 8 MiB reserve within 64 MiB.
Installed tools and standing read-only inputs are counted separately.

Routine internal corrections: the new test's Function evaluator initially
retained a shebang; it now strips it. Dependency discovery exposed the missing
disassembler closure and a comment example, resolved within this task. Early
combined metadata reading exceeded the 8 KiB excerpt target; subsequent reads
were narrowed. The original candidate's 113,292,552-byte checkout overrun remains
documented and noncompliant; this repair does not relabel that incident.

Stopping condition: tested repair published on its dedicated task branch for
fresh coordinator-assigned acceptance; no main integration or successor task.
