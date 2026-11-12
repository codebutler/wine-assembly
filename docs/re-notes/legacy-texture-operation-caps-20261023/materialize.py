import guard as g,json,pathlib,os,subprocess
B=g.B;R=B/'repo';m=json.loads((B/'focused-manifest.json').read_text())
assert m['selectedBytes']<2000000
s=g.sample();remaining=max(0,8388608-s['privateBytes'])+16777216+8388608
assert s['measuredNew']+remaining<=g.LIMIT and s['hostFree']-remaining>=2982150144
g.write(B/'complete-admission.json',{'manifest':m,'projection':s['measuredNew']+remaining,'hostAfter':s['hostFree']-remaining,'privatePeak':8388608,'futureGrowth':16777216,'reserve':8388608,'PASS':True})
g.run(['git','clone','--shared','--no-checkout',m['donor'],str(R)],phase='python')
g.run(['git','-C',str(R),'config','core.sparseCheckout','true'],phase='python')
g.run(['git','-C',str(R),'config','core.sparseCheckoutCone','false'],phase='python')
(R/'.git/info/sparse-checkout').write_text(''.join('/'+r['path']+'\n' for r in m['files']))
g.run(['git','-C',str(R),'checkout','-b','task/legacy-texture-operation-caps-oct23',m['revision']],phase='python')
for row in m['files']:
 import hashlib
 assert hashlib.sha256((R/row['path']).read_bytes()).hexdigest()==row['sha256']
print('focused checkout verified',len(m['files']),m['selectedBytes'])
