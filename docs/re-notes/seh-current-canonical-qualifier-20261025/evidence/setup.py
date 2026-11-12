import pathlib,json,hashlib,subprocess,os
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';D=pathlib.Path('/tmp/seh-corrected-memory-canonical-build-oct25/repo');ROOT=pathlib.Path('/home/user/wine-assembly');C='a3fe340b962da3f31df249881074afe41d6c69a2';B='9d85af30e9ed0c19bac7f9ba99d1b540a508f4e4';BR='task/seh-current-canonical-qualifier-oct25'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV={**os.environ,'GIT_SSH_COMMAND':SSH,'PYTHONDONTWRITEBYTECODE':'1'}
def save(n,d):(O/n).write_text(json.dumps(d,indent=2)+'\n')
def sha(b):return hashlib.sha256(b).hexdigest()
def git(r,*a):
 p=subprocess.run(['git','-C',str(r),*a],env=ENV,capture_output=True,timeout=60);assert p.returncode==0 and not p.stderr,(a,p.returncode,p.stderr[:1000]);return p.stdout
assert json.load(open(O/'admission-precheckout.json'))['passAdmission']
view=json.load(open('/tmp/seh-coordinator-object-view-oct25/receipt.json'));stores=[x['view'] for x in view['sources']]
leaf=O/'donor-leaf';leaf.mkdir()
for p in (D/'.git/objects').iterdir():
 if p.name!='info':(leaf/p.name).symlink_to(p,target_is_directory=p.is_dir())
stores.append(str(leaf));assert all(not (pathlib.Path(p)/'info/alternates').exists() for p in stores)
ENV['GIT_OBJECT_DIRECTORY']=str(leaf);ENV['GIT_ALTERNATE_OBJECT_DIRECTORIES']=':'.join(stores[:-1])
assert git(D,'rev-parse',B+'^{commit}').decode().strip()==B
assert git(D,'merge-base','--is-ancestor',C,B)==b''
remote=git(D,'ls-remote','git@github.com:vgrichina/wine-assembly.git','refs/heads/task/seh-corrected-memory-canonical-build-oct25').decode();assert remote.split()[0]==B
save('trusted-configuration.json',dict(SSH=SSH,donor=B,candidate=C,remote=remote,mountArgv=[],intendedFiles=[],mountValidation='Offline Module-only command has no mount argv or guest parser call; unchanged exact empty configuration from verified donor trusted-configuration.json. No conditional guest execution.',session=os.environ['CODEX_SESSION_ID'],box=None,protectedBox='bx_69aem736 untouched',Boat403='api_key_action_forbidden preserved; no query'))
save('root-before.json',dict(status=git(ROOT,'status','--porcelain=v1').decode(),refs=git(ROOT,'show-ref').decode(),indexSHA256=sha((ROOT/'.git/index').read_bytes())))
ENV.pop('GIT_OBJECT_DIRECTORY');ENV.pop('GIT_ALTERNATE_OBJECT_DIRECTORIES')
p=subprocess.run(['git','init',str(R)],env=ENV,capture_output=True,timeout=60);assert p.returncode==0
(R/'.git/objects/info/alternates').write_text('\n'.join(stores)+'\n')
for k,v in [('core.sparseCheckout','true'),('core.sparseCheckoutCone','false'),('gc.auto','0'),('user.name','Wine Ops'),('user.email','wine-ops@localhost')]:git(R,'config',k,v)
paths=['/docs/re-notes/seh-current-canonical-qualifier-20261025/'];(R/'.git/info/sparse-checkout').write_text('\n'.join(paths)+'\n')
git(R,'remote','add','origin','git@github.com:vgrichina/wine-assembly.git');git(R,'checkout','-q','-b',BR,B)
save('checkout.json',dict(base=B,candidate=C,branch=BR,sparsePaths=paths,stores=stores,ownObjects=str(R/'.git/objects'),readOnlyInputViews=True,fullTreeCopies=0))
print('CHECKOUT PASS; pinned donor remote verified; own writable Git root, nonrecursive read-only views')
