from work import *
import gzip
assert not (H/'guest-attempt.json').exists()
failure=json.load(open(H/'first-failure.json'));assert failure['guestAttempts']==0
dest=H/'repo/docs/re-notes/enigma-api-single-frame-startup-20261026';dest.mkdir(parents=True,exist_ok=True)
names=['first-failure.json','resource-ready.json','resource-precheckout.json','resource-prepared.json','resource-pretransfer.json','resource-failure-publication-before.json','resource-failure-publication-packaged.json','remote-rehash.json','precheckout-parser.json','preflight-api.json','tree-validation-api.json','sibling-resolution-api.json','standing-identities.json','standing-footprint.json','supervisor-identity.json','guest-args.json','next-env.json','capture-current.json','sqlite-baseline.json','sqlite-highwater.json','stage.log','recovery.md','session.json','guest-artifact-inventory.json']
for n in names:(dest/n).write_bytes((H/n).read_bytes())
for n in ['api-history.jsonl','transfer-receipts.json','capture-history.json','prior-recovered-capture.json']:(dest/(n+'.gz')).write_bytes(gzip.compress((H/n).read_bytes(),mtime=0))
for src,target in [('ops/cleanup-api.json','cleanup-api.json'),('ops/box-handback.json','box-handback.json'),('retained/preflight.json','preflight.json'),('retained/tree-validation.json.gz','tree-validation.json.gz')]:
 (dest/target).write_bytes((H/src).read_bytes())
recipes=dest/'recipes';recipes.mkdir(exist_ok=True)
for n in ['work.py','prepare.py','stage.py','stage-and-validate.py','launch.py','collect.py','package.py','preflight.py','validate-tree.cjs','supervise-original.py','supervise-transformed.py','supervise.py','capture.cjs']:
 if n.startswith('supervise'):
  (recipes/(n+'.gz')).write_bytes(gzip.compress((H/n).read_bytes(),mtime=0))
  if (recipes/n).exists():(recipes/n).unlink()
 else:(recipes/n).write_bytes((H/n).read_bytes())
root=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')
for n in ['enigma-api-single-frame-startup-oct26-dispatch.json','enigma-api-single-frame-startup-oct26.task.runtime.json','enigma-fresh-api-capture-inputs-oct26.json','enigma-capture-corrected-incremental-footprint-oct26.json','enigma-supervisor-output-coordinator-accept-oct24.json']:
 p=root/n
 (dest/n).write_bytes(p.read_bytes())
(dest/'root-ref-digest.json').write_bytes((root/'enigma-api-single-frame-startup-oct26/root-ref-digest.json').read_bytes())
manifest={str(p.relative_to(dest)):dict(bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in dest.rglob('*') if p.is_file() and p.name!='evidence-manifest.json'}
(dest/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('PACKAGED',len(manifest),'bounded evidence files; no PNG or guest')
