import pathlib,json,hashlib,subprocess,os
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';ROOT=pathlib.Path('/home/user/wine-assembly');D=pathlib.Path('/tmp/seh-current-canonical-qualifier-oct25/repo');B='806117a11f1b347340b5cc44fb52b79d0ac200e5';C='a3fe340b962da3f31df249881074afe41d6c69a2'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
E={**os.environ,'GIT_SSH_COMMAND':SSH,'PYTHONDONTWRITEBYTECODE':'1'}
def save(n,d):(O/n).write_text(json.dumps(d,indent=2)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def git(r,*a):
 p=subprocess.run(['git','-C',str(r),*a],env=E,capture_output=True,timeout=50);assert p.returncode==0,(a,p.returncode,p.stderr[:2000]);assert len(p.stdout)+len(p.stderr)<=131072;return p.stdout
assert json.load(open(O/'admission-precheckout.json'))['passAdmission']
assert sha(pathlib.Path('/tmp/seh-canonical-qualifier-independent-integrate-oct25/ops/reproduce.cjs'))=='dccbc1f1667332d85805146fb499bff94a744c6e95437368eedfa9dbcfa9f91c'

assert sha(ROOT/'scratch/usage-watch/stream-root-ref-digest-oct25.py')=='25cc9cb5c42ad0c40fe9726167c2800fc1ee7e3ade93ecce53c56a8e93bb9efc'
for base in ['/tmp/seh-current-canonical-qualifier-oct25','/tmp/seh-canonical-qualifier-independent-integrate-oct25']:
 m=json.load(open(base+'/ops/final-evidence-manifest.json'))
 for row in (m if isinstance(m,list) else m['files']):
  p=pathlib.Path(row['path']);assert p.stat().st_size==row['bytes'] and sha(p)==row['sha256'],str(p)
old=pathlib.Path('/tmp/seh-qualifier-trust-anchor-repair-oct25/ops/blocker-evidence-manifest.json')
for row in json.load(open(old))['files']:
 p=pathlib.Path(row['path']);assert p.stat().st_size==row['bytes'] and sha(p)==row['sha256']
save('prior-blocker-preserved.json',dict(path=str(old),sha256=sha(old)))

v=json.load(open('/tmp/seh-coordinator-object-view-oct25/receipt.json'));stores=[x['view'] for x in v['sources']]
for name,donor in [('candidate',D),('reviewer',pathlib.Path('/tmp/seh-canonical-qualifier-independent-integrate-oct25/repo'))]:
 leaf=O/(name+'-leaf');leaf.mkdir()
 for p in (donor/'.git/objects').iterdir():
  if p.name!='info':(leaf/p.name).symlink_to(p,target_is_directory=p.is_dir())
 stores.append(str(leaf))
stores.append('/tmp/seh-current-canonical-qualifier-oct25/ops/donor-leaf')
assert all(not (pathlib.Path(p)/'info/alternates').exists() for p in stores)
E['GIT_OBJECT_DIRECTORY']=stores[-3];E['GIT_ALTERNATE_OBJECT_DIRECTORIES']=':'.join(stores[:-3]+stores[-2:])
assert git(D,'rev-parse',B+'^{commit}').decode().strip()==B
assert git(D,'merge-base','--is-ancestor',C,B)==b''
remote=git(D,'ls-remote','git@github.com:vgrichina/wine-assembly.git','refs/heads/main','refs/heads/task/seh-current-canonical-qualifier-oct25','refs/heads/task/seh-canonical-qualifier-independent-integrate-oct25').decode()
for x in [B,C,'6c4b06b8754989d6f91769cb3f1b8dd6b98ac32c']:assert x in remote
trusted=json.load(open('/tmp/seh-current-canonical-qualifier-oct25/ops/trusted-configuration.json'));assert trusted['SSH']==SSH and trusted['mountArgv']==[] and trusted['intendedFiles']==[]
save('trusted-configuration.json',dict(SSH=SSH,remote=remote,source=C,donor=B,mountArgv=[],intendedFiles=[],mountValidation='Reused unchanged exact empty configuration receipt; no guest command/mount exists and no parser or Boat query is executed.',receiptSHA256=sha(pathlib.Path('/tmp/seh-current-canonical-qualifier-oct25/ops/trusted-configuration.json')),box=None,state='notassigned',expiry=None,protectedBox='bx_69aem736 untouched',session=os.environ['CODEX_SESSION_ID']))
E.pop('GIT_OBJECT_DIRECTORY');E.pop('GIT_ALTERNATE_OBJECT_DIRECTORIES')
save('root-before.json',dict(status=git(ROOT,'status','--porcelain=v1').decode(),refs=json.loads(subprocess.check_output(['python3',str(ROOT/'scratch/usage-watch/stream-root-ref-digest-oct25.py')],env=E,timeout=20)),indexSHA256=sha(ROOT/'.git/index')))
p=subprocess.run(['git','init',str(R)],env=E,capture_output=True,timeout=20);assert p.returncode==0
(R/'.git/objects/info/alternates').write_text('\n'.join(stores)+'\n')
for k,val in [('core.sparseCheckout','true'),('core.sparseCheckoutCone','false'),('gc.auto','0'),('user.name','Wine Ops'),('user.email','wine-ops@localhost')]:git(R,'config',k,val)
(R/'.git/info/sparse-checkout').write_text('/docs/re-notes/seh-current-canonical-qualifier-20261025/\n/docs/re-notes/seh-qualifier-streamed-trust-repair-20261025/\n')
git(R,'remote','add','origin','git@github.com:vgrichina/wine-assembly.git');git(R,'checkout','-q','-b','task/seh-qualifier-streamed-trust-repair-oct25',B)
save('checkout.json',dict(base=B,source=C,branch='task/seh-qualifier-streamed-trust-repair-oct25',stores=stores))
print('Pinned paths/hashes/remote refs/trusted empty mount configuration verified; sparse checkout PASS')
