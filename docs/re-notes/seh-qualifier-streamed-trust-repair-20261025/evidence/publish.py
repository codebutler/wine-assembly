import pathlib,json,hashlib,subprocess,os
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';BR='task/seh-qualifier-streamed-trust-repair-oct25'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV={**os.environ,'GIT_SSH_COMMAND':SSH,'GIT_TERMINAL_PROMPT':'0'}
def git(*a):
 p=subprocess.run(['git','-C',str(R),*a],env=ENV,capture_output=True,timeout=45)
 assert len(p.stdout)+len(p.stderr)<=131072
 assert p.returncode==0,(a,p.returncode,p.stderr.decode()[:2000])
 return p.stdout.decode(),p.stderr.decode()
assert git('branch','--show-current')[0].strip()==BR
pins=git('ls-remote','origin','refs/heads/main','refs/heads/task/seh-current-canonical-qualifier-oct25','refs/heads/task/seh-canonical-qualifier-independent-integrate-oct25')[0]
for pin in ['a3fe340b962da3f31df249881074afe41d6c69a2','806117a11f1b347340b5cc44fb52b79d0ac200e5','6c4b06b8754989d6f91769cb3f1b8dd6b98ac32c']:assert pin in pins
for row in json.load(open(R/'docs/re-notes/seh-qualifier-streamed-trust-repair-20261025/evidence/seal.json')):
 p=R/row['path'];assert p.stat().st_size==row['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==row['sha256']
git('diff','--check')
git('add','docs/re-notes/seh-current-canonical-qualifier-20261025/README.md','docs/re-notes/seh-current-canonical-qualifier-20261025/qualify.cjs','docs/re-notes/seh-current-canonical-qualifier-20261025/test-trust-anchor.cjs','docs/re-notes/seh-qualifier-streamed-trust-repair-20261025')
git('diff','--cached','--check')
names=git('diff','--cached','--name-only')[0].splitlines()
assert names and all(n.startswith(('docs/re-notes/seh-current-canonical-qualifier-20261025/','docs/re-notes/seh-qualifier-streamed-trust-repair-20261025/')) and not n.endswith('.wasm') for n in names)
git('commit','-m','Authenticate canonical qualifier contract before supplied input reads')
commit=git('rev-parse','HEAD')[0].strip()
# Push only the assigned task branch; donors are already published.
push=git('-c','pack.threads=1','push','origin','HEAD:refs/heads/'+BR)
remote=git('ls-remote','origin','refs/heads/'+BR,'refs/heads/main')[0]
refs={line.split()[1]:line.split()[0] for line in remote.splitlines()}
assert refs['refs/heads/'+BR]==commit and refs['refs/heads/main']=='a3fe340b962da3f31df249881074afe41d6c69a2'
result=dict(commit=commit,remoteBranch=BR,verifiedRemoteRefs=remote,pushStdout=push[0],pushStderr=push[1],mainIntegrated=False)
(O/'publication-complete.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
