import hashlib,json,os,pathlib,shutil,subprocess,sys,time
H=pathlib.Path(__file__).resolve().parent;R=H.parent/'repo'
branch='task/maelstrom-select-hook-recovered-canonical-native-oct24'
base='01c4a60d50afe394a0afc9fda1267e6a508e7821'
folder='docs/re-notes/maelstrom-select-hook-recovered-canonical-native-20261024-evidence'
report='docs/re-notes/maelstrom-select-hook-recovered-canonical-native-20261024.md'
commands=[]
def run(*argv):
 p=subprocess.run(argv,cwd=R,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=45)
 assert len(p.stdout)+len(p.stderr)<=131072,'publication command output cap'
 commands.append(dict(argv=argv,exit=p.returncode,stdout=p.stdout.decode(),stderr=p.stderr.decode()))
 (H/'publication-commands.json').write_text(json.dumps(commands,indent=2))
 assert p.returncode==0,commands[-1]
 return p.stdout.decode().strip()
assert json.loads((H/'native-result.json').read_text())['status']=='PASS'
assert json.loads((H/'focused-controls.json').read_text())['status']=='PASS'
assert json.loads((H/'static-abi.json').read_text())['status']=='PASS'
assert run('git','rev-parse','HEAD')==base
assert run('git','branch','--show-current')==branch
run('git','config','gc.auto','0');run('git','config','maintenance.auto','false')
remote=run('git','ls-remote','origin','refs/heads/main','refs/heads/'+branch)
assert remote==base+'\trefs/heads/main',('remote reconciliation',remote)
destination=R/folder;destination.mkdir(parents=True,exist_ok=True)
plan=json.loads((H/'publication-plan.json').read_text())
selected=plan['selected']+['publication-plan.json','admission-prepublication.json','cleanup-before-publication.json','publish.py']
for name in dict.fromkeys(selected):
 p=H/name;assert p.is_file() and p.stat().st_size<=25165824
 shutil.copyfile(p,destination/name)
 (destination/name).chmod(0o644)
files=['tools/maelstrom-select-hook-canonical-build.cjs','test/maelstrom-select-hook-static.py',
 'test/maelstrom-select-hook-native.cjs','test/maelstrom-select-hook-build-controls.cjs',report]
files += [str(p.relative_to(R)) for p in sorted(destination.iterdir()) if p.is_file()]
run('git','add','--sparse','-f','--',*files)
run('git','diff','--cached','--check')
staged=run('git','diff','--cached','--name-only').splitlines();assert sorted(staged)==sorted(files)
seals=[]
for name in staged:
 b=(R/name).read_bytes();blob=run('git','hash-object','--',name)
 seals.append(dict(path=name,bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),gitBlob=blob))
(H/'committed-artifacts.json').write_text(json.dumps(seals,indent=2))
tree=run('git','write-tree')
run('git','commit','-m','Qualify exact select hook with canonical builds and controlled native dispatch')
commit=run('git','rev-parse','HEAD');assert run('git','rev-parse','HEAD^{tree}')==tree
for row in seals:assert run('git','rev-parse','HEAD:'+row['path'])==row['gitBlob']
assert subprocess.call([sys.executable,str(H/'account.py'),'admission-before-push.json'])==0
run('git','push','--porcelain','origin','HEAD:refs/heads/'+branch)
remote=run('git','ls-remote','origin','refs/heads/'+branch,'refs/heads/main')
refs={line.split()[1]:line.split()[0] for line in remote.splitlines()}
assert refs['refs/heads/'+branch]==commit and refs['refs/heads/main']==base
assert run('git','status','--porcelain')==''
out=dict(status='PUBLISHED',commit=commit,tree=tree,branch=branch,remote=refs,sealedBlobs=len(seals),
 moduleBlobs=[r for r in seals if r['path'].endswith('.wasm')],noMainPush=True,noMerge=True,
 verification='Exact remote task SHA binds committed tree and local SHA256/Git blob seals; successful Git receive supplies transitive objects. No fetch/download.',
 completedAt=time.time())
(H/'publication.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))
