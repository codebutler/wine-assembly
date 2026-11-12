import subprocess,pathlib,json,time,resource,os
P=pathlib.Path(__file__).parent; R=P/'repo'; E=R/'docs/re-notes/evidence/d3d9-fresh-target-cache-repair-20261024'; E.mkdir(parents=True,exist_ok=True)
checks=[('new-regression-final',['test/test-d3d9-clear-fresh-target-cache.js'],0),('syntax-backend',['--check','lib/gpu-backend.js'],0),('syntax-regression',['--check','test/test-d3d9-clear-fresh-target-cache.js'],0)]
prior=E/'tests.json'
results=json.loads(prior.read_text()) if prior.exists() else []
for name,args,expected in checks:
 mem=int(next(s.split()[1] for s in open('/proc/meminfo') if s.startswith('MemAvailable:')))*1024
 assert mem>=805306368
 def limits():resource.setrlimit(resource.RLIMIT_CPU,(60,60))
 t=time.time();r=subprocess.run(['timeout','60s','node','--max-old-space-size=256',*args],env={**os.environ,'WINE_CLEAR_COMPILER':'/tmp/legacy-texture-disable-independent-integrate-oct24/repo/tools/watx.js'},cwd=R,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,preexec_fn=limits)
 log=E/(name+'.log');
 if log.exists(): log=E/(name+'-repeat.log')
 log.write_bytes(r.stdout)
 results.append({'name':name,'args':args,'expected_exit':expected,'exit':r.returncode,'seconds':time.time()-t,'mem_available':mem,'bytes':len(r.stdout)})
 (E/'tests.json').write_text(json.dumps(results,indent=2)+'\n')
 assert r.returncode==expected,(name,r.stdout.decode())
print('checks completed: '+str(len(checks))+'; results retained in tests.json');(E/'tests.json').write_text(json.dumps(results,indent=2)+'\n')
