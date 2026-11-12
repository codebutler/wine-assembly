from work import *
def prepare():
 c=json.loads((O/'checkpoint-validated.json').read_text());tree=c['testedTree'];assert txt('write-tree')==tree
 measure('precommit')
 ent=entries(tree)
 pins={p:dict(entry=ent[p],bytes=len(blob(tree,p)),sha256=sha(blob(tree,p))) for p in ['lib/vfs-persistence.js','lib/app-files.js','lib/browser-input.js','lib/renderer-input.js','lib/browser-shell.js','lib/filesystem.js','host.js','lib/file-bundle.js','lib/save-sync.js']}
 for p in pins:
  if p!=SOURCE:assert ent[p]==entries(MAIN)[p]
 save('preserved-source-pins.json',dict(testedTree=tree,pins=pins,completeEntryProof='preservation.json'))
 diff=git('diff',MAIN,tree,'--',SOURCE);assert len(diff)<8192;(O/'production.diff').write_bytes(diff)
 git('diff','--check',MAIN,tree,'--',SOURCE)
 save('review.json',dict(productionDiffSHA256=sha(diff),changedProductionPaths=[SOURCE],semantics='Sole production delta adds tx.onabort rejection with original transaction error or fallback Error; existing oncomplete publication and onerror behavior retained byte-for-byte. Accepted tests establish partial rows unpublished and single promise settlement. Restore bounds and all other production behavior preserved.',productionSha256=SOURCE_SHA,semanticResolutions=0,rootRefReceipt='initial-root-ref-digest.json; root Git readonly by task, no later comparison needed',noRuntimeClaims=True))
 save('incidents.json',dict(historical='Original first failures/mutants and prior provider-capacity interruption preserved byte-for-byte in accepted committed evidence.',current='No merge conflict, acceptance failure or access denial. Initial combined read-only policy/provenance inspection exceeded the requested 8192-byte excerpt size; subsequent production review uses bounded excerpts. No capture bound or resource allocation increased.',mounts='No mount or conditional guest argv exists; canonical filename parser inapplicable. No denied SSH/resume retried.'))
 d=R/DOC;d.mkdir(parents=True,exist_ok=True)
 (d/'REVIEW.md').write_text(f'''# Accepted VFS read-abort main publication

Publish accepted merge `{ACCEPT}` onto verified remote main `{MAIN}` after the browser main owner released ownership. Actual conflict-free merged validated tree is `{tree}`. Accepted tested tree `{ACCEPT_TESTED}` and final tree `{ACCEPT_TREE}` differ only in the accepted review directory; that proof is retained. No semantic conflict resolution or new behavior was introduced.

The only production delta from main is `tx.onabort = () => reject(tx.error || new Error('indexedDB transaction aborted'))` in the IndexedDB cursor read promise. Production SHA-256 `{SOURCE_SHA}` equals the exact accepted source. The original error or fallback Error rejects aborted reads; existing completion publishes rows and existing error behavior is unchanged. Accepted tests cover abort rejection, partial rows remaining unpublished, and terminal settlement. The previously published bounded restore validator remains byte-for-byte preserved. Complete recursive Git entry comparison enumerates all changed paths and modes; every incoming entry equals acceptance, and every other byte and mode equals current main, including app-files, browser input, renderer, host, filesystem, file bundle and save sync.

Rehashed 77 committed accepted payloads: 14 merged closeout, 23 independent acceptance, 17 repair and 23 bounded restore. All accepted production, fixtures, recursively resolved local CommonJS dependencies and installed Node/Git/Python identities match. Reuse repair 13 PASS, independent 12 PASS, persistence PASS and restore PASS. Wrong-identity and early-partial mutants retain expected 9 PASS/3 FAIL and 5 PASS/7 FAIL; repair baseline and mutant retain expected 9 PASS/4 FAIL. No duplicate acceptance groups executed and no weakened oracles. No relevant dependency changed, so no additional merged compatibility execution was required. Source, fixture, dependency, tool, manifest and remaining-check identities are checkpointed in this review.

Finalization changes only this review directory. `evidence-manifest.json` hashes every payload here except itself and binds the validated tree through `tested-tree.json` and `checkpoint-validated.json`. The exact final tree, docs-only delta, commit, manifest identity and verification of each committed payload are retained in sibling `/tmp/vfs-read-abort-main-publication-oct26/ops/commit.json` and `final-tree.json`; keeping the final tree outside its own hashed tree avoids a circular identity. First publish and exactly verify the task branch, then verify unchanged remote main and perform an ordinary fast-forward main push. Finally exactly verify both remote refs together. No force push.

Fresh resource and configuration gates cover checkout/Git/temp/evidence, local and remote publication staging, launcher/session bytes and positive WAL growth once, 12 MiB future growth once, 4 MiB remaining output allowance (8 MiB precheckout), and 8 MiB reserve within the hard 64 MiB allocation. Flat readonly object donors and installed executables are measured standing inputs, not copied. Remote pack staging is covered by the remaining allowance and measured as a bounded pack estimate before publication. Client 536870912 plus finite Node heap 16777216 must leave 805306368 MemAvailable; projected 58720256-byte growth must leave 2982150144 free disk bytes. Dedicated trusted SSH identity/known-hosts and strict checking are preserved. Actual live GPT-6.1-Sol medium 200000 total argv is recorded. No guest or mount invocation exists; filename parser is inapplicable. No Node/native/Boat execution is needed for unchanged identities.

Remaining gates: real browser IndexedDB durability through reload/restart, storage failures, runtime and gameplay. Fixture results do not establish these outcomes. No public deployment, service restart, monitoring changes, denied SSH/resume retries or workers. Claude remains idle. No test box assigned or touched; box ID/state/expiry N/A, coordinator retains lifecycle/shutdown ownership. Root and donor Git remain readonly except append-only root messageboard. Recovery uses the retained isolated checkout, readonly flat object paths and committed bounded recipes. Stop after exact publication or source-backed blocker.
''')
 names=['work.py','finish.py','admission-baseline.json','configuration.json','standing-tools.json','readonly-objects.json','initial-root-ref-digest.json','remote-main-initial.json','resources-precheckout.json','resources-merged.json','resources-prevalidation.json','resources-validated.json','resources-precommit.json','preservation.json','tested-tree.json','checkpoint-merged.json','accepted-payload-verification.json','closure-reuse.json','checkpoint-validated.json','preserved-source-pins.json','review.json','production.diff','incidents.json']
 for n in names:shutil.copyfile(O/n,d/n)
 manifest={DOC+'/'+p.name:filehash(p) for p in sorted(d.iterdir()) if p.is_file()}
 (d/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 git('add','--',DOC);final=txt('write-tree');delta=git('diff','--name-only',tree,final).decode().splitlines()
 assert delta and all(p.startswith(DOC+'/') for p in delta)
 save('final-tree.json',dict(testedTree=tree,finalTree=final,docsOnly=True,changedAfterValidation=delta))
 git('diff','--cached','--check','--',DOC)
 commit=txt('commit-tree',final,'-p',MAIN,'-p',ACCEPT,'-m','Publish accepted VFS read-abort rejection preserving browser and app-files')
 git('update-ref','refs/heads/'+B,commit,MAIN)
 assert txt('rev-parse','HEAD^{tree}')==final
 for p,e in manifest.items():
  data=blob(commit,p);assert dict(bytes=len(data),sha256=sha(data))==e
 assert not git('status','--porcelain').strip()
 save('commit.json',dict(commit=commit,branch=B,parents=[MAIN,ACCEPT],testedTree=tree,finalTree=final,manifestPayloads=len(manifest),manifestPath=DOC+'/evidence-manifest.json',manifest=filehash(d/'evidence-manifest.json'),everyCommittedPayloadRehashed=True,clean=True))
 print('reviewed and committed',commit,'manifest payloads',len(manifest))
def publish():
 measure('prepublication');c=json.loads((O/'commit.json').read_text());commit=c['commit']
 # Bound local streamed pack and the equivalent remote staging without copying history.
 pack=O/'publication.pack'
 with pack.open('wb') as out:
  p=S.run(['git','-C',str(R),'pack-objects','--stdout','--revs','--thin','--delta-base-offset','--window-memory=16m','--threads=1'],input=(commit+'\n^'+MAIN+'\n^'+ACCEPT+'\n').encode(),stdout=out,stderr=S.PIPE,env=ENV,timeout=90)
 assert p.returncode==0 and len(p.stderr)<=8192
 n=pack.stat().st_size;assert n*2<=4194304,('publication staging allowance',n)
 save('publication-staging.json',dict(packBytes=n,sha256=filehash(pack)['sha256'],localPlusRemote=2*n,coveredByRemainingAllowance=4194304,remoteAlreadyHasParents=[MAIN,ACCEPT],noHistoryFetch=True))
 pack.unlink()
 measure('publication-staging')
 out=git('push','origin','HEAD:refs/heads/'+B);(O/'task-push.log').write_bytes(out)
 exact=txt('ls-remote','--refs','origin','refs/heads/'+B);assert exact==commit+'\trefs/heads/'+B
 save('task-publication.json',dict(commit=commit,branch=B,exactRemote=exact,verified=True,ssh=SSH))
 current=txt('ls-remote','--refs','origin','refs/heads/main')
 save('remote-prepublication.json',dict(exact=current,expected=MAIN+'\trefs/heads/main'))
 assert current==MAIN+'\trefs/heads/main','main moved: stop for reconciliation'
 git('merge-base','--is-ancestor',MAIN,commit)
 out=git('push','origin','HEAD:refs/heads/main');(O/'main-push.log').write_bytes(out)
 exact=txt('ls-remote','--refs','origin','refs/heads/main','refs/heads/'+B)
 assert set(exact.splitlines())=={commit+'\trefs/heads/main',commit+'\trefs/heads/'+B}
 save('publication.json',dict(commit=commit,exactRemote=exact,bothVerified=True,normalFastForward=True,force=False,ssh=SSH,**{k:c[k] for k in ['testedTree','finalTree','manifest','manifestPayloads']}))
 res=measure('final')
 result=dict(status='COMPLETE',commit=commit,branch=B,main=commit,parents=[MAIN,ACCEPT],testedTree=c['testedTree'],finalTree=c['finalTree'],docsOnlyAfterValidation=True,acceptedManifestPayloads=77,ownManifestPayloads=c['manifestPayloads'],manifest=str(R/DOC/'evidence-manifest.json'),publication=str(O/'publication.json'),preservation=str(O/'preservation.json'),resources=str(O/'resources-final.json'),projectedPeak=res['projectedPeak'],groupsReused=json.loads((O/'closure-reuse.json').read_text())['groupsReused'],newAcceptanceExecutions=0,remainingGates=['real browser durability/reload/restart','storage failures','runtime/gameplay'],box=dict(id=None,state='N/A not assigned or touched',expiry=None,lifecycleOwner='coordinator'),rootDonorsReadonly=True,workers=0,ownership='RELEASED after completion board append',at=time.time())
 save('result.json',result);(O/'final.txt').write_text(json.dumps(result,indent=2)+'\n')
 print('COMPLETE both refs verified',commit,'peak',res['projectedPeak'])
if __name__=='__main__':globals()[sys.argv[1]]()
