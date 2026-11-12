from common import *
import zlib
rows=g('ls-tree','-r','-t',REV).decode().splitlines()
paths=['tools/enigma-presented-menu-controller.cjs','test/test-enigma-presented-menu-controller.cjs','test/fixtures/enigma-presented-menu-contract.json','docs/re-notes/enigma-start-game-menu-click-api-oct26/predecessor-menu.png']
objects=[]
for l in rows:
 head,p=l.split('\t');mode,kind,oid=head.split()
 if kind=='tree' or p in paths or p.startswith('docs/reviews/enigma-atomic-presented-click-repair-oct26/') or p.startswith('docs/reviews/enigma-atomic-click-independent-accept-oct26/'):
  objects.append((oid,kind))
for oid,kind in objects:
 b=g('cat-file',kind,oid);raw=(kind+' '+str(len(b))+'\0').encode()+b;assert hashlib.sha1(raw).hexdigest()==oid
 p=R/'.git/objects'/oid[:2]/oid[2:];p.parent.mkdir(exist_ok=True);p.write_bytes(zlib.compress(raw))
(R/'.git/objects/info/alternates').unlink();(R/'.git/shallow').write_text(REV+'\n')
for k,v in [('core.sparseCheckout','true'),('core.sparseCheckoutCone','false'),('core.sshCommand',SSH),('user.name','Wine Ops'),('user.email','wine-ops@local')]:g('config',k,v)
(R/'.git/info/sparse-checkout').write_text('\n'.join('/'+p for p in paths)+'\n/docs/reviews/enigma-atomic-presented-click-repair-oct26/\n/docs/reviews/enigma-atomic-click-independent-accept-oct26/\n/docs/reviews/'+H.name+'/\n')
g('update-ref','refs/heads/'+BR,REV);g('symbolic-ref','HEAD','refs/heads/'+BR);g('read-tree','-mu','HEAD');g('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
save('checkout.json',dict(candidate=REV,paths=paths,tree=g('rev-parse','HEAD^{tree}').decode().strip(),hashes={p:sha((R/p).read_bytes()) for p in paths}))
f=open(O/'board-watch.log','ab');p=subprocess.Popen(['tail','-n','0','-f',str(ROOT/'messageboard.txt')],stdout=f,stderr=f,start_new_session=True);f.close();save('watcher.json',dict(pid=p.pid))
gate('checkout')
print('SETUP PASS')
