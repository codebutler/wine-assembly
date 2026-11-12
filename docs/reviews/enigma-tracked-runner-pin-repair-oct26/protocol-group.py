from common import *
P=R/'docs/reviews'/H.name
gate('protocol')
for name in ['runner-guards','protocol']:
 result=json.loads(run([NODE,'--max-old-space-size=192',str(P/(name+'.cjs'))],cwd=R));save(name+'-results.json',result)
 save('checkpoint-'+name+'.json',dict(base=REV,controllerSHA256=sha((R/'tools/enigma-presented-menu-controller.cjs').read_bytes()),fixtures={p.name:sha(p.read_bytes()) for p in P.glob('*.cjs')},runnerSHA256='87ab63d768eb59a09a8b69df2ccb3843270dd867a67405abd82f02c25c1628e7',results=result,remaining=['publication','fresh independent acceptance before MAIN/runtime'],reused=[25,45,24,9,10,20]))
 print(name,'PASS')
