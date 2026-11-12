import pathlib,json,subprocess,os,time
root=pathlib.Path('/tmp/gta2-accepted-raw-exit-main-integrate-oct27');ops=root/'ops';node='/home/user/.nvm/versions/node/v24.18.1/bin/node';pool='/home/user/wine-assembly/scratch/usage-watch/light-execution-pool-oct26.py'
s=json.loads((ops/'node-startup.stdout').read_text());assert s['execPath']==node and s['execArgv']==['--max-old-space-size=512']
for label in ['Max data size','Max address space']:
 line=next(l for l in s['limits'].splitlines() if l.startswith(label));assert 'unlimited            unlimited' in line,line
checks=[('syntax-runner',['--check',str(root/'repo/test/run.js')]),('syntax-fixture',['--check',str(root/'repo/test/test-api-exit-observer.js')]),('production-boundary',[str(root/'repo/test/test-api-exit-observer.js'),'--repro-only']),('full-api-exit-fixture',[str(root/'repo/test/test-api-exit-observer.js')]),('independent-causal',[str(ops/'independent-boundaries.js'),'--causal-only']),('independent-remaining',[str(ops/'independent-boundaries.js'),'--remaining']),('typed-pointer',[str(ops/'typed-pointer.js')]),('airstrike-cross-regression',[str(root/'repo/test/test-input-consumption-state.js')])]
completed=[]
for name,args in checks:
 r=subprocess.run(['python3',pool,'--slots','1','--','python3',str(ops/'run.py'),name,'node',str(root/'repo'),node,'--max-old-space-size=512',*args]);assert r.returncode==0,name
 result=json.loads((ops/(name+'.json')).read_text());completed.append({'name':name,'result':result})
 temp=ops/'checkpoint.tmp';temp.write_text(json.dumps({'candidate':'e99799cd80087eddcd574a58a7062d354fc4d050','main':'03d86580a73a3e53184671fc4e272f8eb1d74887','pins':json.loads((ops/'readiness.json').read_text())['pins'],'completed':completed,'remaining':[n for n,_ in checks[len(completed):]],'blockers':[]},indent=2)+'\n');os.replace(temp,ops/'checkpoint.json')
 print(name+' PASS',flush=True)
