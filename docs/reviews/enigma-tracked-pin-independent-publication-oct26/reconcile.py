from common import *
import zlib
P=R/'docs/reviews'/H.name
gate('reconcile')
remote=g('ls-remote','origin','refs/heads/main').decode().strip();main=remote.split()[0]
# Read-only local main object store; copy only commit and tree metadata, plus
# affected accepted files. No full ref listing, root changes or unbounded fetch.
(R/'.git/objects/info/alternates').write_text(str(ROOT/'.git/objects')+'\n'+str(D/'.git/objects')+'\n')
# The exact remote main was absent in local immutable stores (first failure
# retained). Fetch only a shallow filtered commit/tree closure in own repository.
(R/'.git/objects/info/alternates').unlink()
g('fetch','--no-tags','--depth=1','--filter=blob:none','origin','refs/heads/main:refs/remotes/origin/main')
assert g('rev-parse','refs/remotes/origin/main').decode().strip()==main
assert g('cat-file','-t',main).decode().strip()=='commit'
(R/'.git/objects/info/alternates').write_text(str(ROOT/'.git/objects')+'\n'+str(D/'.git/objects')+'\n')
rows=g('ls-tree','-r','-t',main).decode().splitlines()
objects=[(main,'commit'),(g('rev-parse',main+'^{tree}').decode().strip(),'tree')]
for line in rows:
 head,p=line.split('\t');mode,kind,oid=head.split()
 if kind=='tree':objects.append((oid,kind))
for oid,kind in objects:
 b=g('cat-file',kind,oid);raw=(kind+' '+str(len(b))+'\0').encode()+b
 assert hashlib.sha1(raw).hexdigest()==oid
 p=R/'.git/objects'/oid[:2]/oid[2:];p.parent.mkdir(exist_ok=True);p.write_bytes(zlib.compress(raw))
runner=g('show',main+':test/run.js');assert sha(runner)=='87ab63d768eb59a09a8b69df2ccb3843270dd867a67405abd82f02c25c1628e7'
# Stage exact accepted runner object as an unchanged, explicitly sparse file for
# merged transformation checks only. Materialized bytes count in own allocation.
oid=g('hash-object','-w','--stdin',input=runner).decode().strip();assert oid=='4b8461338f4bcddde6b5d5504991523b28d3ac35'
changes=g('diff-tree','--no-commit-id','--name-status','-r',main,REV).decode().splitlines()
save('main-reconciliation-inventory.json',dict(main=main,remote=remote,candidate=REV,runnerBlob=oid,runnerSHA256=sha(runner),diff=changes,treeMetadataObjectsCopied=len(objects)))
(R/'.git/objects/info/alternates').unlink()
print(json.dumps(dict(main=main,changes=changes),indent=2))
