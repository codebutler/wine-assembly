from common import *
P=R/'docs/reviews'/H.name
for name,remaining in [('transform',['protocol','ambiguity','main reconciliation','merged checks','publication']),('protocol',['ambiguity','main reconciliation','merged checks','publication']),('ambiguity',['main reconciliation','merged checks','publication'])]:
 if (O/('checkpoint-'+name+'.json')).exists():
  print(name,'prior PASS retained; no replay',flush=True);continue
 gate(name)
 result=json.loads(run([NODE,'--max-old-space-size=192',str(P/'independent.cjs'),name],cwd=R))
 save(name+'-results.json',result)
 save('checkpoint-'+name+'.json',dict(candidate=REV,result=result,fixtures={'independent.cjs':sha((P/'independent.cjs').read_bytes()),'tracked-runner-slices.json':sha((R/'docs/reviews/enigma-uncertainty-independent-publication-oct26/tracked-runner-slices.json').read_bytes())},remaining=remaining,blockers=[]))
 print(name,result['checks'],'PASS',flush=True)
