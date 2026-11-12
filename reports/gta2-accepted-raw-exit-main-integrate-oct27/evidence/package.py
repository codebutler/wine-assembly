import pathlib,json,hashlib,shutil
root=pathlib.Path('/tmp/gta2-accepted-raw-exit-main-integrate-oct27');ops=root/'ops'
report=root/'repo/reports/gta2-accepted-raw-exit-main-integrate-oct27';ev=report/'evidence';ev.mkdir(parents=True,exist_ok=True)
r=json.loads((ops/'readiness.json').read_text());a=json.loads((ops/'accepted-receipt-manifest.json').read_text());checks=json.loads((ops/'checkpoint.json').read_text());assert not checks['remaining']
for name,pin in r['pins'].items():
 assert hashlib.sha256((root/'repo'/name).read_bytes()).hexdigest()==pin['sha256'],name
payloads=[]
for p in sorted(ops.iterdir()):
 if p.is_file() and p.name not in ['board-watch.stdout','board-watch.stderr','receipt-manifest.json'] and p.suffix in ['.json','.stdout','.stderr','.py','.js','.txt','.diff','.supervisor-output']:
  d=ev/p.name;shutil.copyfile(p,d);payloads.append({'path':'evidence/'+p.name,'bytes':d.stat().st_size,'sha256':hashlib.sha256(d.read_bytes()).hexdigest()})
prod=json.loads((ops/'production-boundary.stdout').read_text().splitlines()[0]);assert prod['sourceSHA256']==r['pins']['test/run.js']['sha256']
m={
 'status':'MERGED_PRODUCTION_SOURCE_QUALIFIED',
 'mainParent':r['main'],'candidate':r['candidate'],'base':r['base'],
 'acceptedCommit':r['acceptedCommit'],'acceptedManifestSHA256':r['acceptedManifestSHA256'],
 'acceptedPins':r['pins'],
 'newChecks':[{'name':x['name'],'exit':x['result']['exit'],'cleanupComplete':x['result']['cleanupComplete'],'peakRSS':x['result']['peakRSS'],'receipt':'evidence/'+x['name']+'.json'} for x in checks['completed']],
 'startup':'evidence/node-startup.json','extractions':prod['spans'],
 'review':'evidence/source-review.txt','fixtureRelocation':'evidence/fixture-relocation.json',
 'reused':{'independentAcceptedPayloads':42,'producerGroups':11,'producerControls':6,'producerPayloads':70,'predecessorPayloads':9276,'originalBaseRejection':'independent accepted expected exit1; unchanged base input; not repeated','independentAcceptanceManifest':'evidence/accepted-receipt-manifest.json','reason':'Only merged production runner changed; all unchanged passing acceptance reused'},
 'payloads':payloads,
 'incidents':a['incidents']+['Own package-generator quoting SyntaxError prevented script creation; first supervised package attempt exit2 missing file. Subsequent staging exit128 missing report. Both original receipts retained. Corrected only packaging, no source/test/assertion changes or repeated checks.'],
 'resource':{'allocation':268435456,'futureAllowance':159383552,'physicalNode':805306368,'heapNode':536870912,'nodeDataAndAS':'unlimited; measured exact startup','gitPhysical':268435456,'gitData':536870912,'gitDataScope':'Git subprocess only','pythonPhysical':134217728,'cpuSeconds':90,'wallSeconds':120,'fileBytes':25165824,'outputBytes':2097152,'pool':'one permit Python/Node; two Git plus flock','admission':'evidence/*admission.json; client current RSS excluded from growth; current WAL conservatively charged once'},
 'sourceScope':['test/run.js','test/test-api-exit-observer.js','docs/tracing.md'],
 'treePreservation':'Index seeded from immutable exact main; only explicit source paths and this report staged. Metadata-only full-tree delta required before commit-tree; unchanged missing blob references preserved.',
 'publication':{'taskBranch':'refs/heads/task/gta2-accepted-raw-exit-main-integrate-oct27','main':'refs/heads/main','requiredOldMain':r['main'],'method':'tested task push, exact remote verify; refresh exact main then conditional non-force fast-forward; exact verify both','postCommitCloseout':'/tmp/gta2-accepted-raw-exit-main-integrate-oct27/ops/publication-closeout.json','cycleAvoidance':'This immutable precommit manifest does not claim its own commit. External closeout binds this manifest hash to actual commit/ref, metadata scope and cleanup receipts.'},
 'runtime':{'guest':0,'compiler':0,'boatActions':0,'assignedBox':None,'lifecycleOwner':'coordinator','realGTA2HRESULT':None,'gameplay':False},
 'remaining':['fresh coordinator-assigned runtime readiness and admission','observe actual GTA2 raw return and gameplay; unknown here']
}
raw=json.dumps(m,indent=2)+'\n';assert not (ops/'receipt-manifest.json').exists()
(ops/'receipt-manifest.json').write_text(raw);(report/'receipt-manifest.json').write_text(raw)
(report/'README.md').write_text('''# GTA2 raw API-exit observation: current-main integration

Source qualification only. Merged accepted candidate e99799cd onto exact main 03d86580, preserving the Airstrike input-state callback and every unrelated tree entry. No actual GTA2 HRESULT or gameplay is established.

New checks passed on the pinned merged runner: exact Node startup and syntax, unchanged production-boundary reproducer first, full API-exit fixture, independent causal and remaining controls, real typed GetClientRect pointer/ESP churn, and the affected Airstrike input-consumption-state fixture. Independent acceptance 12586737 and producer/predecessor passing groups are reused.

`receipt-manifest.json` binds source/dependency/extraction pins, commands, results, resource admission and retained diagnostics. Fixture relocation changes only the literal repository root; assertions are unchanged. This report contains only this task's compact evidence and references original incidents. Fixtures use installed Node v24.18.1 and heap512 with extracted callbacks and stub memory/registers, never a guest.

Publication requires unchanged remote main and an exact metadata tree-delta check. External `/tmp/gta2-accepted-raw-exit-main-integrate-oct27/ops/publication-closeout.json` records actual commit, verified remote refs and cleanup without a circular self-commit claim. No assigned box; coordinator retains runtime lifecycle ownership.
''')
print(json.dumps({'payloads':len(payloads),'manifestSHA256':hashlib.sha256(raw.encode()).hexdigest()}))
