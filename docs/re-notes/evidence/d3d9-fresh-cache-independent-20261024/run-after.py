import subprocess,pathlib,json,time,resource,os
P=pathlib.Path(__file__).parent; R=P/'repo'; E=R/'docs/re-notes/evidence/d3d9-fresh-cache-independent-20261024'; E.mkdir(parents=True,exist_ok=True)
checks=[('independent',['test/test-d3d9-clear-independent-review.js'],0),('probe',['test/test-d3d9-clear-independent-review.js','--probe'],0),('baseline',['test/test-d3d9-clear-independent-review.js','--probe','--baseline'],1),('focused-cache',['test/test-d3d9-clear-depth-cache.js'],0),('reverting',['test/test-d3d9-clear-depth-cache.js','--mutation'],1),('fresh-target-after',['test/test-d3d9-clear-fresh-target-independent.js'],0),('existing-target-control',['test/test-d3d9-clear-fresh-target-independent.js','--existing-target'],0),('cold-cache-control',['test/test-d3d9-clear-fresh-target-independent.js','--cold-cache'],0)]
prior=E/'tests.json'
results=json.loads(prior.read_text()) if prior.exists() else []
checks += [('new-regression',['test/test-d3d9-clear-fresh-target-cache.js'],0),('revert-named',['test/test-d3d9-clear-fresh-target-cache.js','--revert'],1),('revert-implicit',['test/test-d3d9-clear-fresh-target-cache.js','--implicit-only','--revert'],1)]
for name,args,expected in checks:
 mem=int(next(s.split()[1] for s in open('/proc/meminfo') if s.startswith('MemAvailable:')))*1024
 assert mem>=805306368
 def limits():resource.setrlimit(resource.RLIMIT_CPU,(60,60))
 t=time.time();r=subprocess.run(['timeout','60s','node','--max-old-space-size=256',*args],cwd=R,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,preexec_fn=limits)
 log=E/(name+'.log');
 if log.exists(): log=E/(name+'-repeat.log')
 log.write_bytes(r.stdout)
 results.append({'name':name,'args':args,'expected_exit':expected,'exit':r.returncode,'seconds':time.time()-t,'mem_available':mem,'bytes':len(r.stdout)})
 (E/'tests.json').write_text(json.dumps(results,indent=2)+'\n')
 assert r.returncode==expected,(name,r.stdout.decode())
print(json.dumps(results,indent=2));(E/'tests.json').write_text(json.dumps(results,indent=2)+'\n')
