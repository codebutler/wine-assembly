from common import *
import zlib
save('db-baseline.json',{str(p):alloc(p) for p in pathlib.Path('/home/user/.codex').glob('*.sqlite*')})
gate('initial')
save('node-startup.json',json.loads(run([NODE,'--max-old-space-size=192','-e','console.log(JSON.stringify({execPath:process.execPath,argv:process.execArgv,env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR,NODE_OPTIONS:process.env.NODE_OPTIONS,GIT_SSH_COMMAND:process.env.GIT_SSH_COMMAND},limits:require("fs").readFileSync("/proc/self/limits","utf8"),rss:process.memoryUsage().rss}))'])))
# Environment receipt stores only execution-relevant variables; no credentials.
j=json.load(open(O/'node-startup.json'));j['env']={k:v for k,v in j['env'].items() if k in ['NODE_OPTIONS','TMPDIR','PATH','GIT_SSH_COMMAND']};save('node-startup.json',j)
b=pathlib.Path('/tmp/enigma-presented-frame-controller-repair-oct26/ops/pinned-run.js').read_bytes();assert sha(b)=='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'
s=b.decode();parser=s[s.index('const getArg ='):s.index('// Was `--name=...`')]
parsed=json.loads(run([NODE,'--max-old-space-size=192','-e','const args=[];'+parser+';console.log(JSON.stringify({trees:getArgs("vfs-tree"),mounts:getArgs("vfs-mount")}))']))
assert parsed==dict(trees=[],mounts=[])
save('configuration.json',dict(ssh=SSH,mountArgv=[],intendedFiles=[],parsed=parsed,parserSHA256=sha(parser.encode()),runnerSHA256=sha(b),rootRefReceipt=json.load(open(ROOT/'scratch/usage-watch'/H.name/'root-ref-digest.json'))))
R.mkdir();g('init','-q',str(R),cwd=H)
seen=set();ordered=[];warnings=[]
def visit(p):
 p=p.resolve()
 if p in seen:return
 seen.add(p);assert len(seen)<2048
 if not p.exists():warnings.append('missing immutable object store '+str(p));return
 f=p/'info/alternates'
 if f.exists():
  for line in f.open():
   assert len(line)<8192
   q=line.strip()
   if q:visit(pathlib.Path(q) if q.startswith('/') else p/q)
 ordered.append(str(p))
visit(D/'.git/objects');visit(pathlib.Path('/tmp/corpus-complete-contract-independent-publication-oct26/repo/.git/objects'))
# Flatten only immutable existing stores; preserve missing-store warnings.
(R/'.git/objects/info/alternates').write_text('\n'.join(ordered)+'\n')
paths=['tools/enigma-presented-menu-controller.cjs','test/test-enigma-presented-menu-controller.cjs','test/fixtures/enigma-presented-menu-contract.json','docs/re-notes/enigma-start-game-menu-click-api-oct26/predecessor-menu.png']
rows=g('ls-tree','-r','-t',REV).decode().splitlines()
objects=[(REV,'commit'),(g('rev-parse',REV+'^{tree}').decode().strip(),'tree')]
for l in rows:
 head,p=l.split('\t');mode,kind,oid=head.split()
 if kind=='tree' or p in paths or p.startswith('docs/reviews/enigma-'):objects.append((oid,kind))
for oid,kind in objects:
 b=g('cat-file',kind,oid);raw=(kind+' '+str(len(b))+'\0').encode()+b;assert hashlib.sha1(raw).hexdigest()==oid
 p=R/'.git/objects'/oid[:2]/oid[2:];p.parent.mkdir(exist_ok=True);p.write_bytes(zlib.compress(raw))
(R/'.git/objects/info/alternates').unlink();(R/'.git/shallow').write_text(REV+'\n')
for k,v in [('core.sparseCheckout','true'),('core.sparseCheckoutCone','false'),('core.sshCommand',SSH),('user.name','Wine Ops'),('user.email','wine-ops@local')]:g('config',k,v)
(R/'.git/info/sparse-checkout').write_text('\n'.join('/'+p for p in paths)+'\n/docs/reviews/enigma-atomic-presented-click-repair-oct26/\n/docs/reviews/enigma-atomic-click-independent-accept-oct26/\n/docs/reviews/enigma-final-dispatch-uncertainty-repair-oct26/\n/docs/reviews/'+H.name+'/\n')
g('update-ref','refs/heads/'+BR,REV);g('symbolic-ref','HEAD','refs/heads/'+BR);g('read-tree','-mu','HEAD');g('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
save('checkout.json',dict(candidate=REV,paths=paths,flatObjects=len(objects),readOnlyStores=len(ordered),warnings=warnings,tree=g('rev-parse','HEAD^{tree}').decode().strip(),hashes={p:sha((R/p).read_bytes()) for p in paths}))
f=open(O/'board-watch.log','ab');p=subprocess.Popen(['tail','-n','0','-f',str(ROOT/'messageboard.txt')],stdout=f,stderr=f,start_new_session=True);f.close();save('watcher.json',dict(pid=p.pid))
gate('checkout');print('SETUP PASS')
