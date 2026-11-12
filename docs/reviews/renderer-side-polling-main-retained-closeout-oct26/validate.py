from integrate import *
measure('prevalidation')
td=json.loads((OPS/'tested-tree.json').read_text()); tree=td['testedTree']
assert git('write-tree').decode().strip()==tree
accepted=json.loads((DONOR.parent/'ops/result.json').read_text())
oldDoc='docs/reviews/renderer-side-polling-merged-branch-oct26'
manifest=json.loads(git('show',ACCEPT+':'+oldDoc+'/evidence-manifest.json'))
verified=[]
for name,row in manifest.items():
 path=oldDoc+'/'+name;b=git('show',ACCEPT+':'+path)
 assert sha(b)==row['sha256'] and len(b)==row['bytes']
 assert git('show',tree+':'+path)==b
 verified.append({'path':path,**row})
write('accepted-payload-verification.json',{'accepted':ACCEPT,'count':len(verified),'payloads':verified})
pins=json.loads((DONOR.parent/'ops/sourcepins.json').read_text())
closure=['lib/renderer-input.js','lib/mem-utils.js','lib/region-map.generated.js']+[p for p in pins['changedPaths'] if p.startswith('test/')]
rows=[]
for p in closure:
 a=git('ls-tree',ACCEPT,'--',p).decode().strip();b=git('ls-tree',tree,'--',p).decode().strip();assert a==b
 data=git('show',tree+':'+p)
 if p=='lib/renderer-input.js': assert sha(data)==accepted['sourceRendererSha256']
 else: assert sha(data)==pins['dependenciesAndFixtures'][p]['sha256']
 rows.append({'path':p,'modeAndBlob':b,'sha256':sha(data)})
context=[]
for p in ['package.json','lib/package.json','test/package.json']:
 a=git('ls-tree',ACCEPT,'--',p);b=git('ls-tree',tree,'--',p);assert a==b
 context.append({'path':p,'modeAndBlob':b.decode().strip(),'absent':not b})
assert not os.environ.get('WINE_REGION_MAP') and not os.environ.get('NODE_OPTIONS')
checkpoint=json.loads((DONOR.parent/'ops/checkpoint.json').read_text())
for group in checkpoint['groups']:
 for filename,key in [(group['log'],'logSha256'),(group['name']+'.stderr','stderrSha256')]:
  data=(DONOR.parent/'ops'/filename).read_bytes();assert sha(data)==group[key]
  assert git('show',ACCEPT+':'+oldDoc+'/evidence/'+filename)==data
 assert group['accepted'] and group['testedTree']==accepted['testedTree']
for p in ['legacy-keyboard-message-lparam.cjs','run-legacy.cjs','aggregate-latch-repro.cjs']:
 assert git('show',ACCEPT+':'+oldDoc+'/evidence/'+p)==(DONOR.parent/'ops'/p).read_bytes()
