from work import *
def prepare():
 tested=json.loads((O/'tested-tree.json').read_text())['testedTree'];assert git('write-tree').decode().strip()==tested
 measure('precommit')
 d=R/DOC;d.mkdir(parents=True,exist_ok=True)
 pins={p:dict(entry=entries(tested)[p],sha256=sha(blob(tested,p))) for p in ['lib/app-files.js','lib/vfs-persistence.js','host.js','lib/browser.js','lib/file-bundle.js','lib/save-sync.js'] if p in entries(tested)}
 save('preserved-source-pins.json',dict(tree=tested,pins=pins,completeUnrelatedEntryProof='preservation.json'))
 save('review.json',dict(productionDiff=git('diff',MAIN,tested,'--','lib/app-files.js').decode(),changedProductionPaths=['lib/app-files.js'],semanticReview='Empty alias array now falls through to singular vfsPath or URL basename, matching unchanged host.loadFiles. Nonempty alias normalization and URL policy remain exact accepted implementation.',fixtureReview='Exact wrapper source reviewed: only one full-host identity guard adapted in memory; original accepted test assertions remain unchanged.',rootRefReceipt='initial-root-ref-digest.json; no root Git writes or later comparison required',noRuntimeClaims=True))
 save('incidents.json',[dict(kind='inspection capture deviation',detail='Initial combined provenance reads exceeded the 8192-byte excerpt requirement and tool output was truncated. Later required source diff/wrapper was reviewed with bounded content. No assertions, access or resource gates were changed.'),dict(kind='conservative accounting',detail='Full current shared WAL charged once rather than subtracting an uncertain dispatch baseline; includes all positive task WAL growth. No borrowed object bytes copied.')])
 (d/'REVIEW.md').write_text(f'''# Publish accepted app-files fallback on current main

The accepted empty-alias fallback from `{ACCEPT}` is applied to current main `{MAIN}`. Empty vfsPaths now falls through to vfsPath or the literal URL basename, consistently with host.loadFiles. Nonempty aliases retain their existing behavior. The accepted production SHA-256 is `4c1ce40b92aa990a4bc689bd98d5c0d92ab3af44dafeb93ca52ccbaf2c6124f7`.

Validated merged tree `{tested}` retains every unrelated Git byte and mode from main. The accepted delta and intervening VFS delta relative to `{BASE}` are disjoint. VFS bounds remain SHA-256 `2224f8b74469606696065ea799931bc192982a608dc2a7ec0e9a690d20a4552e`; renderer, host, file bundle, save sync and browser changes are preserved. See the complete changed-entry proof and source pins.

All 24 accepted merged-review manifest payloads were rehashed. The full host, app-files, both original fixtures, compatibility wrapper, recursively resolved local CommonJS dependencies and installed Node executable match the accepted evidence exactly. Reuse merged supplied 7 PASS, independent 8 PASS and 3 rejecting mutants; no acceptance group was rerun. The 16464-byte loadFiles method remains exact. Existing historical evidence is retained verbatim. These fixture results do not qualify actual runtime or gameplay.

Finalization adds this review directory only. Exact final tree, commit, manifest rehash and remote refs are retained in sibling `ops/final-tree.json`, `ops/commit.json`, `ops/publication.json` and `ops/result.json` to avoid circular hashes. Publication is the coherent task branch followed by serialized ordinary fast-forward main with trusted SSH and exact remote verification; no force option. Initial remote main was observed once. Sole main ownership was assigned after VFS owner release; other integrations are branch-only.

Fresh resource checks charge checkout/Git, temporary/evidence files, launcher/session, all current shared WAL once, future 12 MiB once, remaining output growth and 8 MiB reserve inside 64 MiB. Readonly flat donor objects and installed tools execute in place. Memory admission reserves 536870912-byte client plus 16777216-byte Node heap and leaves at least 805306368 bytes; 58720256 projected disk growth leaves at least 2982150144 bytes. No Node test, compile or guest execution is needed for unchanged dependencies. See configuration.json for live gpt-6.1-sol medium 200000 total argv and fixed access/size limits.

Remaining gates are actual browser persistence across reload/restart and storage failures, runtime and gameplay. No guest, Boat, heavy compile, services, monitoring changes, restart or public deployment; denied SSH remains untouched and Claude idle. No worker launched, refilled or resumed. No test box assigned (ID/state/expiry N/A); coordinator retains all lifecycle/shutdown ownership. Root and donors remain readonly except append-only root messageboard. Stop after publication and durable receipt.
''')
 names=['work.py','finish.py','configuration.json','standing-tools.json','readonly-objects.json','initial-root-ref-digest.json','remote-main-initial.json','resources-precheckout.json','resources-prevalidation.json','resources-validated.json','resources-precommit.json','preservation.json','tested-tree.json','accepted-payload-verification.json','closure-reuse.json','checkpoint.json','preserved-source-pins.json','review.json','incidents.json']
 for n in names:shutil.copyfile(O/n,d/n)
 manifest={p.name:dict(bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(d.iterdir()) if p.is_file()}
 (d/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 git('add','--',DOC);final=git('write-tree').decode().strip();delta=git('diff','--name-only',tested,final).decode().splitlines();assert delta and all(p.startswith(DOC+'/') for p in delta)
 save('final-tree.json',dict(testedTree=tested,finalTree=final,docsOnly=True,changedAfterValidation=delta))
 git('diff','--cached','--check','--',DOC)
 git('commit','-q','-m','Publish accepted app-files empty-alias fallback preserving VFS bounds')
 commit=git('rev-parse','HEAD').decode().strip();assert git('rev-parse','HEAD^').decode().strip()==MAIN;assert git('rev-parse','HEAD^{tree}').decode().strip()==final
 for p,e in manifest.items():
  b=blob(commit,DOC+'/'+p);assert sha(b)==e['sha256'] and len(b)==e['bytes']
 assert not git('status','--porcelain').strip()
 save('commit.json',dict(commit=commit,branch=B,parent=MAIN,testedTree=tested,finalTree=final,manifestPayloads=len(manifest),clean=True))
 print('reviewed and committed',commit)
def publish():
 measure('prepublication');c=json.loads((O/'commit.json').read_text());commit=c['commit']
 # Commit is a child of the observed sole-owner main; Git independently rejects non-FF races.
 task=git('push','origin','HEAD:refs/heads/'+B);(O/'task-push.log').write_bytes(task)
 exact=git('ls-remote','--refs','origin','refs/heads/'+B).decode().strip();assert exact==commit+'\trefs/heads/'+B
 save('task-publication.json',dict(commit=commit,branch=B,exactRemote=exact,verified=True,ssh=SSH))
 main=git('push','origin','HEAD:refs/heads/main');(O/'main-push.log').write_bytes(main)
 exact=git('ls-remote','--refs','origin','refs/heads/main','refs/heads/'+B).decode();assert set(exact.splitlines())=={commit+'\trefs/heads/main',commit+'\trefs/heads/'+B}
 save('publication.json',dict(commit=commit,exactRemote=exact,bothVerified=True,normalFastForward=True,force=False,ssh=SSH))
 measure('final')
 result=dict(status='COMPLETE',commit=commit,branch=B,main=commit,parent=MAIN,accepted=ACCEPT,testedTree=c['testedTree'],finalTree=c['finalTree'],docsOnlyAfterValidation=True,acceptedManifestPayloads=24,ownManifestPayloads=c['manifestPayloads'],manifest=str(R/DOC/'evidence-manifest.json'),publication=str(O/'publication.json'),preservation=str(O/'preservation.json'),sourcePins=str(O/'preserved-source-pins.json'),resources=str(O/'resources-final.json'),reused=['merged supplied7PASS','merged independent8PASS','3 rejecting mutants'],newAcceptanceExecutions=0,remainingGates=['browser persistence reload/restart/storage failure','runtime/gameplay'],box=dict(id=None,state='not assigned',expiry=None,lifecycleOwner='coordinator'),donorsReadonly=True,rootGitUnchangedByTask=True,workers=0,ownership='RELEASED after completion board append',at=time.time())
 save('result.json',result)
 (O/'final.txt').write_text(f'COMPLETE {commit}\nPublished {B} and normal FF main; exact trusted remote refs both verified.\nTested tree {c["testedTree"]}; final tree {c["finalTree"]}; docs-only finalization proven.\n24 accepted and {c["manifestPayloads"]} own manifest payloads rehashed. Exact source/test/dependency/Node closure retains 7+8 PASS and 3 rejecting controls; no duplicate tests. Every unrelated byte/mode and VFS bounds source preserved.\nBrowser persistence/runtime/gameplay gates remain. No boxes or lifecycle mutation. Main ownership released; stop.\n')
 print('COMPLETE',commit)
if __name__=='__main__':globals()[sys.argv[1]]()
