from work import *
def prepare():
 c=json.loads((O/'checkpoint.json').read_text());tested=c['testedTree'];assert git('write-tree').decode().strip()==tested
 measure('precommit')
 pins={p:dict(entry=entries(tested)[p],sha256=sha(blob(tested,p))) for p in ['lib/browser-input.js','lib/renderer-input.js','lib/mem-utils.js','lib/region-map.generated.js','lib/app-files.js','lib/vfs-persistence.js','host.js','lib/file-bundle.js','lib/save-sync.js']}
 save('preserved-source-pins.json',dict(tree=tested,pins=pins,completeUnrelatedEntryProof='preservation.json'))
 diff=git('diff',MAIN,tested,'--','lib/browser-input.js');(O/'production.diff').write_bytes(diff)
 save('review.json',dict(productionDiffSHA256=sha(diff),changedProductionPaths=['lib/browser-input.js'],semantics='Accepted physical-key ownership stored before renderer callbacks; ownership deleted before release callbacks; blur/hidden cancellation releases all snapshot keys even when a callback throws; identity checks prevent nested cancellation from duplicating releases and prevent subsequent keypress after canceled ownership. Original forwarded VK and side metadata retained. Owned ups survive page-control focus changes; unowned ups ignored.',preservation='Complete Git tree-entry comparison proves every unrelated byte and mode preserved including app-files, VFS bounds and renderer.',rootRefReceipt='initial-root-ref-digest.json; root Git readonly and no later comparison required',noRuntimeClaims=True))
 save('incidents.json',[dict(kind='inspection excerpt deviation',detail='Initial combined policy/board/provenance inspection exceeded the 8192-byte excerpt preference; some tool output was truncated. Later production diff and operative helper sections were inspected in bounded excerpts. No capture gate, oracle, allocation or access control changed.'),dict(kind='conservative WAL accounting',detail='Charge all current shared WAL once, a conservative superset of positive task WAL delta; no copied donor objects or full history fetch.')])
 d=R/DOC;d.mkdir(parents=True,exist_ok=True)
 (d/'REVIEW.md').write_text(f'''# Accepted browser key ownership main publication

Publish accepted `{ACCEPT}` onto observed remote main `{MAIN}`, after the sole app-files publisher completed and released ownership. Production browser source SHA-256 is `5b2c47fa0b901f0323bc04df34ff27d8c50e47a001d77e9dcae3f2986a3477f0`. The accepted physical-key map records ownership before renderer callbacks and removes it before releases, preserving original VK and side metadata across focus changes. Blur/hidden cancellation handles nested callbacks and throwing releases without leaving other held keys stranded. This includes the original focus prerequisite and the accepted reentrant repair, unchanged.

Merged validated tree `{tested}` grafts only the accepted delta from parent `{BASE}`. Intervening app-files publication and the accepted delta are disjoint. A complete recursive Git entry comparison proves all unrelated bytes and modes preserved, including app-files, VFS predecode bounds, renderer, host, file bundle and save sync. Source pins and the full changed-entry proof are retained.

Rehashed 20 merged-review, 61 independent acceptance and 46 renderer manifest payloads. Exact accepted source, all relevant test fixtures, recursively resolved local CommonJS dependencies, installed Node and environment identities match the accepted tree. Reuse unchanged 7 PASS, independent reentrant 7 PASS, crosslayer 25 PASS and two rejecting controls, plus renderer 119 and legacy results. No acceptance group rerun and no weakened oracle. The original stale-pin rejection, pin-only fixture adaptation and three historical aggregate failures remain intact in the accepted evidence. The receipt is source/fixture evidence; actual browser and guest behavior remain unqualified.

Durable checkpoint records candidate, merged validated tree, exact source/fixture/tool identities, verified evidence and remaining checks. Finalization changes only this review directory; `ops/final-tree.json` and `ops/commit.json` record the final tree and committed manifest verification without circular hashes. Publish the task branch, verify its exact remote ref, then serialize an ordinary fast-forward main publication and verify both refs together. Any changed remote main or semantic conflict stops publication; no force push.

Fresh admission includes checkout/Git/temp/evidence, launcher/session, all current shared WAL charged once, 12 MiB future growth once, 4 MiB remaining output allowance (8 MiB before checkout) and 8 MiB reserve within 64 MiB. Flat readonly donor object stores remain standing inputs and are measured separately. Installed tools execute in place. Client 536870912 plus finite Node heap 16777216 must leave 805306368 MemAvailable; projected growth 58720256 must leave 2982150144 disk bytes. Every execution gate passed; relevant receipts bind measurements and live GPT-6.1-Sol medium 200000 total argv. Trusted dedicated SSH identity and known-hosts configuration are unchanged, with global/system Git config disabled. No mount or conditional guest command exists, so filename-bearing mount validation is inapplicable. No Node check is needed for unchanged dependencies; any affected check would be serial, 16 MiB heap and 30-second wall limit.

Remaining gates: real browser focus/removal qualification and guest/runtime/gameplay. No guest, Boat, heavy compile, service, restart, monitoring change or public deployment; platform denied SSH preserved and Claude idle. No workers launched/resumed or model switch. No test box assigned or touched; box ID/state/expiry N/A and coordinator retains shutdown ownership. Root/donors readonly except append-only messageboard. Stop after completion or exact blocker.
''')
 names=['work.py','finish.py','configuration.json','standing-tools.json','readonly-objects.json','initial-root-ref-digest.json','remote-main-initial.json','resources-precheckout.json','resources-prevalidation.json','resources-validated.json','resources-precommit.json','preservation.json','tested-tree.json','accepted-payload-verification.json','closure-reuse.json','checkpoint.json','preserved-source-pins.json','review.json','production.diff','incidents.json']
 for n in names:shutil.copyfile(O/n,d/n)
 manifest={DOC+'/'+p.name:dict(bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(d.iterdir()) if p.is_file()}
 (d/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 git('add','--',DOC);final=git('write-tree').decode().strip();delta=git('diff','--name-only',tested,final).decode().splitlines()
 assert delta and all(p.startswith(DOC+'/') for p in delta)
 save('final-tree.json',dict(testedTree=tested,finalTree=final,docsOnly=True,changedAfterValidation=delta))
 git('diff','--cached','--check','--',DOC)
 git('commit','-q','-m','Publish accepted reentrant browser key ownership preserving app-files and VFS')
 commit=git('rev-parse','HEAD').decode().strip();assert git('rev-parse','HEAD^').decode().strip()==MAIN;assert git('rev-parse','HEAD^{tree}').decode().strip()==final
 for p,e in manifest.items():
  b=blob(commit,p);assert sha(b)==e['sha256'] and len(b)==e['bytes']
 assert not git('status','--porcelain').strip()
 save('commit.json',dict(commit=commit,branch=B,parent=MAIN,testedTree=tested,finalTree=final,manifestPayloads=len(manifest),clean=True))
 print('reviewed and committed',commit,'manifest payloads',len(manifest))
def publish():
 measure('prepublication');c=json.loads((O/'commit.json').read_text());commit=c['commit']
 task=git('push','origin','HEAD:refs/heads/'+B);(O/'task-push.log').write_bytes(task)
 exact=git('ls-remote','--refs','origin','refs/heads/'+B).decode().strip();assert exact==commit+'\trefs/heads/'+B
 save('task-publication.json',dict(commit=commit,branch=B,exactRemote=exact,verified=True,ssh=SSH))
 current=git('ls-remote','--refs','origin','refs/heads/main').decode().strip()
 save('remote-prepublication.json',dict(exact=current,expected=MAIN+'\trefs/heads/main'))
 assert current==MAIN+'\trefs/heads/main','main changed; stop for reconciliation'
 git('merge-base','--is-ancestor',MAIN,commit)
 main=git('push','origin','HEAD:refs/heads/main');(O/'main-push.log').write_bytes(main)
 exact=git('ls-remote','--refs','origin','refs/heads/main','refs/heads/'+B).decode()
 assert set(exact.splitlines())=={commit+'\trefs/heads/main',commit+'\trefs/heads/'+B}
 save('publication.json',dict(commit=commit,exactRemote=exact,bothVerified=True,normalFastForward=True,force=False,ssh=SSH))
 measure('final')
 result=dict(status='COMPLETE',commit=commit,branch=B,main=commit,parent=MAIN,accepted=ACCEPT,testedTree=c['testedTree'],finalTree=c['finalTree'],docsOnlyAfterValidation=True,acceptedManifestPayloads=127,ownManifestPayloads=c['manifestPayloads'],manifest=str(R/DOC/'evidence-manifest.json'),publication=str(O/'publication.json'),preservation=str(O/'preservation.json'),sourcePins=str(O/'preserved-source-pins.json'),resources=str(O/'resources-final.json'),groupsReused=dict(unchanged=7,independentReentrant=7,crosslayer=25,rejectingControls=2,renderer='119 plus legacy'),newAcceptanceExecutions=0,historicalAggregateFailures=3,remainingGates=['actual browser focus/removal','guest/runtime/gameplay'],box=dict(id=None,state='N/A not assigned or touched',expiry=None,lifecycleOwner='coordinator'),donorsReadonly=True,rootGitUnchangedByTask=True,workers=0,ownership='RELEASED after completion board append',at=time.time())
 save('result.json',result)
 (O/'final.txt').write_text(json.dumps(result,indent=2)+'\n')
 print('COMPLETE both remote refs verified',commit)
if __name__=='__main__':globals()[sys.argv[1]]()
