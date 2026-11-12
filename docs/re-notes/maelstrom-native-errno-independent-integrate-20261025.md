# REJECT: Maelstrom native errno successor latch independent review

Candidate `4542e115ac2b1e0cca6748bd00cdce2b4f781199`, tested tree
`256fb0171c103a03f5ae4407f2cda30fce5f336f`, is rejected without repair or main
integration. All candidate files remain unchanged. The defect is in the enabled
JavaScript transform's source identity binding, not an observed native result.

## Reproducible defect

`tools/maelstrom-native-errno-latch.cjs` reads `sources[p]` once for its type,
again for SHA-256, and a third time for assignment to `input[p]` (lines 176–177).
A source getter can return the authentic pinned `src/07-decoder.wat` twice and
then return a decoder whose CALL-register handler emission changes 119 to 120.
The composed select transform does not repin this additional decoder input.
The enabled transform succeeds and returns the altered unpinned source. This
violates the exported transform's twelve-source identity contract, which the
CALL-register/RET interpretation depends on. It does not establish an affected
CLI run: the CLI currently constructs stable plain source values.

Meaningful controls in `pin-repro.cjs` establish:

- Plain authentic input succeeds; output decoder SHA-256 is the required
  `fec7b2413c972eca6ce666cd5300308047cdc08f7ca6a4542edfea98f02a3837`.
- Plain changed input actually throws `source pin`.
- Getter-backed input is read three times and succeeds with output SHA-256
  `5a19b0ff2bd490061a8a38e6ac98d57a801546b86ed8389f0a06820aee936a60`.
  The independent acceptance assertion fails with exit 1, without timeout/cap.

Run the retained `guard.py pin-repro /absolute/path/to/pin-repro.cjs` from the
isolated checkout. Its three MNE input variables and exact command are recorded
in `pin-repro.json`; all installed inputs were hash-confirmed before tests.
`pin-repro-results.json` records baseline, changed and actual hashes. No candidate
code or pinned inputs were edited to produce this failure.

## Other completed checks and limits

Before this defect, the supplied thirteen AST/model groups and CLI transform
passed. Nine independent groups passed: consumed ModRM/CALL/C3 decoder branches,
native relative target/frame derivation, actual handler stack and snapshot order,
nested RET, stale identity, 360 BigInt span-boundary cases, disabled getter
inertness, fragment identity and private write/call closure. Four deliberately
broken generated-output controls actually failed: stale-token omission, snapshot
after dispatch, widened safe span, and select-result substituted for errno.
These do not override the failing source-identity acceptance invariant.

The source model confirms decoder CALL EDI yields H119/return 007a3366/register7
and C3 yields H41/op0; the RET hook is after EIP/ESP pop and before branch_end.
The preferred CRT CALL displacement targets 78003857, followed at RVA c435 by
ADD EAX,8 and RET at c438; the numerical loaded base remains a fixture. SDLnet's
0x114 locals plus four saved registers give caller offset 0x124. Caller words
are observations, not verified call-site execution. Unsupported mappings reject;
the helper is conservative at the top integer boundary. Nested CALL-register
events conservatively reject, so coverage of arbitrary CRT paths is not promised.

Independent checks reuse the supplied small AST evaluator and fixture but evaluate
consumed decoder branches and independent arithmetic/control oracles. They are
not a full decoder, WebAssembly validator, compiler or native engine. Tail-call,
real memory, flag, scheduler and host behavior are not natively qualified. Only
source/model state isolation was checked. Prior select completion result0,
attempt7/six parks is accepted without reauditing its earlier47 groups.

Native errno/caller, gameplay, fdsets/timeval, overhead and runtime equivalence
remain UNKNOWN. Native `_errno` is neither WSAGetLastError nor emulator errno;
select result zero is not errno. A corrected candidate needs independent review,
then separately authorized canonical compilation/compiled-native qualification
and original instance-bound capture with loader-proven native CRT base. No build,
instantiation, native/original execution, acquisition, deployment, box or worker
operation occurred. No main lock was acquired because integration was rejected.

Publication and cleanup receipts remain in the task ops directory. Main remains
at its actual remotely verified prior revision; only the assigned review branch
is published. Root tracked files/index/refs and the donor remain read-only;
messageboard is append-only. No boxes assigned; bx_g84h8h98 is coordinator-reported
stopped/unqueried and hostbx_69aem736 is untouched. Lifecycle owner is coordinator.
