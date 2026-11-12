# Optional catch binding lexical repair

Starting revision: `5b80af999191fbb0779d2daa026dcc48fc210ebc`.

The dependency scanner treated `catch {}` as an object expression because it
only recognized the parenthesized catch control head. Consequently the slash in
`try {} catch {} /require('.\/missing-adversarial')/.test('');` was treated as
division and inert regexp text falsely became a required dependency. Recognize
the optional catch body as a statement block; its closing brace admits a regexp
statement. Bound catch handling and surrounding expression boundaries retain
their existing behavior.

The unchanged adversarial oracle improves from 19 passes / 1 failure to 20
passes. All prior oracles remain byte-identical: lexical 8 and 37, chord 16,
font 4, lifecycle 36, required dependencies, supplied mouse/input controls, and
chord repair pass. The new fixture passes 31 optional/bound/nested catch,
finally, regexp and required-import/division controls. It checks valid syntax
without executing injected code. Removing the correction makes this fixture
reject the false dependency again; restoring it passes.

Both bundles were regenerated, remain byte-identical to the input, and pass
freshness checks. Complete tracked dependency postorder remains 44 main / 43
JIT modules, including the font reader and its dependencies. No runtime,
WebAssembly, compiler, browser or guest execution was performed.

This remains a scoped CommonJS lexical walker, not a complete JavaScript
parser. Existing fail-closed restrictions remain: escaped identifiers and
slash immediately after a colon-introduced brace are rejected rather than
guessed. Their existing controls are unchanged and pass. This repair does not
claim support for every ECMAScript grammar context.

`acceptance.json` records commands, tested source tree, preservation hashes and
the rejecting control. Detailed logs, admission, publication, recovery and final
manifest are retained at
`/tmp/toyvm-optional-catch-lexical-repair-oct26/ops/`.
Prior accepted unchanged evidence is referenced from
`/tmp/toyvm-lexical-independent-integrate-oct26/ops/result.json`; its packaging
was not duplicated. No main integration is authorized or performed.
