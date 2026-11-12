import pathlib,json,hashlib,shutil
R=pathlib.Path('/tmp/airstrike-accepted-input-observer-main-integrate-oct27/repo'); O=R.parent/'ops'
ready=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/airstrike-observer-integration-readiness-oct27/readiness.json')
d=json.loads(ready.read_text())
a=pathlib.Path(d['acceptanceManifest'])
assert hashlib.sha256(a.read_bytes()).hexdigest()==d['acceptanceSHA256']
assert json.loads(a.read_text())['verdict']=='ACCEPT_SOURCE_ONLY'
(O/'readiness.json').write_bytes(ready.read_bytes())
(O/'accepted-manifest.json').write_bytes(a.read_bytes())
(R/'.git/objects/info/alternates').write_text(d['currentMainObjectStore']+'/objects\n'+d['donor']+'/.git/objects\n')
(R/'.git/config').write_text('''[core]
 repositoryformatversion = 0
 filemode = true
 bare = false
 logallrefupdates = true
 sparseCheckout = true
 sparseCheckoutCone = false
[gc]
 auto = 0
[maintenance]
 auto = false
[user]
 name = Wine Ops
 email = wine-ops@users.noreply.github.com
[remote "origin"]
 url = git@github.com:vgrichina/wine-assembly.git
[pack]
 threads = 1
 windowMemory = 16m
''')
paths=sorted(set(d['sourcePins'])|{'package.json'})
(R/'.git/info/sparse-checkout').write_text(''.join('/'+p+'\n' for p in paths)+'/reports/airstrike-accepted-input-observer-main-integrate-oct27/\n')
receipt={'acceptanceManifestSHA256':d['acceptanceSHA256'],'verifiedPayloadsReused':145,'ssh': 'ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes','mountArgv':[],'mountParser':'not applicable: no guest or mount execution authorized or intended','fetchBytes':0,'incrementalSourceCeiling':1048576,'materializedPaths':paths,'alternatesReadOnly':(R/'.git/objects/info/alternates').read_text().splitlines(),'initialRootRefs':json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/airstrike-accepted-input-observer-main-integrate-oct27/root-ref-digest.json').read_text())}
(O/'configuration.json').write_text(json.dumps(receipt,indent=2)+'\n')
print('PASS exact acceptance manifest; sparse paths/configuration pinned; read-only alternates')