node=json.loads((OPS/'standing-tools.json').read_text())['node']
assert node['sha256']==accepted['standingTools']['node']['sha256']
incoming=git('diff','--name-only',PARENT,BASE).decode().splitlines()
changed=git('diff','--name-only',BASE,tree).decode().splitlines()
expected=git('diff','--name-only',PARENT,ACCEPT).decode().splitlines();assert changed==expected
assert not set(incoming)&set(expected)
sourceChanges=[p for p in incoming if not p.startswith('docs/')]
assert sourceChanges and all(p=='host.js' or p.startswith('test/file-bundle-') for p in sourceChanges)
write('closure-reuse.json',{'acceptedCommit':ACCEPT,'acceptedTestedTree':accepted['testedTree'],'acceptedFinalTree':accepted['finalTree'],'mergedTestedTree':tree,'closure':rows,'packageContext':context,'node':node,'environmentOverridesAbsent':['WINE_REGION_MAP','NODE_OPTIONS'],'unchangedExternalFixtures':['legacy-keyboard-message-lparam.cjs','run-legacy.cjs','aggregate-latch-repro.cjs'],'reusedGroups':checkpoint['groups'],'119PlusLegacyReused':True,'newTestExecutions':0,'affectedMergedCompatibilityChecks':[],'reason':'Intervening parser host.js and its tests/docs have no path overlap or dependency edge into the exact renderer test closure. No rerun warranted.'})
write('preservation.json',{'base':BASE,'tree':tree,'incomingParserPaths':incoming,'acceptedChangedPaths':expected,'actualChangedPaths':changed,'intersection':[],'allOtherTrackedBytesAndModesUnchanged':True,'proof':'git diff --name-only BASE TREE equals exact accepted diff paths; immutable tree entries outside this set are identical. Parser host/save/browser/VFS and all unrelated production files preserved.','rawChangedModesAndObjects':git('diff','--raw','--no-abbrev',BASE,tree).decode()})
assert not git('diff','--check','--cached','--','lib','test')
check=S.run(['git','-C',str(REPO),'diff','--check','--cached'],env=ENV,stdout=S.PIPE,stderr=S.PIPE)
assert check.returncode==2 and not check.stderr
oldcheck=S.run(['git','-C',str(REPO),'diff','--check',PARENT,ACCEPT],env=ENV,stdout=S.PIPE,stderr=S.PIPE)
assert check.stdout==oldcheck.stdout
write('historical-whitespace.json',{'unchangedAcceptedWarnings':check.stdout.decode(),'sourceAndTestsClean':True,'retainedBytesUnmodified':True})
root=json.loads(run(['python3','/home/user/wine-assembly/scratch/usage-watch/stream-root-ref-digest.py']))
initial=json.loads(P.Path('/home/user/wine-assembly/scratch/usage-watch/renderer-side-polling-main-retained-closeout-oct26/root-ref-digest.json').read_text())
assert root['sha256']==initial['sha256'];write('root-ref-comparison.json',{'initial':initial,'current':root,'unchanged':True})
doc=REPO/DOC;doc.mkdir(parents=True,exist_ok=True)
(doc/'REVIEW.md').write_text(f'''# Renderer side modifier polling integration

Accepted renderer commit {ACCEPT}, parent {PARENT}, is reconciled onto parser main {BASE}. The accepted diff applied without conflict; all other tracked bytes and modes are preserved, including parser/host/file-bundle/save/browser/VFS production changes.

Merged tested tree: {tree}. Validation reuses immutable 119 targeted passing tests and legacy keyboard-message PASS at Node 16MiB. All renderer inputs, four fixtures, both transitive modules, package context, external legacy/diagnostic fixtures, and installed Node identity match the accepted execution closure. Parser-only intervening changes have no dependency intersection. No duplicate acceptance, packaging tests, build, guest or gameplay execution occurred.

The aggregate VK16/17/18 queued-delivery lowbit diagnostic retains its three historical expected FAILs on both accepted parents. This integration preserves those semantics.

See closure-reuse.json for commands, hashes and accepted provenance; preservation.json for exact tree comparison; accepted-payload-verification.json for 46 verified committed payloads. The final tree adds only this review directory to the merged tested tree. ops/result.json records final tree, commit and verified remote refs after normal fast-forward publication.

Remaining gates: separately authorized browser/runtime/guest qualification and gameplay. No box assigned; shutdown ownership remains with coordinator. Stop after publication; no successor assignment.
''')
(doc/'RECOVERY.md').write_text(f'''# Recovery

Immutable accepted commit: {ACCEPT}. Main base: {BASE}. Borrowed flat read-only object stores are recorded in ops/readonly-objects.json. No root or donor refs/index/worktree were written.

Evidence and finite integration scripts are retained at {OPS}; source donor is {DONOR}. Retained accepted payloads and manifest remain committed under {oldDoc}. Checkout the published task branch to recover production and documentation; ops/result.json supplies exact publication identities. Do not rerun the 119 tests unless their recorded dependency closure changes. No runtime claim or box lifecycle action.
''')
for p in ['tested-tree.json','closure-reuse.json','preservation.json','accepted-payload-verification.json','configuration.json','standing-tools.json','root-ref-comparison.json','resources-precheckout.json','resources-prevalidation.json','readonly-objects.json','historical-whitespace.json']:
 shutil.copyfile(OPS/p,doc/p)
for p in ['integrate.py','validate.py']:shutil.copyfile(OPS/p,doc/p)
m={str(p.relative_to(doc)):{'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in doc.rglob('*') if p.is_file()}
(doc/'evidence-manifest.json').write_text(json.dumps(m,indent=2)+'\n')
git('add','--',DOC)
final=git('write-tree').decode().strip(); docs=git('diff','--name-only',tree,final).decode().splitlines();assert docs and all(p.startswith(DOC+'/') for p in docs)
write('final-tree.json',{'testedTree':tree,'finalTree':final,'docsOnlyPaths':docs,'acceptedFinalTree':accepted['finalTree'],'acceptedTestedTree':accepted['testedTree']})
measure('prepublication')
print('VALIDATION PASS; reused119+legacy; final tree',final)
