# Browser mouse independent acceptance: REJECT

Candidate: `46e1ef402af1099e6d3f4bdfb0aec45e926ca1ac`, tree
`5bc400eaecedec6e74a47c99e315de312c1ac656`, based on main
`d9012a86a91c13dbe70dbcc4dceff2d7895c18a4`.
The candidate implementation and bundles were not modified. Main was not merged
or published. Review branch: `task/toyvm-mouse-independent-integrate-oct25`.

## Rejecting reproducer: button chords

Run `node test/test-toyvm-mouse-independent-oct25.js`. It exits 1 on the exact
candidate: 10 cases pass, six fail. It uses the exported binding and LiveRun,
with Machine.prototype.int33 on a small plain state fixture; no Machine/VM is
constructed and throwing Wasm guards remain armed.

Sequence: mouse pointerdown, button=0, buttons=1; then pointermove, button=2,
buttons=3 at the same position and pointer ID. INT33 AX=03h must report BX=3;
the candidate reports BX=1. Reverse left/right and left/middle sequences also
fail, in both source and the generated main bundle. Fallback mousedown sequences
pass, as do stale-motion suppression after blur and a fresh resumed gesture.

The cause is tools/toyvm/live.js:735: only kind=down can introduce buttons;
other events intersect the previous mask with event.buttons. Pointer Events
deliver additional button presses during an existing mouse gesture through
pointermove. The supplied fixture instead sends repeated pointerdown events,
so its green result misses this ordinary browser event sequence. See the
[Pointer Events button model](https://www.w3.org/TR/pointerevents2/#chorded-button-interactions)
and [pointermove definition](https://www.w3.org/TR/pointerevents2/#the-pointermove-event).
Repair must retain retry/release ownership rather than blindly accepting every
held hover event. No repair is included in this review.

## Rejecting bundle regression

Run `node test/test-toyvm-bundle-font-independent-oct25.js` from a checkout with
the pinned main baseline objects available. It exits 1: the ROM-font loader is
loadable from both baseline bundles (two positive controls), while both candidate
bundles throw `cannot resolve tools/fnt-read.js from tools/toyvm/browser-entry.js`.
No compiler, Wasm object, rendering or guest is invoked.

Both generated bundle freshness checks fail when the unchanged reachable source
files tools/fnt-read.js and tools/ne-dump.js are present. The implementation
donor sparse checkout omitted these files. The bundler silently skips unavailable
literal dependencies. The committed baseline bundles include the font loader;
the candidate bundles remove it. dos.js:62 still requires it, and its catch at
romStrike leaves the ROM tables blank when unavailable. This is a source/module
regression, not a measured gameplay/rendering result. Candidate bundles remain
unchanged for the reproducer. The first partial-closure freshness diagnostic and
the expanded-closure diagnostic are both retained externally.

## Remaining checks and qualification

Supplied `test/test-toyvm-mouse-input.js --bundle --controls` passes, including
its delivery/release removal controls. Held-key tests, live `--input-only`,
23 corpus static checks and syntax for ten relevant JS files pass. Corpus payload
freshness is skipped because payloads are absent. Generated corpus site.js exactly
matches tools/toyvm/site.js's JS constant; both actual callers use bindInput and
their error paths call stopLive. Both bundle freshness checks fail as above.

All 12 original source seals and five dispatch pins were verified unchanged;
dos.js is byte-identical to the pinned main baseline. Reuse original
docs/reviews/toyvm-browser-mouse-input-oct25/{source-seals.json,baseline.log,
validation.log} for original baseline/delivery/release control evidence. These
show sensitivity to missing delivery/release but do not establish chord behavior
or a complete bundle module closure. Existing accepted qualifier/dashboard/crash/
graphics/save-sync/overlay/renderer work is preserved by leaving main unchanged.

The original implementation's 113,292,552-byte sparse-checkout overrun remains
noncompliant and is not relabeled. This independent task uses an exact file
whitelist, no corpus payload directories, its own writable Git objects and only
flat read-only object leaves (no recursive alternates/full clone/repack).
Two initial metadata reads produced tool-truncated output beyond the requested
8 KiB excerpt size; this was a capture-control incident. Subsequent inspection
was narrowed and focused execution uses a streaming 128 KiB command-output guard,
60s CPU/wall, 24 MiB file limit, Node heap 128 MiB and TERM/KILL/reap within 5s.
One diagnostic assumed buildBundle returned a string; it returns {js,modules,src};
the diagnostic was corrected without changing candidate files or any oracle.

Fresh admission, bounded logs, syntax, source identities, publication verification,
resource accounting and consolidated completion receipt are retained under
`/tmp/toyvm-mouse-independent-integrate-oct25/ops`. Important rejecting logs are
also committed here. No runtime/browser/gameplay, sound or FPS acceptance, public
deployment, restart, Boat/SSH attempt, guest, compiler or Wasm allocation occurred.
No box is assigned (ID/state/expiry null/notassigned/null); coordinator retains
lifecycle ownership, protected boxes untouched. The platform SSH403 was not retried.

Stopping condition: rejected with unchanged reproducible defects; coordinator
assigns any repair. No worker/agent/successor was spawned.
