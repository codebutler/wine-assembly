import pathlib,json,subprocess,hashlib,os
root=pathlib.Path('/tmp/maelstrom-select-recovered-completion-hook-oct24'); repo=root/'repo'; ops=root/'ops'
donor=pathlib.Path('/tmp/maelstrom-select-inertness-independent-closeout-oct24')
revision='0cd1121b01300ae157dd5af3580a4cf132865fdb'; tree='aafaaf80324f955ff5aaa93d1c2dc84aa43964c3'
def run(*args,cwd=None): return subprocess.check_output(args,cwd=cwd,text=True).strip()
assert run('git','rev-parse',revision+'^{tree}',cwd=donor/'repo')==tree
selected=['docs/re-notes/maelstrom-select-lifecycle-observer-20261024.md','docs/re-notes/maelstrom-select-inertness-independent-closeout-20261024.md','docs/re-notes/maelstrom-select-lifecycle-observer-20261024-evidence/source-identity.json']
pins={ '/tmp/maelstrom-head-yield-observer-oct24/ops/run.js':'4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809','/tmp/maelstrom-head-yield-observer-oct24/ops/13-exports.wat':'739397dc54a77e93b367334fd4ca96c921180f57a7558913a3301f1de4520b86','/tmp/maelstrom-event-triggered-boundary-observer-oct24/ops/thread-manager.js':'f0a2f006b0eb992bcdb904f10128167b06bfe143ac05661b82f9586d9755bf40'}
for p,h in pins.items(): assert hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()==h,p

blobs={p:run('git','rev-parse',revision+':'+p,cwd=donor/'repo') for p in selected}
receipt=json.loads((donor/'ops/checkout.json').read_text()); order=receipt['order']+[str(donor/'repo/.git/objects')]
assert len(order)==len(set(order))
for p in order: assert pathlib.Path(p).is_dir(),p
repo.mkdir();run('git','init','-q',str(repo))
(repo/'.git/objects/info/alternates').write_text('\n'.join(order)+'\n')
run('git','config','core.sparseCheckout','true',cwd=repo)
(repo/'.git/info/sparse-checkout').write_text('\n'.join('/'+p for p in selected)+'\n')
run('git','update-ref','refs/heads/task/maelstrom-select-recovered-completion-hook-oct24',revision,cwd=repo)
run('git','symbolic-ref','HEAD','refs/heads/task/maelstrom-select-recovered-completion-hook-oct24',cwd=repo)
run('git','read-tree','-mu','HEAD',cwd=repo)
assert run('git','rev-parse','HEAD^{tree}',cwd=repo)==tree
for p,b in blobs.items(): assert run('git','hash-object',p,cwd=repo)==b,p
remote=run('git','remote','get-url','origin',cwd=donor/'repo');run('git','remote','add','origin',remote,cwd=repo)
for key in ['user.name','user.email']:
 run('git','config',key,run('git','config',key,cwd=donor/'repo'),cwd=repo)
out={'configurationReceiptReused':str(donor/'ops/checkout.json'),'noRuntimeMounts':True,'revision':revision,'tree':tree,'selected':selected,'blobs':blobs,'pins':pins,'order':order,'donorReceipts':[str(donor/'ops/checkout.json'),str(donor/'ops/standing-object-stores.json')],'mountArgv':[],'mountFiles':[],'ssh':os.environ['GIT_SSH_COMMAND'],'fetch':False,'copies':False}
(ops/'checkout.json').write_text(json.dumps(out,indent=2));print(json.dumps({'verifiedRevision':revision,'tree':tree,'paths':len(selected),'pins':len(pins),'stores':len(order)}))
