import json,pathlib,hashlib,shutil
root=pathlib.Path('/tmp/gta2-accepted-raw-exit-main-integrate-oct27');r=json.loads((root/'ops/readiness.json').read_text());total=0;result={}
for name,pin in r['pins'].items():
 p=pathlib.Path(pin['path']);b=p.read_bytes();assert len(b)==pin['bytes'];assert hashlib.sha256(b).hexdigest()==pin['sha256'];assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==pin['gitBlob']
 d=root/'repo'/name;d.parent.mkdir(parents=True,exist_ok=True);d.write_bytes(b);total+=len(b);result[name]=pin
assert total<=r['incrementalSourceCap'];(root/'repo/.git/info/sparse-checkout').write_text(''.join('/'+p+'\n' for p in r['pins'])+'/reports/gta2-accepted-raw-exit-main-integrate-oct27/\n')
(root/'ops/materialization.json').write_text(json.dumps({'total':total,'pins':result},indent=2)+'\n');print('verified',len(result),'pins',total,'bytes')
