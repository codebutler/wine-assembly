import pathlib,json,hashlib,subprocess,os
O=pathlib.Path(__file__).resolve().parent; R=O.parent/'repo'; ROOT=pathlib.Path('/home/user/wine-assembly')
D=pathlib.Path('/tmp/seh-qualifier-streamed-trust-repair-oct25/repo')
C='19b32dad2ac09a6ae022f1f5f619a91e3f7dde4c'; B='a3fe340b962da3f31df249881074afe41d6c69a2'
E=dict(os.environ,GIT_SSH_COMMAND='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes')
def sha(b):return hashlib.sha256(b).hexdigest()
def git(r,*a):
 p=subprocess.run(['git','-C',str(r),*a],env=E,capture_output=True,timeout=45);assert p.returncode==0,(a,p.stderr[:2000]);assert len(p.stdout)+len(p.stderr)<131072;return p.stdout
def save(n,d):(O/n).write_text(json.dumps(d,indent=2)+'\n')
v=json.load(open('/tmp/seh-coordinator-object-view-oct25/receipt.json')); stores=[x['view'] for x in v['sources']]
for name,donor in [('repair',D),('baseline',pathlib.Path('/tmp/seh-current-canonical-qualifier-oct25/repo'))]:
 leaf=O/(name+'-leaf');leaf.mkdir()
 for p in (donor/'.git/objects').iterdir():
  if p.name!='info':(leaf/p.name).symlink_to(p,target_is_directory=p.is_dir())
 stores.append(str(leaf))
stores += json.load(open('/tmp/seh-qualifier-streamed-trust-repair-oct25/ops/checkout.json'))['stores']
stores=list(dict.fromkeys(stores));assert all(not (pathlib.Path(p)/'info/alternates').exists() for p in stores)
E.update(GIT_OBJECT_DIRECTORY=stores[-1],GIT_ALTERNATE_OBJECT_DIRECTORIES=':'.join(stores[:-1]))
assert git(D,'rev-parse',C+'^{commit}').decode().strip()==C
git(D,'merge-base','--is-ancestor',B,C)
prefix='docs/re-notes/seh-current-canonical-qualifier-20261025/'
files=[prefix+x for x in ['qualify.cjs','test-qualifier.cjs','test-trust-anchor.cjs','evidence/contract.json','evidence/source-binding.json']]
files+=['docs/re-notes/seh-qualifier-streamed-trust-repair-20261025/README.md','docs/re-notes/seh-qualifier-streamed-trust-repair-20261025/evidence/review.json']
pins={p:sha(git(D,'show',C+':'+p)) for p in files}
assert pins[prefix+'qualify.cjs']=='c4f2d1383bb7fa253b2134443548820a4b6cd40991c4581cdd10d5a8db97cf70'
assert pins[prefix+'evidence/contract.json']=='4aca68bf97038d771390dd499703fac2e559146186d23f34e6e27425a5083a4b'
for p in ['evidence/contract.json','evidence/source-binding.json']:
 assert git(D,'show','806117a11f1b347340b5cc44fb52b79d0ac200e5:'+prefix+p)==git(D,'show',C+':'+prefix+p)
save('provenance-pins.json',dict(candidate=C,base=B,pins=pins,baselineCommittedContractUnchanged=True,baselineCommittedSourceReceiptUnchanged=True))
E.pop('GIT_OBJECT_DIRECTORY');E.pop('GIT_ALTERNATE_OBJECT_DIRECTORIES')
trusted=json.load(open('/tmp/seh-qualifier-streamed-trust-repair-oct25/ops/trusted-configuration.json'))
assert trusted['SSH']==E['GIT_SSH_COMMAND'] and trusted['mountArgv']==[] and trusted['intendedFiles']==[]
save('trusted-configuration.json',dict(SSH=E['GIT_SSH_COMMAND'],receiptSHA256=sha(json.dumps(trusted).encode()),mountArgv=[],intendedFiles=[],validation='unchanged exact empty mount receipt; no runtime or mount invocation',box=None,state='notassigned',expiry=None))
p=ROOT/'scratch/usage-watch/stream-root-ref-digest-oct25.py';assert sha(p.read_bytes())=='25cc9cb5c42ad0c40fe9726167c2800fc1ee7e3ade93ecce53c56a8e93bb9efc'
save('root-before.json',dict(indexSHA256=sha((ROOT/'.git/index').read_bytes()),refs=json.loads(subprocess.check_output(['python3',str(p)],timeout=15))))
git(ROOT,'init',str(R))
(R/'.git/objects/info/alternates').write_text('\n'.join(stores)+'\n')
for k,val in [('core.sparseCheckout','true'),('core.sparseCheckoutCone','false'),('gc.auto','0'),('user.name','Wine Ops'),('user.email','wine-ops@localhost')]:git(R,'config',k,val)
(R/'.git/info/sparse-checkout').write_text('\n'.join('/'+p for p in files)+'\n')
git(R,'remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
git(R,'checkout','-q','-b','task/seh-trust-anchor-independent-closeout-oct25',C)
for p,h in pins.items():assert sha((R/p).read_bytes())==h
save('checkout.json',dict(candidate=C,base=B,files=files,pins=pins,stores=stores))
print('Explicit sparse checkout and committed contract/source receipt provenance PASS')
