import hashlib,json,shutil,subprocess,time
from pathlib import Path
H=Path(__file__).parent;R=H.parent/'repo';E=R/'docs/reviews/enigma-staging-mode-preservation-repair-oct26'
ns={};exec(compile((H/'push-only.py').read_text().split("assert run('rev-parse'")[0],str(H/'push-only.py'),'exec'),dict(__file__=str(H/'push-only.py')),ns)
# Functions resolve globals in exec's global dict: use a single shared namespace.
ns={'__file__':str(H/'push-only.py')};exec(compile((H/'push-only.py').read_text().split("assert run('rev-parse'")[0],str(H/'push-only.py'),'exec'),ns)
run=ns['run'];source='8752981b212e416250a5655e65c98d3697cb60d5'
assert run('rev-parse','HEAD')==source
shutil.copyfile(H/'closeout.py',E/'closeout.py')
manifest=json.loads((E/'evidence-manifest.json').read_text())
p=E/'closeout.py';manifest[str(p.relative_to(R))]=dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
(E/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
run('add','--',str(E.relative_to(R)))
changed=run('diff','--cached','--name-only').splitlines()
assert changed and all(p.startswith(str(E.relative_to(R))+'/') for p in changed)
run('diff','--cached','--check')
run('commit','-qm','Record Enigma permission repair publication and resource evidence')
commit=run('rev-parse','HEAD')
assert not run('status','--porcelain')
for path,digest in json.loads((H/'checkpoint.json').read_text())['sources'].items():
 assert hashlib.sha256((R/path).read_bytes()).hexdigest()==digest
 assert not run('diff',source,'HEAD','--',path)
# Verify all published evidence against exact committed blobs, without captures.
for path,expected in manifest.items():
 digest=hashlib.sha256();p=subprocess.Popen(['git','-C',str(R),'show',commit+':'+path],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
 size=0
 while b:=p.stdout.read(8192):digest.update(b);size+=len(b)
 p.stdout.close();assert p.wait(timeout=60)==0
 assert digest.hexdigest()==expected['sha256'] and size==expected['bytes']
j=json.loads((H/'source-publication.json').read_text());j.update(commit=commit,sourceCommit=source,tree=run('rev-parse','HEAD^{tree}'),changed=changed,verified=False,evidencePayloads=len(manifest),allCommittedPayloadsRehashed=True,time=time.time(),docsOnlyAfterTests=True)
(H/'commit.json').write_text(json.dumps(j,indent=2)+'\n')
print(json.dumps(dict(commit=commit,sourceCommit=source,evidencePayloads=len(manifest),docsOnly=True)),flush=True)
subprocess.run(['python3','-B',str(H/'push-only.py')],check=True,timeout=140)
