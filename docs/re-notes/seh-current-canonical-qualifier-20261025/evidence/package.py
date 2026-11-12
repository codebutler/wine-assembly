import pathlib,json,hashlib
O=pathlib.Path(__file__).resolve().parent;P=O.parent/'repo/docs/re-notes/seh-current-canonical-qualifier-20261025';D=pathlib.Path('/tmp/seh-corrected-memory-canonical-build-oct25/ops')
def sha(b):return hashlib.sha256(b).hexdigest()
r=json.load(open(O/'result.json'));c=json.load(open(O/'cleanup.json'));assert c['rootIndexUnchanged'] and c['rootRefsUnchanged']
recipe='''# Reproduction and retained-input recovery

The task is complete. This recipe reproduces only static controls and synchronous Buffer Module qualification. It does not authorize a new build, native instantiation, guest run or successor assignment.

Required retained inputs are the exact donor ops sibling `/tmp/seh-corrected-memory-canonical-build-oct25/ops`, build-evidence commit `9d85af30e9ed0c19bac7f9ba99d1b540a508f4e4` on verified remote `task/seh-corrected-memory-canonical-build-oct25`, current source candidate `a3fe340b962da3f31df249881074afe41d6c69a2`, and pinned standing guard/helper/historical source-declaration evidence. `contract.json`, `source-binding.json`, `checkout.json`, and `trusted-configuration.json` bind their paths and identities. `source-binding.json` independently verifies 140 source/compiler dependency blobs, the current include expansion hash, and complete source ABI against the accepted expected inventory. The already accepted full source review/census is reused. The 269-entry layout serialization is rehashed, not recensused. Compiler full path/SHA is checked; no excerpt is substituted.

Ignored binaries are not committed. They remain readonly at the two exact allowed donor ops paths in contract.json; no rebuild or unchanged binary copy was made. The donor's static-abi.json and expected-abi-layout.json remain standing inputs used in place, with hashes bound here. If any retained input is missing or changes, stop. Git stores this recipe, qualifier and evidence, not a binary backup. The donor recovery recipe records how its original artifacts were built; rebuilding is outside this task.

The local task ops scripts are preserved under evidence/ for recovery. Restore them only to newly assigned owned paths after fresh admission, retain strict SSH exactly, and adapt only ownership/branch paths. Do not execute setup.py into an existing checkout or run an unchanged native attempt again. setup.py uses validated nonrecursive views from `/tmp/seh-coordinator-object-view-oct25/receipt.json`, a nonrecursive view of donor leaf objects and a fresh writable Git object root. Object overrides are scoped to reads and removed before writes/publication. No full tree, clone, object-store copy or repack. Sparse paths contain only this deliverable. No mounts, filename-bearing mount argv, box or conditional guest call exists; the exact offline empty mount configuration is retained from donor trusted-configuration.json, with no claim that a guest mount parser was exercised.

Actual commands and per-stage admission/terminal/reaping receipts are preserved. From the retained task, use these shapes only under new authorization and fresh resource admission:

```sh
python3 ops/account.py admission-precheckout.json
python3 ops/setup.py
python3 ops/supervise.py cheap python3 ops/prepare.py
python3 ops/supervise.py cheap node --max-old-space-size=256 repo/docs/re-notes/seh-current-canonical-qualifier-20261025/test-qualifier.cjs ops/contract.json ops/controls.json
```

For each allowed canonical donor file, use the exact module-tail or module-compat attempt argv in evidence with `node --max-old-space-size=2048 --require PINNED_GUARD TASK_QUALIFIER CONTRACT ALLOWED_ABSOLUTE_FILE PINNED_SHA`. The two real command arrays are in command-timing.json and the terminal receipts. The only production constructor line is `const mod=new WebAssembly.Module(b);`, using the unchanged fixed fs.readFileSync Buffer, no options. The preload is the exact guard SHA `47ce2e2b835be33eab6b2b24f027ecaab8ceb61c559890e51548c78199beb197`. Accepted independent review and boundary controls are reused via donor guard-reuse.json; targeted adaptation controls prove exact Buffer identity/options and oversize rejection before a fake constructor. This guard restricts the controlled callsite; it is not a hostile-code sandbox.

The historical driver SHA `4f8b0bbddac21abc821f7da77dc4d7a8573a81b15358a3ff75f173b40a862bdc` is executed unchanged by the regression suite with a clearly labeled static Module facade backed by retained real binary descriptors. Both static replays fail at set_null_diag. The actual previous tail native Module-return/assertion-failure receipt is preserved separately; no unchanged native failure retry is needed. Repaired full metadata checks pass on both buffers, and both fresh guarded native Module calls return. Thirty-five negative controls cover missing/wrong/extra/duplicate export, import/signature/shared-memory change, complete type inventory, layout loss/change/duplication, start metadata/raw start section, overrun, binary/expected/pin hash, path allowlist and oversize guard. No guest is executed by controls.

All stages retain minimum available RAM2684354560 (no coordinator dispatch buffer duplicated), all-new-byte allocation67108864 including owned sparse checkout/Git and transitive metadata, view metadata1789952, launcher/session/full shared WALSHM/positive DB growth/futures and reserve8388608. Disk floor2982150144 after the entire64MiB, plus precheckout volatility627523584. Modules: oldspace2048MiB CPU/wall900sec, cheap Node256MiB CPU/wall60sec; regular files24MiB enforced in kernel, aggregate Module output524288 and cheap131072, TERM/KILL/reap5sec. Installed tools and standing inputs execute in place; no copied binaries. Admissions list measured tools and owned bytes. The supervisor holds one heavy lock per Module and cleans all child groups. UTC launch and persisted terminal timestamps plus monotonic elapsed/RSS are retained. The closeout script and its own supervisor terminal receipt prove cleanup; publication has a separate terminal receipt.

A fixture correction is retained: initial wrong-signature control modified a shared signature object and hit the stronger type rejection before the intended export rejection. Replacing only the fixture signature isolated that oracle; the unchanged production qualifier then passed all controls. The failed control log is retained. An earlier bootstrap account pin was from an old recovery snapshot; the donor's coordinator-verified final manifest supplied the actual account pin before any dependent execution. Neither correction weakened acceptance.

Remaining limits: Module construction proves binary validity and this complete bound interface/layout contract. It does not prove instantiation, import implementations, SEH execution, Configuration-to-Play, GL/D3D behavior or gameplay. No native instance, Memory, instantiate/compile/validate API or guest call occurred. No full build-gate rerun. Actual Boat SSH403 api_key_action_forbidden remains; no box assigned, queried, stopped or resumed; protected bx_69aem736 untouched. Box ID/state/expiry are null/not assigned/null; coordinator owns lifecycle. No main merge.
'''
(O/'recovery.md').write_text(recipe)
report='''# Canonical Module qualifier repaired: tail and compat PASS

Current source `a3fe340b962da3f31df249881074afe41d6c69a2`; retained build-evidence candidate `9d85af30e9ed0c19bac7f9ba99d1b540a508f4e4`. Both genuine uninstrumented binaries were reused in place without rebuild, source/runtime edits, instrumentation, diagnostic exports, ABI weakening or binary patches.

The historical helper required an instrumented interface: `set_null_diag(i32)->()`, `null_diag_field(i32)->i32`, `null_diag_token()->i64` (invocation_current), and `null_diag_root()->i64` (invocation_root). Its retained source-boundaries.json records those declarations. All four are absent from the complete current source ABI. The prior genuine tail Module constructor returned and the helper then rejected missing set_null_diag; compat was not attempted. That was an interface mismatch, not evidence of native Module rejection. This task leaves the historical helper and evidence unchanged.

The replacement does more than remove that assertion. It pins all retained input hashes and the explicit allowed binary paths/hashes; independently binds current source include closure/compiler and all 291 imports and 2,224 function exports/signatures; checks exactly one shared imported/exported memory with8192/32768 limits, the complete172-entry binary type inventory, every export name/kind, no duplicate exports, no start section, and the sole exact16-byte layout payload. The accepted complete269-entry storage/span inventory and static ABI reports are reused as pinned standing evidence. Unknown diagnostic exports are rejected along with any other extra export. Native Module descriptors must equal the fully checked binary metadata.

| Binary | Bytes | SHA256 | Guarded Module |
|---|---:|---|---|
'''
for m in r['modules']:
 q=m['qualification'];report+=f"|{pathlib.Path(q['file']).name}|{q['bytes']}|`{q['sha256']}`|PASS|\n"
