import pathlib,json,hashlib,subprocess,os,sys,time
T=pathlib.Path(__file__).resolve().parent.parent;O=T/'ops';R=T/'repo'
ROOT=pathlib.Path('/home/user/wine-assembly');D=pathlib.Path('/tmp/host-worker-lifecycle-independent-integrate-oct25/repo');S=pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23')
C='a3fe340b962da3f31df249881074afe41d6c69a2';BR='task/seh-corrected-memory-canonical-build-oct25'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV={**os.environ,'GIT_SSH_COMMAND':SSH,'PYTHONDONTWRITEBYTECODE':'1'}
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,d):(O/n).write_text(json.dumps(d,indent=2)+'\n')
def git(root,*a):
 p=subprocess.run(['git','-C',str(root),*a],env=ENV,timeout=60,capture_output=True);assert not p.stderr,('Git stderr',p.stderr[:1000]);assert p.returncode==0,(a,p.returncode);return p.stdout
assert json.load(open(O/'admission-precheckout.json'))['passAdmission']
view=json.load(open('/tmp/seh-coordinator-object-view-oct25/receipt.json'))
ENV['GIT_OBJECT_DIRECTORY']=view['gitObjectDirectory'];ENV['GIT_ALTERNATE_OBJECT_DIRECTORIES']=view['gitAlternateObjectDirectories']
assert git(D,'rev-parse',C+'^{commit}').decode().strip()==C
pins=json.load(open(ROOT/'scratch/usage-watch/seh-canonical-build-input-pins-oct25.json'));save('input-pins.json',pins)
identities=[]
for r in pins['recoveryRecipes']+pins['additionalPins']:
 b=pathlib.Path(r['path']).read_bytes();assert len(b)==r['bytes'] and sha(b)==r['sha256'],r['path'];identities.append(r)
save('standing-pins-verified.json',identities)
save('root-before.json',dict(status=git(ROOT,'status','--porcelain=v1').decode(),refs=git(ROOT,'show-ref').decode(),indexSHA256=sha((ROOT/'.git/index').read_bytes())))
refs=git(D,'ls-remote','git@github.com:vgrichina/wine-assembly.git','refs/heads/main').decode();assert refs.split()[0]==C,refs
save('trusted-configuration.json',dict(SSH=SSH,remoteMain=refs,donorCommit=C,mountArgv=[],mountValidation='No mount argv or filenames: offline task. Canonical guest parser not invoked; no conditional guest execution.',runtime=dict(mode='offline',box=None,session= os.environ['CODEX_SESSION_ID'],coordinatorReceipt='scratch/usage-watch/seh-corrected-memory-launch-admission-oct25.json')))
stores=[r['view'] for r in view['sources']]
assert all(not (pathlib.Path(p)/'info/alternates').exists() for p in stores)
# First bounded Git check and all pins read exclusively through validated view.
checked=[]
for row in pins['files']:
 b=git(D,'cat-file','blob',C+':'+row['path']);assert len(b)==row['bytes'] and sha(b)==row['sha256'],row['path'];checked.append(row['path'])
save('first-git-input-check.json',dict(candidate=C,files=len(checked),stderrBytes=0,passed=True,viewReceipt='/tmp/seh-coordinator-object-view-oct25/receipt.json'))
ENV.pop('GIT_OBJECT_DIRECTORY');ENV.pop('GIT_ALTERNATE_OBJECT_DIRECTORIES')
p=subprocess.run(['git','init',str(R)],env=ENV,capture_output=True);assert p.returncode==0
(R/'.git/objects/info/alternates').write_text('\n'.join(stores)+'\n')
for k,v in [('core.sparseCheckout','true'),('core.sparseCheckoutCone','false'),('gc.auto','0'),('user.name','Wine Ops'),('user.email','wine-ops@localhost')]:git(R,'config',k,v)
paths=['/docs/re-notes/seh-corrected-memory-canonical-build-20261025.md','/docs/re-notes/seh-corrected-memory-canonical-build-20261025-evidence/']
(R/'.git/info/sparse-checkout').write_text('\n'.join(paths)+'\n');git(R,'remote','add','origin','git@github.com:vgrichina/wine-assembly.git');git(R,'checkout','-q','-b',BR,C)
save('checkout.json',dict(candidate=C,branch=BR,HEAD=git(R,'rev-parse','HEAD').decode().strip(),sparsePaths=paths,readonlyFlattenedAlternates=stores,noSourceCopies=True,noObjectCopies=True))
print('CHECKOUT PASS: exact candidate, trusted SSH, flattened readonly stores, explicit sparse report paths')
