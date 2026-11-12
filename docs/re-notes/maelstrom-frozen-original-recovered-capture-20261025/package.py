import pathlib,json,subprocess,shutil,hashlib,time,os,signal
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';R=H/'repo';E=R/'docs/re-notes/maelstrom-frozen-original-recovered-capture-20261025';E.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
def save(n,j):(O/n).write_text(json.dumps(j,indent=2)+'\n')
a=json.load(open(O/'analysis.json'));ev=json.loads((H/'collected/guest/frozen.jsonl').read_text());i=ev['historicalCompletion']['identity'];assert i['entries']==7 and i['parks']==6 and i['completions']==1 and i['phase']==3 and i['fault']==0 and i['capped']==0 and i['active']==0 and i['post']==i['pre']+24 and ev['historicalCompletion']['result']==0
# Interpretation is of the emitted authentic record, not another qualification run.
a['arrivalOrPark']='The accepted instance-owned record reports seven entries, six parks and one genuine completion; these parks are not seven completions.'
a['unknown']=['completion-time fdsets','completion-time timeval','completion-time guest instruction position beyond the stored call identity','gameplay','audio','input responsiveness','overhead','general zero-result semantic equivalence','same-frame retry equivalence','exception equivalence']
save('analysis.json',a)
p=subprocess.run(['/home/user/.ascii/boat','--no-update','--json','info','bx_g84h8h98'],capture_output=True,text=True,timeout=30);assert p.returncode==0;j=json.loads(p.stdout);assert j['sandbox']['state']=='idle' and not j['sandbox'].get('stop');save('box-info.json',j)
save('box-handoff.json',dict(at=time.time(),box='bx_g84h8h98',lifecycle='RUNNING: hydrated Boat API state idle (not stopped)',rawState=j['sandbox']['state'],expiry=j['sandbox']['archiveAfter'],coordinatorShutdown='2026-10-25T01:06:00Z',workerLifecycleMutations=0,ownGuestGroupsRemaining=False,remoteHeavyLockAvailable=True,ownership='handed back to coordinator',protectedHostTouched=False))
w=json.load(open(O/'watcher.json'));start=time.monotonic()
try:os.killpg(w['pid'],signal.SIGTERM)
except ProcessLookupError:pass
# Watcher was spawned by earlier exited preparation process; await disappearance/zombie state.
while time.monotonic()-start<5:
 p=pathlib.Path('/proc')/str(w['pid'])/'stat'
 if not p.exists() or p.read_text().split()[2]=='Z':break
 time.sleep(.03)
