import pathlib, subprocess, json, os, hashlib, time
H=pathlib.Path(__file__).resolve().parent.parent; O=H/'ops'; R=H/'repo'
D=pathlib.Path('/tmp/maelstrom-native-errno-source-snapshot-repair-oct25/repo')
rev='1a87b46728222df4df0b1fee33f83e88776735a9'
root=pathlib.Path('/home/user/wine-assembly')
ssh='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
env=dict(os.environ,GIT_SSH_COMMAND=ssh)
def save(n,x): (O/n).write_text(json.dumps(x,indent=2)+'\n')
def run(*a,cwd=D): return subprocess.check_output(a,cwd=cwd,text=True,env=env,timeout=30).strip()
def ident(p):
 p=pathlib.Path(p); h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(65536),b''):h.update(b)
 return dict(bytes=p.stat().st_size,sha256=h.hexdigest())
review='docs/re-notes/maelstrom-native-errno-source-snapshot-repair-20261025/'
assert run('git','rev-parse','HEAD')==rev
dispatch=json.loads((root/'scratch/usage-watch/maelstrom-native-errno-snapshot-independent-closeout-oct25-dispatch.json').read_text())
for x in dispatch['verifiedFiles']:
 assert ident(D/x['path'])['sha256']==x['sha256']
 assert hashlib.sha256(subprocess.check_output(['git','show',rev+':'+x['path']],cwd=D)).hexdigest()==x['sha256']
standing=json.loads((D/review/'standing-inputs.json').read_text())
for p,x in standing.items():assert ident(p)==x
save('standing-inputs.json',standing)
argv=pathlib.Path('/proc/455683/cmdline').read_bytes().replace(b'\0',b' ').decode()
assert 'model_auto_compact_token_limit=200000' in argv and 'scope="total"' in argv and '-m gpt-6.1-sol' in argv and 'medium' in argv and 'resume' not in argv
launcher=root/'scratch/usage-watch/maelstrom-native-errno-snapshot-independent-closeout-oct25'
session=next(pathlib.Path('/home/user/.codex/sessions/2026/10/25').glob('*01a170ab-e5a7-7af1-95a7-709a4605d3b1.jsonl'))
logs=sum(p.stat().st_blocks*512 for p in launcher.rglob('*') if p.is_file())+session.stat().st_blocks*512
sqlite={str(p):p.stat().st_blocks*512 for p in pathlib.Path('/home/user/.codex').glob('state_5.sqlite*')}
parts=dict(checkoutGitStaging=8<<20,tempEvidence=4<<20,publicationTransfer=4<<20,fullExternalLogs=max(4<<20,logs),positiveSQLiteGrowth=4<<20,futureAllowance=16<<20,reserve=8<<20)
peak=sum(parts.values());free=os.statvfs(H).f_bavail*os.statvfs(H).f_frsize
mem=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))*1024
ok=peak<=64<<20 and free-peak>=2982150144 and mem>=805306368
save('resource-precheckout.json',dict(parts=parts,projectedPeak=peak,allocation=64<<20,free=free,freeAfter=free-peak,memAvailable=mem,sqliteBaseline=sqlite,launcher=str(launcher),session=str(session),fullLogsMeasured=logs,standingFootprintBytes=sum(x['bytes'] for x in standing.values()),standingInputs='standing-inputs.json',passChecks=ok));assert ok
save('readonly-state.json',{str(p):{k:(hashlib.sha256(run('git',*v,cwd=p).encode()).hexdigest() if k=='trackedDiffSHA256' else run('git',*v,cwd=p)) for k,v in {'HEAD':['rev-parse','HEAD'],'refs':['show-ref'],'index':['hash-object','.git/index'],'trackedDiffSHA256':['diff','--no-ext-diff','--binary','HEAD']}.items()} for p in [D,root]})
p=subprocess.run(['git','ls-remote','git@github.com:vgrichina/wine-assembly.git','refs/heads/main','refs/heads/task/maelstrom-native-errno-source-snapshot-repair-oct25'],capture_output=True,text=True,env=env,timeout=30)
save('configuration.json',dict(ssh=ssh,returncode=p.returncode,stdout=p.stdout,stderr=p.stderr,workerArgv=argv,mountArgv=[],intendedMountFiles=[],mountApplicable=False,reason='Offline source/model task; no mount argv or conditional guest execution. Canonical mount parser inapplicable.'))
assert p.returncode==0 and rev in p.stdout and '1ccd6130970d3151a1be23e388f0aa2b820188b2\trefs/heads/main' in p.stdout
seen=set();order=[]
def visit(p):
 p=pathlib.Path(p).resolve()
 if str(p) in seen:return
 seen.add(str(p));a=p/'info/alternates'
 if a.exists():
  for line in a.read_text().splitlines():visit(p/line if not line.startswith('/') else line)
 order.append(str(p))
visit(D/'.git/objects');run('git','init','-q',str(R))
(R/'.git/objects/info/alternates').write_text('\n'.join(order)+'\n')
selected=['tools/maelstrom-native-errno-latch.cjs','tools/maelstrom-select-completion-hook.cjs','test/maelstrom-native-errno-latch.test.cjs','test/maelstrom-native-errno-source-snapshot.test.cjs','test/maelstrom-select-hook-model.cjs','docs/re-notes/maelstrom-native-errno-successor-latch-20261025/source-identity.json']
run('git','config','core.sparseCheckout','true',cwd=R);run('git','config','core.sparseCheckoutCone','false',cwd=R)
(R/'.git/info/sparse-checkout').write_text('\n'.join('/'+p for p in selected)+'\n')
branch='task/maelstrom-native-errno-snapshot-independent-closeout-oct25'
run('git','update-ref','refs/heads/'+branch,rev,cwd=R);run('git','symbolic-ref','HEAD','refs/heads/'+branch,cwd=R);run('git','read-tree','-mu','HEAD',cwd=R)
for k in ['user.name','user.email']:run('git','config',k,run('git','config',k),cwd=R)
run('git','remote','add','origin','git@github.com:vgrichina/wine-assembly.git',cwd=R)
save('checkout.json',dict(revision=rev,branch=branch,selected=selected,dependencyFirstAlternates=order,fetch=False,clone=False,repack=False,objectCopy=False,verifiedRepairFiles=47))
log=open(O/'board-watch.log','ab');p=subprocess.Popen(['tail','-n','0','-f',str(root/'messageboard.txt')],stdout=log,stderr=log,start_new_session=True);log.close();save('watcher.json',dict(pid=p.pid,pgid=p.pid))
print(json.dumps(dict(passChecks=True,projectedPeak=peak,standingInputs=len(standing),revision=rev,paths=len(selected))))
