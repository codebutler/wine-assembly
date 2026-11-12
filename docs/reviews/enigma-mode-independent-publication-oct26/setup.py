from common import *
import sys
admission('precheckout')
argv=Path('/proc/2305082/cmdline').read_bytes().split(b'\0');argv=[a.decode() for a in argv if a]
assert 'gpt-6.1-sol' in argv and 'model_reasoning_effort="medium"' in argv and 'model_auto_compact_token_limit=200000' in argv and 'model_auto_compact_token_limit_scope="total"' in argv
save('launch.json',dict(pid=2305082,argv=argv,session='01a17738-e655-7912-aa2c-3fa07ab18ae5',actual=True))
assert git('rev-parse','HEAD',repo=D)[1].decode().strip()==V
assert git('rev-parse','HEAD',repo=A)[1].decode().strip()==AV
pins={'tools/enigma-bounded-staging.py':'d3b2a9c152de0a7cfbe61facf1d847d6192e4bd399e1638091417070ffdb1f3b','test/test-enigma-staging-modes.py':'c997e0c733fdfb74dbe437ee5878d7d80695d9adac71914e7abe193ac1c07a4f'}
for p,h in pins.items():assert sha(D/p)==h==blobhash(D,V,p)[0]
ar='docs/reviews/enigma-staging-footprint-independent-accept-oct26'
assert sha(A/ar/'accept.py')=='5fc9ef217c961ac0303801fa7f479e1b86ed3fba1a8e87caee4cde91f1cd40a8'==blobhash(A,AV,ar+'/accept.py')[0]
repair='docs/reviews/enigma-staging-mode-preservation-repair-oct26'
manifest=json.loads((D/repair/'evidence-manifest.json').read_text())
for p,v in manifest.items():assert blobhash(D,V,p)==(v['sha256'],v['bytes']) and sha(D/p)==v['sha256']
closure=json.loads((D/repair/'closure.json').read_text())
for p,h in closure.items():
 expected=pins.get(p,h)
 if p.endswith('verify-and-stage.py'):expected='8670667e87830f21f4303eef77dd2e477b50c6b2d4aa31c3c2a89d544b46d97e'
 assert sha(D/p)==expected==blobhash(D,V,p)[0]
pins.update({p:sha(D/p) for p in closure})
# Exact unchanged canonical mount configuration/enumeration receipt; no runtime.
cfg=json.loads((D/repair/'configuration.json').read_text())
assert cfg['ssh']==SSH and cfg['treeMount'] and not cfg['guestExecuted']
parser=D/'docs/re-notes/enigma-staging-footprint-repair-20261026/parser.json'
assert sha(parser)==cfg['mountReceiptSHA256']
pj=json.loads(parser.read_text());assert pj['status']==0 and pj['argv']==cfg['argv'] and pj['enumeration']==cfg['enumeration'] and pj['commaFilenames']==cfg['commaFilenames']
save('configuration.json',dict(ssh=SSH,canonicalMountReceiptSHA256=sha(parser),receipt=cfg,validatedSameTask=True,noGuestExecution=True))
remote=git('ls-remote','git@github.com:vgrichina/wine-assembly.git','refs/heads/main','refs/heads/task/enigma-staging-mode-preservation-repair-oct26',repo=D)[1].decode()
refs={line.split()[1]:line.split()[0] for line in remote.splitlines()}
assert refs['refs/heads/main']==MAIN and refs['refs/heads/task/enigma-staging-mode-preservation-repair-oct26']==V,refs
objects=set()
def visit(p):
 p=p.resolve()
 if p in objects:return
 objects.add(p);a=p/'info/alternates'
 if a.exists():
  for x in a.read_text().splitlines():visit(Path(x) if Path(x).is_absolute() else p/x)
for repo in [D,A,ROOT]:visit(repo/'.git/objects')
paths=sorted(set(pins)|{ar,repair,E})
# Focused measurement before checkout; no wildcard full checkout.
rows=git('ls-tree','-rl',V,'--',*paths,repo=D)[1].decode().splitlines()
size=sum(int(x.split('\t')[0].split()[3]) for x in rows)
assert size<8388608
save('inputs.json',dict(candidate=V,main=MAIN,acceptance=AV,pins=pins,repairPayloadsVerified=len(manifest),remote=refs,sparsePaths=paths,trackedBytes=size,flatReadonlyObjects=[str(p) for p in sorted(objects)],standingTools={p:dict(bytes=Path(p).stat().st_size,sha256=sha(p)) for p in ['/usr/bin/git',sys.executable]},rootRefReceipt=json.loads((L/'root-ref-digest.json').read_text())))
git('init','-q',str(R),repo=H)
(R/'.git/objects/info/alternates').write_text(''.join(str(p)+'\n' for p in sorted(objects)))
for k,v in [('user.name','Wine Ops'),('user.email','wine-ops@local'),('core.sparseCheckout','true'),('core.sparseCheckoutCone','false'),('core.sshCommand',SSH),('gc.auto','0'),('core.preloadIndex','false'),('index.threads','1'),('pack.threads','1')]:git('config',k,v)
(R/'.git/info/sparse-checkout').write_text(''.join('/'+p+'\n' for p in paths))
git('checkout','-qb',BRANCH,V)
git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
for name in ['accept.py','check-644.py','run-group.py']:
 source=D/repair/name
 (H/name).write_bytes(source.read_bytes())
save('checkpoint.json',dict(candidate=V,pins=pins,completed=['pinned-inputs','actual-launch','trusted-remote','sparse-checkout'],remaining=['modes','check644','old-identity-contract','focused','adversarial','reuse','merge','publication'],blockers=[]))
print(json.dumps(dict(status='READY',candidate=V,main=MAIN,sourceBytes=size,repairPayloads=len(manifest),resources=admission('postcheckout')['peak'])))
