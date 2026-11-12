import sys,os,json,subprocess
sys.dont_write_bytecode=True
import manage as a
pins=json.loads((a.O/'configuration.json').read_text())['pins']
env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1');env.pop('PYTHONPATH',None)
rows=[]
for script,count in [('test_controller.py',3),('test_process_owner.py',1)]:
 out=a.O/('affected-'+script.removesuffix('.py'))
 argv=[sys.executable,'-B',str(a.R/'test/fixtures/alien-menu-controller'/script),str(out)]
 r=subprocess.run(argv,env=env,capture_output=True,text=True,timeout=30)
 row=dict(argv=argv,exit=r.returncode,stdout=r.stdout,stderr=r.stderr,expectedMethods=count,fixtureClockHookPresent=False)
 rows.append(row);a.save('affected-progress.json',rows)
 assert r.returncode==0,(script,r.stdout,r.stderr)
 assert ('Ran %d test'%count) in r.stderr and 'OK' in r.stderr
 assert {p:a.sha(a.R/p) for p in pins}==pins
a.save('affected-result.json',dict(status='PASS',methods=4,groups=rows,reason='Merged-tree optional fixture clock hook absent; production legacy retired entry and inherited-descriptor rejection both preserved',newSupervisorAcceptanceChain=False))
a.checkpoint('affected-legacy-checks',testedCodeTree=json.loads((a.O/'tested-tree.json').read_text())['testedCodeTree'],completedChecks=['syntax/closure','190 accepted published payloads','four affected legacy tests'],remaining=['Git exact staged scope/blob validation','task/main publication'])
print('PASS four affected merged-tree legacy tests; no new supervisor group replay')
