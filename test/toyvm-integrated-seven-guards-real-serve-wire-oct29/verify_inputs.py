"""Verify immutable task inputs before importing or executing any backend."""
import hashlib,json,pathlib,sys
TASK=pathlib.Path('/tmp/toyvm-integrated-seven-guards-real-serve-wire-oct29')
REPO=TASK/'repo'
OUT=REPO/'test/toyvm-integrated-seven-guards-real-serve-wire-oct29'
DISPATCH=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-integrated-seven-guards-real-serve-wire-oct29-dispatch.json')
def pin(p):
 b=p.read_bytes();return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def verify():
 assert sys.executable=='/usr/bin/python3'
 assert pathlib.Path.cwd().resolve()==REPO
 d=json.loads(DISPATCH.read_text())
 for key in ('taskSupervisor','limitModule','pythonExecutable'):
  assert pin(pathlib.Path(d[key]))==d[key+'Pin'],key
 assert pin(pathlib.Path(d['canonicalReceipt']))==d['canonicalReceiptPin']
 c=json.loads(pathlib.Path(d['canonicalReceipt']).read_text())
 assert c['commit']==d['candidate']
 for n,p in d['sourcePins'].items():assert pin(REPO/n)==p,n
 inherited=json.loads((TASK/'inputs/integration-tests/provenance.json').read_text())
 receipt=TASK/'inputs/final-epoll-receipt.json'
 assert pin(receipt)==inherited['canonicalReceiptPin']
 f=json.loads(receipt.read_text())
 assert f['commit']==inherited['independentAcceptance']
 assert f['sourcePinsAfter']==d['sourcePins']
 verified={}
 for n,p in f['artifacts'].items():
  local=TASK/'inputs/final-epoll-acceptance'/pathlib.Path(n).name
  assert pin(local)==p,n
  verified[str(local.relative_to(TASK))]=p
 result=dict(status='PASS',baseline=d['candidate'],sourcePins=d['sourcePins'],
  canonicalReceipt=d['canonicalReceiptPin'],retainedReceipt=pin(receipt),
  retainedCommit=f['commit'],verifiedArtifacts=verified,
  launchConfiguration=dict(SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes',
   mountArgv=[],intendedMountFiles=[],mountValidation='not applicable: no checkout or mount execution; exact born-repository identity verified by git-identity'))
 OUT.mkdir(parents=True,exist_ok=True)
 (OUT/'input-verification.json').write_text(json.dumps(result,indent=2)+'\n')
 return result
if __name__=='__main__':verify();print('PASS immutable source and supplied artifact pins')
