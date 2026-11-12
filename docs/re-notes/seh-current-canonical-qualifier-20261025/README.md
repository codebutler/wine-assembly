# Canonical Module qualifier repaired: tail and compat PASS

Trust-anchor correction (2026-10-25): the qualifier now authenticates the exact
contract against an independent digest fixed in its reviewed code. See
[repair and static evidence](../seh-qualifier-streamed-trust-repair-20261025/README.md).
The Module-return receipts and `evidence/seal.json` below are frozen evidence
from candidate `806117a11f1b347340b5cc44fb52b79d0ac200e5`; that historical seal
describes the original README and qualifier at that commit. The repair has its
own seal. No native call was repeated for this correction.

Current source `a3fe340b962da3f31df249881074afe41d6c69a2`; retained build-evidence candidate `9d85af30e9ed0c19bac7f9ba99d1b540a508f4e4`. Both genuine uninstrumented binaries were reused in place without rebuild, source/runtime edits, instrumentation, diagnostic exports, ABI weakening or binary patches.

The historical helper required an instrumented interface: `set_null_diag(i32)->()`, `null_diag_field(i32)->i32`, `null_diag_token()->i64` (invocation_current), and `null_diag_root()->i64` (invocation_root). Its retained source-boundaries.json records those declarations. All four are absent from the complete current source ABI. The prior genuine tail Module constructor returned and the helper then rejected missing set_null_diag; compat was not attempted. That was an interface mismatch, not evidence of native Module rejection. This task leaves the historical helper and evidence unchanged.

The replacement does more than remove that assertion. It pins all retained input hashes and the explicit allowed binary paths/hashes; independently binds current source include closure/compiler and all 291 imports and 2,224 function exports/signatures; checks exactly one shared imported/exported memory with8192/32768 limits, the complete172-entry binary type inventory, every export name/kind, no duplicate exports, no start section, and the sole exact16-byte layout payload. The accepted complete269-entry storage/span inventory and static ABI reports are reused as pinned standing evidence. Unknown diagnostic exports are rejected along with any other extra export. Native Module descriptors must equal the fully checked binary metadata.

| Binary | Bytes | SHA256 | Guarded Module |
|---|---:|---|---|
|wine-assembly.compat.wasm|1882890|`ff495de2b12c308013fa489b9fb291ca836171929655ca20df03440946c54dbc`|PASS|
|wine-assembly.wasm|1880317|`bf707aa41e2883e1407c71810a15fd5f1816961938c1103c8d1d5bd40cb701d9`|PASS|

Closure SHA256 `e9c212ccd85445de89271af25660b331b548f8cb2d40ffa5271b312c6c0e699d`; compiler `d04ed1d5ca74fc1b6f10357576a38e726d58f0ad908ccf34a29de35052aa1a33`; layout `9a3bc9149d58209c`; unchanged guard `47ce2e2b835be33eab6b2b24f027ecaab8ceb61c559890e51548c78199beb197`.

Baseline-fail/repair-pass: the exact pinned old driver is statically replayed against each real retained metadata inventory and fails set_null_diag after its facade call; the actual earlier native failure is reused. The complete repaired static contract passes for both, and two fresh guarded synchronous Buffer Module calls separately pass.35 negative controls pass. No unchanged native retry. A shared-reference test-fixture correction and its failed receipt are retained, without production acceptance changes.

Both Module commands used oldspace2048MiB CPU/wall900s; tail elapsed0.1422s peakRSS140640256bytes, compat0.1060s peakRSS140902400bytes. Admission passed before checkout and every supervised execution/publication; available RAM minimum2684354560 and all64MiB accounting/disk floors retained. Full command arrays, UTC timing, outputs, reaping and resource receipts are sealed in evidence. All local command groups were reaped, the watcher stopped and heavy lock release independently confirmed. Root index/refs remained unchanged. No main merge.

[Recovery recipe](evidence/recovery.md) describes retained inputs, exact controlled callsite, regression reproduction and resource/lifecycle limits. `evidence/seal.json` binds the deliverable files; final local publication/cleanup seals are under `/tmp/seh-current-canonical-qualifier-oct25/ops`. Ignored binaries remain readonly in the donor ops sibling; Git does not preserve them.

No Memory/Instance/instantiate/compile/validate API or guest execution, box query, native runtime/SEH, Configuration-to-Play or gameplay acceptance occurred. Actual Boat SSH403 api_key_action_forbidden remains. No active box assigned: ID/state/expiry null/not assigned/null; protected bx_69aem736 untouched, lifecycle belongs to coordinator. The bounded task stops here.
