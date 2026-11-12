from pathlib import Path
import json,hashlib,os,signal
O=Path(__file__).parent;R=O.parent/'repo'
def save(n,d):(O/n).write_text(json.dumps(d,indent=2)+'\n')
C=json.load(open(O/'closure.json'));E=json.load(open(O/'expected-abi-layout.json'));outputs=json.load(open(O/'outputs.json'));fail=json.load(open(O/'module-tail-1792961632482429974.json'))
save('first-blocker.json',dict(stage='guarded Module qualifier',command=fail['argv'],exit=1,reason='set_null_diag required by pinned qualifier is absent in canonical current source',tailModuleConstructor='returned before failing export assertion',compatModule='NOT_ATTEMPTED',retry=False,owner='coordinator',resumeCondition='Resolve canonical-output versus pinned diagnostic-qualifier contract'))
commands=[]
for p in O.glob('*.json'):
 if p.name.startswith(('cheap-','compiler-','module-tail-')) and not any(s in p.name for s in ['admission','attempt','lock','result','layout']):
  d=json.load(open(p))
  if 'argv' in d:commands.append(d)
assert all(x['reaped'] and not x['remainingGroup'] for x in commands)
pid=int((O/'watcher.pid').read_text())
try:os.kill(pid,signal.SIGTERM)
except ProcessLookupError:pass
save('cleanup.json',dict(commandsReaped=len(commands),remainingOwnedChildGroups=[],watcherPID=pid,watcherStopped=True,heavyLock='released on supervisor exit',boxID=None,boxState='not assigned or queried',expiry=None,shutdownOwner='coordinator',protectedBox='bx_69aem736 untouched',donors='readonly',BoatSSH403='preserved',recoveryWatcher='DEADLINE/exited, no RECOVERED claim'))
save('result.json',dict(status='BLOCKED_PINNED_QUALIFIER_EXPORT',candidate=C['candidate'],compiledCount=2,requestedCompiledCount=2,closureSHA256=C['closureSHA256'],compilerSHA256=C['compilerFullSHA256'],outputs=outputs,staticABI='PASS',completeCompilerInventory=269,layout=E['layout'],tailModuleQualification='FAIL set_null_diag after constructor returned',compatModuleQualification='NOT_ATTEMPTED',Memory=False,Instance=False,guest=False))
recipe='''# Recovery recipe and limits

Stop condition reached: pinned qualifier requires set_null_diag, absent from current uninstrumented canonical source. No automatic retry/repair is authorized. Coordinator must resolve this acceptance-contract mismatch. Prior buffered RAM denial and Boat SSH403 preserved, no RECOVERED claim.

Exact identities and paths: recovery-pins.json, input-pins.json, closure.json, guard-reuse.json, outputs.json. Six retained recovery pins verified. First Git check verified140 exact source/dependency SHA/lengths with zero stderr using only validated nonrecursive view sources[*].view; no donor/object copy or recursive discovery. setup.py creates fresh sparse Git root, strict dedicated trusted SSH and explicit report-only paths; scoped readonly object overrides removed before writes. No mount argv in this offline task.

Reproduction requires fresh authorized ownership paths and account.py admission before setup.py, then supervise.py cheap python3 preflight.py; supervise.py compiler node --max-old-space-size=2048 build.cjs; supervise.py cheap python3 inspect.py. Do not execute historical ownership paths unchanged. All actual command argv and stdout/stderr/terminal/reaping receipts retained. preflight.py resolves128 current reached sources and140 source/compiler dependencies, full compiler path/SHA, no excerpts. build.cjs streams nine changed current Git fragments consistently at f,src/f,./f and calls canonical compileClosure production standardWat strictDeclarations runtimeBuiltins:false, tailCalls:true plus accepted compat transform false. Complete compiler storage AND spans match independent source/mirror inventory; original custom-section stamp applied. No names/shake/instrumentation/compiler/source/binary patch.

inspect.py imports unchanged pinned static helper parse/compare functions against complete current source signatures and validates active data offsets, memory bounds and overlaps and storage bounds. No WebAssembly call. Pinned guarded Module invocation is exact module-tail command receipt: synchronous fixed Buffer constructor returned, then qualifier required-export assertion failed. Compat Module not attempted. Guard is controlled callsite restriction, not hostile-code security sandbox. No Memory/Instance/instantiate/compile/validate/guest.

Mandatory RAM2684354560 applies at ALL worker stages. Dispatch-drop/recovery buffer is coordinator-only. Whole64MiB accounting includes1789952view metadata, owned/new duplicates, current session/launcher/full shared WALSHM/positive DB growth/futures and8MiB reserve. Disk floor2982150144 and precheckout627523584volatility allowance retained. Compiler CPU/wall900s heap2048MiB; cheap60s, file24MiB, compiler capture524288 and cheap131072, TERM/KILL/reap5s. Installed tools and standing immutable sources used in place. account.py and stage admissions retain actual measurements.

Binaries remain in local ops with exact SHA/lengths; no binary committed. Git preserves recipe/evidence, not binaries. No full build-gate/general SEH/native execution/GL-D3D gameplay acceptance. No box assigned/queried; coordinator owns lifecycle; protected box untouched.
'''
(O/'recovery.md').write_text(recipe)
report=f'''# Current-main canonical build: 2/2 compiled; qualifier blocked

Candidate `{C['candidate']}`. Both genuine uninstrumented canonical tail-call and compat modules compiled. Compiler command elapsed8.27s, peak child RSS441880576bytes. Complete compiler269-entry storage/span inventory matched independent current source/mirror layout `{E['layout']}`.

Both binaries passed full current-source ABI:291imports,2224function exports plus memory export, exact types/shared-memory limits/noStart/layout payload,323nonoverlapping data segments each and data/storage bounds. Full static report retained at `{O}/static-abi.json`.

|Artifact|Bytes|SHA256|
|---|---:|---|
'''+''.join(f"|{Path(x['file']).name}|{x['bytes']}|`{x['sha256']}`|\n" for x in outputs)+f'''
Closure SHA256 `{C['closureSHA256']}`; compiler loader SHA256 `{C['compilerFullSHA256']}`. closure.json binds128 reached sources,140 exact dependencies and all nine current overlays.

First substantive blocker: unchanged pinned qualifier constructed tail WebAssembly.Module, then asserted required export `set_null_diag`, absent from canonical source. Tail qualification FAIL; compat Module NOT_ATTEMPTED. No retry or qualifier/compiler repair. Source ABI pass does not satisfy historical diagnostic qualifier. Coordinator owns resolution.

Fresh admissions passed corrected mandatory2684354560RAM,64MiB whole-task accounting including1789952view metadata and full shared WAL/session/launcher, disk floor and precheckout volatility allowance. Earlier duplicate-buffer denial remains preserved. All child groups reaped; watcher stopped; heavy lock released. No box/Memory/Instance/guest/main integration, no Boat403 workaround. Watcher DEADLINE/exited, no RECOVERED claim.

Companion evidence/recovery.md contains bounded recipe and limits. Ignored binaries retained locally under `{O}`; Git records identities/recipe, not binary backup. This is not full build-gate/native execution/general SEH or GL-D3D/gameplay acceptance.
'''
D=R/'docs/re-notes/seh-corrected-memory-canonical-build-20261025-evidence';D.mkdir(parents=True,exist_ok=True)
(R/'docs/re-notes/seh-corrected-memory-canonical-build-20261025.md').write_text(report)
for p in O.iterdir():
 if p.is_file() and p.suffix in ['.py','.cjs','.md','.json','.stderr','.stdout'] and p.name not in ['root-before.json','input-pins.json','checkout.json','static-abi.json','evidence-manifest.json']:(D/p.name).write_bytes(p.read_bytes())
manifest=[dict(path=str(p),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in sorted(O.iterdir()) if p.is_file() and p.name!='evidence-manifest.json']
save('evidence-manifest.json',manifest);(D/'evidence-manifest.json').write_bytes((O/'evidence-manifest.json').read_bytes())
print('closeout prepared',len(manifest),'evidence files')