report+='''
Closure SHA256 `e9c212ccd85445de89271af25660b331b548f8cb2d40ffa5271b312c6c0e699d`; compiler `d04ed1d5ca74fc1b6f10357576a38e726d58f0ad908ccf34a29de35052aa1a33`; layout `9a3bc9149d58209c`; unchanged guard `47ce2e2b835be33eab6b2b24f027ecaab8ceb61c559890e51548c78199beb197`.

Baseline-fail/repair-pass: the exact pinned old driver is statically replayed against each real retained metadata inventory and fails set_null_diag after its facade call; the actual earlier native failure is reused. The complete repaired static contract passes for both, and two fresh guarded synchronous Buffer Module calls separately pass.35 negative controls pass. No unchanged native retry. A shared-reference test-fixture correction and its failed receipt are retained, without production acceptance changes.

Both Module commands used oldspace2048MiB CPU/wall900s; tail elapsed0.1422s peakRSS140640256bytes, compat0.1060s peakRSS140902400bytes. Admission passed before checkout and every supervised execution/publication; available RAM minimum2684354560 and all64MiB accounting/disk floors retained. Full command arrays, UTC timing, outputs, reaping and resource receipts are sealed in evidence. All local command groups were reaped, the watcher stopped and heavy lock release independently confirmed. Root index/refs remained unchanged. No main merge.

[Recovery recipe](evidence/recovery.md) describes retained inputs, exact controlled callsite, regression reproduction and resource/lifecycle limits. `evidence/seal.json` binds the deliverable files; final local publication/cleanup seals are under `/tmp/seh-current-canonical-qualifier-oct25/ops`. Ignored binaries remain readonly in the donor ops sibling; Git does not preserve them.

No Memory/Instance/instantiate/compile/validate API or guest execution, box query, native runtime/SEH, Configuration-to-Play or gameplay acceptance occurred. Actual Boat SSH403 api_key_action_forbidden remains. No active box assigned: ID/state/expiry null/not assigned/null; protected bx_69aem736 untouched, lifecycle belongs to coordinator. The bounded task stops here.
'''
(P/'README.md').write_text(report)
E=P/'evidence';E.mkdir(exist_ok=True)
for p in O.iterdir():
 if p.is_file() and p.suffix in ['.json','.py','.md','.stdout','.stderr'] and p.name not in ['root-before.json','watcher.pid','package.py','publication-complete.json']:(E/p.name).write_bytes(p.read_bytes())
# Include the inspected acceptance receipts by reference and immutable hash, not a duplicated review chain.
(E/'donor-reuse-pins.json').write_text(json.dumps(dict(finalManifest=dict(path=str(D/'final-evidence-manifest.json'),sha256=sha((D/'final-evidence-manifest.json').read_bytes())),standingContract=json.load(open(O/'contract.json'))),indent=2)+'\n')
seal=[dict(path=str(p.relative_to(P)),bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(P.rglob('*')) if p.is_file() and p.name!='seal.json']
(E/'seal.json').write_text(json.dumps(seal,indent=2)+'\n')
print('Packaged',len(seal),'sealed files; no binary duplicated')
