import hashlib,json,os,resource,subprocess
from pathlib import Path
H=Path(__file__).parent; R=H.parent/'repo'
D=Path('/tmp/enigma-staging-footprint-repair-oct26/repo')
A=Path('/tmp/enigma-staging-footprint-independent-accept-oct26/repo')
V='f1aac7b9ba83e2bbc763cb58d38646653d626468'
AV='00bdb5504bc28e1ef17e15c15dbbc81773dbb5f8'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def run(args):
 p=subprocess.run(args,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=60)
 assert len(p.stdout)+len(p.stderr)<=131072
 return p.stdout
def sha(b):return hashlib.sha256(b).hexdigest()
def blobsha(repo,path):
 p=subprocess.Popen(['git','-C',str(repo),'show',V+':'+path],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
 digest=hashlib.sha256()
 while block:=p.stdout.read(8192):digest.update(block)
 p.stdout.close();assert p.wait(timeout=60)==0
 return digest.hexdigest()
assert run(['git','-C',str(D),'rev-parse','HEAD']).decode().strip()==V
assert run(['git','-C',str(A),'rev-parse','HEAD']).decode().strip()==AV
review='docs/reviews/enigma-staging-footprint-independent-accept-oct26/'
assert sha((D/'tools/enigma-bounded-staging.py').read_bytes())=='ed587d488cd8276191db3b7191132546943209e5bff05b67ca66dcc2b90b1652'
assert sha((A/review/'accept.py').read_bytes())=='5fc9ef217c961ac0303801fa7f479e1b86ed3fba1a8e87caee4cde91f1cd40a8'
closure=json.loads((A/review/'closure.json').read_text())
for path,identity in closure.items():
 data=(D/path).read_bytes()
 assert sha(data)==identity==blobsha(D,path)
# Reuse exact unchanged configuration receipt: no guest command is executed.
parser=D/'docs/re-notes/enigma-staging-footprint-repair-20261026/parser.json'
j=json.loads(parser.read_text());assert j['status']==0 and j['treeMount'] and not j['guestExecuted']
(H/'configuration.json').write_text(json.dumps(dict(ssh=SSH,candidate=V,acceptance=AV,mountReceiptSHA256=sha(parser.read_bytes()),parserSHA256=j['parserSHA256'],argv=j['argv'],enumeration=j['enumeration'],commaFilenames=j['commaFilenames'],treeMount=True,reusedExactUnchanged=True,guestExecuted=False),indent=2))
# Flatten recursive alternates; no donor mutation or hidden task-owned objects.
objects=set()
def visit(p):
 p=p.resolve()
 if p in objects:return
 objects.add(p)
 a=p/'info/alternates'
 if a.exists():
  for line in a.read_text().splitlines():visit(Path(line) if Path(line).is_absolute() else p/line)
visit(D/'.git/objects');visit(A/'.git/objects')
seen=set();allocated=0
for p in objects:
 for root,ds,fs in os.walk(p):
  for name in fs:
   q=Path(root)/name;s=q.stat();key=s.st_dev,s.st_ino
   if key not in seen:allocated+=s.st_blocks*512;seen.add(key)
run(['git','init','-q',str(R)])
(R/'.git/objects/info/alternates').write_text(''.join(str(x)+'\n' for x in sorted(objects)))
for key,value in [('user.name','Wine Ops'),('user.email','wine-ops@local'),('core.sparseCheckout','true'),('core.sparseCheckoutCone','false'),('core.sshCommand',SSH),('gc.auto','0')]:run(['git','-C',str(R),'config',key,value])
paths=list(closure)
(R/'.git/info/sparse-checkout').write_text(''.join('/'+p+'\n' for p in paths)+'/'+review+'\n/docs/reviews/enigma-staging-mode-preservation-repair-oct26/\n/test/test-enigma-staging-modes.py\n')
run(['git','-C',str(R),'checkout','-qb','task/enigma-staging-mode-preservation-repair-oct26',V])
run(['git','-C',str(R),'remote','add','origin','git@github.com:vgrichina/wine-assembly.git'])
# Review artifacts remain unchanged, explicitly copied as evidence, not oracle edits.
for name in ['accept.py','check-644.py','checkpoint-modes.json','checkpoint-recipe.json','checkpoint-identity.json','checkpoint-cleanup.json','checkpoint-identity-skip-duplicate.json','checkpoint-identity-double-charge.json','reuse.json','closure.json','REVIEW.md','evidence-manifest.json']:
 data=(A/review/name).read_bytes();(H/name).write_bytes(data)
(H/'root-ref-initial.json').write_bytes(Path('/home/user/wine-assembly/scratch/usage-watch/enigma-staging-mode-preservation-repair-oct26/root-ref-digest.json').read_bytes())
(H/'checkout.json').write_text(json.dumps(dict(candidate=V,acceptance=AV,closure=closure,flatReadOnlyObjects=[str(x) for x in sorted(objects)],standingObjectAllocated=allocated,standingObjectInodes=len(seen),paths=paths,ssh=SSH),indent=2))
print(json.dumps(dict(candidate=V,closureFiles=len(closure),standingObjectAllocated=allocated,standingObjectInodes=len(seen))))