save('watcher-cleanup.json',dict(pid=w['pid'],termSent=True,elapsed=time.monotonic()-start,remainingRunning=pathlib.Path('/proc',str(w['pid']),'stat').exists() and pathlib.Path('/proc',str(w['pid']),'stat').read_text().split()[2]!='Z',reapOwner='parent preparation process exited; system parent owns final reap'))
# Preserve exact hashes of all executed/staged code and consumed payloads, no binaries published.
identity=[]
for p in [H/'runner/test/run.js',H/'runner/lib/thread-manager.js',H/'runtime/build/wine-assembly.wasm',H/'runner/tools/maelstrom-select-frozen-record.cjs',H/'runner/tools/maelstrom-select-completion-hook.cjs',H/'validate-tree.cjs',H/'guest-args.json',*O.glob('*.py')]:identity.append(dict(path=str(p.relative_to(H)),bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
save('effective-identities.json',identity)
refs=['/home/user/wine-assembly/scratch/usage-watch/maelstrom-select-hook-native-integration-coordinator-review-oct24.json','/home/user/wine-assembly/scratch/usage-watch/maelstrom-select-frozen-integration-coordinator-review-oct24.json','/home/user/wine-assembly/scratch/usage-watch/maelstrom-frozen-original-recovered-capture-oct25-dispatch-gate.json']
save('accepted-references.json',[dict(path=p,sha256=sha(pathlib.Path(p).read_bytes()),acceptanceReused=True) for p in refs])
for n in ['manifest.json','guest-args.json','tree-validation.json']:shutil.copy2(H/n,E/n)
for p in O.glob('*'):
 if p.is_file() and p.suffix in ['.json','.jsonl','.py'] and p.name!='package.py':shutil.copy2(p,E/p.name)
for p in (H/'collected/guest').iterdir():shutil.copy2(p,E/p.name)
# Include source pins and recovery recipes; accepted adapters/hook are unchanged Git ancestors.
shutil.copy2(O/'package.py',E/'package.py');shutil.copy2(H/'validate-tree.cjs',E/'validate-tree.cjs')
summary=dict(schema='maelstrom-select-original-capture/v1',status=a['status'],diagnosticOnly=True,guestStarts=1,acceptedAdapterRevision='81eb33d4e8a4cba52107ef40ecd7cb3bd041557c',moduleSHA256='ed9d74e5ab4c8bf03bb9f94a56ec41e6e28d9abfa282a20c6654e35e9d177ea7',historicalCompletion=ev['historicalCompletion'],liveHostObservation=ev['liveHostObservation'],finiteBudget=dict(batchSize=1000,maxBatches=42000,tickMs=200,seconds=60,guestMiB=512,nodeHeapMiB=512),noGuestReruns=True,gameplayAccepted=False,unknown=a['unknown'],historicalDeficienciesPreserved=True,currentTaskDeficiencies=['Initial instruction/code reads exceeded requested per-read excerpt sizing; no retroactive claim of that restriction passing.','Initial owned tree-check adaptation changed unrelated slice; failed local receipt preserved, corrected to accepted checker before any guest.'],artifacts=['frozen.jsonl','output.log','command.json','terminal.json','analysis.json','manifest.json','effective-identities.json','box-handoff.json'])
(E/'capture-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
report='''# Original Maelstrom frozen select completion, 2026-10-25

Exactly one original Maelstrom guest produced one immutable historical select completion record. Accepted main `81eb33d4e8a4cba52107ef40ecd7cb3bd041557c` supplied the unchanged frozen-record adapter and checked runner transform. Native qualification at `606caff1de558f185487aed5e31ede159262ba7e` and the 47 offline acceptance groups were reused without reruns. No compilation, production repair, acquisition, deployment, merge, replacement task or worker launch occurred.

The historical record has attempt/token 7, seven entries, six parks, one completion, phase 3, fault/capped/active all zero, API 934, thread 1, thunk `0x075040f8`, return PC `0x007a3362`, pre ESP `0x074ffb18`, post ESP `0x074ffb30`, and stored result **0**. It establishes one genuine completion after the real result store. Arrival and the six earlier parks are distinct from completion.

The later ordinary host return at batch 36170 reports live EAX `0x53000001`, ESP `0x074ffb18` and EIP `0x075040f8`. Those live values are expressly later observations; they do not replace completion-time values. Completion-time fdsets and timeval were not captured. This original zero-return diagnostic record does not establish general zero-result semantic equivalence, same-frame retry/exception equivalence, overhead, audio, controls, or gameplay acceptance.

The single run reached the unchanged 42000-batch limit and exited naturally, code 0, in 5.426 seconds. The stdout log is 5399 bytes. TERM/KILL were unnecessary; the supervisor reaped the child and confirmed no remaining group. The exact argv retained the P/input schedule, batch size 1000, 200ms ticks, max 42000 batches, 60-second ceiling and 512MiB guest/Node settings. No PNG, yield clear, fence or synthetic select call was introduced. `manifest.json` records every consumed input hash; current canonical-source HEAD is not asserted as an old build identity. `effective-identities.json` binds transformed code, unchanged module and hook.

Fresh two-host admission, trusted Git SSH, dependency-first read-only alternate stores, explicit sparse paths, actual final filename-bearing tree argv (48 original files/2794170 bytes including commas), remote rehash, ordinary Node preamble and inherited supervisor limits passed before the guest. The initial local validator adaptation accidentally changed an unrelated path slice; the retained failure was corrected to the accepted checker before execution. Initial broad instruction/code reads exceeded the requested per-read sizing; that deficiency is preserved rather than retroactively qualified.

The box `bx_g84h8h98` remains RUNNING (hydrated Boat API `idle`, no stop), expiry `2026-10-25T01:11:29.576Z`; coordinator owns shutdown at 01:06 UTC. Remote heavy lock is available and the guest group is absent. No box lifecycle operation or protected-host access was performed. The evidence directory contains raw capture, command/terminal, all hashes, resource checkpoints, recovery scripts and acceptance references. Git publication and final accounting are retained in owned ops and the append-only messageboard.
'''
(R/'docs/re-notes/maelstrom-frozen-original-recovered-capture-20261025.md').write_text(report)
print(json.dumps(dict(packaged=True,evidenceFiles=len(list(E.iterdir())),recordResult=0,attempt=7)))
