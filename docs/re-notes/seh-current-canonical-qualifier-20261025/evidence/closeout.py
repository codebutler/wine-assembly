import pathlib,json,hashlib,datetime,signal,os,fcntl,subprocess,time
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';D=pathlib.Path('/tmp/seh-corrected-memory-canonical-build-oct25/ops');P=R/'docs/re-notes/seh-current-canonical-qualifier-20261025'
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,d):(O/n).write_text(json.dumps(d,indent=2)+'\n')
def utc(t):return datetime.datetime.fromtimestamp(t,datetime.timezone.utc).isoformat()
commands=[];modules=[]
for p in sorted(O.glob('*.json')):
 d=json.load(open(p))
 if isinstance(d,dict) and 'argv' in d and 'reaped' in d:
  assert d['reaped'] and not d['remainingGroup'];commands.append(dict(receipt=p.name,**d,terminalReceiptPersistedUTC=utc(p.stat().st_mtime)))
  if p.name.startswith('module-'):
   a=json.load(open(O/(p.name.split('-179')[0]+'-attempt.json')))
   result=json.load(open(p.with_suffix('.stdout')));assert result['state']=='MODULE_QUALIFICATION_PASS' and d['exit']==0
   modules.append(dict(qualification=result,supervisorReceipt=p.name,startUTC=utc(a['at']),terminalReceiptPersistedUTC=utc(p.stat().st_mtime),elapsed=d['elapsed'],peakRSS=d['maxChildRSSBytes']))
assert len(modules)==2
save('command-timing.json',dict(commands=commands,modules=modules,clock='UTC from launch epoch and actual persisted terminal receipt filesystem timestamp; elapsed from monotonic supervisor timer'))
# Watcher is ours; kill its group and verify no live members. It has no children.
pid=int((O/'watcher.pid').read_text())
try:os.killpg(pid,signal.SIGTERM)
except ProcessLookupError:pass
time.sleep(.1)
try:
 state=pathlib.Path('/proc',str(pid),'stat').read_text().split(') ',1)[1].split()[0];assert state=='Z',state
except FileNotFoundError:state='absent'
lock=open('/tmp/wine-ops-heavy-runtime.lock','a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);fcntl.flock(lock,fcntl.LOCK_UN);lock.close()
ROOT=pathlib.Path('/home/user/wine-assembly');before=json.load(open(O/'root-before.json'))
env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'}
refs=subprocess.check_output(['git','-C',str(ROOT),'show-ref'],env=env,timeout=10).decode()
save('cleanup.json',dict(commandsReaped=len(commands),remainingOwnedChildGroups=[],watcherPID=pid,watcherState=state,watcherStopped=True,heavyLock='released; nonblocking acquisition/release confirmed',rootIndexUnchanged=sha((ROOT/'.git/index').read_bytes())==before['indexSHA256'],rootRefsUnchanged=refs==before['refs'],rootTrackedEditsByTask=0,standingBinaries='used in place, readonly; no copies or patches',boxID=None,boxState='not assigned; not queried',expiry=None,shutdownOwner='coordinator',protectedBox='bx_69aem736 untouched',BoatSSH403='api_key_action_forbidden preserved; no retry or workaround'))
# Preserve actual earlier native constructor-return then required-export failure.
prior=[]
for name in ['module-tail-1792961632482429974.json','module-tail-1792961632482429974.stderr','module-tail-attempt.json','first-blocker.json']:
 b=(D/name).read_bytes();(O/('historical-'+name)).write_bytes(b);prior.append(dict(path=str(D/name),sha256=sha(b),bytes=len(b)))
save('historical-reuse.json',dict(actualNativeFailureEvidence=prior,notRerun=True,explanation='Exact historical driver is replayed using retained full static descriptors in test-qualifier.cjs. Facade construction is explicitly static, not another native Module. Earlier genuine native-return/assertion failure reused. Both repaired native passes are fresh.',fixtureCorrection='First regression attempt mutated a shared signature reference and reached the stronger type-inventory rejection instead of the intended export-signature oracle. Fixture changed to replace only that export/import signature; rerun passes. Prior failed receipt retained; no ABI weakening or native retry.'))
controls=json.load(open(O/'controls.json'));assert controls['state']=='REGRESSION_CONTROLS_PASS'
save('result.json',dict(state='QUALIFIER_REPAIRED_BOTH_MODULES_PASS',candidate='a3fe340b962da3f31df249881074afe41d6c69a2',buildEvidence='9d85af30e9ed0c19bac7f9ba99d1b540a508f4e4',tail='PASS',compat='PASS',modules=modules,sourceBindingSHA256=sha((O/'source-binding.json').read_bytes()),guardSHA256='47ce2e2b835be33eab6b2b24f027ecaab8ceb61c559890e51548c78199beb197',qualifierSHA256=sha((P/'qualify.cjs').read_bytes()),regressionRejects=sum(r.get('rejected',False) for r in controls['results']),Memory=False,Instance=False,guest=False,remainingLimitations=['No native instantiation or guest/SEH execution','No game, Configuration-to-Play or gameplay acceptance','No general runtime validation or complete build-gate rerun','Boat SSH403 remains; no active box assigned','Ignored binaries retained readonly locally; Git does not back them up'],stop='bounded objective complete; no successor selected'))
print('Closeout: both native Module passes, all command groups reaped; watcher stopped and heavy lock released')
