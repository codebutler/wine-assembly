import pathlib,subprocess,json,hashlib,os,datetime,ast,base64
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';P=R/'docs/re-notes/seh-current-canonical-qualifier-20261025';E=P/'evidence';BR='task/seh-current-canonical-qualifier-oct25';BASE='9d85af30e9ed0c19bac7f9ba99d1b540a508f4e4'
assert 'GIT_OBJECT_DIRECTORY' not in os.environ and 'GIT_ALTERNATE_OBJECT_DIRECTORIES' not in os.environ
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes';assert os.environ['GIT_SSH_COMMAND']==SSH

def sha(b):return hashlib.sha256(b).hexdigest()
def git(*args):
 p=subprocess.run(['git','-C',str(R),*args],capture_output=True,timeout=55);assert p.returncode==0,(args,p.returncode,p.stderr[:2000]);return p.stdout.decode().strip()
assert git('branch','--show-current')==BR and git('rev-parse','HEAD')==BASE
for row in json.load(open(E/'seal.json')):
 b=(P/row['path']).read_bytes();assert sha(b)==row['sha256'] and len(b)==row['bytes']
assert sha((P/'qualify.cjs').read_bytes())==json.load(open(O/'result.json'))['qualifierSHA256']
for p in O.glob('*.py'):ast.parse(p.read_text())
main=git('ls-remote','origin','refs/heads/main');donor=git('ls-remote','origin','refs/heads/task/seh-corrected-memory-canonical-build-oct25');assert donor.split()[0]==BASE
(O/'publication-inputs.json').write_text(json.dumps(dict(base=BASE,remoteMainAtPublication=main,remoteDonor=donor,noMerge=True,strictSSH=SSH),indent=2)+'\n')
# Preserve every completed command receipt, including closeout/review, before
# publication. The publication terminal receipt and final local seal follow it.
commands=[]
for p in O.glob('*.json'):
 d=json.load(open(p))
 if isinstance(d,dict) and 'argv' in d and 'reaped' in d:
  assert d['reaped'] and not d['remainingGroup'];commands.append(dict(receipt=p.name,terminalReceiptPersistedUTC=datetime.datetime.fromtimestamp(p.stat().st_mtime,datetime.timezone.utc).isoformat(),**d))
(O/'prepublication-commands.json').write_text(json.dumps(commands,indent=2)+'\n')
for p in O.iterdir():
 if p.is_file() and p.suffix in ['.json','.py','.md','.stdout','.stderr'] and p.name not in ['root-before.json','publication-complete.json']:
  if p.name=='cheap-1792962236091052009.stderr':
   # Preserve raw assertion evidence byte-exactly without introducing its
   # whitespace-only diagnostic lines as Git text whitespace errors.
   (E/p.name).unlink(missing_ok=True);b=p.read_bytes()
   (E/(p.name+'.base64.json')).write_text(json.dumps(dict(encoding='base64',bytes=len(b),sha256=sha(b),data=base64.b64encode(b).decode()),indent=2)+'\n')
  else:(E/p.name).write_bytes(p.read_bytes())
seal=[dict(path=str(p.relative_to(P)),bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(P.rglob('*')) if p.is_file() and p.name!='seal.json'];(E/'seal.json').write_text(json.dumps(seal,indent=2)+'\n')
git('add','-A','docs/re-notes/seh-current-canonical-qualifier-20261025');git('diff','--cached','--check')
files=git('diff','--cached','--name-only').splitlines();assert files and all(p.startswith('docs/re-notes/seh-current-canonical-qualifier-20261025/') and not p.endswith('.wasm') for p in files)
print(git('commit','-m','test: repair current canonical Module qualification contract'))
commit=git('rev-parse','HEAD');print(git('push','-u','origin',BR))
remote=git('ls-remote','origin','refs/heads/'+BR).split()[0];assert remote==commit
(O/'publication-complete.json').write_text(json.dumps(dict(commit=commit,remoteBranch=BR,verifiedRemoteSHA=remote,files=len(files),mainMerged=False,binariesCommitted=False,strictSSHUnchanged=True),indent=2)+'\n')
print(json.dumps(dict(commit=commit,verifiedRemoteSHA=remote,branch=BR,files=len(files))))
