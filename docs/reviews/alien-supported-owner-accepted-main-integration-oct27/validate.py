import sys
sys.dont_write_bytecode=True
import ast,json,hashlib,importlib.util,resource
from pathlib import Path
import manage as a
cfg=json.loads((a.O/'configuration.json').read_text());pins=cfg['pins']
tested=json.loads((a.O/'tested-tree.json').read_text())
assert {p:a.sha(a.R/p) for p in pins}==pins
assert {p:a.sha(a.DONOR/p) for p in pins}==pins
imports={}
for p in pins:
 raw=(a.R/p).read_bytes();node=ast.parse(raw,filename=p);compile(node,p,'exec')
 mods=sorted({n.name.split('.')[0] for x in ast.walk(node) if isinstance(x,ast.Import) for n in x.names}|{x.module.split('.')[0] for x in ast.walk(node) if isinstance(x,ast.ImportFrom) and x.module})
 assert set(mods)<=sys.stdlib_module_names,(p,mods)
 imports[p]=mods
# The complete production local closure consists of these four exact files.
closure=['tools/alien-supervised-gameplay.py','tools/alien-menu-gameplay-controller.py','test/alien-gameplay-sequence.py','test/helpers/alien-control-sequence.py']
for p,literal in [(closure[0],'alien-menu-gameplay-controller.py'),(closure[1],'test/alien-gameplay-sequence.py'),(closure[2],'helpers/alien-control-sequence.py')]:
 assert literal in (a.R/p).read_text()
spec=importlib.util.spec_from_file_location('merged_alien_supervisor',a.R/closure[0]);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
assert Path(module.menu.__file__).resolve()==a.R/closure[1]
assert Path(module.menu.sequence.__file__).resolve()==a.R/closure[2]
assert Path(module.menu.control.__file__).resolve()==a.R/closure[3]
assert callable(module.launch) and callable(module.menu._run_owned)
published=a.DONOR/'docs/reviews/alien-supported-owner-acceptance-publication-oct27'
manifest=json.loads((published/'manifest.json').read_text())
for p,v in manifest.items():
 target=published/p
 assert target.stat().st_size==v['bytes'] and a.sha(target)==v['sha256'],str(target)
for filename in ('boundary-result.json','boundary-execution.json','reuse-verification.json','configuration.json','accept.py'):
 assert a.sha(published/filename)==a.sha(a.DOPS/filename),filename
boundary=json.loads((a.DOPS/'boundary-result.json').read_text())
execution=json.loads((a.DOPS/'boundary-execution.json').read_text())
assert boundary['verdict']=='PASS' and boundary['productionUnchanged'] and not boundary['exactHistoricalScriptPassed']
assert boundary['candidate']==a.SOURCE and boundary['tree']==tested['sourceTree']
assert execution['exit']==0 and execution['stopReason'] is None and execution['cleanupComplete'] and execution['peakRSS']<128*a.MiB
reuse=json.loads((a.DOPS/'reuse-verification.json').read_text())
assert reuse['groupsReused']==['live','uncertain','new-and-death','timeout']
assert (reuse['focused'],reuse['transport'],reuse['unaffected'])==(13,8,24)
prior=Path('/tmp/alien-supervisor-owned-independent-accept-oct27/ops')
assert a.sha(prior/'evidence-manifest.json')==reuse['opsManifestSHA']
assert a.sha(prior/'inherited-alternate-listener.py')==reuse['originalHistoricalScriptSHA']
assert reuse['historicalUnchangedSetupFailurePreserved']
references={str(p):dict(bytes=p.stat().st_size,sha256=a.sha(p)) for p in [a.DOPS/n for n in ('result.json','checkpoint.json','final-manifest.json','boundary-result.json','boundary-execution.json','reuse-verification.json','configuration.json','accept.py','setup-incidents.json')]+[published/'manifest.json',prior/'evidence-manifest.json',prior/'inherited-alternate-listener.py']}
v=dict(status='PASS',source=a.SOURCE,sourceTree=tested['sourceTree'],acceptedReport=a.REPORT,acceptedReportTree='76c43e94521696dd917ad03b42763b90dc3e22f7',base=tested['base'],testedCodeTree=tested['testedCodeTree'],pins=pins,imports=imports,productionClosure={p:pins[p] for p in closure},productionImportsResolved=True,publishedPayloadsVerified=len(manifest),references=references,reusedGroups=reuse['groupsReused'],reusedControls=45,behavioralGroupsReplayed=False,historicalUnchangedReproducerPassed=False,scope='Cooperative supervisor/controller protocol; no arbitrary same-UID isolation or atomic check/send claim',changedFixtureDependency=dict(path='test/fixtures/alien-menu-controller/sitecustomize.py',candidateSHA=a.sha(a.DONOR/'test/fixtures/alien-menu-controller/sitecustomize.py'),mergedTreePresent=False,reason='Outside authorized nine-file delta. Retired standalone main returns before reading clock/connecting. Recheck only four legacy tests in merged environment without historical hook; no new supervisor acceptance chain.'),python=dict(executable=sys.executable,sha256=a.sha(Path(sys.executable).resolve()),limits={k:resource.getrlimit(getattr(resource,'RLIMIT_'+k)) for k in ('DATA','AS','CPU','FSIZE')}),remaining=['Four affected legacy attachment tests','Exact staged-tree scope/blob check','Task branch and normal FF main publication'])
a.save('verification.json',v)
a.checkpoint('syntax-closure-and-receipts',testedCodeTree=tested['testedCodeTree'],verification='verification.json',remaining=v['remaining'])
print(json.dumps(dict(status='PASS',publishedPayloads=len(manifest),syntaxFiles=len(pins),resolvedProductionClosure=closure,reusedGroups=4,reusedControls=45,next='four affected legacy attachment tests')))
