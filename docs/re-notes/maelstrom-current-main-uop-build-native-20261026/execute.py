from stage import *
import sys
if sys.argv[1]=='stage':
 m=json.load(open(O/'current-manifest.json'));deps=[r for r in m['files'] if not r['path'].startswith('src/')]
 code='import pathlib,json,hashlib;R=pathlib.Path("/home/user/maelstrom-uop-canonical-native-qualification-oct26/canonical");rows='+repr(deps)+';'+ '\nfor r in rows:\n b=(R/r["path"]).read_bytes();assert len(b)==r["bytes"] and hashlib.sha256(b).hexdigest()==r["sha256"],r["path"]\nprint(json.dumps(dict(status="PASS",dependencies=rows)))'
 r=py(code,'standing-current-main-dependencies');(O/'standing-dependencies.json').write_text(r['stdout'])
 for n in ['sources.json.gz','current-manifest.json','runtime.json','remote-run.py']:put(O/n,REMOTE+'/ops/'+n)
 for p in list((R/'tools').glob('*.cjs'))+list((R/'test').glob('*.cjs')):put(p,REMOTE+'/repo/'+str(p.relative_to(R)))
 print('STAGED',flush=True)
elif sys.argv[1]=='startup':
 code='import resource,subprocess,json,os;env=dict(os.environ,MNE_CANONICAL_ROOT="/home/user/maelstrom-uop-canonical-native-qualification-oct26/canonical",MNE_STANDING='+repr(REMOTE+'/ops')+',MNE_ANCHORS="/home/user/maelstrom-uop-canonical-native-qualification-oct26/ops/anchors",PYTHONDONTWRITEBYTECODE="1",TMPDIR='+repr(REMOTE+'/ops')+');env.pop("NODE_OPTIONS",None)\ndef limits():\n resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))\np=subprocess.run(["/home/user/.nvm/versions/node/v24.22.1/bin/node","--max-old-space-size=512","--require","/home/user/maelstrom-uop-canonical-native-qualification-oct26/ops/native-module-bound.cjs","-e",\'console.log(JSON.stringify({exec:process.execPath,flags:process.execArgv,limits:require("fs").readFileSync("/proc/self/limits","utf8"),environment:process.env,started:true}))\'],env=env,preexec_fn=limits,capture_output=True,text=True,timeout=30);assert p.returncode==0,p.stderr;d=json.loads(p.stdout);d["environment"]={k:env[k] for k in ["MNE_CANONICAL_ROOT","MNE_STANDING","MNE_ANCHORS","TMPDIR","PYTHONDONTWRITEBYTECODE"]};print(json.dumps(d))'
 r=py(code,'exact-node-startup');(O/'node-startup.json').write_text(r['stdout']);print('STARTUP PASS')
elif sys.argv[1]=='preflight':
 cmd=['python3',REMOTE+'/ops/remote-run.py','preflight','source-preflight','/home/user/.nvm/versions/node/v24.22.1/bin/node','--max-old-space-size=512','--require','/home/user/maelstrom-uop-canonical-native-qualification-oct26/ops/native-module-bound.cjs',REMOTE+'/repo/tools/maelstrom-diagnostic-canonical-build.cjs','--preflight']
 try:r=call(cmd,'source-preflight',65);print(r['stdout'])
 except Exception:
  for ext in ['stdout','stderr']:
   r=py('import pathlib;print(pathlib.Path('+repr(REMOTE+'/ops/source-preflight.'+ext)+').read_text())','first-failure-'+ext);(O/('source-preflight.'+ext)).write_text(r['stdout']);print(r['stdout'][:8192])
  raise
