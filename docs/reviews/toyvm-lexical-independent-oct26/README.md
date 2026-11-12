# Independent ToyVM lexical acceptance: REJECT

Candidate a7794b712404b2832f88046731293dd124f3579c, tree
218c33545f987b61e7c7ffb2f79e474e5f41062d. No main integration.

Valid JavaScript `try {} catch {} /require('.\/missing-adversarial')/.test('');`
contains no require call: its regexp is inert text. The actual exported
moduleList walker instead throws a missing literal dependency for
./missing-adversarial when this prefix is injected into dos.js. The new test
parses each valid prefix with JavaScript itself without executing it, then
asserts semantic closure equality for inert text. The optional-binding catch
case fails; 19 other independent controls pass, including real imports,
escaped text, template expressions, division, and unterminated text rejection.
Malformed-source controls replace the entire source, avoiding accidental
termination by the ordinary module's later text.

Cause: code() treats a brace following `catch` as a non-block operand; its
closing brace consequently leaves expression=false, so the following slash
is read as division. Regexp body tokens are then mistaken for a direct call.
The documented unsupported forms (escaped identifiers and slash after a
colon-introduced brace) do not include optional catch binding. This is an
actual false dependency, rather than a scoped unsupported-syntax rejection.

Run `node test/test-toyvm-lexical-adversarial-oct26.js` unchanged: expected
exit 1 on this candidate. It reads the actual walker through an fs adapter;
no VM/Machine construction, compiler, Wasm allocation, browser or guest run.
The ordinary lexical reproducer is unchanged and passes 8 checks; supplied
lexical37, chord16, font4, lifecycle36, mouse and required-import rejection
controls pass. Complete tracked dependency postorder matches the prior
accepted closure (44 main / 43 JIT); both byte-exact bundle freshness checks
pass. Existing exact-revision evidence remains referenced from the candidate
review and /tmp/toyvm-bundle-lexical-repair-oct25/ops/result.json.

Decision: reject lexical repair for integration; retained mouse/chord/font
changes pass their targeted controls but the complete candidate is withheld.
No production source or existing oracle changed. Remaining scope is a bounded
lexer correction and independent retest assigned by the coordinator.
