import pathlib,json,subprocess,hashlib,time,os
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo'
import resource,sys,shutil,selectors
subprocess.run([sys.executable,str(O/'account-final.py')],check=True)
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def limits():
 resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912));resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
def git(*args):
 p=subprocess.Popen(['git','-c','pack.threads=1','-c','pack.window=0','-c','pack.windowMemory=16m',*args],cwd=R,env=dict(os.environ,GIT_SSH_COMMAND=SSH),preexec_fn=limits,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ,'stdout');sel.register(p.stderr,selectors.EVENT_READ,'stderr');out=dict(stdout=bytearray(),stderr=bytearray());deadline=time.monotonic()+120
 try:
  while sel.get_map():
   assert time.monotonic()<deadline,'Git wall limit'
   for key,_ in sel.select(min(1,max(0,deadline-time.monotonic()))):
    b=os.read(key.fileobj.fileno(),8192)
    if not b:sel.unregister(key.fileobj);continue
    assert sum(map(len,out.values()))+len(b)<=131072,'Git capture limit'
    out[key.data].extend(b)
  p.wait(timeout=max(0.01,deadline-time.monotonic()))
 finally:
  if p.poll() is None:p.kill();p.wait()
  sel.close()
 p.stdout=out['stdout'].decode();p.stderr=out['stderr'].decode()
 with (O/'publication-commands.jsonl').open('a') as f:f.write(json.dumps(dict(argv=args,exit=p.returncode,stdout=p.stdout,stderr=p.stderr,gitDATA=536870912))+'\n')
 assert p.returncode==0,(args,p.stdout,p.stderr)
 return p.stdout.strip()
docs=R/'docs/re-notes/maelstrom-current-main-uop-build-native-20261026'
assert git('rev-parse','HEAD')=='e486b6814a00518a6d9cb14ef376e69ab2f92c49'
assert git('branch','--show-current')=='task/maelstrom-current-main-uop-build-native-oct26'
manifest=json.load(open(docs/'evidence-manifest.json'))
for row in manifest:assert hashlib.file_digest((docs/row['path']).open('rb'),'sha256').hexdigest()==row['sha256']
selected=['tools/maelstrom-select-completion-hook.cjs','tools/maelstrom-diagnostic-canonical-build.cjs','tools/maelstrom-current-main-baseline.cjs','test/maelstrom-diagnostic-canonical-native.cjs','test/maelstrom-current-main-static.py',str(docs.relative_to(R))]
git('add','--sparse','-A','--',*selected)
staged=git('diff','--cached','--name-only').splitlines()
assert all(p in selected or p.startswith(selected[-1]+'/') for p in staged),staged
git('diff','--cached','--check');git('commit','-m','Qualify current-main Maelstrom canonical UOP native boundaries')
commit=git('rev-parse','HEAD');branch='refs/heads/task/maelstrom-current-main-uop-build-native-oct26';git('push','origin','HEAD:'+branch);remote=git('ls-remote','--heads','origin',branch);assert remote==commit+'\t'+branch
row=dict(status='PUSH_VERIFIED',commit=commit,remoteBranch=branch,remoteExact=remote,mainPublished=False,manifestPayloads=len(manifest),gitDATA=536870912,packThreads=1,packWindow=0,packWindowMemory='16m');(O/'publication.json').write_text(json.dumps(row,indent=2));print(json.dumps(row))
