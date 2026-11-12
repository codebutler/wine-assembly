import pathlib,subprocess,os,json,time,resource,re,hashlib,shlex,shutil
R=pathlib.Path(__file__).parent;repo=R/'repo';E=repo/'docs/re-notes/enigma-quiet-filesystem-independent-20261024';donor=pathlib.Path('/tmp/enigma-quiet-filesystem-runner-oct24'); prior=pathlib.Path('/tmp/enigma-provider-complete-startup-oct24');sha=lambda b:hashlib.sha256(b).hexdigest()
# Verify prior command and immutable identities, without repeating provider/guest gates.
ident=json.loads((repo/'docs/re-notes/enigma-quiet-filesystem-20261024/input-identities.json').read_text());checked=[]
for i in ident:
 p=donor/'canonical'/i['path'] if i.get('kind')=='git' else pathlib.Path(i['path']);data=p.read_bytes();assert len(data)==i['bytes'] and sha(data)==i['sha256'];checked.append({'path':str(p),'sha256':sha(data),'bytes':len(data)})
old=json.loads((prior/'guest-args.json').read_text());base=repo/'docs/re-notes/enigma-quiet-filesystem-20261024';new=json.loads((base/'next-argv.json').read_text());expected=old[:2]+['--require=/tmp/enigma-quiet-filesystem-runner-oct24/repo/tools/enigma-quiet-filesystem.cjs','--require='+str(prior/'capture.cjs')]+old[3:];assert new==expected;assert shlex.split((base/'next-child-command.txt').read_text())==['env','-u','WINE_RUN_EXTRA_ARGS','-u','WINE_REGION_MAP','ENIGMA_RUNNER_ROOT='+str(prior/'runner'),'MAELSTROM_CAPTURE_INSTALL=1']+new
assert len(next(a for a in new if a.startswith('--dlls=')).split('=',1)[1].split(','))==8
assert json.loads((base/'next-env.json').read_text())=={'ENIGMA_RUNNER_ROOT':str(prior/'runner'),'MAELSTROM_CAPTURE_INSTALL':'1','remove':['WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP']}
# Exact historical transformation preserves every byte outside two diagnostic settings and prior API cap.
js="""const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');const adapter=require('./repo/tools/enigma-quiet-filesystem.cjs');const root='/tmp/enigma-provider-complete-startup-oct24';const original=fs.readFileSync('/tmp/enigma-quiet-filesystem-runner-oct24/canonical/test/run.js','utf8');let captured;const M={prototype:{_compile(s){captured=s;}}};vm.runInNewContext(fs.readFileSync(root+'/preload.cjs','utf8'),{__dirname:root,require(n){if(n==='module')return M;if(n==='./capture.cjs')return {};return require(n);}});M.prototype._compile(original,root+'/runner/test/run.js');assert.equal(adapter.transform(original),captured.split('_debugReadFile: TRACE_API,').join('_debugReadFile: false,'));console.log('exact historical transform equals original preload plus only both diagnostic substitutions');"""
(R/'differential.cjs').write_text(js)
def limits(): resource.setrlimit(resource.RLIMIT_CPU,(60,60))
def run(name,args,cwd,env):
 mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024;assert mem>=805306368
 t=time.monotonic();p=subprocess.run(args,cwd=cwd,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=60,preexec_fn=limits);assert len(p.stdout)<=32768;(E/(name+'.txt')).write_bytes(p.stdout);return {'name':name,'argv':args,'exit':p.returncode,'wall':time.monotonic()-t,'MemAvailable':mem,'outputBytes':len(p.stdout),'sha256':sha(p.stdout)}
env=dict(os.environ,ENIGMA_CANONICAL_RUNNER=str(donor/'canonical'));env.pop('ENIGMA_RUNNER_ROOT',None)
results=[run('producer-oracle',['node','--max-old-space-size=256','test/enigma-quiet-filesystem.test.cjs'],repo,env),run('exact-differential',['node','--max-old-space-size=256',str(R/'differential.cjs')],R,env)];assert all(x['exit']==0 for x in results)
fixture=R/'reject-fixture'
for name,target,change in [
 ('reject-one-context','test/run.js',lambda x:x.replace('_debugReadFile: TRACE_API && !QUIET_FS,','_debugReadFile: TRACE_API,',1)),
 ('reject-trace-lost','lib/filesystem.js',lambda x:x.replace("ctx._debugReadFile || (ctx.trace && ctx.trace.has && ctx.trace.has('fs'))","ctx._debugReadFile")),
 ('reject-api-cap','tools/enigma-quiet-filesystem.cjs',lambda x:x.replace('diagnosticRecords++ >= 16','diagnosticRecords++ >= 17'))]:
 for p in ['test/run.js','test/enigma-quiet-filesystem.test.cjs','tools/enigma-quiet-filesystem.cjs','lib/filesystem.js']:
  out=fixture/p;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes((repo/p).read_bytes())
 p=fixture/target;s=p.read_text();mut=change(s);assert mut!=s;p.write_text(mut)
 result=run(name,['node','--max-old-space-size=256','test/enigma-quiet-filesystem.test.cjs'],fixture,env);assert result['exit']!=0;results.append(result);shutil.rmtree(fixture)
# Trace mutation correctly fails source binding before behavior; identity pin is a meaningful rejection control.
(E/'independent-tests.json').write_text(json.dumps({'pass':True,'tests':results,'identities':checked,'argvExact':True,'eightProviders':True,'allOtherArgsByteExact':True,'environmentExact':True,'mountValidation':'no conditional guest; no mount executed','scope':'No guest/WASM/build; real filesystem and actual transformed source slices executed'},indent=2));print(json.dumps({'pass':True,'tests':[{k:t[k] for k in ['name','exit','wall']} for t in results]}))
