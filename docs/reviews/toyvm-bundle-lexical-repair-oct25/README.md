# ToyVM bundle lexical dependency repair

Base review: `cbcc67e0a577ea42be1aeb65707f79185852f2c3` (candidate
`99288dd5ad8dfa6f5bcdcdb1ae363aaddac28c3f`). No main integration.

The raw require regexp mistook block comments, trailing comments and quoted
examples in actual dos.js for imports. Dependency discovery now walks lexical
tokens, skips comment/string/regexp/template text, and visits executable template
substitutions. Direct relative single-string require calls allow intervening
whitespace/comments and decode JavaScript string escapes. Bare packages and
computed arguments retain their prior optional behavior. Missing real literal
imports still throw with importer, requested path and resolved path. Traversal
remains deterministic, deduplicated dependency-first DFS.

The scanner is scoped to the current CommonJS source closure, not a complete
JavaScript parser. Escaped identifiers and slash immediately following a
colon-introduced brace are explicitly rejected with importer/offset, rather
than guessing a lexical goal and silently omitting an import. Focused controls
exercise these fail-closed limits. Current tracked modules need neither form.
No source text is stripped or rewritten in either generated bundle.

Unchanged independent lexical reproducer: baseline **3 FAIL / 5 PASS**, repaired
**8 PASS / 0 FAIL**. Its supplied SHA-256 remains
`31f1f93997577c624071c0172a0357258bf2429f37fe7ce102ed323330b1580a`.
The added actual-source lexical suite passes 37 controls, including escaped
quotes/path literals/line continuations, comments around real call tokens,
regex versus division after control/function/class contexts, nested template
substitutions, member calls and computed optional imports. Injected prefixes
are syntax-checked and then supplied only through a read adapter.

Preservation on the repaired source:

- Unchanged independent pointer chords16/16, font4/4 and mouse lifecycle36 PASS.
- Supplied mouse --bundle --controls, repair chord, heldkeys, live --input-only PASS.
- Required dependency suite PASS; missing font and silent omission mutations REJECTED.
- Corpus static23 PASS (payload freshness skipped because payloads are absent).
- Both bundles rebuilt from complete tracked closure:44 main/43 JIT, including
  fnt-read/ne-dump/disasm/simd-ops. Complete module set AND order exactly match
  pinned accepted closure. Both outputs are byte-identical to pinned bundles;
  --check passes, so no generated bundle diff is needed.
- Site generation and byte-exact corpus caller wiring PASS;19 syntax files PASS.

No VM/Machine construction, Wasm compile/allocation/Module/Memory/Instance,
browser, native, guest/game run, runtime/service/deployment/SSH403 retry.
Box null; lifecycle coordinator. Root/donors read-only except append-only root
messageboard. Standing evidence56 seals is reused from coordinator dispatch;
exact current source/reproducer pins are independently checked here.

The source seals and logs bind this change. Consolidated final tested tree,
commit/strict-SSH remote verification, all-new resource accounting, ownership
closure and root ref/index checks are in the sibling task ops/result.json and
evidence-manifest.json. The original operational cap overrun and this task's
capture/routine corrections remain documented in incidents.json.
