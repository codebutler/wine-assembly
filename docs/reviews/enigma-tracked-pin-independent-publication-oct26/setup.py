from common import *
import zlib
save('db-baseline.json',{str(p):alloc(p) for p in pathlib.Path('/home/user/.codex').glob('*.sqlite*')})
gate('initial')
node=run([NODE,'--max-old-space-size=192','-e','console.log(JSON.stringify({execPath:process.execPath,argv:process.execArgv,env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR,NODE_OPTIONS:process.env.NODE_OPTIONS,GIT_SSH_COMMAND:process.env.GIT_SSH_COMMAND},limits:require("fs").readFileSync("/proc/self/limits","utf8"),rss:process.memoryUsage().rss}))'])
save('node-startup.json',json.loads(node))
runner=D/'docs/reviews/enigma-uncertainty-independent-publication-oct26/tracked-run.js'
b=runner.read_bytes();assert sha(b)=='87ab63d768eb59a09a8b69df2ccb3843270dd867a67405abd82f02c25c1628e7'
assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()=='4b8461338f4bcddde6b5d5504991523b28d3ac35'
s=b.decode();parser=s[s.index('const getArg ='):s.index('// Was `--name=...`')]
parsed=json.loads(run([NODE,'--max-old-space-size=192','-e','const args=[];'+parser+';console.log(JSON.stringify({trees:getArgs("vfs-tree"),mounts:getArgs("vfs-mount")}))']))
assert parsed==dict(trees=[],mounts=[])
save('configuration.json',dict(ssh=SSH,mountArgv=[],intendedFiles=[],parsed=parsed,parserSHA256=sha(parser.encode()),runnerSHA256=sha(b),rootRefReceipt=json.load(open(ROOT/'scratch/usage-watch'/H.name/'root-ref-digest.json')),tools={NODE:dict(bytes=pathlib.Path(NODE).stat().st_size,sha256=sha(pathlib.Path(NODE).read_bytes()))},readonlyDonor=dict(path=str(D),allocatedBytes=alloc(D))))
R.mkdir();g('init','-q',str(R),cwd=H)
seen=set();ordered=[]
def visit(p):
 p=p.resolve()
 if p in seen:return
 seen.add(p)
 if not p.exists():return
 f=p/'info/alternates'
 if f.exists():
  for line in f.open():
   q=line.strip()
   if q:visit(pathlib.Path(q) if q.startswith('/') else p/q)
 ordered.append(str(p))
visit(D/'.git/objects');visit(ROOT/'.git/objects')
(R/'.git/objects/info/alternates').write_text('\n'.join(ordered)+'\n')
paths=['tools/enigma-presented-menu-controller.cjs','test/test-enigma-tracked-runner-wiring.cjs','test/test-enigma-presented-menu-controller.cjs','test/fixtures/enigma-presented-menu-contract.json','docs/re-notes/enigma-start-game-menu-click-api-oct26/predecessor-menu.png']
prefixes=['docs/reviews/enigma-tracked-runner-pin-repair-oct26/','docs/reviews/enigma-uncertainty-independent-publication-oct26/']
rows=g('ls-tree','-r','-t',REV).decode().splitlines()
objects=[(REV,'commit'),(g('rev-parse',REV+'^{tree}').decode().strip(),'tree')]
for l in rows:
 head,p=l.split('\t');mode,kind,oid=head.split()
 if kind=='tree' or p in paths or any(p.startswith(x) for x in prefixes):objects.append((oid,kind))
for oid,kind in objects:
 b=g('cat-file',kind,oid);raw=(kind+' '+str(len(b))+'\0').encode()+b;assert hashlib.sha1(raw).hexdigest()==oid
 p=R/'.git/objects'/oid[:2]/oid[2:];p.parent.mkdir(exist_ok=True);p.write_bytes(zlib.compress(raw))
(R/'.git/objects/info/alternates').unlink();(R/'.git/shallow').write_text(REV+'\n')
for k,v in [('core.sparseCheckout','true'),('core.sparseCheckoutCone','false'),('core.sshCommand',SSH),('user.name','Wine Ops'),('user.email','wine-ops@local')]:g('config',k,v)
(R/'.git/info/sparse-checkout').write_text('\n'.join('/'+p for p in paths)+'\n'+''.join('/'+p+'\n' for p in prefixes)+'/docs/reviews/'+H.name+'/\n')
g('update-ref','refs/heads/'+BR,REV);g('symbolic-ref','HEAD','refs/heads/'+BR);g('read-tree','-mu','HEAD');g('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
save('checkout.json',dict(candidate=REV,paths=paths,objects=len(objects),tree=g('rev-parse','HEAD^{tree}').decode().strip(),hashes={p:sha((R/p).read_bytes()) for p in paths}))
f=open(O/'board-watch.log','ab');p=subprocess.Popen(['tail','-n','0','-f',str(ROOT/'messageboard.txt')],stdout=f,stderr=f,start_new_session=True);f.close();save('watcher.json',dict(pid=p.pid))
gate('checkout');print('SETUP PASS')
