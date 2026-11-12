import sys,pathlib,json,subprocess,hashlib,os
import guard as g
B=g.B
# Conservative complete private peak covers focused inputs, Git/index, tests,
# generated tiny modules, evidence and publication; installed/donor bytes standing.
g.write(B/'admission.json',{'privatePeak':8388608,'futureGrowth':16777216,'reserve':8388608,'basis':'focused source task; no full compiler module/guest'})
s=g.sample(); old=g.CAP;g.CAP=s['captureBytes']+32
sent=B/'sentinel-MUST-NOT-EXIST'
try:
 g.run([sys.executable,'-c',"import os,pathlib;os.write(1,b'x'*64);__import__('time').sleep(1);pathlib.Path("+repr(str(sent))+").touch()"],phase='python')
 raise RuntimeError('control unexpectedly passed')
except RuntimeError as e:
 assert 'capture guard' in str(e),str(e)
 assert not sent.exists()
g.CAP=old
g.write(B/'guard-control.json',{'rejected':True,'sentinelAbsent':not sent.exists(),'budget':32,'retained':'execution.jsonl'})
donor='/tmp/d3d-scoped-native-qualification-oct23/repo';rev='5406777ecbcef9cf9b03b40d592d722bb0086de0'
paths=['src/09ab-handlers-d3dim-core.wat','lib/d3dim-gpu.js','tools/watx.js']+['tools/watx-src/'+n for n in ['compiler-parser.js','compiler-stages.js','compiler-codegen.js','compiler.js','PROVENANCE.md','CHANGELOG.md']]
paths+=['test/test-d3dim-gpu-batching.js','test/test-d3dim-gpu-points.js','test/test-tiers.js']
rows=[]
for p in paths:
 r=subprocess.run(['git','-C',donor,'show',rev+':'+p],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if r.returncode:
  print('absent optional',p);continue
 b=r.stdout;assert len(b)<g.FILE
 blob=subprocess.check_output(['git','-C',donor,'rev-parse',rev+':'+p],text=True).strip()
 rows.append({'path':p,'blob':blob,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
 if p=='lib/d3dim-gpu.js': print(b.decode()[:3500]); print('GPU require lines',*[l for l in b.decode().splitlines() if 'require(' in l])
 if p.startswith('test/'):print(p, b.decode()[:1900])
node=pathlib.Path('/usr/local/bin/node').resolve()
receipt={'revision':rev,'donor':donor,'files':rows,'selectedBytes':sum(r['bytes'] for r in rows),'node':{'path':str(node),'bytes':node.stat().st_size,'sha256':hashlib.sha256(node.read_bytes()).hexdigest(),'version':subprocess.check_output([str(node),'--version'],text=True).strip()},'compilerDependencies':'tools/watx.js -> four explicit compiler stages; built-in Node only','limits':{'nodeHeapMiB':256,'cpuWallSeconds':60,'memoryMinimum':805306368,'pythonWallSeconds':60,'captureLimit':524288,'perFile':25165824}}
g.write(B/'focused-manifest.json',receipt)
s=g.sample();remaining=max(0,8388608-s['privateBytes'])+16777216+8388608
assert s['measuredNew']+remaining<=g.LIMIT
assert s['hostFree']-remaining>=2982150144
g.write(B/'first-admission.json',{'measured':s,'projectedNew':s['measuredNew']+remaining,'hostAfter':s['hostFree']-remaining,'PASS':True})
print(json.dumps({'files':len(rows),'bytes':receipt['selectedBytes'],'projectedNew':s['measuredNew']+remaining,'hostAfter':s['hostFree']-remaining,'control':'PASS'}))
